<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import TabView from 'primevue/tabview'
import TabPanel from 'primevue/tabpanel'
import Textarea from 'primevue/textarea'

const router = useRouter()

const agents = ref([])
const hasAgents = ref(false)
const executionLogs = ref([])

const showAddAgentMenu = ref(false)
const showAgentDetailModal = ref(false)
const selectedAgent = ref(null)
const selectedAgentPrompt = ref('')
const showLeftMenu = ref(false)

// Estados para logs detalhados
const showDetailedLogs = ref(false)
const selectedLogDetails = ref([])
const selectedLogInfo = ref(null)

function statusClass(agent) {
  return agent.status === 'on' ? 'dot-on' : agent.status === 'warn' ? 'dot-warn' : 'dot-off'
}
function openAgentDetail(agent) {
  selectedAgent.value = agent
  selectedAgentPrompt.value = agent.prompt || '—'
  showAgentDetailModal.value = true
}
function toggleAgent(agent) {
  agent.active = !agent.active
  agent.status = agent.active ? 'on' : 'off'
}
function deleteAgent(agent) {
  agents.value = agents.value.filter(a => a.id !== agent.id)
  showAgentDetailModal.value = false
}

function getAuthHeaders() {
  const token = localStorage.getItem('authToken')
  return { Authorization: `Bearer ${token}` }
}

async function fetchAgentsFromBackend() {
  try {
    // 1) buscar workflows da conta
    const res = await fetch('http://localhost:3001/api/db/workflows', { headers: getAuthHeaders() })
    const data = await res.json()
    if (!data.success) throw new Error(data.error || 'Falha ao listar workflows')
    const workflows = (data.data || []).filter((w) => (w.agent_count || 0) > 0)
    if (!workflows.length) {
      hasAgents.value = false
      agents.value = []
      return
    }

    // 2) obter agentes de cada workflow
    const allAgents = []
    for (const wf of workflows) {
      const r = await fetch(`http://localhost:3001/api/db/workflows/${wf.id}`, { headers: getAuthHeaders() })
      const j = await r.json()
      if (j.success && j.data && Array.isArray(j.data.agents)) {
        for (const ag of j.data.agents) {
          // Extrair número de telefone do nome do workflow (formato: userId = agenteN)
          const phoneNumber = extractPhoneFromWorkflow(wf);
          
          allAgents.push({
            id: `${wf.id}-${ag.id || ag.name}`,
            name: wf.name || ag.name || 'Agente',
            phone: phoneNumber,
            status: wf.active ? 'on' : 'off',
            active: !!wf.active,
            nodes: wf.nodes || [],
            prompt: ag.prompt || '',
            workflowId: wf.id
          })
        }
      }
    }

    agents.value = allAgents
    hasAgents.value = allAgents.length > 0
  } catch (e) {
    console.error('Erro ao carregar agentes:', e)
    hasAgents.value = false
    agents.value = []
  }
}

function extractPhoneFromWorkflow(workflow) {
  // Por enquanto retorna placeholder, depois integrar com Evolution API
  const agentNumber = workflow.name?.match(/agente(\d+)/)?.[1] || '1';
  return `+55 11 9999-000${agentNumber}`;
}

function openDrawer() { showLeftMenu.value = true }
function goToDashboardPrompt() {
  showAddAgentMenu.value = false
  router.push('/dashboard')
}

function goToCredentials() {
  showLeftMenu.value = false
  // TODO: navegar para página de credenciais ou abrir modal
}

function openLogDetails(log) {
  selectedLogInfo.value = log
  try {
    selectedLogDetails.value = log.detailed_logs ? JSON.parse(log.detailed_logs) : []
  } catch (e) {
    selectedLogDetails.value = [
      { time: new Date(log.created_at).toLocaleTimeString('pt-BR'), message: log.prompt, type: log.status, icon: log.status === 'success' ? '✅' : '❌' }
    ]
  }
  showDetailedLogs.value = true
}

function closeDetailedLogs() {
  showDetailedLogs.value = false
  selectedLogDetails.value = []
  selectedLogInfo.value = null
}

async function fetchExecutionLogs() {
  try {
    const res = await fetch('http://localhost:3001/api/execution-logs', { headers: getAuthHeaders() })
    const data = await res.json()
    if (data.success) {
      executionLogs.value = data.data || []
    }
  } catch (e) {
    console.error('Erro ao carregar logs:', e)
  }
}

onMounted(() => {
  fetchAgentsFromBackend()
  fetchExecutionLogs()
})
</script>

