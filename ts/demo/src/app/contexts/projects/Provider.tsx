import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { useDisclosure } from "@/hooks";
import {
  ProjectsContext,
  type NewProject,
  type Project,
  type ProjectEmail,
  type ProjectSlackItem,
  type ProjectsContextValue,
} from "./context";

// ----------------------------------------------------------------------

const STORAGE_KEY = "ceo-os:projects";

function loadProjects(): Project[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Normaliza entradas (inclui versões antigas sem os campos atuais).
    return parsed.map(
      (p): Project => ({
        id: String(p?.id ?? createId()),
        product: String(p?.product ?? ""),
        title: String(p?.title ?? ""),
        instructions: String(p?.instructions ?? ""),
        connectorCodes: Array.isArray(p?.connectorCodes) ? p.connectorCodes : [],
        links: Array.isArray(p?.links) ? p.links : [],
        files: Array.isArray(p?.files) ? p.files : [],
        memoryIds: Array.isArray(p?.memoryIds) ? p.memoryIds : [],
        emails: Array.isArray(p?.emails) ? p.emails : [],
        slack: Array.isArray(p?.slack) ? p.slack : [],
      }),
    );
  } catch {
    return [];
  }
}

function createId(): string {
  return `prj_${Date.now().toString(36)}${Math.random()
    .toString(36)
    .slice(2, 7)}`;
}

export function ProjectsProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<Project[]>(loadProjects);
  const [isCreateOpen, { open: openCreate, close: closeCreate }] =
    useDisclosure(false);

  // Persistência: a falha PRECISA aparecer. Silenciosa, o item salvo continua
  // na tela e some no próximo carregamento — o usuário vê "salvou" e depois
  // não encontra nada. A cota estoura de verdade quando e-mails inteiros são
  // guardados em grupos.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
    } catch {
      toast.error("Não foi possível guardar os grupos neste navegador.", {
        description:
          "O armazenamento local está cheio (ou bloqueado, como em janela anônima). " +
          "Remova itens antigos de um grupo e tente de novo.",
      });
    }
  }, [projects]);

  const addProject = useCallback((data: NewProject) => {
    const project: Project = { id: createId(), ...data, emails: [], slack: [] };
    setProjects((prev) => [...prev, project]);
    return project;
  }, []);

  // A decisão sai do estado atual (e não de dentro do updater, que o React
  // executa depois) para poder devolver na hora se gravou ou não.
  const addEmailToProject = useCallback(
    (projectId: string, email: Omit<ProjectEmail, "salvoEm">) => {
      const alvo = projects.find((p) => p.id === projectId);
      if (!alvo || alvo.emails.some((e) => e.id === email.id)) return false;
      setProjects((prev) =>
        prev.map((p) =>
          p.id === projectId
            ? { ...p, emails: [{ ...email, salvoEm: Date.now() }, ...p.emails] }
            : p,
        ),
      );
      return true;
    },
    [projects],
  );

  const removeEmailFromProject = useCallback(
    (projectId: string, emailId: string) => {
      setProjects((prev) =>
        prev.map((p) =>
          p.id === projectId
            ? { ...p, emails: p.emails.filter((e) => e.id !== emailId) }
            : p,
        ),
      );
    },
    [],
  );

  const addSlackToProject = useCallback(
    (projectId: string, item: Omit<ProjectSlackItem, "salvoEm">) => {
      setProjects((prev) =>
        prev.map((p) =>
          p.id === projectId && !p.slack.some((s) => s.id === item.id)
            ? { ...p, slack: [{ ...item, salvoEm: Date.now() }, ...p.slack] }
            : p,
        ),
      );
    },
    [],
  );

  const removeSlackFromProject = useCallback(
    (projectId: string, itemId: string) => {
      setProjects((prev) =>
        prev.map((p) =>
          p.id === projectId
            ? { ...p, slack: p.slack.filter((s) => s.id !== itemId) }
            : p,
        ),
      );
    },
    [],
  );

  const removeProject = useCallback((id: string) => {
    setProjects((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const renameProject = useCallback((id: string, title: string) => {
    setProjects((prev) =>
      prev.map((p) => (p.id === id ? { ...p, title } : p)),
    );
  }, []);

  const getProject = useCallback(
    (id: string) => projects.find((p) => p.id === id),
    [projects],
  );

  const projectsByProduct = useCallback(
    (product: string) => projects.filter((p) => p.product === product),
    [projects],
  );

  const value = useMemo<ProjectsContextValue>(
    () => ({
      projects,
      projectsByProduct,
      addProject,
      removeProject,
      renameProject,
      getProject,
      addEmailToProject,
      removeEmailFromProject,
      addSlackToProject,
      removeSlackFromProject,
      isCreateOpen,
      openCreate,
      closeCreate,
    }),
    [
      projects,
      projectsByProduct,
      addProject,
      removeProject,
      renameProject,
      getProject,
      addEmailToProject,
      removeEmailFromProject,
      addSlackToProject,
      removeSlackFromProject,
      isCreateOpen,
      openCreate,
      closeCreate,
    ],
  );

  return <ProjectsContext value={value}>{children}</ProjectsContext>;
}
