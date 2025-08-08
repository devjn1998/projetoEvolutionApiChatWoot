<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';

// Importando componentes do PrimeVue
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import Card from 'primevue/card';
import Divider from 'primevue/divider';
import Message from 'primevue/message';

const fullName = ref('');
const nameEnterprise = ref('');
const username = ref('');
const email = ref('');
const password = ref('');
const router = useRouter();

// Estados para feedback visual
const isLoading = ref(false);
const errorMessage = ref('');
const successMessage = ref('');

const handleRegister = async () => {
  // Limpar mensagens anteriores
  errorMessage.value = '';
  successMessage.value = '';

  // Validação básica
  if (!fullName.value || !nameEnterprise.value || !email.value || !password.value) {
    errorMessage.value = 'Por favor, preencha todos os campos obrigatórios.';
    return;
  }

  if (password.value.length < 6) {
    errorMessage.value = 'A senha deve ter pelo menos 6 caracteres.';
    return;
  }

  isLoading.value = true;

  try {
    // Preparar dados para envio
    const formData = {
      fullName: fullName.value,
      nameEnterprise: nameEnterprise.value,
      username: username.value,
      email: email.value,
      password: password.value,
      timestamp: new Date().toISOString()
    }

    console.log('Enviando dados para o backend...', formData);;


    // Remover timestamp (não é necessário para registro)
    delete formData.timestamp;
    
    console.log('Registrando usuário...', { ...formData, password: '[HIDDEN]' });

    // Enviar dados para a API de registro
    const response = await fetch('http://localhost:3001/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(formData)
    });

    const data = await response.json();
    console.log('Resposta da API:', data);

    if (data.success) {
      console.log('Usuário registrado com sucesso');
      successMessage.value = `Registrado com sucesso! Sua instância: ${data.instanceName}. Redirecionando para login...`;
      setTimeout(() => {
        router.push('/login');
      }, 3000);

    } else {
      console.error('Erro ao registrar:', data.error);
      errorMessage.value = data.error || 'Erro ao registrar usuário';
    }

  } catch (error) {
    console.error('❌ Erro de conexão:', error);
    errorMessage.value = 'Erro de conexão. Verifique sua internet e tente novamente.';
  } finally {
    isLoading.value = false;
  }
};

const goToLogin = () => {
  router.push('/login');
};
</script>

<template>
  <div class="register-background">
    <div class="flex justify-content-center align-items-center min-h-screen p-4">
      <Card class="w-full max-w-25rem shadow-8">
        <template #title>
          <div class="text-center">
            <h2 class="text-3xl font-bold text-900 mb-2">Criar Conta</h2>
            <p class="text-600 text-sm">Cadastre-se para começar</p>
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

          <form @submit.prevent="handleRegister" class="flex flex-column gap-4">
            <div class="p-float-label">
              <label for="fullName">Nome completo</label>
              <InputText id="fullName" v-model="fullName" type="text" class="w-full" />
            </div>
            <div class="p-float-label">
              <label for="nameEnterprise">Nome da empresa</label>
              <InputText id="nameEnterprise" v-model="nameEnterprise" type="text" class="w-full" />
            </div>
            <div class="p-float-label">
              <label for="username">Usuário</label>
              <InputText id="username" v-model="username" type="text" class="w-full" />
            </div>
            <div class="p-float-label">
              <label for="email">Endereço de e-mail</label>
              <InputText id="email" v-model="email" type="email" class="w-full" />
            </div>
            <div class="p-float-label">
              <label for="password">Crie uma senha</label>
              <InputText id="password" v-model="password" type="password" class="w-full" />
            </div>
            <Button 
              type="submit" 
              :label="isLoading ? 'Cadastrando...' : 'Cadastrar'" 
              severity="success" 
              class="w-full" 
              size="large"
              :loading="isLoading"
              :disabled="isLoading"
            />
          </form>
          
          <Divider align="center" class="my-4">
            <span class="text-600 text-sm">OU</span>
          </Divider>
          
          <Button 
            label="Cadastrar com Google" 
            icon="pi pi-google" 
            severity="secondary" 
            outlined 
            class="w-full" 
            size="large"
          />
        </template>
        <template #footer>
          <div class="text-center">
            <span class="text-600 text-sm">Já tem uma conta? </span>
            <Button label="Entre" link @click="goToLogin" class="p-0" />
          </div>
        </template>
      </Card>
    </div>
  </div>
</template>

<style scoped>
.register-background {
  background-image: url('@/assets/images/background.png');
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  background-attachment: fixed;
  min-height: 100vh;
  position: relative;
}

.register-background::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.3);
  z-index: 1;
}

.register-background > div {
  position: relative;
  z-index: 2;
}

/* Melhorar o contraste do card */
:deep(.p-card) {
  backdrop-filter: blur(20px);
  background: rgba(251, 250, 250, 0.844);
}
</style>
