import { generateKeyPairSync, randomBytes, sign } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { UnauthorizedException } from '@nestjs/common';
import { AgenteDesktopGuard } from './agente.guard';
import { ChaveServidor, mensagemRequisicao, verificarP1363 } from './assinatura';
import { createPublicKey } from 'node:crypto';

function dispositivo() {
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  return {
    privateKey,
    spki: publicKey.export({ format: 'der', type: 'spki' }).toString('base64'),
  };
}

function montar(opts: { status?: string; chave?: string | null; nonceRepetido?: boolean; ativo?: boolean } = {}) {
  const dev = dispositivo();
  const registro = {
    id: 'clxdispositivo0001',
    chavePublica: opts.chave === undefined ? dev.spki : opts.chave,
    status: opts.status ?? 'conectado',
    revogadoEm: null,
  };
  const prisma = {
    dispositivoDesktop: { findUnique: jest.fn().mockResolvedValue(registro) },
    nonceDesktop: {
      create: jest.fn(async () => {
        if (opts.nonceRepetido) {
          throw new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'x' });
        }
        return {};
      }),
    },
  };
  const gateway = { liberacao: () => ({ ativo: opts.ativo ?? true }) };
  const guard = new AgenteDesktopGuard(prisma as never, gateway as never);
  return { guard, prisma, dev, registro };
}

function req(dev: ReturnType<typeof dispositivo>, o: { corpo?: string; url?: string; ts?: number; nonce?: string; adulterar?: boolean } = {}) {
  const corpo = Buffer.from(o.corpo ?? '{"a":1}');
  const url = o.url ?? '/desktop/agente/sincronizar';
  const ts = String(o.ts ?? Date.now());
  const nonce = o.nonce ?? randomBytes(16).toString('hex');
  const msg = mensagemRequisicao('POST', url, ts, nonce, corpo);
  const assinatura = sign('sha256', msg, { key: dev.privateKey, dsaEncoding: 'ieee-p1363' }).toString('base64');
  const headers: Record<string, string> = {
    'x-oracle-dispositivo': 'clxdispositivo0001',
    'x-oracle-timestamp': ts,
    'x-oracle-nonce': nonce,
    'x-oracle-assinatura': assinatura,
  };
  return {
    method: 'POST',
    originalUrl: url,
    rawBody: o.adulterar ? Buffer.from('{"a":2}') : corpo,
    header: (n: string) => headers[n.toLowerCase()],
  };
}

const ctx = (r: unknown) => ({ switchToHttp: () => ({ getRequest: () => r }) }) as never;

describe('AgenteDesktopGuard (SR-22, SR-26, SR-32, SR-36)', () => {
  it('aceita requisição assinada corretamente e anexa o dispositivo', async () => {
    const m = montar();
    const r = req(m.dev);
    await expect(m.guard.canActivate(ctx(r))).resolves.toBe(true);
    expect((r as unknown as { dispositivo: unknown }).dispositivo).toBe(m.registro);
  });

  it('corpo adulterado → 401', async () => {
    const m = montar();
    await expect(m.guard.canActivate(ctx(req(m.dev, { adulterar: true })))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('query string faz parte da assinatura (SR-26)', async () => {
    const m = montar();
    const r = req(m.dev, { url: '/desktop/agente/sincronizar?x=1' });
    r.originalUrl = '/desktop/agente/sincronizar?x=2';
    await expect(m.guard.canActivate(ctx(r))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('timestamp fora da janela de 60s → 401', async () => {
    const m = montar();
    await expect(m.guard.canActivate(ctx(req(m.dev, { ts: Date.now() - 120_000 })))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('nonce repetido (replay) → 401', async () => {
    const m = montar({ nonceRepetido: true });
    await expect(m.guard.canActivate(ctx(req(m.dev)))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('dispositivo revogado (sem chave ou status revogado) → 401', async () => {
    const a = montar({ chave: null });
    await expect(a.guard.canActivate(ctx(req(a.dev)))).rejects.toBeInstanceOf(UnauthorizedException);
    const b = montar({ status: 'revogado' });
    await expect(b.guard.canActivate(ctx(req(b.dev)))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('assinatura de OUTRA chave → 401', async () => {
    const m = montar();
    await expect(m.guard.canActivate(ctx(req(dispositivo())))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('funcionalidade não liberada → 404 (rotas não existem)', async () => {
    const m = montar({ ativo: false });
    await expect(m.guard.canActivate(ctx(req(m.dev)))).rejects.toThrow();
    expect(m.prisma.dispositivoDesktop.findUnique).not.toHaveBeenCalled();
  });
});

describe('ChaveServidor (SR-20/SR-25)', () => {
  it('envelope = bytes JSON exatos assinados em P1363, verificáveis com a chave pública', () => {
    const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    const pem = privateKey.export({ format: 'pem', type: 'pkcs8' }).toString();
    const chave = ChaveServidor.carregar(Buffer.from(pem).toString('base64'), '/nao/usado');
    const env = chave.envelope({ tipo: 'comando', dispositivoId: 'd1', id: 'c1' });
    const pub = createPublicKey({ key: Buffer.from(chave.publicaSpkiB64, 'base64'), format: 'der', type: 'spki' });
    const bytes = Buffer.from(env.payload, 'base64');
    expect(verificarP1363(pub, bytes, env.assinatura)).toBe(true);
    expect(JSON.parse(bytes.toString())).toEqual({ tipo: 'comando', dispositivoId: 'd1', id: 'c1' });
    const adulterado = Buffer.from(JSON.stringify({ tipo: 'comando', dispositivoId: 'd2', id: 'c1' }));
    expect(verificarP1363(pub, adulterado, env.assinatura)).toBe(false);
    expect(chave.impressao).toMatch(/^[0-9A-F]{4}(-[0-9A-F]{4}){3}$/);
  });

  it('recusa chave que não seja P-256', () => {
    const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'secp384r1' });
    const pem = privateKey.export({ format: 'pem', type: 'pkcs8' }).toString();
    expect(() => ChaveServidor.carregar(Buffer.from(pem).toString('base64'), '/x')).toThrow();
  });
});
