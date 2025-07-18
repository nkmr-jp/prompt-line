using System;
using System.Runtime.InteropServices;
using System.Text.Json;
using System.Diagnostics;
using System.Text;
using System.Runtime.CompilerServices;
using System.Windows.Automation;

namespace WindowDetector
{
    public static class WindowDetector
    {
        #region Win32 API Declarations
        
        [DllImport("user32.dll")]
        private static extern IntPtr GetForegroundWindow();

        [DllImport("user32.dll")]
        private static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);

        [DllImport("user32.dll")]
        private static extern int GetWindowTextLength(IntPtr hWnd);

        [DllImport("user32.dll")]
        private static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

        [DllImport("user32.dll")]
        private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

        [DllImport("user32.dll")]
        private static extern bool SetForegroundWindow(IntPtr hWnd);

        [DllImport("user32.dll")]
        private static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

        [DllImport("user32.dll")]
        private static extern uint SendInput(uint nInputs, INPUT[] pInputs, int cbSize);

        [DllImport("kernel32.dll")]
        private static extern uint GetCurrentThreadId();

        [DllImport("user32.dll")]
        private static extern bool AttachThreadInput(uint idAttach, uint idAttachTo, bool fAttach);

        [DllImport("user32.dll")]
        private static extern uint GetWindowThreadProcessId(IntPtr hWnd, IntPtr processId);

        [DllImport("user32.dll")]
        private static extern IntPtr FindWindow(string lpClassName, string lpWindowName);

        [DllImport("user32.dll")]
        private static extern bool IsWindow(IntPtr hWnd);

        [DllImport("user32.dll")]
        private static extern bool IsWindowVisible(IntPtr hWnd);

        [StructLayout(LayoutKind.Sequential)]
        private struct RECT
        {
            public int Left;
            public int Top;
            public int Right;
            public int Bottom;
        }

        [StructLayout(LayoutKind.Sequential)]
        private struct INPUT
        {
            public uint Type;
            public InputUnion Data;
        }

        [StructLayout(LayoutKind.Explicit)]
        private struct InputUnion
        {
            [FieldOffset(0)]
            public MOUSEINPUT Mouse;
            [FieldOffset(0)]
            public KEYBDINPUT Keyboard;
            [FieldOffset(0)]
            public HARDWAREINPUT Hardware;
        }

        [StructLayout(LayoutKind.Sequential)]
        private struct MOUSEINPUT
        {
            public int X;
            public int Y;
            public uint MouseData;
            public uint Flags;
            public uint Time;
            public IntPtr ExtraInfo;
        }

        [StructLayout(LayoutKind.Sequential)]
        private struct KEYBDINPUT
        {
            public ushort VirtualKey;
            public ushort ScanCode;
            public uint Flags;
            public uint Time;
            public IntPtr ExtraInfo;
        }

        [StructLayout(LayoutKind.Sequential)]
        private struct HARDWAREINPUT
        {
            public uint Msg;
            public ushort ParamL;
            public ushort ParamH;
        }

        // Constants
        private const uint INPUT_KEYBOARD = 1;
        private const uint KEYEVENTF_KEYUP = 0x0002;
        private const ushort VK_CONTROL = 0x11;
        private const ushort VK_V = 0x56;
        private const int SW_RESTORE = 9;
        private const int SW_SHOW = 5;

        #endregion

        #region Data Models

        public class AppInfo
        {
            public string Name { get; set; } = "";
            public string? BundleId { get; set; } = null;
        }

        public class WindowBounds
        {
            public int X { get; set; }
            public int Y { get; set; }
            public int Width { get; set; }
            public int Height { get; set; }
            public string AppName { get; set; } = "";
            public string? BundleId { get; set; } = null;
        }

        public class ErrorResponse
        {
            public string Error { get; set; } = "";
        }

        public class SuccessResponse
        {
            public bool Success { get; set; } = true;
            public string Message { get; set; } = "";
        }

        public class TextFieldBounds
        {
            public int X { get; set; }
            public int Y { get; set; }
            public int Width { get; set; }
            public int Height { get; set; }
            public string AppName { get; set; } = "";
            public string? BundleId { get; set; } = null;
            public string ControlType { get; set; } = "";
            public string Name { get; set; } = "";
        }

