// n8n API Configuration and Functions
const fetch = require('node-fetch');

class N8nAPI {
    // --- Construtor ---
    constructor(n8nUrl, apiKey = null) {
        if (!n8nUrl) throw new Error("A URL do n8n é obrigatória.");

        this.baseUrl = n8nUrl.endsWith('/') ? n8nUrl.slice(0, -1) : n8nUrl;
        this.apiKey = apiKey;
        this.headers = {
            'Content-Type': 'application/json',
        };
        
        if (this.apiKey) {
            this.headers['X-N8N-API-KEY'] = this.apiKey;
        }
    }

    // Método para atualizar a API key
    updateApiKey(newApiKey) {
        this.apiKey = newApiKey;
        if (newApiKey) {
            this.headers['X-N8N-API-KEY'] = newApiKey;
        } else {
            delete this.headers['X-N8N-API-KEY'];
        }
    }

    // Função auxiliar para realizar as chamadas fetch
    async _fetch(path, options = {}) {
        if (!this.apiKey) {
            throw new Error("API Key do n8n não configurada. Configure via frontend primeiro.");
        }

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
            let parsedMessage = '';
            try {
                const errorJson = JSON.parse(errorText || '{}');
                parsedMessage = errorJson.message || errorJson.error || '';
            } catch (_) {}
            const composed = `[${response.status}] ${response.statusText}${parsedMessage ? ` - ${parsedMessage}` : ''}${errorText && !parsedMessage ? ` - ${errorText.substring(0, 300)}` : ''}`;
            throw new Error(`Erro na API do n8n: ${composed}`);
        }
        
