<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
// Importações PrimeVue
import Button from "primevue/button";
import Card from "primevue/card";
import Dialog from "primevue/dialog";
import Divider from "primevue/divider";
import FloatLabel from "primevue/floatlabel";
import InputText from "primevue/inputtext";
import Panel from "primevue/panel";
import Textarea from "primevue/textarea";
import { useToast } from "primevue/usetoast";

const toast = useToast();
const router = useRouter();

// Estado reativo da aplicação
const workflows = ref([]);
const currentWorkflow = ref(null);

const showCreateAgentModal = ref(false);
const showConfigModal = ref(false);
const showPromptModal = ref(false);
const showClientModal = ref(false);
const editingCredentialType = ref(null);
const editingAgentId = ref(null);
const editingAgentName = ref("");
const tempPrompt = ref("");

// Estado para gestão de clientes multi-tenant
const clients = ref([]);
const isProvisioningClient = ref(false);

// Estado para navegação entre páginas
const currentPage = ref("workflows"); // 'workflows', 'clients', 'settings', 'qrcode'

// Estado para conexão WhatsApp
const whatsappConnection = reactive({
  connected: false,
  qrCode: null,
  loading: false,
  generating: false,
  checking: false,
  instanceName: null,
});

// Estado para n8n
const n8nStatus = reactive({
  online: false,
  loading: true,
  message: "",
  authError: false,
});

// Estado para API Key manual
const manualApiKey = ref("");

// Constante para API Key padrão (mesma do n8n)
const DEFAULT_API_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3MDk0N2QzMC0zNDlhLTRhNjMtYmUyOS1mMmU4ZjVlMDNhNDQiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzU0ODU0OTMxLCJleHAiOjE3NTczODY4MDB9._ABlWvKjEGtruONVB1P8E6tTAw3jbH1M3baByATDLRk";

// API Key atual (pode ser a padrão ou a manual)
const API_KEY = computed(() => manualApiKey.value || DEFAULT_API_KEY);

// Verificar autenticação e carregar dados do usuário
async function checkAuth() {
  const token = localStorage.getItem("authToken");
  if (!token) {
    // Redirecionar para login se não estiver autenticado
    router.push("/login");
    return false;
  }

  try {
    const response = await fetch("http://localhost:3001/api/auth/me", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.ok) {
      const data = await response.json();
      // Carregar dados do usuário logado
      whatsappConnection.instanceName = data.user.instanceName;
      console.log("✅ Usuário autenticado:", data.user);
      return true;
    } else {
      // Token inválido - redirecionar para login
      localStorage.removeItem("authToken");
      localStorage.removeItem("user");
      router.push("/login");
      return false;
    }
  } catch (error) {
    console.error("❌ Erro ao verificar autenticação:", error);
    router.push("/login");
    return false;
  }
}

// Funções para WhatsApp

async function generateQRCode() {
  const token = localStorage.getItem("authToken");
  if (!token) {
    router.push("/login");
    return;
  }

  whatsappConnection.generating = true;
  try {
    // Primeiro, verificar e atualizar o instanceName se necessário
    const checkResponse = await fetch("http://localhost:3001/api/evolution/check-instance", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (checkResponse.ok) {
      const checkData = await checkResponse.json();
      if (checkData.success && checkData.instanceName) {
        whatsappConnection.instanceName = checkData.instanceName;
        console.log("✅ InstanceName atualizado:", checkData.instanceName);
      }
    }

    // Verificar se temos o instanceName
    if (!whatsappConnection.instanceName) {
      showNotification("Erro: Nome da instância não encontrado. Faça login novamente.", "error");
      return;
    }

    const response = await fetch(
      `http://localhost:3001/api/evolution/qrcode/${whatsappConnection.instanceName}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    const data = await response.json();

    if (data.success) {
      whatsappConnection.qrCode = data.qrcode;
      showNotification("QR Code gerado com sucesso!", "success");
      // Iniciar verificação automática de status
      startStatusCheck();
    } else {
      throw new Error(data.error || "Erro ao gerar QR Code");
    }
  } catch (error) {
    console.error("Erro ao gerar QR Code:", error);
    showNotification(`Erro ao gerar QR Code: ${error.message}`, "error");
  } finally {
    whatsappConnection.generating = false;
  }
}

async function checkWhatsAppStatus() {
  const token = localStorage.getItem("authToken");
  if (!token) {
    router.push("/login");
    return;
  }

  whatsappConnection.checking = true;
  try {
    const response = await fetch("http://localhost:3001/api/status", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const data = await response.json();

    if (data.success) {
      whatsappConnection.connected = data.connected;
      if (data.connected) {
        whatsappConnection.qrCode = null; // Remove QR code quando conectado
        showNotification("WhatsApp conectado com sucesso!", "success");
      }
    } else {
      throw new Error(data.error || "Erro ao verificar status");
    }
  } catch (error) {
    console.error("Erro ao verificar status:", error);
    showNotification(`Erro ao verificar status: ${error.message}`, "error");
  } finally {
    whatsappConnection.checking = false;
  }
}

async function disconnectWhatsApp() {
  // TODO: Implementar desconexão via API da Evolution
  showNotification("Função de desconexão será implementada", "info");
}

function startStatusCheck() {
  const interval = setInterval(async () => {
    await checkWhatsAppStatus();
    if (whatsappConnection.connected) {
      clearInterval(interval);
    }
  }, 3000); // Verifica a cada 3 segundos

  // Para automaticamente após 2 minutos se não conectar
  setTimeout(() => {
    clearInterval(interval);
  }, 120000);
}

function navigateToPage(page) {
  currentPage.value = page;

  // Se navegar para a página de QR Code, verificar status inicial
  if (page === "qrcode") {
    whatsappConnection.loading = true;
    setTimeout(async () => {
      await checkWhatsAppStatus();
      whatsappConnection.loading = false;
    }, 1000);
  }

  // Se navegar para a página de configurações, verificar status do n8n
  if (page === "settings") {
    setTimeout(async () => {
      await checkN8nStatus();
    }, 500);
  }
}

// Verificar autenticação ao carregar o dashboard
onMounted(async () => {
  const isAuthenticated = await checkAuth();
  if (isAuthenticated) {
    // Sincronizar a API key padrão com o backend
    try {
      await fetch("http://localhost:3001/api/n8n/sync-api-key", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          apiKey: DEFAULT_API_KEY,
        }),
      });
      console.log("✅ API Key padrão sincronizada com o backend");
    } catch (error) {
      console.warn("⚠️ Erro ao sincronizar API key padrão:", error);
    }

    // Verificar status do n8n primeiro
    await checkN8nStatus();

    // Se n8n estiver online, carregar workflows
    if (n8nStatus.online) {
      await loadWorkflows();
    }

    // await loadClients();
    console.log("✅ Dashboard carregado e usuário autenticado");
  }
});

// Função para configurar n8n do zero
async function configureN8n() {
  try {
    showNotification("Abrindo n8n para configuração...", "info");

    // Abrir n8n em nova aba
    window.open("http://localhost:5678", "_blank");

    // Verificar novamente o status após um tempo
    setTimeout(async () => {
      await checkN8nStatus();
      if (n8nStatus.online) {
        showNotification("n8n configurado com sucesso!", "success");
        await loadWorkflows();
      }
    }, 3000);
  } catch (error) {
    console.error("Erro ao configurar n8n:", error);
    showNotification("Erro ao configurar n8n. Verifique se o serviço está rodando.", "error");
  }
}

const newAgentForm = reactive({
  workflowName: "",
  chatwootApiUrl: "",
  chatwootAccessToken: "",
  geminiApiKey: "",
  googleClientId: "",
  googleClientSecret: "",
});

const configCredentialsForm = reactive({
  chatwoot: { apiUrl: "", accessToken: "" },
  gemini: { apiKey: "" },
  googleSheets: { clientId: "", clientSecret: "" },
});

// Formulário para criar novos clientes
const newClientForm = reactive({
  clientName: "",
  clientEmail: "",
});

// Computed property para filtrar workflows que têm agentes
const filteredWorkflows = computed(() => {
  return workflows.value.filter((workflow) => workflow.agent_count && workflow.agent_count > 0);
});

// Computed properties para verificar status das credenciais
const chatwootConfigured = computed(() => {
  const creds = currentWorkflow.value?.credentials?.chatwoot;
  return creds && creds.apiUrl && creds.accessToken;
});

const geminiConfigured = computed(() => {
  const creds = currentWorkflow.value?.credentials?.gemini;
  return creds && creds.apiKey;
});

const googleSheetsConfigured = computed(() => {
  const creds = currentWorkflow.value?.credentials?.googleSheets;
  return creds && creds.clientId && creds.clientSecret;
});

// Funções de Notificação usando PrimeVue Toast
function showNotification(message, type = "info") {
  const severity = type === "error" ? "error" : type === "success" ? "success" : "info";
  toast.add({
    severity,
    summary: type === "error" ? "Erro" : type === "success" ? "Sucesso" : "Informação",
    detail: message,
    life: 3000,
  });
}

// Função para verificar status do n8n
async function checkN8nStatus() {
  n8nStatus.loading = true;
  n8nStatus.authError = false;

  try {
    const response = await fetch("http://localhost:3001/api/n8n-status");
    const result = await response.json();

    if (result.status === "auth_error") {
      n8nStatus.online = false;
      n8nStatus.authError = true;
      n8nStatus.message = "API Key incorreta. Insira a API Key correta do n8n.";
    } else {
      n8nStatus.online = result.success && result.status === "online";
      n8nStatus.authError = false;
      n8nStatus.message = result.message;
    }

    console.log("🔍 Status do n8n:", result);
    return n8nStatus.online;
  } catch (error) {
    console.error("❌ Erro ao verificar status do n8n:", error);
    n8nStatus.online = false;
    n8nStatus.authError = false;
    n8nStatus.message = "Erro ao conectar com n8n";
    return false;
  } finally {
    n8nStatus.loading = false;
  }
}

// Função para salvar API Key manual
async function saveManualApiKey() {
  if (!manualApiKey.value.trim()) {
    showNotification("Por favor, insira uma API Key válida.", "warn");
    return;
  }

  try {
    // Primeiro testar a nova API Key diretamente no n8n
    const n8nResponse = await fetch("http://localhost:5678/api/v1/credentials", {
      method: "POST",
      headers: {
        "X-N8N-API-KEY": manualApiKey.value,
        "Content-Type": "application/json",
      },
    });

    // Se retornar 405 (Method Not Allowed) ou 400 (Bad Request), significa que a API key está correta
    // mas o endpoint não aceita POST sem body ou espera dados específicos
    if (n8nResponse.status === 405 || n8nResponse.status === 400) {
      // Sincronizar a API key com o backend
      const backendResponse = await fetch("http://localhost:3001/api/n8n/sync-api-key", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          apiKey: manualApiKey.value,
        }),
      });

      if (backendResponse.ok) {
        n8nStatus.authError = false;
        n8nStatus.online = true;
        n8nStatus.message = "API Key configurada com sucesso!";
        showNotification("API Key configurada e sincronizada com sucesso!", "success");

        // Carregar workflows após configurar a API Key
        await loadWorkflows();
      } else {
        showNotification("Erro ao sincronizar API Key com o backend.", "error");
      }
    } else if (n8nResponse.status === 401) {
      showNotification("API Key inválida. Verifique e tente novamente.", "error");
    } else {
      showNotification("Erro ao testar API Key. Status: " + n8nResponse.status, "error");
    }
  } catch (error) {
    console.error("Erro ao testar API Key:", error);
    showNotification("Erro ao testar API Key. Verifique se o n8n está rodando.", "error");
  }
}

// Lógica da API
async function loadWorkflows() {
  workflows.value = [];

  // Primeiro verificar se o n8n está online
  const n8nOnline = await checkN8nStatus();

  if (!n8nOnline) {
    showNotification("n8n não está disponível. Verifique se o serviço está rodando.", "warn");
    return;
  }

  try {
    const response = await fetch("http://localhost:3001/api/db/workflows", {
      headers: {
        "x-api-key": API_KEY,
        "Content-Type": "application/json",
      },
    });
    const result = await response.json();
    if (!result.success) throw new Error(result.error);
    workflows.value = result.data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  } catch (error) {
    showNotification(`Erro ao carregar workflows: ${error.message}`, "error");
  }
}

async function syncWorkflows() {
  // Primeiro verificar se o n8n está online
  const n8nOnline = await checkN8nStatus();

  if (!n8nOnline) {
    showNotification("n8n não está disponível. Verifique se o serviço está rodando.", "warn");
    return;
  }

  showNotification("Sincronizando...", "info");
  try {
    await fetch("http://localhost:3001/api/sync-n8n-to-db", {
      method: "POST",
      headers: {
        "x-api-key": API_KEY,
        "Content-Type": "application/json",
      },
    });
    await loadWorkflows();
    showNotification("Sincronizado com sucesso!", "success");
  } catch (error) {
    showNotification(`Erro: ${error.message}`, "error");
  }
}

async function selectWorkflow(workflowId) {
  currentWorkflow.value = null;
  try {
    const response = await fetch(`http://localhost:3001/api/db/workflows/${workflowId}`, {
      headers: {
        "x-api-key": API_KEY,
        "Content-Type": "application/json",
      },
    });
    const result = await response.json();
    if (!result.success) throw new Error(result.error);
    currentWorkflow.value = result.data;
  } catch (error) {
    showNotification(`Erro ao carregar detalhes: ${error.message}`, "error");
  }
}

