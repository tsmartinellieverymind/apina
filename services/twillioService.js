const twilio = require('twilio');
const httpsAgent = require('./httpsAgent'); // importa o agent customizado

// Configuração do Twilio
const accountSid = process.env.TWILIO_ACCOUNT;
const authToken = process.env.TWILIO_API_TOKEN;
const client = twilio(accountSid, authToken);

// Função para enviar mensagem via Twilio
async function enviarMensagemWhatsApp(to, mensagem) {

  console.log(`✅ Mensagem Enviada pelo GPT : `  + mensagem);
  
  try {
    const message = await client.messages.create({
      body: mensagem,
      from: 'whatsapp:+14155238886',
      to,
      httpAgent: httpsAgent // usa o agent customizado aqui
    });

    console.log(`✅ Mensagem enviada para ${to}. SID: ${message.sid}`);
    return message.sid;

  } catch (error) {
    console.error('❌ Erro ao enviar mensagem pelo Twilio:', error);
    throw error;
  }
}

module.exports = { enviarMensagemWhatsApp };