<template>
  <div class="agents-page">
    <button class="icon-btn left" @click="openDrawer"><img src="@/components/icons/contexto.png" alt="config" /></button>
    <button class="icon-btn right" @click="openDrawer"><img src="@/components/icons/do-utilizador.png" alt="perfil" /></button>

    <!-- Logs detalhados (substitui tela inicial quando ativo) -->
    <section v-if="showDetailedLogs" class="detailed-logs-view">
      <div class="detailed-header">
        <h2 class="detailed-title">Criando seu agente...</h2>
        <button class="close-detailed" @click="closeDetailedLogs">Voltar</button>
      </div>
      <div class="detailed-logs-area">
        <div v-for="(log, i) in selectedLogDetails" :key="i" class="detailed-log-entry" :class="log.type">
          <span class="detailed-log-icon">{{ log.icon }}</span>
          <span class="detailed-log-time">{{ log.time }}</span>
          <span class="detailed-log-message">{{ log.message }}</span>
        </div>
      </div>
    </section>

    <section v-else class="agents-panel">
      <div class="agents-toolbar">
        <button class="add-agent" @click="showAddAgentMenu = true">+</button>
        <div class="agents-title">Meus <strong>agentes</strong></div>
      </div>
      <div v-if="hasAgents" class="agents-grid">
        <div v-for="agent in agents" :key="agent.id" class="agent-card" @click="openAgentDetail(agent)">
          <div class="status-dot" :class="statusClass(agent)"></div>
          <div class="agent-meta">
            <div class="agent-name">{{ agent.name }}</div>
            <div class="agent-phone">{{ agent.phone || '—' }}</div>
          </div>
        </div>
      </div>
      <div v-else class="empty-state">Nenhum agente instalado nesta conta.</div>
    </section>

    <Dialog v-model:visible="showAddAgentMenu" modal header="Novo agente" :style="{ width: '26rem' }">
      <div class="grid">
        <div class="col-12">
          <Button class="w-full btn-gradient"  label="Criar por Prompt" @click="goToDashboardPrompt" />
        </div>
        <div class="col-12">
          <Button class="w-full btn-gradient-gray" label="Criar Manualmente" @click="showAddAgentMenu=false" />
        </div>
      </div>
    </Dialog>

    <Dialog v-model:visible="showAgentDetailModal" modal :header="selectedAgent?.name || 'Agente'" :style="{ width: '60rem' }" maximizable>
      <TabView>
        <TabPanel header="Resumo">
          <div class="grid">
            <div class="col-12 md:col-4">
              <div><strong>Status:</strong> {{ selectedAgent?.active ? 'Ativo' : 'Inativo' }}</div>
              <div><strong>Telefone:</strong> {{ selectedAgent?.phone || '—' }}</div>
            </div>
            <div class="col-12 md:col-8 text-right">
              <Button :label="selectedAgent?.active ? 'Desativar fluxo' : 'Ativar fluxo'" :severity="selectedAgent?.active ? 'warning' : 'success'" @click="toggleAgent(selectedAgent)" />
              <Button label="Deletar" severity="danger" class="ml-2" @click="deleteAgent(selectedAgent)" />
            </div>
          </div>
        </TabPanel>
        <TabPanel header="Prompt">
          <Textarea class="w-full" rows="10" v-model="selectedAgentPrompt" readonly />
        </TabPanel>
        <TabPanel header="Credenciais">
          <div class="text-600 mb-2">Gerencie chaves de API e integrações deste agente.</div>
          <Button label="Editar Credenciais" icon="pi pi-key" />
        </TabPanel>
        <TabPanel header="Nodes instalados">
          <ul class="m-0 pl-3">
            <li v-for="n in (selectedAgent?.nodes || [])" :key="n">{{ n }}</li>
          </ul>
        </TabPanel>
      </TabView>
    </Dialog>
    <!-- Drawer -->
    <transition name="fade">
      <div v-if="showLeftMenu" class="drawer-layer" @click.self="showLeftMenu = false">
        <transition name="slide-left">
          <aside class="left-drawer">
            <div class="drawer-header">
              <button class="close" @click="showLeftMenu = false"><i class="pi pi-times"></i></button>
            </div>
            <nav class="drawer-nav">
              <button class="drawer-item" @click="showLeftMenu=false">Meus agentes</button>
              <button class="drawer-item" @click="goToCredentials">Minhas credenciais</button>
              <button class="drawer-item" @click="showLeftMenu=false">Integrações</button>
              <button class="drawer-item" @click="showLeftMenu=false">Gerenciar Assinatura</button>
              <button class="drawer-item" @click="showLeftMenu=false">Configurações</button>
            </nav>
          </aside>
        </transition>
      </div>
    </transition>

    <!-- Logs de execução abaixo do menu -->
   
  </div>
  
