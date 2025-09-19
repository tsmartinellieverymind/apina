const dayjs = require('dayjs');
require('dayjs/locale/pt-br');
dayjs.locale('pt-br');

// Simular a data atual como 16/09/2025 (data dos logs)
const dataAtual = dayjs('2025-09-16');

console.log('=== TESTE DE INTERPRETAÇÃO DE DATA ===');
console.log(`Data atual simulada: ${dataAtual.format('DD/MM/YYYY')}`);

// Testar interpretação de "Dia 19"
const dia19 = dayjs('2025-09-19');
console.log(`\nTeste "Dia 19":`);
console.log(`- Data interpretada: ${dia19.format('DD/MM/YYYY')}`);
console.log(`- Dia da semana: ${dia19.format('dddd')}`);
console.log(`- Dia da semana (número): ${dia19.day()}`); // 0=domingo, 1=segunda, ..., 6=sábado

const dia20 = dayjs('2025-09-20');
console.log(`\nTeste "Dia 20":`);
console.log(`- Data interpretada: ${dia20.format('DD/MM/YYYY')}`);
console.log(`- Dia da semana: ${dia20.format('dddd')}`);
console.log(`- Dia da semana (número): ${dia20.day()}`);

// Verificar se há alguma confusão na função isDiaUtil
function isDiaUtil(data) {
  const diaSemana = data.day();
  return diaSemana !== 0 && diaSemana !== 6; // Não é domingo nem sábado
}

console.log(`\n=== TESTE isDiaUtil ===`);
console.log(`Dia 19 (${dia19.format('dddd')}) é dia útil: ${isDiaUtil(dia19)}`);
console.log(`Dia 20 (${dia20.format('dddd')}) é dia útil: ${isDiaUtil(dia20)}`);

// Simular o que pode estar acontecendo na geração de sugestões
console.log(`\n=== SIMULAÇÃO DE SUGESTÕES ===`);
let dataParaSugestao = dia19;

// Se dia 19 não for útil, procurar próximo dia útil
if (!isDiaUtil(dataParaSugestao)) {
  console.log(`Dia 19 não é útil, procurando próximo dia útil...`);
  while (!isDiaUtil(dataParaSugestao)) {
    dataParaSugestao = dataParaSugestao.add(1, 'day');
    console.log(`Testando: ${dataParaSugestao.format('DD/MM/YYYY')} (${dataParaSugestao.format('dddd')})`);
  }
} else {
  console.log(`Dia 19 é útil, usando como sugestão.`);
}

console.log(`\nSugestão final: ${dataParaSugestao.format('DD/MM/YYYY')} (${dataParaSugestao.format('dddd')})`);
