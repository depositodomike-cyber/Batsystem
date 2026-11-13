using System.Diagnostics;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using OracleAgent.Canal;
using OracleAgent.Operacoes;
using OracleAgent.Seguranca;
using Xunit;

namespace OracleAgent.Tests;

public class CaminhosTests
{
    [Theory]
    [InlineData(@"C:\Users\u\Documents\..\..\Windows")]
    [InlineData(@"\\servidor\share\a.pdf")]
    [InlineData(@"\\?\C:\Users\u\a.pdf")]
    [InlineData(@"C:\Users\u\Documents\a.pdf:oculto")]
    [InlineData(@"C:\Users\u\Documents\CON")]
    [InlineData(@"C:\Users\u\Documents\nul.txt")]
    [InlineData(@"Documents\a.pdf")]
    [InlineData(@"C:\Users\u\Documents\pasta.\a.pdf")]
    [InlineData(@"C:\Users\u\Documents\a*.pdf")]
    public void Normalizar_recusa_caminhos_perigosos(string c) => Assert.Null(Caminhos.Normalizar(c));

    [Fact]
    public void Prefixo_exige_separador() =>
        Assert.False(Caminhos.DentroDe(@"C:\Users\u\Documents2\a.pdf", [@"C:\Users\u\Documents"]));

