using System.Security.AccessControl;
using System.Security.Principal;
using System.Text.Json;
using System.Text.Json.Serialization;
using OracleAgent.Seguranca;

namespace OracleAgent;

/// <summary>
/// Estado persistido do agente em %LOCALAPPDATA%\Oracle\agent.json, com ACL só
/// do usuário. NÃO contém segredo: a chave privada vive no repositório CNG
/// (não exportável); aqui ficam o id do dispositivo, a chave PÚBLICA fixada
/// do servidor (SR-20) e a política confirmada localmente (SR-35).
/// </summary>
internal sealed class Configuracao
{
    [JsonPropertyName("api")] public string Api { get; set; } = "";
    [JsonPropertyName("dispositivoId")] public string DispositivoId { get; set; } = "";
    [JsonPropertyName("nomeChave")] public string NomeChave { get; set; } = "";
    [JsonPropertyName("chaveServidor")] public string ChaveServidor { get; set; } = "";
    [JsonPropertyName("politicaConfirmada")] public Politica PoliticaConfirmada { get; set; } = Politica.Vazia;
    [JsonPropertyName("ultimaVersaoPolitica")] public int UltimaVersaoPolitica { get; set; }
    [JsonPropertyName("paradoLocal")] public bool ParadoLocal { get; set; }

    public static string Pasta =>
        Environment.GetEnvironmentVariable("ORACLE_AGENT_HOME") is { Length: > 0 } h
            ? h
            : Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Oracle");

    public static string Arquivo => Path.Combine(Pasta, "agent.json");

    private static readonly JsonSerializerOptions Opcoes = new() { WriteIndented = true };

    public static Configuracao? Carregar()
    {
        if (!File.Exists(Arquivo)) return null;
        return JsonSerializer.Deserialize<Configuracao>(File.ReadAllText(Arquivo));
    }

    public void Salvar()
    {
        var dir = Directory.CreateDirectory(Pasta);
        RestringirAoUsuario(dir);
        var tmp = Arquivo + ".tmp";
        File.WriteAllText(tmp, JsonSerializer.Serialize(this, Opcoes));
        File.Move(tmp, Arquivo, overwrite: true);
    }

    public static void Apagar()
    {
        if (File.Exists(Arquivo)) File.Delete(Arquivo);
    }

    /// <summary>ACL: só o usuário atual (sem herança).</summary>
    private static void RestringirAoUsuario(DirectoryInfo dir)
    {
        try
        {
            var sid = WindowsIdentity.GetCurrent().User!;
            var acl = new DirectorySecurity();
            acl.SetAccessRuleProtection(isProtected: true, preserveInheritance: false);
            acl.AddAccessRule(new FileSystemAccessRule(sid, FileSystemRights.FullControl,
                InheritanceFlags.ContainerInherit | InheritanceFlags.ObjectInherit, PropagationFlags.None, AccessControlType.Allow));
            dir.SetAccessControl(acl);
        }
        catch
        {
            // Sem permissão para ajustar a ACL (pasta já existe com outra): segue com a do perfil.
        }
    }
}
