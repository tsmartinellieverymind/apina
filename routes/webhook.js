const express = require('express');
const router = express.Router();
const { buscarClientePorCpf, buscarOSPorClienteId } = require('../services/ixcService');
const { execute } = require('../app/engine/executor');
const dayjs = require('dayjs');

const usuarios = {};

/**
 * Extrai CPF da mensagem (com ou sem pontuação) e retorna só os dígitos.
 */
function extrairCpf(texto) {
  const match = texto.match(/\d{3}\.?\d{3}\.?\d{3}-?\d{2}/);
  return match ? match[0].replace(/[^\d]/g, '') : null;
}

router.post('/', async (req, res) => {
  const mensagem = req.body.Body?.trim() || '';
  const numero = req.body.From;

  // Se não existir "sessão" para este usuário, cria
  if (!usuarios[numero]) {
    usuarios[numero] = { etapa: 'inicio' };
  }
  const user = usuarios[numero];

  let resposta = '';
  let log = `📥 Msg recebida: "${mensagem}"\n👤 Número: ${numero}\nEtapa atual: ${user.etapa}\n`;

  try {
    switch (user.etapa) {
      /**
       * ETAPA "inicio"
       * Aqui forçamos o usuário a informar CPF logo de cara.
       */
      case 'inicio': {
        resposta = 'Olá! Para começar, por favor me informe seu CPF (com ou sem pontuação).';
        // Assim que o chatbot diz isso, passamos para a etapa "cpf"
        user.etapa = 'cpf';
        break;
      }

      /**
       * ETAPA "cpf"
       * Lê a mensagem do usuário, tenta extrair CPF.
       * Se encontrar, busca no IXC. Se não encontrar, pede novamente.
       */
      case 'cpf': {
        const cpf = extrairCpf(mensagem);
        if (!cpf) {
          resposta = 'Não consegui encontrar o CPF na sua mensagem. Por favor, envie o CPF corretamente.';
          log += '⚠️ CPF não encontrado.\n';
          return res.json({ para: numero, resposta, log });
        }

        log += `🔍 CPF extraído: ${cpf}\n`;
        user.cpf = cpf;

        // Buscar cliente no IXC
        const clienteResp = await buscarClientePorCpf(cpf);
        log += `📡 Resposta buscarClientePorCpf: ${JSON.stringify(clienteResp)}\n`;

        if (!clienteResp.cliente?.id) {
          resposta = '🚫 Não encontrei seu CPF no sistema. Verifique e tente novamente.';
          log += '❌ Cliente não encontrado.\n';
          return res.json({ para: numero, resposta, log });
        }

        user.clienteId = clienteResp.cliente.id;
        user.nomeCliente = clienteResp.cliente.razao;
        user.etapa = 'aguardando_os';

        resposta = `Que bom ter você aqui, ${user.nomeCliente || 'cliente'}! Vou verificar se existe alguma OS aberta pra você.`;
        break;
      }

      /**
       * ETAPA "aguardando_os"
       * Aqui já temos o clienteId, então buscamos as OS abertas e decidimos o que perguntar.
       */
      case 'aguardando_os': {
        const osList = await buscarOSPorClienteId(user.clienteId);
        log += `📡 Resposta buscarOSPorClienteId: ${JSON.stringify(osList)}\n`;

        const abertas = osList.filter(os => ['A', 'AG', 'EN'].includes(os.status));

        if (abertas.length === 0) {
          resposta = 'No momento, não há nenhuma OS aberta no seu cadastro. Se precisar de outra coisa, é só me falar.';
          user.etapa = 'finalizado';
          break;
        }

        user.osList = abertas;
        user.etapa = 'escolher_os';

        resposta = `Encontrei ${abertas.length} OS aberta(s):\n` +
          abertas.map(os => `• ${os.id} - ${os.mensagem || 'Sem descrição'}`).join('\n') +
          '\n\nQual delas você quer agendar? Mande o número da OS.';
        break;
      }

      /**
       * ETAPA "escolher_os"
       * O usuário manda o número de uma OS. Validamos e partimos para o agendamento.
       */
      case 'escolher_os': {
        const osEscolhida = user.osList?.find(os => os.id === mensagem);
        if (!osEscolhida) {
          resposta = 'Não achei essa OS na sua lista. Manda o número certinho, por favor.';
          log += '❌ OS não encontrada.\n';
          break;
        }

        user.osEscolhida = osEscolhida;
        user.etapa = 'agendar_data';

        const sugestao = dayjs().add(1, 'day').format('YYYY-MM-DD');
        resposta = `Perfeito! Em qual dia você quer agendar? (Sugestão: ${sugestao})`;
        break;
      }

      /**
       * ETAPA "agendar_data"
       * Recebe a data, chama a action de agendar.
       */
      case 'agendar_data': {
        const data = mensagem || dayjs().add(1, 'day').format('YYYY-MM-DD');

        // Exemplo de chamada ao "execute"
        const resultado = await execute('default-agent', 'agendar_os_completo', {
          osId: user.osEscolhida.id,
          novaData: `${data} 10:00:00`,
          idTecnico: user.osEscolhida.id_tecnico || '0',
          melhorHorario: 'M'
        });

        resposta = resultado.mensagem || 'Pronto! Sua OS foi agendada com sucesso.';
        log += `🧠 Resultado agendamento: ${JSON.stringify(resultado)}\n`;

        user.etapa = 'finalizado';
        break;
      }

      /**
       * Se tiver acabado, mas o usuário continuar conversando,
       * podemos reiniciar ou ver se faz sentido manter "finalizado".
       */
      case 'finalizado': {
        resposta = 'Tudo certo. Se precisar de mais alguma coisa, é só avisar.';
        break;
      }

      default: {
        log += `Etapa desconhecida: ${user.etapa}. Resetando para "inicio".\n`;
        user.etapa = 'inicio';
        resposta = 'Vamos recomeçar? Por favor, me informe o CPF novamente.';
      }
    } // Fim do switch

    usuarios[numero] = user;

    if (!resposta) {
      resposta = 'Não entendi bem. Pode repetir, por favor?';
      log += '⚠️ Nenhuma resposta gerada.\n';
    }

    return res.json({ para: numero, resposta, log });

  } catch (err) {
    const erro = err?.message || 'Erro desconhecido';
    console.error('❌ Erro no webhook:', erro);
    log += `🔥 Erro: ${erro}\n`;
    const respostaErro = 'Desculpe, ocorreu um erro. Tente novamente mais tarde.';
    return res.json({ para: numero, resposta: respostaErro, log });
  }
});

module.exports = router;
