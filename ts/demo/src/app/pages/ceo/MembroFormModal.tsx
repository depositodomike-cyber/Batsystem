// Import Dependencies
import { useMemo, useState } from "react";
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  Transition,
  TransitionChild,
} from "@headlessui/react";

// Local Imports
import { Button } from "@/components/ui";
import type { EstruturaItem } from "@/services/api/estrutura";
import {
  atualizarMembroApi,
  criarMembroApi,
  type Membro,
  type MembroStatus,
} from "@/services/api/membros";
import {
  mensagemErroMembro,
  rotuloArea,
  rotuloCargo,
  STATUS_MEMBRO,
} from "./membros-status";
import { gestoresElegiveis } from "./hierarquia-membros";
import type { Role } from "@/services/api/roles";

// ----------------------------------------------------------------------
// Telas 02 (adicionar) e edição de membro. Um só componente: `membro` nulo é
// criação, preenchido é edição.
//
// Quem chama deve usar `key={membro?.id ?? "novo"}` para o modal remontar
// limpo a cada abertura — mesma técnica do CredenciaisModal em Conectores.tsx,
// que dispensa um efeito de reset.
// ----------------------------------------------------------------------

function emailValido(valor: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor);
}

/**
 * Opções de um seletor de Área ou Cargo: as ATIVAS mais a associação atual do
 * membro, ainda que ela tenha sido desativada depois.
 *
 * Incluir a atual não é detalhe cosmético. O formulário envia todos os campos
 * a cada save; se a área desativada de alguém não estivesse na lista, o
 * `<select>` cairia em "" e o próximo save de QUALQUER campo apagaria a área
 * dessa pessoa — e o backend não recusaria, porque limpar é legal.
 */
function opcoesEstrutura(
  itens: EstruturaItem[],
  atualId: string | null,
): EstruturaItem[] {
  const ativos = itens.filter((i) => i.status === "ativo");
  const atual = atualId ? itens.find((i) => i.id === atualId) : undefined;
  if (atual && atual.status !== "ativo") return [...ativos, atual];
  return ativos;
}

