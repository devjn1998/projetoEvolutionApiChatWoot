<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';

// Importando componentes do PrimeVue
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import Card from 'primevue/card';
import Divider from 'primevue/divider';
import Message from 'primevue/message';

const username = ref(''); // Mudança: aceita username ou email
const password = ref('');
const errorMessage = ref('');
const successMessage = ref('');
const isLoading = ref(false);
const router = useRouter();

const handleLogin = async () => {
  // Validação básica
  if (!username.value || !password.value) {
    errorMessage.value = 'Username/Email e senha são obrigatórios';
    return;
  }

  isLoading.value = true;
  errorMessage.value = '';
  successMessage.value = '';

  try {
    const response = await fetch('http://localhost:3001/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: username.value,
        password: password.value
      })
    });

    const data = await response.json();

    if (data.success) {
      // Salvar token no localStorage
      localStorage.setItem('authToken', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      
      console.log('Login realizado com sucesso:', data.user);
      successMessage.value = `Bem-vindo, ${data.user.fullName}! Redirecionando...`;
      
      // Redirecionar para dashboard
      setTimeout(() => {
        router.push('/dashboard');
      }, 1500);
      
    } else {
      errorMessage.value = data.error || 'Erro ao fazer login';
    }

  } catch (error) {
    console.error('Erro:', error);
    errorMessage.value = 'Erro de conexão. Tente novamente.';
  } finally {
    isLoading.value = false;
  }
};

const goToRegister = () => {
  router.push('/register');
};
</script>

<template>
  <div class="login-background">
    <div class="flex justify-content-center align-items-center min-h-screen p-4">
      <Card class="w-full max-w-25rem shadow-8">
        <template #title>
          <div class="text-center">
            <h2 class="text-3xl font-bold text-900 mb-2">Entrar</h2>
            <p class="text-600 text-sm">Faça login na sua conta</p>
          </div>
        </template>
        <template #content>
          <!-- Mensagens de feedback -->
          <Message v-if="errorMessage" severity="error" :closable="false" class="mb-3">
            {{ errorMessage }}
          </Message>
          <Message v-if="successMessage" severity="success" :closable="false" class="mb-3">
            {{ successMessage }}
          </Message>

          <form @submit.prevent="handleLogin" class="flex flex-column gap-4">
            <div class="p-float-label">
              <label for="username">Username ou E-mail</label>
              <InputText id="username" v-model="username" type="text" class="w-full" />
            </div>
            <div class="p-float-label">
              <label for="password">Senha</label>
              <InputText id="password" v-model="password" type="password" class="w-full" />
            </div>
            <Button 
              type="submit" 
              :label="isLoading ? 'Entrando...' : 'Entrar'" 
              :loading="isLoading"
              class="w-full" 
              size="large" 
            />
          </form>
          
          <Divider align="center" class="my-4">
            <span class="text-600 text-sm">OU</span>
          </Divider>
          
          <Button 
            label="Entrar com Google" 
            icon="pi pi-google" 
            severity="secondary" 
            outlined 
            class="w-full" 
            size="large"
          />
        </template>
        <template #footer>
          <div class="text-center">
            <span class="text-600 text-sm">Não tem uma conta? </span>
            <Button label="Cadastre-se" link @click="goToRegister" class="p-0" />
          </div>
        </template>
      </Card>
    </div>
  </div>
</template>

<style scoped>
.login-background {
  background-image: url('@/assets/images/background.png');
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  background-attachment: fixed;
  min-height: 100vh;
  position: relative;
}

.login-background::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.3);
  z-index: 1;
}

.login-background > div {
  position: relative;
  z-index: 2;
}

/* Melhorar o contraste do card */
:deep(.p-card) {
  backdrop-filter: blur(20px);
  background: rgba(251, 250, 250, 0.844);
}
</style>
