// Import Dependencies
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";

// Local Imports
import { PageTitle } from "@/components/shared/PageTitle";
import {
  ConfirmModal,
  type ModalState,
} from "@/components/shared/ConfirmModal";
import {
  atualizarMembroApi,
  fetchMembrosApi,
  removerMembroApi,
  type Membro,
} from "@/services/api/membros";
import { fetchRolesApi, type Role } from "@/services/api/roles";
import {
  atualizarAreaApi,
  atualizarCargoApi,
  criarAreaApi,
  criarCargoApi,
  fetchAreasApi,
  fetchCargosApi,
  removerAreaApi,
  removerCargoApi,
  SEM_REALOCACAO,
  type EstruturaItem,
} from "@/services/api/estrutura";
import { mensagemErroMembro } from "./membros-status";
import { equipeDireta } from "./hierarquia-membros";
import { MembroRealocacaoModal, type ModoSaida } from "./MembroRealocacaoModal";
import { ConvidadoParaMembroModal } from "./ConvidadoParaMembroModal";
import { EstruturaLista } from "./EstruturaLista";
import { EstruturaFormModal } from "./EstruturaFormModal";
import {
  COPY_AREAS_FORM,
  COPY_AREAS_LISTA,
  COPY_AREAS_REALOCACAO,
  COPY_CARGOS_FORM,
  COPY_CARGOS_LISTA,
  COPY_CARGOS_REALOCACAO,
} from "./estrutura-copy";
import {
  EstruturaRealocacaoModal,
  type ModoEstrutura,
} from "./EstruturaRealocacaoModal";
import { MembrosLista } from "./MembrosLista";
import { MembrosHierarquia } from "./MembrosHierarquia";
import { MembroDrawer } from "./MembroDrawer";
import { MembroFormModal } from "./MembroFormModal";
import { AcessoRoles } from "./AcessoRoles";
import { RoleDrawer } from "./RoleDrawer";
import { RoleFormModal } from "./RoleFormModal";
import { RoleExclusaoModal } from "./RoleExclusaoModal";
import { OwnerTransferenciaModal } from "./OwnerTransferenciaModal";
import { type SecaoAdministracao } from "./configuracoes-secoes";

// ----------------------------------------------------------------------
// Painel das cinco seções de organização de Configurações: Membros, Áreas,
// Cargos, Hierarquia e Roles.
//
// Isto era a tela "Administração", com Membros / Estrutura / Acesso na
// navegação lateral e Áreas, Cargos e Hierarquia como sub-abas de Estrutura.
// Administração deixou de ser uma área da plataforma: as cinco viraram itens de
// primeiro nível do menu de Configurações, e o rótulo do grupo ESTRUTURA passou
// a carregar o nível que a sub-aba `?aba=` carregava. (O comentário anterior
// argumentava contra essa promoção justamente porque não havia grupo para
// segurá-la; agora há.)
//
// O que NÃO mudou, e é a razão de este arquivo continuar sendo um só: ele é o
// dono dos dados e de TODOS os modais. As cinco seções leem a mesma lista de
// membros e abrem o mesmo drawer, então um estado por seção faria elas
// divergirem depois de qualquer edição.
//
// Por isso quem renderiza este painel tem de fazê-lo numa expressão JSX única,
// com a seção vindo por prop — nunca um branch por seção. Um branch por seção
// desmontaria e remontaria o painel a cada clique do menu: quatro chamadas de
// API, drawer fechado, filtros e busca da lista zerados.
//
// As quatro dimensões de um membro ficam deliberadamente separadas: área diz
// onde a pessoa está, cargo qual posição ocupa, gestor a quem responde, e role
// o que ela pode fazer. Nenhuma infere a outra.
// ----------------------------------------------------------------------

/**
 * Cabeçalho de cada seção.
 *
 * A ajuda da antiga página de Administração era um bloco só com quatro
 * parágrafos, e cada um falava de uma seção diferente — que agora são itens
 * distintos do menu. Dividida, cada pedaço chega junto do assunto dele.
 *
 * Mora aqui, e não dentro de `MembrosLista`/`EstruturaLista`/`AcessoRoles`/
 * `MembrosHierarquia`: aqueles quatro são componentes de apresentação e
 * continuam intocados. É o mesmo arranjo que `RegrasSection` já usa — a seção
 * traz o próprio título.
 */
const CABECALHOS: Record<
  SecaoAdministracao,
  { titulo: string; subtitulo: string; ajuda: ReactNode }
