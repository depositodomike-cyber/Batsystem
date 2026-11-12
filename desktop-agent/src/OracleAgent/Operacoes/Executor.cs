using System.Diagnostics;
using System.Text;
using System.Text.Json.Nodes;
using OracleAgent.Canal;
using OracleAgent.Nativo;
using OracleAgent.Seguranca;
using Windows.Media.Control;

namespace OracleAgent.Operacoes;

internal sealed record Resultado(bool Ok, bool Verificado, string Conteudo, string? Erro = null)
{
    public static Resultado Feito(string conteudo) => new(true, true, conteudo);
    public static Resultado SemConfirmacao(string conteudo) => new(true, false, conteudo);
    public static Resultado Falha(string erro) => new(false, false, "", erro);
}

/// <summary>
/// Desktop Automation Layer. Cada operação: (1) revalida contra a política
/// LOCAL efetiva e as listas fixas — independente do servidor; (2) executa
/// por API tipada (nunca shell — SR-10); (3) VERIFICA o resultado real.
/// </summary>
internal sealed class Executor(Func<Politica> politica, Func<IReadOnlyList<AppInventario>> inventario)
{
    private static readonly Dictionary<string, string> Categoria = new()
    {
        ["listar_processos"] = "processos", ["listar_janelas"] = "janelas", ["buscar_arquivos"] = "arquivos_busca",
        ["abrir_aplicativo"] = "apps", ["fechar_aplicativo"] = "apps", ["abrir_url"] = "navegador",
        ["abrir_documento"] = "documentos", ["organizar_janelas"] = "janelas", ["controlar_midia"] = "midia",
        ["criar_pasta"] = "arquivos_escrita", ["mover_arquivo"] = "arquivos_escrita", ["energia"] = "energia",
    };

    /// <summary>Operações que o servidor nunca deveria mandar como moderadas.</summary>
    private static readonly HashSet<string> SempreAlto = ["fechar_aplicativo", "energia"];

    public async Task<Resultado> Executar(Comando c, CancellationToken ct)
    {
        var p = politica();
        try
        {
            if (!Categoria.TryGetValue(c.Operacao, out var cat)) throw new OperacaoRecusada("Operação desconhecida.");
            if (!p.Categoria(cat)) throw new OperacaoRecusada($"A categoria \"{cat}\" não está liberada neste computador.");
            if (c.Risco is not ("baixo" or "moderado" or "alto")) throw new OperacaoRecusada("Risco inválido.");
            if (SempreAlto.Contains(c.Operacao) && c.Risco != "alto") throw new OperacaoRecusada("Classificação de risco inconsistente.");
            // GA-15: operação marcada aqui para pedir confirmação não pode chegar como moderada.
            if (c.Risco == "moderado" && p.Confirmar.Contains(c.Operacao)) throw new OperacaoRecusada("Esta operação exige confirmação neste computador.");

            return c.Operacao switch
            {
                "listar_processos" => ListarProcessos(p),
                "listar_janelas" => ListarJanelas(p),
                "buscar_arquivos" => BuscarArquivos(c.Parametros, p, ct),
                "abrir_aplicativo" => await AbrirApp(c.Parametros, p, ct),
                "fechar_aplicativo" => await FecharApp(c.Parametros, p, ct),
                "abrir_url" => AbrirUrl(c.Parametros, c.Risco, p),
                "abrir_documento" => AbrirDocumento(c.Parametros, c.Risco, p),
                "organizar_janelas" => await OrganizarJanelas(c.Parametros, p, ct),
                "controlar_midia" => await Midia(c.Parametros),
                "criar_pasta" => CriarPasta(c.Parametros, p),
                "mover_arquivo" => Mover(c.Parametros, c.Risco, p),
                "energia" => Energia(c.Parametros),
                _ => throw new OperacaoRecusada("Operação desconhecida."),
            };
        }
        catch (OperacaoRecusada e)
        {
            return Resultado.Falha("Recusado pela política local: " + e.Message);
        }
        catch (OperationCanceledException)
        {
            return Resultado.Falha("Interrompido (parar tudo).");
        }
        catch (Exception e)
        {
            return Resultado.Falha("Falha: " + e.GetType().Name);
        }
    }

