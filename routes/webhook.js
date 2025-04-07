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

  let resposta = '';
  let log = '';

  try {
    log += `📩 Mensagem recebida: "${mensagem}"\n`;

    if (user.etapa === 'cpf') {
      const cpfExtraido = extrairCpf(mensagem);
      if (!cpfExtraido) {
        resposta = '❗ Por favor, me envia seu CPF com os números certinhos (com ou sem pontos).';
        log += '⚠️ CPF não encontrado na mensagem.\n';
        return res.json({ para: numero, resposta, log });
      }

      log += `🔍 CPF extraído: ${cpfExtraido}\n`;
      user.cpf = cpfExtraido;

      const clienteResp = await buscarClientePorCpf(cpfExtraido);
      log += `📡 Resposta da API Cliente: ${JSON.stringify(clienteResp)}\n`;

      if (!clienteResp.cliente || !clienteResp.cliente.id) {
        resposta = '🚫 Não encontrei seu CPF no sistema. Confere e manda de novo pra nóis.';
        log += '❌ Cliente não encontrado.\n';
        return res.json({ para: numero, resposta, log });
      }

      user.clienteId = clienteResp.cliente.id;
      user.nomeCliente = clienteResp.cliente.razao;
      user.etapa = 'aguardando_os';
      resposta = `👋 Achei você aqui, ${user.nomeCliente || 'cliente'}! Agora vou ver se tem alguma OS aberta pra ti.`;
    }

    if (user.etapa === 'aguardando_os' && user.clienteId) {
      const osList = await buscarOS(null, user.clienteId);
      log += `📡 Resposta da API OS: ${JSON.stringify(osList)}\n`;

      const abertas = Object.values(osList).filter(os => os.status === 'A');

      if (abertas.length === 0) {
        resposta = '📭 No momento você não tem nenhuma OS aberta. Se precisar de ajuda, só chamar!';
        user.etapa = 'finalizado';
        return res.json({ para: numero, resposta, log });
      }

      user.osList = abertas;
      user.etapa = 'escolher_os';

      resposta = `📋 Encontrei ${abertas.length} OS aberta(s):\n` +
        abertas.map(os => `• ${os.id} - ${os.mensagem || 'sem descrição'}`).join('\n') +
        `\n\nQual dessas você quer agendar? Manda o número da OS.`;
    }

    usuarios[numero] = user;
    return res.json({ para: numero, resposta, log });

  } catch (error) {
    console.error('❌ Erro inesperado:', error);
    resposta = '⚠️ Deu um probleminha aqui no sistema... tenta de novo em instantes.';
    log += `💥 Erro: ${error.message}\n`;
    return res.json({ para: numero, resposta, log });
  }
});

module.exports = router;
