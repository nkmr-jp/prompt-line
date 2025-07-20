using System;
using System.Runtime.InteropServices;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Diagnostics;
using System.Windows.Automation;

namespace TextFieldDetector
{
    class Program
    {
        #region Win32 API declarations
        
        [DllImport("user32.dll")]
        private static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
        
        [StructLayout(LayoutKind.Sequential)]
        private struct RECT
        {
            public int Left;
            public int Top;
            public int Right;
            public int Bottom;
        }
        
        #endregion
        
        #region Helper Methods
        
        private static readonly JsonSerializerOptions JsonOptions = new JsonSerializerOptions
        {
            NumberHandling = JsonNumberHandling.AllowNamedFloatingPointLiterals,
            WriteIndented = false
        };

        private static string GetProcessName(uint processId)
        {
            try
            {
                using var process = Process.GetProcessById((int)processId);
                return process.ProcessName;
            }
            catch
            {
                return "Unknown";
            }
        }

        private static AutomationElement? GetFocusedTextFieldElement()
        {
            try
            {
                // Get the focused element
                AutomationElement focusedElement = AutomationElement.FocusedElement;
                if (focusedElement == null)
                {
                    return null;
                }

                // Check if the focused element is a text-input control
                var controlType = focusedElement.Current.ControlType;
                
                // Log control type for debugging
                Console.Error.WriteLine($"[DEBUG] Focused element ControlType: {controlType.ProgrammaticName}, Name: {focusedElement.Current.Name ?? "null"}");
                
                // Check for text input controls
                if (controlType == ControlType.Edit ||
                    controlType == ControlType.Text)
                {
                    return focusedElement;
                }
                
                // Document type (common in Electron apps) doesn't have valid bounds
                if (controlType == ControlType.Document)
                {
                    Console.Error.WriteLine("[DEBUG] Document type detected - not a valid text field for positioning");
                    return null;
                }

                // Check for ComboBox with text input capability
                if (controlType == ControlType.ComboBox)
                {
                    var isEditable = focusedElement.GetCurrentPropertyValue(AutomationElement.IsKeyboardFocusableProperty);
                    if (isEditable is bool editable && editable)
                    {
                        return focusedElement;
                    }
                }

                // Check for custom text controls by looking for ValuePattern
                object valuePattern;
                if (focusedElement.TryGetCurrentPattern(ValuePattern.Pattern, out valuePattern))
                {
                    var pattern = valuePattern as ValuePattern;
                    if (pattern != null && !pattern.Current.IsReadOnly)
                    {
                        return focusedElement;
                    }
                }

                return null;
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine($"[ERROR] GetFocusedTextFieldElement: {ex.Message}");
                return null;
            }
        }
        

        private static object GetTextFieldBounds(AutomationElement element)
        {
            try
            {
                var boundingRect = element.Current.BoundingRectangle;
                var controlType = element.Current.ControlType;
                var name = element.Current.Name ?? "";

                // Get the parent window to determine the app name
                var window = element;
                while (window != null && window.Current.ControlType != ControlType.Window)
                {
                    window = TreeWalker.ControlViewWalker.GetParent(window);
                }

                string appName = "";
                if (window != null)
                {
                    var processId = window.Current.ProcessId;
                    appName = GetProcessName((uint)processId);
                }

                // Log bounding rectangle details
                Console.Error.WriteLine($"[DEBUG] BoundingRectangle: X={boundingRect.X}, Y={boundingRect.Y}, W={boundingRect.Width}, H={boundingRect.Height}");
                Console.Error.WriteLine($"[DEBUG] IsEmpty={boundingRect.IsEmpty}, AppName={appName}");

                // Check if bounding rectangle is valid
                if (boundingRect.IsEmpty || 
                    boundingRect.X == int.MinValue || 
                    boundingRect.Y == int.MinValue ||
                    boundingRect.Width <= 0 ||
                    boundingRect.Height <= 0 ||
                    double.IsInfinity(boundingRect.X) ||
                    double.IsInfinity(boundingRect.Y) ||
                    double.IsInfinity(boundingRect.Width) ||
                    double.IsInfinity(boundingRect.Height))
                {
                    Console.Error.WriteLine("[DEBUG] Invalid bounding rectangle detected");
                    return new { error = "Invalid bounding rectangle" };
                }

                Console.Error.WriteLine("[DEBUG] Using normal BoundingRectangle");
                return new
                {
                    x = (int)boundingRect.X,
                    y = (int)boundingRect.Y,
                    width = (int)boundingRect.Width,
                    height = (int)boundingRect.Height,
                    appName = appName,
                    bundleId = (string?)null,
                    controlType = controlType.LocalizedControlType ?? controlType.ProgrammaticName,
                    name = name
                };
            }
            catch
            {
                return new { error = "Failed to get text field bounds" };
            }
        }

