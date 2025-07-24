/**
 * Funções utilitárias para manipulação de datas
 * Inclui verificação de dias úteis e feriados
 */

const dayjs = require('dayjs');

// Lista de feriados nacionais fixos (formato MM-DD)
const feriadosFixos = [
  '01-01', // Ano Novo
  '04-21', // Tiradentes
  '05-01', // Dia do Trabalho
  '09-07', // Independência
  '10-12', // Nossa Senhora Aparecida
  '11-02', // Finados
  '11-15', // Proclamação da República
  '12-25'  // Natal
];

/**
 * Verifica se uma data é feriado
 * @param {Object} data - Objeto dayjs
 * @returns {boolean} true se for feriado, false caso contrário
 */
function isFeriado(data) {
  const mesEDia = data.format('MM-DD');
  return feriadosFixos.includes(mesEDia);
}

/**
 * Verifica se é dia útil (não é final de semana nem feriado)
 * @param {Object} data - Objeto dayjs
 * @returns {boolean} true se for dia útil, false caso contrário
 */
function isDiaUtil(data) {
  const diaSemana = data.day();
  return diaSemana !== 0 && diaSemana !== 6 && !isFeriado(data);
}

/**
 * Obtém o próximo dia útil a partir de uma data
 * @param {Object} data - Objeto dayjs
 * @returns {Object} Próximo dia útil (objeto dayjs)
 */
function getProximoDiaUtil(data) {
  let proximoDia = data.add(1, 'day');
  while (!isDiaUtil(proximoDia)) {
    proximoDia = proximoDia.add(1, 'day');
  }
  return proximoDia;
}

/**
 * Calcula a data mínima para agendamento (próximo dia útil)
 * @returns {Object} Data mínima para agendamento (objeto dayjs)
 */
function getDataMinimaAgendamento() {
  const hoje = dayjs();
  return isDiaUtil(hoje) ? hoje : getProximoDiaUtil(hoje);
}

/**
 * Calcula a data máxima para agendamento baseado no prazo máximo em dias úteis
 * @param {Object} dataReferencia - Data de referência (objeto dayjs)
 * @param {number} prazoMaximoDias - Prazo máximo em dias úteis
 * @returns {Object} Data máxima para agendamento (objeto dayjs)
 */
function getDataMaximaAgendamento(dataReferencia, prazoMaximoDias) {
  let dataAtual = dataReferencia;
  let diasUteisContados = 0;
  
  while (diasUteisContados < prazoMaximoDias) {
    dataAtual = dataAtual.add(1, 'day');
    if (isDiaUtil(dataAtual)) {
      diasUteisContados++;
    }
  }
  
  return dataAtual;
}

/**
 * Formata uma data no formato YYYY-MM-DD para DD/MM/YYYY
 * @param {string} data - Data no formato YYYY-MM-DD
 * @returns {string} Data formatada no formato DD/MM/YYYY
 */
function formatarData(data) {
  if (!data) return '';
  const partes = data.split('-');
  if (partes.length !== 3) return data;
  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

module.exports = {
  isFeriado,
  isDiaUtil,
  getProximoDiaUtil,
  getDataMinimaAgendamento,
  getDataMaximaAgendamento,
  formatarData
};
