require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const https = require('https');
const bodyParser = require('body-parser');
const { OpenAI } = require('openai');
const twilio = require('twilio');

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const app = express();
app.use(cors());
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: false }));

const PORT = process.env.PORT || 5000;

const agent = new https.Agent({
  rejectUnauthorized: false,
});

// Configuração do OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Configuração do Twilio
const accountSid = process.env.TWILIO_ACCOUNT;
const authToken = process.env.TWILIO_API_TOKEN;
const client = twilio(accountSid, authToken);

// Função para enviar mensagem via Twilio
async function enviarMensagemWhatsApp(to, mensagem) {
  try {
    const message = await client.messages.create({
      body: mensagem,
      from: 'whatsapp:+14155238886',
      to,
    });
    return message.sid;
  } catch (error) {
    console.error('Erro ao enviar mensagem pelo Twilio:', error);
    throw error;
  }
}

// Função para obter resposta do GPT com intenção
async function obterRespostaGPTComIntencao(pergunta) {
  try {
    const resposta = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: `Você é um assistente que interpreta comandos e responde com JSON.\nResponda SEMPRE no formato:\n{\n  "intent": "nome_da_acao",\n  "data": { ... },\n  "mensagem": "mensagem para o usuário"\n}\nAlgumas intents possíveis:\n- buscar_os\n- buscar_os_por_id\n- buscar_os_por_protocolo\n- saudacao\n- desconhecido`
        },
        { role: 'user', content: pergunta },
      ],
      temperature: 0.3,
      max_tokens: 500,
    });

    return JSON.parse(resposta.choices[0].message.content);
  } catch (error) {
    console.error('Erro ao obter resposta do GPT:', error);
    throw error;
  }
}

// Função para buscar OSs (lista geral)
async function buscarOSIXC() {
  const response = await axios.post('https://demo.ixcsoft.com.br/webservice/v1/su_oss_chamado', {
    qtype: 'su_oss_chamado.id',
    query: '0',
    oper: '>',
    page: '1',
    rp: '5',
    sortname: 'su_oss_chamado.id',
    sortorder: 'desc'
  }, {
    auth: { username: process.env.API_USER, password: process.env.API_PASS },
    headers: { 'ixcsoft': 'listar', 'Content-Type': 'application/json' },
    httpsAgent: agent
  });

  return response.data?.registros || {};
}

// Função para buscar OS por ID
async function buscarOSPorId(id) {
  const response = await axios.post('https://demo.ixcsoft.com.br/webservice/v1/su_oss_chamado', {
    qtype: 'su_oss_chamado.id',
    query: id,
    oper: '=',
    page: '1',
    rp: '1',
    sortname: 'su_oss_chamado.id',
    sortorder: 'asc'
  }, {
    auth: { username: process.env.API_USER, password: process.env.API_PASS },
    headers: { 'ixcsoft': 'listar', 'Content-Type': 'application/json' },
    httpsAgent: agent
  });

  return response.data?.registros || {};
}

// Função para buscar OS por protocolo
async function buscarOSPorProtocolo(protocolo) {
  const response = await axios.post('https://demo.ixcsoft.com.br/webservice/v1/su_oss_chamado', {
    qtype: 'su_oss_chamado.protocolo',
    query: protocolo,
    oper: '=',
    page: '1',
    rp: '1',
    sortname: 'su_oss_chamado.id',
    sortorder: 'asc'
  }, {
    auth: { username: process.env.API_USER, password: process.env.API_PASS },
    headers: { 'ixcsoft': 'listar', 'Content-Type': 'application/json' },
    httpsAgent: agent
  });

  return response.data?.registros || {};
}

// Rota para listar OSs (IXC)
app.get('/api/os', async (req, res) => {
  try {
    const registros = await buscarOSIXC();
    res.json(registros);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar OSs' });
  }
});

async function responderComGPTViaWhatsApp(mensagemRecebida, numeroUsuario) {
  try {
    // 1. Pergunta ao GPT
    const resposta = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: 'Você é um assistente útil e direto, respondendo de forma clara e objetiva.' },
        { role: 'user', content: mensagemRecebida }
      ],
      temperature: 0.5,
      max_tokens: 300,
    });

    const mensagemGPT = resposta.choices[0].message.content;

    // 2. Envia a resposta para o usuário no WhatsApp
    await client.messages.create({
      body: mensagemGPT,
      from: 'whatsapp:+14155238886',
      to: numeroUsuario
    });

    console.log(`Resposta enviada para ${numeroUsuario}: ${mensagemGPT}`);
  } catch (err) {
    console.error('Erro ao responder via GPT:', err);
    await client.messages.create({
      body: 'Ops! Algo deu errado tentando responder sua mensagem. Tente de novo mais tarde.',
      from: 'whatsapp:+14155238886',
      to: numeroUsuario
    });
  }
}


