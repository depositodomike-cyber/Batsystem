using System.Runtime.InteropServices;
using Microsoft.Win32.SafeHandles;

namespace OracleAgent.Nativo;

/// <summary>Caminho final (resolvido pelo sistema) de um arquivo ou pasta, por handle (GB-06).</summary>
internal static partial class Arquivos
{
    [LibraryImport("kernel32.dll", EntryPoint = "CreateFileW", StringMarshalling = StringMarshalling.Utf16, SetLastError = true)]
    private static partial SafeFileHandle CreateFile(string name, uint access, uint share, IntPtr sec, uint disposition, uint flags, IntPtr template);

    [LibraryImport("kernel32.dll", EntryPoint = "GetFinalPathNameByHandleW", SetLastError = true)]
    private static unsafe partial uint GetFinalPathNameByHandle(SafeFileHandle h, char* buf, uint len, uint flags);

    private const uint FILE_READ_ATTRIBUTES = 0x80;
    private const uint SHARE_ALL = 0x1 | 0x2 | 0x4;
    private const uint OPEN_EXISTING = 3;
    private const uint FILE_FLAG_BACKUP_SEMANTICS = 0x02000000; // permite abrir pastas

    /// <summary>Ex.: C:\Users\u\Documents\a.pdf (sem o prefixo \\?\), ou null.</summary>
    public static string? CaminhoFinal(string caminho)
    {
        using var h = CreateFile(caminho, FILE_READ_ATTRIBUTES, SHARE_ALL, IntPtr.Zero, OPEN_EXISTING, FILE_FLAG_BACKUP_SEMANTICS, IntPtr.Zero);
        if (h.IsInvalid) return null;
        var buf = new char[1024];
        uint n;
        unsafe
        {
            fixed (char* p = buf) n = GetFinalPathNameByHandle(h, p, (uint)buf.Length, 0);
        }
        if (n == 0 || n >= buf.Length) return null;
        var s = new string(buf, 0, (int)n);
        if (s.StartsWith(@"\\?\UNC\", StringComparison.Ordinal)) return null; // rede: recusa
        return s.StartsWith(@"\\?\", StringComparison.Ordinal) ? s[4..] : s;
    }
}
