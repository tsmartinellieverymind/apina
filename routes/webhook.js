const express = require('express');
const router = express.Router();
const dayjs = require('dayjs');
const boolSalvarConversa = false;
const { enviarMensagemWhatsApp } = require('../services/twillioService');
const { buscarClientePorCpf, buscarOSPorClienteId, atualizarOS } = require('../services/ixcService');
const { detectarIntentComContexto, gerarMensagemDaIntent, interpretarDataNatural, interpretarNurmeroOS } = require('../services/openaiService');

// Armazena dados de sessão em memória (para cada número)
const usuarios = {};

function gerarPromptContextualizado(dados) {
  let linhas = [];

  if (dados.nome) linhas.push(`O usuário se chama ${dados.nome}.`);
  if (dados.cpf) linhas.push(`O CPF informado é ${dados.cpf}.`);
  if (dados.osEscolhida?.id) linhas.push(`A OS escolhida é ${dados.osEscolhida.id}.`);
  if (dados.etapaAnterior) linhas.push(`A etapa anterior foi "${dados.etapaAnterior}".`);
  if (dados.mensagemAnteriorGPT) linhas.push(`Sua mensagem anterior: "${dados.mensagemAnteriorGPT}".`);
  if (dados.mensagemAnteriorCliente) linhas.push(`A última mensagem do cliente foi: "${dados.mensagemAnteriorCliente}".`);
  if (dados.mensagemAtualCliente) linhas.push(`A nova mensagem enviada foi: "${dados.mensagemAtualCliente}".`);
  if (dados.observacao) linhas.push(`Observação adicional: ${dados.observacao}`);

  return linhas.join('\n');
}

/**
 * Atualiza o contexto do usuário (ex.: nome, interesses) no objeto user.contexto.
 * @param {Object} user
 * @param {string} chave
 * @param {string} valor
 */
