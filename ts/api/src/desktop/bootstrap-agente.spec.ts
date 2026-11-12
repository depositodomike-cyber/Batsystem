// GB-07 / SR-26: o parser das rotas do agente guarda o corpo CRU (o que a
// assinatura cobre), tem limite de 64 KB e é registrado antes do global.
import { Body, Controller, Module, Post, Req } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';
import { configureApp } from '@/bootstrap';

@Controller()
class EcoController {
  @Post('desktop/agente/eco')
  agente(@Req() req: { rawBody?: Buffer }, @Body() body: unknown) {
    return { raw: req.rawBody ? req.rawBody.toString('utf8') : null, body };
  }

  @Post('outra/eco')
  outra(@Req() req: { rawBody?: Buffer }, @Body() body: unknown) {
    return { raw: req.rawBody ? 'tem' : null, tamanho: JSON.stringify(body).length };
  }
}

@Module({ imports: [ConfigModule.forRoot({ ignoreEnvFile: true })], controllers: [EcoController] })
class EcoModule {}

describe('bootstrap — parser das rotas do agente (GB-07)', () => {
  let app: INestApplication;
  let base: string;

  beforeAll(async () => {
    app = await NestFactory.create(EcoModule, { bodyParser: false, logger: false });
    configureApp(app);
    await app.listen(0, '127.0.0.1');
    base = await app.getUrl();
  });
  afterAll(async () => app.close());

  const post = (caminho: string, corpo: string, tipo = 'application/json') =>
    fetch(`${base}${caminho}`, { method: 'POST', headers: { 'content-type': tipo }, body: corpo });

  it('guarda os bytes EXATOS do corpo (espaços e ordem preservados)', async () => {
    const corpo = '{ "b": 1,  "a": "ção" }';
    const r = await post('/desktop/agente/eco', corpo);
    expect(r.status).toBe(201);
    const j = (await r.json()) as { raw: string; body: unknown };
    expect(j.raw).toBe(corpo);
    expect(j.body).toEqual({ b: 1, a: 'ção' });
  });

  it('recusa corpo acima de 64 KB nas rotas do agente', async () => {
    const r = await post('/desktop/agente/eco', JSON.stringify({ x: 'a'.repeat(70 * 1024) }));
    // O body-parser recusa (PayloadTooLarge); o filtro global da API o
    // devolve como erro genérico. O que importa: o handler nunca roda.
    expect(r.status).toBeGreaterThanOrEqual(400);
    expect(((await r.json()) as { raw?: unknown }).raw).toBeUndefined();
  });

  it('outras rotas seguem com o parser global (25 MB) e sem corpo cru', async () => {
    const r = await post('/outra/eco', JSON.stringify({ x: 'a'.repeat(200 * 1024) }));
    expect(r.status).toBe(201);
    const j = (await r.json()) as { raw: unknown };
    expect(j.raw).toBeNull();
  });

  it('content-type não JSON não gera corpo cru (a assinatura então não confere)', async () => {
    const r = await post('/desktop/agente/eco', '{"a":1}', 'text/plain');
    const j = (await r.json()) as { raw: unknown };
    expect(j.raw).toBeNull();
  });
});
