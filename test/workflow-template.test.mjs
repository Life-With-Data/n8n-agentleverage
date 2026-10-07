import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const templatePath = join(
	process.cwd(),
	"examples/call-recording-to-minutes.json",
);

describe("hosted workflow template", () => {
	it("chains upload → speaker separation → wait → minutes(sourceJobId) → wait", () => {
		const workflow = JSON.parse(readFileSync(templatePath, "utf8"));

		assert.equal(workflow.name, "Call recording to minutes");

		const byName = Object.fromEntries(
			workflow.nodes.map((node) => [node.name, node]),
		);
		assert.equal(
			byName["Upload Audio"]?.type,
			"n8n-nodes-agentleverage.agentLeverage",
		);
		assert.equal(byName["Upload Audio"]?.parameters?.resource, "file");
		assert.equal(byName["Upload Audio"]?.parameters?.operation, "uploadAudio");

		assert.equal(byName["Speaker Separation"]?.parameters?.resource, "speakerSeparation");
		assert.equal(byName["Speaker Separation"]?.parameters?.operation, "create");

		assert.equal(byName["Wait for Transcript"]?.parameters?.resource, "job");
		assert.equal(byName["Wait for Transcript"]?.parameters?.operation, "wait");

		assert.equal(byName["Minutes"]?.parameters?.resource, "minutes");
		assert.equal(byName["Minutes"]?.parameters?.operation, "create");
		assert.equal(
			typeof byName["Minutes"]?.parameters?.sourceJobId,
			"string",
		);
		assert.match(
			String(byName["Minutes"]?.parameters?.sourceJobId),
			/sourceJobId|job\.id/,
		);

		assert.equal(byName["Wait for Minutes"]?.parameters?.operation, "wait");

		const chain = [
			["Form", "Upload Audio"],
			["Upload Audio", "Speaker Separation"],
			["Speaker Separation", "Wait for Transcript"],
			["Wait for Transcript", "Minutes"],
			["Minutes", "Wait for Minutes"],
			["Wait for Minutes", "Output"],
		];
		for (const [from, to] of chain) {
			const next = workflow.connections[from]?.main?.[0]?.[0]?.node;
			assert.equal(next, to, `${from} should connect to ${to}`);
		}
	});
});
