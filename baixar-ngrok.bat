@echo off
echo ========================================
echo  BAIXAR NGROK AUTOMATICAMENTE
echo ========================================
echo.

echo Verificando se ngrok ja existe...
if exist "ngrok.exe" (
    echo ✅ ngrok ja existe no diretorio atual!
    echo Execute: configurar-ngrok.bat
    pause
    exit /b 0
)

echo ❌ ngrok nao encontrado.
echo.
echo ========================================
echo  OPCOES DE INSTALACAO:
echo ========================================
echo  1. Abrir pagina de download do ngrok
echo  2. Baixar automaticamente (requer PowerShell)
echo  3. Cancelar
echo ========================================
echo.

set /p choice="Escolha uma opcao (1-3): "

if "%choice%"=="1" goto open_download
if "%choice%"=="2" goto auto_download
if "%choice%"=="3" goto end
goto invalid

:open_download
echo.
echo Abrindo pagina de download do ngrok...
start https://ngrok.com/download
echo.
echo ========================================
echo  INSTRUCOES:
echo ========================================
echo  1. Baixe o ngrok para Windows
echo  2. Extraia o ngrok.exe neste diretorio:
echo     %CD%
echo  3. Execute: configurar-ngrok.bat
echo ========================================
goto end

:auto_download
echo.
echo Tentando baixar ngrok automaticamente...
echo Isso pode demorar alguns minutos...
echo.

powershell -Command "& {Invoke-WebRequest -Uri 'https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-windows-amd64.zip' -OutFile 'ngrok.zip'; Expand-Archive -Path 'ngrok.zip' -DestinationPath '.' -Force; Remove-Item 'ngrok.zip'}"

if exist "ngrok.exe" (
    echo ✅ ngrok baixado com sucesso!
    echo.
    echo Agora execute: configurar-ngrok.bat
) else (
    echo ❌ Erro ao baixar ngrok automaticamente.
    echo Por favor, baixe manualmente de: https://ngrok.com/download
)
goto end

:invalid
echo.
echo Opcao invalida! Tente novamente.
pause
goto :eof

:end
echo.
pause
