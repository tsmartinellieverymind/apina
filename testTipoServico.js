const { gerarSugestoesDeAgendamento } = require('./services/ixcService');

// Função simplificada para testar o comportamento de filtragem por tipo de serviço
async function testarFiltroTipoServico() {
  // Criar uma OS base simples
  const osBase = {
    id: "999",
    tipo: "I",
    status: "A",
    id_cliente: "2002",
    setor: "2",
    data_abertura: "2025-05-17 09:45:00"
  };
  
  try {
    // Teste 1: OS do tipo instalação (id_assunto: 1)
    const osInstalacao = { ...osBase, id_assunto: "1" };
    console.log("Testando agendamento para INSTALAÇÃO (id_assunto=1)...");
    const resultadoInstalacao = await gerarSugestoesDeAgendamento(osInstalacao, {
      mockDados: true,
      debug: false
    });
    
    // Teste 2: OS do tipo manutenção (id_assunto: 2)
    const osManutencao = { ...osBase, id_assunto: "2" };
    console.log("\nTestando agendamento para MANUTENÇÃO (id_assunto=2)...");
    const resultadoManutencao = await gerarSugestoesDeAgendamento(osManutencao, {
      mockDados: true,
      debug: false
    });
    
    // Resultados simplificados
    console.log("\n===== RESULTADOS DO TESTE =====");
    console.log(`INSTALAÇÃO: ${resultadoInstalacao.sugestao ? 'Tem sugestões' : 'SEM sugestões'}`);
    console.log(`MANUTENÇÃO: ${resultadoManutencao.sugestao ? 'Tem sugestões' : 'SEM sugestões'}`);
    
    // Verificação do comportamento
    console.log("\n===== CONCLUSÃO =====");
    if (!resultadoInstalacao.sugestao && resultadoManutencao.sugestao) {
      console.log("✅ COMPORTAMENTO CORRETO: O sistema está filtrando corretamente.");
      console.log("   - Instalações são filtradas quando limite_instalacao_atingido = true");
      console.log("   - Manutenções não são afetadas pelo limite de instalações");
    } else if (resultadoInstalacao.sugestao && resultadoManutencao.sugestao) {
      console.log("❌ COMPORTAMENTO INCORRETO: O filtro de Técnicos vinculados ao setor não está funcionando.");
    } else if (!resultadoInstalacao.sugestao && !resultadoManutencao.sugestao) {
      console.log("❌ COMPORTAMENTO INCORRETO: O filtro está sendo aplicado a todos os tipos.");
    } else {
      console.log("❓ COMPORTAMENTO INESPERADO: Instalações têm sugestões, mas manutenções não.");
    }
  } catch (error) {
    console.error('Erro ao testar o filtro por tipo de serviço:', error);
  }
}

// Executar o teste
testarFiltroTipoServico();
