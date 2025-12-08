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