</template>

<style scoped>
.agents-page { position: relative; min-height: 100vh; display: grid; place-items: start center; padding: 16px; background: linear-gradient(180deg, #FFFFFF 0%, #F7F7F7 100%); }
.icon-btn { position: absolute; top: 12px; width: 36px; height: 36px; display: grid; place-items: center; background: #fff; border: 1px solid #eee; border-radius: 999px; box-shadow: 0 8px 20px rgba(0,0,0,0.06); cursor: pointer; }
.icon-btn img { width: 18px; height: 18px; display: block; }
.icon-btn.left { left: 12px; }
.icon-btn.right { right: 12px; }
.agents-panel { width: min(1100px, 96vw); margin-top: 8px; padding: 16px; border-radius: 14px; background: linear-gradient(180deg, #FFFFFF 0%, #F4F4F4 100%); box-shadow: 0 26px 40px rgba(0,0,0,0.18); }
.agents-toolbar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.agents-title { font-weight: 700; font-size: 1.8rem; background: linear-gradient(90deg, #BDBDBD, #6B6B6B); -webkit-background-clip: text; background-clip: text; color: transparent; }
.add-agent { width: 36px; height: 36px; border: 1px dashed #BDBDBD; border-radius: 10px; background: #fff; color: #9a9a9a; font-size: 22px; line-height: 0; display: grid; place-items: center; cursor: pointer; }
.agents-grid { display: grid; grid-template-columns: repeat(3, minmax(220px, 1fr)); gap: 18px; padding: 8px; }
.agent-card { position: relative; height: 150px; background: linear-gradient(180deg, #FFFFFF 0%, #EFEFEF 100%); border: 2px dashed #BDBDBD; border-radius: 16px; cursor: pointer; }
.agent-card:hover { box-shadow: 0 16px 30px rgba(0,0,0,0.08); }
.agent-meta { position: absolute; left: 12px; top: 12px; color: #666; }
.agent-name { font-weight: 600; }
.agent-phone { font-size: 12px; opacity: .8; }
.status-dot { position: absolute; right: 12px; bottom: 12px; width: 18px; height: 18px; border-radius: 999px; }
.dot-on { background: radial-gradient(circle at 30% 30%, #4CFF4C, #0E8D0E); }
.dot-off { background: radial-gradient(circle at 30% 30%, #FF7A7A, #850000); }
.dot-warn { background: radial-gradient(circle at 30% 30%, #FFF173, #C9A800); }
.empty-state { padding: 24px; text-align: center; color: #777; }

/* Gradientes e realces do dashboard */

.btn-gradient {
  background: linear-gradient(90deg, #FF6600, #FFA64D) !important;
  color: #fff !important;
  border: none !important;
  box-shadow: 0 10px 22px rgba(255,102,0,0.25) !important;
}
.btn-gradient:hover { filter: brightness(1.05); background: linear-gradient(90deg, #FF6F14, #FFB36A) !important; }

.btn-gradient-gray {
  background: linear-gradient(90deg, #BDBDBD, #6B6B6B) !important;
  color: #fff !important;
  border: none !important;
  box-shadow: 0 10px 22px rgba(107,107,107,0.25) !important;
}
.btn-gradient-gray:hover { filter: brightness(1.05); background: linear-gradient(90deg, #C9C9C9, #9A9A9A) !important; }

/* Drawer */
.drawer-layer { position: fixed; inset: 0; background: rgba(0,0,0,0.25); z-index: 2000; }
.left-drawer { position: fixed; top: 0; left: 0; bottom: 0; width: 200px; background: linear-gradient(180deg, #FFFFFF, #F0F0F0); border-right: 1px solid #e5e5e5; box-shadow: 0 10px 40px rgba(0,0,0,0.15); z-index: 2001; }
.drawer-header { display: flex; justify-content: flex-end; padding: 8px; }
.drawer-header .close { background: transparent; border: none; font-size: 18px; cursor: pointer; }
.drawer-nav { display: grid; gap: 6px; padding: 8px; }
.drawer-item { text-align: left; padding: 10px 12px; background: #fff; border: 1px solid #eee; border-radius: 8px; cursor: pointer; }
.drawer-item:hover { background: #FFF7F0; border-color: #ffe5d1; }
.slide-left-enter-active, .slide-left-leave-active { transition: transform .25s ease, opacity .25s ease; }
.slide-left-enter-from, .slide-left-leave-to { transform: translateX(-120%); opacity: 0; }
.fade-enter-active, .fade-leave-active { transition: opacity .2s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

@media (max-width: 1024px) {
  .agents-grid { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 640px) {
  .agents-grid { grid-template-columns: 1fr; }
}

/* Logs de execução */
.logs-history {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: linear-gradient(180deg, #2D2D2D 0%, #1A1A1A 100%);
  border-top: 1px solid #333;
  box-shadow: 0 -8px 20px rgba(0,0,0,0.25);
  z-index: 1500;
  max-height: 40vh;
  overflow-y: auto;
}
.logs-history-title {
  color: #F5F5F5;
  font-size: 14px;
  font-weight: 600;
  padding: 12px 16px 8px;
  margin: 0;
  border-bottom: 1px solid rgba(255,255,255,0.08);
}
.logs-list {
  padding: 8px 16px 16px;
}
.log-item {
  background: rgba(255,255,255,0.05);
  border-radius: 8px;
  padding: 8px 12px;
  margin-bottom: 6px;
  border-left: 3px solid transparent;
  cursor: pointer;
  transition: background 0.2s ease;
}
.log-item:hover {
  background: rgba(255,255,255,0.08);
}
.log-item.success { border-left-color: #4CFF4C; }
.log-item.error { border-left-color: #FF7A7A; }
.log-item.paused { border-left-color: #FFF173; }
.log-header {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.log-prompt {
  flex: 1;
  color: #F5F5F5;
  font-weight: 500;
  font-size: 13px;
}
.log-status {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 4px;
  text-transform: uppercase;
}
.log-status.success { background: #0E8D0E; color: #fff; }
.log-status.error { background: #850000; color: #fff; }
.log-status.paused { background: #C9A800; color: #fff; }
.log-time {
  font-size: 11px;
  color: #999;
}
.log-details {
  margin-top: 4px;
}
.log-workflow {
  font-size: 12px;
  color: #FFA64D;
  font-weight: 500;
}
.log-error {
  margin-top: 4px;
  font-size: 12px;
  color: #FF7A7A;
  background: rgba(255,122,122,0.1);
  padding: 4px 6px;
  border-radius: 4px;
}

/* Logs detalhados (tela cheia) */
.detailed-logs-view {
  position: fixed;
  inset: 0;
  background: linear-gradient(180deg, #FFFFFF 0%, #F7F7F7 100%);
  z-index: 3000;
  display: grid;
  place-content: center;
  padding: 32px 16px;
}
.detailed-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  max-width: 720px;
  width: 100%;
}
.detailed-title {
  font-weight: 700;
  font-size: 20px;
  background: linear-gradient(90deg, #FF6600, #2D2D2D);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.close-detailed {
  background: linear-gradient(90deg, #6B6B6B, #BDBDBD);
  color: #fff;
  border: none;
  padding: 6px 12px;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
}
.detailed-logs-area {
  background: linear-gradient(180deg, #2D2D2D 0%, #1A1A1A 100%);
  border: 1px solid #333;
  border-radius: 12px;
  padding: 16px;
  max-height: 400px;
  overflow-y: auto;
  box-shadow: 0 8px 20px rgba(0,0,0,0.25);
  max-width: 720px;
  width: 100%;
}
.detailed-log-entry {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 0;
  border-bottom: 1px solid rgba(255,255,255,0.08);
  animation: slideIn 0.3s ease;
}
.detailed-log-entry:last-child { border-bottom: none; }
.detailed-log-icon {
  font-size: 14px;
  min-width: 20px;
}
.detailed-log-time {
  font-size: 11px;
  color: #999;
  font-weight: 500;
  min-width: 60px;
}
.detailed-log-message {
  flex: 1;
  font-weight: 500;
}
.detailed-log-entry.info .detailed-log-message { color: #F5F5F5; }
.detailed-log-entry.success .detailed-log-message { color: #4CFF4C; }
.detailed-log-entry.error .detailed-log-message { color: #FF7A7A; }
.detailed-log-entry.warning .detailed-log-message { color: #FFF173; }

@keyframes slideIn {
  from { opacity: 0; transform: translateY(-8px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>


