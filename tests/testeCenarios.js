/**
 * Teste de cenários de disponibilidade
 * 
 * Este script testa dois cenários:
 * 1. Um dia com disponibilidade para agendamento
 * 2. Um dia sem disponibilidade para agendamento
 */

const dayjs = require('dayjs');
const { verificarDisponibilidadeDataMock } = require('./testeAgendamentoOsMock');
const { formatarData } = require('./services/ixcUtilsData');
const { getConfiguracoesAgendamentoOS } = require('./services/ixcConfigAgendamento');

// Carregar os dados mockados
const mockOs = require('./app/data/mock_ordens_servico');
const mockOsAdicionais = require('./app/data/mock_ordens_servico_adicionais');

/**
 * Função principal de teste
 */
async function testarCenarios() {
  console.log('==== TESTE DE CENÁRIOS DE DISPONIBILIDADE ====');
  
  // Obter a OS selecionada (primeira por padrão)
  const osIndex = process.argv[2] ? parseInt(process.argv[2]) - 1 : 0;
  
  if (!mockOs || !mockOs.registros || !mockOs.registros[osIndex]) {
    console.error(`❌ OS não encontrada no índice ${osIndex + 1}`);
    console.log('Uso: node testeCenarios.js [indice_os]');
    process.exit(1);
  }
  
  // Preparar os dados
  const os = mockOs.registros[osIndex];
  
  // Exibir informações da OS
  console.log(`OS ID: ${os.id}`);
  console.log(`Assunto: ${os.mensagem}`);
  console.log(`Setor: ${os.setor}`);
  console.log('=================================================\n');
  
  // Obter configurações de agendamento baseadas no assunto da OS
  const configOS = getConfiguracoesAgendamentoOS(os);
  console.log('\nConfigurações de agendamento para o assunto:', configOS);
  
  // Cenário 1: Dia com disponibilidade (07/05/2025)
  await testarCenario(os, '2025-05-07', 'M', 'Cenário 1: Dia com disponibilidade');
  
  // Cenário 2: Dia sem disponibilidade (08/05/2025)
  await testarCenario(os, '2025-05-08', 'M', 'Cenário 2: Dia sem disponibilidade');
}

/**
 * Função para testar um cenário específico
 */
async function testarCenario(os, data, periodo, titulo) {
  console.log(`\n==== ${titulo} ====`);
  console.log(`Data: ${formatarData(data)}`);
  console.log(`Período: ${periodo === 'M' ? 'Manhã' : 'Tarde'}`);
  
  try {
    // Verificar disponibilidade usando as configurações do assunto da OS
    const resultado = await verificarDisponibilidadeDataMock(os, data, periodo);
    
    // Exibir resultado
    console.log('\n==== RESULTADO DA VERIFICAÇÃO ====');
    console.log(`Disponível: ${resultado.disponivel ? 'SIM ✅' : 'NÃO ❌'}`);
    console.log(`Mensagem: ${resultado.mensagem}`);
    
    if (resultado.disponivel) {
      console.log(`Técnico disponível: ${resultado.tecnico}`);
    } else if (resultado.alternativas && resultado.alternativas.length > 0) {
      console.log('\n==== ALTERNATIVAS PRÓXIMAS ====');
      resultado.alternativas.forEach((alt, index) => {
        const dataFormatada = formatarData(alt.data);
        const periodoFormatado = alt.periodo === 'M' ? 'Manhã' : 'Tarde';
        const diasDiferenca = calcularDiferencaDias(data, alt.data);
        console.log(`${index + 1}. Data: ${dataFormatada} - ${periodoFormatado} - Técnico: ${alt.id_tecnico} (${diasDiferenca} dias de diferença)`);
      });
    }
    
    console.log('\n✅ Teste concluído!');
  } catch (error) {
    console.error('❌ Erro durante o teste:', error);
  }
}

// Função para calcular diferença de dias entre duas datas

// Função para calcular diferença de dias entre duas datas
function calcularDiferencaDias(data1, data2) {
  const d1 = dayjs(data1);
  const d2 = dayjs(data2);
  return Math.abs(d2.diff(d1, 'day'));
}

// Se executado diretamente
if (require.main === module) {
  testarCenarios();
}
