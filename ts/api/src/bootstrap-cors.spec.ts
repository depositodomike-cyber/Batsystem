// CORS: a origem do Oracle Desktop (`oracle-app://app`) é aceita sem mexer na
// lista de `CORS_ORIGIN`, e uma origem qualquer continua barrada.
import { Controller, Get, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';
import { configureApp, ORIGEM_DESKTOP } from '@/bootstrap';

@Controller()
class PingController {
  @Get('ping')
  ping() {
    return { ok: true };
  }
}

@Module({ imports: [ConfigModule.forRoot({ ignoreEnvFile: true })], controllers: [PingController] })
class PingModule {}

describe('bootstrap — CORS do Oracle Desktop', () => {
  let app: INestApplication;
  let base: string;

  beforeAll(async () => {
    app = await NestFactory.create(PingModule, { bodyParser: false, logger: false });
    configureApp(app);
    await app.listen(0, '127.0.0.1');
    base = await app.getUrl();
  });
  afterAll(async () => app.close());

  const preflight = (origem: string) =>
    fetch(`${base}/ping`, {
      method: 'OPTIONS',
      headers: {
        Origin: origem,
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'authorization',
      },
    });

  it('aceita a origem do app desktop', async () => {
    const r = await preflight(ORIGEM_DESKTOP);
    expect(r.headers.get('access-control-allow-origin')).toBe(ORIGEM_DESKTOP);
  });

  it('continua aceitando o Vite local', async () => {
    const r = await preflight('http://localhost:5173');
    expect(r.headers.get('access-control-allow-origin')).toBe('http://localhost:5173');
  });

  it('barra outros esquemas próprios e sites quaisquer', async () => {
    for (const origem of ['oracle-app://outro', 'evil-app://app', 'https://exemplo.com']) {
      const r = await preflight(origem);
      expect(r.headers.get('access-control-allow-origin')).toBeNull();
    }
  });
});
