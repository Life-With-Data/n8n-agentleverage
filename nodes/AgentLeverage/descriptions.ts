import type { INodeProperties } from "n8n-workflow";

function show(
	resource: string,
	operation: string | string[],
): INodeProperties["displayOptions"] {
	return {
		show: {
			resource: [resource],
			operation: Array.isArray(operation) ? operation : [operation],
		},
	};
}

export const resourceProperty: INodeProperties = {
	displayName: "Resource",
	name: "resource",
	type: "options",
	noDataExpression: true,
	options: [
		{ name: "Audio Redaction", value: "audioRedaction" },
		{ name: "Background Remover", value: "backgroundRemover" },
		{ name: "Credit", value: "credits" },
		{ name: "File", value: "file" },
		{ name: "Invoice Processor", value: "invoiceProcessor" },
		{ name: "Job", value: "job" },
		{ name: 'Minute', value: "minutes" },
		{ name: "News Analyzer", value: "newsAnalyzer" },
		{ name: "Quote Check", value: "quoteCheck" },
		{ name: "Review VOC Pack", value: "reviewVocPack" },
		{ name: "Speaker Separation", value: "speakerSeparation" },
		{ name: "YouTube Transcript", value: "youtubeTranscript" },
	],
	default: "speakerSeparation",
};

function operationsFor(
	resource: string,
	defaultValue: string,
	options: Array<{
		name: string;
		value: string;
		action: string;
		description?: string;
	}>,
): INodeProperties {
	return {
		displayName: "Operation",
		name: "operation",
		type: "options",
		noDataExpression: true,
		displayOptions: { show: { resource: [resource] } },
		options: options.map((option) => ({
			name: option.name,
			value: option.value,
			action: option.action,
			description: option.description,
		})),
		default: defaultValue,
	};
}

export const operationProperties: INodeProperties[] = [
	operationsFor("credits", "getBalance", [
		{
			name: "Get Balance",
			value: "getBalance",
			action: "Get credit balance",
			description: "Read the organization credit balance",
		},
		{
			name: "Get History",
			value: "getHistory",
			action: "Get credit history",
			description: "List credit transactions",
		},
		{
			name: "Get Usage Stats",
			value: "getUsageStats",
			action: "Get credit usage stats",
			description: "Aggregate credit usage",
		},
	]),
	operationsFor("job", "wait", [
		{
			name: "Get",
			value: "get",
			action: "Get a job",
			description: "Fetch job status and output",
		},
		{
			name: "List",
			value: "list",
			action: "List jobs",
			description: "List jobs in the organization",
		},
		{
			name: "Wait",
			value: "wait",
			action: "Wait for a job",
			description: "Poll get_job until COMPLETED or FAILED",
		},
		{
			name: "Cancel",
			value: "cancel",
			action: "Cancel a job",
			description: "Cancel a PENDING job",
		},
		{
			name: "Get Result Asset URL",
			value: "getResultAssetUrl",
			action: "Get job result asset URL",
			description: "Sign a background-remover cutout or source URL",
		},
	]),
	operationsFor("file", "uploadAudio", [
		{
			name: "List",
			value: "list",
			action: "List files",
			description: "List files in the organization",
		},
		{
			name: "Get Download URL",
			value: "getDownloadUrl",
			action: "Get file download URL",
			description: "Mint a signed download URL",
		},
		{
			name: "Create Audio Upload URL",
			value: "createAudioUploadUrl",
			action: "Create audio upload URL",
			description: "Presign a PUT URL for speaker-separation audio",
		},
		{
			name: "Upload Audio",
			value: "uploadAudio",
			action: "Upload audio file",
			description:
				"Presign, HTTP PUT the binary, and return audioFileUrl (path)",
		},
		{
			name: "Create Invoice Upload URL",
			value: "createInvoiceUploadUrl",
			action: "Create invoice upload URL",
			description: "Presign a PUT URL for an invoice PDF or image",
		},
	]),
	operationsFor("speakerSeparation", "create", [
		{
			name: "Create",
			value: "create",
			action: "Create speaker separation job",
			description: "Start speaker separation on uploaded audio",
		},
		{
			name: "Update Labels",
			value: "updateLabels",
			action: "Update speaker labels",
			description: "Rename speakers on a completed job",
		},
	]),
	operationsFor("minutes", "create", [
		{
			name: "Create",
			value: "create",
			action: "Create meeting minutes",
			description:
				"Start minutes from notes or a completed speaker-separation job (sourceJobId)",
		},
	]),
	operationsFor("quoteCheck", "create", [
		{
			name: "Create",
			value: "create",
			action: "Create quote check job",
			description:
				"Check quotes against a minutes job (sourceJobId) or summary plus transcriptJobId",
		},
	]),
	operationsFor("youtubeTranscript", "create", [
		{
			name: "Create",
			value: "create",
			action: "Create YouTube transcript job",
			description: "Start a YouTube transcript-analysis job",
		},
	]),
	operationsFor("newsAnalyzer", "create", [
		{
			name: "Create",
			value: "create",
			action: "Create news analyzer job",
			description: "Analyze a news article from a URL or pasted text",
		},
	]),
	operationsFor("reviewVocPack", "create", [
		{
			name: "Create",
			value: "create",
			action: "Create review VOC pack job",
			description: "Cluster reviews into pain themes",
		},
	]),
	operationsFor("audioRedaction", "create", [
		{
			name: "Create",
			value: "create",
			action: "Create audio redaction job",
			description: "Redact PII from audio already stored in the organization",
		},
	]),
	operationsFor("backgroundRemover", "create", [
		{
			name: "Create",
			value: "create",
			action: "Create background remover job",
			description: "Cut out an image from a public URL or storage path",
		},
	]),
	operationsFor("invoiceProcessor", "create", [
		{
			name: "Create",
			value: "create",
			action: "Create invoice processor job",
			description: "Extract invoice fields from text or an uploaded file",
		},
	]),
];