> = {
  membros: {
    titulo: "Colaboradores",
    subtitulo:
      "Colaboradores da organização, a hierarquia entre eles e o que cada um pode fazer",
    ajuda: (
      <>
        <p>
          Aqui você cadastra e mantém os dados de cada pessoa da organização.
          Quatro informações respondem por tudo: <strong>Área</strong> diz onde
          a pessoa está, <strong>Cargo</strong> qual posição ela ocupa,{" "}
          <strong>Gestor direto</strong> a quem ela responde, e as{" "}
          <strong>Roles</strong> o que ela pode fazer na plataforma.
        </p>
        <p>
          Nenhuma determina a outra: um analista pode ter role Admin, e uma
          mesma área pode ter várias cadeias de gestores.
        </p>
        <p>
          Um colaborador pode ter até duas roles, e o acesso é a soma das duas:
          se qualquer uma concede, ele pode. As permissões vêm sempre das roles
          — não há permissão individual por colaborador, então para mudar o que
          alguém pode fazer, altera-se a role.
        </p>
      </>
    ),
  },
  areas: {
    // Título e subtítulo vêm de `estrutura-copy.ts`, que é a casa de todo o
    // texto de Áreas e Cargos — o mesmo par que `EstruturaLista` renderizava
    // antes de Áreas e Cargos virarem seções.
    titulo: COPY_AREAS_LISTA.titulo,
    subtitulo: COPY_AREAS_LISTA.subtitulo,
    ajuda: (
      <>
        <p>
          As áreas cadastradas aqui são as opções que aparecem no formulário de
          colaborador. Área diz <strong>onde</strong> a pessoa está — não define
          hierarquia nem concede permissão.
        </p>
        <p>
          Desativar uma área apenas a tira das escolhas novas: quem já estava
          nela continua, e a associação segue aparecendo no cadastro.
        </p>
      </>
    ),
  },
  cargos: {
    titulo: COPY_CARGOS_LISTA.titulo,
    subtitulo: COPY_CARGOS_LISTA.subtitulo,
    ajuda: (
      <>
        <p>
          Os cargos cadastrados aqui são as opções que aparecem no formulário de
          colaborador. Cargo diz <strong>qual posição</strong> a pessoa ocupa —
          e não define hierarquia: dois gerentes podem estar em cadeias
          diferentes.
        </p>
        <p>
          Desativar um cargo apenas o tira das escolhas novas: quem já estava
          nele continua.
        </p>
      </>
    ),
  },
  hierarquia: {
    titulo: "Hierarquia",
    subtitulo:
      "A estrutura montada a partir do gestor direto de cada colaborador",
    ajuda: (
      <>
        <p>
          Esta é a única seção que você não preenche: ela é{" "}
          <strong>derivada</strong> do <strong>Gestor direto</strong> de cada
          colaborador, editado no cadastro dele. Não existe cadastro de
          subordinados.
        </p>
        <p>
          Os <strong>gestores indiretos</strong> aparecem como conexões
          secundárias sobre os mesmos cards — eles acompanham a pessoa sem
          definir a posição dela na estrutura.
        </p>
        <p>
          Convidados não participam do organograma: eles têm acesso à plataforma
          sem fazer parte da estrutura da organização.
        </p>
      </>
    ),
  },
  acesso: {
    titulo: "Roles",
    subtitulo: "O que cada pessoa pode fazer na plataforma",
    ajuda: (
      <>
        <p>
          Uma <strong>role</strong> responde o que o colaborador pode fazer. Não
          há permissão individual: para mudar o que alguém pode fazer, altera-se
          a role — ou atribui-se outra.
        </p>
        <p>
          Duas são protegidas e só admitem visualizar: a <strong>Owner</strong>,
          do responsável pela conta, que muda de mãos por &ldquo;Transferir
          propriedade&rdquo;; e a <strong>Convidado</strong>, atribuída
          automaticamente a quem é do tipo convidado.
        </p>
      </>
    ),
  },
};

const ERRO_CARGA = "Não foi possível carregar os dados da organização.";

/** Qual das duas entidades de Estrutura está em jogo. */
type Recurso = "area" | "cargo";

/** Ação destrutiva em confirmação. */
type Acao =
  | { tipo: "desativar"; membro: Membro }
  | { tipo: "cancelar"; membro: Membro }
  | { tipo: "excluirEstrutura"; recurso: Recurso; item: EstruturaItem };