    // ------------------------------------------------------------ apps

    private AppInventario AppAutorizado(JsonObject prm, Politica p)
    {
        var id = (string?)prm["aplicativoId"] ?? throw new OperacaoRecusada("Aplicativo não informado.");
        if (!p.Apps.Contains(id)) throw new OperacaoRecusada("Aplicativo não autorizado neste computador.");
        var app = inventario().FirstOrDefault(a => a.Id == id) ?? throw new OperacaoRecusada("Aplicativo não encontrado no inventário.");
        if (!Inventario.AlvoAceitavel(app.Alvo) || Inventario.IdDe(app.Alvo) != id) throw new OperacaoRecusada("O programa mudou desde o inventário.");
        return app;
    }

    private static List<Process> ProcessosDe(string alvo)
    {
        var nome = Path.GetFileNameWithoutExtension(alvo);
        var lista = new List<Process>();
        foreach (var pr in Process.GetProcessesByName(nome))
        {
            try
            {
                if (string.Equals(pr.MainModule?.FileName, alvo, StringComparison.OrdinalIgnoreCase)) lista.Add(pr);
                else pr.Dispose();
            }
            catch
            {
                pr.Dispose(); // processo de outro usuário/elevado: não é nosso
            }
        }
        return lista;
    }

    private async Task<Resultado> AbrirApp(JsonObject prm, Politica p, CancellationToken ct)
    {
        var app = AppAutorizado(prm, p);
        var antes = ProcessosDe(app.Alvo).Select(x => x.Id).ToHashSet();
        using var _ = Process.Start(new ProcessStartInfo(app.Alvo)
        {
            UseShellExecute = false,
            WorkingDirectory = Path.GetDirectoryName(app.Alvo)!,
        });
        // Verificação real: um processo daquele executável existe (novo ou já aberto).
        for (var i = 0; i < 20; i++)
        {
            await Task.Delay(500, ct);
            var agora = ProcessosDe(app.Alvo);
            if (agora.Count > 0)
            {
                var novo = agora.Any(x => !antes.Contains(x.Id));
                return Resultado.Feito(novo ? $"{app.Nome} foi aberto." : $"{app.Nome} já estava aberto; foi acionado de novo.");
            }
        }
        return Resultado.SemConfirmacao($"Pedi para abrir {app.Nome}, mas não encontrei o processo em execução.");
    }

    private async Task<Resultado> FecharApp(JsonObject prm, Politica p, CancellationToken ct)
    {
        var app = AppAutorizado(prm, p);
        if (ListasFixas.ProcessosProtegidos.Contains(Path.GetFileNameWithoutExtension(app.Alvo))) throw new OperacaoRecusada("Processo protegido.");
        var procs = ProcessosDe(app.Alvo);
        if (procs.Count == 0) return Resultado.Feito($"{app.Nome} não estava aberto.");
        foreach (var pr in procs) pr.CloseMainWindow(); // como clicar no X; sem Kill (SR-17)
        for (var i = 0; i < 20; i++)
        {
            await Task.Delay(500, ct);
            if (ProcessosDe(app.Alvo).Count == 0) return Resultado.Feito($"{app.Nome} foi fechado.");
        }
        return Resultado.SemConfirmacao($"Pedi para fechar {app.Nome}, mas ele continua aberto (talvez esteja perguntando se quer salvar).");
    }

    // ------------------------------------------------------------ leitura

    private Resultado ListarProcessos(Politica p)
    {
        var observaveis = inventario().Where(a => p.Observaveis.Contains(a.Id)).Select(a => a.Alvo).ToHashSet(StringComparer.OrdinalIgnoreCase);
        var sb = new StringBuilder();
        foreach (var grupo in Process.GetProcesses().Where(x => x.MainWindowHandle != IntPtr.Zero).GroupBy(x => x.ProcessName).OrderBy(g => g.Key))
        {
            var pr = grupo.First();
            string? titulo = null;
            try
            {
                if (observaveis.Contains(pr.MainModule?.FileName ?? "")) titulo = pr.MainWindowTitle; // SR-16
            }
            catch { }
            sb.AppendLine(titulo is { Length: > 0 } ? $"- {grupo.Key}: {titulo}" : $"- {grupo.Key}");
        }
        return Resultado.Feito(sb.Length > 0 ? sb.ToString() : "Nenhum aplicativo com janela aberta.");
    }

