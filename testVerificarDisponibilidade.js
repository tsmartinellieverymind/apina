const { verificarDisponibilidade } = require('./services/ixcService');
const mockOS = require('./app/data/mock_ordens_servico').registros;
const mockOSTecnicosOcupados = require('./app/data/mock_ordens_servico_tecnico_ocupado');
const dayjs = require('dayjs');

// Função para formatar data para exibição amigável
function formatarData(dataString) {
  const data = dayjs(dataString);
  return data.format('DD/MM/YYYY');
}

// Função para descrever período
function descreverPeriodo(periodo) {
  return periodo === 'M' ? 'Manhã' : 'Tarde';
}

async function testarDisponibilidadeDeData() {
  console.log('\n======================================================');
  console.log('🔎 TESTE DE VERIFICAÇÃO DE DISPONIBILIDADE DE AGENDA');
  console.log('======================================================\n');

  // Pegar argumentos da linha de comando
  const args = process.argv.slice(2);
  
  // Data a ser verificada (argumento ou hoje+3 dias)
  let dataString = null;
  if (args.includes('--data')) {
    const dataIndex = args.indexOf('--data');
    if (dataIndex < args.length - 1) {
      dataString = args[dataIndex + 1];
    }
  }
  
  // Se não especificou data, usa hoje+3 dias
  if (!dataString) {
    dataString = dayjs().add(3, 'day').format('YYYY-MM-DD');
    console.log(`🗓️  Nenhuma data especificada. Usando data padrão: ${formatarData(dataString)}`);
  } else {
    console.log(`🗓️  Verificando data: ${formatarData(dataString)}`);
  }
  
  // Período a ser verificado (argumento ou ambos)
  let periodo = null;
  if (args.includes('--periodo')) {
    const periodoIndex = args.indexOf('--periodo');
    if (periodoIndex < args.length - 1) {
      periodo = args[periodoIndex + 1].toUpperCase();
    }
  }

  // Pegar a ordem de serviço de teste
  const osBase = mockOS[mockOS.length - 1];
  const osTeste = { ...osBase };
  
  // Executar as verificações
  try {
    // Suprimir logs temporariamente
    const originalConsoleLog = console.log;
    const originalConsoleError = console.error;
    
    if (!periodo || (periodo !== 'M' && periodo !== 'T')) {
      console.log('📋 Verificando disponibilidade para ambos os períodos...\n');
      
      // Suprimir logs
      console.log = function() {};
      console.error = function() {};
      
      // Verificar ambos os períodos
      const resultadoManha = await verificarDisponibilidade(osTeste, dataString, 'M', {
        mockDados: true,
        mockOrdensTecnicoOcupado: mockOSTecnicosOcupados
      });
      
      const resultadoTarde = await verificarDisponibilidade(osTeste, dataString, 'T', {
        mockDados: true,
        mockOrdensTecnicoOcupado: mockOSTecnicosOcupados
      });
      
      // Restaurar logs
      console.log = originalConsoleLog;
      console.error = originalConsoleError;
      
      // Mostrar resultados
      mostrarResultado(dataString, 'M', resultadoManha);
      mostrarResultado(dataString, 'T', resultadoTarde);
      
      // Mostrar resumo de disponibilidade
      mostrarResumoDisponibilidade(resultadoManha.opcoesPorData);
      
    } else {
      console.log(`📋 Verificando disponibilidade para período: ${descreverPeriodo(periodo)}\n`);
      
      // Suprimir logs
      console.log = function() {};
      console.error = function() {};
      
      // Verificar o período específico
      const resultado = await verificarDisponibilidade(osTeste, dataString, periodo, {
        mockDados: true,
        mockOrdensTecnicoOcupado: mockOSTecnicosOcupados
      });
      
      // Restaurar logs
      console.log = originalConsoleLog;
      console.error = originalConsoleError;
      
      // Mostrar resultado
      mostrarResultado(dataString, periodo, resultado);
      
      // Mostrar resumo de disponibilidade
      mostrarResumoDisponibilidade(resultado.opcoesPorData);
    }
  } catch (error) {
    console.error('❌ Erro ao verificar disponibilidade:', error);
  }
}

// Função para exibir o resultado de verificação de disponibilidade
function mostrarResultado(dataString, periodo, resultado) {
  const periodoDescricao = descreverPeriodo(periodo);
  
  if (!resultado.dentroDoRange) {
    console.log(`❌ A data ${formatarData(dataString)} está fora do período permitido para agendamento`);
    console.log(`   Período permitido: ${formatarData(resultado.dataMinima)} até ${formatarData(resultado.dataMaxima)}\n`);
  } else if (resultado.disponivel) {
    console.log(`✅ Data ${formatarData(dataString)}, ${periodoDescricao}: DISPONÍVEL para agendamento!`);
    // Identificar o técnico disponível
    const opcao = resultado.todasOpcoes.find(op => op.data === dataString && op.periodo === periodo);
    if (opcao) {
      console.log(`   Técnico disponível: ID ${opcao.id_tecnico} (Ocupação atual: ${opcao.ocupacao}/${opcao.limite})`);
      
      // Construir mensagem amigável em partes para evitar problemas de formatação
      console.log('   Mensagem amigável:');
      console.log(`   "Prontinho! Sua visita está agendada! Ficou para o dia ${formatarData(dataString)}`);
      console.log(`   no período da ${periodoDescricao.toLowerCase()}. Estou finalizando nosso atendimento.`);
      console.log(`   Caso precise de mim estou por aqui."`); 
      console.log();
    }
  } else {
    console.log(`❌ Data ${formatarData(dataString)}, ${periodoDescricao}: INDISPONÍVEL para agendamento`);
    if (resultado.periodosDisponiveis.length > 0) {
      console.log(`   Períodos disponíveis nesta data: ${resultado.periodosDisponiveis.map(p => descreverPeriodo(p)).join(', ')}\n`);
    }
  }
}

// Função para mostrar o resumo de disponibilidade
function mostrarResumoDisponibilidade(opcoesPorData) {
  console.log('📅 RESUMO DE DISPONIBILIDADE:');
  console.log('----------------------------');
  
  // Ordenar datas
  const datas = Object.keys(opcoesPorData).sort();
  
  datas.forEach(data => {
    const periodos = opcoesPorData[data];
    const disponibilidade = [];
    
    if (periodos.M) disponibilidade.push('Manhã');
    if (periodos.T) disponibilidade.push('Tarde');
    
    if (disponibilidade.length > 0) {
      console.log(`   ${formatarData(data)}: ${disponibilidade.join(', ')}`);
    } else {
      console.log(`   ${formatarData(data)}: Sem horários disponíveis`);
    }
  });
  
  console.log('----------------------------');
}

// Executar o teste
testarDisponibilidadeDeData();
