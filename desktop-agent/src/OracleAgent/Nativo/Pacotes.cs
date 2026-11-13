using System.Diagnostics;
using System.Runtime.InteropServices;

namespace OracleAgent.Nativo;

/// <summary>
/// Apps da Microsoft Store (MSIX): abertos pela API oficial de ativação do
/// Windows (IApplicationActivationManager), pelo AppUserModelID — sem shell,
/// sem argumentos. Devolve o PID para a verificação do resultado real.
/// </summary>
internal static class Pacotes
{
    [ComImport, Guid("2e941141-7f97-4756-ba1d-9decde894a3d"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface IApplicationActivationManager
    {
        [PreserveSig]
        int ActivateApplication([MarshalAs(UnmanagedType.LPWStr)] string appUserModelId,
            [MarshalAs(UnmanagedType.LPWStr)] string? arguments, int options, out uint processId);
        [PreserveSig] int ActivateForFile(IntPtr a, IntPtr b, IntPtr c, out uint d);
        [PreserveSig] int ActivateForProtocol(IntPtr a, IntPtr b, out uint c);
    }

    [ComImport, Guid("45BA127D-10A8-46EA-8AB7-56EA9078943C")]
    private class ApplicationActivationManager;

    /// <summary>PID do app ativado, ou null se o Windows recusou.</summary>
    public static int? Ativar(string aumid)
    {
        object? obj = null;
        try
        {
            obj = new ApplicationActivationManager();
            var hr = ((IApplicationActivationManager)obj).ActivateApplication(aumid, null, 0, out var pid);
            return hr == 0 && pid != 0 ? (int)pid : null;
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

    /// <summary>
    /// Processos de um pacote: executável dentro de
    /// WindowsApps\{Nome}_{versão}_{arquitetura}__{idDoPublicador}\.
    /// </summary>
    public static List<Process> Processos(string aumid)
    {
        var familia = aumid.Split('!')[0];
        var corte = familia.LastIndexOf('_');
        var lista = new List<Process>();
        if (corte <= 0) return lista;
        var nome = familia[..corte];
        var publicador = familia[(corte + 1)..];
        foreach (var pr in Process.GetProcesses())
        {
            try
            {
                var caminho = pr.MainModule?.FileName ?? "";
                var i = caminho.IndexOf(@"\WindowsApps\", StringComparison.OrdinalIgnoreCase);
                if (i < 0) { pr.Dispose(); continue; }
                var pasta = caminho[(i + 13)..].Split('\\')[0];
                if (pasta.StartsWith(nome + "_", StringComparison.OrdinalIgnoreCase) &&
                    pasta.EndsWith("__" + publicador, StringComparison.OrdinalIgnoreCase)) lista.Add(pr);
                else pr.Dispose();
            }
            catch
            {
                pr.Dispose();
            }
        }
        return lista;
    }
}
