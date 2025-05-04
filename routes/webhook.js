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
  let audioUrl = undefined;
  let audioType = undefined;

  if (req.body.Payload) {
    try {
      const payloadObj = JSON.parse(req.body.Payload);
      params = payloadObj?.webhook?.request?.parameters;
      console.log('[Webhook Voz] Payload parameters:', params);
      if (params) {
        smsBody = params.Body;
        voiceText = params.SpeechResult;
        audioUrl = params.MediaUrl0;
        audioType = params.MediaContentType0;
      }
    } catch (e) {
      console.error('[Webhook Voz] Erro ao parsear Payload:', e);
    }
  }

  console.log('[Webhook Voz] smsBody:', smsBody);
  console.log('[Webhook Voz] voiceText:', voiceText);
  console.log('[Webhook Voz] audioUrl:', audioUrl);
  console.log('[Webhook Voz] audioType:', audioType);

  let resposta = smsBody || voiceText;
  const { baixarAudioTwilio, transcreverAudioWhisper } = require('../services/transcribeService');

  async function processarResposta() {
    if (!resposta && audioUrl) {
      try {
        console.log('[Webhook Voz] Baixando áudio do Twilio:', audioUrl);
        const audioBuffer = await baixarAudioTwilio(audioUrl);
        console.log('[Webhook Voz] Áudio baixado, enviando para transcrição...');
        const textoTranscrito = await transcreverAudioWhisper(audioBuffer, 'audio.ogg');
        resposta = textoTranscrito || '(Áudio recebido, mas não foi possível transcrever)';
        console.log('[Webhook Voz] Texto transcrito:', resposta);
      } catch (err) {
        console.error('[Webhook Voz] Erro ao processar/transcrever áudio:', err.message);
        resposta = 'Recebido áudio, mas não foi possível transcrever.';
      }
    }
    resposta = resposta || 'Nada recebido';
    console.log('[Webhook Voz] Recebido:', resposta);

    // Resposta para SMS
    if (smsBody) {
      const twiml = new MessagingResponse();
      twiml.message(resposta);
      res.type('text/xml').send(twiml.toString());
      return;
    }

    // Resposta para voz (retorna o mesmo texto)
    if (voiceText || audioUrl) {
      const twiml = new VoiceResponse();
      twiml.say(resposta);
      res.type('text/xml').send(twiml.toString());
      return;
    }

    // Caso não seja reconhecido
    res.status(400).send('Nenhuma mensagem ou voz recebida');
  }

  processarResposta();

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
