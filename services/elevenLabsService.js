require('dotenv').config({ path: '../.env' }); // Garante que as variáveis de ambiente sejam carregadas
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path'); // Corrigido
const { uploadToS3 } = require('./s3Service'); // Importa a função de upload do s3Service

const apiKey = process.env.ELEVENLABS_API_KEY;
const voiceId = '21m00Tcm4TlvDq8ikWAM'; // Exemplo: ID de voz padrão, ajuste se necessário
const modelId = 'eleven_multilingual_v2'; // Modelo mais recente
const outputDir = path.join(__dirname, '../app'); // Diretório para salvar temporariamente

/**
 * Gera áudio usando a API ElevenLabs, faz upload para S3 e retorna a URL pública.
 * @param {string} texto - O texto a ser convertido em áudio.
 * @returns {Promise<string>} - A URL pública do arquivo de áudio no S3.
 * @throws {Error} - Se houver falha na geração ou upload.
 */
async function gerarAudioUrl(texto) {
  if (!apiKey) {
    throw new Error('Chave da API ElevenLabs não configurada (ELEVENLABS_API_KEY).');
  }
  if (!texto) {
    throw new Error('Texto para geração de áudio não pode ser vazio.');
  }

  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;
  const headers = {
    'Accept': 'audio/mpeg',
    'Content-Type': 'application/json',
    'xi-api-key': apiKey,
  };
  const data = {
    text: texto,
    model_id: modelId,
    voice_settings: {
      stability: 0.5,
      similarity_boost: 0.75,
      // style: 0.0, // ajuste conforme necessário para o modelo v2
      // use_speaker_boost: true
    }
  };

  console.log('[ElevenLabs] Gerando áudio...');
  try {
    const response = await axios.post(url, data, { headers, responseType: 'arraybuffer' });

    if (response.status !== 200) {
      throw new Error(`Erro na API ElevenLabs: ${response.status} ${response.statusText}`);
    }

    const audioBuffer = Buffer.from(response.data);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `audio-${timestamp}.mp3`;
    
    // Não salva mais localmente, envia direto
    // const localFilePath = path.join(outputDir, fileName);
    // await fs.writeFile(localFilePath, audioBuffer);
    // console.log(`[ElevenLabs] Áudio salvo localmente: ${localFilePath}`);

    console.log(`[ElevenLabs] Enviando áudio (${fileName}) para S3...`);
    const s3Url = await uploadToS3(fileName, audioBuffer);
    console.log(`[ElevenLabs] Áudio disponível em: ${s3Url}`);
    return s3Url;

  } catch (error) {
    console.error('[ElevenLabs] Erro ao gerar ou fazer upload do áudio:', error.response ? error.response.data : error.message);
    // Tenta decodificar a resposta de erro se for JSON
    if (error.response && error.response.data instanceof ArrayBuffer) {
      try {
        const errorJson = JSON.parse(Buffer.from(error.response.data).toString('utf-8'));
        console.error('[ElevenLabs] Detalhes do erro (API):', errorJson);
      } catch (parseError) {
        // Não era JSON
      }
    }
    throw new Error('Falha ao gerar ou fazer upload do áudio do ElevenLabs.');
  }
}

module.exports = { gerarAudioUrl };
