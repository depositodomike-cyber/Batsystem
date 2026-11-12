using System.Text.Json.Serialization;

namespace OracleAgent.Seguranca;

/// <summary>Política como o servidor a assina (tipo "politica").</summary>
internal sealed record Politica
{
    [JsonPropertyName("versao")] public int Versao { get; init; }
    [JsonPropertyName("permissoes")] public Dictionary<string, bool> Permissoes { get; init; } = new();
    [JsonPropertyName("confirmar")] public List<string> Confirmar { get; init; } = new();
    [JsonPropertyName("apps")] public List<string> Apps { get; init; } = new();
    [JsonPropertyName("observaveis")] public List<string> Observaveis { get; init; } = new();
    [JsonPropertyName("diretorios")] public List<string> Diretorios { get; init; } = new();
    [JsonPropertyName("dominios")] public List<string> Dominios { get; init; } = new();
    [JsonPropertyName("autoinicio")] public bool Autoinicio { get; init; }

    public static Politica Vazia => new();

    public bool Categoria(string c) => Permissoes.TryGetValue(c, out var v) && v;
}

/// <summary>
/// SR-35 / GA-11 / GA-15: política local independente. A política que VALE
/// aqui é a interseção entre o que o servidor manda e o que o usuário já
/// confirmou NESTE computador. Restrições valem na hora; ampliações (tudo o
/// que reduz risco ou aumenta alcance/observação) esperam a bandeja.
/// </summary>
internal sealed class PoliticaLocal
{
    // GB-02: o loop de rede e a bandeja (UI) mexem aqui em threads diferentes.
    private readonly object _trava = new();
    private Politica _confirmada, _servidor, _efetiva;

    public Politica Confirmada { get { lock (_trava) return _confirmada; } }
    public Politica Servidor { get { lock (_trava) return _servidor; } }
    public Politica Efetiva { get { lock (_trava) return _efetiva; } }

    public PoliticaLocal(Politica confirmada)
    {
        _confirmada = confirmada;
        _servidor = confirmada;
        _efetiva = confirmada;
    }

    /// <summary>Recebe a política do servidor (versão nunca pode descer — SR-27).</summary>
    public bool Receber(Politica servidor)
    {
        lock (_trava)
        {
            if (servidor.Versao < _servidor.Versao) return false;
            _servidor = servidor;
            _efetiva = Intersecao(_confirmada, servidor);
            return true;
        }
    }

    /// <summary>
    /// O que a bandeja mostra: a versão do servidor e o diff exato. A
    /// confirmação depois só vale para ESTA versão (GB-02).
    /// </summary>
    public (int Versao, IReadOnlyList<string> Diff) Instantaneo(Func<string, string>? nomeApp = null)
    {
        lock (_trava) return (_servidor.Versao, Ampliacoes(_confirmada, _servidor, nomeApp));
    }

    /// <summary>
    /// O usuário confirmou na bandeja o diff da versão <paramref name="versaoVista"/>.
    /// Se o servidor mudou a política enquanto o diálogo estava aberto, nada é
    /// aplicado (o usuário precisa rever o diff novo).
    /// </summary>
    public bool ConfirmarAmpliacao(int versaoVista)
    {
        lock (_trava)
        {
            if (_servidor.Versao != versaoVista) return false;
            _confirmada = _servidor;
            _efetiva = _servidor;
            return true;
        }
    }

    public bool AmpliacaoPendente { get { lock (_trava) return Ampliacoes(_confirmada, _servidor).Count > 0; } }

    public IReadOnlyList<string> AmpliacoesPendentes(Func<string, string>? nomeApp = null)
    {
        lock (_trava) return Ampliacoes(_confirmada, _servidor, nomeApp);
    }

    internal static Politica Intersecao(Politica conf, Politica srv) => new()
    {
        Versao = srv.Versao,
        Permissoes = srv.Permissoes.Where(kv => kv.Value && conf.Categoria(kv.Key)).ToDictionary(kv => kv.Key, _ => true),
        // Mais confirmação é mais restritivo: união.
        Confirmar = conf.Confirmar.Union(srv.Confirmar).Distinct().ToList(),
        Apps = srv.Apps.Intersect(conf.Apps).ToList(),
        Observaveis = srv.Observaveis.Intersect(conf.Observaveis).ToList(),
        Diretorios = srv.Diretorios.Where(d => conf.Diretorios.Contains(d, StringComparer.OrdinalIgnoreCase)).ToList(),
        Dominios = srv.Dominios.Intersect(conf.Dominios, StringComparer.OrdinalIgnoreCase).ToList(),
        Autoinicio = srv.Autoinicio && conf.Autoinicio,
    };

    /// <summary>Lista legível do que o servidor quer ampliar (o diff exato mostrado na bandeja).</summary>
    internal static List<string> Ampliacoes(Politica conf, Politica srv, Func<string, string>? nomeApp = null)
    {
        var nome = nomeApp ?? (id => id);
        var d = new List<string>();
        foreach (var (c, v) in srv.Permissoes) if (v && !conf.Categoria(c)) d.Add($"Liberar a categoria \"{c}\"");
        foreach (var op in conf.Confirmar.Except(srv.Confirmar)) d.Add($"Deixar de pedir confirmação para \"{op}\"");
        foreach (var a in srv.Apps.Except(conf.Apps)) d.Add($"Autorizar o aplicativo {nome(a)}");
        foreach (var a in srv.Observaveis.Except(conf.Observaveis)) d.Add($"Permitir ler títulos de janela do aplicativo {nome(a)}");
        foreach (var x in srv.Diretorios.Where(x => !conf.Diretorios.Contains(x, StringComparer.OrdinalIgnoreCase))) d.Add($"Autorizar a pasta {x}");
        foreach (var x in srv.Dominios.Except(conf.Dominios, StringComparer.OrdinalIgnoreCase)) d.Add($"Autorizar o domínio {x}");
        if (srv.Autoinicio && !conf.Autoinicio) d.Add("Iniciar o agente junto com o Windows");
        return d;
    }
}
