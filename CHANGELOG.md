# [0.6.0](https://github.com/nkmr-jp/prompt-line/compare/v0.5.0...v0.6.0) (2025-06-22)


### Bug Fixes

* resolve CI test failures with proper electronAPI mocking ([b164b5f](https://github.com/nkmr-jp/prompt-line/commit/b164b5f4979d7b2b3fb3712004b1b1b859184905))


### Features

* enhance security with contextIsolation and fix compatibility issues ([b4ff347](https://github.com/nkmr-jp/prompt-line/commit/b4ff3472b33f823504465105cbc450aa2cd3baa0))

# [0.5.0](https://github.com/nkmr-jp/prompt-line/compare/v0.4.1...v0.5.0) (2025-06-22)


### Bug Fixes

* **desktop:** improve desktop switching detection with adaptive precision ([9cf8758](https://github.com/nkmr-jp/prompt-line/commit/9cf87585a1330d3bd65d5ccfb86aa0d8be3d3b1b))
* **desktop:** improve desktop switching detection with adaptive precision ([57e9b98](https://github.com/nkmr-jp/prompt-line/commit/57e9b98c2a71f3dd7e65154b839015842e54f44c))
* **window:** ensure window appears on current desktop space ([b7c0129](https://github.com/nkmr-jp/prompt-line/commit/b7c012921aa9a978413c0e4f7a87c225418a31a6))
* **window:** fix window appearing on wrong desktop space ([73b1d5a](https://github.com/nkmr-jp/prompt-line/commit/73b1d5a198f94ef8862ee510826f74cabd6f0c63))


### Features

* **benchmarks:** add appName field support to history generation and testing ([56bcfc3](https://github.com/nkmr-jp/prompt-line/commit/56bcfc356964056b9c4a6e2157ba6e5ca8bc6f88))
* **demo:** add demo prompts and history data with appName support ([46ec693](https://github.com/nkmr-jp/prompt-line/commit/46ec693ec70e1639462d6ec8742153a20864be06))


### Performance Improvements

* **core:** add caching to getCurrentApp for major performance boost ([a739734](https://github.com/nkmr-jp/prompt-line/commit/a739734bfbb7de09e91128c32d725f662298062d))
* **desktop:** implement ultra-fast mode for <100ms window startup ([ab349bc](https://github.com/nkmr-jp/prompt-line/commit/ab349bc998c0bd16240793f1231d3dd61ac91f9c))
* **desktop:** optimize timeslot precision to 1-second for better stability ([cd90761](https://github.com/nkmr-jp/prompt-line/commit/cd90761fee4b5e33971c30e460a2d6dc06469bd6))


### Reverts

* restore ultra-fast mode implementation from ab349bc ([764eee6](https://github.com/nkmr-jp/prompt-line/commit/764eee63e6645513de3e29d8d9931b02c9bd1f9b))

## [0.4.1](https://github.com/nkmr-jp/prompt-line/compare/v0.4.0...v0.4.1) (2025-06-20)


### Bug Fixes

* **settings:** change settings shortcut to local-only and remove from config ([6ac9f08](https://github.com/nkmr-jp/prompt-line/commit/6ac9f08714b473a3bb6b2a0db513adf71adb044f))

# [0.4.0](https://github.com/nkmr-jp/prompt-line/compare/v0.3.0...v0.4.0) (2025-06-20)


### Bug Fixes

* **image:** prevent markdown syntax insertion when pasting images ([e06f70c](https://github.com/nkmr-jp/prompt-line/commit/e06f70c02a0467ebdcd08700896624578b8ec82d))
* **renderer:** resolve duplicate image path insertion ([1a00f3d](https://github.com/nkmr-jp/prompt-line/commit/1a00f3dec000a7c62e4b6437d7ac5ba4b8d1383d))


### Features

* **history:** add appName tracking to history items ([46f9a42](https://github.com/nkmr-jp/prompt-line/commit/46f9a4214906487103b785c07fd228e274ccb5d6))
* **position:** add left-alignment for narrow text fields and remove sensitive logs ([3d7ca31](https://github.com/nkmr-jp/prompt-line/commit/3d7ca314840b8e281af293dbbe0c5001553a36e4))
* **settings:** add Cmd+, shortcut and tray menu to open settings file ([aff8a5e](https://github.com/nkmr-jp/prompt-line/commit/aff8a5e9003e7da0ba00561a134872f6a1930a0d))
* **ui:** implement dynamic shortcut display from settings ([a0561f2](https://github.com/nkmr-jp/prompt-line/commit/a0561f2bceecb5e11be999c9a5b23bada0f088ff))

# [0.3.0](https://github.com/nkmr-jp/prompt-line/compare/v0.2.1...v0.3.0) (2025-06-16)


### Bug Fixes

* **native-tools:** resolve error 126 when running from built app ([5e3d0df](https://github.com/nkmr-jp/prompt-line/commit/5e3d0dfd136f536ec9e36cc6d6e193a03ac33bdb))
* revert active-display-center to center positioning mode ([6e4eaf4](https://github.com/nkmr-jp/prompt-line/commit/6e4eaf42fe4d1c64cae15afe9586178b9b10e36d))
* **settings:** correct shortcuts.search default value to Cmd+f ([30f9dc5](https://github.com/nkmr-jp/prompt-line/commit/30f9dc5e001131754f57d9e4b3980b2f55082c41))
* update tests to match new default positioning and active-display-center ([1df8504](https://github.com/nkmr-jp/prompt-line/commit/1df8504dc8eb3744d403761aebde23db23c506cd))
* **window:** correct cursor position placement and refactor positioning logic ([9f8b74c](https://github.com/nkmr-jp/prompt-line/commit/9f8b74c7af2e7c4729e244f822778cde817f4142))
* **window:** improve text field detection with better error handling and permissions ([baee459](https://github.com/nkmr-jp/prompt-line/commit/baee459b51527c581bd3e4979b90130fcf1a54d7))
* **window:** refactor text field detection to use sequential AppleScript calls ([5a24a7c](https://github.com/nkmr-jp/prompt-line/commit/5a24a7c8b43630025e3109485dbbf9ccc9841d07))
* **window:** use temporary AppleScript file for text field detection ([90d83c0](https://github.com/nkmr-jp/prompt-line/commit/90d83c03218204c4e6591bc966adf403dd385964))


### Features

* **native:** add parent container detection for scrollable text fields ([a712b86](https://github.com/nkmr-jp/prompt-line/commit/a712b86528d0ca6af84b3b20542ffaea73674e26))
* **native:** implement Swift-based text field detector ([5664c12](https://github.com/nkmr-jp/prompt-line/commit/5664c128abba92380952b8ff9da6284ac061acdf))
* **settings:** add comprehensive comments to settings configuration files ([a7dbe7f](https://github.com/nkmr-jp/prompt-line/commit/a7dbe7f8e1d6c99678af561426ab1c948ed2d9a9))
* **settings:** add configurable search shortcut key setting ([ef244f4](https://github.com/nkmr-jp/prompt-line/commit/ef244f454b88fb0e5a55892600d2fe21e20f4172))
* **settings:** set active-text-field as default window position ([f73a13e](https://github.com/nkmr-jp/prompt-line/commit/f73a13e7a60a36e630643f641e7ae08b5d6f0e8e))
* **tray:** add version display and release notes link to tray menu ([c4bd0e5](https://github.com/nkmr-jp/prompt-line/commit/c4bd0e5d4f91ab178276cbe95e1a32d0b4533247))
* **window:** add active-text-field positioning mode ([123bace](https://github.com/nkmr-jp/prompt-line/commit/123bace170f03b000352ed072b84f879a186c44d))
* **window:** align prompt window bottom-left with text field bottom-left ([710628b](https://github.com/nkmr-jp/prompt-line/commit/710628bf39b30ca6ef18f81697dda37f6933a84a))
* **window:** center prompt window within focused text field ([bb5917c](https://github.com/nkmr-jp/prompt-line/commit/bb5917c34f90c0cda99653b1c61c292ec01f04e7))
* **window:** center prompt window within text field container ([39ee715](https://github.com/nkmr-jp/prompt-line/commit/39ee7157f5c9ee311a3c81a9aae51e1db4de0852))

## [0.2.1](https://github.com/nkmr-jp/prompt-line/compare/v0.2.0...v0.2.1) (2025-06-15)


### Bug Fixes

* **history:** protect history.jsonl file from deletion operations ([f26cf8a](https://github.com/nkmr-jp/prompt-line/commit/f26cf8afe7ff8bc00fef069312b55fc18c4600b8))

# [0.2.0](https://github.com/nkmr-jp/prompt-line/compare/v0.1.0...v0.2.0) (2025-06-15)


### Bug Fixes

* **deps:** resolve npm deprecation warnings by updating major dependencies ([caf0edf](https://github.com/nkmr-jp/prompt-line/commit/caf0edfac8194c4e32cc979b4e86bd9a0dfdda31))
* **lint:** resolve ESLint v9 configuration issues for CI ([647ccf8](https://github.com/nkmr-jp/prompt-line/commit/647ccf8fa845452e1cd7f3d789c1cbcf6d91b04d))
* **search:** clear history selection when search filtering is applied ([05df2a1](https://github.com/nkmr-jp/prompt-line/commit/05df2a12f63ec29a5e1d53cc46f5bb72ed9c4b25))
* **search:** improve Cmd+F behavior when search box is open ([8899332](https://github.com/nkmr-jp/prompt-line/commit/8899332b2168c6d25797d79d7398b9aedf5fd9a0))
* **search:** prevent duplicate history navigation in search mode ([aa1edcb](https://github.com/nkmr-jp/prompt-line/commit/aa1edcbc7eaba44ff302acce9e3d090bddf843c2))
* **tests:** resolve Jest v30 compatibility issue in ipc-handlers test ([488cb08](https://github.com/nkmr-jp/prompt-line/commit/488cb080b02b578ba68b66b0daf1ee234bcc9d1f))


### Features

* **ui:** improve history section visual design and shortcuts display ([398a318](https://github.com/nkmr-jp/prompt-line/commit/398a3183807b50061691d57a952b5fe6d87a37bd))

# [0.1.0](https://github.com/nkmr-jp/prompt-line/compare/v0.0.2...v0.1.0) (2025-06-15)


### Bug Fixes

* **search:** enable Esc key to close search even when not focused ([7fb2240](https://github.com/nkmr-jp/prompt-line/commit/7fb2240749c50ac9d89aff972343e895f923b5a8))


### Features

* **deps:** optimize Node.js and npm engine requirements ([023706e](https://github.com/nkmr-jp/prompt-line/commit/023706eb371e76227d9e8d7286f197d312098d58))
* **shortcut:** add dynamic shortcut parsing and configuration support ([9c3344a](https://github.com/nkmr-jp/prompt-line/commit/9c3344a6ac93f1d3c8a8f645a89a8d7dd9d1a1a9))
* **ui:** reset search state and scroll position on window open ([27606e9](https://github.com/nkmr-jp/prompt-line/commit/27606e9d89a569bdd10343a7e372677a950d0c1c))

## [0.0.2](https://github.com/nkmr-jp/prompt-line/compare/v0.0.1...v0.0.2) (2025-06-15)


### Bug Fixes

* Improve test stability and CI reliability ([86d170e](https://github.com/nkmr-jp/prompt-line/commit/86d170e278e8e0025d120bda27bba36a254e5fe7))
* Increase performance test timeout to 10s for slower CI environments ([53639f4](https://github.com/nkmr-jp/prompt-line/commit/53639f4e32c72780b9a93a355464fdca73565d57))
* Refactor history item visibility logic to use a unified MAX_VISIBLE_ITEMS limit ([68f40c0](https://github.com/nkmr-jp/prompt-line/commit/68f40c0aa03a8f9c4088d36b13aacec04ed84b3c))
* remove deprecated husky script lines ([680874b](https://github.com/nkmr-jp/prompt-line/commit/680874b81351bd534427a32910fb8ab391cf1d79))
