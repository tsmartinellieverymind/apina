/**
 * Teste dos limites expandidos de agendamento por setor
 * Testa os novos tipos: instalacao (múltiplas), misto (limite total)
 */

const fs = require('fs');
const path = require('path');
const dayjs = require('dayjs');

// Simular função de carregamento de limites
function carregarLimitesExpandidosMock() {
  try {
    const limitesPath = path.join(__dirname, '../app/data/limites_instalacao_por_setor.json');
    const conteudo = fs.readFileSync(limitesPath, 'utf8');
    return JSON.parse(conteudo);
  } catch (error) {
    console.error('Erro ao carregar limites:', error.message);
    return {};
  }
}

// Simular função de obtenção de limites por setor
function obterLimitesExpandidosMock(setor) {
  const limites = carregarLimitesExpandidosMock();
  const setorStr = String(setor);
  
  if (limites[setorStr]) {
    return limites[setorStr];
  }
  
  // Fallback para configuração padrão (manutenção)
  return {
    tipo: "manutencao",
    limite_instalacao_dia: 0,
    limite_manutencao: {
      M: 2,
      T: 3
    }
  };
}

// Simular função de verificação de disponibilidade expandida
function verificarDisponibilidadeExpandidaMock(setor, tecnicoId, data, periodo, ocupadosPorTecnico, tipoOS = 'manutencao') {
  const limitesSetor = obterLimitesExpandidosMock(setor);
  const dataStr = dayjs(data).format('YYYY-MM-DD');
  const ocupados = ocupadosPorTecnico[tecnicoId]?.[dataStr] || { M: 0, T: 0 };
  
  console.log(`[DEBUG] Verificando disponibilidade expandida:`);
  console.log(`  Setor: ${setor} (${limitesSetor.tipo})`);
  console.log(`  Técnico: ${tecnicoId}`);
  console.log(`  Data: ${dataStr}`);
  console.log(`  Período: ${periodo}`);
  console.log(`  Tipo OS: ${tipoOS}`);
  console.log(`  Ocupação atual:`, ocupados);
  
  if (limitesSetor.tipo === 'instalacao') {
    // Para instalação: máximo N instalações por dia
    const totalInstalacoesDia = ocupados.M + ocupados.T;
    const disponivel = totalInstalacoesDia < limitesSetor.limite_instalacao_dia;
    
    console.log(`  Limite instalação: ${limitesSetor.limite_instalacao_dia}/dia`);
    console.log(`  Total no dia: ${totalInstalacoesDia}`);
    console.log(`  Disponível: ${disponivel}`);
    
    return disponivel;
    
  } else if (limitesSetor.tipo === 'misto') {
    // Para setor misto: verificar limite total E limites específicos
    const totalAgendamentosDia = ocupados.M + ocupados.T;
    
    console.log(`  Limite total: ${limitesSetor.limite_total_dia}/dia`);
    console.log(`  Total atual no dia: ${totalAgendamentosDia}`);
    
    // Primeiro verificar se não ultrapassou limite total
    if (totalAgendamentosDia >= limitesSetor.limite_total_dia) {
      console.log(`  ❌ Limite total do dia atingido`);
      return false;
    }
    
    // Se for instalação, verificar limite específico de instalações
    if (tipoOS === 'instalacao') {
      const totalInstalacoesDia = ocupados.M + ocupados.T; // Assumindo que todas são instalações
      const disponivel = totalInstalacoesDia < limitesSetor.limite_instalacao_dia;
      console.log(`  Limite instalação: ${limitesSetor.limite_instalacao_dia}/dia`);
      console.log(`  Instalações no dia: ${totalInstalacoesDia}`);
      console.log(`  Disponível para instalação: ${disponivel}`);
      return disponivel;
    } else {
      // Se for manutenção, verificar limite por período
      const limitesPeriodo = limitesSetor.limite_manutencao;
      const disponivel = ocupados[periodo] < limitesPeriodo[periodo];
      console.log(`  Limite ${periodo}: ${limitesPeriodo[periodo]}`);
      console.log(`  Ocupado ${periodo}: ${ocupados[periodo]}`);
      console.log(`  Disponível para manutenção: ${disponivel}`);
      return disponivel;
    }
    
  } else {
    // Para manutenção: verificar limite por período
    const limitesPeriodo = limitesSetor.limite_manutencao;
    const disponivel = ocupados[periodo] < limitesPeriodo[periodo];
    
    console.log(`  Limite ${periodo}: ${limitesPeriodo[periodo]}`);
    console.log(`  Ocupado ${periodo}: ${ocupados[periodo]}`);
    console.log(`  Disponível: ${disponivel}`);
    
    return disponivel;
  }
}

