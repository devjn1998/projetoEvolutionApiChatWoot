# Autenticação por API Key - Endpoints de Workflows

## Visão Geral

Todos os endpoints relacionados a workflows e n8n agora requerem autenticação por API Key para garantir a segurança do sistema.

## API Key Configurada

A API Key utilizada é a mesma configurada no n8n:

- **Chave**: `n8n-local-api-key`
- **Configurada em**: `docker-compose.yaml` na seção do n8n

## Endpoints Protegidos

### Workflows

- `GET /api/db/workflows` - Listar todos os workflows
- `GET /api/db/workflows/:id` - Obter workflow específico
- `PUT /api/db/workflows/:id` - Atualizar workflow
- `POST /api/db/credentials/:workflowId` - Adicionar credenciais
- `DELETE /api/db/workflows/:id` - Deletar workflow
- `POST /api/create-workflow-with-credentials` - Criar workflow com credenciais

### n8n

- `POST /api/sync-n8n-to-db` - Sincronizar workflows do n8n
- `POST /api/db/agents/:id/sync-n8n` - Sincronizar agente específico
- `POST /api/update-n8n-credential` - Atualizar credenciais do n8n
- `GET /api/n8n-status` - Verificar status do n8n

## Como Usar a Autenticação

### 1. Via Header (Recomendado)

```bash
curl -X GET "http://localhost:3001/api/db/workflows" \
  -H "x-api-key: n8n-local-api-key"
```

### 2. Via Header Alternativo

```bash
curl -X GET "http://localhost:3001/api/db/workflows" \
  -H "api-key: n8n-local-api-key"
```

### 3. Via Query Parameter

```bash
curl -X GET "http://localhost:3001/api/db/workflows?api_key=n8n-local-api-key"
```

## Exemplos de Uso

### JavaScript/Fetch

```javascript
const response = await fetch("http://localhost:3001/api/db/workflows", {
  method: "GET",
  headers: {
    "x-api-key": "n8n-local-api-key",
    "Content-Type": "application/json",
  },
});
```

### Python/Requests

```python
import requests

headers = {
    'x-api-key': 'n8n-local-api-key',
    'Content-Type': 'application/json'
}

response = requests.get('http://localhost:3001/api/db/workflows', headers=headers)
```

### PHP/cURL

```php
$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, 'http://localhost:3001/api/db/workflows');
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'x-api-key: n8n-local-api-key',
    'Content-Type: application/json'
]);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
$response = curl_exec($ch);
curl_close($ch);
```

## Respostas de Erro

### 401 - API Key Ausente

```json
{
  "success": false,
  "error": "API Key é obrigatória para acessar este endpoint"
}
```

### 403 - API Key Inválida

```json
{
  "success": false,
  "error": "API Key inválida"
}
```

## Endpoints Não Protegidos

Os seguintes endpoints **NÃO** requerem autenticação por API Key:

- Endpoints de autenticação de usuários (`/api/auth/*`)
- Endpoints de Evolution API (`/api/evolution/*`)
- Webhooks do n8n (`/api/n8n/webhook/*`)

## Segurança

- A API Key é validada em todas as requisições para endpoints protegidos
- A validação é feita antes da execução da lógica do endpoint
- Recomenda-se usar HTTPS em produção
- Considere rotacionar a API Key periodicamente em ambientes de produção

## Configuração em Produção

Para ambientes de produção, recomenda-se:

1. **Alterar a API Key padrão**:

   ```yaml
   # docker-compose.yaml
   environment:
     - N8N_API_KEY=sua-api-key-segura-aqui
   ```

2. **Usar variáveis de ambiente**:

   ```bash
   export N8N_API_KEY=sua-api-key-segura-aqui
   ```

3. **Configurar HTTPS** para todas as comunicações

4. **Implementar rate limiting** para prevenir abuso

5. **Monitorar logs** de tentativas de acesso não autorizado
