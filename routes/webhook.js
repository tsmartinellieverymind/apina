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
  let log = `📥 Msg recebida: "${mensagem}"\n👤 Número: ${numero}\nEtapa atual: ${user.etapa}\n`;

  try {
    if (user.etapa === 'cpf') {
      const cpf = extrairCpf(mensagem);
      if (!cpf) {
        resposta = '❗ Por favor, me envia seu CPF certinho (com ou sem pontuação).';
        log += '⚠️ CPF não encontrado na mensagem.\n';
        return res.json({ para: numero, resposta, log });
      }

      log += `🔍 CPF extraído: ${cpf}\n`;
      user.cpf = cpf;

      const clienteResp = await buscarClientePorCpf(cpf);
      log += `📡 Resposta buscarClientePorCpf: ${JSON.stringify(clienteResp)}\n`;

      if (!clienteResp.cliente?.id) {
        resposta = '🚫 Não encontrei seu CPF no sistema. Confere aí e manda de novo.';
        log += '❌ Cliente não encontrado.\n';
        return res.json({ para: numero, resposta, log });
      }

      user.clienteId = clienteResp.cliente.id;
      user.nomeCliente = clienteResp.cliente.razao;
      user.etapa = 'aguardando_os';

      resposta = `🙌 Achei você aqui, ${user.nomeCliente || 'cliente'}! Vou ver se tem alguma OS aberta pra ti.`;
    }

    if (user.etapa === 'aguardando_os') {
      const osList = await buscarOS(null, user.clienteId);
      log += `📡 Resposta buscarOS: ${JSON.stringify(osList)}\n`;

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

    if (user.etapa === 'escolher_os') {
      const osEscolhida = user.osList.find(os => os.id === mensagem);
      if (!osEscolhida) {
        resposta = '🚫 Não achei essa OS. Manda o número certinho, tá bem?';
        log += '❌ ID da OS não encontrada na lista do cliente.\n';
        return res.json({ para: numero, resposta, log });
      }

      user.osEscolhida = osEscolhida;
      user.etapa = 'agendar_data';
      const sugestao = dayjs().add(1, 'day').format('YYYY-MM-DD');
      resposta = `📅 Que dia você quer agendar? (sugestão: ${sugestao})`;
    }

    if (user.etapa === 'agendar_data') {
      const data = mensagem || dayjs().add(1, 'day').format('YYYY-MM-DD');

      const resultado = await execute('default-agent', 'agendar_os_completo', {
        osId: user.osEscolhida.id,
        novaData: `${data} 10:00:00`,
        idTecnico: user.osEscolhida.id_tecnico || '0',
        melhorHorario: 'M'
      });

      resposta = resultado.mensagem || '✅ OS agendada com sucesso!';
      log += `🧠 Resultado agendamento: ${JSON.stringify(resultado)}\n`;

      user.etapa = 'finalizado';
    }

    usuarios[numero] = user;

    // Garante que sempre tenha alguma resposta
    if (!resposta) {
      resposta = '🤖 Ainda estou processando... pode tentar de novo rapidinho?';
      log += '⚠️ Nenhuma resposta gerada. Talvez a etapa esteja inconsistente.\n';
    }

    return res.json({ para: numero, resposta, log });

  } catch (err) {
    const erro = err?.message || 'Erro desconhecido';
    console.error('❌ Erro no webhook:', erro);
    log += `🔥 Erro: ${erro}\n`;
    resposta = '❌ Deu um errinho aqui no sistema. Já estamos verificando, tenta de novo em instantes.';
    return res.json({ para: numero, resposta, log });
  }
});

module.exports = router;
