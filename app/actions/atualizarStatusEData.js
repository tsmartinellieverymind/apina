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

  return {
    mensagem: `✅ OS ${osId} atualizada com sucesso.`,
    data: resposta
  };
};


// actions/agendar_os_completo.js
const { buscarOS, atualizarOS } = require('../../services/ixcService');

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

  return {
    mensagem: `✅ OS ${osId} agendada com sucesso.`,
    data: resposta
  };
};