        // --- Retorna o JSON apenas se o corpo da resposta não estiver vazio ---
        const text = await response.text();
        return text ? JSON.parse(text) : {}; // --- Retorna o JSON ---
    }

    // --- Métodos da API com caminhos corrigidos ---

    // --- Método para listar nodes disponíveis ---
    async getAvailableNodes() {
        try {
            console.log("🔍 Verificando nodes disponíveis no N8N...");
            return await this._fetch('/api/v1/nodes');
        } catch (error) {
            console.warn("⚠️ Erro ao buscar nodes (endpoint pode não existir):", error.message);
            return [];
        }
    }

    // --- Método para verificar se um node específico está instalado ---
    async checkNodeInstalled(nodeName) {
        try {
            const nodes = await this.getAvailableNodes();
            const isInstalled = nodes.some(node => 
                node.name === nodeName || 
                node.packageName === nodeName ||
                (node.nodes && node.nodes.some(n => n.name === nodeName))
            );
            console.log(`📦 Node ${nodeName}: ${isInstalled ? '✅ Instalado' : '❌ Não encontrado'}`);
            return isInstalled;
        } catch (error) {
            console.error(`❌ Erro ao verificar node ${nodeName}:`, error.message);
            return false;
        }
    }

    // --- Método para instalar node via API do N8N ---
    async installNode(packageName) {
        try {
            console.log(`📦 Tentando instalar node: ${packageName}...`);
            
            // Primeira tentativa: endpoint direto de community packages
            try {
                const result = await this._fetch('/rest/community-packages', {
                    method: 'POST',
                    body: JSON.stringify({ name: packageName }),
                });
                console.log(`✅ Node ${packageName} instalado via API do N8N`);
                return { success: true, result };
            } catch (apiError1) {
                console.warn(`⚠️ Tentativa 1 falhou (${apiError1.message}). Tentando endpoint alternativo...`);
                
                // Segunda tentativa: endpoint settings
                try {
                    const result = await this._fetch('/api/v1/community-packages', {
                        method: 'POST',
                        body: JSON.stringify({ name: packageName }),
                    });
                    console.log(`✅ Node ${packageName} instalado via API alternativa do N8N`);
                    return { success: true, result };
                } catch (apiError2) {
                    console.warn(`⚠️ Tentativa 2 falhou (${apiError2.message}). Tentando instalação manual...`);
                    
                    // Terceira tentativa: usar endpoint de configurações
                    try {
                        const result = await this._fetch('/settings', {
                            method: 'POST',
                            body: JSON.stringify({ 
                                'community.packagesMissing': [packageName],
                                'community.packagesInstall': [packageName]
                            }),
                        });
                        console.log(`✅ Node ${packageName} adicionado à lista de instalação`);
                        return { success: true, result };
                    } catch (apiError3) {
                        console.error(`❌ Todas as tentativas de API falharam para ${packageName}`);
                        
                        // Retornar instruções para instalação manual
                        const instructions = this._getManualInstallInstructions(packageName);
                        console.log(`📋 Instruções de instalação manual:`);
                        instructions.forEach(instruction => console.log(`   ${instruction}`));
                        
                        return { 
                            success: false, 
                            message: `Node ${packageName} precisa ser instalado manualmente`,
                            instructions,
                            error: `API: ${apiError3.message}`
                        };
                    }
                }
            }
        } catch (error) {
            console.error(`❌ Erro crítico ao instalar node ${packageName}:`, error.message);
            throw error;
        }
    }

    // --- Método para gerar instruções de instalação manual ---
    _getManualInstallInstructions(packageName) {
        return [
            `🔧 INSTALAÇÃO MANUAL NECESSÁRIA:`,
            ``,
            `📦 Node: ${packageName}`,
            ``,
            `🐳 Para Docker/Docker-compose:`,
            `   1. Adicione ao docker-compose.yml:`,
            `      environment:`,
            `        - N8N_CUSTOM_EXTENSIONS=${packageName}`,
            `   2. Execute: docker-compose restart`,
            ``,
            `💻 Para instalação local:`,
            `   1. Execute: npm install ${packageName}`,
            `   2. Reinicie o N8N`,
            ``,
            `🌐 Via Interface N8N:`,
            `   1. Vá em Settings → Community nodes`,
            `   2. Clique "Install a community node"`,
            `   3. Digite: ${packageName}`,
            `   4. Clique "Install"`
        ];
    }

    // --- Método para verificar e instalar nodes necessários ---
    async ensureRequiredNodes() {
        const requiredNodes = [
            { package: '@devlikeapro/n8n-nodes-chatwoot', node: 'ChatWoot' },
            { package: 'n8n-nodes-evolution-api', node: 'EvolutionAPI' }
        ];

        const results = [];
        
        for (const { package: pkg, node } of requiredNodes) {
            console.log(`\n🔍 Verificando node: ${pkg}`);
            
            const isInstalled = await this.checkNodeInstalled(node);
            
            if (!isInstalled) {
                console.log(`❌ Node ${node} não encontrado. Tentando instalar...`);
                try {
                    const installResult = await this.installNode(pkg);
                    results.push({ 
                        package: pkg, 
                        node, 
                        installed: installResult.success || false,
                        result: installResult 
                    });
                } catch (error) {
                    results.push({ 
                        package: pkg, 
                        node, 
                        installed: false, 
                        error: error.message 
                    });
                }
            } else {
                results.push({ 
                    package: pkg, 
                    node, 
                    installed: true, 
                    alreadyPresent: true 
                });
            }
        }

        return results;
    }

    // --- Cria um workflow (com fallback /rest) ---
    async createWorkflow(workflowData) {
        try {
            return await this._fetch('/api/v1/workflows', {
                method: 'POST',
                body: JSON.stringify(workflowData),
            });
        } catch (error) {
            if (error.message.includes('Not Found') || error.message.includes('404') || error.message.includes('405')) {
                console.warn('⚠️ createWorkflow via /api/v1 falhou. Tentando /rest/workflows...');
                return await this._fetch('/rest/workflows', {
                    method: 'POST',
                    body: JSON.stringify(workflowData),
                });
            }
            throw error;
        }
    }

    // --- Obtém todos os workflows (com fallback para /rest) ---
    async getWorkflows() {
        try {
            return await this._fetch('/api/v1/workflows');
        } catch (error) {
            // Fallback para versões antigas
            if (error.message.includes('Not Found') || error.message.includes('404') || error.message.includes('405')) {
                console.warn('⚠️ getWorkflows via /api/v1 falhou. Tentando /rest/workflows...');
                return await this._fetch('/rest/workflows');
            }
            throw error;
        }
    }

    // --- Obtém um workflow específico ---
    async getWorkflow(workflowId) {
        try {
            console.log(`🔍 [N8N-API] Buscando workflow ${workflowId} em ${this.baseUrl}`);
            let result = await this._fetch(`/api/v1/workflows/${workflowId}`);
            console.log(`📊 [N8N-API] Workflow obtido (api/v1):`, result ? 'ok' : 'null');
            return result;
        } catch (error) {
            // Fallback para versões antigas
            if (error.message.includes('Not Found') || error.message.includes('404') || error.message.includes('405')) {
                console.warn(`⚠️ [N8N-API] /api/v1 falhou (${error.message}). Tentando /rest/workflows/${workflowId}...`);
                const result = await this._fetch(`/rest/workflows/${workflowId}`);
                console.log(`📊 [N8N-API] Workflow obtido (rest):`, result ? 'ok' : 'null');
                return result;
            }
            console.error(`❌ [N8N-API] Erro ao buscar workflow ${workflowId}:`, error.message);
            throw error;
        }
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
        // --- Faz a chamada fetch com fallback ---
        try {
            return await this._fetch(`/api/v1/workflows/${workflowId}`, {
                method: 'PUT',
                body: JSON.stringify(updatePayload),
            });
        } catch (error) {
            if (error.message.includes('Not Found') || error.message.includes('404') || error.message.includes('405')) {
                console.warn('⚠️ updateWorkflow via /api/v1 falhou. Tentando /rest/workflows...');
                return await this._fetch(`/rest/workflows/${workflowId}`, {
                    method: 'PUT',
                    body: JSON.stringify(updatePayload),
                });
            }
            throw error;
        }
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

    // --- Cria uma credencial (com fallback /rest)
    async createCredential(credentialData) {
        try {
            return await this._fetch(`/api/v1/credentials`, {
                method: 'POST',
                body: JSON.stringify(credentialData),
            });
        } catch (error) {
            if (error.message.includes('Not Found') || error.message.includes('404') || error.message.includes('405')) {
                console.warn('⚠️ createCredential via /api/v1 falhou. Tentando /rest/credentials...');
                return await this._fetch(`/rest/credentials`, {
                    method: 'POST',
                    body: JSON.stringify(credentialData),
                });
            }
            throw error;
        }
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
                    // Tentar fallback para /rest
                    console.log("⚠️ Tentando fallback /rest/credentials...");
                    try {
                        return await this._fetch(`/rest/credentials`, { method: 'GET' });
                    } catch (restError) {
                        throw postError; // preserva o erro anterior
                    }
                }
            }
            console.error("❌ Erro ao buscar credenciais com GET.", getError.message);
            // Tentar fallback /rest direto
            if (getError.message.includes('Not Found') || getError.message.includes('404')) {
                console.log("⚠️ Tentando fallback /rest/credentials após erro 404...");
                return await this._fetch(`/rest/credentials`, { method: 'GET' });
            }
            throw getError; // Lança o erro original do GET se não for 404/405
        }
    }

    // --- Atualiza uma credencial ---
    async updateCredential(credentialId, credentialData) {
        try {
            return await this._fetch(`/api/v1/credentials/${credentialId}`, {
                method: 'PUT',
                body: JSON.stringify(credentialData),
            });
        } catch (error) {
            if (error.message.includes('Not Found') || error.message.includes('404') || error.message.includes('405')) {
                console.warn('⚠️ updateCredential via /api/v1 falhou. Tentando /rest/credentials...');
                return await this._fetch(`/rest/credentials/${credentialId}`, {
                    method: 'PUT',
                    body: JSON.stringify(credentialData),
                });
            }
            throw error;
        }
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
        const nodes = workflow.nodes || [];

        let updatedAny = false;

        // 1) Atualizar nós de Agent (Langchain Agent)
        const agentNodes = nodes.filter(node =>
            (node.type === 'n8n-nodes-langchain.agent' || node.type === '@n8n/n8n-nodes-langchain.agent')
            && (agentName ? (node.name?.toLowerCase().includes(agentName.toLowerCase()) || true) : true)
        );

        for (const agentNode of agentNodes) {
            if (!agentNode.parameters) agentNode.parameters = {};
            if (agentNode.parameters.options && typeof agentNode.parameters.options === 'object') {
                agentNode.parameters.options.systemMessage = newPrompt;
            } else {
                // Alguns agentes usam o campo text como instrução
                agentNode.parameters.text = newPrompt;
            }
            updatedAny = true;
        }

        // 2) Atualizar nós de Chat Model (OpenAI, Google Gemini etc.)
        const chatModelNodes = nodes.filter(node =>
            typeof node.type === 'string' && node.type.includes('.lmChat')
        );

        for (const modelNode of chatModelNodes) {
            if (!modelNode.parameters) modelNode.parameters = {};
            // Alguns modelos usam parameters.systemMessage; outros usam parameters.options.systemMessage
            if (modelNode.parameters.options && typeof modelNode.parameters.options === 'object') {
                modelNode.parameters.options.systemMessage = newPrompt;
            }
            modelNode.parameters.systemMessage = newPrompt;
            updatedAny = true;
        }

        if (!updatedAny) {
            throw new Error(`Nenhum nó compatível para receber o prompt foi encontrado`);
        }

        return workflow;
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

    // --- Analisa workflow para detectar configurações necessárias ---
    async analyzeWorkflowConfiguration(workflowId) {
        try {
            console.log(`🔍 [N8N-API] Buscando workflow ${workflowId}...`);
            const workflow = await this.getWorkflow(workflowId);
            console.log(`📊 [N8N-API] Workflow encontrado:`, workflow ? `${workflow.name} (${workflow.nodes?.length || 0} nodes)` : 'null');
            
            if (!workflow) {
                throw new Error(`Workflow ${workflowId} não encontrado`);
            }

            const analysis = {
                workflowId,
                workflowName: workflow.name,
                nodesRequiringCredentials: [],
                aiAgentNodes: [],
                currentPrompt: null,
                promptStructure: {
                    personalidade: '',
                    papel: '',
                    mensagemBoasVindas: '',
                    mensagemFinalizacao: '',
                    configuracoesPadrao: {
                        exibirHoraData: true,
                        identificarNumeroCliente: true
                    }
                },
                webhookConfig: null,
                memoryConfig: null
            };

            const nodes = workflow.nodes || [];
            console.log(`🔍 [N8N-API] Analisando ${nodes.length} nodes...`);

            for (const node of nodes) {
                console.log(`📝 [N8N-API] Analisando node: ${node.name} (${node.type})`);
                
                // Detectar nodes que precisam de credenciais
                if (node.credentials && Object.keys(node.credentials).length > 0) {
                    console.log(`🔑 [N8N-API] Node ${node.name} tem credenciais:`, Object.keys(node.credentials));
                    analysis.nodesRequiringCredentials.push({
                        id: node.id,
                        name: node.name,
                        type: node.type,
                        credentials: Object.keys(node.credentials),
                        currentCredentials: node.credentials
                    });
                }

                // Detectar nodes de AI Agent
                if (node.type === 'n8n-nodes-langchain.agent' || 
                    node.type === '@n8n/n8n-nodes-langchain.agent') {
                    analysis.aiAgentNodes.push({
                        id: node.id,
                        name: node.name,
                        type: node.type,
                        parameters: node.parameters
                    });

                    // Extrair prompt atual
                    try {
                        const currentPrompt = this.extractLLMPrompt(workflow);
                        if (currentPrompt) {
                            console.log(`💬 [N8N-API] Prompt encontrado no node ${node.name}`);
                            analysis.currentPrompt = currentPrompt;
                            analysis.promptStructure = this.parsePromptStructure(currentPrompt);
                        }
                    } catch (promptError) {
                        console.warn(`⚠️ [N8N-API] Erro ao extrair prompt:`, promptError.message);
                    }
                }

                // Detectar configurações de webhook
                if (node.type === 'n8n-nodes-base.webhook') {
                    analysis.webhookConfig = {
                        id: node.id,
                        name: node.name,
                        path: node.parameters?.path || '',
                        httpMethod: node.parameters?.httpMethod || 'GET'
                    };
                }

                // Detectar configurações de memória
                if (node.type === 'n8n-nodes-langchain.memoryVectorStore' ||
                    node.name?.toLowerCase().includes('memory')) {
                    analysis.memoryConfig = {
                        id: node.id,
                        name: node.name,
                        type: node.type,
                        parameters: node.parameters
                    };
                }
            }

            console.log(`✅ [N8N-API] Análise completa:`, {
                nodesRequiringCredentials: analysis.nodesRequiringCredentials.length,
                aiAgentNodes: analysis.aiAgentNodes.length,
                hasWebhook: !!analysis.webhookConfig,
                hasMemory: !!analysis.memoryConfig
            });

            return analysis;
        } catch (error) {
            console.error('❌ [N8N-API] Erro ao analisar workflow:', error);
            console.error('❌ [N8N-API] Stack trace:', error.stack);
            throw error;
        }
    }

    // --- Parsing estruturado do prompt ---
    parsePromptStructure(promptText) {
        const structure = {
            personalidade: '',
            papel: '',
            mensagemBoasVindas: '',
            mensagemFinalizacao: '',
            configuracoesPadrao: {
                exibirHoraData: true,
                identificarNumeroCliente: true
            }
        };

        if (!promptText) return structure;

        // Patterns para extrair seções específicas
        const patterns = {
            personalidade: /(?:personalidade|personality):\s*(.*?)(?=\n(?:papel|role|mensagem)|$)/is,
            papel: /(?:papel|role):\s*(.*?)(?=\n(?:personalidade|personality|mensagem)|$)/is,
            mensagemBoasVindas: /(?:mensagem de boas.vindas|welcome message|boas.vindas):\s*(.*?)(?=\n(?:mensagem de|personalidade|papel)|$)/is,
            mensagemFinalizacao: /(?:mensagem de finalização|mensagem quando finalizar|closing message|finalização):\s*(.*?)(?=\n(?:personalidade|papel|mensagem de boas)|$)/is
        };

        // Extrair cada seção
        for (const [key, pattern] of Object.entries(patterns)) {
            const match = promptText.match(pattern);
            if (match && match[1]) {
                structure[key] = match[1].trim();
            }
        }

        // Verificar configurações padrão
        structure.configuracoesPadrao.exibirHoraData = promptText.includes('hora') || promptText.includes('data');
        structure.configuracoesPadrao.identificarNumeroCliente = promptText.includes('número') || promptText.includes('cliente');

        return structure;
    }

    // --- Salvar prompt estruturado ---
    async saveStructuredPrompt(workflowId, promptStructure) {
        try {
            // Montar parte estática do prompt estruturado (sem expressões)
            let staticPart = '';

            if (promptStructure.personalidade) {
                staticPart += `**PERSONALIDADE:**\n${promptStructure.personalidade}\n\n`;
            }

            if (promptStructure.papel) {
                staticPart += `**PAPEL:**\n${promptStructure.papel}\n\n`;
            }

            if (promptStructure.mensagemBoasVindas) {
                staticPart += `**MENSAGEM DE BOAS-VINDAS:**\n${promptStructure.mensagemBoasVindas}\n\n`;
            }

            if (promptStructure.mensagemFinalizacao) {
                staticPart += `**MENSAGEM QUANDO FINALIZAR UM ATENDIMENTO:**\n${promptStructure.mensagemFinalizacao}\n\n`;
            }

            // Flags para controle de contexto dinâmico
            const flagHoraData = !!(promptStructure.configuracoesPadrao && promptStructure.configuracoesPadrao.exibirHoraData);
            const flagIdentificar = !!(promptStructure.configuracoesPadrao && promptStructure.configuracoesPadrao.identificarNumeroCliente);

            // Para garantir avaliação de expressões mesmo que o campo não suporte inline, definimos TODO o conteúdo como expressão (=)
            // A expressão abaixo constrói a string completa com valores já resolvidos (data/hora, telefone normalizado e id da conversa)
            let structuredPrompt = `={{ (() => {\n` +
                `  let out = ${JSON.stringify(staticPart)};\n` +
                `  const exibirHora = ${flagHoraData ? 'true' : 'false'};\n` +
                `  const identificar = ${flagIdentificar ? 'true' : 'false'};\n` +
                `  if (exibirHora || identificar) {\n` +
                `    out += '**CONTEXTOS DINÂMICOS (não exibir automaticamente):**\\n';\n` +
                `    if (exibirHora) {\n` +
                `      const agora = $now.format('FFFF');\n` +
                `      out += 'HOJE É: ' + agora + '\\n';\n` +
                `    }\n` +
                `    if (identificar) {\n` +
                `      const telRaw = ($('Normalizar Telefone').item.json.telefone || $('Info').item.json.telefone || $json.body?.conversation?.meta?.sender?.phone || $json.body?.sender?.phone || $json.body?.contact?.phone || '');\n` +
                `      const digits = String(telRaw || '').replace(/\\D+/g, '');\n` +
                `      const withCountry = digits ? (digits.startsWith('55') ? digits : ('55' + digits)) : '';\n` +
                `      const telefone = withCountry ? ('+' + withCountry) : '';\n` +
                `      const idConversa = ($('Info').item.json.id_conversa || $json.body?.conversation?.id || $json.body?.conversation_id || '');\n` +
                `      out += 'TELEFONE DO CONTATO: ' + (telefone || 'não identificado') + '\\n';\n` +
                `      out += 'ID DA CONVERSA: ' + (idConversa || 'não identificado') + '\\n';\n` +
                `    }\n` +
                `    out += '\\nUse essas informações apenas quando solicitado ou relevante. Não exiba por padrão.\\n\\n';\n` +
                `  }\n` +
                `  return out;\n` +
                `})() }}`;

            const workflow = await this.getWorkflow(workflowId);
            if (!workflow) {
                throw new Error(`Workflow ${workflowId} não encontrado`);
            }

            const updatedWorkflow = this.updateLLMPrompt(workflow, structuredPrompt);
            await this.updateWorkflow(workflowId, updatedWorkflow);

            return { success: true, prompt: structuredPrompt };
        } catch (error) {
            console.error('❌ Erro ao salvar prompt estruturado:', error);
            throw error;
        }
    }
}

    module.exports = N8nAPI; // --- Exporta a classe ---
