import Cocoa
import ApplicationServices
import Foundation

class WindowDetector {
    static func getActiveWindowBounds() -> [String: Any] {
        guard let frontApp = NSWorkspace.shared.frontmostApplication else {
            return ["error": "No active application found"]
        }
        
        // Get the process ID of the frontmost application
        let pid = frontApp.processIdentifier
        
        // Get window list for the frontmost application
        guard let windowList = CGWindowListCopyWindowInfo([.optionOnScreenOnly, .excludeDesktopElements], kCGNullWindowID) as? [[String: Any]] else {
            return ["error": "Failed to get window list"]
        }
        
        for window in windowList {
            if let windowPID = window[kCGWindowOwnerPID as String] as? Int32,
               let windowLayer = window[kCGWindowLayer as String] as? Int,
               windowPID == pid && windowLayer == 0 {
                
                if let bounds = window[kCGWindowBounds as String] as? [String: Any],
                   let x = bounds["X"] as? NSNumber,
                   let y = bounds["Y"] as? NSNumber,
                   let width = bounds["Width"] as? NSNumber,
                   let height = bounds["Height"] as? NSNumber {
                    
                    var result: [String: Any] = [
                        "x": x,
                        "y": y,
                        "width": width,
                        "height": height,
                        "appName": frontApp.localizedName ?? "Unknown"
                    ]
                    
                    if let bundleId = frontApp.bundleIdentifier {
                        result["bundleId"] = bundleId
                    } else {
                        result["bundleId"] = NSNull()
                    }
                    
                    return result
                }
            }
        }
        
        return ["error": "No active window found"]
    }
    
    static func getCurrentApp() -> [String: Any] {
        guard let frontApp = NSWorkspace.shared.frontmostApplication else {
            return ["error": "No active application found"]
        }
        
        var result: [String: Any] = [
            "name": frontApp.localizedName ?? "Unknown"
        ]
        
        if let bundleId = frontApp.bundleIdentifier {
            result["bundleId"] = bundleId
        } else {
            result["bundleId"] = NSNull()
        }
        
        return result
    }
}

func main() {
    let arguments = CommandLine.arguments
    
    guard arguments.count >= 2 else {
        fputs("Usage: \(arguments[0]) <command>\n", stderr)
        fputs("Commands: window-bounds, current-app\n", stderr)
        exit(1)
    }
    
    let command = arguments[1]
    let result: [String: Any]
    
    switch command {
    case "window-bounds":
        result = WindowDetector.getActiveWindowBounds()
        
    case "current-app":
        result = WindowDetector.getCurrentApp()
        
    default:
        fputs("Unknown command: \(command)\n", stderr)
        exit(1)
    }
    
    // Convert result to JSON and output
    do {
        let jsonData = try JSONSerialization.data(withJSONObject: result, options: [])
        if let jsonString = String(data: jsonData, encoding: .utf8) {
            print(jsonString)
        }
    } catch {
        fputs("JSON serialization error: \(error.localizedDescription)\n", stderr)
        exit(1)
    }
    
    exit(0)
}

main()