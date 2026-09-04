import { BriefcaseIcon, Squares2X2Icon } from "@heroicons/react/24/outline";
import type { CopyEstruturaLista } from "./EstruturaLista";
import type { CopyEstruturaForm } from "./EstruturaFormModal";

// ----------------------------------------------------------------------
// Cópia das abas Áreas e Cargos.
//
// A lista e o formulário são um componente só para as duas entidades — elas
// têm os mesmos campos e as mesmas regras, e só mudam em gênero e substantivo.
// Todo o texto vive aqui para as duas abas não divergirem em tom, e para a
// diferença entre elas caber num diff de um arquivo.
//
// Os conceitos continuam separados, e o texto reflete isso:
//   Área   → onde a pessoa está alocada
//   Cargo  → qual posição profissional ocupa
//   Gestor → a quem responde       (campo do membro)
//   Role   → o que pode fazer      (aba Acesso)
// ----------------------------------------------------------------------

export const COPY_AREAS_LISTA: CopyEstruturaLista = {
  titulo: "Áreas",
  subtitulo: "Organize as áreas que compõem a estrutura da organização.",
  colunaNome: "Nome",
  singular: "área",
  plural: "áreas",
  acaoCriar: "Nova área",
  statusRotulo: { ativo: "Ativa", inativo: "Inativa" },
  inativosRotulo: "inativas",
  vazioTitulo: "Nenhuma área cadastrada",
  vazioHint:
    "Crie áreas para organizar onde os membros estão alocados na organização.",
  buscaVaziaTitulo: "Nenhuma área encontrada",
  icon: Squares2X2Icon,
};

export const COPY_CARGOS_LISTA: CopyEstruturaLista = {
  titulo: "Cargos",
  subtitulo: "Gerencie os cargos utilizados na organização.",
  colunaNome: "Cargo",
  singular: "cargo",
  plural: "cargos",
  acaoCriar: "Novo cargo",
  statusRotulo: { ativo: "Ativo", inativo: "Inativo" },
  inativosRotulo: "inativos",
  vazioTitulo: "Nenhum cargo cadastrado",
  vazioHint:
    "Crie cargos para representar as posições profissionais dos membros.",
  buscaVaziaTitulo: "Nenhum cargo encontrado",
  icon: BriefcaseIcon,
};

export const COPY_AREAS_FORM: CopyEstruturaForm = {
  tituloCriar: "Nova área",
  tituloEditar: "Editar área",
  descricaoModal:
    "A área diz onde a pessoa está alocada. Ela não concede permissão nem define a quem o membro responde.",
  placeholderNome: "Produto",
  placeholderDescricao:
    "Responsável pelos produtos e experiências digitais da organização.",
  acaoCriar: "Criar área",
  statusRotulo: { ativo: "Ativa", inativo: "Inativa" },
  avisoDesativar: (membros) =>
    `${membros} ${membros === 1 ? "membro continua" : "membros continuam"} nesta área: desativar não desfaz vínculo nenhum, só tira a área das escolhas novas.`,
};

export const COPY_CARGOS_FORM: CopyEstruturaForm = {
  tituloCriar: "Novo cargo",
  tituloEditar: "Editar cargo",
  descricaoModal:
    "O cargo diz qual posição profissional a pessoa ocupa. Ele não define hierarquia nem concede permissão.",
  placeholderNome: "Product Designer Sênior",
  placeholderDescricao:
    "Responsável pelo design e evolução das experiências dos produtos digitais.",
  acaoCriar: "Criar cargo",
  statusRotulo: { ativo: "Ativo", inativo: "Inativo" },
  avisoDesativar: (membros) =>
    `${membros} ${membros === 1 ? "membro continua" : "membros continuam"} com este cargo: desativar não desfaz vínculo nenhum, só tira o cargo das escolhas novas.`,
};
