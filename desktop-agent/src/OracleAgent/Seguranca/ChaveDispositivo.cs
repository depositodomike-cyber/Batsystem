using System.Security.Cryptography;

namespace OracleAgent.Seguranca;

/// <summary>
/// Identidade do dispositivo (SR-22): ECDSA P-256 no repositório de chaves CNG
/// do usuário, NÃO exportável. A chave privada nunca existe em arquivo nem em
/// memória gerenciada; só assinamos através do provedor.
/// </summary>
internal sealed class ChaveDispositivo : IDisposable
{
    private readonly ECDsaCng _ec;
    public string Nome { get; }

    private ChaveDispositivo(string nome, CngKey key)
    {
        Nome = nome;
        _ec = new ECDsaCng(key);
    }

    public static ChaveDispositivo Criar()
    {
        var nome = "OracleAgent-" + Guid.NewGuid().ToString("N");
        var p = new CngKeyCreationParameters
        {
            ExportPolicy = CngExportPolicies.None,
            KeyUsage = CngKeyUsages.Signing,
            Provider = CngProvider.MicrosoftSoftwareKeyStorageProvider,
            KeyCreationOptions = CngKeyCreationOptions.None,
        };
        return new ChaveDispositivo(nome, CngKey.Create(CngAlgorithm.ECDsaP256, nome, p));
    }

    public static ChaveDispositivo Abrir(string nome) => new(nome, CngKey.Open(nome));

    public static void Apagar(string nome)
    {
        try
        {
            if (CngKey.Exists(nome)) CngKey.Open(nome).Delete();
        }
        catch
        {
            // Já não existe.
        }
    }

    /// <summary>SPKI DER em base64 (o que o servidor guarda).</summary>
    public string PublicaSpki() => Convert.ToBase64String(_ec.ExportSubjectPublicKeyInfo());

    /// <summary>Assinatura IEEE P1363 (r||s, 64 bytes) — o formato que o servidor verifica.</summary>
    public byte[] Assinar(byte[] dados) => _ec.SignData(dados, HashAlgorithmName.SHA256, DSASignatureFormat.IeeeP1363FixedFieldConcatenation);

    public void Dispose() => _ec.Dispose();

    /// <summary>16 hex do SHA-256 da chave pública, em grupos de 4 (SR-28).</summary>
    public static string Impressao(string spkiBase64)
    {
        var hex = Convert.ToHexString(SHA256.HashData(Convert.FromBase64String(spkiBase64)))[..16];
        return string.Join('-', Enumerable.Range(0, 4).Select(i => hex.Substring(i * 4, 4)));
    }
}
