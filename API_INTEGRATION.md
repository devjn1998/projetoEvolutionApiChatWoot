# API de Integração - Evolution API + Chatwoot + n8n

Este documento descreve os novos endpoints implementados para integração completa entre Evolution API, Chatwoot e n8n.

## 🔄 Fluxo de Integração

1. **Registro do Usuário** → Ativa webhook do n8n
2. **n8n** → Cria empresa no Chatwoot + instância na Evolution API
3. **Webhook n8n** → Atualiza nosso banco com os IDs
4. **Nossa API** → Espelha status e dados de ambos os serviços

## 📋 Endpoints Implementados

### 🔐 Autenticação

Todos os endpoints (exceto webhooks) requerem token JWT no header:

```
Authorization: Bearer <seu-token-jwt>
```

### 🚀 Evolution API

#### 1. Verificar Instância Criada pelo n8n

```http
GET /api/evolution/check-instance
```

Verifica se a instância foi criada automaticamente pelo fluxo do n8n.

**Resposta:**

```json
{
  "success": true,
  "message": "Instância encontrada na Evolution API",
  "instanceName": "usuario123",
  "instance": { ... },
  "created": true
}
```

#### 2. Gerar QR Code

```http
GET /api/evolution/qrcode/:instanceName
```

Gera QR Code para conectar WhatsApp à instância.

**Resposta:**

```json
{
  "success": true,
  "qrcode": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
  "code": "2@...",
  "instanceName": "usuario123"
}
```

#### 3. Listar Instâncias

```http
GET /api/evolution/instances
```

Lista todas as instâncias da Evolution API.

#### 4. Deletar Instância

```http
DELETE /api/evolution/delete-instance/:instanceName
```

Remove uma instância da Evolution API.

### 💬 Chatwoot

#### 1. Sincronizar Dados

```http
GET /api/chatwoot/sync/:userId
```

Sincroniza dados da empresa do Chatwoot com nosso banco.

**Resposta:**

```json
{
  "success": true,
  "message": "Dados do Chatwoot sincronizados com sucesso",
  "chatwootData": {
    "id": 1,
    "name": "Empresa Ltda",
    "domain": "empresa.chatwoot.com"
  }
}
```

### 📊 Status e Monitoramento

#### 1. Status Completo

```http
GET /api/status/complete
```

Retorna status completo integrando Evolution API + Chatwoot.

**Resposta:**

```json
{
  "success": true,
  "user": {
    "id": 1,
    "fullName": "João Silva",
    "nameEnterprise": "Empresa Ltda",
    "username": "joao123",
    "email": "joao@empresa.com",
    "instanceName": "joao123"
  },
  "evolution": {
    "connected": true,
    "status": "open",
    "instance": { ... }
  },
  "chatwoot": {
    "connected": true,
    "account": { ... }
  },
  "integration": {
    "evolutionInstanceCreated": true,
    "qrCodeGenerated": true,
    "chatwootAccountId": 1,
    "chatwootAccountName": "Empresa Ltda"
  }
}
```

### 🔗 Webhooks

#### 1. Webhook Evolution API

```http
POST /api/evolution/webhook/:instanceName
```

Recebe atualizações da Evolution API (conexão, mensagens, etc.).

**Payload:**

```json
{
  "event": "connection.update",
  "data": {
    "state": "open"
  }
}
```

#### 2. Webhook n8n (Empresa Criada)

```http
POST /api/n8n/webhook/company-created
```

Recebe confirmação do n8n após criação de empresa.

**Payload:**

```json
{
  "userId": 1,
  "chatwootAccountId": 1,
  "evolutionInstanceId": "usuario123"
}
```

## 🗄️ Estrutura do Banco de Dados

### Tabela `users`

- `chatwootAccountId` - ID da conta no Chatwoot
- `chatwootAccountName` - Nome da conta no Chatwoot
- `chatwootAccountDomain` - Domínio da conta no Chatwoot
- `chatwootLastSync` - Última sincronização com Chatwoot

### Tabela `instances`

- `evolutionInstanceId` - ID da instância na Evolution API
- `evolutionInstanceCreated` - Se a instância foi criada
- `evolutionInstanceCreatedAt` - Quando foi criada
- `qrCodeGeneratedAt` - Quando o QR Code foi gerado
- `lastStatusCheck` - Última verificação de status

## 🔧 Configuração

### Variáveis de Ambiente

```env
# Evolution API
EVOLUTION_API_URL=http://localhost:8080
EVOLUTION_API_KEY=B6D711FCDE4D4FD5936544120E713976

# Chatwoot
CHATWOOT_API_TOKEN=seu-token-aqui
CHATWOOT_URL=http://localhost:3000

# n8n
N8N_API_URL=http://localhost:5678
N8N_API_KEY=n8n-local-api-key
```

## 🚀 Como Usar

### 1. Registrar Usuário

```javascript
const response = await fetch("/api/auth/register", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    fullName: "João Silva",
    nameEnterprise: "Empresa Ltda",
    username: "joao123",
    email: "joao@empresa.com",
    password: "senha123",
  }),
});
```

### 2. Fazer Login

```javascript
const response = await fetch("/api/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    username: "joao123",
    password: "senha123",
  }),
});

const { token } = await response.json();
```

### 3. Verificar se Instância foi Criada pelo n8n

```javascript
const response = await fetch("/api/evolution/check-instance", {
  headers: { Authorization: `Bearer ${token}` },
});

const { created, instance } = await response.json();
if (created) {
  console.log("Instância criada pelo n8n:", instance);
} else {
  console.log("Aguardando criação da instância pelo n8n...");
}
```

### 4. Gerar QR Code

```javascript
const response = await fetch("/api/evolution/qrcode/joao123", {
  headers: { Authorization: `Bearer ${token}` },
});

const { qrcode } = await response.json();
// Exibir qrcode na interface
```

### 5. Verificar Status Completo

```javascript
const response = await fetch("/api/status/complete", {
  headers: { Authorization: `Bearer ${token}` },
});

const status = await response.json();
// status.evolution.connected - Se WhatsApp está conectado
// status.chatwoot.connected - Se Chatwoot está conectado
```

## 🔄 Fluxo Automático

1. **Usuário se registra** → Webhook n8n é ativado
2. **n8n cria empresa no Chatwoot** → Retorna chatwootAccountId
3. **n8n cria instância na Evolution API** → Retorna evolutionInstanceId
4. **n8n chama webhook** → Atualiza nosso banco
5. **Usuário gera QR Code** → Conecta WhatsApp
6. **Evolution API envia webhook** → Atualiza status de conexão
7. **Sistema sincroniza** → Dados espelhados entre serviços

## 🐛 Troubleshooting

### Erro 500 no /api/status

- Verificar se Evolution API está rodando na porta 8080
- Verificar se o usuário tem instanceName configurado

### QR Code não aparece

- Verificar se a instância foi criada na Evolution API
- Verificar se o endpoint /api/evolution/create-instance foi chamado

### Chatwoot não sincroniza

- Verificar se CHATWOOT_API_TOKEN está configurado
- Verificar se Chatwoot está rodando na porta 3000
- Verificar se o usuário tem chatwootAccountId

### Webhook n8n não funciona

- Verificar se n8n está rodando na porta 5678
- Verificar se o workflow está configurado corretamente
- Verificar se o webhook URL está correto
