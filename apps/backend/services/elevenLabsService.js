//Utilizado para gerar áudio a partir de texto

require('dotenv').config({ path: '../.env' });
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const { uploadToS3 } = require('./s3Service');

const apiKey = process.env.ELEVENLABS_API_KEY;
const voiceId = '21m00Tcm4TlvDq8ikWAM';
const modelId = 'eleven_multilingual_v2';
const outputDir = '/tmp';

async function gerarAudioUrl(texto) {
  if (!apiKey) throw new Error('Chave da API ElevenLabs não configurada.');
  if (!texto) throw new Error('Texto não pode ser vazio.');

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = `audio-${timestamp}.mp3`;
  const outputPath = path.join(outputDir, fileName);

  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`;
  const headers = {
    'Accept': 'audio/mpeg',
    'Content-Type': 'application/json',
    'xi-api-key': apiKey,
    'User-Agent': 'MyVoiceBot/1.0 (https://meusite.com)', // IMPORTANTE para evitar bloqueio por atividade suspeita
  };

  const data = {
    text: texto,
    model_id: modelId,
    voice_settings: {
      stability: 0.5,
      similarity_boost: 0.75,
    },
  };

  try {
    console.log('[ElevenLabs] Solicitando áudio...');
    const response = await axios.post(url, data, {
      headers,
      responseType: 'arraybuffer'
    });

    if (response.status !== 200) {
      throw new Error(`Erro ${response.status}: ${response.statusText}`);
    }

    console.log('[ElevenLabs] Salvando localmente:', outputPath);
    await fs.writeFile(outputPath, response.data);

    console.log('[ElevenLabs] Fazendo upload para S3...');
    const s3Url = await uploadToS3(outputPath, fileName);
    console.log('[ElevenLabs] Upload concluído:', s3Url);

    return s3Url;

  } catch (error) {
    console.error('[ElevenLabs] Erro:', error.message);

    try {
      if (await fs.stat(outputPath)) {
        await fs.unlink(outputPath);
        console.log('[ElevenLabs] Arquivo temporário removido:', outputPath);
      }
    } catch (e) {
      if (e.code !== 'ENOENT') {
        console.warn('[ElevenLabs] Falha ao limpar temporário:', e.message);
      }
    }

    if (error.response?.data) {
      console.error('[ElevenLabs] Detalhe da API:', error.response.data);
    }

    throw new Error('Erro na geração ou upload do áudio: ' + error.message);
  }
}

module.exports = { gerarAudioUrl };
