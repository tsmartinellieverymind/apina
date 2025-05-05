const express = require('express');
const router = express.Router();
const { twiml: { MessagingResponse, VoiceResponse } } = require('twilio');
const { gerarAudioUrl } = require('../services/elevenLabsService'); 
const { baixarAudioTwilio, transcreverAudioWhisper } = require('../services/transcribeService');
const { enviarMensagemWhatsApp } = require('../services/twillioService'); 

// Pega o número do WhatsApp do Twilio do ambiente
const twilioWhatsappNumber = process.env.TWILIO_WHATSAPP_NUMBER;
if (!twilioWhatsappNumber) {
  console.error('❌ ERRO FATAL: Variável de ambiente TWILIO_WHATSAPP_NUMBER não definida!');
  // Em um cenário real, você poderia querer que a aplicação parasse aqui
  // process.exit(1);
}

// Rota para receber mensagens de texto ou voz do Twilio
router.post('/', express.urlencoded({ extended: false }), async (req, res) => {
  // Log da requisição completa para depuração
  console.log('--- [Webhook Voz] INCOMING REQUEST ---');
  console.log('Headers:', JSON.stringify(req.headers, null, 2));
  console.log('Body:', JSON.stringify(req.body, null, 2));

  // IGNORAR WEBHOOKS DE STATUS/ERRO DA TWILIO
  if (req.body.Level === 'ERROR' || req.body.MessageStatus || req.body.SmsStatus) {
    console.log('[Webhook Voz] Ignorando webhook de status/erro da Twilio.');
    return res.status(200).send('Webhook de status/erro recebido e ignorado.');
  }

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

  let textoResposta = smsBody || voiceText;

  async function processarResposta() {
    if (!textoResposta && audioUrl) {
      try {
        console.log('[Webhook Voz] Baixando áudio do Twilio:', audioUrl);
        const audioBuffer = await baixarAudioTwilio(audioUrl);
        console.log('[Webhook Voz] Áudio baixado, enviando para transcrição...');
        const textoTranscrito = await transcreverAudioWhisper(audioBuffer, 'audio.ogg');
        textoResposta = textoTranscrito || '(Áudio recebido, mas não foi possível transcrever)';
        console.log('[Webhook Voz] Texto transcrito:', textoResposta);
      } catch (err) {
        console.error('[Webhook Voz] Erro ao processar/transcrever áudio:', err.message);
        textoResposta = 'Recebi um áudio, mas ocorreu um erro ao tentar processá-lo.';
      }
    }
    textoResposta = textoResposta || 'Não entendi o que você disse ou enviou.';
    console.log('[Webhook Voz] Texto para gerar áudio:', textoResposta);

    // Envia a resposta como ÁUDIO via WhatsApp
    let urlAudioResposta = null;
    try {
        console.log('[Webhook Voz] Gerando áudio da resposta...');
        urlAudioResposta = await gerarAudioUrl(textoResposta);
        console.log(`[Webhook Voz] Áudio da resposta gerado: ${urlAudioResposta}`);
    } catch (err) {
        console.error('[Webhook Voz] Erro ao gerar áudio da resposta:', err);
        // Se falhar em gerar áudio, envia texto como fallback
        urlAudioResposta = null; 
    }
    
    try {
      const destinatario = params?.From || req.body.From;
      if (!destinatario) {
        console.error('[Webhook Voz] Não foi possível identificar o destinatário para resposta WhatsApp a partir de req.body.From.');
        // Responde ao Twilio, mas indica o erro interno
        return res.status(400).json({ status: 'erro', msg: 'Destinatário não encontrado na requisição original.' });
      }

      let messageData = {
        to: destinatario, 
        from: twilioWhatsappNumber // Usa o número correto do .env
      };

      if (urlAudioResposta) {
        // Se temos URL de áudio, enviamos como mídia
        messageData.mediaUrl = [urlAudioResposta]; 
        console.log(`[Webhook Voz] Preparando para enviar ÁUDIO para ${destinatario} (URL: ${urlAudioResposta})`);
      } else {
        // Se não temos URL, enviamos a mensagem de texto
        messageData.body = textoResposta;
        console.log(`[Webhook Voz] Preparando para enviar TEXTO para ${destinatario}: ${textoResposta}`);
      }

      // Chama a função de envio com os dados montados
      const messageSid = await enviarMensagemWhatsApp(messageData);

      console.log(`✅ Mensagem enviada para ${destinatario}. SID: ${messageSid}`);
      res.status(200).json({ 
        status: 'ok', 
        destinatario: destinatario, 
        respostaEnviada: urlAudioResposta ? `Audio URL: ${urlAudioResposta}` : textoResposta 
      });
    } catch (sendError) {
      console.error(`❌ Falha ao enviar mensagem para ${destinatario}:`, sendError);
      // Nota: Não podemos mais enviar uma resposta JSON aqui se o envio falhou,
      // pois a resposta para o webhook original da Twilio já pode ter sido enviada
      // ou o Twilio pode não esperar mais uma resposta.
      // Apenas logamos o erro no servidor.
    }
  }

  processarResposta();
});

module.exports = router;
