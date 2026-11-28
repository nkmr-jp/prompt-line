import ApplicationServices
import Darwin
import Foundation

// MARK: - T3 Code Detection

extension DirectoryDetector {

    struct T3CodeThreadInfo {
        let threadId: String?
        let directory: String?
    }

    private static let dataDirsByBundleId: [String: String] = [
        "com.t3tools.t3code": ".t3",
        "com.t3tools.t3code.custom": ".t3-custom"
    ]

    /// Check if bundle ID is T3 Code
    static func isT3Code(_ bundleId: String) -> Bool {
        return dataDirsByBundleId[bundleId] != nil
    }

    /// Check whether keyboard focus in T3 Code is currently inside an integrated
    /// terminal rather than the chat composer, settings auth terminal, or another control.
    ///
    /// Reading `kAXFocusedUIElementAttribute` avoids setting `AXManualAccessibility`.
    static func isT3CodeTerminalFocused(appPid: pid_t) -> Bool {
        let appRef = AXUIElementCreateApplication(appPid)
        var focusedRef: CFTypeRef?
        guard AXUIElementCopyAttributeValue(appRef, kAXFocusedUIElementAttribute as CFString, &focusedRef) == .success,
              let focused = focusedRef else {
            return false
        }
        let element = focused as! AXUIElement

        var roleRef: CFTypeRef?
        guard AXUIElementCopyAttributeValue(element, kAXRoleAttribute as CFString, &roleRef) == .success,
              let role = roleRef as? String,
              role == "AXTextArea" || role == "AXTextField" else {
            return false
        }

        // Exclude Settings' ProviderAuthTerminal, which reuses the Ghostty terminal
        // surface inside a container labeled "Provider sign-in terminal".
        var parentRef: CFTypeRef?
        if AXUIElementCopyAttributeValue(element, kAXParentAttribute as CFString, &parentRef) == .success,
           let parent = parentRef {
            var parentDescRef: CFTypeRef?
            if AXUIElementCopyAttributeValue(parent as! AXUIElement, kAXDescriptionAttribute as CFString, &parentDescRef) == .success,
               let parentDesc = parentDescRef as? String,
               parentDesc.caseInsensitiveCompare("Provider sign-in terminal") == .orderedSame {
                return false
            }
        }

        var domClassesRef: CFTypeRef?
        if AXUIElementCopyAttributeValue(element, "AXDOMClassList" as CFString, &domClassesRef) == .success,
           let domClasses = domClassesRef as? [String],
           domClasses.contains("t3-ghostty-input") || domClasses.contains("xterm-helper-textarea") {
            return true
        }

        var descRef: CFTypeRef?
        if AXUIElementCopyAttributeValue(element, kAXDescriptionAttribute as CFString, &descRef) == .success,
           let desc = descRef as? String,
           desc.caseInsensitiveCompare("Terminal input") == .orderedSame {
            return true
        }

        return false
    }

    private static func isExistingDirectory(_ path: String) -> Bool {
        var isDirectory: ObjCBool = false
        return FileManager.default.fileExists(atPath: path, isDirectory: &isDirectory) && isDirectory.boolValue
    }

    /// Resolve T3 Code's server PID from `userdata/server-runtime.json`, falling back
    /// to `appPid` and its direct children sharing the same executable path.
    private static func t3CodeServerPids(
        appPid: pid_t,
        bundleId: String,
        in table: ProcessTable
    ) -> [pid_t] {
        if let dataDir = dataDirsByBundleId[bundleId] {
            let runtimeURL = FileManager.default.homeDirectoryForCurrentUser
                .appendingPathComponent(dataDir)
                .appendingPathComponent("userdata/server-runtime.json")
            if let data = try? Data(contentsOf: runtimeURL),
               let json = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any],
               let pidNumber = json["pid"] as? NSNumber {
                let serverPid = pidNumber.int32Value
                if serverPid > 0 && table.entries[serverPid] != nil {
                    return [serverPid]
                }
            }
        }

