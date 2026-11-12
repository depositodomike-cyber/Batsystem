using System.Net;
using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using OracleAgent.Seguranca;

namespace OracleAgent.Canal;

internal sealed class DispositivoRevogadoException() : Exception("O dispositivo foi desconectado do Oracle.");

internal sealed record RespostaPareamento(
    [property: JsonPropertyName("dispositivoId")] string DispositivoId,
    [property: JsonPropertyName("chaveServidor")] string ChaveServidor,
    [property: JsonPropertyName("impressaoServidor")] string ImpressaoServidor,
    [property: JsonPropertyName("impressaoDispositivo")] string ImpressaoDispositivo);

internal sealed record RespostaSincronizar(
    [property: JsonPropertyName("estado")] string Estado,
    [property: JsonPropertyName("politica")] Envelope Politica,
    [property: JsonPropertyName("comandos")] List<Envelope> Comandos);

/// <summary>
/// Cliente HTTP do agente. A conexão é SEMPRE de saída (SR-24): nenhuma porta
/// é aberta neste computador. Toda requisição é assinada com a chave do
/// dispositivo (SR-22): MÉTODO\nCAMINHO\nTIMESTAMP\nNONCE\nSHA256(corpo).
/// </summary>
internal sealed class ClienteApi : IDisposable
{
    private readonly HttpClient _http;
    private readonly ChaveDispositivo? _chave;
    private readonly string _dispositivoId;

    public ClienteApi(Uri api, ChaveDispositivo? chave, string dispositivoId)
    {
        if (!Urls.ApiAceitavel(api.ToString(), out var baseUri)) throw new ArgumentException("A API precisa ser https (ou http em localhost).");
        _http = new HttpClient(new SocketsHttpHandler { AllowAutoRedirect = false, UseProxy = true })
        {
            BaseAddress = baseUri,
            Timeout = TimeSpan.FromSeconds(45),
        };
        _http.DefaultRequestHeaders.UserAgent.Add(new ProductInfoHeaderValue("OracleAgent", Programa.Versao));
        _chave = chave;
        _dispositivoId = dispositivoId;
    }

    private static readonly JsonSerializerOptions Json = new() { DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull };

    internal static byte[] MensagemAssinada(string metodo, string caminho, string ts, string nonce, byte[] corpo) =>
        Encoding.UTF8.GetBytes($"{metodo}\n{caminho}\n{ts}\n{nonce}\n{Convert.ToHexString(SHA256.HashData(corpo)).ToLowerInvariant()}");

    private async Task<T> Post<T>(string caminho, object corpo, bool assinar, CancellationToken ct)
    {
        var bytes = JsonSerializer.SerializeToUtf8Bytes(corpo, Json);
        using var req = new HttpRequestMessage(HttpMethod.Post, caminho) { Content = new ByteArrayContent(bytes) };
        req.Content.Headers.ContentType = new MediaTypeHeaderValue("application/json");
        if (assinar)
        {
            if (_chave is null) throw new InvalidOperationException("Sem chave do dispositivo.");
            var ts = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds().ToString();
            var nonce = Convert.ToHexString(RandomNumberGenerator.GetBytes(16)).ToLowerInvariant();
            var sig = _chave.Assinar(MensagemAssinada("POST", caminho, ts, nonce, bytes));
            req.Headers.Add("X-Oracle-Dispositivo", _dispositivoId);
            req.Headers.Add("X-Oracle-Timestamp", ts);
            req.Headers.Add("X-Oracle-Nonce", nonce);
            req.Headers.Add("X-Oracle-Assinatura", Convert.ToBase64String(sig));
        }
        using var resp = await _http.SendAsync(req, ct);
        if (resp.StatusCode == HttpStatusCode.Unauthorized && assinar) throw new DispositivoRevogadoException();
        if (!resp.IsSuccessStatusCode)
        {
            var texto = await resp.Content.ReadAsStringAsync(ct);
            throw new HttpRequestException($"API respondeu {(int)resp.StatusCode}: {texto[..Math.Min(texto.Length, 300)]}");
        }
        return await resp.Content.ReadFromJsonAsyncSafe<T>(ct);
    }

    public Task<RespostaPareamento> Parear(string codigo, string chavePublica, string nome, CancellationToken ct) =>
        Post<RespostaPareamento>("/desktop/agente/parear", new { codigo, chavePublica, nome, versao = Programa.Versao }, assinar: false, ct);

    public Task<RespostaSincronizar> Sincronizar(object corpo, CancellationToken ct) =>
        Post<RespostaSincronizar>("/desktop/agente/sincronizar", corpo, assinar: true, ct);

    public Task<JsonElement> EnviarResultado(object corpo, CancellationToken ct) =>
        Post<JsonElement>("/desktop/agente/resultados", corpo, assinar: true, ct);

    public void Dispose() => _http.Dispose();
}

internal static class HttpExt
{
    public static async Task<T> ReadFromJsonAsyncSafe<T>(this HttpContent c, CancellationToken ct)
    {
        await using var s = await c.ReadAsStreamAsync(ct);
        return await JsonSerializer.DeserializeAsync<T>(s, cancellationToken: ct) ?? throw new HttpRequestException("Resposta vazia.");
    }
}
