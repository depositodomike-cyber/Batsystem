// Import Dependencies
import { useMemo, useState } from "react";
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  Transition,
  TransitionChild,
} from "@headlessui/react";
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";

// Local Imports
import { Button } from "@/components/ui";
import { useAuthContext } from "@/app/contexts/auth/context";
import { transferirPropriedadeApi, type Role } from "@/services/api/roles";
import type { Membro } from "@/services/api/membros";
import { mensagemErroMembro } from "./membros-status";
import { RotuloCampo } from "./RotuloCampo";

// ----------------------------------------------------------------------
// Transferência da propriedade da organização.
//
// A única operação permitida sobre a Role Owner: ela não é editada nem
// recriada — continua a mesma entidade, com as mesmas permissões, e só muda de
// portador.
//
// "Propriedade" são duas coisas ao mesmo tempo: o papel da CONTA
// (owner/admin/membro, que é o gate legado da API) e o vínculo com a Role
// Owner. O backend muda as duas na mesma transação; aqui a tela só descreve a
// consequência com honestidade.
//
// Dois passos no mesmo modal, porque o item de confirmação pede isso e porque a
// operação não tem desfazer: quem transfere deixa de poder transferir.
// ----------------------------------------------------------------------

/** Quem pode assumir: da organização, ativo e com conta de acesso. */
function elegiveis(membros: Membro[], usuarioLogadoId: string | undefined) {
  return membros
    .filter(
      (m) =>
        m.status === "ativo" &&
        m.temConta &&
        // Um convidado não recebe a propriedade da organização — e a API
        // recusaria a role Owner para ele de qualquer forma.
        m.tipo !== "convidado" &&
        // O próprio proprietário não é destino — a API responde 409.
        m.usuarioId !== usuarioLogadoId,
    )
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

export function OwnerTransferenciaModal({
  aberto,
  roleOwner,
  roles,
  membros,
  onClose,
  onTransferido,
}: {
  aberto: boolean;
  /** A role Owner, para nomear e para excluir da lista de substituição. */
  roleOwner: Role | null;
  /** Todas as roles, para o seletor de substituição do proprietário atual. */
  roles: Role[];
  membros: Membro[];
  onClose: () => void;
  onTransferido: (nomeDoNovoOwner: string) => void;
}) {
  const { user, refreshSession } = useAuthContext();

  const [novoOwnerId, setNovoOwnerId] = useState("");
  const [confirmando, setConfirmando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const candidatos = useMemo(
    () => elegiveis(membros, user?.id),
    [membros, user?.id],
  );
  const novoOwner = candidatos.find((m) => m.id === novoOwnerId) ?? null;

  /** O membro de quem transfere. Pode não existir: quem cria a organização
   *  ganha a conta, não um cadastro na tela de Membros. */
  const meuMembro = membros.find((m) => m.usuarioId === user?.id) ?? null;

  /**
   * A Owner é a única role de quem transfere?
   *
   * Só nesse caso o seletor de substituição aparece: quem já tem outra role
   * continua com ela, e oferecer a escolha seria uma pergunta sem consequência.
   */
  const ownerEhUnicaRole =
    meuMembro != null &&
    roleOwner != null &&
    meuMembro.roleIds.length > 0 &&
    meuMembro.roleIds.every((id) => id === roleOwner.id);

  const substitutas = roles
    // `editavel` e não `!proprietaria`: sem isto a role que fica com o
    // ex-proprietário poderia ser a Convidado, que a API recusa atribuir.
    .filter((r) => r.editavel)
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  // Admin pré-selecionada: quem transfere perde o acesso administrativo do
  // papel de conta, e a role é o caminho que o devolve.
  const [roleSubstituta, setRoleSubstituta] = useState(
    () => substitutas.find((r) => r.codigo === "admin")?.id ?? "",
  );

  /** O destino já tem duas roles que não a Owner? Aí não há vaga (máximo 2). */
  const destinoSemVaga =
    novoOwner != null &&
    roleOwner != null &&
    novoOwner.roleIds.filter((id) => id !== roleOwner.id).length >= 2;

  const transferir = async () => {
    if (!novoOwner) return;
    setErro(null);
    setSalvando(true);
    try {
      await transferirPropriedadeApi({
        novoOwnerMembroId: novoOwner.id,
        ...(ownerEhUnicaRole && roleSubstituta
          ? { roleParaOwnerAtual: roleSubstituta }
          : {}),
      });
      // O papel da conta mudou no banco. Sem isto a interface de quem
      // transferiu segue oferecendo controles que a API passou a recusar.
      await refreshSession();
      onTransferido(novoOwner.nome);
    } catch (err) {
      setConfirmando(false);
      setErro(
        mensagemErroMembro(
          err,
          "Não foi possível transferir a propriedade. Tente novamente.",
        ),
      );
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Transition
      appear
      show={aberto}
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
        <div className="flex items-start gap-3">
          <ExclamationTriangleIcon className="text-warning mt-0.5 size-6 shrink-0" />
          <div className="min-w-0">
            <DialogTitle className="dark:text-dark-100 text-base font-semibold text-gray-800">
              {confirmando
                ? "Confirmar transferência?"
                : "Transferir propriedade"}
            </DialogTitle>
            <p className="dark:text-dark-300 mt-1 text-sm text-gray-500">
              {confirmando
                ? `${novoOwner?.nome} passa a ser o proprietário desta organização. Depois de confirmar, você não é mais o proprietário e não poderá desfazer.`
                : "A propriedade da organização passa para outro membro. Depois da transferência, ele passa a ser o proprietário e você deixa de ser."}
            </p>
          </div>
        </div>

        {!confirmando && (
          <>
            <label className="mt-4 block text-sm">
              <RotuloCampo
                rotulo="Novo proprietário"
                ajuda="Só membros ativos e com conta de acesso podem assumir a propriedade."
              />
              <select
                value={novoOwnerId}
                onChange={(e) => setNovoOwnerId(e.target.value)}
                className="form-select dark:border-dark-450 dark:bg-dark-700 dark:text-dark-100 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
              >
                <option value="">Selecionar membro</option>
                {candidatos.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nome}
                  </option>
                ))}
              </select>
            </label>

            {destinoSemVaga && (
              <p className="text-error mt-3 text-sm">
                {novoOwner?.nome} já possui o limite de duas roles. Remova uma
                delas antes de transferir a propriedade.
              </p>
            )}

            {ownerEhUnicaRole && (
              <label className="mt-4 block text-sm">
                <RotuloCampo
                  rotulo="Seu acesso após a transferência"
                  ajuda="A Owner é a sua única role hoje. Como você deixa de ser proprietário, o seu acesso passa a vir da role escolhida aqui."
                />
                <select
                  value={roleSubstituta}
                  onChange={(e) => setRoleSubstituta(e.target.value)}
                  className="form-select dark:border-dark-450 dark:bg-dark-700 dark:text-dark-100 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="">Nenhuma role</option>
                  {substitutas.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.nome}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {candidatos.length === 0 && (
              <p className="dark:text-dark-300 text-xs-plus mt-3 text-gray-400">
                Nenhum outro membro pode assumir a propriedade agora. É preciso
                que alguém esteja ativo e já tenha concluído o acesso.
              </p>
            )}
          </>
        )}

        {erro && <p className="text-error mt-3 text-sm">{erro}</p>}

        <div className="mt-5 flex items-center justify-end gap-2">
          <Button
            variant="outlined"
            onClick={() => (confirmando ? setConfirmando(false) : onClose())}
            disabled={salvando}
          >
            {confirmando ? "Voltar" : "Cancelar"}
          </Button>
          <Button
            color="error"
            onClick={() =>
              confirmando ? void transferir() : setConfirmando(true)
            }
            disabled={salvando || novoOwner == null || destinoSemVaga}
          >
            {salvando
              ? "Transferindo…"
              : confirmando
                ? "Confirmar transferência"
                : "Transferir propriedade"}
          </Button>
        </div>
      </TransitionChild>
    </Transition>
  );
}
