@echo off
echo ========================================
echo  INICIANDO CHATWOOT PT-BR + EVOLUTION API
echo ========================================
echo.

echo Verificando se Docker esta rodando...
docker version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Docker nao esta rodando!
    echo Execute primeiro: check-docker.bat
    echo.
    pause
    exit /b 1
)
echo ✅ Docker esta funcionando!

echo.
echo Verificando arquivo de configuracao...
if not exist "chatwoot.env" (
    echo ❌ Arquivo chatwoot.env nao encontrado!
    echo.
    pause
    exit /b 1
)
echo ✅ Arquivo chatwoot.env encontrado!

echo.
echo Parando servicos existentes...
docker-compose down

echo.
echo Removendo containers antigos (se existirem)...
docker-compose rm -f

echo.
echo Iniciando servicos...
docker-compose up -d

echo.
echo Aguardando servicos iniciarem...
timeout /t 30 /nobreak

echo.
echo ========================================
echo  STATUS DOS SERVICOS
echo ========================================
docker-compose ps

echo.
echo ========================================
echo  SERVICOS DISPONIVEIS:
echo ========================================
echo  Chatwoot PT-BR: http://localhost:3000
echo  Evolution API:  http://localhost:8080
echo  PostgreSQL:     localhost:5432
echo  Redis:          localhost:6379
echo ========================================
echo.
echo Para ver os logs em tempo real:
echo   docker-compose logs -f
echo.
echo Para parar os servicos:
echo   docker-compose down
echo.
pause
