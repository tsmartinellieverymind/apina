const { buscarClientePorCpf } = require('../../services/ixcService');

module.exports = async ({ cpf }) => {
  if (!cpf) {
    return { mensagem: '❌ CPF não informado.' };
  }

  return await buscarClientePorCpf(cpf);
};
