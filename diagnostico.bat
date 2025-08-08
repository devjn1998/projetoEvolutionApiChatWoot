@echo off
echo ========================================
echo  DIAGNOSTICO COMPLETO DO SISTEMA
echo ========================================
echo.

echo 1. Verificando Docker Desktop...
tasklist /FI "IMAGENAME eq Docker Desktop.exe" 2>nul | find /I "Docker Desktop.exe" >nul
if %ERRORLEVEL% EQU 0 (
    echo ✅ Docker Desktop esta rodando
) else (
    echo ❌ Docker Desktop NAO esta rodando
)

echo.
echo 2. Verificando Docker Engine...
docker version >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo ✅ Docker Engine esta funcionando
    docker version
) else (
    echo ❌ Docker Engine nao esta respondendo
)

echo.
echo 3. Verificando Docker Compose...
docker-compose version >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo ✅ Docker Compose esta funcionando
    docker-compose version
) else (
    echo ❌ Docker Compose nao esta funcionando
)

echo.
echo 4. Verificando arquivos necessarios...
if exist "docker-compose.yaml" (
    echo ✅ docker-compose.yaml existe
) else (
    echo ❌ docker-compose.yaml NAO encontrado
)

if exist "chatwoot.env" (
    echo ✅ chatwoot.env existe
) else (
    echo ❌ chatwoot.env NAO encontrado
)

echo.
echo 5. Verificando portas...
netstat -an | find ":3000" >nul
if %ERRORLEVEL% EQU 0 (
    echo ⚠️  Porta 3000 ja esta em uso
) else (
    echo ✅ Porta 3000 disponivel
)

netstat -an | find ":8080" >nul
if %ERRORLEVEL% EQU 0 (
    echo ⚠️  Porta 8080 ja esta em uso
) else (
    echo ✅ Porta 8080 disponivel
)

netstat -an | find ":5432" >nul
if %ERRORLEVEL% EQU 0 (
    echo ⚠️  Porta 5432 ja esta em uso
) else (
    echo ✅ Porta 5432 disponivel
)

echo.
echo 6. Verificando containers existentes...
docker ps -a 2>nul
if %ERRORLEVEL% EQU 0 (
    echo ✅ Listagem de containers concluida
) else (
    echo ❌ Nao foi possivel listar containers
)

echo.
echo 7. Verificando imagens Docker...
docker images 2>nul
if %ERRORLEVEL% EQU 0 (
    echo ✅ Listagem de imagens concluida
) else (
    echo ❌ Nao foi possivel listar imagens
)

echo.
echo ========================================
echo  RESUMO DO DIAGNOSTICO
echo ========================================
echo Se algum item apresentou erro:
echo 1. Execute check-docker.bat para iniciar o Docker
echo 2. Verifique se tem espaco em disco suficiente
echo 3. Reinicie o computador se necessario
echo 4. Execute como Administrador se persistir
echo.
pause
