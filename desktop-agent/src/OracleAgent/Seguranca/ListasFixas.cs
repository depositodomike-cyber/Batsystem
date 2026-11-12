namespace OracleAgent.Seguranca;

/// <summary>
/// Listas embutidas no binário (SR-12, SR-12a). O servidor NÃO consegue
/// afrouxá-las: são a segunda barreira, independente da política remota.
/// </summary>
internal static class ListasFixas
{
    /// <summary>Executáveis que nunca entram no inventário nem são abertos (LOLBins e shells).</summary>
    public static readonly HashSet<string> ExecutaveisBloqueados = new(StringComparer.OrdinalIgnoreCase)
    {
        "cmd.exe", "powershell.exe", "pwsh.exe", "powershell_ise.exe", "wscript.exe", "cscript.exe",
        "mshta.exe", "rundll32.exe", "regsvr32.exe", "reg.exe", "regedit.exe", "regedt32.exe",
        "bcdedit.exe", "vssadmin.exe", "wmic.exe", "schtasks.exe", "at.exe", "sc.exe", "net.exe",
        "net1.exe", "netsh.exe", "certutil.exe", "bitsadmin.exe", "msiexec.exe", "installutil.exe",
        "msbuild.exe", "cmstp.exe", "forfiles.exe", "pcalua.exe", "wsl.exe", "bash.exe", "wt.exe",
        "conhost.exe", "taskkill.exe", "takeown.exe", "icacls.exe", "cacls.exe", "attrib.exe",
        "diskpart.exe", "format.com", "mmc.exe", "control.exe", "explorer.exe", "hh.exe",
        "msdt.exe", "odbcconf.exe", "regasm.exe", "regsvcs.exe", "runas.exe", "shutdown.exe",
        "csc.exe", "vbc.exe", "jsc.exe", "dotnet.exe", "python.exe", "pythonw.exe", "node.exe",
        "java.exe", "javaw.exe", "msxsl.exe", "syncappvpublishingserver.exe", "winrm.cmd",
        "oracle-agent.exe",
    };

    /// <summary>Processos que nunca são fechados (SR-12).</summary>
    public static readonly HashSet<string> ProcessosProtegidos = new(StringComparer.OrdinalIgnoreCase)
    {
        "csrss", "lsass", "winlogon", "services", "smss", "wininit", "svchost", "msmpeng",
        "explorer", "dwm", "system", "registry", "fontdrvhost", "securityhealthservice",
        "securityhealthsystray", "nissrv", "mssense", "oracle-agent", "taskmgr", "sihost",
        "ctfmon", "runtimebroker", "searchhost", "startmenuexperiencehost", "lsaiso",
    };

    /// <summary>SR-12a: documentos que podem ser abertos (moderado).</summary>
    public static readonly HashSet<string> ExtensoesDocumento = new(StringComparer.OrdinalIgnoreCase)
    {
        ".pdf", ".txt", ".md", ".rtf", ".csv", ".docx", ".xlsx", ".pptx", ".odt", ".ods", ".odp",
        ".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".mp3", ".wav", ".m4a", ".mp4", ".mov",
        ".fig", ".psd", ".ai", ".zip",
    };

    /// <summary>GA-17: só abrem com aprovação (o servidor manda risco "alto").</summary>
    public static readonly HashSet<string> ExtensoesAlto = new(StringComparer.OrdinalIgnoreCase)
    {
        ".doc", ".xls", ".ppt", ".svg",
    };

    public static bool ExecutavelBloqueado(string caminho) =>
        ExecutaveisBloqueados.Contains(Path.GetFileName(caminho));
}
