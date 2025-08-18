<script setup>
import { useRouter } from 'vue-router'
const router = useRouter()
const goRegister = () => router.push('/register')
</script>

<template>
  <section class="cta">
    <div class="container">
      <h2>Pronto para automatizar seu negócio?</h2>
      <button class="primary" @click="goRegister">Criar minha conta agora</button>
    </div>
  </section>
</template>

<style scoped>
.cta { background: var(--brand-gray-strong); padding: 56px 16px; }
.container { max-width: 1200px; margin: 0 auto; text-align: center; }
h2 { color: var(--brand-white); font-weight: 800; margin-bottom: 16px; }
.primary { background: var(--brand-orange-strong); color: var(--brand-white); border: none; padding: 12px 18px; border-radius: 10px; font-weight: 700; }
.primary:hover { background: var(--brand-orange-light); }
</style>


