// Test file to compare findSetorByBairro and buscarSetorPorBairro functions
require('dotenv').config();

// Importar as funções diretamente do arquivo ixcService.js
const ixcService = require('../services/ixcService');

// Verificar se as funções estão disponíveis
console.log('Funções disponíveis no ixcService:', Object.keys(ixcService));

// Obter referências às funções
const findSetorByBairro = ixcService.findSetorByBairro;

// Verificar se as funções foram encontradas
console.log('findSetorByBairro encontrada:', typeof findSetorByBairro === 'function');

// Função para testar apenas findSetorByBairro
async function testarSetorPorBairro(bairro, tipoServico = 'instalação') {
  console.log(`\n====== Testando bairro: "${bairro}" (${tipoServico}) ======`);
  const resultado = await findSetorByBairro(bairro, tipoServico);
  console.log(`\nResultado para "${bairro}": ${JSON.stringify(resultado)}`);
  return { bairro, resultado };
}


// Lista de bairros para testar
const bairrosParaTestar = [
  'Vila Mima'
  // Adicione mais bairros conforme necessário
];

// Função principal para executar os testes
async function executarTestes() {
  console.log('Iniciando testes de findSetorByBairro...\n');
  const resultados = [];
  for (const bairro of bairrosParaTestar) {
    const resultado = await testarSetorPorBairro(bairro);
    resultados.push(resultado);
  }
  // Resumo final
  console.log('\n====== RESUMO DOS TESTES ======');
  console.log(`Total de testes: ${resultados.length}`);
  resultados.forEach(r => {
    console.log(`- ${r.bairro}: ${r.resultado || 'Não encontrado'}`);
  });
  console.log('\nTestes concluídos!');
}

// Executar os testes
executarTestes()
  .then(() => {
    console.log('Programa finalizado com sucesso.');
    process.exit(0);
  })
  .catch(error => {
    console.error('Erro ao executar os testes:', error);
    process.exit(1);
  });
