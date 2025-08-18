<script setup>
const testimonials = [
  { author: 'Maria – Loja X', text: 'Integração em minutos. Nosso suporte ficou 24/7.', logo: '🛒' },
  { author: 'João – SaaS Y', text: 'Automatizamos funis e aumentamos conversões.', logo: '⚡' },
]
</script>

<template>
  <section class="testimonials">
    <div class="container">
      <div class="metrics">
        <div class="metric"><div class="num">0k</div><div class="label">empresas impactadas</div></div>
        <div class="metric"><div class="num">R$0M</div><div class="label">custo reduzido</div></div>
        <div class="metric"><div class="num">0k</div><div class="label">agentes criados</div></div>
        <div class="metric"><div class="num">0A</div><div class="label">anos de mercado</div></div>
      </div>
      <div class="logos">
        <span class="logo">n8n</span>
        <span class="logo">Evolution API</span>
        <span class="logo">Chatwoot</span>
      </div>
      <div class="grid">
        <div v-for="(t, i) in testimonials" :key="i" class="card">
          <div class="logo-circle">{{ t.logo }}</div>
          <p class="text">“{{ t.text }}”</p>
          <div class="author">{{ t.author }}</div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.testimonials { background: linear-gradient(180deg, #FFFFFF 0%, #F5F5F5 100%); padding: 56px 16px; }
.container { max-width: 1200px; margin: 0 auto; }
.metrics { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 20px; }
.metric { background: linear-gradient(180deg, #FFFFFF 0%, #FFF7F0 100%); border-radius: 12px; padding: 16px; text-align: center; box-shadow: 0 8px 22px rgba(255,102,0,0.12); border: 1px solid #ffe5d1; }
.metric .num { font-size: 28px; font-weight: 800; color: var(--brand-gray-strong); }
.metric .label { color: #666; font-weight: 600; }
@media (min-width: 900px) { .metrics { grid-template-columns: repeat(4, 1fr); } }
.logos { display: flex; gap: 16px; align-items: center; flex-wrap: wrap; color: var(--brand-gray-strong); font-weight: 700; opacity: 0.8; }
.logo { background: var(--brand-gray-light); padding: 8px 12px; border-radius: 8px; }
.grid { display: grid; grid-template-columns: repeat(1, 1fr); gap: 16px; margin-top: 16px; }
.card { background: linear-gradient(180deg, #FFFFFF 0%, #FFF7F0 100%); border-radius: 16px; padding: 20px; box-shadow: 0 10px 28px rgba(255,102,0,0.14); border: 1px solid #ffe5d1; }
.logo-circle { width: 40px; height: 40px; border-radius: 999px; background: var(--brand-orange-strong); color: var(--brand-white); display: grid; place-items: center; font-weight: 800; }
.text { color: #333; margin-top: 10px; }
.author { color: var(--brand-gray-strong); font-weight: 700; margin-top: 8px; }
@media (min-width: 900px) { .grid { grid-template-columns: repeat(2, 1fr); } }
</style>


