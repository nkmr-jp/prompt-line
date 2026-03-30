#!/usr/bin/env ts-node

// ANSI color helpers
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
const cyan = (s: string) => `\x1b[36m${s}\x1b[0m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;

console.log(`
${bold('📦 Prompt Line Plugin Manager')}

${bold('Commands:')}
  ${cyan('pnpm run plugin:install <source>')}   Install plugins from a GitHub repository
  ${cyan('pnpm run plugin:help')}               Show this help message

${bold('Source Format:')}
  ${green('github.com/user/repo[/path]')}        GitHub repository ${dim('(default branch)')}
  ${green('github.com/user/repo[/path]@ref')}    GitHub repository at branch/tag/commit hash
  ${green('./local/path')}                        Local directory ${dim('(must be a GitHub repo clone)')}
  ${green('~/local/path')}                        Local directory ${dim('(home-relative)')}
  ${green('/absolute/path')}                      Absolute local path

${bold('Examples:')}
  ${dim('$')} ${cyan('pnpm run plugin:install github.com/nkmr-jp/prompt-line-plugins')}
  ${dim('$')} ${cyan('pnpm run plugin:install github.com/nkmr-jp/prompt-line-plugins@develop')}
  ${dim('$')} ${cyan('pnpm run plugin:install github.com/nkmr-jp/prompt-line-plugins@e5afde2')}

${yellow('⚠️  Important: Remote Repository Required')}
  Plugins are identified by their remote repository path (e.g., ${green('github.com/user/repo')}).
  Even when installing from a local path, the directory must be a clone of a GitHub
  repository — the plugin ID is derived from the git remote origin URL.

${bold('Global CLI Setup')} ${dim('(Optional)')}${bold(':')}
  Add the following to your shell config (e.g., ${dim('~/.zshrc')}) to run plugin commands
  from any directory:

    ${dim('function prompt-line-plugin() {')}
    ${dim('    pnpm --dir /path/to/prompt-line run "plugin:$1" "\\${@:2}"')}
    ${dim('}')}

  Then use:
    ${dim('$')} ${cyan('prompt-line-plugin install github.com/nkmr-jp/prompt-line-plugins')}
    ${dim('$')} ${cyan('prompt-line-plugin help')}
`);
