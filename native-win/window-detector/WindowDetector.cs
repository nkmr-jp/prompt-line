using System;
using System.Runtime.InteropServices;
using System.Text.Json;
using System.Diagnostics;
using System.Text;

namespace WindowDetector
{
    class Program
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

        #endregion

        #region Command Handlers

        private static void GetCurrentApp()
        {
            try
            {
                var hWnd = GetForegroundWindow();
                if (hWnd == IntPtr.Zero)
                {
                    Console.WriteLine(JsonSerializer.Serialize(new { error = "No active application found" }));
                    return;
                }

                GetWindowThreadProcessId(hWnd, out uint processId);
                var processName = GetProcessName(processId);

                var result = new
                {
                    name = processName,
                    bundleId = (string?)null // Windows doesn't have bundle IDs
                };

                Console.WriteLine(JsonSerializer.Serialize(result));
            }
            catch (Exception ex)
            {
                Console.WriteLine(JsonSerializer.Serialize(new { error = ex.Message }));
            }
        }

        private static void GetActiveWindowBounds()
        {
            try
            {
                var hWnd = GetForegroundWindow();
                if (hWnd == IntPtr.Zero)
                {
                    Console.WriteLine(JsonSerializer.Serialize(new { error = "No active window found" }));
                    return;
                }

                if (!GetWindowRect(hWnd, out RECT rect))
                {
                    Console.WriteLine(JsonSerializer.Serialize(new { error = "Failed to get window bounds" }));
                    return;
                }

                GetWindowThreadProcessId(hWnd, out uint processId);
                var processName = GetProcessName(processId);

                var result = new
                {
                    x = rect.Left,
                    y = rect.Top,
                    width = rect.Right - rect.Left,
                    height = rect.Bottom - rect.Top,
                    appName = processName,
                    bundleId = (string?)null
                };

                Console.WriteLine(JsonSerializer.Serialize(result));
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
                Console.WriteLine(JsonSerializer.Serialize(new { error = "No command specified" }));
                Environment.Exit(1);
            }

            switch (args[0])
            {
                case "current-app":
                    GetCurrentApp();
                    break;
                case "window-bounds":
                    GetActiveWindowBounds();
                    break;
                default:
                    Console.WriteLine(JsonSerializer.Serialize(new { error = $"Unknown command: {args[0]}" }));
                    Environment.Exit(1);
                    break;
            }
        }
    }
}