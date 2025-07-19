using System;
using System.Runtime.InteropServices;
using System.Text.Json;
using System.Diagnostics;

namespace KeyboardSimulator
{
    class Program
    {
        #region Win32 API Declarations
        
        [DllImport("user32.dll")]
        private static extern IntPtr GetForegroundWindow();

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

        #region Helper Methods

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

            uint result = SendInput(4, inputs, Marshal.SizeOf<INPUT>());
            return result == 4;
        }

        #endregion

        #region Command Handlers

        private static void Paste()
        {
            try
            {
                bool success = SendCtrlV();
                var result = new
                {
                    success = success,
                    command = "paste",
                    hasAccessibility = true // Windows doesn't require explicit accessibility permissions
                };
                Console.WriteLine(JsonSerializer.Serialize(result));
            }
            catch (Exception ex)
            {
                var result = new
                {
                    success = false,
                    command = "paste",
                    hasAccessibility = true,
                    error = ex.Message
                };
                Console.WriteLine(JsonSerializer.Serialize(result));
            }
        }

        private static void ActivateByName(string appName)
        {
            try
            {
                IntPtr hWnd = FindWindowByProcessName(appName);
                if (hWnd == IntPtr.Zero)
                {
                    var result = new
                    {
                        success = false,
                        command = "activate-name",
                        error = $"No window found for process: {appName}"
                    };
                    Console.WriteLine(JsonSerializer.Serialize(result));
                    return;
                }

                bool success = ActivateWindow(hWnd);
                var successResult = new
                {
                    success = success,
                    command = "activate-name",
                    appName = appName
                };
                Console.WriteLine(JsonSerializer.Serialize(successResult));
            }
            catch (Exception ex)
            {
                var result = new
                {
                    success = false,
                    command = "activate-name",
                    error = ex.Message
                };
                Console.WriteLine(JsonSerializer.Serialize(result));
            }
        }

        private static void ActivateAndPasteByName(string appName)
        {
            try
            {
                IntPtr hWnd = FindWindowByProcessName(appName);
                if (hWnd == IntPtr.Zero)
                {
                    var result = new
                    {
                        success = false,
                        command = "activate-and-paste-name",
                        error = $"No window found for process: {appName}"
                    };
                    Console.WriteLine(JsonSerializer.Serialize(result));
                    return;
                }

                bool activated = ActivateWindow(hWnd);
                if (!activated)
                {
                    var result = new
                    {
                        success = false,
                        command = "activate-and-paste-name",
                        error = $"Failed to activate application: {appName}"
                    };
                    Console.WriteLine(JsonSerializer.Serialize(result));
                    return;
                }

                // Small delay to ensure window is fully activated
                System.Threading.Thread.Sleep(100);

                bool pasteSent = SendCtrlV();
                var successResult = new
                {
                    success = pasteSent,
                    command = "activate-and-paste-name",
                    appName = appName,
                    hasAccessibility = true
                };
                Console.WriteLine(JsonSerializer.Serialize(successResult));
            }
            catch (Exception ex)
            {
                var result = new
                {
                    success = false,
                    command = "activate-and-paste-name",
                    error = ex.Message
                };
                Console.WriteLine(JsonSerializer.Serialize(result));
            }
        }

        #endregion

        static void Main(string[] args)
        {
            if (args.Length == 0)
            {
                Console.WriteLine(JsonSerializer.Serialize(new { error = "No command specified" }));
                Environment.Exit(1);
            }

            switch (args[0])
            {
                case "paste":
                    Paste();
                    break;
                case "activate-name":
                    if (args.Length < 2)
                    {
                        Console.WriteLine(JsonSerializer.Serialize(new { error = "App name required" }));
                        Environment.Exit(1);
                    }
                    ActivateByName(args[1]);
                    break;
                case "activate-and-paste-name":
                    if (args.Length < 2)
                    {
                        Console.WriteLine(JsonSerializer.Serialize(new { error = "App name required" }));
                        Environment.Exit(1);
                    }
                    ActivateAndPasteByName(args[1]);
                    break;
                default:
                    Console.WriteLine(JsonSerializer.Serialize(new { error = $"Unknown command: {args[0]}" }));
                    Environment.Exit(1);
                    break;
            }
        }
    }
}