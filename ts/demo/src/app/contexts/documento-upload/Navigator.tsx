import { useEffect } from "react";
import { useNavigate } from "react-router";

import { useDocumentoUpload } from "./context";

// ----------------------------------------------------------------------
// Ponte de navegação do upload de documento. O DocumentoUploadProvider fica
// acima do RouterProvider (para o processamento continuar entre telas), então
// quem navega é este componente, montado DENTRO do router — assim a navegação
// usa sempre o router vivo, sem depender do módulo exportado.
// ----------------------------------------------------------------------

export function DocumentoUploadNavigator() {
  const navigate = useNavigate();
  const { registrarNavegador } = useDocumentoUpload();

  useEffect(() => {
    registrarNavegador((path, opts) => {
      void navigate(path, { replace: opts?.replace });
    });
    return () => registrarNavegador(null);
  }, [navigate, registrarNavegador]);

  return null;
}
