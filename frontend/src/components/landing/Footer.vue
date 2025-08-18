<script setup>
</script>

<template>
  <footer class="footer">
    <div class="container">
      <div class="left">
        <div class="brand">IAgents</div>
        <p>Automação simples com IA sob medida.</p>
      </div>
      <div class="right">
        <a href="#">Contato</a>
        <a href="#">LinkedIn</a>
        <a href="#">Instagram</a>
      </div>
    </div>
  </footer>
</template>

<style scoped>
.footer { background: var(--brand-gray-light); padding: 24px 16px; border-top: 1px solid var(--color-border); }
.container { max-width: 1200px; margin: 0 auto; display: grid; grid-template-columns: 1fr; gap: 12px; align-items: center; }
.brand { color: var(--brand-gray-strong); font-weight: 800; }
.left p { color: #666; }
.right { display: flex; gap: 12px; flex-wrap: wrap; justify-content: flex-start; }
.right a { color: var(--brand-gray-strong); font-weight: 600; }
.right a:hover { color: var(--brand-orange-strong); }
@media (min-width: 900px) { .container { grid-template-columns: 1fr auto; } .right { justify-content: flex-end; } }
</style>


