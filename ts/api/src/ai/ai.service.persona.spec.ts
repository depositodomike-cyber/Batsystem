// Caracterização de `AiService.personaDoAgente`: é o que o orquestrador vai
// reaproveitar para "consultar um agente". Fixa as três origens de persona e,
// principalmente, as regras de visibilidade (agente de outra pessoa não existe).
import { AiService } from './ai.service';

const squad = {
  id: 's1',
  title: 'Estratégia',
  description: 'decisões estratégicas',
  agents: [
    { reference: 'Ana', position: 'CEO', contribution: 'visão' },
    { reference: 'Bia', position: 'CFO', contribution: 'números' },
  ],
};

function montar() {
  const prisma = {
    squad: { findFirst: jest.fn().mockResolvedValue(null) },
    agenteUsuario: { findFirst: jest.fn().mockResolvedValue(null) },
  };
  const service = new AiService(
    {} as never,
    prisma as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
  return { service, prisma };
}

const dono = { empresaId: 'e1', usuarioId: 'u1' };

describe('AiService.personaDoAgente (caracterização)', () => {
  it('agente do sistema (squad): uma voz com o repertório dos conselheiros', async () => {
    const { service, prisma } = montar();
    prisma.squad.findFirst.mockResolvedValue(squad);
    const p = await service.personaDoAgente('s1');
    expect(prisma.squad.findFirst).toHaveBeenCalledWith({
      where: { id: 's1', active: true },
      include: { agents: { where: { active: true }, orderBy: { order: 'asc' } } },
    });
    expect(p).toMatchObject({ id: 's1', titulo: 'Estratégia' });
    expect(p?.texto).toMatchSnapshot();
  });

  it('sem dono, id que não é squad não resolve', async () => {
    const { service, prisma } = montar();
    expect(await service.personaDoAgente('x')).toBeNull();
    expect(prisma.agenteUsuario.findFirst).not.toHaveBeenCalled();
  });

  it('agente pessoal: escopo do próprio usuário (sem organização ativa)', async () => {
    const { service, prisma } = montar();
    prisma.agenteUsuario.findFirst.mockResolvedValue({
      id: 'p1',
      nome: 'Revisor',
      descricao: 'revisa textos',
      instrucoes: 'seja breve',
      organizacaoId: null,
      sistemaId: null,
    });
    const p = await service.personaDoAgente('p1', dono);
    expect(prisma.agenteUsuario.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'p1',
        empresaId: 'e1',
        excluidoEm: null,
        OR: [{ usuarioId: 'u1', organizacaoId: null }],
      },
    });
    expect(p).toMatchObject({ id: 'p1', titulo: 'Revisor' });
    expect(p?.texto).toMatchSnapshot();
  });

  it('com organização ativa, também libera os agentes dela', async () => {
    const { service, prisma } = montar();
    prisma.agenteUsuario.findFirst.mockResolvedValue({
      id: 'o1',
      nome: 'RH',
      descricao: null,
      instrucoes: null,
      organizacaoId: 'org1',
      sistemaId: null,
    });
    const p = await service.personaDoAgente('o1', { ...dono, organizacaoId: 'org1' });
    expect(prisma.agenteUsuario.findFirst.mock.calls[0][0].where.OR).toEqual([
      { usuarioId: 'u1', organizacaoId: null },
      { organizacaoId: 'org1' },
    ]);
    expect(p?.texto).toMatchSnapshot();
  });

  it('versão da organização de um agente do sistema soma instruções ao original', async () => {
    const { service, prisma } = montar();
    prisma.squad.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(squad);
    prisma.agenteUsuario.findFirst.mockResolvedValue({
      id: 'v1',
      nome: 'Estratégia (nossa)',
      descricao: '',
      instrucoes: 'foque em varejo',
      organizacaoId: 'org1',
      sistemaId: 's1',
    });
    const p = await service.personaDoAgente('v1', { ...dono, organizacaoId: 'org1' });
    expect(prisma.squad.findFirst).toHaveBeenLastCalledWith({
      where: { id: 's1', active: true },
      include: { agents: { where: { active: true }, orderBy: { order: 'asc' } } },
    });
    expect(p).toMatchObject({ id: 'v1', titulo: 'Estratégia (nossa)' });
    // Descrição vazia cai na do original.
    expect(p?.texto).toContain('Quando utilizar este squad: decisões estratégicas');
    expect(p?.texto).toMatchSnapshot();
  });

  it('agente inexistente ou de outra pessoa resolve como null', async () => {
    const { service } = montar();
    expect(await service.personaDoAgente('alheio', dono)).toBeNull();
  });
});
