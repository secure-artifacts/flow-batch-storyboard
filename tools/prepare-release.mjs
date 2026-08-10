import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const buildRoot = path.join(root, "build");
const extensionEntries = [
  "assets",
  "injects",
  "transformers",
  "externals.js",
  "manifest.json",
  "service-worker-loader.js",
];

function copyEntry(sourceRoot, targetRoot, entry) {
  const source = path.join(sourceRoot, entry);
  const target = path.join(targetRoot, entry);
  assertExists(source);
  fs.cpSync(source, target, { recursive: true });
}

function assertExists(target) {
  if (!fs.existsSync(target)) throw new Error(`Missing release input: ${target}`);
}

fs.rmSync(buildRoot, { recursive: true, force: true });
const chromeBuild = path.join(buildRoot, "chrome");
const firefoxBuild = path.join(buildRoot, "firefox");
fs.mkdirSync(chromeBuild, { recursive: true });
fs.mkdirSync(firefoxBuild, { recursive: true });

for (const entry of extensionEntries) {
  copyEntry(root, chromeBuild, entry);
  copyEntry(path.join(root, "firefox"), firefoxBuild, entry);
}
for (const entry of ["offscreen.html", "offscreen.js"]) {
  copyEntry(root, chromeBuild, entry);
}

for (const extensionRoot of [chromeBuild, firefoxBuild]) {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(extensionRoot, "manifest.json"), "utf8"),
  );
  if (manifest.version !== "2.3.26") {
    throw new Error(`Unexpected manifest version in ${extensionRoot}`);
  }
}

console.log("Prepared build/chrome and build/firefox extension roots.");

