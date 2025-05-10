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
    limiteManha: 2,
    limiteTarde: 3
  },
  
  // Instalação de Internet
  {
    id_assunto: 1,
    prioridade: 2,
    dataMinimaAgendamentoDias: 1,
    dataMaximaAgendamentoDias: 7,
    limiteManha: 2,
    limiteTarde: 3
  },
  
  // Suporte Técnico
  {
    id_assunto: 2,
    prioridade: 1,
    dataMinimaAgendamentoDias: 1,
    dataMaximaAgendamentoDias: 5,
    limiteManha: 2,
    limiteTarde: 3
  },
  
  // Cobrança
  {
    id_assunto: 8,
    prioridade: 3,
    dataMinimaAgendamentoDias: 1,
    dataMaximaAgendamentoDias: 10,
    limiteManha: 2,
    limiteTarde: 3
  }
];

module.exports = configuracoesAgendamento;