// Lógica dos Modais e Formulários
function openConfigModal(type) {
  editingCredentialType.value = type;
  const creds = currentWorkflow.value.credentials?.[type] || {};
  if (type === "chatwoot") {
    configCredentialsForm.chatwoot = { ...creds };
  } else if (type === "gemini") {
    configCredentialsForm.gemini = { ...creds };
  } else if (type === "googleSheets") {
    configCredentialsForm.googleSheets = { ...creds };
  }
  showConfigModal.value = true;
}

function startEditPrompt(agent) {
  editingAgentId.value = agent.id;
  editingAgentName.value = agent.name;
  tempPrompt.value = agent.prompt || "";
  showPromptModal.value = true;
}

async function saveAgentPrompt() {
  if (!editingAgentId.value || !currentWorkflow.value) return;

  showNotification("Salvando prompt no banco local...", "info");
  try {
    // 1. Primeiro salva no banco local
    console.log(`Salvando prompt para o agente ${editingAgentId.value}:`, tempPrompt.value);
    await fetch(`http://localhost:3001/api/db/agents/${editingAgentId.value}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: tempPrompt.value }),
    });

    showNotification("Sincronizando com n8n...", "info");

    // 2. Depois sincroniza com o n8n
    console.log("Sincronizando prompt com n8n:", {
      agentId: editingAgentId.value,
      workflowId: currentWorkflow.value.id,
      agentName: editingAgentName.value,
      prompt: tempPrompt.value.substring(0, 100) + "...",
    });

    const syncResponse = await fetch(
      `http://localhost:3001/api/db/agents/${editingAgentId.value}/sync-n8n`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": API_KEY,
        },
        body: JSON.stringify({
          prompt: tempPrompt.value,
          workflowId: currentWorkflow.value.id,
          agentName: editingAgentName.value,
        }),
      }
    );

    if (!syncResponse.ok) {
      const errorData = await syncResponse.json();
      console.error("Erro na resposta da sincronização:", errorData);
      throw new Error(errorData.error || "Erro ao sincronizar com n8n");
    }

    const syncResult = await syncResponse.json();
    console.log("Sincronização com n8n bem-sucedida:", syncResult);

    showNotification("Prompt salvo e sincronizado com n8n com sucesso!", "success");
    showPromptModal.value = false;
    editingAgentId.value = null;
    editingAgentName.value = "";
    tempPrompt.value = "";

    // Recarregar detalhes do workflow para refletir a mudança
    selectWorkflow(currentWorkflow.value.id);
  } catch (error) {
    console.error("Erro ao salvar prompt:", error);
    showNotification(`Erro ao salvar prompt: ${error.message}`, "error");
  }
}

// Função para criar novo agente e workflow
async function createNewAgent() {
  // Validação básica
  if (!newAgentForm.workflowName.trim()) {
    showNotification("Nome do workflow é obrigatório!", "error");
    return;
  }

  if (!newAgentForm.chatwootApiUrl.trim() || !newAgentForm.chatwootAccessToken.trim()) {
    showNotification("Configurações do Chatwoot são obrigatórias!", "error");
    return;
  }

  if (!newAgentForm.geminiApiKey.trim()) {
    showNotification("API Key do Gemini é obrigatória!", "error");
    return;
  }

  showNotification("Criando workflow e configurando credenciais...", "info");

  try {
    const workflowData = {
      workflowName: newAgentForm.workflowName,
      credentials: {
        chatwoot: {
          apiUrl: newAgentForm.chatwootApiUrl,
          accessToken: newAgentForm.chatwootAccessToken,
        },
        gemini: {
          apiKey: newAgentForm.geminiApiKey,
        },
        googleSheets: {
          clientId: newAgentForm.googleClientId || "",
          clientSecret: newAgentForm.googleClientSecret || "",
        },
      },
    };

    console.log("Enviando dados para criação:", workflowData);

    const response = await fetch("http://localhost:3001/api/create-workflow-with-credentials", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
      },
      body: JSON.stringify(workflowData),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Erro ao criar workflow");
    }

    const result = await response.json();
    console.log("Workflow criado com sucesso:", result);

    showNotification("Workflow e agente criados com sucesso!", "success");

    // Limpar formulário
    Object.keys(newAgentForm).forEach((key) => {
      newAgentForm[key] = "";
    });

    // Fechar modal
    showCreateAgentModal.value = false;

    // Recarregar lista de workflows
    loadWorkflows();
  } catch (error) {
    console.error("Erro ao criar workflow:", error);
    showNotification(`Erro ao criar workflow: ${error.message}`, "error");
  }
}

