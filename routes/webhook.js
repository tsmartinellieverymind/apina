const express = require('express');
const router = express.Router();
const { buscarClientePorCpf, buscarOS } = require('../services/ixcService');
const { execute } = require('../app/engine/executor');
const dayjs = require('dayjs');

const usuarios = {};

function extrairCpf(texto) {
  const match = texto.match(/\d{3}\.?\d{3}\.?\d{3}-?\d{2}/);
  return match ? match[0].replace(/[^\d]/g, '') : null;
}

router.post('/', async (req, res) => {
  const mensagem = req.body.Body?.trim();
  const numero = req.body.From;
  const user = usuarios[numero] || { etapa: 'cpf' };

  try {
    let resposta = '';
    const cpfExtraido = extrairCpf(mensagem);

    if (user.etapa === 'cpf' && cpfExtraido) {
      user.cpf = cpfExtraido;
      const clienteResp = await buscarClientePorCpf(user.cpf);

      if (!clienteResp.cliente?.id) {
        resposta = '🚫 Não achei ninguém com esse CPF aqui não. Confere pra mim, por favor.';
      } else {
        user.clienteId = clienteResp.cliente.id;
        user.nomeCliente = clienteResp.cliente.razao;
        user.etapa = 'aguardando_os';
        resposta = `🧐 Achei o CPF, ${user.nomeCliente}! Agora deixa eu ver se tem OS aberta...`;
      }
    }

    if (user.etapa === 'aguardando_os' && user.clienteId) {
      const osList = await buscarOS(null, user.clienteId);
      const abertas = Object.values(osList).filter(os => os.status === 'A');

      if (abertas.length === 0) {
        resposta = '📭 No momento você não tem nenhuma OS aberta. Se precisar de ajuda, é só chamar!';
        user.etapa = 'finalizado';
      } else {
        user.osList = abertas;
        user.etapa = 'escolher_os';
        resposta = `📋 Encontrei ${abertas.length} OS aberta(s):\n` +
          abertas.map(os => `• ${os.id} - ${os.mensagem || 'sem descrição'}`).join('\n') +
          `\n\nQual dessas você quer agendar? Manda só o número dela.`;
      }
    }

    usuarios[numero] = user;
    res.json({ para: numero, resposta });

  } catch (error) {
    console.error('❌ Erro:', error.message);
    res.json({ para: numero, resposta: `⚠️ Erro ao processar: ${error.message}` });
  }
});

module.exports = router;
