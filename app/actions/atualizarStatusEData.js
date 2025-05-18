const { buscarOS, atualizarOS } = require('../../services/ixcService');

module.exports = async ({ osId, novoStatus, novaData }) => {
  if (!osId) {
    return { mensagem: 'ID da OS não informado.' };
  }

  const registros = await buscarOS(osId);
  const os = registros[osId] || Object.values(registros)[0];

  if (!os) {
    return { mensagem: `OS ${osId} não encontrada.` };
  }

  const payload = {
    ...os,
    status: novoStatus,
    data_agenda: novaData,
  };

  delete payload.idx;
  delete payload.preview;
  delete payload.id;
  delete payload.id_tecnico; // não deve ser enviado

  const resposta = await atualizarOS(osId, payload);

  if (resposta.type === 'error') {
    return {
      mensagem: `❌ Falha ao atualizar OS ${osId}: ${resposta.message}`,
      detalhes: resposta
    };
  }

  // Buscar assunto/título da OS
  const assunto = payload.titulo || payload.mensagem || payload.motivo || 'a visita';
  
  // Importar as funções de formatação
  const { gerarMensagemConfirmacaoAgendamento, formatarDataPeriodo } = require('../../services/ixcService');
  
  // Buscar data/hora agendada
  let mensagem;
  const dataAgendada = payload.data_agenda_final || payload.novaData || novaData;
  
  if (dataAgendada) {
    const [data, hora] = String(dataAgendada).split(' ');
    if (data) {
      // Verificar se temos informação de período
      if (payload.melhor_horario_agenda) {
        // Usar a função de mensagem amigável
        mensagem = gerarMensagemConfirmacaoAgendamento(assunto, data, payload.melhor_horario_agenda);
        
        // Adicionar o dia da semana para tornar a mensagem ainda mais amigável
        const { diaDaSemanaExtenso } = require('../utils/dateHelpers');
        const diaSemana = diaDaSemanaExtenso(data);
        // Capitalizar primeira letra
        const diaSemanaFormatado = diaSemana.charAt(0).toUpperCase() + diaSemana.slice(1);
        
        // Substituir a data formatada por data com dia da semana
        const { dataFormatada } = formatarDataPeriodo(data, payload.melhor_horario_agenda);
        mensagem = mensagem.replace(`dia ${dataFormatada}`, `${diaSemanaFormatado}, dia ${dataFormatada}`);
      } else if (hora) {
        // Se temos hora mas não período, formatar com hora específica
        const dataFormatada = require('dayjs')(data).format('DD/MM/YYYY');
        mensagem = `Prontinho! Sua visita para ${assunto} está agendada! Ficou para o dia ${dataFormatada} às ${hora.slice(0,5)}. Estou finalizando nosso atendimento. Caso precise de mim, estou por aqui.`;
      } else {
        // Se temos apenas data
        const dataFormatada = require('dayjs')(data).format('DD/MM/YYYY');
        mensagem = `Prontinho! Sua visita para ${assunto} está agendada! Ficou para o dia ${dataFormatada}. Estou finalizando nosso atendimento. Caso precise de mim, estou por aqui.`;
      }
    }
  } else {
    mensagem = `Prontinho! Sua OS ${osId} foi atualizada com sucesso. Caso precise de mim, estou por aqui.`;
  }
  return {
    mensagem,
    data: resposta
  };

};

// actions/agendar_os_completo.js
const { buscarOS, atualizarOS, gerarMensagemConfirmacaoAgendamento, formatarDataPeriodo } = require('../../services/ixcService');

module.exports = async ({ osId, novaData, idTecnico, melhorHorario }) => {
  if (!osId || !novaData || !idTecnico || !melhorHorario) {
    return { mensagem: 'Parâmetros obrigatórios: osId, novaData, idTecnico, melhorHorario' };
  }

  const registros = await buscarOS(osId);
  const os = registros[osId] || Object.values(registros)[0];

  if (!os) {
    return { mensagem: `OS ${osId} não encontrada.` };
  }

  if (os.status !== 'A') {
    return { mensagem: `Apenas OSs com status 'A' (Aberta) podem ser agendadas.` };
  }

  const payload = {
    ...os,
    status: 'AG',
    data_agenda: novaData,
    melhor_horario_agenda: melhorHorario,
    id_tecnico: idTecnico,
    tipo: os.tipo || 'C',
    liberado: os.liberado || '1',
    origem_endereco: os.origem_endereco || 'M',
    origem_endereco_estrutura: os.origem_endereco_estrutura || 'E'
  };

  // Campos problemáticos
  delete payload.idx;
  delete payload.preview;
  delete payload.id;
  delete payload.impresso;
  if (!payload.protocolo) delete payload.protocolo;

  const resposta = await atualizarOS(osId, payload);

  if (resposta.type === 'error') {
    return {
      mensagem: `❌ Erro ao agendar OS ${osId}: ${resposta.message}`,
      detalhes: resposta
    };
  }

  // Buscar assunto/título da OS
  const assunto = payload.titulo || payload.mensagem || payload.motivo || 'a visita';
  
  // Extrair a data da novaData
  const [data] = String(novaData).split(' ');
  
  // Gerar mensagem amigável usando a função de formatação
  let mensagem = gerarMensagemConfirmacaoAgendamento(assunto, data, melhorHorario);
  
  // Adicionar o dia da semana para tornar a mensagem ainda mais amigável
  const { diaDaSemanaExtenso } = require('../utils/dateHelpers');
  const diaSemana = diaDaSemanaExtenso(data);
  // Capitalizar primeira letra
  const diaSemanaFormatado = diaSemana.charAt(0).toUpperCase() + diaSemana.slice(1);
  
  // Substituir a data formatada por data com dia da semana
  const { dataFormatada } = formatarDataPeriodo(data, melhorHorario);
  mensagem = mensagem.replace(`dia ${dataFormatada}`, `${diaSemanaFormatado}, dia ${dataFormatada}`);
  
  return {
    mensagem,
    data: resposta
  };
};