// Função para salvar credenciais do modal
async function saveCredentials() {
  if (!currentWorkflow.value) return;

  showNotification("Salvando e aplicando credenciais...", "info");

  try {
    // 1. Salvar credenciais no banco local
    await fetch(`http://localhost:3001/api/db/credentials/${currentWorkflow.value.id}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
      },
      body: JSON.stringify(configCredentialsForm),
    });

    // 2. Atualizar credenciais no n8n dinamicamente
    await updateN8nCredentials();

    showNotification("Credenciais salvas e aplicadas com sucesso!", "success");
    showConfigModal.value = false;
    selectWorkflow(currentWorkflow.value.id); // Recarregar dados
  } catch (error) {
    console.error("Erro ao salvar credenciais:", error);
    showNotification(`Erro ao salvar credenciais: ${error.message}`, "error");
  }
}

// Função para atualizar credenciais no n8n dinamicamente
async function updateN8nCredentials() {
  if (!currentWorkflow.value) return;

  try {
    const updatePromises = [];

    // Atualizar Chatwoot se configurado
    if (configCredentialsForm.chatwoot.apiUrl && configCredentialsForm.chatwoot.accessToken) {
      updatePromises.push(
        updateN8nCredential("chatwoot", {
          url: configCredentialsForm.chatwoot.apiUrl,
          accessToken: configCredentialsForm.chatwoot.accessToken,
        })
      );
    }

    // Atualizar Gemini se configurado
    if (configCredentialsForm.gemini.apiKey) {
      updatePromises.push(
        updateN8nCredential("gemini", {
          apiKey: configCredentialsForm.gemini.apiKey,
          host: "https://generativelanguage.googleapis.com",
        })
      );
    }

    // Atualizar Google Sheets se configurado
    if (
      configCredentialsForm.googleSheets.clientId &&
      configCredentialsForm.googleSheets.clientSecret
    ) {
      updatePromises.push(
        updateN8nCredential("googleSheets", {
          clientId: configCredentialsForm.googleSheets.clientId,
          clientSecret: configCredentialsForm.googleSheets.clientSecret,
        })
      );
    }

    await Promise.all(updatePromises);
    console.log("Todas as credenciais foram atualizadas no n8n");
  } catch (error) {
    console.error("Erro ao atualizar credenciais no n8n:", error);
    throw error;
  }
}

// Função para atualizar uma credencial específica no n8n
async function updateN8nCredential(type, data) {
  const response = await fetch(`http://localhost:3001/api/update-n8n-credential`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": API_KEY,
    },
    body: JSON.stringify({
      workflowId: currentWorkflow.value.id,
      credentialType: type,
      credentialData: data,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Erro ao atualizar credencial ${type}: ${errorData.error}`);
  }

  return response.json();
}

// Função para testar conexão das credenciais
async function testConnection(credentialType) {
  if (!currentWorkflow.value) return;

  showNotification(`Testando conexão ${credentialType}...`, "info");

  try {
    const response = await fetch(`http://localhost:3001/api/test-credential/${credentialType}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workflowId: currentWorkflow.value.id,
        credentials: currentWorkflow.value.credentials[credentialType],
      }),
    });

    const result = await response.json();

    if (response.ok && result.success) {
      showNotification(`✅ ${credentialType} conectado com sucesso!`, "success");
    } else {
      const errorMsg = result.error || "Credenciais inválidas ou serviço indisponível";
      showNotification(`⚠️ Erro de conexão ${credentialType}: ${errorMsg}`, "warn");
    }
  } catch (error) {
    console.error(`Erro ao testar ${credentialType}:`, error);
    showNotification(`❌ Erro ao testar ${credentialType}: ${error.message}`, "error");
  }
}

