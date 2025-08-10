@echo off
echo Iniciando túnel ngrok para Chatwoot e Evolution API...
echo.

echo Parando processos ngrok existentes...
taskkill /F /IM ngrok.exe 2>nul

echo.
echo Iniciando túnel único com ambos os serviços...
ngrok start --config ngrok.yml chatwoot evolution-api

echo.
echo Túnel iniciado! Acesse:
echo - Interface ngrok: http://localhost:4040
echo - Chatwoot: https://[seu-dominio-ngrok].ngrok-free.app (porta 3000)
echo - Evolution API: https://[seu-dominio-ngrok].ngrok-free.app (porta 8080)
echo.
pause 