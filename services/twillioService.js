const twilio = require('twilio');
const httpsAgent = require('./httpsAgent'); // importa o agent customizado
const { ensureSession, sendText } = require('./wahaService');

// Provider selection: use WAHA by default, unless explicitly forcing Twilio
const USE_WAHA = process.env.ENABLE_TWILIO !== 'true';

// Configuração do Twilio (fallback)
const accountSid = process.env.TWILIO_ACCOUNT;
const authToken = process.env.TWILIO_API_TOKEN;
const client = (accountSid && authToken) ? twilio(accountSid, authToken) : null;

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
    if (USE_WAHA) {
      const session = process.env.WAHA_SESSION || 'default';
      const toRaw = String(messageData.to || '');
      // Extrai apenas dígitos do padrão whatsapp:+55...
      const phone = toRaw.replace(/\D/g, '');
      const text = messageData.body || (Array.isArray(messageData.mediaUrl) && messageData.mediaUrl.length > 0
        ? `Mensagem com mídia: ${messageData.mediaUrl[0]}`
        : '');
      if (!phone) throw new Error('Destino inválido para WAHA (sem número).');
      if (!text) throw new Error('Corpo vazio para envio WAHA.');

      await ensureSession(session);
      const resp = await sendText({ session, phone, text });
      // Log conciso (evitar dump grande do objeto)
      console.log(`✅ [WAHA] Mensagem enviada para +${phone}. Id: ${resp?.id || 'ok'}`);
      // Retorna algo equivalente a SID para compat
      return resp?.id || 'waha-ok';
    }

    // Twilio fallback
    if (!client) throw new Error('Twilio não configurado e USE_WAHA=false. Configure WAHA ou TWILIO.');
    // Logs verbosos comentados para facilitar análise
    // console.log('messageData:', messageData);
    // console.log('messageData.from:', messageData.from);
    // console.log('messageData.to:', messageData.to);
    // console.log('messageData.body:', messageData.body);
    // console.log('messageData.mediaUrl:', messageData.mediaUrl);
    console.log(`[Twilio] Enviando mensagem para ${messageData.to}`);
    const message = await client.messages.create({
      ...messageData,
      httpAgent: httpsAgent
    });
    console.log(`✅ Mensagem enviada para ${messageData.to}. SID: ${message.sid}`);
    return message.sid;

  } catch (error) {
    console.error('❌ Erro ao enviar mensagem pelo Twilio:', error);
    throw error;
  }
}

module.exports = { enviarMensagemWhatsApp };
