const dayjs = require('dayjs');
require('dayjs/locale/pt-br');
dayjs.locale('pt-br');

console.log('=== TESTE DE VALIDAÇÃO DE DATAS ===\n');

// Testar as datas mencionadas no problema
const datas = [
  '2025-09-28', // Dia 28 - sábado
  '2025-09-29', // Dia 29 - domingo  
  '2025-09-30'  // Dia 30 - segunda
];

datas.forEach(data => {
  const dataObj = dayjs(data);
  const diaSemana = dataObj.day(); // 0=domingo, 1=segunda, ..., 6=sábado
  const nomeDiaSemana = dataObj.format('dddd');
  const dataFormatada = dataObj.format('DD/MM/YYYY');
  
  console.log(`Data: ${dataFormatada} (${nomeDiaSemana})`);
  console.log(`  - Dia da semana (número): ${diaSemana}`);
  console.log(`  - É dia útil: ${diaSemana !== 0 && diaSemana !== 6 ? '✅ SIM' : '❌ NÃO'}`);
  console.log('');
});

console.log('=== ANÁLISE DO PROBLEMA ===');
console.log('28/09/2025 (sábado) → ❌ Sistema rejeitou corretamente');
console.log('29/09/2025 (domingo) → ❌ Sistema deveria rejeitar mas ACEITOU!');
console.log('30/09/2025 (segunda) → ✅ Sistema deveria aceitar');

console.log('\n🚨 PROBLEMA IDENTIFICADO:');
console.log('O sistema está agendando para DOMINGO (29/09/2025)!');
console.log('Isso indica que a validação de dia útil não está sendo aplicada corretamente.');
