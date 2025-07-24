const dayjs = require('dayjs');

const businessSlots = ['08:00:00', '10:00:00', '13:00:00', '15:00:00', '17:00:00'];

/**
 * Sugere uma data e horário dentro do SLA informado.
 * @param {number} slaHoras - Quantidade de horas de SLA (padrão: 72).
 * @param {string[]} [slots] - Horários válidos no formato HH:mm:ss.
 * @param {function(dayjs):boolean} [isFeriado] - Callback opcional para feriados.
 * @returns {{ data: string, hora: string }}
 */
function sugerirDataAgendamento(slaHoras = 72, slots = businessSlots, isFeriado = () => false) {
  let dt = dayjs().add(slaHoras, 'hour');

  while (dt.day() === 0 || dt.day() === 6 || isFeriado(dt)) {
    dt = dt.add(1, 'day').startOf('day');
  }

  const slot = slots.find(h => {
    const [hh] = h.split(':');
    return dt.hour() < parseInt(hh);
  }) || null;

  if (!slot) {
    do {
      dt = dt.add(1, 'day').startOf('day');
    } while (dt.day() === 0 || dt.day() === 6 || isFeriado(dt));
    return { data: dt.format('YYYY-MM-DD'), hora: slots[0] };
  }

  return { data: dt.format('YYYY-MM-DD'), hora: slot };
}

/**
 * Retorna o nome do dia da semana em português para uma data.
 * @param {string|Date|dayjs} data - Data no formato YYYY-MM-DD, Date ou dayjs
 * @returns {string} Nome do dia da semana (ex: "domingo", "segunda-feira")
 */
function diaDaSemanaExtenso(data) {
  const nomes = [
    'domingo',
    'segunda-feira',
    'terça-feira',
    'quarta-feira',
    'quinta-feira',
    'sexta-feira',
    'sábado'
  ];
  const d = dayjs(data);
  return nomes[d.day()];
}

module.exports = {
  sugerirDataAgendamento,
  diaDaSemanaExtenso
};
