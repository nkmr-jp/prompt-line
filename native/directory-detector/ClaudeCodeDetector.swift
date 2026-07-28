import Foundation

// MARK: - Claude Code CLI working directory
//
// Every detector in this tool ultimately resolves a *shell's* working directory.
// Claude Code's "Entering worktree(...)" performs a real chdir() inside the CLI
// process itself: the agent moves into the worktree while the shell that started
// it stays put. Unless detection looks one level past the shell, the reported
// project directory silently lags behind the directory the session is actually
// working in.

extension DirectoryDetector {

    // Depth caps for the process-tree walks. The agent normally sits one level
    // below its shell, and a shell sits two or three levels below the terminal
    // app (app -> login -> zsh). The caps exist so a pathological process tree can
    // never turn detection — which runs on every window show — into a long walk.
    private static let agentSearchMaxDepth = 4
    private static let shellSearchMaxDepth = 10
    private static let processWalkMaxNodes = 2048

    // MARK: - Process table snapshot

    /// pid/ppid/comm for every process, captured through libproc.
    struct ProcessTable {
        struct Entry {
            let ppid: pid_t
            /// `comm` from libproc is truncated to MAXCOMLEN (16) characters. That
            /// is enough to recognise shells ("zsh", "bash"), but not the agent —
            /// whose binary is named after its version — so agent matching uses
            /// `proc_pidpath` on the few processes actually visited.
            let comm: String
        }

        let entries: [pid_t: Entry]
        let children: [pid_t: [pid_t]]
    }

    /// Snapshot the process table via libproc.
    /// Measured on a 1000-process machine: ~1ms, against ~75ms to fork `ps`. That
    /// margin is what lets the AX/CLI fast paths — which exist precisely to avoid
    /// forking `ps` — pick up the agent's directory without losing their speed.
    static func snapshotProcessTable() -> ProcessTable {
        let empty = ProcessTable(entries: [:], children: [:])

        let byteCount = proc_listpids(UInt32(PROC_ALL_PIDS), 0, nil, 0)
        guard byteCount > 0 else { return empty }

        // Processes can be created between sizing and reading; ask for headroom.
        let capacity = Int(byteCount) / MemoryLayout<pid_t>.size + 64
        var pids = [pid_t](repeating: 0, count: capacity)
        let written = proc_listpids(
            UInt32(PROC_ALL_PIDS),
            0,
            &pids,
            Int32(capacity * MemoryLayout<pid_t>.size)
        )
        guard written > 0 else { return empty }

        var entries: [pid_t: ProcessTable.Entry] = [:]
        var children: [pid_t: [pid_t]] = [:]
        entries.reserveCapacity(capacity)

        for pid in pids[0..<(Int(written) / MemoryLayout<pid_t>.size)] where pid > 0 {
            guard let info = shortBsdInfo(pid) else { continue }
            let ppid = pid_t(bitPattern: info.pbsi_ppid)
            entries[pid] = ProcessTable.Entry(ppid: ppid, comm: commName(info))
            children[ppid, default: []].append(pid)
        }

        return ProcessTable(entries: entries, children: children)
    }

    // MARK: - Public entry points

    /// Prefer the Claude Code session's own working directory over `directory`
    /// when the agent is running under `shellPid`. Returns `directory` unchanged
    /// when no agent is there or its cwd cannot be read.
    static func preferClaudeCodeCwd(over directory: String, shellPid: pid_t) -> String {
        return claudeCodeCwd(underShellPid: shellPid, in: snapshotProcessTable()) ?? directory
    }

    /// Same, for detectors that only learn the focused pane's directory and not the
    /// shell behind it (Ghostty's AXDocument, cmux's AppleScript): find the focused
    /// shell sitting in that directory under `appPid` first, then look beneath it.
    static func preferClaudeCodeCwd(over directory: String, appPid: pid_t) -> String {
        let table = snapshotProcessTable()
        for shellPid in focusedShellPids(underAppPid: appPid, matching: directory, in: table) {
            if let cwd = claudeCodeCwd(underShellPid: shellPid, in: table) {
                return cwd
            }
        }
        return directory
    }

    /// Working directory of the Claude Code session running under `shellPid`.
    /// `shellPid` itself is considered a candidate, because tty-based detection can
    /// resolve the pane's foreground process — the agent — rather than the shell.
    static func claudeCodeCwd(underShellPid shellPid: pid_t, in table: ProcessTable) -> String? {
        // Breadth-first, so an outer session wins over a nested `claude -p` that it
        // may have spawned through a shell command.
        for pid in walk(from: shellPid, in: table, maxDepth: agentSearchMaxDepth) {
            guard let path = executablePath(pid), isClaudeCodeExecutable(path) else { continue }
            if let cwd = getCwdFromPidFast(pid), !cwd.isEmpty {
                return cwd
            }
        }
        return nil
    }

    /// Recognise the Claude Code CLI from its executable path.
    static func isClaudeCodeExecutable(_ path: String) -> Bool {
        let executable = path as NSString

        // Native installs exec the versioned binary: `<...>/claude/versions/<version>`.
        // `proc_pidpath` resolves the `~/.local/bin/claude` symlink to this form, so
        // this arm matches every live session regardless of how it was launched.
        let versionsDir = executable.deletingLastPathComponent as NSString
        if versionsDir.lastPathComponent == "versions",
           (versionsDir.deletingLastPathComponent as NSString).lastPathComponent == "claude" {
            return true
        }

        // Defensive second arm for installs that exec a binary literally named
        // `claude`. It is a loose match, but it is only ever applied to processes
        // already proven to be running under the focused shell.
        return executable.lastPathComponent == "claude"
    }

