// Import Dependencies
import { useMemo, useState } from "react";
import {
  Menu,
  MenuButton,
  MenuItem,
  MenuItems,
  Transition,
} from "@headlessui/react";
import {
  ArrowsRightLeftIcon,
  EllipsisVerticalIcon,
  EyeIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  PencilSquareIcon,
  PlusIcon,
  TrashIcon,
  UserMinusIcon,
  UserPlusIcon,
  UsersIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import clsx from "clsx";

// Local Imports
import {
  Avatar,
  Badge,
  Button,
  Spinner,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
} from "@/components/ui";
import type { Membro, MembroStatus, MembroTipo } from "@/services/api/membros";
import {
  rotuloArea,
  rotuloCargo,
  STATUS_MEMBRO,
  TIPO_MEMBRO,
} from "./membros-status";

// ----------------------------------------------------------------------
// Aba "Membros" da tela Estrutura: listagem, filtros e ações por linha.
//
// Componente de apresentação. Os dados e todos os modais vivem em
// Estrutura.tsx, porque a aba Hierarquia usa a MESMA lista e o MESMO drawer —
// duplicar esse estado deixaria as duas abas divergindo.
//
// A busca e os filtros, ao contrário, vivem AQUI: são estado de interface, não
// dado. Nenhum outro consumidor os lê, e subi-los para a página só engordaria
// um arquivo que já é dono de quatro listas e oito modais.
//
// Tudo client-side. A lista vem inteira (não há paginação), e o filtro no
// servidor não daria conta da chave usada aqui: Área e Cargo são filtrados pelo
// RÓTULO, e o backend guarda o CÓDIGO nas linhas legadas — só o cliente tem a
// tabela de tradução (ver `rotuloArea`).
// ----------------------------------------------------------------------

/**
 * Filtros da listagem, num objeto só e não em quatro `useState`.
 *
 * O motivo é o `useMemo`: quatro estados são quatro chances de esquecer uma
 * dependência, e o sintoma é o pior possível — o filtro muda e a lista não.
 * Com um objeto a dependência é um valor só. Mesma forma de `MemoriaGrafo`.
 */
/**
 * Valor composto do filtro de status: quem está na organização.
 *
 * Não é um `MembroStatus` — é uma opção de FILTRO, e por isso um sentinela
 * próprio, como o `SEM` de Área e Cargo. Colidir com status de verdade é
 * impossível: os três do enum são `ativo`, `convite_pendente` e `inativo`.
 */
const EM_ATIVIDADE = "em_atividade";

/**
 * Os status que `EM_ATIVIDADE` inclui, escritos um por um em vez de derivados
 * por `!== "inativo"`.
 *
 * Se um quarto status nascer no enum, esta lista o deixa de FORA até alguém
 * decidir — mesma regra que `OPCOES_STATUS` segue ao não derivar as opções dos
 * membros carregados. Num filtro que todo mundo vê por padrão, faltar
 * visivelmente é melhor que entrar em silêncio.
 */
const STATUS_EM_ATIVIDADE: MembroStatus[] = ["ativo", "convite_pendente"];

type FiltroStatus = MembroStatus | typeof EM_ATIVIDADE | "";

/** Aplica o filtro de status, incluindo o valor composto. */
function statusCombina(valor: FiltroStatus, atual: MembroStatus): boolean {
  if (valor === "") return true;
  if (valor === EM_ATIVIDADE) return STATUS_EM_ATIVIDADE.includes(atual);
  return atual === valor;
}

interface FiltrosMembros {
  status: FiltroStatus;
  /**
   * Vocabulário fechado, como `gestor` e ao contrário de `area`/`cargo`: não
   * é rótulo escrito pelo operador, então não precisa do sentinela nem do
   * prefixo `v:`.
   */
  tipo: MembroTipo | "";
  /** Chave = RÓTULO de `rotuloArea`, não o `areaId`. Ver `combina`. */
  area: string;
  /** Chave = RÓTULO de `rotuloCargo`. */
  cargo: string;
  /** Presença, não valor: qualquer membro pode ser gestor. */
  gestor: "" | "com" | "sem";
}

const FILTROS_VAZIOS: FiltrosMembros = {
  status: "",
  tipo: "",
  area: "",
  cargo: "",
  gestor: "",
};

/**
 * O estado inicial: a tabela abre mostrando quem está na organização — ativos e
 * convites pendentes —, com os inativos de fora.
 *
 * Não é `FILTROS_VAZIOS`. A API manda a lista inteira, e abrir com os inativos
 * misturados enche a tabela de linhas em que quase nenhuma ação cabe: um
 * inativo não tem acesso, não aparece no organograma, e o que se faz com ele é
 * reativar. Quem administra chega aqui para trabalhar sobre quem está dentro.
 *
 * O efeito colateral é a faixa "Mostrando N de M" com "Limpar filtros"
 * aparecendo já na primeira renderização, e ela é bem-vinda: esconder linhas
 * sem dizer que estão escondidas é o que não se pode fazer.
 *
 * `FILTROS_VAZIOS` segue sendo o destino de "Limpar filtros" — limpar é tirar
 * TODO filtro, este incluído, e não voltar ao padrão.
 */
const FILTROS_PADRAO: FiltrosMembros = {
  ...FILTROS_VAZIOS,
  status: EM_ATIVIDADE,
};

/**
 * Sentinela do filtro "sem valor definido".
 *
 * Os valores de Área e Cargo são codificados: `""` não filtra, `SEM` exige
 * ausência, e `v:<rótulo>` exige aquele rótulo. O prefixo `v:` não é
 * decoração: nome de área é texto do usuário, e nada impede alguém de criar uma
 * área chamada "sem" — sem o prefixo ela colidiria com o sentinela e o filtro
 * de ausência passaria a filtrar por ela.
 */
const SEM = "sem";

/** Aplica um filtro de valor único ao rótulo resolvido de um membro. */
function combina(valor: string, atual: string): boolean {
  if (valor === "") return true;
  if (valor === SEM) return atual === "";
  return atual === valor.slice(2);
}

/**
 * As opções de um select, com o valor aplicado garantido na lista mesmo que
 * nenhum membro o carregue mais.
 *
 * Sem isto: filtro em Área="Marketing", alguém RENOMEIA a área, o `carregar()`
 * traz o rótulo novo e "Marketing" desaparece das opções — um `<select>` cujo
 * `value` não casa com nenhuma `<option>` exibe a PRIMEIRA ("Todas as áreas"),
 * enquanto o filtro segue aplicado e a tabela vazia. Controle diz uma coisa,
 * tabela diz outra.
 *
 * Mesma correção que `opcoesEstrutura` faz em `MembroFormModal` para a área
 * inativa já escolhida. E de propósito NÃO é um `useEffect` de reset: aquilo
 * escreveria estado durante mudança de dado, brigaria com quem está filtrando,
 * e zeraria tudo em cada montagem — quando `membros` ainda é `[]`.
 */
function comValorAplicado(valores: string[], aplicado: string): string[] {
  if (!aplicado.startsWith("v:")) return valores;
  const chave = aplicado.slice(2);
  return valores.includes(chave) ? valores : [...valores, chave];
}

/**
 * Opções de status, derivadas de `STATUS_MEMBRO` e não de uma lista literal.
 *
 * Aquele arquivo existe para "os três nunca divergirem no rótulo ou na cor", e
 * um status novo tem de nascer aqui em vez de faltar em silêncio. A ordem das
 * chaves é a do enum do Prisma — a mesma do `orderBy` da API, logo a mesma
 * ordem das linhas da tabela.
 *
 * Ao contrário de Área e Cargo, esta lista NÃO sai dos membros carregados: os
 * três status são vocabulário fechado da plataforma, e não dado por tenant.
 * Quem administra espera achar "Inativo" no select e descobrir ali que não há
 * nenhum — se a opção sumisse, "ninguém inativo" ficaria indistinguível de
 * "esta tela não filtra por status".
 */
const OPCOES_STATUS: { id: MembroStatus; rotulo: string }[] = (
  Object.keys(STATUS_MEMBRO) as MembroStatus[]
).map((s) => ({ id: s, rotulo: STATUS_MEMBRO[s].rotulo }));

export function MembrosLista({
  membros,
  carregando,
  erroCarga,
  onRecarregar,
  onAdicionar,
  onAbrirMembro,
  onEditar,
  onDesativar,
  onReativar,
  onCancelarConvite,
  onConverter,
}: {
  membros: Membro[];
  carregando: boolean;
  erroCarga: string | null;
  onRecarregar: () => void;
  onAdicionar: () => void;
  onAbrirMembro: (membro: Membro) => void;
  onEditar: (membro: Membro) => void;
  onDesativar: (membro: Membro) => void;
  onReativar: (membro: Membro) => void;
  onCancelarConvite: (membro: Membro) => void;
  /** Promover um convidado a colaborador da organização. */
  onConverter: (membro: Membro) => void;
}) {
  const [query, setQuery] = useState("");
  const [filtros, setFiltros] = useState<FiltrosMembros>(FILTROS_PADRAO);

  const definir = <K extends keyof FiltrosMembros>(
    chave: K,
    valor: FiltrosMembros[K],
  ) => setFiltros((atuais) => ({ ...atuais, [chave]: valor }));

  const algumFiltroAtivo = Object.values(filtros).some((v) => v !== "");
  const limparTudo = () => {
    setFiltros(FILTROS_VAZIOS);
    setQuery("");
  };

  /**
   * Opções dos selects: os valores DISTINTOS presentes nos membros carregados
   * — e não as áreas e cargos que a página também carrega.
   *
   * É o que mantém o contrato mínimo de um filtro: toda opção rende pelo menos
   * uma linha, e toda linha visível é alcançável por alguma opção. Semear das
   * entidades erraria três vezes — o rótulo legado sem entidade não apareceria
   * (linha inalcançável), a área inativa com membros sairia da lista, e a área
   * ativa sem ninguém ofereceria uma opção que só produz tabela vazia. É o que
   * `Email.tsx` já faz com "Todos os marcadores".
   *
   * A dependência é `[membros]`, NUNCA `filtrados`. Derivar da lista filtrada
   * faria as opções de Cargo encolherem ao escolher uma Área, e o cargo já
   * selecionado sairia da própria lista — o select passaria a exibir "Todos os
   * cargos" com o filtro ainda aplicado.
   */
  const opcoes = useMemo(() => {
    const coletar = (
      ler: (m: Membro) => string,
      inativa: (m: Membro) => boolean,
    ) => {
      const rotulos = new Set<string>();
      const inativos = new Set<string>();
      let temVazio = false;
      for (const m of membros) {
        const r = ler(m);
        if (r === "") {
          temVazio = true;
          continue;
        }
        rotulos.add(r);
        // A anotação "· inativa" sai dos próprios membros, sem prop nova: se
        // alguém com este rótulo carrega uma entidade inativa, a opção avisa —
        // mesma informação que o formulário de membro mostra. Rótulo puramente
        // legado não é entidade nenhuma e fica sem anotação, o que é correto.
        if (inativa(m)) inativos.add(r);
      }
      return {
        valores: [...rotulos].sort((a, b) => a.localeCompare(b, "pt-BR")),
        inativos,
        temVazio,
      };
    };

    return {
      area: coletar(rotuloArea, (m) => m.areaRef?.status === "inativo"),
      cargo: coletar(rotuloCargo, (m) => m.cargoRef?.status === "inativo"),
      temSemGestor: membros.some((m) => m.gestorId == null),
      temComGestor: membros.some((m) => m.gestorId != null),
      // Os dois, e não só `temConvidado`: numa organização 100% de convidados
      // o filtro também não discrimina nada. Segue o modelo do gestor, e não o
      // do status — status não tem guarda porque "ninguém inativo" precisa
      // continuar distinguível de "esta tela não filtra por status".
      temConvidado: membros.some((m) => m.tipo === "convidado"),
      temMembro: membros.some((m) => m.tipo === "membro"),
    };
  }, [membros]);

  const filtrados = useMemo(() => {
    const q = query.trim().toLowerCase();
    // Preserva a identidade do array quando nada estreita a lista — o código
    // original escolheu isso de propósito.
    if (!q && !algumFiltroAtivo) return membros;

    return membros.filter((m) => {
      // Os filtros vêm ANTES da busca: são comparações de igualdade, e
      // adiantá-las evita montar o array de sete campos e chamar sete
      // `toLowerCase()` para linhas que já saíram — isso roda por linha, a
      // cada tecla digitada.
      if (!statusCombina(filtros.status, m.status)) return false;
      if (filtros.tipo !== "" && m.tipo !== filtros.tipo) return false;
      if (!combina(filtros.area, rotuloArea(m))) return false;
      if (!combina(filtros.cargo, rotuloCargo(m))) return false;
      if (filtros.gestor === "com" && m.gestorId == null) return false;
      if (filtros.gestor === "sem" && m.gestorId != null) return false;
      if (!q) return true;

      // O array da busca continua completo, incluindo área, cargo e status —
      // que agora também têm filtro. Enxugá-lo ("área já tem filtro") regride o
      // que o placeholder promete: buscar "Produto" tem de funcionar sem tocar
      // no select.
      return [
        m.nome,
        m.email,
        rotuloArea(m),
        rotuloCargo(m),
        m.gestor?.nome ?? "",
        // Os nomes das duas: com `m.role?.nome` a linha sumiria da busca por
        // causa da segunda role.
        m.roles.map((r) => r.nome).join(" "),
        STATUS_MEMBRO[m.status].rotulo,
        TIPO_MEMBRO[m.tipo].rotulo,
      ].some((campo) => campo.toLowerCase().includes(q));
    });
  }, [membros, query, filtros, algumFiltroAtivo]);

  // Sobre `membros`, e NÃO sobre `filtrados`: este resumo fala da
  // organização, e o "Mostrando N de M" da faixa de filtros fala da tabela.
  // Trocar faria o filtro Status=Inativo renderizar "0 ativos" ao lado de uma
  // tabela cheia de inativos.
  const ativos = membros.filter((m) => m.status === "ativo").length;
  const pendentes = membros.filter(
    (m) => m.status === "convite_pendente",
  ).length;
  const convidados = membros.filter((m) => m.tipo === "convidado").length;

  return (
    <div>
      {/* Busca + resumo + ação primária */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-xs">
          <MagnifyingGlassIcon className="dark:text-dark-300 pointer-events-none absolute top-1/2 left-3 size-4.5 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nome, e-mail, área, cargo, gestor ou role…"
            aria-label="Buscar colaboradores"
            className="form-input dark:border-dark-450 dark:bg-dark-900 dark:text-dark-100 dark:placeholder:text-dark-300 h-9 w-full rounded-lg border border-gray-300 bg-white ps-9 pe-9 text-sm placeholder:text-gray-400"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Limpar busca"
              className="dark:text-dark-300 dark:hover:text-dark-100 absolute top-1/2 right-2 grid size-6 -translate-y-1/2 place-items-center rounded-lg text-gray-400 hover:text-gray-700"
            >
              <XMarkIcon className="size-4" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          <p className="dark:text-dark-300 text-xs-plus text-gray-500">
            {membros.length}{" "}
            {membros.length === 1 ? "colaborador" : "colaboradores"}
            {" · "}
            {ativos} {ativos === 1 ? "ativo" : "ativos"}
            {pendentes > 0 && ` · ${pendentes} com convite pendente`}
            {convidados > 0 &&
              ` · ${convidados} ${convidados === 1 ? "convidado" : "convidados"}`}
          </p>
          <Button
            onClick={onAdicionar}
            color="primary"
            className="h-9 shrink-0 gap-1.5 rounded-lg px-3"
          >
            <PlusIcon className="size-4.5 stroke-[1.5]" />
            Adicionar colaborador
          </Button>
        </div>
      </div>

      {/* Filtros — segundo andar, abaixo da busca.
          Dentro do ramo de carga, ao contrário da faixa acima, que é estável:
          as opções vêm dos membros, então antes da carga este bloco só saberia
          exibir selects vazios. E no ramo de erro `membros` mantém o valor
          anterior (o catch só grava a mensagem), então os selects teriam opções
          sobre uma lista que a tela acabou de declarar que não carregou. */}
      {!carregando && !erroCarga && membros.length > 0 && (
        <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center">
          <div className="flex flex-wrap items-center gap-2">
            {/* Status vem primeiro, a mesma posição que tinha como chips: é o
                filtro mais usado e mantém a ordem de leitura da faixa.
                Sem guarda de "só se tiver o que oferecer", ao contrário dos
                demais — a lista é fixa, não derivada dos membros. */}
            <SelectFiltro
              rotulo="Filtrar por status"
              valor={filtros.status}
              onChange={(v) => definir("status", v as FiltroStatus)}
            >
              <option value="">Todos os status</option>
              {/* O padrão da tela, logo abaixo de "Todos": a lista vai do mais
                  amplo ao mais estreito. */}
              <option value={EM_ATIVIDADE}>Ativos e convites pendentes</option>
              {OPCOES_STATUS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.rotulo}
                </option>
              ))}
            </SelectFiltro>

            {/* Depois de Status e ANTES de Área: o tipo muda o SIGNIFICADO
                de área, cargo e gestor (um convidado não tem nenhum dos três),
                então lê-se antes deles. */}
            {opcoes.temConvidado && opcoes.temMembro && (
              <SelectFiltro
                rotulo="Filtrar por tipo de colaborador"
                valor={filtros.tipo}
                onChange={(v) => definir("tipo", v as MembroTipo | "")}
              >
                <option value="">Membros e convidados</option>
                <option value="membro">{TIPO_MEMBRO.membro.rotulo}</option>
                <option value="convidado">
                  {TIPO_MEMBRO.convidado.rotulo}
                </option>
              </SelectFiltro>
            )}

            {/* Cada select só existe se tiver o que oferecer — mesma guarda do
                "Todos os marcadores" em Email.tsx. */}
            {(opcoes.area.valores.length > 0 || opcoes.area.temVazio) && (
              <SelectFiltro
                rotulo="Filtrar por área"
                valor={filtros.area}
                onChange={(v) => definir("area", v)}
              >
                <option value="">Todas as áreas</option>
                {comValorAplicado(opcoes.area.valores, filtros.area).map(
                  (r) => (
                    <option key={r} value={`v:${r}`}>
                      {r}
                      {opcoes.area.inativos.has(r) ? " · inativa" : ""}
                    </option>
                  ),
                )}
                {/* "Sem …" por ÚLTIMO, ao contrário do formulário de membro,
                    onde é o valor vazio do campo e vem primeiro. Aqui o padrão
                    é "Todas", e a ausência é o balde residual — igual ao
                    travessão que fecha a coluna. */}
                {opcoes.area.temVazio && (
                  <option value={SEM}>Sem área definida</option>
                )}
              </SelectFiltro>
            )}

            {(opcoes.cargo.valores.length > 0 || opcoes.cargo.temVazio) && (
              <SelectFiltro
                rotulo="Filtrar por cargo"
                valor={filtros.cargo}
                onChange={(v) => definir("cargo", v)}
              >
                <option value="">Todos os cargos</option>
                {comValorAplicado(opcoes.cargo.valores, filtros.cargo).map(
                  (r) => (
                    <option key={r} value={`v:${r}`}>
                      {r}
                      {opcoes.cargo.inativos.has(r) ? " · inativo" : ""}
                    </option>
                  ),
                )}
                {opcoes.cargo.temVazio && (
                  <option value={SEM}>Sem cargo definido</option>
                )}
              </SelectFiltro>
            )}

            {/* Gestor é PRESENÇA, não pessoa: qualquer membro pode ser gestor,
                então uma opção por pessoa cresceria sem limite e duplicaria o
                que a aba Hierarquia já responde. "Quem está fora da estrutura?"
                é a pergunta que esta tela faz. */}
            {opcoes.temSemGestor && opcoes.temComGestor && (
              <SelectFiltro
                rotulo="Filtrar por gestor direto"
                valor={filtros.gestor}
                onChange={(v) => definir("gestor", v as "" | "com" | "sem")}
              >
                <option value="">Com e sem gestor</option>
                <option value="com">Com gestor definido</option>
                <option value="sem">Sem gestor definido</option>
              </SelectFiltro>
            )}
          </div>

          {(algumFiltroAtivo || query !== "") && (
            <div className="flex items-center gap-3 lg:ml-auto">
              <p className="dark:text-dark-300 text-xs-plus text-gray-500">
                Mostrando {filtrados.length} de {membros.length}
              </p>
              <button
                type="button"
                onClick={limparTudo}
                className="text-primary-600 dark:text-primary-400 text-xs-plus font-semibold"
              >
                Limpar filtros
              </button>
            </div>
          )}
        </div>
      )}

      {/* Listagem */}
      {carregando ? (
        <div className="mt-8 grid place-items-center py-16">
          <Spinner color="primary" className="size-8" />
        </div>
      ) : erroCarga ? (
        <EstadoVazio
          icon={UsersIcon}
          titulo="Não foi possível carregar os colaboradores"
          hint={erroCarga}
          acao={{ rotulo: "Tentar de novo", onClick: onRecarregar }}
        />
      ) : membros.length === 0 ? (
        /* Antes dos ramos de filtro, e não aninhado dentro deles: uma
           organização sem ninguém nunca deve ler "Nenhum membro com esses
           filtros". */
        <EstadoVazio
          icon={UsersIcon}
          titulo="Nenhum colaborador ainda"
          hint="Adicione as pessoas da sua organização para começar."
          acao={{ rotulo: "Adicionar colaborador", onClick: onAdicionar }}
        />
      ) : filtrados.length === 0 ? (
        algumFiltroAtivo ? (
          <EstadoVazio
            icon={FunnelIcon}
            titulo="Nenhum colaborador com esses filtros"
            hint={
              query
                ? "Ajuste a busca ou os filtros para ver mais pessoas."
                : "Ajuste os filtros para ver mais pessoas."
            }
            // `EstadoVazio` aceita UMA ação, então o rótulo é calculado em vez
            // de virarem dois botões.
            acao={{
              rotulo: query ? "Limpar busca e filtros" : "Limpar filtros",
              onClick: limparTudo,
            }}
          />
        ) : (
          <EstadoVazio
            icon={MagnifyingGlassIcon}
            titulo="Nenhum colaborador encontrado"
            hint="Ajuste a busca para ver mais pessoas."
            acao={{ rotulo: "Limpar busca", onClick: () => setQuery("") }}
          />
        )
      ) : (
        <div className="dark:border-dark-600 mt-5 overflow-x-auto rounded-xl border border-gray-200">
          {/* A largura mínima cresceu a cada versão (3xl → 4xl → 5xl → 6xl):
              entraram as colunas Gestor e Role, e a de Role passou a caber dois
              badges. O contêiner rola na horizontal em vez de comprimir as
              demais. */}
          <Table hoverable className="w-full min-w-6xl text-left">
            <THead>
              <Tr className="dark:border-dark-600 dark:bg-dark-800 border-b border-gray-200 bg-gray-50">
                {[
                  "Colaborador",
                  "E-mail",
                  "Área",
                  "Cargo",
                  "Gestor",
                  "Roles",
                  "Status",
                ].map((titulo) => (
                  <Th
                    key={titulo}
                    className="dark:text-dark-200 py-3 text-xs font-semibold tracking-wider text-gray-500 uppercase"
                  >
                    {titulo}
                  </Th>
                ))}
                <Th className="w-12 py-3">
                  <span className="sr-only">Ações</span>
                </Th>
              </Tr>
            </THead>
            <TBody>
              {filtrados.map((m) => {
                const status = STATUS_MEMBRO[m.status];
                return (
                  <Tr
                    key={m.id}
                    className="dark:border-dark-600 cursor-pointer border-b border-gray-100 last:border-0"
                    onClick={() => onAbrirMembro(m)}
                  >
                    <Td className="py-3">
                      <div className="flex items-center gap-3">
                        <Avatar
                          size={9}
                          name={m.nome}
                          initialColor="auto"
                          classNames={{ display: "text-xs" }}
                        />
                        <span className="dark:text-dark-100 min-w-0 text-sm font-medium text-gray-800">
                          {m.nome}
                        </span>
                        {/* Só para convidado. Um badge que aparecesse sempre
                            seria uma coluna disfarçada — e a tabela já está em
                            `min-w-6xl`. É ele que explica por que Área, Cargo
                            e Gestor vêm vazios nesta linha. */}
                        {m.tipo === "convidado" && (
                          <Badge
                            color={TIPO_MEMBRO.convidado.cor}
                            variant="soft"
                            className="shrink-0 rounded-full"
                          >
                            {TIPO_MEMBRO.convidado.rotulo}
                          </Badge>
                        )}
                      </div>
                    </Td>
                    <Td className="dark:text-dark-200 text-sm-plus py-3 text-gray-600">
                      {m.email}
                    </Td>
                    <Td className="dark:text-dark-200 text-sm-plus py-3 text-gray-600">
                      {rotuloArea(m) || <Vazio />}
                    </Td>
                    <Td className="dark:text-dark-200 text-sm-plus py-3 text-gray-600">
                      {rotuloCargo(m) || <Vazio />}
                    </Td>
                    <Td className="dark:text-dark-200 text-sm-plus py-3 text-gray-600">
                      {m.gestor ? (
                        <span className="flex items-center gap-1.5">
                          {m.gestor.nome}
                          {/* Gestor inativo é sinalizado, não desfeito. */}
                          {m.gestor.status === "inativo" && (
                            <Badge
                              color="warning"
                              variant="soft"
                              className="rounded-full"
                            >
                              inativo
                            </Badge>
                          )}
                        </span>
                      ) : (
                        <Vazio />
                      )}
                    </Td>
                    <Td className="dark:text-dark-200 text-sm-plus py-3 text-gray-600">
                      {m.roles.length > 0 ? (
                        <span className="flex flex-wrap items-center gap-1.5">
                          {m.roles.map((r) => (
                            <Badge
                              key={r.id}
                              color={r.tipo === "sistema" ? "info" : "neutral"}
                              variant="soft"
                              className="rounded-full"
                            >
                              {r.nome}
                            </Badge>
                          ))}
                        </span>
                      ) : (
                        <Vazio />
                      )}
                    </Td>
                    <Td className="py-3">
                      <Badge
                        color={status.cor}
                        variant="soft"
                        className="rounded-full"
                      >
                        {status.rotulo}
                      </Badge>
                    </Td>
                    <Td className="py-3">
                      {/* stopPropagation: a linha inteira abre o drawer. */}
                      <div onClick={(e) => e.stopPropagation()}>
                        <MembroMenu
                          membro={m}
                          onVisualizar={() => onAbrirMembro(m)}
                          onEditar={() => onEditar(m)}
                          onDesativar={() => onDesativar(m)}
                          onReativar={() => onReativar(m)}
                          onCancelarConvite={() => onCancelarConvite(m)}
                          onConverter={() => onConverter(m)}
                        />
                      </div>
                    </Td>
                  </Tr>
                );
              })}
            </TBody>
          </Table>
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------

function Vazio() {
  return <span className="text-gray-400">—</span>;
}

/**
 * Select de um filtro. Casca do "Todos os marcadores" de `Email.tsx`, com
 * `h-9` para alinhar com o input de busca.
 *
 * A borda e o texto em `primary` quando há valor não são enfeite: são o
 * antídoto para "filtro ativo e invisível" sem precisar de badge. Um select
 * cujo rótulo ocioso é "Todas as áreas" não denuncia sozinho que está ligado.
 *
 * Sem rótulo visível ao lado: a opção "todas" carrega o rótulo e o
 * `aria-label` cobre o leitor de tela. Três rótulos na faixa não caberiam.
 */
function SelectFiltro({
  rotulo,
  valor,
  onChange,
  children,
}: {
  rotulo: string;
  valor: string;
  onChange: (valor: string) => void;
  children: React.ReactNode;
}) {
  const ativo = valor !== "";
  return (
    <select
      value={valor}
      onChange={(e) => onChange(e.target.value)}
      aria-label={rotulo}
      className={clsx(
        "form-select dark:bg-dark-800 dark:text-dark-100 text-xs-plus h-9 rounded-lg border bg-white ps-3 pe-8",
        ativo
          ? "border-primary-500 text-primary-600 dark:border-primary-400 dark:text-primary-400"
          : "dark:border-dark-500 border-gray-300 text-gray-600",
      )}
    >
      {children}
    </select>
  );
}

/** Menu de ações da linha. Mesma casca do KeyMenu em AiConnectionCard.tsx. */
function MembroMenu({
  membro,
  onVisualizar,
  onEditar,
  onDesativar,
  onReativar,
  onCancelarConvite,
  onConverter,
}: {
  membro: Membro;
  onVisualizar: () => void;
  onEditar: () => void;
  onDesativar: () => void;
  onReativar: () => void;
  onCancelarConvite: () => void;
  onConverter: () => void;
}) {
  return (
    <Menu as="div" className="relative shrink-0">
      <MenuButton
        aria-label={`Ações de ${membro.nome}`}
        className="dark:text-dark-300 dark:hover:bg-dark-500 dark:hover:text-dark-100 grid size-7 place-items-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
      >
        <EllipsisVerticalIcon className="size-5" />
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
        className="dark:bg-dark-750 dark:border-dark-500 z-100 w-52 rounded-lg border border-gray-200 bg-white py-1 shadow-lg shadow-gray-200/60 outline-hidden dark:shadow-none"
      >
        <ItemMenu icon={EyeIcon} onClick={onVisualizar}>
          Visualizar colaborador
        </ItemMenu>
        <ItemMenu icon={PencilSquareIcon} onClick={onEditar}>
          Editar colaborador
        </ItemMenu>
        {/* Só a promoção: convidado vira colaborador. A direção inversa
            ("Converter em convidado") foi retirada da interface — quem já faz
            parte da organização não é mais rebaixado por aqui.

            Reclassificação, não destruição: sem `destrutivo`, e com o mesmo
            ícone que a transferência de propriedade usa. */}
        {membro.tipo === "convidado" && (
          <ItemMenu icon={ArrowsRightLeftIcon} onClick={onConverter}>
            Converter em colaborador
          </ItemMenu>
        )}
        {membro.status === "inativo" ? (
          <ItemMenu icon={UserPlusIcon} onClick={onReativar}>
            Reativar colaborador
          </ItemMenu>
        ) : (
          <ItemMenu icon={UserMinusIcon} onClick={onDesativar} destrutivo>
            Desativar colaborador
          </ItemMenu>
        )}
        {/* Excluir só existe para convite: quem tem conta vira Inativo. */}
        {!membro.temConta && (
          <ItemMenu icon={TrashIcon} onClick={onCancelarConvite} destrutivo>
            Cancelar convite
          </ItemMenu>
        )}
      </Transition>
    </Menu>
  );
}

function ItemMenu({
  icon: Icon,
  onClick,
  destrutivo,
  children,
}: {
  icon: React.ElementType;
  onClick: () => void;
  destrutivo?: boolean;
  children: React.ReactNode;
}) {
  return (
    <MenuItem>
      {({ focus }) => (
        <button
          type="button"
          onClick={onClick}
          className={clsx(
            "flex w-full items-center gap-2 px-3.5 py-2 text-left text-sm transition-colors",
            destrutivo
              ? "this:error text-this dark:text-this-light"
              : "dark:text-dark-100 text-gray-700",
            focus &&
              (destrutivo
                ? "bg-this/10 dark:bg-this-light/10"
                : "dark:bg-dark-600 bg-gray-100"),
          )}
        >
          <Icon className="size-4" />
          {children}
        </button>
      )}
    </MenuItem>
  );
}

function EstadoVazio({
  icon: Icon,
  titulo,
  hint,
  acao,
}: {
  icon: React.ElementType;
  titulo: string;
  hint: string;
  acao: { rotulo: string; onClick: () => void };
}) {
  return (
    <div className="dark:border-dark-600 mt-8 grid place-items-center rounded-xl border border-dashed border-gray-300 px-6 py-16 text-center">
      <Icon className="dark:text-dark-400 size-10 text-gray-300" />
      <p className="dark:text-dark-100 mt-3 text-sm font-medium text-gray-700">
        {titulo}
      </p>
      <p className="dark:text-dark-300 text-xs-plus mt-1 text-gray-400">
        {hint}
      </p>
      <Button
        variant="outlined"
        className="mt-4 rounded-lg"
        onClick={acao.onClick}
      >
        {acao.rotulo}
      </Button>
    </div>
  );
}
