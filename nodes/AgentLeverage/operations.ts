import {
	assertJobSucceeded,
	callMcpTool,
	isJobComplete,
	isJobTerminal,
	type McpTransport,
	omitEmpty,
	unwrapJob,
} from "./mcp.ts";

/**
 * MCP tools a static `agl_` API token can call. Clerk-only mcpServers CRUD
 * is omitted: those tools refuse API keys.
 */
export const STATIC_MCP_TOOLS = [
	"get_credit_balance",
	"get_credit_history",
	"get_credit_usage_stats",
	"youtube_transcript",
	"news_analyzer",
	"review_voc_pack",
	"audio_redaction",
	"bg_remover",
	"speaker_separation",
	"invoice_processor",
	"meeting_summarizer",
	"quote_check",
	"get_job",
	"list_jobs",
	"list_files",
	"get_file_download_url",
	"get_job_result_asset_url",
	"cancel_job",
	"update_speaker_labels",
	"create_audio_upload_url",
	"create_invoice_upload_url",
] as const;

export type StaticMcpTool = (typeof STATIC_MCP_TOOLS)[number];

export interface BinaryAudio {
	buffer: Uint8Array;
	fileName: string;
	mimeType: string;
}

export interface OperationParams {
	[key: string]: unknown;
}

export interface RunOperationInput {
	apiUrl: string;
	transport: McpTransport;
	putFile: (url: string, body: Uint8Array, mimeType: string) => Promise<void>;
	sleep: (ms: number) => Promise<void>;
	now?: () => number;
	resource: string;
	operation: string;
	params: OperationParams;
	binary?: BinaryAudio;
	rpcId?: number;
}

function asString(value: unknown): string {
	return typeof value === "string" ? value.trim() : "";
}

function asNumber(value: unknown): number | undefined {
	if (typeof value === "number" && Number.isFinite(value)) {
		return value;
	}
	if (typeof value === "string" && value.trim() !== "") {
		const parsed = Number(value);
		return Number.isFinite(parsed) ? parsed : undefined;
	}
	return undefined;
}

function asStringArray(value: unknown): string[] | undefined {
	if (Array.isArray(value)) {
		const items = value
			.map((entry) => (typeof entry === "string" ? entry.trim() : ""))
			.filter(Boolean);
		return items.length > 0 ? items : undefined;
	}
	if (typeof value === "string" && value.trim()) {
		const items = value
			.split(/[\n,]/)
			.map((entry) => entry.trim())
			.filter(Boolean);
		return items.length > 0 ? items : undefined;
	}
	return undefined;
}

function additional(params: OperationParams): Record<string, unknown> {
	const extra = params.additionalFields;
	if (extra && typeof extra === "object" && !Array.isArray(extra)) {
		return extra as Record<string, unknown>;
	}
	return {};
}

function merged(params: OperationParams): Record<string, unknown> {
	return { ...additional(params), ...params };
}

export function mcpToolFor(
	resource: string,
	operation: string,
): StaticMcpTool | "uploadAudio" | "waitForJob" {
	const key = `${resource}.${operation}`;
	const map: Record<string, StaticMcpTool | "uploadAudio" | "waitForJob"> = {
		"credits.getBalance": "get_credit_balance",
		"credits.getHistory": "get_credit_history",
		"credits.getUsageStats": "get_credit_usage_stats",
		"job.get": "get_job",
		"job.list": "list_jobs",
		"job.cancel": "cancel_job",
		"job.wait": "waitForJob",
		"job.getResultAssetUrl": "get_job_result_asset_url",
		"file.list": "list_files",
		"file.getDownloadUrl": "get_file_download_url",
		"file.createAudioUploadUrl": "create_audio_upload_url",
		"file.createInvoiceUploadUrl": "create_invoice_upload_url",
		"file.uploadAudio": "uploadAudio",
		"speakerSeparation.create": "speaker_separation",
		"speakerSeparation.updateLabels": "update_speaker_labels",
		"minutes.create": "meeting_summarizer",
		"quoteCheck.create": "quote_check",
		"youtubeTranscript.create": "youtube_transcript",
		"newsAnalyzer.create": "news_analyzer",
		"reviewVocPack.create": "review_voc_pack",
		"audioRedaction.create": "audio_redaction",
		"backgroundRemover.create": "bg_remover",
		"invoiceProcessor.create": "invoice_processor",
	};
	const tool = map[key];
	if (!tool) {
		throw new Error(`Unsupported Agent Leverage operation: ${key}`);
	}
	return tool;
}