export function PainelAdministracao({
  secao,
  onIrPara,
}: {
  secao: SecaoAdministracao;
  /**
   * Navegar para outra seção do menu.
   *
   * Uma prop, e não um `useSearchParams` aqui dentro: quem é dono da URL é a
   * página de Configurações, e duplicar o contrato de `?secao=` nos dois
   * lugares faria os ids divergirem em silêncio. Existe por causa de um único
   * call site — o botão "Ver membros" do estado vazio da Hierarquia.
   */
  onIrPara: (secao: SecaoAdministracao) => void;
}) {
  const active = secao;
  const cabecalho = CABECALHOS[secao];

  const [membros, setMembros] = useState<Membro[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [areas, setAreas] = useState<EstruturaItem[]>([]);
  const [cargos, setCargos] = useState<EstruturaItem[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erroCarga, setErroCarga] = useState<string | null>(null);

  const [estruturaEditando, setEstruturaEditando] =
    useState<EstruturaItem | null>(null);
  const [estruturaFormAberto, setEstruturaFormAberto] =
    useState<Recurso | null>(null);

  const [roleSelecionada, setRoleSelecionada] = useState<Role | null>(null);
  const [roleEditando, setRoleEditando] = useState<Role | null>(null);
  const [roleFormAberto, setRoleFormAberto] = useState(false);
  /**
   * Desativar/excluir uma área ou cargo COM colaboradores.
   *
   * Um estado só para os quatro casos, porque o modal é um só. Com zero
   * vinculados nada disto entra em cena: aquele caminho continua sendo um
   * clique (desativar) ou o ConfirmModal de sempre (excluir) — acrescentar
   * uma etapa onde não há consequência a explicar seria atrito puro.
   */
  const [realocandoEstrutura, setRealocandoEstrutura] = useState<{
    recurso: Recurso;
    modo: ModoEstrutura;
    item: EstruturaItem;
  } | null>(null);
  const [roleExcluindo, setRoleExcluindo] = useState<Role | null>(null);
  const [transferindoPropriedade, setTransferindoPropriedade] = useState(false);

  const [selecionado, setSelecionado] = useState<Membro | null>(null);
  const [editando, setEditando] = useState<Membro | null>(null);
  const [formAberto, setFormAberto] = useState(false);

  // Saída de um membro que lidera alguém: a decisão é "para quem vai a equipe",
  // que é um campo, não um sim/não — por isso não passa pelo ConfirmModal.
  const [realocando, setRealocando] = useState<{
    modo: ModoSaida;
    membro: Membro;
  } | null>(null);

  // A ação em confirmação e o "aberto" são estados separados de propósito: o
  // ConfirmModal segue montado durante o fade-out, e se o texto viesse de um
  // estado zerado no fechamento ele piscaria para a mensagem genérica.
  // Convidado voltando a ser membro: modal próprio, porque a decisão é qual
  // role ele passa a ter — um campo, não um sim/não. Simétrico ao de
  // realocação, que resolve a direção oposta.
  const [convertendoEmMembro, setConvertendoEmMembro] = useState<Membro | null>(
    null,
  );

  const [acao, setAcao] = useState<Acao | null>(null);
  const [confirmAberto, setConfirmAberto] = useState(false);
  const [estadoConfirm, setEstadoConfirm] = useState<ModalState>("pending");
  const [confirmando, setConfirmando] = useState(false);

  /**
   * Recarrega as quatro listas. Elas andam juntas: a contagem de membros por
   * role/área/cargo e o rótulo exibido em cada membro derivam umas das outras,
   * e recarregar só uma deixaria a tela mostrando números que não fecham.
   *
   * Esta lógica existe em dois lugares — aqui e na cadeia do efeito de carga
   * inicial abaixo. Ao acrescentar uma lista, mexer nos dois: esquecer um deixa
   * metade da tela obsoleta em silêncio.
   */
  const carregar = useCallback(async () => {
    try {
      const [listaMembros, listaRoles, listaAreas, listaCargos] =
        await Promise.all([
          fetchMembrosApi(),
          fetchRolesApi(),
          fetchAreasApi(),
          fetchCargosApi(),
        ]);
      setMembros(listaMembros);
      setRoles(listaRoles);
      setAreas(listaAreas);
      setCargos(listaCargos);
      setErroCarga(null);
    } catch (err) {
      setErroCarga(mensagemErroMembro(err, ERRO_CARGA));
    } finally {
      setCarregando(false);
    }
  }, []);

  // Carga inicial no formato dos providers de dados do projeto (ex.:
  // contexts/connectors/Provider.tsx): cadeia de promise com flag `cancelado`,
  // que evita setState depois do unmount — o StrictMode monta duas vezes em dev.
  useEffect(() => {
    let cancelado = false;
    Promise.all([
      fetchMembrosApi(),
      fetchRolesApi(),
      fetchAreasApi(),
      fetchCargosApi(),
    ])
      .then(([listaMembros, listaRoles, listaAreas, listaCargos]) => {
        if (cancelado) return;
        setMembros(listaMembros);
        setRoles(listaRoles);
        setAreas(listaAreas);
        setCargos(listaCargos);
        setErroCarga(null);
      })
      .catch((err: unknown) => {
        if (cancelado) return;
        setErroCarga(mensagemErroMembro(err, ERRO_CARGA));
      })
      .finally(() => {
        if (!cancelado) setCarregando(false);
      });
    return () => {
      cancelado = true;
    };
  }, []);

  const abrirCriacao = () => {
    setEditando(null);
    setFormAberto(true);
  };

  const abrirEdicao = (membro: Membro) => {
    setEditando(membro);
    setFormAberto(true);
  };

  const aoSalvar = (membro: Membro, criado: boolean) => {
    setFormAberto(false);
    setEditando(null);
    // O drawer pode estar aberto sobre o mesmo membro — mantém sincronizado.
    setSelecionado((atual) => (atual?.id === membro.id ? membro : atual));
    // Mensagens sem flexão de gênero: o nome do membro é dado do usuário.
    toast.success(
      criado
        ? `${membro.nome} entrou como convite pendente.`
        : `Dados de ${membro.nome} atualizados.`,
    );
    void carregar();
  };

  /** Reativar não é destrutivo: aplica direto, sem modal de confirmação. */
  const reativar = async (membro: Membro) => {
    try {
      const atualizado = await atualizarMembroApi(membro.id, {
        status: "ativo",
      });
      setSelecionado((atual) =>
        atual?.id === atualizado.id ? atualizado : atual,
      );
      toast.success(`${membro.nome} voltou a ter acesso.`);
      void carregar();
    } catch (err) {
      toast.error(
        mensagemErroMembro(err, "Não foi possível reativar o colaborador."),
      );
    }
  };

  const abrirNovaRole = () => {
    setRoleEditando(null);
    setRoleFormAberto(true);
  };

  const editarRole = (role: Role) => {
    setRoleEditando(role);
    setRoleFormAberto(true);
  };

  const aoSalvarRole = (role: Role, criada: boolean) => {
    setRoleFormAberto(false);
    setRoleEditando(null);
    // O drawer pode estar aberto sobre a mesma role — mantém sincronizado.
    setRoleSelecionada((atual) => (atual?.id === role.id ? role : atual));
    toast.success(
      criada
        ? `Role "${role.nome}" criada.`
        : `Role "${role.nome}" atualizada${role.membros > 0 ? ` — ${role.membros} ${role.membros === 1 ? "colaborador herda" : "colaboradores herdam"} as novas permissões` : ""}.`,
    );
    void carregar();
  };

  const aoTransferirPropriedade = (nomeDoNovoOwner: string) => {
    setTransferindoPropriedade(false);
    setRoleSelecionada(null);
    toast.success(
      `${nomeDoNovoOwner} é o novo proprietário da organização. Você deixou de ser o proprietário.`,
    );
    // Recarrega tudo: a contagem da role Owner, as roles dos dois membros
    // envolvidos e o papel da conta mudaram juntos.
    void carregar();
  };

  const aoExcluirRole = (role: Role) => {
    setRoleExcluindo(null);
    setRoleSelecionada((atual) => (atual?.id === role.id ? null : atual));
    toast.success(`Role "${role.nome}" excluída.`);
    void carregar();
  };

  // ---- Estrutura (Áreas e Cargos) -------------------------------------
  // Os handlers são genéricos sobre o recurso porque as duas entidades têm as
  // mesmas regras; só a API chamada e a cópia mudam.

  const abrirEstruturaNova = (recurso: Recurso) => {
    setEstruturaEditando(null);
    setEstruturaFormAberto(recurso);
  };

  const editarEstrutura = (recurso: Recurso, item: EstruturaItem) => {
    setEstruturaEditando(item);
    setEstruturaFormAberto(recurso);
  };

  const fecharEstruturaForm = () => {
    setEstruturaFormAberto(null);
    setEstruturaEditando(null);
  };

  const aoSalvarEstrutura = (
    recurso: Recurso,
    item: EstruturaItem,
    criado: boolean,
  ) => {
    fecharEstruturaForm();
    const nome = recurso === "area" ? "Área" : "Cargo";
    // Sem flexão de gênero no nome: ele é dado do usuário.
    toast.success(
      criado
        ? `${nome} "${item.nome}" criado.`
        : `${nome} "${item.nome}" atualizado.`,
    );
    void carregar();
  };

  /**
   * Alterna ativo/inativo pelo menu da linha.
   *
   * Reativar e desativar algo sem ninguém vinculado seguem diretos, sem
   * confirmação: não são destrutivos — preservam registro, histórico e
   * associações, e só mexem nas escolhas novas.
   *
   * Desativar COM colaboradores abre o modal de realocação. Não porque a ação
   * passou a ser perigosa (ela continua preservando tudo), mas porque é o
   * único momento em que oferecer o destino faz sentido — depois, mover as
   * pessoas viraria edição uma a uma.
   */
  const alternarStatusEstrutura = async (
    recurso: Recurso,
    item: EstruturaItem,
  ) => {
    if (item.status === "ativo" && item.membros > 0) {
      setRealocandoEstrutura({ recurso, modo: "desativar", item });
      return;
    }

    const proximo = item.status === "ativo" ? "inativo" : "ativo";
    const atualizar = recurso === "area" ? atualizarAreaApi : atualizarCargoApi;
    try {
      await atualizar(item.id, { status: proximo });
      toast.success(
        proximo === "inativo"
          ? `"${item.nome}" não aparece mais como opção nos cadastros. Quem já estava continua.`
          : `"${item.nome}" voltou a ser uma opção nos cadastros.`,
      );
      void carregar();
    } catch (err) {
      toast.error(
        mensagemErroMembro(err, "Não foi possível alterar o status."),
      );
    }
  };

  /**
   * Quantos membros respondem diretamente a este.
   *
   * Deriva da lista já carregada — a única relação persistida é `gestorId`, e a
   * autoridade da contagem é o backend, que reconta na confirmação. Aqui serve
   * só para escolher o fluxo: com liderados, o modal de realocação; sem eles, o
   * ConfirmModal de sempre, sem etapa a mais.
   */
  const lideradosDiretos = (membro: Membro) =>
    equipeDireta(membros, membro.id).length;

  /** Abre o modal de realocação ou o fluxo antigo, conforme haja equipe. */
  const pedirSaida = (modo: ModoSaida, membro: Membro) => {
    if (lideradosDiretos(membro) > 0) {
      setRealocando({ modo, membro });
      return;
    }
    pedirConfirmacao({
      tipo: modo === "excluir" ? "cancelar" : "desativar",
      membro,
    });
  };

  const aoRealocar = (
    membro: Membro,
    modo: ModoSaida,
    liderados: number,
    novaLideranca: Membro,
    atualizado: Membro | null,
  ) => {
    setRealocando(null);
    // O drawer pode estar aberto sobre quem acabou de sair da estrutura. Quem
    // deixou de existir sai do drawer; quem continua tem de ser RE-SINCRONIZADO
    // — `carregar()` troca a lista, mas o selecionado é estado separado, e sem
    // isto o detalhe seguiria mostrando o estado anterior de quem acabou de ser
    // desativado.
    setSelecionado((atual) => {
      if (atual?.id !== membro.id) return atual;
      return modo === "excluir" ? null : (atualizado ?? atual);
    });
    const desfecho = modo === "excluir" ? "foi excluído" : "ficou inativo";
    toast.success(
      `${membro.nome} ${desfecho}. ${liderados} ${liderados === 1 ? "liderado agora responde" : "liderados agora respondem"} a ${novaLideranca.nome}.`,
    );
    void carregar();
  };

  /**
   * Convidado → colaborador, a única direção que existe.
   *
   * A inversa saiu da interface a pedido: quem já faz parte da organização não
   * é mais rebaixado a convidado por aqui. A que ficou tem modal próprio,
   * porque o que ela precisa é uma role.
   */
  const pedirConversao = (membro: Membro) => {
    setConvertendoEmMembro(membro);
  };

  const aoConverterEmMembro = (atualizado: Membro) => {
    setConvertendoEmMembro(null);
    setSelecionado((atual) =>
      atual?.id === atualizado.id ? atualizado : atual,
    );
    toast.success(
      `${atualizado.nome} agora faz parte da organização. Defina área, cargo e gestor em Editar colaborador.`,
    );
    void carregar();
  };

  /**
   * A chamada de API da realocação, já ligada à espécie certa.
   *
   * O mapeamento de "sem destino" difere entre as duas ações, e é aqui que
   * ele mora: na exclusão manda-se `SEM_REALOCACAO` (a API recusa a chamada
   * sem resolução, de propósito); na desativação manda-se nada, porque
   * desativar sem realocar preserva os vínculos e não há o que resolver.
   */
  const aplicarRealocacaoEstrutura = async (
    recurso: Recurso,
    modo: ModoEstrutura,
    item: EstruturaItem,
    destinoId: string | null,
  ) => {
    if (modo === "excluir") {
      const remover = recurso === "area" ? removerAreaApi : removerCargoApi;
      await remover(item.id, destinoId ?? SEM_REALOCACAO);
      return;
    }
    const atualizar = recurso === "area" ? atualizarAreaApi : atualizarCargoApi;
    await atualizar(item.id, {
      status: "inativo",
      ...(destinoId ? { realocarPara: destinoId } : {}),
    });
  };

  const aoConcluirRealocacao = (mensagem: string) => {
    setRealocandoEstrutura(null);
    toast.success(mensagem);
    void carregar();
  };

  const pedirConfirmacao = (proxima: Acao) => {
    setAcao(proxima);
    setEstadoConfirm("pending");
    setConfirmAberto(true);
  };

  const confirmarAcao = async () => {
    if (!acao) return;
    setConfirmando(true);
    try {
      if (acao.tipo === "excluirEstrutura") {
        const remover =
          acao.recurso === "area" ? removerAreaApi : removerCargoApi;
        await remover(acao.item.id);
      } else if (acao.tipo === "desativar") {
        await atualizarMembroApi(acao.membro.id, { status: "inativo" });
      } else {
        await removerMembroApi(acao.membro.id);
      }
      setEstadoConfirm("success");
      // Quem saiu da lista sai do detalhe junto. Estrutura fica de fora: as
      // áreas e os cargos não têm detalhe aberto para fechar.
      if (acao.tipo !== "excluirEstrutura") {
        setSelecionado((atual) =>
          atual?.id === acao.membro.id ? null : atual,
        );
      }
      void carregar();
    } catch (err) {
      setEstadoConfirm("error");
      toast.error(mensagemErroMembro(err, "Não foi possível concluir a ação."));
    } finally {
      setConfirmando(false);
    }
  };

  const fecharConfirm = () => {
    if (confirmando) return;
    setConfirmAberto(false);
  };

  return (
    <>
      {/* Cabeçalho da seção. A ajuda vem de `CABECALHOS`, dividida por seção:
          antes era um bloco único de quatro parágrafos numa página chamada
          Administração, e cada parágrafo falava de uma seção diferente.

          Um `PageTitle` aqui, com "Configurações" acima, é o arranjo que
          `RegrasSection` já usa — a seção traz o próprio título. */}
      <div className="mb-6 flex flex-col gap-1">
        <PageTitle help={{ description: cabecalho.ajuda }}>
          {cabecalho.titulo}
        </PageTitle>
        <p className="dark:text-dark-300 max-w-xl text-sm text-gray-500">
          {cabecalho.subtitulo}
        </p>
      </div>

      {active === "membros" ? (
        <MembrosLista
          membros={membros}
          carregando={carregando}
          erroCarga={erroCarga}
          onRecarregar={() => void carregar()}
          onAdicionar={abrirCriacao}
          onAbrirMembro={setSelecionado}
          onEditar={abrirEdicao}
          onDesativar={(m) => pedirSaida("desativar", m)}
          onReativar={(m) => void reativar(m)}
          onCancelarConvite={(m) => pedirSaida("excluir", m)}
          onConverter={pedirConversao}
        />
      ) : active === "areas" ? (
        <EstruturaLista
          itens={areas}
          copy={COPY_AREAS_LISTA}
          carregando={carregando}
          erroCarga={erroCarga}
          onRecarregar={() => void carregar()}
          onCriar={() => abrirEstruturaNova("area")}
          onEditar={(item) => editarEstrutura("area", item)}
          onAlternarStatus={(item) =>
            void alternarStatusEstrutura("area", item)
          }
          onExcluir={(item) =>
            item.membros > 0
              ? setRealocandoEstrutura({
                  recurso: "area",
                  modo: "excluir",
                  item,
                })
              : pedirConfirmacao({
                  tipo: "excluirEstrutura",
                  recurso: "area",
                  item,
                })
          }
        />
      ) : active === "cargos" ? (
        <EstruturaLista
          itens={cargos}
          copy={COPY_CARGOS_LISTA}
          carregando={carregando}
          erroCarga={erroCarga}
          onRecarregar={() => void carregar()}
          onCriar={() => abrirEstruturaNova("cargo")}
          onEditar={(item) => editarEstrutura("cargo", item)}
          onAlternarStatus={(item) =>
            void alternarStatusEstrutura("cargo", item)
          }
          onExcluir={(item) =>
            item.membros > 0
              ? setRealocandoEstrutura({
                  recurso: "cargo",
                  modo: "excluir",
                  item,
                })
              : pedirConfirmacao({
                  tipo: "excluirEstrutura",
                  recurso: "cargo",
                  item,
                })
          }
        />
      ) : active === "hierarquia" ? (
        <MembrosHierarquia
          membros={membros}
          // A seleção da PÁGINA, a mesma do drawer: o organograma não tem
          // um conceito próprio, e criar um segundo faria os dois
          // divergirem no primeiro bug.
          membroSelecionadoId={selecionado?.id ?? null}
          onAbrirMembro={setSelecionado}
          onIrParaLista={() => onIrPara("membros")}
        />
      ) : (
        <AcessoRoles
          roles={roles}
          carregando={carregando}
          erroCarga={erroCarga}
          onRecarregar={() => void carregar()}
          onNova={abrirNovaRole}
          onAbrirRole={setRoleSelecionada}
          onEditar={editarRole}
          onExcluir={setRoleExcluindo}
          onTransferirPropriedade={() => setTransferindoPropriedade(true)}
        />
      )}

      {/* Detalhe do membro — compartilhado por todas as seções. */}
      <MembroDrawer
        membro={selecionado}
        membros={membros}
        close={() => setSelecionado(null)}
        onEditar={() => selecionado && abrirEdicao(selecionado)}
        onAbrirMembro={setSelecionado}
      />

      {/* Adicionar / editar. `key` remonta o form limpo a cada abertura,
          dispensando um efeito de reset. */}
      <MembroFormModal
        key={editando?.id ?? "novo"}
        open={formAberto}
        membro={editando}
        membros={membros}
        roles={roles}
        areas={areas}
        cargos={cargos}
        liderados={editando ? lideradosDiretos(editando) : 0}
        onClose={() => {
          setFormAberto(false);
          setEditando(null);
        }}
        onSalvo={aoSalvar}
      />

      {/* Detalhe da role — compartilhado pela aba Acesso e pelo drawer do
          membro, que leva a ela. */}
      <RoleDrawer
        role={roleSelecionada}
        membros={membros}
        close={() => setRoleSelecionada(null)}
        onEditar={() => roleSelecionada && editarRole(roleSelecionada)}
        onTransferirPropriedade={() => setTransferindoPropriedade(true)}
        onAbrirMembro={(m) => {
          setRoleSelecionada(null);
          setSelecionado(m);
        }}
      />

      <RoleFormModal
        key={roleEditando?.id ?? "nova"}
        open={roleFormAberto}
        role={roleEditando}
        onClose={() => {
          setRoleFormAberto(false);
          setRoleEditando(null);
        }}
        onSalvo={aoSalvarRole}
      />

      {/* Transferência de propriedade — a única ação da role Owner. `key`
          remonta o modal limpo a cada abertura, dispensando um reset. */}
      <OwnerTransferenciaModal
        key={transferindoPropriedade ? "aberto" : "fechado"}
        aberto={transferindoPropriedade}
        roleOwner={roles.find((r) => r.proprietaria) ?? null}
        roles={roles}
        membros={membros}
        onClose={() => setTransferindoPropriedade(false)}
        onTransferido={aoTransferirPropriedade}
      />

      <RoleExclusaoModal
        key={roleExcluindo?.id ?? "nenhuma"}
        role={roleExcluindo}
        roles={roles}
        // Quantos perderiam a única role que têm. Calculado aqui porque é aqui
        // que a lista de membros vive: a `Role` traz só o total de portadores,
        // e dele não se deduz quantos deles têm uma segunda.
        membrosQueFicariamSemRole={
          roleExcluindo == null
            ? 0
            : membros.filter(
                (m) =>
                  m.roleIds.length === 1 && m.roleIds[0] === roleExcluindo.id,
              ).length
        }
        onClose={() => setRoleExcluindo(null)}
        onExcluida={aoExcluirRole}
      />

      {/* Desativar ou excluir área/cargo COM colaboradores. `key` remonta o
          modal a cada abertura, para o select de destino não vir preenchido
          da vez anterior — convenção de todos os modais desta página. O
          prefixo evita empatar com o `"nenhum"` dos modais vizinhos: chaves
          se comparam entre irmãos, e duas iguais viram aviso do React. */}
      <EstruturaRealocacaoModal
        key={
          realocandoEstrutura
            ? `estrutura-${realocandoEstrutura.modo}-${realocandoEstrutura.item.id}`
            : "estrutura-nenhum"
        }
        item={realocandoEstrutura?.item ?? null}
        modo={realocandoEstrutura?.modo ?? "desativar"}
        // A lista da própria espécie: o destino nunca atravessa área ↔ cargo.
        itens={realocandoEstrutura?.recurso === "cargo" ? cargos : areas}
        copy={
          realocandoEstrutura?.recurso === "cargo"
            ? COPY_CARGOS_REALOCACAO
            : COPY_AREAS_REALOCACAO
        }
        onConfirmar={(item, destinoId) =>
          aplicarRealocacaoEstrutura(
            realocandoEstrutura?.recurso ?? "area",
            realocandoEstrutura?.modo ?? "desativar",
            item,
            destinoId,
          )
        }
        onClose={() => setRealocandoEstrutura(null)}
        onConcluido={aoConcluirRealocacao}
      />

      {/* Saída de um gestor com equipe. `key` remonta o form limpo a cada
          abertura, para o select de nova liderança não vir preenchido do
          membro anterior. */}
      {/* Convidado → membro. `key` remonta limpo a cada abertura, dispensando
          um reset — convenção de todos os modais desta página. */}
      <ConvidadoParaMembroModal
        key={convertendoEmMembro?.id ?? "nenhum"}
        membro={convertendoEmMembro}
        roles={roles}
        onClose={() => setConvertendoEmMembro(null)}
        onConcluido={aoConverterEmMembro}
      />

      <MembroRealocacaoModal
        key={`${realocando?.modo ?? "nenhum"}-${realocando?.membro.id ?? "nenhum"}`}
        membro={realocando?.membro ?? null}
        modo={realocando?.modo ?? "excluir"}
        membros={membros}
        onClose={() => setRealocando(null)}
        onConcluido={aoRealocar}
      />

      {/* Criar / editar Área ou Cargo. `key` remonta o form limpo a cada
          abertura — e inclui o recurso, para trocar de aba não reaproveitar o
          estado do outro. */}
      <EstruturaFormModal
        key={`${estruturaFormAberto ?? "nenhum"}-${estruturaEditando?.id ?? "novo"}`}
        open={estruturaFormAberto !== null}
        item={estruturaEditando}
        copy={
          estruturaFormAberto === "cargo" ? COPY_CARGOS_FORM : COPY_AREAS_FORM
        }
        onClose={fecharEstruturaForm}
        onCriar={estruturaFormAberto === "cargo" ? criarCargoApi : criarAreaApi}
        onAtualizar={
          estruturaFormAberto === "cargo" ? atualizarCargoApi : atualizarAreaApi
        }
        onSalvo={(item, criado) =>
          aoSalvarEstrutura(estruturaFormAberto ?? "area", item, criado)
        }
      />

      <ConfirmModal
        show={confirmAberto}
        onClose={fecharConfirm}
        onOk={() => void confirmarAcao()}
        confirmLoading={confirmando}
        state={estadoConfirm}
        messages={
          acao?.tipo === "excluirEstrutura"
            ? {
                pending: {
                  title:
                    acao.recurso === "area"
                      ? "Excluir esta área?"
                      : "Excluir este cargo?",
                  // Só chega aqui sem ninguém vinculado: o menu esconde
                  // "Excluir" quando há membros, e a API recusaria de todo
                  // jeito.
                  description: `"${acao.item.nome}" será removido da organização. Nenhum colaborador está ${acao.recurso === "area" ? "nesta área" : "com este cargo"}, então nada é desfeito.`,
                  actionText: "Excluir",
                },
                success: {
                  title: "Excluído",
                  description: "O cadastro não aparece mais na lista.",
                  actionText: "Ok",
                },
                error: {
                  title: "Não foi possível excluir",
                  description: "Tente novamente em instantes.",
                  actionText: "Tentar de novo",
                },
              }
            : acao?.tipo === "cancelar"
              ? {
                  pending: {
                    title: "Cancelar este convite?",
                    // Este branch só roda com zero liderados: quem lidera
                    // alguém passa pelo modal de realocação, não por aqui.
                    description: `O convite de ${acao.membro.nome} será removido da organização. Ninguém responde a essa pessoa, e você pode enviar um novo convite depois.`,
                    actionText: "Cancelar convite",
                  },
                  success: {
                    title: "Convite cancelado",
                    description:
                      "A pessoa não aparece mais na lista de colaboradores.",
                    actionText: "Ok",
                  },
                  error: {
                    title: "Não foi possível cancelar",
                    description: "Tente novamente em instantes.",
                    actionText: "Tentar de novo",
                  },
                }
              : {
                  pending: {
                    title: "Desativar este colaborador?",
                    description: acao
                      ? `${acao.membro.nome} deixa de ter acesso ativo à organização. A posição na hierarquia é preservada e você pode reativar depois.`
                      : "",
                    actionText: "Desativar",
                  },
                  success: {
                    title: "Colaborador desativado",
                    description: "O acesso à organização ficou inativo.",
                    actionText: "Ok",
                  },
                  error: {
                    title: "Não foi possível desativar",
                    description: "Tente novamente em instantes.",
                    actionText: "Tentar de novo",
                  },
                }
        }
      />
    </>
  );
}
