import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from "n8n-workflow";
import { NodeConnectionTypes, NodeOperationError } from "n8n-workflow";
import {
	fieldProperties,
	operationProperties,
	resourceProperty,
} from "./descriptions.ts";
import { DEFAULT_API_URL } from "./mcp.ts";
import { runOperation } from "./operations.ts";

export class AgentLeverage implements INodeType {
	description: INodeTypeDescription = {
		displayName: "Agent Leverage",
		name: "agentLeverage",
		icon: {
			light: "file:agentleverage.svg",
			dark: "file:agentleverage.dark.svg",
		},
		group: ["transform"],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description:
			"Turn call recordings into speaker-separated transcripts, diarization, meeting minutes, and other Agent Leverage tools",
		defaults: {
			name: "Agent Leverage",
		},
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: "agentLeverageApi",
				required: true,
			},
		],
		properties: [resourceProperty, ...operationProperties, ...fieldProperties],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const credentials = await this.getCredentials("agentLeverageApi");
		const apiUrl =
			typeof credentials.apiUrl === "string" && credentials.apiUrl
				? credentials.apiUrl.replace(/\/+$/, "")
				: DEFAULT_API_URL;

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				const resource = this.getNodeParameter(
					"resource",
					itemIndex,
				) as string;
				const operation = this.getNodeParameter(
					"operation",
					itemIndex,
				) as string;
				const params = collectParameters(this, itemIndex);
				let binary: { buffer: Uint8Array; fileName: string; mimeType: string } | undefined;

				if (resource === "file" && operation === "uploadAudio") {
					const binaryPropertyName = this.getNodeParameter(
						"binaryPropertyName",
						itemIndex,
						"data",
					) as string;
					const buffer = await this.helpers.getBinaryDataBuffer(
						itemIndex,
						binaryPropertyName,
					);
					const meta = items[itemIndex].binary?.[binaryPropertyName];
					binary = {
						buffer,
						fileName: meta?.fileName ?? "recording",
						mimeType: meta?.mimeType ?? "application/octet-stream",
					};
				}

				const json = await runOperation({
					apiUrl,
					resource,
					operation,
					params,
					binary,
					rpcId: itemIndex + 1,
					sleep: async (ms) => {
						await new Promise((resolve) => {
							const signal = AbortSignal.timeout(ms);
							signal.addEventListener("abort", () => resolve(undefined), {
								once: true,
							});
						});
					},
					putFile: async (url, body, mimeType) => {
						await this.helpers.httpRequest({
							method: "PUT",
							url,
							body: Buffer.from(body),
							headers: { "Content-Type": mimeType },
							json: false,
						});
					},
					transport: async (request) => {
						const response = await this.helpers.httpRequestWithAuthentication.call(
							this,
							"agentLeverageApi",
							{
								method: request.method,
								url: request.url,
								headers: request.headers,
								body: request.body,
								json: false,
								encoding: "text",
								returnFullResponse: true,
							},
						);
						return normalizeHttpResponse(response);
					},
				});

				returnData.push({
					json: (json && typeof json === "object"
						? json
						: { data: json }) as INodeExecutionData["json"],
					pairedItem: { item: itemIndex },
				});
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: {
							error: error instanceof Error ? error.message : String(error),
						},
						pairedItem: { item: itemIndex },
					});
					continue;
				}
				throw new NodeOperationError(
					this.getNode(),
					error instanceof Error ? error : new Error(String(error)),
					{ itemIndex },
				);
			}
		}

		return [returnData];
	}
}

function normalizeHttpResponse(response: unknown): {
	statusCode: number;
	contentType?: string;
	body: string;
} {
	if (typeof response === "string") {
		return { statusCode: 200, body: response };
	}
	if (Buffer.isBuffer(response)) {
		return { statusCode: 200, body: response.toString("utf8") };
	}
	if (response && typeof response === "object") {
		const full = response as {
			statusCode?: number;
			headers?: Record<string, string>;
			body?: unknown;
		};
		if ("body" in full) {
			const body =
				typeof full.body === "string"
					? full.body
					: Buffer.isBuffer(full.body)
						? full.body.toString("utf8")
						: JSON.stringify(full.body ?? "");
			return {
				statusCode: full.statusCode ?? 200,
				contentType:
					full.headers?.["content-type"] ??
					full.headers?.["Content-Type"],
				body,
			};
		}
	}
	return { statusCode: 200, body: JSON.stringify(response ?? "") };
}

function collectParameters(
	ctx: IExecuteFunctions,
	itemIndex: number,
): Record<string, unknown> {
	const names = [
		"jobId",
		"pollIntervalMs",
		"timeoutMs",
		"role",
		"fileId",
		"filename",
		"mimeType",
		"binaryPropertyName",
		"audioFileUrl",
		"sourceJobId",
		"meetingNotes",
		"url",
		"speakers",
		"additionalFields",
	];
	const params: Record<string, unknown> = {};
	for (const name of names) {
		try {
			params[name] = ctx.getNodeParameter(name, itemIndex);
		} catch {
			// Parameter hidden for this resource/operation.
		}
	}
	return params;
}
