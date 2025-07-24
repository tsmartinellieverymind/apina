// Função adaptadora para substituir interpretaDataePeriodo
// Esta função usa interpretarDataNatural que já está importada
async function adaptadorInterpretaDataPeriodo({ mensagem, agentId = 'agent_os', dados = {}, promptExtra = '' }) {
  const { interpretarDataNatural } = require('./services/openaiService');
  
  // Chama a função que já existe e está importada
  const dataString = await interpretarDataNatural(mensagem);
  
  // Determina o período com base em palavras-chave na mensagem
  let periodo = null;
  const msgLower = mensagem.toLowerCase();
  
  if (msgLower.includes('manhã') || msgLower.includes('manha') || 
      msgLower.includes('cedo') || msgLower.includes('antes do almoço')) {
    periodo = 'M';
  } else if (msgLower.includes('tarde') || msgLower.includes('depois do almoço') || 
             msgLower.includes('noite')) {
    periodo = 'T';
  } else {
    // Se não encontrar palavras-chave, assume tarde como padrão
    periodo = 'T';
  }
  
  return {
    data_interpretada: dataString,
    periodo_interpretado: periodo
  };
}

module.exports = adaptadorInterpretaDataPeriodo;
