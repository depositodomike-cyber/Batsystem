// Conexões pessoais por usuário: um membro nunca vê nem altera a conta
// (e-mail, agenda, Drive) de outro; conectores da organização seguem da empresa.
import { ForbiddenException } from '@nestjs/common';
import { chaveConexao, ehPessoal, permissaoParaAlterar, titularDe, visiveisPara } from './titular';
import { ConectoresService } from './conectores.service';
import { OauthStateService } from './oauth-state.service';
import { OauthProviderService } from './oauth-provider.service';
import { AcessoConectores } from './acesso-conectores';
import { RolesService } from '@/acesso/roles.service';
import type { AuthenticatedUser } from '@/auth/jwt.strategy';

const crypto = {
  encrypt: (v: string) => `cif(${v})`,
  decrypt: (v: string) => v.replace(/^cif\((.*)\)$/, '$1'),
};
const config = {
  get: (k: string, padrao?: string) =>
    ({ ENCRYPTION_KEY: 'segredo-de-teste', GOOGLE_CLIENT_ID: 'cid', GOOGLE_CLIENT_SECRET: 'cs' })[k] ?? padrao,
};

describe('titular', () => {
  it('pessoais: Gmail, Outlook, Agenda e Drive; o resto é da organização', () => {
    expect(['gmail', 'outlook', 'google-calendar', 'google-drive'].every(ehPessoal)).toBe(true);
    expect(['slack', 'teams', 'zapier', 'gupy'].some(ehPessoal)).toBe(false);
  });

  it('a chave única inclui o titular: usuário nas pessoais, "" nas da organização', () => {
    expect(chaveConexao('e1', 'gmail', 'u1')).toEqual({
      empresaId_connectorId_titular: { empresaId: 'e1', connectorId: 'gmail', titular: 'u1' },
    });
    expect(chaveConexao('e1', 'zapier', 'u1')).toEqual({
      empresaId_connectorId_titular: { empresaId: 'e1', connectorId: 'zapier', titular: '' },
    });
    expect(() => titularDe('gmail', null)).toThrow(/exige o usuário/);
  });

  it('visibilidade: organização + as SUAS pessoais; sem usuário (MCP), só organização', () => {
    expect(visiveisPara('e1', 'u1')).toEqual({ empresaId: 'e1', OR: [{ titular: '' }, { titular: 'u1' }] });
    expect(visiveisPara('e1', null)).toEqual({ empresaId: 'e1', OR: [{ titular: '' }] });
  });

  it('permissão para alterar: pessoal = conectores.visualizar; organização = conectores.configurar', () => {
    expect(permissaoParaAlterar('gmail')).toBe('conectores.visualizar');
    expect(permissaoParaAlterar('zapier')).toBe('conectores.configurar');
  });
});

