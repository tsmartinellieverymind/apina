// index.js
const prompt = require('prompt-sync')();
const { execute } = require('./app/engine/executor');

(async () => {
  console.log("🤖 Bem-vindo ao Agent OS Tester\n");

  const intent = prompt('Digite uma intenção como "buscar_os_aberta", "atualizar_status_e_data", "agendar_os_completo" ou "buscar_colaborador_por_cpf": ou "buscar_cliente_por_cpf":');
  let params = {};

  if (intent === 'atualizar_status_e_data') {
    params.osId = prompt("ID da OS: ");
    params.novoStatus = prompt("Novo status: ");
    params.novaData = prompt("Nova data (YYYY-MM-DD): ");
  } else if (intent === 'agendar_os_completo') {
    params.osId = prompt("ID da OS: ");
    params.novaData = prompt("Data para agendamento (YYYY-MM-DD HH:mm:ss): ");
    params.idTecnico = prompt("ID do técnico: ");
    params.melhorHorario = prompt("Melhor horário (ex: M, T, Q): ");
  } else if (intent === 'buscar_colaborador_por_cpf') {
    params.cpf = prompt("CPF do colaborador: ");
  } else if (intent === 'buscar_cliente_por_cpf') {
    params.cpf = prompt("CPF do cliente: ");
  }else {
    console.log("❓ Intenção não reconhecida.");
    return;
  }

  const resposta = await execute("default-agent", intent, params);
  console.log("\n🟢 Resposta:", resposta);
})();