    [Theory]
    [InlineData(@"C:\")]
    [InlineData(@"C:\Windows")]
    [InlineData(@"C:\Program Files\App")]
    [InlineData(@"C:\ProgramData")]
    [InlineData(@"C:\Users\u\AppData\Roaming")]
    [InlineData(@"C:\Users\u\.ssh")]
    public void Diretorios_de_sistema_nunca_autorizados(string d)
    {
        Assert.True(Caminhos.DiretorioProibido(d));
        Assert.False(Caminhos.DentroDe(Path.Combine(d, "x.txt"), [d]));
    }

    [Fact]
    public void Junction_para_fora_da_allowlist_e_recusada()
    {
        using var tmp = new PastaTemporaria();
        var fora = Directory.CreateDirectory(Path.Combine(tmp.Raiz, "fora")).FullName;
        var autorizado = Directory.CreateDirectory(Path.Combine(tmp.Raiz, "autorizado")).FullName;
        var juncao = Path.Combine(autorizado, "atalho");
        var p = Process.Start(new ProcessStartInfo("cmd.exe", $"/c mklink /J \"{juncao}\" \"{fora}\"") { CreateNoWindow = true, UseShellExecute = false })!;
        p.WaitForExit();
        Assert.True(Directory.Exists(juncao), "não foi possível criar a junction de teste");
        File.WriteAllText(Path.Combine(fora, "segredo.txt"), "x");

        var viaJuncao = Path.Combine(juncao, "segredo.txt");
        Assert.True(Caminhos.DentroDe(viaJuncao, [autorizado])); // textualmente parece dentro…
        Assert.True(Caminhos.TemReparsePoint(viaJuncao));        // …mas passa por uma junction
        Assert.Throws<OperacaoRecusada>(() => Caminhos.Exigir(viaJuncao, [autorizado]));
    }
}

public class UrlsTests
{
    [Theory]
    [InlineData("javascript:alert(1)")]
    [InlineData("file:///C:/Windows/system32/calc.exe")]
    [InlineData("ms-settings:privacy")]
    [InlineData("https://user:pw@exemplo.com/")]
    [InlineData("https://exemplo.com/ --flag")]
    [InlineData("https://exemplo.com/\"x")]
    public void Recusa_urls_perigosas(string u) => Assert.Null(Urls.Normalizar(u));

    [Fact]
    public void Dominio_por_rotulos()
    {
        Assert.True(Urls.HostAutorizado("docs.exemplo.com", ["exemplo.com"]));
        Assert.False(Urls.HostAutorizado("evil-exemplo.com", ["exemplo.com"]));
        Assert.False(Urls.HostAutorizado("exemplo.com.evil.com", ["exemplo.com"]));
        Assert.Equal("xn--exmple-cua.com", Urls.Host(Urls.Normalizar("https://exämple.com/")!));
    }

    [Theory]
    [InlineData("http://localhost:3001", true)]
    [InlineData("http://127.0.0.1:3001", true)]
    [InlineData("https://api.exemplo.com", true)]
    [InlineData("http://api.exemplo.com", false)]
    [InlineData("http://192.168.0.10:3001", false)]
    [InlineData("ftp://localhost", false)]
    public void Api_https_ou_http_loopback(string url, bool ok) => Assert.Equal(ok, Urls.ApiAceitavel(url, out _));
}

public class EnvelopesTests
{
    private readonly ECDsa _servidor = ECDsa.Create(ECCurve.NamedCurves.nistP256);
    private string Spki => Convert.ToBase64String(_servidor.ExportSubjectPublicKeyInfo());

    private Envelope Assinar(object obj, ECDsa? chave = null)
    {
        var bytes = JsonSerializer.SerializeToUtf8Bytes(obj);
        var sig = (chave ?? _servidor).SignData(bytes, HashAlgorithmName.SHA256, DSASignatureFormat.IeeeP1363FixedFieldConcatenation);
        return new Envelope(Convert.ToBase64String(bytes), Convert.ToBase64String(sig));
    }

    private object Comando(string id = "c1", string nonce = "n1", string disp = "d1", string tipo = "comando", TimeSpan? emitido = null, TimeSpan? validade = null)
    {
        var e = DateTimeOffset.UtcNow + (emitido ?? TimeSpan.Zero);
        return new
        {
            tipo, dispositivoId = disp, id, operacao = "abrir_aplicativo", parametros = new { aplicativoId = "x" },
            risco = "moderado", nonce, emitidoEm = e.ToString("O"), expiraEm = (e + (validade ?? TimeSpan.FromSeconds(60))).ToString("O"), versaoPolitica = 1,
        };
    }

    private VerificadorEnvelopes V() => new(Spki, "d1", DateTimeOffset.UtcNow.AddMinutes(-1));

    [Fact]
    public void Comando_valido() => Assert.Equal("c1", V().AbrirComando(Assinar(Comando())).Id);

    [Fact]
    public void Assinatura_de_outra_chave()
    {
        using var outra = ECDsa.Create(ECCurve.NamedCurves.nistP256);
        Assert.Throws<OperacaoRecusada>(() => V().AbrirComando(Assinar(Comando(), outra)));
    }

    [Fact]
    public void Payload_adulterado()
    {
        var env = Assinar(Comando());
        var adulterado = Convert.ToBase64String(JsonSerializer.SerializeToUtf8Bytes(Comando(id: "c2")));
        Assert.Throws<OperacaoRecusada>(() => V().AbrirComando(env with { Payload = adulterado }));
    }

    [Fact]
    public void Outro_dispositivo_ou_tipo_errado()
    {
        Assert.Throws<OperacaoRecusada>(() => V().AbrirComando(Assinar(Comando(disp: "d2"))));
        Assert.Throws<OperacaoRecusada>(() => V().AbrirComando(Assinar(Comando(tipo: "politica"))));
        Assert.Throws<OperacaoRecusada>(() => V().AbrirPolitica(Assinar(Comando())));
    }

    [Fact]
    public void Replay_de_id_ou_nonce()
    {
        var v = V();
        v.AbrirComando(Assinar(Comando()));
        Assert.Throws<OperacaoRecusada>(() => v.AbrirComando(Assinar(Comando())));
        Assert.Throws<OperacaoRecusada>(() => v.AbrirComando(Assinar(Comando(id: "c9"))));      // mesmo nonce
        Assert.Throws<OperacaoRecusada>(() => v.AbrirComando(Assinar(Comando(nonce: "n9"))));   // mesmo id
    }

    [Fact]
    public void Vencido_validade_longa_futuro_ou_antes_do_inicio()
    {
        Assert.Throws<OperacaoRecusada>(() => V().AbrirComando(Assinar(Comando(emitido: TimeSpan.FromSeconds(-70)))));
        Assert.Throws<OperacaoRecusada>(() => V().AbrirComando(Assinar(Comando(validade: TimeSpan.FromHours(1)))));
        Assert.Throws<OperacaoRecusada>(() => V().AbrirComando(Assinar(Comando(emitido: TimeSpan.FromMinutes(1)))));
        var recemIniciado = new VerificadorEnvelopes(Spki, "d1", DateTimeOffset.UtcNow);
        Assert.Throws<OperacaoRecusada>(() => recemIniciado.AbrirComando(Assinar(Comando(emitido: TimeSpan.FromSeconds(-30)))));
    }

    [Fact]
    public void Mensagem_assinada_igual_a_do_servidor()
    {
        // Mesmo formato de ts/api/src/desktop/assinatura.ts (mensagemRequisicao).
        var m = Encoding.UTF8.GetString(ClienteApi.MensagemAssinada("POST", "/desktop/agente/sincronizar", "1700000000000", "ab", "{}"u8.ToArray()));
        Assert.Equal("POST\n/desktop/agente/sincronizar\n1700000000000\nab\n44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a", m);
    }
}

public class PoliticaLocalTests
{
    private static Politica P(int v, string[]? apps = null, string[]? dirs = null, Dictionary<string, bool>? perm = null, string[]? confirmar = null, bool auto = false) => new()
    {
        Versao = v, Apps = [.. apps ?? []], Diretorios = [.. dirs ?? []], Permissoes = perm ?? new(), Confirmar = [.. confirmar ?? []], Autoinicio = auto,
    };

    [Fact]
    public void Ampliacao_so_vale_depois_da_bandeja()
    {
        var pl = new PoliticaLocal(P(1));
        pl.Receber(P(2, apps: ["a"], dirs: [@"C:\Users\u\Documents"], perm: new() { ["apps"] = true }, auto: true));
        Assert.Empty(pl.Efetiva.Apps);
        Assert.False(pl.Efetiva.Categoria("apps"));
        Assert.False(pl.Efetiva.Autoinicio);
        Assert.True(pl.AmpliacaoPendente);
        Assert.Equal(4, pl.AmpliacoesPendentes().Count);
        Assert.True(pl.ConfirmarAmpliacao(2));
        Assert.Contains("a", pl.Efetiva.Apps);
        Assert.True(pl.Efetiva.Categoria("apps"));
    }

    [Fact]
    public void GB02_confirmacao_vale_so_para_a_versao_exibida()
    {
        var pl = new PoliticaLocal(P(1));
        pl.Receber(P(2, apps: ["a"], perm: new() { ["apps"] = true }));
        var (versao, diff) = pl.Instantaneo(id => "App " + id);
        Assert.Contains(diff, d => d.Contains("App a"));
        // Enquanto o diálogo está aberto, o servidor amplia mais (JWT roubado).
        pl.Receber(P(3, apps: ["a", "malicioso"], perm: new() { ["apps"] = true, ["energia"] = true }));
        Assert.False(pl.ConfirmarAmpliacao(versao));
        Assert.Empty(pl.Efetiva.Apps);
        Assert.False(pl.Efetiva.Categoria("energia"));
        Assert.True(pl.ConfirmarAmpliacao(pl.Instantaneo().Versao));
        Assert.Contains("malicioso", pl.Efetiva.Apps);
    }

    [Fact]
    public void GB02_concorrencia_sem_estado_inconsistente()
    {
        var pl = new PoliticaLocal(P(1));
        Parallel.For(2, 2000, v =>
        {
            pl.Receber(P(v, apps: ["a"], perm: new() { ["apps"] = true }));
            var s = pl.Instantaneo();
            pl.ConfirmarAmpliacao(s.Versao);
        });
        // A efetiva é sempre a interseção da confirmada com a do servidor.
        Assert.True(pl.Efetiva.Apps.All(a => pl.Confirmada.Apps.Contains(a)));
    }

    [Fact]
    public void Restricao_vale_na_hora()
    {
        var pl = new PoliticaLocal(P(2, apps: ["a", "b"], perm: new() { ["apps"] = true, ["midia"] = true }));
        pl.Receber(P(3, apps: ["a"], perm: new() { ["apps"] = true }));
        Assert.Equal(["a"], pl.Efetiva.Apps);
        Assert.False(pl.Efetiva.Categoria("midia"));
        Assert.False(pl.AmpliacaoPendente);
    }

    [Fact]
    public void Tirar_de_pedir_confirmacao_e_ampliacao()
    {
        var pl = new PoliticaLocal(P(1, confirmar: ["abrir_url"]));
        pl.Receber(P(2));
        Assert.True(pl.AmpliacaoPendente);
        Assert.Contains("abrir_url", pl.Efetiva.Confirmar);
    }

    [Fact]
    public void Versao_nunca_desce() => Assert.False(new PoliticaLocal(P(5)).Receber(P(4)));
}

public class ExecutorTests
{
    private static Comando C(string op, string risco, JsonObject prm) =>
        new("c", op, prm, risco, DateTimeOffset.UtcNow, DateTimeOffset.UtcNow.AddSeconds(60), 1);

    private static Politica Tudo(params string[] dirs) => new()
    {
        Versao = 1,
        Permissoes = new() { ["apps"] = true, ["documentos"] = true, ["arquivos_escrita"] = true, ["arquivos_busca"] = true, ["energia"] = true, ["navegador"] = true },
        Diretorios = [.. dirs],
        Confirmar = ["criar_pasta"],
    };

    private static Executor E(Politica p) => new(() => p, () => []);

    [Fact]
    public async Task Categoria_desligada_recusa()
    {
        var r = await E(new Politica()).Executar(C("listar_processos", "baixo", new()), default);
        Assert.False(r.Ok);
        Assert.Contains("categoria", r.Erro);
    }

    [Fact]
    public async Task Operacao_sempre_alta_chegando_como_moderada_e_recusada()
    {
        var r = await E(Tudo()).Executar(C("energia", "moderado", new() { ["acao"] = "desligar" }), default);
        Assert.False(r.Ok);
        Assert.Contains("inconsistente", r.Erro);
    }

    [Fact]
    public async Task Operacao_desconhecida_e_recusada()
    {
        var r = await E(Tudo()).Executar(C("executar_comando", "baixo", new() { ["cmd"] = "calc" }), default);
        Assert.False(r.Ok);
    }

    [Fact]
    public async Task Moderado_em_operacao_que_pede_confirmacao_aqui_e_recusado()
    {
        using var tmp = new PastaTemporaria();
        var r = await E(Tudo(tmp.Raiz)).Executar(C("criar_pasta", "moderado", new() { ["caminho"] = Path.Combine(tmp.Raiz, "x") }), default);
        Assert.False(r.Ok);
        Assert.False(Directory.Exists(Path.Combine(tmp.Raiz, "x")));
    }

    [Fact]
    public async Task Criar_pasta_alto_aprovado_cria_e_verifica()
    {
        using var tmp = new PastaTemporaria();
        var r = await E(Tudo(tmp.Raiz)).Executar(C("criar_pasta", "alto", new() { ["caminho"] = Path.Combine(tmp.Raiz, "Projetos") }), default);
        Assert.True(r.Ok && r.Verificado, r.Erro);
        Assert.True(Directory.Exists(Path.Combine(tmp.Raiz, "Projetos")));
    }

    [Fact]
    public async Task Abrir_executavel_como_documento_e_recusado_mesmo_com_alto()
    {
        using var tmp = new PastaTemporaria();
        var exe = Path.Combine(tmp.Raiz, "x.exe");
        File.WriteAllText(exe, "MZ");
        foreach (var risco in new[] { "moderado", "alto" })
        {
            var r = await E(Tudo(tmp.Raiz)).Executar(C("abrir_documento", risco, new() { ["caminho"] = exe }), default);
            Assert.False(r.Ok);
        }
    }

    [Fact]
    public async Task Fora_do_diretorio_autorizado_e_recusado()
    {
        using var tmp = new PastaTemporaria();
        var r = await E(Tudo(Path.Combine(tmp.Raiz, "a"))).Executar(
            C("criar_pasta", "alto", new() { ["caminho"] = Path.Combine(tmp.Raiz, "b") }), default);
        Assert.False(r.Ok);
    }

    [Fact]
    public async Task Mover_nao_troca_extensao_e_verifica_destino()
    {
        using var tmp = new PastaTemporaria();
        var o = Path.Combine(tmp.Raiz, "a.pdf");
        File.WriteAllText(o, "%PDF");
        var ruim = await E(Tudo(tmp.Raiz)).Executar(C("mover_arquivo", "moderado", new() { ["origem"] = o, ["destino"] = Path.Combine(tmp.Raiz, "a.exe") }), default);
        Assert.False(ruim.Ok);
        Directory.CreateDirectory(Path.Combine(tmp.Raiz, "sub"));
        var bom = await E(Tudo(tmp.Raiz)).Executar(C("mover_arquivo", "moderado", new() { ["origem"] = o, ["destino"] = Path.Combine(tmp.Raiz, "sub", "a.pdf") }), default);
        Assert.True(bom.Ok && bom.Verificado, bom.Erro);
    }

    [Fact]
    public async Task App_fora_da_politica_local_e_recusado()
    {
        var r = await E(Tudo()).Executar(C("abrir_aplicativo", "moderado", new() { ["aplicativoId"] = "abc" }), default);
        Assert.False(r.Ok);
    }
}

public class InventarioTests
{
    [Theory]
    [InlineData(@"C:\Windows\System32\cmd.exe")]
    [InlineData(@"C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe")]
    [InlineData(@"C:\Windows\System32\mshta.exe")]
    [InlineData(@"C:\Windows\System32\rundll32.exe")]
    [InlineData(@"\\servidor\app.exe")]
    [InlineData(@"C:\Windows\System32\notepad.txt")]
    public void LOLBins_e_alvos_invalidos_ficam_fora(string alvo) => Assert.False(Inventario.AlvoAceitavel(alvo));

    [Fact]
    public void Notepad_e_aceitavel() => Assert.True(Inventario.AlvoAceitavel(@"C:\Windows\System32\notepad.exe"));
}

/// <summary>Pasta temporária DENTRO do perfil (AppData é proibido de propósito).</summary>
internal sealed class PastaTemporaria : IDisposable
{
    public string Raiz { get; } = Directory.CreateDirectory(
        Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), "OracleAgentTestes-" + Guid.NewGuid().ToString("N")[..8])).FullName;

