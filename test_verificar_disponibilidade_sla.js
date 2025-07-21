// Teste da função verificarDisponibilidadeData com validação SLA
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
const customParseFormat = require('dayjs/plugin/customParseFormat');

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(customParseFormat);

// Importar as configurações
const configuracoesAgendamento = require('./app/data/configuracoes_agendamentos');

// Simular a função isDiaUtil
function isDiaUtil(dataObj) {
  const diaSemana = dataObj.day();
  return diaSemana >= 1 && diaSemana <= 5;
}

// Simular a função validarSLA (já implementada no ixcService.js)
function validarSLA(os, dataObj) {
  const idAssunto = os.id_assunto;
  const config = configuracoesAgendamento.find(c => c.id_assunto == idAssunto);
  
  if (config) {
    const diasMax = config.dataMaximaAgendamentoDias;
    
    const dataCriacao = os.data_cadastro || os.data_abertura || os.data_criacao || os.data_inicio;
    
    if (dataCriacao) {
      const dataCriacaoObj = dayjs(dataCriacao);
      if (dataCriacaoObj.isValid()) {
        const dataLimiteSLA = dataCriacaoObj.add(diasMax, 'day');
        
        const hoje = dayjs();
        if (hoje.isAfter(dataLimiteSLA)) {
          return { 
            disponivel: false, 
            motivo: 'Acima do SLA - prazo máximo para agendamento já foi ultrapassado' 
          };
        }
        
        if (dataObj.isAfter(dataLimiteSLA)) {
          return { 
            disponivel: false, 
            motivo: `Acima do SLA - data limite para agendamento: ${dataLimiteSLA.format('DD/MM/YYYY')}` 
          };
        }
      }
    }
  }
  
  return null;
}

// Teste
async function testarValidacaoSLA() {
  console.log('=== TESTE VALIDAÇÃO SLA ===');
  
  // OS criada há 5 dias
  const os = {
    id: 12345,
    id_assunto: 1, // Assumindo que existe na configuração
    data_cadastro: dayjs().subtract(5, 'day').format('YYYY-MM-DD'),
    titulo: 'Teste de OS para validação SLA'
  };
  
  console.log('OS:', os);
  console.log('Configurações disponíveis:', configuracoesAgendamento.map(c => ({id_assunto: c.id_assunto, diasMax: c.dataMaximaAgendamentoDias})));
  
  // Teste 1: Data dentro do SLA
  const dataOk = dayjs().add(3, 'day');
  console.log('\nTeste 1 - Data dentro do SLA:');
  console.log('Data solicitada:', dataOk.format('DD/MM/YYYY'));
  
  const erroSLA1 = validarSLA(os, dataOk);
  if (erroSLA1) {
    console.log('ERRO SLA:', erroSLA1);
  } else {
    console.log('SLA OK - pode prosseguir com agendamento');
  }
  
  // Teste 2: Data fora do SLA
  const dataForaDoSLA = dayjs().add(30, 'day');
  console.log('\nTeste 2 - Data fora do SLA:');
  console.log('Data solicitada:', dataForaDoSLA.format('DD/MM/YYYY'));
  
  const erroSLA2 = validarSLA(os, dataForaDoSLA);
  if (erroSLA2) {
    console.log('ERRO SLA:', erroSLA2);
  } else {
    console.log('SLA OK - pode prosseguir com agendamento');
  }
  
  // Teste 3: OS muito antiga (SLA já vencido)
  const osAntiga = {
    ...os,
    data_cadastro: dayjs().subtract(30, 'day').format('YYYY-MM-DD')
  };
  
  console.log('\nTeste 3 - OS antiga (SLA vencido):');
  console.log('OS criada em:', osAntiga.data_cadastro);
  
  const erroSLA3 = validarSLA(osAntiga, dayjs().add(1, 'day'));
  if (erroSLA3) {
    console.log('ERRO SLA:', erroSLA3);
  } else {
    console.log('SLA OK - pode prosseguir com agendamento');
  }
}

testarValidacaoSLA().catch(console.error);