describe('ConectoresService com titular', () => {
  function montar() {
    const prisma = {
      empresaConector: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue({}),
        count: jest.fn().mockResolvedValue(0),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const oauth = { revogarGoogle: jest.fn().mockResolvedValue(undefined) };
    const service = new ConectoresService(prisma as never, crypto as never, oauth as never);
    return { service, prisma, oauth };
  }

  it('list lê só o que o usuário vê', async () => {
    const { service, prisma } = montar();
    await service.list('e1', 'u1');
    expect(prisma.empresaConector.findMany).toHaveBeenCalledWith({
      where: { empresaId: 'e1', OR: [{ titular: '' }, { titular: 'u1' }] },
    });
  });

  it('connect pessoal grava com o titular e o usuário', async () => {
    const { service, prisma } = montar();
    await service.connect('e1', 'u1', 'gmail', 'app');
    expect(prisma.empresaConector.upsert).toHaveBeenCalledWith({
      where: chaveConexao('e1', 'gmail', 'u1'),
      create: { empresaId: 'e1', connectorId: 'gmail', origem: 'app', titular: 'u1', usuarioId: 'u1' },
      update: {},
    });
  });

  it('connect da organização grava sem usuário', async () => {
    const { service, prisma } = montar();
    await service.connect('e1', 'u1', 'zapier', 'app');
    expect(prisma.empresaConector.upsert.mock.calls[0][0].create).toMatchObject({ titular: '', usuarioId: null });
  });

  it('disconnect Google: conta e revoga só a concessão DESTE usuário', async () => {
    const { service, prisma, oauth } = montar();
    await service.disconnect('e1', 'u1', 'gmail');
    expect(prisma.empresaConector.count.mock.calls[0][0].where).toMatchObject({ empresaId: 'e1', titular: 'u1' });
    expect(oauth.revogarGoogle).toHaveBeenCalledWith('e1', 'u1', 'gmail');
    expect(prisma.empresaConector.deleteMany).toHaveBeenCalledWith({
      where: { empresaId: 'e1', connectorId: 'gmail', titular: 'u1' },
    });
  });

  it('disconnect Google com outro Google do mesmo usuário ativo: não revoga', async () => {
    const { service, prisma, oauth } = montar();
    prisma.empresaConector.count.mockResolvedValue(1);
    await service.disconnect('e1', 'u1', 'gmail');
    expect(oauth.revogarGoogle).not.toHaveBeenCalled();
  });

  it('get de conector pessoal sem usuário (MCP) aparece desconectado, sem consultar', async () => {
    const { service, prisma } = montar();
    const r = await service.get('e1', null, 'gmail');
    expect(r.connected).toBe(false);
    expect(prisma.empresaConector.findUnique).not.toHaveBeenCalled();
  });
});

describe('OAuth: o dono viaja no state assinado', () => {
  const state = new OauthStateService(config as never, crypto as never);

  it('assina e devolve o usuário', () => {
    const s = state.sign('e1', 'gmail', 'verif', 'u1');
    expect(state.verify(s)).toEqual({ empresaId: 'e1', connectorId: 'gmail', codeVerifier: 'verif', usuarioId: 'u1' });
  });

  it('trocar o usuário no payload quebra a assinatura', () => {
    const [payload, mac] = state.sign('e1', 'gmail', undefined, 'u1').split('.');
    const adulterado = Buffer.from(
      JSON.stringify({ ...JSON.parse(Buffer.from(payload, 'base64url').toString()), u: 'u2' }),
    ).toString('base64url');
    expect(() => state.verify(`${adulterado}.${mac}`)).toThrow(/adulterado/);
  });

  function provedor() {
    const prisma = {
      empresaConector: {
        upsert: jest.fn().mockResolvedValue({}),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };
    const svc = new OauthProviderService(config as never, prisma as never, crypto as never, state);
    return { svc, prisma };
  }

  it('callback de conta pessoal sem dono no state (link antigo) é recusado, sem gravar', async () => {
    const { svc, prisma } = provedor();
    const antigo = state.sign('e1', 'gmail', 'verif');
    await expect(svc.handleCallback('code', antigo, 'email')).rejects.toThrow(/Autorização antiga/);
    expect(prisma.empresaConector.upsert).not.toHaveBeenCalled();
  });

  it('getAccessToken lê só a conexão do usuário pedido', async () => {
    const { svc, prisma } = provedor();
    prisma.empresaConector.findUnique.mockResolvedValue(null);
    await expect(svc.getAccessToken('e1', 'u2', 'gmail', 'email')).rejects.toThrow(
      /ainda não foi autorizado na sua conta/,
    );
    expect(prisma.empresaConector.findUnique).toHaveBeenCalledWith({ where: chaveConexao('e1', 'gmail', 'u2') });
  });

  it('URL de autorização carrega o usuário no state', () => {
    const { svc } = provedor();
    const url = new URL(svc.buildAuthorizeUrl('e1', 'u1', 'gmail', 'email'));
    expect(state.verify(url.searchParams.get('state')!).usuarioId).toBe('u1');
  });
});

describe('quem pode alterar conexões', () => {
  const membro = { id: 'u1', empresaId: 'e1', role: 'membro', email: '' } as AuthenticatedUser;

  function acesso(ctx: { convidado: boolean; permissoes: string[] }) {
    const roles = new RolesService(
      ...([] as unknown as ConstructorParameters<typeof RolesService>),
    ) as RolesService & { contextoDeAutorizacao: jest.Mock };
    roles.contextoDeAutorizacao = jest.fn().mockResolvedValue(ctx);
    return new AcessoConectores(roles);
  }

  it('membro com conectores.visualizar conecta a própria conta, mas não um conector da organização', async () => {
    const a = acesso({ convidado: false, permissoes: ['conectores.visualizar'] });
    await expect(a.exigirPodeAlterar(membro, 'gmail')).resolves.toBeUndefined();
    await expect(a.exigirPodeAlterar(membro, 'zapier')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('convidado não conecta nem a própria conta', async () => {
    const a = acesso({ convidado: true, permissoes: ['ia.usar'] });
    await expect(a.exigirPodeAlterar({ ...membro, role: 'owner' }, 'gmail')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('owner/admin alteram conectores da organização', async () => {
    const a = acesso({ convidado: false, permissoes: [] });
    await expect(a.exigirPodeAlterar({ ...membro, role: 'admin' }, 'zapier')).resolves.toBeUndefined();
  });
});
