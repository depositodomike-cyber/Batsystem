import {
  avaliarRisco,
  dentroDeAutorizado,
  diretorioProibido,
  hostAutorizado,
  normalizarCaminho,
  normalizarUrl,
  OPERACOES,
  type Operacao,
  type PoliticaEfetiva,
  type RiscoDesktop,
} from './risco-desktop';

const ORDEM: Record<RiscoDesktop, number> = { baixo: 0, moderado: 1, alto: 2, bloqueado: 3 };

const tudoLigado = (): PoliticaEfetiva => ({
  versao: 1,
  permissoes: {
    apps: true, processos: true, janelas: true, arquivos_busca: true, documentos: true,
    arquivos_escrita: true, navegador: true, midia: true, energia: true,
  },
  confirmar: [],
  apps: ['a'.repeat(16), 'b'.repeat(16)],
  observaveis: [],
  diretorios: ['C:\\Users\\mike\\Documents'],
  dominios: ['exemplo.com'],
});
const LIMPA = { limpa: true, vozAtivacao: false };

describe('risco-desktop — SR-03: o risco nunca desce abaixo do base', () => {
  const entradas: Record<string, unknown>[] = [
    {},
    { aplicativoId: 'a'.repeat(16) },
    { aplicativoId: 'x' },
    { url: 'https://exemplo.com/a' },
    { url: 'javascript:alert(1)' },
    { caminho: 'C:\\Users\\mike\\Documents\\a.pdf' },
    { caminho: 'C:\\Windows\\system32\\cmd.exe' },
    { origem: 'C:\\Users\\mike\\Documents\\a.pdf', destino: 'C:\\Users\\mike\\Documents\\b.pdf' },
    { diretorio: 'C:\\Users\\mike\\Documents' },
    { layout: 'maximizar', aplicativoIds: ['a'.repeat(16)] },
    { acao: 'desligar' },
    // Tentativas do modelo de "rebaixar" o risco por parâmetro (T09).
    { risco: 'baixo', aplicativoId: 'a'.repeat(16) },
    { seguro: true, confirmado: true },
  ];
  for (const op of Object.keys(OPERACOES) as Operacao[]) {
    it(`${op}: qualquer entrada/política/contexto ≥ ${OPERACOES[op].base}`, () => {
      for (const e of entradas) {
        for (const ctx of [LIMPA, { limpa: false, vozAtivacao: false }, { limpa: true, vozAtivacao: true }]) {
          for (const p of [tudoLigado(), { ...tudoLigado(), permissoes: {} }]) {
            const r = avaliarRisco(op, e, p, ctx).risco;
            expect(ORDEM[r]).toBeGreaterThanOrEqual(ORDEM[OPERACOES[op].base]);
          }
        }
      }
    });
  }
});

describe('risco-desktop — política e contexto', () => {
  it('SR-02: categoria desligada = bloqueado (política nova nega tudo)', () => {
    const p = { ...tudoLigado(), permissoes: {} };
    for (const op of Object.keys(OPERACOES) as Operacao[]) {
      expect(avaliarRisco(op, { aplicativoId: 'a'.repeat(16) }, p, LIMPA).risco).toBe('bloqueado');
    }
  });

  it('SR-04: moderado limpo roda; com "pedir confirmação" vira alto', () => {
    const e = { aplicativoId: 'a'.repeat(16) };
    expect(avaliarRisco('abrir_aplicativo', e, tudoLigado(), LIMPA).risco).toBe('moderado');
    expect(avaliarRisco('abrir_aplicativo', e, { ...tudoLigado(), confirmar: ['abrir_aplicativo'] }, LIMPA).risco).toBe('alto');
  });

  it('SR-06 contaminacao_execucao: execução que leu conteúdo transforma moderado em alto', () => {
    const r = avaliarRisco('criar_pasta', { caminho: 'C:\\Users\\mike\\Documents\\Nova' }, tudoLigado(), { limpa: false, vozAtivacao: false });
    expect(r.risco).toBe('alto');
  });

  it('SR-06b voz_ativacao: palavra de ativação transforma moderado em alto', () => {
    expect(avaliarRisco('controlar_midia', { acao: 'proxima' }, tudoLigado(), { limpa: true, vozAtivacao: true }).risco).toBe('alto');
  });

  it('SR-08: app fora da allowlist é bloqueado mesmo com a categoria ligada', () => {
    expect(avaliarRisco('abrir_aplicativo', { aplicativoId: 'c'.repeat(16) }, tudoLigado(), LIMPA).risco).toBe('bloqueado');
  });

  it('fechar app e energia são sempre altos', () => {
    expect(avaliarRisco('fechar_aplicativo', { aplicativoId: 'a'.repeat(16) }, tudoLigado(), LIMPA).risco).toBe('alto');
    expect(avaliarRisco('energia', { acao: 'desligar' }, tudoLigado(), LIMPA).risco).toBe('alto');
  });

  it('organizar_janelas só com apps autorizados', () => {
    expect(avaliarRisco('organizar_janelas', { layout: 'maximizar', aplicativoIds: ['a'.repeat(16)] }, tudoLigado(), LIMPA).risco).toBe('moderado');
    expect(avaliarRisco('organizar_janelas', { layout: 'maximizar', aplicativoIds: ['z'.repeat(16)] }, tudoLigado(), LIMPA).risco).toBe('bloqueado');
  });
});