        #endregion

        #region Command Handlers

        private static void GetActiveTextFieldBounds()
        {
            try
            {
                var focusedElement = GetFocusedTextFieldElement();
                if (focusedElement == null)
                {
                    Console.WriteLine(JsonSerializer.Serialize(new { error = "No focused text field found" }, JsonOptions));
                    return;
                }

                var bounds = GetTextFieldBounds(focusedElement);
                Console.WriteLine(JsonSerializer.Serialize(bounds, JsonOptions));
            }
            catch (Exception ex)
            {
                Console.WriteLine(JsonSerializer.Serialize(new { error = ex.Message }, JsonOptions));
            }
        }
        
        private static void GetFocusedElementInfo()
        {
            try
            {
                // Get the focused element
                AutomationElement focusedElement = AutomationElement.FocusedElement;
                if (focusedElement == null)
                {
                    Console.WriteLine(JsonSerializer.Serialize(new { error = "No focused element" }, JsonOptions));
                    return;
                }

                var controlType = focusedElement.Current.ControlType;
                var bounds = focusedElement.Current.BoundingRectangle;
                
                // Get the parent window to determine the app name
                var window = focusedElement;
                while (window != null && window.Current.ControlType != ControlType.Window)
                {
                    window = TreeWalker.ControlViewWalker.GetParent(window);
                }

                string appName = "";
                if (window != null)
                {
                    var processId = window.Current.ProcessId;
                    appName = GetProcessName((uint)processId);
                }

                var result = new
                {
                    controlType = controlType.ProgrammaticName,
                    localizedControlType = controlType.LocalizedControlType,
                    name = focusedElement.Current.Name ?? "",
                    className = focusedElement.Current.ClassName ?? "",
                    automationId = focusedElement.Current.AutomationId ?? "",
                    appName = appName,
                    bounds = new
                    {
                        x = bounds.X,
                        y = bounds.Y,
                        width = bounds.Width,
                        height = bounds.Height,
                        isEmpty = bounds.IsEmpty
                    },
                    hasKeyboardFocus = focusedElement.Current.HasKeyboardFocus,
                    isEnabled = focusedElement.Current.IsEnabled,
                    nativeWindowHandle = focusedElement.Current.NativeWindowHandle != IntPtr.Zero
                };

                Console.WriteLine(JsonSerializer.Serialize(result, JsonOptions));
            }
            catch (Exception ex)
            {
                Console.WriteLine(JsonSerializer.Serialize(new { error = ex.Message }, JsonOptions));
            }
        }

        #endregion

        static void Main(string[] args)
        {
            if (args.Length == 0)
            {
                // Default command for text-field-detector
                GetActiveTextFieldBounds();
                return;
            }

            switch (args[0])
            {
                case "bounds":
                case "text-field-bounds":
                    GetActiveTextFieldBounds();
                    break;
                case "focused-element":
                    GetFocusedElementInfo();
                    break;
                default:
                    Console.WriteLine(JsonSerializer.Serialize(new { error = $"Unknown command: {args[0]}" }, JsonOptions));
                    Environment.Exit(1);
                    break;
            }
        }
    }
}