    private Resultado ListarJanelas(Politica p)
    {
        var observaveis = inventario().Where(a => p.Observaveis.Contains(a.Id)).Select(a => a.Alvo).ToHashSet(StringComparer.OrdinalIgnoreCase);
        var sb = new StringBuilder();
        foreach (var (_, pid, titulo) in Win32.JanelasVisiveis())
        {
            try
            {
                using var pr = Process.GetProcessById((int)pid);
                var exe = pr.MainModule?.FileName ?? "";
                sb.AppendLine(observaveis.Contains(exe) ? $"- {pr.ProcessName}: {titulo}" : $"- {pr.ProcessName}");
            }
            catch { }
        }
        return Resultado.Feito(sb.Length > 0 ? sb.ToString() : "Nenhuma janela visível.");
    }

    private static Resultado BuscarArquivos(JsonObject prm, Politica p, CancellationToken ct)
    {
        var dir = Caminhos.Exigir((string?)prm["diretorio"], p.Diretorios);
        if (!Directory.Exists(dir)) return Resultado.Feito("O diretório não existe.");
        Caminhos.ConferirFinal(dir, p.Diretorios);
        var nome = ((string?)prm["nome"] ?? "").Trim();
        if (nome.IndexOfAny(['*', '?', '\\', '/']) >= 0) throw new OperacaoRecusada("Busca sem curingas nem caminhos.");
        var exts = (prm["extensoes"] as JsonArray)?.Select(x => (string?)x ?? "").Where(x => x.StartsWith('.')).ToHashSet(StringComparer.OrdinalIgnoreCase);
        var limite = Math.Clamp((int?)prm["limite"] ?? 20, 1, 200);
        var porModificado = ((string?)prm["ordenar"] ?? "modificado") == "modificado";
        var opcoes = new EnumerationOptions
        {
            RecurseSubdirectories = true,
            MaxRecursionDepth = 6,
            IgnoreInaccessible = true,
            AttributesToSkip = FileAttributes.ReparsePoint | FileAttributes.System | FileAttributes.Hidden,
        };
        var achados = new List<FileInfo>();
        var vistos = 0;
        foreach (var f in new DirectoryInfo(dir).EnumerateFiles("*", opcoes))
        {
            ct.ThrowIfCancellationRequested();
            if (++vistos > 50_000) break;
            if (nome.Length > 0 && !f.Name.Contains(nome, StringComparison.CurrentCultureIgnoreCase)) continue;
            if (exts is { Count: > 0 } && !exts.Contains(f.Extension)) continue;
            if (!Caminhos.DentroDe(f.FullName, p.Diretorios)) continue; // GB-01: AppData, ocultos, 8.3…
            achados.Add(f);
        }
        var ordenados = (porModificado ? achados.OrderByDescending(f => f.LastWriteTimeUtc) : achados.OrderBy(f => f.Name)).Take(limite);
        // GB-05/SR-15: caminhos RELATIVOS ao diretório pesquisado.
        var sb = new StringBuilder($"Diretório: {dir}\n(caminho completo = diretório + \\ + caminho relativo)\n");
        var algum = false;
        foreach (var f in ordenados)
        {
            algum = true;
            sb.AppendLine($"- {Path.GetRelativePath(dir, f.FullName)} | {f.Length / 1024} KB | modificado {f.LastWriteTime:yyyy-MM-dd HH:mm}");
        }
        return Resultado.Feito(algum ? sb.ToString() : "Nenhum arquivo encontrado.");
    }

    // ------------------------------------------------------------ shell

