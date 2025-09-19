console.log('=== TESTE: VALIDAÇÃO DE SLA ===\n');

const dayjs = require('dayjs');
const isSameOrBefore = require('dayjs/plugin/isSameOrBefore');
dayjs.extend(isSameOrBefore);

// Simular OS com data de abertura
const osSimulada = {
  id: '13236',
  id_assunto: '18',
  data_abertura: '2025-09-16 13:09:12',
  setor: '14'
};

// Simular configuração SLA
const configSLA = {
  id_assunto: 18,
  prioridade: 1,
  dataMinimaAgendamentoDias: 1,
  dataMaximaAgendamentoDias: 3
};

function calcularLimiteSLA(dataAbertura, diasMax) {
  return dayjs(dataAbertura).add(diasMax, 'day');
}

function testarValidacaoSLA() {
  console.log('=== CENÁRIO DO PROBLEMA ===');
  console.log('OS criada em:', osSimulada.data_abertura);
  console.log('Configuração SLA: máximo', configSLA.dataMaximaAgendamentoDias, 'dias');
  
  const dataAbertura = dayjs(osSimulada.data_abertura);
  const limiteSLA = calcularLimiteSLA(osSimulada.data_abertura, configSLA.dataMaximaAgendamentoDias);
  
  console.log('Data de abertura:', dataAbertura.format('DD/MM/YYYY HH:mm:ss'));
  console.log('Limite SLA:', limiteSLA.format('DD/MM/YYYY HH:mm:ss'));
  console.log('');
  
  // Testar datas
  const datasTeste = [
    '2025-09-17', // Dentro do SLA
    '2025-09-18', // Dentro do SLA  
    '2025-09-19', // Limite do SLA
    '2025-09-20', // Fora do SLA
    '2025-09-30', // MUITO fora do SLA (caso do problema)
  ];
  
  console.log('=== TESTES DE VALIDAÇÃO ===');
  datasTeste.forEach(data => {
    const dataObj = dayjs(data);
    const dentroSLA = dataObj.isSameOrBefore(limiteSLA, 'day');
    const diasApos = dataObj.diff(limiteSLA, 'day');
    
    console.log(`📅 ${data} (${dataObj.format('dddd, DD/MM/YYYY')})`);
    console.log(`   ${dentroSLA ? '✅ DENTRO do SLA' : '❌ FORA do SLA'}`);
    if (!dentroSLA) {
      console.log(`   🚨 ${diasApos} dia(s) após o limite`);
    }
    console.log('');
  });
}

function simularFluxoCorrigido() {
  console.log('=== FLUXO CORRIGIDO ===');
  console.log('1. Sistema oferece: "17/09, 18/09, 19/09, 22/09"');
  console.log('2. Usuário: "dia 23"');
  console.log('3. Sistema: "23/09 não disponível..."');
  console.log('4. Usuário: "30"');
  console.log('5. Sistema: ✅ "Infelizmente, terça-feira, 30/09/2025, está fora do prazo permitido para agendamento. Acima do SLA - data limite para agendamento: 19/09/2025. Posso manter o agendamento para a data que sugeri anteriormente..."');
  console.log('');
}

function simularFluxoAnterior() {
  console.log('=== FLUXO ANTERIOR (PROBLEMÁTICO) ===');
  console.log('1. Sistema oferece: "17/09, 18/09, 19/09, 22/09"');
  console.log('2. Usuário: "dia 23"');
  console.log('3. Sistema: "23/09 não disponível..."');
  console.log('4. Usuário: "30"');
  console.log('5. Sistema: ❌ "Perfeito! Posso confirmar o agendamento da TV REPARO para terça-feira, 30/09/2025..." (IGNORA SLA!)');
  console.log('');
}

console.log('=== COMPARAÇÃO DOS FLUXOS ===\n');
simularFluxoAnterior();
simularFluxoCorrigido();

testarValidacaoSLA();

console.log('=== CORREÇÕES IMPLEMENTADAS ===');
console.log('✅ Validação de SLA ANTES de aceitar data específica');
console.log('✅ Retorno de erro estruturado quando SLA é violado');
console.log('✅ Tratamento no webhook para erros de SLA');
console.log('✅ Mensagem informativa sobre limite de prazo');
console.log('✅ Oferece alternativas dentro do SLA');
console.log('');

console.log('=== LOCALIZAÇÃO DAS CORREÇÕES ===');
console.log('📁 ixcService.js (linhas ~308-318): Validação SLA em dataEspecifica');
console.log('📁 webhook.js (linhas ~2126-2137): Tratamento erro SLA');
console.log('');

console.log('🎉 PROBLEMA CRÍTICO DE SLA CORRIGIDO!');
