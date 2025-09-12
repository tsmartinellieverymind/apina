/**
 * Teste dos limites de agendamento por setor usando dados mockados
 * Simula a lógica sem fazer chamadas reais para API
 */

const mockOSData = require('../app/mocks/mock_ordens_servico_tecnico_ocupado');
const dayjs = require('dayjs');
const fs = require('fs');
const path = require('path');

// Simular função de carregamento de limites
function carregarLimitesInstalacaoMock() {
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
function obterLimitesAgendamentoPorSetorMock(setor) {
  const limites = carregarLimitesInstalacaoMock();
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

// Simular função de verificação de ocupação por técnico
function calcularOcupacaoPorTecnicoMock(osAgendadas) {
  const ocupadosPorTecnico = {};
  
  osAgendadas.forEach(os => {
    const idTecnico = os.id_tecnico;
    const dataAgenda = dayjs(os.data_agenda_final || os.data_agenda);
    const dataStr = dataAgenda.format('YYYY-MM-DD');
    const periodo = os.melhor_horario_agenda || 'M'; // M ou T
    
    if (!ocupadosPorTecnico[idTecnico]) {
      ocupadosPorTecnico[idTecnico] = {};
    }
    
    if (!ocupadosPorTecnico[idTecnico][dataStr]) {
      ocupadosPorTecnico[idTecnico][dataStr] = { M: 0, T: 0 };
    }
    
    ocupadosPorTecnico[idTecnico][dataStr][periodo]++;
  });
  
  return ocupadosPorTecnico;
}

// Simular função de verificação de disponibilidade com limites por setor
function verificarDisponibilidadeComLimitesMock(setor, tecnicoId, data, periodo, ocupadosPorTecnico) {
  const limitesSetor = obterLimitesAgendamentoPorSetorMock(setor);
  const dataStr = dayjs(data).format('YYYY-MM-DD');
  const ocupados = ocupadosPorTecnico[tecnicoId]?.[dataStr] || { M: 0, T: 0 };
  
  console.log(`[DEBUG] Verificando disponibilidade:`);
  console.log(`  Setor: ${setor} (${limitesSetor.tipo})`);
  console.log(`  Técnico: ${tecnicoId}`);
  console.log(`  Data: ${dataStr}`);
  console.log(`  Período: ${periodo}`);
  console.log(`  Ocupação atual:`, ocupados);
  
  if (limitesSetor.tipo === 'instalacao') {
    // Para instalação: máximo 1 por dia (qualquer período)
    const totalInstalacoesDia = ocupados.M + ocupados.T;
    const disponivel = totalInstalacoesDia < limitesSetor.limite_instalacao_dia;
    
    console.log(`  Limite instalação: ${limitesSetor.limite_instalacao_dia}/dia`);
    console.log(`  Total no dia: ${totalInstalacoesDia}`);
    console.log(`  Disponível: ${disponivel}`);
    
    return disponivel;
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

async function testarLimitesSetorComMock() {
  console.log('🧪 TESTE COM DADOS MOCKADOS - LIMITES POR SETOR');
  console.log('=' .repeat(60));

  // Carregar dados mockados
  const osAgendadas = mockOSData.registros;
  console.log(`📊 Total de OSs mockadas: ${osAgendadas.length}`);
  
  // Calcular ocupação atual dos técnicos
  const ocupadosPorTecnico = calcularOcupacaoPorTecnicoMock(osAgendadas);
  console.log('📊 Ocupação por técnico:', JSON.stringify(ocupadosPorTecnico, null, 2));

  // Teste 1: Verificar disponibilidade para instalação (setor 14)
  console.log('\n📋 TESTE 1: Disponibilidade para Instalação (Setor 14)');
  console.log('-'.repeat(50));
  
  const dataTesteManha = dayjs().add(1, 'day').format('YYYY-MM-DD');
  const disponibilidadeInstalacaoManha = verificarDisponibilidadeComLimitesMock(
    '14', // setor instalação
    '1',  // técnico 1
    dataTesteManha,
    'M',  // manhã
    ocupadosPorTecnico
  );
  
  console.log(`✅ Resultado: ${disponibilidadeInstalacaoManha ? 'DISPONÍVEL' : 'INDISPONÍVEL'}`);

  // Teste 2: Verificar disponibilidade para manutenção (setor 13)
  console.log('\n📋 TESTE 2: Disponibilidade para Manutenção (Setor 13)');
  console.log('-'.repeat(50));
  
  const disponibilidadeManutencaoTarde = verificarDisponibilidadeComLimitesMock(
    '13', // setor manutenção
    '2',  // técnico 2
    dataTesteManha,
    'T',  // tarde
    ocupadosPorTecnico
  );
  
  console.log(`✅ Resultado: ${disponibilidadeManutencaoTarde ? 'DISPONÍVEL' : 'INDISPONÍVEL'}`);

  // Teste 3: Simular cenário de limite atingido
  console.log('\n📋 TESTE 3: Cenário com Limite Atingido');
  console.log('-'.repeat(50));
  
  // Simular técnico com 1 instalação já agendada
  const ocupadosSimulados = {
    '1': {
      [dataTesteManha]: { M: 1, T: 0 } // 1 instalação na manhã
    }
  };
  
  const disponibilidadeComLimite = verificarDisponibilidadeComLimitesMock(
    '14', // setor instalação
    '1',  // técnico 1
    dataTesteManha,
    'T',  // tarde
    ocupadosSimulados
  );
  
  console.log(`✅ Resultado: ${disponibilidadeComLimite ? 'DISPONÍVEL' : 'INDISPONÍVEL'}`);

  // Teste 4: Verificar configurações carregadas
  console.log('\n📋 TESTE 4: Configurações por Setor');
  console.log('-'.repeat(50));
  
  const setoresParaTestar = ['13', '14', '15', '16', '999'];
  setoresParaTestar.forEach(setor => {
    const config = obterLimitesAgendamentoPorSetorMock(setor);
    console.log(`✅ Setor ${setor}:`, {
      tipo: config.tipo,
      limite_instalacao_dia: config.limite_instalacao_dia,
      limite_manutencao: config.limite_manutencao
    });
  });

  console.log('\n' + '='.repeat(60));
  console.log('🏁 TESTES COM MOCK CONCLUÍDOS');
  
  // Resumo dos resultados
  console.log('\n📊 RESUMO DOS RESULTADOS:');
  console.log(`   Instalação (setor 14) manhã: ${disponibilidadeInstalacaoManha ? '✅ DISPONÍVEL' : '❌ INDISPONÍVEL'}`);
  console.log(`   Manutenção (setor 13) tarde: ${disponibilidadeManutencaoTarde ? '✅ DISPONÍVEL' : '❌ INDISPONÍVEL'}`);
  console.log(`   Instalação com limite atingido: ${disponibilidadeComLimite ? '✅ DISPONÍVEL' : '❌ INDISPONÍVEL'}`);
}

// Executar testes
if (require.main === module) {
  testarLimitesSetorComMock().catch(console.error);
}

module.exports = { 
  testarLimitesSetorComMock,
  obterLimitesAgendamentoPorSetorMock,
  verificarDisponibilidadeComLimitesMock
};
