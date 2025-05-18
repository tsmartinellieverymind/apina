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
  
  // Instalação de Internet
  {
    id_assunto: 1,
    prioridade: 2,
    dataMinimaAgendamentoDias:1,
    dataMaximaAgendamentoDias:5,
    tipo: 'instalacao'
  },
  
  // Suporte Técnico
  {
    id_assunto: 2,
    prioridade: 1,
    dataMinimaAgendamentoDias: 1,
    dataMaximaAgendamentoDias: 5,
    tipo: 'manutencao'
  },
  
  // Cobrança
  {
    id_assunto: 3,
    prioridade: 3,
    dataMinimaAgendamentoDias: 1,
    dataMaximaAgendamentoDias: 10,
    tipo: 'instalacao'
  }
];

module.exports = configuracoesAgendamento;
