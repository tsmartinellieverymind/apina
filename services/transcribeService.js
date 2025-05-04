const axios = require('axios');
require('dotenv').config();

/**
 * Baixa um arquivo de áudio de uma URL protegida do Twilio
 * @param {string} url - URL do arquivo de áudio
 * @returns {Promise<Buffer>} - Buffer do áudio
 */
async function baixarAudioTwilio(url) {
  // Twilio exige autenticação básica
  const username = process.env.TWILIO_ACCOUNT;
  const password = process.env.TWILIO_API_TOKEN;
  const response = await axios.get(url, {
    responseType: 'arraybuffer',
    auth: { username, password }
  });
  return response.data;
}

/**
 * Envia áudio para o Whisper API da OpenAI e retorna a transcrição
 * @param {Buffer} audioBuffer - Buffer do áudio
 * @param {string} filename - Nome do arquivo (ex: audio.ogg)
 * @returns {Promise<string>} - Texto transcrito
 */
async function transcreverAudioWhisper(audioBuffer, filename = 'audio.ogg') {
  const apiKey = process.env.OPENAI_API_KEY;
  const formData = new FormData();
  formData.append('file', audioBuffer, filename);
  formData.append('model', 'whisper-1');

  const response = await axios.post('https://api.openai.com/v1/audio/transcriptions', formData, {
    headers: {
      ...formData.getHeaders(),
      'Authorization': `Bearer ${apiKey}`
    }
  });
  return response.data.text;
}

module.exports = { baixarAudioTwilio, transcreverAudioWhisper };
