const { buscarColaboradorPorCpf } = require('../../services/ixcService');

module.exports = async ({ cpf }) => {
  if (!cpf) {
    return { mensagem: '⚠️ CPF é obrigatório.' };
  }

  const resultado = await buscarColaboradorPorCpf(cpf);
  return resultado;
};
