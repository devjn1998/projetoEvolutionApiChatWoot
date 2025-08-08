// n8n API Configuration and Functions
const fetch = require('node-fetch');

class N8nAPI {
    // --- Construtor ---
    constructor(n8nUrl, apiKey) {
        if (!n8nUrl) throw new Error("A URL do n8n é obrigatória.");
        if (!apiKey) throw new Error("A API Key do n8n é obrigatória.");

        this.baseUrl = n8nUrl.endsWith('/') ? n8nUrl.slice(0, -1) : n8nUrl;
        this.apiKey = apiKey;
        this.headers = {
            'Content-Type': 'application/json',
            'X-N8N-API-KEY': this.apiKey,
        };
    }

    // Função auxiliar para realizar as chamadas fetch
    async _fetch(path, options = {}) {
        const fullUrl = `${this.baseUrl}${path}`;
        
        const config = {
            ...options,
            headers: {
                ...this.headers,
                ...options.headers,
            },
        };
        // --- Faz a chamada fetch ---
        const response = await fetch(fullUrl, config);
        // --- Verifica se a resposta é ok ---
            if (!response.ok) {
            const errorText = await response.text();
            console.error(`❌ N8nAPI Error: ${response.status} ${response.statusText} em ${fullUrl}`, errorText);
            // Tenta fazer o parse do erro, se for JSON, senão usa o texto.
            try {
                const errorJson = JSON.parse(errorText);
                throw new Error(errorJson.message || `Erro na API do n8n: ${response.statusText}`); // --- Lança o erro ---
            } catch (e) {
                throw new Error(`Erro na API do n8n: ${response.statusText}`); // --- Lança o erro ---
            }
        }
        
        // --- Retorna o JSON apenas se o corpo da resposta não estiver vazio ---
        const text = await response.text();
        return text ? JSON.parse(text) : {}; // --- Retorna o JSON ---
    }

    // --- Métodos da API com caminhos corrigidos ---

    // --- Cria um workflow ---
    async createWorkflow(workflowData) {
        return this._fetch('/api/v1/workflows', {
            method: 'POST',
            body: JSON.stringify(workflowData),
        });
    }

    // --- Obtém todos os workflows ---
    async getWorkflows() {
        return this._fetch('/api/v1/workflows');
    }

    // --- Obtém um workflow específico ---
    async getWorkflow(workflowId) {
        return this._fetch(`/api/v1/workflows/${workflowId}`);
    }

    // --- Atualiza um workflow ---
    async updateWorkflow(workflowId, workflowData) {
        // A API de atualização do n8n espera um objeto contendo o nome, os nós e as conexões.
        // Filtramos o objeto para enviar apenas o necessário.
        const updatePayload = {
            name: workflowData.name,
            nodes: workflowData.nodes,
            connections: workflowData.connections,
            settings: workflowData.settings,
        };
        // --- Faz a chamada fetch ---
        return this._fetch(`/api/v1/workflows/${workflowId}`, {
                method: 'PUT',
            body: JSON.stringify(updatePayload),
        });
    }

    // --- Deleta um workflow ---
    async deleteWorkflow(workflowId) {
        try {
            return await this._fetch(`/api/v1/workflows/${workflowId}`, { method: 'DELETE' });
        } catch (error) {
            if (error.message.includes('404') || error.message.includes('Not Found')) {
                console.warn(`⚠️  Workflow ${workflowId} não encontrado no n8n, provavelmente já foi deletado.`);
                return { success: true, message: 'Já deletado no n8n.' };
            }
            throw error;
        }
    }

    // --- Ativa ou desativa um workflow ---
    async updateWorkflowActiveStatus(workflowId, active) {
        const endpoint = active ? 'activate' : 'deactivate'; 
        return this._fetch(`/api/v1/workflows/${workflowId}/${endpoint}`, { method: 'POST' });
    }

    // --- Cria uma credencial ---
    async createCredential(credentialData) {
        return this._fetch(`/api/v1/credentials`, {
                method: 'POST',
            body: JSON.stringify(credentialData),
        });
    }

    // --- Busca todas as credenciais ---
    async getCredentials() {
        try {
            console.log("🔍 Tentando buscar credenciais com GET /api/v1/credentials...");
            return await this._fetch(`/api/v1/credentials`, { method: 'GET' });
        } catch (getError) {
            if (getError.message.includes('405')) {
                console.log("⚠️ GET não permitido. Tentando com POST /api/v1/credentials...");
                try {
                    // Se GET falhar com 405, tenta POST. Algumas versões do n8n usam POST para listar.
                    return await this._fetch(`/api/v1/credentials`, { method: 'POST' });
                } catch (postError) {
                    console.error("❌ Buscar credenciais com POST também falhou.", postError.message);
                    throw postError; // Lança o erro do POST
                }
            }
            console.error("❌ Erro ao buscar credenciais com GET.", getError.message);
            throw getError; // Lança o erro original do GET se não for 405
        }
    }

