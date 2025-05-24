// Patch 1: Add aguardandoConfirmacao flag to extrair_data handler
// This patch adds a flag to indicate we're waiting for user confirmation before finalizing an appointment

// For line 1095 - After setting tipoUltimaPergunta to AGENDAMENTO
user.sugestaoData = user.dataInterpretada;
user.sugestaoPeriodo = user.periodoAgendamento;
user.tipoUltimaPergunta = 'AGENDAMENTO';
user.aguardandoConfirmacao = true; // Flag para indicar que estamos aguardando confirmação
