const express = require('express');
const router = express.Router();
const { buscarClientePorCpf, buscarOSPorClienteId, atualizarOS } = require('../services/ixcService');
const { interpretarMensagem, responderComBaseNaIntent, interpretarDataNatural } = require('../services/openaiService');
const dayjs = require('dayjs');
const { enviarMensagemWhatsApp } = require('../services/twillioService');

// Armazena dados de sessão em memória (para cada número)
const usuarios = {};

/**
 * Atualiza o contexto do usuário (ex.: nome, interesses) no objeto user.contexto.
 * @param {Object} user
 * @param {string} chave
 * @param {string} valor
 */
function atualizarContextoUsuario(user, chave, valor) {
  if (!user.contexto) {
    user.contexto = {};
  }

  // Se a chave for "interesses", guardamos em array para acumular
  if (chave === 'interesses') {
    if (!Array.isArray(user.contexto.interesses)) {
      user.contexto.interesses = [];
    }
    // Evita duplicar
    if (!user.contexto.interesses.includes(valor)) {
      user.contexto.interesses.push(valor);
    }
  } else {
    // Armazena qualquer outra chave-valor
    user.contexto[chave] = valor;
  }
}

/**
 * Gera o texto que será passado em 'promptExtra', incluindo small talk.
 * @param {Object} user
 * @returns {string} Texto descrevendo nome e interesses, para small talk
 */
function gerarPromptExtra(user) {
  if (!user.contexto) return '';

  let extra = '';
  const nome = user.contexto.nome;
  const interesses = user.contexto.interesses;

  if (nome) {
    extra += `O usuário se chama ${nome}.\n`;
  }
  if (Array.isArray(interesses) && interesses.length > 0) {
    extra += `Ele/ela tem interesse em: ${interesses.join(', ')}.\n`;
  }

  if (extra) {
    extra += 'Por favor, faça um small talk sobre esses detalhes antes de retomar a ajuda.\n';
  }
  return extra;
}

/**
 * Tenta extrair o nome do usuário caso ele escreva "meu nome é X" (heurística simples).
 * @param {string} mensagem
 * @returns {string|null}
 */
function extrairNomeUsuario(mensagem) {
  // Exemplo bem simples:
  const regex = /meu nome é\s+([\p{L}\s]+)/iu;
  const match = mensagem.match(regex);
  if (match && match[1]) {
    return match[1].trim();
  }
  return null;
}

/**
 * Extrai CPF de uma string (com ou sem pontuação).
 * @param {string} texto
 * @returns {string|null}
 */
function extrairCpf(texto) {
  const match = texto.match(/\d{3}\.?\d{3}\.?\d{3}-?\d{2}/);
  return match ? match[0].replace(/[^\d]/g, '') : null;
}

/**
 * Rota principal que recebe mensagens via webhook (Twilio/WhatsApp).
 */
