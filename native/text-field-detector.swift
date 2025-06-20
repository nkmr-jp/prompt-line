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
        
        // Get element role
        var role: CFTypeRef?
        let roleResult = AXUIElementCopyAttributeValue(axElement, kAXRoleAttribute as CFString, &role)
        
        if roleResult != AXError.success {
            return ["error": "cannot_get_role"]
        }
        
        guard let elementRole = role as? String else {
            return ["error": "invalid_role"]
        }
        
        // Check if element is a text field
        let textFieldRoles = ["AXTextField", "AXTextArea", "AXSecureTextField", "AXComboBox"]
        if !textFieldRoles.contains(elementRole) {
            return ["error": "not_text_field", "role": elementRole]
        }
        
        // Get element position
        var position: CFTypeRef?
        let positionResult = AXUIElementCopyAttributeValue(axElement, kAXPositionAttribute as CFString, &position)
        
        if positionResult != AXError.success {
            return ["error": "cannot_get_position"]
        }
        
        // Get element size
        var size: CFTypeRef?
        let sizeResult = AXUIElementCopyAttributeValue(axElement, kAXSizeAttribute as CFString, &size)
        
        if sizeResult != AXError.success {
            return ["error": "cannot_get_size"]
        }
        
        // Extract position values
        var point = CGPoint.zero
        if !AXValueGetValue(position as! AXValue, .cgPoint, &point) {
            return ["error": "invalid_position_data"]
        }
        
        // Extract size values
        var cgSize = CGSize.zero
        if !AXValueGetValue(size as! AXValue, .cgSize, &cgSize) {
            return ["error": "invalid_size_data"]
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
        
        // Check if text field has content without capturing the actual value
        if elementRole != "AXSecureTextField" {
            var value: CFTypeRef?
            if AXUIElementCopyAttributeValue(axElement, kAXValueAttribute as CFString, &value) == AXError.success,
               let valueString = value as? String {
                additionalInfo["hasContent"] = !valueString.isEmpty
            }
        }
        
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