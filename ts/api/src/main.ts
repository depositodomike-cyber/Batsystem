import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { configureApp } from './bootstrap';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  configureApp(app);

  const config = app.get(ConfigService);
  const port = config.get<number>('PORT', 3001);
  // 0.0.0.0 é exigido por plataformas de container (Railway/Render) para
  // expor a porta; localmente é equivalente a localhost. O Oracle Desktop
  // passa HOST=127.0.0.1: a API embutida não fica acessível pela rede.
  const host = config.get<string>('HOST', '0.0.0.0');
  await app.listen(port, host);
  console.log(`🚀 Oracle API rodando em http://localhost:${port}`);
}

void bootstrap();
