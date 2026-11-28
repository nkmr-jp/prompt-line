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
    
    private static let t3CodeBundleIds: Set<String> = [
        "com.t3tools.t3code",
        "com.t3tools.t3code.custom"
    ]

    private static func isT3CodeTerminalFocused(appPid: pid_t) -> Bool {
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

    static func getCurrentApp() -> [String: Any] {
        guard let frontApp = NSWorkspace.shared.frontmostApplication else {
            return ["error": "No active application found"]
        }
        
        var result: [String: Any] = [
            "name": frontApp.localizedName ?? "Unknown"
        ]
        
        if let bundleId = frontApp.bundleIdentifier {
            result["bundleId"] = bundleId
            if t3CodeBundleIds.contains(bundleId) && isT3CodeTerminalFocused(appPid: frontApp.processIdentifier) {
                result["terminalFocused"] = true
            }
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