export function MembroFormModal({
  open,
  membro,
  membros,
  roles,
  areas,
  cargos,
  liderados,
  onClose,
  onSalvo,
}: {
  open: boolean;
  /** Nulo = criar. Preenchido = editar. */
  membro: Membro | null;
  /** Lista completa da organização, para montar o seletor de Gestor direto. */
  membros: Membro[];
  /** Roles da organização, para o seletor da seção Acesso. */
  roles: Role[];
  /** Áreas e cargos cadastrados, para os seletores de estrutura. */
  areas: EstruturaItem[];
  cargos: EstruturaItem[];
  /**
   * Quantos membros respondem a este. Desativar quem lidera alguém exige
   * escolher uma nova liderança, o que acontece no modal de realocação — então
   * aqui a opção Inativo aparece indisponível em vez de falhar no save.
   */
  liderados: number;
  onClose: () => void;
  onSalvo: (membro: Membro, criado: boolean) => void;
}) {
  const editando = membro != null;

  const [nome, setNome] = useState(membro?.nome ?? "");
  const [email, setEmail] = useState(membro?.email ?? "");
  const [areaId, setAreaId] = useState(membro?.areaId ?? "");
  const [cargoId, setCargoId] = useState(membro?.cargoId ?? "");
  const [gestorId, setGestorId] = useState(membro?.gestorId ?? "");
  const [roleIds, setRoleIds] = useState<string[]>(membro?.roleIds ?? []);
  // Segundo seletor visível mas ainda vazio, enquanto o operador escolhe. Sem
  // ele, "+ Adicionar role" não teria onde renderizar a escolha.
  const [slotExtra, setSlotExtra] = useState(false);
  // Membro novo nasce como convite pendente; o campo só é editável na edição.
  const [status, setStatus] = useState<MembroStatus>(
    membro?.status ?? "convite_pendente",
  );

  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  /**
   * Opções de um dos seletores de role.
   *
   * Duas regras, as duas obrigatórias:
   *
   * 1. A role Owner é exclusiva do responsável pela conta: a API recusa
   *    atribuí-la a qualquer outro membro, então não faz sentido oferecê-la. A
   *    exceção é quem JÁ a tem — sem isso o próprio Owner abriria o formulário
   *    com o seletor em branco e salvaria removendo a própria role.
   * 2. A mesma role não pode estar nos dois seletores. Sem isto o save "daria
   *    certo": o backend deduplica e gravaria uma role só, enquanto a tela
   *    mostrava duas.
   *
   * Uma role já atribuída continua listada mesmo se saísse do catálogo — mesma
   * armadilha de `opcoesEstrutura`, já que o formulário manda todos os campos
   * em todo save.
   */
  const opcoesDoSlot = (indice: number) =>
    roles.filter(
      (r) =>
        (r.codigo !== "owner" || (membro?.roleIds ?? []).includes(r.id)) &&
        !roleIds.some((id, i) => i !== indice && id === r.id),
    );

  /** Define a role de um slot; valor vazio remove o slot da lista. */
  const definirRole = (indice: number, valor: string) => {
    setRoleIds((atuais) => {
      const proximos = [...atuais];
      if (valor === "") proximos.splice(indice, 1);
      else proximos[indice] = valor;
      return proximos.filter(Boolean);
    });
    if (valor === "" && indice === 1) setSlotExtra(false);
  };

  // Um slot a mais só enquanto couber: com duas roles escolhidas, "+ Adicionar
  // role" desaparece.
  const slotsVisiveis = Math.min(
    2,
    Math.max(roleIds.length, slotExtra ? roleIds.length + 1 : 1),
  );

  // Regras 02 e 04 na própria origem do seletor: sem a própria pessoa e sem
  // ninguém que já responda a ela, direta ou indiretamente. O backend valida de
  // novo — isto é a camada de UI, não a de garantia.
  const candidatos = useMemo(
    () =>
      gestoresElegiveis(membros, membro?.id ?? null).sort((a, b) =>
        a.nome.localeCompare(b.nome, "pt-BR"),
      ),
    [membros, membro?.id],
  );

  const areasDisponiveis = useMemo(
    () => opcoesEstrutura(areas, membro?.areaId ?? null),
    [areas, membro?.areaId],
  );
  const cargosDisponiveis = useMemo(
    () => opcoesEstrutura(cargos, membro?.cargoId ?? null),
    [cargos, membro?.cargoId],
  );

  // Desativar quem lidera alguém exige escolher a nova liderança da equipe, o
  // que só existe no modal de realocação. Aqui a opção fica indisponível para o
  // operador não descobrir isso num 409 depois de preencher o formulário.
  const desativacaoExigeRealocacao =
    editando && liderados > 0 && membro.status !== "inativo";

  // O e-mail de quem já tem conta é a chave de login: o backend recusa a troca,
  // então o campo aparece travado em vez de deixar o usuário tentar e errar.
  const emailTravado = membro?.temConta === true;

  const salvar = async () => {
    setErro(null);

    if (nome.trim() === "") {
      setErro("Informe o nome do membro.");
      return;
    }
    if (email.trim() === "") {
      setErro("Informe o e-mail do membro.");
      return;
    }
    if (!emailValido(email.trim())) {
      setErro("E-mail inválido.");
      return;
    }

    setSalvando(true);
    try {
      if (editando) {
        const atualizado = await atualizarMembroApi(membro.id, {
          nome: nome.trim(),
          ...(emailTravado ? {} : { email: email.trim().toLowerCase() }),
          areaId,
          cargoId,
          gestorId,
          roleIds,
          status,
        });
        onSalvo(atualizado, false);
      } else {
        const criado = await criarMembroApi({
          nome: nome.trim(),
          email: email.trim().toLowerCase(),
          areaId,
          cargoId,
          gestorId,
          roleIds,
        });
        onSalvo(criado, true);
      }
    } catch (err) {
      setErro(
        mensagemErroMembro(err, "Não foi possível salvar. Tente novamente."),
      );
    } finally {
      setSalvando(false);
    }
  };

  return (
    // `as={Dialog}` (e não Transition > Dialog aninhados) é a mesma forma do
    // ConfirmModal compartilhado. Ela importa: com o Dialog montando num
    // elemento próprio no mesmo tick, o clique que fecha o menu de ações da
    // linha chegava ao detector de clique-fora e fechava o modal na hora.
    <Transition
      appear
      show={open}
      as={Dialog}
      className="fixed inset-0 z-100 flex flex-col items-center justify-center overflow-hidden px-4 py-6 sm:px-5"
      onClose={() => {
        if (!salvando) onClose();
      }}
    >
      <TransitionChild
        as="div"
        enter="ease-out duration-300"
        enterFrom="opacity-0"
        enterTo="opacity-100"
        leave="ease-in duration-200"
        leaveFrom="opacity-100"
        leaveTo="opacity-0"
        className="absolute inset-0 bg-gray-900/50 transition-opacity dark:bg-black/40"
      />

      <TransitionChild
        as={DialogPanel}
        enter="ease-out duration-300"
        enterFrom="opacity-0"
        enterTo="opacity-100"
        leave="ease-in duration-200"
        leaveFrom="opacity-100"
        leaveTo="opacity-0"
        className="scrollbar-sm dark:bg-dark-700 relative w-full max-w-md overflow-y-auto rounded-lg bg-white px-5 py-6"
      >
        <DialogTitle className="dark:text-dark-100 text-base font-semibold text-gray-800">
          {editando ? "Editar membro" : "Adicionar membro"}
        </DialogTitle>
        <p className="dark:text-dark-300 mt-1 text-sm text-gray-500">
          {editando
            ? "Atualize os dados da pessoa e a sua posição na organização."
            : "O membro entra como convite pendente e passa a Ativo quando concluir o acesso."}
        </p>

        <div className="mt-4 space-y-3">
          <label className="block text-sm">
            <span className="dark:text-dark-200 mb-1 block font-medium text-gray-600">
              Nome
            </span>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Nome completo"
              maxLength={160}
              autoComplete="off"
              className="form-input dark:border-dark-450 dark:bg-dark-700 dark:text-dark-100 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="block text-sm">
            <span className="dark:text-dark-200 mb-1 block font-medium text-gray-600">
              E-mail
            </span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="pessoa@empresa.com.br"
              maxLength={200}
              autoComplete="off"
              disabled={emailTravado}
              className="form-input dark:border-dark-450 dark:bg-dark-700 dark:text-dark-100 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
            />
            {emailTravado && (
              <span className="dark:text-dark-300 mt-1 block text-xs font-normal text-gray-400">
                Quem já tem conta altera o e-mail no próprio perfil.
              </span>
            )}
          </label>

          <label className="block text-sm">
            <span className="dark:text-dark-200 mb-1 block font-medium text-gray-600">
              Área
              <span className="ml-1 font-normal text-gray-400">(opcional)</span>
            </span>
            <select
              value={areaId}
              onChange={(e) => setAreaId(e.target.value)}
              className="form-select dark:border-dark-450 dark:bg-dark-700 dark:text-dark-100 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
            >
              <option value="">Sem área definida</option>
              {areasDisponiveis.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nome}
                  {a.status === "inativo" ? " · inativa" : ""}
                </option>
              ))}
            </select>
            {areas.length === 0 && (
              <span className="dark:text-dark-300 mt-1 block text-xs font-normal text-gray-400">
                Nenhuma área cadastrada ainda — crie em Estrutura › Áreas.
              </span>
            )}
          </label>

          <label className="block text-sm">
            <span className="dark:text-dark-200 mb-1 block font-medium text-gray-600">
              Cargo
              <span className="ml-1 font-normal text-gray-400">(opcional)</span>
            </span>
            <select
              value={cargoId}
              onChange={(e) => setCargoId(e.target.value)}
              className="form-select dark:border-dark-450 dark:bg-dark-700 dark:text-dark-100 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
            >
              <option value="">Sem cargo definido</option>
              {cargosDisponiveis.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                  {c.status === "inativo" ? " · inativo" : ""}
                </option>
              ))}
            </select>
            {cargos.length === 0 && (
              <span className="dark:text-dark-300 mt-1 block text-xs font-normal text-gray-400">
                Nenhum cargo cadastrado ainda — crie em Estrutura › Cargos.
              </span>
            )}
          </label>

          {/* Gestor direto — a relação que constrói a hierarquia. Fica ao lado
              de Área e Cargo porque as três respondem perguntas diferentes:
              onde a pessoa está, qual a posição dela, e a quem ela responde. */}
          <label className="block text-sm">
            <span className="dark:text-dark-200 mb-1 block font-medium text-gray-600">
              Gestor direto
              <span className="ml-1 font-normal text-gray-400">(opcional)</span>
            </span>
            <select
              value={gestorId}
              onChange={(e) => setGestorId(e.target.value)}
              className="form-select dark:border-dark-450 dark:bg-dark-700 dark:text-dark-100 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
            >
              <option value="">Nenhum — topo da estrutura</option>
              {candidatos.map((c) => (
                <option key={c.id} value={c.id}>
                  {[c.nome, rotuloCargo(c), rotuloArea(c)]
                    .filter(Boolean)
                    .join(" · ")}
                </option>
              ))}
            </select>
            <span className="dark:text-dark-300 mt-1 block text-xs font-normal text-gray-400">
              A quem esta pessoa responde. Quem já está na equipe dela não
              aparece na lista, para não criar um ciclo.
            </span>
          </label>

          {/* Acesso — separado da estrutura organizacional de propósito: área,
              cargo e gestor dizem onde a pessoa está e a quem responde; a role
              diz o que ela pode fazer. Nenhum dos três sugere a role. */}
          <div className="dark:bg-dark-500 mt-1 h-px bg-gray-200" />
          <p className="dark:text-dark-200 text-xs font-semibold tracking-wider text-gray-500 uppercase">
            Acesso
          </p>

          {/* Até duas roles, reveladas por etapa: o segundo seletor só existe
              quando alguém pede, para o formulário não carregar um campo vazio
              no caso comum de uma role só. */}
          <div className="block text-sm">
            <span className="dark:text-dark-200 mb-1 block font-medium text-gray-600">
              Roles
              <span className="ml-1 font-normal text-gray-400">(opcional)</span>
            </span>
            <div className="space-y-2">
              {Array.from({ length: slotsVisiveis }, (_, i) => (
                <div key={i} className="flex items-center gap-2">
                  <select
                    value={roleIds[i] ?? ""}
                    onChange={(e) => definirRole(i, e.target.value)}
                    aria-label={i === 0 ? "Role" : "Role adicional"}
                    className="form-select dark:border-dark-450 dark:bg-dark-700 dark:text-dark-100 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                  >
                    <option value="">
                      {i === 0 ? "Nenhuma role" : "Selecionar role"}
                    </option>
                    {opcoesDoSlot(i).map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.nome}
                        {r.tipo === "sistema" ? " · sistema" : ""}
                      </option>
                    ))}
                  </select>
                  {i === 1 && (
                    <button
                      type="button"
                      onClick={() => definirRole(1, "")}
                      className="dark:text-dark-300 dark:hover:text-dark-100 shrink-0 text-xs text-gray-500 hover:text-gray-700"
                    >
                      Remover
                    </button>
                  )}
                </div>
              ))}
            </div>
            {slotsVisiveis < 2 && (
              <button
                type="button"
                onClick={() => setSlotExtra(true)}
                className="text-primary-600 dark:text-primary-400 text-xs-plus mt-2"
              >
                + Adicionar role
              </button>
            )}
            <span className="dark:text-dark-300 mt-1 block text-xs font-normal text-gray-400">
              Definem o que a pessoa pode fazer na plataforma. Com duas roles, o
              acesso é a soma das duas: se qualquer uma concede, ela pode. As
              permissões vêm das roles — não há permissão individual por membro.
            </span>
          </div>

          <label className="block text-sm">
            <span className="dark:text-dark-200 mb-1 block font-medium text-gray-600">
              Status
            </span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as MembroStatus)}
              disabled={!editando}
              className="form-select dark:border-dark-450 dark:bg-dark-700 dark:text-dark-100 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
            >
              {(["ativo", "convite_pendente", "inativo"] as MembroStatus[]).map(
                (s) => (
                  <option
                    key={s}
                    value={s}
                    // Duas opções ficam indisponíveis em vez de falharem no
                    // save: quem já tem conta não volta para convite pendente,
                    // e quem lidera alguém só é desativado pelo fluxo que pede
                    // a nova liderança da equipe.
                    disabled={
                      (s === "convite_pendente" && emailTravado) ||
                      (s === "inativo" && desativacaoExigeRealocacao)
                    }
                  >
                    {STATUS_MEMBRO[s].rotulo}
                  </option>
                ),
              )}
            </select>
            {!editando ? (
              <span className="dark:text-dark-300 mt-1 block text-xs font-normal text-gray-400">
                Todo membro novo entra como convite pendente.
              </span>
            ) : (
              desativacaoExigeRealocacao && (
                <span className="dark:text-dark-300 mt-1 block text-xs font-normal text-gray-400">
                  {liderados}{" "}
                  {liderados === 1
                    ? "membro responde"
                    : "membros respondem"}{" "}
                  a esta pessoa. Use "Desativar membro" no menu da lista para
                  escolher quem assume a equipe.
                </span>
              )
            )}
          </label>
        </div>

        {erro && <p className="text-error mt-3 text-sm">{erro}</p>}

        <div className="mt-5 flex items-center justify-end gap-2">
          <Button variant="outlined" onClick={onClose} disabled={salvando}>
            Cancelar
          </Button>
          <Button color="primary" onClick={salvar} disabled={salvando}>
            {salvando ? "Salvando…" : editando ? "Salvar" : "Adicionar"}
          </Button>
        </div>
      </TransitionChild>
    </Transition>
  );
}
