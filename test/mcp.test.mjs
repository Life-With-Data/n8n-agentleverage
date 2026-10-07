import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	buildToolsCallBody,
	callMcpTool,
	extractJsonRpcMessage,
	mcpEndpoint,
	omitEmpty,
	parseToolResult,
	unwrapJob,
} from "../nodes/AgentLeverage/mcp.ts";

describe("mcp client", () => {
	it("builds the canonical /api/mcp endpoint", () => {
		assert.equal(
			mcpEndpoint("https://www.agentleverage.co/"),
			"https://www.agentleverage.co/api/mcp",
		);
	});

	it("serializes a tools/call JSON-RPC body", () => {
		const body = JSON.parse(
			buildToolsCallBody(7, "speaker_separation", {
				audioFileUrl: "organizations/org/files/a.mp3",
			}),
		);
		assert.equal(body.jsonrpc, "2.0");
		assert.equal(body.id, 7);
		assert.equal(body.method, "tools/call");
		assert.equal(body.params.name, "speaker_separation");
		assert.equal(
			body.params.arguments.audioFileUrl,
			"organizations/org/files/a.mp3",
		);
	});

	it("parses SSE-framed JSON-RPC", () => {
		const body = [
			"event: message",
			'data: {"jsonrpc":"2.0","id":3,"result":{"content":[{"type":"text","text":"{\\"ok\\":true}"}]}}',
			"",
		].join("\n");
		const message = extractJsonRpcMessage(body, 3, "text/event-stream");
		assert.ok(message);
		const parsed = parseToolResult(message?.result);
		assert.deepEqual(parsed.payload, { ok: true });
		assert.equal(parsed.isError, false);
	});

	it("parses application/json JSON-RPC", () => {
		const body = JSON.stringify({
			jsonrpc: "2.0",
			id: 1,
			result: { structuredContent: { job: { id: "j1", status: "PENDING" } } },
		});
		const message = extractJsonRpcMessage(body, 1, "application/json");
		assert.deepEqual(parseToolResult(message?.result).payload, {
			job: { id: "j1", status: "PENDING" },
		});
	});

	it("unwraps { job } handles", () => {
		const job = unwrapJob({ job: { id: "ss-1", status: "COMPLETED", output: { transcript: "hi" } } });
		assert.equal(job.id, "ss-1");
		assert.equal(job.status, "COMPLETED");
	});

	it("omits empty optional fields", () => {
		assert.deepEqual(
			omitEmpty({ a: "x", b: "", c: undefined, d: [], e: 2 }),
			{ a: "x", e: 2 },
		);
	});

	it("calls tools/call over the injected transport", async () => {
		const result = await callMcpTool(
			async (request) => {
				assert.equal(request.method, "POST");
				assert.equal(
					request.url,
					"https://www.agentleverage.co/api/mcp",
				);
				assert.match(request.headers.Accept, /text\/event-stream/);
				const payload = JSON.parse(request.body);
				assert.equal(payload.params.name, "get_credit_balance");
				return {
					statusCode: 200,
					contentType: "text/event-stream",
					body: `data: ${JSON.stringify({
						jsonrpc: "2.0",
						id: 1,
						result: { structuredContent: { available: 12 } },
					})}\n\n`,
				};
			},
			{
				apiUrl: "https://www.agentleverage.co",
				name: "get_credit_balance",
				args: {},
			},
		);
		assert.deepEqual(result.payload, { available: 12 });
	});

	it("surfaces HTTP 401 as a token rejection", async () => {
		await assert.rejects(
			() =>
				callMcpTool(
					async () => ({
						statusCode: 401,
						body: "Unauthorized",
					}),
					{
						apiUrl: "https://www.agentleverage.co",
						name: "get_credit_balance",
						args: {},
					},
				),
			/agl_ API token was rejected/,
		);
	});
});
