# n8n-nodes-agentleverage

This is an n8n community node. It lets you use [Agent Leverage](https://www.agentleverage.co) in your n8n workflows.

Agent Leverage turns call recordings into speaker-separated transcripts (diarization), meeting minutes, and related transcription jobs over the public MCP API (`agl_` API tokens).

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/reference/license/) workflow automation platform.

[Installation](#installation)
[Operations](#operations)
[Credentials](#credentials)
[Compatibility](#compatibility)
[Usage](#usage)
[Resources](#resources)

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation.

### npm

```bash
npm install n8n-nodes-agentleverage
```

### n8n UI (self-hosted)

Owner and Admin users only. From n8n:

1. Go to **Settings > Community Nodes**.
2. Select **Install**.
3. Enter `n8n-nodes-agentleverage` as the npm package name.
4. Agree to the risk warning and select **Install**.

Step-by-step UI details: [GUI installation](https://docs.n8n.io/integrations/community-nodes/installation-and-management/gui-installation/).

n8n Cloud only lists **verified** community nodes. Verification is a Creator Portal submission after the package is on npm with GitHub Actions provenance.

## Operations

| Resource | Operations |
| --- | --- |
| Credits | Get balance, history, usage stats |
| Job | Get, list, wait/poll, cancel, get result asset URL |
| File | List, download URL, create audio/invoice upload URL, **upload audio** (presign + PUT) |
| Speaker Separation | Create (`audioFileUrl`), update labels |
| Minutes | Create (`sourceJobId` or meeting notes) |
| Quote Check, YouTube Transcript, News Analyzer, Review VOC Pack, Audio Redaction, Background Remover, Invoice Processor | Create |

## Credentials

Create a token in Agent Leverage: **Settings → API tokens**.

- Tokens start with `agl_`
- Sent as `Authorization: Bearer agl_…`
- Unlock the static-token MCP tool surface (`tools:read` / `tools:execute`)

Default API URL: `https://www.agentleverage.co`. Override the URL in credentials for local dev (`http://localhost:3500`).

Clerk-only `mcpServers` CRUD tools are not on this node; API keys cannot call them.

## Compatibility

Requires n8n with community nodes enabled (self-hosted). Minimum Node.js for building this package: 20.15 (n8n community-node engines). Developed against `@n8n/node-cli` ≥ 0.23.0.

## Usage

Import the call-recording-to-minutes workflow in n8n (**File → Import from URL**):

https://www.agentleverage.co/n8n/call-recording-to-minutes.json

The template: form-upload audio → Speaker Separation → poll/wait → Minutes (`sourceJobId`) → output.

## Resources

- [n8n community nodes documentation](https://docs.n8n.io/integrations/community-nodes/)
- [Agent Leverage](https://www.agentleverage.co)
- [Submit community nodes](https://docs.n8n.io/connect/create-nodes/deploy-your-node/submit-community-nodes/)
- [n8n Creator Portal](https://creators.n8n.io/nodes)

## Development (this monorepo)

This package lives in the Agent Leverage monorepo but is **isolated from the pnpm workspace and Turbo app builds** (`pnpm-workspace.yaml` excludes it). It uses npm + `@n8n/node-cli`, not the repo's Biome/Turbo pipeline.

```bash
cd n8n-agentleverage
npm install
npm test
npm run lint
npm run build
npm run scan    # local equivalent of the scanner's ESLint legs (no npm provenance)
npm run dev     # n8n-node dev — load the node in a local n8n
```

Style is **programmatic**. MCP is JSON-RPC Streamable-HTTP, not REST, and Upload Audio PUTs binary to a signed URL — declarative `routing` cannot do that without an `execute()` method.

## Publishing

Do **not** publish from a cloud agent or a personal npm account. n8n verification needs the GitHub/npm owner and a GitHub Actions provenance publish.

From this directory, after the publish workflow is on `main`:

```bash
npm run release
```

That lints, builds, bumps, tags, and pushes. The tag triggers `.github/workflows/publish.yml`, which publishes to npm with provenance. One-time npm trusted-publisher / `NPM_TOKEN` setup is documented in that workflow file.

## License

[MIT](./LICENSE)
