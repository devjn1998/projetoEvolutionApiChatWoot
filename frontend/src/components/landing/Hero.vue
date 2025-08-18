<script setup>
import { useRouter } from 'vue-router'
const router = useRouter()
const goRegister = () => router.push('/register')
import MetricsChart from './MetricsChart.vue'
</script>

<template>
  <section class="hero">
    <div class="container">
      <div class="copy">
        <h1><span class="gradient">Agentes de IA</span> prontos para o seu negócio</h1>
        <p class="subtitle">Gere atendimento, vendas e operações 100% automáticas em minutos.</p>
        <p class="support">Integração com n8n, Evolution API e Chatwoot. Basta escanear o QR Code.</p>
        <div class="actions">
          <button class="primary" @click="goRegister">Criar minha conta</button>
          <a class="secondary" href="#funcionalidades">Ver como funciona</a>
        </div>
        <div class="badges">
          <span>Sem cartão de crédito</span>
          <span>Teste por 7 dias</span>
        </div>
      </div>
      <div class="art">
        
        <MetricsChart class="chart" />
      </div>
    </div>
  </section>
</template>

<style scoped>
.hero { background: var(--brand-white); padding: 72px 16px; }
.container { max-width: 1200px; margin: 0 auto; display: grid; grid-template-columns: 1fr; gap: 32px; align-items: center; }
.copy h1 { font-size: 40px; line-height: 1.1; color: var(--brand-gray-strong); font-weight: 800; }
.gradient { background: linear-gradient(90deg, #FF6600, #FFA64D); -webkit-background-clip: text; background-clip: text; color: transparent; }
.subtitle { margin-top: 12px; color: #333; font-size: 20px; font-weight: 600; }
.support { margin-top: 6px; color: #666; font-size: 16px; }
.actions { margin-top: 20px; display: flex; gap: 12px; flex-wrap: wrap; }
.primary { background: linear-gradient(90deg, #FF6600, #FFA64D); color: var(--brand-white); border: none; padding: 12px 20px; border-radius: 999px; font-weight: 800; box-shadow: 0 10px 24px rgba(255,102,0,0.25); }
.primary:hover { filter: brightness(1.05); }
.secondary { color: var(--brand-orange-strong); font-weight: 600; }
.badges { display: flex; gap: 10px; margin-top: 12px; }
.badges span { background: var(--brand-gray-light); color: var(--brand-gray-strong); font-weight: 600; padding: 6px 10px; border-radius: 999px; }
.art { display: grid; gap: 16px; justify-items: center; }
.card { width: 320px; height: 240px; border-radius: 16px; background: var(--brand-gray-light); padding: 20px; display: grid; grid-template-columns: 120px 1fr; gap: 16px; box-shadow: 0 10px 30px rgba(0,0,0,0.08); }
.chart { width: 100%; max-width: 560px; }
.qr { width: 120px; height: 120px; background: repeating-linear-gradient(45deg, #000, #000 8px, #fff 8px, #fff 16px); border-radius: 8px; }
.rows { display: grid; gap: 10px; align-content: start; }
.rows span { height: 14px; background: #e0e0e0; border-radius: 6px; }

@media (min-width: 900px) {
  .container { grid-template-columns: 1.1fr 0.9fr; }
  .copy h1 { font-size: 54px; }
  .art { justify-items: end; }
}
</style>


