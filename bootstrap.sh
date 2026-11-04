#!/bin/sh

set -eu

repository="${VSCODE_PROFILES_REPOSITORY:-halcyon098/vscode-profiles}"
revision="${VSCODE_PROFILES_REVISION:-main}"
selection="${1:-all}"

if ! command -v code >/dev/null 2>&1; then
  printf '%s\n' 'The VS Code command-line launcher (code) is not available.' >&2
  printf '%s\n' 'Install VS Code and enable the shell command before importing profiles.' >&2
  exit 1
fi

if ! command -v curl >/dev/null 2>&1; then
  printf '%s\n' 'curl is required to download profile files.' >&2
  exit 1
fi

case "$selection" in
  base) profiles="base" ;;
  go) profiles="go" ;;
  python) profiles="python" ;;
  php) profiles="php" ;;
  js|javascript|typescript|javascript-typescript) profiles="javascript-typescript" ;;
  all) profiles="base go python php javascript-typescript" ;;
  *)
    printf 'Unknown profile: %s\n' "$selection" >&2
    printf '%s\n' 'Use: base, go, python, php, js, or all.' >&2
    exit 1
    ;;
esac

download_dir=$(mktemp -d "${TMPDIR:-/tmp}/vscode-profiles.XXXXXX")
trap 'rm -rf "$download_dir"' EXIT HUP INT TERM

for profile in $profiles; do
  file="$download_dir/$profile.code-profile"
  url="https://raw.githubusercontent.com/$repository/$revision/dist/$profile.code-profile"

  printf 'Downloading %s...\n' "$profile"
  curl -fsSL "$url" -o "$file"
  printf 'Opening %s in VS Code. Complete or cancel the import, then close the tab.\n' "$profile"
  code --wait "$file"
done