    private static Resultado AbrirUrl(JsonObject prm, string risco, Politica p)
    {
        var u = Urls.Normalizar((string?)prm["url"]) ?? throw new OperacaoRecusada("URL inválida.");
        // GA-15: moderado só para domínio confirmado AQUI; fora disso o servidor teve de pedir aprovação.
        if (risco == "moderado" && !Urls.HostAutorizado(Urls.Host(u), p.Dominios)) throw new OperacaoRecusada("Domínio não autorizado neste computador.");
        using var pr = Process.Start(new ProcessStartInfo(u.AbsoluteUri) { UseShellExecute = true });
        // ShellExecute devolveu sem erro: o Windows entregou o endereço ao navegador padrão.
        return Resultado.Feito($"O navegador recebeu o endereço {Urls.Host(u)}.");
    }

    private static Resultado AbrirDocumento(JsonObject prm, string risco, Politica p)
    {
        var caminho = Caminhos.Exigir((string?)prm["caminho"], p.Diretorios);
        var ext = Path.GetExtension(caminho);
        var permitido = ListasFixas.ExtensoesDocumento.Contains(ext) || (risco == "alto" && ListasFixas.ExtensoesAlto.Contains(ext));
        if (!permitido) throw new OperacaoRecusada($"Arquivos {ext} não podem ser abertos pelo Oracle.");
        if (!File.Exists(caminho)) return Resultado.Falha("O arquivo não existe.");
        Caminhos.ConferirFinal(caminho, p.Diretorios); // GB-06
        using var pr = Process.Start(new ProcessStartInfo(caminho) { UseShellExecute = true });
        return Resultado.Feito($"{Path.GetFileName(caminho)} foi aberto no aplicativo padrão.");
    }

    // ------------------------------------------------------------ janelas

    private async Task<Resultado> OrganizarJanelas(JsonObject prm, Politica p, CancellationToken ct)
    {
        var layout = (string?)prm["layout"] ?? "";
        var ids = (prm["aplicativoIds"] as JsonArray)?.Select(x => (string?)x ?? "").ToList() ?? [];
        if (ids.Count is 0 or > 2) throw new OperacaoRecusada("Aplicativos inválidos.");
        var apps = ids.Select(id => AppAutorizado(new JsonObject { ["aplicativoId"] = id }, p)).ToList();
        var janelas = Win32.JanelasVisiveis();
        IntPtr JanelaDe(AppInventario a)
        {
            var pids = ProcessosDe(a.Alvo).Select(x => (uint)x.Id).ToHashSet();
            return janelas.FirstOrDefault(j => pids.Contains(j.Pid)).Handle;
        }
        var hs = apps.Select(JanelaDe).ToList();
        if (hs.Any(h => h == IntPtr.Zero)) return Resultado.Falha("Não encontrei a janela de todos os aplicativos (estão abertos?).");
        var tela = Screen.PrimaryScreen!.WorkingArea;
        switch (layout)
        {
            case "maximizar":
                Win32.ShowWindow(hs[0], Win32.SW_MAXIMIZE);
                await Task.Delay(300, ct);
                return Win32.IsZoomed(hs[0]) ? Resultado.Feito($"{apps[0].Nome} maximizado.") : Resultado.SemConfirmacao("Pedi para maximizar, mas a janela não confirmou.");
            case "restaurar":
                Win32.ShowWindow(hs[0], Win32.SW_RESTORE);
                await Task.Delay(300, ct);
                return !Win32.IsIconic(hs[0]) ? Resultado.Feito($"{apps[0].Nome} restaurado.") : Resultado.SemConfirmacao("A janela continua minimizada.");
            case "minimizar_outras":
                var alvo = hs[0];
                foreach (var (h, _, _) in janelas.Where(j => j.Handle != alvo)) Win32.ShowWindow(h, Win32.SW_SHOWMINNOACTIVE);
                Win32.ShowWindow(alvo, Win32.SW_RESTORE);
                Win32.SetForegroundWindow(alvo);
                await Task.Delay(300, ct);
                return Resultado.Feito($"Deixei só {apps[0].Nome} visível.");
            case "lado_a_lado":
                if (hs.Count != 2) throw new OperacaoRecusada("Lado a lado precisa de 2 aplicativos.");
                var metade = tela.Width / 2;
                for (var i = 0; i < 2; i++)
                {
                    Win32.ShowWindow(hs[i], Win32.SW_RESTORE);
                    Win32.SetWindowPos(hs[i], IntPtr.Zero, tela.Left + i * metade, tela.Top, metade, tela.Height, Win32.SWP_NOZORDER | Win32.SWP_SHOWWINDOW);
                }
                await Task.Delay(300, ct);
                var ok = hs.Select((h, i) => Win32.GetWindowRect(h, out var r) && Math.Abs(r.Left - (tela.Left + i * metade)) < 40).All(x => x);
                return ok ? Resultado.Feito($"{apps[0].Nome} e {apps[1].Nome} lado a lado.") : Resultado.SemConfirmacao("Posicionei as janelas, mas uma delas não ficou no lugar.");
            default:
                throw new OperacaoRecusada("Layout inválido.");
        }
    }

