const dayjs = require('dayjs');

// Simular as configurações e funções necessárias
const configuracoesAgendamento = [
  {
    id_assunto: 1,
    dataMaximaAgendamentoDias: 15,
    prioridade: 'alta'
  },
  {
    id_assunto: 2,
    dataMaximaAgendamentoDias: 30,
    prioridade: 'normal'
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

function isDiaUtil(dataObj) {
  const diaSemana = dataObj.day();
  return diaSemana >= 1 && diaSemana <= 5; // Segunda a sexta
}

// Simular a função verificarDisponibilidadeData com validação SLA
async function verificarDisponibilidadeData(os, opcoes = {}) {
  const { data, periodo } = opcoes;
  
  if (!data) {
    return { disponivel: false, motivo: 'Data não especificada' };
  }
  
  // Converter para objeto dayjs
  const dataObj = dayjs(data);
  if (!dataObj.isValid()) {
    return { disponivel: false, motivo: 'Data inválida' };
  }
  
  // Verificar se é dia útil
  if (!isDiaUtil(dataObj)) {
    return { disponivel: false, motivo: 'Não é um dia útil' };
  }
  
  // Validar SLA
  const erroSLA = validarSLA(os, dataObj);
  if (erroSLA) {
    return erroSLA;
  }
  
  // Se chegou até aqui, passou em todas as validações
  return {
    disponivel: true,
    data: data,
    periodo: periodo,
    motivo: 'Disponível (passou na validação SLA)',
    sla_validado: true
  };
}

// Testes
async function executarTestes() {
  console.log('=== TESTES DE VALIDAÇÃO SLA ===\n');
  
  // Teste 1: OS recente dentro do SLA
  const osRecente = {
    id_assunto: 1,
    data_cadastro: dayjs().subtract(5, 'day').format('YYYY-MM-DD') // 5 dias atrás
  };
  
  const dataAgendamentoOk = dayjs().add(3, 'day').format('YYYY-MM-DD'); // 3 dias no futuro
  const resultado1 = await verificarDisponibilidadeData(osRecente, { data: dataAgendamentoOk, periodo: 'M' });
  
  console.log('Teste 1 - OS recente, agendamento dentro do SLA:');
  console.log('OS criada:', osRecente.data_cadastro);
  console.log('Agendamento para:', dataAgendamentoOk);
  console.log('Resultado:', resultado1);
  console.log('');
  
  // Teste 2: OS antiga, SLA já vencido
  const osAntiga = {
    id_assunto: 1,
    data_cadastro: dayjs().subtract(20, 'day').format('YYYY-MM-DD') // 20 dias atrás
  };
  
  const resultado2 = await verificarDisponibilidadeData(osAntiga, { data: dataAgendamentoOk, periodo: 'M' });
  
  console.log('Teste 2 - OS antiga, SLA já vencido:');
  console.log('OS criada:', osAntiga.data_cadastro);
  console.log('Agendamento para:', dataAgendamentoOk);
  console.log('Resultado:', resultado2);
  console.log('');
  
  // Teste 3: Tentativa de agendamento fora do SLA
  const osMedia = {
    id_assunto: 1,
    data_cadastro: dayjs().subtract(5, 'day').format('YYYY-MM-DD') // 5 dias atrás
  };
  
  const dataForaDoSLA = dayjs().add(20, 'day').format('YYYY-MM-DD'); // 20 dias no futuro (total 25 dias)
  const resultado3 = await verificarDisponibilidadeData(osMedia, { data: dataForaDoSLA, periodo: 'T' });
  
  console.log('Teste 3 - Agendamento fora do SLA:');
  console.log('OS criada:', osMedia.data_cadastro);
  console.log('Agendamento para:', dataForaDoSLA);
  console.log('Resultado:', resultado3);
  console.log('');
  
  // Teste 4: OS com SLA maior (30 dias)
  const osNormal = {
    id_assunto: 2,
    data_cadastro: dayjs().subtract(10, 'day').format('YYYY-MM-DD') // 10 dias atrás
  };
  
  const dataAgendamento30 = dayjs().add(15, 'day').format('YYYY-MM-DD'); // 15 dias no futuro (total 25 dias)
  const resultado4 = await verificarDisponibilidadeData(osNormal, { data: dataAgendamento30, periodo: 'M' });
  
  console.log('Teste 4 - OS com SLA de 30 dias:');
  console.log('OS criada:', osNormal.data_cadastro);
  console.log('Agendamento para:', dataAgendamento30);
  console.log('Resultado:', resultado4);
  console.log('');
  
  // Teste 5: Fim de semana (não é dia útil)
  const proximoSabado = dayjs().day(6).format('YYYY-MM-DD'); // Próximo sábado
  const resultado5 = await verificarDisponibilidadeData(osRecente, { data: proximoSabado, periodo: 'M' });
  
  console.log('Teste 5 - Tentativa de agendamento em fim de semana:');
  console.log('Agendamento para:', proximoSabado, '(sábado)');
  console.log('Resultado:', resultado5);
}

executarTestes().catch(console.error);
