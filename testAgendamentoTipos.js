const { gerarSugestoesDeAgendamento } = require('./services/ixcService');
const mockOS = require('./app/data/mock_ordens_servico').registros;
const mockOSTecnicosOcupados = require('./app/data/mock_ordens_servico_tecnico_ocupado');

async function testarSugestoesPorTipo() {
  // Criar uma OS base simplificada
  const osBase = {
    id: "999",
    tipo: "I",
    status: "A",
    id_cliente: "2002",
    setor: "2",
    data_abertura: "2025-05-17 09:45:00"
  };
  
  console.log('===== TESTE DE AGENDAMENTO POR TIPO =====');
  
  try {
    // Teste 1: OS do tipo instalação (id_assunto: 1)
    const osInstalacao = { ...osBase, id_assunto: "1" };
    const resultadoInstalacao = await gerarSugestoesDeAgendamento(osInstalacao, {
      mockDados: true,
      mockOrdensTecnicoOcupado: mockOSTecnicosOcupados,
      debug: false // Reduzir logs
    });
    
    // Teste 2: OS do tipo manutenção (id_assunto: 2)
    const osManutencao = { ...osBase, id_assunto: "2" };
    const resultadoManutencao = await gerarSugestoesDeAgendamento(osManutencao, {
      mockDados: true,
      mockOrdensTecnicoOcupado: mockOSTecnicosOcupados,
      debug: false // Reduzir logs
    });
    
    // Resultados simplificados
    console.log('\n===== RESULTADOS =====');
    console.log(`INSTALAÇÃO (id_assunto=1): ${resultadoInstalacao.sugestao ? 'Tem sugestões' : 'SEM sugestões'}`);
    console.log(`MANUTENÇÃO (id_assunto=2): ${resultadoManutencao.sugestao ? 'Tem sugestões' : 'SEM sugestões'}`);
    
    // Verificação do comportamento
    console.log('\n===== VERIFICAÇÃO DE COMPORTAMENTO =====');
    if (!resultadoInstalacao.sugestao && resultadoManutencao.sugestao) {
      console.log('✅ COMPORTAMENTO CORRETO: Instalações são filtradas quando limite_instalacao_atingido = true, mas manutenções não são afetadas.');
    } else if (resultadoInstalacao.sugestao && resultadoManutencao.sugestao) {
      console.log('❌ COMPORTAMENTO INCORRETO: Ambos os tipos têm sugestões disponíveis, o filtro de limite_instalacao_atingido não está funcionando.');
    } else if (!resultadoInstalacao.sugestao && !resultadoManutencao.sugestao) {
      console.log('❌ COMPORTAMENTO INCORRETO: Nenhum tipo tem sugestões disponíveis, o filtro está sendo aplicado a todos os tipos.');
    } else {
      console.log('❓ COMPORTAMENTO INESPERADO: Instalações têm sugestões disponíveis, mas manutenções não.');
    }
    
  } catch (error) {
    console.error('Erro ao testar gerarSugestoesDeAgendamento:', error);
  }
}

testarSugestoesPorTipo();