    // --- Atualiza uma credencial ---
    async updateCredential(credentialId, credentialData) {
        return this._fetch(`/api/v1/credentials/${credentialId}`, {
            method: 'PUT',
            body: JSON.stringify(credentialData),
        });
    }

    // --- Dispara um webhook ---
    async triggerWebhook(webhookPath) {
        // O webhookPath já vem formatado de server.js como /webhook/ID?params
        return this._fetch(webhookPath, { method: 'GET' });
    }
    
    // --- Lógica de Extração e Atualização de Prompts (Mantida como está) ---

    // --- Encontra um workflow pelo nome ---
    async findWorkflowByName(name) {
            const workflows = await this.getWorkflows();
            return workflows.data.find(workflow => 
                workflow.name && workflow.name.toLowerCase().includes(name.toLowerCase())
            );
    }
    
    // --- Extrai o prompt LLM de um workflow ---
    extractLLMPrompt(workflow) {
        // --- Extrai o prompt LLM de um workflow ---
        try {
            const nodes = workflow.nodes || []; // --- Obtém os nós do workflow ---
            const agentNodes = nodes.filter(node => // --- Filtra os nós que são agentes ---
                node.type === 'n8n-nodes-langchain.agent' || // --- Verifica se o nó é um agente Langchain ---
                node.type === 'n8n/n8n-nodes-langchain.agent' // --- Verifica se o nó é um agente Langchain ---
            );
            
            if (agentNodes.length === 0) return null; // --- Se não houver agentes, retorna null ---

            const targetNode = agentNodes.find(node => node.name?.toLowerCase().includes('secretária')) || agentNodes[0]; // --- Encontra o nó de secretária ---

            if (targetNode && targetNode.parameters) { // --- Se o nó de secretária existe e tem parâmetros ---
                 if (targetNode.parameters.options && targetNode.parameters.options.systemMessage) { // --- Se o nó de secretária tem um prompt ---
                    return targetNode.parameters.options.systemMessage; // --- Retorna o prompt ---
                }
                if (targetNode.parameters.text && !targetNode.parameters.text.includes('{{')) { // --- Se o nó de secretária tem um prompt ---
                    return targetNode.parameters.text; // --- Retorna o prompt ---
                }
            }
            return null; // --- Se não houver agente de secretária, retorna null ---
        } catch (error) {
            console.error('Erro ao extrair prompt LLM:', error); // --- Exibe o erro ---
            return null; // --- Retorna null ---
        }
    }

    // --- Atualiza o prompt LLM de um workflow ---
    updateLLMPrompt(workflow, newPrompt, agentName = 'Secretária') {
            const nodes = workflow.nodes || []; // --- Obtém os nós do workflow ---
            let targetNode = nodes.find(node => // --- Encontra o nó de secretária ---
            (node.type === 'n8n-nodes-langchain.agent' || node.type === '@n8n/n8n-nodes-langchain.agent') && // --- Verifica se o nó é um agente Langchain ---
            node.name?.toLowerCase().includes(agentName.toLowerCase()) // --- Verifica se o nome do nó é o mesmo que o agente ---
            );

            if (!targetNode) { // --- Se não houver nó de secretária, encontra o primeiro nó de secretária ---
                targetNode = nodes.find(node => // --- Encontra o primeiro nó de secretária ---
                    node.type === 'n8n-nodes-langchain.agent' || // --- Verifica se o nó é um agente Langchain ---
                    node.type === '@n8n/n8n-nodes-langchain.agent' // --- Verifica se o nó é um agente Langchain ---
                );
            }

            if (!targetNode) { // --- Se não houver nó de secretária, lança um erro ---
                throw new Error(`Nenhum agente Langchain encontrado no workflow`); // --- Lança um erro ---
            }

        if (!targetNode.parameters) targetNode.parameters = {}; // --- Se o nó de secretária não tem parâmetros, define parâmetros vazios ---

        if (targetNode.parameters.options && typeof targetNode.parameters.options === 'object') { // --- Se o nó de secretária tem opções ---
                targetNode.parameters.options.systemMessage = newPrompt; // --- Atualiza o prompt ---
            } else {
                    targetNode.parameters.text = newPrompt; // --- Atualiza o prompt ---
                }

            return workflow; // --- Retorna o workflow ---
    }

    // --- Salva o prompt LLM em um workflow ---
    async savePromptToWorkflow(workflowName, newPrompt, agentName = 'Secretária') {
            const workflow = await this.findWorkflowByName(workflowName); // --- Encontra o workflow pelo nome ---
            if (!workflow) { // --- Se não houver workflow, lança um erro ---
                throw new Error(`Workflow "${workflowName}" não encontrado`); // --- Lança um erro ---
            }

            const updatedWorkflow = this.updateLLMPrompt(workflow, newPrompt, agentName); // --- Atualiza o prompt ---
            
        await this.updateWorkflow(workflow.id, updatedWorkflow); // --- Atualiza o workflow ---
        
        return { success: true, workflowId: workflow.id }; // --- Retorna o workflow ---
    }
}

    module.exports = N8nAPI; // --- Exporta a classe ---
