<script setup>
import { useRouter } from 'vue-router'
const router = useRouter()
const plans = [
  { name: 'Essential', price: 'R$99/mês', promo: 'R$74 no primeiro mês', features: ['1 agente', '5 fluxos n8n', 'Integração Evolution API', 'Relatório semanal no WhatsApp'] },
  { name: 'Pro', price: 'R$249/mês', highlight: true, features: ['3 agentes', 'n8n + Chatwoot', 'Integração Evolution API', 'Suporte padrão'] },
  { name: 'Business', price: 'R$499/mês', features: ['Agentes ilimitados', 'Prioridade no WhatsApp', 'Integrações avançadas', 'SLA empresarial'] },
]
const goRegister = () => router.push('/register')
</script>

<template>
  <section class="pricing">
    <div class="container">
      <div v-for="(p, i) in plans" :key="i" class="card" :class="{ highlight: p.highlight }">
        <h3>{{ p.name }}</h3>
        <div class="price">{{ p.price }}</div>
        <div v-if="p.promo" class="promo">{{ p.promo }} — use o cupom <strong>BEMVINDO25</strong></div>
        <ul>
          <li v-for="(f, j) in p.features" :key="j">{{ f }}</li>
        </ul>
        <button class="cta" @click="goRegister">Assinar</button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.pricing { background: radial-gradient(600px 280px at 85% 10%, rgba(255,166,77,0.18), rgba(255,166,77,0) 70%), var(--brand-white); padding: 56px 16px; }
.container { max-width: 1200px; margin: 0 auto; display: grid; grid-template-columns: repeat(1, 1fr); gap: 16px; }
.card { background: linear-gradient(180deg, #FFFFFF 0%, #FFF3E6 100%); border-radius: 16px; padding: 24px; box-shadow: 0 18px 36px rgba(255,102,0,0.15); border: 2px solid transparent; }
.card.highlight { border-color: var(--brand-orange-strong); background: #fff7f0; position: relative; }
.card.highlight::after { content: 'Mais popular'; position: absolute; top: -12px; right: 12px; background: var(--brand-orange-strong); color: var(--brand-white); font-size: 12px; padding: 4px 8px; border-radius: 999px; }
.promo { margin: 6px 0 10px; color: #444; font-weight: 600; }
h3 { color: var(--brand-gray-strong); font-weight: 800; }
.price { font-size: 24px; color: var(--brand-orange-strong); margin: 8px 0 12px; font-weight: 800; }
ul { list-style: none; padding: 0; margin: 0 0 16px; }
li { color: #444; margin-bottom: 6px; }
.cta { width: 100%; background: var(--brand-orange-strong); color: var(--brand-white); border: none; padding: 12px; border-radius: 10px; font-weight: 700; }
.cta:hover { background: var(--brand-orange-light); }
@media (min-width: 900px) { .container { grid-template-columns: repeat(3, 1fr); } }
</style>


