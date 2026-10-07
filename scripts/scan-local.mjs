#!/usr/bin/env node
/**
 * Local stand-in for `npx @n8n/scan-community-package n8n-nodes-agentleverage`.
 *
 * The official CLI only accepts a published npm package name, then checks
 * provenance and lints attested source + the published tarball. This script
 * runs the same ESLint legs against this checkout (source) and `dist/`
 * (compiled artifact). Provenance cannot be checked until npm publish.
 *
 * @see https://www.npmjs.com/package/@n8n/scan-community-package
 * @see https://docs.n8n.io/connect/create-nodes/build-your-node/reference/verification-guidelines/
 */
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { fileURLToPath } from "node:url";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const scannerPath = require.resolve(
	"@n8n/scan-community-package/scanner/scanner.mjs",
);
const { analyzePackage, SOURCE_FILE_PATTERNS } = await import(
	pathToFileURL(scannerPath).href
);

const fail = (label, result) => {
	console.error(`❌ ${label}: ${result.message ?? "failed"}`);
	if (result.details) {
		console.error(result.details);
	}
	process.exit(1);
};

process.stdout.write("Scanning source (n8n-node lint surface)...\n");
const sourceResult = await analyzePackage(packageRoot, SOURCE_FILE_PATTERNS);
if (!sourceResult.passed) {
	fail("source", sourceResult);
}
console.log("✅ Source scan passed");

process.stdout.write("Scanning compiled dist/ + package.json...\n");
const distResult = await analyzePackage(packageRoot, [
	"dist/**/*.js",
	"package.json",
]);
if (!distResult.passed) {
	fail("dist", distResult);
}
console.log("✅ Dist scan passed");
console.log(
	"Note: npx @n8n/scan-community-package n8n-nodes-agentleverage also checks npm provenance after publish.",
);
