@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Instale o Node.js 20 ou mais recente para iniciar este projeto.
  pause
  exit /b 1
)
echo Abra http://127.0.0.1:4173 no navegador.
echo Para encerrar, pressione Ctrl+C.
node serve.mjs
pause
