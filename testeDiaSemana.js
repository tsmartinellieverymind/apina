const dayjs = require('dayjs');
const { diaDaSemanaExtenso } = require('./app/utils/dateHelpers');

// Data a ser testada
const dataParaTestar = '2025-06-23';

// Verificar usando dayjs diretamente
console.log('Data:', dataParaTestar);
console.log('Dia da semana (número):', dayjs(dataParaTestar).day());
console.log('Dia da semana (nome em inglês):', dayjs(dataParaTestar).format('dddd'));

// Verificar usando nossa função diaDaSemanaExtenso
console.log('Dia da semana (nome em português):', diaDaSemanaExtenso(dataParaTestar));

// Verificar data atual para referência
console.log('\nData atual:', dayjs().format('YYYY-MM-DD'));
console.log('Dia da semana atual (nome em português):', diaDaSemanaExtenso(dayjs()));
