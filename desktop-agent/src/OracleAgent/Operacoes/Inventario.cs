using System.Security.Cryptography;
using System.Text;
using System.Text.Json.Serialization;
using OracleAgent.Nativo;
using OracleAgent.Seguranca;

namespace OracleAgent.Operacoes;

internal sealed record AppInventario(
    [property: JsonPropertyName("id")] string Id,
    [property: JsonPropertyName("nome")] string Nome,
    [property: JsonPropertyName("alvo")] string Alvo);

/// <summary>
/// Inventário de aplicativos (SR-11, SR-11a): atalhos do Menu Iniciar cujo
/// alvo é um .exe existente, SEM argumentos e fora da lista de bloqueio. O
/// servidor só conhece o id (hash do alvo); o caminho para executar sai daqui.
/// </summary>
internal static class Inventario
{
    public static string IdDe(string alvo) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(alvo.ToLowerInvariant()))).ToLowerInvariant()[..32];

    public static List<AppInventario> Montar()
    {
        var pastas = new[]
        {
            Environment.GetFolderPath(Environment.SpecialFolder.CommonPrograms),
            Environment.GetFolderPath(Environment.SpecialFolder.Programs),
        };
        var porId = new Dictionary<string, AppInventario>();
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
                });
            }
            catch
            {
                continue;
            }
            foreach (var lnk in lnks)
            {
                var item = Avaliar(lnk);
                if (item is not null) porId.TryAdd(item.Id, item);
                if (porId.Count >= 500) break;
            }
        }
        return porId.Values.OrderBy(a => a.Nome, StringComparer.CurrentCultureIgnoreCase).ToList();
    }

    internal static AppInventario? Avaliar(string lnk)
    {
        var lido = Atalhos.Ler(lnk);
        if (lido is null) return null;
        var (alvo, args) = lido.Value;
        if (!string.IsNullOrWhiteSpace(args)) return null; // GA-09
        if (!AlvoAceitavel(alvo)) return null;
        var nome = Path.GetFileNameWithoutExtension(lnk);
        if (nome.Length is 0 or > 120) return null;
        if (nome.Contains("uninstall", StringComparison.OrdinalIgnoreCase) || nome.Contains("desinstalar", StringComparison.OrdinalIgnoreCase)) return null;
        return new AppInventario(IdDe(alvo), nome, alvo);
    }

    internal static bool AlvoAceitavel(string alvo)
    {
        if (string.IsNullOrWhiteSpace(alvo) || alvo.StartsWith(@"\\", StringComparison.Ordinal)) return false;
        if (!alvo.EndsWith(".exe", StringComparison.OrdinalIgnoreCase)) return false;
        if (ListasFixas.ExecutavelBloqueado(alvo)) return false;
        return File.Exists(alvo);
    }
}
