const dayjs = require('dayjs');

console.log('=== TESTE SIMPLES - VALIDAÇÃO HOJE ===');
console.log('Data/hora atual:', dayjs().format('DD/MM/YYYY HH:mm:ss'));

// Teste básico
const hoje = dayjs();
const dataHoje = dayjs().format('YYYY-MM-DD');
const dataAmanha = dayjs().add(1, 'day').format('YYYY-MM-DD');

console.log('\nComparação de datas:');
console.log('Hoje (objeto):', hoje.format('DD/MM/YYYY'));
console.log('Data hoje (string):', dataHoje);
console.log('Data amanhã (string):', dataAmanha);

// Testar a comparação isSame
const dataObjHoje = dayjs(dataHoje);
const dataObjAmanha = dayjs(dataAmanha);

console.log('\nTeste isSame:');
console.log('dataObjHoje.isSame(hoje, "day"):', dataObjHoje.isSame(hoje, 'day'));
console.log('dataObjAmanha.isSame(hoje, "day"):', dataObjAmanha.isSame(hoje, 'day'));

// Simular a validação
function testarValidacaoHoje(dataString) {
  const dataObj = dayjs(dataString);
  const hoje = dayjs();
  
  if (dataObj.isSame(hoje, 'day')) {
    return { bloqueado: true, motivo: 'Não é possível agendar para o dia atual' };
  }
  
  return { bloqueado: false, motivo: 'Data permitida' };
}

console.log('\nTeste da validação:');
console.log('Hoje:', testarValidacaoHoje(dataHoje));
console.log('Amanhã:', testarValidacaoHoje(dataAmanha));
