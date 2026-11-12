// `AiService.completarComFerramentas`: failover pela fila do tenant, diretrizes
// e registro de uso — com os provedores simulados (nenhuma chamada de rede).
import { ServiceUnavailableException } from '@nestjs/common';
import { AiService } from './ai.service';
import { getProvider } from './providers';
import type { DefinicaoFerramenta, LlmToolsResult } from './tool-use';

jest.mock('./providers', () => {
  const real = jest.requireActual('./providers');
  const provedores = {
    anthropic: { completeWithTools: jest.fn() },
    openai: { completeWithTools: jest.fn() },
  };
  return { ...real, getProvider: jest.fn((p: 'anthropic' | 'openai') => provedores[p]) };
});

const anthropic = getProvider('anthropic').completeWithTools as jest.Mock;
const openai = getProvider('openai').completeWithTools as jest.Mock;

const ferramenta: DefinicaoFerramenta = {
  nome: 'buscar',
  descricao: 'busca',
  parametros: { type: 'object', properties: {} },
};

const turno: LlmToolsResult = {
  texto: '',
  chamadas: [{ id: 'c1', nome: 'buscar', entrada: {} }],
  parada: 'ferramenta',
  usage: { entrada: 100, saida: 20 },
  mensagem: { papel: 'assistant', blocos: [{ tipo: 'chamada', id: 'c1', nome: 'buscar', entrada: {} }] },
};

const mensagens = [{ papel: 'user' as const, blocos: [{ tipo: 'texto' as const, texto: 'oi' }] }];

function montar() {
  const connections = {
    listDecrypted: jest.fn().mockResolvedValue([
      { id: 'k1', provider: 'anthropic', model: 'claude-x', apiKey: 'a' },
      { id: 'k2', provider: 'openai', model: 'gpt-x', apiKey: 'b' },
    ]),
    marcarInvalida: jest.fn().mockResolvedValue(undefined),
  };
  const uso = { registrar: jest.fn() };
  const memorias = { blocoSystem: jest.fn().mockResolvedValue('DIRETRIZES') };
  const perfil = { blocoPreferencias: jest.fn().mockResolvedValue('') };
  const service = new AiService(
    { get: jest.fn() } as never,
    {} as never,
    connections as never,
    uso as never,
    {} as never,
    memorias as never,
    perfil as never,
  );
  return { service, connections, uso, memorias };
}

beforeEach(() => {
  anthropic.mockReset();
  openai.mockReset();
});

describe('AiService.completarComFerramentas', () => {
  it('usa o primeiro da fila, com diretrizes, e registra o uso', async () => {
    const { service, uso } = montar();
    anthropic.mockResolvedValue(turno);
    const r = await service.completarComFerramentas('e1', 'u1', {
      system: 'SYS',
      mensagens,
      ferramentas: [ferramenta],
      escolha: 'obrigatoria',
    });
    expect(anthropic).toHaveBeenCalledWith({
      apiKey: 'a',
      model: 'claude-x',
      system: 'SYS\n\nDIRETRIZES',
      mensagens,
      ferramentas: [ferramenta],
      maxTokens: 4000,
      escolha: 'obrigatoria',
    });
    expect(openai).not.toHaveBeenCalled();
    expect(r).toEqual({ ...turno, modelo: 'anthropic/claude-x' });
    expect(uso.registrar).toHaveBeenCalledWith({
      empresaId: 'e1',
      usuarioId: 'u1',
      entrada: 100,
      saida: 20,
      fonte: 'ferramentas',
    });
  });

  it('semDiretrizes manda o system como veio', async () => {
    const { service, memorias } = montar();
    anthropic.mockResolvedValue(turno);
    await service.completarComFerramentas('e1', 'u1', {
      system: 'ROTEADOR',
      mensagens,
      ferramentas: [],
      semDiretrizes: true,
      fonte: 'roteador',
    });
    expect(anthropic.mock.calls[0][0].system).toBe('ROTEADOR');
    expect(memorias.blocoSystem).not.toHaveBeenCalled();
  });

  it('falha do provedor passa para o próximo da fila (outro provedor)', async () => {
    const { service, connections } = montar();
    anthropic.mockRejectedValue(Object.assign(new Error('sobrecarga'), { status: 529 }));
    openai.mockResolvedValue(turno);
    const r = await service.completarComFerramentas('e1', 'u1', {
      system: 'S',
      mensagens,
      ferramentas: [ferramenta],
    });
    expect(r.modelo).toBe('openai/gpt-x');
    expect(openai.mock.calls[0][0].mensagens).toBe(mensagens);
    expect(connections.marcarInvalida).not.toHaveBeenCalled();
  });

  it('chave recusada marca a conexão inválida e segue a fila', async () => {
    const { service, connections } = montar();
    anthropic.mockRejectedValue(Object.assign(new Error('auth'), { status: 401 }));
    openai.mockResolvedValue(turno);
    await service.completarComFerramentas('e1', 'u1', { system: 'S', mensagens, ferramentas: [] });
    expect(connections.marcarInvalida).toHaveBeenCalledWith('k1');
  });

  it('erro da requisição (400) não troca de modelo e vira mensagem clara', async () => {
    const { service } = montar();
    anthropic.mockRejectedValue(Object.assign(new Error('payload'), { status: 400 }));
    await expect(
      service.completarComFerramentas('e1', 'u1', { system: 'S', mensagens, ferramentas: [] }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(openai).not.toHaveBeenCalled();
  });

  it('valida ferramentas e mensagens antes de gastar tokens', async () => {
    const { service } = montar();
    await expect(
      service.completarComFerramentas('e1', 'u1', {
        system: 'S',
        mensagens,
        ferramentas: [{ ...ferramenta, nome: 'nome inválido' }],
      }),
    ).rejects.toThrow(/inválido/);
    await expect(
      service.completarComFerramentas('e1', 'u1', { system: 'S', mensagens: [], ferramentas: [] }),
    ).rejects.toThrow(/ao menos uma mensagem/);
    expect(anthropic).not.toHaveBeenCalled();
  });
});