        #endregion

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

        private static string GetWindowTitle(IntPtr hWnd)
        {
            try
            {
                int length = GetWindowTextLength(hWnd);
                if (length == 0) return "";

                var buffer = new StringBuilder(length + 1);
                GetWindowText(hWnd, buffer, buffer.Capacity);
                return buffer.ToString();
            }
            catch
            {
                return "";
            }
        }

        private static IntPtr MarshalStringToPtr(string str)
        {
            return Marshal.StringToHGlobalAnsi(str);
        }

        private static IntPtr FindWindowByProcessName(string processName)
        {
            try
            {
                var processes = Process.GetProcessesByName(processName);
                foreach (var process in processes)
                {
                    if (process.MainWindowHandle != IntPtr.Zero)
                    {
                        return process.MainWindowHandle;
                    }
                }
                return IntPtr.Zero;
            }
            catch
            {
                return IntPtr.Zero;
            }
        }

        private static bool ActivateWindow(IntPtr hWnd)
        {
            if (hWnd == IntPtr.Zero || !IsWindow(hWnd))
                return false;

            // Get the thread ID of the target window
            uint targetThreadId = GetWindowThreadProcessId(hWnd, IntPtr.Zero);
            uint currentThreadId = GetCurrentThreadId();

            try
            {
                // Attach threads to allow SetForegroundWindow to work
                if (targetThreadId != currentThreadId)
                {
                    AttachThreadInput(currentThreadId, targetThreadId, true);
                }

                // Restore the window if it's minimized
                ShowWindow(hWnd, SW_RESTORE);
                
                // Set as foreground window
                bool result = SetForegroundWindow(hWnd);

                return result;
            }
            finally
            {
                // Detach threads
                if (targetThreadId != currentThreadId)
                {
                    AttachThreadInput(currentThreadId, targetThreadId, false);
                }
            }
        }

