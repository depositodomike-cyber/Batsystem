import type { ColorType } from "@/constants/app";
import { nomeArea } from "@/app/data/areas";
import { nomeCargo } from "@/app/data/cargos";
import type { EstruturaRef, MembroStatus } from "@/services/api/membros";

// ----------------------------------------------------------------------
// Metadados de status de membro, compartilhados pela listagem, pelo drawer e
// pelo formulário — para os três nunca divergirem no rótulo ou na cor.
// ----------------------------------------------------------------------

export interface StatusMembroMeta {
  rotulo: string;
  /** Cor do <Badge> do Design System. */
  cor: ColorType;
  /** Frase curta usada no drawer, explicando o que o status significa. */
  descricao: string;
}

export const STATUS_MEMBRO: Record<MembroStatus, StatusMembroMeta> = {
  ativo: {
    rotulo: "Ativo",
    cor: "success",
    descricao: "Tem acesso normal à organização.",
  },
  convite_pendente: {
    rotulo: "Convite pendente",
    cor: "warning",
    descricao: "Foi adicionado, mas ainda não concluiu o acesso.",
  },
  inativo: {
    rotulo: "Inativo",
    cor: "neutral",
    descricao: "Não possui acesso ativo à organização.",
  },
};

/**
 * Rótulo da área de um membro (ou do gestor embutido nele).
 *
 * Precedência entidade → texto legado, e é isto que mantém a tela correta
 * durante a transição: quem já escolheu uma Área tem `areaRef`; quem foi
 * cadastrado antes de Áreas virarem entidades só tem o código antigo em
 * `area`, que `nomeArea()` traduz. Não houve backfill de propósito, então os
 * dois casos convivem por tempo indeterminado.
 *
 * Devolve string vazia quando não há nenhum dos dois — quem chama decide o
 * texto de ausência ("Sem área definida", um travessão, etc.).
 */
export function rotuloArea(membro: {
  areaRef: EstruturaRef | null;
  area: string | null;
}): string {
  return membro.areaRef?.nome ?? nomeArea(membro.area);
}

/** Rótulo do cargo, com a mesma precedência de `rotuloArea`. */
export function rotuloCargo(membro: {
  cargoRef: EstruturaRef | null;
  cargo: string | null;
}): string {
  return membro.cargoRef?.nome ?? nomeCargo(membro.cargo);
}

/**
 * Mensagem de erro vinda da API, com um fallback por chamador.
 *
 * O interceptor de `utils/axios.ts` rejeita com string ou `{ message }` (que
 * pode ser um array do ValidationPipe), nunca com um AxiosError — daí o
 * desempacotamento. Mesmo helper que `Conectores.tsx` usa.
 */
export function mensagemErroMembro(err: unknown, fallback: string): string {
  if (typeof err === "string") return err;
  if (err && typeof err === "object" && "message" in err) {
    const m = (err as { message: unknown }).message;
    if (Array.isArray(m) && typeof m[0] === "string") return m[0];
    if (typeof m === "string") return m;
  }
  return fallback;
}
