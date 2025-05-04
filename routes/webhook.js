const express = require('express');
const router = express.Router();
const { twiml: { MessagingResponse, VoiceResponse } } = require('twilio');

// Rota para receber mensagens de texto ou voz do Twilio
router.post('/', express.urlencoded({ extended: false }), (req, res) => {
  // Log the full request for debugging
  console.log('--- [Webhook Voz] INCOMING REQUEST ---');
  console.log('Headers:', JSON.stringify(req.headers, null, 2));
  console.log('Body:', JSON.stringify(req.body, null, 2));

  // Suporte para Payload aninhado (caso venha como string JSON)
  let smsBody = req.body.Body;
  let voiceText = req.body.SpeechResult;
  let params = null;

  if (req.body.Payload) {
    try {
      const payloadObj = JSON.parse(req.body.Payload);
      params = payloadObj?.webhook?.request?.parameters;
      console.log('[Webhook Voz] Payload parameters:', params);
      if (params) {
        smsBody = params.Body;
        voiceText = params.SpeechResult;
      }
    } catch (e) {
      console.error('[Webhook Voz] Erro ao parsear Payload:', e);
    }
  }

  console.log('[Webhook Voz] smsBody:', smsBody);
  console.log('[Webhook Voz] voiceText:', voiceText);

  const resposta = smsBody || voiceText || 'Nada recebido';
  console.log('[Webhook Voz] Recebido:', resposta);

  // Resposta para SMS
  if (smsBody) {
    const twiml = new MessagingResponse();
    twiml.message(resposta);
    res.type('text/xml').send(twiml.toString());
    return;
  }

  // Resposta para voz (retorna o mesmo texto)
  if (voiceText) {
    const twiml = new VoiceResponse();
    twiml.say(resposta);
    res.type('text/xml').send(twiml.toString());
    return;
  }

  // Caso não seja reconhecido
  res.status(400).send('Nenhuma mensagem ou voz recebida');
});

module.exports = router;
