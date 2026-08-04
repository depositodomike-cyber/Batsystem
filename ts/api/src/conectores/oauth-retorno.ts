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
