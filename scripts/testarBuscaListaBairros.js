require('dotenv').config();
const mongoose = require('mongoose');

async function testarBuscaListaBairros() {
  try {
    console.log('Conectando ao MongoDB:', process.env.MONGO_URI);
    await mongoose.connect(process.env.MONGO_URI, {
      tls: true,
      tlsAllowInvalidCertificates: true
    });
    const db = mongoose.connection.useDb('IXC_SETORES');
    const setoresCollection = db.collection('setores');
    console.log('Buscando setores...');
    const listaBairros = await setoresCollection.find({}).toArray();
    console.log(`Total de setores encontrados: ${listaBairros.length}`);
    if (listaBairros.length > 0) {
      console.log('Exemplo de setor:', JSON.stringify(listaBairros[0], null, 2));
      if (listaBairros.length > 1) {
        console.log('Exemplo de segundo setor:', JSON.stringify(listaBairros[1], null, 2));
      }
    } else {
      console.log('Nenhum setor encontrado na coleção!');
    }
    await mongoose.disconnect();
    console.log('Conexão com MongoDB encerrada.');
  } catch (error) {
    console.error('Erro ao buscar lista de bairros/setores:', error);
    try { await mongoose.disconnect(); } catch(e) {}
  }
}

testarBuscaListaBairros();
