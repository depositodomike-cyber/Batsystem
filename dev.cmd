@echo off
rem ---------------------------------------------------------------------
rem Sobe o ambiente local completo: API (NestJS, :3001) e Web (Vite, :5173).
rem
rem Cada serviço abre na PRÓPRIA janela de console, e não em segundo plano,
rem por dois motivos: o log fica à vista (é onde aparece o erro quando o Nest
rem falha a recompilar) e fechar a janela encerra o serviço, sem processo
rem órfão segurando a porta.
rem
rem `cmd /k` mantém a janela aberta depois de o processo terminar — sem isso,
rem um crash fecharia a janela junto e levaria a mensagem de erro com ela.
rem
rem Requisitos: `npm install` já feito nas duas pastas e o Postgres local no ar
rem (ts/api: npm run db:up).
rem ---------------------------------------------------------------------

start "beculture API  :3001" cmd /k "cd /d "%~dp0ts\api" && npm run start:dev"
start "beculture Web  :5173" cmd /k "cd /d "%~dp0ts\demo" && npm run dev"

echo.
echo   API  http://localhost:3001   (janela "beculture API")
echo   Web  http://localhost:5173   (janela "beculture Web")
echo.
echo   A API leva ~2s para compilar e abrir a porta.
echo   Para conferir se esta viva:  curl -s -o nul -w "%%{http_code}" http://localhost:3001/uso/tokens
echo   401 = viva  ^|  000 = fora do ar
echo.
