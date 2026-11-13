using OracleAgent.Operacoes;

namespace OracleAgent;

/// <summary>
/// Ícone na bandeja: estado, "Parar tudo"/"Retomar", revisão de ampliações de
/// permissão (SR-35, com o diff exato), impressões digitais e sair.
/// </summary>
internal sealed class Bandeja : ApplicationContext
{
    private readonly Agente _agente;
    private readonly NotifyIcon _icone;
    private readonly ToolStripMenuItem _estado = new() { Enabled = false };
    private readonly ToolStripMenuItem _parar = new("Parar tudo");
    private readonly ToolStripMenuItem _retomar = new("Retomar");
    private readonly ToolStripMenuItem _revisar = new("Revisar permissões pendentes…");
    private readonly CancellationTokenSource _cts = new();
    private readonly SynchronizationContext _ui;
    private bool _avisouAmpliacao;

    public Bandeja(Agente agente)
    {
        _agente = agente;
        var menu = new ContextMenuStrip();
        menu.Items.Add(_estado);
        menu.Items.Add(new ToolStripSeparator());
        menu.Items.Add(_parar);
        menu.Items.Add(_retomar);
        menu.Items.Add(_revisar);
        menu.Items.Add(new ToolStripMenuItem("Cancelar desligamento/encerramento", null, (_, _) =>
            Avisar(Agendador.CancelarTudo() ? "Cancelado." : "Nada agendado.")));
        menu.Items.Add(new ToolStripMenuItem("Impressões digitais…", null, (_, _) => MessageBox.Show(
            $"Este computador: {_agente.ImpressaoDispositivo}\nServidor Oracle: {_agente.ImpressaoServidor}\n\nConfira com o que aparece em Configurações > Ambiente local.",
            "Oracle — Ambiente local", MessageBoxButtons.OK, MessageBoxIcon.Information)));
        menu.Items.Add(new ToolStripSeparator());
        menu.Items.Add(new ToolStripMenuItem("Sair", null, (_, _) => Sair()));

        _parar.Click += (_, _) => { _agente.PararTudo(); Avisar("Tudo parado. O Oracle não vai agir neste computador até você retomar."); };
        _retomar.Click += (_, _) => _agente.Retomar();
        _revisar.Click += (_, _) => Revisar();

        _icone = new NotifyIcon { Icon = SystemIcons.Shield, Visible = true, ContextMenuStrip = menu, Text = "Oracle — Ambiente local" };
        // Clique no ícone (botão esquerdo) com permissões pendentes abre a revisão direto.
        _icone.MouseClick += (_, e) => { if (e.Button == MouseButtons.Left && _agente.AmpliacaoPendente) Revisar(); };
        _icone.BalloonTipClicked += (_, _) => { if (_agente.AmpliacaoPendente) Revisar(); };
        // O loop de rede roda em outra thread: a UI só é tocada na thread dela.
        _ui = SynchronizationContext.Current ?? new WindowsFormsSynchronizationContext();
        _agente.Mudou += () => _ui.Post(_ => Atualizar(), null);
        Atualizar();
        _ = Task.Run(() => _agente.Rodar(_cts.Token));
    }

    private void Atualizar()
    {
        var estado = _agente.ParadoLocal ? "Parado (bandeja)" : _agente.EstadoServidor switch
        {
            "conectado" => "Conectado",
            "pendente" => "Aguardando confirmação em Configurações",
            "bloqueado" => "Parado pelo Oracle",
            "revogado" => "Desconectado (revogado)",
            "erro" => "Sem comunicação",
            _ => "Inicializando",
        };
        _estado.Text = "Estado: " + estado;
        _icone.Text = ("Oracle — " + estado)[..Math.Min(63, ("Oracle — " + estado).Length)];
        _parar.Visible = !_agente.ParadoLocal;
        _retomar.Visible = _agente.ParadoLocal;
        _revisar.Visible = _agente.AmpliacaoPendente;
        if (_agente.AmpliacaoPendente && !_avisouAmpliacao)
        {
            _avisouAmpliacao = true;
            Avisar("O Oracle pediu novas permissões neste computador. Clique aqui (ou no ícone do escudo) para revisar.");
        }
        if (!_agente.AmpliacaoPendente) _avisouAmpliacao = false;
        if (_agente.EstadoServidor == "revogado") Avisar("Este computador foi desconectado do Oracle.");
    }

    private bool _revisando;

    private void Revisar()
    {
        if (_revisando) return;
        _revisando = true;
        try { RevisarUmaVez(); } finally { _revisando = false; }
    }

    private void RevisarUmaVez()
    {
        // GB-02: o "Sim" vale só para a versão e o diff exibidos agora.
        var (versao, lista) = _agente.AmpliacoesPendentes();
        if (lista.Count == 0) return;
        _agente.Registrar("politica.revisao_aberta", new { versao, itens = lista.Count });
        var texto = $"O Oracle quer AMPLIAR o que pode fazer neste computador (política v{versao}):\n\n• " + string.Join("\n• ", lista) +
                    "\n\nSe não foi você que pediu em Configurações > Ambiente local, clique em Não.";
        var resposta = MessageBox.Show(texto, "Oracle — novas permissões", MessageBoxButtons.YesNo, MessageBoxIcon.Warning,
            MessageBoxDefaultButton.Button2, MessageBoxOptions.DefaultDesktopOnly);
        if (resposta != DialogResult.Yes)
        {
            _agente.Registrar("politica.revisao_negada", new { versao });
            return;
        }
        if (_agente.ConfirmarAmpliacao(versao))
        {
            Avisar($"Permissões confirmadas neste computador (política v{versao}).");
        }
        else
        {
            MessageBox.Show("As permissões pedidas mudaram enquanto esta janela estava aberta. Nada foi aplicado; revise de novo.",
                "Oracle — novas permissões", MessageBoxButtons.OK, MessageBoxIcon.Warning, MessageBoxDefaultButton.Button1, MessageBoxOptions.DefaultDesktopOnly);
        }
    }

    private void Avisar(string msg) => _icone.ShowBalloonTip(5000, "Oracle", msg, ToolTipIcon.Info);

    private void Sair()
    {
        _cts.Cancel();
        _icone.Visible = false;
        _icone.Dispose();
        ExitThread();
    }
}
