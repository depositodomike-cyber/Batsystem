import { BadRequestException } from '@nestjs/common';
import {
  FerramentasConectores,
  formatarEmails,
  formatarEventos,
  MAX_TEXTO_ARQUIVO,
  TRECHO_EMAIL,
} from './conectores';
import { RegistroFerramentasService } from './registro.service';
import type { FerramentasLeitura } from './leitura';
import type { FerramentasEscrita } from './escrita';
import type { FerramentasGeracao } from './geracao';
import type { AuthenticatedUser } from '@/auth/jwt.strategy';

const ctx = {
  user: { id: 'u1', empresaId: 'e1' } as AuthenticatedUser,
  organizacaoId: 'org1',
  repositorioId: null,
};

const email = (i: number, extra: Record<string, unknown> = {}) => ({
  id: `m${i}`,
  remetenteNome: `Pessoa ${i}`,
  remetenteEmail: `p${i}@x.com`,
  para: 'eu@x.com',
  assunto: `Assunto ${i}`,
  data: '2026-11-12T09:30:00Z',
  corpo: `corpo ${i}`,
  ...extra,
});

function montar() {
  const emailSvc = { listInbox: jest.fn().mockResolvedValue([email(1), email(2, { naoLido: true })]) };
  const agenda = { listUpcoming: jest.fn().mockResolvedValue([]) };
  const drive = {
    listar: jest.fn().mockResolvedValue({ arquivos: [], proximaPagina: null }),
    conteudo: jest.fn(),
  };
  const conectores = new FerramentasConectores(emailSvc as never, agenda as never, drive as never);
  const vazio = { todas: () => [] };
  const registro = new RegistroFerramentasService(
    vazio as unknown as FerramentasLeitura,
    vazio as unknown as FerramentasEscrita,
    vazio as unknown as FerramentasGeracao,
    conectores,
    { todas: () => [] } as never,
  );
  return { registro, emailSvc, agenda, drive };
}

describe('ferramentas de conectores', () => {
  it('quatro ferramentas, todas de leitura e exigindo conectores.visualizar', () => {
    const { registro } = montar();
    expect(registro.perfis()).toEqual(
      ['ler_emails', 'ler_agenda', 'buscar_drive', 'ler_arquivo_drive'].map((nome) => ({
        nome,
        risco: 'leitura',
        permissao: 'conectores.visualizar',
        dadosExternos: true,
      })),
    );
  });

  it('ler_emails usa a caixa DO USUÁRIO do contexto', async () => {
    const { registro, emailSvc } = montar();
    const r = await registro.executar('ler_emails', { quantidade: 5 }, ctx);
    expect(emailSvc.listInbox).toHaveBeenCalledWith('e1', 'u1', 'gmail', 5);
    expect(r.ok && r.conteudo).toContain('De: Pessoa 2 <p2@x.com> (não lido) | Assunto: Assunto 2');
  });

  it('ler_emails com filtro busca mais e filtra por remetente/assunto/corpo', async () => {
    const { registro, emailSvc } = montar();
    emailSvc.listInbox.mockResolvedValue([email(1), email(2, { assunto: 'Proposta comercial' })]);
    const r = await registro.executar('ler_emails', { filtro: 'proposta' }, ctx);
    expect(emailSvc.listInbox).toHaveBeenCalledWith('e1', 'u1', 'gmail', 50);
    expect(r.ok && r.conteudo).toContain('Proposta comercial');
    expect(r.ok && r.conteudo).not.toContain('Assunto 1');
  });

  it('conta não conectada: a mensagem do serviço chega ao modelo', async () => {
    const { registro, emailSvc } = montar();
    emailSvc.listInbox.mockRejectedValue(
      new BadRequestException('O Gmail ainda não foi autorizado na sua conta. Abra Conectores…'),
    );
    const r = await registro.executar('ler_emails', {}, ctx);
    expect(r).toEqual({ ok: false, erro: 'O Gmail ainda não foi autorizado na sua conta. Abra Conectores…' });
  });

  it('ler_agenda pede a janela de N dias à frente, na agenda do usuário', async () => {
    const { registro, agenda } = montar();
    await registro.executar('ler_agenda', { dias: 3 }, ctx);
    const [emp, usu, prov, lim, janela] = agenda.listUpcoming.mock.calls[0];
    expect([emp, usu, prov, lim]).toEqual(['e1', 'u1', 'google-calendar', 50]);
    const horas = (new Date(janela.fim).getTime() - new Date(janela.inicio).getTime()) / 3_600_000;
    expect(Math.round(horas)).toBe(72);
  });

  it('buscar_drive e ler_arquivo_drive usam o Drive do usuário; o arquivo vira fonte', async () => {
    const { registro, drive } = montar();
    drive.listar.mockResolvedValue({
      arquivos: [{ id: 'f1', nome: 'Plano.docx', tipoRotulo: 'Documento', modificadoEm: '2026-11-01T00:00:00Z', importavel: true }],
      proximaPagina: null,
    });
    const b = await registro.executar('buscar_drive', { busca: 'plano' }, ctx);
    expect(drive.listar).toHaveBeenCalledWith('e1', 'u1', { busca: 'plano', pasta: undefined });
    expect(b.ok && b.conteudo).toBe('- id: f1 | Plano.docx (Documento) | modificado 2026-11-01');

    drive.conteudo.mockResolvedValue({
      arquivo: { nome: 'Plano.docx', link: 'https://drive/f1' },
      texto: 'x'.repeat(MAX_TEXTO_ARQUIVO + 10),
      truncado: false,
    });
    const l = await registro.executar('ler_arquivo_drive', { arquivoId: 'f1' }, ctx);
    expect(drive.conteudo).toHaveBeenCalledWith('e1', 'u1', 'f1');
    expect(l.ok && l.conteudo).toMatch(/Arquivo longo: só o começo foi lido/);
    expect(l.ok && l.fontes).toEqual([{ titulo: 'Plano.docx', url: 'https://drive/f1' }]);
  });

  it('esquemas recusam valores fora do limite', async () => {
    const { registro, emailSvc } = montar();
    const r = await registro.executar('ler_emails', { quantidade: 500 }, ctx);
    expect(r.ok).toBe(false);
    expect(emailSvc.listInbox).not.toHaveBeenCalled();
  });
});

describe('formatação', () => {
  it('e-mail longo vira trecho; anexos aparecem', () => {
    const t = formatarEmails([email(1, { corpo: 'a'.repeat(TRECHO_EMAIL + 50), anexos: [{ nome: 'nf.pdf', tamanho: 1 }] }) as never]);
    expect(t).toContain('anexos: nf.pdf');
    expect(t).toContain(`${'a'.repeat(TRECHO_EMAIL)}…`);
  });

  it('eventos cancelados saem; dia inteiro é marcado', () => {
    const t = formatarEventos([
      { id: '1', titulo: 'Feriado', inicio: '2026-11-15T00:00:00Z', fim: '2026-11-16T00:00:00Z', diaInteiro: true },
      { id: '2', titulo: 'Cancelado', inicio: '2026-11-13T10:00:00Z', fim: '2026-11-13T11:00:00Z', diaInteiro: false, cancelado: true },
    ]);
    expect(t).toBe('- 2026-11-15 (dia inteiro): Feriado');
  });
});