export function collectMcpArgs(
	resource: string,
	operation: string,
	params: OperationParams,
): Record<string, unknown> {
	const fields = merged(params);

	switch (`${resource}.${operation}`) {
		case "credits.getBalance":
			return {};
		case "credits.getHistory":
			return omitEmpty({
				limit: asNumber(fields.limit),
				offset: asNumber(fields.offset),
				toolSlug: asString(fields.toolSlug),
				type: asString(fields.type),
				startDate: asString(fields.startDate),
				endDate: asString(fields.endDate),
			});
		case "credits.getUsageStats":
			return omitEmpty({
				startDate: asString(fields.startDate),
				endDate: asString(fields.endDate),
			});
		case "job.get":
		case "job.cancel":
		case "job.wait":
			return omitEmpty({ jobId: asString(fields.jobId) });
		case "job.list":
			return omitEmpty({
				toolSlug: asString(fields.toolSlug),
				limit: asNumber(fields.limit),
				offset: asNumber(fields.offset),
			});
		case "job.getResultAssetUrl":
			return omitEmpty({
				jobId: asString(fields.jobId),
				role: asString(fields.role) || "cutout",
			});
		case "file.list":
			return omitEmpty({
				mimeCategory: asString(fields.mimeCategory),
				search: asString(fields.search),
				tagIds: asStringArray(fields.tagIds),
				page: asNumber(fields.page),
				pageSize: asNumber(fields.pageSize),
			});
		case "file.getDownloadUrl":
			return omitEmpty({ fileId: asString(fields.fileId) });
		case "file.createAudioUploadUrl":
		case "file.createInvoiceUploadUrl":
			return omitEmpty({
				filename: asString(fields.filename),
				mimeType: asString(fields.mimeType),
				size: asNumber(fields.size) || undefined,
			});
		case "speakerSeparation.create":
			return omitEmpty({
				audioFileUrl: asString(fields.audioFileUrl),
				audioMetadata: fields.audioMetadata,
				speakersExpected: asNumber(fields.speakersExpected) || undefined,
				languageCode: asString(fields.languageCode),
				estimatedDurationSeconds:
					asNumber(fields.estimatedDurationSeconds) || undefined,
			});
		case "speakerSeparation.updateLabels": {
			const speakersRaw = fields.speakers as
				| { speaker?: Array<{ id?: string; label?: string }> }
				| Array<{ id?: string; label?: string }>
				| undefined;
			const rows = Array.isArray(speakersRaw)
				? speakersRaw
				: (speakersRaw?.speaker ?? []);
			return omitEmpty({
				jobId: asString(fields.jobId),
				speakers: rows.map((row) => ({
					id: asString(row.id),
					label: asString(row.label),
				})),
			});
		}
		case "minutes.create":
			return omitEmpty({
				meetingNotes: asString(fields.meetingNotes),
				sourceJobId: asString(fields.sourceJobId),
				meetingType: asString(fields.meetingType),
				participants: asStringArray(fields.participants),
				meetingDate: asString(fields.meetingDate),
				projectContext: asString(fields.projectContext),
			});
		case "quoteCheck.create":
			return omitEmpty({
				sourceJobId: asString(fields.sourceJobId),
				summary: asString(fields.summary),
				transcriptJobId: asString(fields.transcriptJobId),
			});
		case "youtubeTranscript.create":
			return omitEmpty({
				url: asString(fields.url),
				lang: asString(fields.lang),
				mode: asString(fields.mode) || "native",
			});
		case "newsAnalyzer.create":
			return omitEmpty({
				articleUrl: asString(fields.articleUrl),
				articleText: asString(fields.articleText),
			});
		case "reviewVocPack.create":
			return omitEmpty({
				reviewUrls: asStringArray(fields.reviewUrls),
				corpus: asString(fields.corpus),
				maxReviews: asNumber(fields.maxReviews),
				focus: asString(fields.focus),
			});
		case "audioRedaction.create":
			return omitEmpty({
				audioFileUrl: asString(fields.audioFileUrl),
				policies: asStringArray(fields.policies),
			});
		case "backgroundRemover.create":
			return omitEmpty({
				imageUrl: asString(fields.imageUrl),
				imageFileUrl: asString(fields.imageFileUrl),
			});
		case "invoiceProcessor.create":
			return omitEmpty({
				invoiceText: asString(fields.invoiceText),
				filePath: asString(fields.filePath),
				bucket: asString(fields.bucket),
				mimeType: asString(fields.mimeType),
				outputFormat: asString(fields.outputFormat),
			});
		default:
			return {};
	}
}

