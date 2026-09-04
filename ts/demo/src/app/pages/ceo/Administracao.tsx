// Import Dependencies
import { useCallback, useEffect, useState } from "react";
import { useLocation, useSearchParams } from "react-router";
import { toast } from "sonner";
import { KeyIcon, ShareIcon, UsersIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";

// Local Imports
import { Page } from "@/components/shared/Page";
import { PageTitle } from "@/components/shared/PageTitle";
import {
  ConfirmModal,
  type ModalState,
} from "@/components/shared/ConfirmModal";
import { ScrollShadow } from "@/components/ui";
import { getCurrentProduct } from "@/app/navigation/ceoOs";
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
  type EstruturaItem,
} from "@/services/api/estrutura";
import { mensagemErroMembro } from "./membros-status";
import { equipeDireta } from "./hierarquia-membros";
import {
  MembroRealocacaoModal,
  type ModoSaida,
} from "./MembroRealocacaoModal";
import { EstruturaLista } from "./EstruturaLista";
import { EstruturaFormModal } from "./EstruturaFormModal";
import {
  COPY_AREAS_FORM,
  COPY_AREAS_LISTA,
  COPY_CARGOS_FORM,
  COPY_CARGOS_LISTA,
} from "./estrutura-copy";
import { MembrosLista } from "./MembrosLista";
import { MembrosHierarquia } from "./MembrosHierarquia";
import { MembroDrawer } from "./MembroDrawer";
import { MembroFormModal } from "./MembroFormModal";
import { AcessoRoles } from "./AcessoRoles";
import { RoleDrawer } from "./RoleDrawer";
import { RoleFormModal } from "./RoleFormModal";
import { RoleExclusaoModal } from "./RoleExclusaoModal";

// ----------------------------------------------------------------------
// Administração da organização — três seções:
//   • Membros   — listagem e cadastro (V1).
//   • Estrutura — Áreas, Cargos e a árvore derivada de Gestor direto (V2/V4).
//   • Acesso    — roles e permissões (V3).
//
// As quatro dimensões ficam deliberadamente separadas: área diz onde a pessoa
// está, cargo qual posição ocupa, gestor a quem responde, e role o que ela pode
// fazer. Nenhuma infere a outra.
//
// O layout de seções (navegação lateral que vira strip horizontal abaixo de lg,
// seção na URL via ?secao=) é o mesmo de Configuracoes.tsx, de propósito: são
// as duas telas administrativas da plataforma.
//
// Esta página é a dona dos dados e de todos os modais. As abas são
// apresentação: as duas leem a mesma lista e abrem o mesmo drawer, então um
// estado por aba faria as duas divergirem depois de qualquer edição.
// ----------------------------------------------------------------------

const SECOES = [
  { id: "membros", titulo: "Membros", icon: UsersIcon },
  { id: "estrutura", titulo: "Estrutura", icon: ShareIcon },
  { id: "acesso", titulo: "Acesso", icon: KeyIcon },
] as const;

type SecaoId = (typeof SECOES)[number]["id"];

/**
 * Sub-abas da seção Estrutura, em `?aba=`.
 *
 * Ficam AQUI, dentro da seção que já existia, em vez de virarem itens da
 * navegação lateral: Áreas, Cargos e Hierarquia respondem à mesma pergunta —
 * como a organização se organiza —, e promovê-las a seções empurraria Membros
 * e Acesso para o mesmo nível de granularidade.
 */
const ABAS_ESTRUTURA = [
  { id: "areas", titulo: "Áreas" },
  { id: "cargos", titulo: "Cargos" },
  { id: "hierarquia", titulo: "Hierarquia" },
] as const;

type AbaEstruturaId = (typeof ABAS_ESTRUTURA)[number]["id"];

const ERRO_CARGA = "Não foi possível carregar os dados da organização.";

/** Qual das duas entidades de Estrutura está em jogo. */
type Recurso = "area" | "cargo";

/** Ação destrutiva em confirmação. */
type Acao =
  | { tipo: "desativar"; membro: Membro }
  | { tipo: "cancelar"; membro: Membro }
  | { tipo: "excluirEstrutura"; recurso: Recurso; item: EstruturaItem };

