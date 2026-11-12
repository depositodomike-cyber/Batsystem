using System.Text.RegularExpressions;

namespace OracleAgent.Seguranca;

/// <summary>
/// Validação de caminhos no próprio computador (SR-13). Repete a pré-checagem
/// textual do servidor e acrescenta o que só dá para ver aqui: reparse points
/// (symlink/junction) em qualquer componente existente do caminho.
/// </summary>
internal static partial class Caminhos
{
    [GeneratedRegex(@"^(con|prn|aux|nul|com[0-9¹²³]|lpt[0-9¹²³])(\..*)?$", RegexOptions.IgnoreCase)]
    private static partial Regex Reservado();

    /// <summary>Normaliza ou devolve null (recusa UNC, \\?\, ADS, `..`, reservados, relativo).</summary>
    public static string? Normalizar(string? bruto)
    {
        if (string.IsNullOrEmpty(bruto) || bruto.Length < 3 || bruto.Length > 400) return null;
        foreach (var ch in bruto)
        {
            if (ch < 0x20 || ch is '"' or '<' or '>' or '|' or '?' or '*') return null;
        }
        var p = bruto.Replace('/', '\\');
        if (!(char.IsAsciiLetter(p[0]) && p[1] == ':' && p[2] == '\\')) return null;
        if (p.IndexOf(':', 2) >= 0) return null;
        var partes = p[3..].Split('\\', StringSplitOptions.RemoveEmptyEntries);
        foreach (var parte in partes)
        {
            if (parte is "." or "..") return null;
            if (Reservado().IsMatch(parte)) return null;
            if (parte.EndsWith('.') || parte.EndsWith(' ')) return null;
        }
        var normal = char.ToUpperInvariant(p[0]) + ":\\" + string.Join('\\', partes);
        // GetFullPath não pode mudar nada além do que já normalizamos.
        var full = Path.GetFullPath(normal).TrimEnd('\\');
        return string.Equals(full, normal.TrimEnd('\\'), StringComparison.OrdinalIgnoreCase) ? full : null;
    }

    private static readonly string[] RaizesProibidas =
        ["windows", "program files", "program files (x86)", "programdata", "$recycle.bin", "system volume information", "recovery", "boot"];
    private static readonly HashSet<string> ComponentesProibidos = ["appdata", "startup", "start menu", "ntuser.dat", "desktop.ini"];

    /// <summary>
    /// GB-01: proibido em QUALQUER componente — não só no diretório autorizado.
    /// Autorizar a pasta do usuário não abre AppData, Startup, pastas ocultas
    /// (.ssh, .aws…) nem nomes curtos 8.3 (PROGRA~1), que podem apontar para
    /// qualquer lugar.
    /// </summary>
    public static bool CaminhoProibido(string caminho)
    {
        var n = Normalizar(caminho);
        if (n is null) return true;
        var l = n.ToLowerInvariant();
        if (l.Length <= 3) return true; // raiz
        var partes = l[3..].Split('\\');
        if (RaizesProibidas.Contains(partes[0])) return true;
        return partes.Any(x => x.Contains('~') || x.StartsWith('.') || x.StartsWith('$') || ComponentesProibidos.Contains(x));
    }

    public static bool DiretorioProibido(string dir) => CaminhoProibido(dir);

    /// <summary>Dentro de algum autorizado (prefixo com separador, sem diferenciar maiúsculas).</summary>
    public static bool DentroDe(string caminho, IEnumerable<string> autorizados)
    {
        var c = Normalizar(caminho);
        if (c is null || CaminhoProibido(c)) return false;
        foreach (var d in autorizados)
        {
            var n = Normalizar(d);
            if (n is null || DiretorioProibido(n)) continue;
            if (c.Equals(n, StringComparison.OrdinalIgnoreCase) ||
                c.StartsWith(n + "\\", StringComparison.OrdinalIgnoreCase)) return true;
        }
        return false;
    }

    /// <summary>
    /// Algum componente EXISTENTE do caminho é reparse point (symlink/junction),
    /// oculto ou de sistema (GB-01)?
    /// </summary>
    public static bool TemReparsePoint(string caminho)
    {
        var atual = caminho;
        while (!string.IsNullOrEmpty(atual) && atual.Length > 3)
        {
            try
            {
                if (File.Exists(atual) || Directory.Exists(atual))
                {
                    var attr = File.GetAttributes(atual);
                    if ((attr & (FileAttributes.ReparsePoint | FileAttributes.Hidden | FileAttributes.System)) != 0) return true;
                }
            }
            catch
            {
                return true; // na dúvida, recusa
            }
            atual = Path.GetDirectoryName(atual) ?? "";
        }
        return false;
    }

    /// <summary>Validação completa para uso: texto + autorizado + sem reparse point.</summary>
    public static string Exigir(string? caminho, IEnumerable<string> autorizados)
    {
        var n = Normalizar(caminho) ?? throw new OperacaoRecusada("Caminho inválido.");
        if (!DentroDe(n, autorizados)) throw new OperacaoRecusada("Caminho fora dos diretórios autorizados neste computador.");
        if (TemReparsePoint(n)) throw new OperacaoRecusada("Caminho passa por um atalho de sistema (symlink/junction) ou item oculto/de sistema.");
        return n;
    }

    /// <summary>
    /// GB-06: confere o caminho REAL de um item existente, aberto por handle,
    /// imediatamente antes de agir. Fecha a janela entre a validação textual e
    /// o uso (um junction criado no meio é detectado aqui).
    /// </summary>
    public static void ConferirFinal(string existente, IEnumerable<string> autorizados)
    {
        var final = Nativo.Arquivos.CaminhoFinal(existente) ?? throw new OperacaoRecusada("Não foi possível conferir o caminho real.");
        if (!string.Equals(final.TrimEnd('\\'), existente.TrimEnd('\\'), StringComparison.OrdinalIgnoreCase) || !DentroDe(final, autorizados))
        {
            throw new OperacaoRecusada("O caminho real não confere com o autorizado.");
        }
    }
}

/// <summary>Recusa pela política local: vira resultado `ok=false` para o servidor.</summary>
internal sealed class OperacaoRecusada(string mensagem) : Exception(mensagem);