describe('risco-desktop — URLs (SR-06a, SR-37, GA-16)', () => {
  it('url_dominio_autorizado: moderado; fora da allowlist: alto', () => {
    expect(avaliarRisco('abrir_url', { url: 'https://docs.exemplo.com/x?q=1' }, tudoLigado(), LIMPA).risco).toBe('moderado');
    expect(avaliarRisco('abrir_url', { url: 'https://evil.com/?d=segredo' }, tudoLigado(), LIMPA).risco).toBe('alto');
  });
  it('url_rotulos: evil-exemplo.com e exemplo.com.evil.com não casam', () => {
    expect(hostAutorizado('evil-exemplo.com', ['exemplo.com'])).toBe(false);
    expect(hostAutorizado('exemplo.com.evil.com', ['exemplo.com'])).toBe(false);
    expect(hostAutorizado('EXEMPLO.com.', ['exemplo.com'])).toBe(true);
    expect(hostAutorizado('a.b.exemplo.com', ['exemplo.com'])).toBe(true);
  });
  it('url_idn: host IDN comparado em punycode', () => {
    const n = normalizarUrl('https://exämple.com/')!;
    expect(n.host).toBe('xn--exmple-cua.com');
    expect(hostAutorizado(n.host, ['exemple.com'])).toBe(false);
  });
  it('url_invalida: esquemas, credenciais e caracteres perigosos são bloqueados', () => {
    for (const url of [
      'javascript:alert(1)',
      'file:///C:/Windows/system32/calc.exe',
      'ms-settings:privacy',
      'https://user:pw@exemplo.com/',
      'https://exemplo.com/ --disable-web-security',
      'https://exemplo.com/"a',
      'https://exemplo.com/\u0000',
    ]) {
      expect(avaliarRisco('abrir_url', { url }, tudoLigado(), LIMPA).risco).toBe('bloqueado');
    }
  });
});

