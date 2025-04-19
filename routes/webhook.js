const express = require('express');
const router = express.Router();
const { buscarClientePorCpf, buscarOSPorClienteId, atualizarOS } = require('../services/ixcService');
const { interpretarMensagem, responderComBaseNaIntent, interpretarDataNatural } = require('../services/openaiService');
const dayjs = require('dayjs');
const { enviarMensagemWhatsApp } = require('../services/twillioService');
const boolSalvarConversa = false;

// Armazena dados de sessão em memória (para cada número)
const usuarios = {};

/**
 * Atualiza o contexto do usuário (ex.: nome, interesses) no objeto user.contexto.
 * @param {Object} user
 * @param {string} chave
 * @param {string} valor
 */
function geraDados(intentAnterior, mensagemAnterior, mensagemAnteriorCliente, mensagem, user, observacao ){

  return{
    intentAnterior: intentAnterior,
    mensagemAnteriorGPT: mensagemAnterior,
    mensagemAnteriorCliente: mensagemAnteriorCliente,
    mensagemAtualCliente: mensagem,
    mensagemAnteriorCliente : user.mensagemAnteriorCliente,
    etapaAnterior : user.etapaAnterior,
    mensagemAnteriorGPT : user.mensagemAnteriorGPT,
    cpf : user.cpf,
    clienteId : user.clienteId,
    nome : user.nomeCliente,
    osList : user.osList,
    osEscolhida : user.osEscolhida,
    etapaAtual : user.etapaAtual,
    observacao : observacao || ''
  };
}

