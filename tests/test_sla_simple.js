const dayjs = require('dayjs');

console.log('Teste simples de validação SLA');
console.log('Data atual:', dayjs().format('DD/MM/YYYY'));

const os = {
  id_assunto: 1,
  data_cadastro: '2025-01-01'
};

console.log('OS criada em:', os.data_cadastro);
console.log('Tentando agendar para hoje');

// Simular validação
const dataCriacao = dayjs(os.data_cadastro);
const hoje = dayjs();
const diasMax = 15;
const dataLimite = dataCriacao.add(diasMax, 'day');

console.log('Data limite SLA:', dataLimite.format('DD/MM/YYYY'));
console.log('Hoje está após o limite?', hoje.isAfter(dataLimite));

if (hoje.isAfter(dataLimite)) {
  console.log('ERRO: SLA ultrapassado');
} else {
  console.log('OK: Dentro do SLA');
}