    // ------------------------------------------------------------ mídia

    private static async Task<Resultado> Midia(JsonObject prm)
    {
        var acao = (string?)prm["acao"] ?? "";
        switch (acao)
        {
            case "volume_mais": return Win32.TeclaMidia(Win32.VK_VOLUME_UP) ? Resultado.Feito("Volume aumentado.") : Resultado.Falha("O Windows recusou a tecla de volume.");
            case "volume_menos": return Win32.TeclaMidia(Win32.VK_VOLUME_DOWN) ? Resultado.Feito("Volume diminuído.") : Resultado.Falha("O Windows recusou a tecla de volume.");
            case "mudo": return Win32.TeclaMidia(Win32.VK_VOLUME_MUTE) ? Resultado.Feito("Mudo alternado.") : Resultado.Falha("O Windows recusou a tecla de volume.");
        }
        var gerente = await GlobalSystemMediaTransportControlsSessionManager.RequestAsync();
        var sessao = gerente.GetCurrentSession();
        if (sessao is null) return Resultado.Falha("Nenhum aplicativo está tocando mídia agora.");
        var ok = acao switch
        {
            "tocar_pausar" => await sessao.TryTogglePlayPauseAsync(),
            "proxima" => await sessao.TrySkipNextAsync(),
            "anterior" => await sessao.TrySkipPreviousAsync(),
            "parar" => await sessao.TryStopAsync(),
            _ => throw new OperacaoRecusada("Ação de mídia inválida."),
        };
        await Task.Delay(400);
        var estado = sessao.GetPlaybackInfo()?.PlaybackStatus.ToString() ?? "?";
        return ok ? Resultado.Feito($"Mídia ({sessao.SourceAppUserModelId}): {acao.Replace('_', ' ')} — agora {estado}.") : Resultado.Falha("O aplicativo de mídia recusou o comando.");
    }

    // ------------------------------------------------------------ arquivos

    private static Resultado CriarPasta(JsonObject prm, Politica p)
    {
        var c = Caminhos.Exigir((string?)prm["caminho"], p.Diretorios);
        if (File.Exists(c)) return Resultado.Falha("Já existe um arquivo com esse nome.");
        var pai = Path.GetDirectoryName(c)!;
        if (!Directory.Exists(pai)) return Resultado.Falha("A pasta onde criar não existe.");
        Caminhos.ConferirFinal(pai, p.Diretorios); // GB-06
        Directory.CreateDirectory(c);
        return Directory.Exists(c) ? Resultado.Feito($"Pasta {Path.GetFileName(c)} pronta.") : Resultado.Falha("A pasta não foi criada.");
    }

