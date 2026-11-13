import { ComandosDesktopService } from './comandos.service';

const FIGMA = { id: 'f'.repeat(32), nome: 'Figma', alvo: 'C:\\Users\\u\\AppData\\Local\\Figma\\Figma.exe' };
const CLAUDE = { id: 'c'.repeat(32), nome: 'Claude', alvo: 'C:\\Users\\u\\AppData\\Local\\AnthropicClaude\\claude.exe' };
const USER = { id: 'u1', empresaId: 'e1' } as never;

function montar(o: {
  inventario?: unknown[] | null;
  apps?: string[];
  permissoes?: Record<string, boolean>;
  indisponivel?: string | null;
}) {
  const prisma = {
    dispositivoDesktop: {
      findFirst: jest.fn().mockResolvedValue(o.inventario === null ? null : { inventario: o.inventario ?? [FIGMA, CLAUDE] }),
    },
  };
  const politicas = {
    obter: jest.fn().mockResolvedValue({
      versao: 1,
      permissoes: o.permissoes ?? { apps: true, midia: true, janelas: true, navegador: true, energia: true },
      confirmar: [], apps: o.apps ?? [FIGMA.id, CLAUDE.id], observaveis: [], diretorios: [], dominios: [], apelidos: {},
    }),
  };
  const gateway = { indisponibilidade: jest.fn().mockResolvedValue(o.indisponivel ?? null) };
  return new ComandosDesktopService(prisma as never, gateway as never, politicas as never);
}

describe('ComandosDesktopService.interpretar', () => {
  it('"abrir firma" com Figma autorizado → executa abrir Figma (comando direto)', async () => {
    const r = await montar({}).interpretar(USER, 'abrir firma');
    expect(r).toEqual({
      acao: 'executar',
      texto: 'abrir firma',
      entendido: 'abrir Figma',
      chamada: { nome: 'desktop_abrir_aplicativo', entrada: { aplicativo: 'firma' } },
    });
  });

  it('"abra a janela do Klaus" → abrir Claude', async () => {
    const r = await montar({}).interpretar(USER, 'abra a janela do Klaus');
    expect(r).toMatchObject({ acao: 'executar', entendido: 'abrir Claude' });
  });

  it('voz: escolhe a alternativa que existe no computador', async () => {
    const r = await montar({}).interpretar(USER, 'abrir o blau', ['abrir claude'], 'voz_ativacao');
    expect(r).toMatchObject({ acao: 'executar', texto: 'abrir claude', entendido: 'abrir Claude' });
  });

  it('servidor desligado / sem computador: responde o motivo na hora, sem pesquisar', async () => {
    const r = await montar({ inventario: null, indisponivel: 'O controle do computador está desligado neste servidor.' }).interpretar(USER, 'abrir firma');
    expect(r).toEqual({ acao: 'responder', resposta: expect.stringContaining('Entendi: **abrir Figma**') });
    expect((r as { resposta: string }).resposta).toContain('desligado');
  });

  it('app no computador mas não autorizado: diz qual e onde autorizar', async () => {
    const r = await montar({ apps: [FIGMA.id] }).interpretar(USER, 'abrir claude');
    expect(r).toEqual({ acao: 'responder', resposta: expect.stringContaining('**Claude** neste computador, mas ele ainda não está autorizado') });
  });

  it('categoria desligada', async () => {
    const r = await montar({ permissoes: { apps: false } }).interpretar(USER, 'abrir figma');
    expect(r).toEqual({ acao: 'responder', resposta: expect.stringContaining('libere "apps"') });
  });

  it('mídia sem alvo', async () => {
    const r = await montar({}).interpretar(USER, 'próxima música');
    expect(r).toMatchObject({ acao: 'executar', chamada: { nome: 'desktop_controlar_midia', entrada: { acao: 'proxima' } } });
  });

  it('perguntas e "abrir firma" sem nenhum app parecido não são comando', async () => {
    const svc = montar({ inventario: [CLAUDE] });
    expect(await svc.interpretar(USER, 'como abrir uma firma no Brasil?')).toBeNull();
    expect(await svc.interpretar(USER, 'abrir uma empresa de consultoria')).toBeNull();
  });

  it('GC-01: texto digitado ignora alternativas', async () => {
    const r = await montar({}).interpretar(USER, 'abrir o blau', ['abrir claude'], 'texto');
    expect(r).not.toMatchObject({ acao: 'executar' });
  });

  it('GC-05: sobrou instrução depois do app → fluxo normal (não executa só metade)', async () => {
    expect(await montar({}).interpretar(USER, 'executa o claude e apaga tudo da pasta')).toBeNull();
  });

  it('arquivos vão para o planejador', async () => {
    expect(await montar({}).interpretar(USER, 'abrir o último documento que editei')).toEqual({ acao: 'planejar' });
  });

  it('nome ambíguo: pergunta "você quis dizer"', async () => {
    const r = await montar({ inventario: [FIGMA, { ...FIGMA, id: 'a'.repeat(32), nome: 'Figma Beta' }] }).interpretar(USER, 'abrir o app figm');
    expect(r).toEqual({ acao: 'responder', resposta: expect.stringContaining('Você quis dizer') });
  });
});
