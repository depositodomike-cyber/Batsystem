// ----------------------------------------------------------------------
// Configurações de usuário › Perfil Pessoal.
//
// Cadastro gradual por categoria: cada cartão salva só a sua categoria e
// nada é obrigatório. O perfil pertence ao usuário (servidor, por usuário — não
// por organização). Depois de cada salvamento, o mesmo clique grava a
// representação em Markdown no Repositório e atualiza o Grafo
// (ver sincronizar.ts).
// ----------------------------------------------------------------------

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowPathIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";

import { Badge, Button, Spinner } from "@/components/ui";
import { Input, Select, Textarea } from "@/components/ui/Form";
import { DatePicker } from "@/components/shared/form/Datepicker";
import { ConfirmModal } from "@/components/shared/ConfirmModal";
import type { ModalState } from "@/components/shared/ConfirmModal";
import {
  excluirPerfilApi,
  obterPerfilApi,
  salvarCategoriaPerfilApi,
  type CategoriaPerfil,
  type EstiloVidaItem,
  type FormacaoItem,
  type InteresseItem,
  type ObjetivoItem,
  type PerfilBasico,
  type PerfilComunicacao,
  type PerfilDados,
  type PerfilFormacao,
} from "@/services/api/perfil";
import { SectionCard } from "../configuracoes-ui";
import { ItemModal, ListaDeItens, ListaDePalavras, type CampoItem } from "./campos";
import { PASTA_PERFIL } from "./markdown";
import {
  CATEGORIAS_ESTILO,
  HORIZONTES,
  NIVEIS_FORMACAO,
  OPCOES_COMUNICACAO,
  STATUS_OBJETIVO,
  TIPOS_INTERESSE,
  rotuloHorizonte,
  rotuloTipoInteresse,
} from "./rotulos";
import {
  excluirPerfilDoRepositorio,
  mensagemFalhaRepositorio,
  sincronizarPerfilNoRepositorio,
} from "./sincronizar";

// ----------------------------------------------------------------------
// Valores vazios e "está preenchida?"

const BASICO_VAZIO: PerfilBasico = {
  nomeCompleto: "",
  nomePreferido: "",
  nascimento: "",
  cidade: "",
  estado: "",
  pais: "",
  idiomaPrincipal: "",
  outrosIdiomas: [],
};
const FORMACAO_VAZIA: PerfilFormacao = {
  formacoes: [],
  cursos: [],
  certificacoes: [],
  areas: [],
  especialidades: [],
  habilidadesTecnicas: [],
  habilidadesComportamentais: [],
};
const COMUNICACAO_VAZIA: PerfilComunicacao = {
  idiomaResposta: "",
  tom: "",
  detalhe: "",
  profundidade: "",
  apresentacao: "",
  instrucoes: "",
};

function temConteudo(v: unknown): boolean {
  if (typeof v === "string") return v.trim().length > 0;
  if (Array.isArray(v)) return v.length > 0;
  if (v && typeof v === "object") return Object.values(v).some(temConteudo);
  return false;
}

const CATEGORIAS: { id: CategoriaPerfil; titulo: string }[] = [
  { id: "basico", titulo: "Informações básicas" },
  { id: "formacao", titulo: "Formação e conhecimento" },
  { id: "interesses", titulo: "Interesses e atividades" },
  { id: "comunicacao", titulo: "Preferências de comunicação" },
  { id: "objetivos", titulo: "Objetivos pessoais" },
  { id: "estiloVida", titulo: "Estilo de vida e preferências" },
];

