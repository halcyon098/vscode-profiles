import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = path.join(root, "src");
const outputRoot = path.join(root, "dist");

const profiles = [
  { id: "base", name: "Base", icon: "vscode" },
  { id: "go", name: "Go" },
  { id: "python", name: "Python", icon: "snake" },
  { id: "php", name: "PHP" },
  {
    id: "javascript-typescript",
    name: "JavaScript & TypeScript",
  },
];

const forbiddenExtensionPrefixes = [
  "anthropic.",
  "github.copilot",
  "hybridtalentcomputing.cline-chinese",
  "openai.",
];

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function deepMerge(base, overlay) {
  const result = { ...base };
  for (const [key, value] of Object.entries(overlay)) {
    result[key] = isPlainObject(result[key]) && isPlainObject(value)
      ? deepMerge(result[key], value)
      : value;
  }
  return result;
}

function mergeExtensions(common, profile) {
  const result = [];
  const seen = new Set();

  for (const extensionId of [...common, ...profile]) {
    const normalized = extensionId.toLowerCase();
    if (!/^[a-z0-9][a-z0-9-]*\.[a-z0-9][a-z0-9-]*$/i.test(extensionId)) {
      throw new Error(`Invalid extension identifier: ${extensionId}`);
    }
    if (forbiddenExtensionPrefixes.some((prefix) => normalized.startsWith(prefix))) {
      throw new Error(`AI extension is not allowed: ${extensionId}`);
    }
    if (!seen.has(normalized)) {
      seen.add(normalized);
      result.push(extensionId);
    }
  }

  return result;
}

function toProfileTemplate(profile, settings, extensions) {
  const template = {
    name: profile.name,
    settings: JSON.stringify({
      settings: `${JSON.stringify(settings, null, 2)}\n`,
    }),
    extensions: JSON.stringify(
      extensions.map((id) => ({ identifier: { id } })),
    ),
  };

  if (profile.icon) {
    template.icon = profile.icon;
  }

  return template;
}

const commonSettings = await readJson(path.join(sourceRoot, "common/settings.json"));
const commonExtensions = await readJson(path.join(sourceRoot, "common/extensions.json"));

await mkdir(outputRoot, { recursive: true });

for (const profile of profiles) {
  const isBase = profile.id === "base";
  const profileSettings = isBase
    ? {}
    : await readJson(path.join(sourceRoot, `profiles/${profile.id}/settings.json`));
  const profileExtensions = isBase
    ? []
    : await readJson(path.join(sourceRoot, `profiles/${profile.id}/extensions.json`));

  const settings = deepMerge(commonSettings, profileSettings);
  const extensions = mergeExtensions(commonExtensions, profileExtensions);
  const template = toProfileTemplate(profile, settings, extensions);
  const outputPath = path.join(outputRoot, `${profile.id}.code-profile`);

  await writeFile(outputPath, `${JSON.stringify(template, null, 2)}\n`, "utf8");
  console.log(`Built ${path.relative(root, outputPath)} (${extensions.length} extensions)`);
}
