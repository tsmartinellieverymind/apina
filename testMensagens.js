const { 
  formatarDataPeriodo, 
  gerarMensagemConfirmacaoAgendamento,
  atualizarOS
} = require('./services/ixcService');
const dayjs = require('dayjs');

// Função para testar a formatação de datas e períodos
function testarFormatacaoDataPeriodo() {
  console.log('===== TESTE DE FORMATAÇÃO DE DATAS E PERÍODOS =====');
  
  const hoje = dayjs();
  const amanha = hoje.add(1, 'day');
  const depoisDeAmanha = hoje.add(2, 'day');
  
  const datasParaTeste = [
    { data: hoje.format('YYYY-MM-DD'), descricao: 'Hoje' },
    { data: amanha.format('YYYY-MM-DD'), descricao: 'Amanhã' },
    { data: depoisDeAmanha.format('YYYY-MM-DD'), descricao: 'Depois de amanhã' }
  ];
  
  const periodos = [
    { codigo: 'M', descricao: 'Manhã' },
    { codigo: 'T', descricao: 'Tarde' }
  ];
  
  for (const dataTeste of datasParaTeste) {
    for (const periodo of periodos) {
      const resultado = formatarDataPeriodo(dataTeste.data, periodo.codigo);
      console.log(`${dataTeste.descricao} (${dataTeste.data}) - ${periodo.descricao} (${periodo.codigo}):`);
      console.log(`  Data formatada: "${resultado.dataFormatada}"`);
      console.log(`  Dia da semana: "${resultado.diaSemana}"`);
      console.log(`  Período formatado: "${resultado.periodoFormatado}"`);
      console.log(`  Texto completo: "${resultado.textoCompleto}"`);
      console.log('---');
    }
  }
}

// Função para testar a geração de mensagens de confirmação
function testarMensagensConfirmacao() {
  console.log('\n===== TESTE DE MENSAGENS DE CONFIRMAÇÃO =====');
  
  const assuntos = [
    'Instalação de internet',
    'Manutenção de roteador',
    'Cobrança'
  ];
  
  const hoje = dayjs();
  const amanha = hoje.add(1, 'day');
  
  for (const assunto of assuntos) {
    const mensagemManha = gerarMensagemConfirmacaoAgendamento(assunto, amanha.format('YYYY-MM-DD'), 'M');
    console.log(`\nAssunto: ${assunto}, Amanhã de manhã:`);
    console.log(`"${mensagemManha}"`);
    
    const mensagemTarde = gerarMensagemConfirmacaoAgendamento(assunto, amanha.format('YYYY-MM-DD'), 'T');
    console.log(`\nAssunto: ${assunto}, Amanhã de tarde:`);
    console.log(`"${mensagemTarde}"`);
  }
}

// Função para testar a atualização de OS com mensagens amigáveis
async function testarAtualizacaoOS() {
  console.log('\n===== TESTE DE ATUALIZAÇÃO DE OS COM MENSAGENS AMIGÁVEIS =====');
  
  // Simular uma atualização de OS
  const osId = '12345';
  const amanha = dayjs().add(1, 'day');
  const dataAgendamento = amanha.format('YYYY-MM-DD 10:00:00');
  
  const payload = {
    titulo: 'Instalação de fibra óptica',
    data_agenda_final: dataAgendamento,
    melhor_horario_agenda: 'M',
    // Outros campos necessários para a atualização
    status: 'P'
  };
  
  try {
    // Simular a chamada para atualizarOS sem realmente fazer a requisição API
    const resultado = await atualizarOS(osId, payload, true); // true para modo de teste
    console.log('Resultado da atualização (simulação):');
    console.log(`Mensagem: "${resultado.mensagem}"`);
  } catch (error) {
    console.error('Erro ao testar atualização de OS:', error);
  }
}

// Executar os testes
async function executarTestes() {
  testarFormatacaoDataPeriodo();
  testarMensagensConfirmacao();
  
  try {
    await testarAtualizacaoOS();
  } catch (error) {
    console.error('Erro ao executar testes de atualização:', error);
  }
  
  console.log('\n===== TESTES CONCLUÍDOS =====');
}

// Modificar a função atualizarOS para permitir testes sem fazer requisições reais
const originalAtualizarOS = atualizarOS;
module.exports.atualizarOS = async function(osId, payload, modoTeste = false) {
  if (modoTeste) {
    console.log('Executando atualizarOS em modo de teste (sem requisição API)');
    
    // Buscar assunto/título da OS
    const assunto = payload.titulo || payload.mensagem || payload.motivo || 'a visita';
    
    // Buscar data e período agendados
    let mensagem;
    
    if (payload.data_agenda_final) {
      const [data] = payload.data_agenda_final.split(' ');
      if (data && payload.melhor_horario_agenda) {
        try {
          // Verificar se temos a função de dia da semana
          let diaDaSemanaExtenso;
          try {
            const dateHelpers = require('./app/utils/dateHelpers');
            diaDaSemanaExtenso = dateHelpers.diaDaSemanaExtenso;
          } catch (error) {
            // Função auxiliar para obter o dia da semana caso o módulo não esteja disponível
            diaDaSemanaExtenso = (dataStr) => {
              const dias = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
              const data = dayjs(dataStr);
              return dias[data.day()];
            };
          }
          
          // Obter o dia da semana
          const diaSemana = diaDaSemanaExtenso(data);
          // Capitalizar primeira letra
          const diaSemanaFormatado = diaSemana.charAt(0).toUpperCase() + diaSemana.slice(1);
          
          // Gerar a mensagem amigável com a data formatada
          const dataFormatada = dayjs(data).format('DD/MM/YYYY');
          let periodoFormatado = payload.melhor_horario_agenda === 'M' ? 'pela manhã' : 'pela tarde';
          
          mensagem = `Prontinho! Sua visita para ${assunto} está agendada! `;
          mensagem += `Ficou para ${diaSemanaFormatado}, dia ${dataFormatada} ${periodoFormatado}. `;
          mensagem += `Estou finalizando nosso atendimento. Caso precise de mim estou por aqui.`;
        } catch (error) {
          // Em caso de erro, usar a função padrão
          mensagem = gerarMensagemConfirmacaoAgendamento(assunto, data, payload.melhor_horario_agenda);
        }
      } else {
        // Fallback se não tiver período definido
        const dataFormatada = dayjs(data).format('DD/MM/YYYY');
        mensagem = `Prontinho! Sua visita para ${assunto} está agendada! ` +
                  `Ficou para o dia ${dataFormatada}. ` +
                  `Estou finalizando nosso atendimento. Caso precise de mim, estou por aqui.`;
      }
    } else {
      mensagem = `Prontinho! Sua OS ${osId} foi atualizada com sucesso. Caso precise de mim, estou por aqui.`;
    }
    
    return {
      mensagem,
      data: { success: true, message: 'Simulação de atualização bem-sucedida' }
    };
  } else {
    // Chamada real para a API
    return originalAtualizarOS(osId, payload);
  }
};

// Iniciar os testes
executarTestes();
