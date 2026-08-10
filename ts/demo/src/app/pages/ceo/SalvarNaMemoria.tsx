// Import Dependencies
import { useState } from "react";
import { toast } from "sonner";
import { Menu, MenuButton, MenuItem, MenuItems, Transition } from "@headlessui/react";
import {
  CheckCircleIcon,
  CheckIcon,
  ChevronDownIcon,
  FolderPlusIcon,
} from "@heroicons/react/24/outline";
import clsx from "clsx";

// Local Imports
import { Button, Spinner } from "@/components/ui";
import {
  escreverNotaMemoria,
  garantirNotasDePessoas,
  memoriaVaultSupported,
  type AnexoMemoria,
} from "@/utils/memoriaVault";
import { syncVaultBatch } from "@/services/api/vault";
import { PASTA_MEMORIA } from "./memoria-pastas";
import { usePastasMemoria } from "./usePastasMemoria";

// ----------------------------------------------------------------------
// Botão "Salvar na memória" — o mesmo da Upload Transcrição, reaproveitado por
// todas as ações do IA Studio. Grava o conteúdo gerado como .md na Pasta da
// Memória, dentro da subpasta da ação ("Artigos", "Imagens"…), criando-a se
// ainda não existir. Some quando o navegador não suporta a File System Access
// API (mesma regra do modal de transcrição).
//
// O botão é dividido: o clique principal grava na pasta da ação e a seta abre a
// lista de temas — que, como em toda opção de gravar no Repositório, são as PASTAS
// DISPONÍVEIS NA MEMÓRIA (ver usePastasMemoria).
// ----------------------------------------------------------------------

interface Props {
  /** Subpasta do Repositório sugerida — use PASTA_MEMORIA (memoria-pastas.ts). */
  pasta: string;
  titulo: string;
  tags?: string[];
  /** Conteúdo pronto em Markdown. Ignorado quando `preparar` é passado. */
  conteudo?: string;
  /**
   * Monta o conteúdo na hora do clique — para ações cujo resultado precisa ser
   * construído (HTML do carrossel) ou baixado (imagem, MP4) antes de gravar.
   */
  preparar?: () => Promise<{ conteudo: string; anexos?: AnexoMemoria[] }>;
  /**
   * Assinatura do resultado, para ações em que o conteúdo não chega por prop
   * (`preparar`): quando muda, o botão volta a "Salvar na memória".
   */
  versao?: string | number;
  /**
   * Pessoas citadas (ex.: participantes de uma ata). Ao salvar, cria uma nota
   * .md na pasta "Pessoas" para cada uma que ainda não tem nota — assim os
   * [[wikilinks]] da ata conectam a um nó real no grafo, sem nós soltos.
   */
  pessoas?: string[];
  disabled?: boolean;
  className?: string;
}

