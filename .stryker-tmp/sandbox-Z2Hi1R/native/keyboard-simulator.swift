import Cocoa
import ApplicationServices
import Foundation

class KeyboardSimulator {
    static func sendCommandV() -> Bool {
        // Check if we have accessibility permissions
        let accessibilityEnabled = AXIsProcessTrustedWithOptions([
            kAXTrustedCheckOptionPrompt.takeUnretainedValue(): false
        ] as CFDictionary)
        
        if !accessibilityEnabled {
            NSLog("Accessibility permissions not granted")
            return false
        }
        
        // Create key down event for Cmd+V
        guard let keyDownEvent = CGEvent(keyboardEventSource: nil, virtualKey: 9, keyDown: true) else {
            NSLog("Failed to create key down event")
            return false
        }
        
        // Set the command modifier flag
        keyDownEvent.flags = .maskCommand
        
        // Create key up event for Cmd+V
        guard let keyUpEvent = CGEvent(keyboardEventSource: nil, virtualKey: 9, keyDown: false) else {
            NSLog("Failed to create key up event")
            return false
        }
        
        keyUpEvent.flags = .maskCommand
        
        // Post the events to the system
        keyDownEvent.post(tap: .cghidEventTap)
        usleep(10000) // 10ms delay between key down and up
        keyUpEvent.post(tap: .cghidEventTap)
        
        NSLog("Sent Cmd+V keyboard event")
        return true
    }
    
    static func activateApplication(byName appName: String) -> Bool {
        let runningApps = NSWorkspace.shared.runningApplications
        
        for app in runningApps {
            if app.localizedName == appName || app.bundleIdentifier == appName {
                return app.activate(options: .activateAllWindows)
            }
        }
        
        return false
    }
    
    static func activateApplication(byBundleId bundleId: String) -> Bool {
        let runningApps = NSWorkspace.shared.runningApplications
        
        for app in runningApps {
            if app.bundleIdentifier == bundleId {
                let activated = app.activate(options: .activateAllWindows)
                NSLog("Activating app with bundle ID: \(bundleId), success: \(activated)")
                return activated
            }
        }
        
        NSLog("App with bundle ID not found: \(bundleId)")
        return false
    }
}

func main() {
    let arguments = CommandLine.arguments
    
    guard arguments.count >= 2 else {
        fputs("Usage: \(arguments[0]) <command> [arguments]\n", stderr)
        fputs("Commands:\n", stderr)
        fputs("  paste - Send Cmd+V keyboard event\n", stderr)
        fputs("  activate-name <app_name> - Activate app by name\n", stderr)
        fputs("  activate-bundle <bundle_id> - Activate app by bundle ID\n", stderr)
        fputs("  activate-and-paste-name <app_name> - Activate app by name and paste\n", stderr)
        fputs("  activate-and-paste-bundle <bundle_id> - Activate app by bundle ID and paste\n", stderr)
        exit(1)
    }
    
    let command = arguments[1]
    var success = false
    
    switch command {
    case "paste":
        success = KeyboardSimulator.sendCommandV()
        
    case "activate-name":
        guard arguments.count >= 3 else {
            fputs("Missing app name argument\n", stderr)
            exit(1)
        }
        let appName = arguments[2]
        success = KeyboardSimulator.activateApplication(byName: appName)
        
    case "activate-bundle":
        guard arguments.count >= 3 else {
            fputs("Missing bundle ID argument\n", stderr)
            exit(1)
        }
        let bundleId = arguments[2]
        success = KeyboardSimulator.activateApplication(byBundleId: bundleId)
        
    case "activate-and-paste-name":
        guard arguments.count >= 3 else {
            fputs("Missing app name argument\n", stderr)
            exit(1)
        }
        let appName = arguments[2]
        success = KeyboardSimulator.activateApplication(byName: appName)
        if success {
            success = KeyboardSimulator.sendCommandV()
        }
        
    case "activate-and-paste-bundle":
        guard arguments.count >= 3 else {
            fputs("Missing bundle ID argument\n", stderr)
            exit(1)
        }
        let bundleId = arguments[2]
        success = KeyboardSimulator.activateApplication(byBundleId: bundleId)
        if success {
            success = KeyboardSimulator.sendCommandV()
        }
        
    default:
        fputs("Unknown command or missing arguments: \(command)\n", stderr)
        exit(1)
    }
    
    // Check accessibility permissions for additional info
    let hasAccessibility = AXIsProcessTrustedWithOptions([
        kAXTrustedCheckOptionPrompt.takeUnretainedValue(): false
    ] as CFDictionary)
    
    // Output result as JSON
    let result: [String: Any] = [
        "success": success,
        "command": command,
        "hasAccessibility": hasAccessibility
    ]
    
    do {
        let jsonData = try JSONSerialization.data(withJSONObject: result, options: [])
        if let jsonString = String(data: jsonData, encoding: .utf8) {
            print(jsonString)
        }
    } catch {
        fputs("JSON serialization error: \(error.localizedDescription)\n", stderr)
        exit(1)
    }
    
    exit(success ? 0 : 1)
}

main()