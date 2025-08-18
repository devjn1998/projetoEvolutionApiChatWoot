<script setup>
const items = [
  { title: 'Automação sem esforço', text: 'Fluxos prontos e integração automática.', icon: '⚙️' },
  { title: 'Agentes de IA sob medida', text: 'Personalizados para o seu negócio.', icon: '🤖' },
  { title: 'Integração em segundos', text: 'Apenas escaneie o QR Code.', icon: '🔗' },
  { title: 'Atendimento inteligente', text: 'Converse em todos os canais.', icon: '💬' }
]
</script>

<template>
  <section class="benefits">
    <div class="container">
      <div v-for="(b, i) in items" :key="i" class="card">
        <div class="icon">{{ b.icon }}</div>
        <h3>{{ b.title }}</h3>
        <p>{{ b.text }}</p>
      </div>
    </div>
  </section>
</template>

<style scoped>
.benefits { background: radial-gradient(600px 300px at 10% 10%, rgba(255, 102, 0, 0.08), rgba(255,102,0,0) 70%), var(--brand-white); padding: 48px 16px; }
.container { max-width: 1200px; margin: 0 auto; display: grid; grid-template-columns: repeat(1, 1fr); gap: 16px; }
.card { background: linear-gradient(180deg, #FFFFFF 0%, #F9F4EF 100%); border-radius: 16px; padding: 22px; box-shadow: 0 16px 36px rgba(255, 102, 0, 0.15); transition: transform .2s ease, box-shadow .2s ease; border: 1px solid #ffe5d1; }
.card:hover { transform: translateY(-4px); }
.icon { font-size: 22px; }
h3 { color: var(--brand-gray-strong); margin-top: 8px; font-weight: 700; }
p { color: #555; }

@media (min-width: 700px) {
  .container { grid-template-columns: repeat(2, 1fr); }
}
@media (min-width: 1024px) {
  .container { grid-template-columns: repeat(4, 1fr); }
}
</style>


