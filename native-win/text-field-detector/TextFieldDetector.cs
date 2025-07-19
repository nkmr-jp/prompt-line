using System;
using System.Runtime.InteropServices;
using System.Text.Json;
using System.Diagnostics;
using System.Windows.Automation;

namespace TextFieldDetector
{
    class Program
    {
        #region Helper Methods

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
                
                // Check for text input controls
                if (controlType == ControlType.Edit ||
                    controlType == ControlType.Document ||
                    controlType == ControlType.Text)
                {
                    return focusedElement;
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
            catch
            {
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
                    Console.WriteLine(JsonSerializer.Serialize(new { error = "No focused text field found" }));
                    return;
                }

                var bounds = GetTextFieldBounds(focusedElement);
                Console.WriteLine(JsonSerializer.Serialize(bounds));
            }
            catch (Exception ex)
            {
                Console.WriteLine(JsonSerializer.Serialize(new { error = ex.Message }));
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
                default:
                    Console.WriteLine(JsonSerializer.Serialize(new { error = $"Unknown command: {args[0]}" }));
                    Environment.Exit(1);
                    break;
            }
        }
    }
}