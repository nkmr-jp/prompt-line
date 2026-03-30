#!/usr/bin/env ts-node

const HELP_TEXT = `
📦 Prompt Line Plugin Manager

Commands:
  pnpm run plugin:install <source>   Install plugins from a GitHub repository
  pnpm run plugin:help               Show this help message

Source Format:
  github.com/user/repo[/path]        GitHub repository (default branch)
  github.com/user/repo[/path]@ref    GitHub repository at branch/tag/commit hash
  ./local/path                        Local directory (must be a GitHub repo clone)
  ~/local/path                        Local directory (home-relative)
  /absolute/path                      Absolute local path

Examples:
  pnpm run plugin:install github.com/nkmr-jp/prompt-line-plugins
  pnpm run plugin:install github.com/nkmr-jp/prompt-line-plugins@develop
  pnpm run plugin:install github.com/nkmr-jp/prompt-line-plugins@e5afde2

⚠️  Important: Remote Repository Required
  Plugins are identified by their remote repository path (e.g., github.com/user/repo).
  Even when installing from a local path, the directory must be a clone of a GitHub
  repository — the plugin ID is derived from the git remote origin URL.

Global CLI Setup (Optional):
  Add the following to your shell config (e.g., ~/.zshrc) to run plugin commands
  from any directory:

    function prompt-line-plugin() {
        pnpm --dir /path/to/prompt-line run "plugin:$1" "\${@:2}"
    }

  Then use:
    prompt-line-plugin install github.com/nkmr-jp/prompt-line-plugins
    prompt-line-plugin help
`.trimStart();

console.log(HELP_TEXT);
