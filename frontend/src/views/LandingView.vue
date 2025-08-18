<script setup>
import Header from '@/components/landing/Header.vue'
import Hero from '@/components/landing/Hero.vue'
import Benefits from '@/components/landing/Benefits.vue'
import Demo from '@/components/landing/Demo.vue'
import UseCases from '@/components/landing/UseCases.vue'
import Pricing from '@/components/landing/Pricing.vue'
import Testimonials from '@/components/landing/Testimonials.vue'
import CTA from '@/components/landing/CTA.vue'
import Footer from '@/components/landing/Footer.vue'
</script>

<template>
  <div class="landing-wrap">
    <Header />
    <main>
      <Hero />
      <section id="sobre" class="section">
        <Benefits />
      </section>
      <div class="divider"></div>
      <section id="funcionalidades" class="section">
        <Demo />
      </section>
      <div class="divider"></div>
      <UseCases />
      <div class="divider"></div>
      <section id="planos" class="section">
        <Pricing />
      </section>
      <div class="divider"></div>
      <Testimonials />
      <div class="divider"></div>
      <section id="contato" class="section">
        <CTA />
      </section>
    </main>
    <Footer />
  </div>
  
</template>

<style scoped>
main { display: block; }
.landing-wrap {
  background:
    radial-gradient(600px 300px at 90% 10%, rgba(255, 166, 77, 0.16), rgba(255, 166, 77, 0) 70%),
    radial-gradient(500px 260px at 0% 40%, rgba(255, 102, 0, 0.10), rgba(255, 102, 0, 0) 65%),
    linear-gradient(180deg, rgba(240, 215, 177, 0.241) 0%, rgb(252, 252, 252) 100%);
}
.section { padding-top: 24px; padding-bottom: 24px; }
.divider { height: 1px; background: linear-gradient(90deg, rgba(255,102,0,0), rgba(255,102,0,0.35), rgba(255,102,0,0)); opacity: .6; }
</style>


