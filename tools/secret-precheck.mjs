import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const excludedDirectories = new Set([".git", "node_modules", "build", "release"]);
const textExtensions = new Set([
  ".css",
  ".html",
  ".js",
  ".json",
  ".md",
  ".mjs",
  ".ps1",
  ".yaml",
  ".yml",
]);
const secretPatterns = [
  ["private key", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ["GitHub token", /\b(?:ghp|github_pat)_[A-Za-z0-9_]{20,}\b/],
  ["Google API key", /\bAIza[0-9A-Za-z_-]{30,}\b/],
  ["AWS access key", /\bAKIA[0-9A-Z]{16}\b/],
  ["OpenAI-style secret", /\bsk-[A-Za-z0-9]{20,}\b/],
  ["absolute Windows user path", /[A-Za-z]:\\Users\\[^\\\s]+\\/],
];
const findings = [];

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (excludedDirectories.has(entry.name)) continue;
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      walk(target);
      continue;
    }
    if (!textExtensions.has(path.extname(entry.name).toLowerCase())) continue;
    const content = fs.readFileSync(target, "utf8");
    for (const [label, pattern] of secretPatterns) {
      if (pattern.test(content)) findings.push(`${label}: ${path.relative(root, target)}`);
    }
  }
}

walk(root);
assert.deepEqual(findings, [], `Potential secrets or private paths:\n${findings.join("\n")}`);
console.log("Secret and private-path pre-check passed.");