router.post('/', async (req, res) => {
  const mensagem = req.body.Body?.trim();
  const numero = req.body.From;

  const user = usuarios[numero] || { etapa: 'inicio' };

  let resposta = '';
  let log = `📥 Mensagem: "${mensagem}"\n👤 De: ${numero}\n📌 Etapa: ${user.etapa}\n`;

  try {
    // 1) Vamos acumular dados no contexto se encontrarmos algo
    //    Exemplo: se detectar "meu nome é X"
    const nomeCapturado = extrairNomeUsuario(mensagem);
    if (nomeCapturado) {
      atualizarContextoUsuario(user, 'nome', nomeCapturado);
    }
    // 2) Se a mensagem mencionar "alien" ou "alienígenas", adicionamos a interesses
    if (/alien(ígenas)?/i.test(mensagem)) {
      atualizarContextoUsuario(user, 'interesses', 'alienígenas');
    }

    // 3) Gera a string de contexto para small talk
    const contextoExtra = gerarPromptExtra(user);

    // 4) Interpreta a mensagem via GPT
    const interpretacao = await interpretarMensagem({
      mensagem: mensagem,
      agentId: 'default-agent',
      promptExtra: (
        user.etapa === 'informar_cpf' && !!user.cpf
      )
        ? `Você já tem o CPF do cliente que é ${user.cpf}. O usuário deve informar o número da OS.\n${contextoExtra}`
        : contextoExtra,
      intentAnterior: user.etapa,
      mensagemAnterior: user.mensagemAnterior || ''
    });

    const { intent, data, mensagem: respostaGPT } = interpretacao;
    log += `🧠 Intent detectada: ${intent}\n📦 Data extraída: ${JSON.stringify(data)}\n`;
    console.error('❌ intent:', intent);

    switch (intent) {
      case 'inicio': {
        if (!user.cpf) {
          resposta = respostaGPT || await responderComBaseNaIntent(
            'inicio',
            'default-agent',
            {},
            contextoExtra + '###IMPORTANTE - Peça o CPF###'
          );
        } else {
          resposta = respostaGPT || await responderComBaseNaIntent(
            'inicio',
            'default-agent',
            {},
            contextoExtra
          );
        }
        user.etapa = 'informar_cpf';
        user.mensagemAnterior = resposta;
        break;
      }

      case 'aleatorio': {

        if (!user.cpf) {
          resposta = respostaGPT || await responderComBaseNaIntent(
            'inicio',
            'default-agent',
            {},
            'IMPORTANTE - Peça o CPF'
          );          
          console.error('aleatorio CPF if:', !user.cpf);
        } else{
          
          console.error('aleatorio CPF else:', !user.cpf);
          resposta = respostaGPT || await responderComBaseNaIntent(
            'aleatorio',
            'default-agent',
            {},
            contextoExtra
          );
        }
        user.etapa = 'inicio';
        user.mensagemAnterior = resposta;
        break;
      }

      case 'help': {
        resposta = respostaGPT || await responderComBaseNaIntent(
          'help',
          'default-agent',
          {},
          contextoExtra
        );
        user.mensagemAnterior = resposta;
        break;
      }

      case 'desconhecido': {
        resposta = respostaGPT || await responderComBaseNaIntent(
          'desconhecido',
          'default-agent',
          {},
          contextoExtra
        );
        user.mensagemAnterior = resposta;
        break;
      }

      case 'informar_cpf': {
        console.error('extrairCpf mensagem:', mensagem);
        const cpf = extrairCpf(mensagem);
        
        console.error('extrairCpf reposta variavel cpf mensagem:', mensagem);
        
        console.error('!cpf:', !cpf);
        if (!cpf) {
          resposta = await responderComBaseNaIntent(
            'cpf_invalido',
            'default-agent',
            {},
            contextoExtra
          );
          
        console.error('extrairCpf resposta:', resposta);
          break;
        }
        
        console.error('!passou:');

        user.cpf = cpf;
        const clienteResp = await buscarClientePorCpf(cpf);
        log += `📡 Resultado da busca de cliente: ${JSON.stringify(clienteResp)}\n`;

        if (!clienteResp.cliente?.id) {
          resposta = await responderComBaseNaIntent(
            'cpf_nao_encontrado',
            'default-agent',
            {},
            contextoExtra
          );
          break;
        }

        user.clienteId = clienteResp.cliente.id;
        user.nomeCliente = clienteResp.cliente.razao;

        const osList = await buscarOSPorClienteId(user.clienteId);
        log += `📋 OS encontradas: ${JSON.stringify(osList)}\n`;

        const abertas = osList.filter(os => ['A', 'AG', 'EN'].includes(os.status));
        if (abertas.length === 0) {
          resposta = await responderComBaseNaIntent(
            'sem_os_aberta',
            'default-agent',
            {},
            contextoExtra
          );
          user.etapa = 'finalizado';
          break;
        }

        user.osList = abertas;
        user.osEscolhida = abertas;
        user.etapa = 'escolher_os';

        resposta =
          `✅ Achei seu cadastro ${user.nomeCliente}.\n\nEncontrei ${abertas.length} OS(s) abertas:\n` +
          abertas.map(os => `• ${os.id} - ${os.mensagem || 'Sem descrição'}`).join('\n') +
          `\n\nPor motivos de segurança por favor me diga o número da OS que deseja agendar.`;
        user.mensagemAnterior = resposta;
        break;
      }

      case 'verificar_os': {
        if (!user.clienteId) {
          resposta = await responderComBaseNaIntent(
            'faltando_cpf',
            'default-agent',
            {},
            contextoExtra
          );
          user.mensagemAnterior = resposta;
          user.etapa = 'cpf';
          break;
        }

        const osList = await buscarOSPorClienteId(user.clienteId);
        log += `📋 OS encontradas: ${JSON.stringify(osList)}\n`;

        const abertas = osList.filter(os => ['A', 'AG', 'EN'].includes(os.status));
        if (abertas.length === 0) {
          resposta = await responderComBaseNaIntent(
            'sem_os_aberta',
            'default-agent',
            {},
            contextoExtra
          );
          user.etapa = 'finalizado';
          break;
        }

        user.osList = abertas;
        user.osEscolhida = abertas;
        user.etapa = 'escolher_os';

        resposta =
          `Encontrei ${abertas.length} OS(s) abertas:\n` +
          abertas.map(os => `• ${os.id} - ${os.mensagem || 'Sem descrição'}`).join('\n') +
          `\n\nPor motivos de segurança por favor qual OS deseja saber mais informações.`;
        user.mensagemAnterior = resposta;
        break;
      }

      case 'escolher_os': {
        if (!user.clienteId) {
          resposta = await responderComBaseNaIntent(
            'faltando_cpf',
            'default-agent',
            {},
            contextoExtra
          );
          user.etapa = 'cpf';
          user.mensagemAnterior = resposta;
          break;
        }

        const os = user.osList?.find(o => o.id === mensagem);
        if (!os) {
          resposta = await responderComBaseNaIntent(
            'os_nao_encontrada',
            'default-agent',
            {},
            contextoExtra
          );
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
          resposta = await responderComBaseNaIntent(
            'faltando_cpf',               // Intent
            'default-agent',              // agentId
            {
              info: 'Para prosseguir, precisamos do CPF do usuário.',
              osEscolhida: user.osEscolhida // Inclui as informações sobre OS
            },
            contextoExtra
          );
          user.mensagemAnterior = resposta;
          user.etapa = 'cpf';
          break;
        }
        
        // 2) Verifica se não há OS escolhida
        if (!osEscolhida?.id) {
          resposta = await responderComBaseNaIntent(
            'faltando_os',
            'default-agent',
            {
              info: 'Por favor, precisamos que o usuário escolha a OS para agendar.',
              osEscolhida: user.osEscolhida // Inclui todas as infos da OS
            },
            contextoExtra
          );
          user.mensagemAnterior = resposta;
          user.etapa = 'escolher_os';
          break;
        }
        
        // 3) Verifica se não há data para agendamento
        if (!dataFinal) {
          resposta = await responderComBaseNaIntent(
            'faltando_data',
            'default-agent',
            {
              info: 'O usuário deve informar a melhor data para a visita técnica.',
              osEscolhida: user.osEscolhida
            },
            contextoExtra
          );
          user.mensagemAnterior = resposta;
          user.etapa = 'agendar_data';
          break;
        }
        
        // Se passou por todas as verificações, prossiga normalmente
        const payloadOriginal = {
          ...osEscolhida,
          data_agenda_final: `${dataFinal} 10:00:00`,
          melhor_horario_agenda: 'M'
        };
        
        const resultado = await atualizarOS(osEscolhida.id, payloadOriginal);
        log += `🛠 Atualização OS: ${JSON.stringify(resultado)}\n`;
        
        resposta = resultado.mensagem || await responderComBaseNaIntent(
          'agendamento_ok',
          'default-agent',
          {
            info: 'Sua OS foi agendada com sucesso, obrigado pelo contato.',
            osEscolhida: user.osEscolhida
          },
          contextoExtra
        );
        
        user.mensagemAnterior = resposta;
        user.etapa = 'finalizado';
      }

      case 'extrair_data': {
        const dataInterpretada = await interpretarDataNatural(mensagem);
        if (!dataInterpretada || !dayjs(dataInterpretada).isValid()) {
          resposta = await responderComBaseNaIntent(
            'faltando_data',
            'default-agent',
            {},
            contextoExtra
          );
          user.mensagemAnterior = resposta;
          break;
        }

        const dataFormatada = dayjs(dataInterpretada).format('YYYY-MM-DD');
        user.dataProposta = dataFormatada;
        resposta =
          `📅 Entendi! A data informada é ${dayjs(dataFormatada).format('DD/MM/YYYY')}. ` +
          `Posso seguir com essa data para o agendamento?`;
        user.etapa = 'confirmar_agendamento';
        user.mensagemAnterior = resposta;
        break;
      }

      case 'confirmar_agendamento': {
        if (!user.dataProposta || !dayjs(user.dataProposta).isValid()) {
          resposta = await responderComBaseNaIntent(
            'faltando_data',
            'default-agent',
            {},
            contextoExtra
          );
          user.etapa = 'agendar_data';
          user.mensagemAnterior = resposta;
          break;
        }

        const osEscolhida = user.osEscolhida?.['0'] || user.osEscolhida;
        if (!osEscolhida?.id) {
          resposta = await responderComBaseNaIntent(
            'faltando_os',
            'default-agent',
            {},
            contextoExtra
          );
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

        resposta = resultado.mensagem || await responderComBaseNaIntent(
          'agendamento_ok',
          'default-agent',
          {},
          contextoExtra
        );
        user.etapa = 'finalizado';
        user.mensagemAnterior = resposta;
        break;
      }

      case 'finalizado':
      default:
        resposta = respostaGPT || await responderComBaseNaIntent(
          'encerrado',
          'default-agent',
          {},
          contextoExtra
        );
        user.mensagemAnterior = resposta;

        // Limpar todos os dados do usuário
        usuarios[numero] = { etapa: 'inicio' };
        break;
    }

    // Persistimos o user atualizado
    usuarios[numero] = user;

    // Fallback se não houve resposta
    if (!resposta) {
      resposta = await responderComBaseNaIntent(
        'aleatorio',
        'default-agent',
        {},
        gerarPromptExtra(user)
      );
    }

    await enviarMensagemWhatsApp(numero, resposta);
    return res.json({
      para: numero,
      status: '📤 Mensagem enviada via Twilio',
      mensagem: resposta,
      log
    });

  } catch (error) {
    const erroCompleto = error?.stack || error?.message || 'Erro desconhecido';
    log += `🔥 Erro detalhado:\n${erroCompleto}\n`;

    resposta = '❌ Opa! Deu um errinho aqui. Já estamos resolvendo. Tenta de novo daqui a pouco.';
    await enviarMensagemWhatsApp(numero, resposta);

    return res.json({
      para: numero,
      status: '📤 Erro enviado via Twilio',
      mensagem: resposta,
      log
    });
  }
});

module.exports = router;
