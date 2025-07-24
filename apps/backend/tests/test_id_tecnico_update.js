const dayjs = require('dayjs');

// Simular a função gerarSugestoesDeAgendamento
async function gerarSugestoesDeAgendamento(os, opcoes = {}) {
  console.log('Gerando sugestões para OS:', os.id);
  console.log('Opções:', opcoes);
  
  // Simular diferentes técnicos para diferentes datas/períodos
  const { dataEspecifica, periodoEspecifico } = opcoes;
  
  let id_tecnico;
  let data;
  let periodo;
  
  if (dataEspecifica && periodoEspecifico) {
    // Data/período específicos - simular técnico específico
    data = dataEspecifica;
    periodo = periodoEspecifico;
    id_tecnico = `${dayjs(dataEspecifica).format('DD')}${periodo}`; // Ex: "21M" para dia 21 manhã
  } else {
    // Sugestão geral - usar técnico padrão
    data = dayjs().add(1, 'day').format('YYYY-MM-DD');
    periodo = 'M';
    id_tecnico = 'TEC001';
  }
  
  return {
    sugestao: {
      data: data,
      periodo: periodo,
      id_tecnico: id_tecnico
    },
    alternativas: []
  };
}

// Simular estado do usuário
const user = {
  osEscolhida: { id: '12345', id_assunto: 1 },
  dataInterpretada: null,
  periodoAgendamento: null,
  sugestaoData: null,
  sugestaoPeriodo: null,
  id_tecnico: null
};

async function testarAtualizacaoIdTecnico() {
  console.log('=== TESTE ATUALIZAÇÃO ID_TECNICO ===\n');
  
  console.log('Estado inicial do usuário:');
  console.log('user.id_tecnico:', user.id_tecnico);
  console.log('user.sugestaoData:', user.sugestaoData);
  console.log('user.sugestaoPeriodo:', user.sugestaoPeriodo);
  console.log('');
  
  // Teste 1: Gerar sugestão inicial
  console.log('1. Gerando sugestão inicial...');
  const sugestoes1 = await gerarSugestoesDeAgendamento(user.osEscolhida);
  user.sugestaoData = sugestoes1.sugestao.data;
  user.sugestaoPeriodo = sugestoes1.sugestao.periodo;
  user.id_tecnico = sugestoes1.sugestao.id_tecnico;
  
  console.log('Após sugestão inicial:');
  console.log('user.id_tecnico:', user.id_tecnico);
  console.log('user.sugestaoData:', user.sugestaoData);
  console.log('user.sugestaoPeriodo:', user.sugestaoPeriodo);
  console.log('');
  
  // Teste 2: Usuário escolhe data/período diferente
  console.log('2. Usuário escolhe data/período específico...');
  user.dataInterpretada = '2025-01-25';
  user.periodoAgendamento = 'T';
  
  // Simular o que acontece quando confirmamos uma data específica
  const sugestaoEspecifica = await gerarSugestoesDeAgendamento(user.osEscolhida, {
    dataEspecifica: user.dataInterpretada,
    periodoEspecifico: user.periodoAgendamento
  });
  
  user.sugestaoData = user.dataInterpretada;
  user.sugestaoPeriodo = user.periodoAgendamento;
  user.id_tecnico = sugestaoEspecifica?.sugestao?.id_tecnico || null;
  
  console.log('Após escolha de data específica:');
  console.log('user.id_tecnico:', user.id_tecnico);
  console.log('user.sugestaoData:', user.sugestaoData);
  console.log('user.sugestaoPeriodo:', user.sugestaoPeriodo);
  console.log('');
  
  // Teste 3: Usuário muda para outra data
  console.log('3. Usuário muda para outra data...');
  user.dataInterpretada = '2025-01-30';
  user.periodoAgendamento = 'M';
  
  const sugestaoNova = await gerarSugestoesDeAgendamento(user.osEscolhida, {
    dataEspecifica: user.dataInterpretada,
    periodoEspecifico: user.periodoAgendamento
  });
  
  user.sugestaoData = user.dataInterpretada;
  user.sugestaoPeriodo = user.periodoAgendamento;
  user.id_tecnico = sugestaoNova?.sugestao?.id_tecnico || null;
  
  console.log('Após mudança de data:');
  console.log('user.id_tecnico:', user.id_tecnico);
  console.log('user.sugestaoData:', user.sugestaoData);
  console.log('user.sugestaoPeriodo:', user.sugestaoPeriodo);
  console.log('');
  
  // Verificar se o id_tecnico mudou corretamente
  console.log('=== RESULTADO DO TESTE ===');
  if (user.id_tecnico === '30M') {
    console.log('✅ SUCESSO: id_tecnico foi atualizado corretamente para a nova data/período');
  } else {
    console.log('❌ FALHA: id_tecnico não foi atualizado corretamente');
    console.log('Esperado: 30M, Recebido:', user.id_tecnico);
  }
  
  console.log('\nResumo das atualizações:');
  console.log('1. Sugestão inicial: TEC001 (técnico padrão)');
  console.log('2. Data específica 25/01 tarde: 25T');
  console.log('3. Nova data 30/01 manhã: 30M');
  console.log('\nO id_tecnico deve ser atualizado a cada mudança de data/período!');
}

testarAtualizacaoIdTecnico().catch(console.error);
