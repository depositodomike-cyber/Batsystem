using System.Runtime.InteropServices;
using System.Text;

namespace OracleAgent.Nativo;

/// <summary>P/Invoke mínimo para janelas, entrada de mídia, sessão e energia.</summary>
internal static partial class Win32
{
    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    [LibraryImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static partial bool EnumWindows(EnumWindowsProc cb, IntPtr lParam);

    [LibraryImport("user32.dll", EntryPoint = "GetWindowTextW", StringMarshalling = StringMarshalling.Utf16)]
    private static partial int GetWindowText(IntPtr hWnd, [Out] char[] buf, int max);

    [LibraryImport("user32.dll")]
    private static partial int GetWindowTextLengthW(IntPtr hWnd);

    [LibraryImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static partial bool IsWindowVisible(IntPtr hWnd);

    [LibraryImport("user32.dll")]
    public static partial uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid);

    [LibraryImport("user32.dll")]
    public static partial IntPtr GetWindow(IntPtr hWnd, uint cmd);

    [LibraryImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static partial bool ShowWindow(IntPtr hWnd, int cmd);

    [LibraryImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static partial bool SetWindowPos(IntPtr hWnd, IntPtr after, int x, int y, int cx, int cy, uint flags);

    [StructLayout(LayoutKind.Sequential)]
    public struct RECT { public int Left, Top, Right, Bottom; }

    [LibraryImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static partial bool GetWindowRect(IntPtr hWnd, out RECT r);

    [LibraryImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static partial bool IsZoomed(IntPtr hWnd);

    [LibraryImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static partial bool IsIconic(IntPtr hWnd);

    [LibraryImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static partial bool SetForegroundWindow(IntPtr hWnd);

    [LibraryImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static partial bool LockWorkStation();

    [LibraryImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static partial bool ExitWindowsEx(uint flags, uint reason);

    [LibraryImport("advapi32.dll", EntryPoint = "InitiateSystemShutdownExW", StringMarshalling = StringMarshalling.Utf16, SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static partial bool InitiateSystemShutdownEx(string? machine, string message, uint timeout,
        [MarshalAs(UnmanagedType.Bool)] bool force, [MarshalAs(UnmanagedType.Bool)] bool reboot, uint reason);

    [LibraryImport("advapi32.dll", EntryPoint = "AbortSystemShutdownW", StringMarshalling = StringMarshalling.Utf16, SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static partial bool AbortSystemShutdown(string? machine);

    public const int SW_MAXIMIZE = 3, SW_MINIMIZE = 6, SW_RESTORE = 9, SW_SHOWMINNOACTIVE = 7;
    public const uint GW_OWNER = 4, SWP_NOZORDER = 0x0004, SWP_SHOWWINDOW = 0x0040;
    public const uint EWX_LOGOFF = 0x0;

    public static string Titulo(IntPtr h)
    {
        var n = GetWindowTextLengthW(h);
        if (n <= 0) return "";
        var buf = new char[n + 1];
        var lidos = GetWindowText(h, buf, buf.Length);
        return new string(buf, 0, Math.Max(0, lidos));
    }

    /// <summary>Janelas de topo visíveis, com título, sem dono.</summary>
    public static List<(IntPtr Handle, uint Pid, string Titulo)> JanelasVisiveis()
    {
        var lista = new List<(IntPtr, uint, string)>();
        EnumWindows((h, _) =>
        {
            if (!IsWindowVisible(h) || GetWindow(h, GW_OWNER) != IntPtr.Zero) return true;
            var t = Titulo(h);
            if (t.Length == 0) return true;
            GetWindowThreadProcessId(h, out var pid);
            lista.Add((h, pid, t));
            return true;
        }, IntPtr.Zero);
        return lista;
    }

    // ------------------------------------------------------------ teclas de mídia

    [StructLayout(LayoutKind.Sequential)]
    private struct INPUT { public uint type; public INPUTUNION u; }

    [StructLayout(LayoutKind.Explicit)]
    private struct INPUTUNION { [FieldOffset(0)] public KEYBDINPUT ki; [FieldOffset(0)] public MOUSEINPUT mi; }

    [StructLayout(LayoutKind.Sequential)]
    private struct KEYBDINPUT { public ushort wVk; public ushort wScan; public uint dwFlags; public uint time; public IntPtr dwExtraInfo; }

    [StructLayout(LayoutKind.Sequential)]
    private struct MOUSEINPUT { public int dx, dy; public uint mouseData, dwFlags, time; public IntPtr dwExtraInfo; }

    [LibraryImport("user32.dll", SetLastError = true)]
    private static partial uint SendInput(uint n, [In] INPUT[] inputs, int size);

    public const ushort VK_VOLUME_MUTE = 0xAD, VK_VOLUME_DOWN = 0xAE, VK_VOLUME_UP = 0xAF;

    /// <summary>Uma tecla virtual de mídia/volume (só estas: não há digitação arbitrária).</summary>
    public static bool TeclaMidia(ushort vk)
    {
        if (vk is not (VK_VOLUME_MUTE or VK_VOLUME_DOWN or VK_VOLUME_UP)) return false;
        var ins = new INPUT[]
        {
            new() { type = 1, u = new INPUTUNION { ki = new KEYBDINPUT { wVk = vk } } },
            new() { type = 1, u = new INPUTUNION { ki = new KEYBDINPUT { wVk = vk, dwFlags = 2 } } },
        };
        return SendInput(2, ins, Marshal.SizeOf<INPUT>()) == 2;
    }

    // ------------------------------------------------------------ privilégio de desligar

    [LibraryImport("advapi32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static partial bool OpenProcessToken(IntPtr process, uint access, out IntPtr token);

    [LibraryImport("advapi32.dll", EntryPoint = "LookupPrivilegeValueW", StringMarshalling = StringMarshalling.Utf16, SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static partial bool LookupPrivilegeValue(string? system, string name, out long luid);

    [StructLayout(LayoutKind.Sequential, Pack = 4)]
    private struct TOKEN_PRIVILEGES { public uint Count; public long Luid; public uint Attr; }

    [LibraryImport("advapi32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static partial bool AdjustTokenPrivileges(IntPtr token, [MarshalAs(UnmanagedType.Bool)] bool disableAll,
        ref TOKEN_PRIVILEGES n, uint len, IntPtr prev, IntPtr retLen);

    [LibraryImport("kernel32.dll")]
    private static partial IntPtr GetCurrentProcess();

    [LibraryImport("kernel32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static partial bool CloseHandle(IntPtr h);

    /// <summary>
    /// Habilita SeShutdownPrivilege no PRÓPRIO token (privilégio que o usuário
    /// já tem; não é elevação — SR-14).
    /// </summary>
    public static bool HabilitarDesligamento()
    {
        if (!OpenProcessToken(GetCurrentProcess(), 0x0020 | 0x0008, out var token)) return false;
        try
        {
            if (!LookupPrivilegeValue(null, "SeShutdownPrivilege", out var luid)) return false;
            var tp = new TOKEN_PRIVILEGES { Count = 1, Luid = luid, Attr = 0x2 };
            return AdjustTokenPrivileges(token, false, ref tp, 0, IntPtr.Zero, IntPtr.Zero) && Marshal.GetLastWin32Error() == 0;
        }
        finally
        {
            CloseHandle(token);
        }
    }
}

/// <summary>Resolve o alvo de um atalho .lnk via IShellLink (GA-09).</summary>
internal static class Atalhos
{
    [ComImport, Guid("00021401-0000-0000-C000-000000000046")]
    private class ShellLink;

    [ComImport, InterfaceType(ComInterfaceType.InterfaceIsIUnknown), Guid("000214F9-0000-0000-C000-000000000046")]
    private interface IShellLinkW
    {
        void GetPath([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder file, int cch, IntPtr fd, uint flags);
        void GetIDList(out IntPtr ppidl);
        void SetIDList(IntPtr pidl);
        void GetDescription([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder name, int cch);
        void SetDescription([MarshalAs(UnmanagedType.LPWStr)] string name);
        void GetWorkingDirectory([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder dir, int cch);
        void SetWorkingDirectory([MarshalAs(UnmanagedType.LPWStr)] string dir);
        void GetArguments([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder args, int cch);
        void SetArguments([MarshalAs(UnmanagedType.LPWStr)] string args);
        void GetHotkey(out short hotkey);
        void SetHotkey(short hotkey);
        void GetShowCmd(out int cmd);
        void SetShowCmd(int cmd);
        void GetIconLocation([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder path, int cch, out int icon);
        void SetIconLocation([MarshalAs(UnmanagedType.LPWStr)] string path, int icon);
        void SetRelativePath([MarshalAs(UnmanagedType.LPWStr)] string path, uint reserved);
        void Resolve(IntPtr hwnd, uint flags);
        void SetPath([MarshalAs(UnmanagedType.LPWStr)] string file);
    }

    [ComImport, InterfaceType(ComInterfaceType.InterfaceIsIUnknown), Guid("0000010b-0000-0000-C000-000000000046")]
    private interface IPersistFile
    {
        void GetClassID(out Guid id);
        [PreserveSig] int IsDirty();
        void Load([MarshalAs(UnmanagedType.LPWStr)] string file, uint mode);
        void Save([MarshalAs(UnmanagedType.LPWStr)] string file, [MarshalAs(UnmanagedType.Bool)] bool remember);
        void SaveCompleted([MarshalAs(UnmanagedType.LPWStr)] string file);
        void GetCurFile([MarshalAs(UnmanagedType.LPWStr)] out string file);
    }

    /// <summary>(alvo, argumentos) ou null se não der para ler.</summary>
    public static (string Alvo, string Argumentos)? Ler(string lnk)
    {
        object? obj = null;
        try
        {
            obj = new ShellLink();
            ((IPersistFile)obj).Load(lnk, 0);
            var link = (IShellLinkW)obj;
            var alvo = new StringBuilder(1024);
            link.GetPath(alvo, alvo.Capacity, IntPtr.Zero, 0x4 /* SLGP_RAWPATH */);
            var args = new StringBuilder(2048);
            link.GetArguments(args, args.Capacity);
            var caminho = Environment.ExpandEnvironmentVariables(alvo.ToString());
            return (caminho, args.ToString());
        }
        catch
        {
            return null;
        }
        finally
        {
            if (obj is not null) Marshal.FinalReleaseComObject(obj);
        }
    }
}
