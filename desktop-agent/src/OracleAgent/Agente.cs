using System.Text.Json;
using Microsoft.Win32;
using OracleAgent.Canal;
using OracleAgent.Operacoes;
using OracleAgent.Seguranca;

namespace OracleAgent;

/// <summary>
/// Loop principal: sincroniza (heartbeat + long-poll, sempre de saída),
/// aplica a política assinada (com confirmação local para ampliações),
/// executa comandos verificados e devolve o resultado real.
/// </summary>
internal sealed class Agente : IDisposable
{
    private readonly Configuracao _cfg;
    private readonly ChaveDispositivo _chave;
    private readonly ClienteApi _api;
    private readonly VerificadorEnvelopes _verificador;
    private readonly PoliticaLocal _politica;
    private readonly Executor _executor;
    private readonly Log _log;
    private List<AppInventario> _inventario = [];
    private DateTimeOffset _inventarioEm = DateTimeOffset.MinValue;
    private CancellationTokenSource _operacao = new();
    private string _estadoServidor = "inicializando";

    public event Action? Mudou;
    public string EstadoServidor => _estadoServidor;
    public bool ParadoLocal => _cfg.ParadoLocal;
    public bool AmpliacaoPendente => _politica.AmpliacaoPendente;
    /// <summary>Snapshot do que será mostrado na bandeja (versão + diff com nomes de apps).</summary>
    public (int Versao, IReadOnlyList<string> Diff) AmpliacoesPendentes() => _politica.Instantaneo(NomeApp);

    private string NomeApp(string id) => _inventario.FirstOrDefault(a => a.Id == id) is { } a ? $"\"{a.Nome}\" ({a.Alvo})" : $"desconhecido ({id})";
    public string ImpressaoDispositivo { get; }
    public string ImpressaoServidor { get; }
    public string? UltimoErro { get; private set; }

    public Agente(Configuracao cfg, Log log)
    {
        _cfg = cfg;
        _log = log;
        _chave = ChaveDispositivo.Abrir(cfg.NomeChave);
        _api = new ClienteApi(new Uri(cfg.Api), _chave, cfg.DispositivoId);
        _verificador = new VerificadorEnvelopes(cfg.ChaveServidor, cfg.DispositivoId, DateTimeOffset.UtcNow);
        _politica = new PoliticaLocal(cfg.PoliticaConfirmada);
        _executor = new Executor(() => _politica.Efetiva, () => _inventario);
        ImpressaoDispositivo = ChaveDispositivo.Impressao(_chave.PublicaSpki());
        ImpressaoServidor = ChaveDispositivo.Impressao(cfg.ChaveServidor);
    }

    // ------------------------------------------------------------ bandeja

    /// <summary>SR-31: parar tudo localmente (funciona offline).</summary>
    public void PararTudo()
    {
        _cfg.ParadoLocal = true;
        _cfg.Salvar();
        _operacao.Cancel();
        Agendador.CancelarTudo();
        _log.Registrar("parada.local", null);
        Mudou?.Invoke();
    }

    public void Retomar()
    {
        _cfg.ParadoLocal = false;
        _cfg.Salvar();
        _operacao = new CancellationTokenSource();
        _log.Registrar("retomada.local", null);
        Mudou?.Invoke();
    }

    /// <summary>SR-35: o usuário aceitou a ampliação NA BANDEJA deste computador.</summary>
    /// <returns>false se a política mudou depois de exibida (GB-02): nada é aplicado.</returns>
    public bool ConfirmarAmpliacao(int versaoVista)
    {
        if (!_politica.ConfirmarAmpliacao(versaoVista))
        {
            _log.Registrar("politica.confirmacao_desatualizada", new { versaoVista });
            Mudou?.Invoke();
            return false;
        }
        _cfg.PoliticaConfirmada = _politica.Confirmada;
        _cfg.Salvar();
        AplicarAutoinicio(_politica.Efetiva.Autoinicio);
        _log.Registrar("politica.confirmada", new { versao = _politica.Confirmada.Versao });
        Mudou?.Invoke();
        return true;
    }

    // ------------------------------------------------------------ loop

    public async Task Rodar(CancellationToken ct)
    {
        var espera = TimeSpan.FromSeconds(2);
        var primeira = true;
        while (!ct.IsCancellationRequested)
        {
            try
            {
                await Ciclo(primeira, ct);
                primeira = false;
                UltimoErro = null;
                espera = TimeSpan.FromSeconds(2);
            }
            catch (DispositivoRevogadoException)
            {
                // SR-32: revogado no servidor → apaga a chave e a configuração.
                _log.Registrar("revogado", null);
                ChaveDispositivo.Apagar(_cfg.NomeChave);
                Configuracao.Apagar();
                _estadoServidor = "revogado";
                Mudou?.Invoke();
                return;
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested)
            {
                return;
            }
            catch (Exception e)
            {
                UltimoErro = e.Message;
                _estadoServidor = "erro";
                Mudou?.Invoke();
                await Task.Delay(espera, ct);
                espera = TimeSpan.FromSeconds(Math.Min(espera.TotalSeconds * 2, 30));
            }
        }
    }

