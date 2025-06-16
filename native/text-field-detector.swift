import Cocoa
import ApplicationServices
import Foundation

class TextFieldDetector {
    static func getActiveTextFieldBounds() -> [String: Any] {
        // Check if we have accessibility permissions
        if !AXIsProcessTrusted() {
            return ["error": "no_accessibility_permission"]
        }
        
        guard let frontApp = NSWorkspace.shared.frontmostApplication else {
            return ["error": "no_active_application"]
        }
        
        let pid = frontApp.processIdentifier
        let app = AXUIElementCreateApplication(pid)
        
        // Get focused element
        var focusedElement: CFTypeRef?
        let focusResult = AXUIElementCopyAttributeValue(app, kAXFocusedUIElementAttribute as CFString, &focusedElement)
        
        if focusResult != AXError.success {
            return ["error": "no_focused_element"]
        }
        
        guard let element = focusedElement else {
            return ["error": "focused_element_null"]
        }
        
        let axElement = element as! AXUIElement
        
        // Try to get element role (but don't fail if unavailable)
        var elementRole = "Unknown"
        var role: CFTypeRef?
        let roleResult = AXUIElementCopyAttributeValue(axElement, kAXRoleAttribute as CFString, &role)
        
        if roleResult == AXError.success, let roleString = role as? String {
            elementRole = roleString
            
            // If we can get role, check if it's a text field
            let textFieldRoles = ["AXTextField", "AXTextArea", "AXSecureTextField", "AXComboBox"]
            if !textFieldRoles.contains(elementRole) {
                return ["error": "not_text_field", "role": elementRole]
            }
        }
        // If role is unavailable, continue anyway - the element might still be a text field
        
        // Try multiple methods to get position and size information
        var point = CGPoint()
        var cgSize = CGSize()
        var boundsObtained = false
        var lastError = "unknown_error"
        var methodUsed = "none"
        
        // Method 1: Standard kAXPositionAttribute and kAXSizeAttribute
        var position: CFTypeRef?
        var size: CFTypeRef?
        
        let positionResult = AXUIElementCopyAttributeValue(axElement, kAXPositionAttribute as CFString, &position)
        let sizeResult = AXUIElementCopyAttributeValue(axElement, kAXSizeAttribute as CFString, &size)
        
        if positionResult == AXError.success && sizeResult == AXError.success,
           let positionValue = position, let sizeValue = size {
            let pointResult = AXValueGetValue(positionValue as! AXValue, .cgPoint, &point)
            let sizeValueResult = AXValueGetValue(sizeValue as! AXValue, .cgSize, &cgSize)
            
            if pointResult && sizeValueResult {
                boundsObtained = true
                methodUsed = "standard_attributes"
            } else {
                lastError = "cannot_convert_standard_values"
            }
        } else {
            lastError = "cannot_get_standard_attributes"
        }
        
        // Method 2: Try getting bounds information from parent elements
        if !boundsObtained {
            var parent: CFTypeRef?
            let parentResult = AXUIElementCopyAttributeValue(axElement, kAXParentAttribute as CFString, &parent)
            
            if parentResult == AXError.success, let parentElement = parent {
                let parentAXElement = parentElement as! AXUIElement
                
                // Try to get parent position and size
                var parentPosition: CFTypeRef?
                var parentSize: CFTypeRef?
                
                let parentPosResult = AXUIElementCopyAttributeValue(parentAXElement, kAXPositionAttribute as CFString, &parentPosition)
                let parentSizeResult = AXUIElementCopyAttributeValue(parentAXElement, kAXSizeAttribute as CFString, &parentSize)
                
                if parentPosResult == AXError.success && parentSizeResult == AXError.success,
                   let parentPosValue = parentPosition, let parentSizeValue = parentSize {
                    var parentPoint = CGPoint()
                    var parentSize = CGSize()
                    let parentPointResult = AXValueGetValue(parentPosValue as! AXValue, .cgPoint, &parentPoint)
                    let parentSizeValueResult = AXValueGetValue(parentSizeValue as! AXValue, .cgSize, &parentSize)
                    
                    if parentPointResult && parentSizeValueResult {
                        // Use parent bounds as text field estimate
                        point.x = parentPoint.x + 10  // Small offset from parent edge
                        point.y = parentPoint.y + 10
                        cgSize.width = max(200, min(400, parentSize.width - 20))  // Reasonable width within parent
                        cgSize.height = min(30, parentSize.height - 20)  // Text field height within parent
                        boundsObtained = true
                        methodUsed = "parent_bounds"
                    } else {
                        lastError = "cannot_convert_parent_values"
                    }
                } else {
                    lastError = "cannot_get_parent_attributes"
                }
            } else {
                lastError = "cannot_get_parent_element"
            }
        }
        
        // Method 3: Try kAXWindowAttribute to get parent window bounds and estimate
        if !boundsObtained {
            var window: CFTypeRef?
            let windowResult = AXUIElementCopyAttributeValue(axElement, kAXWindowAttribute as CFString, &window)
            
            if windowResult == AXError.success, let windowElement = window {
                let windowAXElement = windowElement as! AXUIElement
                
                // Try to get window position and size
                var windowPosition: CFTypeRef?
                var windowSize: CFTypeRef?
                
                let windowPosResult = AXUIElementCopyAttributeValue(windowAXElement, kAXPositionAttribute as CFString, &windowPosition)
                let windowSizeResult = AXUIElementCopyAttributeValue(windowAXElement, kAXSizeAttribute as CFString, &windowSize)
                
                if windowPosResult == AXError.success && windowSizeResult == AXError.success,
                   let windowPosValue = windowPosition, let windowSizeValue = windowSize {
                    var windowPoint = CGPoint()
                    var windowSize = CGSize()
                    let windowPointResult = AXValueGetValue(windowPosValue as! AXValue, .cgPoint, &windowPoint)
                    let windowSizeValueResult = AXValueGetValue(windowSizeValue as! AXValue, .cgSize, &windowSize)
                    
                    if windowPointResult && windowSizeValueResult {
                        // Estimate text field position within window
                        point.x = windowPoint.x + 50  // Reasonable offset from window edge
                        point.y = windowPoint.y + 100 // Estimate for typical text field position
                        cgSize.width = min(400, max(300, windowSize.width - 100))  // Reasonable width
                        cgSize.height = 30  // Standard text field height
                        boundsObtained = true
                        methodUsed = "window_estimate"
                    } else {
                        lastError = "cannot_convert_window_values"
                    }
                } else {
                    lastError = "cannot_get_window_attributes"
                }
            } else {
                lastError = "cannot_get_window_element"
            }
        }
        
        // Method 4: Use CGWindowListCopyWindowInfo as fallback
        if !boundsObtained {
            let options: CGWindowListOption = [.optionOnScreenOnly, .excludeDesktopElements]
            guard let windowList = CGWindowListCopyWindowInfo(options, kCGNullWindowID) as? [[String: Any]] else {
                return ["error": "cannot_get_window_list_fallback"]
            }
            
            // Find the active window for this app
            for windowInfo in windowList {
                if let windowPid = windowInfo[kCGWindowOwnerPID as String] as? Int32,
                   windowPid == pid,
                   let bounds = windowInfo[kCGWindowBounds as String] as? [String: CGFloat],
                   let layer = windowInfo[kCGWindowLayer as String] as? Int,
                   layer == 0 {  // Main window layer
                    
                    if let x = bounds["X"], let y = bounds["Y"],
                       let width = bounds["Width"], let height = bounds["Height"] {
                        // Estimate text field position in center-bottom of window
                        point.x = x + width * 0.2  // 20% from left edge
                        point.y = y + height * 0.7 // 70% down from top
                        cgSize.width = min(400, max(300, width * 0.6))  // 60% of window width
                        cgSize.height = 30  // Standard text field height
                        boundsObtained = true
                        methodUsed = "window_list_estimate"
                        break
                    }
                }
            }
            
            if !boundsObtained {
                lastError = "no_suitable_window_found_in_list"
            }
        }
        
        // If all methods failed, return error with debugging info
        if !boundsObtained {
            return [
                "error": "all_bounds_methods_failed", 
                "lastError": lastError,
                "role": elementRole,
                "appName": frontApp.localizedName ?? "Unknown",
                "appPid": pid
            ]
        }
        
        // Get additional text field information
        var additionalInfo: [String: Any] = [:]
        
        // Get element title if available
        var title: CFTypeRef?
        if AXUIElementCopyAttributeValue(axElement, kAXTitleAttribute as CFString, &title) == AXError.success,
           let titleString = title as? String {
            additionalInfo["title"] = titleString
        }
        
        // Get placeholder text if available (for text fields)
        var placeholder: CFTypeRef?
        if AXUIElementCopyAttributeValue(axElement, kAXPlaceholderValueAttribute as CFString, &placeholder) == AXError.success,
           let placeholderString = placeholder as? String {
            additionalInfo["placeholder"] = placeholderString
        }
        
        // Get current text value if available and safe (not for secure fields)
//        if elementRole != "AXSecureTextField" {
//            var value: CFTypeRef?
//            if AXUIElementCopyAttributeValue(axElement, kAXValueAttribute as CFString, &value) == AXError.success,
//               let valueString = value as? String {
//                additionalInfo["value"] = valueString
//                additionalInfo["hasContent"] = !valueString.isEmpty
//            }
//        }
        
        // Get text field state information
        var enabled: CFTypeRef?
        if AXUIElementCopyAttributeValue(axElement, kAXEnabledAttribute as CFString, &enabled) == AXError.success,
           let enabledBool = enabled as? Bool {
            additionalInfo["enabled"] = enabledBool
        }
        
        // Note: kAXVisibleAttribute doesn't exist, skip this check
        
        // Get parent element information for better positioning with scrollable content
        var parentInfo: [String: Any] = [:]
        var parent: CFTypeRef?
        if AXUIElementCopyAttributeValue(axElement, kAXParentAttribute as CFString, &parent) == AXError.success,
           let parentElement = parent {
            let parentAXElement = parentElement as! AXUIElement
            
            // Get parent role
            var parentRole: CFTypeRef?
            if AXUIElementCopyAttributeValue(parentAXElement, kAXRoleAttribute as CFString, &parentRole) == AXError.success,
               let parentRoleString = parentRole as? String {
                parentInfo["role"] = parentRoleString
                
                // If parent is a scroll area or similar container, get its visible bounds
                if parentRoleString == "AXScrollArea" || parentRoleString == "AXGroup" || parentRoleString == "AXSplitGroup" {
                    var parentPosition: CFTypeRef?
                    var parentSize: CFTypeRef?
                    
                    if AXUIElementCopyAttributeValue(parentAXElement, kAXPositionAttribute as CFString, &parentPosition) == AXError.success,
                       AXUIElementCopyAttributeValue(parentAXElement, kAXSizeAttribute as CFString, &parentSize) == AXError.success {
                        
                        var parentPoint = CGPoint.zero
                        var parentCGSize = CGSize.zero
                        
                        if AXValueGetValue(parentPosition as! AXValue, .cgPoint, &parentPoint),
                           AXValueGetValue(parentSize as! AXValue, .cgSize, &parentCGSize) {
                            parentInfo["x"] = Int(parentPoint.x)
                            parentInfo["y"] = Int(parentPoint.y)
                            parentInfo["width"] = Int(parentCGSize.width)
                            parentInfo["height"] = Int(parentCGSize.height)
                            parentInfo["isVisibleContainer"] = true
                        }
                    }
                }
            }
        }
        
        // Return comprehensive text field information
        var result: [String: Any] = [
            "success": true,
            "x": Int(point.x),
            "y": Int(point.y),
            "width": Int(cgSize.width),
            "height": Int(cgSize.height),
            "role": elementRole,
            "methodUsed": methodUsed,
            "appName": frontApp.localizedName ?? "Unknown",
            "appPid": pid
        ]
        
        if let bundleId = frontApp.bundleIdentifier {
            result["bundleId"] = bundleId
        }
        
        // Merge additional information
        result.merge(additionalInfo) { (_, new) in new }
        
        // Add parent container info if available
        if !parentInfo.isEmpty {
            result["parent"] = parentInfo
        }
        
        return result
    }
    
