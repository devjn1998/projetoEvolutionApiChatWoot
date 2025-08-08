// Importações do Vue
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'

// Importações do PrimeVue 4.x
import PrimeVue from 'primevue/config';
import Aura from '@primevue/themes/aura'; // Tema Aura (PrimeVue 4.x)
import ToastService from 'primevue/toastservice';
import Tooltip from 'primevue/tooltip';
import 'primeicons/primeicons.css'; // Ícones
import 'primeflex/primeflex.css'; // Utilitários de CSS

// CSS Global para definir Arial como fonte padrão
const globalCSS = `
  * {
    font-family: Arial, sans-serif !important;
  }
  
  body {
    font-family: Arial, sans-serif !important;
  }
  
  .p-component {
    font-family: Arial, sans-serif !important;
  }
`;

// Injeta o CSS global
const style = document.createElement('style');
style.textContent = globalCSS;
document.head.appendChild(style);

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(PrimeVue, {
    theme: {
        preset: Aura,
        options: {
            prefix: 'p',
            darkModeSelector: '.p-dark',
            cssLayer: false
        }
    }
});
app.use(ToastService);
app.directive('tooltip', Tooltip);

app.mount('#app')
