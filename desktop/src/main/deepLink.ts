import { app } from "electron";
import { appendFileSync } from "node:fs";
import path from "node:path";
import { arquivoLog } from "./servicos/caminhos";
import { URL_DEV } from "./config";
import { abrirRota, focarJanelaPrincipal } from "./janela";

/**
 * Protocolo `oracle-desktop://` — volta ao app depois da autorização OAuth
 * feita no navegador do sistema. A API redireciona para
 * `oracle-desktop://conectores?conector=…&status=…` (ts/api/src/conectores/
 * oauth-retorno.ts) e o Windows entrega a URL a esta instância (argv da
 * primeira abertura ou evento `second-instance`).
 */

export const PROTOCOLO = "oracle-desktop";

/** Parâmetros aceitos no retorno; o resto é descartado. */
const PARAMS_RETORNO = ["conector", "status", "conta", "motivo"] as const;

export function registrarProtocolo(): void {
  // `--` no fim: o Chromium para de ler switches ali, então uma URL
  // maliciosa não consegue injetar flags na linha de comando.
  if (process.defaultApp) {
    const args = [path.resolve(process.argv[1] ?? ".")];
    if (URL_DEV) args.push("--oracle-dev");
    app.setAsDefaultProtocolClient(PROTOCOLO, process.execPath, [...args, "--"]);
  } else {
    app.setAsDefaultProtocolClient(PROTOCOLO, process.execPath, ["--"]);
  }
}

/** O link vem depois do `--` com que o protocolo foi registrado. */
export function deepLinkNoArgv(argv: readonly string[]): string | null {
  const fim = argv.indexOf("--");
  if (fim < 0) return null;
  return argv.slice(fim + 1).find((a) => a.toLowerCase().startsWith(`${PROTOCOLO}://`)) ?? null;
}

/**
 * O retorno OAuth só é aceito logo depois de o app abrir um consentimento no
 * navegador (GD-11): um link `oracle-desktop://` disparado por qualquer página
 * fora dessa janela apenas traz o Oracle para a frente, sem recarregar nem
 * mostrar texto vindo da URL. Cada retorno consome a espera.
 */
const ESPERA_RETORNO_MS = 15 * 60_000;
let retornoEsperadoAte = 0;

export function aguardarRetornoOauth(agora = Date.now()): void {
  retornoEsperadoAte = agora + ESPERA_RETORNO_MS;
}

export function consumirRetornoEsperado(agora = Date.now()): boolean {
  const ok = agora <= retornoEsperadoAte;
  retornoEsperadoAte = 0;
  return ok;
}

/** Converte o deep link na rota da interface, ou null se não for válido. */
export function rotaDoDeepLink(link: string): string | null {
  let url: URL;
  try {
    url = new URL(link);
  } catch {
    return null;
  }
  if (url.protocol !== `${PROTOCOLO}:` || url.hostname !== "conectores") return null;
  const params = new URLSearchParams();
  for (const k of PARAMS_RETORNO) {
    const v = url.searchParams.get(k);
    if (v !== null) params.set(k, v.slice(0, 500));
  }
  if (!params.get("conector") || !params.get("status")) return null;
  return `/oracle/conectores?${params.toString()}`;
}

/** Registro do retorno OAuth (logs/oauth.log): só conector e status, nunca a conta. */
function registrar(evento: string, rota: string | null): void {
  try {
    const p = rota ? new URLSearchParams(rota.split("?")[1] ?? "") : null;
    const detalhe = p ? `conector=${p.get("conector")} status=${p.get("status")}` : "link inválido";
    appendFileSync(arquivoLog("oauth.log"), `${new Date().toISOString()} ${evento} ${detalhe}\n`);
  } catch {
    // log é opcional
  }
}

export function tratarDeepLink(link: string | null): void {
  if (!link) return;
  const rota = rotaDoDeepLink(link);
  focarJanelaPrincipal();
  const esperado = consumirRetornoEsperado();
  registrar(esperado ? "retorno" : "retorno-ignorado(sem-espera)", rota);
  if (!rota || !esperado) return;
  // Recarrega na página de Conectores: ela lê os parâmetros ao montar, mostra
  // o aviso e busca o estado novo dos conectores.
  abrirRota(rota);
}
