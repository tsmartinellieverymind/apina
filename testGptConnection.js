const GptConnectionTester = require('./services/gptConnectionTester');
require('dotenv').config();

process.on('uncaughtException', function(err) {
  console.error('Exceção não capturada:', err);
  process.exit(1);
});
process.on('unhandledRejection', function(reason, p) {
  console.error('Promise rejeitada não tratada:', reason);
  process.exit(1);
});

(async () => {
  try {
    const tester = new GptConnectionTester();
    const result = await tester.testConnection();
    console.log('--- Resultado do teste de conexão com o GPT ---');
    if (result.success) {
      console.log('✅ Sucesso!');
      console.log('Status:', result.status);
      console.log('Resposta:', JSON.stringify(result.data, null, 2));
    } else {
      console.error('❌ Falha na conexão:');
      console.error(result.error);
      if (result.stack) {
        console.error('Stack:', result.stack);
      }
    }
  } catch (err) {
    console.error('Erro inesperado no teste:', err);
  }
})();