    static func checkAccessibilityPermission() -> [String: Any] {
        let isTrusted = AXIsProcessTrusted()
        
        if !isTrusted {
            // Check with prompt option for user convenience
            let options: NSDictionary = [kAXTrustedCheckOptionPrompt.takeRetainedValue(): true]
            let trustedWithPrompt = AXIsProcessTrustedWithOptions(options)
            
            return [
                "hasPermission": trustedWithPrompt,
                "prompted": true
            ]
        }
        
        return [
            "hasPermission": true,
            "prompted": false
        ]
    }
    
    static func getFocusedElementInfo() -> [String: Any] {
        // Check accessibility permissions first
        if !AXIsProcessTrusted() {
            return ["error": "no_accessibility_permission"]
        }
        
        guard let frontApp = NSWorkspace.shared.frontmostApplication else {
            return ["error": "no_active_application"]
        }
        
        let pid = frontApp.processIdentifier
        let app = AXUIElementCreateApplication(pid)
        
        // Get focused element
        var focusedElement: CFTypeRef?
        let focusResult = AXUIElementCopyAttributeValue(app, kAXFocusedUIElementAttribute as CFString, &focusedElement)
        
        if focusResult != AXError.success {
            return ["error": "no_focused_element"]
        }
        
        guard let element = focusedElement else {
            return ["error": "focused_element_null"]
        }
        
        let axElement = element as! AXUIElement
        
        // Get basic element information
        var elementInfo: [String: Any] = [
            "appName": frontApp.localizedName ?? "Unknown",
            "appPid": pid
        ]
        
        if let bundleId = frontApp.bundleIdentifier {
            elementInfo["bundleId"] = bundleId
        }
        
        // Get element role
        var role: CFTypeRef?
        if AXUIElementCopyAttributeValue(axElement, kAXRoleAttribute as CFString, &role) == AXError.success,
           let elementRole = role as? String {
            elementInfo["role"] = elementRole
        }
        
        // Get element subrole
        var subrole: CFTypeRef?
        if AXUIElementCopyAttributeValue(axElement, kAXSubroleAttribute as CFString, &subrole) == AXError.success,
           let elementSubrole = subrole as? String {
            elementInfo["subrole"] = elementSubrole
        }
        
        // Get element title
        var title: CFTypeRef?
        if AXUIElementCopyAttributeValue(axElement, kAXTitleAttribute as CFString, &title) == AXError.success,
           let titleString = title as? String {
            elementInfo["title"] = titleString
        }
        
        // Get element description
        var description: CFTypeRef?
        if AXUIElementCopyAttributeValue(axElement, kAXDescriptionAttribute as CFString, &description) == AXError.success,
           let descString = description as? String {
            elementInfo["description"] = descString
        }
        
        // Get position and size if available
        var position: CFTypeRef?
        var size: CFTypeRef?
        
        if AXUIElementCopyAttributeValue(axElement, kAXPositionAttribute as CFString, &position) == AXError.success,
           AXUIElementCopyAttributeValue(axElement, kAXSizeAttribute as CFString, &size) == AXError.success {
            
            var point = CGPoint.zero
            var cgSize = CGSize.zero
            
            if AXValueGetValue(position as! AXValue, .cgPoint, &point),
               AXValueGetValue(size as! AXValue, .cgSize, &cgSize) {
                elementInfo["x"] = Int(point.x)
                elementInfo["y"] = Int(point.y)
                elementInfo["width"] = Int(cgSize.width)
                elementInfo["height"] = Int(cgSize.height)
            }
        }
        
        // Get element state
        var enabled: CFTypeRef?
        if AXUIElementCopyAttributeValue(axElement, kAXEnabledAttribute as CFString, &enabled) == AXError.success,
           let enabledBool = enabled as? Bool {
            elementInfo["enabled"] = enabledBool
        }
        
        return elementInfo
    }
}

func main() {
    let arguments = CommandLine.arguments
    
    guard arguments.count >= 2 else {
        fputs("Usage: \(arguments[0]) <command>\n", stderr)
        fputs("Commands:\n", stderr)
        fputs("  text-field-bounds    - Get bounds of focused text field\n", stderr)
        fputs("  check-permission     - Check accessibility permission status\n", stderr)
        fputs("  focused-element      - Get information about focused element\n", stderr)
        exit(1)
    }
    
    let command = arguments[1]
    let result: [String: Any]
    
    switch command {
    case "text-field-bounds":
        result = TextFieldDetector.getActiveTextFieldBounds()
        
    case "check-permission":
        result = TextFieldDetector.checkAccessibilityPermission()
        
    case "focused-element":
        result = TextFieldDetector.getFocusedElementInfo()
        
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