export default function Administracao() {
  const { pathname } = useLocation();
  const product = getCurrentProduct(pathname);
  const [searchParams, setSearchParams] = useSearchParams();

  const secaoSolicitada = searchParams.get("secao");
  const active: SecaoId =
    SECOES.find((s) => s.id === secaoSolicitada)?.id ?? "membros";

  const abaSolicitada = searchParams.get("aba");
  const abaEstrutura: AbaEstruturaId =
    ABAS_ESTRUTURA.find((a) => a.id === abaSolicitada)?.id ?? "areas";

  const selecionarSecao = (secao: SecaoId) => {
    const proximos = new URLSearchParams(searchParams);
    proximos.set("secao", secao);
    // A sub-aba só existe dentro de Estrutura: carregá-la para Membros ou
    // Acesso deixaria um parâmetro morto na URL compartilhada.
    if (secao !== "estrutura") proximos.delete("aba");
    setSearchParams(proximos);
  };

  const selecionarAba = (aba: AbaEstruturaId) => {
    const proximos = new URLSearchParams(searchParams);
    proximos.set("secao", "estrutura");
    proximos.set("aba", aba);
    setSearchParams(proximos);
  };

  const [membros, setMembros] = useState<Membro[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [areas, setAreas] = useState<EstruturaItem[]>([]);
  const [cargos, setCargos] = useState<EstruturaItem[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erroCarga, setErroCarga] = useState<string | null>(null);

  const [estruturaEditando, setEstruturaEditando] =
    useState<EstruturaItem | null>(null);
  const [estruturaFormAberto, setEstruturaFormAberto] = useState<Recurso | null>(
    null,
  );

  const [roleSelecionada, setRoleSelecionada] = useState<Role | null>(null);
  const [roleEditando, setRoleEditando] = useState<Role | null>(null);
  const [roleFormAberto, setRoleFormAberto] = useState(false);
  const [roleExcluindo, setRoleExcluindo] = useState<Role | null>(null);

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
        mensagemErroMembro(err, "Não foi possível reativar o membro."),
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
        : `Role "${role.nome}" atualizada${role.membros > 0 ? ` — ${role.membros} ${role.membros === 1 ? "membro herda" : "membros herdam"} as novas permissões` : ""}.`,
    );
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
   * Alterna ativo/inativo direto pelo menu da linha.
   *
   * Não passa por confirmação: desativar aqui NÃO é destrutivo — preserva o
   * registro, o histórico e todas as associações de membro, e só tira a
   * entidade das escolhas novas.
   */
  const alternarStatusEstrutura = async (
    recurso: Recurso,
    item: EstruturaItem,
  ) => {
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
  ) => {
    setRealocando(null);
    // O drawer pode estar aberto sobre quem acabou de sair da estrutura.
    setSelecionado((atual) =>
      atual?.id === membro.id && modo === "excluir" ? null : atual,
    );
    toast.success(
      `${membro.nome} ${modo === "excluir" ? "foi excluído" : "ficou inativo"}. ${liderados} ${liderados === 1 ? "liderado agora responde" : "liderados agora respondem"} a ${novaLideranca.nome}.`,
    );
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
      if (acao.tipo !== "excluirEstrutura") {
        setSelecionado((atual) => (atual?.id === acao.membro.id ? null : atual));
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
    <Page title={`Administração · ${product.name}`}>
      <div className="transition-content w-full px-(--margin-x) py-6">
        {/* Cabeçalho */}
        <div className="flex flex-col gap-1">
          <PageTitle
            help={{
              description: (
                <>
                  <p>
                    <strong>Estrutura</strong> reúne quem faz parte da
                    organização e como essas pessoas se organizam. Em{" "}
                    <strong>Membros</strong> você cadastra e mantém os dados de
                    cada pessoa; em <strong>Hierarquia</strong> vê a estrutura
                    montada a partir dessas informações.
                  </p>
                  <p>
                    Quatro informações respondem por tudo: <strong>Área</strong>{" "}
                    diz onde a pessoa está, <strong>Cargo</strong> qual posição
                    ela ocupa, <strong>Gestor direto</strong> a quem ela
                    responde, e as <strong>Roles</strong> o que ela pode fazer
                    na plataforma. Nenhuma determina a outra: um analista pode
                    ter role Admin, e uma mesma área pode ter várias cadeias de
                    gestores.
                  </p>
                  <p>
                    As áreas e os cargos disponíveis são cadastrados em{" "}
                    <strong>Estrutura</strong>, e é de lá que saem as opções do
                    formulário de membro. Desativar uma área ou um cargo apenas
                    o tira das escolhas novas: quem já estava nele continua.
                  </p>
                  <p>
                    A hierarquia e as roles são editadas no cadastro do membro.
                    Um membro pode ter até duas roles, e o acesso é a soma das
                    duas: se qualquer uma concede, ele pode. As permissões vêm
                    sempre das roles — não há permissão individual por membro,
                    então para mudar o que alguém pode fazer, altera-se a role.
                  </p>
                </>
              ),
            }}
          >
            Administração
          </PageTitle>
          <p className="dark:text-dark-300 max-w-xl text-sm text-gray-500">
            Membros da organização, a hierarquia entre eles e o que cada um pode
            fazer
          </p>
        </div>

        <div className="mt-6 flex flex-col gap-6 lg:flex-row">
          {/* Navegação lateral — abaixo de lg vira uma strip horizontal, mesmo
              tratamento de Configuracoes.tsx. */}
          <nav className="min-w-0 lg:w-56 lg:shrink-0">
            <ScrollShadow
              orientation="horizontal"
              size={24}
              className="dark:border-dark-600 dark:bg-dark-700 hide-scrollbar flex gap-1.5 overflow-x-auto rounded-xl border border-gray-200 bg-white p-1.5 lg:overflow-visible"
            >
              <ul className="flex gap-1.5 lg:w-full lg:flex-col lg:gap-1">
                {SECOES.map((s) => (
                  <li key={s.id} className="shrink-0 lg:shrink">
                    <button
                      type="button"
                      onClick={() => selecionarSecao(s.id)}
                      className={clsx(
                        "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                        active === s.id
                          ? "bg-primary-600 dark:bg-primary-500 text-white"
                          : "dark:text-dark-200 dark:hover:bg-dark-600 text-gray-600 hover:bg-gray-100",
                      )}
                    >
                      <s.icon className="size-4.5 shrink-0" />
                      {s.titulo}
                    </button>
                  </li>
                ))}
              </ul>
            </ScrollShadow>
          </nav>

          {/* Painel da seção ativa */}
          <div className="min-w-0 flex-1">
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
              />
            ) : active === "estrutura" ? (
              <div>
                {/* Sub-abas — mesma pílula da navegação lateral, em escala
                    menor, para ler como um nível abaixo e não como um segundo
                    menu. */}
                <ScrollShadow
                  orientation="horizontal"
                  size={24}
                  className="hide-scrollbar mb-5 flex gap-1 overflow-x-auto"
                >
                  {ABAS_ESTRUTURA.map((aba) => (
                    <button
                      key={aba.id}
                      type="button"
                      onClick={() => selecionarAba(aba.id)}
                      className={clsx(
                        "shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                        abaEstrutura === aba.id
                          ? "dark:bg-dark-600 dark:text-dark-100 bg-gray-150 text-gray-800"
                          : "dark:text-dark-300 dark:hover:bg-dark-700 text-gray-500 hover:bg-gray-100",
                      )}
                    >
                      {aba.titulo}
                    </button>
                  ))}
                </ScrollShadow>

                {abaEstrutura === "areas" ? (
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
                      pedirConfirmacao({
                        tipo: "excluirEstrutura",
                        recurso: "area",
                        item,
                      })
                    }
                  />
                ) : abaEstrutura === "cargos" ? (
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
                      pedirConfirmacao({
                        tipo: "excluirEstrutura",
                        recurso: "cargo",
                        item,
                      })
                    }
                  />
                ) : (
                  <MembrosHierarquia
                    membros={membros}
                    onAbrirMembro={setSelecionado}
                    onIrParaLista={() => selecionarSecao("membros")}
                  />
                )}
              </div>
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
              />
            )}
          </div>
        </div>
      </div>

      {/* Detalhe do membro — compartilhado pelas duas abas. */}
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

      <RoleExclusaoModal
        key={roleExcluindo?.id ?? "nenhuma"}
        role={roleExcluindo}
        roles={roles}
        onClose={() => setRoleExcluindo(null)}
        onExcluida={aoExcluirRole}
      />

      {/* Saída de um gestor com equipe. `key` remonta o form limpo a cada
          abertura, para o select de nova liderança não vir preenchido do
          membro anterior. */}
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
        onCriar={
          estruturaFormAberto === "cargo" ? criarCargoApi : criarAreaApi
        }
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
                  description: `"${acao.item.nome}" será removido da organização. Nenhum membro está ${acao.recurso === "area" ? "nesta área" : "com este cargo"}, então nada é desfeito.`,
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
                  description: "A pessoa não aparece mais na lista de membros.",
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
                  title: "Desativar este membro?",
                  description: acao
                    ? `${acao.membro.nome} deixa de ter acesso ativo à organização. A posição na hierarquia é preservada e você pode reativar depois.`
                    : "",
                  actionText: "Desativar",
                },
                success: {
                  title: "Membro desativado",
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
    </Page>
  );
}