    public void Dispose()
    {
        try { Directory.Delete(Raiz, recursive: true); } catch { }
    }
}

public class ChaveDispositivoTests
{
    [Fact]
    public void Chave_CNG_nao_exportavel_assina_e_exporta_so_a_publica()
    {
        using var k = ChaveDispositivo.Criar();
        try
        {
            var spki = k.PublicaSpki();
            var dados = "mensagem"u8.ToArray();
            var sig = k.Assinar(dados);
            Assert.Equal(64, sig.Length);
            using var pub = ECDsa.Create();
            pub.ImportSubjectPublicKeyInfo(Convert.FromBase64String(spki), out _);
            Assert.True(pub.VerifyData(dados, sig, HashAlgorithmName.SHA256, DSASignatureFormat.IeeeP1363FixedFieldConcatenation));
            using var cng = CngKey.Open(k.Nome);
            Assert.Equal(CngExportPolicies.None, cng.ExportPolicy);
            Assert.ThrowsAny<CryptographicException>(() => cng.Export(CngKeyBlobFormat.EccPrivateBlob));
        }
        finally
        {
            ChaveDispositivo.Apagar(k.Nome);
        }
        Assert.False(CngKey.Exists(k.Nome));
    }
}

public class GB01Tests
{
    [Theory]
    [InlineData(@"C:\Users\u\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup\x.pdf")]
    [InlineData(@"C:\Users\u\AppData\Local\Oracle\agent.json")]
    [InlineData(@"C:\Users\u\.ssh\id_rsa.txt")]
    [InlineData(@"C:\Users\u\SSH~1\a.pdf")]
    [InlineData(@"C:\PROGRA~1\x.pdf")]
    [InlineData(@"C:\Users\u\Documents\Startup\a.pdf")]
    public void Alvos_proibidos_mesmo_com_a_home_autorizada(string alvo) =>
        Assert.False(Caminhos.DentroDe(alvo, [@"C:\Users\u"]));

