#!/usr/bin/env node

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const profileIds = ["base", "go", "python", "php", "javascript-typescript"];
const forbiddenExtensionPrefixes = [
  "anthropic.",
  "github.copilot",
  "hybridtalentcomputing.cline-chinese",
  "openai.",
];

function getUserDirectory() {
  if (process.env.VSCODE_USER_DIRECTORY) {
    return path.resolve(process.env.VSCODE_USER_DIRECTORY);
  }
  if (process.platform === "darwin") {
    return path.join(os.homedir(), "Library/Application Support/Code/User");
  }
  if (process.platform === "win32") {
    return path.join(process.env.APPDATA, "Code/User");
  }
  return path.join(os.homedir(), ".config/Code/User");
}

function normalizeSettings(settings) {
  const normalized = structuredClone(settings);
  if (normalized["workbench.colorTheme"] === "Default Dark Modern") {
    normalized["workbench.colorTheme"] = "Dark Modern";
  }
  return normalized;
}

const userDirectory = getUserDirectory();
const codeCommand = process.env.VSCODE_COMMAND || "code";
const storage = JSON.parse(
  await readFile(path.join(userDirectory, "globalStorage/storage.json"), "utf8"),
);

for (const profileId of profileIds) {
  const template = JSON.parse(
    await readFile(path.join(root, "dist", `${profileId}.code-profile`), "utf8"),
  );
  const profile = storage.userDataProfiles?.find((entry) => entry.name === template.name);
  assert(profile, `Missing local profile: ${template.name}`);

  const expectedSettings = JSON.parse(JSON.parse(template.settings).settings);
  const actualSettings = JSON.parse(
    await readFile(
      path.join(userDirectory, "profiles", profile.location, "settings.json"),
      "utf8",
    ),
  );
  assert.deepEqual(
    normalizeSettings(actualSettings),
    normalizeSettings(expectedSettings),
    `${template.name}: settings differ`,
  );

  const expectedExtensions = new Set(
    JSON.parse(template.extensions).map((entry) => entry.identifier.id.toLowerCase()),
  );
  const actualExtensions = new Set(
    execFileSync(
      codeCommand,
      ["--profile", template.name, "--list-extensions"],
      { encoding: "utf8" },
    )
      .split(/\r?\n/)
      .map((line) => line.trim().toLowerCase())
      .filter(Boolean),
  );

  for (const extensionId of expectedExtensions) {
    assert(actualExtensions.has(extensionId), `${template.name}: missing ${extensionId}`);
  }
  for (const extensionId of actualExtensions) {
    assert(
      !forbiddenExtensionPrefixes.some((prefix) => extensionId.startsWith(prefix)),
      `${template.name}: forbidden AI extension ${extensionId}`,
    );
  }

  console.log(
    `Audited ${template.name}: settings match, ${expectedExtensions.size} required extensions present.`,
  );
}
