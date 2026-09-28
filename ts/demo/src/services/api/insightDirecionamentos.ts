import axios from "@/utils/axios";
import type {
  DirecionamentoInput,
  InsightDirecionamento,
} from "@/app/data/insights";

// "Direcionador de insights" — chama o backend ts/api
// (/ai/insights/direcionamentos). Ler é livre; escrever exige a permissão
// `insights.gerenciar_direcionadores`, e a área escolhida é validada no
// servidor (quem não administra a conta só usa a própria área).

/** O que o usuário atual pode escolher em "Onde observar?". */
export interface OpcoesFoco {
  podeTodaOrganizacao: boolean;
  areas: { id: string; nome: string }[];
}

export async function listarDirecionamentosApi(): Promise<
  InsightDirecionamento[]
> {
  const { data } = await axios.get<{
    direcionamentos: InsightDirecionamento[];
  }>("/ai/insights/direcionamentos");
  return data.direcionamentos;
}

export async function opcoesFocoApi(): Promise<OpcoesFoco> {
  const { data } = await axios.get<OpcoesFoco>(
    "/ai/insights/direcionamentos/opcoes-foco",
  );
  return data;
}

export async function criarDirecionamentoApi(
  input: DirecionamentoInput,
): Promise<InsightDirecionamento> {
  const { data } = await axios.post<InsightDirecionamento>(
    "/ai/insights/direcionamentos",
    input,
  );
  return data;
}

/** Edição parcial — inclui ativar/desativar (`{ ativo }`). */
export async function atualizarDirecionamentoApi(
  id: string,
  input: Partial<DirecionamentoInput> & { ativo?: boolean },
): Promise<InsightDirecionamento> {
  const { data } = await axios.patch<InsightDirecionamento>(
    `/ai/insights/direcionamentos/${encodeURIComponent(id)}`,
    input,
  );
  return data;
}

export async function excluirDirecionamentoApi(id: string): Promise<void> {
  await axios.delete(`/ai/insights/direcionamentos/${encodeURIComponent(id)}`);
}

/** Mensagem legível de um erro da API (o interceptor rejeita com o corpo). */
export function mensagemDeErroApi(e: unknown, padrao: string): string {
  if (e && typeof e === "object" && "message" in e) {
    const msg = (e as { message?: unknown }).message;
    if (typeof msg === "string" && msg) return msg;
    if (Array.isArray(msg) && typeof msg[0] === "string") return msg[0];
  }
  return padrao;
}
