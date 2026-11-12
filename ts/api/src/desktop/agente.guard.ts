import {
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request } from 'express';
import { PrismaService } from '@/prisma/prisma.service';
import { chavePublicaDispositivo, mensagemRequisicao, verificarP1363 } from './assinatura';
import { GatewayDesktopService } from './gateway.service';

export const JANELA_TIMESTAMP_MS = 60_000;

/**
 * Autentica o AGENTE (não o usuário): cada requisição é assinada com a chave
 * não exportável do dispositivo sobre método + caminho com query + timestamp
 * + nonce + SHA-256 do corpo cru (SR-22/SR-26). Nonce de uso único no banco
 * (SR-36). Dispositivo revogado → 401 (SR-32).
 */
@Injectable()
export class AgenteDesktopGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: GatewayDesktopService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    if (!this.gateway.liberacao().ativo) throw new NotFoundException();
    const req = ctx.switchToHttp().getRequest<Request & { rawBody?: Buffer; dispositivo?: unknown }>();
    const id = req.header('x-oracle-dispositivo') ?? '';
    const ts = req.header('x-oracle-timestamp') ?? '';
    const nonce = req.header('x-oracle-nonce') ?? '';
    const assinatura = req.header('x-oracle-assinatura') ?? '';
    const negar = () => new UnauthorizedException('Assinatura do dispositivo inválida.');

    if (!/^[a-z0-9]{10,40}$/.test(id) || !/^\d{13}$/.test(ts) || !/^[a-f0-9]{32}$/.test(nonce) || !assinatura) throw negar();
    if (Math.abs(Date.now() - Number(ts)) > JANELA_TIMESTAMP_MS) throw negar();

    const d = await this.prisma.dispositivoDesktop.findUnique({ where: { id } });
    if (!d || !d.chavePublica || d.status === 'revogado' || d.revogadoEm) throw negar();

    let chave;
    try {
      chave = chavePublicaDispositivo(d.chavePublica);
    } catch {
      throw negar();
    }
    const corpo = req.rawBody ?? Buffer.alloc(0);
    const msg = mensagemRequisicao(req.method, req.originalUrl, ts, nonce, corpo);
    if (!verificarP1363(chave, msg, assinatura)) throw negar();

    // Replay: o nonce só pode ser usado uma vez por dispositivo.
    try {
      await this.prisma.nonceDesktop.create({ data: { dispositivoId: d.id, nonce } });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') throw negar();
      throw err;
    }
    req.dispositivo = d;
    return true;
  }
}
