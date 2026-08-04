import { useEffect, useState } from "react";
import {
  CheckIcon,
  ChevronDownIcon,
  ClipboardDocumentIcon,
  ExclamationTriangleIcon,
  KeyIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import clsx from "clsx";

import { Button, Badge } from "@/components/ui";
import { useAuthContext } from "@/app/contexts/auth/context";
import { JWT_HOST_API } from "@/configs/auth";
import {
  createMcpKeyApi,
  listMcpKeysApi,
  revokeMcpKeyApi,
  type CreatedMcpKey,
  type McpKey,
} from "@/services/api/mcpKeys";

function errMessage(err: unknown): string {
  if (typeof err === "string") return err;
  if (err && typeof err === "object" && "message" in err) {
    const m = (err as { message: unknown }).message;
    if (typeof m === "string") return m;
  }
  return "Não foi possível concluir. Tente novamente.";
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/**
 * Chaves de acesso ao servidor MCP da empresa. Visível só para admin/owner
 * (mesma regra do backend). A chave crua aparece UMA única vez, na criação.
 */
export function McpKeysCard() {
  const { user } = useAuthContext();
  const isAdmin = user?.role === "admin" || user?.role === "owner";

  const [keys, setKeys] = useState<McpKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [nome, setNome] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedMcpKey | null>(null);
  const [copied, setCopied] = useState(false);
  // Inicia minimizado: o card só exibe a barra de título até o usuário expandir.
  const [open, setOpen] = useState(false);

  const mcpUrl = `${JWT_HOST_API.replace(/\/$/, "")}/mcp`;

  useEffect(() => {
    if (!isAdmin) return;
    let alive = true;
    listMcpKeysApi()
      .then((items) => {
        if (alive) setKeys(items);
      })
      .catch(() => {
        /* sem API no ar → lista vazia */
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [isAdmin]);

  if (!isAdmin) return null;

  const onCreate = async () => {
    setError(null);
    if (!nome.trim()) {
      setError("Dê um nome à chave (ex.: Claude do CEO).");
      return;
    }
    setSaving(true);
    try {
      const key = await createMcpKeyApi(nome.trim());
      setCreated(key);
      setCopied(false);
      setNome("");
      setKeys((prev) => [
        {
          id: key.id,
          nome: key.nome,
          last4: key.last4,
          criadoEm: key.criadoEm,
          lastUsedAt: key.lastUsedAt,
        },
        ...prev,
      ]);
    } catch (err) {
      setError(errMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const onRevoke = async (key: McpKey) => {
    if (
      !window.confirm(
        `Revogar a chave "${key.nome}"? Clientes MCP que a usam perderão o acesso imediatamente.`,
      )
    ) {
      return;
    }
    setError(null);
    try {
      await revokeMcpKeyApi(key.id);
      setKeys((prev) => prev.filter((k) => k.id !== key.id));
      if (created?.id === key.id) setCreated(null);
    } catch (err) {
      setError(errMessage(err));
    }
  };

  const onCopy = async () => {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.key);
      setCopied(true);
    } catch {
      /* navegador sem clipboard → o usuário pode selecionar o texto */
    }
  };

  return (
    <div className="dark:border-dark-500 dark:bg-dark-700 mb-6 rounded-2xl border border-gray-200 bg-white px-5 py-2">
      <div className="flex items-start gap-3">
        <span className="bg-primary-50 text-primary-600 dark:bg-primary-500/10 dark:text-primary-400 grid size-7 shrink-0 place-items-center rounded-lg">
          <KeyIcon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className="flex w-full items-center gap-2 text-left"
          >
            <h3 className="dark:text-dark-100 text-base font-semibold text-gray-800">
              Servidor MCP
            </h3>
            {keys.length > 0 && (
              <Badge color="success" variant="soft" className="rounded-full">
                {keys.length} {keys.length === 1 ? "chave ativa" : "chaves ativas"}
              </Badge>
            )}
            <ChevronDownIcon
              className={clsx(
                "dark:text-dark-300 ml-auto size-5 shrink-0 text-gray-400 transition-transform duration-200",
                open && "rotate-180",
              )}
            />
          </button>

          {!open ? null : (
            <>
          <p className="dark:text-dark-300 mt-2 text-sm text-gray-500">
            Conecte agentes externos (Claude, Cursor, VS Code…) aos conectores
            da sua empresa via MCP. Endpoint:{" "}
            <code className="dark:bg-dark-600 dark:text-dark-100 rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-700">
              {mcpUrl}
            </code>
          </p>

          {/* Chave recém-criada — única exibição da chave crua */}
          {created && (
            <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-500/30 dark:bg-amber-500/10">
              <div className="flex items-center gap-2">
                <ExclamationTriangleIcon className="size-4.5 shrink-0 text-amber-500" />
                <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                  Copie agora — esta chave não será exibida novamente.
                </p>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <code className="dark:bg-dark-800 dark:text-dark-50 min-w-0 flex-1 truncate rounded-lg bg-white px-3 py-2 font-mono text-xs text-gray-800">
                  {created.key}
                </code>
                <Button
                  onClick={onCopy}
                  className="h-9 shrink-0 gap-1.5 rounded-lg text-xs"
                  color={copied ? "success" : "primary"}
                >
                  {copied ? (
                    <>
                      <CheckIcon className="size-4" /> Copiado
                    </>
                  ) : (
                    <>
                      <ClipboardDocumentIcon className="size-4" /> Copiar
                    </>
                  )}
                </Button>
              </div>
              <Button
                variant="flat"
                className="mt-2 h-7 rounded-lg px-2 text-xs"
                onClick={() => setCreated(null)}
              >
                Já copiei, ocultar
              </Button>
            </div>
          )}

          {/* Lista de chaves */}
          {loading ? (
            <p className="dark:text-dark-300 mt-4 text-sm text-gray-400">
              Carregando…
            </p>
          ) : keys.length > 0 ? (
            <ul className="dark:divide-dark-500 dark:border-dark-500 mt-4 divide-y divide-gray-100 rounded-xl border border-gray-100">
              {keys.map((k) => (
                <li
                  key={k.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5"
                >
                  <div className="min-w-0 text-sm">
                    <span className="dark:text-dark-100 font-medium text-gray-700">
                      {k.nome}
                    </span>
                    <span className="dark:text-dark-300 ml-2 font-mono text-xs text-gray-400">
                      bcl_mcp_…{k.last4}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="dark:text-dark-300 text-xs text-gray-400">
                      criada em {formatDate(k.criadoEm)}
                      {k.lastUsedAt
                        ? ` · usada em ${formatDate(k.lastUsedAt)}`
                        : " · nunca usada"}
                    </span>
                    <Button
                      variant="flat"
                      color="error"
                      isIcon
                      className="size-7 rounded-full"
                      aria-label={`Revogar chave ${k.nome}`}
                      onClick={() => onRevoke(k)}
                    >
                      <TrashIcon className="size-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="dark:text-dark-300 mt-4 text-sm text-gray-400">
              Nenhuma chave ativa. Gere uma chave para conectar um cliente MCP.
            </p>
          )}

          {error && <p className="mt-3 text-sm text-error">{error}</p>}

          {/* Criar nova chave */}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void onCreate();
              }}
              placeholder="Nome da chave (ex.: Claude do CEO)"
              maxLength={80}
              className="form-input dark:border-dark-450 dark:bg-dark-700 w-full max-w-xs rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            <Button color="primary" onClick={onCreate} disabled={saving}>
              {saving ? "Gerando…" : "Gerar chave"}
            </Button>
          </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
