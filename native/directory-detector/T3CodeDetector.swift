import Foundation

// MARK: - T3 Code Detection

extension DirectoryDetector {

    /// Check if bundle ID is T3 Code
    static func isT3Code(_ bundleId: String) -> Bool {
        return bundleId == "com.t3tools.t3code"
    }

    /// Working directory of the thread shown in T3 Code's focused window.
    ///
    /// T3 Code persists no "currently open thread": the route lives only in the
    /// renderer, and `lastVisitedAt` is a read watermark that does not move when
    /// switching between already-read threads. The window title does follow the
    /// route — the renderer sets it to "<project> / <thread>" — so the title is
    /// matched against the server's thread projection to find the directory.
    static func getT3CodeDirectory(appPid: pid_t, bundleId: String) -> String? {
        guard let title = getWindowTitle(pid: appPid, bundleId: bundleId) else { return nil }
        return t3CodeDirectory(forWindowTitle: title)
    }

    static func t3CodeDirectory(forWindowTitle title: String) -> String? {
        let trimmed = title.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return nil }

        let dbURL = FileManager.default.homeDirectoryForCurrentUser
            .appendingPathComponent(".t3/userdata/statev2.sqlite")
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
        // directory yield nothing rather than a guess.
        let sql = """
            WITH m AS (
                SELECT coalesce(nullif(CASE WHEN json_valid(t.payload_json)
                           THEN json_extract(t.payload_json, '$.worktreePath') END, ''), p.workspace_root) AS dir,
                       t.archived_at IS NOT NULL OR p.archived_at IS NOT NULL AS archived
                FROM orchestration_v2_projection_threads t
                JOIN projection_projects p ON p.project_id = t.project_id
                WHERE t.deleted_at IS NULL AND p.deleted_at IS NULL
                  AND CASE WHEN trim(p.title, \(ws)) = '' THEN trim(t.title, \(ws))
                           ELSE trim(p.title, \(ws)) || ' / ' || trim(t.title, \(ws)) END = \(titleLiteral)
            ), tier AS (
                SELECT dir FROM m WHERE archived = (SELECT min(archived) FROM m)
            )
            SELECT CASE WHEN count(DISTINCT dir) = 1 THEN max(dir) END FROM tier
            """

        guard let directory = queryStateDatabase(dbURL, sql: sql),
              directory.hasPrefix("/") else { return nil }

        // A worktree removed after its thread was created must not become the
        // search root.
        var isDirectory: ObjCBool = false
        guard FileManager.default.fileExists(atPath: directory, isDirectory: &isDirectory),
              isDirectory.boolValue else { return nil }
        return directory
    }
}
