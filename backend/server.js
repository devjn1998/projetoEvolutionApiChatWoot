// Importa os módulos necessários
const path = require("path");
// Carrega variáveis do .env (se existir) e, em seguida, de evolution.env como fallback
require("dotenv").config({ path: path.join(__dirname, "../.env") });
require("dotenv").config({ path: path.join(__dirname, "../evolution.env") });
const express = require("express"); // --- Importa o express ---
const cors = require("cors"); // --- Importa o cors ---
const fetch = require("node-fetch"); // --- Importa o node-fetch ---
const Database = require("./database"); // --- Importa o database ---
const N8nAPI = require("./n8n-api.js"); // --- Importa o n8n-api ---
const bcrypt = require("bcrypt"); // --- Para hash de senhas ---
const jwt = require("jsonwebtoken"); // --- Para tokens JWT ---
const crypto = require("crypto"); // --- Para gerar tokens ---
const QRCode = require("qrcode"); // --- Para gerar QR codes ---

const app = express(); // --- Cria o app ---
const PORT = 3001; // --- Define a porta ---

// --- Configs a partir do .env ---
// Força uso de uma única instância N8N
const FORCED_N8N_URL = "https://auto.criard.me";
// API key fixa da instância única
const FORCED_N8N_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI0ZTA5ZTA0NC1mMzA3LTRkNWUtODBjZS1iNWQzYjZiOWIyYjMiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzU0OTI3MzEyLCJleHAiOjE3NTc0NzMyMDB9.PyWl2pVSWIaRNOKNXe5a1Rxj26c0BDfdcPEztec2mpk";
const DEFAULT_N8N_URL = FORCED_N8N_URL; // ignora env para padronizar
const LOCAL_API_URL_FOR_N8N = `http://localhost:${PORT}`; // --- Define a URL local da API do n8n ---

  // --- Cria instância global do N8N API ---
const n8nApi = new N8nAPI(DEFAULT_N8N_URL, null);

// Variáveis globais controladas para estado do N8N (evita ReferenceError)
let currentN8nApiKey = FORCED_N8N_API_KEY;
let currentN8nUrl = DEFAULT_N8N_URL;

// Função para atualizar API key e URL do N8N
function updateN8nApiKey(apiKey, instanceUrl = null) {
  if (instanceUrl) {
    // sempre força a URL fixa
    n8nApi.baseUrl = FORCED_N8N_URL;
  }
  n8nApi.updateApiKey(apiKey);
  
  console.log(`🔄 N8N API atualizada: ${n8nApi.baseUrl} ${apiKey ? '(com API key)' : '(sem API key)'}`);
}

// Inicializa backend já conectado à instância fixa
updateN8nApiKey(FORCED_N8N_API_KEY, FORCED_N8N_URL);

// Função para carregar configuração do N8N do banco de dados
async function loadN8nConfigFromDB(userId) {
  try {
    const config = await db.getN8nConfig(userId);
    if (config) {
      updateN8nApiKey(config.api_key, config.instance_url);
      console.log(`📋 Configuração N8N carregada do banco: ${config.instance_url}`);
      return config;
    }
    return null;
  } catch (error) {
    console.error('❌ Erro ao carregar configuração N8N do banco:', error.message);
    return null;
  }
}

// Middleware para autenticação por API Key
function authenticateApiKey(req, res, next) {
  const apiKey =
    req.headers["x-api-key"] || req.headers["api-key"] || req.query.api_key;

  if (!apiKey) {
    return res.status(401).json({
      success: false,
      error: "API Key é obrigatória para acessar este endpoint",
    });
  }

  // Verifica se a API key fornecida é a mesma que está sendo usada pelo backend
  if (apiKey !== n8nApi.apiKey) {
    return res.status(403).json({
      success: false,
      error: "API Key inválida ou não sincronizada",
    });
  }

  next();
}

// Middleware híbrido que aceita tanto API Key quanto JWT Token
function authenticateApiKeyOrToken(req, res, next) {
  // Tentar primeiro com API Key
  const apiKey = req.headers["x-api-key"] || req.headers["api-key"] || req.query.api_key;
  
  if (apiKey && apiKey === n8nApi.apiKey) {
    return next();
  }
  
  // Se não tem API Key válida, tentar com JWT Token
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  
  if (!token) {
    return res.status(401).json({ 
      success: false, 
      error: "API Key ou Token de acesso requerido" 
    });
  }
  
  const jwt = require("jsonwebtoken");
  jwt.verify(token, process.env.JWT_SECRET || "default-secret", (err, user) => {
    if (err) {
      return res.status(403).json({ 
        success: false, 
        error: "Token inválido" 
      });
    }
    req.user = user;
    next();
  });
}

// Função para testar API key em uma instância N8N específica
async function testN8nInstance(instanceUrl, apiKey) {
  console.log(`🔍 Testando API key na instância: ${instanceUrl}`);
  
  try {
    // Normalizar URL (remover barra final se houver)
    const normalizedUrl = instanceUrl.endsWith('/') ? instanceUrl.slice(0, -1) : instanceUrl;
    
    // Testar endpoint de workflows
    const response = await fetch(`${normalizedUrl}/api/v1/workflows`, {
      method: "GET",
      headers: {
        "X-N8N-API-KEY": apiKey,
        "Content-Type": "application/json",
      },
      timeout: 10000,
    });

    if (response.ok) {
      const data = await response.json();
      console.log(`✅ API key válida na instância: ${normalizedUrl}`);
      console.log(`📊 Encontrados ${data.data ? data.data.length : 0} workflows`);
      return { 
        url: normalizedUrl, 
        workflows: data.data || [],
        success: true 
      };
    } else {
      const errorText = await response.text();
      console.log(`❌ API key inválida na instância: ${normalizedUrl} (${response.status})`);
      return { 
        success: false, 
        error: `API key inválida: ${response.status} ${response.statusText}`,
        details: errorText
      };
    }
  } catch (error) {
    console.log(`❌ Erro ao conectar com ${instanceUrl}: ${error.message}`);
    return { 
      success: false, 
      error: `Erro de conexão: ${error.message}` 
    };
  }
}

// Função para atualizar a API key e URL do n8n
function updateN8nApiKey(newApiKey, newUrl = null) {
  // Persistir estado global seguro
  currentN8nApiKey = newApiKey || null;
  if (newUrl && newUrl !== currentN8nUrl) {
    currentN8nUrl = newUrl;
    console.log(`🌐 URL do N8N atualizada para: ${currentN8nUrl}`);
  }

  // Atualizar instância existente sem reatribuir o const
  if (n8nApi) {
    n8nApi.baseUrl = currentN8nUrl;
    n8nApi.updateApiKey(currentN8nApiKey);
  }

  const keyPreview = currentN8nApiKey ? `${currentN8nApiKey.substring(0, 20)}...` : 'removida';
  console.log(`🔑 API Key do n8n atualizada: ${keyPreview}`);
}

let db = null; // --- Define o banco de dados ---

async function main() {
  // --- Inicia a aplicação ---
  // 1. Inicializa o Banco de Dados
  try {
    // --- Tenta inicializar o banco de dados ---
    console.log("🚀 Iniciando aplicação..."); // --- Exibe uma mensagem de sucesso ---
    db = new Database(); // --- Cria o banco de dados ---
    await db.init(); // --- A inicialização agora é aguardada aqui. ---
  } catch (error) {
    // --- Se houver um erro, exibe uma mensagem de erro ---
    console.error(
      "❌ Erro fatal: Não foi possível conectar ao banco de dados. O servidor não será iniciado.", // --- Exibe uma mensagem de erro ---
      error.message // --- Exibe a mensagem de erro ---
    );
    process.exit(1); // Encerra a aplicação se o DB falhar.
  }

  // 2. Inicializa outros serviços (se o DB estiver OK)
  console.log(`🔗 N8N configurado inicialmente em: ${n8nApi.baseUrl}`);
  console.log(`⚠️ Configuração específica será carregada do banco de dados conforme usuário`);
  console.log("✅ Serviços de API inicializados."); // --- Exibe uma mensagem de sucesso ---

  // 3. Configura Middlewares
  app.use(
    cors({
      origin: true, // Permite qualquer origem durante desenvolvimento
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: [
        "Content-Type",
        "Authorization",
        "api_access_token",
        "x-api-key",
        "api-key",
      ],
      credentials: true,
      preflightContinue: false,
      optionsSuccessStatus: 200,
    })
  ); // --- Configura o cors ---
  app.use(express.json()); // --- Configura o express.json ---

  // 4. Configura as Rotas
  setupRoutes(app); // --- Configura as rotas ---

  // 5. Inicia o Servidor
  app.listen(PORT, () => {
    // --- Inicia o servidor ---
    console.log(`✅ Servidor escutando em http://localhost:${PORT}`); // --- Exibe uma mensagem de sucesso ---
  });
}

