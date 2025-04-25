// prompts.js

const promptMap = {
  inicio: `{
    "intent": "inicio",
    "descricao": "Quando o usuário inicia uma conversa ou envia uma saudação como 'oi', 'bom dia', etc.",
    "exemplo_resposta": "Olá, sou \${agent.nome} da Ibiunet! Tudo bem? Poderia me enviar seu CPF para iniciarmos o atendimento?"
  }`,

  aleatorio: `{
    "intent": "aleatorio",
    "descricao": "Quando o usuário foge do fluxo esperado (ex: fala de futebol, aliens, etc.) ou não responde de forma objetiva.",
    "exemplo_resposta": "Haha, legal isso! Mas antes da gente conversar mais, preciso do seu CPF pra iniciar o atendimento, beleza?"
  }`,

  extrair_cpf: `{
    "intent": "extrair_cpf",
    "descricao": "Selecionar apenas se o usuário informar um CPF válido com 11 dígitos, com ou sem pontuação. Caso mencione o CPF sem informar os números, use 'aleatorio'.",
    "exemplo_resposta": "Beleza! Recebi seu CPF. Vou puxar seus dados agora."
  }`,

  verificar_os: `{
    "intent": "verificar_os",
    "descricao": "Quando o usuário pergunta sobre o status ou data de uma OS (ex: 'qual o status da minha OS?', 'quando o técnico vem?').",
    "exemplo_resposta": "Certo, vou dar uma olhada nas suas ordens de serviço. Só um minutinho."
  }`,

  escolher_os: `{
    "intent": "escolher_os",
    "descricao": "Quando o usuário escolhe uma OS, geralmente por número ou posição (ex: 'quero a primeira', 'é a OS 1234').",
    "exemplo_resposta": "Entendido! Vamos seguir com a OS 1234. Podemos agendar a visita?"
  }`,

  agendar_data: `{
    "intent": "agendar_data",
    "descricao": "Quando o usuário expressa desejo de marcar uma data (ex: 'quero agendar', 'pode marcar pra mim?').",
    "exemplo_resposta": "Claro! Me diz um dia que seja bom pra você."
  }`,

  extrair_data: `{
    "intent": "extrair_data",
    "descricao": "Quando o usuário menciona uma data em linguagem natural (ex: 'amanhã', 'dia 20', 'sábado').",
    "exemplo_resposta": "Você mencionou uma data. Vou interpretar e te confirmar certinho."
  }`,

  extrair_hora: `{
    "intent": "extrair_hora",
    "descricao": "Quando o usuário menciona um horário (ex: 'às 10', 'no fim da tarde', 'de manhã').",
    "exemplo_resposta": "Você comentou um horário. Vou confirmar aqui no sistema e já te retorno."
  }`,

  confirmar_agendamento: `{
    "intent": "confirmar_agendamento",
    "descricao": "Quando o usuário confirma a data e/ou hora sugerida (ex: 'pode ser', 'fechado', 'confirmo sim').",
    "exemplo_resposta": "Perfeito! Confirmei sua visita. Qualquer coisa, é só me chamar."
  }`,

  finalizado: `{
    "intent": "finalizado",
    "descricao": "Quando o atendimento se encerra ou o usuário agradece, se despede etc.",
    "exemplo_resposta": "Ótimo! Atendimento finalizado. Obrigado por falar com a gente!"
  }`
};

module.exports = promptMap;