async function callTool(
	input: RunOperationInput,
	name: string,
	args: Record<string, unknown>,
): Promise<unknown> {
	const result = await callMcpTool(input.transport, {
		apiUrl: input.apiUrl,
		id: input.rpcId ?? 1,
		name,
		args,
	});
	return result.payload;
}

export async function uploadAudioFile(
	input: RunOperationInput,
): Promise<Record<string, unknown>> {
	if (!input.binary) {
		throw new Error(
			"Upload Audio requires binary input. Set Binary Property to the field that holds the recording.",
		);
	}
	const filename =
		asString(input.params.filename) || input.binary.fileName || "recording";
	const mimeType =
		asString(input.params.mimeType) ||
		input.binary.mimeType ||
		"audio/mpeg";
	const presign = (await callTool(input, "create_audio_upload_url", {
		filename,
		mimeType,
		size: input.binary.buffer.byteLength,
	})) as Record<string, unknown>;

	const signedUploadUrl = asString(presign.signedUploadUrl);
	const path = asString(presign.path);
	if (!signedUploadUrl || !path) {
		throw new Error(
			"create_audio_upload_url did not return signedUploadUrl and path.",
		);
	}

	await input.putFile(signedUploadUrl, input.binary.buffer, mimeType);

	return {
		path,
		bucket: presign.bucket,
		filename,
		mimeType,
		size: input.binary.buffer.byteLength,
		audioFileUrl: path,
	};
}

export async function waitForJob(
	input: RunOperationInput,
): Promise<unknown> {
	const jobId = asString(input.params.jobId);
	if (!jobId) {
		throw new Error("Wait for Job requires jobId.");
	}
	const intervalMs = Math.max(
		1000,
		asNumber(input.params.pollIntervalMs) ?? 5000,
	);
	const timeoutMs = Math.max(
		intervalMs,
		asNumber(input.params.timeoutMs) ?? 600_000,
	);
	const now = input.now ?? Date.now;
	const deadline = now() + timeoutMs;

	let last = unwrapJob(await callTool(input, "get_job", { jobId }));
	while (!isJobTerminal(last)) {
		if (now() >= deadline) {
			throw new Error(
				`Timed out waiting for job ${jobId} after ${timeoutMs}ms (last status: ${last.status}).`,
			);
		}
		await input.sleep(intervalMs);
		last = unwrapJob(await callTool(input, "get_job", { jobId }));
	}

	assertJobSucceeded(last);
	if (!isJobComplete(last)) {
		throw new Error(`Job ${jobId} ended with status ${last.status}.`);
	}
	return { job: last };
}

export async function runOperation(input: RunOperationInput): Promise<unknown> {
	const tool = mcpToolFor(input.resource, input.operation);
	if (tool === "uploadAudio") {
		return uploadAudioFile(input);
	}
	if (tool === "waitForJob") {
		return waitForJob(input);
	}
	const args = collectMcpArgs(
		input.resource,
		input.operation,
		input.params,
	);
	return callTool(input, tool, args);
}

/** Every static-reachable MCP tool is mapped from some resource.operation. */
export function operationsCoveringStaticTools(): string[] {
	const covered = new Set<string>();
	const resources = [
		["credits", "getBalance"],
		["credits", "getHistory"],
		["credits", "getUsageStats"],
		["job", "get"],
		["job", "list"],
		["job", "cancel"],
		["job", "getResultAssetUrl"],
		["file", "list"],
		["file", "getDownloadUrl"],
		["file", "createAudioUploadUrl"],
		["file", "createInvoiceUploadUrl"],
		["speakerSeparation", "create"],
		["speakerSeparation", "updateLabels"],
		["minutes", "create"],
		["quoteCheck", "create"],
		["youtubeTranscript", "create"],
		["newsAnalyzer", "create"],
		["reviewVocPack", "create"],
		["audioRedaction", "create"],
		["backgroundRemover", "create"],
		["invoiceProcessor", "create"],
	] as const;
	for (const [resource, operation] of resources) {
		const tool = mcpToolFor(resource, operation);
		if (tool !== "uploadAudio" && tool !== "waitForJob") {
			covered.add(tool);
		}
	}
	return [...covered].sort();
}
