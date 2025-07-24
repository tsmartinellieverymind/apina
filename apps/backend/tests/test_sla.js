const dayjs = require('dayjs');

// Simular a função validarSLA
const configuracoesAgendamento = [
  {
    id_assunto: 1,
    dataMaximaAgendamentoDias: 15
  }
];

function validarSLA(os, dataObj) {
  const idAssunto = os.id_assunto;
  const config = configuracoesAgendamento.find(c => c.id_assunto == idAssunto);
  
  if (config) {
    const diasMax = config.dataMaximaAgendamentoDias;
    
    // Buscar data de criação/abertura da OS (campos comuns no IXC)
    const dataCriacao = os.data_cadastro || os.data_abertura || os.data_criacao || os.data_inicio;
    
    if (dataCriacao) {
      const dataCriacaoObj = dayjs(dataCriacao);
      if (dataCriacaoObj.isValid()) {
        // Calcular data limite do SLA (data de criação + diasMax)
        const dataLimiteSLA = dataCriacaoObj.add(diasMax, 'day');
        
        // Se hoje já passou do SLA, retornar erro
        const hoje = dayjs();
        if (hoje.isAfter(dataLimiteSLA)) {
          return { 
            disponivel: false, 
            motivo: 'Acima do SLA - prazo máximo para agendamento já foi ultrapassado' 
          };
        }
        
        // Se a data solicitada for maior que o limite do SLA, retornar erro
        if (dataObj.isAfter(dataLimiteSLA)) {
          return { 
            disponivel: false, 
            motivo: `Acima do SLA - data limite para agendamento: ${dataLimiteSLA.format('DD/MM/YYYY')}` 
          };
        }
      }
    }
  }
  
  return null; // SLA ok
}

// Teste
const os = {
  id_assunto: 1,
  data_cadastro: '2025-01-01' // OS criada em 1º de janeiro
};

const dataAgendamento = dayjs('2025-01-20'); // Tentando agendar para 20 de janeiro
const resultado = validarSLA(os, dataAgendamento);

console.log('Teste de validação SLA:');
console.log('OS criada em:', os.data_cadastro);
console.log('Tentando agendar para:', dataAgendamento.format('DD/MM/YYYY'));
console.log('Resultado:', resultado);

// Teste com data fora do SLA
const dataForaDoSLA = dayjs('2025-02-01'); // 31 dias depois
const resultadoForaDoSLA = validarSLA(os, dataForaDoSLA);

console.log('\nTeste fora do SLA:');
console.log('Tentando agendar para:', dataForaDoSLA.format('DD/MM/YYYY'));
console.log('Resultado:', resultadoForaDoSLA);
