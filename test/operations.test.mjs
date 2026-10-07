import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	collectMcpArgs,
	mcpToolFor,
	operationsCoveringStaticTools,
	runOperation,
	STATIC_MCP_TOOLS,
} from "../nodes/AgentLeverage/operations.ts";

describe("operations catalog", () => {
	it("covers every static-reachable MCP tool", () => {
		assert.deepEqual(
			operationsCoveringStaticTools(),
			[...STATIC_MCP_TOOLS].sort(),
		);
	});

	it("maps speaker separation and minutes to the MCP tool names", () => {
		assert.equal(
			mcpToolFor("speakerSeparation", "create"),
			"speaker_separation",
		);
		assert.equal(mcpToolFor("minutes", "create"), "meeting_summarizer");
		assert.equal(mcpToolFor("file", "uploadAudio"), "uploadAudio");
		assert.equal(mcpToolFor("job", "wait"), "waitForJob");
	});

	it("collects minutes sourceJobId without requiring notes", () => {
		assert.deepEqual(
			collectMcpArgs("minutes", "create", { sourceJobId: "ss-1" }),
			{ sourceJobId: "ss-1" },
		);
	});

	it("collects speaker-separation audioFileUrl", () => {
		assert.deepEqual(
			collectMcpArgs("speakerSeparation", "create", {
				audioFileUrl: "organizations/org/files/call.mp3",
				additionalFields: { speakersExpected: 0 },
			}),
			{ audioFileUrl: "organizations/org/files/call.mp3" },
		);
	});
});

describe("runOperation", () => {
	it("uploads audio via presign then PUT, without sending the API key to storage", async () => {
		const calls = [];
		const puts = [];

		const result = await runOperation({
			apiUrl: "https://www.agentleverage.co",
			resource: "file",
			operation: "uploadAudio",
			params: { filename: "call.wav", mimeType: "audio/wav" },
			binary: {
				buffer: new Uint8Array([1, 2, 3, 4]),
				fileName: "call.wav",
				mimeType: "audio/wav",
			},
			sleep: async () => undefined,
			putFile: async (url, body, mimeType) => {
				puts.push({ url, mimeType, bytes: body.byteLength });
			},
			transport: async (request) => {
				calls.push(JSON.parse(request.body).params.name);
				return {
					statusCode: 200,
					contentType: "application/json",
					body: JSON.stringify({
						jsonrpc: "2.0",
						id: 1,
						result: {
							structuredContent: {
								signedUploadUrl: "https://storage.example/put",
								path: "organizations/org/files/call.wav",
								bucket: "files",
							},
						},
					}),
				};
			},
		});

		assert.deepEqual(calls, ["create_audio_upload_url"]);
		assert.deepEqual(puts, [
			{
				url: "https://storage.example/put",
				mimeType: "audio/wav",
				bytes: 4,
			},
		]);
		assert.deepEqual(result, {
			path: "organizations/org/files/call.wav",
			bucket: "files",
			filename: "call.wav",
			mimeType: "audio/wav",
			size: 4,
			audioFileUrl: "organizations/org/files/call.wav",
		});
	});

	it("creates speaker separation then polls get_job until COMPLETED", async () => {
		const tools = [];
		let gets = 0;

		const created = await runOperation({
			apiUrl: "https://www.agentleverage.co",
			resource: "speakerSeparation",
			operation: "create",
			params: { audioFileUrl: "organizations/org/files/call.wav" },
			sleep: async () => undefined,
			putFile: async () => undefined,
			transport: async (request) => {
				const name = JSON.parse(request.body).params.name;
				tools.push(name);
				return {
					statusCode: 200,
					contentType: "application/json",
					body: JSON.stringify({
						jsonrpc: "2.0",
						id: 1,
						result: {
							structuredContent: {
								job: { id: "ss-1", status: "PENDING" },
							},
						},
					}),
				};
			},
		});
		assert.deepEqual(created, { job: { id: "ss-1", status: "PENDING" } });

		const waited = await runOperation({
			apiUrl: "https://www.agentleverage.co",
			resource: "job",
			operation: "wait",
			params: { jobId: "ss-1", pollIntervalMs: 1, timeoutMs: 1000 },
			sleep: async () => undefined,
			putFile: async () => undefined,
			now: () => 0,
			transport: async (request) => {
				const name = JSON.parse(request.body).params.name;
				tools.push(name);
				gets += 1;
				const status = gets === 1 ? "PROCESSING" : "COMPLETED";
				return {
					statusCode: 200,
					contentType: "application/json",
					body: JSON.stringify({
						jsonrpc: "2.0",
						id: 1,
						result: {
							structuredContent: {
								job: {
									id: "ss-1",
									status,
									output: { transcript: "hello" },
								},
							},
						},
					}),
				};
			},
		});

		const minutes = await runOperation({
			apiUrl: "https://www.agentleverage.co",
			resource: "minutes",
			operation: "create",
			params: { sourceJobId: "ss-1" },
			sleep: async () => undefined,
			putFile: async () => undefined,
			transport: async (request) => {
				const parsed = JSON.parse(request.body);
				tools.push(parsed.params.name);
				assert.equal(parsed.params.arguments.sourceJobId, "ss-1");
				return {
					statusCode: 200,
					contentType: "application/json",
					body: JSON.stringify({
						jsonrpc: "2.0",
						id: 1,
						result: {
							structuredContent: {
								job: { id: "min-1", status: "PENDING" },
							},
						},
					}),
				};
			},
		});

		assert.ok(tools.includes("speaker_separation"));
		assert.ok(tools.includes("get_job"));
		assert.ok(tools.includes("meeting_summarizer"));
		assert.equal(waited.job.status, "COMPLETED");
		assert.deepEqual(minutes, { job: { id: "min-1", status: "PENDING" } });
	});

	it("fails waitForJob on FAILED status", async () => {
		await assert.rejects(
			() =>
				runOperation({
					apiUrl: "https://www.agentleverage.co",
					resource: "job",
					operation: "wait",
					params: { jobId: "ss-1", pollIntervalMs: 1, timeoutMs: 1000 },
					sleep: async () => undefined,
					putFile: async () => undefined,
					transport: async () => ({
						statusCode: 200,
						contentType: "application/json",
						body: JSON.stringify({
							jsonrpc: "2.0",
							id: 1,
							result: {
								structuredContent: {
									job: {
										id: "ss-1",
										status: "FAILED",
										error: "vendor down",
									},
								},
							},
						}),
					}),
				}),
			/FAILED: vendor down/,
		);
	});
});
