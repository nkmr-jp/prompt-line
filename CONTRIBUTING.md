# Contributing to Prompt Line

# Operating Policy
This is a personal OSS project, so we aim to operate it with minimal overhead.<br>
The basic approach is to "build features I want and share them publicly" with a relaxed stance.<br>
Additionally, we have a policy of not adding features that I don't personally use, as they increase maintenance burden.

We basically expect users to freely customize and use it in their own environments.

## 1. Feel free to fork and customize
* Please customize it freely according to your environment.
* Most features can be implemented by using AI like Claude.
* Windows and Linux users might enjoy the challenge of porting it.
  * Since most of the code is implemented in TypeScript and built with Electron, porting should be relatively straightforward by replacing only the native function calls with platform-specific implementations.

## 2. Please create an Issue for bug reports
* We will try to address bugs that can be reproduced in the author's environment.
* Please provide detailed information when reporting.
* For environment-specific bugs, testing and support may be difficult, so please consult AI like Claude.
* Please refrain from submitting AI-generated Issues.

### Bug Reports

When reporting a bug, please include the following information:
* **Environment**: macOS version, Prompt Line version
* **Reproduction steps**: Clear step-by-step instructions
* **Expected behavior**: What should happen
* **Actual behavior**: What actually happened
* **Screenshots**: If applicable. Videos are also acceptable.

## 3. Pull Requests are not currently accepted
We are not currently accepting Pull Requests from third parties for the following reasons:
* **Review and testing overhead**
  * As a personal project, we want to avoid spending time on PR reviews and testing
  * Explanation of project policies and implementation patterns is high cost
  * We want to avoid the effort of adjusting different implementation styles
* **Security concerns**
  * External code may contain security risks
  * Security is particularly important for an app requiring accessibility permissions
* **AI Slop problem**
  * In recent years, low-quality AI-generated code PRs have become problematic

While this may be unusual for OSS, we've decided to limit acceptance of external code following the "open source but not open contribution" policy adopted by SQLite.

ClaudeCode also accepts Issues but not external code (as it's not published as OSS), which is a similar policy approach. (This might also be an AI Slop countermeasure.)

### References
* https://qiita.com/rana_kualu/items/6b1f09786038e894970e
* https://qiita.com/ko1nksm/items/87d27a287e1b6005d11c
* https://www.reddit.com/r/ExperiencedDevs/comments/1kr8clp/ai_slop_prs_are_burning_me_and_my_team_out_hard/