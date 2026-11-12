using System.Runtime.InteropServices;
using OracleAgent.Canal;
using OracleAgent.Seguranca;

namespace OracleAgent;

/// <summary>
/// CLI do Oracle Local Agent.
///   oracle-agent pair CODIGO --api https://api.exemplo [--nome "PC do escritório"]
///   oracle-agent run [--background]
///   oracle-agent status
///   oracle-agent permissoes   (confirma ampliações de política no console, com o agente parado)
///   oracle-agent unpair
/// </summary>
internal static partial class Programa
{
    public const string Versao = "1.0.0";

    [LibraryImport("kernel32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static partial bool FreeConsole();

    [STAThread]
    public static int Main(string[] args)
    {
        var cmd = args.FirstOrDefault()?.ToLowerInvariant() ?? "run";
        try
        {
            return cmd switch
            {
                "pair" => Parear(args).GetAwaiter().GetResult(),
                "run" => Rodar(args),
                "status" => Status(),
                "permissoes" => RevisarPermissoes().GetAwaiter().GetResult(),
                "unpair" => Desparear(),
                _ => Ajuda(),
            };
        }
        catch (Exception e)
        {
            Console.Error.WriteLine("Erro: " + e.Message);
            return 1;
        }
    }

    private static string? Opcao(string[] args, string nome)
    {
        var i = Array.IndexOf(args, nome);
        return i >= 0 && i + 1 < args.Length ? args[i + 1] : null;
    }

    private static int Ajuda()
    {
        Console.WriteLine("Uso: oracle-agent pair CODIGO --api URL [--nome NOME] | run | status | permissoes | unpair");
        return 2;
    }

    private static async Task<int> Parear(string[] args)
    {
        if (args.Length < 2) return Ajuda();
        var codigo = args[1];
        var api = Opcao(args, "--api") ?? "http://localhost:3001";
        var nome = Opcao(args, "--nome") ?? Environment.MachineName;
        if (!Urls.ApiAceitavel(api, out var uri)) throw new ArgumentException("A API precisa ser https (http só para localhost).");
        if (Configuracao.Carregar() is not null) throw new InvalidOperationException("Este computador já está pareado. Use `oracle-agent unpair` antes.");

        var chave = ChaveDispositivo.Criar();
        try
        {
            using var cliente = new ClienteApi(uri!, null, "");
            var r = await cliente.Parear(codigo, chave.PublicaSpki(), nome, CancellationToken.None);
            if (ChaveDispositivo.Impressao(r.ChaveServidor) != r.ImpressaoServidor) throw new InvalidOperationException("Resposta do servidor inconsistente.");

            // SR-28 / GA-07: confirmação LOCAL da identidade do servidor.
            Console.WriteLine();
            Console.WriteLine($"Servidor:              {uri}");
            Console.WriteLine($"Impressão do servidor: {r.ImpressaoServidor}");
            Console.WriteLine($"Impressão DESTE PC:    {r.ImpressaoDispositivo}");
            Console.WriteLine();
            Console.WriteLine("Confira se a impressão do servidor é a mesma mostrada em Configurações > Ambiente local.");
            Console.Write("Confirmar o pareamento com este servidor? (s/N) ");
            var resposta = Console.ReadLine()?.Trim().ToLowerInvariant();
            if (resposta is not ("s" or "sim"))
            {
                ChaveDispositivo.Apagar(chave.Nome);
                Console.WriteLine("Pareamento cancelado. Revogue o dispositivo pendente em Configurações > Ambiente local.");
                return 3;
            }

            new Configuracao
            {
                Api = uri!.ToString(),
                DispositivoId = r.DispositivoId,
                NomeChave = chave.Nome,
                ChaveServidor = r.ChaveServidor,
            }.Salvar();
            Console.WriteLine();
            Console.WriteLine("Pronto. Agora, em Configurações > Ambiente local, confirme este computador digitando a impressão:");
            Console.WriteLine($"    {r.ImpressaoDispositivo}");
            Console.WriteLine("Depois rode `oracle-agent run` (ou ative a inicialização com o Windows nas configurações).");
            return 0;
        }
        catch
        {
            ChaveDispositivo.Apagar(chave.Nome);
            throw;
        }
        finally
        {
            chave.Dispose();
        }
    }

    private static int Rodar(string[] args)
    {
        var cfg = Configuracao.Carregar() ?? throw new InvalidOperationException("Este computador não está pareado. Use `oracle-agent pair CODIGO --api URL`.");
        using var unico = new Mutex(true, @"Local\OracleLocalAgent", out var primeiro);
        if (!primeiro) throw new InvalidOperationException("O agente já está rodando.");
        if (args.Contains("--background")) FreeConsole();
        else Console.WriteLine("Oracle Local Agent rodando na bandeja do Windows. Feche pelo ícone (Sair).");
        Application.SetHighDpiMode(HighDpiMode.SystemAware);
        Application.EnableVisualStyles();
        using var agente = new Agente(cfg, new Log());
        Application.Run(new Bandeja(agente));
        return 0;
    }

    private static int Status()
    {
        var cfg = Configuracao.Carregar();
        if (cfg is null)
        {
            Console.WriteLine("Não pareado.");
            return 0;
        }
        using var chave = ChaveDispositivo.Abrir(cfg.NomeChave);
        Console.WriteLine($"Pareado com {cfg.Api}");
        Console.WriteLine($"Dispositivo:           {cfg.DispositivoId}");
        Console.WriteLine($"Impressão deste PC:    {ChaveDispositivo.Impressao(chave.PublicaSpki())}");
        Console.WriteLine($"Impressão do servidor: {ChaveDispositivo.Impressao(cfg.ChaveServidor)}");
        Console.WriteLine($"Política confirmada:   v{cfg.PoliticaConfirmada.Versao}");
        Console.WriteLine($"Parado localmente:     {(cfg.ParadoLocal ? "sim" : "não")}");
        return 0;
    }

    /// <summary>
    /// SR-35 pelo console: busca a política assinada, mostra o diff de
    /// ampliações e pede confirmação de quem está NESTE computador. Só com o
    /// agente parado (com ele rodando, a confirmação é pela bandeja).
    /// </summary>
    private static async Task<int> RevisarPermissoes()
    {
        var cfg = Configuracao.Carregar() ?? throw new InvalidOperationException("Este computador não está pareado.");
        // GB-11: o mutex fica preso até o fim — o agente não pode iniciar no meio
        // e ter o agent.json sobrescrito.
        using var unico = new Mutex(true, @"Local\OracleLocalAgent", out var livre);
        if (!livre) throw new InvalidOperationException("O agente está rodando: revise as permissões pelo ícone na bandeja.");
        var inventario = Operacoes.Inventario.Montar();
        string NomeApp(string id) => inventario.FirstOrDefault(a => a.Id == id) is { } a ? $"\"{a.Nome}\" ({a.Alvo})" : $"desconhecido ({id})";
        using var chave = ChaveDispositivo.Abrir(cfg.NomeChave);
        using var api = new ClienteApi(new Uri(cfg.Api), chave, cfg.DispositivoId);
        var verificador = new VerificadorEnvelopes(cfg.ChaveServidor, cfg.DispositivoId, DateTimeOffset.UtcNow);
        var resp = await api.Sincronizar(new
        {
            versao = Versao,
            estado = "sincronizando",
            paradoLocal = cfg.ParadoLocal,
            politicaAplicada = cfg.PoliticaConfirmada.Versao,
            confirmacaoLocalPendente = true,
            autoinicio = false,
            esperar = false,
        }, CancellationToken.None);
        var servidor = verificador.AbrirPolitica(resp.Politica);
        if (servidor.Versao < cfg.PoliticaConfirmada.Versao) throw new InvalidOperationException("Política do servidor mais antiga que a confirmada.");
        var diff = PoliticaLocal.Ampliacoes(cfg.PoliticaConfirmada, servidor, NomeApp);
        if (diff.Count == 0)
        {
            cfg.PoliticaConfirmada = servidor; // só restrições: valem sem perguntar
            cfg.Salvar();
            Console.WriteLine($"Nada a ampliar. Política v{servidor.Versao} aplicada.");
            return 0;
        }
        Console.WriteLine("O Oracle quer AMPLIAR o que pode fazer neste computador:");
        foreach (var d in diff) Console.WriteLine("  • " + d);
        Console.Write("Se não foi você que pediu em Configurações > Ambiente local, responda N. Confirmar? (s/N) ");
        var r = Console.ReadLine()?.Trim().ToLowerInvariant();
        if (r is not ("s" or "sim"))
        {
            Console.WriteLine("Nada mudou neste computador.");
            return 3;
        }
        cfg.PoliticaConfirmada = servidor;
        cfg.Salvar();
        Console.WriteLine($"Política v{servidor.Versao} confirmada neste computador.");
        return 0;
    }

    private static int Desparear()
    {
        var cfg = Configuracao.Carregar();
        if (cfg is not null) ChaveDispositivo.Apagar(cfg.NomeChave);
        Configuracao.Apagar();
        Agente.RemoverAutoinicio();
        Console.WriteLine("Chave e configuração locais apagadas. Revogue o dispositivo também em Configurações > Ambiente local.");
        return 0;
    }
}