    // MARK: - Focused shell resolution

    /// Shells under `appPid` whose cwd is `directory`, narrowed to the tty that was
    /// most recently active. The tty narrowing matters when two panes sit in the
    /// same directory and only one of them runs an agent: the pane the user is
    /// actually looking at wins — the same focus heuristic that
    /// `getNativeTerminalDirectory` already relies on.
    /// Returns every shell on the winning tty rather than one pid, because a pane
    /// owns a login shell plus any shells nested inside it and the agent may hang
    /// off either.
    private static func focusedShellPids(
        underAppPid appPid: pid_t,
        matching directory: String,
        in table: ProcessTable
    ) -> [pid_t] {
        let target = canonicalPath(directory)
        var shellsByTty: [String: [pid_t]] = [:]
        var mtimeByTty: [String: TimeInterval] = [:]

        for pid in walk(from: appPid, in: table, maxDepth: shellSearchMaxDepth) {
            guard let entry = table.entries[pid], isShellCommand(entry.comm) else { continue }
            guard let tty = ttyName(ofPid: pid) else { continue }
            guard let cwd = getCwdFromPidFast(pid), canonicalPath(cwd) == target else { continue }

            shellsByTty[tty, default: []].append(pid)
            if mtimeByTty[tty] == nil {
                mtimeByTty[tty] = mtimeForTty(tty) ?? 0
            }
        }

        // Compare the tty name on ties so the result never depends on dictionary
        // ordering.
        guard let focusedTty = mtimeByTty.max(by: { ($0.value, $0.key) < ($1.value, $1.key) })?.key else {
            return []
        }
        return shellsByTty[focusedTty] ?? []
    }

    // MARK: - Process tree helpers

    /// Breadth-first walk of `rootPid` and its descendants, nearest first.
    private static func walk(from rootPid: pid_t, in table: ProcessTable, maxDepth: Int) -> [pid_t] {
        var visited: [pid_t] = [rootPid]
        var queue: [(pid: pid_t, depth: Int)] = [(rootPid, 0)]
        var index = 0

        while index < queue.count && visited.count < processWalkMaxNodes {
            let (pid, depth) = queue[index]
            index += 1
            if depth >= maxDepth { continue }

            // Newest child first, so ties within a level resolve to the most
            // recently started process.
            for child in (table.children[pid] ?? []).sorted(by: >) {
                visited.append(child)
                queue.append((child, depth + 1))
                if visited.count >= processWalkMaxNodes { break }
            }
        }

        return visited
    }

    /// PROC_PIDT_SHORTBSDINFO, not PROC_PIDTBSDINFO: the full flavour is refused
    /// for processes owned by another user, and a terminal's process tree runs
    /// through exactly such a process — the setuid-root `/usr/bin/login` that sits
    /// between the terminal app and the pane's shell. Reading the short flavour
    /// keeps the parent chain intact.
    private static func shortBsdInfo(_ pid: pid_t) -> proc_bsdshortinfo? {
        var info = proc_bsdshortinfo()
        let size = Int32(MemoryLayout<proc_bsdshortinfo>.size)
        let result = withUnsafeMutablePointer(to: &info) { pointer in
            proc_pidinfo(pid, PROC_PIDT_SHORTBSDINFO, 0, pointer, size)
        }
        return result == size ? info : nil
    }

    /// `pbsi_comm` is `char[MAXCOMLEN]` and is *not* guaranteed to be
    /// NUL-terminated, so it has to be read as a bounded buffer.
    private static func commName(_ info: proc_bsdshortinfo) -> String {
        var info = info
        let bytes = withUnsafePointer(to: &info.pbsi_comm) { pointer in
            pointer.withMemoryRebound(to: UInt8.self, capacity: Int(MAXCOMLEN)) { chars in
                Array(UnsafeBufferPointer(start: chars, count: Int(MAXCOMLEN)).prefix { $0 != 0 })
            }
        }
        return String(decoding: bytes, as: UTF8.self)
    }

    private static func executablePath(_ pid: pid_t) -> String? {
        var buffer = [CChar](repeating: 0, count: 4 * Int(MAXPATHLEN))
        let length = proc_pidpath(pid, &buffer, UInt32(buffer.count))
        return length > 0 ? String(cString: buffer) : nil
    }

    /// Controlling tty of a process. Only the full BSD info carries the tty device,
    /// so this is asked for shell candidates only — those are owned by the current
    /// user, where the full flavour is permitted.
    private static func ttyName(ofPid pid: pid_t) -> String? {
        var info = proc_bsdinfo()
        let size = Int32(MemoryLayout<proc_bsdinfo>.size)
        let result = withUnsafeMutablePointer(to: &info) { pointer in
            proc_pidinfo(pid, PROC_PIDTBSDINFO, 0, pointer, size)
        }
        guard result == size else { return nil }

        let tdev = dev_t(bitPattern: info.e_tdev)
        guard tdev != 0, tdev != -1, let name = devname(tdev, S_IFCHR) else {
            return nil
        }
        return String(cString: name)
    }

    /// Compare directories the way the filesystem sees them: the shell's cwd comes
    /// from the kernel (already canonical) while a terminal reports whatever `$PWD`
    /// held, which may still contain symlinks.
    private static func canonicalPath(_ path: String) -> String {
        var resolved = URL(fileURLWithPath: path).resolvingSymlinksInPath().path
        if resolved.hasSuffix("/") && resolved != "/" {
            resolved.removeLast()
        }
        return resolved
    }
}
