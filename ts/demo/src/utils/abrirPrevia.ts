/**
 * Abre conteúdo gerado (HTML de painel, carrossel, apresentação), anexos e a
 * versão de impressão numa janela própria.
 *
 * - Navegador: como sempre, nova aba com um `blob:` (`noopener`).
 * - Oracle Desktop: numa janela de prévia isolada, de origem opaca e sessão
 *   própria (desktop/src/main/previa.ts). Conteúdo gerado por IA nunca roda
 *   na origem do app, onde veria os dados locais e as pastas do Repositório.
 */
import { useEffect, useState } from "react";
import { ponteDesktop } from "./desktop";

export async function abrirEmJanelaPropria(
  blob: Blob,
  opcoes: { titulo?: string; imprimir?: boolean } = {},
): Promise<void> {
  const ponte = ponteDesktop();
  if (ponte) {
    const ok = await ponte.abrirPrevia(await blob.arrayBuffer(), blob.type || "text/html", opcoes);
    if (!ok) throw new Error("Não foi possível abrir este conteúdo.");
    return;
  }
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener,noreferrer");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Escapa texto para HTML (títulos montados em documentos gerados). */
export function escaparHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

/**
 * URL de prévia isolada para um iframe DENTRO da interface (Dashboard), só no
 * Oracle Desktop. Lá, um `srcdoc` herdaria a CSP do app e os scripts do painel
 * não rodariam; a URL `oracle-previa:` traz a CSP própria (sandbox, origem
 * opaca). Na web devolve null e o chamador segue com `srcDoc`.
 */
export function usePreviaIsolada(html: string | null): string | null {
  const [url, setUrl] = useState<{ html: string; url: string } | null>(null);
  useEffect(() => {
    const ponte = ponteDesktop();
    if (!ponte || !html) return;
    let vivo = true;
    void ponte.registrarPrevia(html, "text/html").then((u) => {
      if (vivo && u) setUrl({ html, url: u });
    });
    return () => {
      vivo = false;
    };
  }, [html]);
  return url && url.html === html ? url.url : null;
}
