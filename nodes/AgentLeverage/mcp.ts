/**
 * Stateless MCP Streamable-HTTP client for Agent Leverage.
 *
 * The production endpoint is `POST /api/mcp` with
 * `Authorization: Bearer agl_…`. mcp-handler is configured with
 * `sessionIdGenerator: undefined`, so `tools/call` needs no initialize
 * handshake and no `mcp-session-id`. Accept MUST list both
 * `application/json` and `text/event-stream`; responses are often
 * SSE-framed (`data: {json}`).
 */

export const DEFAULT_API_URL = "https://www.agentleverage.co";
export const MCP_PATH = "/api/mcp";

export interface JsonRpcError {
	code: number;
	message: string;
}

export interface McpToolResult {
	payload: unknown;
	isError: boolean;
	text: string;
}

export interface McpHttpResponse {
	statusCode: number;
	contentType?: string;
	body: string;
}

export interface McpHttpRequest {
	method: "POST";
	url: string;
	headers: Record<string, string>;
	body: string;
}

export type McpTransport = (request: McpHttpRequest) => Promise<McpHttpResponse>;

export function mcpEndpoint(apiUrl: string): string {
	return `${apiUrl.replace(/\/+$/, "")}${MCP_PATH}`;
}

export function buildToolsCallBody(
	id: number,
	name: string,
	args: Record<string, unknown>,
): string {
	return JSON.stringify({
		jsonrpc: "2.0",
		id,
		method: "tools/call",
		params: { name, arguments: args },
	});
}

export function mcpRequestHeaders(): Record<string, string> {
	return {
		Accept: "application/json, text/event-stream",
		"Content-Type": "application/json",
	};
}

export function extractJsonRpcMessage(
	body: string,
	id: number,
	contentType?: string,
): { result?: unknown; error?: JsonRpcError } | null {
	const candidates: string[] = [];
	if (contentType?.includes("application/json")) {
		candidates.push(body);
	} else {
		for (const line of body.split("\n")) {
			const trimmed = line.trim();
			if (trimmed.startsWith("data:")) {
				candidates.push(trimmed.slice(5).trim());
			}
		}
		if (candidates.length === 0 && body.trim()) {
			candidates.push(body.trim());
		}
	}

	for (const raw of candidates) {
		if (!raw) {
			continue;
		}
		try {
			const parsed = JSON.parse(raw) as {
				id?: unknown;
				result?: unknown;
				error?: JsonRpcError;
			};
			if (parsed && typeof parsed === "object" && parsed.id === id) {
				return parsed;
			}
		} catch {
			// keep scanning
		}
	}
	return null;
}

export function parseToolResult(result: unknown): McpToolResult {
	const envelope = (result ?? {}) as {
		content?: Array<{ type: string; text?: string }>;
		structuredContent?: unknown;
		isError?: boolean;
	};
	const text = envelope.content?.find((c) => c.type === "text")?.text ?? "";
	let payload = envelope.structuredContent;
	if (payload === undefined && text) {
		try {
			payload = JSON.parse(text);
		} catch {
			payload = undefined;
		}
	}
	return {
		payload: payload ?? (text ? { text } : result),
		isError: envelope.isError === true,
		text,
	};
}

export async function callMcpTool(
	transport: McpTransport,
	options: {
		apiUrl: string;
		id?: number;
		name: string;
		args: Record<string, unknown>;
	},
): Promise<McpToolResult> {
	const id = options.id ?? 1;
	const url = mcpEndpoint(options.apiUrl);
	const response = await transport({
		method: "POST",
		url,
		headers: mcpRequestHeaders(),
		body: buildToolsCallBody(id, options.name, options.args),
	});

	if (response.statusCode === 401) {
		throw new Error(
			`HTTP 401 Unauthorized from ${url} — the agl_ API token was rejected.`,
		);
	}

	const message = extractJsonRpcMessage(
		response.body,
		id,
		response.contentType,
	);
	if (!message) {
		throw new Error(
			`No JSON-RPC message for id=${id} (HTTP ${response.statusCode}).`,
		);
	}
	if (message.error) {
		throw new Error(
			`JSON-RPC error (${message.error.code}) on ${options.name}: ${message.error.message}`,
		);
	}

	const parsed = parseToolResult(message.result);
	if (parsed.isError) {
		throw new Error(
			parsed.text || `Agent Leverage tool ${options.name} returned isError`,
		);
	}
	return parsed;
}

export function omitEmpty(
	input: Record<string, unknown>,
): Record<string, unknown> {
	const out: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(input)) {
		if (value === undefined || value === null || value === "") {
			continue;
		}
		if (Array.isArray(value) && value.length === 0) {
			continue;
		}
		out[key] = value;
	}
	return out;
}

export interface JobHandle {
	id: string;
	status: string;
	output?: unknown;
	error?: unknown;
}

const TERMINAL_FAILURE = new Set(["FAILED", "CANCELLED"]);

export function unwrapJob(payload: unknown): JobHandle {
	if (!payload || typeof payload !== "object") {
		throw new Error("Agent Leverage job payload was not an object.");
	}
	const root = payload as Record<string, unknown>;
	const jobSource =
		root.job && typeof root.job === "object"
			? (root.job as Record<string, unknown>)
			: root;
	if (typeof jobSource.id !== "string" || typeof jobSource.status !== "string") {
		throw new Error("Agent Leverage job payload is missing id or status.");
	}
	return {
		id: jobSource.id,
		status: jobSource.status,
		output: jobSource.output,
		error: jobSource.error,
	};
}

export function assertJobSucceeded(job: JobHandle): void {
	if (TERMINAL_FAILURE.has(job.status)) {
		const detail =
			typeof job.error === "string" && job.error
				? `: ${job.error}`
				: "";
		throw new Error(`Job ${job.id} ended with status ${job.status}${detail}`);
	}
}

export function isJobComplete(job: JobHandle): boolean {
	return job.status === "COMPLETED";
}

export function isJobTerminal(job: JobHandle): boolean {
	return job.status === "COMPLETED" || TERMINAL_FAILURE.has(job.status);
}