const opcoes = (lista: string[]) => lista.map((v) => ({ valor: v, rotulo: v }));
const novoId = () => `item-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

type Salvar = <C extends CategoriaPerfil>(
  categoria: C,
  valor: NonNullable<PerfilDados[C]>,
) => Promise<boolean>;

function BotaoSalvar({ sujo, salvando, onClick }: { sujo: boolean; salvando: boolean; onClick: () => void }) {
  return (
    <div className="mt-5 flex items-center justify-end gap-3">
      {sujo && (
        <span className="dark:text-dark-300 text-xs-plus text-gray-500">Alterações não salvas</span>
      )}
      <Button color="primary" className="gap-1.5 rounded-lg" disabled={!sujo || salvando} onClick={onClick}>
        {salvando && <Spinner color="primary" className="size-4" />}
        Salvar
      </Button>
    </div>
  );
}

/** Rascunho local de uma categoria de campos simples. */
function useRascunho<T>(salvo: T) {
  const [rascunho, setRascunho] = useState<T>(salvo);
  const [base, setBase] = useState<T>(salvo);
  if (salvo !== base) {
    setBase(salvo);
    setRascunho(salvo);
  }
  const sujo = estavel(rascunho) !== estavel(salvo);
  return [rascunho, setRascunho, sujo] as const;
}

/** JSON com chaves em ordem: o Postgres (jsonb) devolve as chaves reordenadas. */
function estavel(v: unknown): string {
  return JSON.stringify(v, (_k, x: unknown) =>
    x && typeof x === "object" && !Array.isArray(x)
      ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b)))
      : x,
  );
}

// ----------------------------------------------------------------------
// Cartões

function CartaoBasico({ valor, salvar }: { valor: PerfilBasico; salvar: Salvar }) {
  const [r, setR, sujo] = useRascunho(valor);
  const [salvando, setSalvando] = useState(false);
  const set = (k: keyof PerfilBasico, v: string) => setR((x) => ({ ...x, [k]: v }));
  return (
    <SectionCard titulo="Informações básicas" descricao="Quem você é e de onde fala. Preencha só o que quiser.">
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Nome completo" value={r.nomeCompleto} onChange={(e) => set("nomeCompleto", e.target.value)} />
        <Input label="Como prefere ser chamado" value={r.nomePreferido} onChange={(e) => set("nomePreferido", e.target.value)} />
        <DatePicker
          label="Data de nascimento"
          placeholder="Escolha uma data"
          value={r.nascimento}
          options={{ dateFormat: "Y-m-d", allowInput: true }}
          onChange={(_: Date[], s: string) => set("nascimento", s)}
        />
        <Input label="Cidade" value={r.cidade} onChange={(e) => set("cidade", e.target.value)} />
        <Input label="Estado" value={r.estado} onChange={(e) => set("estado", e.target.value)} />
        <Input label="País" value={r.pais} onChange={(e) => set("pais", e.target.value)} />
        <Input label="Idioma principal" value={r.idiomaPrincipal} onChange={(e) => set("idiomaPrincipal", e.target.value)} />
        <ListaDePalavras
          rotulo="Outros idiomas"
          valores={r.outrosIdiomas}
          onChange={(v) => setR((x) => ({ ...x, outrosIdiomas: v }))}
        />
      </div>
      <BotaoSalvar
        sujo={sujo}
        salvando={salvando}
        onClick={async () => {
          setSalvando(true);
          await salvar("basico", r);
          setSalvando(false);
        }}
      />
    </SectionCard>
  );
}

const CAMPOS_FORMACAO: CampoItem[] = [
  { chave: "curso", rotulo: "Curso / formação", tipo: "texto", obrigatorio: true, placeholder: "Ex.: Administração" },
  { chave: "nivel", rotulo: "Nível", tipo: "select", opcoes: opcoes(NIVEIS_FORMACAO) },
  { chave: "instituicao", rotulo: "Instituição de ensino", tipo: "texto" },
  { chave: "ano", rotulo: "Ano de conclusão", tipo: "texto", placeholder: "Ex.: 2018" },
];

function CartaoFormacao({ valor, salvar }: { valor: PerfilFormacao; salvar: Salvar }) {
  const [r, setR, sujo] = useRascunho(valor);
  const [salvando, setSalvando] = useState(false);
  const [modal, setModal] = useState<{ item: FormacaoItem | null } | null>(null);
  const setLista = (k: keyof PerfilFormacao, v: string[]) => setR((x) => ({ ...x, [k]: v }));

  const salvarCom = async (formacoes: FormacaoItem[]) => {
    setSalvando(true);
    const ok = await salvar("formacao", { ...r, formacoes });
    setSalvando(false);
    return ok;
  };

  return (
    <SectionCard
      titulo="Formação e conhecimento"
      descricao="Sua trajetória acadêmica e o que você já domina. Ajuda a IA a recomendar o próximo passo."
    >
      <p className="dark:text-dark-100 mb-2 text-sm font-medium text-gray-700">Formação acadêmica</p>
      <ListaDeItens<FormacaoItem & Record<string, string>>
        itens={r.formacoes as (FormacaoItem & Record<string, string>)[]}
        resumo={(x) => ({
          titulo: x.curso,
          detalhe: [x.nivel, x.instituicao, x.ano].filter(Boolean).join(" · "),
        })}
        onAdicionar={() => setModal({ item: null })}
        onEditar={(item) => setModal({ item })}
        onExcluir={(item) => void salvarCom(r.formacoes.filter((x) => x.id !== item.id))}
        rotuloAdicionar="Adicionar formação"
        vazio="Nenhuma formação cadastrada."
      />
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <ListaDePalavras rotulo="Cursos realizados" valores={r.cursos} onChange={(v) => setLista("cursos", v)} />
        <ListaDePalavras rotulo="Certificações" valores={r.certificacoes} onChange={(v) => setLista("certificacoes", v)} />
        <ListaDePalavras rotulo="Áreas de conhecimento" valores={r.areas} onChange={(v) => setLista("areas", v)} />
        <ListaDePalavras rotulo="Especialidades" valores={r.especialidades} onChange={(v) => setLista("especialidades", v)} />
        <ListaDePalavras
          rotulo="Habilidades técnicas"
          valores={r.habilidadesTecnicas}
          onChange={(v) => setLista("habilidadesTecnicas", v)}
        />
        <ListaDePalavras
          rotulo="Habilidades comportamentais"
          valores={r.habilidadesComportamentais}
          onChange={(v) => setLista("habilidadesComportamentais", v)}
        />
      </div>
      <BotaoSalvar sujo={sujo} salvando={salvando} onClick={() => void salvarCom(r.formacoes)} />
      <ItemModal
        aberto={modal != null}
        titulo={modal?.item ? "Editar formação" : "Nova formação"}
        campos={CAMPOS_FORMACAO}
        inicial={(modal?.item as unknown as Record<string, string> | null) ?? null}
        salvando={salvando}
        onClose={() => setModal(null)}
        onSalvar={async (v) => {
          const item = { ...(modal?.item ?? { id: novoId() }), ...v } as FormacaoItem;
          const lista = modal?.item
            ? r.formacoes.map((x) => (x.id === item.id ? item : x))
            : [...r.formacoes, item];
          if (await salvarCom(lista)) setModal(null);
        }}
      />
    </SectionCard>
  );
}

/** Cartão de itens que salvam na hora (interesses, objetivos, estilo de vida). */
function CartaoDeItens<T extends { id: string }>({
  titulo,
  descricao,
  itens,
  campos,
  resumo,
  rotuloAdicionar,
  vazio,
  rotuloItem,
  gravar,
}: {
  titulo: string;
  descricao: string;
  itens: T[];
  campos: CampoItem[];
  resumo: (x: T) => { titulo: string; detalhe?: string };
  rotuloAdicionar: string;
  vazio: string;
  rotuloItem: string;
  gravar: (itens: T[]) => Promise<boolean>;
}) {
  const [modal, setModal] = useState<{ item: T | null } | null>(null);
  const [salvando, setSalvando] = useState(false);
  const executar = async (lista: T[]) => {
    setSalvando(true);
    const ok = await gravar(lista);
    setSalvando(false);
    return ok;
  };
  type Linha = T & Record<string, string>;
  return (
    <SectionCard titulo={titulo} descricao={descricao}>
      <ListaDeItens<Linha>
        itens={itens as Linha[]}
        resumo={resumo as (x: Linha) => { titulo: string; detalhe?: string }}
        onAdicionar={() => setModal({ item: null })}
        onEditar={(item) => setModal({ item })}
        onExcluir={(item) => void executar(itens.filter((x) => x.id !== item.id))}
        rotuloAdicionar={rotuloAdicionar}
        vazio={vazio}
      />
      <ItemModal
        aberto={modal != null}
        titulo={modal?.item ? `Editar ${rotuloItem}` : `Novo ${rotuloItem}`}
        campos={campos}
        inicial={(modal?.item as Record<string, string> | null) ?? null}
        salvando={salvando}
        onClose={() => setModal(null)}
        onSalvar={async (v) => {
          const item = { ...(modal?.item ?? { id: novoId() }), ...v } as T;
          const lista = modal?.item ? itens.map((x) => (x.id === item.id ? item : x)) : [...itens, item];
          if (await executar(lista)) setModal(null);
        }}
      />
    </SectionCard>
  );
}

function CartaoComunicacao({ valor, salvar }: { valor: PerfilComunicacao; salvar: Salvar }) {
  const [r, setR, sujo] = useRascunho(valor);
  const [salvando, setSalvando] = useState(false);
  const set = (k: keyof PerfilComunicacao, v: string) => setR((x) => ({ ...x, [k]: v }));
  const sel = (k: keyof typeof OPCOES_COMUNICACAO, rotulo: string) => (
    <Select
      label={rotulo}
      value={r[k]}
      onChange={(e) => set(k, e.target.value)}
      data={[{ label: "Sem preferência", value: "" }, ...OPCOES_COMUNICACAO[k].map((v) => ({ label: v, value: v }))]}
    />
  );
  return (
    <SectionCard
      titulo="Preferências de comunicação"
      descricao="Como o Oracle deve falar com você. Vale para as conversas e os agentes, salvo instruções específicas de cada agente."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Idioma preferencial de resposta"
          value={r.idiomaResposta}
          placeholder="Ex.: Português"
          onChange={(e) => set("idiomaResposta", e.target.value)}
        />
        {sel("tom", "Tom de comunicação")}
        {sel("detalhe", "Nível de detalhamento")}
        {sel("profundidade", "Objetivas ou aprofundadas")}
        {sel("apresentacao", "Apresentação das informações")}
      </div>
      <Textarea
        className="mt-4"
        label="Outras instruções pessoais para a IA"
        rows={3}
        value={r.instrucoes}
        placeholder="Ex.: sempre traga exemplos práticos; evite jargões."
        onChange={(e) => set("instrucoes", e.target.value)}
      />
      <BotaoSalvar
        sujo={sujo}
        salvando={salvando}
        onClick={async () => {
          setSalvando(true);
          await salvar("comunicacao", r);
          setSalvando(false);
        }}
      />
    </SectionCard>
  );
}

// ----------------------------------------------------------------------
// Seção

type EstadoRepo =
  | { tipo: "ocioso" }
  | { tipo: "sincronizando" }
  | { tipo: "ok"; em: Date }
  | { tipo: "falha"; msg: string };

export function PerfilPessoalSection() {
  const [dados, setDados] = useState<PerfilDados | null>(null);
  const [erroCarga, setErroCarga] = useState(false);
  const [repo, setRepo] = useState<EstadoRepo>({ tipo: "ocioso" });
  const [confirmar, setConfirmar] = useState(false);
  const [estadoConfirm, setEstadoConfirm] = useState<ModalState>("pending");
  const [excluindo, setExcluindo] = useState(false);

  useEffect(() => {
    let vivo = true;
    obterPerfilApi()
      .then((r) => vivo && setDados(r.dados))
      .catch(() => vivo && setErroCarga(true));
    return () => {
      vivo = false;
    };
  }, []);

  const sincronizar = async (d: PerfilDados) => {
    setRepo({ tipo: "sincronizando" });
    const r = await sincronizarPerfilNoRepositorio(d);
    setRepo(r.ok ? { tipo: "ok", em: new Date() } : { tipo: "falha", msg: mensagemFalhaRepositorio(r.reason) });
  };

  const salvar: Salvar = async (categoria, valor) => {
    try {
      const r = await salvarCategoriaPerfilApi(categoria, valor);
      setDados(r.dados);
      toast.success("Perfil salvo.");
      void sincronizar(r.dados);
      return true;
    } catch {
      toast.error("Não foi possível salvar o perfil.");
      return false;
    }
  };

  const excluir = async () => {
    setExcluindo(true);
    try {
      const noRepo = await excluirPerfilDoRepositorio();
      await excluirPerfilApi();
      setDados({});
      setRepo(
        noRepo.ok
          ? { tipo: "ocioso" }
          : { tipo: "falha", msg: `Perfil excluído, mas os arquivos do Repositório não foram apagados: ${mensagemFalhaRepositorio(noRepo.reason)}` },
      );
      setEstadoConfirm("success");
    } catch {
      setEstadoConfirm("error");
    } finally {
      setExcluindo(false);
    }
  };

  const preenchidas = useMemo(
    () => new Set(CATEGORIAS.filter((c) => temConteudo(dados?.[c.id])).map((c) => c.id)),
    [dados],
  );

  if (erroCarga)
    return (
      <SectionCard titulo="Perfil Pessoal" descricao="Não foi possível carregar o seu perfil agora.">
        <Button variant="outlined" className="rounded-lg" onClick={() => window.location.reload()}>
          Tentar de novo
        </Button>
      </SectionCard>
    );
  if (!dados)
    return (
      <div className="flex justify-center py-16">
        <Spinner color="primary" className="size-6" />
      </div>
    );

  const b = dados.basico;
  const nome = b?.nomePreferido || b?.nomeCompleto;
  const local = [b?.cidade, b?.estado, b?.pais].filter(Boolean).join(", ");
  const idiomas = [b?.idiomaPrincipal, ...(b?.outrosIdiomas ?? [])].filter(Boolean).join(", ");

  return (
    <div className="space-y-6">
      {/* Resumo */}
      <SectionCard
        titulo="Perfil Pessoal"
        descricao="O que o Oracle sabe sobre você. É só seu: vale em qualquer organização e não é compartilhado com ninguém."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <p className="dark:text-dark-50 text-lg font-semibold text-gray-800">{nome || "Seu nome ainda não foi informado"}</p>
            {local && <p className="dark:text-dark-300 text-sm text-gray-500">{local}</p>}
            {idiomas && <p className="dark:text-dark-300 text-sm text-gray-500">Idiomas: {idiomas}</p>}
            <p className="dark:text-dark-300 text-xs-plus pt-1 text-gray-500">
              {dados.formacao?.habilidadesTecnicas.length ?? 0} habilidades técnicas ·{" "}
              {dados.interesses?.itens.length ?? 0} interesses · {dados.objetivos?.itens.length ?? 0} objetivos
            </p>
          </div>
          <ul className="flex flex-wrap content-start gap-2">
            {CATEGORIAS.map((c) => (
              <li key={c.id}>
                <a href={`#perfil-${c.id}`}>
                  <Badge variant="soft" color={preenchidas.has(c.id) ? "success" : "neutral"} className="gap-1 rounded-full">
                    {preenchidas.has(c.id) && <CheckCircleIcon className="size-3.5" />}
                    {c.titulo} · {preenchidas.has(c.id) ? "Preenchida" : "Pendente"}
                  </Badge>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </SectionCard>

      <div id="perfil-basico">
        <CartaoBasico valor={dados.basico ?? BASICO_VAZIO} salvar={salvar} />
      </div>
      <div id="perfil-formacao">
        <CartaoFormacao valor={dados.formacao ?? FORMACAO_VAZIA} salvar={salvar} />
      </div>
      <div id="perfil-interesses">
        <CartaoDeItens<InteresseItem>
          titulo="Interesses e atividades"
          descricao="Assuntos e atividades que fazem parte da sua vida — e o que você quer aprender ou experimentar."
          itens={dados.interesses?.itens ?? []}
          campos={[
            { chave: "nome", rotulo: "Interesse ou atividade", tipo: "texto", obrigatorio: true, placeholder: "Ex.: Fotografia" },
            {
              chave: "tipo",
              rotulo: "Tipo",
              tipo: "select",
              opcoes: TIPOS_INTERESSE.map((t) => ({ valor: t.valor, rotulo: t.rotulo })),
            },
            { chave: "categoria", rotulo: "Categoria", tipo: "texto", placeholder: "Ex.: Arte, Esporte, Tecnologia" },
          ]}
          resumo={(x) => ({ titulo: x.nome, detalhe: [rotuloTipoInteresse(x.tipo), x.categoria].filter(Boolean).join(" · ") })}
          rotuloAdicionar="Adicionar interesse"
          vazio="Nenhum interesse cadastrado."
          rotuloItem="interesse"
          gravar={(itens) => salvar("interesses", { itens })}
        />
      </div>
      <div id="perfil-comunicacao">
        <CartaoComunicacao valor={dados.comunicacao ?? COMUNICACAO_VAZIA} salvar={salvar} />
      </div>
      <div id="perfil-objetivos">
        <CartaoDeItens<ObjetivoItem>
          titulo="Objetivos pessoais"
          descricao="O que você quer alcançar. A IA considera seus objetivos ao sugerir cursos, oportunidades e prioridades."
          itens={dados.objetivos?.itens ?? []}
          campos={[
            { chave: "titulo", rotulo: "Título", tipo: "texto", obrigatorio: true },
            { chave: "descricao", rotulo: "Descrição", tipo: "textarea" },
            { chave: "categoria", rotulo: "Categoria", tipo: "texto", placeholder: "Ex.: Carreira, Saúde, Finanças" },
            { chave: "horizonte", rotulo: "Horizonte", tipo: "select", opcoes: HORIZONTES.map((h) => ({ valor: h.valor, rotulo: h.rotulo })) },
            { chave: "data", rotulo: "Data desejada de conclusão", tipo: "data" },
            { chave: "status", rotulo: "Status", tipo: "select", opcoes: opcoes(STATUS_OBJETIVO) },
            { chave: "observacoes", rotulo: "Observações", tipo: "textarea" },
          ]}
          resumo={(x) => ({
            titulo: x.titulo,
            detalhe: [x.categoria, rotuloHorizonte(x.horizonte), x.status, x.data].filter(Boolean).join(" · "),
          })}
          rotuloAdicionar="Adicionar objetivo"
          vazio="Nenhum objetivo cadastrado."
          rotuloItem="objetivo"
          gravar={(itens) => salvar("objetivos", { itens })}
        />
      </div>
      <div id="perfil-estiloVida">
        <CartaoDeItens<EstiloVidaItem>
          titulo="Estilo de vida e preferências"
          descricao="Consumo, entretenimento, viagens, alimentação, compras, estilo — o que ajudar a contextualizar recomendações."
          itens={dados.estiloVida?.itens ?? []}
          campos={[
            { chave: "categoria", rotulo: "Categoria", tipo: "select", opcoes: opcoes(CATEGORIAS_ESTILO) },
            { chave: "texto", rotulo: "Preferência", tipo: "textarea", obrigatorio: true, placeholder: "Ex.: prefiro viagens de natureza a cidades grandes." },
          ]}
          resumo={(x) => ({ titulo: x.texto, detalhe: x.categoria })}
          rotuloAdicionar="Adicionar preferência"
          vazio="Nenhuma preferência cadastrada."
          rotuloItem="preferência"
          gravar={(itens) => salvar("estiloVida", { itens })}
        />
      </div>

      {/* Repositório e exclusão */}
      <SectionCard
        titulo="Repositório e Grafo"
        descricao={`O perfil vira arquivos Markdown em ${PASTA_PERFIL}/ no Repositório, entra no Grafo e fica disponível para a IA. A sincronização acontece a cada salvamento.`}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="dark:text-dark-200 text-xs-plus flex items-center gap-2 text-gray-600">
            {repo.tipo === "sincronizando" && (
              <>
                <Spinner color="primary" className="size-4" /> Sincronizando com o Repositório…
              </>
            )}
            {repo.tipo === "ok" && (
              <>
                <CheckCircleIcon className="text-success size-4.5" /> Sincronizado às{" "}
                {repo.em.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}.
              </>
            )}
            {repo.tipo === "falha" && (
              <>
                <ExclamationTriangleIcon className="text-warning size-4.5 shrink-0" /> Pendente: {repo.msg}
              </>
            )}
            {repo.tipo === "ocioso" && <>Salve uma categoria ou sincronize agora.</>}
          </p>
          <div className="flex shrink-0 gap-2">
            <Button
              variant="outlined"
              className="gap-1.5 rounded-lg"
              disabled={repo.tipo === "sincronizando"}
              onClick={() => void sincronizar(dados)}
            >
              <ArrowPathIcon className="size-4.5" />
              Sincronizar com o Repositório
            </Button>
            <Button
              variant="outlined"
              color="error"
              className="gap-1.5 rounded-lg"
              onClick={() => {
                setEstadoConfirm("pending");
                setConfirmar(true);
              }}
            >
              <TrashIcon className="size-4.5" />
              Excluir perfil
            </Button>
          </div>
        </div>
      </SectionCard>

      <ConfirmModal
        show={confirmar}
        onClose={() => {
          setConfirmar(false);
          setEstadoConfirm("pending");
        }}
        onOk={() => void excluir()}
        confirmLoading={excluindo}
        state={estadoConfirm}
        messages={{
          pending: {
            title: "Excluir o Perfil Pessoal?",
            description: `Apaga todas as informações do perfil, os arquivos em ${PASTA_PERFIL}/ e as ligações dele no Grafo. O restante do Repositório não é alterado. Não dá para desfazer.`,
            actionText: "Excluir",
          },
          success: {
            title: "Perfil excluído",
            description: "As informações do seu perfil foram apagadas.",
            actionText: "Fechar",
          },
          error: {
            title: "Não foi possível excluir",
            description: "Tente novamente em instantes.",
            actionText: "Fechar",
          },
        }}
      />
    </div>
  );
}