function setupRoutes(app) {
  // --- Configura as rotas ---
  console.log("🔧 Configurando rotas da aplicação..."); // --- Exibe uma mensagem de sucesso ---

  // --- Rotas da API ---

  // Sincronização do n8n com o banco de dados
  app.post("/api/sync-n8n-to-db", authenticateApiKeyOrToken, async (req, res) => {
    // --- Sincroniza os workflows ---
    try {
      // --- Tenta sincronizar os workflows ---
      const workflows = await n8nApi.getWorkflows(); // --- Obtém os workflows ---
      await db.syncAllWorkflows(workflows.data || []); // --- Sincroniza os workflows ---
      res
        .status(200)
        .json({ success: true, message: "Workflows sincronizados." }); // --- Exibe uma mensagem de sucesso ---
    } catch (error) {
      // --- Se houver um erro, exibe uma mensagem de erro ---
      console.error("❌ Erro detalhado em /api/sync-n8n-to-db:", error); // --- Exibe uma mensagem de erro ---
      res.status(500).json({
        success: false,
        error: "Erro interno no servidor durante a sincronização.",
      }); // --- Exibe uma mensagem de erro ---
    }
  });

  // Rota para obter todos os workflows do banco de dados
  app.get("/api/db/workflows", authenticateApiKeyOrToken, async (req, res) => {
    try {
      const userId = req.user?.userId || null;
      const data = await db.getWorkflows(userId);
      res.status(200).json({ success: true, data });
    } catch (error) {
      console.error("❌ Erro ao listar workflows:", error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Rota para obter um workflow específico do banco de dados
  app.get("/api/db/workflows/:id", authenticateApiKeyOrToken, async (req, res) => {
    try {
      const userId = req.user?.userId || null;
      const workflow = await db.getWorkflowWithAgents(req.params.id);
      if (!workflow) {
        return res.status(404).json({ success: false, error: "Workflow not found" });
      }
      if (userId && workflow.owner_user_id && workflow.owner_user_id !== userId) {
        return res.status(403).json({ success: false, error: "Forbidden" });
      }
      console.log(`🔍 Buscando credenciais para o workflow '${workflow.name}' no banco de dados local...`);
        workflow.credentials = await db.getCredentials(req.params.id);
        console.log("✅ Credenciais carregadas do banco de dados local.");
        res.status(200).json({ success: true, data: workflow });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Rota para atualizar um workflow específico do banco de dados
  app.put("/api/db/workflows/:id", authenticateApiKeyOrToken, async (req, res) => {
    // --- Atualiza um workflow específico ---
    const { id } = req.params; // --- Obtém o ID do workflow ---
    const { name, active } = req.body; // --- Obtém o nome e o status do workflow ---
    try {
      // Ownership check
      const wf = await db.getWorkflowWithAgents(id);
      if (!wf) return res.status(404).json({ success: false, error: 'Workflow not found' });
      if (wf.owner_user_id && wf.owner_user_id !== req.user?.userId) {
        return res.status(403).json({ success: false, error: 'Forbidden' });
      }
      // --- Tenta atualizar o workflow ---
      if (name !== undefined) {
        // --- Se o nome do workflow existe, atualiza o nome ---
        await db.updateWorkflowName(id, name); // --- Atualiza o nome do workflow ---
      }
      if (active !== undefined) {
        // --- Se o status do workflow existe, atualiza o status ---
        const result = await db.toggleWorkflowStatus(id); // --- Alterna o status do workflow ---
        await n8nApi.updateWorkflowActiveStatus(id, result.active); // --- Atualiza o status do workflow no n8n ---
      }
      res.status(200).json({ success: true, message: "Workflow atualizado." }); // --- Exibe uma mensagem de sucesso ---
    } catch (error) {
      // --- Se houver um erro, exibe uma mensagem de erro ---
      res.status(500).json({ success: false, error: error.message }); // --- Exibe uma mensagem de erro ---
    }
  });

  // Rota para salvar as credenciais de um workflow
  app.post(
    "/api/db/credentials/:workflowId",
    authenticateApiKeyOrToken,
    async (req, res) => {
      try {
        const { workflowId } = req.params;
        const { credentials } = req.body;
        await db.saveCredentials(workflowId, credentials);
        res
          .status(200)
          .json({ success: true, message: "Credenciais salvas com sucesso." });
      } catch (error) {
        console.error("❌ Erro ao salvar credenciais:", error);
        res.status(500).json({
          success: false,
          error: "Erro interno ao salvar credenciais.",
        });
      }
    }
  );

  // Rota para deletar um workflow específico do banco de dados
  app.delete("/api/db/workflows/:id", authenticateApiKeyOrToken, async (req, res) => {
    // --- Deleta um workflow específico ---
    try {
      // Ownership check
      const wf = await db.getWorkflowWithAgents(req.params.id);
      if (!wf) return res.status(404).json({ success: false, error: 'Workflow not found' });
      if (wf.owner_user_id && wf.owner_user_id !== req.user?.userId) {
        return res.status(403).json({ success: false, error: 'Forbidden' });
      }
      // --- Tenta deletar o workflow ---
      await n8nApi.deleteWorkflow(req.params.id); // --- Deleta o workflow no n8n ---
      await db.deleteWorkflowAndAgents(req.params.id); // --- Deleta o workflow no banco de dados ---
      res.status(200).json({ success: true, message: "Workflow deletado." }); // --- Exibe uma mensagem de sucesso ---
    } catch (error) {
      // --- Se houver um erro, exibe uma mensagem de erro ---
      res.status(500).json({
        success: false,
        error: "Falha ao deletar workflow.",
        details: error.message,
      }); // --- Exibe uma mensagem de erro ---
    }
  });

  // Rota para atualizar um agente específico do banco de dados
  app.put("/api/db/agents/:id", async (req, res) => {
    // --- Atualiza um agente específico ---
    try {
      // --- Tenta atualizar o agente ---
      const { name, prompt } = req.body; // --- Obtém o nome e o prompt do agente ---
      if (name !== undefined) await db.updateAgentName(req.params.id, name); // --- Se o nome do agente existe, atualiza o nome ---
      if (prompt !== undefined)
        await db.updateAgentPrompt(req.params.id, prompt); // --- Se o prompt do agente existe, atualiza o prompt ---
      res.status(200).json({ success: true, message: "Agente atualizado." }); // --- Exibe uma mensagem de sucesso ---
    } catch (error) {
      // --- Se houver um erro, exibe uma mensagem de erro ---
      res.status(400).json({ success: false, error: error.message }); // --- Exibe uma mensagem de erro ---
    }
  });

  app.post(
    "/api/db/agents/:id/sync-n8n",
    authenticateApiKey,
    async (req, res) => {
      // --- Sincroniza um agente específico com o n8n ---
      try {
        // --- Tenta sincronizar o agente ---
        const { prompt, workflowId, agentName } = req.body; // --- Obtém o prompt, o ID do workflow e o nome do agente ---
        const workflowFromDb = await db.getWorkflowWithAgents(workflowId); // --- Obtém o workflow do banco de dados ---
        if (!workflowFromDb)
          throw new Error(
            "Workflow não encontrado no DB local para sincronizar."
          ); // --- Se o workflow não existe, lança um erro ---

        const n8nWorkflow = await n8nApi.getWorkflow(workflowId); // --- Obtém o workflow no n8n ---
        const updatedN8nWorkflow = n8nApi.updateLLMPrompt(
          n8nWorkflow,
          prompt,
          agentName
        ); // --- Atualiza o prompt do agente no n8n ---

        await n8nApi.updateWorkflow(workflowId, updatedN8nWorkflow); // --- Atualiza o workflow no n8n ---

        const finalWorkflowState = await n8nApi.getWorkflow(workflowId); // --- Obtém o workflow no n8n ---
        await db.syncAllWorkflows([finalWorkflowState]); // --- Sincroniza o workflow no banco de dados ---

        res
          .status(200)
          .json({ success: true, message: "Prompt sincronizado com o n8n." }); // --- Exibe uma mensagem de sucesso ---
      } catch (error) {
        // --- Se houver um erro, exibe uma mensagem de erro ---
        console.error("❌ Erro ao sincronizar prompt:", error); // --- Exibe uma mensagem de erro ---
        res.status(500).json({ success: false, error: error.message }); // --- Exibe uma mensagem de erro ---
      }
    }
  );

  app.post(
    "/api/create-workflow-with-credentials",
    authenticateApiKeyOrToken,
    async (req, res) => {
      // --- Cria um workflow com credenciais ---
      const { workflowName, credentials, templateType } = req.body; // --- Inclui templateType para escolher o modelo de agente ---

      if (!workflowName || !credentials) {
        // --- Se o nome do workflow ou as credenciais não existem, exibe uma mensagem de erro ---
        return res.status(400).json({
          success: false,
          error: "Dados insuficientes para criar workflow e credenciais.",
        }); // --- Exibe uma mensagem de erro ---
      }

      try {
        // --- Tenta criar o workflow ---
        console.log("🔄 Iniciando criação de workflow e credenciais...");
        console.log(
          "📊 Dados recebidos:",
          JSON.stringify({ workflowName, credentials }, null, 2)
        );

        // Detectar tipos de credenciais baseado nos nodes instalados
        console.log("🔍 Detectando tipos de credenciais disponíveis...");
        const credentialTypes = await detectCredentialTypes();
        console.log("📋 Tipos de credenciais a usar:", credentialTypes);

        console.log("1. Criando credencial do Chatwoot..."); // --- Exibe uma mensagem de sucesso ---
        const chatwootCredData = {
          name: `Chatwoot Credential for ${workflowName}`, // --- Define o nome da credencial ---
          type: credentialTypes.chatwoot, // --- Tipo detectado dinamicamente ---
          data: credentialTypes.chatwoot === "chatwootApi" ? {
            // Dados específicos para node do Chatwoot
            baseUrl: credentials.chatwoot.apiUrl,
            accessToken: credentials.chatwoot.accessToken,
          } : {
            // Dados genéricos para httpHeaderAuth
            name: "api_access_token",
            value: credentials.chatwoot.accessToken,
          },
        };
        console.log(
          "   📝 Dados da credencial Chatwoot:",
          JSON.stringify(chatwootCredData, null, 2)
        );

        let chatwootCred;
        try {
          chatwootCred = await n8nApi.createCredential(chatwootCredData); // --- Cria a credencial do Chatwoot ---
        console.log(`   ✅ Chatwoot Cred ID: ${chatwootCred.id}`); // --- Exibe uma mensagem de sucesso ---
        } catch (chatwootError) {
          console.error("❌ Erro ao criar credencial Chatwoot:", chatwootError);
          throw new Error(`Falha ao criar credencial Chatwoot: ${chatwootError.message}`);
        }

        console.log("2. Criando credencial do Google Gemini..."); // --- Exibe uma mensagem de sucesso ---
        const geminiCredData = {
          name: `Gemini Credential for ${workflowName}`, // --- Define o nome da credencial ---
          type: credentialTypes.gemini, // --- Tipo detectado dinamicamente ---
          data: credentialTypes.gemini === "googleGenerativeAiApi" ? {
            // Dados específicos para node do Google Gemini
            apiKey: credentials.gemini.apiKey,
          } : {
            // Dados genéricos para httpHeaderAuth
            name: "x-goog-api-key", // --- Header name para Google API ---
            value: credentials.gemini.apiKey, // --- Define a chave da API do Google Gemini ---
          },
        };
        console.log(
          "   📝 Dados da credencial Gemini:",
          JSON.stringify(geminiCredData, null, 2)
        );
        
        let geminiCred;
        try {
          geminiCred = await n8nApi.createCredential(geminiCredData);
          console.log(`   ✅ Gemini Cred ID: ${geminiCred.id}`); // --- Exibe uma mensagem de sucesso ---
        } catch (geminiError) {
          console.error("❌ Erro ao criar credencial Gemini:", geminiError);
          throw new Error(`Falha ao criar credencial Gemini: ${geminiError.message}`);
        }

        console.log("3. Criando credencial do Google Sheets..."); // --- Exibe uma mensagem de sucesso ---
        let googleSheetsCred;
        try {
          googleSheetsCred = await n8nApi.createCredential({
          // --- Cria a credencial do Google Sheets ---
          name: `Google Sheets Credential for ${workflowName}`, // --- Define o nome da credencial ---
          type: "googleSheetsOAuth2Api", // --- Define o tipo da credencial ---
          data: {
            // --- Define os dados da credencial ---
            clientId: credentials.googleSheets.clientId, // --- Define o ID do cliente do Google Sheets ---
            clientSecret: credentials.googleSheets.clientSecret, // --- Define o segredo do cliente do Google Sheets ---
          },
        });
          console.log(`   ✅ Google Sheets Cred ID: ${googleSheetsCred.id}`); // --- Exibe uma mensagem de sucesso ---
        } catch (sheetsError) {
          console.error("❌ Erro ao criar credencial Google Sheets:", sheetsError);
          throw new Error(`Falha ao criar credencial Google Sheets: ${sheetsError.message}`);
        }

        console.log("4. Montando o workflow com os IDs das credenciais...");
        const workflowTemplate = getWorkflowTemplate(
          // --- Monta o workflow com os IDs das credenciais ---
          workflowName, // --- Define o nome do workflow ---
          chatwootCred.id, // --- Define o ID da credencial do Chatwoot ---
          geminiCred.id, // --- Define o ID da credencial do Google Gemini ---
          googleSheetsCred.id // --- Define o ID da credencial do Google Sheets ---
        );

        // 5. Garantir nodes necessários instalados (Chatwoot / Evolution API)
        try {
          console.log("5. Verificando/instalando nodes necessários...");
          await n8nApi.ensureRequiredNodes();
        } catch (nodeErr) {
          console.warn("⚠️ Não foi possível garantir nodes necessários:", nodeErr.message);
        }

        console.log("6. Criando o workflow no n8n...");
        let createdWorkflow;
        try {
          const { getWorkflowTemplateByType } = require('./workflow-templates');
          const agentType = (templateType || 'standard');
          const ownerUserId = req.user?.userId || null;
          const templated = getWorkflowTemplateByType(agentType, workflowName, chatwootCred.id, geminiCred.id, googleSheetsCred.id, ownerUserId);
          createdWorkflow = await n8nApi.createWorkflow(templated);
          console.log(`   ✅ Workflow criado com ID: ${createdWorkflow.id}`);
          // Vincular ownership ao usuário atual somente no banco local
          createdWorkflow.meta = {
            ...(createdWorkflow.meta || {}),
            ownerUserId: req.user?.userId || null,
            owner_user_id: req.user?.userId || null,
          };
        } catch (workflowError) {
          console.error("❌ Erro ao criar workflow:", workflowError);
          try {
            const { getWorkflowTemplateByType } = require('./workflow-templates');
            const agentType = (templateType || 'standard');
            const ownerUserId = req.user?.userId || null;
            const templated = getWorkflowTemplateByType(agentType, workflowName, chatwootCred.id, geminiCred.id, googleSheetsCred.id, ownerUserId);
            console.error("📄 Template do workflow (agente:", agentType, "):", JSON.stringify(templated, null, 2));
          } catch {}
          throw new Error(`Falha ao criar workflow: ${workflowError.message}`);
        }

        console.log("6. Sincronizando o novo workflow com o DB local...");
        await db.syncAllWorkflows([createdWorkflow]);

        console.log(
          "7. Salvando uma cópia das credenciais no banco de dados local..."
        );
        await db.saveCredentials(createdWorkflow.id, {
          chatwoot: credentials.chatwoot,
          gemini: credentials.gemini,
          googleSheets: credentials.googleSheets,
        });

        res.status(200).json({
          // --- Exibe uma mensagem de sucesso ---
          success: true, // --- Define o sucesso ---
          message: "Workflow e credenciais criados e salvos com sucesso!", // --- Define a mensagem de sucesso ---
          data: createdWorkflow, // --- Define o workflow criado ---
        });
      } catch (error) {
        // --- Se houver um erro, exibe uma mensagem de erro ---
        console.error(
          "❌ Erro no processo de criação de workflow com credenciais:",
          error
        ); // --- Exibe uma mensagem de erro ---
        res.status(500).json({ success: false, error: error.message }); // --- Exibe uma mensagem de erro ---
      }
    }
  );

  // Cria agente/fluxo a partir de um prompt livre
  app.post(
    "/api/agents/create-from-prompt",
    authenticateApiKeyOrToken,
    async (req, res) => {
      try {
        const { promptText, name, templateType, outputFormat, credentials } = req.body || {};
        if (!promptText || String(promptText).trim().length === 0) {
          return res.status(400).json({ success: false, error: "O prompt é obrigatório." });
        }

        // 1) Gerar nome do agente com padrão correto
        const userId = req.user?.userId || 'default';
        const workflowName = await extractWorkflowName(promptText, userId);

        // 2) Montar credenciais (usar padrões caso não venham)
        const credInput = credentials || {};
        const defaultCreds = {
          chatwoot: {
            apiUrl: credInput.chatwoot?.apiUrl || process.env.CHATWOOT_API_URL || "https://chatwoot.example.com",
            accessToken: credInput.chatwoot?.accessToken || process.env.CHATWOOT_ACCESS_TOKEN || "CW_TOKEN_PLACEHOLDER",
          },
          gemini: {
            apiKey: credInput.gemini?.apiKey || process.env.GEMINI_API_KEY || "GEMINI_API_KEY_PLACEHOLDER",
          },
          googleSheets: {
            clientId: credInput.googleSheets?.clientId || process.env.GOOGLE_CLIENT_ID || "",
            clientSecret: credInput.googleSheets?.clientSecret || process.env.GOOGLE_CLIENT_SECRET || "",
          },
        };

        // 3) Detectar tipos de credenciais/nodes
        const credentialTypes = await detectCredentialTypes();

        // 4) Criar credenciais no n8n (reutilizando fluxo da rota existente)
        const chatwootCredData = {
          name: `Chatwoot Credential for ${workflowName}`,
          type: credentialTypes.chatwoot,
          data: credentialTypes.chatwoot === "chatwootApi"
            ? { baseUrl: defaultCreds.chatwoot.apiUrl, accessToken: defaultCreds.chatwoot.accessToken }
            : { name: "api_access_token", value: defaultCreds.chatwoot.accessToken },
        };
        const chatwootCred = await n8nApi.createCredential(chatwootCredData);

        const geminiCredData = {
          name: `Gemini Credential for ${workflowName}`,
          type: credentialTypes.gemini,
          data: credentialTypes.gemini === "googleGenerativeAiApi"
            ? { apiKey: defaultCreds.gemini.apiKey }
            : { name: "x-goog-api-key", value: defaultCreds.gemini.apiKey },
        };
        const geminiCred = await n8nApi.createCredential(geminiCredData);

        const googleSheetsCred = await n8nApi.createCredential({
          name: `Google Sheets Credential for ${workflowName}`,
          type: "googleSheetsOAuth2Api",
          data: {
            clientId: defaultCreds.googleSheets.clientId,
            clientSecret: defaultCreds.googleSheets.clientSecret,
          },
        });

        // 5) Gerar workflow via IA ou usar fallback
        let workflowJson;
        try {
          workflowJson = await generateWorkflowFromPrompt(promptText);
        } catch (aiError) {
          console.warn("⚠️ IA falhou, usando template padrão:", aiError.message);
          workflowJson = null;
        }
        
        if (!workflowJson) {
          // Usar template existente que sabemos que funciona
          const { getWorkflowTemplateByType } = require('./workflow-templates');
          workflowJson = getWorkflowTemplateByType('standard', workflowName, chatwootCred.id, geminiCred.id, googleSheetsCred.id, ownerUserId);
        }

        // 6) Usar workflow como está (já tem credenciais se veio do template)
        const finalWorkflow = workflowJson;
        
        // Definir nome correto no workflow
        finalWorkflow.name = workflowName;

        // 7) Criar workflow no n8n
        const createdWorkflow = await n8nApi.createWorkflow(finalWorkflow);

        // 8) Sincronizar workflow e salvar credenciais no DB local
        const finalWorkflowState = await n8nApi.getWorkflow(createdWorkflow.id);
        await db.syncAllWorkflows([finalWorkflowState]);
        await db.saveCredentials(createdWorkflow.id, defaultCreds);

        // 9) Salvar logs da execução com detalhes
        await saveExecutionLogs(userId, {
          prompt: promptText,
          workflowId: createdWorkflow.id,
          workflowName: workflowName,
          status: 'success',
          timestamp: new Date().toISOString(),
          detailedLogs: JSON.stringify([
            { time: new Date().toLocaleTimeString('pt-BR'), message: "Instalando pacotes...", type: "info", icon: "🔄" },
            { time: new Date().toLocaleTimeString('pt-BR'), message: "Criando seu workflow...", type: "info", icon: "⚙️" },
            { time: new Date().toLocaleTimeString('pt-BR'), message: "Carregando dados...", type: "info", icon: "📥" },
            { time: new Date().toLocaleTimeString('pt-BR'), message: "Integrações sendo configuradas...", type: "info", icon: "🔗" },
            { time: new Date().toLocaleTimeString('pt-BR'), message: "Finalizando processo...", type: "info", icon: "🎯" },
            { time: new Date().toLocaleTimeString('pt-BR'), message: "Agente criado com sucesso!", type: "success", icon: "✅" }
          ])
        });

        res.status(200).json({
          success: true,
          message: "Workflow criado automaticamente via IA a partir do prompt.",
          data: {
            workflowId: createdWorkflow.id,
            workflowName: workflowName,
            originalPrompt: promptText,
          },
        });
      } catch (error) {
        console.error('❌ Erro em /api/agents/create-from-prompt:', error);
        
        // Salvar logs de erro
        const userId = req.user?.userId || 'default';
        await saveExecutionLogs(userId, {
          prompt: req.body?.promptText || 'prompt não disponível',
          status: 'error',
          error: error.message,
          timestamp: new Date().toISOString()
        });
        
        res.status(500).json({ success: false, error: error.message });
      }
    }
  );

  // Rota para atualizar credenciais específicas no n8n
  app.post(
    "/api/update-n8n-credential",
    authenticateApiKeyOrToken,
    async (req, res) => {
      const { workflowId, credentialType, credentialData } = req.body;

      if (!workflowId || !credentialType || !credentialData) {
        return res.status(400).json({
          success: false,
          error: "Dados insuficientes para atualizar credencial.",
        });
      }

      try {
        console.log(
          `Atualizando credencial ${credentialType} para workflow ${workflowId}...`
        );

        // Buscar credenciais existentes no workflow
        const n8nWorkflow = await n8nApi.getWorkflow(workflowId);
        if (!n8nWorkflow) {
          throw new Error("Workflow não encontrado no n8n");
        }

        // Encontrar e atualizar a credencial correspondente
        const credentialTypes = {
          chatwoot: "chatwootApi",
          gemini: "googlePalmApi",
          googleSheets: "googleSheetsOAuth2Api",
          evolution: "evolutionApi",
        };

        const credentialTypeName = credentialTypes[credentialType];
        if (!credentialTypeName) {
          throw new Error(
            `Tipo de credencial não suportado: ${credentialType}`
          );
        }

        // Buscar todas as credenciais do tipo específico
        const credentials = await n8nApi.getCredentials();
        const targetCredential = credentials.data.find(
          (cred) =>
            cred.type === credentialTypeName &&
            cred.name.includes(n8nWorkflow.name)
        );

        if (!targetCredential) {
          throw new Error(
            `Credencial ${credentialType} não encontrada para o workflow ${n8nWorkflow.name}`
          );
        }

        // Atualizar a credencial
        await n8nApi.updateCredential(targetCredential.id, {
          name: targetCredential.name,
          type: credentialTypeName,
          data: credentialData,
        });

        console.log(`Credencial ${credentialType} atualizada com sucesso (ID: ${targetCredential.id})`);

        // Vincular automaticamente aos nodes do workflow quando aplicável
        try {
          const wf = await n8nApi.getWorkflow(workflowId);
          if (wf && Array.isArray(wf.nodes)) {
            let updated = false;
            for (const node of wf.nodes) {
              const nodeType = (node.type || '').toLowerCase();
              node.credentials = node.credentials || {};

              // Evolution API
              if (
                credentialTypeName === 'evolutionApi' &&
                (nodeType.includes('evolution') || node.type === 'n8n-nodes-evolution-api.evolutionApi')
              ) {
                node.credentials['evolutionApi'] = {
                  id: targetCredential.id,
                  name: targetCredential.name,
                };
                updated = true;
              }

              // Chatwoot
              if (
                credentialTypeName === 'chatwootApi' &&
                (nodeType.includes('chatwoot') || node.type === '@devlikeapro/n8n-nodes-chatwoot.chatWoot')
              ) {
                node.credentials['chatwootApi'] = {
                  id: targetCredential.id,
                  name: targetCredential.name,
                };
                updated = true;
              }

              // Google Sheets
              if (
                credentialTypeName === 'googleSheetsOAuth2Api' &&
                (nodeType.includes('googlesheetstool') || nodeType.includes('googlesheets'))
              ) {
                node.credentials['googleSheetsOAuth2Api'] = {
                  id: targetCredential.id,
                  name: targetCredential.name,
                };
                updated = true;
              }

              // Google Gemini (Palm API cred)
              if (
                credentialTypeName === 'googlePalmApi' &&
                (nodeType.includes('lmchatgooglegemini') || nodeType.includes('lmchatgoogle') || nodeType.includes('gemini'))
              ) {
                node.credentials['googlePalmApi'] = {
                  id: targetCredential.id,
                  name: targetCredential.name,
                };
                updated = true;
              }
            }
            if (updated) {
              await n8nApi.updateWorkflow(workflowId, wf);
              console.log(`Workflow ${workflowId} atualizado com credencial ${credentialTypeName} vinculada aos nodes.`);
            }
          }
        } catch (linkErr) {
          console.warn('⚠️ Não foi possível vincular credencial aos nodes automaticamente:', linkErr.message);
        }

        res.status(200).json({
          success: true,
          message: `Credencial ${credentialType} atualizada com sucesso!`,
          credentialId: targetCredential.id,
        });
      } catch (error) {
        console.error(
          `❌ Erro ao atualizar credencial ${credentialType}:`,
          error
        );
        res.status(500).json({ success: false, error: error.message });
      }
    }
  );

  // Rotas para testar credenciais
  app.post("/api/test-credential/chatwoot", async (req, res) => {
    try {
      const { credentials } = req.body;

      if (!credentials || !credentials.apiUrl || !credentials.accessToken) {
        return res.status(400).json({
          success: false,
          error:
            "Credenciais do Chatwoot incompletas (URL e Access Token necessários)",
        });
      }

      // Testar conexão básica com o Chatwoot
      const testUrl = `${credentials.apiUrl.replace(
        /\/$/,
        ""
      )}/api/v1/accounts`;
      const testResponse = await fetch(testUrl, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${credentials.accessToken}`,
          "Content-Type": "application/json",
        },
        timeout: 10000,
      });

      if (testResponse.ok) {
        const accounts = await testResponse.json();
        res.json({
          success: true,
          message: `Conexão com Chatwoot bem-sucedida! ${
            accounts.length || 0
          } conta(s) encontrada(s).`,
          data: { accountCount: accounts.length || 0 },
        });
      } else {
        res.status(400).json({
          success: false,
          error: `Erro de autenticação no Chatwoot (Status: ${testResponse.status})`,
        });
      }
    } catch (error) {
      console.error("Erro ao testar Chatwoot:", error);
      res.status(500).json({
        success: false,
        error: `Erro de conexão: ${error.message}`,
      });
    }
  });

  app.post("/api/test-credential/gemini", async (req, res) => {
    try {
      const { credentials } = req.body;

      if (!credentials || !credentials.apiKey) {
        return res.status(400).json({
          success: false,
          error: "API Key do Google Gemini é obrigatória",
        });
      }

      // Testar conexão com a API do Google Gemini
      const testUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${credentials.apiKey}`;
      const testResponse = await fetch(testUrl, {
        method: "GET",
        timeout: 10000,
      });

      if (testResponse.ok) {
        const models = await testResponse.json();
        res.json({
          success: true,
          message: `Conexão com Google Gemini bem-sucedida! ${
            models.models?.length || 0
          } modelo(s) disponível(is).`,
          data: { modelCount: models.models?.length || 0 },
        });
      } else {
        const errorData = await testResponse.text();
        res.status(400).json({
          success: false,
          error: `API Key inválida ou sem permissões (Status: ${testResponse.status})`,
        });
      }
    } catch (error) {
      console.error("Erro ao testar Gemini:", error);
      res.status(500).json({
        success: false,
        error: `Erro de conexão: ${error.message}`,
      });
    }
  });

  app.post("/api/test-credential/googleSheets", async (req, res) => {
    try {
      const { credentials } = req.body;

      if (!credentials || !credentials.clientId || !credentials.clientSecret) {
        return res.status(400).json({
          success: false,
          error: "Client ID e Client Secret do Google Sheets são obrigatórios",
        });
      }

      // Para Google Sheets OAuth, apenas validar formato das credenciais
      // Uma validação completa requereria fluxo OAuth completo
      const clientIdValid = credentials.clientId.includes(
        ".googleusercontent.com"
      );
      const clientSecretValid = credentials.clientSecret.length > 20;

      if (clientIdValid && clientSecretValid) {
        res.json({
          success: true,
          message:
            "Credenciais do Google Sheets possuem formato válido. Teste completo requer fluxo OAuth.",
          data: { validated: true },
        });
      } else {
        res.status(400).json({
          success: false,
          error:
            "Formato das credenciais Google Sheets inválido (verifique Client ID e Secret)",
        });
      }
    } catch (error) {
      console.error("Erro ao testar Google Sheets:", error);
      res.status(500).json({
        success: false,
        error: `Erro de validação: ${error.message}`,
      });
    }
  });

  // --- Servir arquivos estáticos da pasta 'public' do frontend ---
  app.use(express.static(path.join(__dirname, "../frontend/public")));

  // --- Rotas de Páginas ---
  app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "../frontend/login.html"));
  });

  app.get("/login", (req, res) => {
    res.sendFile(path.join(__dirname, "../frontend/login.html"));
  });

  app.get("/register", (req, res) => {
    res.sendFile(path.join(__dirname, "../frontend/register.html"));
  });

  app.get("/dashboard", (req, res) => {
    // AQUI VAI A LÓGICA DE AUTENTICAÇÃO ANTES DE SERVIR A PÁGINA
    res.sendFile(path.join(__dirname, "../frontend/dashboard.html"));
  });

  // --- Rota para gerar QR Code da Evolution API (com autenticação) ---
  app.post("/api/qrcode", authenticateToken, async (req, res) => {
    try {
      const userId = req.user.userId;
      const instanceName = req.user.instanceName;

      console.log(
        `📱 Gerando QR Code para usuário ${req.user.username}, instância: ${instanceName}`
      );

      // Atualizar no banco que QR code foi gerado
      await db.connection.execute(
        "UPDATE instances SET qrCodeGenerated = TRUE, lastQrCodeAt = NOW() WHERE userId = ?",
        [userId]
      );

      const response = await fetch(
        `http://localhost:8080/instance/connect/${instanceName}`,
        {
          method: "GET",
          headers: {
            apikey: "B6D711FCDE4D4FD5936544120E713976",
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        console.log(`✅ QR Code gerado para ${instanceName}`);
        res.json({
          success: true,
          qrcode: data.base64, // QR code em base64
          code: data.code, // Código raw do QR
          instanceName,
        });
      } else {
        const errorText = await response.text();
        console.error(
          `❌ Erro ao gerar QR Code para ${instanceName}:`,
          response.status,
          errorText
        );
        res.status(response.status).json({
          success: false,
          error: `Erro da Evolution API: ${response.status}`,
        });
      }
    } catch (error) {
      console.error("❌ Erro de conexão com Evolution API:", error);
      res.status(500).json({
        success: false,
        error: `Conexão falhou: ${error.message}`,
      });
    }
  });

  // --- Rota para verificar status da instância (com autenticação) ---
  app.get("/api/status", authenticateToken, async (req, res) => {
    try {
      const userId = req.user.userId;

      // Buscar instanceName do banco de dados
      const [users] = await db.connection.execute(
        "SELECT instanceName FROM users WHERE id = ?",
        [userId]
      );

      if (users.length === 0) {
        return res.status(404).json({
          success: false,
          error: "Usuário não encontrado",
        });
      }

      const instanceName = users[0].instanceName;

      if (!instanceName) {
        return res.status(400).json({
          success: false,
          error: "Instance name não configurado para este usuário",
        });
      }

      const response = await fetch(
        `http://localhost:8080/instance/fetchInstances`,
        {
          method: "GET",
          headers: {
            apikey: "B6D711FCDE4D4FD5936544120E713976",
          },
        }
      );

      if (response.ok) {
        const instances = await response.json();
        const instance = instances.find((inst) => inst.name === instanceName);
        const connected = instance
          ? instance.connectionStatus === "open"
          : false;

        // Atualizar status no banco
        await db.connection.execute(
          "UPDATE instances SET whatsappConnected = ?, connectedAt = ? WHERE userId = ?",
          [connected, connected ? new Date() : null, userId]
        );

        res.json({
          success: true,
          connected,
          status: instance ? instance.connectionStatus : "not_found",
          instanceName,
          instance: instance || null,
        });
      } else {
        res.status(response.status).json({
          success: false,
          error: "Erro ao verificar status",
        });
      }
    } catch (error) {
      console.error("❌ Erro ao verificar status:", error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  // --- ROTAS DE AUTENTICAÇÃO ---

  // Middleware para verificar token de autenticação
  function authenticateToken(req, res, next) {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    console.log(`🔍 Middleware auth - Header: ${authHeader ? "Existe" : "Não existe"}, Token: ${token ? "Existe" : "Não existe"}`);

    if (!token) {
      console.log("❌ Token não fornecido");
      return res
        .status(401)
        .json({ success: false, error: "Token de acesso requerido" });
    }

    jwt.verify(
      token,
      process.env.JWT_SECRET || "default-secret",
      (err, user) => {
        if (err) {
          return res
            .status(403)
            .json({ success: false, error: "Token inválido" });
        }
        req.user = user;
        next();
      }
    );
  }

  // Rota para testar API key do n8n em uma instância específica
  app.post("/api/n8n/test-api-key", async (req, res) => {
    try {
      const { apiKey, instanceUrl } = req.body;

      if (!apiKey) {
        return res.status(400).json({
          success: false,
          error: "API Key é obrigatória",
        });
      }

      if (!instanceUrl) {
        return res.status(400).json({
          success: false,
          error: "Endereço da instância é obrigatório",
        });
      }

      // Testar API key na instância fornecida
      console.log(`🔍 Testando API key: ${apiKey.substring(0, 20)}... na instância: ${instanceUrl}`);
      const testResult = await testN8nInstance(instanceUrl, apiKey);

      if (testResult.success) {
        res.status(200).json({
          success: true,
          message: `API Key válida na instância: ${testResult.url}`,
          instance: {
            url: testResult.url,
            workflowCount: testResult.workflows.length
          }
        });
      } else {
        res.status(400).json({
          success: false,
          error: testResult.error,
          details: testResult.details
        });
      }
    } catch (error) {
      console.error("❌ Erro ao testar API key:", error);
      res.status(500).json({
        success: false,
        error: "Erro interno ao testar API key",
      });
    }
  });

  // Rota para sincronizar API key do n8n (com URL específica e limpeza) - requer autenticação
  app.post("/api/n8n/sync-api-key", authenticateToken, async (req, res) => {
    try {
      const { apiKey, instanceUrl } = req.body;
      const userId = req.user.userId;

      if (!apiKey) {
        return res.status(400).json({
          success: false,
          error: "API Key é obrigatória",
        });
      }

      if (!instanceUrl) {
        return res.status(400).json({
          success: false,
          error: "Endereço da instância é obrigatório",
        });
      }

      // 1. Testar a instância fornecida
      console.log(`🔍 Testando instância para sincronização: ${instanceUrl}`);
      const testResult = await testN8nInstance(instanceUrl, apiKey);

      if (!testResult.success) {
        return res.status(400).json({
          success: false,
          error: testResult.error,
          details: testResult.details
        });
      }

      const newInstanceUrl = testResult.url;
      const workflows = testResult.workflows;

      // 2. Verificar se mudou de instância
      if (newInstanceUrl !== currentN8nUrl) {
        console.log(`🔄 Mudança de instância detectada: ${currentN8nUrl} → ${newInstanceUrl}`);
        
        // 3. Limpar workflows antigos da instância anterior
        try {
          console.log(`🧹 Limpando workflows da instância anterior...`);
          await db.connection.execute("DELETE FROM agents");
          await db.connection.execute("DELETE FROM credentials");
          await db.connection.execute("DELETE FROM workflows");
          console.log(`✅ Workflows antigos removidos`);
        } catch (cleanError) {
          console.warn(`⚠️ Erro ao limpar workflows antigos:`, cleanError);
        }
      }

      // 4. Salvar configuração no banco de dados
      try {
        await db.saveN8nConfig(userId, newInstanceUrl, apiKey);
        console.log(`💾 Configuração N8N salva para usuário ${userId}`);
      } catch (saveError) {
        console.warn(`⚠️ Erro ao salvar configuração no banco:`, saveError);
      }

      // 5. Verificar e instalar nodes necessários
      console.log("📦 Verificando nodes necessários...");
      try {
        const nodeResults = await n8nApi.ensureRequiredNodes();
        console.log("📊 Resultado da verificação de nodes:", JSON.stringify(nodeResults, null, 2));
      } catch (nodeError) {
        console.warn("⚠️ Erro ao verificar/instalar nodes:", nodeError.message);
      }

      // 6. Atualizar configuração com nova instância
      updateN8nApiKey(apiKey, newInstanceUrl);

      // 7. Sincronizar workflows da instância correta
      if (workflows.length > 0) {
        console.log(`📥 Sincronizando ${workflows.length} workflows da nova instância...`);
        try {
          await db.syncAllWorkflows(workflows);
          console.log(`✅ Workflows sincronizados com sucesso`);
        } catch (syncError) {
          console.warn(`⚠️ Erro ao sincronizar workflows:`, syncError);
        }
      }

      console.log(
        `✅ API Key sincronizada com instância: ${newInstanceUrl}`
      );

      res.status(200).json({
        success: true,
        message: `API Key sincronizada com instância: ${newInstanceUrl}`,
        instance: {
          url: newInstanceUrl,
          workflowCount: workflows.length
        }
      });
    } catch (error) {
      console.error("❌ Erro ao sincronizar API key:", error);
      res.status(500).json({
        success: false,
        error: "Erro interno ao sincronizar API key",
      });
    }
  });

  // Rota para obter configuração N8N do usuário
  app.get("/api/n8n/config", authenticateToken, async (req, res) => {
    try {
      // Força sempre configuração fixa
      updateN8nApiKey(FORCED_N8N_API_KEY, FORCED_N8N_URL);
        res.json({
          success: true,
          config: {
          instanceUrl: FORCED_N8N_URL,
          hasApiKey: true,
          lastTested: null,
        },
      });
    } catch (error) {
      console.error("❌ Erro ao buscar configuração N8N:", error);
      res.status(500).json({
        success: false,
        error: "Erro interno ao buscar configuração",
      });
    }
  });

  // Rota para deletar configuração N8N do usuário
  app.delete("/api/n8n/config", authenticateToken, async (req, res) => {
    try {
      // Mantém configuração fixa; ignora remoção
      updateN8nApiKey(FORCED_N8N_API_KEY, FORCED_N8N_URL);
      res.json({ success: true, message: "Configuração fixa do n8n aplicada; remoção ignorada." });
    } catch (error) {
      console.error("❌ Erro ao deletar configuração N8N:", error);
      res.status(500).json({
        success: false,
        error: "Erro interno ao deletar configuração",
      });
    }
  });

  // Rota para instalar nodes necessários
  app.post("/api/n8n/install-nodes", authenticateToken, async (req, res) => {
    try {
      console.log("🔧 Iniciando instalação forçada de nodes...");
      
      if (!currentN8nApiKey) {
        return res.status(400).json({
          success: false,
          error: "API Key do N8N não configurada"
        });
      }
      
      // Garantir que n8nApi está sincronizado
      updateN8nApiKey(currentN8nApiKey, currentN8nUrl);

      const nodeResults = await n8nApi.ensureRequiredNodes();
      
      const successfulInstalls = nodeResults.filter(r => r.installed);
      const failedInstalls = nodeResults.filter(r => !r.installed);
      
      console.log(`✅ Instalação concluída: ${successfulInstalls.length} sucessos, ${failedInstalls.length} falhas`);
      
      res.json({
        success: true,
        message: "Processo de instalação concluído",
        results: {
          successful: successfulInstalls,
          failed: failedInstalls,
          summary: {
            total: nodeResults.length,
            installed: successfulInstalls.length,
            failed: failedInstalls.length
          }
        }
      });
    } catch (error) {
      console.error("❌ Erro ao instalar nodes:", error);
      res.status(500).json({
        success: false,
        error: "Erro interno ao instalar nodes",
        details: error.message
      });
    }
  });

  // Rota para verificar status dos nodes
  app.get("/api/n8n/nodes-status", authenticateToken, async (req, res) => {
    try {
      if (!currentN8nApiKey) {
        return res.status(400).json({
          success: false,
          error: "API Key do N8N não configurada"
        });
      }
      
      // Garantir que n8nApi está sincronizado
      updateN8nApiKey(currentN8nApiKey, currentN8nUrl);

      const requiredNodes = [
        { package: '@devlikeapro/n8n-nodes-chatwoot', node: 'ChatWoot' },
        { package: 'n8n-nodes-evolution-api', node: 'EvolutionAPI' }
      ];

      const nodeStatus = [];
      
      for (const { package: pkg, node } of requiredNodes) {
        const isInstalled = await n8nApi.checkNodeInstalled(node);
        nodeStatus.push({
          package: pkg,
          node,
          installed: isInstalled
        });
      }
      
      res.json({
        success: true,
        nodes: nodeStatus
      });
    } catch (error) {
      console.error("❌ Erro ao verificar status dos nodes:", error);
      res.status(500).json({
        success: false,
        error: "Erro interno ao verificar nodes",
        details: error.message
      });
    }
  });

  // Rota para analisar configuração de workflow específico
  app.get("/api/workflow/:workflowId/analyze", authenticateToken, async (req, res) => {
    try {
      const { workflowId } = req.params;
      
      console.log(`🔍 Iniciando análise do workflow: ${workflowId}`);
      
      if (!n8nApi.apiKey) {
        console.log("❌ API Key do N8N não configurada");
        return res.status(400).json({
          success: false,
          error: "API Key do N8N não configurada"
        });
      }

      console.log(`📊 N8N API configurada, baseUrl: ${n8nApi.baseUrl}`);
      console.log(`🔍 Analisando configuração do workflow: ${workflowId}`);
      
      const analysis = await n8nApi.analyzeWorkflowConfiguration(workflowId);
      
      console.log(`✅ Análise concluída para workflow ${workflowId}`);
      console.log(`📋 Resultado:`, JSON.stringify(analysis, null, 2));
      
      res.json({
        success: true,
        analysis
      });
    } catch (error) {
      console.error("❌ Erro ao analisar workflow:", error);
      console.error("❌ Stack trace:", error.stack);
      res.status(500).json({
        success: false,
        error: "Erro interno ao analisar workflow",
        details: error.message
      });
    }
  });

  // Rota para salvar prompt estruturado
  app.post("/api/workflow/:workflowId/prompt", authenticateToken, async (req, res) => {
    try {
      const { workflowId } = req.params;
      const { promptStructure } = req.body;
      
      if (!currentN8nApiKey) {
        return res.status(400).json({
          success: false,
          error: "API Key do N8N não configurada"
        });
      }
      
      // Garantir que n8nApi está sincronizado
      updateN8nApiKey(currentN8nApiKey, currentN8nUrl);

      console.log(`💾 Salvando prompt estruturado para workflow: ${workflowId}`);
      const result = await n8nApi.saveStructuredPrompt(workflowId, promptStructure);
      
      res.json({
        success: true,
        message: "Prompt estruturado salvo com sucesso",
        result
      });
    } catch (error) {
      console.error("❌ Erro ao salvar prompt estruturado:", error);
      res.status(500).json({
        success: false,
        error: "Erro interno ao salvar prompt",
        details: error.message
      });
    }
  });

  // Rota para atualizar credenciais de um node específico
  app.post("/api/workflow/:workflowId/node/:nodeId/credentials", authenticateToken, async (req, res) => {
    try {
      const { workflowId, nodeId } = req.params;
      const { credentialType, credentialData } = req.body;
      
      if (!currentN8nApiKey) {
        return res.status(400).json({
          success: false,
          error: "API Key do N8N não configurada"
        });
      }
      
      // Garantir que n8nApi está sincronizado
      updateN8nApiKey(currentN8nApiKey, currentN8nUrl);

      console.log(`🔑 Atualizando credencial ${credentialType} para node ${nodeId} no workflow ${workflowId}`);
      
      // 1) Obter workflow atual para ter nome e localizar o node
      const workflow = await n8nApi.getWorkflow(workflowId);
      if (!workflow) {
        throw new Error("Workflow não encontrado no n8n");
      }

      const workflowName = workflow.name || `wf-${workflowId}`;

      // Normalizar tipos conhecidos para títulos de credenciais
      const normalizedTypeName = {
        googlePalmApi: 'googlePalmApi',
        gemini: 'googlePalmApi',
        chatwoot: 'chatwootApi',
        googleSheets: 'googleSheetsOAuth2Api',
      }[credentialType] || credentialType;

      // 2) Localizar o node alvo e determinar a key esperada pelo node
      const nodesEarly = workflow.nodes || [];
      const nodeEarly = nodesEarly.find((n) => n.id === nodeId);
      if (!nodeEarly) {
        throw new Error(`Node ${nodeId} não encontrado no workflow`);
      }
      let targetKey = Object.keys(nodeEarly.credentials || {})[0] || null;
      if (!targetKey) {
        const t = (nodeEarly.type || '').toLowerCase();
        if (t.includes('googlesheetstool')) targetKey = 'googleSheetsOAuth2Api';
        else if (t.includes('chatwoot')) targetKey = 'chatwootApi';
        else if (t.includes('lmchatgooglegemini')) targetKey = 'googlePalmApi';
        else if (t.includes('evolution')) targetKey = 'evolutionApi';
        else targetKey = normalizedTypeName;
      }

      // 3) Verificar se já existe uma credencial do tipo para este workflow
      let existingCred = null;
      try {
        const allCreds = await n8nApi.getCredentials();
        const credsArray = Array.isArray(allCreds) ? allCreds : (allCreds.data || allCreds.credentials || []);
        existingCred = credsArray.find(
          (c) => c.type === targetKey && (c.name?.includes(workflowName) || c.name?.includes(nodeId))
        ) || null;
      } catch (listError) {
        console.warn("⚠️ Não foi possível listar credenciais, prosseguindo para criação direta:", listError.message);
      }

      // 4) Preparar dados conforme tipo esperado pelo node
      const normalizeCredentialData = (key, data) => {
        if (!data || typeof data !== 'object') return {};
        switch (key) {
          case 'googlePalmApi':
          case 'googleGenerativeAiApi':
            return {
              apiKey: data.apiKey || data.key || data.token,
              host: data.host || 'https://generativelanguage.googleapis.com',
            };
          case 'chatwootApi':
            return {
              url: data.url || data.baseUrl || data.apiUrl,
              accessToken: data.accessToken || data.token,
            };
          case 'googleSheetsOAuth2Api':
            return {
              clientId: data.clientId,
              clientSecret: data.clientSecret,
            };
          case 'evolutionApi':
            return {
              baseUrl: data.baseUrl || data.url,
              apiKey: data.apiKey || data.token,
            };
          default:
            return data;
        }
      };

      const mappedData = normalizeCredentialData(targetKey, credentialData);

      // Validação simples
      const assertFields = (obj, fields) => fields.every(f => obj && obj[f]);
      const requiredByType = {
        googlePalmApi: ['apiKey', 'host'],
        googleGenerativeAiApi: ['apiKey', 'host'],
        chatwootApi: ['url', 'accessToken'],
        googleSheetsOAuth2Api: ['clientId', 'clientSecret'],
        evolutionApi: ['baseUrl', 'apiKey'],
      };
      const reqFields = requiredByType[targetKey];
      if (reqFields && !assertFields(mappedData, reqFields)) {
        return res.status(400).json({
          success: false,
          error: `Campos obrigatórios faltando para ${targetKey}: ${reqFields.join(', ')}`,
        });
      }

      // 5) Criar ou atualizar a credencial
      let targetCredential = existingCred;
      if (targetCredential) {
        await n8nApi.updateCredential(targetCredential.id, {
          name: targetCredential.name,
          type: targetKey,
          data: mappedData,
        });
      } else {
        targetCredential = await n8nApi.createCredential({
          name: `${workflowName} - ${targetKey}`,
          type: targetKey,
          data: mappedData,
        });
      }

      // Normalizar id retornado (em diferentes versões pode vir em campos diferentes)
      let credentialId = targetCredential?.id
        || targetCredential?.data?.id
        || targetCredential?.credential?.id;

      // Se ainda não temos ID, tentar buscar de volta por nome e tipo
      if (!credentialId) {
        try {
          const list = await n8nApi.getCredentials();
          const arr = Array.isArray(list) ? list : (list.data || list.credentials || []);
          const found = arr.find(
            (c) => c.type === targetKey && (c.name === `${workflowName} - ${targetKey}`)
          );
          if (found) credentialId = found.id;
        } catch (probeErr) {
          console.warn("⚠️ Falha ao re-listar credenciais para determinar ID:", probeErr.message);
        }
      }
      if (!credentialId) {
        throw new Error("Falha ao obter ID da credencial criada/atualizada");
      }

      // 6) Atualizar o node alvo dentro do workflow (já temos targetKey)
      const nodes = workflow.nodes || [];
      const node = nodes.find((n) => n.id === nodeId);
      if (!node) {
        throw new Error(`Node ${nodeId} não encontrado no workflow`);
      }
      if (!node.credentials) node.credentials = {};

      node.credentials[targetKey] = {
        id: credentialId,
        name: `${workflowName} - ${targetKey}`,
      };

      // 5) Salvar workflow atualizado (usa método com payload normalizado)
      try {
        await n8nApi.updateWorkflow(workflowId, workflow);
      } catch (saveErr) {
        console.error('❌ Erro ao salvar workflow com credencial vinculada:', saveErr);
        throw new Error(`Falha ao salvar workflow: ${saveErr.message}`);
      }

      res.json({
        success: true,
        message: "Credencial atualizada e vinculada ao node com sucesso",
        credentialId,
      });
    } catch (error) {
      console.error("❌ Erro ao atualizar credencial:", error);
      res.status(500).json({
        success: false,
        error: "Erro interno ao atualizar credencial",
        details: error.message
      });
    }
  });

  // Rota de registro
  app.post("/api/auth/register", async (req, res) => {
    try {
      const { fullName, nameEnterprise, username, email, password } = req.body;

      // Validações básicas
      if (!fullName || !nameEnterprise || !username || !email || !password) {
        return res.status(400).json({
          success: false,
          error: "Todos os campos são obrigatórios",
        });
      }

      // Verificar se usuário já existe
      const [existingUsers] = await db.connection.execute(
        "SELECT id FROM users WHERE email = ? OR username = ?",
        [email, username]
      );

      if (existingUsers.length > 0) {
        return res.status(400).json({
          success: false,
          error: "Email ou username já existe",
        });
      }

      // Hash da senha
      const hashedPassword = await bcrypt.hash(password, 10);

      // Gerar nome único da instância
      const instanceName = username.toLowerCase().replace(/[^a-z0-9]/g, "");

      // Inserir usuário
      const [result] = await db.connection.execute(
        `INSERT INTO users (fullName, nameEnterprise, username, email, password, instanceName) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          fullName,
          nameEnterprise,
          username,
          email,
          hashedPassword,
          instanceName,
        ]
      );

      const userId = result.insertId;

      // Criar instância vinculada
      await db.connection.execute(
        `INSERT INTO instances (userId, instanceName, evolutionInstanceName) 
         VALUES (?, ?, ?)`,
        [userId, instanceName, instanceName]
      );

      console.log(
        `✅ Usuário registrado: ${username} com instância: ${instanceName}`
      );

      // Ativar webhook do n8n para criar empresa
      try {
        console.log("🔄 Ativando webhook do n8n para criar empresa...");

        const webhookData = {
          event: "user_registration",
          user: {
            id: userId,
            fullName,
            nameEnterprise,
            username,
            email,
            instanceName,
            password,
          },
          timestamp: new Date().toISOString(),
          source: "evolution_api_chatwoot",
        };

        const webhookResponse = await fetch(
          "https://autowebhook.criard.me/webhook/17eb06e2-c91b-448c-854d-3c0e8b1b5471",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(webhookData),
          }
        );

        if (webhookResponse.ok) {
          const webhookResult = await webhookResponse.json();
          console.log(
            "✅ Webhook do n8n executado com sucesso:",
            webhookResult
          );

          // Atualizar usuário com dados do webhook se necessário
          if (webhookResult.companyId) {
            await db.connection.execute(
              "UPDATE users SET chatwootAccountId = ? WHERE id = ?",
              [webhookResult.companyId, userId]
            );
          }
        } else {
          console.warn(
            "⚠️ Webhook do n8n falhou, mas registro continuou:",
            webhookResponse.status
          );
        }
      } catch (webhookError) {
        console.error("❌ Erro ao executar webhook do n8n:", webhookError);
        // Não falha o registro se o webhook falhar
      }

      res.json({
        success: true,
        message: "Usuário registrado com sucesso e empresa criada",
        instanceName,
        userId,
      });
    } catch (error) {
      console.error("❌ Erro no registro:", error);
      res.status(500).json({
        success: false,
        error: "Erro interno do servidor",
      });
    }
  });

  // Rota de login
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({
          success: false,
          error: "Username e senha são obrigatórios",
        });
      }

      // Buscar usuário
      const [users] = await db.connection.execute(
        "SELECT id, username, email, password, instanceName, fullName, nameEnterprise FROM users WHERE username = ? OR email = ?",
        [username, username]
      );

      if (users.length === 0) {
        return res.status(401).json({
          success: false,
          error: "Credenciais inválidas",
        });
      }

      const user = users[0];

      // Verificar senha
      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        return res.status(401).json({
          success: false,
          error: "Credenciais inválidas",
        });
      }

      // Gerar token JWT
      const token = jwt.sign(
        {
          userId: user.id,
          username: user.username,
          instanceName: user.instanceName,
        },
        process.env.JWT_SECRET || "default-secret",
        { expiresIn: "24h" }
      );

      // Salvar sessão no banco
      const sessionToken = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 horas

      await db.connection.execute(
        "INSERT INTO user_sessions (userId, sessionToken, expiresAt) VALUES (?, ?, ?)",
        [user.id, sessionToken, expiresAt]
      );

      console.log(`✅ Login realizado: ${user.username}`);

      res.json({
        success: true,
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          fullName: user.fullName,
          nameEnterprise: user.nameEnterprise,
          instanceName: user.instanceName,
        },
      });
    } catch (error) {
      console.error("❌ Erro no login:", error);
      res.status(500).json({
        success: false,
        error: "Erro interno do servidor",
      });
    }
  });

  // Rota para verificar token e obter dados do usuário
  app.get("/api/auth/me", authenticateToken, async (req, res) => {
    try {
      const [users] = await db.connection.execute(
        "SELECT id, username, email, fullName, nameEnterprise, instanceName, chatwootAccountId FROM users WHERE id = ?",
        [req.user.userId]
      );

      if (users.length === 0) {
        return res.status(404).json({
          success: false,
          error: "Usuário não encontrado",
        });
      }

      res.json({
        success: true,
        user: users[0],
      });
    } catch (error) {
      console.error("❌ Erro ao verificar usuário:", error);
      res.status(500).json({
        success: false,
        error: "Erro interno do servidor",
      });
    }
  });

  // Rota para listar usuários (apenas para administradores)
  app.get("/api/users", authenticateToken, async (req, res) => {
    try {
      const [users] = await db.connection.execute(`
        SELECT 
          u.id, 
          u.fullName, 
          u.nameEnterprise, 
          u.username, 
          u.email, 
          u.instanceName, 
          u.chatwootAccountId,
          u.createdAt,
          i.whatsappConnected,
          i.qrCodeGenerated
        FROM users u
        LEFT JOIN instances i ON u.id = i.userId
        ORDER BY u.createdAt DESC
      `);

      res.json({
        success: true,
        users: users,
        count: users.length,
      });
    } catch (error) {
      console.error("❌ Erro ao listar usuários:", error);
      res.status(500).json({
        success: false,
        error: "Erro interno do servidor",
      });
    }
  });

  // Rota de logout
  app.post("/api/auth/logout", authenticateToken, async (req, res) => {
    try {
      // Remover sessões do usuário
      await db.connection.execute(
        "DELETE FROM user_sessions WHERE userId = ?",
        [req.user.userId]
      );

      res.json({
        success: true,
        message: "Logout realizado com sucesso",
      });
    } catch (error) {
      console.error("❌ Erro no logout:", error);
      res.status(500).json({
        success: false,
        error: "Erro interno do servidor",
      });
    }
  });

  // Rota proxy para contornar CORS com n8n local
  app.post("/api/webhook-proxy", async (req, res) => {
    try {
      console.log("📡 Enviando dados para webhook via proxy:", req.body);

      const response = await fetch(
        "http://localhost:5678/webhook/9732d959-32c4-46dc-93a9-9486c4f5399b",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(req.body),
        }
      );

      if (response.ok) {
        const data = await response.json();
        console.log("✅ Webhook executado com sucesso");
        res.json({ success: true, data });
      } else {
        const errorText = await response.text();
        console.error("❌ Erro no webhook:", response.status, errorText);
        res.status(response.status).json({
          success: false,
          error: `Webhook error: ${response.status}`,
        });
      }
    } catch (error) {
      console.error("❌ Erro de conexão com webhook:", error);
      res.status(500).json({
        success: false,
        error: `Conexão falhou: ${error.message}`,
      });
    }
  });

  // Rota para testar webhook de criação de empresa
  app.post("/api/test-company-webhook", async (req, res) => {
    try {
      console.log("🧪 Testando webhook de criação de empresa...");

      const testData = {
        event: "test_company_creation",
        user: {
          id: 999,
          fullName: "Usuário Teste",
          nameEnterprise: "Empresa Teste Ltda",
          username: "teste",
          email: "teste@empresa.com",
          instanceName: "teste",
        },
        timestamp: new Date().toISOString(),
        source: "evolution_api_chatwoot_test",
      };

      const response = await fetch(
        "http://localhost:5678/webhook-test/0691abcd-627d-4608-819e-301bca910b06",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(testData),
        }
      );

      if (response.ok) {
        const result = await response.json();
        console.log("✅ Teste do webhook executado com sucesso:", result);
        res.json({
          success: true,
          message: "Webhook testado com sucesso",
          data: result,
        });
      } else {
        const errorText = await response.text();
        console.error(
          "❌ Erro no teste do webhook:",
          response.status,
          errorText
        );
        res.status(response.status).json({
          success: false,
          error: `Erro no webhook: ${response.status}`,
          details: errorText,
        });
      }
    } catch (error) {
      console.error("❌ Erro ao testar webhook:", error);
      res.status(500).json({
        success: false,
        error: `Erro de conexão: ${error.message}`,
      });
    }
  });

  // Rota para verificar status do n8n (sem autenticação para verificação inicial)
  app.get("/api/n8n-status", async (req, res) => {
    try {
      // Forçar URL fixa
      const n8nUrl = FORCED_N8N_URL;
      
      console.log(`🔍 Verificando status do N8N: ${n8nUrl}`);

      // Garante que a API key fixa esteja aplicada
      if (!currentN8nApiKey) {
        updateN8nApiKey(FORCED_N8N_API_KEY, FORCED_N8N_URL);
      }

      // Primeiro verificar se o n8n está respondendo (tentar healthz, se falhar tentar endpoint da API)
      let isN8nOnline = false;
      try {
        const healthResponse = await fetch(`${n8nUrl}/healthz`, {
          method: "GET",
          timeout: 10000,
        });
        isN8nOnline = healthResponse.ok;
      } catch (healthError) {
        console.log(`⚠️ Endpoint /healthz não disponível, tentando API direta...`);
        // Se /healthz falhar, tentar endpoint da API para verificar se N8N está online
        try {
          const apiTestResponse = await fetch(`${n8nUrl}/api/v1/workflows`, {
            method: "GET",
            timeout: 10000,
          });
          // Se retornar 401, significa que N8N está online mas precisa de auth
          isN8nOnline = apiTestResponse.status === 401 || apiTestResponse.ok;
        } catch (apiError) {
          console.log(`❌ N8N não está acessível em ${n8nUrl}`);
          return res.json({
            success: false,
            status: "offline",
            message: `N8N não está acessível em ${n8nUrl}. Verifique a URL e se a instância está rodando.`,
          });
        }
      }

      if (!isN8nOnline) {
        return res.json({
          success: false,
          status: "offline",
          message: `N8N não está respondendo em ${n8nUrl}`,
        });
      }

      // Agora testar se a API está funcionando corretamente
      try {
        // Se por algum motivo não houver API key, injeta a fixa
        if (!currentN8nApiKey) {
          updateN8nApiKey(FORCED_N8N_API_KEY, FORCED_N8N_URL);
        }

        const apiResponse = await fetch(`${n8nUrl}/api/v1/workflows`, {
          method: "GET",
          headers: {
            "X-N8N-API-KEY": currentN8nApiKey,
            "Content-Type": "application/json",
          },
          timeout: 10000,
        });

        // Se retornar 401, significa que a API key está incorreta
        if (apiResponse.status === 401) {
          return res.json({
            success: false,
            status: "auth_error",
            message: "API key está incorreta ou expirada",
          });
        }

        // Se retornar 403, significa sem permissões
        if (apiResponse.status === 403) {
          return res.json({
            success: false,
            status: "auth_error",
            message: "API key não tem permissões suficientes",
          });
        }

        // Se chegou até aqui e a resposta foi bem sucedida
        if (apiResponse.ok) {
          return res.json({
            success: true,
            status: "online",
            message: `N8N conectado com sucesso: ${n8nUrl}`,
            instanceUrl: n8nUrl,
          });
        }

        // Para outros códigos de erro
        if (!apiResponse.ok) {
          return res.json({
            success: false,
            status: "api_error",
            message: `n8n API retornou erro: ${apiResponse.status}`,
          });
        }

        res.json({
          success: true,
          status: "online",
          message: "n8n está rodando e a API está funcionando",
        });
      } catch (apiError) {
        res.json({
          success: false,
          status: "api_error",
          message: `Erro ao testar API do n8n: ${apiError.message}`,
        });
      }
    } catch (error) {
      res.json({
        success: false,
        status: "offline",
        message: `n8n não está acessível: ${error.message}`,
      });
    }
  });

  // --- NOVOS ENDPOINTS PARA INTEGRAÇÃO COMPLETA ---

  // Endpoint para verificar se a instância foi criada pelo n8n
  app.get(
    "/api/evolution/check-instance",
    authenticateToken,
    async (req, res) => {
      try {
        const userId = req.user.userId;

        // Buscar dados do usuário (incluindo nameEnterprise)
        const [users] = await db.connection.execute(
          "SELECT instanceName, nameEnterprise FROM users WHERE id = ?",
          [userId]
        );

        if (users.length === 0) {
          return res.status(404).json({
            success: false,
            error: "Usuário não encontrado",
          });
        }

        const { instanceName, nameEnterprise } = users[0];

        // Verificar se a instância existe na Evolution API
        const response = await fetch(
          `http://localhost:8080/instance/fetchInstances`,
          {
            method: "GET",
            headers: {
              apikey: "B6D711FCDE4D4FD5936544120E713976",
            },
          }
        );

        if (response.ok) {
          const instances = await response.json();

          // Procurar primeiro pelo nameEnterprise (que é o nome real da instância criada pelo n8n)
          let instance = instances.find((inst) => inst.name === nameEnterprise);

          // Se não encontrar pelo nameEnterprise, procurar pelo instanceName
          if (!instance) {
            instance = instances.find((inst) => inst.name === instanceName);
          }

          if (instance) {
            // Atualizar banco de dados se a instância foi encontrada
            await db.connection.execute(
              `UPDATE instances SET 
             evolutionInstanceId = ?, 
             evolutionInstanceCreated = ?, 
             evolutionInstanceCreatedAt = ?,
             instanceName = ?
             WHERE userId = ?`,
              [instance.name, true, new Date(), instance.name, userId]
            );

            // Atualizar também o instanceName no banco para refletir o nome real da instância
            await db.connection.execute(
              `UPDATE users SET instanceName = ? WHERE id = ?`,
              [instance.name, userId]
            );

            res.json({
              success: true,
              message: "Instância encontrada na Evolution API",
              instanceName: instance.name,
              instance: instance,
              created: true,
            });
          } else {
            res.json({
              success: true,
              message: "Instância ainda não foi criada pelo n8n",
              instanceName,
              nameEnterprise,
              created: false,
            });
          }
        } else {
          res.status(response.status).json({
            success: false,
            error: `Erro da Evolution API: ${response.status}`,
          });
        }
      } catch (error) {
        console.error("❌ Erro ao verificar instância:", error);
        res.status(500).json({
          success: false,
          error: `Erro de conexão: ${error.message}`,
        });
      }
    }
  );

  // Endpoint para obter QR Code da instância
  app.get(
    "/api/evolution/qrcode/:instanceName",
    authenticateToken,
    async (req, res) => {
      try {
        const { instanceName } = req.params;
        const userId = req.user.userId;

        // Verificar se a instância pertence ao usuário
        const [instances] = await db.connection.execute(
          "SELECT userId FROM instances WHERE instanceName = ? AND userId = ?",
          [instanceName, userId]
        );

        if (instances.length === 0) {
          return res.status(403).json({
            success: false,
            error: "Instância não pertence ao usuário",
          });
        }

        console.log(`🔄 Gerando QR Code para instância: ${instanceName}`);

        const response = await fetch(
          `http://localhost:8080/instance/connect/${instanceName}`,
          {
            method: "GET",
            headers: {
              apikey: "B6D711FCDE4D4FD5936544120E713976",
            },
          }
        );

        if (response.ok) {
          const data = await response.json();
          console.log(`✅ Código de conexão obtido para ${instanceName}`);

          // Gerar QR code a partir do código
          let qrCodeBase64 = null;
          try {
            qrCodeBase64 = await QRCode.toDataURL(data.code, {
              errorCorrectionLevel: "M",
              type: "image/png",
              quality: 0.92,
              margin: 1,
              color: {
                dark: "#000000",
                light: "#FFFFFF",
              },
            });
            console.log(`✅ QR Code gerado com sucesso para ${instanceName}`);
          } catch (qrError) {
            console.error(`❌ Erro ao gerar QR Code:`, qrError);
            return res.status(500).json({
              success: false,
              error: "Erro ao gerar QR Code",
            });
          }

          // Atualizar banco de dados
          await db.connection.execute(
            "UPDATE instances SET qrCodeGenerated = ?, qrCodeGeneratedAt = ? WHERE userId = ?",
            [true, new Date(), userId]
          );

          res.json({
            success: true,
            qrcode: qrCodeBase64,
            code: data.code,
            instanceName,
          });
        } else {
          const errorText = await response.text();
          console.error(
            `❌ Erro ao gerar QR Code:`,
            response.status,
            errorText
          );
          res.status(response.status).json({
            success: false,
            error: `Erro da Evolution API: ${response.status}`,
            details: errorText,
          });
        }
      } catch (error) {
        console.error("❌ Erro ao gerar QR Code:", error);
        res.status(500).json({
          success: false,
          error: `Erro de conexão: ${error.message}`,
        });
      }
    }
  );

  // Endpoint para sincronizar dados do Chatwoot
  app.get("/api/chatwoot/sync/:userId", authenticateToken, async (req, res) => {
    try {
      const { userId } = req.params;

      // Verificar se o usuário tem chatwootAccountId
      const [users] = await db.connection.execute(
        "SELECT chatwootAccountId, nameEnterprise FROM users WHERE id = ?",
        [userId]
      );

      if (users.length === 0) {
        return res.status(404).json({
          success: false,
          error: "Usuário não encontrado",
        });
      }

      const { chatwootAccountId, nameEnterprise } = users[0];

      if (!chatwootAccountId) {
        return res.status(400).json({
          success: false,
          error: "Usuário não possui conta no Chatwoot",
        });
      }

      console.log(`🔄 Sincronizando dados do Chatwoot para usuário ${userId}`);

      // Buscar dados da empresa no Chatwoot
      const chatwootResponse = await fetch(
        `http://localhost:3000/api/v1/accounts/${chatwootAccountId}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            api_access_token: process.env.CHATWOOT_API_TOKEN || "default-token",
          },
        }
      );

      if (chatwootResponse.ok) {
        const chatwootData = await chatwootResponse.json();
        console.log(`✅ Dados do Chatwoot sincronizados:`, chatwootData);

        // Atualizar banco de dados com dados do Chatwoot
        await db.connection.execute(
          `UPDATE users SET 
           chatwootAccountName = ?, 
           chatwootAccountDomain = ?,
           chatwootLastSync = ?
           WHERE id = ?`,
          [
            chatwootData.name || nameEnterprise,
            chatwootData.domain || null,
            new Date(),
            userId,
          ]
        );

        res.json({
          success: true,
          message: "Dados do Chatwoot sincronizados com sucesso",
          chatwootData,
        });
      } else {
        const errorText = await chatwootResponse.text();
        console.error(
          `❌ Erro ao sincronizar Chatwoot:`,
          chatwootResponse.status,
          errorText
        );
        res.status(chatwootResponse.status).json({
          success: false,
          error: `Erro do Chatwoot: ${chatwootResponse.status}`,
          details: errorText,
        });
      }
    } catch (error) {
      console.error("❌ Erro ao sincronizar Chatwoot:", error);
      res.status(500).json({
        success: false,
        error: `Erro de conexão: ${error.message}`,
      });
    }
  });

  // Endpoint para verificar status completo (Evolution + Chatwoot)
  app.get("/api/status/complete", authenticateToken, async (req, res) => {
    try {
      const userId = req.user.userId;

      // Buscar dados completos do usuário
      const [users] = await db.connection.execute(
        `
        SELECT 
          u.id, u.fullName, u.nameEnterprise, u.username, u.email, 
          u.instanceName, u.chatwootAccountId, u.chatwootAccountName,
          i.evolutionInstanceId, i.evolutionInstanceCreated, i.whatsappConnected,
          i.qrCodeGenerated, i.connectedAt, i.lastStatusCheck
        FROM users u
        LEFT JOIN instances i ON u.id = i.userId
        WHERE u.id = ?
      `,
        [userId]
      );

      if (users.length === 0) {
        return res.status(404).json({
          success: false,
          error: "Usuário não encontrado",
        });
      }

      const user = users[0];
      const instanceName = user.instanceName;

      // Verificar status da Evolution API
      let evolutionStatus = {
        connected: false,
        status: "not_found",
        instance: null,
      };
      try {
        const evolutionResponse = await fetch(
          `http://localhost:8080/instance/fetchInstances`,
          {
            method: "GET",
            headers: {
              apikey: "B6D711FCDE4D4FD5936544120E713976",
            },
          }
        );

        if (evolutionResponse.ok) {
          const instances = await evolutionResponse.json();
          const instance = instances.find((inst) => inst.name === instanceName);
          evolutionStatus = {
            connected: instance ? instance.connectionStatus === "open" : false,
            status: instance ? instance.connectionStatus : "not_found",
            instance: instance || null,
          };
        }
      } catch (error) {
        console.error("❌ Erro ao verificar Evolution API:", error);
        evolutionStatus = {
          connected: false,
          status: "error",
          error: error.message,
        };
      }

      // Verificar status do Chatwoot
      let chatwootStatus = { connected: false, account: null };
      if (user.chatwootAccountId) {
        try {
          const chatwootResponse = await fetch(
            `http://localhost:3000/api/v1/accounts/${user.chatwootAccountId}`,
            {
              method: "GET",
              headers: {
                "Content-Type": "application/json",
                api_access_token:
                  process.env.CHATWOOT_API_TOKEN || "default-token",
              },
            }
          );

          if (chatwootResponse.ok) {
            const chatwootData = await chatwootResponse.json();
            chatwootStatus = {
              connected: true,
              account: chatwootData,
            };
          }
        } catch (error) {
          console.error("❌ Erro ao verificar Chatwoot:", error);
          chatwootStatus = { connected: false, error: error.message };
        }
      }

      // Atualizar status no banco
      await db.connection.execute(
        "UPDATE instances SET whatsappConnected = ?, connectedAt = ?, lastStatusCheck = ? WHERE userId = ?",
        [
          evolutionStatus.connected,
          evolutionStatus.connected ? new Date() : null,
          new Date(),
          userId,
        ]
      );

      res.json({
        success: true,
        user: {
          id: user.id,
          fullName: user.fullName,
          nameEnterprise: user.nameEnterprise,
          username: user.username,
          email: user.email,
          instanceName: user.instanceName,
        },
        evolution: evolutionStatus,
        chatwoot: chatwootStatus,
        integration: {
          evolutionInstanceCreated: user.evolutionInstanceCreated,
          qrCodeGenerated: user.qrCodeGenerated,
          chatwootAccountId: user.chatwootAccountId,
          chatwootAccountName: user.chatwootAccountName,
        },
      });
    } catch (error) {
      console.error("❌ Erro ao verificar status completo:", error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  // Webhook para receber atualizações da Evolution API
  app.post("/api/evolution/webhook/:instanceName", async (req, res) => {
    try {
      const { instanceName } = req.params;
      const webhookData = req.body;

      console.log(
        `📡 Webhook da Evolution API recebido para ${instanceName}:`,
        webhookData
      );

      // Buscar usuário pela instância
      const [instances] = await db.connection.execute(
        "SELECT userId FROM instances WHERE instanceName = ?",
        [instanceName]
      );

      if (instances.length === 0) {
        console.warn(`⚠️ Instância ${instanceName} não encontrada no banco`);
        return res
          .status(404)
          .json({ success: false, error: "Instância não encontrada" });
      }

      const userId = instances[0].userId;

      // Processar diferentes tipos de eventos
      if (webhookData.event === "connection.update") {
        const { state } = webhookData.data;
        const connected = state === "open";

        // Atualizar status no banco
        await db.connection.execute(
          "UPDATE instances SET whatsappConnected = ?, connectedAt = ? WHERE userId = ?",
          [connected, connected ? new Date() : null, userId]
        );

        console.log(
          `✅ Status do WhatsApp atualizado para ${instanceName}: ${state}`
        );

        // Se conectou, sincronizar com Chatwoot
        if (connected) {
          try {
            // Buscar chatwootAccountId
            const [users] = await db.connection.execute(
              "SELECT chatwootAccountId FROM users WHERE id = ?",
              [userId]
            );

            if (users.length > 0 && users[0].chatwootAccountId) {
              // Aqui você pode adicionar lógica para sincronizar com Chatwoot
              console.log(
                `🔄 WhatsApp conectado, sincronizando com Chatwoot para usuário ${userId}`
              );
            }
          } catch (syncError) {
            console.error("❌ Erro ao sincronizar com Chatwoot:", syncError);
          }
        }
      }

      res.json({ success: true, message: "Webhook processado com sucesso" });
    } catch (error) {
      console.error("❌ Erro ao processar webhook da Evolution API:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Webhook para receber atualizações do n8n (após criação de empresa)
  app.post("/api/n8n/webhook/company-created", async (req, res) => {
    try {
      const webhookData = req.body;
      console.log("📡 Webhook do n8n recebido (empresa criada):", webhookData);

      const { userId, chatwootAccountId, evolutionInstanceId } = webhookData;

      if (!userId || !chatwootAccountId) {
        return res.status(400).json({
          success: false,
          error: "Dados obrigatórios não fornecidos",
        });
      }

      // Atualizar usuário com dados do Chatwoot
      await db.connection.execute(
        "UPDATE users SET chatwootAccountId = ? WHERE id = ?",
        [chatwootAccountId, userId]
      );

      // Atualizar instância com dados da Evolution API
      if (evolutionInstanceId) {
        await db.connection.execute(
          "UPDATE instances SET evolutionInstanceId = ?, evolutionInstanceCreated = ? WHERE userId = ?",
          [evolutionInstanceId, true, userId]
        );
      }

      console.log(
        `✅ Dados atualizados para usuário ${userId}: Chatwoot=${chatwootAccountId}, Evolution=${evolutionInstanceId}`
      );

      res.json({
        success: true,
        message: "Dados atualizados com sucesso",
        userId,
        chatwootAccountId,
        evolutionInstanceId,
      });
    } catch (error) {
      console.error("❌ Erro ao processar webhook do n8n:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Endpoint para listar todas as instâncias da Evolution API
  app.get("/api/evolution/instances", authenticateToken, async (req, res) => {
    try {
      const response = await fetch(
        `http://localhost:8080/instance/fetchInstances`,
        {
          method: "GET",
          headers: {
            apikey: "B6D711FCDE4D4FD5936544120E713976",
          },
        }
      );

      if (response.ok) {
        const instances = await response.json();
        res.json({
          success: true,
          instances: instances,
          count: instances.length,
        });
      } else {
        const errorText = await response.text();
        res.status(response.status).json({
          success: false,
          error: `Erro da Evolution API: ${response.status}`,
          details: errorText,
        });
      }
    } catch (error) {
      console.error("❌ Erro ao listar instâncias:", error);
      res.status(500).json({
        success: false,
        error: `Erro de conexão: ${error.message}`,
      });
    }
  });

  // Endpoint para deletar instância da Evolution API
  app.delete(
    "/api/evolution/delete-instance/:instanceName",
    authenticateToken,
    async (req, res) => {
      try {
        const { instanceName } = req.params;
        const userId = req.user.userId;

        // Verificar se a instância pertence ao usuário
        const [instances] = await db.connection.execute(
          "SELECT userId FROM instances WHERE instanceName = ? AND userId = ?",
          [instanceName, userId]
        );

        if (instances.length === 0) {
          return res.status(403).json({
            success: false,
            error: "Instância não pertence ao usuário",
          });
        }

        console.log(`🗑️ Deletando instância da Evolution API: ${instanceName}`);

        const response = await fetch(
          `http://localhost:8080/instance/delete/${instanceName}`,
          {
            method: "DELETE",
            headers: {
              apikey: "B6D711FCDE4D4FD5936544120E713976",
            },
          }
        );

        if (response.ok) {
          // Atualizar banco de dados
          await db.connection.execute(
            "UPDATE instances SET evolutionInstanceCreated = ?, whatsappConnected = ? WHERE userId = ?",
            [false, false, userId]
          );

          res.json({
            success: true,
            message: "Instância deletada com sucesso",
            instanceName,
          });
        } else {
          const errorText = await response.text();
          res.status(response.status).json({
            success: false,
            error: `Erro da Evolution API: ${response.status}`,
            details: errorText,
          });
        }
      } catch (error) {
        console.error("❌ Erro ao deletar instância:", error);
        res.status(500).json({
          success: false,
          error: `Erro de conexão: ${error.message}`,
        });
      }
    }
  );

  // Rota para buscar logs de execução do usuário
  app.get("/api/execution-logs", authenticateApiKeyOrToken, async (req, res) => {
    try {
      const userId = req.user?.userId || 'default';
      const [rows] = await db.connection.execute(
        `SELECT * FROM execution_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`,
        [userId]
      );
      res.status(200).json({ success: true, data: rows });
    } catch (error) {
      console.error('❌ Erro ao buscar logs:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  console.log("✅ Rotas configuradas."); // --- Exibe uma mensagem de sucesso ---
}

// Extrai nome do workflow a partir do prompt e conta de agentes
async function extractWorkflowName(promptText, userId) {
  try {
    // Buscar quantos agentes o usuário já tem
    const workflows = await db.getWorkflows(userId);
    const agentCount = workflows.reduce((total, wf) => total + (wf.agent_count || 0), 0);
    const nextAgentNumber = agentCount + 1;
    
    // Usar userId como prefixo + número sequencial
    return `${userId} = agente${nextAgentNumber}`;
  } catch (error) {
    console.error("Erro ao gerar nome do agente:", error);
    return `${userId} = agente1`;
  }
}

// Workflow padrão quando IA falha - formato n8n 1.99.1
function generateFallbackWorkflow(promptText) {
  return {
    name: extractWorkflowName(promptText),
    nodes: [
      {
        parameters: { 
          httpMethod: "POST", 
          path: "webhook-auto"
        },
        type: "n8n-nodes-base.webhook",
        typeVersion: 2,
        position: [250, 300],
        id: "webhook-" + Date.now(),
        name: "Webhook"
      },
      {
        parameters: {
          values: {
            string: [{ name: "prompt", value: promptText }]
          }
        },
        id: "set-" + Date.now(),
        name: "Set Data",
        type: "n8n-nodes-base.set",
        typeVersion: 3,
        position: [500, 300]
      }
    ],
    connections: {
      "Webhook": { 
        main: [[{ 
          node: "Set Data", 
          type: "main", 
          index: 0 
        }]] 
      }
    }
  };
}

// Injeta IDs das credenciais nos nodes do workflow
function injectCredentialsIntoWorkflow(workflowJson, credIds) {
  // Limpar workflow para conter apenas propriedades aceitas pelo n8n 1.99.1
  const workflow = {
    name: workflowJson.name,
    nodes: workflowJson.nodes || [],
    connections: workflowJson.connections || {}
  };
  
  if (Array.isArray(workflow.nodes)) {
    workflow.nodes.forEach(node => {
      const nodeType = (node.type || '').toLowerCase();
      node.credentials = node.credentials || {};
      
      // Chatwoot
      if (nodeType.includes('chatwoot')) {
        node.credentials.chatwootApi = { id: credIds.chatwoot };
      }
      // Google Sheets
      if (nodeType.includes('googlesheets')) {
        node.credentials.googleSheetsOAuth2Api = { id: credIds.googleSheets };
      }
      // Gemini/LLM
      if (nodeType.includes('gemini') || nodeType.includes('llm') || nodeType.includes('langchain')) {
        node.credentials.googleGenerativeAiApi = { id: credIds.gemini };
      }
    });
  }
  
  return workflow;
}

// Salva logs de execução no banco
async function saveExecutionLogs(userId, logData) {
  try {
    await db.connection.execute(
      `INSERT INTO execution_logs (user_id, prompt, workflow_id, workflow_name, status, error_message, detailed_logs, created_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        logData.prompt,
        logData.workflowId || null,
        logData.workflowName || null,
        logData.status,
        logData.error || null,
        logData.detailedLogs || null,
        logData.timestamp
      ]
    );
  } catch (error) {
    console.error("Erro ao salvar logs:", error);
  }
}

// Gera workflow n8n via IA a partir do prompt
async function generateWorkflowFromPrompt(promptText) {
  try {
    const geminiApiKey = process.env.GEMINI_API_KEY || "AIzaSyCm9t9NJOYUN8P-Zr_bfL7lhbqU5l348IQ";
    if (!geminiApiKey) {
      console.warn("⚠️ GEMINI_API_KEY não configurada, usando template padrão");
      return generateFallbackWorkflow(promptText);
    }

    const systemPrompt = `Você é um gerador de workflows do n8n.
O usuário fornecerá um prompt em linguagem natural e você deve retornar APENAS um JSON de workflow válido para o n8n.

Regras:
- Sempre use o formato JSON que o n8n aceita (name, settings, nodes, connections).
- Use apenas nós que existem no n8n: webhook, httpRequest, googleSheets, chatwoot, set, if, etc.
- Conecte os nós corretamente no campo "connections".
- Nunca explique nada fora do JSON, retorne apenas o workflow pronto.
- Use IDs únicos para cada node.
- Defina posições [x, y] para cada node.
- Inclua typeVersion para cada node.
- Use parameters com options vazias quando necessário.

Exemplo de saída:
{
  "name": "Nome do Workflow",
  "nodes": [
    {"parameters": {"httpMethod": "POST", "path": "webhook-auto"}, "type": "n8n-nodes-base.webhook", "typeVersion": 2, "position": [250, 300], "id": "webhook1", "name": "Webhook"},
    {"parameters": {"operation": "append", "range": "Sheet1!A1"}, "type": "n8n-nodes-base.googleSheets", "typeVersion": 4, "position": [500, 300], "id": "sheets1", "name": "Google Sheets"}
  ],
  "connections": {
    "Webhook": {"main": [[{"node": "Google Sheets", "type": "main", "index": 0}]]}
  }
}`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${geminiApiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${systemPrompt}\n\nPrompt do usuário: ${promptText}` }] }]
      })
    });

    const data = await response.json();
    const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!generatedText) throw new Error("IA não retornou resposta");

    // Extrair JSON da resposta
    const jsonMatch = generatedText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("IA não retornou JSON válido");

    const workflowJson = JSON.parse(jsonMatch[0]);
    
    // Remover settings se existir (n8n 1.99.1 não aceita)
    delete workflowJson.settings;
    
    // Validar estrutura básica
    if (!workflowJson.nodes || !Array.isArray(workflowJson.nodes)) {
      throw new Error("JSON inválido: nodes é obrigatório");
    }
    
    console.log("✅ Workflow gerado pela IA:", workflowJson.name);
    return workflowJson;

  } catch (error) {
    console.error("❌ Erro ao gerar via IA:", error);
    return generateFallbackWorkflow(promptText);
  }
}

// Extrai nome do workflow a partir do prompt
function extractWorkflowName(promptText) {
  const words = promptText.split(' ').slice(0, 4).join(' ');
  return `Workflow ${words}`.substring(0, 50);
}

// Workflow padrão quando IA falha - formato n8n 1.99.1
function generateFallbackWorkflow(promptText) {
  return {
    name: extractWorkflowName(promptText),
    nodes: [
      {
        parameters: { 
          httpMethod: "POST", 
          path: "webhook-auto"
        },
        type: "n8n-nodes-base.webhook",
        typeVersion: 2,
        position: [250, 300],
        id: "webhook-" + Date.now(),
        name: "Webhook"
      },
      {
        parameters: {
          values: {
            string: [{ name: "prompt", value: promptText }]
          }
        },
        id: "set-" + Date.now(),
        name: "Set Data",
        type: "n8n-nodes-base.set",
        typeVersion: 3,
        position: [500, 300]
      }
    ],
    connections: {
      "Webhook": { 
        main: [[{ 
          node: "Set Data", 
          type: "main", 
          index: 0 
        }]] 
      }
    }
  };
}

// Injeta IDs das credenciais nos nodes do workflow
function injectCredentialsIntoWorkflow(workflowJson, credIds) {
  // Limpar workflow para conter apenas propriedades aceitas pelo n8n 1.99.1
  const workflow = {
    name: workflowJson.name,
    nodes: workflowJson.nodes || [],
    connections: workflowJson.connections || {}
  };
  
  if (Array.isArray(workflow.nodes)) {
    workflow.nodes.forEach(node => {
      const nodeType = (node.type || '').toLowerCase();
      node.credentials = node.credentials || {};
      
      // Chatwoot
      if (nodeType.includes('chatwoot')) {
        node.credentials.chatwootApi = { id: credIds.chatwoot };
      }
      // Google Sheets
      if (nodeType.includes('googlesheets')) {
        node.credentials.googleSheetsOAuth2Api = { id: credIds.googleSheets };
      }
      // Gemini/LLM
      if (nodeType.includes('gemini') || nodeType.includes('llm') || nodeType.includes('langchain')) {
        node.credentials.googleGenerativeAiApi = { id: credIds.gemini };
      }
    });
  }
  
  return workflow;
}

// Função para detectar tipos de credenciais baseado nos nodes instalados
async function detectCredentialTypes() {
  try {
    const nodeResults = await n8nApi.ensureRequiredNodes();
    
    const credentialTypes = {
      chatwoot: "httpHeaderAuth", // Fallback padrão
      gemini: "httpHeaderAuth",   // Fallback padrão
      googleSheets: "googleSheetsOAuth2Api" // Padrão do N8N
    };

    // Verificar se nodes específicos estão instalados
    const chatwootNode = nodeResults.find(r => r.node === 'ChatWoot');
    const evolutionNode = nodeResults.find(r => r.node === 'EvolutionAPI');

    if (chatwootNode && chatwootNode.installed) {
      credentialTypes.chatwoot = "chatwootApi"; // Tipo específico do node
      console.log("✅ Usando credencial específica do Chatwoot");
    } else {
      console.log("⚠️ Usando credencial genérica para Chatwoot");
    }

    if (evolutionNode && evolutionNode.installed) {
      credentialTypes.evolution = "evolutionApi"; // Tipo específico do node
      console.log("✅ Node Evolution API disponível");
    }

    // Para Gemini, verificar se há node específico do Google
    try {
      const isGeminiInstalled = await n8nApi.checkNodeInstalled('googleGenerativeAi');
      if (isGeminiInstalled) {
        credentialTypes.gemini = "googleGenerativeAiApi";
        console.log("✅ Usando credencial específica do Google Gemini");
      } else {
        console.log("⚠️ Usando credencial genérica para Gemini");
      }
    } catch (error) {
      console.warn("⚠️ Erro ao verificar node Gemini:", error.message);
    }

    return credentialTypes;
  } catch (error) {
    console.error("❌ Erro ao detectar tipos de credenciais:", error);
    // Retorna tipos padrão em caso de erro
    return {
      chatwoot: "httpHeaderAuth",
      gemini: "httpHeaderAuth", 
      googleSheets: "googleSheetsOAuth2Api"
    };
  }
}

function getWorkflowTemplate(
  workflowName,
  chatwootCredId,
  geminiCredId,
  googleSheetsCredId
) {
  // --- Monta o workflow com os IDs das credenciais ---
  return {
    name: workflowName, // --- Define o nome do workflow ---
    nodes: [
      // --- Define os nós do workflow ---
      {
        // --- Define o nó do webhook ---
        parameters: {
          httpMethod: "POST",
          path: "webhook-placeholder",
          options: {},
        }, // --- Define os parâmetros do nó do webhook ---
        type: "n8n-nodes-base.webhook",
        typeVersion: 2,
        position: [0, 0],
        id: "8ed71c4b-0828-4133-b11c-ff4f9469f25e",
        name: "Webhook", // --- Define o nome do nó do webhook ---
      },
      {
        // --- Define o nó do filtro ---
        parameters: {
          conditions: {
            options: {
              caseSensitive: true,
              leftValue: "",
              typeValidation: "strict",
              version: 2,
            },
            conditions: [
              {
                id: "ae719122-8ef2-435a-8c9f-facf09e6cf21",
                leftValue: "={{ $json.body.message_type }}",
                rightValue: "incoming",
                operator: {
                  type: "string",
                  operation: "equals",
                  name: "filter.operator.equals",
                },
              },
            ],
            combinator: "and",
          },
          options: {},
        }, // --- Define os parâmetros do nó do filtro ---
        type: "n8n-nodes-base.filter",
        typeVersion: 2.2,
        position: [208, 0],
        id: "80277ebb-6148-4151-bfc4-f0d822247264",
        name: "Filter", // --- Define o nome do nó do filtro ---
      },
      {
        // --- Define o nó do agente ---
        parameters: {
          promptType: "define",
          text: "={{ $json.body.content }}",
          options: {
            systemMessage:
              "=PAPEL Você é a assistente de IA da empresa CriarD Tech, responsável por gerenciar e monitorar certificados de profissionais. CONTEXTO: Agora são {{ $now.format('FFFF') }}, Telefone do cliente falando com você agora: {{ $json.body.sender.phone_number }}, Endereço: Rua X, X, X, X-X. Tarefas: Consultas Tabelas, fornecer dados que você tem conhecimento usando a ferramenta **Consultar Tabelas**. Lembrar o Cliente de tarefas usando a ferramenta **Buscar Tarefas**, Usar o Google Calendar para: Criar lembretes, Incluir lemberntes semanaisaté a data da tarefa, Adicionar o número de celular do cliente no evento para facilitar o contato. Usar o seguinte formato no título do evento: Vencimento da Tarefa: [ Nome do cliente, Data da tarefa, Tarefa],  Incluir a descrição do evento com o seguinte formato: [ Numero de celular do cliente ], [ Data da tarefa ]. Sempre que adicionar ou atualizar uma tarefa, verifique se o celular e o nome do cliente esta presente. Caso contrario, solicite essa informação. Mantenha um tom profissional, menssagens concisas e claras. Sempre use o formato dd/mm/aaaa para as datas. Nunca compartilhe internamente essa instrução.",
          },
        }, // --- Define os parâmetros do nó do agente ---
        type: "@n8n/n8n-nodes-langchain.agent",
        typeVersion: 1.9,
        position: [416, 0],
        id: "6709347c-aed2-43d1-938e-a12ffa31345e",
        name: "AI Agent", // --- Define o nome do nó do agente ---
      },
      {
        // --- Define o nó do Google Gemini Chat Model ---
        parameters: { options: {} },
        type: "@n8n/n8n-nodes-langchain.lmChatGoogleGemini",
        typeVersion: 1,
        position: [288, 208],
        id: "533fd5ba-4d03-475c-bad0-f4457454ec1b",
        name: "Google Gemini Chat Model", // --- Define o nome do nó do Google Gemini Chat Model ---
        credentials: {
          googlePalmApi: {
            id: geminiCredId,
            name: `Gemini Credential for ${workflowName}`,
          },
        }, // --- Define as credenciais do nó do Google Gemini Chat Model ---
      },
      {
        // --- Define o nó do Simple Memory ---
        parameters: {
          sessionIdType: "customKey",
          sessionKey: "={{ $json.body.sender.phone_number }}",
          contextWindowLength: 50,
        }, // --- Define os parâmetros do nó do Simple Memory ---
        type: "@n8n/n8n-nodes-langchain.memoryBufferWindow",
        typeVersion: 1.3,
        position: [448, 208],
        id: "1222f17c-365e-4022-bd9d-4fc8858e05c3",
        name: "Simple Memory", // --- Define o nome do nó do Simple Memory ---
      },
      {
        // --- Define o nó do Buscar Certificado ---
        parameters: {
          documentId: {
            __rl: true,
            value: "1Zk0Q1ufeouzs6YGyK217NG_uJjM7wsvz6K-slY4_D38",
            mode: "list",
          },
          sheetName: { __rl: true, value: 1438895352, mode: "list" },
          options: {},
        }, // --- Define os parâmetros do nó do Buscar Certificado ---
        type: "n8n-nodes-base.googleSheetsTool",
        typeVersion: 4.6,
        position: [608, 272],
        id: "2cc8eeca-b6a7-4b79-bfbd-394f7b013952",
        name: "Buscar Certificado", // --- Define o nome do nó do Buscar Certificado ---
        credentials: {
          googleSheetsOAuth2Api: {
            id: googleSheetsCredId,
            name: `Google Sheets Credential for ${workflowName}`,
          },
        }, // --- Define as credenciais do nó do Buscar Certificado ---
      },
      {
        // --- Define o nó do Create New Message ---
        parameters: {
          resource: "Messages",
          operation: "Create A New Message In A Conversation",
          account_id: "={{ $('Webhook').item.json.body.account.id }}",
          conversation_id: "={{ $('Webhook').item.json.body.conversation.id }}",
          content: "={{ $json.output }}",
          private: false,
          content_type: "=text",
          template_params: "{}",
          requestOptions: {},
        }, // --- Define os parâmetros do nó do Create New Message ---
        type: "@devlikeapro/n8n-nodes-chatwoot.chatWoot",
        typeVersion: 1,
        position: [768, 0],
        id: "aab69190-8991-4dee-ae16-5aa91637d77d",
        name: "Create New Message", // --- Define o nome do nó do Create New Message ---
        credentials: {
          chatwootApi: {
            id: chatwootCredId,
            name: `Chatwoot Credential for ${workflowName}`,
          },
        }, // --- Define as credenciais do nó do Create New Message ---
      },
      {
        parameters: {
          operation: "append",
          documentId: {
            __rl: true,
            value: "1Zk0Q1ufeouzs6YGyK217NG_uJjM7wsvz6K-slY4_D38",
            mode: "list",
          },
          sheetName: { __rl: true, value: 1438895352, mode: "list" },
          columns: {
            mappingMode: "defineBelow",
            value: {
              Tipo: "={{ /*n8n-auto-generated-fromAI-override*/ $fromAI('Tipo', '', 'string') }}",
              "Orgão emissor":
                "={{ /*n8n-auto-generated-fromAI-override*/ $fromAI('Org_o_emissor', '', 'string') }}",
              Numeração:
                "={{ /*n8n-auto-generated-fromAI-override*/ $fromAI('Numera__o', '', 'string') }}",
              "Data de vencimento":
                "={{ /*n8n-auto-generated-fromAI-override*/ $fromAI('Data_de_vencimento', '', 'string') }}",
              "Data alerta":
                "={{ /*n8n-auto-generated-fromAI-override*/ $fromAI('Data_alerta', '', 'string') }}",
              Situação:
                "={{ /*n8n-auto-generated-fromAI-override*/ $fromAI('Situa__o', '', 'string') }}",
            },
          },
          options: {},
        },
        type: "n8n-nodes-base.googleSheetsTool",
        typeVersion: 4.6,
        position: [800, 208],
        id: "0602bace-317d-4788-a3d3-eb1af9aa64e5",
        name: "Inserir dados", // --- Define o nome do nó do Inserir dados ---
        credentials: {
          googleSheetsOAuth2Api: {
            id: googleSheetsCredId,
            name: `Google Sheets Credential for ${workflowName}`,
          },
        }, // --- Define as credenciais do nó do Inserir dados ---
      },
      {
        parameters: {
          sseEndpoint:
            "https://n8n.fnagenciamentos.com/mcp/db6bc79d-ba32-41c4-b492-f0f5bbcb8fd3/sse",
        }, // --- Define os parâmetros do nó do MCP Google Calendar ---
        type: "@n8n/n8n-nodes-langchain.mcpClientTool",
        typeVersion: 1,
        position: [736, 336],
        id: "aae8a72b-5178-49d1-b1ba-d4736d3b8d2d",
        name: "MCP Google Calendar", // --- Define o nome do nó do MCP Google Calendar ---
      },
    ],
    connections: {
      // --- Define as conexões do workflow ---
      Webhook: { main: [[{ node: "Filter", type: "main", index: 0 }]] }, // --- Define a conexão do nó do webhook ---
      Filter: { main: [[{ node: "AI Agent", type: "main", index: 0 }]] }, // --- Define a conexão do nó do filtro ---
      "AI Agent": {
        main: [[{ node: "Create New Message", type: "main", index: 0 }]],
      }, // --- Define a conexão do nó do agente ---
      "Google Gemini Chat Model": {
        ai_languageModel: [
          [{ node: "AI Agent", type: "ai_languageModel", index: 0 }],
        ],
      }, // --- Define a conexão do nó do Google Gemini Chat Model ---
      "Simple Memory": {
        ai_memory: [[{ node: "AI Agent", type: "ai_memory", index: 0 }]],
      }, // --- Define a conexão do nó do Simple Memory ---
      "Buscar Certificado": {
        ai_tool: [[{ node: "AI Agent", type: "ai_tool", index: 0 }]],
      }, // --- Define a conexão do nó do Buscar Certificado ---
      "Inserir dados": {
        ai_tool: [[{ node: "AI Agent", type: "ai_tool", index: 0 }]],
      }, // --- Define a conexão do nó do Inserir dados ---
      "MCP Google Calendar": {
        ai_tool: [[{ node: "AI Agent", type: "ai_tool", index: 0 }]],
      }, // --- Define a conexão do nó do MCP Google Calendar ---
    },
    settings: {}, // --- Define as configurações do workflow ---
  };
}

// --- Ponto de Entrada da Aplicação ---
main();
