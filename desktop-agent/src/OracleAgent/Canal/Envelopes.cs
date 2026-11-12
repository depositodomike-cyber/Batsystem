using System.Security.Cryptography;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.Json.Serialization;
using OracleAgent.Seguranca;

namespace OracleAgent.Canal;

internal sealed record Envelope(
    [property: JsonPropertyName("payload")] string Payload,
    [property: JsonPropertyName("assinatura")] string Assinatura);

/// <summary>Comando já verificado e interpretado.</summary>
internal sealed record Comando(
    string Id,
    string Operacao,
    JsonObject Parametros,
    string Risco,
    DateTimeOffset EmitidoEm,
    DateTimeOffset ExpiraEm,
    int VersaoPolitica);

/// <summary>
/// Verificação dos envelopes do servidor (SR-20, SR-21, SR-27, SR-29):
/// assinatura sobre os BYTES exatos ANTES de interpretar o JSON; tipo certo
/// no canal certo; destinado a ESTE dispositivo; dentro da validade; emitido
/// depois que o agente iniciou; id e nonce nunca vistos.
/// </summary>
internal sealed class VerificadorEnvelopes
{
    private readonly ECDsa _servidor;
    private readonly string _dispositivoId;
    private readonly DateTimeOffset _inicio;
    private readonly Func<DateTimeOffset> _agora;
    private readonly Dictionary<string, DateTimeOffset> _vistos = new();
    private static readonly TimeSpan Tolerancia = TimeSpan.FromSeconds(5);
    private static readonly TimeSpan ValidadeMaxima = TimeSpan.FromSeconds(65);

    public VerificadorEnvelopes(string chaveServidorSpki, string dispositivoId, DateTimeOffset inicio, Func<DateTimeOffset>? agora = null)
    {
        _servidor = ECDsa.Create();
        _servidor.ImportSubjectPublicKeyInfo(Convert.FromBase64String(chaveServidorSpki), out _);
        _dispositivoId = dispositivoId;
        _inicio = inicio;
        _agora = agora ?? (() => DateTimeOffset.UtcNow);
    }

    private JsonObject Abrir(Envelope e, string tipoEsperado)
    {
        byte[] bytes, sig;
        try
        {
            bytes = Convert.FromBase64String(e.Payload);
            sig = Convert.FromBase64String(e.Assinatura);
        }
        catch (FormatException)
        {
            throw new OperacaoRecusada("Envelope malformado.");
        }
        if (sig.Length != 64 || !_servidor.VerifyData(bytes, sig, HashAlgorithmName.SHA256, DSASignatureFormat.IeeeP1363FixedFieldConcatenation))
        {
            throw new OperacaoRecusada("Assinatura do servidor inválida.");
        }
        var obj = JsonNode.Parse(bytes) as JsonObject ?? throw new OperacaoRecusada("Envelope sem objeto.");
        if ((string?)obj["tipo"] != tipoEsperado) throw new OperacaoRecusada("Tipo de envelope inesperado.");
        if ((string?)obj["dispositivoId"] != _dispositivoId) throw new OperacaoRecusada("Envelope destinado a outro dispositivo.");
        return obj;
    }

    public Politica AbrirPolitica(Envelope e)
    {
        var obj = Abrir(e, "politica");
        return obj.Deserialize<Politica>() ?? throw new OperacaoRecusada("Política ilegível.");
    }

    public Comando AbrirComando(Envelope e)
    {
        var obj = Abrir(e, "comando");
        var id = (string?)obj["id"] ?? throw new OperacaoRecusada("Comando sem id.");
        var nonce = (string?)obj["nonce"] ?? throw new OperacaoRecusada("Comando sem nonce.");
        var emitido = DateTimeOffset.Parse((string?)obj["emitidoEm"] ?? throw new OperacaoRecusada("Comando sem emissão."));
        var expira = DateTimeOffset.Parse((string?)obj["expiraEm"] ?? throw new OperacaoRecusada("Comando sem validade."));
        var agora = _agora();
        if (expira <= agora) throw new OperacaoRecusada("Comando vencido.");
        if (expira - emitido > ValidadeMaxima) throw new OperacaoRecusada("Validade do comando longa demais.");
        if (emitido < _inicio - Tolerancia) throw new OperacaoRecusada("Comando emitido antes do agente iniciar.");
        if (emitido > agora + Tolerancia) throw new OperacaoRecusada("Comando emitido no futuro.");

        foreach (var k in _vistos.Where(kv => kv.Value < agora).Select(kv => kv.Key).ToList()) _vistos.Remove(k);
        if (_vistos.ContainsKey("id:" + id) || _vistos.ContainsKey("n:" + nonce)) throw new OperacaoRecusada("Comando repetido.");
        _vistos["id:" + id] = expira + Tolerancia;
        _vistos["n:" + nonce] = expira + Tolerancia;

        return new Comando(
            id,
            (string?)obj["operacao"] ?? "",
            obj["parametros"] as JsonObject ?? new JsonObject(),
            (string?)obj["risco"] ?? "bloqueado",
            emitido,
            expira,
            (int?)obj["versaoPolitica"] ?? 0);
    }
}
