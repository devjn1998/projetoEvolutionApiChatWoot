<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const isMenuOpen = ref(false)
const router = useRouter()

const goToRegister = () => router.push('/register')
</script>

<template>
  <header class="header">
    <div class="promo">✨ Garanta <strong>25% OFF</strong> no primeiro mês. Cupom: <strong>BEMVINDO25</strong></div>
    <div class="container">
      <div class="logo" @click="router.push('/')">
        <span class="dot"></span>
        <span class="brand">IAgents</span>
      </div>
      <nav class="nav" :class="{ open: isMenuOpen }">
        <a href="#sobre">Sobre</a>
        <a href="#funcionalidades">Funcionalidades</a>
        <a href="#planos">Planos</a>
        <a href="#contato">Contato</a>
      </nav>
      <button class="cta" @click="goToRegister">Iniciar teste grátis</button>
      <button class="burger" @click="isMenuOpen = !isMenuOpen">
        <span></span>
        <span></span>
        <span></span>
      </button>
    </div>
  </header>
</template>

<style scoped>
.header { position: sticky; top: 0; z-index: 50; background: var(--brand-white); border-bottom: 1px solid var(--color-border); }
.promo { text-align: center; padding: 8px 12px; background: var(--brand-gray-light); color: var(--brand-gray-strong); font-weight: 600; }
.container {
  display: flex;
  align-items: center;
  justify-content: space-between;
  max-width: 1200px;
  margin: 0 auto;
  padding: 16px;
}
.logo { display: flex; align-items: center; gap: 8px; cursor: pointer; }
.logo .dot { width: 10px; height: 10px; border-radius: 50%; background: var(--brand-orange-strong); }
.brand { color: var(--brand-gray-strong); font-weight: 700; letter-spacing: 0.5px; }
.nav { display: none; gap: 24px; }
.nav a { color: var(--brand-gray-strong); font-weight: 500; }
.nav a:hover { color: var(--brand-orange-strong); }
.cta { background: linear-gradient(90deg, #FF6600, #FFA64D); color: var(--brand-white); border: none; padding: 10px 16px; border-radius: 999px; font-weight: 700; box-shadow: 0 8px 18px rgba(255,102,0,0.25); }
.cta:hover { filter: brightness(1.05); }
.burger { display: inline-flex; flex-direction: column; gap: 4px; background: transparent; border: none; }
.burger span { width: 22px; height: 2px; background: var(--brand-gray-strong); }

@media (min-width: 900px) {
  .nav { display: flex; }
  .burger { display: none; }
}

/* mobile dropdown */
@media (max-width: 899px) {
  .nav.open { position: absolute; top: 58px; left: 0; right: 0; background: var(--brand-white); display: flex; flex-direction: column; padding: 12px 16px; border-bottom: 1px solid var(--color-border); }
}
</style>