    private async Task Ciclo(bool primeira, CancellationToken ct)
    {
        if (primeira || DateTimeOffset.UtcNow - _inventarioEm > TimeSpan.FromMinutes(10))
        {
            _inventario = await Task.Run(Inventario.Montar, ct);
            _inventarioEm = DateTimeOffset.UtcNow;
        }
        var enviarInventario = primeira || _inventarioEm > DateTimeOffset.UtcNow.AddSeconds(-5);
        var resp = await _api.Sincronizar(new
        {
            versao = Programa.Versao,
            estado = primeira ? "inicializando" : "ativo",
            paradoLocal = _cfg.ParadoLocal,
            politicaAplicada = _politica.Confirmada.Versao,
            confirmacaoLocalPendente = _politica.AmpliacaoPendente,
            autoinicio = AutoinicioLigado(),
            inventario = enviarInventario ? _inventario : null,
            esperar = !primeira,
        }, ct);

        var anterior = _estadoServidor;
        _estadoServidor = resp.Estado;
        // Bloqueado no servidor ("parar tudo" pela UI/voz) → aborta o que estiver rodando.
        if (resp.Estado == "bloqueado")
        {
            _operacao.Cancel();
            Agendador.CancelarTudo();
        }
        else if (_operacao.IsCancellationRequested && !_cfg.ParadoLocal)
        {
            _operacao = new CancellationTokenSource();
        }

        // Política: assinada, para este dispositivo, versão nunca menor (SR-27).
        try
        {
            var p = _verificador.AbrirPolitica(resp.Politica);
            var tinhaPendente = _politica.AmpliacaoPendente;
            if (_politica.Receber(p))
            {
                AplicarAutoinicio(_politica.Efetiva.Autoinicio);
                if (!tinhaPendente && _politica.AmpliacaoPendente) _log.Registrar("politica.ampliacao_pendente", new { versao = p.Versao });
            }
        }
        catch (OperacaoRecusada e)
        {
            _log.Registrar("politica.rejeitada", new { motivo = e.Message });
        }
        if (anterior != _estadoServidor) Mudou?.Invoke();

        foreach (var env in resp.Comandos)
        {
            await Processar(env, ct);
        }
    }

    private async Task Processar(Envelope env, CancellationToken ct)
    {
        Comando c;
        try
        {
            c = _verificador.AbrirComando(env);
        }
        catch (OperacaoRecusada e)
        {
            // Não dá para confiar no id de um envelope inválido: só registra.
            _log.Registrar("comando.rejeitado", new { motivo = e.Message });
            return;
        }

        Resultado r;
        if (_cfg.ParadoLocal || _estadoServidor != "conectado")
        {
            r = Resultado.Falha("O controle do computador está parado.");
        }
        else
        {
            using var limite = CancellationTokenSource.CreateLinkedTokenSource(ct, _operacao.Token);
            limite.CancelAfter(TimeSpan.FromSeconds(30)); // SR-33
            _log.Registrar("comando.iniciado", new { c.Id, c.Operacao, c.Risco });
            r = await _executor.Executar(c, limite.Token);
        }
        _log.Registrar(r.Ok ? "comando.concluido" : "comando.falhou", new { c.Id, c.Operacao, r.Verificado, erro = r.Erro });
        await _api.EnviarResultado(new
        {
            comandoId = c.Id,
            ok = r.Ok,
            verificado = r.Verificado,
            conteudo = r.Ok ? Truncar(r.Conteudo, 20_000) : null,
            erro = r.Ok ? null : Truncar(r.Erro ?? "Falhou.", 2000),
        }, ct);
    }

    private static string Truncar(string s, int max) => s.Length <= max ? s : s[..max];

    // ------------------------------------------------------------ autoinício (SR-14)

    private const string ChaveRun = @"Software\Microsoft\Windows\CurrentVersion\Run";
    private const string NomeRun = "OracleLocalAgent";

    private static bool AutoinicioLigado()
    {
        using var k = Registry.CurrentUser.OpenSubKey(ChaveRun);
        return k?.GetValue(NomeRun) is string;
    }

    /// <summary>Única escrita de registro do agente: a própria entrada em HKCU\...\Run.</summary>
    private static void AplicarAutoinicio(bool ligado)
    {
        using var k = Registry.CurrentUser.OpenSubKey(ChaveRun, writable: true);
        if (k is null) return;
        if (ligado)
        {
            var exe = Environment.ProcessPath;
            if (exe is not null) k.SetValue(NomeRun, $"\"{exe}\" run --background");
        }
        else if (k.GetValue(NomeRun) is not null)
        {
            k.DeleteValue(NomeRun, throwOnMissingValue: false);
        }
    }

    public static void RemoverAutoinicio() => AplicarAutoinicio(false);

    public void Dispose()
    {
        _api.Dispose();
        _chave.Dispose();
    }
}

/// <summary>
/// Log local (JSONL rotativo) sem conteúdo de arquivos, caminhos completos ou
/// chaves (SR-40): só eventos, ids e operações.
/// </summary>
internal sealed class Log
{
    private readonly object _trava = new();
    private string Arquivo => Path.Combine(Configuracao.Pasta, "agent-log.jsonl");

    public void Registrar(string evento, object? detalhes)
    {
        try
        {
            lock (_trava)
            {
                Directory.CreateDirectory(Configuracao.Pasta);
                var fi = new FileInfo(Arquivo);
                if (fi.Exists && fi.Length > 2 * 1024 * 1024)
                {
                    File.Move(Arquivo, Arquivo + ".1", overwrite: true);
                }
                File.AppendAllText(Arquivo, JsonSerializer.Serialize(new { em = DateTimeOffset.Now, evento, detalhes }) + "\n");
            }
        }
        catch
        {
            // Log nunca derruba o agente.
        }
    }
}
