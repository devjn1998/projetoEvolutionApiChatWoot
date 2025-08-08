# 🚀 Chatwoot PT-BR + Evolution API + ngrok

## 📋 Pré-requisitos

1. **Docker** e **Docker Compose** instalados
2. **ngrok** instalado (para exposição externa)
   - Download: https://ngrok.com/download
   - Extrair e adicionar ao PATH do Windows

## 🛠️ Instalação

### 1. Configurar as variáveis de ambiente

Edite o arquivo `chatwoot.env` conforme necessário:

```bash
# Senhas padrão (recomendado alterar em produção)
POSTGRES_PASSWORD=chatwoot123
REDIS_PASSWORD=redis123
EVOLUTION_API_KEY=B6D711FCDE4D4FD5936544120E713976
```

### 2. Iniciar os serviços

Execute o script para iniciar todos os serviços:

```cmd
start-services.bat
```

Ou manualmente:

```cmd
docker-compose up -d
```

### 3. Configurar ngrok (para acesso externo)

Execute o script de configuração do ngrok:

```cmd
setup-ngrok.bat
```

Ou configure manualmente:

```cmd
# Terminal 1 - Chatwoot
ngrok http 3000

# Terminal 2 - Evolution API  
ngrok http 8080
```

### 4. Atualizar URLs no arquivo chatwoot.env

Após executar o ngrok, copie as URLs geradas e atualize:

```bash
CHATWOOT_NGROK_URL=https://xxxxx.ngrok.io
EVOLUTION_NGROK_URL=https://yyyyy.ngrok.io
WEBHOOK_GLOBAL_URL=https://yyyyy.ngrok.io
```

### 5. Reiniciar os serviços

```cmd
docker-compose restart
```

## 🌐 Acessos

### Serviços Locais
- **Chatwoot**: http://localhost:3000
- **Evolution API**: http://localhost:8080
- **ngrok Dashboard**: http://localhost:4040

### Banco de Dados
- **PostgreSQL**: localhost:5432
- **Redis**: localhost:6379

## 🎯 Primeiro Acesso ao Chatwoot

1. Acesse http://localhost:3000
2. Crie sua conta de administrador
3. Configure sua primeira caixa de entrada
4. Integre com a Evolution API usando a URL do ngrok

## 🔗 Configurando WhatsApp

### 1. No Evolution API

1. Acesse http://localhost:8080 ou sua URL do ngrok
2. Use a API Key: `B6D711FCDE4D4FD5936544120E713976`
3. Crie uma nova instância
4. Escaneie o QR Code com seu WhatsApp

### 2. No Chatwoot

1. Vá em **Configurações > Caixas de Entrada**
2. Clique em **Adicionar Caixa de Entrada**
3. Selecione **API**
4. Configure:
   - **Nome**: WhatsApp Business
   - **Webhook URL**: `[SUA_URL_NGROK_CHATWOOT]/webhooks/whatsapp`
   - **API Base URL**: `[SUA_URL_NGROK_EVOLUTION]/`
   - **API Key**: `B6D711FCDE4D4FD5936544120E713976`

## 🐛 Comandos Úteis

### Ver logs em tempo real
```cmd
docker-compose logs -f
```

### Ver status dos serviços
```cmd
docker-compose ps
```

### Parar todos os serviços
```cmd
docker-compose down
```

### Remover dados (CUIDADO!)
```cmd
docker-compose down -v
```

### Acessar container do Chatwoot
```cmd
docker-compose exec chatwoot bash
```

### Backup do banco de dados
```cmd
docker-compose exec postgres pg_dump -U chatwoot chatwoot_production > backup.sql
```

## 🔧 Solução de Problemas

### Problema: Serviços não iniciam
```cmd
# Verificar logs
docker-compose logs

# Limpar e reiniciar
docker-compose down
docker system prune -f
docker-compose up -d
```

### Problema: Erro de conexão com banco
1. Verifique se as senhas no `chatwoot.env` estão corretas
2. Aguarde mais tempo para o PostgreSQL inicializar
3. Verifique logs: `docker-compose logs postgres`

### Problema: Evolution API não conecta
1. Verifique se a porta 8080 está livre
2. Confirme se as variáveis de ambiente estão corretas
3. Verifique logs: `docker-compose logs evolution-api`

### Problema: ngrok não funciona
1. Verifique se está instalado: `ngrok version`
2. Faça login no ngrok: `ngrok authtoken SEU_TOKEN`
3. Teste: `ngrok http 3000`

## 📝 Notas Importantes

1. **Segurança**: Altere as senhas padrão em produção
2. **ngrok gratuito**: URLs mudam a cada reinicialização
3. **Backup**: Faça backup regular do banco de dados
4. **Logs**: Monitore os logs regularmente
5. **Recursos**: Chatwoot PT-BR tem recursos extras comparado ao original

## 🆘 Suporte

- **Documentação Chatwoot**: https://www.chatwoot.com/docs/
- **Evolution API**: https://github.com/EvolutionAPI/evolution-api
- **ngrok**: https://ngrok.com/docs

---

✨ **Desenvolvido para facilitar a implementação do Chatwoot PT-BR com WhatsApp!**
