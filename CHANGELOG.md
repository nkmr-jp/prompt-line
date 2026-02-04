## [0.19.1](https://github.com/nkmr-jp/prompt-line/compare/v0.19.0...v0.19.1) (2026-02-04)

### Bug Fixes

* **ci:** enable CHANGELOG.md auto-update in release workflow ([a441ab0](https://github.com/nkmr-jp/prompt-line/commit/a441ab0e))

## [0.19.0](https://github.com/nkmr-jp/prompt-line/compare/v0.18.6...v0.19.0) (2026-02-04)

### Features

* **release:** migrate to go-semantic-release ([e8c2733](https://github.com/nkmr-jp/prompt-line/commit/e8c27338))
* **renderer:** invalidate slash command cache on window shown ([f340644](https://github.com/nkmr-jp/prompt-line/commit/f3406446))
* **slash-commands:** add color support to source badges ([3caa8f5](https://github.com/nkmr-jp/prompt-line/commit/3caa8f56))
* **slash-command-manager:** support hex color codes for command labels ([caab6f9](https://github.com/nkmr-jp/prompt-line/commit/caab6f90))
* **built-in-commands:** add hot reload support for command YAML files ([8be6ca4](https://github.com/nkmr-jp/prompt-line/commit/8be6ca49))
* **colors:** add blue color option to command and search interfaces ([95a7ca2](https://github.com/nkmr-jp/prompt-line/commit/95a7ca23))
* **built-in-commands:** add color property and new commands to CLI tools ([f52ce88](https://github.com/nkmr-jp/prompt-line/commit/f52ce882))
* **slash-commands:** update builtin commands with 2026 additions ([effdef1](https://github.com/nkmr-jp/prompt-line/commit/effdef14))
* **slash-commands:** add OpenClaw TUI built-in commands ([b60ff1d](https://github.com/nkmr-jp/prompt-line/commit/b60ff1d1))

### Bug Fixes

* **security:** remove semantic-release and resolve all vulnerabilities ([cc5198a](https://github.com/nkmr-jp/prompt-line/commit/cc5198af))
* **built-in-commands-manager:** exclude directories from YAML file filter ([772e425](https://github.com/nkmr-jp/prompt-line/commit/772e425b))

### Performance Improvements

* **built-in-commands:** improve file watcher logging and directory detection ([af2614a](https://github.com/nkmr-jp/prompt-line/commit/af2614a3))

### Documentation

* **color:** add comprehensive color documentation for slash commands ([2b50db3](https://github.com/nkmr-jp/prompt-line/commit/2b50db3c))

### Tests

* **built-in-commands:** fix mock setup for clearCache method ([ef3518a](https://github.com/nkmr-jp/prompt-line/commit/ef3518a3))
* **performance:** adjust p95 threshold for environment variance ([bc2d3c0](https://github.com/nkmr-jp/prompt-line/commit/bc2d3c0a))

### Code Refactoring

* **built-in-commands:** clean up debug logs for production ([268e7e1](https://github.com/nkmr-jp/prompt-line/commit/268e7e18))
* **built-in-commands-manager:** use imported loader singleton instead of dynamic require ([fd1e06a](https://github.com/nkmr-jp/prompt-line/commit/fd1e06af))
* **types:** consolidate color type definitions and add hex color support ([0cf60f0](https://github.com/nkmr-jp/prompt-line/commit/0cf60f0b))

### Miscellaneous Chores

* **ci:** pin go-semantic-release action to commit hash ([9a9a3e5](https://github.com/nkmr-jp/prompt-line/commit/9a9a3e50))
* **built-in-commands:** update color scheme for CLI tools in YAML definitions ([54f5d35](https://github.com/nkmr-jp/prompt-line/commit/54f5d355))
* **config:** update default settings color scheme for commands and skills ([a0cbc98](https://github.com/nkmr-jp/prompt-line/commit/a0cbc983))

## [0.18.6](https://github.com/nkmr-jp/prompt-line/compare/v0.18.5...v0.18.6) (2026-01-30)

### Maintenance

* **config:** add configuration documentation and update peer dependency metadata ([f2e5af7](https://github.com/nkmr-jp/prompt-line/commit/f2e5af7a99cd6a4b302c98ea25aaa9b7d6337ad4))

## [0.18.5](https://github.com/nkmr-jp/prompt-line/compare/v0.18.4...v0.18.5) (2026-01-29)

### Maintenance

* **deps:** bump tar in the npm_and_yarn group across 1 directory ([6388037](https://github.com/nkmr-jp/prompt-line/commit/6388037d012ac79a58239a6a9ad8d6b72847fb54))

## [0.18.4](https://github.com/nkmr-jp/prompt-line/compare/v0.18.3...v0.18.4) (2026-01-22)

### Maintenance

* **deps-dev:** bump lodash ([e1f6cea](https://github.com/nkmr-jp/prompt-line/commit/e1f6cea8d2c91de9dbe9da896a1d239aaf698309))

## [0.18.3](https://github.com/nkmr-jp/prompt-line/compare/v0.18.2...v0.18.3) (2026-01-22)

### Maintenance

* **deps-dev:** bump lodash-es ([cbc6c8b](https://github.com/nkmr-jp/prompt-line/commit/cbc6c8b943f6df5f993feea183d8e7ed6940b44d))

## [0.18.2](https://github.com/nkmr-jp/prompt-line/compare/v0.18.1...v0.18.2) (2026-01-17)

### Bug Fixes

* **deps:** correct ts-node version from 1.7.1 to 10.9.2 ([1f9c990](https://github.com/nkmr-jp/prompt-line/commit/1f9c99063d06516b02b2cabb3b8604b3003c4050))

### Maintenance

* **deps:** remove tar override to fix @electron/rebuild compatibility ([fd22e14](https://github.com/nkmr-jp/prompt-line/commit/fd22e148d6809ef04fda6d5ef93bb440af0e5cbf))

## [0.18.1](https://github.com/nkmr-jp/prompt-line/compare/v0.18.0...v0.18.1) (2026-01-17)

### Maintenance

* **deps:** update jest, ts-jest, and ts-node with lock file regeneration ([a0b4809](https://github.com/nkmr-jp/prompt-line/commit/a0b48093bbc3d31ac15474b126d34ef6f6a0b408))
* **deps:** upgrade tar to 7.5.3 and remove duplicate dependencies ([b7b6464](https://github.com/nkmr-jp/prompt-line/commit/b7b646466ce1d48a0eff5110ea8a53d2ae97a792))

## [0.18.0](https://github.com/nkmr-jp/prompt-line/compare/v0.17.0...v0.18.0) (2026-01-16)

### Features

* **code-search:** enhance symbol ranking with file modification time scoring ([e99d94c](https://github.com/nkmr-jp/prompt-line/commit/e99d94cff4db878fe17aa1fb6fdcf2303bda0bd0))
* **code-search:** integrate fzf-based scoring with mtime bonus capping ([0848cb1](https://github.com/nkmr-jp/prompt-line/commit/0848cb1f7ecdc062fdbb7909eb3a0decb3fd52d2))
* **file-cache:** add mtime refresh on window show for accurate scoring ([ee848b9](https://github.com/nkmr-jp/prompt-line/commit/ee848b92d6bd350aed8aa85e1818774c12ea8be7))
* **file-filter-manager:** exclude system directories from file search results ([3083396](https://github.com/nkmr-jp/prompt-line/commit/3083396c29e4efc0b2f6631d3b64f7fdfda56f26))
* **file-search:** calculate path bonus from relative path when baseDir is provided ([b4e59a2](https://github.com/nkmr-jp/prompt-line/commit/b4e59a25f97e438113e7d6d4a2bad1c7c99aa770))
* **scoring:** add file modification time and usage history bonuses to fuzzy matching ([b7b748c](https://github.com/nkmr-jp/prompt-line/commit/b7b748c3ae10371f4047d366f8e652602294c3c8))
* **search:** integrate FzfScorer for improved fuzzy matching across search modules ([08c0dbf](https://github.com/nkmr-jp/prompt-line/commit/08c0dbf17177467013c5d63737d59a3add4695b2))
* **slash-command:** add usage frequency and recency tracking ([1e32545](https://github.com/nkmr-jp/prompt-line/commit/1e325459abbb0773e1b0f07ec79174d1b2551a05))
* **slash-command:** integrate usage bonus into search result sorting ([dbe8f3f](https://github.com/nkmr-jp/prompt-line/commit/dbe8f3f9a079b85673f07a30dc4cf5f508e120f7))
* **usage-history:** add usage history tracking infrastructure ([81f0529](https://github.com/nkmr-jp/prompt-line/commit/81f05294bb46d737daa89868e6db4f1bc6780f91))

### Bug Fixes

* **lint:** prefix unused error variable with underscore ([bc8f64d](https://github.com/nkmr-jp/prompt-line/commit/bc8f64d76cda7991e5c389f09d261ed9da19a0ff))
* **scoring:** reduce MAX_MTIME_BONUS from 1000 to 500 ([bc8897b](https://github.com/nkmr-jp/prompt-line/commit/bc8897bfd72c12f00b95773cc7e6275b381cd078))
* **security:** add path traversal protection and schema validation ([e2e0d49](https://github.com/nkmr-jp/prompt-line/commit/e2e0d490147d953d91c0f536a9ed7c2080c8c0c3)), closes [#171](https://github.com/nkmr-jp/prompt-line/issues/171)
* **security:** check path traversal before normalization ([d0712b9](https://github.com/nkmr-jp/prompt-line/commit/d0712b96093270743eaa393015f14aa786d21c22))
* **test:** relax scalability test threshold for CI environment variance ([30b0f15](https://github.com/nkmr-jp/prompt-line/commit/30b0f157b59d5a5c207dc6e5227a3a95e14e96bc))

### Code Refactoring

* **file-cache:** optimize mtime scoring with recent files cache ([452b231](https://github.com/nkmr-jp/prompt-line/commit/452b23102e5466d585ce3d64a1b5fad3b15f7128))
* **file-filter-manager:** remove system directory exclusion filter ([c388056](https://github.com/nkmr-jp/prompt-line/commit/c388056964802f8b011c2d66e9aabbd8730061c8))
* **history-search:** disable FzfScorer and use simple contains matching ([62dbf6b](https://github.com/nkmr-jp/prompt-line/commit/62dbf6b62af3ef015d3df5e6eeb6bad903ce7320))
* remove unused FZF constants and symbol search test fixtures ([d0c93e2](https://github.com/nkmr-jp/prompt-line/commit/d0c93e2de4660afb76b05fb365ede480a4a8aeb6))
* **search:** remove FZF fuzzy matching and simplify scoring algorithms ([0c556d6](https://github.com/nkmr-jp/prompt-line/commit/0c556d6525612263d28b8c894775fe6775bef81e))
* **usage-bonus:** implement continuous linear decay for file mtime bonus ([42c77ac](https://github.com/nkmr-jp/prompt-line/commit/42c77ac286113e320b337abfafb1191b469f67d6))
* **usage-history:** convert singleton managers to lazy-loaded functions ([81edeed](https://github.com/nkmr-jp/prompt-line/commit/81edeedadda36b9b1f5776fbe0ce585c83ad300d))

### Performance Improvements

* **file-cache-manager:** enrich cached files with mtime for improved scoring ([ae12ba8](https://github.com/nkmr-jp/prompt-line/commit/ae12ba8b1698b251409a2da07afd8da273877651))
* **file-search:** implement hybrid decay algorithm for mtime bonus scoring ([3ce5f7c](https://github.com/nkmr-jp/prompt-line/commit/3ce5f7cbfaca07da73e47849a8f33f3502177188))
* **fuzzy-matcher:** cap mtime bonus to prevent recency from dominating score ([cd41e6e](https://github.com/nkmr-jp/prompt-line/commit/cd41e6ecc2486995bb9e80475f7dc2f1da062253))
* **fuzzy-matcher:** scale FZF scores and preserve case sensitivity ([ad5086c](https://github.com/nkmr-jp/prompt-line/commit/ad5086c91fe20dd852ff63780ac6bb24ae2dac68))
* **history-search:** improve recency bonus calculation for fresher results ([26a7e82](https://github.com/nkmr-jp/prompt-line/commit/26a7e8233e4e4a7a869e05ab83d4336c8fe24288))
* **history-search:** increase recency bonus and TTL for better ranking ([b111637](https://github.com/nkmr-jp/prompt-line/commit/b11163756323c2b548dc815c96141be71574f695))
* **history-search:** increase recency bonus from 200 to 400 points ([dda8de0](https://github.com/nkmr-jp/prompt-line/commit/dda8de0447ef73add1f0bec91e0009c44ff51d89))
* **history-search:** reduce maximum recency bonus from 2500 to 1000 points ([4963789](https://github.com/nkmr-jp/prompt-line/commit/49637895717045738466f63fc3c6342ce27e86db))
* **history-search:** reduce STARTS_WITH match score from 500 to 300 ([713acce](https://github.com/nkmr-jp/prompt-line/commit/713acce254881213241c52b3604ae1bd07dd3bda))
* **mention-search:** increase recency bonus to 600 points and implement file usage bonuses ([9564660](https://github.com/nkmr-jp/prompt-line/commit/95646608ec39c95357491c40ecc5e48283eb255a))
* **mentions:** increase mtime bonus cap and add tiebreaker for file scoring ([9b7f12a](https://github.com/nkmr-jp/prompt-line/commit/9b7f12a76a59a57fdef5faeb24b1a41c325bef1e))
* **scoring:** reduce file mtime bonus cap from 200 to 100 ([27543e1](https://github.com/nkmr-jp/prompt-line/commit/27543e1cc86c45fff9eee1d57184f949f69d2701))
* **scoring:** reduce MAX_FILE_MTIME bonus from 500 to 200 ([f30fe1e](https://github.com/nkmr-jp/prompt-line/commit/f30fe1e9f2e4e3a8bcbb1b94a3e41bb87d40b960))
* **usage-bonus-calculator:** increase MAX_FILE_MTIME from 500 to 2500 ([7e31457](https://github.com/nkmr-jp/prompt-line/commit/7e31457ac46e49c3394da02914b42b6ae87d71fa))
* **usage-bonus-calculator:** scale file modification time bonus to 500 ([b321f6a](https://github.com/nkmr-jp/prompt-line/commit/b321f6a0c3df3d99d14e95c219537a045064f9cc))
* **usage-bonus:** adjust scoring constants for optimized ranking ([93005eb](https://github.com/nkmr-jp/prompt-line/commit/93005eb87b23d6eaefb0193471da255631f3c859))
* **usage-bonus:** implement two-phase mtime decay with increased bonus ceiling ([622e9f1](https://github.com/nkmr-jp/prompt-line/commit/622e9f1853f3c56edae5eed1fb173df4e47af87e))
* **usage-bonus:** increase bonus constants by 10x for better ranking ([c507025](https://github.com/nkmr-jp/prompt-line/commit/c507025e59b547088d5dd0228edc237870cc2b4b))

### Tests

* **fzf-scorer:** improve scoring logic with exact match bonus and camel case prioritization ([68174f8](https://github.com/nkmr-jp/prompt-line/commit/68174f8fd719d1f51172b5f4d0ab388af68923de))
* **history-search:** reduce MAX_RECENCY_BONUS from 3500 to 1500 and add type cast ([aaf8847](https://github.com/nkmr-jp/prompt-line/commit/aaf88479576830b807a3eee95add1e9e35f85c6c))
* update assertion syntax to use toHaveLength matcher ([6d98512](https://github.com/nkmr-jp/prompt-line/commit/6d98512aaf1301d955a38b55f8d176a8e492ccad))
* **usage-bonus-calculator:** reduce MAX_FILE_MTIME from 2500 to 500 ([31f9746](https://github.com/nkmr-jp/prompt-line/commit/31f97463aeb6c6a6bc9e5a99ae2b8a8ce7ea32c0))

### Maintenance

* **release:** 0.16.1 [skip ci] ([dc4c2d2](https://github.com/nkmr-jp/prompt-line/commit/dc4c2d26e988f76bc822ff2cd8e419d1dda72156))
* **release:** 0.17.0 [skip ci] ([69621c6](https://github.com/nkmr-jp/prompt-line/commit/69621c6d44d5eacbe3e68375cbb46f4d6afe110e))

## [0.17.0](https://github.com/nkmr-jp/prompt-line/compare/v0.16.1...v0.17.0) (2026-01-12)

### Features

* **code-search:** add relativePath filtering to symbol search ([885d7e1](https://github.com/nkmr-jp/prompt-line/commit/885d7e1c96c8b0f6386a6b0264d7f78ac462ad21))
* **types:** add relativePath filter option to SymbolSearchOptions ([6e201e8](https://github.com/nkmr-jp/prompt-line/commit/6e201e862b798abb56e84a6c9a2fdc3000413cd8))

### Bug Fixes

* **code-search:** allow empty query to show all symbols for language ([ce1d081](https://github.com/nkmr-jp/prompt-line/commit/ce1d081c40d3ba7b85dad4672de83d4d6553ac92))
* **code-search:** allow single character search queries ([bcd818f](https://github.com/nkmr-jp/prompt-line/commit/bcd818fb3abde8ccf32b627cd8874bf9436ac570))
* **file-filter-manager, suggestion-ui-manager:** prevent missing candidates in incremental search and fix hover state handling ([e9e821f](https://github.com/nkmr-jp/prompt-line/commit/e9e821f5dbb02995d02d98f21586ddccda2117c5))
* **history:** improve pagination robustness and maintain FIFO queue ordering ([2fd4e19](https://github.com/nkmr-jp/prompt-line/commit/2fd4e194076b6d6e65acb2033294c71b17069164))
* **mention-manager, event-listener-manager:** prevent pending animations after suspension ([8fcec97](https://github.com/nkmr-jp/prompt-line/commit/8fcec97d795f1e434b39a6ddb3235d05c5b89f36))

### Code Refactoring

* **code-search:** move symbol filtering to Main process ([99108f3](https://github.com/nkmr-jp/prompt-line/commit/99108f3df57ce2ba7c050ef506a53b67371f079b))

### Performance Improvements

* **code-search:** implement incremental search filtering and symbol name caching ([a0478aa](https://github.com/nkmr-jp/prompt-line/commit/a0478aa2855889594d40ecd88ea269c3b987eb23))
* **history:** add pagination support and optimize array operations ([a8ca5f1](https://github.com/nkmr-jp/prompt-line/commit/a8ca5f172a18c60bca78e52d846f349d24e59407))
* optimize config and cache management with TTL and LRU eviction ([2211d6b](https://github.com/nkmr-jp/prompt-line/commit/2211d6b544cbed941a22f4fc4f0974e060eb0769))
* optimize event handling and caching for improved input performance ([2f0d1f8](https://github.com/nkmr-jp/prompt-line/commit/2f0d1f8b64a3fa0854ef3a0202fa4e95ca0acc3b))
* **symbol-search:** migrate caching to JS-side SymbolCacheManager and optimize ripgrep execution ([ef1819d](https://github.com/nkmr-jp/prompt-line/commit/ef1819d69ecf589212089e704fecc74acecc971c))

## [0.16.1](https://github.com/nkmr-jp/prompt-line/compare/v0.16.0...v0.16.1) (2026-01-10)

### Maintenance

* **deps:** upgrade glob to v13.0.0 and consolidate dependencies ([d5c7c6d](https://github.com/nkmr-jp/prompt-line/commit/d5c7c6dc1c94d2e4d14d8050d8eceb2336745cc4))

## [0.16.0](https://github.com/nkmr-jp/prompt-line/compare/v0.15.0...v0.16.0) (2026-01-10)

### Features

* **command-name-matcher:** add suffix wildcard pattern matching ([443a0c3](https://github.com/nkmr-jp/prompt-line/commit/443a0c3c20c3f4768ab903d05f4787e8017df753))
* **frontmatter-popup:** add file path link to frontmatter popup footer ([7256ade](https://github.com/nkmr-jp/prompt-line/commit/7256ade237a1ffdb195e111d5137e6fa5a603583))
* **frontmatter-popup:** support agents and improve file path display ([aa3197d](https://github.com/nkmr-jp/prompt-line/commit/aa3197dd064c67b2f82abc863561b2fbf5a8050c))
* **history-search:** add multi-keyword AND search support ([495b922](https://github.com/nkmr-jp/prompt-line/commit/495b9227718a51aae62b2dd09e64bb22bf02ecc8))
* **history-ui:** add scrollbar hover interactions and wheel event forwarding ([41a0c0c](https://github.com/nkmr-jp/prompt-line/commit/41a0c0c2be44d4a83e3f3b3df54131a93ed808c5))
* **history-ui:** add scrollbar thumb drag functionality ([eaed605](https://github.com/nkmr-jp/prompt-line/commit/eaed6059a96b58b9d5c6903d479863321f8b6794))
* **history:** add Cmd+S shortcut to save draft to history ([4621c01](https://github.com/nkmr-jp/prompt-line/commit/4621c0186acf9229f6e19a9a4e7ff9ba4712398b))
* **history:** capture app name and directory when saving draft to history ([7371dbb](https://github.com/nkmr-jp/prompt-line/commit/7371dbb7b025c7a6dd0205e3bc325c55bdbfcd9c))
* **main:** add directory detection debug test method ([abd7154](https://github.com/nkmr-jp/prompt-line/commit/abd715497f3d65f3b6c887eda6369883ac4f2b54))
* **mention-manager:** add support for multi-word slash commands ([3abb703](https://github.com/nkmr-jp/prompt-line/commit/3abb7035248583becd82ec30f49ca9242e16ab97))
* **mentions:** add backspace deletion for slash commands ([a89806d](https://github.com/nkmr-jp/prompt-line/commit/a89806d32be1e994fce45c752756911fe7372a89))
* **mentions:** add file path link to agent frontmatter popup ([9bccb02](https://github.com/nkmr-jp/prompt-line/commit/9bccb0259f59abaff37ac5ca6f7df5033ee5d93d))
* **mentions:** add global enable/disable filters for mdSearch mentions ([95030b8](https://github.com/nkmr-jp/prompt-line/commit/95030b8449be276396c83cb2501ec8f5d1442998))
* **mentions:** add multi-word slash command support via cursor detection ([74c408f](https://github.com/nkmr-jp/prompt-line/commit/74c408ff7c914f75dee967c08fcf35ba180ac246))
* **mentions:** add slash command highlighting and hover support ([69b99e2](https://github.com/nkmr-jp/prompt-line/commit/69b99e2177dad46c7e595938a99a3513640b761d))
* **native-tools:** add support for Warp and WezTerm terminals ([9137533](https://github.com/nkmr-jp/prompt-line/commit/9137533f651b9a316df50b5343c6f29dcf10b7f5))
* **native-tools:** Add support for Zed IDE and update file opener configs ([6abe8c0](https://github.com/nkmr-jp/prompt-line/commit/6abe8c0fbcfe2fce25375f8342d60006b7750aec))
* **popup-manager:** add command/agent selection callbacks for textarea insertion ([a48de3c](https://github.com/nkmr-jp/prompt-line/commit/a48de3c72475168edd4226d423bf37071fcced52))
* **popup-managers:** add row hover tracking for tooltip persistence ([45d4504](https://github.com/nkmr-jp/prompt-line/commit/45d4504cc3fb97c437b386506a8a39b5c3ba65b2))
* **prefix-resolver:** select closest matching plugin.json when multiple files exist ([d1710f3](https://github.com/nkmr-jp/prompt-line/commit/d1710f36afde83f8bb44cdac466c4cf937a548f3))
* **settings:** enhance configuration with new label, color, and file pattern options ([f96358e](https://github.com/nkmr-jp/prompt-line/commit/f96358e2cd8d8a1456e200cf4506eb06c4f6ea7a))
* **settings:** implement hot reload for settings with file watching ([d7dd6b4](https://github.com/nkmr-jp/prompt-line/commit/d7dd6b4570d5ca7be485b6e22561a123be09ca60))
* **settings:** update slash commands and mentions configuration for plugin support ([3bdfb8b](https://github.com/nkmr-jp/prompt-line/commit/3bdfb8b261755d6e1ee8923f4ad60901c3162457))
* **slash-command-manager:** add copy-to-clipboard support for argument hints ([dfdd159](https://github.com/nkmr-jp/prompt-line/commit/dfdd1594480d7886f31f75b254ac4b27037a3002))
* **slash-command-manager:** add getCommandSource method to retrieve command source by name ([0b2984e](https://github.com/nkmr-jp/prompt-line/commit/0b2984e083616b30a76c6dd29bc0b4a3e5352939))
* **slash-command-manager:** add label field to command search filter ([d70e947](https://github.com/nkmr-jp/prompt-line/commit/d70e947b5682a470973868891a4b48cc056ab283))
* **slash-command-manager:** copy argumentHint to clipboard on command selection ([9c32f71](https://github.com/nkmr-jp/prompt-line/commit/9c32f7101935e0fc29b7647a4fa7156e2b20b2b8))
* **slash-command-manager:** persist argument hint display during command argument entry ([0a947aa](https://github.com/nkmr-jp/prompt-line/commit/0a947aab25ad46f9e487c4a2f2494b524e5a0e13))
* **slash-command-manager:** show argument hint when cursor is positioned in command arguments ([461f011](https://github.com/nkmr-jp/prompt-line/commit/461f0114688cba1b31b6cd405e23fdb52ca0dc23))
* **slash-command-manager:** show argument hints on textarea focus ([640cbeb](https://github.com/nkmr-jp/prompt-line/commit/640cbebf7cf84cdbf57c8aba68e1b172c6a97c98))
* **slash-commands:** add dynamic cursor-based positioning for suggestions ([3be2b07](https://github.com/nkmr-jp/prompt-line/commit/3be2b071098153d10beee2b43430c907495a12d2))
* **slash-commands:** add entry-level enable/disable filtering for commands and mentions ([7aacbc1](https://github.com/nkmr-jp/prompt-line/commit/7aacbc1c3250adf70061f91928f2b12a5be8765e))
* **slash-commands:** add global command cache for recently used commands ([6d17a6b](https://github.com/nkmr-jp/prompt-line/commit/6d17a6bb3615dd73a9b1745dc95f01ca9795bf60))
* **slash-commands:** add label color customization for command badges ([54407f7](https://github.com/nkmr-jp/prompt-line/commit/54407f72bcf550d834a7144a0e5a2d543caa701b))
* **slash-commands:** add label field to slash command entries ([45d00a1](https://github.com/nkmr-jp/prompt-line/commit/45d00a1fc370f35916fd5629db452812303ccb28))
* **slash-commands:** add label support with frontmatter template resolution ([3cbced5](https://github.com/nkmr-jp/prompt-line/commit/3cbced5b4b22d393bfc70fe8d9cd15639f4f550c))
* **slash-commands:** add labelColor support for command highlighting ([a0b9a13](https://github.com/nkmr-jp/prompt-line/commit/a0b9a13592530525b93092593b61853ef3860ccb))
* **slash-commands:** add plugin commands and enhance skill command configuration ([913adda](https://github.com/nkmr-jp/prompt-line/commit/913addad09000d0ee1f77493a23d1b548708f5a2))
* **slash-commands:** add source-based highlighting for slash commands ([97a4c30](https://github.com/nkmr-jp/prompt-line/commit/97a4c30c6bfedd747d0152ed6701973997005bf7))
* **slash-commands:** add visual feedback when copying argument hints ([b9493ac](https://github.com/nkmr-jp/prompt-line/commit/b9493acec18d09d659614a5d528d7b368bf74e4a))
* **slash-commands:** expand color palette and rename blue to teal ([9d87700](https://github.com/nkmr-jp/prompt-line/commit/9d877008f8c3442b74134c6ee941e077ed32776f))
* **slash-commands:** replace source badge with fixed 'arg' argument hint badge ([4cebc8a](https://github.com/nkmr-jp/prompt-line/commit/4cebc8a91def34a22eb6aaf03fb192150d5c7fc5)), closes [#999](https://github.com/nkmr-jp/prompt-line/issues/999)
* **slash-commands:** support colon syntax in slash command patterns ([9fb0c15](https://github.com/nkmr-jp/prompt-line/commit/9fb0c15d45a1d25851685e0786a8aabda33e6d4e))
* **slash-commands:** support multi-word command detection in highlighting ([87222ef](https://github.com/nkmr-jp/prompt-line/commit/87222ef12c0cde74cb52c1afa251c15e1c1c52c4))
* **slashCommands:** add enable/disable filtering for slash commands ([f050fb3](https://github.com/nkmr-jp/prompt-line/commit/f050fb328bf378062791c5c0f646d13a046c3e75))
* **symbol-search:** add include/exclude patterns support ([60a7b73](https://github.com/nkmr-jp/prompt-line/commit/60a7b730b7af0a1bb7584d77a715f4eb02395cb8))
* **template-resolver:** add prefix variable support for template resolution ([dc44402](https://github.com/nkmr-jp/prompt-line/commit/dc4440241c2450a7b194ee2eca2232ff2cbb5b3e))

### Bug Fixes

* **deps:** resolve npm install deprecation warnings by updating Jest to v30 ([c31dc0d](https://github.com/nkmr-jp/prompt-line/commit/c31dc0d12d31f6ed173f8f4ca123cd48b5fbbdd0))
* **deps:** resolve npm install warnings by updating dependencies ([abbf942](https://github.com/nkmr-jp/prompt-line/commit/abbf94207dfda5e7f6aab16edb466116e40e1f48))
* **directory-detector:** skip Prompt Line itself during app detection ([56ebd68](https://github.com/nkmr-jp/prompt-line/commit/56ebd68367a5651cc3dd10ca170266c0a453579c))
* **dom-manager, path-manager:** trigger input event on text update and add selected paths ([c262a07](https://github.com/nkmr-jp/prompt-line/commit/c262a076cc9b51aaf2686773f692ea06ef016681))
* **dom-manager:** dispatch input event after text insertion to trigger slash command detection ([0f1614a](https://github.com/nkmr-jp/prompt-line/commit/0f1614afbed5b3adf567e0aa4d09dd0ff9dd0ce3))
* **dom-manager:** remove manual input event dispatch on setText ([61db1ad](https://github.com/nkmr-jp/prompt-line/commit/61db1adba7640e4c395a4612fafe8e35d5e6860d))
* **file-opener-manager:** add case-insensitive editor config lookup ([0538527](https://github.com/nkmr-jp/prompt-line/commit/0538527ec5aa2a3cc2c34b056f50424ce4a6a123))
* **file-suggestions:** adjust frontmatter info icon hitbox positioning ([c49b78c](https://github.com/nkmr-jp/prompt-line/commit/c49b78c2090d5cf7034566cc8696eb3b1b164af3))
* **highlight-manager:** always highlight slash commands regardless of command sync state ([64677ac](https://github.com/nkmr-jp/prompt-line/commit/64677ac292b624daac532ae3fbe5440386dfccdb))
* **history-ui:** enforce minimum scrollbar thumb height ([2bc4c20](https://github.com/nkmr-jp/prompt-line/commit/2bc4c20c2f376d548921310e70293d6c446dc175))
* **history:** deduplicate history items by text content ([4aa3dde](https://github.com/nkmr-jp/prompt-line/commit/4aa3dde2a8f97423c4cd25df0d401eef467b263f))
* **history:** fix duplicate handling by using item ID instead of text match ([6461ed2](https://github.com/nkmr-jp/prompt-line/commit/6461ed23b6f6d003e690e7352a982e7e7af91fde))
* **history:** prevent duplicate items when loading history from file ([8c58e82](https://github.com/nkmr-jp/prompt-line/commit/8c58e82c3bb1bc3d3bf4b12332719ff50938306f))
* **history:** skip saving draft if text matches latest history item ([c25a14c](https://github.com/nkmr-jp/prompt-line/commit/c25a14caa14b59b8d58d67197ad6ec7079db318f))
* **history:** update scrollbar size after infinite scroll content loads ([46f6dce](https://github.com/nkmr-jp/prompt-line/commit/46f6dce12e3223f8cd8730f217df649758090f47))
* **mention-manager, slash-command-manager:** ensure popup positioning after scroll completes ([c0550e5](https://github.com/nkmr-jp/prompt-line/commit/c0550e59114b327946bee5d847d6b48d4464db39))
* **mention-manager:** prevent file search from interrupting symbol mode ([57063d9](https://github.com/nkmr-jp/prompt-line/commit/57063d9fccba3c02d8332e22b6577baa3aff618d))
* **mentions:** add requestAnimationFrame sync in handleCmdClick and export findSlashCommandAtCursor ([10649d5](https://github.com/nkmr-jp/prompt-line/commit/10649d5b1b22f41e26f90c4ae597f287f1c5d3b4))
* **mentions:** add tabSize to caret coordinate calculation ([085e0a8](https://github.com/nkmr-jp/prompt-line/commit/085e0a80f8c01310a4f43519ddb467a88195ddf0))
* **mentions:** disable hint display for built-in slash commands ([bb8639c](https://github.com/nkmr-jp/prompt-line/commit/bb8639ccf0f8b7e10f8dca6d6f8b119cd630669e))
* **mentions:** enable Cmd+hover detection for slash commands ([2f29bb3](https://github.com/nkmr-jp/prompt-line/commit/2f29bb37b6f7ba3cb1d971487e1409185467e884))
* **mentions:** enable Ctrl+Enter for slash commands without sync check ([e00a676](https://github.com/nkmr-jp/prompt-line/commit/e00a6760fe7ae55b65ce4c82ad09d899cbcf637e))
* **mentions:** schedule popup hide instead of immediate hide on mouse leave ([1cf2e47](https://github.com/nkmr-jp/prompt-line/commit/1cf2e479749a6c4a4776897d81f5e9c854e9b17f))
* **mentions:** show hint for slash commands without command sync check ([a85fd38](https://github.com/nkmr-jp/prompt-line/commit/a85fd386114e6d7158c3a2c618af5fd7242fd884))
* **navigation-manager:** prevent text input flicker by deferring update until after symbol load ([439d938](https://github.com/nkmr-jp/prompt-line/commit/439d9381f8136ff811121911dc33910ba2470a5b))
* **navigation:** defer text input update until symbol search completes ([3f3085c](https://github.com/nkmr-jp/prompt-line/commit/3f3085c3640ac5ef445e06c1dfedd2c7a03f2226))
* **path-manager, slash-command-manager:** prevent default only when handling deletion and refactor UI state management ([d42ef39](https://github.com/nkmr-jp/prompt-line/commit/d42ef391308db4b557b7f97c0fbe018e84edcc95))
* **path-manager:** prevent backspace default behavior only when handling single trailing space ([c864d61](https://github.com/nkmr-jp/prompt-line/commit/c864d616869dd3062779665301488f0e40a80acf))
* **popup-position-calculator:** change default horizontalGap from 2px to 0px ([146c603](https://github.com/nkmr-jp/prompt-line/commit/146c603edb085caa11e7eebc8a45f2b4dc6a94e8))
* **popup-position-calculator:** reduce default horizontal gap from 8px to 2px ([c971344](https://github.com/nkmr-jp/prompt-line/commit/c971344f96dab8534bcfa9a2391a1086acacb1a0))
* **popup-position-calculator:** use bottom CSS property when positioning popup above target ([ace7c4c](https://github.com/nkmr-jp/prompt-line/commit/ace7c4c0ec43920aa6128de5dfee1a8feab5bdc6))
* **settings,prefix-resolver:** support tilde expansion in basePath and prefixPattern ([097ed7a](https://github.com/nkmr-jp/prompt-line/commit/097ed7a4a30224f7559cb60c3269cafa091415fd))
* **settings:** add prefixPattern to getMdSearchEntries conversion ([bf5ce73](https://github.com/nkmr-jp/prompt-line/commit/bf5ce733c332cf2e356ca5ac0e9deeb22afdae52))
* **slash-command-manager,path-manager:** require space/tab confirmation for slash command suggestions ([3017ebd](https://github.com/nkmr-jp/prompt-line/commit/3017ebd101c374b4223a813d43cb04184e55d37c))
* **slash-command-manager:** convert viewport coordinates to main-content relative coordinates ([ffa10f7](https://github.com/nkmr-jp/prompt-line/commit/ffa10f7f06e98d84962c3ddc0f53a4a4deb14703))
* **slash-command-manager:** hide frontmatter popup when showing selected command ([015d0bb](https://github.com/nkmr-jp/prompt-line/commit/015d0bb82a569d36656353c1253692c6e392d009))
* **slash-command-manager:** hide suggestions when user types arguments after command ([7f442c8](https://github.com/nkmr-jp/prompt-line/commit/7f442c820ada8f25edf441ba2569f882ce7ebe15))
* **slash-command-manager:** improve hint visibility logic for trailing whitespace ([c95d04e](https://github.com/nkmr-jp/prompt-line/commit/c95d04e281f67a0886abb61a5e7a0d98853067d8))
* **slash-command-manager:** improve menu positioning when displayed above cursor ([024b1cf](https://github.com/nkmr-jp/prompt-line/commit/024b1cfdb078b91018bd83ae7fc0126b64d44fcb))
* **slash-command-manager:** only trigger paste when slash command is at text start ([574f178](https://github.com/nkmr-jp/prompt-line/commit/574f1781caba274c8d8fedf8436ceb22b1a87eae))
* **slash-command-manager:** show argumentHint when cursor returns to argument position ([1aec8b6](https://github.com/nkmr-jp/prompt-line/commit/1aec8b65cbf13c5cdcba2f9ec08fd4d28405a5c9))
* **slash-command-manager:** simplify paste trigger logic for enter key ([044877a](https://github.com/nkmr-jp/prompt-line/commit/044877aee74a02ab9cbabd26fb4811fed42470df))
* **slash-command-manager:** simplify trigger detection and restore real-time suggestions ([90c8a2c](https://github.com/nkmr-jp/prompt-line/commit/90c8a2c9c629c759c28cd3e835d02b608aa25a3d))
* **slash-command-manager:** support colon in command names for argument hints ([23476d5](https://github.com/nkmr-jp/prompt-line/commit/23476d5f7eddae5198373edb94fd1e719e6433a2))
* **slash-command-manager:** track command position for proper argument hint validation ([3b30699](https://github.com/nkmr-jp/prompt-line/commit/3b306992e09d8e2b7c04c486fbfd688cd17db9fd))
* **slash-command-manager:** use correct trigger position for argument hint display ([2b865c0](https://github.com/nkmr-jp/prompt-line/commit/2b865c0d12cae2dbeaf21a73e3024c8cee7d3b9c))
* **slash-command-manager:** use Tab behavior for command selection via click ([c51f541](https://github.com/nkmr-jp/prompt-line/commit/c51f541ea9c29ae0a031fcec8c99db06a598edaa))
* **slash-command:** handle duplicate commands with gray highlight ([16520f2](https://github.com/nkmr-jp/prompt-line/commit/16520f2461f1e55d80a78c4c1e2e136b78da59ca))
* **slash-commands:** only delete entire command if it's a known command ([b6a0e95](https://github.com/nkmr-jp/prompt-line/commit/b6a0e95d05e1abcbe714f2a60ece4180cfbfaab9))
* **styles:** change overflow-wrap to 'anywhere' for breaking long paths/URLs ([6ad1acc](https://github.com/nkmr-jp/prompt-line/commit/6ad1acc1d4b247c76f7d35a7d686beb50b4579bd))
* **styles:** change word-break from break-all to normal in input section ([8d666c7](https://github.com/nkmr-jp/prompt-line/commit/8d666c708d424d217f8df821633aa6ae1e0fe091)), closes [#textInput](https://github.com/nkmr-jp/prompt-line/issues/textInput)
* **symbol-searcher:** include hidden and gitignored files when using include patterns ([cab10e9](https://github.com/nkmr-jp/prompt-line/commit/cab10e94dad10a036eea2d926b6a00cf7b9477e7))
* **symbol-searcher:** skip cache when patterns are specified ([571543d](https://github.com/nkmr-jp/prompt-line/commit/571543de045a7e5749e2c9cbebf6141889ac140c))
* **window:** prevent Prompt Line from becoming paste target on double-trigger ([734dc77](https://github.com/nkmr-jp/prompt-line/commit/734dc774996fade230e67c75e2d9a66c5be9a90c))
* **window:** prevent window repositioning when Prompt Line is focused ([081494e](https://github.com/nkmr-jp/prompt-line/commit/081494ed700cd30b1f0b762b3dd5b7114fbacfe2))
* **window:** restore window position when recreated after space change ([3f69643](https://github.com/nkmr-jp/prompt-line/commit/3f69643aea2ce497931a98e4556712fec9a99cfb))
* **window:** support both production and development bundle IDs in app detection ([ef72fba](https://github.com/nkmr-jp/prompt-line/commit/ef72fbaa480675a424ac59c2f3208eb8e388c9ed))

### Code Refactoring

* **code-search:** add type annotations and pass include/exclude patterns to search ([9694a71](https://github.com/nkmr-jp/prompt-line/commit/9694a710916f0bc1d5da80cfa381f46b01ac6aa1))
* **code-search:** split symbol navigation into quiet load and UI update phases ([d1c970e](https://github.com/nkmr-jp/prompt-line/commit/d1c970e23bd3a14794c611750460c27cd4de84e7))
* **config:** move skills from mdSearch to slashCommands ([04d2702](https://github.com/nkmr-jp/prompt-line/commit/04d27022193c3771eae68809e31107d9f902cc02))
* **file-suggestions:** improve frontmatter icon hit area with pseudo-element ([f9afac5](https://github.com/nkmr-jp/prompt-line/commit/f9afac5d29431bafab13aaa43530d60b017698b2))
* **frontmatter-popup-manager:** move file path to frontmatter content ([fe32d2b](https://github.com/nkmr-jp/prompt-line/commit/fe32d2b40d76b63b4cf045e989fa25e26bf4e29b))
* **history-ui:** remove debug logging and simplify comment ([de75cf0](https://github.com/nkmr-jp/prompt-line/commit/de75cf027282a60d83ea4c5a34ac2b466ba3cbcb))
* **history-ui:** simplify thumb height calculation to linear formula ([ce197bb](https://github.com/nkmr-jp/prompt-line/commit/ce197bbf30a04171d9beb7c2db551c97f33392ee))
* **history:** simplify duplicate handling and item updates ([3f2a3bf](https://github.com/nkmr-jp/prompt-line/commit/3f2a3bff7d917292a940f39af9ef66d4c2883bfa))
* **main:** remove unused directory detection test function ([0ddad3f](https://github.com/nkmr-jp/prompt-line/commit/0ddad3f691a0920e09248db2d40d1a33caf42902))
* **navigation-manager:** reorder text input update in symbol navigation ([baebb1a](https://github.com/nkmr-jp/prompt-line/commit/baebb1a08c8da5f573b0c388e3b9532b679a9750))
* **notifications:** move copy feedback from toast to app name area ([9a12b41](https://github.com/nkmr-jp/prompt-line/commit/9a12b419b0f5deb270a35b06473e90e04e501852))
* **renderer:** extract load more increment to named constant ([8312c0a](https://github.com/nkmr-jp/prompt-line/commit/8312c0a6b60fa475cf1af11a7a0ae6a8031a9520))
* **slash-command-manager:** move argumentHint logic before paste decision ([00e21aa](https://github.com/nkmr-jp/prompt-line/commit/00e21aad0de999a9f548650dd9fe31dc488702f4))
* **slash-command-manager:** prioritize label badge over source badge ([c82c32e](https://github.com/nkmr-jp/prompt-line/commit/c82c32ef8ac914ff7dbcd9cb02d71970b01aa842))
* **slash-command-manager:** replace regex with command list matching for argument hints ([083abf4](https://github.com/nkmr-jp/prompt-line/commit/083abf40bcb85f31e8e02c336bcd5eaf423ce982))
* **slash-command-manager:** simplify cursor positioning logic ([4d6626a](https://github.com/nkmr-jp/prompt-line/commit/4d6626a70d088aaa68a53876202e4a00cd39efef))
* **slash-commands:** extract copied notification into reusable toast component ([11f2679](https://github.com/nkmr-jp/prompt-line/commit/11f26794109a2da5728b3b0dc7437070539265a1))
* **slash-commands:** extract trigger query logic into reusable utility ([8e5a2bf](https://github.com/nkmr-jp/prompt-line/commit/8e5a2bf764d75f3a753fdabeb1bddac7fa140f4d))
* **slash-commands:** rename labelColor to color for consistency ([1419f48](https://github.com/nkmr-jp/prompt-line/commit/1419f485ea5244ed3870b5d5da891d054fba38d6))
* **slash-commands:** replace CSS class toggling with dynamic DOM element for copy feedback ([f37092a](https://github.com/nkmr-jp/prompt-line/commit/f37092ae31975b749176722f8cc7a8bd18dfad07))
* **slash-commands:** support commented example entries in YAML generation ([308c24e](https://github.com/nkmr-jp/prompt-line/commit/308c24e3953c04fe95a8dd6f28d684cbbe718d8b))
* **styles:** remove unused position relative and ::before pseudo-element from frontmatter-info-icon ([cb0f341](https://github.com/nkmr-jp/prompt-line/commit/cb0f34149fe6fa2da372c804977dd6fab8043c9d))
* **styles:** replace text-decoration with box-shadow for slash command highlights ([7cd314a](https://github.com/nkmr-jp/prompt-line/commit/7cd314a86055775057f252bd6602993098545a22))

### Performance Improvements

* **history-section:** add smooth width transition to scrollbar on hover ([136f107](https://github.com/nkmr-jp/prompt-line/commit/136f10701ea65c47e8f18d68a4a779258a907723))
* **history-ui:** increase scrollbar thumb size and min height ([1976372](https://github.com/nkmr-jp/prompt-line/commit/197637233e22c83c073f21e4c7a1204a92077a2d))
* **history-ui:** increase scrollbar thumb size for better visibility ([1fc4919](https://github.com/nkmr-jp/prompt-line/commit/1fc4919df0e47a68694a356470e83d39af2da747))
* **history-ui:** reduce minimum scrollbar thumb height from 30px to 10px ([d175e45](https://github.com/nkmr-jp/prompt-line/commit/d175e45057602f21f186bcd5cbdd9686a9bd3f64))
* **history:** adjust scrollbar thumb size calculation and width ([1bc82ec](https://github.com/nkmr-jp/prompt-line/commit/1bc82ec8e26ef37018727266d5bcae69ccf82914))
* **input-section:** prevent layout thrashing and horizontal overflow flicker ([ed0d047](https://github.com/nkmr-jp/prompt-line/commit/ed0d047aa1c8ca47a923cee6bdd664d7a19e4047)), closes [#textInput](https://github.com/nkmr-jp/prompt-line/issues/textInput) [#textInput](https://github.com/nkmr-jp/prompt-line/issues/textInput)
* **input-section:** reduce slash command underline thickness from 2px to 1px ([4c1d769](https://github.com/nkmr-jp/prompt-line/commit/4c1d769f052b842015a9b0227c5c8d2dea4c2889))
* **slash-command-manager:** defer popup position calculation until scroll completes ([caa9fa5](https://github.com/nkmr-jp/prompt-line/commit/caa9fa519e49e57d1e3ac2a1048f2be17fc4789d))
* **styles:** reduce opacity of slash command highlights from 0.4 to 0.25 ([8a9bc3c](https://github.com/nkmr-jp/prompt-line/commit/8a9bc3cd914be4776957a33a011383739693d553))

### Tests

* **settings-manager:** add comprehensive hot reload functionality tests ([a1d54e3](https://github.com/nkmr-jp/prompt-line/commit/a1d54e34892d8145718ccf6d87cbc4af08a15708))
* **settings-manager:** add tests for enable/disable filters in getMdSearchEntries ([05aad3e](https://github.com/nkmr-jp/prompt-line/commit/05aad3ee7b2ada6d5a2ac88c4a5bfc29d0afda6b))
* update settings and yaml generator tests for plugin and skill entries ([56a7db3](https://github.com/nkmr-jp/prompt-line/commit/56a7db3f12c0f98cbbc01f604737f4ed175d3710))

### Maintenance

* remove claude-mem context blocks from CLAUDE.md files ([2e386a1](https://github.com/nkmr-jp/prompt-line/commit/2e386a11d2976920c3e970c6ece327ebc75a9ffa))

## [0.15.0](https://github.com/nkmr-jp/prompt-line/compare/v0.14.2...v0.15.0) (2026-01-04)

### Features

* **settings:** add default mentions configuration with fileSearch and symbolSearch ([c233696](https://github.com/nkmr-jp/prompt-line/commit/c2336960ca5c8b09e5c3d40a1d3555e10b145bf0))
* **symbol-search:** add ripgrep availability check and symbol search enablement ([e838b5f](https://github.com/nkmr-jp/prompt-line/commit/e838b5f07619233590bd8c196cf3c429ff3317f0))
* **symbol-search:** add symbol search enable/disable state management ([80f6b1d](https://github.com/nkmr-jp/prompt-line/commit/80f6b1dec06c763daa34558d9f36309434d64369))
* **symbol-searcher:** require git repository for symbol search operations ([3842722](https://github.com/nkmr-jp/prompt-line/commit/3842722f05c12bd82472c77d20828e1140a0d69b))

### Bug Fixes

* **config:** correct mdSearch entry indentation and separator formatting ([0f1ff97](https://github.com/nkmr-jp/prompt-line/commit/0f1ff97e3f20403bec4f8f20f45b446a48891edc))
* **config:** normalize comment indentation in YAML examples ([e5204c3](https://github.com/nkmr-jp/prompt-line/commit/e5204c3dd9abbbf09d4e070987f4679ad9dc8939))
* **file-search:** disable file search when fd command is unavailable ([0ae36f5](https://github.com/nkmr-jp/prompt-line/commit/0ae36f55be777168d1328edd0039547db3d5d9fe))
* **settings:** improve error handling and array serialization ([a4b809d](https://github.com/nkmr-jp/prompt-line/commit/a4b809d59d0337c7d40ced68be88d15a09490811))
* **settings:** include commented examples when saving settings ([5df9b60](https://github.com/nkmr-jp/prompt-line/commit/5df9b60c052dd6ffd6e88769959a6a6fc157ed2e))
* **snapshot-manager:** remove debug log spam during history navigation ([6b48dbf](https://github.com/nkmr-jp/prompt-line/commit/6b48dbf6cef7e40369877782f2f9306337af91a9))
* **window:** skip background directory detection when fd command unavailable ([2f2be13](https://github.com/nkmr-jp/prompt-line/commit/2f2be13518b46421d9f0dd5a39eaf65028556846))

### Code Refactoring

* **config:** consolidate default settings to single source of truth ([485b281](https://github.com/nkmr-jp/prompt-line/commit/485b281a80a779c775434dfc3aa628ba4b482d62))
* **config:** unify default settings as single source of truth ([af4176c](https://github.com/nkmr-jp/prompt-line/commit/af4176c1276dd723bc1b7044a6b1e53949d37c66))
* consolidate default settings into single source of truth ([b5ad6b3](https://github.com/nkmr-jp/prompt-line/commit/b5ad6b3117fdee3941304afd473dbcd3dd3ff94f))
* **settings-manager:** improve null safety in settings merging and simplify defaults ([cfe9f59](https://github.com/nkmr-jp/prompt-line/commit/cfe9f5949d50537bf77cfbe6767ff07673977ce7))
* **settings:** consolidate example settings generation from source ([bd5cd75](https://github.com/nkmr-jp/prompt-line/commit/bd5cd75bfa111205ef4c0997ff7daa0f6a3ced86))
* **settings:** consolidate YAML generation into single source of truth ([8587603](https://github.com/nkmr-jp/prompt-line/commit/85876038fd0a377340f434057f1b3c96e8ac61cf))
* **slash-commands:** simplify builtIn configuration structure ([a32c689](https://github.com/nkmr-jp/prompt-line/commit/a32c6890fcb35a50b5f1d987d0db72dde745ecb3))

### Performance Improvements

* **symbol-search:** increase default maxSymbols and timeout limits ([fa57dd3](https://github.com/nkmr-jp/prompt-line/commit/fa57dd3f5bc8ffa599a4a65af02e53d1b1460cae))

### Maintenance

* **config:** update default file opener extensions ([725d4d7](https://github.com/nkmr-jp/prompt-line/commit/725d4d78416729d9bd7f268c766456761888e29e))

## [0.14.2](https://github.com/nkmr-jp/prompt-line/compare/v0.14.1...v0.14.2) (2026-01-01)

### Bug Fixes

* **slash-command-manager:** refactor DOM construction to match list view order ([e04773b](https://github.com/nkmr-jp/prompt-line/commit/e04773b2da88b58b94c1e353355f1769b0c7a024))

### Code Refactoring

* **settings:** streamline settings structure and expand slash commands & mentions features ([32070b3](https://github.com/nkmr-jp/prompt-line/commit/32070b389354842997276057f0fd984fa6f9bd5a))

### Maintenance

* **deps:** bump qs in the npm_and_yarn group across 1 directory ([4797b7c](https://github.com/nkmr-jp/prompt-line/commit/4797b7c623494ec64324deb2ae3dad35bd62b053))
* **package-lock:** remove and re-add "peer" fields for dependencies ([33d213a](https://github.com/nkmr-jp/prompt-line/commit/33d213a9529e79dd9a590237ab27b13d99cce98b))
* **release:** 0.14.0 [skip ci] ([dd1f052](https://github.com/nkmr-jp/prompt-line/commit/dd1f052621fe69cff9de690439c1ec8b0bff9444))

## [0.14.1](https://github.com/nkmr-jp/prompt-line/compare/v0.14.0...v0.14.1) (2026-01-01)

### Maintenance

* **deps:** bump qs in the npm_and_yarn group across 1 directory ([68dbd0c](https://github.com/nkmr-jp/prompt-line/commit/68dbd0c823e0f61fdc659fe5d92ffea08827910e))

## [0.14.0](https://github.com/nkmr-jp/prompt-line/compare/v0.13.0...v0.14.0) (2026-01-01)

### Features

* add JetBrains MCP server configuration ([06b5172](https://github.com/nkmr-jp/prompt-line/commit/06b5172826db707189ab389a4ee9ba877a9f0e78))
* **built-in-commands:** add settings-based filtering for built-in commands ([ec60286](https://github.com/nkmr-jp/prompt-line/commit/ec6028627cee537b3da573e56398ba3e42e3c307))
* **built-in-commands:** add support for built-in slash commands ([0b7210c](https://github.com/nkmr-jp/prompt-line/commit/0b7210cbed9f8186eb7e4547e908938ae1514096))
* **directory-operations:** pass file search settings to directory listing ([26c6d64](https://github.com/nkmr-jp/prompt-line/commit/26c6d648ec83d196493cb9371f13cb5941f9d49c))
* **draft:** persist and restore scroll position for draft text ([ac46c35](https://github.com/nkmr-jp/prompt-line/commit/ac46c352ffed0c15a0f6377fc261762b8ce09976))
* **eslint:** add custom CSP validation rule for inline styles ([4d3f527](https://github.com/nkmr-jp/prompt-line/commit/4d3f527dace2f5de082962a528b6556cbf6eb6eb))
* **mdsearch:** add source and displayName fields to user-defined commands ([985f8a8](https://github.com/nkmr-jp/prompt-line/commit/985f8a864220f9c1339b4a41dda52c34a2f04f21))
* **native:** add tmux detection as fallback for directory detection ([c072167](https://github.com/nkmr-jp/prompt-line/commit/c07216793011a6aa4528e0619c70bb609ea47ad7))
* **settings:** add builtInCommands support to settings merge ([ea5a4a8](https://github.com/nkmr-jp/prompt-line/commit/ea5a4a88bc6bc150ae2a8706c97d9ee1d0f236f2))
* **shortcuts:** add Shift+Cmd+, to open settings directory ([47ab638](https://github.com/nkmr-jp/prompt-line/commit/47ab6383c41e4d823ee7ef0b6b255de06218de6f))
* **slash-commands:** add display name support for built-in commands ([254470b](https://github.com/nkmr-jp/prompt-line/commit/254470b2a748515876dd65a67e1591911bfccb94))
* **slash-commands:** add displayName field for source badge display ([50b0289](https://github.com/nkmr-jp/prompt-line/commit/50b02897242cf7a8b09745f19aa4b881eff7f795))
* **slash-commands:** add displayName to command filtering logic ([7e2d9b9](https://github.com/nkmr-jp/prompt-line/commit/7e2d9b9a1eb1e58db11944d7599de958dc87c631))
* **slash-commands:** add reference documentation links to command metadata ([741c6cb](https://github.com/nkmr-jp/prompt-line/commit/741c6cb8d723d60dcf4e149364c83d1786dda4ff))
* **slash-commands:** add source-specific badge colors and data attributes ([557616b](https://github.com/nkmr-jp/prompt-line/commit/557616b63799b45f692f99461371043ba911f5c6)), closes [#e8c58](https://github.com/nkmr-jp/prompt-line/issues/e8c58) [#7](https://github.com/nkmr-jp/prompt-line/issues/7) [#82](https://github.com/nkmr-jp/prompt-line/issues/82) [#c792](https://github.com/nkmr-jp/prompt-line/issues/c792)
* **symbol-searcher:** add caching and block-based symbol detection for Go ([b859808](https://github.com/nkmr-jp/prompt-line/commit/b85980800bc17769732f11cadb0ca41bc32412b2))
* **symbol-searcher:** add Go generic function and method pattern support ([1f7ec47](https://github.com/nkmr-jp/prompt-line/commit/1f7ec476b695e8fcc35c202d68f863bbc040dc46))
* **text-field-detector:** add container detection for terminal apps like Ghostty ([6e5f28a](https://github.com/nkmr-jp/prompt-line/commit/6e5f28af13e7dc6f4ab07bbfa2c096edca4c209c))
* **ui:** display source label in selected slash command header ([919e8d5](https://github.com/nkmr-jp/prompt-line/commit/919e8d55d561f567ebc74c4bf7e6b90965fe055b))

### Bug Fixes

* **csp:** remove unsafe-inline style from CSP policy ([e263afe](https://github.com/nkmr-jp/prompt-line/commit/e263afe943a86e7c268199399f251be20f6b78b4))
* **cursor-position:** ensure cursor stays correct after [@mention](https://github.com/mention) deletion ([3321d50](https://github.com/nkmr-jp/prompt-line/commit/3321d5007ab54d450cdf8d333011d07993ac2735))
* **directory-detector:** optimize Ghostty CWD detection with fast process tree traversal ([edc7819](https://github.com/nkmr-jp/prompt-line/commit/edc7819e313d8a2f724e755fdac240b4fd7c05cb))
* **directory-detector:** update hint text for large directory detection timeout ([ad41b7c](https://github.com/nkmr-jp/prompt-line/commit/ad41b7c15f0b6a3e7320bb8a7fab93b4d327a96c))
* **file-search:** allow hidden directories in absolute path detection ([216ebbe](https://github.com/nkmr-jp/prompt-line/commit/216ebbe0d497166710286ee425bbc92e12cd5785))
* **file-search:** consolidate backdrop rendering to use unified range processing ([1d8cf2e](https://github.com/nkmr-jp/prompt-line/commit/1d8cf2e5b1921d06132b0bed0e2d70e51e5f0a68))
* **file-search:** correct type annotations for filtered files and agents ([b3d1770](https://github.com/nkmr-jp/prompt-line/commit/b3d17701f824c23275a84be953509e9673cf5b94))
* **file-search:** support hidden directories in path detection ([ac1bf8f](https://github.com/nkmr-jp/prompt-line/commit/ac1bf8fb2d3c33d08da0f0211057dd742b5a3614))
* **lifecycle:** restore scroll position before rendering to prevent visual flickering ([5f59997](https://github.com/nkmr-jp/prompt-line/commit/5f59997df3b8d93290e8b804635e4a832fb9e228))
* **mentions:** remove invalid regex quantifier in tilde path pattern ([2e18021](https://github.com/nkmr-jp/prompt-line/commit/2e18021bd19a2f86eb6cfcf30c0f9ef3333fb5e2))
* **mentions:** resolve cursor jump to position 0 when deleting [@mention](https://github.com/mention) paths ([99f9dc7](https://github.com/nkmr-jp/prompt-line/commit/99f9dc7732a326615b4f00b5eeb3151b1cce3575))
* **native:** optimize Ghostty detection and add tmux-based terminal support ([0186279](https://github.com/nkmr-jp/prompt-line/commit/0186279c8a58d6895cc6eff9a1de4a5c8599f6c8))
* **path-manager:** prevent accidental deletion of [@path](https://github.com/path) when cursor is on new line ([62a55b3](https://github.com/nkmr-jp/prompt-line/commit/62a55b35ef03474019a9b231836646b6ad9b8c3a))
* **security:** allow unsafe-inline styles in CSP for Electron app ([a9f8ad2](https://github.com/nkmr-jp/prompt-line/commit/a9f8ad275d4701408f106ba3010a755a26cffd80))
* **slash-command-manager:** refactor DOM construction to match list view order ([475f258](https://github.com/nkmr-jp/prompt-line/commit/475f2582ec4a85bda950504becb55dc0091afbfc))
* **symbol-search:** add maxBuffer option to execFile calls for large codebases ([6206371](https://github.com/nkmr-jp/prompt-line/commit/62063715287e99ff15cbeb37008120ec066f1150))
* **symbol-searcher:** add variable pattern for Go var blocks ([d836ff8](https://github.com/nkmr-jp/prompt-line/commit/d836ff89bdb02b7aa7fd824895bd359ecd6cc9e9))
* **symbol-searcher:** improve Go constant and variable detection in const/var blocks ([0b86307](https://github.com/nkmr-jp/prompt-line/commit/0b86307f5f9dd81ebdd567223b288e06442e2e81))
* **symbol-searcher:** improve Go constant detection regex to reduce false positives ([c2d2d49](https://github.com/nkmr-jp/prompt-line/commit/c2d2d49b560d5139da1a2bb53bfda55f8b6e346c))
* **symbol-searcher:** improve Go constant/variable indentation pattern matching ([26da668](https://github.com/nkmr-jp/prompt-line/commit/26da66809a318e93a705ff35cf3f47f9d6915c11))
* **symbol-searcher:** improve Go symbol detection with keyword exclusion ([bca1edf](https://github.com/nkmr-jp/prompt-line/commit/bca1edff86502f2ddb6150f9c2978cc1ca3348cc))
* **symbol-searcher:** improve Go variable detection in var blocks ([3e526ab](https://github.com/nkmr-jp/prompt-line/commit/3e526ab51a43bd86c69b8ef1eec7fa734c0c2ed4))
* **symbol-searcher:** refine Go constant pattern matching to exclude function calls ([9719a7a](https://github.com/nkmr-jp/prompt-line/commit/9719a7a112214fb1a02a4f6cbd2d1a99983dc47b))
* **symbol-searcher:** support space indentation in Go const blocks ([78dd031](https://github.com/nkmr-jp/prompt-line/commit/78dd03170d51ae87fe07bb8981ac63c824cd2426))
* **symbol-search:** exclude short variable declarations from Go constant detection ([dc388dd](https://github.com/nkmr-jp/prompt-line/commit/dc388dd3769b4977425ed3f4998c02842ad01bb5))
* **symbol-search:** improve Go constant pattern matching for various literal types ([19820e4](https://github.com/nkmr-jp/prompt-line/commit/19820e44dcd5a8b42b2e52c57cb8789a5e331cd3))
* **system-handler:** open settings directory instead of file ([c92784b](https://github.com/nkmr-jp/prompt-line/commit/c92784be6464fb6d9be4f884a29d1b1b5dc2e88e))
* **test:** update IPC handler count for open-settings-directory ([37327b5](https://github.com/nkmr-jp/prompt-line/commit/37327b5a0fd303325a7caca80a851e3d17595448))

### Code Refactoring

* **built-in-commands:** migrate from individual md files to YAML-based generation ([9596a60](https://github.com/nkmr-jp/prompt-line/commit/9596a6013c47fbbaf11c27bd2edabe4dbee4b7c5))
* **commands:** load built-in commands from YAML directly ([a7781e4](https://github.com/nkmr-jp/prompt-line/commit/a7781e4f9ec787bf028a1c4718f63e2cb61df0a1))
* consolidate magic numbers into constants and simplify directory detection ([e540e93](https://github.com/nkmr-jp/prompt-line/commit/e540e930d000a4c14719a29df23ca097bfbe36e8))
* extract HandlerStats type and implement BaseCacheManager for cache abstraction ([446431d](https://github.com/nkmr-jp/prompt-line/commit/446431d2dbe9446ad80663ddd8bfde6293087e0c))
* **file-search-manager:** extract initialization methods and simplify control flow ([07fca8b](https://github.com/nkmr-jp/prompt-line/commit/07fca8b93b885c44dc3ba00f15849f675f26bfcd))
* **file-search:** consolidate path pattern constants for consistency ([a69457a](https://github.com/nkmr-jp/prompt-line/commit/a69457a2d57a7c8ecad33081e118cce62d3744e7))
* **file-search:** delegate symbol mode logic to CodeSearchManager ([ec27e5f](https://github.com/nkmr-jp/prompt-line/commit/ec27e5f2e5ed47714a1a2e164d3a31b68870f29f))
* **file-search:** extract initialization logic into FileSearchInitializer class ([284301f](https://github.com/nkmr-jp/prompt-line/commit/284301fe65c3fe4b54ac7a86b304d77b46340493))
* **mdsearch:** allow duplicate command names with different sources ([10ebf0f](https://github.com/nkmr-jp/prompt-line/commit/10ebf0f90844a1995ff6be319fa3b24e0931132c))
* **mentions:** consolidate file-search and code-search into unified mentions module ([bd237f3](https://github.com/nkmr-jp/prompt-line/commit/bd237f3e621f4736d4c3de5164d04f949b4adaab))
* **mentions:** remove debug logging statements ([49bf7a1](https://github.com/nkmr-jp/prompt-line/commit/49bf7a11e2a08a94449b7b34d626361d16a22f71))
* **native:** streamline tmux and container detection logic ([575bdd5](https://github.com/nkmr-jp/prompt-line/commit/575bdd55182f349eb46bdc052b938a2e12ceb228))
* remove debug console logs from dom and event managers ([5dcc07c](https://github.com/nkmr-jp/prompt-line/commit/5dcc07c8101c6698cf325b65c5cd7490726f27d6))
* remove excessive debug logging throughout codebase ([be713c9](https://github.com/nkmr-jp/prompt-line/commit/be713c9e6cc8cfb04fcdc46e80c38b4792b8d32e))
* remove redundant info-level logging from handlers and renderer ([d3ee201](https://github.com/nkmr-jp/prompt-line/commit/d3ee2015c32e92e05ccfbbbfe86f24a2a730a5fc))
* rename FileSearch* to Mention* for consistent naming ([36ad462](https://github.com/nkmr-jp/prompt-line/commit/36ad4622f89dc4e7da819b76e08f462b677de9b3))
* **renderer:** centralize electronAPI access with type-safe service ([7334279](https://github.com/nkmr-jp/prompt-line/commit/7334279b63588f897a2f8388c2677c143d09c78e))
* **renderer:** implement IInitializable interface and lazy-load electronAPI ([7d0a23c](https://github.com/nkmr-jp/prompt-line/commit/7d0a23ca78801d2a317b0aae5e94d3f9f59553bf))
* **renderer:** split DirectoryDataHandlerCallbacks into focused interfaces ([5a0b03c](https://github.com/nkmr-jp/prompt-line/commit/5a0b03cb39d1c3bcda03dd26aa13e0268e3ae67d))
* **settings:** auto-append colon to searchPrefix for cleaner configuration ([9af54de](https://github.com/nkmr-jp/prompt-line/commit/9af54de21a20b1debeb99a5645edc7112dbe56c4))
* **settings:** migrate mention settings to unified nested structure ([0de1d58](https://github.com/nkmr-jp/prompt-line/commit/0de1d582185edeb7172afde2dd2300c932a06fd5))
* **settings:** rename userDefined to custom and mdSearch for slash commands and mentions ([a4bd4fa](https://github.com/nkmr-jp/prompt-line/commit/a4bd4fa113af58f3de55fc0ca2d879b4b93c5e56))
* **settings:** restructure settings for slash commands and mentions ([a907c76](https://github.com/nkmr-jp/prompt-line/commit/a907c76e1575dba146a465a80bd1ed6961f2f6f7))
* **slash-command-manager:** remove maxSuggestions limit ([397336f](https://github.com/nkmr-jp/prompt-line/commit/397336f5341844dcdb60249cd830a36417e97e60))
* **slash-commands:** remove enabled flag from builtIn settings ([a042b63](https://github.com/nkmr-jp/prompt-line/commit/a042b63c6b56026b9158b6ae29e307b3af53b761))
* **slash-commands:** remove inputFormat field from SlashCommandEntry ([6648c0e](https://github.com/nkmr-jp/prompt-line/commit/6648c0e45b533f2823f5eba9ecf6744e880fe9cc))
* **symbol-search:** change rgPaths array to single rgPath string ([4adfeec](https://github.com/nkmr-jp/prompt-line/commit/4adfeec1cec65ef9ab82960348ddc585e8ff2b30))
* **symbol-searcher:** move cache to ~/.prompt-line/cache/projects/ ([8bc1d59](https://github.com/nkmr-jp/prompt-line/commit/8bc1d590554dd65675179c698fe1b299bfbcc1f4))
* **symbol-search:** simplify Go variable pattern matching ([3036cd1](https://github.com/nkmr-jp/prompt-line/commit/3036cd1ac0f1b6ffbffdf64414dfdadd663e4f00))

### Performance Improvements

* **code-search:** optimize symbol filtering with main process filtering and memory cache ([d664ebe](https://github.com/nkmr-jp/prompt-line/commit/d664ebeaeb867a36f69ccd9e38d8ab7a058cb960))

### Maintenance

* **built-in-commands:** rename YAML files to .yml extension ([89aeb43](https://github.com/nkmr-jp/prompt-line/commit/89aeb439a6e7277a8934b0fb1ccb5d59cb65d08c))
* **commands:** quote descriptions containing colons in YAML ([448c1b3](https://github.com/nkmr-jp/prompt-line/commit/448c1b37c108e9b8f9ca7a33a4ea0e3b08ef6f27))
* **commands:** remove blank lines from claude.yaml command list ([3a1587e](https://github.com/nkmr-jp/prompt-line/commit/3a1587e29dd4a07e15b61922be8a33ba16555f66))
* **commands:** remove outdated claude-code.yaml built-in commands file ([48e8754](https://github.com/nkmr-jp/prompt-line/commit/48e87543171fb1135b853179740450b685360173))
* **commands:** reorganize and update built-in slash command descriptions ([acbb621](https://github.com/nkmr-jp/prompt-line/commit/acbb621d63ec2056d60bcd5411477688b1debd31))
* **commands:** reorganize built-in slash commands by functional category ([877c3ce](https://github.com/nkmr-jp/prompt-line/commit/877c3ce7d64882cde95da5432db6c374d3416651))
* **logging:** remove non-error debug and info logs from main and renderer processes ([82d431d](https://github.com/nkmr-jp/prompt-line/commit/82d431de537b2b7e063f3faa45ad00c2f59e4977))

## [0.13.0](https://github.com/nkmr-jp/prompt-line/compare/v0.12.0...v0.13.0) (2025-12-28)

### Features

* **@path-cache:** implement persistent registration and caching of selected file paths ([8941bb0](https://github.com/nkmr-jp/prompt-line/commit/8941bb0716cf4b3b12f5e0c15b961a4cb39842e0))
* **at-path-cache:** implement global cache for mdSearch selections ([dd14eaf](https://github.com/nkmr-jp/prompt-line/commit/dd14eaf3a85b36a07f09183df6f618249a1fc207))
* **fileSearch:** add maxSuggestions configuration for file and symbol search ([fcf472e](https://github.com/nkmr-jp/prompt-line/commit/fcf472e29a27e3cf4c0daac4d5c3e02f21448e28))
* **history-ui:** implement custom scrollbar overlay ([b7aeb65](https://github.com/nkmr-jp/prompt-line/commit/b7aeb654815dedab193ebd020cb1f16f22919f5d))
* **native-tools:** add comprehensive native tools module documentation ([b9706dc](https://github.com/nkmr-jp/prompt-line/commit/b9706dc67ca14adde697987873f6990dc06d0553))
* **native-tools:** add Markdown symbol search support ([4049aa3](https://github.com/nkmr-jp/prompt-line/commit/4049aa3111055489c7607899a7eae086091ec628))
* **native-tools:** add Terraform symbol detection support ([8e2172f](https://github.com/nkmr-jp/prompt-line/commit/8e2172f927cdfe1fc4b0fb2e6ded09f73143df90))
* **symbol-search:** increase default file symbol display limit to 50 ([14562f7](https://github.com/nkmr-jp/prompt-line/commit/14562f75b4a30dbd8ded05378344c222ed19976e))
* **text-highlighting:** add underline display for all clickable text ([7dbc86a](https://github.com/nkmr-jp/prompt-line/commit/7dbc86a017b743a24722e744d42d0b0bcb1179de))

### Bug Fixes

* **code-search:** prevent emoji conversion in [@lang](https://github.com/lang): code search patterns ([d6d6f63](https://github.com/nkmr-jp/prompt-line/commit/d6d6f63dc8bd5feb1a3b777328a43741337fefe4))
* **code-search:** prevent macOS emoji conversion in code search input ([86dcc1c](https://github.com/nkmr-jp/prompt-line/commit/86dcc1c7297f7d112b100f9a93000f618d273096))
* **code-search:** render suggestions after symbol search completes ([0fdd8f9](https://github.com/nkmr-jp/prompt-line/commit/0fdd8f9b25fa69f93e19aef149e5e479d30a39bf))
* **dom-manager:** ensure correct cursor position after text replacement ([6969894](https://github.com/nkmr-jp/prompt-line/commit/6969894fa98b3a33d2e8574285dc6e7f52c27a44))
* **event-listener:** force redraw highlight position on tab key press ([c7d5487](https://github.com/nkmr-jp/prompt-line/commit/c7d5487571f1853b5f13286f1671a8885432b7b2))
* **file-search:** add debug logging for [@path](https://github.com/path) backspace handling ([c40ab9a](https://github.com/nkmr-jp/prompt-line/commit/c40ab9ace163434b5f417ce457c9f328f778a583))
* **file-search:** add debug logging for cursor position tracking in path deletion ([909fb5f](https://github.com/nkmr-jp/prompt-line/commit/909fb5f373d21bb2c97cbe947bc5c3dacda58133))
* **file-search:** align tab width between backdrop and textarea ([67d5b11](https://github.com/nkmr-jp/prompt-line/commit/67d5b11c33448d7ae002d157f9371727a771d818))
* **file-search:** convert tabs to spaces in backdrop rendering for correct highlighting ([318fa96](https://github.com/nkmr-jp/prompt-line/commit/318fa960d03931ed839f684b44c13393acd45446))
* **file-search:** correct [@path](https://github.com/path) deletion logic on backspace ([17df96b](https://github.com/nkmr-jp/prompt-line/commit/17df96b6b166afcdf4df2d2b98cd0d142b77e9a7))
* **file-search:** correct CSS class names in HighlightManager ([63993c2](https://github.com/nkmr-jp/prompt-line/commit/63993c23cddcf89d257a720903e663ed73c53d95))
* **file-search:** correct savedStart position in path replacement logic ([d3f6f2b](https://github.com/nkmr-jp/prompt-line/commit/d3f6f2b2407203fcad11865de289088063a79060))
* **file-search:** correct scroll position synchronization when scrolled to bottom ([8d13009](https://github.com/nkmr-jp/prompt-line/commit/8d1300957b1fe73c0496ed462aeef29b855bec4f))
* **file-search:** ensure backdrop scrollHeight matches textarea for proper scroll synchronization ([7f01ad3](https://github.com/nkmr-jp/prompt-line/commit/7f01ad3137c2e560b126aef1316e5fae0928be98))
* **file-search:** fix [@path](https://github.com/path) detection after line breaks ([d673e6e](https://github.com/nkmr-jp/prompt-line/commit/d673e6e2730125938bfad98c98fdb07e2fe6ecbc))
* **file-search:** fix [@path](https://github.com/path) highlighting for newly selected symbols ([be80ef1](https://github.com/nkmr-jp/prompt-line/commit/be80ef1bbca9628f6dbb6142571dec20bcf367a3))
* **file-search:** fix symbol suggestions limit hardcoded to 20 ([1b74bf8](https://github.com/nkmr-jp/prompt-line/commit/1b74bf8633440d1282c4d5d85fd34e739b627c7e))
* **file-search:** fix tab key highlighting and convert tabs to spaces ([0842b07](https://github.com/nkmr-jp/prompt-line/commit/0842b079beb04adafdc254d25ad52e4b93681883))
* **file-search:** hide file suggestions before starting code search ([037c5c8](https://github.com/nkmr-jp/prompt-line/commit/037c5c8036c5872cfadabf72aee8eafb796af9a3))
* **file-search:** hide old file suggestions during code search initialization ([80277cf](https://github.com/nkmr-jp/prompt-line/commit/80277cfe9ace8f75d2bc188c6c0e07623817fcab))
* **file-search:** improve [@path](https://github.com/path) deletion detection at cursor boundaries ([89ecd9a](https://github.com/nkmr-jp/prompt-line/commit/89ecd9a480bb3fdad376042fa27239eec481e6da))
* **file-search:** improve [@path](https://github.com/path) detection to handle multiple trailing terminators ([e964559](https://github.com/nkmr-jp/prompt-line/commit/e964559b2fbfe9863d50e592759314a39bea501b))
* **file-search:** improve file path insertion and highlight range handling ([6d8914c](https://github.com/nkmr-jp/prompt-line/commit/6d8914c85b42a44af91c33e5cfcc2b811a9b8ed2))
* **file-search:** preserve search state when hiding suggestions ([9667f97](https://github.com/nkmr-jp/prompt-line/commit/9667f976959f0429a3009238108861f67df8f649))
* **file-search:** preserve textarea scroll position during [@path](https://github.com/path) deletion ([7168fac](https://github.com/nkmr-jp/prompt-line/commit/7168fac8e1c257477e3c19cd819fb81b40ab3d06))
* **file-search:** prevent [@path](https://github.com/path) highlight when cursor follows non-space character ([b17e9f0](https://github.com/nkmr-jp/prompt-line/commit/b17e9f01f86bfc1ff159547c3d1a3e186aadf726))
* **file-search:** prevent cursor jump when deleting [@path](https://github.com/path) with backspace ([c3fc761](https://github.com/nkmr-jp/prompt-line/commit/c3fc76100a2fe61a457f1fc8e4dc03cb17e6f8d1))
* **file-search:** prevent false [@path](https://github.com/path) deletion when @ follows [@path](https://github.com/path) ([310a04f](https://github.com/nkmr-jp/prompt-line/commit/310a04fded29912a5883793bf700b2aaff83286c))
* **file-search:** remove duplicate ranges to fix underline positioning ([7d2d05f](https://github.com/nkmr-jp/prompt-line/commit/7d2d05f5ad22199e6359e668a86b438ae8991d84))
* **file-search:** resolve cursor jump bug during [@path](https://github.com/path) deletion ([4acb9f7](https://github.com/nkmr-jp/prompt-line/commit/4acb9f76e6f7df318c93813432b62330366b7e55))
* **file-search:** resolve cursor position after [@path](https://github.com/path) deletion ([5ac846e](https://github.com/nkmr-jp/prompt-line/commit/5ac846e6ba9b71dabd2330be7d21c89630dc790b))
* **file-search:** restore cursor position after [@path](https://github.com/path) deletion ([13715bc](https://github.com/nkmr-jp/prompt-line/commit/13715bcf0968d79e9668b711173bbee5cc631faa))
* **file-search:** restore dropdown positioning in suggestion list ([b20a5d9](https://github.com/nkmr-jp/prompt-line/commit/b20a5d930e5d61e933c48457f94735bd6217b9cf))
* **file-search:** restore original file-search-manager structure ([3e78c40](https://github.com/nkmr-jp/prompt-line/commit/3e78c4003a2ce4b582df18ee1a19daa1c93758e2))
* **file-search:** restrict path end characters to alphanumeric, dots, underscores, parentheses, and colons ([4c98fc5](https://github.com/nkmr-jp/prompt-line/commit/4c98fc5b0fe48a97c76661eeac5ffd68151246b9))
* **file-search:** restrict path patterns to ASCII characters only ([8af369f](https://github.com/nkmr-jp/prompt-line/commit/8af369f0413b3db41e461a8ea7801970d2166e00))
* **file-search:** show error message when file does not exist ([2a227e0](https://github.com/nkmr-jp/prompt-line/commit/2a227e0f579bdbcdfac493dede948ea2e7534862))
* **file-search:** support Makefile symbol search without extension ([998100a](https://github.com/nkmr-jp/prompt-line/commit/998100ae60bc68677feeb156a8b94e645e74b6c1))
* **file-search:** synchronize selectedPaths between FileSearchManager and HighlightManager ([93fd4a2](https://github.com/nkmr-jp/prompt-line/commit/93fd4a2ba668a174e257391062195a1fd0d26e04))
* **highlight-backdrop:** enable scrolling with hidden scrollbar ([4ac2ffe](https://github.com/nkmr-jp/prompt-line/commit/4ac2ffee7e5180d1b17301ecee1c53a81c0268d4))
* **highlight:** use CSS transform for smooth backdrop scrolling ([5c34d6f](https://github.com/nkmr-jp/prompt-line/commit/5c34d6f3ed4fae9b2eedbf086319c6348399f99b))
* **history-ui:** adjust scrollbar positioning and highlight width ([38689fd](https://github.com/nkmr-jp/prompt-line/commit/38689fdffd1e6852f85be86c4c4fdc0f34cff869))
* **history-ui:** ensure scrollbar space allocation for consistent layout ([c6f8d54](https://github.com/nkmr-jp/prompt-line/commit/c6f8d54077ec891c010b417f254cb14badf10a26))
* **history-ui:** extend highlight background to scrollbar area ([e581751](https://github.com/nkmr-jp/prompt-line/commit/e58175139cf0dfad2d9807030a5cab099bfa3df6))
* **history-ui:** overlay scrollbar on history items during scroll ([eec2ea8](https://github.com/nkmr-jp/prompt-line/commit/eec2ea8e51c7dfda4f5cd446796bff269332d23a))
* **history-ui:** use overlay scrollbar to prevent highlight clipping ([cd6e523](https://github.com/nkmr-jp/prompt-line/commit/cd6e52369fec9320f061c8b79f076d8b256c9b6d))
* **history:** adjust scrollbar visibility in history section ([365d1cf](https://github.com/nkmr-jp/prompt-line/commit/365d1cfdee67c7506e9b98fe5753d91d45729c1e))
* **history:** show scrollbar on hover with smooth fade animation ([5df9de6](https://github.com/nkmr-jp/prompt-line/commit/5df9de6271e4082421002b69456bfbd93e284c0b))
* **path-manager:** add debug logging for cursor position validation ([5ece981](https://github.com/nkmr-jp/prompt-line/commit/5ece9816bc05500121f2a3c687cfee46e59c96ba))
* **path-manager:** improve scroll position tracking during path deletion ([f385fb3](https://github.com/nkmr-jp/prompt-line/commit/f385fb39e633b9c64066ef89f52b26431d326cfb))
* restore solid line styling ([fa519e5](https://github.com/nkmr-jp/prompt-line/commit/fa519e5745186d4f8e7c3d28ad06d63cce4529d9))
* **scroll-sync:** revert tab conversion processing and maintain CSS improvements ([eba3819](https://github.com/nkmr-jp/prompt-line/commit/eba3819ca75b83d1e877d1b5e2ccb78965ab5121))
* **scrollbar:** adjust scrollbar visibility to prevent layout shift ([c02abff](https://github.com/nkmr-jp/prompt-line/commit/c02abff9d95cc089b5ce42e83623c817363f5371))
* **scrollbar:** hide scrollbar while preserving scroll functionality ([0661747](https://github.com/nkmr-jp/prompt-line/commit/0661747eb7616afed31788d7f866abe6fa92e139))
* **scrollbar:** restore scrollbar track background styling ([615d11a](https://github.com/nkmr-jp/prompt-line/commit/615d11a68e909cf668f0d1b1e8f2caa4f91cb953))
* **styles:** align text rendering between textarea and highlight backdrop ([6737f07](https://github.com/nkmr-jp/prompt-line/commit/6737f076c6cbb0898385ab56a840d43f9977ab5f))
* **styling:** align backdrop scrollbar width with textarea padding ([b65008d](https://github.com/nkmr-jp/prompt-line/commit/b65008dd1d969f2f92d8287ec000fcc87ac63378))
* **styling:** align backdrop width with scrollbar handling for consistent text wrapping ([36ddbe2](https://github.com/nkmr-jp/prompt-line/commit/36ddbe28a04b6fd4214ed3edd21a15c97a0e831f))
* **symbol-search:** add inline link detection for markdown symbol search ([756d2f4](https://github.com/nkmr-jp/prompt-line/commit/756d2f4571c82d328b2b65b09ecc857c701eff8d))
* **symbol-search:** correct Makefile field mapping and symbol parser ([c873fe3](https://github.com/nkmr-jp/prompt-line/commit/c873fe3f3b4b891b53f454b8d9344e64d141b71d))
* **symbol-searcher:** correct JSON serialization of language extension field ([1855412](https://github.com/nkmr-jp/prompt-line/commit/18554121ba2fcde33b14e17589ed0799e3050a31))
* **symbol-search:** exclude code block comments from Markdown headings ([ec48946](https://github.com/nkmr-jp/prompt-line/commit/ec489466f9e56e87710efeb66f8d2ddf29be0f77))
* **symbol-search:** replace unsupported ripgrep negative lookahead with concrete Go type patterns ([c4c7a24](https://github.com/nkmr-jp/prompt-line/commit/c4c7a2448973038adb08ce262ad7db7767e6a31a))
* **symbol-search:** resolve race condition preventing code search functionality ([fd7f82c](https://github.com/nkmr-jp/prompt-line/commit/fd7f82c30be24d510552aa0d5e3b082b08f4a3d8))
* **textarea:** restore original white-space and overflow-wrap properties ([083fd01](https://github.com/nkmr-jp/prompt-line/commit/083fd01e2b1cc20848af1b07a0fd991487495568))
* **transparency:** increase default transparency to 0.3 ([a33ba41](https://github.com/nkmr-jp/prompt-line/commit/a33ba413804369dd25b03489464e484ce6fbc69c))
* **ui:** prevent layout shift by reserving scrollbar space ([abd1c43](https://github.com/nkmr-jp/prompt-line/commit/abd1c435b357f59f486fb5d1ceff0bceffc750fd))
* **ui:** use overlay scrollbar style for full-width highlighting ([34e4312](https://github.com/nkmr-jp/prompt-line/commit/34e431265c1d68e517d1dfa904229861fc79f0df))

### Code Refactoring

* **@path-highlight:** rearchitect path highlighting with improved CSS metrics and sync ([48f56a7](https://github.com/nkmr-jp/prompt-line/commit/48f56a7882ffd75825d518abc367547dff5efb5c))
* **code-search:** remove link from Markdown symbol search ([16379ad](https://github.com/nkmr-jp/prompt-line/commit/16379ad15e26ee40b92000af3c9c28046027dfdf))
* **code-search:** replace SYMBOL_ICONS with SVG icons ([401e6ee](https://github.com/nkmr-jp/prompt-line/commit/401e6eeeef72ed2bda8d7c92f64dd08dc58b6fb0))
* complete codebase refactoring across 21 tasks in 3 phases ([2d10a01](https://github.com/nkmr-jp/prompt-line/commit/2d10a0178980de0f66e33d43873f82d7f34e99ea))
* consolidate constants and improve code structure ([2af5e49](https://github.com/nkmr-jp/prompt-line/commit/2af5e49671e0eea0a8cedb2f8fddcdd4c3ee17bf))
* consolidate duplicate text field bounds and popup positioning logic ([b831d9b](https://github.com/nkmr-jp/prompt-line/commit/b831d9bf9c5b21da3ec6110927ef9deb2d25f4fb))
* consolidate history manager and remove redundant code ([282340c](https://github.com/nkmr-jp/prompt-line/commit/282340c863b107819632a924eb5bb1eb41638b80))
* consolidate IPC error handling and renderer logging ([7e5e257](https://github.com/nkmr-jp/prompt-line/commit/7e5e25790e712409ede2919a00c6f30baf71160b))
* create ESLint analysis and refactoring plan for type safety improvements ([41d2fff](https://github.com/nkmr-jp/prompt-line/commit/41d2fffa269eb5559d93ba845057f556c90334cd))
* defer refactoring decision for large file split ([3f54b47](https://github.com/nkmr-jp/prompt-line/commit/3f54b47e28ca6b16b7fa0c2519c1719020cbc4da))
* extract specialized managers from large renderer components ([29c385a](https://github.com/nkmr-jp/prompt-line/commit/29c385a89d3929345ccaafd0640730474a213fba))
* **file-search:** consolidate manager responsibilities with SuggestionListManager, HighlightManager, and CodeSearchManager ([ffc410c](https://github.com/nkmr-jp/prompt-line/commit/ffc410c5569260e2c6e3d7f4cdd8218dc0c14540))
* **file-search:** consolidate managers to reduce complexity ([450c5e3](https://github.com/nkmr-jp/prompt-line/commit/450c5e3ad80ad312c4b7b8623fbe35ace3c8e86b))
* **file-search:** consolidate modular architecture into monolithic manager ([b089dae](https://github.com/nkmr-jp/prompt-line/commit/b089dae46c575deb2f19857d76c9aa822a4c8d3d))
* **file-search:** consolidate navigation managers and fix type issues ([0599876](https://github.com/nkmr-jp/prompt-line/commit/0599876b80b79ecedb4098c0f7c441d83a5807bd))
* **file-search:** consolidate navigation managers and remove unused factory ([db9a0e9](https://github.com/nkmr-jp/prompt-line/commit/db9a0e9f79ca67a4aa3ba5520435eb547634effb))
* **file-search:** consolidate overfragmented manager classes ([4b00e3c](https://github.com/nkmr-jp/prompt-line/commit/4b00e3c176f3a1a777ac0dcd02b6f472df2c2a30))
* **file-search:** consolidate path management into unified PathManager ([76a96f8](https://github.com/nkmr-jp/prompt-line/commit/76a96f8d4ee1863889562305427d0409cc9e2e98))
* **file-search:** delegate highlight methods to HighlightManager ([3e34103](https://github.com/nkmr-jp/prompt-line/commit/3e3410338a97718c896196995e72b8dd046713ed))
* **file-search:** extract AtPathBehaviorManager from HistoryUIManager ([d2f2f5c](https://github.com/nkmr-jp/prompt-line/commit/d2f2f5ce3eaa30af7851ca1c69abcae41b4b3ed2))
* **file-search:** extract fuzzy matching logic into dedicated module ([8582cfb](https://github.com/nkmr-jp/prompt-line/commit/8582cfb2aa5e63ed035921a6e5c9563ec14c4cab))
* **file-search:** extract helper methods to reduce duplication ([9c34652](https://github.com/nkmr-jp/prompt-line/commit/9c346529bdc404c0940fee89d052f75127fbfa71))
* **file-search:** extract ItemSelectionManager from FileSearchManager ([7e1754f](https://github.com/nkmr-jp/prompt-line/commit/7e1754f769cc073b99172e3e8adcd5611bb7eb31))
* **file-search:** extract KeyboardNavigationManager from file-search-manager ([867f5bc](https://github.com/nkmr-jp/prompt-line/commit/867f5bca481c725ae250ebaf4d7cb5328024629f))
* **file-search:** extract managers into specialized modules ([293082f](https://github.com/nkmr-jp/prompt-line/commit/293082f496e7351b7fc3e0ff1673ccf90b170a06))
* **file-search:** extract methods and add cache shortcuts in FileSearchManager ([fcc9311](https://github.com/nkmr-jp/prompt-line/commit/fcc9311e8f998f627ff86c0756e61917fb41d057))
* **file-search:** extract NavigationManager from file-search-manager ([9c40b57](https://github.com/nkmr-jp/prompt-line/commit/9c40b571553599f74e2b44646a2b2eb79aeb0817))
* **file-search:** extract PopupManager to separate module ([73da9d5](https://github.com/nkmr-jp/prompt-line/commit/73da9d52fed49470761b004dc66f0117da36e5a1))
* **file-search:** extract SettingsCacheManager to separate module ([510d409](https://github.com/nkmr-jp/prompt-line/commit/510d409b945ebe0812876c92f4b1108869320976))
* **file-search:** extract specialized managers from core modules ([10d619d](https://github.com/nkmr-jp/prompt-line/commit/10d619dd034640eebbe919039024ba9c1990d4b8))
* **file-search:** extract state management and factory pattern for FileSearchManager ([0b3f869](https://github.com/nkmr-jp/prompt-line/commit/0b3f8691ca50e2fb1820d37d51fc688e65bd171b))
* **file-search:** extract symbol mode UI logic to SymbolModeUIManager ([2a64c66](https://github.com/nkmr-jp/prompt-line/commit/2a64c6646c9c411f2bc5e2a58ad2a37a7c7e9690))
* **file-search:** extract types and path utilities into separate modules ([5ea22f8](https://github.com/nkmr-jp/prompt-line/commit/5ea22f8ff615739324bf77322096ec430f423841))
* **file-search:** extract utilities into modular submodules ([2638119](https://github.com/nkmr-jp/prompt-line/commit/2638119cb2180d9cafbf7fee314663943ba79905))
* **file-search:** extract utility functions and improve code organization ([92da2ef](https://github.com/nkmr-jp/prompt-line/commit/92da2ef451ed1c574474f8fe04a468ba4e8f89c5))
* **file-search:** extract utility functions into separate modules ([bf71a73](https://github.com/nkmr-jp/prompt-line/commit/bf71a730dfa29ce76b0bd7dc54373e624e48515d))
* **file-search:** inline AgentSearchManager logic into FileSearchManager ([b2e61ba](https://github.com/nkmr-jp/prompt-line/commit/b2e61ba8310f7ed36d0d486dd3ba41504391cc43))
* **file-search:** integrate DirectoryCacheManager and CodeSearchManager ([0487400](https://github.com/nkmr-jp/prompt-line/commit/04874002ce08d5fe19646c5a608064c489670457))
* **file-search:** integrate specialized managers into FileSearchManager facade ([16557c3](https://github.com/nkmr-jp/prompt-line/commit/16557c37e8c9d177432f0f4cbff29c619674633f))
* **file-search:** introduce FileSearchState for centralized state management ([bae0d3e](https://github.com/nkmr-jp/prompt-line/commit/bae0d3e88251ea3aefb53544ac3292cc81afb8c1))
* **file-search:** migrate to modular architecture ([456caf8](https://github.com/nkmr-jp/prompt-line/commit/456caf8bbe2ba54c5972f0349c85aaf06b2615d4))
* **file-search:** reduce FileSearchManager complexity and improve code maintainability ([733a6f9](https://github.com/nkmr-jp/prompt-line/commit/733a6f98cd5619598f4775a5608d2244ee408c51))
* **file-search:** remove duplicate hover and highlight code from FileSearchManager ([e16b3aa](https://github.com/nkmr-jp/prompt-line/commit/e16b3aad092ab976ab045ae4de844ae2e34896ef))
* **file-search:** remove unused cache and debug methods ([d81dfc0](https://github.com/nkmr-jp/prompt-line/commit/d81dfc07600de244b073d47a7c574ca62f0ed174))
* **file-search:** remove unused code and optimize module architecture ([14d33b7](https://github.com/nkmr-jp/prompt-line/commit/14d33b701e9a49e247cdd3101cfe2c8c18139231))
* identify files exceeding ESLint max-lines limit and prioritize refactoring ([77a1943](https://github.com/nkmr-jp/prompt-line/commit/77a1943f97df2bd4eb1290b6d8ffc75c0ab6296d))
* **native-tools:** split native-tools.ts into modular components ([fd2c47c](https://github.com/nkmr-jp/prompt-line/commit/fd2c47c88620a3e00366ac09b1bfcadc58a5705b))
* reduce TypeScript warnings from 668 to 626 ([e90176f](https://github.com/nkmr-jp/prompt-line/commit/e90176ff94452705835234fea81137142de493c5))
* **renderer:** delegate file operations and highlight management to specialized managers ([c37192a](https://github.com/nkmr-jp/prompt-line/commit/c37192ab1ab47547c2c0065b6801d79307f0b8fe))
* **renderer:** extract DirectoryDataHandler from renderer ([c39b8f5](https://github.com/nkmr-jp/prompt-line/commit/c39b8f524b00301b7373f08a6336ec5e066832ee))
* **slash-command:** extract FrontmatterPopupManager from slash-command-manager ([d3ca7e7](https://github.com/nkmr-jp/prompt-line/commit/d3ca7e7cc39174bfdca0344c7783aca0aa03f72d))
* **symbol-searcher:** simplify Markdown heading regex pattern ([b98ff72](https://github.com/nkmr-jp/prompt-line/commit/b98ff72155605a4c50db75b34ddf620b06664841))
* **utils:** split utils.ts into modular files ([c50776a](https://github.com/nkmr-jp/prompt-line/commit/c50776adc8dc5e951bb54292ac639954dc178b91))

### Tests

* add mutation testing analysis and improvement plan for test suite ([2f5849c](https://github.com/nkmr-jp/prompt-line/commit/2f5849c307f11b16515b03cdf54c1f2f36eff2d2))
* **ipc-handlers:** update handler count to 31 for at-path cache handlers ([20e07c1](https://github.com/nkmr-jp/prompt-line/commit/20e07c1a6acb31d8d7fa625ed846054545cea641))

### Maintenance

* **config:** add jscpd configuration for code duplication detection ([02ff240](https://github.com/nkmr-jp/prompt-line/commit/02ff24044f742e24db5ad8eea4a8f0514fa63ee8))
* **config:** update project name in `.serena/project.yml` ([bc636b7](https://github.com/nkmr-jp/prompt-line/commit/bc636b7abbfaa563ffbd6085efe161a4673efdb6))
* **eslint:** add max-lines rule for source files ([244a1c0](https://github.com/nkmr-jp/prompt-line/commit/244a1c0d0827334a2bf64e2af98788b42fa4b715))
* exclude stryker mutation testing artifacts from git tracking ([951c59f](https://github.com/nkmr-jp/prompt-line/commit/951c59f1436009767b34a06fb08fa1aa0c3c8784))
* **linting:** add code complexity and function length rules ([77b5bbd](https://github.com/nkmr-jp/prompt-line/commit/77b5bbdc73e00ba85262821383e17816c77a9706))

## [0.12.0](https://github.com/nkmr-jp/prompt-line/compare/v0.11.0...v0.12.0) (2025-12-22)

### Features

* **code-search:** add refreshCache option for background symbol updates ([92cf900](https://github.com/nkmr-jp/prompt-line/commit/92cf9009143ccfa25cbbe17f20a1fcbb5975359a))
* **code-search:** add symbol type filtering with colon syntax ([a33fa10](https://github.com/nkmr-jp/prompt-line/commit/a33fa10be0f5216979ab0abd02f2f57d29dc1e7b))
* **code-search:** improve symbol expansion with display and click-to-open support ([bc7c827](https://github.com/nkmr-jp/prompt-line/commit/bc7c827fa296b12973daed4b80db05dffd3db7db))
* **file-opener:** add line number support for opening files in editors ([b47233a](https://github.com/nkmr-jp/prompt-line/commit/b47233a80bbb1e48fb3dd82b3b85861592804b22))
* **file-search:** add configurable input format for file paths and names ([954efb3](https://github.com/nkmr-jp/prompt-line/commit/954efb341ca0c9e4572ec108aad2a077fdf49d57))
* **file-search:** add symbol list display after file selection ([28d5d96](https://github.com/nkmr-jp/prompt-line/commit/28d5d963b8713bac35812ae161795bd35298dd30))
* **file-search:** add symbol navigation for supported file types ([4eefaec](https://github.com/nkmr-jp/prompt-line/commit/4eefaec975fa8e826883831bd41f376232040d7a))
* **file-search:** integrate FileSearchManager UI with symbol display ([e0d1c29](https://github.com/nkmr-jp/prompt-line/commit/e0d1c2933b2e2bf9fdd26798f5fa453f3555e62d))
* **file-search:** preserve symbol path highlighting on window restart ([b5bb529](https://github.com/nkmr-jp/prompt-line/commit/b5bb52945db2da505a90c689f7dab353d38d692e))
* **file-search:** support path format without @ prefix ([648289b](https://github.com/nkmr-jp/prompt-line/commit/648289b7759e7679e2d1fd442b8e86e42c35dec6))
* **history-search:** display "+xxx more items" message in search results ([bf9db4c](https://github.com/nkmr-jp/prompt-line/commit/bf9db4cbd1a1ee72b3e33e02b311fe7371eec73b))
* **history-search:** implement infinite scroll functionality ([480e2f7](https://github.com/nkmr-jp/prompt-line/commit/480e2f7469f250fd406353752740731386031fb9))
* **history-search:** refactor with modular architecture and score-based filtering ([5d35baf](https://github.com/nkmr-jp/prompt-line/commit/5d35bafdfb6d270c88169de2428ce081598e6d58))
* **history:** implement lazy-loading for history items with 50-item pagination ([0ceea84](https://github.com/nkmr-jp/prompt-line/commit/0ceea842f66b4e29b5f33e442098f406cf47f5ff))
* **md-search:** add configurable sort order for search results ([332de23](https://github.com/nkmr-jp/prompt-line/commit/332de234f8af3c5113cec44f82a3a56e88c0e69e))
* **native-tools:** add Makefile symbol search support via mk alias ([8b41dfa](https://github.com/nkmr-jp/prompt-line/commit/8b41dfa50ac729b0b09b58baa493910169a9ec8c))
* **native-tools:** implement complete Swift-based native tools architecture ([9bea890](https://github.com/nkmr-jp/prompt-line/commit/9bea89063bfb19cf434d58d999e12e16aed4fa51))
* **symbol-search:** add configurable settings for symbol search functionality ([f1f8737](https://github.com/nkmr-jp/prompt-line/commit/f1f87372194b39916d305db21e2f8c50d9e8af7d))
* **symbol-search:** add support for 13 programming languages ([4d7a7cb](https://github.com/nkmr-jp/prompt-line/commit/4d7a7cb93553a1b02faefa806e944aff28a48faa))
* **symbol-search:** implement main process symbol searcher manager ([86c448a](https://github.com/nkmr-jp/prompt-line/commit/86c448a65323a8c593d53067dec949373058baa1))
* **symbol-search:** increase default max symbols and add shell/makefile support ([27d5a5f](https://github.com/nkmr-jp/prompt-line/commit/27d5a5f70144a0ac4e3d5dea72c3c6a0b1f79765))
* **symbols:** update VSCode symbol icons from Codicons ([90d841e](https://github.com/nkmr-jp/prompt-line/commit/90d841e6a3a73a5ac6c90d6f586d6dbea4f71d8a)), closes [#ffab40](https://github.com/nkmr-jp/prompt-line/issues/ffab40) [#b388](https://github.com/nkmr-jp/prompt-line/issues/b388) [#80cbc4](https://github.com/nkmr-jp/prompt-line/issues/80cbc4) [#80](https://github.com/nkmr-jp/prompt-line/issues/80) [#82b1](https://github.com/nkmr-jp/prompt-line/issues/82b1) [#90caf9](https://github.com/nkmr-jp/prompt-line/issues/90caf9) [#ffca28](https://github.com/nkmr-jp/prompt-line/issues/ffca28) [#c5e1a5](https://github.com/nkmr-jp/prompt-line/issues/c5e1a5) [#ff8a65](https://github.com/nkmr-jp/prompt-line/issues/ff8a65) [#bcaaa4](https://github.com/nkmr-jp/prompt-line/issues/bcaaa4)

### Bug Fixes

* **code-search:** remove all colons from search query ([56ce033](https://github.com/nkmr-jp/prompt-line/commit/56ce03311051ef9ae84325c902f43f6df6a54f30))
* **code-search:** respect maxSymbols setting from configuration ([c08dfa6](https://github.com/nkmr-jp/prompt-line/commit/c08dfa655d4554778e2358663039f6ff9a4774a8))
* **code-search:** set cursor position after symbol insertion ([27d9191](https://github.com/nkmr-jp/prompt-line/commit/27d919116269dee5997403efd874cd91abe72055))
* **directory-detector:** correct two-stage file discovery process ([cdf79d6](https://github.com/nkmr-jp/prompt-line/commit/cdf79d6bb9651d4d8e400243dc9347c27e724baf))
* **file-opener:** update JetBrains IDE integration from URL scheme to CLI commands ([4d1959c](https://github.com/nkmr-jp/prompt-line/commit/4d1959ca1ecda1498efb71583b089868f07e1e4c))
* **file-search:** add logging for code search initialization and diagnostics ([6cb5d49](https://github.com/nkmr-jp/prompt-line/commit/6cb5d498dc96896b64742878376836e4c371ca16))
* **file-search:** apply maxSuggestions setting to @ mention suggestions ([224d1ca](https://github.com/nkmr-jp/prompt-line/commit/224d1ca132a067480953f12344853c7b92e4bf4d))
* **file-search:** change default inputFormat from 'path' to 'name' ([8a71531](https://github.com/nkmr-jp/prompt-line/commit/8a71531d87a39c788f090fd3cff29807f0db4143))
* **file-search:** correct CodeSearchManager element ID reference ([0a216ac](https://github.com/nkmr-jp/prompt-line/commit/0a216ac5bdc67f5508b2a621ff3fed09a7d4187a))
* **file-search:** disable Tab expansion during IME composition ([7de9374](https://github.com/nkmr-jp/prompt-line/commit/7de9374b8a7459973b15089ee87089bc1e4ccd96))
* **file-search:** handle symbol insertion consistently with directory navigation ([5a8dd14](https://github.com/nkmr-jp/prompt-line/commit/5a8dd145dfbba6e982c0fa4c93791633c9197063))
* **file-search:** preserve line numbers and symbols in file paths ([7682270](https://github.com/nkmr-jp/prompt-line/commit/7682270e63422e1a155976d65fe2ea99a96675b8))
* **file-search:** preserve normal backspace behavior with Shift and text selection ([5af0d41](https://github.com/nkmr-jp/prompt-line/commit/5af0d41b4554c10153553fadc4e29311bc9e8af2))
* **file-search:** prevent code search pattern from matching search prefixes ([94633b8](https://github.com/nkmr-jp/prompt-line/commit/94633b858450fd2aeb7c01fb2571b996a0a421ab))
* **file-search:** prevent conflict between file search and code search patterns ([917898e](https://github.com/nkmr-jp/prompt-line/commit/917898e1ce2d50ab5ac5763648508cb89ce1098d))
* **file-search:** prevent cursor position interference in backspace handling for [@path](https://github.com/path) ([4a29726](https://github.com/nkmr-jp/prompt-line/commit/4a29726ed430367df5791526e297ca60c0e3eee2))
* **file-search:** prevent prefix deletion when confirming IME input ([f774f41](https://github.com/nkmr-jp/prompt-line/commit/f774f41ffcdea3101ad8c61b8c88e2ea636ddccd))
* **file-search:** prevent unnecessary cache refresh during code search input ([cbd9efc](https://github.com/nkmr-jp/prompt-line/commit/cbd9efc0f5da631a95197345304e8d8cb2087f27))
* **file-search:** remove inputFormat configuration and revert to [@filename](https://github.com/filename) format ([a1f0871](https://github.com/nkmr-jp/prompt-line/commit/a1f0871b873a3cc28bdceff8b87593277aa6735c)), closes [#129](https://github.com/nkmr-jp/prompt-line/issues/129)
* **file-search:** resolve cursor jump and text insertion issues in selectSymbol ([3b645cd](https://github.com/nkmr-jp/prompt-line/commit/3b645cd966e820f5e537312a8cb4009ccba8c757))
* **file-search:** resolve cursor positioning race condition in highlighter ([b740a98](https://github.com/nkmr-jp/prompt-line/commit/b740a981047eb24368bbfb741dfb52b150ec14b3))
* **file-search:** respect maxSuggestions setting in modular architecture ([990d1dc](https://github.com/nkmr-jp/prompt-line/commit/990d1dcbd7034a436329bb9ed3dfc8cea8339ee1))
* **file-search:** restore cursor position after backspace deletion of [@path](https://github.com/path) symbols ([67d0b46](https://github.com/nkmr-jp/prompt-line/commit/67d0b46348430021cfcade0bc552fc8c14c582d1))
* **file-search:** restore relative path insertion for file selection ([9a667c1](https://github.com/nkmr-jp/prompt-line/commit/9a667c18678e690db3f6c89e25e4a22c45076759)), closes [#129](https://github.com/nkmr-jp/prompt-line/issues/129)
* **file-search:** skip file search for code symbol patterns ([96a08ae](https://github.com/nkmr-jp/prompt-line/commit/96a08ae6493daa9d55ecfac2a5ed5ab9b13713b7))
* **file-search:** support JetBrains IDE file opening with native macOS app launching ([5d9249b](https://github.com/nkmr-jp/prompt-line/commit/5d9249b764ea48108f2128b2c433e5e8ac5126c6))
* **file-search:** unify symbol suggestion UI with directory navigation pattern ([d56f203](https://github.com/nkmr-jp/prompt-line/commit/d56f2031b7d2152df49a6a59e6b5bccc465f0609))
* **file-search:** update cache with directory-only data when files unavailable ([03c6203](https://github.com/nkmr-jp/prompt-line/commit/03c62038cf082a6a77f3324196dd5ad3d7a0244c))
* **file-search:** use 'name' format as default for @ mention insertion ([18dbf28](https://github.com/nkmr-jp/prompt-line/commit/18dbf2828473ec7c169c88b0b2bf352b17370dbc)), closes [#129](https://github.com/nkmr-jp/prompt-line/issues/129)
* **file-search:** wait for code search initialization before pattern matching ([10f337d](https://github.com/nkmr-jp/prompt-line/commit/10f337d07891a67f8d2cc814b114f44036d40c59))
* **goland-integration:** update command format to use --line flag for line number ([91360f7](https://github.com/nkmr-jp/prompt-line/commit/91360f7b2a9351a83cf7813b29396c7eba21c9ff))
* **history-search:** prevent selection clear when loading more items ([f637775](https://github.com/nkmr-jp/prompt-line/commit/f63777579ac90b2bf0547e17696417ee89829908))
* **history-search:** sort search results by timestamp when scores are equal ([ddf876a](https://github.com/nkmr-jp/prompt-line/commit/ddf876a5a0c90f9f7754557768114eee367c7259))
* **history-ui:** improve display formatting for large item counts ([49fd461](https://github.com/nkmr-jp/prompt-line/commit/49fd461b5ac9164e078ff717acfafbad823b7d85))
* **history:** apply display limit when exiting search mode ([0d35dd6](https://github.com/nkmr-jp/prompt-line/commit/0d35dd63258c226b9c906e69f6610dfbfbf9ab60))
* **history:** enable search across full history instead of 200-item cache limit ([5e37784](https://github.com/nkmr-jp/prompt-line/commit/5e37784c690d730e671264e4f446766a5b9931f6))
* **history:** optimize visible items limit and add memory cache configuration ([812708a](https://github.com/nkmr-jp/prompt-line/commit/812708a8c56e0208c85f5ba073d4628c517d6abe))
* **md-search:** apply maxSuggestions configuration to slash commands and fix default config handling ([bdbab11](https://github.com/nkmr-jp/prompt-line/commit/bdbab11396136674bc95e997273273d53ed393f3))
* **md-search:** use query-specific sort order for search results ([fa17ccc](https://github.com/nkmr-jp/prompt-line/commit/fa17cccb51c8e2b6755273cb563073c5726a3b02))
* **native-tools:** ensure timeout values are integers for execFile compatibility ([44d59de](https://github.com/nkmr-jp/prompt-line/commit/44d59de5f5489e975ffb8a10a41ef12f0a19fb46))
* **settings:** add symbolSearch section to settings template ([0f0b0b3](https://github.com/nkmr-jp/prompt-line/commit/0f0b0b3383e05de48a72e2a2297214f9494ddac3))
* **slash-commands:** apply maxSuggestions setting to command suggestions ([b9f3087](https://github.com/nkmr-jp/prompt-line/commit/b9f3087ba287fd460eedba59cbb66e69b982ed67))
* **symbol-search:** apply maxSymbols limit to cached results ([3b826d0](https://github.com/nkmr-jp/prompt-line/commit/3b826d0b4be81e6aa4190b3848b77e947e3bd029))
* **symbol-search:** deduplicate background cache refresh operations ([69e21e3](https://github.com/nkmr-jp/prompt-line/commit/69e21e380eb8dc692c8d0e4ec2c5ff2e491bbaee))
* **symbol-searcher:** increase timeout to 30s and improve error logging ([39235c7](https://github.com/nkmr-jp/prompt-line/commit/39235c798f32397f5c6c24ff5d1f734aaa98d158))
* **symbol-search:** expand filtering to include line content matching ([b515c1c](https://github.com/nkmr-jp/prompt-line/commit/b515c1ce9660ef449c940f4dfa6c06b4bb4112a3))
* **symbol-search:** improve symbol detection for file navigation ([9a0edc3](https://github.com/nkmr-jp/prompt-line/commit/9a0edc313182776ca87a180f0c226c3fcf2d2c04))
* **window-positioning:** correct position calculation logic ([ee47b8b](https://github.com/nkmr-jp/prompt-line/commit/ee47b8b93a2ca1b617a1d66a4fac8fbc225e448f))
* **window:** ensure window displays on startup and responds to toggle commands ([ee8c711](https://github.com/nkmr-jp/prompt-line/commit/ee8c711bed9a68afce8a80c4f00b22e1d2c14e4e))

### Code Refactoring

* **code-search:** remove hardcoded maxSymbols limits ([2de1db5](https://github.com/nkmr-jp/prompt-line/commit/2de1db59965d039e5d633c418523914fc25c200c))
* **file-search:** align navigateIntoFile with directory navigation pattern ([0490f01](https://github.com/nkmr-jp/prompt-line/commit/0490f016e70e11802209fe1be16f3e369332660b))
* **file-search:** integrate Material Icons for symbol search and remove unused code ([ae2a97e](https://github.com/nkmr-jp/prompt-line/commit/ae2a97e73d77b54493a1b5f9919bc03fd570e647))
* **file-search:** separate search scope from display limit ([8c31dc1](https://github.com/nkmr-jp/prompt-line/commit/8c31dc1f6e7c33468b805fa63fdb8392ac89dd1e))
* **native-tools:** split directory-detector into modular architecture ([672da24](https://github.com/nkmr-jp/prompt-line/commit/672da24325735ed2c758634d2df4ff3868cb76bc))
* **symbol-cache:** reorganize cache storage by language for improved performance ([d194f58](https://github.com/nkmr-jp/prompt-line/commit/d194f5846daad576fb8b393c7ff958742663a851))
* **symbol-search:** remove unused quick search functions ([0446492](https://github.com/nkmr-jp/prompt-line/commit/04464929ac5e0dbb553224392c2e3be532dbd7f1))

### Performance Improvements

* **native-tools:** optimize symbol search with parallel pattern execution and async pipe reading ([598c1ba](https://github.com/nkmr-jp/prompt-line/commit/598c1bab1ee46e873ee3a0075ac993f04e3b1e1a))

### Maintenance

* **display:** reduce default history display limit from 200 to 50 items ([27fbc80](https://github.com/nkmr-jp/prompt-line/commit/27fbc800636f5bc405cb8397bad60f88b23f2a9d))
* **file-search:** disable fuzzy matching by default ([1ff6033](https://github.com/nkmr-jp/prompt-line/commit/1ff603356fbe963d2808eafe4917cfee096d2757))
* remove 日本語.txt file ([4cd72aa](https://github.com/nkmr-jp/prompt-line/commit/4cd72aa99e611ef3687a04101ed67b8150bf6dcb))
* revert to previous build state ([3d12e4d](https://github.com/nkmr-jp/prompt-line/commit/3d12e4d9c47f31722c88cd2c5a6f292549de26ba))
* **timeout:** increase default symbol search timeout to 5 seconds ([508af08](https://github.com/nkmr-jp/prompt-line/commit/508af0863a63df3abc481aeac2b917460858d77a))

## [0.11.0](https://github.com/nkmr-jp/prompt-line/compare/v0.10.1...v0.11.0) (2025-12-08)

### Features

* **file-search:** enforce maxDepth: 1 for non-git directories ([7557df5](https://github.com/nkmr-jp/prompt-line/commit/7557df5349810417eca7d9fa12205d95e974ce7b))

### Bug Fixes

* **file-search, undo:** resolve highlight and cursor issues ([facac1c](https://github.com/nkmr-jp/prompt-line/commit/facac1ccf6fbc4f9eed0b370daf909d7c11c30d0))
* **file-search:** add undo/redo support for file path insertion ([69a96b2](https://github.com/nkmr-jp/prompt-line/commit/69a96b2bb8c42c7b568633147a475a0bcdab418c))
* **file-search:** filter out root-owned files for security ([f388370](https://github.com/nkmr-jp/prompt-line/commit/f388370426d6a9d790f6d3522c30c68026ba1262))
* **file-search:** hide "Building file index..." hint for disabled directories ([0c8b346](https://github.com/nkmr-jp/prompt-line/commit/0c8b346e5b930c555fd9265b847218cd33cd06ba))
* **file-search:** prevent "Building file index..." display for disabled root directory ([2397354](https://github.com/nkmr-jp/prompt-line/commit/23973547b8b57326d52a5033671e474d2e7d0133))
* **file-search:** prevent "Building file index..." display on root directory startup ([ab3b39a](https://github.com/nkmr-jp/prompt-line/commit/ab3b39a02d2c73b0cd66f1ca02bee2f9dc49f33e))
* **file-search:** prevent cache operations in root-owned system directories ([534fe2c](https://github.com/nkmr-jp/prompt-line/commit/534fe2ceff8ac68b8c6a65f646fef0ff35d4ad92))
* **file-search:** prevent non-path prefixes from being recognized as clickable links ([4f3e3af](https://github.com/nkmr-jp/prompt-line/commit/4f3e3afa69d07b6050c8c87cbf31a7fcfda91977))
* **file-search:** respect maxDepth setting and disable search in root directory ([8ffea61](https://github.com/nkmr-jp/prompt-line/commit/8ffea611fec7a190568208cc47e856892ebdb0e4))
* **file-search:** restore highlight on undo for cached file paths ([ece0c9b](https://github.com/nkmr-jp/prompt-line/commit/ece0c9b0a474e9f36d81f56f2e5d1f004e5f41eb))
* **file-search:** skip cache creation for disabled file search directories ([ab548cd](https://github.com/nkmr-jp/prompt-line/commit/ab548cdefdd1c60ec7330398c400ad6a7ba7bf17))
* **file-search:** support query parameters and fragments in URL detection ([a29ebd1](https://github.com/nkmr-jp/prompt-line/commit/a29ebd170bcad466f068418d2acf92fb792011b2))
* **ipc-handlers:** add missing Electron type import ([93f9e3c](https://github.com/nkmr-jp/prompt-line/commit/93f9e3c5ef9abfa9978a635985678aa08758d524))
* **paste-handler:** add security validation for image file operations ([d07a9b4](https://github.com/nkmr-jp/prompt-line/commit/d07a9b4cce54e2413e084667e7b7b5312c854bab))
* **slash-commands:** allow Ctrl+Enter to open files while editing commands ([87a3551](https://github.com/nkmr-jp/prompt-line/commit/87a355106463defb4add64a69099a6bdfa9160a3))

### Code Refactoring

* **file-search:** simplify at-path highlighting with set-based tracking ([dfe83a9](https://github.com/nkmr-jp/prompt-line/commit/dfe83a901d3bc4a3be2c96e4e5cf31b04f66dc41))
* **ipc-handlers:** split into 8 modular handler components ([2097d62](https://github.com/nkmr-jp/prompt-line/commit/2097d6217e3e78798bcd2f8fed776340bf8c523b))
* **ipc-handlers:** split monolithic module into 8 specialized handlers ([0b7c3cb](https://github.com/nkmr-jp/prompt-line/commit/0b7c3cba955ccb8be7ddf3f37d599ab1d4a9db2d))
* **renderer, window-manager:** complete modular architecture refactoring for Phase 1 & 2 ([fe70d1f](https://github.com/nkmr-jp/prompt-line/commit/fe70d1f7c4eb09c4a22bde1725ef4765df4f2e61))
* **window-manager:** split into modular architecture with 6 specialized modules ([dd1b7d8](https://github.com/nkmr-jp/prompt-line/commit/dd1b7d8bf767b9b181a22423736792a2a50a3571))

## [0.10.1](https://github.com/nkmr-jp/prompt-line/compare/v0.10.0...v0.10.1) (2025-12-07)

### Bug Fixes

* **file-search:** add parent directories and trailing slashes to relative paths ([05723c6](https://github.com/nkmr-jp/prompt-line/commit/05723c6353df17b4bd06fa99ab8c5c2cebe07e76))
* **file-search:** highlight directory paths with trailing slashes ([ec424ac](https://github.com/nkmr-jp/prompt-line/commit/ec424ac5e9a9756e8952cd8a51782564c85e5e61))

## [0.10.0](https://github.com/nkmr-jp/prompt-line/compare/v0.9.0...v0.10.0) (2025-12-07)

### Features

* **agent-loader:** add AgentLoader for loading and caching agents from directories ([a8dc90f](https://github.com/nkmr-jp/prompt-line/commit/a8dc90f21622e8e96138ac117308ff9208e8a8ba))
* **directory-manager:** extract directory management from draft manager ([1e14a5b](https://github.com/nkmr-jp/prompt-line/commit/1e14a5bd6eb076dd68dbfeb29b980d918ac1644f))
* **file-cache:** add cache invalidation and hint messages for missing fd command ([85ff828](https://github.com/nkmr-jp/prompt-line/commit/85ff828b12905608eb69be0a01c9c3af28496af6))
* **file-cache:** add file list caching for [@mention](https://github.com/mention) file search ([c86f99b](https://github.com/nkmr-jp/prompt-line/commit/c86f99b184a4f23f71da55eca82e5f2a0533a134))
* **file-limit:** add file limit reached indicator to directory detection ([34e9329](https://github.com/nkmr-jp/prompt-line/commit/34e932980dec9dc75ad5f396953f839441a2dec6))
* **file-search:** add Cmd+click support for absolute file paths ([d08c12b](https://github.com/nkmr-jp/prompt-line/commit/d08c12b20c7d0403861ae9a9242cb6a041faeeca))
* **file-search:** add Cmd+click to open files in editor ([7e697b4](https://github.com/nkmr-jp/prompt-line/commit/7e697b4d7ddc16cc67a6bf38913a9dcb0c8bb9f2))
* **file-search:** add configurable file search enable/disable state ([a4e2379](https://github.com/nkmr-jp/prompt-line/commit/a4e23794744151e97927561ce19263ca18e678e0))
* **file-search:** add cursor position file opening with visual feedback ([13a2e53](https://github.com/nkmr-jp/prompt-line/commit/13a2e539109cb085ba5ba461d8745e179c4fe595)), closes [#60a5](https://github.com/nkmr-jp/prompt-line/issues/60a5) [#93c5](https://github.com/nkmr-jp/prompt-line/issues/93c5)
* **file-search:** add customizable fdPath configuration option ([89246e4](https://github.com/nkmr-jp/prompt-line/commit/89246e429e107ea2ca9f00a51d53bd51d6e6a926))
* **file-search:** add dynamic hint text for linkable paths ([da5d192](https://github.com/nkmr-jp/prompt-line/commit/da5d192560d632c60e157e24df1cf562d341b308))
* **file-search:** add file path highlighting and Ctrl+Enter file opening ([8d9c445](https://github.com/nkmr-jp/prompt-line/commit/8d9c44593a067d1bbbc72d540e51dfc4bfb7cebe))
* **file-search:** add frontmatter popup on agent hover ([4149022](https://github.com/nkmr-jp/prompt-line/commit/4149022e9d883cbfb3545fdbdea15375fa7a3496))
* **file-search:** add hidden file visibility by default ref TOOLS-574 ([baefb23](https://github.com/nkmr-jp/prompt-line/commit/baefb23fcac8c931f6a2b590f4de6738fe6f6bd5))
* **file-search:** add support for ~ paths and agent file links ([c1ee9fb](https://github.com/nkmr-jp/prompt-line/commit/c1ee9fbb64ac2ac80948c6415dc3b5e9ed07cdc5))
* **file-search:** add symbolic link following support ([f99b220](https://github.com/nkmr-jp/prompt-line/commit/f99b2205b22fa4781b104029358b99527b511970))
* **file-search:** add terminal directory detection and file search functionality ([421f4b7](https://github.com/nkmr-jp/prompt-line/commit/421f4b7c6b7d9bfe48cf07f9eb3aebee8fc666de))
* **file-search:** add visual feedback during file index building ([9cae9d7](https://github.com/nkmr-jp/prompt-line/commit/9cae9d745a074b361365bb57c68ac934dd6ee7d1))
* **file-search:** enable window dragging when file is opened from link ([2145de1](https://github.com/nkmr-jp/prompt-line/commit/2145de18b575dfa56c6486c651c3946fd997666e))
* **file-search:** exclude slash commands from path highlighting and add URL click functionality ([fb2b297](https://github.com/nkmr-jp/prompt-line/commit/fb2b29709b1b22182916d4634dc7d10fd9719027))
* **file-search:** expand suggestion menu to full width ref TOOLS-559 ([0275c6a](https://github.com/nkmr-jp/prompt-line/commit/0275c6a9ba48dc974e8568c8b5168deec8dd1615))
* **file-search:** highlight [@paths](https://github.com/paths) only when files exist in current directory ([e88f9cb](https://github.com/nkmr-jp/prompt-line/commit/e88f9cb7763a9e7acd9d1c02ad00922e44260550))
* **file-search:** implement fileSearch settings and slash commands ([5a35ce6](https://github.com/nkmr-jp/prompt-line/commit/5a35ce65b6f359e71604a44178c54c8ba3560da0))
* **file-search:** improve directory selection and navigation behavior ([7224b21](https://github.com/nkmr-jp/prompt-line/commit/7224b214105a5a60570aace9216e2b80bc1dd328))
* **file-search:** include symlink files in search results ([9c572f0](https://github.com/nkmr-jp/prompt-line/commit/9c572f087a9ab353912db2a9d28507c68632afdc))
* **file-search:** prevent window close on URL launch and add slash command file opening ([fbce858](https://github.com/nkmr-jp/prompt-line/commit/fbce858199f51cae07689da08f993965feebb44d))
* **history:** add directory field to history items ([1a370ee](https://github.com/nkmr-jp/prompt-line/commit/1a370ee9e494d030cbcc79f1338d59e3169ed690))
* **md-search:** add configurable maxSuggestions setting ([0fdc652](https://github.com/nkmr-jp/prompt-line/commit/0fdc652505cd67aa3eaee357d23162a6ab478f0d))
* **md-search:** add searchPrefix filtering for mention entries ([582c93a](https://github.com/nkmr-jp/prompt-line/commit/582c93ae16fbc89ea18bf9d519243b03b1fad815))
* **md-search:** improve pattern matching for markdown file discovery ([ab8852e](https://github.com/nkmr-jp/prompt-line/commit/ab8852e0b4768436b76b2fe7d9de696d8ebbf5b6))
* **md-search:** unify SlashCommandLoader and AgentLoader into MdSearchLoader ([ec077a6](https://github.com/nkmr-jp/prompt-line/commit/ec077a6958c0b06156efbef2224555f0a2c78b3b))
* **mdSearch:** implement searchPrefix feature for filtered mention searches ([daf0cd1](https://github.com/nkmr-jp/prompt-line/commit/daf0cd1bb7c5645487f7468b8a015b4bf0d912c0))
* **search:** add agent search integration with @ trigger ref TOOLS-557 ([bec1e8b](https://github.com/nkmr-jp/prompt-line/commit/bec1e8b9eba1703c7618f40c61605ec45fb61339))
* **search:** disable agent search prefix by default with opt-in configuration ([7e9fa57](https://github.com/nkmr-jp/prompt-line/commit/7e9fa57a70bfd15483b285a00d2f6912bcc84365))
* **settings:** change includeHidden default to true ref TOOLS-574 ([91533aa](https://github.com/nkmr-jp/prompt-line/commit/91533aa27b07a4cea9bad428046c661f9a7c5d12))
* **settings:** merge agent directories config properly ref TOOLS-557 ([f531c7b](https://github.com/nkmr-jp/prompt-line/commit/f531c7ba3afc242c4c2a856864f806f59442d3fd))
* **slash-command-manager:** add frontmatter popup display on hover ([e2e2c4b](https://github.com/nkmr-jp/prompt-line/commit/e2e2c4bbe2c7d553647d6847b1234980f59ae58f))
* **slash-commands:** add argument-hint support and history shortcut isolation ([df14e8a](https://github.com/nkmr-jp/prompt-line/commit/df14e8a6280e27a4fef0735b46ff2cfa942593ed))
* **slash-commands:** add custom slash command support with incremental search ([8e9e686](https://github.com/nkmr-jp/prompt-line/commit/8e9e686ab696c7246e1e22c81ddccbd418577f28))
* **slash-commands:** add file opening with callbacks for window management ([bdee8a1](https://github.com/nkmr-jp/prompt-line/commit/bdee8a16778c6609569a4576b75988eb9ce1035b))
* **slash-commands:** add keyboard navigation and event handler integration ([9a73dc0](https://github.com/nkmr-jp/prompt-line/commit/9a73dc0104de99d32f5efd64787d0f32a75926f6))
* **slash-commands:** add multiple directories support ([6ee6b43](https://github.com/nkmr-jp/prompt-line/commit/6ee6b4340320b0cb572dffbd2d82b916896d4592))
* **slash-commands:** differentiate Enter/Tab behavior with argument editing support ([dfb27d3](https://github.com/nkmr-jp/prompt-line/commit/dfb27d33da61f3703daf8da14e72f153f87fd6b8))
* **slash-commands:** keep selected command visible while editing arguments ([cb103fb](https://github.com/nkmr-jp/prompt-line/commit/cb103fbe9d2b6b634a7cf7dbeec31144ac37b842))
* **tooltip:** add auto-show tooltip with Ctrl+I toggle ([076ce41](https://github.com/nkmr-jp/prompt-line/commit/076ce41b8a8572a27a786455218f067c9a748b5c))
* **ui:** add frontmatter info icon with hover-triggered popup for file search and slash commands ([b997752](https://github.com/nkmr-jp/prompt-line/commit/b997752d394bab62c575d9638f452ff226e7de38))
* **window-focus:** add IPC handler for focusing Prompt Line window ([33820c2](https://github.com/nkmr-jp/prompt-line/commit/33820c2928d6663018fb413a17ed1d17f9d09583))
* **window:** keep window visible in draggable state on blur ([12d4cd5](https://github.com/nkmr-jp/prompt-line/commit/12d4cd551095bbc7db32e58f9e3f3d14c8e6f001))

### Bug Fixes

* **agent-search:** apply searchPrefix filter when query is empty ([2dd99f6](https://github.com/nkmr-jp/prompt-line/commit/2dd99f644962d7dbbcfa17039dbc8d36ee25ffdc))
* **config:** correct YAML syntax in commented configuration sections ([de3af77](https://github.com/nkmr-jp/prompt-line/commit/de3af7767f6db3b261edc3c9ee12a85f2c68a657))
* **directory-detection:** restore 5s timeout and add timeout hint for large directories ([616060f](https://github.com/nkmr-jp/prompt-line/commit/616060fa229e1a1db3c5adee01abc04088ad885e))
* **directory-detector:** prevent pipe deadlock with async reading ([25fdf5b](https://github.com/nkmr-jp/prompt-line/commit/25fdf5b7adc9178979289b133e9dc2544b5d9bfe))
* **docs:** improve clarity of file size and directory descriptions ([a0a858a](https://github.com/nkmr-jp/prompt-line/commit/a0a858a2c82d397fd1c48e97b08af413a82d87e8))
* **draft-restoration:** validate file existence when restoring [@paths](https://github.com/paths) from draft ([5563d98](https://github.com/nkmr-jp/prompt-line/commit/5563d988fe80d5de29df9c637b8a96fc80169eed))
* **file-handling:** use background open on macOS to preserve window focus ([211299a](https://github.com/nkmr-jp/prompt-line/commit/211299a2ca2f1396b30fc896ae5e215bf4bf3831))
* **file-opener-manager:** bring opened application to foreground ([6618e32](https://github.com/nkmr-jp/prompt-line/commit/6618e32781867aa44b078f3a4be04322f3cae98f))
* **file-opening:** use native open command to keep opened files in foreground ([20ad0ab](https://github.com/nkmr-jp/prompt-line/commit/20ad0abf586a7cffad355069b48da26c3febf2c0))
* **file-search-manager:** correct highlight positioning and restore highlights after text edits ([34e713d](https://github.com/nkmr-jp/prompt-line/commit/34e713dbab28037547acb944ca0636f9c4b3bd35))
* **file-search-manager:** prevent popup from hijacking keyboard and scroll events ([79c0203](https://github.com/nkmr-jp/prompt-line/commit/79c02038f876d97c7dd5f2f242c548c195bee7c3))
* **file-search-manager:** restore PromptLine window focus after opening files ([2f17294](https://github.com/nkmr-jp/prompt-line/commit/2f17294948f4c44c222a7c5db923ae6f407f2151))
* **file-search-manager:** support relative paths with parent directory references ([df13860](https://github.com/nkmr-jp/prompt-line/commit/df13860c92017a4e8c5c646288a292a7870f0ec3))
* **file-search:** align frontmatter popup positioning with command info icon ([de8f642](https://github.com/nkmr-jp/prompt-line/commit/de8f642de2e61428b2a47fa11bbe8cf515c2536f))
* **file-search:** apply excludePatterns during include pattern searches ([65ee1f7](https://github.com/nkmr-jp/prompt-line/commit/65ee1f75934654284ecfc75a9720ee02f4a06be6))
* **file-search:** Ctrl+Enter opens file without inserting path ([99fc297](https://github.com/nkmr-jp/prompt-line/commit/99fc297ede336e6a6ca418dd930e77893dc94fc6))
* **file-search:** increase agent suggestions limit from 5 to 15 ([e7fcce4](https://github.com/nkmr-jp/prompt-line/commit/e7fcce41f32cfab207b1eb090af26159278aaa3c))
* **file-search:** preserve symlink paths in search results ([fe699fd](https://github.com/nkmr-jp/prompt-line/commit/fe699fd3b32ddcee8ce2e2f409cc7b944627d390))
* **file-search:** prioritize fd installation hint over indexing message ([93a1d19](https://github.com/nkmr-jp/prompt-line/commit/93a1d191573a1086065545f9b9737d9cd5e431b8))
* **file-search:** render link style for absolute paths on Cmd+hover ([4d63319](https://github.com/nkmr-jp/prompt-line/commit/4d63319762dbd86cb6c6083bcfd5a4c720ee3253))
* **file-search:** resolve fd detection when app launched outside shell ([fb980c2](https://github.com/nkmr-jp/prompt-line/commit/fb980c2f3a2119d114ea3817ae110a13362fcd2a))
* **file-search:** restore [@path](https://github.com/path) highlighting from draft without existence checks ([2b92dbe](https://github.com/nkmr-jp/prompt-line/commit/2b92dbe16ce14320c6f6908699eb57b62021fd76))
* **file-search:** skip all file search operations when disabled in settings ([24877dc](https://github.com/nkmr-jp/prompt-line/commit/24877dce696ec415aba87e33b4ed6e7a34170275))
* **file-search:** skip all file search operations when disabled in settings ([223fff2](https://github.com/nkmr-jp/prompt-line/commit/223fff2c55c3212d0aa849d9ee25ca62c165eefd))
* **file-search:** update cursor position highlight style and limit to absolute paths ([94b15a4](https://github.com/nkmr-jp/prompt-line/commit/94b15a4078c4544cf6100338458e053f09b02dcd))
* **file-search:** update merged suggestions when navigating into directories ([24bd9c3](https://github.com/nkmr-jp/prompt-line/commit/24bd9c33fb9ba3608802aa60a821126064b1d1e5))
* **hint-text:** restore default hint message when input starts ([c9fa6c3](https://github.com/nkmr-jp/prompt-line/commit/c9fa6c370c1e35cd0b02c6966f1bab0fd0a8499d))
* **history:** add user-friendly error messages for file limit and timeout cases ([a0e1b86](https://github.com/nkmr-jp/prompt-line/commit/a0e1b86acbc12ffe15ff79aefc09f5fb9d1e7534))
* **history:** clear search highlights when navigating history items ([3555b4e](https://github.com/nkmr-jp/prompt-line/commit/3555b4e71e98d1cff2a080b006b03ddcc22a5451))
* **history:** save directory to draft when directory data is detected ([d364d38](https://github.com/nkmr-jp/prompt-line/commit/d364d3806aa497ae8256009875ba189fda879f61))
* **indexing:** suppress "Building file index" hint when fd is not installed ([59f3e3e](https://github.com/nkmr-jp/prompt-line/commit/59f3e3e35a1efcf2cd717ff9916b7bf4692f5ee1))
* **ipc-handlers:** resolve relative file paths using DirectoryManager instead of process.cwd() ([46c56a1](https://github.com/nkmr-jp/prompt-line/commit/46c56a13f05d2a858daa01b0edf46fc6349c5319))
* **logging:** add debug logging to FileOpenerManager for troubleshooting ([ffa930a](https://github.com/nkmr-jp/prompt-line/commit/ffa930aaa9063ac6bcb5cab555469044fa7d9a24))
* **md-search:** change default agent name to agent-{basename} ([f900fd3](https://github.com/nkmr-jp/prompt-line/commit/f900fd3791104c178dff6bbabbb2bddd8f7c42fd))
* **md-search:** skip slash command processing when command type is not registered ([815a69c](https://github.com/nkmr-jp/prompt-line/commit/815a69cfa2e62c4964cc688550053415f436d98f))
* **menu:** adjust position when @ is near right edge ref TOOLS-559 ([cc9e5aa](https://github.com/nkmr-jp/prompt-line/commit/cc9e5aabecee12b40e8aa3488ba674801b30d2f9))
* **path-display:** handle root directory paths correctly ([2ce8b88](https://github.com/nkmr-jp/prompt-line/commit/2ce8b8881f004bd19e8d2e73abe83d015a772bd2))
* **path-resolution:** improve relative path handling and fix duplicate entries in search results ([59e02f0](https://github.com/nkmr-jp/prompt-line/commit/59e02f03a3d4e2c37b637a8f9854e6f7d556827f))
* **renderer:** clear search highlight when navigating history with Ctrl+j ([9510981](https://github.com/nkmr-jp/prompt-line/commit/951098104d29a854c72ebf440594eda4db5c6cab))
* **security:** implement phase 1 security improvements - YAML schema validation and file permissions ([a1bb5b6](https://github.com/nkmr-jp/prompt-line/commit/a1bb5b62828ee112a84e8b353d225d171a115b79))
* **security:** implement phase 1-3 security audit recommendations ([1299fb3](https://github.com/nkmr-jp/prompt-line/commit/1299fb3f2be48f294ae4fa1facb4b1c0433c01da))
* **settings:** correct YAML indentation in commented configuration ([8242a8b](https://github.com/nkmr-jp/prompt-line/commit/8242a8bf440be737ea6b47baa78b82c0782b488d))
* **settings:** disable optional settings when commented out in settings.yml ([591ea7b](https://github.com/nkmr-jp/prompt-line/commit/591ea7b5ffbcf8c16fceaf4a6264430fd6c0385f))
* **settings:** don't write empty collections to settings file ([98b6ac1](https://github.com/nkmr-jp/prompt-line/commit/98b6ac14147efa921f1439e59426423ee4eda6fa))
* **settings:** ensure all settings are active in generated config ([8d0fbd4](https://github.com/nkmr-jp/prompt-line/commit/8d0fbd43971445090012e4f5dba096061bc03a8b))
* **settings:** respect optional settings commented state in configuration ([3585ef1](https://github.com/nkmr-jp/prompt-line/commit/3585ef1c2911f05cdd87d10ef80898cf842d1a4f))
* **settings:** set mdSearch default to empty array ([d6bc558](https://github.com/nkmr-jp/prompt-line/commit/d6bc558f3c77edd3a3412ec1a453ad9558fa8ff8))
* **settings:** update settings.yml template to use mdSearch configuration ([2fc9835](https://github.com/nkmr-jp/prompt-line/commit/2fc9835de5706cc107bfda73db6566f5973f8562))
* **slash-command-manager:** remove textarea clear and suggestion hide on file open ([773a22c](https://github.com/nkmr-jp/prompt-line/commit/773a22c4f43bb7b5d24f466df4916ba44806d886))
* **test:** add missing setSlashCommandManager mock to EventHandler ([f0ca75c](https://github.com/nkmr-jp/prompt-line/commit/f0ca75ca58271e0c1d606b58dbeb5b84b15aae44))
* **tests:** update window-manager test for decoupled directory data ([cc3d44c](https://github.com/nkmr-jp/prompt-line/commit/cc3d44ca0960b044cd7211cc4d7fb17785c1bd7e))
* **test:** update IPC handler count for get-agent-file-path ([9ae7c4b](https://github.com/nkmr-jp/prompt-line/commit/9ae7c4b9e0541e5b309d44d3a9247cb09f1d963d))
* **tooltip:** use lowercase 'i' in Ctrl+i hint message ([dfa9cb8](https://github.com/nkmr-jp/prompt-line/commit/dfa9cb8d21d78cbd9f5fb4af7ddf466d9ea60ba7))
* **ui:** adjust file suggestion menu positioning and width calculation ref TOOLS-559 ([64cba45](https://github.com/nkmr-jp/prompt-line/commit/64cba458d6b16602516b4b837effb41a858bf33d))
* **ui:** improve slash command description layout and icon positioning ([beb22ef](https://github.com/nkmr-jp/prompt-line/commit/beb22efca28fb699931be7492df3618181e93579))
* **ui:** improve slash command layout to single-row display ([78dcb0e](https://github.com/nkmr-jp/prompt-line/commit/78dcb0ec0aea935608340c0b578cfbe93616d6ab))
* **ui:** position tooltip to left of info icon ([0922855](https://github.com/nkmr-jp/prompt-line/commit/09228551c300b7a48abad12ee4d6569036d55d0a))
* **ui:** prevent slash suggestion items from wrapping to multiple lines ([36f27d3](https://github.com/nkmr-jp/prompt-line/commit/36f27d388e652a76ae6b026cb480225474017439))
* **ui:** reset scroll position in suggestion containers and adjust scrollbar styles ([1916e53](https://github.com/nkmr-jp/prompt-line/commit/1916e5397715fdf29a994171f310ae342969b340))
* **window-manager:** add fd command availability check and display hint when unavailable ([9c8d44b](https://github.com/nkmr-jp/prompt-line/commit/9c8d44b372c88bc5e14cc496cf7ee7d1b1d83a23))
* **window-manager:** detect fd command availability at startup ([f45eca3](https://github.com/nkmr-jp/prompt-line/commit/f45eca3fda39ee3f5c3f8432931f136fa0eb57ab))
* **window-manager:** increase directory detection timeout from 5s to 10s ([a6d4aec](https://github.com/nkmr-jp/prompt-line/commit/a6d4aecfc508db76de2a05e29198dcd920ca4c32))
* **window-manager:** increase maxBuffer for large file list output ([a92676b](https://github.com/nkmr-jp/prompt-line/commit/a92676b236c8173ef653dad098ceee40d3cc72ec))

### Code Refactoring

* **file-detection:** remove fd-only mode and simplify to recursive search ([26476e3](https://github.com/nkmr-jp/prompt-line/commit/26476e31e8b6fee351eff1f379d8c8c6a2eb7431))
* **file-icons:** rename agent icon to mention icon for consistency ([dbc9c29](https://github.com/nkmr-jp/prompt-line/commit/dbc9c2934c15753479ba782183fcb8c40db99b74))
* **security:** replace child_process.exec() with execFile() to prevent command injection ([75ed1a3](https://github.com/nkmr-jp/prompt-line/commit/75ed1a3a172264163be561b5741f55377ea48f65))
* **settings:** make fileSearch and fileOpener default settings ([3c11461](https://github.com/nkmr-jp/prompt-line/commit/3c11461c71c6650d4a8cfe041029483bde7c97b6))
* **settings:** reorganize settings sections and disable file search by default ([f51d955](https://github.com/nkmr-jp/prompt-line/commit/f51d955c7900c17b4ded537e04f66e7ba9364676))
* **slash-command:** separate file opening from command execution ([9def8d9](https://github.com/nkmr-jp/prompt-line/commit/9def8d94725e1e14715adb9b49943e4321e9eacc))
* **ui:** remove tooltip and simplify hint text ([2daa3e6](https://github.com/nkmr-jp/prompt-line/commit/2daa3e6e47b9572493d38693a3127fef06013d31))
* **ui:** revert mention icon to robot/agent icon ([718f1fa](https://github.com/nkmr-jp/prompt-line/commit/718f1fa0d1167a7ca37a281a8fd076330078103c))
* **window-manager:** simplify directory detection flow ([35cfa9d](https://github.com/nkmr-jp/prompt-line/commit/35cfa9d2eca6f51feda09155429f8975f45c1c79))

### Performance Improvements

* **directory-detector:** use libproc proc_pidinfo for 13x faster CWD detection ([cbcaab6](https://github.com/nkmr-jp/prompt-line/commit/cbcaab65de618dbd87ea6ced0ecc1691d29d401b))

### Tests

* **md-search-loader:** add comprehensive test suite for mdSearch system ([9762902](https://github.com/nkmr-jp/prompt-line/commit/97629026faa23d2273947419c5d72116ae74a5f0))
* remove directory-detector E2E test ([d3169e5](https://github.com/nkmr-jp/prompt-line/commit/d3169e532c172e1fdadf281bde26bb7ee60dac07))

### Maintenance

* **assets:** update doc9.png ([c4f8549](https://github.com/nkmr-jp/prompt-line/commit/c4f85498014ef501cc897c152fcfef3b29d28346))
* **config:** adjust settings.yml for large directory ([4aa403a](https://github.com/nkmr-jp/prompt-line/commit/4aa403a3a4bb0511fbf8438e3284822a5ee96750))
* **config:** update skill configuration sample formatting ([6234f20](https://github.com/nkmr-jp/prompt-line/commit/6234f2079d2dfaed59a9a1f44df8fab72a376302))
* **deps:** upgrade semantic-release and dependencies ([909c21c](https://github.com/nkmr-jp/prompt-line/commit/909c21cd2c3e3246d84fc66f5415505e1e678505))
* **project:** add hookify configuration guidance to CLAUDE.md ([780ad77](https://github.com/nkmr-jp/prompt-line/commit/780ad77df4129efb8e2bc2a33f4263931e44f139))
* remove temporary patch file ([4f25b0e](https://github.com/nkmr-jp/prompt-line/commit/4f25b0e7d7a040dd49ed78312b13c018f3f6c9a2))
* **settings-manager:** comment out unused custom slash command YAML configuration ([7b0614d](https://github.com/nkmr-jp/prompt-line/commit/7b0614d8bd22eb9503e9c235a8ee3b3639d2bec5))
* **slash-commands:** comment out slash command suggestion items for future use ([4c5b052](https://github.com/nkmr-jp/prompt-line/commit/4c5b052fdde9e0c8a88d240963457f6701bc5074))
* update CLAUDE.md with project guidelines and development workflow ([0f21320](https://github.com/nkmr-jp/prompt-line/commit/0f2132034c753c990ef8f26e7ffde95ccd30bf10))

## [0.9.0](https://github.com/nkmr-jp/prompt-line/compare/v0.8.13...v0.9.0) (2025-11-17)

### Features

* **input:** implement Shift+Tab outdent functionality ([12c6e86](https://github.com/nkmr-jp/prompt-line/commit/12c6e86f9a564b2079950e41361ab055b61019f7))
* **logging:** control DEBUG log output based on environment ([63acd85](https://github.com/nkmr-jp/prompt-line/commit/63acd85f867d9b456b032ff470088a20c1e88102))
* **snapshot:** implement undo functionality for history selection ([0013c3c](https://github.com/nkmr-jp/prompt-line/commit/0013c3c1d4e5f2b4130b082b3c3b652acd29f5bc))

### Bug Fixes

* **editor:** prevent horizontal overflow from spaces and tabs ([3add19f](https://github.com/nkmr-jp/prompt-line/commit/3add19ffa0ec8ab1b79de4be0a31520be002d6a7))
* **input:** enable Tab key input with proper IME handling ([df7426b](https://github.com/nkmr-jp/prompt-line/commit/df7426b87a68d6b1b49eaf3ee3b33978dae990df))
* **input:** prevent Shift+Tab from inserting tab character ([b2eccaf](https://github.com/nkmr-jp/prompt-line/commit/b2eccaf68b46d53b4705e6c14ce74b214f7213d6))
* **logging:** use LOG_LEVEL env var for debug logging control ([81bd815](https://github.com/nkmr-jp/prompt-line/commit/81bd8156145aed1039d19e7643a0065e4bd4a3f4))
* **scripts:** remove redundant node_modules deletion in clean:full ([898527b](https://github.com/nkmr-jp/prompt-line/commit/898527b7224ce3040382115ec792316573334a18))
* **snapshot:** clear snapshot on text edit to preserve browser undo ([30873a6](https://github.com/nkmr-jp/prompt-line/commit/30873a699ebdea339df369bf25988a21fc2967c4))

### Code Refactoring

* **logger:** simplify early return pattern in log method ([0042465](https://github.com/nkmr-jp/prompt-line/commit/00424655401391a7d0cd0f1f2e1b2750e3538af1))

### Tests

* remove before-input-event listener expectation ([06b48f2](https://github.com/nkmr-jp/prompt-line/commit/06b48f225c2d666ee116d549b5e8451c381dbb95))

## [0.8.13](https://github.com/nkmr-jp/prompt-line/compare/v0.8.12...v0.8.13) (2025-11-15)

### Bug Fixes

* **deps:** update js-yaml to 4.1.1 to fix prototype pollution vulnerability ([e366778](https://github.com/nkmr-jp/prompt-line/commit/e366778d143e34d0f3291947fed291d345caae3a)), closes [#11](https://github.com/nkmr-jp/prompt-line/issues/11)
* **deps:** use npm overrides to force js-yaml 4.1.1 for all dependencies ([4862547](https://github.com/nkmr-jp/prompt-line/commit/48625475b1578d418403646e9197362da90e6670))

### Maintenance

* add build cleanup scripts and troubleshooting guide ([1e118ca](https://github.com/nkmr-jp/prompt-line/commit/1e118caaec0555c46c82abca5c38eafeebb752f7))
* **deps:** update @eslint/plugin-kit and vite to latest versions ([27df0f3](https://github.com/nkmr-jp/prompt-line/commit/27df0f318558f6cbbf2d1291ad4b4bd2462d31f4))

## [0.8.12](https://github.com/nkmr-jp/prompt-line/compare/v0.8.11...v0.8.12) (2025-11-15)

### Maintenance

* **deps:** bump js-yaml in the npm_and_yarn group across 1 directory ([cc863ad](https://github.com/nkmr-jp/prompt-line/commit/cc863adee0d9b7c61f8c134cdf289bac57c9327f))

## [0.8.11](https://github.com/nkmr-jp/prompt-line/compare/v0.8.10...v0.8.11) (2025-10-21)

### Maintenance

* **deps-dev:** bump vite in the npm_and_yarn group across 1 directory ([ee7416f](https://github.com/nkmr-jp/prompt-line/commit/ee7416f039a2bc4416018c80d884f9a863c7c59e))

## [0.8.10](https://github.com/nkmr-jp/prompt-line/compare/v0.8.9...v0.8.10) (2025-10-03)

### Maintenance

* add aqua.yaml for pinact dependency management ([f27b9c7](https://github.com/nkmr-jp/prompt-line/commit/f27b9c726d431708c33d6f936b5f37b5d741d935))
* **ci:** pin GitHub Actions to commit hashes using pinact ([bff2e60](https://github.com/nkmr-jp/prompt-line/commit/bff2e6061d90490aad74433eda9d37a83206640d))

## [0.8.9](https://github.com/nkmr-jp/prompt-line/compare/v0.8.8...v0.8.9) (2025-09-10)

### Maintenance

* **deps-dev:** bump vite in the npm_and_yarn group across 1 directory ([1ab9523](https://github.com/nkmr-jp/prompt-line/commit/1ab95238da3450f8a3b2c5a0a11a857d224ed1ef))

## [0.8.8](https://github.com/nkmr-jp/prompt-line/compare/v0.8.7...v0.8.8) (2025-09-05)

### Maintenance

* **deps-dev:** bump electron ([f1a20fe](https://github.com/nkmr-jp/prompt-line/commit/f1a20fe36a55f91fa28e30348692eb40647214a4))

## [0.8.7](https://github.com/nkmr-jp/prompt-line/compare/v0.8.6...v0.8.7) (2025-08-06)

### Maintenance

* **deps-dev:** bump tmp in the npm_and_yarn group across 1 directory ([c942748](https://github.com/nkmr-jp/prompt-line/commit/c942748f10b2369af83a55de62e68c9ed0574e60))

## [0.8.6](https://github.com/nkmr-jp/prompt-line/compare/v0.8.5...v0.8.6) (2025-07-22)

### Maintenance

* **deps-dev:** bump form-data ([edc7557](https://github.com/nkmr-jp/prompt-line/commit/edc755784add78a45c5ac40290dabda768812d77))

## [0.8.5](https://github.com/nkmr-jp/prompt-line/compare/v0.8.4...v0.8.5) (2025-07-16)

### Maintenance

* remove 'style' commit type from release rules and documentation ([e0ad423](https://github.com/nkmr-jp/prompt-line/commit/e0ad423fd328cdab6e76204ee2ad07a7db1943a7))
* update release note sections for commit types and adjust CHANGELOG formatting ([4cee997](https://github.com/nkmr-jp/prompt-line/commit/4cee997a1760e0784163bb5e330317cf1ec21fdb))

## [0.8.4](https://github.com/nkmr-jp/prompt-line/compare/v0.8.3...v0.8.4) (2025-07-16)

### Bug Fixes

* add missing conventional-changelog-conventionalcommits dependency for semantic-release ([591c1fc](https://github.com/nkmr-jp/prompt-line/commit/591c1fc847d3be63db2f9a3535d1c4008ae8d73e))

### Maintenance

* switch to conventional commits preset and adjust release rules and sections ([3f76ed0](https://github.com/nkmr-jp/prompt-line/commit/3f76ed04f3e95b31993576c90d61c5b55f0bbc69))
* update conventional-changelog-conventionalcommits to latest version 9.1.0 ([5fbb12f](https://github.com/nkmr-jp/prompt-line/commit/5fbb12f896b05da564c6bf441e05560ba2a284b3))

## [0.8.3](https://github.com/nkmr-jp/prompt-line/compare/v0.8.2...v0.8.3) (2025-07-16)

### Maintenance

* mark all commit types as visible in release notes configuration ([8336454](https://github.com/nkmr-jp/prompt-line/commit/833645438c7abe38d9ae153eb044efe88e23c649))

## [0.8.2](https://github.com/nkmr-jp/prompt-line/compare/v0.8.1...v0.8.2) (2025-07-16)

### Maintenance

* update semantic-release config to use angular preset for release notes generation ([d0aebe0](https://github.com/nkmr-jp/prompt-line/commit/d0aebe0))

## [0.8.1](https://github.com/nkmr-jp/prompt-line/compare/v0.8.0...v0.8.1) (2025-07-16)

### Code Refactoring
* remove unused statistics types and methods ([f8a7952](https://github.com/nkmr-jp/prompt-line/commit/f8a795291ef5e84277b896f66694a0812bd9871d))

### Maintenance

* configure semantic-release to treat more commit types as patch updates ([55bfabb](https://github.com/nkmr-jp/prompt-line/commit/55bfabbb8dcaf1cb4fe6332126236326094e0ce9))

# [0.8.0](https://github.com/nkmr-jp/prompt-line/compare/v0.7.2...v0.8.0) (2025-07-09)


### Bug Fixes

* resolve CSP inline style violation and improve image naming ([2e02844](https://github.com/nkmr-jp/prompt-line/commit/2e028448aa5bda653cc6e74bb7238e52a320585c))
* resolve image paste text interference ([b97acd0](https://github.com/nkmr-jp/prompt-line/commit/b97acd06a306d9746db2046fd1d0371ae4a1eaa6))


### Features

* **security:** enhance Electron security settings and remove CSP unsafe-inline ([e97c0b3](https://github.com/nkmr-jp/prompt-line/commit/e97c0b353322bdd15d9831130ff87b6c6154c1ae))

## [0.7.2](https://github.com/nkmr-jp/prompt-line/compare/v0.7.1...v0.7.2) (2025-06-29)


### Bug Fixes

* revert problematic PR to restore copy-paste functionality ([b887fdb](https://github.com/nkmr-jp/prompt-line/commit/b887fdb57f3181666e4972d0c68db7e4252f27df)), closes [#46](https://github.com/nkmr-jp/prompt-line/issues/46)

## [0.7.1](https://github.com/nkmr-jp/prompt-line/compare/v0.7.0...v0.7.1) (2025-06-24)


### Bug Fixes

* prevent markdown syntax from being pasted with images from Bear editor ([09485b4](https://github.com/nkmr-jp/prompt-line/commit/09485b4c644413d8dd5bdcdafc51457eaaf87250))

# [0.7.0](https://github.com/nkmr-jp/prompt-line/compare/v0.6.1...v0.7.0) (2025-06-23)


### Bug Fixes

* resolve critical security vulnerabilities in AppleScript execution and build process ([42e548e](https://github.com/nkmr-jp/prompt-line/commit/42e548e1cf9881257bd411e31bcc464a9d4f10a2))


### Features

* implement comprehensive security improvements ([ccde68f](https://github.com/nkmr-jp/prompt-line/commit/ccde68f5efeb467e186eab47e3528758f4cb39a8))

## [0.6.1](https://github.com/nkmr-jp/prompt-line/compare/v0.6.0...v0.6.1) (2025-06-23)


### Bug Fixes

* improve app bundle size calculation in afterSign.js ([cf6c2cd](https://github.com/nkmr-jp/prompt-line/commit/cf6c2cd81bb2b3e778ad8147b8fe6af616730bd6))

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
