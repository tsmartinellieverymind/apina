const express = require('express');
const router = express.Router();
const { buscarClientePorCpf, buscarOS } = require('../services/ixcService');
const { execute } = require('../app/engine/executor');
const dayjs = require('dayjs');

const usuarios = {}; // memória simples por número

router.post('/', async (req, res) => {
  const mensagem = req.body.Body?.trim();
  const numero = req.body.From;
  const user = usuarios[numero] || { etapa: 'cpf' };

  try {
    let resposta = '';

    if (user.etapa === 'cpf') {
      user.cpf = mensagem;
      const clienteResp = await buscarClientePorCpf(user.cpf);

      if (!clienteResp.cliente || !clienteResp.cliente.id) {
        resposta = '🚫 Não encontrei seu CPF no sistema. Confere e manda de novo pra nóis.';
      } else {
        user.clienteId = clienteResp.cliente.id;
        user.nomeCliente = clienteResp.cliente.razao;
        user.etapa = 'aguardando_os';
        resposta = `👋 Achei você aqui, ${user.nomeCliente || 'cliente'}! Agora vou ver se tem alguma OS aberta pra ti.`;
      }
    }

    if (user.etapa === 'aguardando_os') {
      const osList = await buscarOS(null, user.clienteId);
      const abertas = Object.values(osList).filter(os => os.status === 'A');

      if (abertas.length === 0) {
        resposta = '📭 No momento você não tem nenhuma OS aberta. Se precisar de ajuda, só chamar!';
        user.etapa = 'finalizado';
      } else {
        user.osList = abertas;
        user.etapa = 'escolher_os';

        resposta = `📋 Encontrei ${abertas.length} OS aberta(s):\n` +
          abertas.map(os => `• ${os.id} - ${os.mensagem || 'sem descrição'}`).join('\n') +
          `\n\nQual dessas você quer agendar? Manda o número da OS.`;
      }
    }

    else if (user.etapa === 'escolher_os') {
      const osEscolhida = user.osList.find(os => os.id === mensagem);
      if (!osEscolhida) {
        resposta = '🚫 Não achei essa OS. Manda o número certinho, tá bem?';
      } else {
        user.osEscolhida = osEscolhida;
        user.etapa = 'agendar_data';
        const sugestao = dayjs().add(1, 'day').format('YYYY-MM-DD');
        resposta = `📅 Que dia você quer agendar? (sugestão: ${sugestao})`;
      }
    }

    else if (user.etapa === 'agendar_data') {
      const data = mensagem || dayjs().add(1, 'day').format('YYYY-MM-DD');

      const resultado = await execute('default-agent', 'agendar_os_completo', {
        osId: user.osEscolhida.id,
        novaData: `${data} 10:00:00`,
        idTecnico: user.osEscolhida.id_tecnico || '0',
        melhorHorario: 'M'
      });

      resposta = `✅ Agendado com sucesso!\n${resultado.mensagem}`;
      user.etapa = 'finalizado';
    }

    usuarios[numero] = user;
    res.json({ para: numero, resposta });

  } catch (error) {
    console.error('❌ Erro no webhook:', error.message);
    res.status(500).json({ erro: 'Erro ao processar mensagem.' });
  }
});

module.exports = router;
