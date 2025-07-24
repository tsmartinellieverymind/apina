/**
 * Teste da função verificarDisponibilidadeDataMock
 * 
 * Este script testa a função que verifica a disponibilidade de técnicos
 * para uma data e período específicos
 */

const dayjs = require('dayjs');
const { verificarDisponibilidadeDataMock, isDiaUtil } = require('./testeAgendamentoOsMock');

// Carregar os dados mockados
const mockOs = require('./app/data/mock_ordens_servico');
const mockOsAdicionais = require('./app/data/mock_ordens_servico_adicionais');

/**
 * Função principal de teste
 */
async function testarDisponibilidadeTecnicos() {
  console.log('==== TESTE DE VERIFICAÇÃO DE DISPONIBILIDADE DE TÉCNICOS ====');
  
  // Obter a OS selecionada (primeira por padrão)
  const osIndex = process.argv[2] ? parseInt(process.argv[2]) - 1 : 0;
  const dataDesejada = process.argv[3] || gerarDataFutura(1);
  const periodoDesejado = process.argv[4] || 'M';
  const slaHoras = process.argv[5] ? parseInt(process.argv[5]) : 72;
  
  if (!mockOs || !mockOs.registros || !mockOs.registros[osIndex]) {
    console.error(`❌ OS não encontrada no índice ${osIndex + 1}`);
    console.log('Uso: node testeDisponibilidadeTecnicos.js [indice_os] [data_YYYY-MM-DD] [periodo_M_ou_T] [sla_horas]');
    process.exit(1);
  }
  
  // Preparar os dados
  const os = mockOs.registros[osIndex];
  
  // Exibir informações da OS
  console.log(`OS ID: ${os.id}`);
  console.log(`Assunto: ${os.assunto}`);
  console.log(`Setor: ${os.setor}`);
  console.log(`Data desejada: ${formatarData(dataDesejada)}`);
  console.log(`Período desejado: ${periodoDesejado === 'M' ? 'Manhã' : 'Tarde'}`);
  console.log(`SLA: ${slaHoras} horas`);
  console.log('=================================================\n');
  
  try {
    // Verificar disponibilidade
    const resultado = await verificarDisponibilidadeDataMock(os, dataDesejada, periodoDesejado, null, slaHoras);
    
    // Exibir resultado
    console.log('\n\n==== RESULTADO DA VERIFICAÇÃO ====');
    console.log(`Disponível: ${resultado.disponivel ? 'SIM ✅' : 'NÃO ❌'}`);
    console.log(`Mensagem: ${resultado.mensagem}`);
    
    if (resultado.disponivel) {
      console.log(`Técnico disponível: ${resultado.tecnico}`);
    } else if (resultado.alternativas && resultado.alternativas.length > 0) {
      console.log('\n==== ALTERNATIVAS PRÓXIMAS ====');
      resultado.alternativas.forEach((alt, index) => {
        const dataFormatada = formatarData(alt.data);
        const periodoFormatado = alt.periodo === 'M' ? 'Manhã' : 'Tarde';
        const diasDiferenca = calcularDiferencaDias(dataDesejada, alt.data);
        console.log(`${index + 1}. Data: ${dataFormatada} - ${periodoFormatado} - Técnico: ${alt.id_tecnico} (${diasDiferenca} dias de diferença)`);
      });
    }
    
    console.log('\n✅ Teste concluído!');
  } catch (error) {
    console.error('❌ Erro durante o teste:', error);
  }
}

// Função para simular uma data futura (útil para testes)
function gerarDataFutura(diasAdicionais = 1) {
  let dataFutura = dayjs().add(diasAdicionais, 'day');
  
  // Garantir que seja um dia útil
  while (!isDiaUtil(dataFutura)) {
    dataFutura = dataFutura.add(1, 'day');
  }
  
  return dataFutura.format('YYYY-MM-DD');
}

// Função para formatar data YYYY-MM-DD para DD/MM/YYYY
function formatarData(data) {
  if (!data) return '';
  const partes = data.split('-');
  if (partes.length !== 3) return data;
  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

// Função para calcular diferença de dias entre duas datas
function calcularDiferencaDias(data1, data2) {
  const d1 = dayjs(data1);
  const d2 = dayjs(data2);
  return Math.abs(d2.diff(d1, 'day'));
}

// Se executado diretamente
if (require.main === module) {
  testarDisponibilidadeTecnicos();
}
