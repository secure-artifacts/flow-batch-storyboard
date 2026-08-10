import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const requiredExtensionEntries = [
  "manifest.json",
  "service-worker-loader.js",
  "assets/background.ts-FwaP8xAx.js",
  "assets/index.ts-loader-DJMxT1XF.js",
  "assets/logo-16.png",
  "assets/logo-32.png",
  "assets/logo-48.png",
  "assets/logo-128.png",
  "injects/index.css",
  "injects/index.js",
  "transformers/flow.js",
];

for (const extensionRoot of [root, path.join(root, "firefox")]) {
  for (const entry of requiredExtensionEntries) {
    assert(fs.existsSync(path.join(extensionRoot, entry)), `Missing ${entry}`);
  }
  const manifest = JSON.parse(
    fs.readFileSync(path.join(extensionRoot, "manifest.json"), "utf8"),
  );
  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.version, "2.3.26");
  assert(
    manifest.content_scripts || manifest.background || manifest.action,
    "Repository root must be recognizable as a browser extension",
  );
  const mainScript = fs.readFileSync(
    path.join(extensionRoot, "injects/index.js"),
    "utf8",
  );
  assert(mainScript.includes("fbRepairPrematureMissingOutputs"));
  assert(mainScript.includes("FB_GENERATION_HARD_LIMIT_MS = 3 * 60 * 1e3"));
  assert(mainScript.includes('pluginVersion: "2.3.26"'));
  assert(!mainScript.includes("const submissionGroups = new Map()"));
}

const workflow = fs.readFileSync(
  path.join(root, ".github/workflows/release.yml"),
  "utf8",
);
for (const marker of [
  "push:",
  "tags:",
  "id-token: write",
  "contents: write",
  "attestations: write",
  "actions/attest-build-provenance@v2",
  "subject-path: 'release/*.zip'",
  "softprops/action-gh-release@v2",
]) {
  assert(workflow.includes(marker), `Workflow is missing: ${marker}`);
}
assert(!workflow.includes("workflow_dispatch"));
assert(!workflow.includes("release:\n"));

const excluded = new Set([".git", "node_modules", "build", "release"]);
const javascriptFiles = [];
function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (excluded.has(entry.name)) continue;
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(target);
    else if (entry.name.endsWith(".js") || entry.name.endsWith(".mjs")) {
      javascriptFiles.push(target);
    }
  }
}
walk(root);
for (const file of javascriptFiles) {
  const result = spawnSync(process.execPath, ["--check", file], {
    encoding: "utf8",
  });
  assert.equal(result.status, 0, `Syntax failed: ${file}\n${result.stderr}`);
}

const forbiddenFiles = [];
function findForbidden(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (excluded.has(entry.name)) continue;
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) findForbidden(target);
    else if (/^Flow断点_.*\.json$/i.test(entry.name) || /\.(mp4|jpe?g|webp)$/i.test(entry.name)) {
      forbiddenFiles.push(path.relative(root, target));
    }
  }
}
findForbidden(root);
assert.deepEqual(forbiddenFiles, []);

console.log(`Repository verification passed; checked ${javascriptFiles.length} JavaScript files.`);

