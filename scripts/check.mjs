import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const profileIds = ["base", "go", "python", "php", "javascript-typescript"];
const expectedNames = {
  base: "Base",
  go: "Go",
  python: "Python",
  php: "PHP",
  "javascript-typescript": "JavaScript & TypeScript",
};
const forbiddenKeys = [
  "vue.",
  "roo-cline.",
  "claudeCode.",
  "chatgpt.",
  "chat.defaultModel",
  "security.workspace.trust.untrustedFiles",
  "editor.unicodeHighlight.nonBasicASCIIVariants",
];
const forbiddenExtensionPrefixes = [
  "anthropic.",
  "github.copilot",
  "hybridtalentcomputing.cline-chinese",
  "openai.",
];
const applicationScopedExtensions = new Set([
  "ms-ceintl.vscode-language-pack-zh-hans",
  "ms-vscode-remote.remote-containers",
]);

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

for (const profileId of profileIds) {
  const filePath = path.join(root, "dist", `${profileId}.code-profile`);
  const raw = await readFile(filePath, "utf8");
  const template = JSON.parse(raw);

  assert(template.name === expectedNames[profileId], `${profileId}: unexpected profile name`);
  assert(!("globalState" in template), `${profileId}: globalState must not be exported`);
  assert(!("mcp" in template), `${profileId}: MCP must not be exported`);
  assert(!("keybindings" in template), `${profileId}: keybindings must not be exported`);
  assert(!("snippets" in template), `${profileId}: snippets must not be exported`);
  assert(!("tasks" in template), `${profileId}: tasks must not be exported`);

  const settingsResource = JSON.parse(template.settings);
  const settings = JSON.parse(settingsResource.settings);
  const extensions = JSON.parse(template.extensions);
  const extensionIds = extensions.map((entry) => entry.identifier?.id);
  const normalizedExtensionIds = extensionIds.map((id) => id.toLowerCase());

  assert(
    normalizedExtensionIds.length === new Set(normalizedExtensionIds).size,
    `${profileId}: duplicate extensions`,
  );
  assert(
    !extensionIds.some((id) => forbiddenExtensionPrefixes.some((prefix) => id.toLowerCase().startsWith(prefix))),
    `${profileId}: AI extension found`,
  );
  assert(
    !extensionIds.some((id) => applicationScopedExtensions.has(id.toLowerCase())),
    `${profileId}: application-scoped extension must remain outside language profiles`,
  );
  assert(
    !Object.keys(settings).some((key) => forbiddenKeys.some((prefix) => key.startsWith(prefix))),
    `${profileId}: stale or unsafe setting found`,
  );
  assert(!raw.includes("/Users/"), `${profileId}: absolute macOS path found`);
  assert(!raw.includes("/home/"), `${profileId}: absolute Linux path found`);
  assert(!/[A-Za-z]:\\\\Users\\\\/.test(raw), `${profileId}: absolute Windows path found`);
  assert(!/gh[pousr]_[A-Za-z0-9]{20,}/.test(raw), `${profileId}: GitHub token pattern found`);
  assert(!/sk-[A-Za-z0-9_-]{20,}/.test(raw), `${profileId}: API key pattern found`);

  console.log(`Checked ${profileId}: ${Object.keys(settings).length} settings, ${extensions.length} extensions`);
}
