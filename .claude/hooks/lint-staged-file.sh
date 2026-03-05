#!/bin/bash
FILE_PATH=$(jq -r '.tool_input.file_path // empty')
[ -z "$FILE_PATH" ] && exit 0
[ -f "$FILE_PATH" ] || exit 0
case "$FILE_PATH" in
  *.ts|*.tsx|*.js|*.jsx|*.json)
    npx biome check --write "$FILE_PATH" 2>&1 | head -20
    ;;
  *.md)
    npx markdownlint-cli2 --fix "$FILE_PATH" 2>&1 | head -20
    ;;
esac
exit 0
