// prompts.js

const promptMap = {
  inicio: `{
    "intent": "inicio",
    "descricao": "Quando o usuário inicia uma conversa ou envia uma saudação como 'oi', 'bom dia', etc.",
    "exemplo_resposta": "Olá, sou \${agent.nome} da Ibiunet! Tudo bem? Poderia me enviar seu CPF para iniciarmos o atendimento?"
  }`,

  aleatorio: `{
    "intent": "aleatorio",
    "descricao": "Quando o usuário foge do fluxo esperado (ex.: fala de futebol, aliens, etc.) ou não responde de forma objetiva.",
    "exemplo_resposta": "Haha, legal isso! Mas antes da gente conversar mais, preciso do seu CPF pra iniciar o atendimento, beleza?"
  }`,

  extrair_cpf: `{
    "intent": "extrair_cpf",
    "descricao": "Selecionar apenas se o usuário informar um CPF válido com 11 dígitos, com ou sem pontuação. Caso mencione o CPF sem informar os números, use 'aleatorio'.",
    "exemplo_resposta": "Beleza! Recebi seu CPF. Vou puxar seus dados agora."
  }`,

  verificar_os: `{
    "intent": "verificar_os",
    "descricao": "Quando o usuário pergunta sobre status ou data de uma OS (ex.: 'qual o status da minha OS?', 'quando o técnico vem?').",
    "exemplo_resposta": "Certo, vou dar uma olhada nas suas ordens de serviço. Só um minutinho."
  }`,

  escolher_os: `{
    "intent": "escolher_os",
    "descricao": "Quando o usuário informa explicitamente o número ou a posição da OS que deseja (ex: '12310', 'a primeira', 'quero a segunda', 'é a OS 1234'). Use esta intent quando a mensagem do usuário indicar claramente qual OS ele escolheu, sem ser apenas uma confirmação.ou se o usuario estiver respondendo a alguma questão do atendente, use esta intent.",
    "exemplos_usuario": [
      "12310",
      "quero a primeira",
      "prefiro a segunda",
      "é a OS 1234",
      "vou querer a terceira"
    ],
    "exemplo_resposta": "Entendido! Vamos seguir com a OS 1234. Podemos agendar a visita?"
  }`,

  confirmar_escolha_os: `{
    "intent": "confirmar_escolha_os",
    "descricao": "Quando o usuário apenas confirma uma escolha de OS feita anteriormente, usando respostas de aceitação como: 'ok', 'pode ser', 'fechado', 'serve', 'isso mesmo'. NÃO use esta intent se o usuário informar explicitamente o número ou posição da OS na resposta.",
    "exemplos_usuario": [
      "ok",
      "pode ser",
      "fechado",
      "serve",
      "isso mesmo"
    ],
    "exemplo_resposta": "Beleza! OS confirmada. Agora vamos definir a data."
  }`,


  agendar_data: `{
    "intent": "agendar_data",
    "descricao": "Quando o usuário expressa desejo de marcar uma data ('quero agendar', 'pode marcar pra mim?','pode ser amanha?,'pode ser na proxima sexta').",
    "exemplo_resposta": "Claro! Me diz um dia que seja bom pra você."
  }`,

  extrair_data: `{
    "intent": "extrair_data",
    "descricao": "Quando o usuário menciona uma data em linguagem natural (ex.: 'amanhã', 'dia 20', 'sábado').",
    "exemplo_resposta": "Você mencionou uma data. Vou interpretar e te confirmar certinho."
  }`,

  extrair_hora: `{
    "intent": "extrair_hora",
    "descricao": "Quando o usuário menciona um horário (ex.: 'às 10', 'no fim da tarde').",
    "exemplo_resposta": "Você comentou um horário. Vou confirmar aqui no sistema e já te retorno."
  }`,

  confirmar_agendamento: `{
    "intent": "confirmar_agendamento",
    "descricao": "Quando o usuário confirma a data e horário sugeridos ('pode ser', 'fechado', 'confirmo sim').",
    "exemplo_resposta": "Perfeito! Confirmei sua visita para a data e horário combinados. 🚀"
  }`,

  finalizado: `{
    "intent": "finalizado",
    "descricao": "Quando o atendimento se encerra ou o usuário agradece e se despede.Ex (ok obrigado)",
    "exemplo_resposta": "Ótimo! Atendimento finalizado. Obrigado por falar com a gente!"
  }`,
  mais_detalhes: `{
    "intent": "mais_detalhes",
    "descricao": "A ultima pergunta deve dizer sobre mais detalhes da OS.Ou o usuario pediu detalhes sobre a OS XXX",
    "exemplo_resposta": ""
  }`,
  agendar_outra_data: `{
  intent: "agendar_outra_data",
  description: "Quando o usuário já havia informado uma data para agendamento, mas decide mudar para outra.",
  examples: [
    "Na verdade, pode marcar para outro dia.",
    "Prefiro agendar para semana que vem.",
    "Quero mudar a data.",
    "Não, melhor marcar para sexta.",
    "Decidi mudar, pode ser dia 10."
  ]
}`,

  datas_disponiveis: `{
    "intent": "datas_disponiveis",
    "descricao": "Quando o usuário pede para ver mais opções de datas e horários disponíveis para agendamento.",
    "exemplos_usuario": [
      "quero mais horarios",
      "quais opções tenho de horario e data?",
      "pra qnd posso agendar?",
      "quero outro horario",
      "quero outra data"
    ],
    "exemplo_resposta": "Aqui estão algumas datas disponíveis para agendamento. Se quiser ver horários específicos, é só pedir!"
  }`,
  recusar_cancelar: `{
    "intent": "recusar_cancelar",
    "descricao": "Quando o usuário decide cancelar, desistir ou recusar a continuidade do atendimento, por exemplo, respondendo 'não', 'desisti', 'quero cancelar', 'deixa pra lá', etc. em qualquer etapa do fluxo.",
    "exemplos_usuario": [
      "não",
      "desisti",
      "quero cancelar",
      "deixa pra lá",
      "não quero mais",
      "pode cancelar"
    ],
    "exemplo_resposta": "Tudo bem, cancelei o processo para você. Se precisar retomar ou tiver outra dúvida, é só me chamar! 😊"
  }`,

  mudar_de_os: `{
    "intent": "mudar_de_os",
    "descricao": "Quando o usuário deseja trocar a OS durante um agendamento, por exemplo, dizendo 'não quero essa, quero a outra OS', 'quero reagendar outra OS', etc.",
    "exemplos_usuario": [
      "não quero essa, quero a outra OS",
      "quero reagendar outra OS",
      "prefiro agendar outra ordem",
      "quero mudar de OS",
      "posso escolher outra OS?"
    ],
    "exemplo_resposta": "Sem problemas! Vamos escolher uma nova ordem de serviço para agendar. Por favor, me diga qual OS você deseja e depois selecione uma nova data para o agendamento."
  }`,

  alterar_periodo: `{
    "intent": "alterar_periodo",
    "descricao": "Quando o usuário aceita a data sugerida, mas deseja alterar apenas o período (manhã/tarde).",
    "exemplos_usuario": [
      "pode ser nesse dia mas pela manhã",
      "quero no mesmo dia mas à tarde",
      "a data está boa, mas prefiro de manhã",
      "sim, mas no período da manhã",
      "concordo com o dia, mas quero mudar para o período da tarde",
      "o dia está bom, só muda para o período da manhã"
    ],
    "exemplo_resposta": "Entendi! Vou verificar a disponibilidade para o mesmo dia, mas no período que você prefere."
  }`,

  listar_opcoes: `{
    "intent": "listar_opcoes",
    "descricao": "Quando o usuário pede para ver novamente as opções disponíveis de datas para agendamento ou de ordens de serviço (OS).",
    "exemplos_usuario": [
      "quais opções tenho?",
      "me mostra de novo as datas",
      "quero ver as OS disponíveis",
      "quais OS posso agendar?",
      "quais horários posso escolher?",
      "quero ver as opções de data",
      "me mostra as OS de novo"
    ],
    "exemplo_resposta": "Claro! Aqui estão as opções disponíveis: Ordens de Serviço (OS): [listar OS do usuário]. Datas e horários disponíveis: [listar datas e horários sugeridos]. Se quiser escolher uma OS, basta me dizer o número. Para agendar, é só informar a data e horário que preferir!"
  }`
};

module.exports = promptMap;
