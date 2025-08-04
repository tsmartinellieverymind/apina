/**
 * Configurações para agendamento de OS
 * 
 * Cada configuração contém:
 * - id_assunto: ID do assunto da OS no IXC
 * - prioridade: Nível de prioridade (0-5, onde 0 é a mais alta)
 * - dataMinimaAgendamentoDias: Dias mínimos para agendar a partir de hoje
 * - dataMaximaAgendamentoDias: Dias máximos para agendar a partir de hoje
 * - limiteManha: Limite de agendamentos por técnico no período da manhã (padrão: 2)
 * - limiteTarde: Limite de agendamentos por técnico no período da tarde (padrão: 3)
 */

const configuracoesAgendamento = [
  // Configuração padrão (quando não há configuração específica para o assunto)
  {
    id_assunto: 0, // 0 = configuração padrão/fallback
    prioridade: 3,
    dataMinimaAgendamentoDias: 1,
    dataMaximaAgendamentoDias: 15,
    tipo: 'manutencao'
  },

  {
    id_assunto: 1, // 0 = configuração padrão/fallback
    prioridade: 3,
    dataMinimaAgendamentoDias: 1,
    dataMaximaAgendamentoDias: 15,
    tipo: 'manutencao'
  },

  //INSTALAÇÃO COMBO(O.S) - IBIUNA
  {
    id_assunto: 16,
    prioridade: 2, // prioridade ajustada automaticamente
    dataMinimaAgendamentoDias: 5,
    dataMaximaAgendamentoDias: 20,
    tipo: 'instalacao'
  },

  //MUDANÇA DE ENDEREÇO (O.S)
  {
    id_assunto: 17,
    prioridade: 3, // prioridade ajustada automaticamente
    dataMinimaAgendamentoDias: 3,
    dataMaximaAgendamentoDias: 10,
    tipo: 'instalacao'
  },

  //TV REPARO (O.S)
  {
    id_assunto: 18,
    prioridade: 1, // prioridade ajustada automaticamente
    dataMinimaAgendamentoDias: 1,
    dataMaximaAgendamentoDias: 3,
    tipo: 'manutencao'
  },

  //VISTORIA TECNICA (OS)
  {
    id_assunto: 19,
    prioridade: 2, // prioridade ajustada automaticamente
    dataMinimaAgendamentoDias: 3,
    dataMaximaAgendamentoDias: 10,
    tipo: 'manutencao'
  }
];

module.exports = configuracoesAgendamento;
