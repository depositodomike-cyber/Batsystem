namespace OracleAgent.Seguranca;

/// <summary>SR-37 / GA-16: URLs e domínios.</summary>
internal static class Urls
{
    public static Uri? Normalizar(string? bruta)
    {
        if (string.IsNullOrEmpty(bruta) || bruta.Length > 2048) return null;
        foreach (var ch in bruta)
        {
            if (char.IsWhiteSpace(ch) || ch < 0x20 || ch == 0x7f || ch is '"' or '\'' or '<' or '>' or '`') return null;
        }
        if (!Uri.TryCreate(bruta, UriKind.Absolute, out var u)) return null;
        if (u.Scheme != Uri.UriSchemeHttp && u.Scheme != Uri.UriSchemeHttps) return null;
        if (!string.IsNullOrEmpty(u.UserInfo)) return null;
        if (string.IsNullOrEmpty(u.IdnHost)) return null;
        return u;
    }

    public static string Host(Uri u) => u.IdnHost.ToLowerInvariant().TrimEnd('.');

    public static bool HostAutorizado(string host, IEnumerable<string> dominios)
    {
        var h = host.ToLowerInvariant().TrimEnd('.');
        foreach (var d in dominios)
        {
            if (!Uri.TryCreate("http://" + d.Trim(), UriKind.Absolute, out var du)) continue;
            var dom = du.IdnHost.ToLowerInvariant().TrimEnd('.');
            if (dom.Length == 0) continue;
            if (h == dom || h.EndsWith("." + dom, StringComparison.Ordinal)) return true;
        }
        return false;
    }

    /// <summary>A URL da API: HTTPS, ou HTTP só em loopback (SR-24).</summary>
    public static bool ApiAceitavel(string url, out Uri? uri)
    {
        uri = null;
        if (!Uri.TryCreate(url, UriKind.Absolute, out var u)) return false;
        if (!string.IsNullOrEmpty(u.UserInfo) || !string.IsNullOrEmpty(u.Query) || !string.IsNullOrEmpty(u.Fragment)) return false;
        if (u.Scheme == Uri.UriSchemeHttps || (u.Scheme == Uri.UriSchemeHttp && u.IsLoopback))
        {
            uri = new Uri(u.GetLeftPart(UriPartial.Authority));
            return true;
        }
        return false;
    }
}
