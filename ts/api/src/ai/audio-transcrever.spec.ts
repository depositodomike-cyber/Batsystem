// POST /ai/audio/transcrever — ditado do Oracle Desktop (GD-13): só transcreve,
// idioma por allowlist, erro do provedor nunca vaza para o cliente.
import { BadRequestException } from '@nestjs/common';
import { AudioController } from './audio.controller';
import { transcreverAudioOpenAI } from './audio/transcrever';

jest.mock('./audio/transcrever', () => ({ transcreverAudioOpenAI: jest.fn() }));
const transcrever = transcreverAudioOpenAI as jest.MockedFunction<typeof transcreverAudioOpenAI>;

const usuario = { id: 'u1', empresaId: 'e1' } as never;
const audio = { originalname: 'ditado.webm', buffer: Buffer.from('x'), size: 1 };

function controller(chave: string | null = 'sk-teste') {
  const ai = { completar: jest.fn() };
  const memorias = { create: jest.fn(), list: jest.fn() };
  const insights = { gerarDeMaterial: jest.fn() };
  const chaveOpenAi = { resolver: jest.fn().mockResolvedValue(chave) };
  const c = new AudioController(ai as never, memorias as never, insights as never, chaveOpenAi as never);
  return { c, ai, memorias, insights };
}

describe('AudioController.transcrever', () => {
  beforeEach(() => transcrever.mockReset());

  it('sem arquivo → 400', async () => {
    await expect(controller().c.transcrever(usuario, undefined)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('só transcreve: não resume, não salva, não gera insights', async () => {
    transcrever.mockResolvedValue('olá mundo');
    const { c, ai, memorias, insights } = controller();
    await expect(c.transcrever(usuario, audio, 'pt')).resolves.toEqual({ texto: 'olá mundo' });
    expect(transcrever).toHaveBeenCalledWith('sk-teste', audio.buffer, 'ditado.webm', 'pt');
    expect(ai.completar).not.toHaveBeenCalled();
    expect(memorias.create).not.toHaveBeenCalled();
    expect(insights.gerarDeMaterial).not.toHaveBeenCalled();
  });

  it('idioma fora da allowlist é ignorado', async () => {
    transcrever.mockResolvedValue('x');
    await controller().c.transcrever(usuario, audio, 'xx; DROP');
    expect(transcrever).toHaveBeenCalledWith('sk-teste', audio.buffer, 'ditado.webm', undefined);
  });

  it('erro do provedor vira mensagem genérica (não vaza a chave)', async () => {
    transcrever.mockRejectedValue(new Error('Incorrect API key provided: sk-teste'));
    const r = controller().c.transcrever(usuario, audio, 'pt');
    await expect(r).rejects.toBeInstanceOf(BadRequestException);
    await expect(r).rejects.not.toThrow(/sk-teste/);
  });

  it('sem chave OpenAI → 400 explicando como conectar', async () => {
    await expect(controller(null).c.transcrever(usuario, audio)).rejects.toThrow(/OpenAI/);
  });
});
