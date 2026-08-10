import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const mainScript = fs.readFileSync(path.join(root, "injects/index.js"), "utf8");
const restoreSource = mainScript.match(
  /const FB_MODE_OPTIONS[\s\S]*?\n      async function fbCheckpointSha256/,
);
assert(restoreSource, "Checkpoint restore implementation was not found");

const context = {
  crypto: { randomUUID: () => "synthetic-row-id" },
  Date,
  Math,
  encodeURIComponent,
  decodeURIComponent,
};
vm.createContext(context);
vm.runInContext(
  restoreSource[0].replace(
    /\n      async function fbCheckpointSha256[\s\S]*/,
    "\nglobalThis.__restoreRows = fbCheckpointRestoreRows;",
  ),
  context,
);

const mediaUrl = (id) =>
  `https://labs.google/fx/api/trpc/media.getMediaUrlRedirect?name=${encodeURIComponent(id)}`;

for (const outputCount of [2, 3, 4]) {
  const generationIds = Array.from(
    { length: outputCount },
    (_, index) => `generation-${outputCount}-${index + 1}`,
  );
  const oldRow = {
    id: `row-${outputCount}`,
    imageName: `image-${outputCount}.jpg`,
    clipName: `clip-${outputCount}`,
    prompt: `prompt-${outputCount}`,
    status: "partial_success",
    expectedOutputs: outputCount,
    generationIds,
    successfulGenerationIds: [generationIds[0]],
    failedGenerationIds: Array.from(
      { length: outputCount - 1 },
      (_, index) => `__flow_missing_row-${outputCount}_${index + 1}`,
    ),
    results: [{ url: mediaUrl(generationIds[0]) }],
    downloadedFiles: [`Flow批量生成/clip-${outputCount}-1.mp4`],
    successfulOutputs: 1,
    failedOutputs: outputCount - 1,
  };
  const [restored] = context.__restoreRows([oldRow], "Flow批量生成/");
  assert.equal(restored.status, "ready");
  assert.equal(restored.results.length, outputCount);
  assert.equal(restored.results[0].url, oldRow.results[0].url);
  assert.equal(restored.successfulOutputs, outputCount);
  assert.equal(restored.failedOutputs, 0);
  assert(!restored.failedGenerationIds.some((id) => id.startsWith("__flow_missing_")));
}

console.log("Regression tests passed for 2, 3 and 4 outputs.");

