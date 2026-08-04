import axios from "@/utils/axios";

import type { EmailItem } from "@/app/data/emails";

// Caixa de entrada real dos conectores de e-mail (ts/api, EmailApiService).
// O backend já normaliza Gmail e Outlook para o mesmo formato — daqui para
// cima a página não sabe de qual provedor veio a mensagem.

export interface CaixaDeEntrada {
  /** Conta autorizada (ex.: voce@empresa.com), quando o provedor devolve. */
  conta: string | null;
  emails: EmailItem[];
}

/** Últimos e-mails da caixa de entrada do provedor conectado. */
export async function fetchCaixaDeEntradaApi(
  provedor: string,
  limite = 25,
): Promise<CaixaDeEntrada> {
  const { data } = await axios.get<CaixaDeEntrada>(
    `/conectores/email/${encodeURIComponent(provedor)}/mensagens`,
    { params: { limite } },
  );
  return { conta: data.conta ?? null, emails: data.emails ?? [] };
}
