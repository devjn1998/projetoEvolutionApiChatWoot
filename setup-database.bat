@echo off
echo ========================================
echo  CONFIGURANDO BANCO DE DADOS CHATWOOT
echo ========================================
echo.

echo Verificando se Docker esta rodando...
docker version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Docker nao esta rodando!
    echo Execute primeiro: check-docker.bat
    pause
    exit /b 1
)

echo ✅ Docker funcionando!
echo.

echo Parando servicos existentes...
docker-compose down

echo.
echo Removendo volumes antigos (opcional - dados serao perdidos)...
set /p remove_volumes="Deseja remover dados antigos? (S/N): "
if /i "%remove_volumes%"=="S" (
    docker-compose down -v
    echo ✅ Volumes removidos
) else (
    echo ✅ Volumes mantidos
)

echo.
echo Iniciando apenas PostgreSQL e Redis primeiro...
docker-compose up -d postgres redis

echo.
echo Aguardando PostgreSQL ficar pronto...
:wait_postgres
timeout /t 5 /nobreak >nul
docker-compose exec postgres pg_isready -h localhost -p 5432 -U chatwoot -d chatwoot_production >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo Ainda aguardando PostgreSQL...
    goto wait_postgres
)

echo ✅ PostgreSQL pronto!
echo.

echo Executando setup inicial do banco...
docker-compose run --rm chatwoot bundle exec rails db:chatwoot_prepare

if %ERRORLEVEL% EQU 0 (
    echo ✅ Banco configurado com sucesso!
    echo.
    echo Iniciando todos os servicos...
    docker-compose up -d
    
    echo.
    echo ========================================
    echo  CONFIGURACAO CONCLUIDA!
    echo ========================================
    echo.
    echo Aguarde alguns minutos para o Chatwoot inicializar completamente.
    echo.
    echo Acesse: http://localhost:3000
    echo.
) else (
    echo ❌ Erro ao configurar banco!
    echo Verificando logs...
    docker-compose logs chatwoot
)

pause
