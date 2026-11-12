import type Anthropic from '@anthropic-ai/sdk';
import type OpenAI from 'openai';
import {
  escolhaAnthropic,
  escolhaOpenAi,
  ferramentasAnthropic,
  ferramentasOpenAi,
  mensagensAnthropic,
  mensagensOpenAi,
  respostaAnthropic,
  respostaOpenAi,
  validarFerramentas,
  type DefinicaoFerramenta,
  type MensagemComFerramentas,
} from './tool-use';

const buscar: DefinicaoFerramenta = {
  nome: 'buscar_memoria',
  descricao: 'Busca nas notas do usuário.',
  parametros: {
    type: 'object',
    properties: { consulta: { type: 'string' } },
    required: ['consulta'],
  },
};

/** Uma conversa típica de um turno com ferramenta: pede, executa, responde. */
const historico: MensagemComFerramentas[] = [
  { papel: 'user', blocos: [{ tipo: 'texto', texto: 'O que anotei sobre café?' }] },
  {
    papel: 'assistant',
    blocos: [
      { tipo: 'texto', texto: 'Vou procurar.' },
      { tipo: 'chamada', id: 'call_1', nome: 'buscar_memoria', entrada: { consulta: 'café' } },
      { tipo: 'chamada', id: 'call_2', nome: 'buscar_memoria', entrada: { consulta: 'cafeteria' } },
    ],
  },
  {
    papel: 'user',
    blocos: [
      { tipo: 'resultado', idChamada: 'call_1', conteudo: 'Nota: café coado.' },
      { tipo: 'resultado', idChamada: 'call_2', conteudo: 'timeout', erro: true },
    ],
  },
];

describe('validarFerramentas', () => {
  it('aceita definições válidas', () => {
    expect(() => validarFerramentas([buscar])).not.toThrow();
  });
  it.each([
    [[{ ...buscar, nome: 'com espaço' }], /inválido/],
    [[{ ...buscar, nome: 'x'.repeat(65) }], /inválido/],
    [[buscar, buscar], /duplicada/],
    [[{ ...buscar, parametros: { type: 'string' } }], /type: object/],
  ])('rejeita %#', (defs, erro) => {
    expect(() => validarFerramentas(defs as DefinicaoFerramenta[])).toThrow(erro);
  });
});

describe('Anthropic', () => {
  it('converte ferramentas e escolha', () => {
    expect(ferramentasAnthropic([buscar])).toEqual([
      { name: 'buscar_memoria', description: 'Busca nas notas do usuário.', input_schema: buscar.parametros },
    ]);
    expect(escolhaAnthropic('auto')).toEqual({ type: 'auto' });
    expect(escolhaAnthropic('obrigatoria')).toEqual({ type: 'any' });
    expect(escolhaAnthropic('nenhuma')).toEqual({ type: 'none' });
  });

  it('converte o histórico em blocos, com is_error só quando houve erro', () => {
    expect(mensagensAnthropic(historico)).toEqual([
      { role: 'user', content: [{ type: 'text', text: 'O que anotei sobre café?' }] },
      {
        role: 'assistant',
        content: [
          { type: 'text', text: 'Vou procurar.' },
          { type: 'tool_use', id: 'call_1', name: 'buscar_memoria', input: { consulta: 'café' } },
          { type: 'tool_use', id: 'call_2', name: 'buscar_memoria', input: { consulta: 'cafeteria' } },
        ],
      },
      {
        role: 'user',
        content: [
          { type: 'tool_result', tool_use_id: 'call_1', content: 'Nota: café coado.' },
          { type: 'tool_result', tool_use_id: 'call_2', content: 'timeout', is_error: true },
        ],
      },
    ]);
  });

  it('descarta blocos de texto vazios e mensagens que ficam sem conteúdo', () => {
    expect(
      mensagensAnthropic([
        { papel: 'assistant', blocos: [{ tipo: 'texto', texto: '  ' }] },
        { papel: 'user', blocos: [{ tipo: 'texto', texto: '' }, { tipo: 'texto', texto: 'oi' }] },
      ]),
    ).toEqual([{ role: 'user', content: [{ type: 'text', text: 'oi' }] }]);
  });

  it('interpreta uma resposta que pede ferramenta', () => {
    const msg = {
      stop_reason: 'tool_use',
      content: [
        { type: 'text', text: 'Procurando…' },
        { type: 'tool_use', id: 'toolu_1', name: 'buscar_memoria', input: { consulta: 'café' } },
      ],
    } as unknown as Anthropic.Message;
    expect(respostaAnthropic(msg)).toEqual({
      texto: 'Procurando…',
      chamadas: [{ id: 'toolu_1', nome: 'buscar_memoria', entrada: { consulta: 'café' } }],
      parada: 'ferramenta',
      mensagem: {
        papel: 'assistant',
        blocos: [
          { tipo: 'texto', texto: 'Procurando…' },
          { tipo: 'chamada', id: 'toolu_1', nome: 'buscar_memoria', entrada: { consulta: 'café' } },
        ],
      },
    });
  });

  it.each([
    ['end_turn', 'fim'],
    ['max_tokens', 'limite'],
    ['refusal', 'recusa'],
    ['pause_turn', 'fim'],
  ])('stop_reason %s → %s', (stop, parada) => {
    const msg = { stop_reason: stop, content: [] } as unknown as Anthropic.Message;
    expect(respostaAnthropic(msg).parada).toBe(parada);
  });
});

