import type { Response } from 'express';

/**
 * Quem iniciou o fluxo OAuth. Ausente = a interface web (volta para FRONT_URL);
 * 'desktop' = o Oracle Desktop, que autoriza no navegador do sistema e volta
 * ao app pelo protocolo `oracle-desktop://` (desktop/src/main/deepLink.ts).
 */
export type OrigemOauth = 'desktop';

/** Retorno ao app desktop (substitui `FRONT_URL/oracle/conectores`). */
export const RETORNO_DESKTOP = 'oracle-desktop://conectores';

/** Lê o parâmetro `?origem=` do pedido de autorização. */
export function origemOauth(valor: unknown): OrigemOauth | undefined {
  return valor === 'desktop' ? 'desktop' : undefined;
}

/**
 * URL de volta ao front ao fim de um fluxo OAuth. O front lê estes
 * parâmetros na página de Conectores para exibir o toast de sucesso/erro:
 *
 *   ?conector=<id>&status=ok&conta=<conta autorizada>
 *   ?conector=<id>&status=erro&motivo=<mensagem>
 *
 * Compartilhado por todos os conectores OAuth (Slack, e-mail).
 */
export function oauthRetorno(
  frontUrl: string,
  connectorId: string,
  resultado: { conta: string } | { motivo: string },
): string {
  const params = new URLSearchParams({ conector: connectorId });
  if ('conta' in resultado) {
    params.set('status', 'ok');
    if (resultado.conta) params.set('conta', resultado.conta);
  } else {
    params.set('status', 'erro');
    params.set('motivo', resultado.motivo);
  }
  return `${frontUrl}?${params.toString()}`;
}

/** Mínimo de escape para texto e atributos HTML. */
function escaparHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/**
 * Página que o navegador mostra ao voltar para o Oracle Desktop. Um 302 direto
 * para `oracle-desktop://` não "carrega" nada na aba: o navegador entrega o
 * link ao Windows e a aba fica parada na tela do provedor, com a barra de
 * progresso girando para sempre. Aqui a aba chega a uma página de verdade,
 * que tenta abrir o app sozinha e oferece o botão (com gesto do usuário, que
 * o navegador sempre aceita) caso a abertura automática seja bloqueada.
 */
export function paginaRetornoDesktop(destino: string): string {
  const url = new URL(destino);
  const ok = url.searchParams.get('status') === 'ok';
  const titulo = ok ? 'Autorização concluída' : 'Não foi possível conectar';
  const detalhe = ok
    ? 'Pode voltar ao Oracle — esta aba já pode ser fechada.'
    : (url.searchParams.get('motivo') ?? 'Volte ao Oracle e tente de novo.');
  const href = escaparHtml(destino);
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Oracle — ${escaparHtml(titulo)}</title>
<style>
  :root{color-scheme:light dark}
  body{margin:0;min-height:100vh;display:grid;place-items:center;font:16px/1.5 system-ui,sans-serif;background:Canvas;color:CanvasText}
  main{max-width:420px;padding:32px 24px;text-align:center}
  h1{font-size:22px;margin:0 0 8px}
  p{margin:0 0 24px;opacity:.8}
  a{display:inline-block;padding:10px 20px;border-radius:999px;background:#3b5bdb;color:#fff;text-decoration:none;font-weight:600}
</style></head>
<body><main>
  <h1>${escaparHtml(titulo)}</h1>
  <p>${escaparHtml(detalhe)}</p>
  <a id="abrir" href="${href}">Abrir o Oracle</a>
</main>
<script>location.href = document.getElementById('abrir').href;</script>
</body></html>`;
}

/**
 * Encerra o callback OAuth: redireciona para a interface web ou, no Oracle
 * Desktop, mostra a página que devolve o usuário ao app.
 */
export function enviarRetornoOauth(res: Response, destino: string): void {
  if (!destino.startsWith(RETORNO_DESKTOP)) {
    res.redirect(destino);
    return;
  }
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).type('html').send(paginaRetornoDesktop(destino));
}
