const express = require('express');
const router = express.Router();
const { twiml: { MessagingResponse, VoiceResponse } } = require('twilio');

// Rota para receber mensagens de texto ou voz do Twilio
router.post('/', express.urlencoded({ extended: false }), (req, res) => {
  // Para mensagens SMS
  const smsBody = req.body.Body;
  // Para chamadas de voz, o Twilio envia transcrição em SpeechResult
  const voiceText = req.body.SpeechResult;

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
