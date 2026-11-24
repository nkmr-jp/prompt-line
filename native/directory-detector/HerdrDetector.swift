import Cocoa

// MARK: - Herdr Detection

extension DirectoryDetector {

    /// Check if bundle ID is Herdr
    static func isHerdr(_ bundleId: String) -> Bool {
        return bundleId == "dev.herdr.app"
    }

    /// Working directory of the terminal in Herdr's focused pane.
    ///
    /// Herdr's terminals run under the `herdr-core` daemon, not under the app,
    /// so the process-tree detectors never see them. The app reports its focused
    /// pane (`status`) and which terminal sits in it (`ls`); `herdr-core get`
    /// then gives that terminal's foreground process cwd. Its top-level `cwd`
    /// (also in `herdr-core ls`) is only where the terminal started and does not
    /// follow `cd`.
    static func getHerdrDirectory(appPid: pid_t) -> (directory: String?, shellPid: pid_t?) {
        guard let appCli = herdrAppCli(appPid: appPid),
              let coreCli = herdrCoreCli(),
              let status = runCli(appCli, args: ["status"]).flatMap(jsonObject),
              let focusedPane = status["focused_pane"] as? String,
              let layout = runCli(appCli, args: ["ls"]).flatMap(jsonObject),
              let terminalId = herdrTerminal(inPane: focusedPane, layout: layout),
              let terminal = runCli(coreCli, args: ["get", terminalId, "--json"]).flatMap(jsonObject) else {
            return (nil, nil)
        }

        let foreground = terminal["foreground"] as? [String: Any]
        guard let cwd = (foreground?["cwd"] as? String) ?? (terminal["cwd"] as? String),
              !cwd.isEmpty else {
            return (nil, nil)
        }

        // `pid` is the terminal's own program (the shell). A Claude Code session
        // in it may have moved into a worktree that the shell never followed.
        // A finished terminal keeps reporting its dead pid, which the system may
        // have handed to an unrelated process by now, so it is not walked.
        guard terminal["state"] as? String != "finished",
              let pid = (terminal["pid"] as? NSNumber)?.int32Value else {
            return (cwd, nil)
        }
        return (preferClaudeCodeCwd(over: cwd, shellPid: pid), pid)
    }

    private static func herdrTerminal(inPane paneId: String, layout: [String: Any]) -> String? {
        for space in layout["spaces"] as? [[String: Any]] ?? [] {
            for tab in space["tabs"] as? [[String: Any]] ?? [] {
                for terminal in tab["terminals"] as? [[String: Any]] ?? []
                where terminal["pane"] as? String == paneId {
                    return terminal["terminal"] as? String
                }
            }
        }
        return nil
    }

    /// The app binary doubles as its CLI (`~/.local/bin/herdr-app` links to it),
    /// so take it from the running app rather than from a guessed path.
    private static func herdrAppCli(appPid: pid_t) -> URL? {
        guard let app = NSRunningApplication(processIdentifier: appPid),
              let url = app.executableURL,
              FileManager.default.isExecutableFile(atPath: url.path) else { return nil }
        return url
    }

    /// `herdr-core` is installed per user, outside the app bundle.
    private static func herdrCoreCli() -> URL? {
        let home = FileManager.default.homeDirectoryForCurrentUser.path
        let candidates = [
            "\(home)/.local/bin/herdr-core",
            "\(home)/.local/share/herdr-core/current/Contents/MacOS/herdr-core"
        ]
        return candidates.first { FileManager.default.isExecutableFile(atPath: $0) }
            .map { URL(fileURLWithPath: $0) }
    }

    private static func jsonObject(_ data: Data) -> [String: Any]? {
        return (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
    }
}
