@echo off
echo ========================================
echo  🚀 INICIALIZACAO AUTOMATICA COMPLETA
echo  Chatwoot PT-BR + Evolution API + ngrok
echo ========================================
echo.

echo [PASSO 1] Verificando Docker Desktop...
call check-docker.bat
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Falha ao inicializar Docker
    pause
    exit /b 1
)

echo.
echo [PASSO 2] Executando diagnostico...
call diagnostico.bat

echo.
echo [PASSO 3] Iniciando servicos...
call start-services.bat
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Falha ao iniciar servicos
    pause
    exit /b 1
)

echo.
echo [PASSO 4] Verificando se servicos estao rodando...
timeout /t 10 /nobreak >nul

docker-compose ps

echo.
echo ========================================
echo  ✅ INICIALIZACAO CONCLUIDA!
echo ========================================
echo.
echo 🌐 SERVICOS DISPONIVEIS:
echo   • Chatwoot PT-BR: http://localhost:3000
echo   • Evolution API:  http://localhost:8080
echo   • ngrok Dashboard: http://localhost:4040
echo.
echo 📋 PROXIMOS PASSOS:
echo   1. Acesse http://localhost:3000 para configurar Chatwoot
echo   2. Execute setup-ngrok.bat para exposicao externa
echo   3. Configure WhatsApp na Evolution API
echo.
echo 🔧 COMANDOS UTEIS:
echo   • Ver logs: docker-compose logs -f
echo   • Parar tudo: docker-compose down
echo   • Reiniciar: docker-compose restart
echo.
pause
