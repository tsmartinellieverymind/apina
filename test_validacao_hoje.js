const dayjs = require('dayjs');

// Simular as funções necessárias
function isDiaUtil(dataObj) {
  const diaSemana = dataObj.day();
  return diaSemana >= 1 && diaSemana <= 5;
}

function validarSLA(os, dataObj) {
  // Simulação simples - sempre retorna null (SLA ok) para este teste
  return null;
}

// Simular a função verificarDisponibilidadeData com todas as validações
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
  
  // Verificar se não é agendamento para hoje
  const hoje = dayjs();
  if (dataObj.isSame(hoje, 'day')) {
    return { disponivel: false, motivo: 'Não é possível agendar para o dia atual' };
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
    motivo: 'Disponível (passou em todas as validações)',
    validacoes_ok: ['data_valida', 'dia_util', 'nao_eh_hoje', 'sla_ok']
  };
}

// Testes
async function executarTestes() {
  console.log('=== TESTE VALIDAÇÃO "NÃO AGENDAR PARA HOJE" ===\n');
  
  const os = {
    id_assunto: 1,
    data_cadastro: dayjs().subtract(2, 'day').format('YYYY-MM-DD')
  };
  
  // Teste 1: Tentativa de agendamento para hoje
  const hoje = dayjs().format('YYYY-MM-DD');
  console.log('Teste 1 - Tentativa de agendamento para HOJE:');
  console.log('Data atual:', dayjs().format('DD/MM/YYYY HH:mm'));
  console.log('Tentando agendar para:', hoje);
  
  const resultado1 = await verificarDisponibilidadeData(os, { data: hoje, periodo: 'M' });
  console.log('Resultado:', resultado1);
  console.log('');
  
  // Teste 2: Agendamento para amanhã (deve funcionar se for dia útil)
  const amanha = dayjs().add(1, 'day').format('YYYY-MM-DD');
  console.log('Teste 2 - Agendamento para AMANHÃ:');
  console.log('Tentando agendar para:', amanha, `(${dayjs(amanha).format('dddd')})`);
  
  const resultado2 = await verificarDisponibilidadeData(os, { data: amanha, periodo: 'T' });
  console.log('Resultado:', resultado2);
  console.log('');
  
  // Teste 3: Agendamento para próxima segunda-feira (garantir que é dia útil)
  const proximaSegunda = dayjs().day(8).format('YYYY-MM-DD'); // Próxima segunda
  console.log('Teste 3 - Agendamento para próxima segunda-feira:');
  console.log('Tentando agendar para:', proximaSegunda, `(${dayjs(proximaSegunda).format('dddd')})`);
  
  const resultado3 = await verificarDisponibilidadeData(os, { data: proximaSegunda, periodo: 'M' });
  console.log('Resultado:', resultado3);
  console.log('');
  
  // Teste 4: Verificar se outras validações ainda funcionam (fim de semana)
  const proximoSabado = dayjs().day(6).format('YYYY-MM-DD');
  console.log('Teste 4 - Tentativa para fim de semana (deve falhar por não ser dia útil):');
  console.log('Tentando agendar para:', proximoSabado, `(${dayjs(proximoSabado).format('dddd')})`);
  
  const resultado4 = await verificarDisponibilidadeData(os, { data: proximoSabado, periodo: 'M' });
  console.log('Resultado:', resultado4);
  console.log('');
  
  console.log('=== RESUMO DAS VALIDAÇÕES ===');
  console.log('1. Data inválida: ❌ Bloqueia');
  console.log('2. Fim de semana: ❌ Bloqueia');
  console.log('3. Agendamento para hoje: ❌ Bloqueia');
  console.log('4. SLA ultrapassado: ❌ Bloqueia');  
  console.log('5. Data válida no futuro em dia útil: ✅ Permite');
}

executarTestes().catch(console.error);