        private static bool SendCtrlV()
        {
            var inputs = new INPUT[4];

            // Press Ctrl
            inputs[0] = new INPUT
            {
                Type = INPUT_KEYBOARD,
                Data = new InputUnion
                {
                    Keyboard = new KEYBDINPUT
                    {
                        VirtualKey = VK_CONTROL,
                        ScanCode = 0,
                        Flags = 0,
                        Time = 0,
                        ExtraInfo = IntPtr.Zero
                    }
                }
            };

            // Press V
            inputs[1] = new INPUT
            {
                Type = INPUT_KEYBOARD,
                Data = new InputUnion
                {
                    Keyboard = new KEYBDINPUT
                    {
                        VirtualKey = VK_V,
                        ScanCode = 0,
                        Flags = 0,
                        Time = 0,
                        ExtraInfo = IntPtr.Zero
                    }
                }
            };

            // Release V
            inputs[2] = new INPUT
            {
                Type = INPUT_KEYBOARD,
                Data = new InputUnion
                {
                    Keyboard = new KEYBDINPUT
                    {
                        VirtualKey = VK_V,
                        ScanCode = 0,
                        Flags = KEYEVENTF_KEYUP,
                        Time = 0,
                        ExtraInfo = IntPtr.Zero
                    }
                }
            };

            // Release Ctrl
            inputs[3] = new INPUT
            {
                Type = INPUT_KEYBOARD,
                Data = new InputUnion
                {
                    Keyboard = new KEYBDINPUT
                    {
                        VirtualKey = VK_CONTROL,
                        ScanCode = 0,
                        Flags = KEYEVENTF_KEYUP,
                        Time = 0,
                        ExtraInfo = IntPtr.Zero
                    }
                }
            };

            uint result = SendInput(4, inputs, Marshal.SizeOf(typeof(INPUT)));
            return result == 4;
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

        private static TextFieldBounds? GetTextFieldBounds(AutomationElement element)
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

                return new TextFieldBounds
                {
                    X = (int)boundingRect.X,
                    Y = (int)boundingRect.Y,
                    Width = (int)boundingRect.Width,
                    Height = (int)boundingRect.Height,
                    AppName = appName,
                    BundleId = null,
                    ControlType = controlType.LocalizedControlType ?? controlType.ProgrammaticName,
                    Name = name
                };
            }
            catch
            {
                return null;
            }
        }

        #endregion

        #region Exported Methods

        [UnmanagedCallersOnly(EntryPoint = "GetCurrentApp", CallConvs = new[] { typeof(CallConvStdcall) })]
        public static IntPtr GetCurrentApp()
        {
            try
            {
                var hWnd = GetForegroundWindow();
                if (hWnd == IntPtr.Zero)
                {
                    var error = new ErrorResponse { Error = "No active application found" };
                    return MarshalStringToPtr(JsonSerializer.Serialize(error));
                }

                GetWindowThreadProcessId(hWnd, out uint processId);
                var processName = GetProcessName(processId);

                var appInfo = new AppInfo
                {
                    Name = processName,
                    BundleId = null // Windows doesn't have bundle IDs
                };

                return MarshalStringToPtr(JsonSerializer.Serialize(appInfo));
            }
            catch (Exception ex)
            {
                var error = new ErrorResponse { Error = ex.Message };
                return MarshalStringToPtr(JsonSerializer.Serialize(error));
            }
        }

        [UnmanagedCallersOnly(EntryPoint = "GetActiveWindowBounds", CallConvs = new[] { typeof(CallConvStdcall) })]
        public static IntPtr GetActiveWindowBounds()
        {
            try
            {
                var hWnd = GetForegroundWindow();
                if (hWnd == IntPtr.Zero)
                {
                    var error = new ErrorResponse { Error = "No active window found" };
                    return MarshalStringToPtr(JsonSerializer.Serialize(error));
                }

                if (!GetWindowRect(hWnd, out RECT rect))
                {
                    var error = new ErrorResponse { Error = "Failed to get window bounds" };
                    return MarshalStringToPtr(JsonSerializer.Serialize(error));
                }

                GetWindowThreadProcessId(hWnd, out uint processId);
                var processName = GetProcessName(processId);

                var bounds = new WindowBounds
                {
                    X = rect.Left,
                    Y = rect.Top,
                    Width = rect.Right - rect.Left,
                    Height = rect.Bottom - rect.Top,
                    AppName = processName,
                    BundleId = null
                };

                return MarshalStringToPtr(JsonSerializer.Serialize(bounds));
            }
            catch (Exception ex)
            {
                var error = new ErrorResponse { Error = ex.Message };
                return MarshalStringToPtr(JsonSerializer.Serialize(error));
            }
        }

        [UnmanagedCallersOnly(EntryPoint = "SendKeyboardInput", CallConvs = new[] { typeof(CallConvStdcall) })]
        public static IntPtr SendKeyboardInput()
        {
            try
            {
                bool success = SendCtrlV();
                if (success)
                {
                    var response = new SuccessResponse 
                    { 
                        Success = true, 
                        Message = "Ctrl+V sent successfully" 
                    };
                    return MarshalStringToPtr(JsonSerializer.Serialize(response));
                }
                else
                {
                    var error = new ErrorResponse { Error = "Failed to send Ctrl+V" };
                    return MarshalStringToPtr(JsonSerializer.Serialize(error));
                }
            }
            catch (Exception ex)
            {
                var error = new ErrorResponse { Error = ex.Message };
                return MarshalStringToPtr(JsonSerializer.Serialize(error));
            }
        }

        [UnmanagedCallersOnly(EntryPoint = "ActivateApp", CallConvs = new[] { typeof(CallConvStdcall) })]
        public static IntPtr ActivateApp(IntPtr processNamePtr)
        {
            try
            {
                string processName = Marshal.PtrToStringAnsi(processNamePtr) ?? "";
                if (string.IsNullOrEmpty(processName))
                {
                    var error = new ErrorResponse { Error = "Process name cannot be empty" };
                    return MarshalStringToPtr(JsonSerializer.Serialize(error));
                }

                IntPtr hWnd = FindWindowByProcessName(processName);
                if (hWnd == IntPtr.Zero)
                {
                    var error = new ErrorResponse { Error = $"No window found for process: {processName}" };
                    return MarshalStringToPtr(JsonSerializer.Serialize(error));
                }

                bool success = ActivateWindow(hWnd);
                if (success)
                {
                    var response = new SuccessResponse 
                    { 
                        Success = true, 
                        Message = $"Application {processName} activated successfully" 
                    };
                    return MarshalStringToPtr(JsonSerializer.Serialize(response));
                }
                else
                {
                    var error = new ErrorResponse { Error = $"Failed to activate application: {processName}" };
                    return MarshalStringToPtr(JsonSerializer.Serialize(error));
                }
            }
            catch (Exception ex)
            {
                var error = new ErrorResponse { Error = ex.Message };
                return MarshalStringToPtr(JsonSerializer.Serialize(error));
            }
        }

        [UnmanagedCallersOnly(EntryPoint = "ActivateAppAndPaste", CallConvs = new[] { typeof(CallConvStdcall) })]
        public static IntPtr ActivateAppAndPaste(IntPtr processNamePtr)
        {
            try
            {
                string processName = Marshal.PtrToStringAnsi(processNamePtr) ?? "";
                if (string.IsNullOrEmpty(processName))
                {
                    var error = new ErrorResponse { Error = "Process name cannot be empty" };
                    return MarshalStringToPtr(JsonSerializer.Serialize(error));
                }

                IntPtr hWnd = FindWindowByProcessName(processName);
                if (hWnd == IntPtr.Zero)
                {
                    var error = new ErrorResponse { Error = $"No window found for process: {processName}" };
                    return MarshalStringToPtr(JsonSerializer.Serialize(error));
                }

                bool activated = ActivateWindow(hWnd);
                if (!activated)
                {
                    var error = new ErrorResponse { Error = $"Failed to activate application: {processName}" };
                    return MarshalStringToPtr(JsonSerializer.Serialize(error));
                }

                // Small delay to ensure window is fully activated
                System.Threading.Thread.Sleep(100);

                bool pasteSent = SendCtrlV();
                if (pasteSent)
                {
                    var response = new SuccessResponse 
                    { 
                        Success = true, 
                        Message = $"Application {processName} activated and Ctrl+V sent successfully" 
                    };
                    return MarshalStringToPtr(JsonSerializer.Serialize(response));
                }
                else
                {
                    var error = new ErrorResponse { Error = "Application activated but failed to send Ctrl+V" };
                    return MarshalStringToPtr(JsonSerializer.Serialize(error));
                }
            }
            catch (Exception ex)
            {
                var error = new ErrorResponse { Error = ex.Message };
                return MarshalStringToPtr(JsonSerializer.Serialize(error));
            }
        }

        [UnmanagedCallersOnly(EntryPoint = "GetActiveTextFieldBounds", CallConvs = new[] { typeof(CallConvStdcall) })]
        public static IntPtr GetActiveTextFieldBounds()
        {
            try
            {
                var focusedElement = GetFocusedTextFieldElement();
                if (focusedElement == null)
                {
                    var error = new ErrorResponse { Error = "No focused text field found" };
                    return MarshalStringToPtr(JsonSerializer.Serialize(error));
                }

                var bounds = GetTextFieldBounds(focusedElement);
                if (bounds == null)
                {
                    var error = new ErrorResponse { Error = "Failed to get text field bounds" };
                    return MarshalStringToPtr(JsonSerializer.Serialize(error));
                }

                return MarshalStringToPtr(JsonSerializer.Serialize(bounds));
            }
            catch (Exception ex)
            {
                var error = new ErrorResponse { Error = ex.Message };
                return MarshalStringToPtr(JsonSerializer.Serialize(error));
            }
        }

        [UnmanagedCallersOnly(EntryPoint = "FreeString", CallConvs = new[] { typeof(CallConvStdcall) })]
        public static void FreeString(IntPtr ptr)
        {
            if (ptr != IntPtr.Zero)
            {
                Marshal.FreeHGlobal(ptr);
            }
        }

        #endregion
    }
}