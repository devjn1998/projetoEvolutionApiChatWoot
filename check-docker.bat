@echo off
echo ========================================
echo  VERIFICANDO DOCKER DESKTOP
echo ========================================
echo.

echo Verificando se Docker Desktop esta rodando...
tasklist /FI "IMAGENAME eq Docker Desktop.exe" 2>nul | find /I "Docker Desktop.exe" >nul
if %ERRORLEVEL% EQU 0 (
    echo ✅ Docker Desktop esta rodando!
    goto check_docker_engine
) else (
    echo ❌ Docker Desktop NAO esta rodando!
    echo.
    echo Tentando iniciar Docker Desktop...
    
    REM Tentar encontrar Docker Desktop nos locais comuns
    if exist "C:\Program Files\Docker\Docker\Docker Desktop.exe" (
        start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
        echo Docker Desktop encontrado em Program Files, iniciando...
    ) else if exist "%USERPROFILE%\AppData\Local\Docker\Docker Desktop.exe" (
        start "" "%USERPROFILE%\AppData\Local\Docker\Docker Desktop.exe"
        echo Docker Desktop encontrado em AppData, iniciando...
    ) else (
        echo.
        echo ❌ Docker Desktop nao encontrado!
        echo Por favor:
        echo 1. Instale o Docker Desktop de: https://www.docker.com/products/docker-desktop
        echo 2. Ou inicie manualmente o Docker Desktop
        echo.
        pause
        exit /b 1
    )
    
    echo.
    echo Aguardando Docker Desktop inicializar...
    echo Isso pode demorar 1-2 minutos...
    
    :wait_loop
    timeout /t 10 /nobreak >nul
    tasklist /FI "IMAGENAME eq Docker Desktop.exe" 2>nul | find /I "Docker Desktop.exe" >nul
    if %ERRORLEVEL% NEQ 0 (
        echo Ainda aguardando...
        goto wait_loop
    )
    
    echo ✅ Docker Desktop iniciado!
    echo Aguardando mais 30 segundos para o engine ficar pronto...
    timeout /t 30 /nobreak
)

:check_docker_engine
echo.
echo Testando conexao com Docker Engine...
docker version >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo ✅ Docker Engine esta funcionando!
    echo.
    echo ========================================
    echo  VERSAO DO DOCKER:
    echo ========================================
    docker version
) else (
    echo ❌ Docker Engine nao esta respondendo
    echo Aguarde mais alguns segundos e tente novamente...
    echo.
    echo Se o problema persistir:
    echo 1. Reinicie o Docker Desktop
    echo 2. Verifique se o Windows WSL2 esta funcionando
    echo 3. Tente executar como Administrador
    echo.
    pause
    exit /b 1
)

echo.
echo ========================================
echo  DOCKER PRONTO PARA USO!
echo ========================================
echo.
pause