    private static Resultado Mover(JsonObject prm, string risco, Politica p)
    {
        var o = Caminhos.Exigir((string?)prm["origem"], p.Diretorios);
        var d = Caminhos.Exigir((string?)prm["destino"], p.Diretorios);
        var ext = Path.GetExtension(o);
        if (!string.Equals(ext, Path.GetExtension(d), StringComparison.OrdinalIgnoreCase)) throw new OperacaoRecusada("Mover não pode trocar a extensão.");
        // GB-01: só documentos — nunca executáveis, atalhos, scripts ou sem extensão.
        if (!ListasFixas.ExtensoesDocumento.Contains(ext) && !ListasFixas.ExtensoesAlto.Contains(ext)) throw new OperacaoRecusada($"Arquivos {(ext.Length > 0 ? ext : "sem extensão")} não podem ser movidos.");
        if (!File.Exists(o)) return Resultado.Falha("O arquivo de origem não existe.");
        var sobrescrever = (bool?)prm["sobrescrever"] ?? false;
        if (sobrescrever && risco != "alto") throw new OperacaoRecusada("Sobrescrever exige confirmação.");
        if (File.Exists(d) && !sobrescrever) return Resultado.Falha("Já existe um arquivo no destino.");
        var destinoDir = Path.GetDirectoryName(d)!;
        if (!Directory.Exists(destinoDir)) return Resultado.Falha("A pasta de destino não existe.");
        Caminhos.ConferirFinal(o, p.Diretorios);          // GB-06
        Caminhos.ConferirFinal(destinoDir, p.Diretorios);
        var tamanho = new FileInfo(o).Length;
        File.Move(o, d, sobrescrever);
        return File.Exists(d) && !File.Exists(o) && new FileInfo(d).Length == tamanho
            ? Resultado.Feito($"{Path.GetFileName(o)} movido para {Path.GetFileName(destinoDir)}.")
            : Resultado.SemConfirmacao("O sistema aceitou mover, mas não consegui confirmar o arquivo no destino.");
    }

    // ------------------------------------------------------------ energia

    private const uint MotivoPlanejado = 0x80000000 | 0x00040000; // SHTDN_REASON_FLAG_PLANNED | MAJOR_APPLICATION

    private static Resultado Energia(JsonObject prm)
    {
        var acao = (string?)prm["acao"] ?? "";
        switch (acao)
        {
            case "bloquear":
                return Win32.LockWorkStation() ? Resultado.Feito("Tela bloqueada.") : Resultado.Falha("O Windows recusou bloquear.");
            case "cancelar_desligamento":
                Win32.HabilitarDesligamento();
                return Win32.AbortSystemShutdown(null) ? Resultado.Feito("Desligamento cancelado.") : Resultado.Falha("Não havia desligamento agendado.");
            case "desligar":
            case "reiniciar":
                if (!Win32.HabilitarDesligamento()) return Resultado.Falha("Sem privilégio de desligamento nesta sessão.");
                // 30s de aviso; pode ser abortado pela bandeja ou por "cancelar_desligamento" (SR-17). Sem `force`.
                return Win32.InitiateSystemShutdownEx(null, "O Oracle vai " + (acao == "desligar" ? "desligar" : "reiniciar") + " o computador em 30 segundos.", 30, false, acao == "reiniciar", MotivoPlanejado)
                    ? Resultado.Feito((acao == "desligar" ? "Desligamento" : "Reinício") + " agendado para daqui a 30 segundos.")
                    : Resultado.Falha("O Windows recusou o desligamento.");
            case "encerrar_sessao":
                return Agendador.EncerrarSessaoEm30s()
                    ? Resultado.Feito("A sessão será encerrada em 30 segundos (dá para cancelar pela bandeja do Oracle).")
                    : Resultado.Falha("Já existe um encerramento agendado.");
            default:
                throw new OperacaoRecusada("Ação de energia inválida.");
        }
    }
}

/// <summary>Encerramento de sessão com 30s de aviso, cancelável pela bandeja.</summary>
internal static class Agendador
{
    private static CancellationTokenSource? _logoff;

    public static bool EncerrarSessaoEm30s()
    {
        if (_logoff is not null) return false;
        var cts = _logoff = new CancellationTokenSource();
        _ = Task.Run(async () =>
        {
            try
            {
                await Task.Delay(TimeSpan.FromSeconds(30), cts.Token);
                Win32.ExitWindowsEx(Win32.EWX_LOGOFF, MotivoPlanejadoLogoff);
            }
            catch (OperationCanceledException) { }
            finally { _logoff = null; }
        });
        return true;
    }

    private const uint MotivoPlanejadoLogoff = 0x80000000 | 0x00040000;

    public static bool CancelarTudo()
    {
        var algo = false;
        if (_logoff is { } c) { c.Cancel(); algo = true; }
        Win32.HabilitarDesligamento();
        if (Win32.AbortSystemShutdown(null)) algo = true;
        return algo;
    }
}
