// Representação visual pequena de um agente mencionável (@).
//
// Agente do sistema → o ícone do catálogo (o mesmo do antigo squad) num tile
// primário. Agente personalizado → o avatar ilustrado que o usuário escolheu
// ou, sem ícone, `Avatar` com as iniciais do nome. Sem
// agente conhecido (ex.: personalizado já excluído), cai nas iniciais do nome
// gravado na mensagem.
import clsx from "clsx";

import { Avatar } from "@/components/ui";
import { navigationIcons } from "@/app/navigation/icons";
import { iconesAgentePorChave } from "./iconesAgente";

// ----------------------------------------------------------------------

const TAMANHO = {
  sm: { tile: "size-5 rounded-md", icone: "size-3.5", avatar: 5, texto: "text-[9px]" },
  md: { tile: "size-6 rounded-md", icone: "size-4", avatar: 6, texto: "text-[10px]" },
} as const;

export function AgenteAvatar({
  titulo,
  icone,
  tamanho = "sm",
  className,
}: {
  titulo: string;
  /**
   * Chave do ícone: de `navigationIcons` (agentes do sistema) ou do catálogo
   * `ICONES_AGENTE` ("agente:…", agentes personalizados).
   */
  icone?: string | null;
  tamanho?: keyof typeof TAMANHO;
  className?: string;
}) {
  const t = TAMANHO[tamanho];
  // Avatar ilustrado (agente personalizado): ocupa o círculo inteiro.
  const Ilustracao = icone ? iconesAgentePorChave[icone] : undefined;
  const Icone = icone ? navigationIcons[icone] : undefined;

  if (Ilustracao) {
    return (
      <Ilustracao
        className={clsx("shrink-0 rounded-full", t.tile, className)}
      />
    );
  }

  if (Icone) {
    return (
      <span
        aria-hidden
        className={clsx(
          "bg-primary-600/10 text-primary-600 dark:bg-primary-400/10 dark:text-primary-400 grid shrink-0 place-items-center",
          t.tile,
          className,
        )}
      >
        <Icone className={clsx(t.icone, "stroke-[1.5]")} />
      </span>
    );
  }

  return (
    <Avatar
      size={t.avatar}
      name={titulo || "?"}
      initialColor="auto"
      classNames={{
        root: clsx("shrink-0", className),
        display: clsx(t.texto, "font-semibold"),
      }}
    />
  );
}
