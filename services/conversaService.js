const Conversa = require('../app/models/Conversa');

async function salvarConversa({ numero, mensagem_usuario, mensagem_sistema, intent, etapa, dados_extras }) {
  try {
    const conversa = new Conversa({
      numero,
      mensagem_usuario,
      mensagem_sistema,
      intent,
      etapa,
      dados_extras
    });

    await conversa.save();
    console.log('💾 Conversa salva com sucesso');
  } catch (err) {
    console.error('❌ Erro ao salvar conversa:', err);
  }
}

module.exports = {
  salvarConversa
};
