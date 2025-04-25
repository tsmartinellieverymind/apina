const promptMap = require('../intents/prompts');

class IntentModel {
  constructor(nome, codigo, filhos = []) {
    this.nome = nome;
    this.codigo = codigo;
    this.prompt = promptMap[codigo];
    this.filhos = filhos; // nomes das intents filhas
  }

  gerarPrompt() {
    return `{
  "intent": "${this.codigo}",
  "mensagem": ${JSON.stringify(this.prompt)}
}`;
  }
}

const INTENTS = [
  new IntentModel('INICIO', 'inicio', ['ALEATORIO', 'EXTRAIR_CPF']),
  new IntentModel('ALEATORIO', 'aleatorio', ['INICIO']),
  new IntentModel('EXTRAIR_CPF', 'extrair_cpf', ['ESCOLHER_OS']),
  new IntentModel('VERIFICAR_OS', 'verificar_os', ['ESCOLHER_OS']),
  new IntentModel('ESCOLHER_OS', 'escolher_os', ['AGENDAR_DATA']),
  new IntentModel('AGENDAR_DATA', 'agendar_data', ['EXTRAIR_DATA']),
  new IntentModel('EXTRAIR_DATA', 'extrair_data', ['CONFIRMAR_AGENDAMENTO']),
  new IntentModel('EXTRAIR_HORA', 'extrair_hora', ['CONFIRMAR_AGENDAMENTO']),
  new IntentModel('CONFIRMAR_AGENDAMENTO', 'confirmar_agendamento', ['FINALIZADO']),
  new IntentModel('FINALIZADO', 'finalizado', [])
];

const getIntentByCodigo = codigo => INTENTS.find(i => i.codigo === codigo);

module.exports = {
  IntentModel,
  INTENTS,
  getIntentByCodigo
};
