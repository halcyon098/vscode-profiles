#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const aliases = {
  base: "base",
  go: "go",
  python: "python",
  php: "php",
  js: "javascript-typescript",
  javascript: "javascript-typescript",
  typescript: "javascript-typescript",
  "javascript-typescript": "javascript-typescript",
};
const allProfiles = ["base", "go", "python", "php", "javascript-typescript"];

function getUserDirectory() {
  if (process.env.VSCODE_USER_DIRECTORY) {
    return path.resolve(process.env.VSCODE_USER_DIRECTORY);
  }

  if (process.platform === "darwin") {
    return path.join(os.homedir(), "Library/Application Support/Code/User");
  }
  if (process.platform === "win32") {
    if (!process.env.APPDATA) {
      throw new Error("APPDATA is not available; set VSCODE_USER_DIRECTORY explicitly.");
    }
    return path.join(process.env.APPDATA, "Code/User");
  }
  return path.join(os.homedir(), ".config/Code/User");
}

function getRequestedProfiles(selection) {
  if (selection === "all") {
    return allProfiles;
  }
  const profile = aliases[selection];
  if (!profile) {
    throw new Error(`Unknown profile: ${selection}. Use base, go, python, php, js, or all.`);
  }
  return [profile];
}

function assertVSCodeIsClosed() {
  if (process.platform === "win32") {
    return;
  }

  const processName = process.platform === "darwin" ? "Code" : "code";
  try {
    execFileSync("pgrep", ["-x", processName], { stdio: "ignore" });
    throw new Error("VS Code is running. Close it before installing profiles.");
  } catch (error) {
    if (error?.status === 0 || error?.message?.startsWith("VS Code is running")) {
      throw error;
    }
  }
}

async function loadTemplate(profileId) {
  const filePath = path.join(root, "dist", `${profileId}.code-profile`);
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function readStorage(userDirectory) {
  const storagePath = path.join(userDirectory, "globalStorage/storage.json");
  const storage = JSON.parse(await readFile(storagePath, "utf8"));
  return { storagePath, storage };
}

function findProfile(storage, profileName) {
  return storage.userDataProfiles?.find((entry) => entry.name === profileName);
}

function createProfileLocation(storage) {
  const existingLocations = new Set(
    (storage.userDataProfiles ?? []).map((entry) => entry.location),
  );

  let location;
  do {
    location = randomBytes(4).toString("hex");
  } while (existingLocations.has(location));

  return location;
}

async function registerProfile(userDirectory, template) {
  const { storagePath, storage } = await readStorage(userDirectory);
  const existing = findProfile(storage, template.name);

  if (existing) {
    return existing.location;
  }

  const location = createProfileLocation(storage);
  const profile = { location, name: template.name };
  if (template.icon) {
    profile.icon = template.icon;
  }

  storage.userDataProfiles = [...(storage.userDataProfiles ?? []), profile];

  try {
    await copyFile(
      storagePath,
      `${storagePath}.vscode-profiles.backup`,
      fsConstants.COPYFILE_EXCL,
    );
  } catch (error) {
    if (error?.code !== "EEXIST") {
      throw error;
    }
  }

  await writeFile(storagePath, `${JSON.stringify(storage, null, 2)}\n`, "utf8");
  return location;
}

async function verifyProfileLocation(userDirectory, profileName, expectedLocation) {
  const { storage } = await readStorage(userDirectory);
  const profile = findProfile(storage, profileName);

  if (!profile?.location || profile.location.startsWith("builtin/")) {
    throw new Error(`VS Code did not register profile: ${profileName}`);
  }
  if (profile.location !== expectedLocation) {
    throw new Error(`Profile location changed unexpectedly: ${profileName}`);
  }
}

const selection = process.argv[2] ?? "all";
const requestedProfiles = getRequestedProfiles(selection);
const userDirectory = getUserDirectory();
const codeCommand = process.env.VSCODE_COMMAND || "code";
const defaultSettingsPath = path.join(userDirectory, "settings.json");

assertVSCodeIsClosed();
const defaultSettingsBefore = await readFile(defaultSettingsPath, "utf8").catch((error) => {
  if (error?.code === "ENOENT") {
    return null;
  }
  throw error;
});

for (const profileId of requestedProfiles) {
  const template = await loadTemplate(profileId);
  const settingsResource = JSON.parse(template.settings);
  const settings = JSON.parse(settingsResource.settings);
  const extensions = JSON.parse(template.extensions).map((entry) => entry.identifier.id);
  const extensionArgs = extensions.flatMap((extensionId) => ["--install-extension", extensionId]);
  const profileLocation = await registerProfile(userDirectory, template);
  const profileDirectory = path.join(userDirectory, "profiles", profileLocation);

  console.log(`Creating or updating ${template.name}...`);
  await mkdir(profileDirectory, { recursive: true });
  await writeFile(
    path.join(profileDirectory, "settings.json"),
    `${JSON.stringify(settings, null, 2)}\n`,
    "utf8",
  );

  execFileSync(codeCommand, ["--profile", template.name, ...extensionArgs], {
    stdio: "inherit",
  });

  await verifyProfileLocation(userDirectory, template.name, profileLocation);
  console.log(`Installed ${template.name} (${extensions.length} extensions).`);
}

const defaultSettingsAfter = await readFile(defaultSettingsPath, "utf8").catch((error) => {
  if (error?.code === "ENOENT") {
    return null;
  }
  throw error;
});
if (defaultSettingsAfter !== defaultSettingsBefore) {
  throw new Error("Default VS Code settings changed unexpectedly; restore the registry backup.");
}

console.log("Default VS Code settings were not modified.");
console.log("Done. Start VS Code normally; do not re-import the .code-profile files.");
