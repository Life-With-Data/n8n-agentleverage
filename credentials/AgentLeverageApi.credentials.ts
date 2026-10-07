import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
	Icon,
} from "n8n-workflow";

export class AgentLeverageApi implements ICredentialType {
	name = "agentLeverageApi";

	displayName = "Agent Leverage API";

	documentationUrl = "https://www.agentleverage.co";

	icon: Icon = {
		light: "file:../nodes/AgentLeverage/agentleverage.svg",
		dark: "file:../nodes/AgentLeverage/agentleverage.dark.svg",
	};

	properties: INodeProperties[] = [
		{
			displayName: "API URL",
			name: "apiUrl",
			type: "string",
			default: "https://www.agentleverage.co",
			description:
				"Origin of the Agent Leverage deployment. Production is https://www.agentleverage.co. Local dev is typically http://localhost:3500.",
		},
		{
			displayName: "API Key",
			name: "apiKey",
			type: "string",
			typeOptions: { password: true },
			default: "",
			required: true,
			description:
				"Org-scoped static token from Agent Leverage Settings → API tokens. Starts with agl_. Sent as Authorization: Bearer <token> to POST /api/mcp.",
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: "generic",
		properties: {
			headers: {
				Authorization: "=Bearer {{$credentials.apiKey}}",
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: "={{$credentials.apiUrl}}",
			url: "/api/mcp",
			method: "POST",
			headers: {
				Accept: "application/json, text/event-stream",
				"Content-Type": "application/json",
			},
			body: {
				jsonrpc: "2.0",
				id: 1,
				method: "tools/call",
				params: {
					name: "get_credit_balance",
					arguments: {},
				},
			},
		},
	};
}
