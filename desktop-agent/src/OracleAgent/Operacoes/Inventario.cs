using System.Security.Cryptography;
using System.Text;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;
using OracleAgent.Nativo;
using OracleAgent.Seguranca;

namespace OracleAgent.Operacoes;

internal sealed record AppInventario(
    [property: JsonPropertyName("id")] string Id,
    [property: JsonPropertyName("nome")] string Nome,
    [property: JsonPropertyName("alvo")] string Alvo);

/// <summary>
/// Inventário de aplicativos (SR-11, SR-11a). Duas fontes:
/// 1. Atalhos .lnk do Menu Iniciar cujo alvo é um .exe existente e fora da
///    lista de bloqueio. ARGUMENTOS DO ATALHO SÃO IGNORADOS: o executável é
///    sempre iniciado sem argumentos (o Chrome, por exemplo, põe
///    "--source-shortcut-location"); por isso um atalho com argumentos não
///    leva a nada além de abrir o programa — e shells/LOLBins seguem fora.
/// 2. Apps da Microsoft Store (pacotes MSIX, ex.: Claude, Spotify,
///    WhatsApp), identificados pelo AppUserModelID e abertos pela API oficial
///    de ativação do Windows — sem shell.
/// O servidor só conhece o id (hash do alvo); o que executar sai daqui.
/// </summary>
internal static partial class Inventario
{
    /// <summary>Prefixo do alvo de um app da Store.</summary>
    public const string PrefixoPacote = @"shell:AppsFolder\";

    public static string IdDe(string alvo) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(alvo.ToLowerInvariant()))).ToLowerInvariant()[..32];

    public static bool EhPacote(string alvo) => alvo.StartsWith(PrefixoPacote, StringComparison.OrdinalIgnoreCase);

    public static string Aumid(string alvo) => alvo[PrefixoPacote.Length..];

    [GeneratedRegex(@"^[A-Za-z0-9.\-]+_[a-z0-9]{13}![A-Za-z0-9.\-_]+$")]
    private static partial Regex AumidValido();

    /// <summary>Pacotes que dão acesso a shell/sistema: nunca entram (SR-12).</summary>
    private static readonly string[] PacotesBloqueados =
    [
        "Microsoft.WindowsTerminal", "Microsoft.PowerShell", "windows.immersivecontrolpanel", "Microsoft.Windows.",
        "MicrosoftWindows.", "Microsoft.WindowsStore", "Microsoft.DesktopAppInstaller", "Microsoft.SecHealthUI",
        "Microsoft.VisualStudioCode", "CanonicalGroupLimited", "TheDebianProject", "Microsoft.WindowsSubsystemFor",
    ];

    public static List<AppInventario> Montar()
    {
        var porId = new Dictionary<string, AppInventario>();
        foreach (var item in DeAtalhos().Concat(DePacotes()))
        {
            porId.TryAdd(item.Id, item);
            if (porId.Count >= 500) break;
        }
        return porId.Values.OrderBy(a => a.Nome, StringComparer.CurrentCultureIgnoreCase).ToList();
    }

    private static IEnumerable<AppInventario> DeAtalhos()
    {
        var pastas = new[]
        {
            Environment.GetFolderPath(Environment.SpecialFolder.CommonPrograms),
            Environment.GetFolderPath(Environment.SpecialFolder.Programs),
        };
        foreach (var pasta in pastas.Where(Directory.Exists))
        {
            IEnumerable<string> lnks;
            try
            {
                lnks = Directory.EnumerateFiles(pasta, "*.lnk", new EnumerationOptions
                {
                    RecurseSubdirectories = true,
                    MaxRecursionDepth = 3,
                    IgnoreInaccessible = true,
                    AttributesToSkip = FileAttributes.ReparsePoint,
                }).ToList();
            }
            catch
            {
                continue;
            }
            foreach (var lnk in lnks)
            {
                var item = Avaliar(lnk);
                if (item is not null) yield return item;
            }
        }
    }

    /// <summary>Apps da Store pela pasta virtual "AppsFolder" (o que o Menu Iniciar mostra).</summary>
    private static IEnumerable<AppInventario> DePacotes()
    {
        var lista = new List<AppInventario>();
        try
        {
            var tipo = Type.GetTypeFromProgID("Shell.Application");
            if (tipo is null) return lista;
            dynamic shell = Activator.CreateInstance(tipo)!;
            dynamic? pasta = shell.NameSpace("shell:AppsFolder");
            if (pasta is null) return lista;
            foreach (dynamic it in pasta.Items())
            {
                string nome = it.Name;
                string aumid = it.Path;
                var app = AvaliarPacote(nome, aumid);
                if (app is not null) lista.Add(app);
            }
        }
        catch
        {
            // Sem Shell (ex.: sessão sem desktop): só os atalhos.
        }
        return lista;
    }

    internal static AppInventario? AvaliarPacote(string nome, string aumid)
    {
        if (string.IsNullOrWhiteSpace(nome) || nome.Length > 120 || !AumidValido().IsMatch(aumid ?? "")) return null;
        if (PacotesBloqueados.Any(p => aumid!.StartsWith(p, StringComparison.OrdinalIgnoreCase))) return null;
        var alvo = PrefixoPacote + aumid;
        return new AppInventario(IdDe(alvo), nome.Trim(), alvo);
    }

    internal static AppInventario? Avaliar(string lnk)
    {
        var lido = Atalhos.Ler(lnk);
        if (lido is null) return null;
        var (alvo, _) = lido.Value; // argumentos ignorados (ver cabeçalho)
        if (!AlvoAceitavel(alvo)) return null;
        var nome = Path.GetFileNameWithoutExtension(lnk);
        if (nome.Length is 0 or > 120) return null;
        if (nome.Contains("uninstall", StringComparison.OrdinalIgnoreCase) || nome.Contains("desinstalar", StringComparison.OrdinalIgnoreCase)) return null;
        return new AppInventario(IdDe(alvo), nome, alvo);
    }

    internal static bool AlvoAceitavel(string alvo)
    {
        if (EhPacote(alvo)) return AvaliarPacote("x", Aumid(alvo)) is not null;
        if (string.IsNullOrWhiteSpace(alvo) || alvo.StartsWith(@"\\", StringComparison.Ordinal)) return false;
        if (!alvo.EndsWith(".exe", StringComparison.OrdinalIgnoreCase)) return false;
        if (ListasFixas.ExecutavelBloqueado(alvo)) return false;
        return File.Exists(alvo);
    }
}
