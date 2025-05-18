const { gerarSugestoesDeAgendamento } = require('./services/ixcService');
const mockOS = require('./app/data/mock_ordens_servico').registros;
const mockOSTecnicosOcupados = require('./app/data/mock_ordens_servico_tecnico_ocupado');

async function testarSugestoes() {
  // Criar uma cópia da ordem de serviço de teste (última do array)
  const osBase = mockOS[mockOS.length - 1];
  
  // Usar o id_assunto do mock_ordens_servico.js sem override
  const osTeste = { ...osBase };
  console.log(`Ordem de Serviço de Teste (id_assunto: ${osTeste.id_assunto}):`, osTeste);

  try {
    console.log('osTeste:', JSON.stringify(osTeste, null, 2));
    // Mostrar a data atual para referência
    console.log(`[TESTE] Data atual: ${new Date().toISOString()}`);
    
    // Pass options to use the mock data with occupied technicians
    const resultado = await gerarSugestoesDeAgendamento(osTeste, {
      mockDados: true,
      mockOrdensTecnicoOcupado: mockOSTecnicosOcupados, // Directly pass the mock data with the correct variable name
      // Usar os valores da configuração (diasMin=1, diasMax=8)
      // Não forçamos mais valores específicos para garantir que o sistema use os valores da configuração
      debug: true // Habilitar logs detalhados
    });
    console.log('Resultado de gerarSugestoesDeAgendamento:', JSON.stringify(resultado, null, 2));
  } catch (error) {
    console.error('Erro ao testar gerarSugestoesDeAgendamento:', error);
  }
}

testarSugestoes();
