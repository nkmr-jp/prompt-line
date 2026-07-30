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
    /// shell behind it (Ghostty's AXDocument, cmux's AppleScript).
    ///
    /// `focusedTty` — when the terminal can name the focused pane's tty, as cmux
    /// does through its control socket — identifies that pane exactly, and the agent
    /// occupying it is the answer.
    ///
    /// Without it there is no focus information at all. Several panes routinely sit
    /// in `directory`, and tty mtime cannot arbitrate between them: it measures
    /// output traffic, not focus, which is precisely why `getGhosttyDirectory`
    /// prefers AXDocument over it. Picking one would make the reported project
    /// directory depend on which *background* pane last redrew its prompt. So the
    /// agent's directory is adopted only when every pane in `directory` resolves to
    /// the same place; anything else returns `directory` unchanged. A stable answer
    /// beats silently scoping file search to another pane's worktree.
    static func preferClaudeCodeCwd(over directory: String, appPid: pid_t, focusedTty: String? = nil) -> String {
        let table = snapshotProcessTable()
        let descendants = walk(from: appPid, in: table, maxDepth: shellSearchMaxDepth)

        if let tty = focusedTty {
            return claudeCodeCwds(among: descendants, onTtys: [tty])[tty] ?? directory
        }

        let ttys = ttysHostingShells(among: descendants, matching: directory, in: table)
        let agents = claudeCodeCwds(among: descendants, onTtys: ttys)
        let resolved = Set(ttys.map { agents[$0] ?? directory })
        return resolved.count == 1 ? resolved.first! : directory
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
        let parent = executable.deletingLastPathComponent as NSString

        // Native installs exec the versioned binary: `<...>/claude/versions/<version>`.
        // `proc_pidpath` resolves the `~/.local/bin/claude` symlink to this form, so
        // this arm matches every live session regardless of how it was launched.
        if parent.lastPathComponent == "versions",
           (parent.deletingLastPathComponent as NSString).lastPathComponent == "claude" {
            return true
        }

        // Second arm for installs that exec a binary literally named `claude`.
        // Requiring a `bin` directory (`/opt/homebrew/bin`, `~/.local/bin`, npm's
        // `node_modules/.bin`) keeps an unrelated `<project>/claude` from matching.
        return executable.lastPathComponent == "claude"
            && (parent.lastPathComponent == "bin" || parent.lastPathComponent == ".bin")
    }

    // MARK: - Pane resolution

    /// Working directory of the Claude Code session occupying each of `ttys`.
    /// Matching the agent on its controlling tty rather than on a parent shell means
    /// a pane whose foreground process *is* the agent resolves like one where the
    /// agent hangs off the pane's shell, and it needs no guess about which of a
    /// pane's nested shells started the session.
    /// `pids` arrives breadth-first, so an outer session wins over a nested
    /// `claude -p` that it may have spawned through a shell command.
    private static func claudeCodeCwds(among pids: [pid_t], onTtys ttys: Set<String>) -> [String: String] {
        var found: [String: String] = [:]
        guard !ttys.isEmpty else { return found }

        for pid in pids {
            if found.count == ttys.count { break }
            guard let path = executablePath(pid), isClaudeCodeExecutable(path) else { continue }
            guard let tty = ttyName(ofPid: pid), ttys.contains(tty), found[tty] == nil else { continue }
            guard let cwd = getCwdFromPidFast(pid), !cwd.isEmpty else { continue }
            found[tty] = cwd
        }

        return found
    }

    /// ttys of the panes that host a shell sitting in `directory`. A pane owns one
    /// tty, so this is the set of panes the reported directory could have come from.
    private static func ttysHostingShells(
        among pids: [pid_t],
        matching directory: String,
        in table: ProcessTable
    ) -> Set<String> {
        let target = canonicalPath(directory)
        var ttys: Set<String> = []

        for pid in pids {
            guard let entry = table.entries[pid], isShellCommand(entry.comm) else { continue }
            guard let cwd = getCwdFromPidFast(pid), canonicalPath(cwd) == target else { continue }
            guard let tty = ttyName(ofPid: pid) else { continue }
            ttys.insert(tty)
        }

        return ttys
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