        var pids: [pid_t] = [appPid]
        if let appPath = executablePath(appPid) {
            for child in table.children[appPid] ?? [] {
                if executablePath(child) == appPath {
                    pids.append(child)
                }
            }
        }
        return pids
    }

    /// Read argv and envp from `KERN_PROCARGS2` for a process owned by the current user.
    private static func readProcArgsAndEnv(_ pid: pid_t) -> (argv: [String], env: [String: String]) {
        guard pid > 0 else { return ([], [:]) }

        var mib: [Int32] = [CTL_KERN, KERN_PROCARGS2, pid]
        var size = 0
        guard sysctl(&mib, 3, nil, &size, nil, 0) == 0,
              size > MemoryLayout<Int32>.size else {
            return ([], [:])
        }

        var buffer = [UInt8](repeating: 0, count: size)
        guard sysctl(&mib, 3, &buffer, &size, nil, 0) == 0,
              size > MemoryLayout<Int32>.size else {
            return ([], [:])
        }

        let rawArgc = UInt32(buffer[0])
            | (UInt32(buffer[1]) << 8)
            | (UInt32(buffer[2]) << 16)
            | (UInt32(buffer[3]) << 24)
        let argc = Int(Int32(bitPattern: rawArgc))
        guard argc >= 0, argc < 4096 else { return ([], [:]) }

        var offset = MemoryLayout<Int32>.size
        // Skip exec_path and trailing NUL alignment padding before argv[0].
        while offset < size && buffer[offset] != 0 {
            offset += 1
        }
        while offset < size && buffer[offset] == 0 {
            offset += 1
        }

        func readNextString() -> String? {
            guard offset < size else { return nil }
            let start = offset
            while offset < size && buffer[offset] != 0 {
                offset += 1
            }
            let value = String(decoding: buffer[start..<offset], as: UTF8.self)
            if offset < size {
                offset += 1
            }
            return value
        }

        var argv: [String] = []
        argv.reserveCapacity(argc)
        for _ in 0..<argc {
            guard let arg = readNextString() else { break }
            argv.append(arg)
        }

        var env: [String: String] = [:]
        while let entry = readNextString() {
            if entry.isEmpty { continue }
            guard let eqIndex = entry.firstIndex(of: "=") else { continue }
            let key = String(entry[..<eqIndex])
            if !key.isEmpty {
                env[key] = String(entry[entry.index(after: eqIndex)...])
            }
        }

        return (argv, env)
    }

    private static func isCommandModeShell(_ argv: [String]) -> Bool {
        for arg in argv.dropFirst() {
            if arg == "--" { break }
            if arg == "-c" { return true }
            if arg.hasPrefix("-") && !arg.hasPrefix("--") {
                let flags = arg.dropFirst()
                if !flags.isEmpty && flags.allSatisfy({ $0.isASCII && $0.isLetter }) && flags.contains("c") {
                    return true
                }
            }
        }
        return false
    }

    /// Working directory of the active integrated terminal in T3 Code.
    ///
    /// Uses a single `libproc` process table snapshot and `getCwdFromPidFast`,
    /// resolves the T3 Code server process via `server-runtime.json`, excludes
    /// inherited-TTY helper shells and `-c` command shells, follows nested
    /// interactive subshells on the same TTY, and uses `T3CODE_THREAD_ID`
    /// (readable on non-SIP shells and non-SIP descendants) to scope to the
    /// active thread when available.
    static func getT3CodeTerminalDirectory(
        appPid: pid_t,
        bundleId: String = "com.t3tools.t3code",
        threadInfo: T3CodeThreadInfo? = nil
    ) -> (directory: String?, shellPid: pid_t?) {
        guard appPid > 0 else { return (nil, nil) }

        let table = snapshotProcessTable()
        guard !table.entries.isEmpty else { return (nil, nil) }

        let serverPids = t3CodeServerPids(appPid: appPid, bundleId: bundleId, in: table)
        var inheritedTtys: Set<String> = []
        if let appTty = ttyName(ofPid: appPid) {
            inheritedTtys.insert(appTty)
        }
        for serverPid in serverPids {
            if let serverTty = ttyName(ofPid: serverPid) {
                inheritedTtys.insert(serverTty)
            }
        }

        let canonicalThreadDir = threadInfo?.directory.map { canonicalPath($0) }

        struct ShellCandidate {
            let pid: pid_t
            let cwd: String
            let ttyMtime: TimeInterval
            let matchesThreadId: Bool
            let inThreadDir: Bool
        }

        var candidates: [ShellCandidate] = []
        for serverPid in serverPids {
            for rootShellPid in table.children[serverPid] ?? [] {
                guard let rootEntry = table.entries[rootShellPid],
                      isShellCommand(rootEntry.comm) else { continue }
                guard let tty = ttyName(ofPid: rootShellPid),
                      !inheritedTtys.contains(tty) else { continue }

                let rootProc = readProcArgsAndEnv(rootShellPid)
                guard !isCommandModeShell(rootProc.argv) else { continue }

                let descendants = walk(from: rootShellPid, in: table, maxDepth: 4)

                // Prefer the deepest interactive subshell sharing the same TTY.
                var activeShellPid: pid_t?
                var activeCwd: String?
                for pid in descendants.reversed() {
                    if pid != rootShellPid {
                        guard let entry = table.entries[pid],
                              isShellCommand(entry.comm),
                              ttyName(ofPid: pid) == tty else { continue }
                        if isCommandModeShell(readProcArgsAndEnv(pid).argv) { continue }
                    }
                    if let cwd = getCwdFromPidFast(pid), !cwd.isEmpty, isExistingDirectory(cwd) {
                        activeShellPid = pid
                        activeCwd = cwd
                        break
                    }
                }
                guard let chosenShellPid = activeShellPid,
                      let chosenShellCwd = activeCwd else { continue }

                // Check T3CODE_THREAD_ID / TERM_PROGRAM on the shell or its non-SIP descendants on this TTY.
                var shellThreadId = rootProc.env["T3CODE_THREAD_ID"].flatMap { $0.isEmpty ? nil : $0 }
                var termProgram = rootProc.env["TERM_PROGRAM"]
                if shellThreadId == nil {
                    for descPid in descendants.dropFirst() {
                        guard ttyName(ofPid: descPid) == tty else { continue }
                        let descEnv = readProcArgsAndEnv(descPid).env
                        if termProgram == nil {
                            termProgram = descEnv["TERM_PROGRAM"]
                        }
                        if let tid = descEnv["T3CODE_THREAD_ID"], !tid.isEmpty {
                            shellThreadId = tid
                            break
                        }
                    }
                }

                if let termProgram = termProgram, termProgram != "t3code" {
                    continue
                }
                if let targetThreadId = threadInfo?.threadId,
                   let foundThreadId = shellThreadId,
                   foundThreadId != targetThreadId {
                    continue
                }

                var resolvedCwd = chosenShellCwd
                if let claudeCwd = claudeCodeCwd(underShellPid: chosenShellPid, in: table),
                   isExistingDirectory(claudeCwd) {
                    resolvedCwd = claudeCwd
                }

                let inThreadDir = canonicalThreadDir.map { root in
                    let candidatePath = canonicalPath(resolvedCwd)
                    return candidatePath == root || candidatePath.hasPrefix(root + "/")
                } ?? false

                let matchesThreadId = (threadInfo?.threadId != nil && shellThreadId == threadInfo?.threadId)
                let mtime = mtimeForTty(tty) ?? 0
                candidates.append(ShellCandidate(
                    pid: chosenShellPid,
                    cwd: resolvedCwd,
                    ttyMtime: mtime,
                    matchesThreadId: matchesThreadId,
                    inThreadDir: inThreadDir
                ))
            }
        }

        guard !candidates.isEmpty else { return (nil, nil) }

        if candidates.contains(where: { $0.matchesThreadId }) {
            candidates = candidates.filter { $0.matchesThreadId }
        }

        candidates.sort { lhs, rhs in
            if lhs.ttyMtime != rhs.ttyMtime {
                return lhs.ttyMtime > rhs.ttyMtime
            }
            if lhs.inThreadDir != rhs.inThreadDir {
                return lhs.inThreadDir
            }
            return lhs.pid > rhs.pid
        }

        return (candidates[0].cwd, candidates[0].pid)
    }

    /// Thread ID and working directory of the thread shown in T3 Code's focused window.
    ///
    /// T3 Code persists no "currently open thread": the route lives only in the
    /// renderer, and `lastVisitedAt` is a read watermark that does not move when
    /// switching between already-read threads. The window title does follow the
    /// route — the renderer sets it to "<project> / <thread>" — so the title is
    /// matched against the server's thread projection to find the directory.
    static func getT3CodeThreadInfo(appPid: pid_t, bundleId: String) -> T3CodeThreadInfo? {
        guard let title = getWindowTitle(pid: appPid, bundleId: bundleId) else { return nil }
        return t3CodeThreadInfo(forWindowTitle: title, bundleId: bundleId)
    }

    private static func decodeHexUTF8(_ hex: Substring) -> String? {
        guard !hex.isEmpty, hex.count % 2 == 0 else { return nil }
        var bytes: [UInt8] = []
        bytes.reserveCapacity(hex.count / 2)
        var index = hex.startIndex
        while index < hex.endIndex {
            let nextIndex = hex.index(index, offsetBy: 2)
            guard let byte = UInt8(hex[index..<nextIndex], radix: 16) else { return nil }
            bytes.append(byte)
            index = nextIndex
        }
        return String(decoding: bytes, as: UTF8.self)
    }

    static func t3CodeThreadInfo(forWindowTitle title: String, bundleId: String = "com.t3tools.t3code") -> T3CodeThreadInfo? {
        let trimmed = title.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty,
              let dataDir = dataDirsByBundleId[bundleId] else { return nil }

        let dbURL = FileManager.default.homeDirectoryForCurrentUser
            .appendingPathComponent(dataDir)
            .appendingPathComponent("userdata/statev2.sqlite")
        guard FileManager.default.fileExists(atPath: dbURL.path) else { return nil }

        // The title is arbitrary user text; a hex blob literal keeps it out of
        // the SQL grammar entirely.
        let titleLiteral = "CAST(X'" + trimmed.utf8.map { String(format: "%02x", $0) }.joined() + "' AS TEXT)"
        // Same characters Swift's .whitespacesAndNewlines trims above for the
        // common cases; SQLite's bare trim() strips only spaces.
        let ws = "' ' || char(9) || char(10) || char(13)"
        // Mirrors the renderer's title: an empty project title leaves only the
        // thread title. Titles are not unique, so archived threads count only
        // when no live thread matches, and matches that disagree on the
        // thread ID or directory yield nothing for that field rather than a guess.
        // hex(tid) + '|' avoids sqlite3's caret escaping of control characters
        // and queryStateDatabase's whitespace trimming.
        let sql = """
            WITH m AS (
                SELECT t.thread_id AS tid,
                       coalesce(nullif(CASE WHEN json_valid(t.payload_json)
                           THEN json_extract(t.payload_json, '$.worktreePath') END, ''), p.workspace_root) AS dir,
                       t.archived_at IS NOT NULL OR p.archived_at IS NOT NULL AS archived
                FROM orchestration_v2_projection_threads t
                JOIN projection_projects p ON p.project_id = t.project_id
                WHERE t.deleted_at IS NULL AND p.deleted_at IS NULL
                  AND CASE WHEN trim(p.title, \(ws)) = '' THEN trim(t.title, \(ws))
                           ELSE trim(p.title, \(ws)) || ' / ' || trim(t.title, \(ws)) END = \(titleLiteral)
            ), tier AS (
                SELECT tid, dir FROM m WHERE archived = (SELECT min(archived) FROM m)
            )
            SELECT CASE WHEN count(DISTINCT tid) = 1 THEN hex(CAST(max(tid) AS BLOB)) ELSE '' END || '|' ||
                   CASE WHEN count(DISTINCT dir) = 1 THEN max(dir) ELSE '' END
            FROM tier
            """

        guard let raw = queryStateDatabase(dbURL, sql: sql) else { return nil }
        let parts = raw.split(separator: "|", maxSplits: 1, omittingEmptySubsequences: false)
        guard parts.count == 2 else { return nil }

        let threadId = decodeHexUTF8(parts[0])
        let dirCandidate = String(parts[1])
        let directory: String? = (dirCandidate.hasPrefix("/") && isExistingDirectory(dirCandidate))
            ? dirCandidate
            : nil

        if threadId == nil && directory == nil {
            return nil
        }
        return T3CodeThreadInfo(threadId: threadId, directory: directory)
    }

    static func getT3CodeDirectory(appPid: pid_t, bundleId: String) -> String? {
        return getT3CodeThreadInfo(appPid: appPid, bundleId: bundleId)?.directory
    }

    static func t3CodeDirectory(forWindowTitle title: String, bundleId: String = "com.t3tools.t3code") -> String? {
        return t3CodeThreadInfo(forWindowTitle: title, bundleId: bundleId)?.directory
    }
}
