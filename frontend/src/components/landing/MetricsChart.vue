<script setup>
import { ref, onMounted } from 'vue'

const clicks = ref(0)
const impressions = ref(0)
const ctr = ref(0)
const lineLen = ref(0)
const dashOffset = ref(800)

onMounted(() => {
  // Animate numbers
  animateNumber(clicks, 12412, 1000)
  animateNumber(impressions, 523123, 1200)
  animateNumber(ctr, 1.58, 900, true)

  // Animate line stroke-dashoffset
  const length = 820
  lineLen.value = length
  requestAnimationFrame(() => {
    animateValue(800, 0, 1200, v => { dashOffset.value = v })
  })
})

function animateNumber(targetRef, to, duration, isFloat = false) {
  animateValue(0, to, duration, v => {
    targetRef.value = isFloat ? Math.round(v * 100) / 100 : Math.round(v)
  })
}

function animateValue(from, to, duration, onUpdate) {
  const start = performance.now()
  const diff = to - from
  const ease = t => 1 - Math.pow(1 - t, 3)
  function frame(now) {
    const p = Math.min(1, (now - start) / duration)
    onUpdate(from + diff * ease(p))
    if (p < 1) requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)
}
</script>

<template>
  <div class="chart-card">
    <div class="header">
      <span class="dot"></span>
      <span class="title">Métricas de Tráfego Orgânico</span>
    </div>

    <div class="pills">
      <div class="pill">
        <div class="icon">⧉</div>
        <div>
          <div class="label">Cliques</div>
          <div class="value">{{ clicks.toLocaleString('pt-BR') }} <span class="delta">↑ 9.6%</span></div>
        </div>
      </div>
      <div class="pill">
        <div class="icon">◎</div>
        <div>
          <div class="label">Impressões</div>
          <div class="value">{{ impressions.toLocaleString('pt-BR') }} <span class="delta">↑ 12.5%</span></div>
        </div>
      </div>
      <div class="pill">
        <div class="icon">◴</div>
        <div>
          <div class="label">CTR Médio</div>
          <div class="value">{{ ctr.toFixed(2) }} <span class="delta">↑ 1.2%</span></div>
        </div>
      </div>
    </div>

    <div class="svg-wrap">
      <svg viewBox="0 0 600 260" preserveAspectRatio="none" class="svg">
        <!-- grid -->
        <g stroke="#eee">
          <line v-for="y in 5" :key="y" :x1="0" :x2="600" :y1="y*50" :y2="y*50" />
        </g>
        <!-- area under main line -->
        <defs>
          <linearGradient id="areaGrad" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" :stop-color="'#FF6600'" stop-opacity="0.35" />
            <stop offset="100%" :stop-color="'#FFA64D'" stop-opacity="0.05" />
          </linearGradient>
          <linearGradient id="lineGrad" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stop-color="#FF6600" />
            <stop offset="100%" stop-color="#FFA64D" />
          </linearGradient>
        </defs>
        <path d="M0,200 C60,180 120,210 180,190 C240,170 300,210 360,170 C420,140 480,200 540,180 L600,190 L600,260 L0,260 Z" fill="url(#areaGrad)" />
        <path d="M0,200 C60,180 120,210 180,190 C240,170 300,210 360,170 C420,140 480,200 540,180 L600,190" stroke="url(#lineGrad)" stroke-width="4" fill="none" :style="{ strokeDasharray: lineLen + 'px', strokeDashoffset: dashOffset + 'px', transition: 'stroke-dashoffset 1.2s ease-out' }" />
        <path d="M0,210 C60,200 120,220 180,205 C240,195 300,225 360,190 C420,175 480,215 540,200 L600,205" stroke="#2D2D2D" stroke-opacity="0.35" stroke-width="3" fill="none" />
      </svg>
      <div class="legend">
        <span class="dot dot-primary"></span>
        <span>Cliques</span>
        <span class="dot dot-secondary"></span>
        <span>Impressões</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.chart-card {
  background: var(--brand-white);
  border-radius: 16px;
  border: 1px solid #eee;
  box-shadow: 0 12px 32px rgba(0,0,0,0.08);
  padding: 16px;
}
.header { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
.dot { width: 10px; height: 10px; border-radius: 50%; background: var(--brand-orange-strong); }
.title { color: var(--brand-gray-strong); font-weight: 700; }
.pills { display: grid; grid-template-columns: 1fr; gap: 10px; margin-bottom: 12px; }
.pill { display: grid; grid-template-columns: 28px 1fr; gap: 8px; align-items: center; background: var(--brand-gray-light); border-radius: 12px; padding: 8px 10px; }
.icon { width: 28px; height: 28px; border-radius: 8px; background: #fff; display: grid; place-items: center; color: var(--brand-orange-strong); font-weight: 800; }
.label { color: #555; font-weight: 600; }
.value { color: var(--brand-gray-strong); font-weight: 800; }
.delta { color: var(--brand-orange-strong); font-weight: 700; font-size: 12px; margin-left: 6px; }
.svg-wrap { background: #fff; border: 1px solid #f0f0f0; border-radius: 12px; padding: 6px; }
.svg { width: 100%; height: 260px; display: block; }
.legend { display: flex; align-items: center; gap: 8px; color: #666; font-weight: 600; padding: 8px 4px 0; }
.dot-primary { background: linear-gradient(90deg, #FF6600, #FFA64D); }
.dot-secondary { background: rgba(45,45,45,0.6); }

@media (min-width: 900px) {
  .pills { grid-template-columns: repeat(3, 1fr); }
}
</style>


