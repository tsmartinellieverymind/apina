const express = require('express');
const router = express.Router();
const { buscarClientePorCpf, buscarOSPorClienteId, atualizarOS } = require('../services/ixcService');
const { interpretarMensagem, responderComBaseNaIntent, interpretarDataNatural } = require('../services/openaiService');
const dayjs = require('dayjs');
const { enviarMensagemWhatsApp } = require('../services/twillioService');

const usuarios = {};

/**
 * Extrai CPF de uma string (com ou sem pontuação).
 * @param {string} texto 
 * @returns {string|null}
 */
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
    let intent, data, respostaGPT;

    // Usar a função interpretarMensagem passando objeto com todos os parâmetros
    const interpretacao = await interpretarMensagem({
      mensagem,
      agentId: 'default-agent',
      // Se já temos CPF, passamos algo em promptExtra, caso contrário '':
      promptExtra: (user.etapa === 'informar_cpf' && !!user.cpf)
        ? `Você já tem o CPF do cliente que é ${user.cpf}. O usuário deve te informar agora o número da OS a ser atualizada.`
        : '',
      intentAnterior: user.etapa,
      mensagemAnterior: user.mensagemAnterior || ''
    });

    intent = interpretacao.intent;
    data = interpretacao.data;
    respostaGPT = interpretacao.mensagem;

    log += `🧠 Intent detectada: ${intent}\n📦 Data extraída: ${JSON.stringify(data)}\n`;
    console.error('❌ intent:', intent);

    switch (intent) {
      case 'inicio':
        if (!user.cpf) {
          console.error('CPF:', user.cpf);
          resposta = await responderComBaseNaIntent('cpf_invalido', 'default-agent', '', 'Solicite o CPF para iniciar');
        } else {
          console.error('CPF não encontrado');
          resposta = respostaGPT || await responderComBaseNaIntent('inicio', 'default-agent', '', user.mensagemAnterior);
        }
        console.error('❌ Mensagem inválida recebida para interpretação:', resposta);
        user.etapa = 'informar_cpf';
        break;

      case 'aleatorio':
        // Exemplo: se quiser colocar a intentAnterior, altere a mensagem:
        // var intentAnteriorMsg = "Sua intent anterior era " + user.etapa + " - Você deve ...";
        resposta = respostaGPT || await responderComBaseNaIntent('aleatorio', 'default-agent', '');
        user.mensagemAnterior = mensagem;
        console.error('❌ Mensagem inválida recebida para interpretação:', resposta);
        user.etapa = 'inicio';
        break;

      case 'informar_cpf': {
        const cpf = extrairCpf(mensagem);
        if (!cpf) {
          resposta = await responderComBaseNaIntent('cpf_invalido', 'default-agent');
          break;
        }

        user.cpf = cpf;
        const clienteResp = await buscarClientePorCpf(cpf);
        log += `📡 Resultado da busca de cliente: ${JSON.stringify(clienteResp)}\n`;

        if (!clienteResp.cliente?.id) {
          resposta = await responderComBaseNaIntent('cpf_nao_encontrado', 'default-agent');
          break;
        }

        user.clienteId = clienteResp.cliente.id;
        user.nomeCliente = clienteResp.cliente.razao;

        const osList = await buscarOSPorClienteId(user.clienteId);
        log += `📋 OS encontradas: ${JSON.stringify(osList)}\n`;

        const abertas = osList.filter(os => ['A', 'AG', 'EN'].includes(os.status));
        if (abertas.length === 0) {
          resposta = await responderComBaseNaIntent('sem_os_aberta', 'default-agent');
          user.etapa = 'finalizado';
          break;
        }

        user.osList = abertas;
        user.etapa = 'escolher_os';
        user.osEscolhida = abertas;

        resposta = `✅ CPF identificado: ${user.nomeCliente}.\n\nEncontrei ${abertas.length} OS aberta(s):\n` +
          abertas.map(os => `• ${os.id} - ${os.mensagem || 'Sem descrição'}`).join('\n') +
          `\n\nQual delas você quer agendar? Me manda o número dela.`;
        user.mensagemAnterior = resposta;
        break;
      }

      case 'verificar_os': {
        const osList = await buscarOSPorClienteId(user.clienteId);
        log += `📋 OS encontradas: ${JSON.stringify(osList)}\n`;

        const abertas = osList.filter(os => ['A', 'AG', 'EN'].includes(os.status));
        if (abertas.length === 0) {
          resposta = await responderComBaseNaIntent('sem_os_aberta', 'default-agent');
          user.etapa = 'finalizado';
          break;
        }

        user.osList = abertas;
        user.etapa = 'escolher_os';
        user.osEscolhida = abertas;

        resposta = `Encontrei ${abertas.length} OS aberta(s):\n` +
          abertas.map(os => `• ${os.id} - ${os.mensagem || 'Sem descrição'}`).join('\n') +
          `\n\nQual delas você quer agendar? Me manda o número dela.`;
        user.mensagemAnterior = resposta;
        break;
      }

      case 'escolher_os': {
        if (!user.clienteId) {
          resposta = await responderComBaseNaIntent('faltando_cpf', 'default-agent');
          user.etapa = 'cpf';
          user.mensagemAnterior = resposta;
          break;
        }

        const os = user.osList?.find(os => os.id === mensagem);
        if (!os) {
          resposta = await responderComBaseNaIntent('os_nao_encontrada', 'default-agent');
          user.mensagemAnterior = resposta;
          break;
        }

        user.osEscolhida = os;
        user.etapa = 'agendar_data';

        const sugestao = dayjs().add(1, 'day').format('YYYY-MM-DD');
        resposta = `Qual dia quer agendar? (Sugestão: ${sugestao})`;
        user.mensagemAnterior = resposta;
        break;
      }

      case 'agendar_data': {
        const osEscolhida = user.osEscolhida?.['0'] || user.osEscolhida;
        const dataFinal = data?.data_agendamento;

        if (!user.clienteId) {
          resposta = await responderComBaseNaIntent('faltando_cpf', 'default-agent');
          user.mensagemAnterior = resposta;
          user.etapa = 'cpf';
          break;
        }

        if (!osEscolhida?.id) {
          resposta = await responderComBaseNaIntent('faltando_os', 'default-agent');
          user.mensagemAnterior = resposta;
          user.etapa = 'escolher_os';
          break;
        }

        if (!dataFinal) {
          resposta = await responderComBaseNaIntent('faltando_data', 'default-agent');
          user.mensagemAnterior = resposta;
          user.etapa = 'agendar_data';
          break;
        }

        const payloadOriginal = {
          ...osEscolhida,
          data_agenda_final: `${dataFinal} 10:00:00`,
          melhor_horario_agenda: 'M'
        };

        const resultado = await atualizarOS(osEscolhida.id, payloadOriginal);
        log += `🛠 Atualização OS: ${JSON.stringify(resultado)}\n`;

        resposta = resultado.mensagem || await responderComBaseNaIntent('agendamento_ok', 'default-agent');
        user.mensagemAnterior = resposta;
        user.etapa = 'finalizado';
        break;
      }

      case 'extrair_data': {
        const dataInterpretada = await interpretarDataNatural(mensagem);

        if (!dataInterpretada || !dayjs(dataInterpretada).isValid()) {
          resposta = await responderComBaseNaIntent('faltando_data', 'default-agent');
          user.mensagemAnterior = resposta;
          break;
        }

        const dataFormatada = dayjs(dataInterpretada).format('YYYY-MM-DD');
        user.dataProposta = dataFormatada;
        resposta = `📅 Entendi! A data informada é ${dayjs(dataFormatada).format('DD/MM/YYYY')}. Posso seguir com essa data para o agendamento?`;
        user.etapa = 'confirmar_agendamento';
        user.mensagemAnterior = resposta;
        break;
      }

      case 'confirmar_agendamento': {
        if (!user.dataProposta || !dayjs(user.dataProposta).isValid()) {
          resposta = await responderComBaseNaIntent('faltando_data', 'default-agent');
          user.etapa = 'agendar_data';
          user.mensagemAnterior = resposta;
          break;
        }

        const osEscolhida = user.osEscolhida?.['0'] || user.osEscolhida;

        if (!osEscolhida?.id) {
          resposta = await responderComBaseNaIntent('faltando_os', 'default-agent');
          user.etapa = 'escolher_os';
          user.mensagemAnterior = resposta;
          break;
        }

        const payloadOriginal = {
          ...osEscolhida,
          data_agenda_final: `${user.dataProposta} 10:00:00`,
          melhor_horario_agenda: 'M'
        };

        const resultado = await atualizarOS(osEscolhida.id, payloadOriginal);
        log += `🛠 Atualização OS: ${JSON.stringify(resultado)}\n`;

        resposta = resultado.mensagem || await responderComBaseNaIntent('agendamento_ok', 'default-agent');
        user.etapa = 'agendar_data';
        user.mensagemAnterior = resposta;
        break;
      }

      case 'finalizado':
      default:
        resposta = respostaGPT || await responderComBaseNaIntent('encerrado', 'default-agent');
        user.mensagemAnterior = resposta;

        // 🔄 Limpar todos os dados do usuário após finalização
        usuarios[numero] = { etapa: 'inicio' };
        break;
    }

    usuarios[numero] = user;

    if (!resposta) {
      resposta = await responderComBaseNaIntent('aleatorio', 'default-agent');
    }

    await enviarMensagemWhatsApp(numero, resposta);
    return res.json({ para: numero, status: '📤 Mensagem enviada via Twilio', mensagem: resposta, log });

  } catch (error) {
    const erroCompleto = error?.stack || error?.message || 'Erro desconhecido';
    log += `🔥 Erro detalhado:\n${erroCompleto}\n`;

    resposta = '❌ Opa! Deu um errinho aqui. Já estamos resolvendo. Tenta de novo daqui a pouco.';
    await enviarMensagemWhatsApp(numero, resposta);
    return res.json({ para: numero, status: '📤 Erro enviado via Twilio', mensagem: resposta, log });
  }
});

module.exports = router;
