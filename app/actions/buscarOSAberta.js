const { buscarOS } = require('../../services/ixcService');

module.exports = async (params) => {
  const { id } = params;
  const resultado = await buscarOS(id);
  return {
    mensagem: `A OS ${id} está com status ${resultado.status}`,
    data: resultado
  };
};
