@echo off
echo ========================================
echo  CONFIGURANDO NGROK PARA EXPOSICAO
echo ========================================
echo.

echo IMPORTANTE: Certifique-se de que o ngrok esta instalado!
echo Se nao tiver, baixe em: https://ngrok.com/download
echo.

echo Verificando se ngrok esta instalado...
ngrok version >nul 2>&1
if errorlevel 1 (
    echo ERRO: ngrok nao encontrado!
    echo Por favor, instale o ngrok e adicione ao PATH
    echo Download: https://ngrok.com/download
    pause
    exit /b 1
)

echo ngrok encontrado!
echo.

echo ========================================
echo  OPCOES DE CONFIGURACAO:
echo ========================================
echo  1. Iniciar ngrok para Chatwoot (porta 3000)
echo  2. Iniciar ngrok para Evolution API (porta 8080)
echo  3. Iniciar ambos (recomendado)
echo  4. Configuracao manual
echo ========================================
echo.

set /p choice="Escolha uma opcao (1-4): "

if "%choice%"=="1" goto chatwoot_only
if "%choice%"=="2" goto evolution_only
if "%choice%"=="3" goto both
if "%choice%"=="4" goto manual
goto invalid

:chatwoot_only
echo.
echo Iniciando ngrok para Chatwoot...
start "Ngrok Chatwoot" ngrok http 3000
echo.
echo Acesse http://localhost:4040 para ver as URLs do ngrok
echo Copie a URL HTTPS e atualize CHATWOOT_NGROK_URL no arquivo chatwoot.env
goto end

:evolution_only
echo.
echo Iniciando ngrok para Evolution API...
start "Ngrok Evolution API" ngrok http 8080
echo.
echo Acesse http://localhost:4040 para ver as URLs do ngrok
echo Copie a URL HTTPS e atualize EVOLUTION_NGROK_URL no arquivo chatwoot.env
goto end

:both
echo.
echo Iniciando ngrok para ambos os servicos...
echo.
echo Iniciando Chatwoot (porta 3000)...
start "Ngrok Chatwoot" ngrok http 3000 --log=stdout

timeout /t 3 /nobreak

echo Iniciando Evolution API (porta 8080)...
start "Ngrok Evolution API" ngrok http 8080 --log=stdout

echo.
echo ========================================
echo  PROXIMOS PASSOS:
echo ========================================
echo  1. Acesse http://localhost:4040 para ver as URLs
echo  2. Copie as URLs HTTPS geradas
echo  3. Atualize o arquivo chatwoot.env com as URLs:
echo     - CHATWOOT_NGROK_URL=https://xxxxx.ngrok.io
echo     - EVOLUTION_NGROK_URL=https://yyyyy.ngrok.io
echo     - WEBHOOK_GLOBAL_URL=https://yyyyy.ngrok.io
echo  4. Reinicie os servicos: docker-compose restart
echo ========================================
goto end

:manual
echo.
echo ========================================
echo  CONFIGURACAO MANUAL DO NGROK:
echo ========================================
echo.
echo Para expor o Chatwoot:
echo   ngrok http 3000
echo.
echo Para expor a Evolution API:
echo   ngrok http 8080
echo.
echo Para expor ambos simultaneamente, abra dois terminais
echo e execute os comandos acima em cada um.
echo.
echo Depois atualize o arquivo chatwoot.env com as URLs geradas.
goto end

:invalid
echo.
echo Opcao invalida! Tente novamente.
pause
goto :eof

:end
echo.
echo Configuracao iniciada!
pause
