// Import Dependencies
import { ListBulletIcon, ShareIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";

// ----------------------------------------------------------------------
// Alternador entre as duas visualizações da hierarquia.
//
// Controle segmentado, no mesmo formato do "Editar / Ler" do modal de nota:
// trilha cinza com o item ativo em relevo. A escolha é lembrada no
// localStorage, como o seletor do Repositório já faz — trocar de aba e voltar
// não deve devolver o usuário para a visão que ele não escolheu.
// ----------------------------------------------------------------------

export type HierarquiaView = "organograma" | "arvore";

const CHAVE = "ceo-os:hierarquia-view";

/** Organograma é o padrão: é a leitura mais completa da estrutura. */
export function lerHierarquiaView(): HierarquiaView {
  try {
    return localStorage.getItem(CHAVE) === "arvore" ? "arvore" : "organograma";
  } catch {
    // Navegação privada pode barrar o acesso — cair no padrão basta.
    return "organograma";
  }
}

export function salvarHierarquiaView(view: HierarquiaView): void {
  try {
    localStorage.setItem(CHAVE, view);
  } catch {
    /* sem persistência; a escolha ainda vale nesta sessão */
  }
}

const OPCOES = [
  { id: "organograma", rotulo: "Organograma", Icon: ShareIcon },
  { id: "arvore", rotulo: "Árvore", Icon: ListBulletIcon },
] as const;

export function HierarquiaViewSelect({
  value,
  onChange,
}: {
  value: HierarquiaView;
  onChange: (view: HierarquiaView) => void;
}) {
  return (
    <div className="dark:bg-dark-800 flex w-fit shrink-0 gap-1 rounded-lg bg-gray-100 p-1">
      {OPCOES.map(({ id, rotulo, Icon }) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          aria-pressed={value === id}
          className={clsx(
            "text-xs-plus flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium transition-colors",
            value === id
              ? "dark:bg-dark-600 dark:text-dark-50 bg-white text-gray-800 shadow-sm"
              : "dark:text-dark-300 text-gray-500",
          )}
        >
          <Icon className="size-4" />
          {rotulo}
        </button>
      ))}
    </div>
  );
}
