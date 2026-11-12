import { RoteadorService } from './roteador.service';
import {
  normalizarPlano,
  PlanejadorService,
  planoEmTexto,
  planoPadrao,
} from './planejador.service';
import { extrairJson } from './json-modelo';
import { SYSTEM_ROTEADOR } from './prompts';
import type { AuthenticatedUser } from '@/auth/jwt.strategy';

const user = { id: 'u1', empresaId: 'e1' } as AuthenticatedUser;
const turno = (texto: string) => ({
  texto,
  chamadas: [],
  parada: 'fim',
  usage: { entrada: 50, saida: 5 },
  mensagem: { papel: 'assistant', blocos: [] },
  modelo: 'anthropic/x',
});

describe('extrairJson', () => {
  it.each([
    ['{"a":1}', { a: 1 }],
    ['```json\n{"a":1}\n```', { a: 1 }],
    ['Claro! {"a":{"b":2}} pronto', { a: { b: 2 } }],
    ['sem json', null],
    ['{quebrado', null],
  ])('%j', (texto, esperado) => {
    expect(extrairJson(texto)).toEqual(esperado);
  });
});

describe('RoteadorService', () => {
  function montar() {
    const ai = { completarComFerramentas: jest.fn() };
    return { roteador: new RoteadorService(ai as never), ai };
  }

  it('classifica sem diretrizes e sem ferramentas, com a conversa recente', async () => {
    const { roteador, ai } = montar();
    ai.completarComFerramentas.mockResolvedValue(turno('{"rota":"plano","motivo":"compara fontes"}'));
    const r = await roteador.decidir(user, 'compare com o outro', [
      { pergunta: 'p1', resposta: 'r1' },
      { pergunta: 'p2', resposta: 'r2' },
      { pergunta: 'p3', resposta: 'r3' },
    ]);
    expect(r).toEqual({ rota: 'plano', motivo: 'compara fontes', usage: { entrada: 50, saida: 5 } });
    const [, , p] = ai.completarComFerramentas.mock.calls[0];
    expect(p).toMatchObject({ system: SYSTEM_ROTEADOR, ferramentas: [], semDiretrizes: true });
    const texto = p.mensagens[0].blocos[0].texto as string;
    expect(texto).not.toContain('p1');
    expect(texto).toContain('Usuário: p2');
    expect(texto).toContain('## PEDIDO\ncompare com o outro');
  });

  it('devolve a fonte da rota direta quando o modelo informa', async () => {
    const { roteador, ai } = montar();
    ai.completarComFerramentas.mockResolvedValue(turno('{"rota":"direta","fonte":"web","motivo":"notícias"}'));
    expect(await roteador.decidir(user, 'últimas notícias de IA', [])).toMatchObject({ rota: 'direta', fonte: 'web' });
    ai.completarComFerramentas.mockResolvedValue(turno('{"rota":"direta"}'));
    expect((await roteador.decidir(user, 'oi', [])).fonte).toBeUndefined();
  });

  it.each([
    ['resposta fora do formato', () => Promise.resolve(turno('acho que plano'))],
    ['rota desconhecida', () => Promise.resolve(turno('{"rota":"outra"}'))],
    ['falha da IA', () => Promise.reject(new Error('sem IA'))],
  ])('%s → direta (o comportamento de hoje)', async (_n, impl) => {
    const { roteador, ai } = montar();
    ai.completarComFerramentas.mockImplementation(impl);
    expect((await roteador.decidir(user, 'oi', [])).rota).toBe('direta');
  });
});

