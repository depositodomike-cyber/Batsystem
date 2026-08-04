/**
 * Entrypoint serverless da Vercel.
 *
 * Importa o `dist/` gerado pelo `nest build` (tsc com emitDecoratorMetadata),
 * porque o compilador TS do @vercel/node (esbuild) NÃO emite metadata de
 * decorators — o que quebraria a DI do NestJS.
 *
 * O app Nest é cacheado entre invocações (Fluid Compute reusa a instância).
 */
const express = require('express');
const { NestFactory } = require('@nestjs/core');
const { ExpressAdapter } = require('@nestjs/platform-express');
const { AppModule } = require('../dist/app.module');
const { configureApp } = require('../dist/bootstrap');

const server = express();
let ready;

async function bootstrap() {
  const app = await NestFactory.create(AppModule, new ExpressAdapter(server), {
    bodyParser: false,
  });
  configureApp(app);
  await app.init();
}

module.exports = async (req, res) => {
  ready ??= bootstrap();
  await ready;
  server(req, res);
};
