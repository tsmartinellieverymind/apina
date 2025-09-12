/**
 * Teste dos limites de agendamento por setor
 * Valida se a lógica de instalação (1 por dia) vs manutenção (2M/3T) funciona corretamente
 */

const { gerarSugestoesDeAgendamento, verificarDisponibilidadeData } = require('../services/ixcService');
const dayjs = require('dayjs');

async function testarLimitesSetor() {
  console.log('🧪 INICIANDO TESTES DE LIMITES POR SETOR');
  console.log('=' .repeat(60));

  // Teste 1: OS de Instalação (setor 14)
  console.log('\n📋 TESTE 1: OS de Instalação (Setor 14)');
  console.log('-'.repeat(40));
  
  const osInstalacao = {
    id: '12345',
    id_setor: '14', // Setor de instalação
    id_assunto: 16,
    data_cadastro: '2025-01-10 10:00:00'
  };

  try {
    const sugestoesInstalacao = await gerarSugestoesDeAgendamento(osInstalacao);
    console.log('✅ Sugestões para INSTALAÇÃO geradas:');
    console.log('   Sugestão principal:', sugestoesInstalacao.sugestao);
    console.log('   Alternativas:', sugestoesInstalacao.alternativas?.length || 0);
  } catch (error) {
    console.log('❌ Erro ao gerar sugestões de instalação:', error.message);
  }

  // Teste 2: OS de Manutenção (setor 13)  
  console.log('\n📋 TESTE 2: OS de Manutenção (Setor 13)');
  console.log('-'.repeat(40));
  
  const osManutencao = {
    id: '12346',
    id_setor: '13', // Setor de manutenção
    id_assunto: 19,
    data_cadastro: '2025-01-10 10:00:00'
  };

  try {
    const sugestoesManutencao = await gerarSugestoesDeAgendamento(osManutencao);
    console.log('✅ Sugestões para MANUTENÇÃO geradas:');
    console.log('   Sugestão principal:', sugestoesManutencao.sugestao);
    console.log('   Alternativas:', sugestoesManutencao.alternativas?.length || 0);
  } catch (error) {
    console.log('❌ Erro ao gerar sugestões de manutenção:', error.message);
  }

  // Teste 3: Verificar disponibilidade específica
  console.log('\n📋 TESTE 3: Verificação de Disponibilidade');
  console.log('-'.repeat(40));
  
  const amanha = dayjs().add(1, 'day').format('YYYY-MM-DD');
  
  try {
    const dispInstalacao = await verificarDisponibilidadeData(osInstalacao, {
      data: amanha,
      periodo: 'M'
    });
    console.log('✅ Disponibilidade INSTALAÇÃO (manhã):', dispInstalacao);

    const dispManutencao = await verificarDisponibilidadeData(osManutencao, {
      data: amanha, 
      periodo: 'T'
    });
    console.log('✅ Disponibilidade MANUTENÇÃO (tarde):', dispManutencao);
    
  } catch (error) {
    console.log('❌ Erro ao verificar disponibilidade:', error.message);
  }

  // Teste 4: OS com setor não configurado (fallback)
  console.log('\n📋 TESTE 4: OS com Setor Não Configurado');
  console.log('-'.repeat(40));
  
  const osDesconhecida = {
    id: '12347',
    id_setor: '999', // Setor não configurado
    id_assunto: 1,
    data_cadastro: '2025-01-10 10:00:00'
  };

  try {
    const sugestoesFallback = await gerarSugestoesDeAgendamento(osDesconhecida);
    console.log('✅ Sugestões para setor DESCONHECIDO (fallback):');
    console.log('   Sugestão principal:', sugestoesFallback.sugestao);
    console.log('   Alternativas:', sugestoesFallback.alternativas?.length || 0);
  } catch (error) {
    console.log('❌ Erro ao gerar sugestões fallback:', error.message);
  }

  console.log('\n' + '='.repeat(60));
  console.log('🏁 TESTES CONCLUÍDOS');
}

// Executar testes
if (require.main === module) {
  testarLimitesSetor().catch(console.error);
}

module.exports = { testarLimitesSetor };