describe('normalizarPlano', () => {
  const validas = new Set(['buscar_memoria', 'buscar_web']);

  it('mantém um plano válido', () => {
    const plano = normalizarPlano(
      {
        objetivo: 'comparar',
        etapas: [
          { chave: 'e1', descricao: 'memória', ferramenta: 'buscar_memoria', dependeDe: [] },
          { chave: 'e2', descricao: 'web', ferramenta: 'buscar_web' },
          { chave: 'e3', descricao: 'responder', ferramenta: null, dependeDe: ['e1', 'e2'] },
        ],
      },
      validas,
    );
    expect(plano?.etapas.map((e) => [e.chave, e.ferramenta, e.dependeDe])).toEqual([
      ['e1', 'buscar_memoria', []],
      ['e2', 'buscar_web', []],
      ['e3', null, ['e1', 'e2']],
    ]);
  });

  it('descarta ferramenta inventada, chave repetida e dependência para frente (ciclo)', () => {
    const plano = normalizarPlano(
      {
        objetivo: 'x',
        etapas: [
          { chave: 'e1', descricao: 'a', ferramenta: 'apagar_tudo', dependeDe: ['e2'] },
          { chave: 'e1', descricao: 'repetida' },
          { chave: 'e2', descricao: 'b', dependeDe: ['e1', 'e2', 'e9', 'e1'] },
        ],
      },
      validas,
    );
    expect(plano?.etapas).toEqual([
      { chave: 'e1', descricao: 'a', ferramenta: null, dependeDe: [] },
      { chave: 'e2', descricao: 'b', ferramenta: null, dependeDe: ['e1'] },
    ]);
  });

  it.each([null, {}, { objetivo: 'x', etapas: [] }, { objetivo: 'x', etapas: Array(9).fill({ chave: 'a', descricao: 'b' }) }])(
    'rejeita %j',
    (bruto) => {
      expect(normalizarPlano(bruto, validas)).toBeNull();
    },
  );

  it('vira texto legível para o executor', () => {
    expect(
      planoEmTexto({
        objetivo: 'O',
        etapas: [
          { chave: 'e1', descricao: 'buscar', ferramenta: 'buscar_web', dependeDe: [] },
          { chave: 'e2', descricao: 'responder', ferramenta: null, dependeDe: ['e1'] },
        ],
      }),
    ).toBe('Objetivo: O\ne1. buscar [buscar_web]\ne2. responder (depois de e1)');
  });
});

describe('PlanejadorService', () => {
  function montar() {
    const ai = { completarComFerramentas: jest.fn() };
    const registro = {
      definicoes: jest.fn().mockReturnValue([
        { nome: 'buscar_memoria', descricao: 'busca na memória', parametros: { type: 'object' } },
      ]),
    };
    return { planejador: new PlanejadorService(ai as never, registro as never), ai };
  }
  const mensagens = [{ papel: 'user' as const, blocos: [{ tipo: 'texto' as const, texto: 'pedido' }] }];

  it('planeja sem diretrizes, listando as ferramentas no system', async () => {
    const { planejador, ai } = montar();
    ai.completarComFerramentas.mockResolvedValue(
      turno('{"objetivo":"o","etapas":[{"chave":"e1","descricao":"d","ferramenta":"buscar_memoria"}]}'),
    );
    const r = await planejador.planejar(user, 'pedido', mensagens);
    expect(r.padrao).toBe(false);
    expect(r.plano.etapas[0].ferramenta).toBe('buscar_memoria');
    const [, , p] = ai.completarComFerramentas.mock.calls[0];
    expect(p.system).toContain('- buscar_memoria: busca na memória');
    expect(p).toMatchObject({ mensagens, ferramentas: [], semDiretrizes: true });
  });

  it('restrito ao repositório: o planejador não vê ferramentas de dados externos', async () => {
    const ai = { completarComFerramentas: jest.fn().mockResolvedValue(turno('{"objetivo":"o","etapas":[{"chave":"e1","descricao":"d"}]}')) };
    const registro = {
      perfis: jest.fn().mockReturnValue([
        { nome: 'buscar_memoria', dadosExternos: false },
        { nome: 'buscar_web', dadosExternos: true },
      ]),
      definicoes: jest.fn().mockReturnValue([{ nome: 'buscar_memoria', descricao: 'd', parametros: { type: 'object' } }]),
    };
    await new PlanejadorService(ai as never, registro as never).planejar(user, 'p', mensagens, true);
    expect(registro.definicoes).toHaveBeenCalledWith(['buscar_memoria']);
  });

  it.each([
    ['JSON inválido', () => Promise.resolve(turno('vou pensar'))],
    ['falha da IA', () => Promise.reject(new Error('x'))],
  ])('%s → plano padrão', async (_n, impl) => {
    const { planejador, ai } = montar();
    ai.completarComFerramentas.mockImplementation(impl);
    const r = await planejador.planejar(user, 'pedido', mensagens);
    expect(r.padrao).toBe(true);
    expect(r.plano).toEqual(planoPadrao('pedido'));
  });
});
