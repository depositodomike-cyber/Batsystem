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

  /**
   * Sufixo das URLs da Vercel do time, liberado ALÉM da lista fixa.
   *
   * Cada deploy ganha uma URL própria e efêmera
   * (`beculture-<hash>-beculture.vercel.app`), e o projeto ainda tem aliases
   * como `beculture-web-beculture.vercel.app`. Nenhuma delas cabe numa lista
   * estática, e abrir a app por qualquer uma derrubava TODAS as chamadas no
   * preflight: sem `Access-Control-Allow-Origin` o browser bloqueia a resposta,
   * o axios não recebe resposta nenhuma e o front conclui "servidor
   * indisponível" — entrando em sessão local, com 401 em tudo depois.
   *
   * O sufixo é específico do time (`-<time>.vercel.app`), então não abre a API
   * para deploys de terceiros. Ponha string vazia para desligar a regra.
   */
  const sufixoVercel = config
    .get<string>('CORS_VERCEL_SUFFIX', '-beculture.vercel.app')
    .trim();

  const origemPermitida = (origem: string): boolean => {
    if (origins.includes(origem)) return true;
    return (
      sufixoVercel !== '' &&
      origem.startsWith('https://') &&
      origem.endsWith(sufixoVercel)
    );
  };

  app.enableCors({
    // Callback, e não a lista: `cb(null, false)` só omite os headers (o browser
    // barra), enquanto lançar viraria 500 no preflight.
    origin: (
      origem: string | undefined,
      cb: (err: Error | null, permitido?: boolean) => void,
    ) => {
      // Sem `Origin` não é requisição de browser (curl, health check, SSR).
      if (!origem) return cb(null, true);
      cb(null, origemPermitida(origem));
    },
    credentials: true,
    // `X-Repositorio-Id` é um header custom: sem declará-lo o preflight o
    // bloqueia e o isolamento por repositório cai, em silêncio, para o escopo
    // do tenant — que é exatamente o que ele existe para evitar.
    allowedHeaders: ["Content-Type", "Authorization", "X-Repositorio-Id"],
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
