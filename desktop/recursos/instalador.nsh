; Instalador do Oracle Desktop.
;
; Antes de trocar os arquivos (instalação por cima ou atualização), pede ao
; Oracle aberto que saia pelo caminho normal — `Oracle.exe --sair` — para que
; a API e o Postgres embutidos parem limpos e não fiquem arquivos presos.
!macro customInit
  ${If} ${FileExists} "$LOCALAPPDATA\Programs\Oracle\Oracle.exe"
    ExecWait '"$LOCALAPPDATA\Programs\Oracle\Oracle.exe" --sair'
    Sleep 8000
  ${EndIf}
!macroend

; Desinstalação: remove o que o app grava no registro do usuário. Numa
; ATUALIZAÇÃO o desinstalador antigo também roda — aí nada é removido (o app
; regrava tudo ao abrir). Os dados em %APPDATA%\Oracle (banco, sessão,
; preferências) nunca são apagados aqui.
!macro customUnInstall
  ${ifNot} ${isUpdated}
    ; Protocolo do retorno OAuth (desktop/src/main/deepLink.ts).
    DeleteRegKey HKCU "Software\Classes\oracle-desktop"
    ; "Iniciar com o Windows" (app.setLoginItemSettings, nome = AppUserModelId).
    DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "com.oracle.desktop"
  ${endIf}
!macroend
