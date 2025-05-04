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
  let audioUrl = req.body.MediaUrl0;
  let audioType = req.body.MediaContentType0;

  if (req.body.Payload) {
    try {
      const payloadObj = JSON.parse(req.body.Payload);
      params = payloadObj?.webhook?.request?.parameters;
      console.log('[Webhook Voz] Payload parameters:', params);
      if (params) {
        smsBody = params.Body;
        voiceText = params.SpeechResult;
        audioUrl = params.MediaUrl0 || audioUrl;
        audioType = params.MediaContentType0 || audioType;
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

    // Envia a resposta via WhatsApp usando o twillioService
    try {
      const { enviarMensagemWhatsApp } = require('../services/twillioService');
      const destinatario = params?.From || req.body.From;
      if (destinatario) {
        await enviarMensagemWhatsApp(destinatario, resposta);
        console.log(`[Webhook Voz] Mensagem enviada para ${destinatario}: ${resposta}`);
        res.status(200).json({ status: 'ok', destinatario, resposta });
      } else {
        console.error('[Webhook Voz] Não foi possível identificar o destinatário para resposta WhatsApp.');
        res.status(400).json({ status: 'erro', msg: 'Destinatário não encontrado' });
      }
    } catch (err) {
      console.error('[Webhook Voz] Erro ao enviar mensagem WhatsApp:', err);
      res.status(500).json({ status: 'erro', msg: 'Falha ao enviar mensagem WhatsApp' });
    }
  }

  processarResposta();
});

module.exports = router;