function geraDados(intentAnterior, mensagemAnterior, mensagemAnteriorCliente, mensagem, user, observacao) {
  console.log('\n📦 === [geraDados] Entrando na função ===');
  console.log('🧠 intentAnterior:', intentAnterior);
  console.log('💬 mensagemAnteriorGPT:', mensagemAnterior);
  console.log('💬 mensagemAnteriorGPT user:', user.mensagemAnteriorGPT);
  console.log('💬 mensagemAnteriorCliente:', mensagemAnteriorCliente);
  console.log('💬 mensagemAtualCliente:', mensagem);
  console.log('👤 user:', JSON.stringify(user, null, 2));
  console.log('📝 observacao:', observacao);

  const dados = {
    intentAnterior: intentAnterior,
    mensagemAnteriorGPT: mensagemAnterior,
    mensagemAnteriorCliente: mensagemAnteriorCliente,
    mensagemAtualCliente: mensagem,
    mensagemAnteriorCliente: user.mensagemAnteriorCliente,
    etapaAnterior: user.etapaAnterior,
    mensagemAnteriorGPT: user.mensagemAnteriorGPT,
    cpf: user.cpf,
    clienteId: user.clienteId,
    nome: user.nomeCliente,
    osList: user.osList,
    osEscolhida: user.osEscolhida,
    dataEscolhidaAgendamento: user.dataInterpretada,
    etapaAtual: user.etapaAtual,
    observacao: observacao || ''
  };

  console.log('📤 === [geraDados] Dados gerados ===');
  console.log(JSON.stringify(dados, null, 2));

  return dados;
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

  //Inicializa o usuário com a sessão já aberta ou cria outra
  const user = usuarios[numero] || { etapa: 'inicio' };
  const mensagemAnteriorCliente = user.mensagemAnteriorCliente || '';

  let resposta = '';

  //Inicia
  try {

    var intentAnterior = user.etapaAnterior || '';
    var mensagemAnterior = user.mensagemAnteriorGPT || '';
    const promptExtra = geraDados(intentAnterior, mensagemAnterior, mensagemAnteriorCliente, mensagem, user, '');

    const contexto = gerarPromptContextualizado(promptExtra);
    console.log(`geraDados`+ contexto);

    //Início - Busca intent
    const intentRaw = await detectarIntentComContexto({
      mensagem: mensagem,
      agentId: 'default-agent',
      promptExtra: contexto,
      intentAnterior: intentAnterior,
      mensagemAnteriorGPT: user.mensagemAnteriorGPT || ''
    });
    
    console.log('🧠 intentRaw ===>');
    console.dir(intentRaw, { depth: null });

    //Carrega as variaveis da intent
    const { intent } = intentRaw;
    user.etapaAtual = intent;

    //Começa Switch
    switch (intent) {
      //OK
      case 'inicio': {
        if (!user.cpf) {
          resposta =  await gerarMensagemDaIntent({
            intent: intent,
            agentId: 'default-agent',
            dados: contexto,
            promptExtra: 'IMPORTANTE - Peça o CPF - Se o cliente falar que não quer informar finalize o atendimento.'
          });
        } else {
          resposta = await gerarMensagemDaIntent({
            intent: intent,
            agentId: 'default-agent',
            dados: contexto,
            promptExtra: 'IMPORTANTE - Não Peça o CPF'
          });
        }
        console.error('🧠 intent fim inicio:', intent);
        break;
      }

      case 'aleatorio': {
        if (!user.cpf) {
          resposta =  await gerarMensagemDaIntent({
            intent: intent,
            agentId: 'default-agent',
            dados: contexto,
            promptExtra: 'IMPORTANTE - Peça o CPF - Se o cliente falar que não quer informar finalize o atendimento.'
          });
        } else{
            if(intentAnterior ===  'verificar_os' || 'escolher_os' || 'agendar_data' || 'extrair_data' || 'confirmar_agendamento')
            {
              await gerarMensagemDaIntent({
                intent: intent,
                agentId: 'default-agent',
                dados: contexto,
                promptExtra: 'IMPORTANTE - Solicitar que o usuário responda a pergunta anterior'
              });
            }
            else{
              await gerarMensagemDaIntent({
                intent: intent,
                agentId: 'default-agent',
                dados: contexto,
                promptExtra: ''
              });
            }
          }
        break;
      }
      
      case 'extrair_cpf': {
        console.error('extrairCpf mensagem:', mensagem);
        const cpf = extrairCpf(mensagem);
        
        console.error('extrairCpf reposta variavel cpf mensagem:', mensagem);
        
        console.error('!cpf:', !cpf);
        if (!cpf) {

          // var mensagemExtra = !cpf ? 'Pedir para digitar o CPF (CPF não foi digitado na msg anterior)' :'Pedir para digitar o CPF correto:';
          // resposta = await gerarMensagemDaIntent(
          //   'cpf_invalido',
          //   'default-agent',contexto,
          //   ''
          // );
          resposta =
          `Tem algo errado na formação do seu CPF, poderia me enviar novamente?`;
          user.mensagemAnteriorGPT = resposta;
          console.error('🧠 intent fim:', intent);
          break;
        }
        user.cpf = cpf;
        const clienteResp = await buscarClientePorCpf(cpf);

        if (!clienteResp.cliente?.id) {
          resposta =
          `Não encontrei seu CPF, poderia me enviar novamente?`;
          user.mensagemAnteriorGPT = resposta;
          console.error('🧠 intent fim:', intent);
          break;
        }

        user.clienteId = clienteResp.cliente.id;
        user.nomeCliente = clienteResp.cliente.razao;

        const osList = await buscarOSPorClienteId(user.clienteId);
        const abertas = osList.filter(os => ['A', 'AG', 'EN'].includes(os.status));
        if (abertas.length === 0) {
          resposta =  await gerarMensagemDaIntent({
            intent: intent,
            agentId: 'default-agent',
            dados: contexto,
            promptExtra: 'Sem Os Aberta'
          });
          break;
        }

        user.osList = abertas;
        user.osEscolhida = abertas;

        resposta =
          `✅ Achei seu cadastro ${user.nomeCliente}.\n\nEncontrei ${abertas.length} OS(s) abertas:\n` +
          abertas.map(os => `• ${os.id} - ${os.mensagem || 'Sem descrição'}`).join('\n') +
          `\n\nPor motivos de segurança por favor me diga o número da OS que deseja agendar.`;
        break;
      }

      case 'verificar_os': {
        if (!user.clienteId) {
          resposta = await gerarMensagemDaIntent({
            intent: intent,
            agentId: 'default-agent',
            dados: contexto,
            promptExtra: 'IMPORTANTE - Peça o CPF - Se o cliente falar que não quer informar finalize o atendimento.'
          });
        break;
        }
        const osList = await buscarOSPorClienteId(user.clienteId);
        const abertas = osList.filter(os => ['A', 'AG', 'EN'].includes(os.status));
        if (abertas.length === 0) {
          resposta =  await gerarMensagemDaIntent({
            intent: intent,
            agentId: 'default-agent',
            dados: contexto,
            promptExtra: 'IMPORTANTE - Sem OS aberta'
          });
        break;
        }

        user.osList = abertas;
        user.osEscolhida = abertas;

        resposta =
          `Encontrei ${abertas.length} OS(s) abertas:\n` +
          abertas.map(os => `• ${os.id} - ${os.mensagem || 'Sem descrição'}`).join('\n') +
          `\n\nPor motivos de segurança por favor qual OS deseja saber mais informações.`;
        break;
      }

      case 'escolher_os': {
        if (!user.clienteId) {
          resposta = await gerarMensagemDaIntent({
            intent: intent,
            agentId: 'default-agent',
            dados: contexto,
            promptExtra: 'IMPORTANTE - Peça o CPF - Se o cliente falar que não quer informar finalize o atendimento.'
          });
          break;
        }
        
        const idOsEscolhida = await interpretarNurmeroOS(mensagem, user.osList);

        const os = user.osList?.find(o => o.id === idOsEscolhida);
        if (!os) {
          resposta = await gerarMensagemDaIntent({
            intent: intent,
            agentId: 'default-agent',
            dados: contexto,
            promptExtra: 'IMPORTANTE - OS não encontrada'
          });
         break;
        }

        user.osEscolhida = os;
        const sugestao = dayjs().add(1, 'day').format('YYYY-MM-DD');
        resposta = `Qual dia quer agendar? (Sugestão: ${sugestao})`;
        break;
      }

      case 'agendar_data': {
        if (!user.clienteId) {
          resposta =  await gerarMensagemDaIntent({
            intent: intent,
            agentId: 'default-agent',
            dados: contexto,
            promptExtra: 'IMPORTANTE - Peça o CPF - Se o cliente falar que não quer informar finalize o atendimento.'
          });
        break;
        }
        const osEscolhida = user.osEscolhida?.['0'] || user.osEscolhida;
        
        // 2) Verifica se não há OS escolhida
        if (!osEscolhida?.id) {
          resposta =  await gerarMensagemDaIntent({
            intent: intent,
            agentId: 'default-agent',
            dados: contexto,
            promptExtra: 'Solicitar que o usuário selecione uma das OS'
          });
        break;
        }
        
        // 1) Extrai a data final de forma segura
        const dataFinal = data?.data_agendamento || '';

        // 2) Verifica se a data está ausente e trata o fluxo
        if (!dataFinal) {
          resposta = await gerarMensagemDaIntent({
            intent,
            agentId: 'default-agent',
            dados: contexto,
            promptExtra: 'Solicitar que o usuário escolha uma data.'
          });
          break;
        }
        
        const horarioInterpretado = user.horarioInterpretado  || '';;
        if (!horarioInterpretado) {
          resposta =  await gerarMensagemDaIntent({
            intent: intent,
            agentId: 'default-agent',
            dados: contexto,
            promptExtra: 'IMPORTANTE - Peça para que o usuário selecione um horário'
          });
        break;
        }

        // Se passou por todas as verificações, prossiga normalmente
        const payloadOriginal = {
          ...osEscolhida,
          data_agenda_final: `${dataFinal}+ ${horario}`,
          melhor_horario_agenda: 'M'
        };
        
        const resultado = await atualizarOS(osEscolhida.id, payloadOriginal);
        
        resposta = await gerarMensagemDaIntent({
          intent: intent,
          agentId: 'default-agent',
          dados: contexto,
          promptExtra: 'IMPORTANTE - OS agendada com sucesso! ' + resultado.mensagem
        });
      }
      
      //NOT OK
      case 'extrair_hora': {
        const horarioInterpretado = await interpretaHora(mensagem);
        if (!horarioInterpretado || !dayjs(horarioInterpretado).isValid()) {
          resposta = await gerarMensagemDaIntent(
            'faltando_hora',
            'default-agent',             
            contexto,
            ''
          );
          console.error('🧠 intent fim:', intent);
        break;
        }
        //TODO JUNTAR A HORA COM A DATA
        const dataFormatada = dayjs(user.dataInterpretada).format('YYYY-MM-DD');
        user.dataProposta = dataFormatada;
        resposta =
          `📅 Entendi! A data informada é ${dayjs(dataFormatada).format('DD/MM/YYYY')}. ` +
          `Posso seguir com essa data para o agendamento?`;
        break;
      }
      
      //NOT OK
      case 'extrair_data': {
        const dataInterpretada = await interpretarDataNatural(mensagem);
        
        if (!dataInterpretada || !dayjs(dataInterpretada).isValid()) {
          resposta =  await gerarMensagemDaIntent({
            intent: intent,
            agentId: 'default-agent',
            dados: contexto,
            promptExtra: 'IMPORTANTE - Peça para que o usuário selecione uma data'
          });
          user.dataInterpretada = dataInterpretada;
        break;
        }

        const horarioInterpretado = user.horarioInterpretado;
        if (!horarioInterpretado) {
        resposta = await  await gerarMensagemDaIntent({
          intent: intent,
          agentId: 'default-agent',
          dados: contexto,
          promptExtra: 'IMPORTANTE - Peça para que o usuário selecione um horário'
        })}
        else{
          const dataFormatada = dayjs(dataInterpretada).format('YYYY-MM-DD');
          user.dataProposta = dataFormatada;
          resposta =
            `📅 Entendi! A data informada é ${dayjs(dataFormatada).format('DD/MM/YYYY')}. ` +
            `Posso seguir com essa data para o agendamento?`;
        }
        break;
      }

      case 'confirmar_agendamento': {
        if (!user.dataProposta || !dayjs(user.dataProposta).isValid()) {
          resposta =  await gerarMensagemDaIntent({
            intent: intent,
            agentId: 'default-agent',
            dados: contexto,
            promptExtra: 'IMPORTANTE - Peça para que o usuário selecione uma data'
          });
          console.error('🧠 intent fim:', intent);
        break;
        }

        const osEscolhida = user.osEscolhida?.['0'] || user.osEscolhida;
        if (!osEscolhida?.id) {
          resposta =  await gerarMensagemDaIntent({
            intent: intent,
            agentId: 'default-agent',
            dados: contexto,
            promptExtra: 'IMPORTANTE - Peça para que o usuário selecione uma OS'
          });
        break;
        }

        const payloadOriginal = {
          ...osEscolhida,
          data_agenda_final: `${user.dataProposta} + ${user.horarioInterpretado}`,
          melhor_horario_agenda: 'M'
        };

        const resultado = await atualizarOS(osEscolhida.id, payloadOriginal);

        resposta = resultado.mensagem ||  await gerarMensagemDaIntent({
          intent: intent,
          agentId: 'default-agent',
          dados: contexto,
          promptExtra: 'IMPORTANTE - Agendamento OK'
        });
        break;
      }

      case 'finalizado':
      default:
        resposta = await gerarMensagemDaIntent({
          intent: intent,
          agentId: 'default-agent',
          dados: contexto,
          promptExtra: 'IMPORTANTE - Encerrar atendimento'
        });
        // Limpar todos os dados do usuário
        usuarios[numero] = { etapa: 'inicio' };
        break;
    }

    // Fallback se não houve resposta
    if (!resposta) {
      resposta = await gerarMensagemDaIntent(
        'aleatorio',
        'default-agent',         
        contexto,
        ''
      );
    }

    // Persistimos o user atualizado
    usuarios[numero] = user;

    //Atualiza Dados do usuário.
    user.etapaAnterior = intent;
    user.mensagemAnteriorGPT = resposta;
    user.mensagemAnteriorCliente = mensagem;

    //Envia para Whatsup
    await enviarMensagemWhatsApp(numero, resposta);
    
    //Salva conversa no Mongo DB
    if(boolSalvarConversa){
      const { salvarConversa } = require('../services/conversaService');
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

    //Logs
    console.error('user.mensagemAnteriorCliente : ' + user.mensagemAnteriorCliente);
    console.error('user.etapaAnterior : ' + user.etapaAnterior);
    console.error('user.mensagemAnteriorGPT : ' + user.mensagemAnterior);
    console.error('user.cpf : ' + user.cpf);
    console.error('user.clienteId : ' + user.clienteId);
    console.error('user.nomeCliente :  ' + user.nomeCliente );
    console.error('user.osList :  ' + user.osList );
    console.error('user.osEscolhida : ' + user.osEscolhida);
    console.error('user.etapaAtual : ' + user.etapaAtual);
    console.error('user.dataInterpretada : ' + user.dataInterpretada);
    
    //retorna req REST
    return res.json({
      para: numero,
      status: '📤 Mensagem enviada via Twilio',
      mensagem: resposta,
      intent: intent,
      intentAnterior: intentAnterior
    });

  } catch (error) {
    const erroCompleto = error?.stack || error?.message || 'Erro desconhecido';

    console.log(`erroCompleto`+erroCompleto);
    resposta = '❌ Opa! Deu um errinho aqui. Já estamos resolvendo. Tenta de novo daqui a pouco.:' + erroCompleto;
    await enviarMensagemWhatsApp(numero, resposta);
    const { salvarConversa } = require('../services/conversaService');

    if(boolSalvarConversa){
      const { salvarConversa } = require('../services/conversaService');
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
      //log
    });
  }
});

module.exports = router;