describe('OpenAI', () => {
  it('converte ferramentas e escolha', () => {
    expect(ferramentasOpenAi([buscar])).toEqual([
      {
        type: 'function',
        function: {
          name: 'buscar_memoria',
          description: 'Busca nas notas do usuário.',
          parameters: buscar.parametros,
        },
      },
    ]);
    expect(escolhaOpenAi('auto')).toBe('auto');
    expect(escolhaOpenAi('obrigatoria')).toBe('required');
    expect(escolhaOpenAi('nenhuma')).toBe('none');
  });

  it('resultados viram mensagens role: tool logo após o assistente', () => {
    expect(mensagensOpenAi('SYS', historico)).toEqual([
      { role: 'system', content: 'SYS' },
      { role: 'user', content: 'O que anotei sobre café?' },
      {
        role: 'assistant',
        content: 'Vou procurar.',
        tool_calls: [
          { id: 'call_1', type: 'function', function: { name: 'buscar_memoria', arguments: '{"consulta":"café"}' } },
          { id: 'call_2', type: 'function', function: { name: 'buscar_memoria', arguments: '{"consulta":"cafeteria"}' } },
        ],
      },
      { role: 'tool', tool_call_id: 'call_1', content: 'Nota: café coado.' },
      { role: 'tool', tool_call_id: 'call_2', content: 'ERRO: timeout' },
    ]);
  });

  it('texto junto dos resultados vem depois deles; assistente só com chamadas tem content null', () => {
    const msgs = mensagensOpenAi('S', [
      {
        papel: 'assistant',
        blocos: [{ tipo: 'chamada', id: 'c', nome: 'f', entrada: {} }],
      },
      {
        papel: 'user',
        blocos: [
          { tipo: 'texto', texto: 'continue' },
          { tipo: 'resultado', idChamada: 'c', conteudo: 'ok' },
        ],
      },
    ]);
    expect(msgs.slice(1)).toEqual([
      {
        role: 'assistant',
        content: null,
        tool_calls: [{ id: 'c', type: 'function', function: { name: 'f', arguments: '{}' } }],
      },
      { role: 'tool', tool_call_id: 'c', content: 'ok' },
      { role: 'user', content: 'continue' },
    ]);
  });

  function resposta(
    message: Record<string, unknown>,
    finish_reason: string,
  ): OpenAI.Chat.Completions.ChatCompletion {
    return {
      choices: [{ message, finish_reason }],
      usage: { prompt_tokens: 10, completion_tokens: 3 },
    } as unknown as OpenAI.Chat.Completions.ChatCompletion;
  }

  it('interpreta chamadas e marca argumentos inválidos sem descartar a chamada', () => {
    const r = respostaOpenAi(
      resposta(
        {
          content: null,
          tool_calls: [
            { id: 'a', type: 'function', function: { name: 'f', arguments: '{"x":1}' } },
            { id: 'b', type: 'function', function: { name: 'f', arguments: '{quebrado' } },
            { id: 'c', type: 'function', function: { name: 'f', arguments: '[1]' } },
            { id: 'd', type: 'custom', custom: { name: 'g', input: '' } },
          ],
        },
        'tool_calls',
      ),
    );
    expect(r.parada).toBe('ferramenta');
    expect(r.chamadas).toEqual([
      { id: 'a', nome: 'f', entrada: { x: 1 } },
      { id: 'b', nome: 'f', entrada: {}, argumentosInvalidos: '{quebrado' },
      { id: 'c', nome: 'f', entrada: {}, argumentosInvalidos: '[1]' },
    ]);
    expect(r.usage).toEqual({ entrada: 10, saida: 3 });
    expect(r.mensagem.blocos.map((b) => b.tipo)).toEqual(['chamada', 'chamada', 'chamada']);
  });

  it.each([
    ['stop', 'fim'],
    ['length', 'limite'],
    ['content_filter', 'recusa'],
  ])('finish_reason %s → %s', (finish, parada) => {
    const r = respostaOpenAi(resposta({ content: 'oi' }, finish));
    expect(r.parada).toBe(parada);
    expect(r.mensagem).toEqual({ papel: 'assistant', blocos: [{ tipo: 'texto', texto: 'oi' }] });
  });
});

describe('troca de provedor no meio da conversa', () => {
  it('um turno da OpenAI entra no histórico e vai para a Anthropic sem perda', () => {
    const turno = respostaOpenAi({
      choices: [
        {
          message: {
            content: 'Vou buscar.',
            tool_calls: [{ id: 'call_9', type: 'function', function: { name: 'buscar_memoria', arguments: '{"consulta":"x"}' } }],
          },
          finish_reason: 'tool_calls',
        },
      ],
    } as unknown as OpenAI.Chat.Completions.ChatCompletion);
    const seguinte = mensagensAnthropic([
      historico[0],
      turno.mensagem,
      { papel: 'user', blocos: [{ tipo: 'resultado', idChamada: 'call_9', conteudo: 'achei' }] },
    ]);
    expect(seguinte[1].content).toEqual([
      { type: 'text', text: 'Vou buscar.' },
      { type: 'tool_use', id: 'call_9', name: 'buscar_memoria', input: { consulta: 'x' } },
    ]);
    expect(seguinte[2].content).toEqual([
      { type: 'tool_result', tool_use_id: 'call_9', content: 'achei' },
    ]);
  });
});
