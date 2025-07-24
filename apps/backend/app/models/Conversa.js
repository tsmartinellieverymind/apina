const mongoose = require('mongoose');
//Utiliazdo para armazenar as conversas do chatbot
const ConversaSchema = new mongoose.Schema({
  numero: { type: String, required: true, index: true },
  mensagem_usuario: String,
  mensagem_sistema: String,
  intent: String,
  etapa: String,
  dados_extras: Object,
  data_hora: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Conversa', ConversaSchema);
