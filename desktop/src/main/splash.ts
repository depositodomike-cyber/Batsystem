import type { EstadoBackend } from "./servicos/backend";

/**
 * Tela de abertura enquanto o backend sobe. A interface só é carregada com a
 * API pronta: antes disso, o login cairia no "modo local" (token de protótipo).
 * Página estática em data: URL — sem acesso à ponte (a origem não é a do app).
 */

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function htmlSplash(e: Pick<EstadoBackend, "etapa" | "erro" | "pastaLogs">): string {
  const corpo = e.erro
    ? `<h1>Não foi possível iniciar o Oracle</h1>
       <p class="erro">${esc(e.erro)}</p>
       <p class="dica">Detalhes nos registros em<br><code>${esc(e.pastaLogs)}</code></p>
       <p class="dica">Feche e abra o Oracle para tentar de novo.</p>`
    : `<div class="giro" aria-hidden="true"></div>
       <h1>Oracle</h1>
       <p id="etapa">${esc(e.etapa || "Iniciando…")}</p>`;
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">
<title>Oracle</title>
<style>
  html,body{margin:0;height:100%;background:#000;color:#e5e7eb;font:15px/1.5 "Segoe UI",system-ui,sans-serif}
  body{display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:24px;box-sizing:border-box}
  h1{font-size:22px;font-weight:600;margin:16px 0 4px;color:#fff}
  p{margin:4px 0;color:#9ca3af;max-width:560px}
  .erro{color:#fca5a5;white-space:pre-wrap}
  .dica{font-size:13px}
  code{font-family:Consolas,monospace;font-size:12px;color:#d1d5db;word-break:break-all}
  .giro{width:28px;height:28px;border-radius:50%;border:3px solid #374151;border-top-color:#ef0a4a;animation:g 0.9s linear infinite}
  @keyframes g{to{transform:rotate(360deg)}}
</style></head><body>${corpo}</body></html>`;
}

export function urlSplash(e: Pick<EstadoBackend, "etapa" | "erro" | "pastaLogs">): string {
  return `data:text/html;charset=utf-8,${encodeURIComponent(htmlSplash(e))}`;
}
