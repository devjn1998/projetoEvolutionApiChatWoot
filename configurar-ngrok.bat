@echo off
echo ========================================
echo  CONFIGURANDO NGROK COMPLETO
echo ========================================
echo.

REM Definir token do ngrok
set NGROK_TOKEN=30Hx5xQ5QNN0zE8EWNmcitVOiKE_86CEYfTyTUQahX4BoMdf6

echo Procurando ngrok no sistema...

REM Tentar encontrar ngrok nos locais comuns
set NGROK_PATH=
if exist "ngrok.exe" (
    set NGROK_PATH=ngrok.exe
    echo ✅ ngrok encontrado no diretorio atual
) else if exist "C:\Program Files\ngrok\ngrok.exe" (
    set NGROK_PATH="C:\Program Files\ngrok\ngrok.exe"
    echo ✅ ngrok encontrado em Program Files
) else if exist "%USERPROFILE%\Downloads\ngrok.exe" (
    set NGROK_PATH="%USERPROFILE%\Downloads\ngrok.exe"
    echo ✅ ngrok encontrado em Downloads
) else if exist "%USERPROFILE%\AppData\Local\ngrok\ngrok.exe" (
    set NGROK_PATH="%USERPROFILE%\AppData\Local\ngrok\ngrok.exe"
    echo ✅ ngrok encontrado em AppData
) else (
    echo ❌ ngrok nao encontrado!
    echo.
    echo Por favor:
    echo 1. Baixe o ngrok de: https://ngrok.com/download
    echo 2. Extraia o ngrok.exe neste diretorio ou
    echo 3. Instale em C:\Program Files\ngrok\
    echo.
    pause
    exit /b 1
)

echo.
echo Configurando token de autenticacao...
%NGROK_PATH% config add-authtoken %NGROK_TOKEN%
if %ERRORLEVEL% EQU 0 (
    echo ✅ Token configurado com sucesso!
) else (
    echo ❌ Erro ao configurar token
    pause
    exit /b 1
)

echo.
echo ========================================
echo  OPCOES DE EXPOSICAO:
echo ========================================
echo  1. Expor Chatwoot (porta 3000)
echo  2. Expor Evolution API (porta 8080)  
echo  3. Expor ambos (recomendado)
echo  4. Sair
echo ========================================
echo.

set /p choice="Escolha uma opcao (1-4): "

if "%choice%"=="1" goto chatwoot_only
if "%choice%"=="2" goto evolution_only
if "%choice%"=="3" goto both
if "%choice%"=="4" goto end
goto invalid

:chatwoot_only
echo.
echo Iniciando ngrok para Chatwoot...
start "Ngrok Chatwoot" cmd /c "%NGROK_PATH% http 3000"
echo.
echo ✅ ngrok iniciado para Chatwoot!
goto show_instructions

:evolution_only
echo.
echo Iniciando ngrok para Evolution API...
start "Ngrok Evolution" cmd /c "%NGROK_PATH% http 8080"
echo.
echo ✅ ngrok iniciado para Evolution API!
goto show_instructions

:both
echo.
echo Iniciando ngrok para Chatwoot (porta 3000)...
start "Ngrok Chatwoot" cmd /c "%NGROK_PATH% http 3000"
timeout /t 3 /nobreak >nul

echo Iniciando ngrok para Evolution API (porta 8080)...
start "Ngrok Evolution" cmd /c "%NGROK_PATH% http 8080"
echo.
echo ✅ Ambos os servicos expostos!
goto show_instructions

:show_instructions
echo.
echo ========================================
echo  PROXIMOS PASSOS:
echo ========================================
echo  1. Aguarde as janelas do ngrok abrirem
echo  2. Anote as URLs HTTPS geradas (ex: https://xxxxx.ngrok.io)
echo  3. Use essas URLs para:
echo     - Acessar Chatwoot externamente
echo     - Configurar webhooks da Evolution API
echo     - Integrar com sistemas externos
echo.
echo ⚠️  IMPORTANTE:
echo   - URLs gratuitas mudam a cada reinicializacao
echo   - Para URLs fixas, considere ngrok pago
echo   - Mantenha as janelas abertas para manter exposicao
echo.
goto end

:invalid
echo.
echo Opcao invalida! Tente novamente.
pause
goto :eof

:end
echo.
echo ========================================
echo  CONFIGURACAO NGROK CONCLUIDA!
echo ========================================
echo.
echo SERVICOS LOCAIS:
echo   • Chatwoot: http://localhost:3000
echo   • Evolution API: http://localhost:8080
echo.
echo Para parar o ngrok, feche as janelas dos terminals.
echo.
pause