async function testarLimitesExpandidos() {
  console.log('🧪 TESTE DE LIMITES EXPANDIDOS POR SETOR');
  console.log('=' .repeat(60));

  const dataTesteManha = dayjs().add(1, 'day').format('YYYY-MM-DD');

  // Teste 1: Setor com 5 instalações permitidas (setor 17)
  console.log('\n📋 TESTE 1: Setor 17 - 5 Instalações por Dia');
  console.log('-'.repeat(50));
  
  // Simular técnico com 3 instalações já agendadas
  const ocupados17 = {
    '1': {
      [dataTesteManha]: { M: 2, T: 1 } // 3 instalações no dia
    }
  };
  
  const disponivel17 = verificarDisponibilidadeExpandidaMock(
    '17', // setor com 5 instalações
    '1',  // técnico 1
    dataTesteManha,
    'M',  // manhã
    ocupados17,
    'instalacao'
  );
  
  console.log(`✅ Resultado: ${disponivel17 ? 'DISPONÍVEL' : 'INDISPONÍVEL'} (3/5 instalações)`);

  // Teste 2: Setor misto com limite total de 5 (setor 18)
  console.log('\n📋 TESTE 2: Setor 18 - Misto (5 total/dia)');
  console.log('-'.repeat(50));
  
  // Simular técnico com 3 agendamentos já feitos
  const ocupados18 = {
    '2': {
      [dataTesteManha]: { M: 2, T: 1 } // 3 agendamentos no dia
    }
  };
  
  const disponivelMisto = verificarDisponibilidadeExpandidaMock(
    '18', // setor misto (5 total)
    '2',  // técnico 2
    dataTesteManha,
    'T',  // tarde
    ocupados18,
    'manutencao'
  );
  
  console.log(`✅ Resultado: ${disponivelMisto ? 'DISPONÍVEL' : 'INDISPONÍVEL'} (3/5 total)`);

  // Teste 3: Setor misto com limite total atingido
  console.log('\n📋 TESTE 3: Setor 18 - Limite Total Atingido');
  console.log('-'.repeat(50));
  
  // Simular técnico com 5 agendamentos (limite atingido)
  const ocupados18Cheio = {
    '3': {
      [dataTesteManha]: { M: 3, T: 2 } // 5 agendamentos no dia (limite)
    }
  };
  
  const disponivelMistoCheio = verificarDisponibilidadeExpandidaMock(
    '18', // setor misto (5 total)
    '3',  // técnico 3
    dataTesteManha,
    'M',  // manhã
    ocupados18Cheio,
    'instalacao'
  );
  
  console.log(`✅ Resultado: ${disponivelMistoCheio ? 'DISPONÍVEL' : 'INDISPONÍVEL'} (5/5 total - CHEIO)`);

  // Teste 4: Setor misto com limite alto (setor 19)
  console.log('\n📋 TESTE 4: Setor 19 - Misto (8 total/dia)');
  console.log('-'.repeat(50));
  
  // Simular técnico com 6 agendamentos
  const ocupados19 = {
    '4': {
      [dataTesteManha]: { M: 3, T: 3 } // 6 agendamentos no dia
    }
  };
  
  const disponivel19 = verificarDisponibilidadeExpandidaMock(
    '19', // setor misto (8 total)
    '4',  // técnico 4
    dataTesteManha,
    'T',  // tarde
    ocupados19,
    'manutencao'
  );
  
  console.log(`✅ Resultado: ${disponivel19 ? 'DISPONÍVEL' : 'INDISPONÍVEL'} (6/8 total)`);

  // Teste 5: Mostrar todas as configurações
  console.log('\n📋 TESTE 5: Todas as Configurações Expandidas');
  console.log('-'.repeat(50));
  
  const setoresParaTestar = ['13', '14', '15', '16', '17', '18', '19'];
  setoresParaTestar.forEach(setor => {
    const config = obterLimitesExpandidosMock(setor);
    console.log(`✅ Setor ${setor} (${config.tipo}):`);
    if (config.tipo === 'misto') {
      console.log(`   Total/dia: ${config.limite_total_dia}`);
      console.log(`   Instalações/dia: ${config.limite_instalacao_dia}`);
      console.log(`   Manutenção: ${config.limite_manutencao.M}M/${config.limite_manutencao.T}T`);
    } else if (config.tipo === 'instalacao') {
      console.log(`   Instalações/dia: ${config.limite_instalacao_dia}`);
    } else {
      console.log(`   Manutenção: ${config.limite_manutencao.M}M/${config.limite_manutencao.T}T`);
    }
  });

  console.log('\n' + '='.repeat(60));
  console.log('🏁 TESTES EXPANDIDOS CONCLUÍDOS');
  
  // Resumo dos resultados
  console.log('\n📊 RESUMO DOS RESULTADOS:');
  console.log(`   Setor 17 (5 instalações): ${disponivel17 ? '✅ DISPONÍVEL' : '❌ INDISPONÍVEL'} (3/5)`);
  console.log(`   Setor 18 (5 total): ${disponivelMisto ? '✅ DISPONÍVEL' : '❌ INDISPONÍVEL'} (3/5)`);
  console.log(`   Setor 18 (limite cheio): ${disponivelMistoCheio ? '✅ DISPONÍVEL' : '❌ INDISPONÍVEL'} (5/5)`);
  console.log(`   Setor 19 (8 total): ${disponivel19 ? '✅ DISPONÍVEL' : '❌ INDISPONÍVEL'} (6/8)`);
}

// Executar testes
if (require.main === module) {
  testarLimitesExpandidos().catch(console.error);
}

module.exports = { 
  testarLimitesExpandidos,
  obterLimitesExpandidosMock,
  verificarDisponibilidadeExpandidaMock
};
