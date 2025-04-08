const express = require('express');
const router = express.Router();
const { buscarClientePorCpf, buscarOSPorClienteId, atualizarOS } = require('../services/ixcService');
const { interpretarMensagem } = require('../services/openaiService');
const dayjs = require('dayjs');
const { enviarMensagemWhatsApp } = require('../services/twillioService');

const usuarios = {};

function extrairCpf(texto) {
  const match = texto.match(/\d{3}\.?\d{3}\.?\d{3}-?\d{2}/);
  return match ? match[0].replace(/[^\d]/g, '') : null;
}

router.post('/', async (req, res) => {
  const mensagem = req.body.Body?.trim();
  const numero = req.body.From;
  const user = usuarios[numero] || { etapa: 'inicio' };

  let resposta = '';
  let log = `📥 Mensagem: "${mensagem}"\n👤 De: ${numero}\n📌 Etapa: ${user.etapa}\n`;

  try {
    const { intent, data, mensagem: respostaBase } = await interpretarMensagem(mensagem);
    log += `🧠 Intent detectada: ${intent}\n📦 Data extraída: ${JSON.stringify(data)}\n`;

    switch (intent) {
      case 'inicio':
        resposta = 'Olá! Pra gente começar, me manda seu CPF (com ou sem pontuação).';
        user.etapa = 'cpf';
        break;

      case 'informar_cpf': {
        const cpf = extrairCpf(mensagem);
        if (!cpf) {
          resposta = '❗ Não consegui entender o CPF. Pode mandar de novo, por favor?';
          break;
        }

        user.cpf = cpf;
        const clienteResp = await buscarClientePorCpf(cpf);
        log += `📡 Resultado da busca de cliente: ${JSON.stringify(clienteResp)}\n`;

        if (!clienteResp.cliente?.id) {
          resposta = '🚫 Não encontrei esse CPF no sistema. Confere aí e me manda de novo.';
          break;
        }

        user.clienteId = clienteResp.cliente.id;
        user.nomeCliente = clienteResp.cliente.razao;
        user.etapa = 'verificar_os';

        resposta = `Beleza, ${user.nomeCliente || 'cliente'}! Agora vou dar uma olhadinha nas suas OS abertas.`;
        break;
      }

      case 'verificar_os': {
        const osList = await buscarOSPorClienteId(user.clienteId);
        log += `📋 OS encontradas: ${JSON.stringify(osList)}\n`;

        const abertas = osList.filter(os => ['A', 'AG', 'EN'].includes(os.status));
        if (abertas.length === 0) {
          resposta = '📭 No momento você não tem nenhuma OS aberta. Se precisar, só chamar!';
          user.etapa = 'finalizado';
          break;
        }

        user.osList = abertas;
        user.etapa = 'escolher_os';
        user.osEscolhida = abertas;

        resposta = `Encontrei ${abertas.length} OS aberta(s):\n` +
          abertas.map(os => `• ${os.id} - ${os.mensagem || 'Sem descrição'}`).join('\n') +
          `\n\nQual delas você quer agendar? Me manda o número dela.`;
        break;
      }

      case 'escolher_os': {
        const os = user.osList?.find(os => os.id === mensagem);
        if (!os) {
          resposta = '❗ Não encontrei essa OS na sua lista. Dá uma olhadinha e manda de novo.';
          break;
        }

        user.osEscolhida = os;
        user.etapa = 'agendar_data';

        const sugestao = dayjs().add(1, 'day').format('YYYY-MM-DD');
        resposta = `Qual dia quer agendar? (Sugestão: ${sugestao})`;
        break;
      }

      case 'agendar_data': {
        const dataFinal = data?.data_agendamento || dayjs().add(1, 'day').format('YYYY-MM-DD');
        const osEscolhida = user.osEscolhida?.['0'] || user.osEscolhida;

        const payloadOriginal = {
          ...osEscolhida,
          data_agenda_final: `${dataFinal} 10:00:00`,
          melhor_horario_agenda: 'M'
        };

        const resultado = await atualizarOS(osEscolhida.id, payloadOriginal);
        log += `🛠 Atualização OS: ${JSON.stringify(resultado)}\n`;

        resposta = resultado.mensagem || '✅ Agendamento feito com sucesso!';
        user.etapa = 'finalizado';
        break;
      }

      case 'finalizado':
      default:
        resposta = respostaBase || 'Tudo certo! Se precisar de mais alguma coisa, é só mandar mensagem.';
        break;
    }

    usuarios[numero] = user;

    if (!resposta) {
      resposta = '⚠️ Tô meio confuso aqui. Pode tentar de novo, por favor?';
    }

    // ✅ Envia a resposta via WhatsApp (Twilio)
    await enviarMensagemWhatsApp(numero, resposta);
    return res.json({ para: numero, status: '📤 Mensagem enviada via Twilio', log });

  } catch (error) {
    const erroCompleto = error?.stack || error?.message || 'Erro desconhecido';
    log += `🔥 Erro detalhado:\n${erroCompleto}\n`;

    resposta = '❌ Opa! Deu um errinho aqui. Já estamos resolvendo. Tenta de novo daqui a pouco.';
    await enviarMensagemWhatsApp(numero, resposta);
    return res.json({ para: numero, status: '📤 Erro enviado via Twilio', log });
  }
});

module.exports = router;