function atualizarContextoUsuario(user, chave, valor) {
  
  console.log(`INICIO LOGS`);
  console.log(`user`  + user.contexto);

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
  // Exemplo bem simples * MELHORAR:
  const regex = /meu nome é\s+([\p{L}\s]+)/iu;
  const match = mensagem.match(regex);
  if (match && match[1]) {
    return match[1].trim();
  }
  return null;
}
//await retornaAssunto(intentAnterior, contextoExtra, mensagemAnterior, intent,mensagemAnteriorCliente, mensagem);
async function retornaAssunto(intentAnterior, contextoExtra, mensagemAnterior, intent, respostaGPT,mensagemAnteriorCliente,mensagem) {


  console.log(`### intentAnterior ### : `+intentAnterior);
  console.log(`### contextoExtra ### : `+contextoExtra);
  console.log(`### mensagemAnterior ### : `+mensagemAnterior);
  console.log(`### intent ### : `+intent);
  console.log(`### respostaGPT ### : `+respostaGPT);
  console.log(`### mensagemAnteriorCliente ### : `+mensagemAnteriorCliente);
  console.log(`### mensagem ### : `+mensagem);



  let mensagemCustomizada = '';
  switch (intentAnterior) {
    case 'verificar_os':
    case 'escolher_os':
      mensagemCustomizada = 'Peça novamente o número da OS para ser verificada';
      break;
    case 'agendar_data':
    case 'extrair_data':
      mensagemCustomizada = 'Peça novamente a data que deseja agendar a OS';
      break;
    case 'confirmar_agendamento':
      mensagemCustomizada = 'Peça novamente para confirmar o agendamento';
      break;
    default:
      mensagemCustomizada = 'Retome o fluxo com a etapa anterior';
      break;
  }
  return respostaGPT || await responderComBaseNaIntent(
    intent,
    'default-agent',
    geraDados(intentAnterior, mensagemAnterior, mensagemAnteriorCliente, mensagem, user, mensagemCustomizada)
  );
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

  console.log(`### Mensagem Recebida do Usuário ### : `+mensagem);

  const user = usuarios[numero] || { etapa: 'inicio' };
  const mensagemAnteriorCliente = user.mensagemAnteriorCliente || '';

  let resposta = '';
  let log = `📥 Mensagem: "${mensagem}"\n👤 De: ${numero}\n📌 Etapa: ${user.etapaAnterior}\n`;

  try {

    //Remover
    const nomeCapturado = extrairNomeUsuario(mensagem);
    if (nomeCapturado) {
      atualizarContextoUsuario(user, 'nome', nomeCapturado);
    }
    const contextoExtra = gerarPromptExtra(user);
    var intentAnterior = user.etapaAnterior || '';
    var mensagemAnterior = user.mensagemAnteriorGPT || '';
    //Remover

    //Início - Busca intent
    const interpretacao = await interpretarMensagem({
      mensagem: mensagem,
      agentId: 'default-agent',
      // promptExtra: (
      //   user.etapaAnterior === 'informar_cpf' && !!user.cpf
      // )
      //   ? `Você já tem o CPF do cliente que é ${user.cpf}. O usuário deve informar o número da OS.\n${contextoExtra}`

      promptExtra: geraDados(intentAnterior, mensagemAnterior, mensagemAnteriorCliente, mensagem, user ),
      intentAnterior: intentAnterior,
      mensagemAnteriorGPT: user.mensagemAnteriorGPT || ''
    });
  
    //Carrega as variaveis da intent
    const /{ intent, data, mensagem: respostaGPT } = interpretacao;
    log += `🧠 Intent detectada: ${intent}\n📦 Data extraída: ${JSON.stringify(data)}\n`;
    console.error('🧠 intent:', intent);
    user.etapaAtual = intent;
    switch (intent) {
      case 'inicio': {
        if (!user.cpf) {
          resposta = respostaGPT || await responderComBaseNaIntent(
            'inicio',
            'default-agent',geraDados(intentAnterior, mensagemAnterior, mensagemAnteriorCliente, mensagem, user ),
            contextoExtra + '###IMPORTANTE - Peça o CPF###'
          );
        } else {
          resposta = respostaGPT || await responderComBaseNaIntent(
            'agendar-os',
            'default-agent',geraDados(intentAnterior, mensagemAnterior, mensagemAnteriorCliente, mensagem, user ),
            contextoExtra + '###IMPORTANTE -Não peça o CPF###'
          );
        }
        user.mensagemAnteriorGPT = resposta;
                console.error('🧠 intent fim:', intent);
        break;
      }

      case 'aleatorio': {
        
        console.error('🧠🧠🧠 Entrou no aleatorio');
        console.error('🧠🧠🧠 !user.cpf:', !user.cpf);
        if (!user.cpf) {
          resposta = respostaGPT || await responderComBaseNaIntent(
            'inicio',
            'default-agent',geraDados(intentAnterior, mensagemAnterior, mensagemAnteriorCliente, mensagem, user ),
            'IMPORTANTE - Peça o CPF'
          );          
          console.error('aleatorio CPF if:', !user.cpf);
        } else{
          
          console.error('aleatorio CPF else:', !user.cpf);
          if(intentAnterior ===  'verificar_os' || 'escolher_os' || 'agendar_data' || 'extrair_data' || 'confirmar_agendamento')
          {
            console.error('aleatorio CPF else intentAnterior:', intentAnterior);
            resposta = await retornaAssunto(intentAnterior, contextoExtra, mensagemAnterior, intent,mensagemAnteriorCliente, mensagem);
            
            console.error('resposta retornaAssunto:', resposta);
          }
          else{
            console.error('aleatorio CPF else:', !user.cpf);
            resposta = respostaGPT || await responderComBaseNaIntent(
              'aleatorio',
              'default-agent',
              geraDados(intentAnterior, mensagemAnterior, mensagemAnteriorCliente, mensagem, user ),
              contextoExtra
            );
          }
        }
        user.etapaAnterior = intent;
        user.mensagemAnteriorGPT = resposta;
        console.error('🧠 mensagemAnteriorGPT',user.mensagemAnteriorGPT);
        console.error('🧠 mensagemAnteriorCliente',user.mensagemAnteriorCliente);
        console.error('🧠 intent fim:', intent);
        break;
      }

      case 'help': {
        resposta = respostaGPT || await responderComBaseNaIntent(
          'help',
          'default-agent',
          geraDados(intentAnterior, mensagemAnterior, mensagemAnteriorCliente, mensagem, user ),
          contextoExtra
        );
        user.mensagemAnteriorGPT = resposta;
        console.error('🧠 intent fim:', intent);
        break;
      }

      case 'desconhecido': {
        resposta = respostaGPT || await responderComBaseNaIntent(
          'desconhecido',
          'default-agent',
           
        geraDados(intentAnterior, mensagemAnterior, mensagemAnteriorCliente, mensagem, user ),
          contextoExtra
        );
        user.mensagemAnteriorGPT = resposta;
        console.error('🧠 intent fim:', intent);
        break;
      }

      case 'informar_cpf': {
        console.error('extrairCpf mensagem:', mensagem);
        const cpf = extrairCpf(mensagem);
        
        console.error('extrairCpf reposta variavel cpf mensagem:', mensagem);
        
        console.error('!cpf:', !cpf);
        if (!cpf) {

          var mensagemExtra = !cpf ? 'Pedir para digitar o CPF (CPF não foi digitado na msg anterior)' :'Pedir para digitar o CPF correto:';
          resposta = await responderComBaseNaIntent(
            'cpf_invalido',
            'default-agent',geraDados(intentAnterior, mensagemAnterior, mensagemAnteriorCliente, mensagem, user ),
            contextoExtra
          );
          
        console.error('extrairCpf resposta:', resposta);
          console.error('🧠 intent fim:', intent);
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
             
        geraDados(intentAnterior, mensagemAnterior, mensagemAnteriorCliente, mensagem, user ),
            contextoExtra
          );
          console.error('🧠 intent fim:', intent);
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
             
        geraDados(intentAnterior, mensagemAnterior, mensagemAnteriorCliente, mensagem, user ),
            contextoExtra
          );
          user.etapaAnterior = 'finalizado';
          console.error('🧠 intent fim:', intent);
        break;
        }

        user.osList = abertas;
        user.osEscolhida = abertas;
        user.etapaAnterior = 'escolher_os';

        resposta =
          `✅ Achei seu cadastro ${user.nomeCliente}.\n\nEncontrei ${abertas.length} OS(s) abertas:\n` +
          abertas.map(os => `• ${os.id} - ${os.mensagem || 'Sem descrição'}`).join('\n') +
          `\n\nPor motivos de segurança por favor me diga o número da OS que deseja agendar.`;
        user.mensagemAnteriorGPT = resposta;
        console.error('🧠 intent fim:', intent);
        break;
      }

      case 'verificar_os': {
        if (!user.clienteId) {
          resposta = await responderComBaseNaIntent(
            'faltando_cpf',
            'default-agent',geraDados(intentAnterior, mensagemAnterior, mensagemAnteriorCliente, mensagem, user ),
            contextoExtra
          );
          user.mensagemAnteriorGPT = resposta;
          user.etapaAnterior = 'cpf';
          console.error('🧠 intent fim:', intent);
        break;
        }

        const osList = await buscarOSPorClienteId(user.clienteId);
        log += `📋 OS encontradas: ${JSON.stringify(osList)}\n`;

        const abertas = osList.filter(os => ['A', 'AG', 'EN'].includes(os.status));
        if (abertas.length === 0) {
          resposta = await responderComBaseNaIntent(
            'sem_os_aberta',
            'default-agent',geraDados(intentAnterior, mensagemAnterior, mensagemAnteriorCliente, mensagem, user ),
            contextoExtra
          );
          user.etapaAnterior = 'finalizado';
          console.error('🧠 intent fim:', intent);
        break;
        }

        user.osList = abertas;
        user.osEscolhida = abertas;
        user.etapaAnterior = 'escolher_os';

        resposta =
          `Encontrei ${abertas.length} OS(s) abertas:\n` +
          abertas.map(os => `• ${os.id} - ${os.mensagem || 'Sem descrição'}`).join('\n') +
          `\n\nPor motivos de segurança por favor qual OS deseja saber mais informações.`;
        user.mensagemAnteriorGPT = resposta;
        console.error('🧠 intent fim:', intent);
        break;
      }
      case 'escolher_os': {
        if (!user.clienteId) {
          resposta = await responderComBaseNaIntent(
            'faltando_cpf',
            'default-agent',geraDados(intentAnterior, mensagemAnterior, mensagemAnteriorCliente, mensagem, user ),
            contextoExtra
          );
          user.etapaAnterior = 'cpf';
          user.mensagemAnteriorGPT = resposta;
          console.error('🧠 intent fim:', intent);
        break;
        }

        const os = user.osList?.find(o => o.id === mensagem);
        if (!os) {
          resposta = await responderComBaseNaIntent(
            'os_nao_encontrada',
            'default-agent',geraDados(intentAnterior, mensagemAnterior, mensagemAnteriorCliente, mensagem, user ),
            contextoExtra
          );
          user.mensagemAnteriorGPT = resposta;
          console.error('🧠 intent fim:', intent);
        break;
        }

        user.osEscolhida = os;
        user.etapaAnterior = 'agendar_data';

        const sugestao = dayjs().add(1, 'day').format('YYYY-MM-DD');
        resposta = `Qual dia quer agendar? (Sugestão: ${sugestao})`;
        user.mensagemAnteriorGPT = resposta;
        console.error('🧠 intent fim:', intent);
        break;
      }

      case 'agendar_data': {
        const osEscolhida = user.osEscolhida?.['0'] || user.osEscolhida;
        const dataFinal = data?.data_agendamento;
        const horarioInterpretado = user.horarioInterpretado;

        if (!user.clienteId) {
          resposta = await responderComBaseNaIntent(
            'faltando_cpf',               // Intent
            'default-agent', geraDados(intentAnterior, mensagemAnterior, mensagemAnteriorCliente, mensagem, user, 'Para prosseguir, precisamos do CPF do usuário.' )
            ,
            contextoExtra
          );
          user.mensagemAnteriorGPT = resposta;
          user.etapaAnterior = 'cpf';
          console.error('🧠 intent fim:', intent);
        break;
        }
        
        // 2) Verifica se não há OS escolhida
        if (!osEscolhida?.id) {
          resposta = await responderComBaseNaIntent(
            'faltando_os',
            'default-agent',geraDados(intentAnterior, mensagemAnterior, mensagemAnteriorCliente, mensagem, user, 'Por favor, precisamos que o usuário escolha a OS para agendar. Os escolhida:'+ user.osEscolhida ),
            contextoExtra
          );
          user.mensagemAnteriorGPT = resposta;
          user.etapaAnterior = 'escolher_os';
          console.error('🧠 intent fim:', intent);
        break;
        }
        
        // 3) Verifica se não há data para agendamento
        if (!dataFinal) {
          resposta = await responderComBaseNaIntent(
            'faltando_data',
            'default-agent',geraDados(intentAnterior, mensagemAnterior, mensagemAnteriorCliente, mensagem, user, 'O usuário deve informar a melhor data para a visita técnica.:'+ user.osEscolhida ),
            contextoExtra
          );
          user.mensagemAnteriorGPT = resposta;
          user.etapaAnterior = 'agendar_data';
          console.error('🧠 intent fim:', intent);
        break;
        }
        
        if (!horarioInterpretado) {
          resposta = await responderComBaseNaIntent(
            'faltando_horario',
            'default-agent',geraDados(intentAnterior, mensagemAnterior, mensagemAnteriorCliente, mensagem, user, 'O usuário deve informar a melhor data para a visita técnica.:'+ user.osEscolhida ),
            contextoExtra
          );
          user.mensagemAnteriorGPT = resposta;
          user.etapaAnterior = 'agendar_data';
          console.error('🧠 intent fim:', intent);
        break;
        }

        // Se passou por todas as verificações, prossiga normalmente
        const payloadOriginal = {
          ...osEscolhida,
          data_agenda_final: `${dataFinal}+ ${horario}`,
          melhor_horario_agenda: 'M'
        };
        
        const resultado = await atualizarOS(osEscolhida.id, payloadOriginal);
        log += `🛠 Atualização OS: ${JSON.stringify(resultado)}\n`;
        
        resposta = resultado.mensagem || await responderComBaseNaIntent(
          'agendamento_ok',
          'default-agent',geraDados(intentAnterior, mensagemAnterior, mensagemAnteriorCliente, mensagem, user, 'Seu agendamento foi efetuado com sucesso!'+ user.osEscolhida ),
          contextoExtra
        );
        
        user.mensagemAnteriorGPT = resposta;
        user.etapaAnterior = 'finalizado';
      }
      
      case 'extrair_hora': {
        const horarioInterpretado = await interpretaHora(mensagem);
        if (!dataInterpretada || !dayjs(dataInterpretada).isValid()) {
          resposta = await responderComBaseNaIntent(
            'faltando_hora',
            'default-agent',             
            geraDados(intentAnterior, mensagemAnterior, mensagemAnteriorCliente, mensagem, user ),
            contextoExtra
          );

          user.horarioInterpretado = horarioInterpretado;
          user.mensagemAnteriorGPT = resposta;
          console.error('🧠 intent fim:', intent);
        break;
        }

        const dataFormatada = dayjs(dataInterpretada).format('YYYY-MM-DD');
        user.dataProposta = dataFormatada;
        resposta =
          `📅 Entendi! A data informada é ${dayjs(dataFormatada).format('DD/MM/YYYY')}. ` +
          `Posso seguir com essa data para o agendamento?`;
        user.etapaAnterior = intent;
        user.mensagemAnteriorGPT = resposta;
        console.error('🧠 intent fim:', intent);
        break;
      }

      case 'extrair_data': {
        const dataInterpretada = await interpretarDataNatural(mensagem);
        if (!dataInterpretada || !dayjs(dataInterpretada).isValid()) {
          resposta = await responderComBaseNaIntent(
            'faltando_data',
            'default-agent',
             
        geraDados(intentAnterior, mensagemAnterior, mensagemAnteriorCliente, mensagem, user ),
            contextoExtra
          );
          user.etapaAnterior = intent;
          user.mensagemAnteriorGPT = resposta;
          console.error('🧠 intent fim:', intent);
        break;
        }

        const horarioInterpretado = user.horarioInterpretado;
        if (!horarioInterpretado) {
        resposta = await responderComBaseNaIntent(
        'faltando_horario',
        'default-agent',
        {
          info: 'O usuário deve informar o melhor horario para a visita técnica.',
          osEscolhida: user.osEscolhida
        },
          contextoExtra
        )}
        else{
          const dataFormatada = dayjs(dataInterpretada).format('YYYY-MM-DD');
          user.dataProposta = dataFormatada;
          resposta =
            `📅 Entendi! A data informada é ${dayjs(dataFormatada).format('DD/MM/YYYY')}. ` +
            `Posso seguir com essa data para o agendamento?`;
          
        }
        user.etapaAnterior = intent;
        user.mensagemAnteriorGPT = resposta;
        console.error('🧠 intent fim:', intent);
        break;
      }

      case 'confirmar_agendamento': {
        if (!user.dataProposta || !dayjs(user.dataProposta).isValid()) {
          resposta = await responderComBaseNaIntent(
            'faltando_data',
            'default-agent',
             
        geraDados(intentAnterior, mensagemAnterior, mensagemAnteriorCliente, mensagem, user ),
            contextoExtra
          );
          user.etapaAnterior = intent;
          user.mensagemAnteriorGPT = resposta;
          console.error('🧠 intent fim:', intent);
        break;
        }

        const osEscolhida = user.osEscolhida?.['0'] || user.osEscolhida;
        if (!osEscolhida?.id) {
          resposta = await responderComBaseNaIntent(
            'faltando_os',
            'default-agent',
             
          geraDados(intentAnterior, mensagemAnterior, mensagemAnteriorCliente, mensagem, user ),
              contextoExtra
            );
      
          user.etapaAnterior = intent;
          user.mensagemAnteriorGPT = resposta;
          console.error('🧠 intent fim:', intent);
        break;
        }

        const payloadOriginal = {
          ...osEscolhida,
          data_agenda_final: `${user.dataProposta} + ${user.horarioInterpretado}`,
          melhor_horario_agenda: 'M'
        };

        const resultado = await atualizarOS(osEscolhida.id, payloadOriginal);
        log += `🛠 Atualização OS: ${JSON.stringify(resultado)}\n`;

        resposta = resultado.mensagem || await responderComBaseNaIntent(
          'agendamento_ok',
          'default-agent',
           
        geraDados(intentAnterior, mensagemAnterior, mensagemAnteriorCliente, mensagem, user ),
          contextoExtra
        );
        user.etapaAnterior = intent;
        user.mensagemAnteriorGPT = resposta;
        console.error('🧠 intent fim:', intent);
        break;
      }

      case 'finalizado':
      default:
        resposta = respostaGPT || await responderComBaseNaIntent(
          'encerrado',
          'default-agent',           
          geraDados(intentAnterior, mensagemAnterior, mensagemAnteriorCliente, mensagem, user, 'De despeça e agradeça pela conversa'),
          contextoExtra
        );
        user.mensagemAnteriorGPT = resposta;

        // Limpar todos os dados do usuário
        usuarios[numero] = { etapa: 'inicio' };
        console.error('🧠 intent fim:', intent);
        break;
    }

    // Persistimos o user atualizado
    usuarios[numero] = user;

    // Fallback se não houve resposta
    if (!resposta) {
      resposta = await responderComBaseNaIntent(
        'aleatorio',
        'default-agent',         
        geraDados(intentAnterior, mensagemAnterior, mensagemAnteriorCliente, mensagem, user ),
        gerarPromptExtra(user)
      );
    }

    await enviarMensagemWhatsApp(numero, resposta);
    const { salvarConversa } = require('../services/conversaService');

    if(boolSalvarConversa){
      await salvarConversa({
        numero,
        mensagem_usuario: mensagem,
        mensagem_sistema: resposta,
        intent,
        etapa: user.etapaAtual,
        dados_extras: {
          cpf: user.cpf,
          clienteId: user.clienteId,
          osEscolhida: user.osEscolhida,
          nomeCliente: user.nomeCliente
        }
      });
    }


    user.mensagemAnteriorCliente = mensagem;

      
    console.error('user.mensagemAnteriorCliente : ' + user.mensagemAnteriorCliente);
    console.error('user.etapaAnterior : ' + user.etapaAnterior);
    console.error('user.mensagemAnteriorGPT : ' + user.mensagemAnterior);
    console.error('user.cpf : ' + user.cpf);
    console.error('user.clienteId : ' + user.clienteId);
    console.error('user.nomeCliente :  ' + user.nomeCliente );
    console.error('user.osList :  ' + user.osList );
    console.error('user.osEscolhida : ' + user.osEscolhida);
    console.error('user.etapaAtual : ' + user.etapaAtual);
    

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
    const { salvarConversa } = require('../services/conversaService');

    if(boolSalvarConversa){
      await salvarConversa({
        numero,
        mensagem_usuario: mensagem,
        mensagem_sistema: resposta,
        intent,
        etapa: user.etapaAnterior,
        dados_extras: {
          cpf: user.cpf,
          clienteId: user.clienteId,
          osEscolhida: user.osEscolhida,
          nomeCliente: user.nomeCliente
        }
      });
    }
    return res.json({
      para: numero,
      status: '📤 Erro enviado via Twilio',
      mensagem: resposta,
      log
    });
  }
});

module.exports = router;
