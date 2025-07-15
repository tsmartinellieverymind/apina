function logEstado({ numero, user, intent, resposta }) {
  console.log('\n========= ESTADO DA SESSÃO =========');

  // Campos principais destacados
  const principais = {
    numero,
    etapaAtual: user.etapaAtual,
    etapaAnterior: user.etapaAnterior,
    cpf: user.cpf,
    clienteId: user.clienteId,
    nomeCliente: user.nomeCliente,
    osEscolhida: user.osEscolhida?.id || null,
    dataInterpretada: user.dataInterpretada,
    periodo: user.periodoAgendamento // Usando a propriedade correta periodoAgendamento
  };

  // Todos os atributos restantes do user (exceto os já destacados)
  const extras = {};
  Object.keys(user).forEach(key => {
    if (!(key in principais)) {
      extras[key] = user[key];
    }
  });

  // Exibe tabela com principais e extras
  console.table({ ...principais, ...extras });
  console.log('OS abertas:', (user.osList || []).map(o => o.id).join(', ') || '—');
  console.log('====================================\n');
}

module.exports = { logEstado };