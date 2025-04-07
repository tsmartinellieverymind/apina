const express = require('express');
const router = express.Router();
const { loadAgent, getTopicById, executeAction } = require('../app/engine/loader');
const { interpretarMensagem } = require('../services/openaiService'); // opcional

router.post('/', async (req, res) => {
  const mensagem = req.body.Body;
  const numero = req.body.From;
  const agent = loadAgent();

  try {
    // Interpretação pode vir do GPT ou de um parser próprio
    const { intent, data, mensagem: respostaBase } = await interpretarMensagem(mensagem, agent);

    const resultado = await executeAction(intent, data);
    res.json({
      para: numero,
      resposta: resultado?.mensagem || respostaBase
    });
  } catch (error) {
    console.error('Erro no webhook:', error.message);
    res.status(500).json({ erro: 'Erro ao processar mensagem.' });
  }
});

module.exports = router;
