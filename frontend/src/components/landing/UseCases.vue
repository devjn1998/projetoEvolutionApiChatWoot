<script setup>
const items = [
  { title: 'Atendimento ao cliente', text: 'Bots que respondem rápido e com contexto.' },
  { title: 'Marketing digital', text: 'Campanhas automatizadas e personalizadas.' },
  { title: 'Logística', text: 'Atualizações e rastreio em tempo real.' },
  { title: 'Vendas', text: 'Qualificação e follow-up automático.' }
]
</script>

<template>
  <section class="usecases">
    <div class="container">
      <h2>Aplicações</h2>
      <div class="grid">
        <div v-for="(u, i) in items" :key="i" class="card">
          <h3>{{ u.title }}</h3>
          <p>{{ u.text }}</p>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.usecases { background: linear-gradient(180deg, #FFFFFF 0%, #F5F5F5 100%); padding: 56px 16px; }
.container { max-width: 1200px; margin: 0 auto; }
h2 { color: var(--brand-gray-strong); margin-bottom: 20px; font-size: 28px; font-weight: 800; }
.grid { display: grid; grid-template-columns: repeat(1, 1fr); gap: 16px; }
.card { background: linear-gradient(180deg, #FFFFFF 0%, #FFF7F0 100%); border-radius: 16px; padding: 20px; box-shadow: 0 8px 22px rgba(255,102,0,0.12); border: 1px solid #ffe5d1; }
h3 { color: var(--brand-gray-strong); margin-bottom: 8px; font-weight: 700; }
p { color: #555; }
@media (min-width: 700px) { .grid { grid-template-columns: repeat(2, 1fr); } }
@media (min-width: 1024px) { .grid { grid-template-columns: repeat(4, 1fr); } }
</style>


