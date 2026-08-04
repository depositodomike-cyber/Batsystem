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
  // expor a porta; localmente é equivalente a localhost.
  await app.listen(port, '0.0.0.0');
  console.log(`🚀 beculture API rodando em http://localhost:${port}`);
}

void bootstrap();
