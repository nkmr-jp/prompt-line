#!/bin/sh
# prompt-line CLI shim.
# Runs the bundled CLI with the app's Electron binary in Node mode.
# Homebrew links this file into its bin directory, so resolve symlinks first.

SOURCE="$0"
while [ -L "$SOURCE" ]; do
  DIR="$(cd "$(dirname "$SOURCE")" && pwd)"
  SOURCE="$(readlink "$SOURCE")"
  case "$SOURCE" in /*) ;; *) SOURCE="$DIR/$SOURCE" ;; esac
done

RESOURCES="$(cd "$(dirname "$SOURCE")" && pwd)"
ELECTRON_RUN_AS_NODE=1 exec "$RESOURCES/../MacOS/Prompt Line" "$RESOURCES/prompt-line/prompt-line.js" "$@"
