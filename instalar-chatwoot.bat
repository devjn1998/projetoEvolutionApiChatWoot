@echo off
echo ========================================
echo  🚀 INSTALACAO AUTOMATICA CHATWOOT PT-BR
echo ========================================
echo.

echo [PASSO 1] Verificando Docker...
docker version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Docker nao encontrado!
    echo Execute primeiro: check-docker.bat
    pause
    exit /b 1
)
echo ✅ Docker OK

echo.
echo [PASSO 2] Parando servicos existentes...
docker-compose down -v

echo.
echo [PASSO 3] Baixando imagens...
docker-compose pull

echo.
echo [PASSO 4] Iniciando PostgreSQL e Redis...
docker-compose up -d postgres redis

echo.
echo [PASSO 5] Aguardando PostgreSQL (pode demorar 1-2 minutos)...
:wait_db
timeout /t 10 /nobreak >nul
docker-compose exec -T postgres pg_isready -h localhost -U chatwoot -d chatwoot_production >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo Aguardando banco...
    goto wait_db
)
echo ✅ PostgreSQL pronto!

echo.
echo [PASSO 6] Configurando banco de dados...
docker-compose run --rm chatwoot bundle exec rails db:chatwoot_prepare

if %ERRORLEVEL% NEQ 0 (
    echo ❌ Erro na configuracao do banco!
    echo Tentando novamente...
    timeout /t 10 /nobreak
    docker-compose run --rm chatwoot bundle exec rails db:chatwoot_prepare
)

echo.
echo [PASSO 7] Iniciando todos os servicos...
docker-compose up -d

echo.
echo [PASSO 8] Aguardando inicializacao completa...
timeout /t 30 /nobreak

echo.
echo ========================================
echo  ✅ INSTALACAO CONCLUIDA!
echo ========================================
echo.
echo 🌐 SERVICOS DISPONIVEIS:
echo   • Chatwoot PT-BR: http://localhost:3000
echo   • Evolution API:  http://localhost:8080
echo.
echo 📋 PROXIMOS PASSOS:
echo   1. Acesse http://localhost:3000
echo   2. Crie sua conta de administrador
echo   3. Configure sua primeira caixa de entrada
echo   4. Execute setup-ngrok.bat para exposicao externa
echo.
echo 🔧 COMANDOS UTEIS:
echo   • Ver logs: docker-compose logs -f chatwoot
echo   • Status: docker-compose ps
echo   • Parar: docker-compose down
echo.

set /p open_browser="Deseja abrir o navegador agora? (S/N): "
if /i "%open_browser%"=="S" (
    start http://localhost:3000
)

pause
