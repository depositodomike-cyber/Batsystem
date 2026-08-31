// ----------------------------------------------------------------------
// Credenciais por conector — espelho backend da fonte do front:
//   ts/demo/src/app/data/conector-credenciais.ts
//
// Aqui ficam APENAS metadados: quais ids de campo existem e quais são
// obrigatórios. Nenhum valor. Serve para validar o que entra em
// `PUT /conectores/:id/credenciais` — um campo fora desta lista é 400, na
// mesma linha do `forbidNonWhitelisted` do ValidationPipe global.
//
// Ao mexer nos campos de um conector, atualize os DOIS arquivos.
// ----------------------------------------------------------------------

export interface CampoCredencialSpec {
  id: string;
  obrigatorio: boolean;
}

/**
 * Campos aceitos por conector, na ordem em que o front os exibe.
 *
 * Os nomes seguem o vocabulário de cada provedor (Client ID/Secret no OAuth do
 * Google, Tenant/Client no Entra ID, Phone Number ID e WABA na Cloud API da
 * Meta), para o valor colado do painel do provedor ir no campo certo.
 */
export const CREDENCIAIS_POR_CONECTOR: Record<string, CampoCredencialSpec[]> = {
  'google-drive': [
    { id: 'clientId', obrigatorio: true },
    { id: 'clientSecret', obrigatorio: true },
    { id: 'pastaRaizId', obrigatorio: false },
  ],
  teams: [
    { id: 'tenantId', obrigatorio: true },
    { id: 'clientId', obrigatorio: true },
    { id: 'clientSecret', obrigatorio: true },
  ],
  onedrive: [
    { id: 'tenantId', obrigatorio: true },
    { id: 'clientId', obrigatorio: true },
    { id: 'clientSecret', obrigatorio: true },
    { id: 'driveId', obrigatorio: false },
  ],
  whatsapp: [
    { id: 'phoneNumberId', obrigatorio: true },
    { id: 'wabaId', obrigatorio: true },
    { id: 'accessToken', obrigatorio: true },
    { id: 'webhookVerifyToken', obrigatorio: false },
  ],
  youtube: [
    { id: 'clientId', obrigatorio: true },
    { id: 'clientSecret', obrigatorio: true },
    { id: 'apiKey', obrigatorio: false },
    { id: 'channelId', obrigatorio: false },
  ],
  zapier: [
    { id: 'webhookUrl', obrigatorio: true },
    { id: 'apiKey', obrigatorio: false },
  ],
};

/** True quando o conector se conecta por formulário de credenciais. */
export function exigeCredenciais(connectorId: string): boolean {
  return connectorId in CREDENCIAIS_POR_CONECTOR;
}

/** Spec dos campos do conector (vazio quando ele não usa credenciais). */
export function camposDoConector(connectorId: string): CampoCredencialSpec[] {
  return CREDENCIAIS_POR_CONECTOR[connectorId] ?? [];
}
