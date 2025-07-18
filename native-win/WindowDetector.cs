using System;
using System.Runtime.InteropServices;
using System.Text.Json;
using System.Diagnostics;
using System.Text;
using System.Runtime.CompilerServices;

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

        [StructLayout(LayoutKind.Sequential)]
        private struct RECT
        {
            public int Left;
            public int Top;
            public int Right;
            public int Bottom;
        }

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