    [Theory]
    [InlineData("x.exe")]
    [InlineData("x.lnk")]
    [InlineData("x.bat")]
    [InlineData("semext")]
    [InlineData("x.json")]
    public async Task Mover_so_documentos(string nome)
    {
        using var tmp = new PastaTemporaria();
        var o = Path.Combine(tmp.Raiz, nome);
        File.WriteAllText(o, "x");
        Directory.CreateDirectory(Path.Combine(tmp.Raiz, "sub"));
        var p = new Politica { Versao = 1, Permissoes = new() { ["arquivos_escrita"] = true }, Diretorios = [tmp.Raiz] };
        var r = await new Executor(() => p, () => []).Executar(
            new Comando("c", "mover_arquivo", new JsonObject { ["origem"] = o, ["destino"] = Path.Combine(tmp.Raiz, "sub", nome) }, "moderado",
                DateTimeOffset.UtcNow, DateTimeOffset.UtcNow.AddSeconds(60), 1), default);
        Assert.False(r.Ok);
        Assert.True(File.Exists(o));
    }

    [Fact]
    public void GB06_caminho_final_detecta_junction()
    {
        using var tmp = new PastaTemporaria();
        var fora = Directory.CreateDirectory(Path.Combine(tmp.Raiz, "fora")).FullName;
        var aut = Directory.CreateDirectory(Path.Combine(tmp.Raiz, "aut")).FullName;
        var j = Path.Combine(aut, "j");
        Process.Start(new ProcessStartInfo("cmd.exe", $"/c mklink /J \"{j}\" \"{fora}\"") { CreateNoWindow = true, UseShellExecute = false })!.WaitForExit();
        Assert.Throws<OperacaoRecusada>(() => Caminhos.ConferirFinal(j, [aut]));
        Caminhos.ConferirFinal(aut, [aut]); // pasta normal passa
    }
}