describe('risco-desktop — caminhos (SR-13) e extensões (SR-12a, GA-17)', () => {
  it('normalizarCaminho recusa traversal, UNC, ADS, reservados e relativo', () => {
    for (const c of [
      'C:\\Users\\mike\\Documents\\..\\..\\Windows',
      '\\\\servidor\\share\\a.pdf',
      '\\\\?\\C:\\Users\\a.pdf',
      'C:\\Users\\mike\\Documents\\a.pdf:segredo',
      'C:\\Users\\mike\\Documents\\CON',
      'C:\\Users\\mike\\Documents\\nul.txt',
      'Documents\\a.pdf',
      'C:\\Users\\mike\\Documents\\pasta.\\a.pdf',
    ]) {
      expect(normalizarCaminho(c)).toBeNull();
    }
    expect(normalizarCaminho('c:/Users/mike/Documents/a.pdf')).toBe('C:\\Users\\mike\\Documents\\a.pdf');
  });

  it('prefixo com separador: Documents2 não está dentro de Documents', () => {
    expect(dentroDeAutorizado('C:\\Users\\mike\\Documents2\\a.pdf', ['C:\\Users\\mike\\Documents'])).toBe(false);
    expect(dentroDeAutorizado('c:\\users\\MIKE\\documents\\x\\a.pdf', ['C:\\Users\\mike\\Documents'])).toBe(true);
  });

  it('diretórios de sistema não podem ser autorizados', () => {
    for (const d of ['C:\\', 'C:\\Windows', 'C:\\Program Files\\X', 'C:\\ProgramData', 'C:\\Users\\mike\\AppData\\Roaming', 'C:\\Users\\mike\\.ssh']) {
      expect(diretorioProibido(d)).toBe(true);
    }
    expect(dentroDeAutorizado('C:\\Windows\\notepad.exe', ['C:\\Windows'])).toBe(false);
    expect(diretorioProibido('C:\\Users\\mike\\Documents')).toBe(false);
  });

  it('abrir_documento: allowlist; executáveis bloqueados; legados com macro/svg altos', () => {
    const p = tudoLigado();
    const r = (n: string) => avaliarRisco('abrir_documento', { caminho: `C:\\Users\\mike\\Documents\\${n}` }, p, LIMPA).risco;
    expect(r('a.pdf')).toBe('moderado');
    for (const n of ['a.exe', 'a.bat', 'a.ps1', 'a.lnk', 'a.url', 'a.library-ms', 'a.search-ms', 'a.chm', 'a.cpl', 'a.msc', 'a.hta', 'a.jar', 'a.iso', 'a.docm', 'a.xlsm', 'a.html', 'sem-extensao']) {
      expect(r(n)).toBe('bloqueado');
    }
    for (const n of ['a.doc', 'a.xls', 'a.ppt', 'a.svg']) expect(r(n)).toBe('alto');
  });

  it('abrir_documento fora dos diretórios autorizados é bloqueado', () => {
    expect(avaliarRisco('abrir_documento', { caminho: 'C:\\Users\\mike\\Desktop\\a.pdf' }, tudoLigado(), LIMPA).risco).toBe('bloqueado');
  });

  it('mover_arquivo: não troca extensão; sobrescrever é alto', () => {
    const d = 'C:\\Users\\mike\\Documents';
    expect(avaliarRisco('mover_arquivo', { origem: `${d}\\a.pdf`, destino: `${d}\\b.exe` }, tudoLigado(), LIMPA).risco).toBe('bloqueado');
    expect(avaliarRisco('mover_arquivo', { origem: `${d}\\a.pdf`, destino: `${d}\\x\\a.pdf`, sobrescrever: true }, tudoLigado(), LIMPA).risco).toBe('alto');
    expect(avaliarRisco('mover_arquivo', { origem: `${d}\\a.pdf`, destino: `${d}\\x\\a.pdf` }, tudoLigado(), LIMPA).risco).toBe('moderado');
  });
});

describe('GB-01: alvos proibidos sob diretório autorizado', () => {
  const home = (): PoliticaEfetiva => ({ ...tudoLigado(), diretorios: ['C:\\Users\\mike'] });

  it('Startup, AppData, pasta do agente, .ssh e nomes 8.3 ficam de fora mesmo com a home autorizada', () => {
    for (const alvo of [
      'C:\\Users\\mike\\AppData\\Roaming\\Microsoft\\Windows\\Start Menu\\Programs\\Startup\\x.pdf',
      'C:\\Users\\mike\\AppData\\Local\\Oracle\\agent.json',
      'C:\\Users\\mike\\.ssh\\id_rsa.txt',
      'C:\\Users\\mike\\.aws\\credentials.txt',
      'C:\\Users\\mike\\SSH~1\\a.pdf',
      'C:\\PROGRA~1\\x.pdf',
      'C:\\Users\\mike\\Documents\\Startup\\a.pdf',
    ]) {
      expect(dentroDeAutorizado(alvo, ['C:\\Users\\mike'])).toBe(false);
      expect(avaliarRisco('abrir_documento', { caminho: alvo }, home(), LIMPA).risco).toBe('bloqueado');
      expect(avaliarRisco('criar_pasta', { caminho: alvo }, home(), LIMPA).risco).toBe('bloqueado');
    }
  });

  it('mover: .exe, .lnk, scripts, sem extensão e destino Startup são bloqueados', () => {
    const d = 'C:\\Users\\mike\\Downloads';
    for (const n of ['x.exe', 'x.lnk', 'x.bat', 'x.ps1', 'semext', 'x.json']) {
      const r = avaliarRisco('mover_arquivo', { origem: `${d}\\${n}`, destino: `C:\\Users\\mike\\Documents\\${n}` }, home(), LIMPA);
      expect(r.risco).toBe('bloqueado');
    }
    const startup = 'C:\\Users\\mike\\AppData\\Roaming\\Microsoft\\Windows\\Start Menu\\Programs\\Startup\\a.pdf';
    expect(avaliarRisco('mover_arquivo', { origem: `${d}\\a.pdf`, destino: startup }, home(), LIMPA).risco).toBe('bloqueado');
    const ok = avaliarRisco('mover_arquivo', { origem: `${d}\\a.pdf`, destino: 'C:\\Users\\mike\\Documents\\a.pdf' }, home(), LIMPA);
    expect(ok.risco).toBe('moderado');
  });
});

