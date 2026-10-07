import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const pkg = JSON.parse(
	readFileSync(join(process.cwd(), "package.json"), "utf8"),
);

describe("package.json community-node metadata", () => {
	it("uses the unscoped n8n-nodes-* name required for community packages", () => {
		assert.equal(pkg.name, "n8n-nodes-agentleverage");
		assert.match(pkg.name, /^n8n-nodes-/);
	});

	it("includes the required community-node keyword and discoverability terms", () => {
		assert.ok(pkg.keywords.includes("n8n-community-node-package"));
		for (const keyword of [
			"call-recording",
			"speaker-separation",
			"diarization",
			"meeting-minutes",
			"transcription",
		]) {
			assert.ok(pkg.keywords.includes(keyword), `missing keyword ${keyword}`);
		}
	});

	it("points homepage, bugs, and repository at Agent Leverage / this repo", () => {
		assert.equal(pkg.homepage, "https://www.agentleverage.co");
		assert.equal(
			pkg.bugs?.url,
			"https://github.com/Life-With-Data/n8n-agentleverage/issues",
		);
		assert.match(
			String(pkg.repository?.url),
			/github\.com\/Life-With-Data\/n8n-agentleverage/,
		);
	});

	it("declares the n8n package block with compiled node and credentials", () => {
		assert.equal(pkg.n8n?.n8nNodesApiVersion, 1);
		assert.deepEqual(pkg.n8n?.nodes, [
			"dist/nodes/AgentLeverage/AgentLeverage.node.js",
		]);
		assert.deepEqual(pkg.n8n?.credentials, [
			"dist/credentials/AgentLeverageApi.credentials.js",
		]);
	});

	it("describes call recordings, diarization, minutes, and transcription", () => {
		const description = pkg.description.toLowerCase();
		assert.match(description, /call recording/);
		assert.match(description, /speaker separation/);
		assert.match(description, /diarization/);
		assert.match(description, /meeting minutes/);
		assert.match(description, /transcription/);
	});

	it("documents npm install, Community Nodes UI install, and the workflow URL", () => {
		const readme = readFileSync(join(process.cwd(), "README.md"), "utf8");
		assert.match(readme, /npm install n8n-nodes-agentleverage/);
		assert.match(readme, /Settings > Community Nodes/);
		assert.match(
			readme,
			/https:\/\/www\.agentleverage\.co\/n8n\/call-recording-to-minutes\.json/,
		);
	});
});
