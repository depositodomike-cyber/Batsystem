import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { ipPrivado, lerPagina, lookupSeguro, textoDoHtml, validarUrl } from './web';
import { respostaWebOpenAi } from '@/ai/providers';

describe('ipPrivado', () => {
  it.each([
    '127.0.0.1',
    '10.1.2.3',
    '172.16.0.1',
    '172.31.255.255',
    '192.168.0.10',
    '169.254.169.254', // metadados de nuvem
    '100.64.0.1',
    '0.0.0.0',
    '224.0.0.1',
    '::1',
    '::',
    'fc00::1',
    'fd12:3456::1',
    'fe80::1',
    '::ffff:127.0.0.1',
    '::ffff:10.0.0.1',
    '64:ff9b::a00:1',
    'não-é-ip',
  ])('bloqueia %s', (ip) => {
    expect(ipPrivado(ip)).toBe(true);
  });

  it.each(['8.8.8.8', '1.1.1.1', '172.32.0.1', '2606:4700:4700::1111', '::ffff:8.8.8.8'])('libera %s', (ip) => {
    expect(ipPrivado(ip)).toBe(false);
  });
});

describe('validarUrl', () => {
  it('aceita http/https públicos', () => {
    expect(validarUrl('https://example.com/a?b=1').hostname).toBe('example.com');
    expect(validarUrl('http://example.com:80/').port).toBe('');
  });

  it.each([
    ['ftp://example.com/', /http ou https/],
    ['file:///etc/passwd', /http ou https/],
    ['javascript:alert(1)', /http ou https/],
    ['https://user:pw@example.com/', /usuário e senha/],
    ['http://example.com:5433/', /portas padrão/],
    ['http://localhost/', /internos/],
    ['http://api.localhost/', /internos/],
    ['http://127.0.0.1/', /internos/],
    ['http://169.254.169.254/latest/meta-data', /internos/],
    ['http://[::1]/', /internos/],
    ['http://10.0.0.5/', /internos/],
    ['nada', /inválida/],
  ])('recusa %s', (url, motivo) => {
    expect(() => validarUrl(url)).toThrow(motivo);
  });
});

describe('lookupSeguro', () => {
  it('nome que resolve para o loopback é bloqueado na própria conexão', async () => {
    const erro = await new Promise<Error | null>((resolve) =>
      lookupSeguro('localhost', { all: false }, (err) => resolve(err)),
    );
    expect(erro?.message).toMatch(/internos ou privados/);
  });
});

describe('lerPagina contra um servidor na máquina (SSRF)', () => {
  let servidor: http.Server;
  let porta: number;
  beforeAll(async () => {
    servidor = http.createServer((_req, res) => res.end('<html><title>segredo</title><p>interno</p></html>'));
    await new Promise<void>((r) => servidor.listen(0, '127.0.0.1', () => r()));
    porta = (servidor.address() as AddressInfo).port;
  });
  afterAll(() => new Promise<void>((r) => servidor.close(() => r())));

  it('não alcança 127.0.0.1, nem por IP nem por nome', async () => {
    await expect(lerPagina(`http://127.0.0.1:${porta}/`)).rejects.toThrow();
    await expect(lerPagina(`http://127.0.0.1/`)).rejects.toThrow(/internos/);
    // localtest.me é um domínio público que resolve para 127.0.0.1.
    await expect(lerPagina('http://localtest.me/')).rejects.toThrow(/internos ou privados|Não foi possível/);
  });
});

describe('textoDoHtml', () => {
  it('pega o título e o texto principal, sem scripts, estilos e navegação', () => {
    const r = textoDoHtml(`<!doctype html><html><head><title> Notícia X </title><style>p{}</style></head>
      <body><nav>Menu Home Contato</nav><main><h1>Manchete</h1><p>Primeiro   parágrafo.</p>
      <script>roubar()</script><p>Segundo.</p></main><footer>Rodapé</footer></body></html>`);
    expect(r.titulo).toBe('Notícia X');
    expect(r.texto).toBe('Manchete\nPrimeiro parágrafo.\nSegundo.');
  });

  it('sem <main>, usa o body', () => {
    expect(textoDoHtml('<html><body><p>Só isto</p></body></html>').texto).toBe('Só isto');
  });
});

describe('respostaWebOpenAi', () => {
  it('extrai texto, fontes deduplicadas, corte e uso', () => {
    const r = respostaWebOpenAi({
      output_text: 'Dólar a R$ 5.',
      status: 'incomplete',
      incomplete_details: { reason: 'max_output_tokens' },
      usage: { input_tokens: 100, output_tokens: 20 },
      output: [
        { type: 'web_search_call' },
        {
          type: 'message',
          content: [
            {
              type: 'output_text',
              annotations: [
                { type: 'url_citation', url: 'https://bcb.gov.br', title: 'BC' },
                { type: 'url_citation', url: 'https://bcb.gov.br', title: 'BC de novo' },
                { type: 'url_citation', url: 'https://g1.com', title: '' },
              ],
            },
          ],
        },
      ],
    } as never);
    expect(r).toEqual({
      text: 'Dólar a R$ 5.',
      fontes: [
        { titulo: 'BC', url: 'https://bcb.gov.br' },
        { titulo: 'https://g1.com', url: 'https://g1.com' },
      ],
      truncated: true,
      usage: { entrada: 100, saida: 20 },
    });
  });
});
