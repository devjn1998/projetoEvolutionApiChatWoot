<script setup>
</script>

<template>
  <section class="demo">
    <div class="container">
      <div class="mock">
        <div class="top">
          <div class="dot"></div>
          <div class="title">Onboarding</div>
        </div>
        <div class="steps">
          <div class="step">
            <div class="num">1</div>
            <div>
              <h4>Crie sua conta</h4>
              <p>Cadastre-se e acesse o painel.</p>
            </div>
          </div>
          <div class="step">
            <div class="num">2</div>
            <div>
              <h4>Escaneie o QR Code</h4>
              <p>Integração automática com Evolution API.</p>
            </div>
          </div>
          <div class="step">
            <div class="num">3</div>
            <div>
              <h4>Pronto!</h4>
              <p>Agentes conectados ao n8n e Chatwoot.</p>
            </div>
          </div>
        </div>
        <div class="qr"></div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.demo { background: var(--brand-gray-light); padding: 60px 16px; }
.container { max-width: 1200px; margin: 0 auto; }
.mock { background: var(--brand-white); border-radius: 16px; box-shadow: 0 12px 32px rgba(0,0,0,0.08); padding: 20px; display: grid; grid-template-columns: 1fr; gap: 20px; border: 1px solid #eee; }
.top { display: flex; align-items: center; gap: 8px; }
.top .dot { width: 10px; height: 10px; border-radius: 50%; background: var(--brand-orange-strong); }
.top .title { color: var(--brand-gray-strong); font-weight: 700; }
.steps { display: grid; gap: 12px; }
.step { display: grid; grid-template-columns: 32px 1fr; gap: 12px; align-items: start; }
.num { width: 32px; height: 32px; border-radius: 999px; background: var(--brand-orange-strong); color: var(--brand-white); display: grid; place-items: center; font-weight: 700; }
.qr { height: 160px; background: repeating-linear-gradient(45deg, #000, #000 8px, #fff 8px, #fff 16px); border-radius: 12px; }

@media (min-width: 900px) {
  .mock { grid-template-columns: 1fr 240px; align-items: center; }
}
</style>