// Função para deletar workflow
async function deleteWorkflow(workflowId, workflowName) {
  // Confirmação antes de deletar
  if (
    !confirm(
      `Tem certeza que deseja deletar o workflow "${workflowName}"? Esta ação não pode ser desfeita.`
    )
  ) {
    return;
  }

  showNotification("Deletando workflow...", "info");

  try {
    const response = await fetch(`http://localhost:3001/api/db/workflows/${workflowId}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Erro ao deletar workflow");
    }

    showNotification(`Workflow "${workflowName}" deletado com sucesso!`, "success");

    // Se o workflow deletado era o selecionado, limpar seleção
    if (currentWorkflow.value && currentWorkflow.value.id === workflowId) {
      currentWorkflow.value = null;
    }

    // Recarregar lista de workflows
    loadWorkflows();
  } catch (error) {
    console.error("Erro ao deletar workflow:", error);
    showNotification(`Erro ao deletar workflow: ${error.message}`, "error");
  }
}

// Função para copiar texto para clipboard
function copyToClipboard(text) {
  navigator.clipboard
    .writeText(text)
    .then(() => {
      showNotification("URL copiada para o clipboard!", "success");
    })
    .catch(() => {
      showNotification("Erro ao copiar URL", "error");
    });
}

// Função para truncar texto
function truncateText(text, maxLength) {
  if (!text) return "";
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + "...";
}

// ===== FUNÇÕES DE GESTÃO DE CLIENTES MULTI-TENANT =====

async function loadClients() {
  try {
    // TODO: Implementar endpoints de clientes no backend
    // const response = await fetch("http://localhost:3001/api/clients");
    // const result = await response.json();
    // if (!result.success) throw new Error(result.error);
    // clients.value = result.data;
    clients.value = []; // Temporariamente vazio até implementar
  } catch (error) {
    showNotification(`Erro ao carregar clientes: ${error.message}`, "error");
  }
}

function openCreateClientModal() {
  newClientForm.clientName = "";
  newClientForm.clientEmail = "";
  showClientModal.value = true;
}

async function createClient() {
  if (!newClientForm.clientName || !newClientForm.clientEmail) {
    showNotification("Nome e email do cliente são obrigatórios", "error");
    return;
  }

  isProvisioningClient.value = true;

  try {
    showNotification("Provisionando nova instância...", "info");

    // TODO: Implementar endpoint de provisionamento no backend
    // const response = await fetch("http://localhost:3001/api/clients/provision", {
    //   method: "POST",
    //   headers: { "Content-Type": "application/json" },
    //   body: JSON.stringify({
    //     clientName: newClientForm.clientName,
    //     clientEmail: newClientForm.clientEmail,
    //   }),
    // });

    // const result = await response.json();

    // if (!result.success) throw new Error(result.error);

    // showNotification(`Cliente ${result.data.clientName} provisionado com sucesso!`, "success");
    showNotification("Funcionalidade de provisionamento será implementada em breve!", "info");
    showClientModal.value = false;
    await loadClients();
  } catch (error) {
    showNotification(`Erro no provisionamento: ${error.message}`, "error");
  } finally {
    isProvisioningClient.value = false;
  }
}

async function stopClient(clientId) {
  try {
    showNotification("Parando instância...", "info");
    // TODO: Implementar endpoint de parar cliente no backend
    // const response = await fetch(`http://localhost:3001/api/clients/${clientId}/stop`, {
    //   method: "POST",
    // });
    // const result = await response.json();

    // if (!result.success) throw new Error(result.error);

    // showNotification("Instância parada com sucesso", "success");
    showNotification("Funcionalidade será implementada em breve!", "info");
    await loadClients();
  } catch (error) {
    showNotification(`Erro ao parar instância: ${error.message}`, "error");
  }
}

async function removeClient(clientId) {
  if (!confirm("Tem certeza que deseja remover esta instância? Esta ação não pode ser desfeita.")) {
    return;
  }

  try {
    showNotification("Removendo instância...", "info");
    // TODO: Implementar endpoint de remover cliente no backend
    // const response = await fetch(`http://localhost:3001/api/clients/${clientId}`, {
    //   method: "DELETE",
    // });
    // const result = await response.json();

    // if (!result.success) throw new Error(result.error);

    // showNotification("Instância removida com sucesso", "success");
    showNotification("Funcionalidade será implementada em breve!", "info");
    await loadClients();
  } catch (error) {
    showNotification(`Erro ao remover instância: ${error.message}`, "error");
  }
}

// Computed para títulos dinâmicos
const pageTitle = computed(() => {
  switch (currentPage.value) {
    case "workflows":
      return "Workflows & Agentes IA";
    case "clients":
      return "Clientes Multi-Tenant";
    case "settings":
      return "Configurações";
    case "qrcode":
      return "Conectar WhatsApp";
    default:
      return "Dashboard";
  }
});

const pageDescription = computed(() => {
  switch (currentPage.value) {
    case "workflows":
      return "Gerencie workflows do n8n e configure agentes IA";
    case "clients":
      return "Provisione e gerencie instâncias isoladas para clientes";
    case "settings":
      return "Configurações gerais do sistema";
    case "qrcode":
      return "Conecte sua instância do WhatsApp escaneando o QR Code";
    default:
      return "";
  }
});
</script>

<template>
  <div class="min-h-screen surface-ground">
    <!-- Layout Principal com PrimeFlex -->
    <div class="flex">
      <!-- Sidebar -->
      <Panel class="w-3 border-right-1 surface-border h-screen">
        <template #header>
          <div class="flex align-items-center gap-2">
            <i class="pi pi-th-large text-primary"></i>
            <span class="font-semibold">Multi-Tenant SaaS</span>
          </div>
        </template>
        <div class="flex flex-column gap-2">
          <Button
            label="Workflows"
            icon="pi pi-sitemap"
            class="w-full justify-content-start"
            :severity="currentPage === 'workflows' ? 'primary' : 'secondary'"
            :text="currentPage !== 'workflows'"
            @click="navigateToPage('workflows')"
          />
          <Button
            label="Clientes"
            icon="pi pi-users"
            class="w-full justify-content-start"
            :severity="currentPage === 'clients' ? 'primary' : 'secondary'"
            :text="currentPage !== 'clients'"
            @click="navigateToPage('clients')"
          />
          <Button
            label="Configurações"
            icon="pi pi-cog"
            class="w-full justify-content-start"
            :severity="currentPage === 'settings' ? 'primary' : 'secondary'"
            :text="currentPage !== 'settings'"
            @click="navigateToPage('settings')"
          />
          <Button
            label="Conectar WhatsApp"
            icon="pi pi-whatsapp"
            class="w-full justify-content-start"
            :severity="currentPage === 'qrcode' ? 'primary' : 'secondary'"
            :text="currentPage !== 'qrcode'"
            @click="navigateToPage('qrcode')"
          />
        </div>
      </Panel>

      <!-- Conteúdo Principal -->
      <div class="flex-1 flex flex-column">
        <!-- Header -->
        <div class="surface-card shadow-1 p-4 border-bottom-1 surface-border">
          <div class="flex justify-content-between align-items-center">
            <div>
              <h1 class="text-3xl font-bold text-900 m-0">{{ pageTitle }}</h1>
              <p class="text-600 m-0 mt-1">{{ pageDescription }}</p>
            </div>
            <div class="flex gap-2">
              <Button
                v-if="currentPage === 'clients'"
                label="Novo Cliente"
                icon="pi pi-building"
                @click="openCreateClientModal"
                severity="success"
                size="large"
              />
              <Button
                v-if="currentPage === 'workflows'"
                label="Criar Agente"
                icon="pi pi-plus"
                @click="showCreateAgentModal = true"
                size="large"
              />
            </div>
          </div>
        </div>

        <!-- Conteúdo das Páginas -->
        <div class="flex-1 p-4">
          <!-- PÁGINA DE WORKFLOWS -->
          <div v-if="currentPage === 'workflows'" class="grid gap-3">
            <!-- Lista de Workflows -->
            <div class="col-12 lg:col-4">
              <Card class="h-full">
                <template #header>
                  <div class="p-3 border-bottom-1 surface-border">
                    <div class="flex justify-content-between align-items-center mb-2">
                      <h3 class="text-lg font-semibold m-0">Workflows</h3>
                      <span class="text-500 text-sm">{{ workflows.length }}</span>
                    </div>
                    <Button
                      label="Sincronizar"
                      icon="pi pi-refresh"
                      @click="syncWorkflows"
                      class="w-full"
                      severity="secondary"
                      size="small"
                    />
                  </div>
                </template>
                <template #content>
                  <div v-if="n8nStatus.loading" class="text-center py-4">
                    <i class="pi pi-spin pi-spinner text-4xl text-400 mb-3"></i>
                    <p class="text-500">Verificando n8n...</p>
                  </div>
                  <div v-else-if="!n8nStatus.online" class="text-center py-4">
                    <i class="pi pi-exclamation-triangle text-4xl text-orange-500 mb-3"></i>
                    <p class="text-600 font-semibold mb-2">n8n não está disponível</p>
                    <p class="text-500 text-sm mb-3">{{ n8nStatus.message }}</p>
                    <Button
                      label="Verificar novamente"
                      icon="pi pi-refresh"
                      @click="checkN8nStatus"
                      size="small"
                      severity="secondary"
                    />
                  </div>
                  <div v-else-if="!workflows.length" class="text-center py-4">
                    <i class="pi pi-inbox text-4xl text-400 mb-3"></i>
                    <p class="text-500">Nenhum workflow encontrado</p>
                    <p class="text-400 text-sm">Sincronize com o n8n para carregar os workflows</p>
                  </div>
                  <div v-else-if="!filteredWorkflows.length" class="text-center py-4">
                    <i class="pi pi-inbox text-4xl text-400 mb-3"></i>
                    <p class="text-500">Nenhum workflow com agentes encontrado</p>
                    <p class="text-400 text-sm">Crie um novo agente para começar</p>
                  </div>
                  <div v-else class="flex flex-column gap-2">
                    <Card
                      v-for="workflow in filteredWorkflows"
                      :key="workflow.id"
                      class="cursor-pointer border-1 surface-border"
                      :class="{
                        'border-primary': currentWorkflow && currentWorkflow.id === workflow.id,
                      }"
                      @click="selectWorkflow(workflow.id)"
                    >
                      <template #content>
                        <div class="flex justify-content-between align-items-start">
                          <div class="flex-1">
                            <h3 class="font-semibold text-900 mb-2">{{ workflow.name }}</h3>
                            <p class="text-600 text-sm mb-2">
                              Agentes: {{ workflow.agent_count || 0 }}
                            </p>
                            <span
                              class="inline-flex align-items-center gap-1 text-xs px-2 py-1 border-round"
                              :class="
                                workflow.active
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-gray-100 text-gray-600'
                              "
                            >
                              <i
                                :class="
                                  workflow.active
                                    ? 'pi pi-check-circle text-green-600'
                                    : 'pi pi-pause-circle text-gray-500'
                                "
                              ></i>
                              {{ workflow.active ? "Ativo" : "Inativo" }}
                            </span>
                          </div>
                          <Button
                            icon="pi pi-times"
                            severity="danger"
                            size="small"
                            class="p-button-sm p-button-rounded"
                            @click.stop="deleteWorkflow(workflow.id, workflow.name)"
                            v-tooltip.left="'Deletar workflow'"
                          />
                        </div>
                      </template>
                    </Card>
                  </div>
                </template>
              </Card>
            </div>

            <!-- Detalhes do Workflow -->
            <div class="col-12 lg:col-8">
              <div
                v-if="!currentWorkflow"
                class="flex flex-column align-items-center justify-content-center"
                style="min-height: 400px"
              >
                <i class="pi pi-file-o text-4xl text-400 mb-3"></i>
                <h3 class="text-lg text-600 mb-2">Selecione um Workflow</h3>
                <p class="text-500 text-sm">Clique em um workflow para ver os detalhes</p>
              </div>

              <div v-else class="flex flex-column gap-3">
                <!-- Header do Workflow -->
                <Card>
                  <template #content>
                    <div class="flex justify-content-between align-items-center p-2">
                      <div>
                        <h3 class="text-xl font-bold text-900 mb-1">{{ currentWorkflow.name }}</h3>
                        <span
                          class="inline-flex align-items-center gap-1 text-sm"
                          :class="currentWorkflow.active ? 'text-green-600' : 'text-gray-500'"
                        >
                          <i
                            :class="
                              currentWorkflow.active ? 'pi pi-check-circle' : 'pi pi-pause-circle'
                            "
                          ></i>
                          {{ currentWorkflow.active ? "Ativo" : "Inativo" }}
                        </span>
                      </div>
                      <Button
                        :label="currentWorkflow.active ? 'Desativar' : 'Ativar'"
                        :severity="currentWorkflow.active ? 'danger' : 'success'"
                        :icon="currentWorkflow.active ? 'pi pi-pause' : 'pi pi-play'"
                        size="small"
                      />
                    </div>
                  </template>
                </Card>

                <!-- Seção de Agentes -->
                <Panel header="Agentes" toggleable class="compact-panel">
                  <template #header>
                    <div class="flex align-items-center gap-2">
                      <i class="pi pi-users text-primary text-sm"></i>
                      <span class="font-semibold text-sm">Agentes</span>
                    </div>
                  </template>
                  <div class="flex gap-3 flex-nowrap">
                    <div
                      v-for="agent in currentWorkflow.agents"
                      :key="agent.id"
                      class="flex-shrink-0"
                      style="width: 200px"
                    >
                      <div class="agent-card cursor-pointer" @click="startEditPrompt(agent)">
                        <div class="agent-card-header">
                          <div class="flex align-items-center gap-2">
                            <div class="agent-icon">
                              <i class="pi pi-user"></i>
                            </div>
                            <h4 class="agent-name">{{ agent.name }}</h4>
                          </div>
                        </div>

                        <div class="agent-card-body">
                          <div class="prompt-section">
                            <div class="prompt-label">
                              <i class="pi pi-file-edit"></i>
                              <span>Prompt</span>
                            </div>

                            <div class="prompt-content">
                              <p v-if="agent.prompt">
                                {{ truncateText(agent.prompt, 100) }}
                              </p>
                              <p v-else class="prompt-empty">Clique para adicionar um prompt...</p>
                            </div>

                            <div class="prompt-action">
                              <small v-if="agent.prompt && agent.prompt.length > 100"> </small>
                              <small v-else-if="!agent.prompt">
                                <i class="pi pi-plus mr-1"></i>
                                Adicionar
                              </small>
                              <small v-else>
                                <i class="pi pi-pencil mr-1"></i>
                                Editar
                              </small>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </Panel>

                <!-- Seção de Credenciais -->
                <Panel header="Credenciais" toggleable class="compact-panel">
                  <template #header>
                    <div class="flex align-items-center gap-2">
                      <i class="pi pi-key text-primary text-sm"></i>
                      <span class="font-semibold text-sm">Credenciais</span>
                    </div>
                  </template>

                  <div class="flex gap-3 flex-nowrap">
                    <div class="flex-1">
                      <Card
                        class="cursor-pointer h-full border-1 surface-border hover:border-primary"
                        @click="openConfigModal('chatwoot')"
                      >
                        <template #content>
                          <div class="text-center p-2">
                            <i class="pi pi-comments text-2xl text-blue-500 mb-2 block"></i>
                            <h5 class="font-semibold text-900 mb-2 text-sm">Chatwoot</h5>
                            <span
                              class="inline-flex align-items-center gap-1 text-xs px-2 py-1 border-round"
                              :class="
                                chatwootConfigured
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-orange-100 text-orange-800'
                              "
                            >
                              <i
                                :class="
                                  chatwootConfigured
                                    ? 'pi pi-check-circle'
                                    : 'pi pi-exclamation-triangle'
                                "
                              ></i>
                              {{ chatwootConfigured ? "OK" : "Config" }}
                            </span>
                            <Button
                              v-if="chatwootConfigured"
                              icon="pi pi-wifi"
                              severity="info"
                              text
                              size="small"
                              class="mt-2"
                              @click.stop="testConnection('chatwoot')"
                            />
                          </div>
                        </template>
                      </Card>
                    </div>

                    <div class="flex-1">
                      <Card
                        class="cursor-pointer h-full border-1 surface-border hover:border-primary"
                        @click="openConfigModal('gemini')"
                      >
                        <template #content>
                          <div class="text-center p-2">
                            <i class="pi pi-google text-2xl text-purple-500 mb-2 block"></i>
                            <h5 class="font-semibold text-900 mb-2 text-sm">Google Gemini</h5>
                            <span
                              class="inline-flex align-items-center gap-1 text-xs px-2 py-1 border-round"
                              :class="
                                geminiConfigured
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-orange-100 text-orange-800'
                              "
                            >
                              <i
                                :class="
                                  geminiConfigured
                                    ? 'pi pi-check-circle'
                                    : 'pi pi-exclamation-triangle'
                                "
                              ></i>
                              {{ geminiConfigured ? "OK" : "Config" }}
                            </span>
                            <Button
                              v-if="geminiConfigured"
                              icon="pi pi-wifi"
                              severity="info"
                              text
                              size="small"
                              class="mt-2"
                              @click.stop="testConnection('gemini')"
                            />
                          </div>
                        </template>
                      </Card>
                    </div>

                    <div class="flex-1">
                      <Card
                        class="cursor-pointer h-full border-1 surface-border hover:border-primary"
                        @click="openConfigModal('googleSheets')"
                      >
                        <template #content>
                          <div class="text-center p-2">
                            <i class="pi pi-table text-2xl text-green-500 mb-2 block"></i>
                            <h5 class="font-semibold text-900 mb-2 text-sm">Google Sheets</h5>
                            <span
                              class="inline-flex align-items-center gap-1 text-xs px-2 py-1 border-round"
                              :class="
                                googleSheetsConfigured
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-orange-100 text-orange-800'
                              "
                            >
                              <i
                                :class="
                                  googleSheetsConfigured
                                    ? 'pi pi-check-circle'
                                    : 'pi pi-exclamation-triangle'
                                "
                              ></i>
                              {{ googleSheetsConfigured ? "OK" : "Config" }}
                            </span>
                            <Button
                              v-if="googleSheetsConfigured"
                              icon="pi pi-wifi"
                              severity="info"
                              text
                              size="small"
                              class="mt-2"
                              @click.stop="testConnection('googleSheets')"
                            />
                          </div>
                        </template>
                      </Card>
                    </div>
                  </div>
                </Panel>
              </div>
            </div>
          </div>

          <!-- PÁGINA DE CLIENTES -->
          <div v-if="currentPage === 'clients'" class="grid">
            <div class="col-12">
              <Card>
                <template #header>
                  <div class="p-4 border-bottom-1 surface-border">
                    <div class="flex justify-content-between align-items-center mb-3">
                      <h2 class="text-xl font-semibold m-0">Clientes Multi-Tenant</h2>
                      <span class="text-500">{{ clients.length }} cliente(s) provisionados</span>
                    </div>
                    <Button
                      label="Novo Cliente"
                      icon="pi pi-plus"
                      @click="openCreateClientModal"
                      class="w-full"
                      severity="success"
                    />
                  </div>
                </template>
                <template #content>
                  <div v-if="!clients.length" class="text-center py-8">
                    <i class="pi pi-building text-6xl text-400 mb-4"></i>
                    <h3 class="text-xl text-600 mb-2">Nenhum cliente provisionado</h3>
                    <p class="text-500 mb-4">
                      Crie sua primeira instância multi-tenant para começar
                    </p>
                    <Button
                      label="Criar Primeiro Cliente"
                      icon="pi pi-plus"
                      @click="openCreateClientModal"
                      severity="success"
                      size="large"
                    />
                  </div>
                  <div v-else class="grid">
                    <div
                      v-for="client in clients"
                      :key="client.client_id"
                      class="col-12 md:col-6 lg:col-4"
                    >
                      <Card class="h-full border-1 surface-border">
                        <template #content>
                          <div class="flex flex-column h-full">
                            <div class="flex justify-content-between align-items-start mb-3">
                              <div class="flex-1">
                                <h3 class="font-semibold text-900 mb-1">
                                  {{ client.client_name }}
                                </h3>
                                <p class="text-600 text-sm mb-2">{{ client.client_email }}</p>
                              </div>
                              <span
                                class="inline-flex align-items-center gap-1 text-xs px-2 py-1 border-round"
                                :class="
                                  client.status === 'active'
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-gray-100 text-gray-600'
                                "
                              >
                                <i
                                  :class="
                                    client.status === 'active'
                                      ? 'pi pi-check-circle'
                                      : 'pi pi-pause-circle'
                                  "
                                ></i>
                                {{ client.status === "active" ? "Ativo" : "Inativo" }}
                              </span>
                            </div>

                            <div class="flex flex-column gap-2 mb-3">
                              <div class="flex align-items-center gap-2">
                                <i class="pi pi-server text-xs text-400"></i>
                                <span class="text-xs text-600">Chatwoot: :{{ client.port }}</span>
                              </div>
                              <div class="flex align-items-center gap-2">
                                <i class="pi pi-cog text-xs text-400"></i>
                                <span class="text-xs text-600"
                                  >n8n: :{{ client.n8n_port || client.port + 1000 }}</span
                                >
                              </div>
                            </div>

                            <div class="flex flex-column gap-2 mt-auto">
                              <div class="grid gap-2">
                                <div class="col">
                                  <a
                                    :href="`http://localhost:${client.port}`"
                                    target="_blank"
                                    class="no-underline"
                                  >
                                    <Button
                                      label="Chatwoot"
                                      icon="pi pi-external-link"
                                      class="w-full"
                                      severity="info"
                                      size="small"
                                    />
                                  </a>
                                </div>
                                <div class="col">
                                  <a
                                    :href="`http://localhost:${
                                      client.n8n_port || client.port + 1000
                                    }`"
                                    target="_blank"
                                    class="no-underline"
                                  >
                                    <Button
                                      label="n8n"
                                      icon="pi pi-cog"
                                      class="w-full"
                                      severity="secondary"
                                      size="small"
                                    />
                                  </a>
                                </div>
                              </div>
                              <div class="flex gap-2">
                                <Button
                                  icon="pi pi-stop"
                                  severity="warning"
                                  size="small"
                                  class="flex-1"
                                  @click="stopClient(client.client_id)"
                                  v-tooltip="'Parar instância'"
                                />
                                <Button
                                  icon="pi pi-trash"
                                  severity="danger"
                                  size="small"
                                  class="flex-1"
                                  @click="removeClient(client.client_id)"
                                  v-tooltip="'Remover instância'"
                                />
                              </div>
                            </div>
                          </div>
                        </template>
                      </Card>
                    </div>
                  </div>
                </template>
              </Card>
            </div>
          </div>

          <!-- PÁGINA DE CONFIGURAÇÕES -->
          <div v-if="currentPage === 'settings'" class="grid">
            <div class="col-12">
              <Card>
                <template #header>
                  <div class="p-4 border-bottom-1 surface-border">
                    <h2 class="text-xl font-semibold m-0">Configurações do Sistema</h2>
                  </div>
                </template>
                <template #content>
                  <div class="flex flex-column gap-6">
                    <!-- Configurações de Conexão -->
                    <div>
                      <h3 class="text-lg font-semibold text-900 mb-3">
                        <i class="pi pi-link mr-2 text-primary"></i>
                        Conexões Externas
                      </h3>
                      <div class="grid">
                        <div class="col-12 md:col-6">
                          <Card class="border-1 surface-border">
                            <template #content>
                              <div class="text-center">
                                <i class="pi pi-sitemap text-4xl text-blue-500 mb-3"></i>
                                <h4 class="font-semibold text-900 mb-2">n8n Server</h4>

                                <!-- Status dinâmico do n8n -->
                                <div v-if="n8nStatus.loading" class="mb-3">
                                  <p class="text-600 text-sm mb-2">Verificando conexão...</p>
                                  <i class="pi pi-spin pi-spinner text-blue-500"></i>
                                </div>

                                <div v-else-if="n8nStatus.online" class="mb-3">
                                  <p class="text-600 text-sm mb-2">Conectado a: localhost:5678</p>
                                  <span
                                    class="inline-flex align-items-center gap-1 text-xs px-2 py-1 border-round bg-green-100 text-green-800"
                                  >
                                    <i class="pi pi-check-circle"></i>
                                    Online
                                  </span>
                                </div>

                                <div v-else-if="n8nStatus.authError" class="mb-3">
                                  <p class="text-600 text-sm mb-2">API Key incorreta</p>
                                  <span
                                    class="inline-flex align-items-center gap-1 text-xs px-2 py-1 border-round bg-orange-100 text-orange-800"
                                  >
                                    <i class="pi pi-exclamation-triangle"></i>
                                    Erro de Autenticação
                                  </span>
                                  <div class="mt-3">
                                    <div class="flex flex-column gap-2">
                                      <FloatLabel>
                                        <InputText
                                          v-model="manualApiKey"
                                          placeholder="Insira a API Key do n8n"
                                          class="w-full"
                                          type="password"
                                        />
                                        <label>API Key do n8n</label>
                                      </FloatLabel>
                                      <Button
                                        label="Salvar API Key"
                                        icon="pi pi-key"
                                        size="small"
                                        @click="saveManualApiKey"
                                        class="p-button-sm"
                                      />
                                    </div>
                                  </div>
                                </div>

                                <div v-else class="mb-3">
                                  <p class="text-600 text-sm mb-2">n8n não está disponível</p>
                                  <span
                                    class="inline-flex align-items-center gap-1 text-xs px-2 py-1 border-round bg-red-100 text-red-800"
                                  >
                                    <i class="pi pi-exclamation-triangle"></i>
                                    Offline
                                  </span>
                                  <div class="mt-2">
                                    <Button
                                      label="Configurar n8n"
                                      icon="pi pi-cog"
                                      size="small"
                                      @click="configureN8n"
                                      class="p-button-sm"
                                    />
                                  </div>
                                </div>
                              </div>
                            </template>
                          </Card>
                        </div>
                        <div class="col-12 md:col-6">
                          <Card class="border-1 surface-border">
                            <template #content>
                              <div class="text-center">
                                <i class="pi pi-database text-4xl text-green-500 mb-3"></i>
                                <h4 class="font-semibold text-900 mb-2">MySQL Database</h4>
                                <p class="text-600 text-sm mb-3">Banco local: localhost</p>
                                <span
                                  class="inline-flex align-items-center gap-1 text-xs px-2 py-1 border-round bg-green-100 text-green-800"
                                >
                                  <i class="pi pi-check-circle"></i>
                                  Conectado
                                </span>
                              </div>
                            </template>
                          </Card>
                        </div>
                      </div>
                    </div>

                    <!-- Estatísticas do Sistema -->
                    <div>
                      <h3 class="text-lg font-semibold text-900 mb-3">
                        <i class="pi pi-chart-bar mr-2 text-primary"></i>
                        Estatísticas
                      </h3>
                      <div class="grid">
                        <div class="col-12 sm:col-6 md:col-3">
                          <Card class="border-1 surface-border text-center">
                            <template #content>
                              <i class="pi pi-users text-2xl text-blue-500 mb-2"></i>
                              <h4 class="text-xl font-bold text-900 mb-1">{{ clients.length }}</h4>
                              <p class="text-600 text-sm m-0">Clientes Ativos</p>
                            </template>
                          </Card>
                        </div>
                        <div class="col-12 sm:col-6 md:col-3">
                          <Card class="border-1 surface-border text-center">
                            <template #content>
                              <i class="pi pi-sitemap text-2xl text-green-500 mb-2"></i>
                              <h4 class="text-xl font-bold text-900 mb-1">
                                {{ workflows.length }}
                              </h4>
                              <p class="text-600 text-sm m-0">Workflows Totais</p>
                            </template>
                          </Card>
                        </div>
                        <div class="col-12 sm:col-6 md:col-3">
                          <Card class="border-1 surface-border text-center">
                            <template #content>
                              <i class="pi pi-server text-2xl text-purple-500 mb-2"></i>
                              <h4 class="text-xl font-bold text-900 mb-1">
                                {{ clients.length * 2 }}
                              </h4>
                              <p class="text-600 text-sm m-0">Instâncias Ativas</p>
                            </template>
                          </Card>
                        </div>
                        <div class="col-12 sm:col-6 md:col-3">
                          <Card class="border-1 surface-border text-center">
                            <template #content>
                              <i class="pi pi-cog text-2xl text-orange-500 mb-2"></i>
                              <h4 class="text-xl font-bold text-900 mb-1">
                                {{ filteredWorkflows.length }}
                              </h4>
                              <p class="text-600 text-sm m-0">Agentes IA</p>
                            </template>
                          </Card>
                        </div>
                      </div>
                    </div>

                    <!-- Informações do Sistema -->
                    <div>
                      <h3 class="text-lg font-semibold text-900 mb-3">
                        <i class="pi pi-info-circle mr-2 text-primary"></i>
                        Informações do Sistema
                      </h3>
                      <Card class="border-1 surface-border">
                        <template #content>
                          <div class="grid">
                            <div class="col-12 md:col-6">
                              <div class="flex flex-column gap-3">
                                <div class="flex justify-content-between">
                                  <span class="text-600">Versão:</span>
                                  <span class="font-semibold">v1.0.0</span>
                                </div>
                                <div class="flex justify-content-between">
                                  <span class="text-600">Ambiente:</span>
                                  <span class="font-semibold">Desenvolvimento</span>
                                </div>
                                <div class="flex justify-content-between">
                                  <span class="text-600">Backend:</span>
                                  <span class="font-semibold">Node.js + Express</span>
                                </div>
                              </div>
                            </div>
                            <div class="col-12 md:col-6">
                              <div class="flex flex-column gap-3">
                                <div class="flex justify-content-between">
                                  <span class="text-600">Frontend:</span>
                                  <span class="font-semibold">Vue.js + PrimeVue</span>
                                </div>
                                <div class="flex justify-content-between">
                                  <span class="text-600">Docker:</span>
                                  <span class="font-semibold">Multi-Container</span>
                                </div>
                                <div class="flex justify-content-between">
                                  <span class="text-600">Última atualização:</span>
                                  <span class="font-semibold">Hoje</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </template>
                      </Card>
                    </div>
                  </div>
                </template>
              </Card>
            </div>
          </div>

          <!-- PÁGINA DE QR CODE WHATSAPP -->
          <div v-if="currentPage === 'qrcode'" class="grid">
            <div class="col-12">
              <Card>
                <template #header>
                  <div class="p-4 border-bottom-1 surface-border">
                    <h2 class="text-xl font-semibold m-0">
                      <i class="pi pi-whatsapp mr-2 text-green-500"></i>
                      Conectar WhatsApp
                    </h2>
                  </div>
                </template>
                <template #content>
                  <div class="flex flex-column gap-6">
                    <!-- Status da Conexão -->
                    <div class="text-center">
                      <div
                        v-if="whatsappConnection.loading"
                        class="flex flex-column align-items-center gap-3"
                      >
                        <i class="pi pi-spin pi-spinner text-4xl text-primary"></i>
                        <p class="text-600">Verificando status da conexão...</p>
                      </div>

                      <div
                        v-else-if="whatsappConnection.connected"
                        class="flex flex-column align-items-center gap-3"
                      >
                        <div
                          class="w-6rem h-6rem border-circle bg-green-100 flex align-items-center justify-content-center"
                        >
                          <i class="pi pi-check text-4xl text-green-600"></i>
                        </div>
                        <h3 class="text-2xl font-semibold text-900 m-0">WhatsApp Conectado!</h3>
                        <p class="text-600 mb-4">
                          Sua instância está ativa e funcionando perfeitamente.
                        </p>
                        <div class="flex gap-2">
                          <Button
                            label="Verificar Status"
                            icon="pi pi-refresh"
                            @click="checkWhatsAppStatus"
                            :loading="whatsappConnection.checking"
                            outlined
                          />
                          <Button
                            label="Desconectar"
                            icon="pi pi-sign-out"
                            @click="disconnectWhatsApp"
                            severity="danger"
                            outlined
                          />
                        </div>
                      </div>

                      <div v-else class="flex flex-column align-items-center gap-4">
                        <div
                          class="w-6rem h-6rem border-circle bg-orange-100 flex align-items-center justify-content-center"
                        >
                          <i class="pi pi-whatsapp text-4xl text-orange-600"></i>
                        </div>
                        <h3 class="text-2xl font-semibold text-900 m-0">Conectar WhatsApp</h3>
                        <p class="text-600 mb-4">
                          Escaneie o QR Code com seu WhatsApp para conectar sua instância.
                        </p>

                        <!-- QR Code -->
                        <div
                          v-if="whatsappConnection.qrCode"
                          class="flex flex-column align-items-center gap-3"
                        >
                          <Card class="border-2 border-dashed surface-border">
                            <template #content>
                              <div class="text-center p-4">
                                <img
                                  :src="whatsappConnection.qrCode"
                                  alt="QR Code WhatsApp"
                                  class="max-w-20rem w-full"
                                />
                              </div>
                            </template>
                          </Card>
                          <div class="text-center">
                            <p class="text-sm text-600 mb-2">1. Abra o WhatsApp no seu celular</p>
                            <p class="text-sm text-600 mb-2">
                              2. Toque em ⋮ → Dispositivos conectados
                            </p>
                            <p class="text-sm text-600 mb-4">
                              3. Toque em "Conectar um dispositivo" e escaneie o código
                            </p>
                            <Button
                              label="Gerar Novo QR Code"
                              icon="pi pi-refresh"
                              @click="generateQRCode"
                              :loading="whatsappConnection.generating"
                              outlined
                            />
                          </div>
                        </div>

                        <!-- Botão inicial -->
                        <div v-else>
                          <Button
                            label="Gerar QR Code"
                            icon="pi pi-qrcode"
                            @click="generateQRCode"
                            :loading="whatsappConnection.generating"
                            size="large"
                          />
                        </div>
                      </div>
                    </div>

                    <!-- Informações Adicionais -->
                    <div class="grid">
                      <div class="col-12 md:col-4">
                        <Card class="border-1 surface-border h-full">
                          <template #content>
                            <div class="text-center">
                              <i class="pi pi-shield text-3xl text-blue-500 mb-3"></i>
                              <h4 class="font-semibold text-900 mb-2">Seguro e Privado</h4>
                              <p class="text-600 text-sm">
                                Suas mensagens ficam criptografadas end-to-end.
                              </p>
                            </div>
                          </template>
                        </Card>
                      </div>
                      <div class="col-12 md:col-4">
                        <Card class="border-1 surface-border h-full">
                          <template #content>
                            <div class="text-center">
                              <i class="pi pi-bolt text-3xl text-orange-500 mb-3"></i>
                              <h4 class="font-semibold text-900 mb-2">Conexão Rápida</h4>
                              <p class="text-600 text-sm">
                                Conecte em segundos e comece a usar imediatamente.
                              </p>
                            </div>
                          </template>
                        </Card>
                      </div>
                      <div class="col-12 md:col-4">
                        <Card class="border-1 surface-border h-full">
                          <template #content>
                            <div class="text-center">
                              <i class="pi pi-sync text-3xl text-green-500 mb-3"></i>
                              <h4 class="font-semibold text-900 mb-2">Sincronização</h4>
                              <p class="text-600 text-sm">
                                Mensagens sincronizadas automaticamente.
                              </p>
                            </div>
                          </template>
                        </Card>
                      </div>
                    </div>
                  </div>
                </template>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Modais com PrimeVue Dialog -->
    <Dialog
      v-model:visible="showCreateAgentModal"
      modal
      header="Criar Novo Agente e Workflow"
      :style="{ width: '50rem' }"
      :breakpoints="{ '1199px': '75vw', '575px': '90vw' }"
    >
      <div class="flex flex-column gap-4">
        <FloatLabel>
          <InputText id="workflowName" v-model="newAgentForm.workflowName" class="w-full" />
          <label for="workflowName">Nome do Workflow</label>
        </FloatLabel>

        <Divider />

        <h4 class="font-semibold text-900 mb-0">Configurações Iniciais</h4>

        <div class="grid">
          <div class="col-12 md:col-6">
            <FloatLabel>
              <InputText id="chatwootUrl" v-model="newAgentForm.chatwootApiUrl" class="w-full" />
              <label for="chatwootUrl">Chatwoot API URL</label>
            </FloatLabel>
          </div>
          <div class="col-12 md:col-6">
            <FloatLabel>
              <InputText
                id="chatwootToken"
                v-model="newAgentForm.chatwootAccessToken"
                class="w-full"
              />
              <label for="chatwootToken">Chatwoot Access Token</label>
            </FloatLabel>
          </div>
          <div class="col-12">
            <FloatLabel>
              <InputText id="geminiKey" v-model="newAgentForm.geminiApiKey" class="w-full" />
              <label for="geminiKey">Gemini API Key</label>
            </FloatLabel>
          </div>
          <div class="col-12 md:col-6">
            <FloatLabel>
              <InputText id="googleClientId" v-model="newAgentForm.googleClientId" class="w-full" />
              <label for="googleClientId">Google Client ID (Opcional)</label>
            </FloatLabel>
          </div>
          <div class="col-12 md:col-6">
            <FloatLabel>
              <InputText
                id="googleClientSecret"
                v-model="newAgentForm.googleClientSecret"
                class="w-full"
              />
              <label for="googleClientSecret">Google Client Secret (Opcional)</label>
            </FloatLabel>
          </div>
        </div>
      </div>

      <template #footer>
        <Button label="Cancelar" severity="secondary" @click="showCreateAgentModal = false" />
        <Button label="Criar" icon="pi pi-check" @click="createNewAgent" />
      </template>
    </Dialog>

    <Dialog
      v-model:visible="showConfigModal"
      modal
      :header="`Configurar ${editingCredentialType}`"
      :style="{ width: '40rem' }"
      :breakpoints="{ '1199px': '75vw', '575px': '90vw' }"
    >
      <!-- Formulário Chatwoot -->
      <div v-if="editingCredentialType === 'chatwoot'" class="flex flex-column gap-4">
        <div class="flex align-items-center gap-2 mb-3">
          <i class="pi pi-comments text-blue-500 text-2xl"></i>
          <h4 class="font-semibold text-900 m-0">Configurações do Chatwoot</h4>
        </div>

        <FloatLabel>
          <InputText
            id="chatwootApiUrl"
            v-model="configCredentialsForm.chatwoot.apiUrl"
            class="w-full"
            placeholder="https://app.chatwoot.com"
          />
          <label for="chatwootApiUrl">API URL</label>
        </FloatLabel>

        <FloatLabel>
          <InputText
            id="chatwootAccessToken"
            v-model="configCredentialsForm.chatwoot.accessToken"
            class="w-full"
            type="password"
          />
          <label for="chatwootAccessToken">Access Token</label>
        </FloatLabel>
      </div>

      <!-- Formulário Gemini -->
      <div v-if="editingCredentialType === 'gemini'" class="flex flex-column gap-4">
        <div class="flex align-items-center gap-2 mb-3">
          <i class="pi pi-google text-purple-500 text-2xl"></i>
          <h4 class="font-semibold text-900 m-0">Configurações do Google Gemini</h4>
        </div>

        <FloatLabel>
          <InputText
            id="geminiApiKey"
            v-model="configCredentialsForm.gemini.apiKey"
            class="w-full"
            type="password"
          />
          <label for="geminiApiKey">API Key</label>
        </FloatLabel>
      </div>

      <!-- Formulário Google Sheets -->
      <div v-if="editingCredentialType === 'googleSheets'" class="flex flex-column gap-4">
        <div class="flex align-items-center gap-2 mb-3">
          <i class="pi pi-table text-green-500 text-2xl"></i>
          <h4 class="font-semibold text-900 m-0">Configurações do Google Sheets</h4>
        </div>

        <FloatLabel>
          <InputText
            id="googleClientId"
            v-model="configCredentialsForm.googleSheets.clientId"
            class="w-full"
          />
          <label for="googleClientId">Client ID</label>
        </FloatLabel>

        <FloatLabel>
          <InputText
            id="googleClientSecret"
            v-model="configCredentialsForm.googleSheets.clientSecret"
            class="w-full"
            type="password"
          />
          <label for="googleClientSecret">Client Secret</label>
        </FloatLabel>

        <div class="p-3 border-1 surface-border border-round">
          <div class="flex justify-content-between align-items-center">
            <div>
              <p class="text-sm font-semibold text-900 mb-1">OAuth Redirect URI</p>
              <p class="text-xs text-600 mb-0">Use esta URL no console do Google</p>
            </div>
            <Button
              icon="pi pi-copy"
              severity="secondary"
              text
              size="small"
              @click="copyToClipboard('http://localhost:5678/rest/oauth2-credential/callback')"
            />
          </div>
          <code class="text-xs text-500 block mt-2"
            >http://localhost:5678/rest/oauth2-credential/callback</code
          >
        </div>
      </div>

      <template #footer>
        <Button label="Cancelar" severity="secondary" @click="showConfigModal = false" />
        <Button label="Salvar" icon="pi pi-check" @click="saveCredentials" />
      </template>
    </Dialog>

    <!-- Modal de Edição de Prompt -->
    <Dialog
      v-model:visible="showPromptModal"
      modal
      :header="`Editar Prompt - ${editingAgentName}`"
      :style="{ width: '50rem' }"
      :breakpoints="{ '1199px': '75vw', '575px': '90vw' }"
      maximizable
    >
      <div class="flex flex-column gap-4">
        <div class="flex align-items-center gap-2 mb-2">
          <i class="pi pi-file-edit text-primary text-xl"></i>
          <h4 class="font-semibold text-900 m-0">Prompt do Agente</h4>
        </div>

        <p class="text-600 text-sm mb-3">
          Configure o prompt que será usado por este agente para interagir com os usuários. Seja
          específico e claro sobre o comportamento esperado.
        </p>

        <FloatLabel>
          <Textarea
            id="promptEdit"
            v-model="tempPrompt"
            rows="12"
            class="w-full"
            auto-resize
            :placeholder="'Digite o prompt para o agente ' + editingAgentName"
          />
          <label for="promptEdit">Prompt</label>
        </FloatLabel>

        <div class="p-3 border-1 surface-border border-round bg-blue-50">
          <div class="flex align-items-start gap-2">
            <i class="pi pi-info-circle text-blue-600 mt-1"></i>
            <div>
              <p class="text-sm font-medium text-blue-900 mb-1">Dicas para um bom prompt:</p>
              <ul class="text-xs text-blue-800 m-0 pl-3">
                <li>Seja específico sobre o papel do agente</li>
                <li>Defina o tom e estilo de comunicação</li>
                <li>Inclua instruções sobre como lidar com situações específicas</li>
                <li>Evite prompts muito longos ou complexos</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <template #footer>
        <div class="flex justify-content-between w-full">
          <div class="flex align-items-center gap-2 text-sm text-600">
            <i class="pi pi-clock"></i>
            <span>{{ tempPrompt.length }} caracteres</span>
          </div>
          <div class="flex gap-2">
            <Button label="Cancelar" severity="secondary" @click="showPromptModal = false" />
            <Button
              label="Salvar Prompt"
              icon="pi pi-check"
              @click="saveAgentPrompt"
              :disabled="!tempPrompt.trim()"
            />
          </div>
        </div>
      </template>
    </Dialog>

    <!-- Modal de Criação de Cliente -->
    <Dialog
      v-model:visible="showClientModal"
      modal
      header="Criar Nova Instância de Cliente"
      :style="{ width: '40rem' }"
      :breakpoints="{ '1199px': '75vw', '575px': '90vw' }"
    >
      <div class="flex flex-column gap-4">
        <div class="flex align-items-center gap-2 mb-2">
          <i class="pi pi-building text-primary text-xl"></i>
          <h4 class="font-semibold text-900 m-0">Nova Instância Multi-Tenant</h4>
        </div>

        <p class="text-600 text-sm mb-3">
          Crie uma nova instância isolada do Chatwoot + n8n para este cliente. Serão geradas URLs
          únicas e ambientes completamente separados.
        </p>

        <FloatLabel>
          <InputText
            id="clientName"
            v-model="newClientForm.clientName"
            class="w-full"
            :placeholder="'Ex: Empresa ABC Ltda'"
          />
          <label for="clientName">Nome do Cliente</label>
        </FloatLabel>

        <FloatLabel>
          <InputText
            id="clientEmail"
            v-model="newClientForm.clientEmail"
            class="w-full"
            type="email"
            :placeholder="'Ex: admin@empresa.com'"
          />
          <label for="clientEmail">Email do Cliente</label>
        </FloatLabel>

        <div class="p-3 border-1 surface-border border-round bg-green-50">
          <div class="flex align-items-start gap-2">
            <i class="pi pi-info-circle text-green-600 mt-1"></i>
            <div>
              <p class="text-sm font-medium text-green-900 mb-1">O que será criado:</p>
              <ul class="text-xs text-green-800 m-0 pl-3">
                <li>Uma instância única do Chatwoot com porta própria</li>
                <li>Uma instância única do n8n com porta própria</li>
                <li>Banco de dados PostgreSQL isolado (compartilhado)</li>
                <li>Cache Redis dedicado</li>
                <li>Credenciais e configurações exclusivas</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <template #footer>
        <div class="flex justify-content-end gap-2">
          <Button
            label="Cancelar"
            severity="secondary"
            @click="showClientModal = false"
            :disabled="isProvisioningClient"
          />
          <Button
            label="Criar Instância"
            icon="pi pi-plus"
            @click="createClient"
            :disabled="
              !newClientForm.clientName || !newClientForm.clientEmail || isProvisioningClient
            "
            :loading="isProvisioningClient"
          />
        </div>
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
/* Layout compacto */
.compact-panel .p-panel-header {
  padding: 0.75rem 1rem;
  min-height: auto;
}

.compact-panel .p-panel-content {
  padding: 0.75rem 1rem;
}

/* Forçar layout sem wrap */
.flex-nowrap {
  flex-wrap: nowrap !important;
  overflow-x: auto;
}

.flex-shrink-0 {
  flex-shrink: 0 !important;
}

/* Cards de agentes modernos */
.agent-card {
  background: white;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  padding: 0;
  height: 120px;
  transition: all 0.3s ease;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.agent-card:hover {
  border-color: #10b981;
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.15);
  transform: translateY(-2px);
}

.agent-card-header {
  padding: 8px 12px 6px 12px;
  border-bottom: 1px solid #f3f4f6;
}

.agent-icon {
  width: 24px;
  height: 24px;
  background: #f0f9ff;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #0ea5e9;
  font-size: 12px;
}

.agent-name {
  font-size: 14px;
  font-weight: 600;
  color: #111827;
  margin: 0;
  font-family: Arial, sans-serif;
}

.agent-card-body {
  padding: 0 12px 8px 12px;
  height: calc(100% - 50px);
  display: flex;
  flex-direction: column;
}

.prompt-section {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.prompt-label {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
  color: #6b7280;
  font-size: 12px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.prompt-label i {
  font-size: 12px;
}

.prompt-content {
  flex: 1;
  margin-bottom: 8px;
}

.prompt-content p {
  font-size: 13px;
  line-height: 1.5;
  color: #374151;
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
}

.prompt-empty {
  color: #9ca3af !important;
  font-style: italic;
}

.prompt-action {
  margin-top: auto;
}

.prompt-action small {
  color: #6b7280;
  font-size: 11px;
  font-weight: 500;
  display: flex;
  align-items: center;
  transition: color 0.2s;
}

.agent-card:hover .prompt-action small {
  color: #10b981;
}

.agent-card:hover .agent-icon {
  background: #dcfce7;
  color: #16a34a;
}
</style>
