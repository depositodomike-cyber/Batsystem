import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { json, urlencoded } from 'express';
import helmet from 'helmet';
import { HttpExceptionFilter } from './common/http-exception.filter';

/**
 * Configuração compartilhada entre o bootstrap local (`main.ts`) e o
 * entrypoint serverless da Vercel (`api/index.js`). Mantém CORS, body
 * parser, helmet e pipes iguais nos dois ambientes.
 */
export function configureApp(app: INestApplication): void {
  // Desligamos o body-parser padrão (limite ~100kb) e registramos o nosso com
  // um teto alto: a sincronização do Vault (/ai/vault) envia lotes de notas .md
  // em JSON que passam facilmente de 100kb. Uploads multipart (FileInterceptor)
  // usam multer e não são afetados por isto.
  app.use(json({ limit: '25mb' }));
  app.use(urlencoded({ extended: true, limit: '25mb' }));

  const config = app.get(ConfigService);

  // Headers de segurança (CSP não se aplica: a API só serve JSON/SSE).
  app.use(helmet({ contentSecurityPolicy: false }));

  // CORS_ORIGIN aceita uma ou mais origens separadas por vírgula.
  const origins = config
    .get<string>('CORS_ORIGIN', 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  app.enableCors({
    origin: origins,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());
}