export function SalvarNaMemoriaButton({
  pasta,
  titulo,
  tags,
  conteudo,
  preparar,
  versao,
  pessoas,
  disabled,
  className,
}: Props) {
  const [gravando, setGravando] = useState(false);
  const [salvoEm, setSalvoEm] = useState<string | null>(null);
  const { temas } = usePastasMemoria();

  // A pasta da ação sempre entra na lista, mesmo antes de existir no vault:
  // ela é criada na primeira gravação (escreverNotaMemoria usa `create: true`).
  const destinos = temas.some((t) => t.id === pasta)
    ? temas.map((t) => t.id)
    : [pasta, ...temas.map((t) => t.id)];

  // Guardamos a assinatura do que foi gravado, não um booleano: conteúdo novo
  // (outra geração, refino, edição do título) volta a habilitar o botão em vez
  // de deixar o usuário preso no "Na memória" da versão anterior. A pasta entra
  // na assinatura para gravar o mesmo conteúdo em outro tema continuar valendo.
  const assinatura = (destino: string) =>
    `${destino}|${titulo}|${conteudo ?? ""}|${versao ?? ""}`;
  const salvo = salvoEm === assinatura(pasta);

  if (!memoriaVaultSupported()) return null;

  const salvar = async (destino: string) => {
    setGravando(true);
    try {
      const pronto = preparar ? await preparar() : { conteudo: conteudo ?? "" };
      const r = await escreverNotaMemoria({
        subpasta: destino,
        titulo: titulo.trim() || destino,
        conteudo: pronto.conteudo,
        anexos: pronto.anexos,
        tags,
      });
      if (r.ok) {
        setSalvoEm(assinatura(destino));
        toast("Salvo na pasta do Repositório", {
          description: `${r.pasta}/${r.arquivo} — recarregue o grafo para ver o nó.`,
        });
        // Cria as notas de pessoas citadas que ainda não existem, para que os
        // [[wikilinks]] da ata conectem a nós reais no grafo (pasta "Pessoas").
        if (pessoas?.length) void criarNotasDePessoas(pessoas);
      } else if (r.reason === "no-folder") {
        toast("Nenhuma pasta do Repositório definida", {
          description: "Defina a pasta em Repositório (ou Configurações) e tente de novo.",
        });
      } else if (r.reason === "denied") {
        toast("Permissão negada", { description: "É preciso autorizar a escrita na pasta." });
      } else if (r.reason === "unsupported") {
        toast("Gravação indisponível neste navegador", {
          description:
            "O Repositório está como cópia somente leitura. Ative o acesso a pastas (no Brave: brave://flags/#file-system-access-api) ou use o Chrome.",
        });
      } else {
        toast("Não foi possível gravar o arquivo", { description: "Tente novamente." });
      }
    } catch {
      toast("Não foi possível gravar o arquivo", { description: "Tente novamente." });
    } finally {
      setGravando(false);
    }
  };

  // Cria as notas .md das pessoas citadas que ainda não existem e as indexa na
  // IA. Silencioso quando não há nada a criar; avisa apenas quando cria algo (ou
  // quando a permissão de escrita falta). Roda em segundo plano após salvar.
  const criarNotasDePessoas = async (nomes: string[]) => {
    const r = await garantirNotasDePessoas(nomes, PASTA_MEMORIA.pessoas);
    if (!r.ok) {
      if (r.reason === "denied") {
        toast("Notas de pessoas não criadas", {
          description: "Autorize a escrita na pasta do Repositório para criá-las.",
        });
      }
      return;
    }
    if (!r.criadas.length) return;
    void syncVaultBatch(
      r.criadas.map((n) => ({ path: n.path, titulo: n.titulo, conteudo: n.texto })),
    ).catch(() => undefined);
    toast(
      r.criadas.length === 1
        ? "Nota de pessoa criada"
        : `${r.criadas.length} notas de pessoas criadas`,
      {
        description: `Em Pessoas: ${r.criadas.map((n) => n.titulo).join(", ")}. Recarregue o grafo.`,
      },
    );
  };

  const bloqueado = disabled || gravando;

  return (
    // `items-stretch` + altura automática na seta: o botão de seta acompanha a
    // altura do principal, inclusive quando quem chama passa `h-auto`.
    <div className={clsx("inline-flex items-stretch", className)}>
      <Button
        onClick={() => salvar(pasta)}
        disabled={bloqueado || salvo}
        color="primary"
        className={clsx("h-8 gap-1.5 rounded-r-none px-2.5 text-xs-plus", className)}
      >
        {gravando ? (
          <Spinner className="size-4" />
        ) : salvo ? (
          <CheckCircleIcon className="size-4" />
        ) : (
          <FolderPlusIcon className="size-4" />
        )}
        {salvo ? "Na memória" : "Salvar na memória"}
      </Button>

      <Menu as="div" className="relative">
        <MenuButton
          as={Button}
          disabled={bloqueado}
          color="primary"
          aria-label="Escolher o tema (pasta do Repositório)"
          className="dark:border-l-primary-400/40 h-auto rounded-l-none border-l border-l-white/25 px-1.5"
        >
          <ChevronDownIcon className="size-4" />
        </MenuButton>
        <Transition
          as={MenuItems}
          anchor={{ to: "bottom end", gap: 4 }}
          enter="transition ease-out duration-100"
          enterFrom="opacity-0 translate-y-1"
          enterTo="opacity-100 translate-y-0"
          leave="transition ease-in duration-75"
          leaveFrom="opacity-100 translate-y-0"
          leaveTo="opacity-0 translate-y-1"
          className="dark:bg-dark-750 dark:border-dark-500 z-100 max-h-80 w-60 overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg shadow-gray-200/60 outline-hidden dark:shadow-none"
        >
          <p className="dark:text-dark-300 px-3.5 py-1.5 text-[11px] font-medium tracking-wide text-gray-400 uppercase">
            Pastas do Repositório
          </p>
          {destinos.map((destino) => (
            <MenuItem key={destino}>
              {({ focus }) => (
                <button
                  type="button"
                  onClick={() => salvar(destino)}
                  className={clsx(
                    "flex w-full items-center gap-2 px-3.5 py-2 text-left text-sm transition-colors",
                    focus
                      ? "dark:bg-dark-600 dark:text-dark-100 bg-gray-100 text-gray-800"
                      : "dark:text-dark-200 text-gray-600",
                  )}
                >
                  <CheckIcon
                    className={clsx(
                      "size-4 shrink-0",
                      destino === pasta ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span className="truncate">{destino}</span>
                </button>
              )}
            </MenuItem>
          ))}
        </Transition>
      </Menu>
    </div>
  );
}
