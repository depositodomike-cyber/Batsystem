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
