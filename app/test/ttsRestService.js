// Ignora SSL inválido (por causa de proxy ou antivírus)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { GoogleAuth } = require('google-auth-library');

const keyPath = path.resolve(__dirname, './secrets/text-to-speech-458821-4c53ac96822b.json');

async function gerarAudioComAxios(texto) {
  console.log('[REST] Iniciando geração com REST API...');

  const auth = new GoogleAuth({
    keyFile: keyPath,
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  });

  const client = await auth.getClient();
  const token = await client.getAccessToken();

  const url = 'https://texttospeech.googleapis.com/v1/text:synthesize';

  const payload = {
    input: { text: texto },
    voice: {
      languageCode: 'pt-BR',
      name: 'pt-BR-Neural2-B',
    },
    audioConfig: {
      audioEncoding: 'MP3',
    },
  };

  try {
    const response = await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${token.token || token}`,
        'Content-Type': 'application/json',
      },
    });

    const audioContent = response.data.audioContent;
    const outputPath = path.resolve(__dirname, 'teste-audio-rest.mp3');
    fs.writeFileSync(outputPath, audioContent, 'base64');

    console.log(`✅ [REST] Áudio salvo em: ${outputPath}`);
  } catch (err) {
    console.error('❌ [REST] Erro ao chamar API REST:', err.message);
    console.error(err?.response?.data || err);
  }
}

gerarAudioComAxios('Olá Thiago! Esse áudio foi gerado pela API REST, sem gRPC.');
