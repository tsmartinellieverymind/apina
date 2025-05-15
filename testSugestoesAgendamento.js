const { gerarSugestoesDeAgendamento } = require('./services/ixcService');
const mockOS = require('./app/data/mock_ordens_servico').registros;

async function testarSugestoes() {
  // Seleciona a ordem de serviço de teste (última do array)
  const osTeste = mockOS[mockOS.length - 1];
  console.log('Ordem de Serviço de Teste:', osTeste);

  try {
    
    console.log('osTeste:', JSON.stringify(osTeste, null, 2));
    const resultado = await gerarSugestoesDeAgendamento(osTeste);
    console.log('Resultado de gerarSugestoesDeAgendamento:', JSON.stringify(resultado, null, 2));
  } catch (error) {
    console.error('Erro ao testar gerarSugestoesDeAgendamento:', error);
  }
}

testarSugestoes();
