import Foundation

// MARK: - CWD Detection

extension DirectoryDetector {

    // MARK: - Get current working directory from PID

    /// Get process CWD using libproc (10-50x faster than lsof)
    /// Performance: ~1-5ms vs 50-200ms for lsof
    static func getCwdFromPidFast(_ pid: pid_t) -> String? {
        var vnodeInfo = proc_vnodepathinfo()
        let size = MemoryLayout<proc_vnodepathinfo>.size

        let result = withUnsafeMutablePointer(to: &vnodeInfo) { pointer in
            proc_pidinfo(
                pid,
                PROC_PIDVNODEPATHINFO,
                0,
                pointer,
                Int32(size)
            )
        }

        guard result > 0 else {
            // Error: fall back to lsof
            return getCwdFromPidLsof(pid)
        }

        let cwdPath = withUnsafePointer(to: &vnodeInfo.pvi_cdir.vip_path) { pointer in
            pointer.withMemoryRebound(to: CChar.self, capacity: Int(MAXPATHLEN)) {
                String(cString: $0)
            }
        }

        return cwdPath.isEmpty ? nil : cwdPath
    }

    /// Original lsof-based implementation (fallback)
    /// Performance: ~50-200ms per call
    static func getCwdFromPidLsof(_ pid: pid_t) -> String? {
        // Use lsof to get the current working directory with timeout
        // Added -n -P flags to skip DNS resolution and port name conversion
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/sbin/lsof")
        process.arguments = ["-n", "-P", "-a", "-p", String(pid), "-d", "cwd", "-F", "n"]

        let pipe = Pipe()
        process.standardOutput = pipe
        process.standardError = FileHandle.nullDevice

        do {
            try process.run()

            // Add 1 second timeout to prevent hanging on unresponsive processes
            let semaphore = DispatchSemaphore(value: 0)
            var result: String?

            DispatchQueue.global(qos: .userInitiated).async {
                process.waitUntilExit()
                semaphore.signal()
            }

            let waitResult = semaphore.wait(timeout: .now() + 1.0)

            if waitResult == .timedOut {
                process.terminate()
                return nil
            }

            let data = pipe.fileHandleForReading.readDataToEndOfFile()
            guard let output = String(data: data, encoding: .utf8) else {
                return nil
            }

            // Parse lsof -F output (field output format)
            // Lines starting with 'n' contain the name (path)
            for line in output.split(separator: "\n") {
                let lineStr = String(line)
                if lineStr.hasPrefix("n") && !lineStr.hasPrefix("ncwd") {
                    result = String(lineStr.dropFirst())
                    break
                }
            }

            return result
        } catch {
            return nil
        }
    }

    /// Main entry point with automatic fallback
    static func getCwdFromPid(_ pid: pid_t) -> String? {
        return getCwdFromPidFast(pid)
    }
}
