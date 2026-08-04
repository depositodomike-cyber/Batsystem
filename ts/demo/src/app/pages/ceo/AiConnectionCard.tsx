import { useEffect, useMemo, useState } from "react";
import {
  CpuChipIcon,
  PhotoIcon,
  VideoCameraIcon,
  CheckCircleIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/outline";

import { Button } from "@/components/ui";
import {
  getAiConnection,
  getAiProviders,
  removeAiConnection,
  setAiConnection,
} from "@/services/api/aiConnection";
import {
  getAiMediaConnection,
  getAiMediaProviders,
  removeAiMediaConnection,
  setAiMediaConnection,
} from "@/services/api/aiMediaConnection";

// ----------------------------------------------------------------------
// Tipos genéricos compartilhados pelas três modalidades.

interface ModelInfo {
  id: string;
  name: string;
}
interface ProviderInfo {
  id: string;
  name: string;
  models: ModelInfo[];
}
interface Connection {
  provider: string;
  model: string;
  keyLast4: string;
}

/**
 * Adapter de persistência de uma modalidade. Texto usa o backend real
 * (`/ai/connection`); Imagem e Vídeo usam persistência local (BYOK demo).
 */
interface ModalityAdapter {
  getProviders(): Promise<ProviderInfo[]>;
  getConnection(): Promise<Connection | null>;
  save(input: {
    provider: string;
    model: string;
    apiKey: string;
  }): Promise<Connection>;
  remove(): Promise<void>;
}

interface Modality {
  id: "text" | "image" | "video";
  label: string;
  icon: React.ElementType;
  /** Placeholder da chave (dica do formato esperado pelo provedor). */
  keyHint: string;
  adapter: ModalityAdapter;
}

const MODALITIES: Modality[] = [
  {
    id: "text",
    label: "Texto",
    icon: CpuChipIcon,
    keyHint: "sk-…",
    adapter: {
      getProviders: () => getAiProviders(),
      getConnection: () => getAiConnection(),
      save: (input) =>
        setAiConnection({
          provider: input.provider as "anthropic" | "openai",
          model: input.model,
          apiKey: input.apiKey,
        }),
      remove: () => removeAiConnection(),
    },
  },
  {
    id: "image",
    label: "Imagem",
    icon: PhotoIcon,
    keyHint: "sk-… / chave do provedor",
    adapter: {
      getProviders: () => getAiMediaProviders("image"),
      getConnection: () => getAiMediaConnection("image"),
      save: (input) => setAiMediaConnection("image", input),
      remove: () => removeAiMediaConnection("image"),
    },
  },
  {
    id: "video",
    label: "Vídeo",
    icon: VideoCameraIcon,
    keyHint: "chave do provedor",
    adapter: {
      getProviders: () => getAiMediaProviders("video"),
      getConnection: () => getAiMediaConnection("video"),
      save: (input) => setAiMediaConnection("video", input),
      remove: () => removeAiMediaConnection("video"),
    },
  },
];

function errMessage(err: unknown): string {
  if (typeof err === "string") return err;
  if (err && typeof err === "object" && "message" in err) {
    const m = (err as { message: unknown }).message;
    if (typeof m === "string") return m;
  }
  return "Não foi possível concluir. Tente novamente.";
}

/**
 * Conexões de IA do tenant (BYOK), separadas por modalidade: Texto, Imagem e
 * Vídeo. As três seções ficam sempre visíveis, empilhadas; cada uma lista
 * provedores, mostra a conexão atual e permite conectar/trocar/desconectar.
 * A chave nunca volta do servidor.
 */
export function AiConnectionCard() {
  // Conexão de cada modalidade, só para exibir o selo "Conectado" no título.
  const [connected, setConnected] = useState<Record<string, boolean>>({});

  const setModalityConnected = (id: string, value: boolean) =>
    setConnected((prev) => ({ ...prev, [id]: value }));

  return (
    <div className="dark:divide-dark-500 divide-y divide-gray-200">
      {MODALITIES.map((m) => (
        <section key={m.id} className="py-5 first:pt-0 last:pb-0">
          <div className="flex items-center gap-2">
            <span className="bg-primary-50 text-primary-600 dark:bg-primary-500/10 dark:text-primary-400 grid size-7 shrink-0 place-items-center rounded-lg">
              <m.icon className="size-4.5" />
            </span>
            <h4 className="dark:text-dark-100 text-sm font-semibold text-gray-800">
              {m.label}
            </h4>
            {connected[m.id] && (
              <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
                <CheckCircleIcon className="size-3.5" />
                Conectado
              </span>
            )}
          </div>
          <ModalityPanel
            modality={m}
            onConnectionChange={(v) => setModalityConnected(m.id, v)}
          />
        </section>
      ))}
    </div>
  );
}

// ----------------------------------------------------------------------

function ModalityPanel({
  modality,
  onConnectionChange,
}: {
  modality: Modality;
  onConnectionChange: (connected: boolean) => void;
}) {
  const { adapter, keyHint } = modality;

  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [connection, setConnection] = useState<Connection | null>(null);
  const [loading, setLoading] = useState(true);

  const [providerId, setProviderId] = useState("");
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [provs, conn] = await Promise.all([
          adapter.getProviders(),
          adapter.getConnection(),
        ]);
        if (!alive) return;
        setProviders(provs);
        setConnection(conn);
        onConnectionChange(!!conn);
        const initialProvider = conn?.provider ?? provs[0]?.id ?? "";
        setProviderId(initialProvider);
        const models =
          provs.find((p) => p.id === initialProvider)?.models ?? [];
        setModel(conn?.model ?? models[0]?.id ?? "");
      } catch {
        /* mantém estado vazio; o usuário pode tentar novamente */
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
    // Só na montagem do painel.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const models = useMemo(
    () => providers.find((p) => p.id === providerId)?.models ?? [],
    [providers, providerId],
  );

  const providerName = (id: string) =>
    providers.find((p) => p.id === id)?.name ?? id;

  const onChangeProvider = (id: string) => {
    setProviderId(id);
    setModel(providers.find((p) => p.id === id)?.models[0]?.id ?? "");
  };

  const onSave = async () => {
    setError(null);
    setSuccess(null);
    if (!apiKey.trim()) {
      setError("Cole a chave de API do provedor.");
      return;
    }
    setSaving(true);
    try {
      const saved = await adapter.save({ provider: providerId, model, apiKey });
      setConnection(saved);
      onConnectionChange(true);
      setApiKey("");
      setSuccess(`${modality.label} conectado com sucesso.`);
    } catch (err) {
      setError(errMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const onDisconnect = async () => {
    setError(null);
    setSuccess(null);
    setSaving(true);
    try {
      await adapter.remove();
      setConnection(null);
      onConnectionChange(false);
      setSuccess(`${modality.label} desconectado.`);
    } catch (err) {
      setError(errMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <p className="dark:text-dark-300 mt-4 text-sm text-gray-400">
        Carregando…
      </p>
    );
  }

  return (
    <div className="mt-4">
      {connection && (
        <div className="dark:border-dark-500 dark:bg-dark-600 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
          <div className="text-sm">
            <span className="dark:text-dark-100 font-medium text-gray-700">
              {providerName(connection.provider)} · {connection.model}
            </span>
            <span className="dark:text-dark-300 ml-2 text-gray-400">
              chave ••••{connection.keyLast4}
            </span>
          </div>
          <Button
            onClick={onDisconnect}
            disabled={saving}
            className="dark:border-dark-450 border border-gray-300 text-xs"
          >
            Desconectar
          </Button>
        </div>
      )}

      {/* Formulário conectar / trocar */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="text-sm">
          <span className="dark:text-dark-200 mb-1 block font-medium text-gray-600">
            Provedor
          </span>
          <select
            value={providerId}
            onChange={(e) => onChangeProvider(e.target.value)}
            className="form-select dark:border-dark-450 dark:bg-dark-700 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm">
          <span className="dark:text-dark-200 mb-1 block font-medium text-gray-600">
            Modelo
          </span>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="form-select dark:border-dark-450 dark:bg-dark-700 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm">
          <span className="dark:text-dark-200 mb-1 block font-medium text-gray-600">
            Chave de API
          </span>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={connection ? "Cole para substituir" : keyHint}
            autoComplete="off"
            className="form-input dark:border-dark-450 dark:bg-dark-700 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </label>
      </div>

      {error && <p className="mt-3 text-sm text-error">{error}</p>}
      {success && <p className="mt-3 text-sm text-success">{success}</p>}

      <div className="mt-4 flex items-center gap-3">
        <Button color="primary" onClick={onSave} disabled={saving || !model}>
          {saving
            ? "Validando…"
            : connection
              ? "Salvar alterações"
              : `Conectar ${modality.label}`}
        </Button>
        <span className="dark:text-dark-300 inline-flex items-center gap-1 text-xs text-gray-400">
          <ShieldCheckIcon className="size-4" />
          Chave validada e criptografada no servidor
        </span>
      </div>
    </div>
  );
}
