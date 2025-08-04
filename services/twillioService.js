const twilio = require('twilio');
const httpsAgent = require('./httpsAgent'); // importa o agent customizado

// Configuração do Twilio
const accountSid = process.env.TWILIO_ACCOUNT;
const authToken = process.env.TWILIO_API_TOKEN;
const client = twilio(accountSid, authToken);

// Função para enviar mensagem via Twilio
// Agora aceita um único objeto 'messageData' com as propriedades necessárias
async function enviarMensagemWhatsApp(messageData) {

  // Log condicional baseado no tipo de mensagem (texto ou mídia)
  if (messageData.body) {
    console.log(`➡️  Preparando envio de TEXTO para ${messageData.to}: ${messageData.body}`);
  } else if (messageData.mediaUrl && messageData.mediaUrl.length > 0) {
    console.log(`➡️  Preparando envio de MÍDIA para ${messageData.to}: ${messageData.mediaUrl[0]}`);
  } else {
    console.warn(`⚠️ Tentativa de envio para ${messageData.to} sem body ou mediaUrl.`);
    throw new Error('Mensagem para Twilio deve conter body ou mediaUrl.');
  }
  
  try {
    // Cria a mensagem usando as propriedades do objeto messageData
    // Inclui 'to', 'from', 'body' OU 'mediaUrl'


    console.log('messageData:', messageData);
    console.log('messageData.from:', messageData.from);
    console.log('messageData.to:', messageData.to);
    console.log('messageData.body:', messageData.body);
    console.log('messageData.mediaUrl:', messageData.mediaUrl);
    
    const message = await client.messages.create({
      ...messageData, // Espalha as propriedades (to, from, body?, mediaUrl?)
      httpAgent: httpsAgent // Mantém o agent customizado
    });

    console.log(`✅ Mensagem enviada para ${messageData.to}. SID: ${message.sid}`);
    return message.sid;

  } catch (error) {
    console.error('❌ Erro ao enviar mensagem pelo Twilio:', error);
    throw error;
  }
}

module.exports = { enviarMensagemWhatsApp };
