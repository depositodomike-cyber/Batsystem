// Caracterização de POST /ai/melhorar, /ai/ata e /ai/artigo antes de a lógica
// sair dos controllers (para virar ferramenta do orquestrador). Os snapshots
// fixam os prompts montados; nada pode mudar sem um teste acusar.
import { BadRequestException } from '@nestjs/common';
import { MelhorarController } from './melhorar.controller';
import { AtaController } from './ata.controller';
import { ArtigoController } from './artigo.controller';
import { GeradoresTextoService } from './geradores-texto.service';
import { SYSTEM_MELHORAR } from './melhorar/prompts';
import { SYSTEM_ATA, SYSTEM_ATA_MEMORIA } from './ata/prompts';
import { SYSTEM_ARTIGO } from './artigo/prompts';
import type { AuthenticatedUser } from '@/auth/jwt.strategy';

jest.mock('./analise/extrair-texto', () => ({
  extrairTexto: jest.fn(async (buf: Buffer) => `do arquivo: ${buf.toString()}`),
}));

const user = { id: 'u1', empresaId: 'e1' } as AuthenticatedUser;
const design = { marca: { nome: 'Acme' } };

function montar() {
  const ai = { completar: jest.fn() };
  const vault = { titulos: jest.fn().mockResolvedValue(['Nota A', 'Nota B']) };
  const memorias = {
    list: jest.fn().mockResolvedValue([
      { title: 'Tom', content: 'formal', active: true },
      { title: 'Velha', content: 'x', active: false },
    ]),
  };
  // Controllers reais sobre o serviço real: o teste cobre o caminho HTTP inteiro.
  const geradores = new GeradoresTextoService(ai as never, vault as never, memorias as never);
  return {
    ai,
    vault,
    memorias,
    melhorar: new MelhorarController(geradores),
    ata: new AtaController(geradores),
    artigo: new ArtigoController(geradores),
  };
}

describe('POST /ai/melhorar (caracterização)', () => {
  it('exige texto', async () => {
    const m = montar();
    await expect(m.melhorar.melhorar(user, null, { texto: ' ' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('monta o prompt com marca, instruções e títulos do vault', async () => {
    const m = montar();
    m.ai.completar.mockResolvedValue({ text: 'TEXTO MELHORADO', truncated: false });
    const r = await m.melhorar.melhorar(user, 'repo1', {
      texto: '  meu texto  ',
      instrucoes: ' mais curto ',
      design: design as never,
    });
    expect(m.vault.titulos).toHaveBeenCalledWith('e1', 'repo1', 'meu texto', 40);
    const [emp, usu, system, userPrompt, max] = m.ai.completar.mock.calls[0];
    expect([emp, usu, system, max]).toEqual(['e1', 'u1', SYSTEM_MELHORAR, 4000]);
    expect(userPrompt).toMatchSnapshot();
    expect(r).toMatchSnapshot();
  });

  it('segue sem os títulos do vault se a busca falhar', async () => {
    const m = montar();
    m.vault.titulos.mockRejectedValue(new Error('db'));
    m.ai.completar.mockResolvedValue({ text: 'ok', truncated: false });
    await m.melhorar.melhorar(user, null, { texto: 'x' });
    expect(m.ai.completar).toHaveBeenCalled();
  });
});

describe('POST /ai/ata (caracterização)', () => {
  it('exige arquivo ou texto', async () => {
    const m = montar();
    await expect(m.ata.ata(user, null, undefined, {})).rejects.toBeInstanceOf(BadRequestException);
  });

  it('texto colado, sem memória: prompt e system padrão', async () => {
    const m = montar();
    m.ai.completar.mockResolvedValue({ text: '# Ata da reunião\n\nPontos.', truncated: false });
    const r = await m.ata.ata(user, 'repo1', undefined, { texto: ' reunião de ontem ', instrucoes: ' resumida ' });
    const [, , system, userPrompt, max] = m.ai.completar.mock.calls[0];
    expect([system, max]).toEqual([SYSTEM_ATA, 8000]);
    expect(userPrompt).toMatchSnapshot();
    expect(m.memorias.list).not.toHaveBeenCalled();
    expect(r).toMatchSnapshot();
  });

  it('arquivo vence o texto; memória "true" usa o system da Memória e os títulos ativos', async () => {
    const m = montar();
    m.ai.completar.mockResolvedValue({ text: 'ata', truncated: false });
    const r = await m.ata.ata(
      user,
      null,
      { originalname: 'r.txt', buffer: Buffer.from('conteúdo'), size: 8 },
      { texto: 'ignorado', memoria: 'true', design: JSON.stringify(design) },
    );
    const [, , system, userPrompt] = m.ai.completar.mock.calls[0];
    expect(system).toBe(SYSTEM_ATA_MEMORIA);
    expect(userPrompt).toContain('do arquivo: conteúdo');
    expect(userPrompt).not.toContain('ignorado');
    expect(userPrompt).toMatchSnapshot();
    expect(r.memoria).toBe(true);
  });
});

describe('POST /ai/artigo (caracterização)', () => {
  it('exige tema', async () => {
    const m = montar();
    await expect(m.artigo.artigo(user, null, {})).rejects.toBeInstanceOf(BadRequestException);
  });

  it('com fonte "memoria": diretrizes ativas entram na referência', async () => {
    const m = montar();
    m.ai.completar.mockResolvedValue({ text: '# Título\n\nCorpo.', truncated: false });
    const r = await m.artigo.artigo(user, 'repo1', {
      tema: ' IA no varejo ',
      contexto: ' para lojistas ',
      fontes: ['memoria'],
      referencia: 'ref do cliente',
      ajuste: 'mais curto',
      design: design as never,
    });
    expect(m.vault.titulos).toHaveBeenCalledWith('e1', 'repo1', 'IA no varejo\npara lojistas', 40);
    const [, , system, userPrompt, max] = m.ai.completar.mock.calls[0];
    expect([system, max]).toEqual([SYSTEM_ARTIGO, 6000]);
    expect(userPrompt).toMatchSnapshot();
    expect(r).toMatchSnapshot();
  });

  it('sem fonte "memoria": não lê as diretrizes', async () => {
    const m = montar();
    m.ai.completar.mockResolvedValue({ text: 'x', truncated: false });
    await m.artigo.artigo(user, null, { tema: 't' });
    expect(m.memorias.list).not.toHaveBeenCalled();
  });
});
