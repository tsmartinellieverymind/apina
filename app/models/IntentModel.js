// app/models/IntentModel.js

const promptMap = require('../intents/prompts');

class IntentModel {
  constructor(nome, codigo, filhos = []) {
    this.nome = nome;
    this.codigo = codigo;
    this.prompt = JSON.parse(promptMap[codigo]); // Já transforma o texto do prompts.js em objeto JSON
    this.filhos = filhos; // Lista de códigos de intents filhas
  }

  gerarPrompt() {
    return {
      intent: this.prompt.intent,
      descricao: this.prompt.descricao,
      exemplo_resposta: this.prompt.exemplo_resposta
    };
  }
}

// Lista de todas as Intents do sistema
const INTENTS = [
  new IntentModel('INICIO', 'inicio', ['ALEATORIO', 'EXTRAIR_CPF']),
  new IntentModel('ALEATORIO', 'aleatorio', ['INICIO']),
  new IntentModel('EXTRAIR_CPF', 'extrair_cpf', ['ESCOLHER_OS']),
  new IntentModel('VERIFICAR_OS', 'verificar_os', ['ESCOLHER_OS']),
  new IntentModel('ESCOLHER_OS', 'escolher_os', ['CONFIRMAR_ESCOLHA_OS', 'AGENDAR_DATA']),
  new IntentModel('CONFIRMAR_ESCOLHA_OS', 'confirmar_escolha_os', ['AGENDAR_DATA']),
  new IntentModel('AGENDAR_DATA', 'agendar_data', ['EXTRAIR_DATA', 'EXTRAIR_HORA', 'DATAS_DISPONIVEIS', 'ALTERAR_PERIODO']),
  new IntentModel('DATAS_DISPONIVEIS', 'datas_disponiveis', ['CONFIRMAR_AGENDAMENTO', 'AGENDAR_OUTRA_DATA']),
  new IntentModel('EXTRAIR_DATA', 'extrair_data', ['CONFIRMAR_AGENDAMENTO']),
  new IntentModel('EXTRAIR_HORA', 'extrair_hora', ['CONFIRMAR_AGENDAMENTO']),
  new IntentModel('ALTERAR_PERIODO', 'alterar_periodo', ['CONFIRMAR_AGENDAMENTO']),
  new IntentModel('CONFIRMAR_AGENDAMENTO', 'confirmar_agendamento', ['FINALIZADO']),
  new IntentModel('FINALIZADO', 'finalizado', []),
  new IntentModel('MAIS_DETALHES', 'mais_detalhes', []),
  new IntentModel('RECUSAR_CANCELAR', 'recusar_cancelar', ['INICIO']),
  new IntentModel('MUDAR_DE_OS', 'mudar_de_os', ['ESCOLHER_OS']),
  new IntentModel('LISTAR_OPCOES', 'listar_opcoes', ['ESCOLHER_OS', 'AGENDAR_DATA'])
];

// Função auxiliar para buscar uma intent pelo código
const getIntentByCodigo = (codigo) => INTENTS.find(i => i.codigo === codigo);

module.exports = {
  IntentModel,
  INTENTS,
  getIntentByCodigo
};
