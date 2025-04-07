const express = require('express');
const router = express.Router();
const { buscarClientePorCpf, buscarOS } = require('../services/ixcService');
const { execute } = require('../app/engine/executor');
const dayjs = require('dayjs');

const usuarios = {}; // memória temporária por número de telefone

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
        resposta = '🚫 Oxe, num achei seu CPF aqui não. Confere direitinho e manda de novo pra nóis 🙏';
      } else {
        user.clienteId = clienteResp.cliente.id;
        user.nomeCliente = clienteResp.cliente.razao;
        user.etapa = 'aguardando_os';
        resposta = `👋 Eita, achei sim! Cê tá como ${user.nomeCliente || 'cliente'} aqui no sistema. Agora vou ver se tem alguma OS aberta, tá bom?`;
      }
    }

    else if (user.etapa === 'aguardando_os') {
      const osList = await buscarOS(null, user.clienteId);
      const abertas = Object.values(osList).filter(os => os.status === 'A');

      if (abertas.length === 0) {
        resposta = '📭 No momento cê não tem nenhuma OS aberta, viu? Qualquer coisa é só chamar 💬';
        user.etapa = 'finalizado';
      } else {
        user.osList = abertas;
        user.etapa = 'escolher_os';

        resposta = `📋 Encontrei ${abertas.length} OS aberta(s):\n` +
          abertas.map(os => `• ${os.id} - ${os.mensagem || 'sem descrição'}`).join('\n') +
          `\n\nQual dessas você quer agendar? Manda só o número dela.`;
      }
    }

    else if (user.etapa === 'escolher_os') {
      const osEscolhida = user.osList.find(os => os.id === mensagem);
      if (!osEscolhida) {
        resposta = '🚫 Ixi, não achei essa OS não. Dá uma olhadinha no número e tenta de novo, tá certo?';
      } else {
        user.osEscolhida = osEscolhida;
        user.etapa = 'agendar_data';
        const sugestao = dayjs().add(1, 'day').format('YYYY-MM-DD');
        resposta = `📅 Qual dia cê quer agendar? (sugestão: ${sugestao})`;
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

      if (resultado?.mensagem) {
        resposta = `✅ Agendamento feito com sucesso, viu!\n${resultado.mensagem}`;
      } else {
        resposta = `⚠️ Tivemos um probleminha no agendamento.\nDetalhes: ${JSON.stringify(resultado, null, 2)}`;
      }

      user.etapa = 'finalizado';
    }

    usuarios[numero] = user;
    res.json({ para: numero, resposta });

  } catch (error) {
    console.error('❌ Erro no webhook:', error);

    // Envia o log de erro como resposta (apenas para debug/testes)
    res.json({
      para: numero,
      resposta: `❌ Ih rapaz, aconteceu um errim por aqui:\n${error.message || 'Erro desconhecido'}`
    });
  }
});

module.exports = router;