export const fieldProperties: INodeProperties[] = [
	{
		displayName: "Job ID",
		name: "jobId",
		type: "string",
		required: true,
		default: "",
		displayOptions: show("job", [
			"get",
			"wait",
			"cancel",
			"getResultAssetUrl",
		]),
	},
	{
		displayName: "Job ID",
		name: "jobId",
		type: "string",
		required: true,
		default: "",
		displayOptions: show("speakerSeparation", "updateLabels"),
	},
	{
		displayName: "Poll Interval (Ms)",
		name: "pollIntervalMs",
		type: "number",
		default: 5000,
		displayOptions: show("job", "wait"),
	},
	{
		displayName: "Timeout (Ms)",
		name: "timeoutMs",
		type: "number",
		default: 600000,
		displayOptions: show("job", "wait"),
	},
	{
		displayName: "Role",
		name: "role",
		type: "options",
		options: [
			{ name: "Cutout", value: "cutout" },
			{ name: "Source", value: "source" },
		],
		default: "cutout",
		displayOptions: show("job", "getResultAssetUrl"),
	},
	{
		displayName: "File ID",
		name: "fileId",
		type: "string",
		required: true,
		default: "",
		displayOptions: show("file", "getDownloadUrl"),
	},
	{
		displayName: "Filename",
		name: "filename",
		type: "string",
		required: true,
		default: "",
		displayOptions: show("file", [
			"createAudioUploadUrl",
			"createInvoiceUploadUrl",
		]),
	},
	{
		displayName: "MIME Type",
		name: "mimeType",
		type: "string",
		required: true,
		default: "audio/mpeg",
		displayOptions: show("file", [
			"createAudioUploadUrl",
			"createInvoiceUploadUrl",
		]),
	},
	{
		displayName: "Binary Property",
		name: "binaryPropertyName",
		type: "string",
		default: "data",
		required: true,
		description: "Input item binary property that holds the audio file",
		displayOptions: show("file", "uploadAudio"),
	},
	{
		displayName: "Filename",
		name: "filename",
		type: "string",
		default: "",
		description: "Overrides the binary fileName when set",
		displayOptions: show("file", "uploadAudio"),
	},
	{
		displayName: "MIME Type",
		name: "mimeType",
		type: "string",
		default: "",
		description: "Overrides the binary mimeType when set",
		displayOptions: show("file", "uploadAudio"),
	},
	{
		displayName: "Audio File URL",
		name: "audioFileUrl",
		type: "string",
		required: true,
		default: "",
		description:
			"Storage path from Upload Audio or list_files (e.g. organizations/&lt;orgId&gt;/files/meeting.mp3)",
		displayOptions: show("speakerSeparation", "create"),
	},
	{
		displayName: "Audio File URL",
		name: "audioFileUrl",
		type: "string",
		required: true,
		default: "",
		displayOptions: show("audioRedaction", "create"),
	},
	{
		displayName: "Source Job ID",
		name: "sourceJobId",
		type: "string",
		default: "",
		description:
			"ID of a completed speaker_separation job in this organization. Pass this or Meeting Notes.",
		displayOptions: show("minutes", "create"),
	},
	{
		displayName: "Meeting Notes",
		name: "meetingNotes",
		type: "string",
		typeOptions: { rows: 5 },
		default: "",
		displayOptions: show("minutes", "create"),
	},
	{
		displayName: "Source Job ID",
		name: "sourceJobId",
		type: "string",
		default: "",
		description:
			"Completed meeting_summarizer job that itself chained from speaker_separation",
		displayOptions: show("quoteCheck", "create"),
	},
	{
		displayName: "YouTube URL",
		name: "url",
		type: "string",
		required: true,
		default: "",
		displayOptions: show("youtubeTranscript", "create"),
	},
	{
		displayName: "Speakers",
		name: "speakers",
		type: "fixedCollection",
		typeOptions: { multipleValues: true },
		default: {},
		displayOptions: show("speakerSeparation", "updateLabels"),
		options: [
			{
				name: "speaker",
				displayName: "Speaker",
				values: [
					{
						displayName: "ID",
						name: "id",
						type: "string",
						default: "",
						description: 'Speaker ID from get_job (e.g. "A")',
					},
					{
						displayName: "Label",
						name: "label",
						type: "string",
						default: "",
					},
				],
			},
		],
	},
	{
		displayName: "Additional Fields",
		name: "additionalFields",
		type: "collection",
		placeholder: "Add Field",
		default: {},
		displayOptions: {
			show: {
				resource: [
					"credits",
					"job",
					"file",
					"speakerSeparation",
					"minutes",
					"quoteCheck",
					"youtubeTranscript",
					"newsAnalyzer",
					"reviewVocPack",
					"audioRedaction",
					"backgroundRemover",
					"invoiceProcessor",
				],
			},
		},
		options: [
			{
				displayName: "Article Text",
				name: "articleText",
				type: "string",
				typeOptions: { rows: 5 },
				default: "",
			},
			{
				displayName: "Article URL",
				name: "articleUrl",
				type: "string",
				default: "",
			},
			{
				displayName: "Audio Metadata",
				name: "audioMetadata",
				type: "json",
				default: "{}",
			},
			{
				displayName: "Bucket",
				name: "bucket",
				type: "string",
				default: "",
			},
			{
				displayName: "Corpus",
				name: "corpus",
				type: "string",
				typeOptions: { rows: 5 },
				default: "",
			},
			{
				displayName: "End Date",
				name: "endDate",
				type: "string",
				default: "",
			},
			{
				displayName: "Estimated Duration Seconds",
				name: "estimatedDurationSeconds",
				type: "number",
				default: 0,
			},
			{
				displayName: "File Path",
				name: "filePath",
				type: "string",
				default: "",
			},
			{
				displayName: "Focus",
				name: "focus",
				type: "options",
				options: [
					{ name: "Bugs", value: "bugs" },
					{ name: "Other", value: "other" },
					{ name: "Pricing", value: "pricing" },
					{ name: "Support", value: "support" },
				],
				default: "other",
			},
			{
				displayName: "Image File URL",
				name: "imageFileUrl",
				type: "string",
				default: "",
			},
			{
				displayName: "Image URL",
				name: "imageUrl",
				type: "string",
				default: "",
			},
			{
				displayName: "Invoice Text",
				name: "invoiceText",
				type: "string",
				typeOptions: { rows: 5 },
				default: "",
			},
			{
				displayName: "Language",
				name: "lang",
				type: "string",
				default: "",
			},
			{
				displayName: "Language Code",
				name: "languageCode",
				type: "string",
				default: "",
			},
			{
				displayName: "Limit",
				name: "limit",
				type: "number",
				default: 50,
				typeOptions: {
					minValue: 1,
				},
				description: "Max number of results to return",
			},
			{
				displayName: "Max Reviews",
				name: "maxReviews",
				type: "number",
				default: 50,
			},
			{
				displayName: "Meeting Date",
				name: "meetingDate",
				type: "string",
				default: "",
			},
			{
				displayName: "Meeting Type",
				name: "meetingType",
				type: "options",
				options: [
					{ name: "Client", value: "client" },
					{ name: "General", value: "general" },
					{ name: "One on One", value: "one_on_one" },
					{ name: "Planning", value: "planning" },
					{ name: "Retrospective", value: "retrospective" },
					{ name: "Standup", value: "standup" },
				],
				default: "general",
			},
			{
				displayName: "MIME Category",
				name: "mimeCategory",
				type: "options",
				options: [
					{ name: "Audio", value: "audio" },
					{ name: "Document", value: "document" },
					{ name: "Image", value: "image" },
					{ name: "Other", value: "other" },
					{ name: "Video", value: "video" },
				],
				default: "audio",
			},
			{
				displayName: "MIME Type",
				name: "mimeType",
				type: "string",
				default: "",
			},
			{
				displayName: "Mode",
				name: "mode",
				type: "options",
				options: [
					{ name: "Auto", value: "auto" },
					{ name: "Generate", value: "generate" },
					{ name: "Native", value: "native" },
				],
				default: "native",
			},
			{
				displayName: "Offset",
				name: "offset",
				type: "number",
				default: 0,
			},
			{
				displayName: "Output Format",
				name: "outputFormat",
				type: "options",
				options: [
					{ name: "CSV", value: "csv" },
					{ name: "JSON", value: "json" },
					{ name: "QuickBooks", value: "quickbooks" },
					{ name: "Xero", value: "xero" },
				],
				default: "json",
			},
			{
				displayName: "Page",
				name: "page",
				type: "number",
				default: 1,
			},
			{
				displayName: "Page Size",
				name: "pageSize",
				type: "number",
				default: 20,
			},
			{
				displayName: "Participants",
				name: "participants",
				type: "string",
				default: "",
				description: "Comma-separated attendee names",
			},
			{
				displayName: "Policies",
				name: "policies",
				type: "string",
				default: "",
				description:
					"Comma-separated redaction policy codes (e.g. person_name, phone_number)",
			},
			{
				displayName: "Project Context",
				name: "projectContext",
				type: "string",
				default: "",
			},
			{
				displayName: "Review URLs",
				name: "reviewUrls",
				type: "string",
				default: "",
				description: "Comma-separated review page URLs",
			},
			{
				displayName: "Search",
				name: "search",
				type: "string",
				default: "",
			},
			{
				displayName: "Size",
				name: "size",
				type: "number",
				default: 0,
			},
			{
				displayName: "Speakers Expected",
				name: "speakersExpected",
				type: "number",
				default: 0,
			},
			{
				displayName: "Start Date",
				name: "startDate",
				type: "string",
				default: "",
			},
			{
				displayName: "Summary",
				name: "summary",
				type: "string",
				typeOptions: { rows: 5 },
				default: "",
			},
			{
				displayName: "Tag IDs",
				name: "tagIds",
				type: "string",
				default: "",
				description: "Comma-separated tag IDs",
			},
			{
				displayName: "Tool Slug",
				name: "toolSlug",
				type: "string",
				default: "",
			},
			{
				displayName: "Transaction Type",
				name: "type",
				type: "options",
				options: [
					{ name: "Adjustment", value: "ADJUSTMENT" },
					{ name: "Grant", value: "GRANT" },
					{ name: "Overage", value: "OVERAGE" },
					{ name: "Purchase", value: "PURCHASE" },
					{ name: "Refund", value: "REFUND" },
					{ name: "Usage", value: "USAGE" },
				],
				default: "USAGE",
			},
			{
				displayName: "Transcript Job ID",
				name: "transcriptJobId",
				type: "string",
				default: "",
			},
		],
	},
];
