// Import Dependencies
import { useMemo, useState } from "react";
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  Transition,
  TransitionChild,
} from "@headlessui/react";
import { XMarkIcon } from "@heroicons/react/24/outline";

// Local Imports
import { Button } from "@/components/ui";
import type { EstruturaItem } from "@/services/api/estrutura";
import {
  atualizarMembroApi,
  criarMembroApi,
  type Membro,
  type MembroStatus,
  type MembroTipo,
} from "@/services/api/membros";
import {
  mensagemErroMembro,
  rotuloArea,
  rotuloCargo,
  STATUS_MEMBRO,
  TIPO_MEMBRO,
} from "./membros-status";
import { gestoresElegiveis } from "./hierarquia-membros";
import { MAX_GESTORES_INDIRETOS } from "./membros-indiretos";
import { RotuloCampo } from "./RotuloCampo";
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
  const [tipo, setTipo] = useState<MembroTipo>(membro?.tipo ?? "membro");
  const ehConvidado = tipo === "convidado";
  const [gestorId, setGestorId] = useState(membro?.gestorId ?? "");
  const [gestorIndiretoIds, setGestorIndiretoIds] = useState<string[]>(
    membro?.gestorIndiretoIds ?? [],
  );
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
        // `editavel` é o predicado único de "role que uma pessoa pode
        // receber": ele exclui Owner e Convidado de uma vez. O escape hatch é
        // só para a Owner — sem ele o proprietário abriria o formulário com o
        // seletor em branco e salvaria removendo a própria role. A Convidado
        // não precisa dele: o bloco de roles nem é renderizado para convidado.
        (r.editavel ||
          (r.proprietaria && (membro?.roleIds ?? []).includes(r.id))) &&
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
      gestoresElegiveis(membros, membro?.id ?? null)
        // Convidado não é gestor de ninguém. O filtro fica em cada call site,
        // e NÃO dentro de `gestoresElegiveis`: aquela função é compartilhada
        // com a realocação mas não com o seletor de indiretos, então uma regra
        // escondida lá seria invisível justamente onde também precisa valer.
        // É como o arquivo já trata a regra de Owner, em `opcoesDoSlot`.
        .filter((m) => m.tipo !== "convidado")
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    [membros, membro?.id],
  );

  /**
   * Candidatos a gestor INDIRETO — e a diferença em relação a `candidatos`
   * acima é a regra, não um detalhe.
   *
   * NÃO usa `gestoresElegiveis`: aquela função exclui os descendentes, que é
   * prevenção de ciclo do gestor DIRETO. Relação indireta não forma a árvore,
   * então ciclo não é problema dela — e alguém da equipe de uma pessoa pode
   * perfeitamente ser gestor indireto dela (um especialista sênior que
   * acompanha o próprio gerente num tema, por exemplo). Filtrar aqui recusaria
   * um caso legítimo, e o backend aceita.
   *
   * Fora ficam só três: o próprio membro, o gestor direto — porque a relação
   * direta é a de maior relevância e não se repete como indireta — e quem já
   * está escolhido. O gestor direto sai da lista assim que é escolhido no
   * campo acima, sem precisar salvar.
   *
   * Sem filtro de Área (gestor indireto de outra área é válido) e sem filtro
   * de status, exatamente como o gestor direto: quem está inativo continua
   * podendo ter a relação, e a tela sinaliza em vez de desfazer.
   */
  const candidatosIndiretos = useMemo(
    () =>
      membros
        .filter(
          (m) =>
            m.id !== membro?.id &&
            m.id !== gestorId &&
            m.tipo !== "convidado" &&
            !gestorIndiretoIds.includes(m.id),
        )
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    [membros, membro?.id, gestorId, gestorIndiretoIds],
  );

  /**
   * Os escolhidos, na mesma ordem alfabética em que o backend devolve — assim
   * a lista não se reordena ao salvar.
   *
   * Resolvido contra `membros` e não contra `membro.gestoresIndiretos`:
   * quem acaba de ser adicionado ainda não está na resposta salva. Um id que
   * não resolve é descartado em vez de virar um chip vazio.
   */
  const indiretosEscolhidos = useMemo(
    () =>
      gestorIndiretoIds
        .map((id) => membros.find((m) => m.id === id))
        .filter((m): m is Membro => m != null)
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    [gestorIndiretoIds, membros],
  );

  /**
   * Troca o gestor direto e, no mesmo gesto, solta o vínculo indireto que
   * acabou de virar redundante.
   *
   * Sem isto, promover a gestor direto quem já era indireto deixaria a mesma
   * pessoa nas duas relações na tela: ela sumiria das opções (o filtro de
   * `candidatosIndiretos`) mas o chip continuaria lá. O save funcionaria — o
   * backend subtrai o repetido quando o gestor direto muda — e o chip
   * desapareceria sozinho depois, que é exatamente a aparência de um bug.
   *
   * Remover aqui, e não filtrar na exibição: filtrar faria o chip RESSURGIR se
   * a pessoa voltasse o gestor direto para outro alguém, porque o id nunca
   * teria saído do estado. A relação indireta é desfeita de propósito, não
   * escondida.
   */
  const definirGestorDireto = (novoId: string) => {
    setGestorId(novoId);
    if (novoId) {
      setGestorIndiretoIds((atuais) => atuais.filter((id) => id !== novoId));
    }
  };

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

  /**
   * O payload, montado a partir do TIPO — e não por spread do estado.
   *
   * Uma função só para os dois call sites (criar e editar). Sem ela seriam
   * quatro combinações escritas à mão, e o próximo campo que alguém
   * acrescentasse entraria no spread e vazaria em silêncio para o convidado.
   *
   * Os campos escondidos continuam no estado de propósito: se o operador
   * escolhe Convidado por engano e volta atrás na mesma abertura do modal, a
   * área e o gestor que ele já tinha escolhido continuam lá. O que não pode
   * atravessar é o VALOR — daí a montagem explícita.
   *
   * String vazia, e não omissão: num PATCH, omitir significa "não mexe", e o
   * convidado continuaria com `gestorId` no banco, aparecendo como gestor de
   * outra pessoa. "String vazia limpa a relação" é a convenção que o serviço
   * já documenta.
   *
   * E NUNCA `roleIds` com a role Convidado: ela é consequência do tipo e quem
   * atribui é o backend. Mandá-la daqui criaria duas fontes de verdade.
   */
  const dadosDoFormulario = () => {
    const comum = { nome: nome.trim(), tipo };
    if (ehConvidado) {
      return {
        ...comum,
        areaId: "",
        cargoId: "",
        gestorId: "",
        gestorIndiretoIds: [],
        roleIds: [],
      };
    }
    return { ...comum, areaId, cargoId, gestorId, gestorIndiretoIds, roleIds };
  };

  const salvar = async () => {
    setErro(null);

    if (nome.trim() === "") {
      setErro("Informe o nome do colaborador.");
      return;
    }
    if (email.trim() === "") {
      setErro("Informe o e-mail do colaborador.");
      return;
    }
    if (!emailValido(email.trim())) {
      setErro("E-mail inválido.");
      return;
    }
    // Ao menos uma role, e só para membro comum: o convidado recebe a
    // Convidado do backend, e para ele `roleIds` sai vazio de propósito (ver
    // `dadosDoFormulario`).
    //
    // A API recusa igual — esta checagem existe para o operador descobrir
    // ANTES de enviar, no mesmo lugar em que ele escolheria. Sem ela o 409
    // voltaria depois de preencher tudo, sem apontar o campo.
    if (!ehConvidado && roleIds.length === 0) {
      setErro("Escolha ao menos uma role para o colaborador.");
      return;
    }

    setSalvando(true);
    try {
      if (editando) {
        const atualizado = await atualizarMembroApi(membro.id, {
          ...dadosDoFormulario(),
          ...(emailTravado ? {} : { email: email.trim().toLowerCase() }),
          status,
        });
        onSalvo(atualizado, false);
      } else {
        const criado = await criarMembroApi({
          ...dadosDoFormulario(),
          email: email.trim().toLowerCase(),
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
          {editando ? "Editar colaborador" : "Adicionar colaborador"}
        </DialogTitle>
        <p className="dark:text-dark-300 mt-1 text-sm text-gray-500">
          {editando
            ? "Atualize os dados da pessoa e a sua posição na organização."
            : "Adicione um colaborador à organização."}
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
            <RotuloCampo
              rotulo="E-mail"
              // Só quando o campo está travado: é aí que existe algo a
              // explicar. Ícone condicional é honesto — a ajuda aparece quando
              // há ajuda.
              ajuda={
                emailTravado
                  ? "Quem já tem conta altera o e-mail no próprio perfil."
                  : undefined
              }
            />
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
          </label>

          {/* Entre E-mail e Área de propósito: nome e e-mail são identidade e
              valem para os dois tipos, e daqui para baixo tudo depende desta
              escolha. Depois do Status, o operador preencheria área, cargo,
              gestores e roles para só então descobrir que nada se aplica — o
              mesmo mal que o campo Status combate ao desabilitar a opção em vez
              de deixar o save falhar. */}
          <label className="block text-sm">
            <RotuloCampo
              rotulo="Tipo da conta"
              ajuda={TIPO_MEMBRO[tipo].descricao}
            />
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value as MembroTipo)}
              // Só na criação. Depois disso, a única mudança de tipo que
              // existe é promover um convidado, e ela vive no menu da lista —
              // o formulário nunca abre outro modal; ele aponta o caminho.
              disabled={editando}
              className="form-select dark:border-dark-450 dark:bg-dark-700 dark:text-dark-100 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
            >
              <option value="membro">{TIPO_MEMBRO.membro.rotulo}</option>
              <option value="convidado">{TIPO_MEMBRO.convidado.rotulo}</option>
            </select>
            {/* A DESCRIÇÃO do tipo virou o ícone acima. Isto aqui não é
                descrição: é o que fazer com o campo desabilitado. Para o
                convidado é onde fazer a operação; para quem já é colaborador é
                o motivo de não haver operação nenhuma — o caminho de volta foi
                retirado da interface, e um select travado sem explicação é pior
                do que a explicação. */}
            {editando && (
              <span className="dark:text-dark-300 mt-1 block text-xs font-normal text-gray-400">
                {ehConvidado
                  ? 'Use "Converter em colaborador" no menu da lista.'
                  : "O tipo da conta não muda depois do cadastro."}
              </span>
            )}
          </label>

          {/* Daqui até o divisor "Acesso": só para membro da organização.
              Escondidos, e não desabilitados — cinco campos desabilitados
              mostrariam "Gestor direto: Amanda" um instante antes de o save
              apagar a Amanda, e um campo que exibe um valor que o próprio save
              vai destruir é pior do que um erro. Sem seção vazia porque não
              sobra seção. */}
          {!ehConvidado && (
            <>
              <label className="block text-sm">
                <span className="dark:text-dark-200 mb-1 block font-medium text-gray-600">
                  Área
                  <span className="ml-1 font-normal text-gray-400">
                    (opcional)
                  </span>
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
                  <span className="ml-1 font-normal text-gray-400">
                    (opcional)
                  </span>
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
                <RotuloCampo
                  rotulo="Gestor direto"
                  opcional
                  ajuda="A quem esta pessoa responde. Quem já está na equipe dela não aparece na lista, para não criar um ciclo."
                />
                <select
                  value={gestorId}
                  onChange={(e) => definirGestorDireto(e.target.value)}
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
              </label>

              {/* Gestores indiretos — a segunda relação de gestão, logo abaixo da
              primeira porque as duas respondem a mesma família de pergunta.
              Continua no bloco de ESTRUTURA: acompanhar alguém não é permissão.

              O `<select>` age como "adicionar" e volta ao placeholder a cada
              escolha; os escolhidos vivem nos chips abaixo. É o padrão nativo
              do resto deste formulário — um combobox aqui seria o único campo
              com outra mecânica de interação. */}
              <div className="block text-sm">
                <RotuloCampo
                  rotulo="Gestores indiretos"
                  opcional
                  ajuda="Outras lideranças que acompanham esta pessoa. Não mudam a posição dela na estrutura nem concedem acesso — quem define a posição é o gestor direto. Pode ser de outra área."
                />
                <select
                  // Sempre vazio: o valor escolhido vira chip e o campo volta a
                  // convidar. Sem isto o select exibiria a última escolha como se
                  // ela fosse "o" valor do campo, competindo com os chips.
                  value=""
                  aria-label="Adicionar gestor indireto"
                  disabled={
                    candidatosIndiretos.length === 0 ||
                    gestorIndiretoIds.length >= MAX_GESTORES_INDIRETOS
                  }
                  onChange={(e) => {
                    const id = e.target.value;
                    if (id) setGestorIndiretoIds((atuais) => [...atuais, id]);
                  }}
                  className="form-select dark:border-dark-450 dark:bg-dark-700 dark:text-dark-100 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm disabled:opacity-60"
                >
                  <option value="">
                    {gestorIndiretoIds.length >= MAX_GESTORES_INDIRETOS
                      ? `Limite de ${MAX_GESTORES_INDIRETOS} atingido`
                      : candidatosIndiretos.length === 0
                        ? "Ninguém mais disponível"
                        : "Adicionar gestor indireto…"}
                  </option>
                  {candidatosIndiretos.map((c) => (
                    <option key={c.id} value={c.id}>
                      {[c.nome, rotuloCargo(c), rotuloArea(c)]
                        .filter(Boolean)
                        .join(" · ")}
                    </option>
                  ))}
                </select>

                {indiretosEscolhidos.length > 0 && (
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {indiretosEscolhidos.map((g) => (
                      <li
                        key={g.id}
                        className="dark:border-dark-450 dark:bg-dark-600 dark:text-dark-100 text-xs-plus flex items-center gap-1 rounded-lg border border-gray-300 bg-gray-50 py-1 ps-2.5 pe-1 text-gray-700"
                      >
                        {g.nome}
                        {g.status === "inativo" && (
                          <span className="dark:text-dark-300 text-xs text-gray-400">
                            · inativo
                          </span>
                        )}
                        <button
                          type="button"
                          aria-label={`Remover ${g.nome} dos gestores indiretos`}
                          title="Remover"
                          onClick={() =>
                            setGestorIndiretoIds((atuais) =>
                              atuais.filter((id) => id !== g.id),
                            )
                          }
                          className="dark:text-dark-300 dark:hover:text-dark-50 dark:hover:bg-dark-500 grid size-5 place-items-center rounded text-gray-400 hover:bg-gray-200 hover:text-gray-700"
                        >
                          <XMarkIcon className="size-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}

          {/* Acesso — separado da estrutura organizacional de propósito: área,
              cargo e gestor dizem onde a pessoa está e a quem responde; a role
              diz o que ela pode fazer. Nenhum dos três sugere a role. */}
          <div className="dark:bg-dark-500 mt-1 h-px bg-gray-200" />
          <p className="dark:text-dark-200 text-xs font-semibold tracking-wider text-gray-500 uppercase">
            Acesso
          </p>

          {/* Convidado não escolhe role: ele recebe a Convidado, e só ela —
              as permissões de duas roles se SOMAM, então "Convidado + Admin"
              daria Admin e o conceito se dissolveria.

              Texto, e não um select desabilitado com uma opção: um select lê
              como escolha, e alguém tentaria mudá-lo. */}
          {ehConvidado ? (
            <div className="block text-sm">
              <RotuloCampo
                rotulo="Role"
                ajuda="Atribuída automaticamente e não editável. Dá acesso à IA e a nenhuma configuração da organização."
              />
              <p className="dark:border-dark-450 dark:bg-dark-700 dark:text-dark-100 rounded-lg border border-gray-300 px-3 py-2 text-sm">
                {TIPO_MEMBRO.convidado.rotulo}
                <span className="dark:text-dark-300 ml-1 text-xs text-gray-400">
                  · role de sistema
                </span>
              </p>
            </div>
          ) : (
            <>
              {/* Até duas roles, reveladas por etapa: o segundo seletor só existe
              quando alguém pede, para o formulário não carregar um campo vazio
              no caso comum de uma role só. */}
              <div className="block text-sm">
                <RotuloCampo
                  rotulo="Roles"
                  ajuda="Ao menos uma é obrigatória: é a role que define o que a pessoa pode fazer na plataforma. Com duas, o acesso é a soma das duas — se qualquer uma concede, ela pode. As permissões vêm sempre das roles, não há permissão individual por colaborador."
                />
                <div className="space-y-2">
                  {Array.from({ length: slotsVisiveis }, (_, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <select
                        value={roleIds[i] ?? ""}
                        onChange={(e) => definirRole(i, e.target.value)}
                        aria-label={i === 0 ? "Role" : "Role adicional"}
                        className="form-select dark:border-dark-450 dark:bg-dark-700 dark:text-dark-100 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                      >
                        {/* "Selecionar role" nos dois slots, e não "Nenhuma
                            role" no primeiro: a opção vazia continua existindo
                            porque o select precisa de um valor enquanto ninguém
                            escolheu, mas ela não é mais um estado válido de
                            membro — nomeá-la "Nenhuma role" a oferecia como
                            escolha. */}
                        <option value="">Selecionar role</option>
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
              </div>
            </>
          )}

          <label className="block text-sm">
            <RotuloCampo
              rotulo="Status"
              // Na criação a frase descreve o campo; na edição não há descrição
              // (o que existe é o aviso de realocação, que fica visível abaixo).
              ajuda={
                !editando
                  ? "Todo colaborador novo entra como convite pendente."
                  : undefined
              }
            />
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
            {/* A descrição da criação virou o ícone; este aviso NÃO virou,
                porque ele não descreve o campo: diz onde fazer a operação que a
                opção desabilitada impede. */}
            {editando && desativacaoExigeRealocacao && (
              <span className="dark:text-dark-300 mt-1 block text-xs font-normal text-gray-400">
                {liderados}{" "}
                {liderados === 1
                  ? "colaborador responde"
                  : "colaboradores respondem"}{" "}
                a esta pessoa. Use &ldquo;Desativar membro&rdquo; no menu da
                lista para escolher quem assume a equipe.
              </span>
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