app.get('/api/teste-gpt-agendamento-protocolo', async (req, res) => {
    const pergunta = 'Gostaria de informações sobre a minha os que tem o protocolo 2018079...quero saber em qual endereço está essa os';
    const numeroDestino = 'whatsapp:+5511999930332';
  
    try {
      const gpt = await obterRespostaGPTComIntencao(pergunta);
  
      if (gpt.intent === 'buscar_os_por_protocolo') {
        if (!gpt.data?.protocolo) {
          await enviarMensagemWhatsApp(numeroDestino, 'Qual o número do protocolo da OS que deseja consultar?');
          return res.json({ sucesso: false, mensagem: 'Protocolo não informado, solicitação enviada ao usuário.' });
        }
  
        const os = await buscarOSPorProtocolo(gpt.data.protocolo);
        if (Object.keys(os).length === 0) {
          await enviarMensagemWhatsApp(numeroDestino, `Nenhuma OS encontrada com protocolo ${gpt.data.protocolo}.`);
          return res.json({ sucesso: false, mensagem: 'Nenhuma OS encontrada.' });
        }
  
        const detalhes = Object.values(os).map(o => {
          return `Protocolo: ${o.protocolo}\nID: ${o.id}\nEndereço: ${o.endereco || 'não informado'}\nStatus: ${o.status}\nMensagem: ${o.mensagem || '---'}`;
        }).join('\n\n');
  
        const mensagem = `${gpt.mensagem}\n\n${detalhes}`;
        await enviarMensagemWhatsApp(numeroDestino, mensagem);
  
        res.json({ sucesso: true, mensagem });
      } else {
        await enviarMensagemWhatsApp(numeroDestino, gpt.mensagem);
        res.json({ sucesso: true, mensagem: gpt.mensagem });
      }
    } catch (error) {
      console.error('Erro no teste GPT com protocolo:', error);
      res.status(500).json({ erro: 'Erro ao processar teste GPT com protocolo.' });
    }
  });

// Rota de teste mockado: buscar por protocolo 2018079
app.get('/api/teste-os-protocolo', async (req, res) => {
  const protocolo = '2018079';
  const numeroDestino = 'whatsapp:+5511999930332';

  try {
    const os = await buscarOSPorProtocolo(protocolo);
    if (Object.keys(os).length === 0) {
      await enviarMensagemWhatsApp(numeroDestino, `Nenhuma OS encontrada com protocolo ${protocolo}.`);
      return res.json({ sucesso: false, mensagem: 'Nenhuma OS encontrada.' });
    }

    const detalhes = Object.values(os).map(o => `Protocolo: ${o.protocolo}, ID: ${o.id}, Assunto: ${o.assunto}, Status: ${o.status}`).join('\n');
    const mensagem = `Resultado da busca por protocolo ${protocolo}:\n${detalhes}`;
    await enviarMensagemWhatsApp(numeroDestino, mensagem);

    res.json({ sucesso: true, mensagem });
  } catch (error) {
    console.error('Erro ao buscar OS por protocolo:', error);
    res.status(500).json({ erro: 'Erro ao buscar OS por protocolo.' });
  }
});

// Webhook WhatsApp com resposta do GPT
app.post('/whatsapp-webhook', async (req, res) => {
  const mensagemRecebida = req.body.Body;
  const numeroUsuario = req.body.From;

  try {
    const gpt = await obterRespostaGPTComIntencao(mensagemRecebida);

    if (gpt.intent === 'buscar_os') {
      const dados = await buscarOSIXC();
      const primeirasOS = Object.values(dados).map(os => `ID: ${os.id}, Assunto: ${os.assunto}`).join('\n');
      const mensagemFinal = `${gpt.mensagem}\n\nÚltimas OS:\n${primeirasOS}`;
      await enviarMensagemWhatsApp(numeroUsuario, mensagemFinal);
    } else if (gpt.intent === 'buscar_os_por_id') {
      if (!gpt.data?.id) {
        await enviarMensagemWhatsApp(numeroUsuario, 'Qual o número da OS que deseja consultar?');
      } else {
        const os = await buscarOSPorId(gpt.data.id);
        if (Object.keys(os).length === 0) {
          await enviarMensagemWhatsApp(numeroUsuario, `Não encontrei nenhuma OS com ID ${gpt.data.id}.`);
        } else {
          const detalhes = Object.values(os).map(o => `ID: ${o.id}, Assunto: ${o.assunto}, Status: ${o.status}`).join('\n');
          await enviarMensagemWhatsApp(numeroUsuario, `${gpt.mensagem}\n\n${detalhes}`);
        }
      }
    } else if (gpt.intent === 'buscar_os_por_protocolo') {
      if (!gpt.data?.protocolo) {
        await enviarMensagemWhatsApp(numeroUsuario, 'Qual o número do protocolo da OS que deseja consultar?');
      } else {
        const os = await buscarOSPorProtocolo(gpt.data.protocolo);
        if (Object.keys(os).length === 0) {
          await enviarMensagemWhatsApp(numeroUsuario, `Não encontrei nenhuma OS com protocolo ${gpt.data.protocolo}.`);
        } else {
          const detalhes = Object.values(os).map(o => `Protocolo: ${o.protocolo}, ID: ${o.id}, Assunto: ${o.assunto}, Status: ${o.status}`).join('\n');
          await enviarMensagemWhatsApp(numeroUsuario, `${gpt.mensagem}\n\n${detalhes}`);
        }
      }
    } else {
      await enviarMensagemWhatsApp(numeroUsuario, gpt.mensagem);
    }

    res.set('Content-Type', 'text/xml');
    res.send('<Response></Response>');
  } catch (error) {
    res.status(500).send(error);
  }
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT} 🚀`);
});
