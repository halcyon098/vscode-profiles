# VS Code Profiles

Minimal, framework-neutral VS Code profiles for general development, Go, Python, PHP, and JavaScript/TypeScript.

The repository is the auditable source and disaster-recovery path. VS Code Settings Sync remains the normal way to restore profiles on a new machine.

Imports create profiles named `Base v2`, `Go v2`, `Python v2`, `PHP v2`, and `JavaScript & TypeScript v2`. The suffix prevents conflicts with older profiles during migration.

## Profiles

| Profile | Language support | Additional extensions |
| --- | --- | --- |
| Base | Git, Markdown, JSON, YAML, TOML, XML, SSH, containers | EditorConfig, YAML, TOML, XML, Remote SSH, Dev Containers, Containers |
| Go | Go, gopls, formatting, imports, tests, debugging | Go |
| Python | Python, Pylance, Ruff formatting and linting | Python, Pylance, Ruff |
| PHP | PHP completion, formatting and Xdebug | Intelephense, PHP Debug |
| JavaScript & TypeScript | JavaScript, TypeScript, JSX, TSX, HTML and CSS | ESLint, Prettier |

Framework integrations are project concerns. For example, Vue projects should recommend `vue.volar` in the project's `.vscode/extensions.json` instead of adding Volar to the general JavaScript/TypeScript profile.

AI assistants, model endpoints, MCP servers, UI state, absolute paths and credentials are intentionally excluded. VS Code's built-in Copilot and chat surfaces are disabled with `chat.disableAIFeatures`.

## Restore

The preferred path on a new machine is:

1. Install VS Code.
2. Sign in with GitHub and enable Settings Sync.
3. Sync Settings, Extensions, Profiles, Keyboard Shortcuts, Snippets and Tasks.
4. Keep UI State and AI-related resources out of sync.

When Settings Sync is unavailable, run the non-interactive installer:

```sh
curl -fsSL https://raw.githubusercontent.com/halcyon098/vscode-profiles/main/bootstrap.sh | sh -s -- all
```

Use `base`, `go`, `python`, `php` or `js` instead of `all` to import one profile.

Close VS Code before running the installer. The script backs up VS Code's local profile registry, registers any missing profiles, installs extensions through the official VS Code CLI, and writes the profile settings without opening the graphical Profile Import screen.

The bootstrap script requires `code`, `curl`, and Node.js. It does not install VS Code, language runtimes or command-line tools. When Node.js is unavailable, use VS Code Settings Sync instead.

Do not repeatedly open files from `dist/` after a profile has been installed. They are portable artifacts and build outputs, not the preferred local installation path.

## Development

Source settings and extension lists live under `src/`. Generated `.code-profile` files are committed under `dist/` so restoring a machine does not require Node.js.

```sh
npm run build
npm run check
node scripts/install-local.mjs all
npm run audit:local
```

The build uses only the Node.js standard library. Language settings override common settings, objects are merged recursively, and extension IDs are deduplicated.

Project settings remain authoritative. Repositories should keep their own `.editorconfig`, formatter, linter, test and framework configuration.

## License

MIT
