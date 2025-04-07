const express = require('express');
const router = express.Router();
const { buscarClientePorCpf, buscarOS } = require('../services/ixcService');
const { execute } = require('../app/engine/executor');
const dayjs = require('dayjs');

// Memória de sessão (em produção: Redis, DB, etc)
const sessions = {};

router.post('/', async (req, res) => {
  const mensagem = req.body.Body?.trim();
  const numero = req.body.From;
  const session = sessions[numero] || { step: 'inicio' };

  try {
    if (session.step === 'inicio') {
      sessions[numero] = { step: 'aguardando_cpf' };
      return res.json({ resposta: "🧑‍🌾 Olá! Eu sou a assistente virtual aqui da central. Pra começá, me envia seu CPF com os pontinhos, por favor 😊" });
    }

    if (session.step === 'aguardando_cpf') {
      const cpf = mensagem;
      const clienteResp = await buscarClientePorCpf(cpf);

      if (!clienteResp.cliente || !clienteResp.cliente.id) {
        return res.json({ resposta: "🚫 Não encontrei nenhum cadastro com esse CPF. Dá uma conferida e tenta de novo, tá bem?" });
      }

      sessions[numero] = {
        step: 'aguardando_escolha_os',
        cpf,
        idCliente: clienteResp.cliente.id
      };

      const osList = await buscarOS(null, clienteResp.cliente.id);
      const abertas = Object.values(osList).filter(os => os.status === 'A');

      if (abertas.length === 0) {
        delete sessions[numero];
        return res.json({ resposta: "📭 No momento, você não tem nenhuma OS aberta. Se precisar de ajuda, é só chamar!" });
      }

      sessions[numero].osList = abertas;

      if (abertas.length === 1) {
        sessions[numero].osId = abertas[0].id;
        sessions[numero].step = 'aguardando_data';

        const sugestao = dayjs().add(1, 'day').format('YYYY-MM-DD');
        return res.json({ resposta: `✅ Achei sua OS ${abertas[0].id}. Qual dia você quer agendar? (sugestão: ${sugestao})` });
      }

      const lista = abertas.map(os => `- OS ${os.id}: ${os.mensagem || 'sem descrição'}`).join('\n');
      return res.json({ resposta: `📋 Encontrei essas OS abertas:\n${lista}\nQual o ID da OS que você quer agendar?` });
    }

    if (session.step === 'aguardando_escolha_os') {
      const osIdEscolhido = mensagem;
      const encontrada = session.osList.find(os => os.id === osIdEscolhido);

      if (!encontrada) {
        return res.json({ resposta: "🚫 Não encontrei essa OS. Confere o número e tenta de novo." });
      }

      sessions[numero].osId = encontrada.id;
      sessions[numero].osSelecionada = encontrada;
      sessions[numero].step = 'aguardando_data';

      const sugestao = dayjs().add(1, 'day').format('YYYY-MM-DD');
      return res.json({ resposta: `Perfeito! Qual dia você quer agendar? (sugestão: ${sugestao})` });
    }

    if (session.step === 'aguardando_data') {
      const data = mensagem || dayjs().add(1, 'day').format('YYYY-MM-DD');

      const agendamento = await execute("default-agent", "agendar_os_completo", {
        osId: session.osId,
        novaData: `${data} 10:00:00`,
        idTecnico: session.osSelecionada?.id_tecnico || '0',
        melhorHorario: 'M'
      });

      delete sessions[numero];

      return res.json({
        resposta: `✅ Agendamento feito com sucesso!\n📆 Data: ${data}\n📄 Detalhes: ${agendamento.mensagem || 'ok'}`
      });
    }

    return res.json({ resposta: "❌ Não entendi sua mensagem... vamos começar de novo. Me envia seu CPF, por favor!" });
  } catch (err) {
    console.error('Erro no webhook:', err.message);
    return res.status(500).json({ resposta: "😢 Opa! Deu um errinho aqui. Tenta de novo mais tarde, tá bem?" });
  }
});

module.exports = router;
