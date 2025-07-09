# Contributing to Prompt Line

# Operating Policy
Welcome and thank you for wanting to contribute!

This is a personal OSS project, so I aim to operate it with minimal overhead. <br>
The basic approach is to "build features I want and share them publicly". <br>
Additionally, I have a policy of not adding features that I don't personally use, as they increase maintenance burden.

I basically expect users to freely customize and use it in their own environments.

## 1. Feel free to fork and customize
* Please customize it freely according to your environment.
* You can implement desired features yourself using AI like Claude.
* Windows/Linux users could try porting it.
  * Since most of the code is implemented in TypeScript and built with Electron, porting should be possible with relatively few code changes, such as replacing the native API calls with platform-specific implementations.

## 2. Please create an Issue for bug reports
* I will try to address bugs that can be reproduced in my environment.
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
Prompt Line is not currently accepting Pull Requests from third parties for the following reasons:
* **Review and testing overhead**
  * As a personal project, I want to avoid spending time on PR reviews and testing
  * Explanation of project policies and implementation patterns is high cost
  * I want to avoid the effort of adjusting different implementation styles
* **Security concerns**
  * External code may contain security risks
  * Security is particularly important for an app requiring accessibility permissions
* **AI Slop problem**
  * In recent years, low-quality AI-generated code PRs have become problematic

# References
* https://github.com/readme/featured/how-open-is-open-source
* https://www.reddit.com/r/ExperiencedDevs/comments/1kr8clp/ai_slop_prs_are_burning_me_and_my_team_out_hard/
* https://qiita.com/rana_kualu/items/6b1f09786038e894970e
