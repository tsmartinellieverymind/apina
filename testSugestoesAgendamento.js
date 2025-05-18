const { gerarSugestoesDeAgendamento } = require('./services/ixcService');
const mockOS = require('./app/data/mock_ordens_servico').registros;
const mockOSTecnicosOcupados = require('./app/data/mock_ordens_servico_tecnico_ocupado');
const dayjs = require('dayjs');

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

// Função para gerar uma data aleatória entre hoje e os próximos 10 dias
function gerarDataAleatoria() {
  const hoje = dayjs();
  const diasAleatorios = Math.floor(Math.random() * 10) + 1; // 1 a 10 dias
  return hoje.add(diasAleatorios, 'day');
}

// Função para gerar um período aleatório (M ou T)
function gerarPeriodoAleatorio() {
  return Math.random() < 0.5 ? 'M' : 'T';
}

// Função para verificar se uma data e período específicos estão disponíveis para agendamento
async function verificarDisponibilidade(dataString, periodo) {
  console.log(`\n========================= TESTE DE DISPONIBILIDADE =========================`);
  console.log(`🔍 Verificando disponibilidade para: ${dataString}, período: ${periodo}`);
  
  // Criar uma cópia da ordem de serviço de teste
  const osBase = mockOS[mockOS.length - 1];
  const osTeste = { ...osBase };
  
  try {
    // Desabilitar console.log temporariamente para suprimir logs do gerarSugestoesDeAgendamento
    const originalConsoleLog = console.log;
    console.log = function() {};
    
    // Obter sugestões de agendamento (sem gerar logs)
    const resultado = await gerarSugestoesDeAgendamento(osTeste, {
      mockDados: true,
      mockOrdensTecnicoOcupado: mockOSTecnicosOcupados,
      debug: false
    });
    
    // Restaurar console.log
    console.log = originalConsoleLog;
    
    // Extrair todas as opções disponíveis
    const todasOpcoes = [
      resultado.sugestao,
      ...resultado.alternativas
    ].filter(op => op);
    
    // Ordenar por data
    todasOpcoes.sort((a, b) => a.data.localeCompare(b.data));
    
    // Identificar range de datas disponíveis
    const dataMinima = todasOpcoes[0]?.data;
    const dataMaxima = todasOpcoes[todasOpcoes.length-1]?.data;
    console.log(`📅 Range de datas disponíveis: ${dataMinima} até ${dataMaxima}`);
    
    // Calcular as opções disponíveis por data
    const opcoesPorData = {};
    todasOpcoes.forEach(op => {
      if (!opcoesPorData[op.data]) {
        opcoesPorData[op.data] = { M: false, T: false };
      }
      opcoesPorData[op.data][op.periodo] = !op.limite_instalacao_atingido;
    });
    
    // Verificar se a data solicitada está disponível
    const dentroDoRange = dataMinima <= dataString && dataString <= dataMaxima;
    const dataTemOpcoes = opcoesPorData[dataString];
    const periodoDisponivel = dataTemOpcoes ? dataTemOpcoes[periodo] : false;
    
    // Exibir resultado da verificação
    if (!dentroDoRange) {
      console.log(`❌ [FORA DO RANGE] A data ${dataString} está fora do período permitido para agendamento`);
    } else if (!dataTemOpcoes) {
      console.log(`❌ [DATA BLOQUEADA] A data ${dataString} está dentro do range, mas não possui opções disponíveis`);
    } else if (!periodoDisponivel) {
      console.log(`❌ [PERÍODO INDISPONÍVEL] A data ${dataString} está disponível, mas o período ${periodo} não está disponível`);
      // Mostrar qual período está disponível
      const outrosPeriodos = Object.entries(dataTemOpcoes)
        .filter(([p, disponivel]) => disponivel)
        .map(([p]) => p);
      if (outrosPeriodos.length > 0) {
        console.log(`ℹ️ Períodos disponíveis para ${dataString}: ${outrosPeriodos.join(', ')}`);
      }
    } else {
      console.log(`✅ [DISPONÍVEL] A data ${dataString} período ${periodo} está disponível para agendamento!`);
    }
    
    // Listar todas as datas e períodos disponíveis
    console.log('\n📃 Resumo de disponibilidades:');
    Object.entries(opcoesPorData).forEach(([data, periodos]) => {
      const periodosDisponiveis = Object.entries(periodos)
        .filter(([_, disponivel]) => disponivel)
        .map(([p]) => p);
      if (periodosDisponiveis.length > 0) {
        console.log(`  ${data}: ${periodosDisponiveis.join(', ')}`);
      } else {
        console.log(`  ${data}: Sem horários disponíveis`);
      }
    });
    
    console.log(`\nTotal de opções disponíveis: ${todasOpcoes.length}`);
    console.log(`=====================================================================\n`);
    
    return { disponivel: periodoDisponivel, dentroDoRange, opcoesPorData };
  } catch (error) {
    console.error('Erro ao verificar disponibilidade:', error);
    return { disponivel: false, dentroDoRange: false, erro: error.message };
  }
}

// Função para testar uma data aleatória
async function testarDataAleatoria() {
  // Gerar data e período aleatórios
  const dataAleatoria = gerarDataAleatoria();
  const periodoAleatorio = gerarPeriodoAleatorio();
  const dataFormatada = dataAleatoria.format('YYYY-MM-DD');
  
  // Verificar disponibilidade
  return await verificarDisponibilidade(dataFormatada, periodoAleatorio);
}

// Função para testar uma data específica informada como argumento
async function testarDataEspecifica(dataString, periodo) {
  if (!dataString) {
    console.log('\nData não informada. Formato esperado: YYYY-MM-DD');
    return;
  }
  
  // Se não foi informado um período, testa ambos
  if (!periodo || (periodo !== 'M' && periodo !== 'T')) {
    console.log('Período não informado ou inválido. Testando ambos os períodos.');
    await verificarDisponibilidade(dataString, 'M');
    await verificarDisponibilidade(dataString, 'T');
  } else {
    await verificarDisponibilidade(dataString, periodo);
  }
}

// Processar argumentos da linha de comando
const args = process.argv.slice(2);

// Verificar quais testes executar com base nos argumentos
if (args.includes('--apenas-aleatorio')) {
  // Testar com data aleatória
  testarDataAleatoria();
} else if (args.includes('--data')) {
  // Encontrar a data especificada após o argumento --data
  const dataIndex = args.indexOf('--data');
  if (dataIndex < args.length - 1) {
    const dataEspecifica = args[dataIndex + 1];
    
    // Se foi informado o período após a data (--periodo M ou --periodo T)
    let periodo = null;
    if (args.includes('--periodo')) {
      const periodoIndex = args.indexOf('--periodo');
      if (periodoIndex < args.length - 1) {
        periodo = args[periodoIndex + 1].toUpperCase();
      }
    }
    
    testarDataEspecifica(dataEspecifica, periodo);
  } else {
    console.log('Data não informada após o argumento --data');
  }
} else {
  // Executar os testes padrão
  testarSugestoes();
  testarDataAleatoria();
}
