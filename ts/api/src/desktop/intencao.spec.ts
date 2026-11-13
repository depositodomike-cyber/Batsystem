import { interpretarComando, melhorComando } from './intencao';
import { fonetica, resolverAlvo, type AppConhecido } from './vocabulario';

const APPS: AppConhecido[] = [
  { id: 'f'.repeat(32), nome: 'Figma', alvo: 'C:\\Users\\u\\AppData\\Local\\Figma\\Figma.exe' },
  { id: 'c'.repeat(32), nome: 'Claude', alvo: 'C:\\Users\\u\\AppData\\Local\\AnthropicClaude\\claude.exe' },
  { id: 'g'.repeat(32), nome: 'Google Chrome', alvo: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' },
  { id: 's'.repeat(32), nome: 'Spotify', alvo: 'C:\\Users\\u\\AppData\\Roaming\\Spotify\\Spotify.exe' },
  { id: 'v'.repeat(32), nome: 'Visual Studio Code', alvo: 'C:\\Users\\u\\AppData\\Local\\Programs\\Microsoft VS Code\\Code.exe' },
  { id: 'w'.repeat(32), nome: 'WhatsApp', alvo: 'C:\\Program Files\\WindowsApps\\WhatsApp.exe' },
];
const app = (texto: string) => resolverAlvo(texto, APPS).app?.nome ?? null;

describe('interpretarComando — abrir/fechar apps (palavras-chave e sinônimos)', () => {
  it.each([
    ['abrir figma', 'figma'],
    ['Abrir Figma', 'figma'],
    ['Oracle, abre o Figma', 'figma'],
    ['abra o figma pra mim', 'figma'],
    ['abra a janela do Claude no meu computador', 'claude'],
    ['inicia o spotify', 'spotify'],
    ['iniciar o Visual Studio Code', 'visual studio code'],
    ['execute o chrome', 'chrome'],
    ['roda o whatsapp', 'whatsapp'],
    ['lança o figma', 'figma'],
    ['carrega o app do spotify', 'spotify'],
    ['pode abrir o claude por favor', 'claude'],
    ['entra no figma', 'figma'],
    ['open figma', 'figma'],
    ['Abrir Google Chrome', 'google chrome'],
    ['abrir o aplicativo claude', 'claude'],
  ])('"%s" → abrir "%s"', (frase, alvo) => {
    expect(interpretarComando(frase)).toEqual(expect.objectContaining({ tipo: 'app', operacao: 'abrir_aplicativo', alvo }));
  });

  it.each([
    ['fechar figma', 'figma'],
    ['fecha o spotify', 'spotify'],
    ['feche o chrome', 'chrome'],
    ['encerra o claude', 'claude'],
    ['sai do whatsapp', 'whatsapp'],
    ['close figma', 'figma'],
  ])('"%s" → fechar "%s"', (frase, alvo) => {
    expect(interpretarComando(frase)).toEqual(expect.objectContaining({ tipo: 'app', operacao: 'fechar_aplicativo', alvo }));
  });

  it('marca "explícito" quando a frase fala em app/janela/programa', () => {
    expect(interpretarComando('abrir o aplicativo claude')).toMatchObject({ explicito: true });
    expect(interpretarComando('abrir figma')).toMatchObject({ explicito: false });
  });
});

describe('interpretarComando — mídia, energia, janelas, sites', () => {
  it.each([
    ['toca música', 'tocar_pausar'],
    ['tocar', 'tocar_pausar'],
    ['pausa', 'tocar_pausar'],
    ['pausar a música', 'tocar_pausar'],
    ['próxima música', 'proxima'],
    ['pula', 'proxima'],
    ['avança a faixa', 'proxima'],
    ['música anterior', 'anterior'],
    ['volta a música', 'anterior'],
    ['aumenta o volume', 'volume_mais'],
    ['sobe o som', 'volume_mais'],
    ['abaixa o volume', 'volume_menos'],
    ['diminui o som', 'volume_menos'],
    ['mudo', 'mudo'],
    ['silenciar', 'mudo'],
  ])('"%s" → mídia %s', (frase, acao) => {
    expect(interpretarComando(frase)).toEqual({ tipo: 'midia', acao });
  });

  it.each([
    ['desliga o computador', 'desligar'],
    ['desligar o pc', 'desligar'],
    ['reinicia o computador', 'reiniciar'],
    ['bloqueia a tela', 'bloquear'],
    ['trava o computador', 'bloquear'],
    ['encerrar a sessão', 'encerrar_sessao'],
  ])('"%s" → energia %s', (frase, acao) => {
    expect(interpretarComando(frase)).toEqual({ tipo: 'energia', acao });
  });

  it('janelas', () => {
    expect(interpretarComando('maximiza o figma')).toEqual({ tipo: 'janelas', layout: 'maximizar', alvos: ['figma'] });
    expect(interpretarComando('deixa só o figma')).toEqual({ tipo: 'janelas', layout: 'minimizar_outras', alvos: ['figma'] });
    expect(interpretarComando('minimiza tudo menos o chrome')).toEqual({ tipo: 'janelas', layout: 'minimizar_outras', alvos: ['chrome'] });
    expect(interpretarComando('coloca o figma e o chrome lado a lado')).toEqual({ tipo: 'janelas', layout: 'lado_a_lado', alvos: ['figma', 'chrome'] });
    expect(interpretarComando('restaura o spotify')).toEqual({ tipo: 'janelas', layout: 'restaurar', alvos: ['spotify'] });
  });

  it('sites e pesquisa', () => {
    expect(interpretarComando('abrir o site figma.com')).toMatchObject({ tipo: 'url', url: 'https://figma.com' });
    expect(interpretarComando('acessa github.com/anthropics')).toMatchObject({ tipo: 'url', url: 'https://github.com/anthropics' });
    expect(interpretarComando('pesquisa design systems no google')).toMatchObject({
      tipo: 'url',
      url: 'https://www.google.com/search?q=design%20systems',
    });
  });

  it('arquivos vão para o planejador', () => {
    for (const f of ['abrir o último documento que editei', 'encontre o arquivo da proposta', 'procura a planilha de custos', 'move a proposta para a pasta do projeto']) {
      expect(interpretarComando(f)).toEqual({ tipo: 'arquivos' });
    }
  });
});

describe('interpretarComando — NÃO é comando', () => {
  it.each([
    'como abrir uma firma no Brasil?',
    'Como abrir uma firma',
    'qual o melhor app para design?',
    'o que é o Figma',
    'abrir firma?',
    'me explica como funciona o spotify',
    'resuma minhas notas da semana',
    'abrir uma empresa de consultoria com dois sócios e capital social',
    'quando devo fechar o trimestre',
  ])('"%s"', (frase) => {
    expect(interpretarComando(frase)).toBeNull();
  });
});

describe('vocabulário — corrige o ditado contra o inventário', () => {
  it.each([
    ['firma', 'Figma'],
    ['figma', 'Figma'],
    ['FIGMA', 'Figma'],
    ['klaus', 'Claude'],
    ['claude', 'Claude'],
    ['cloud', 'Claude'],
    ['clode', 'Claude'],
    ['chrome', 'Google Chrome'],
    ['crome', 'Google Chrome'],
    ['google chrome', 'Google Chrome'],
    ['espotifai', 'Spotify'],
    ['spotify', 'Spotify'],
    ['vs code', 'Visual Studio Code'],
    ['zap', 'WhatsApp'],
    ['whatsapp', 'WhatsApp'],
  ])('"%s" → %s', (texto, nome) => {
    expect(app(texto)).toBe(nome);
  });

  it('sem correspondência clara não inventa um app', () => {
    expect(app('notepad')).toBeNull();
    expect(app('photoshop')).toBeNull();
    expect(resolverAlvo('xyz', []).app).toBeNull();
  });

  it('apelido do usuário tem precedência', () => {
    expect(resolverAlvo('meu editor', APPS, { ['v'.repeat(32)]: ['meu editor'] }).app?.nome).toBe('Visual Studio Code');
  });

  it('fonética pt-BR', () => {
    expect(fonetica('Claude')).toBe(fonetica('Clóde'));
    expect(fonetica('Spotify')).toBe(fonetica('Spotifi'));
  });

  it('melhorComando escolhe a alternativa de voz cujo alvo existe', () => {
    const reconhecido = (alvo: string) => resolverAlvo(alvo, APPS).app !== null;
    const r = melhorComando('abrir firma', ['abrir figma', 'abrir firmas'], reconhecido);
    expect(r?.intencao).toMatchObject({ tipo: 'app', alvo: 'firma' }); // "firma" já resolve para Figma
    const r2 = melhorComando('abrir clóvis', ['abrir claude'], (a) => a === 'claude');
    expect(r2?.texto).toBe('abrir claude');
    expect(melhorComando('como abrir uma firma?', [], reconhecido)).toBeNull();
  });

  it('GC-01: alternativa não transforma frase comum em comando nem troca a operação', () => {
    const reconhecido = (alvo: string) => resolverAlvo(alvo, APPS).app !== null;
    expect(melhorComando('como abrir uma firma no Brasil?', ['abrir figma'], reconhecido)).toBeNull();
    expect(melhorComando('resuma minhas notas', ['abrir claude'], reconhecido)).toBeNull();
    const r = melhorComando('abrir o blau', ['fechar claude', 'abrir claude'], reconhecido);
    expect(r?.intencao).toMatchObject({ operacao: 'abrir_aplicativo', alvo: 'claude' });
    const s = melhorComando('abrir o blau', ['fechar claude'], reconhecido);
    expect(s?.intencao).toMatchObject({ operacao: 'abrir_aplicativo', alvo: 'blau' });
  });

  it('GC-07: "liga pra Maria" e "usar o excel para calcular" não são abrir app', () => {
    expect(interpretarComando('liga pra Maria')).toBeNull();
    expect(interpretarComando('usar o excel para calcular a margem')).toBeNull();
  });
});
