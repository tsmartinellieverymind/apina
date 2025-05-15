// test-auth.js
const { GoogleAuth } = require('google-auth-library');
const auth = new GoogleAuth();

(async () => {
  try {
    console.log('[Auth] Tentando carregar credenciais padrão...');
    const client = await auth.getClient();
    const projectId = await auth.getProjectId();
    console.log('✅ Credenciais carregadas com sucesso para o projeto:', projectId);
  } catch (err) {
    console.error('❌ Erro ao carregar credenciais:', err.message);
    console.error(err);
  }
})();