public class PacotesTests
{
    [Theory]
    [InlineData("Claude", "Claude_pzs8sxrjxfjjc!Claude", true)]
    [InlineData("Spotify", "SpotifyAB.SpotifyMusic_zpdnekdrzrea0!Spotify", true)]
    [InlineData("WhatsApp", "5319275A.WhatsAppDesktop_cv1g1gvanyjgm!App", true)]
    [InlineData("Terminal", "Microsoft.WindowsTerminal_8wekyb3d8bbwe!App", false)]
    [InlineData("PowerShell", "Microsoft.PowerShell_8wekyb3d8bbwe!Pwsh", false)]
    [InlineData("Configurações", "windows.immersivecontrolpanel_cw5n1h2txyewy!microsoft.windows.immersivecontrolpanel", false)]
    [InlineData("Chrome", "Chrome", false)]
    [InlineData("x", @"C:\Windows\System32\cmd.exe", false)]
    [InlineData("x", "Evil_abcdefghijklm!App & calc", false)]
    public void Store_apps_aceitos_e_de_sistema_bloqueados(string nome, string aumid, bool ok)
    {
        var app = Inventario.AvaliarPacote(nome, aumid);
        Assert.Equal(ok, app is not null);
        if (app is not null)
        {
            Assert.True(Inventario.EhPacote(app.Alvo));
            Assert.True(Inventario.AlvoAceitavel(app.Alvo));
            Assert.Equal(aumid, Inventario.Aumid(app.Alvo));
        }
    }
}
