const intentsOtimizado = {
  inicio: {
    "intent": "inicio",
    "descricao": "Ativa quando o usuário inicia uma conversa ou envia qualquer tipo de saudação (oi, olá, bom dia, boa tarde, boa noite, etc). Reconhece primeiro contato ou retomada de diálogo após pausa.",
    "exemplos_usuario": [
      "oi",
      "olá, tudo bem?",
      "bom dia",
      "boa tarde, preciso de ajuda",
      "boa noite, gostaria de falar com atendente",
      "estou com um problema",
      "preciso de suporte"
    ],
    "exemplo_resposta": "Olá, sou ${agent.nome} da Ibiunet! Tudo bem? Poderia me enviar seu CPF para iniciarmos o atendimento?"
  },

  aleatorio: {
    "intent": "aleatorio",
    "descricao": "Ativa quando o usuário envia mensagens fora do contexto esperado, aborda temas não relacionados ao atendimento, ou responde de forma vaga/imprecisa sem fornecer as informações solicitadas. Até mesmo olá ponde ser aleatório se não tem sentido com a frase anterior do agente",
    "exemplos_usuario": [
      
      "você gosta de futebol?",
      "acredita em vida extraterrestre?",
      "qual é a sua cor favorita?",
      "me conta uma piada",
      "você é um robô?",
      "não sei o que dizer agora",
      "estou só testando"
    ],
    "exemplo_resposta": "Haha, legal isso! Mas antes da gente conversar mais, preciso do seu CPF pra iniciar o atendimento, beleza?"
  },

  extrair_cpf: {
    "intent": "extrair_cpf",
    "descricao": "Ativa exclusivamente quando o usuário fornece um número de CPF válido com 11 dígitos, com ou sem pontuação (123.456.789-00 ou 12345678900). Identifica CPFs mesmo quando acompanhados de texto adicional.",
    "exemplos_usuario": [
      "123.456.789-00",
      "12345678900",
      "meu CPF é 123.456.789-00",
      "segue meu documento: 12345678900",
      "pode usar esse: 123.456.789-00",
      "o número é 12345678900, pode verificar?",
      "CPF: 123.456.789-00"
    ],
    "exemplo_resposta": "Beleza! Recebi seu CPF. Vou puxar seus dados agora."
  },

  verificar_os: {
    "intent": "verificar_os",
    "descricao": "Ativa quando o usuário solicita informações sobre o status, andamento ou agendamento de uma ordem de serviço (OS). ",
    "exemplos_usuario": [
      "qual o status da minha OS?",
      "quando o técnico vai vir?",
      "gostaria de saber sobre minha ordem de serviço",
      "tem previsão para o atendimento?",
      "Qual endereço da minha os?",
      "quero verificar o andamento do meu chamado",
      "a visita técnica já foi agendada?",
      "preciso saber quando vão resolver meu problema"
    ],
    "exemplo_resposta": "Certo, vou dar uma olhada nas suas ordens de serviço. Só um minutinho."
  },

  escolher_os: {
    "intent": "escolher_os",
    "descricao": "Ativa quando o usuário seleciona explicitamente uma OS específica, seja por número ou posição (primeira, segunda, etc). Identifica quando o usuário faz uma escolha clara, não apenas confirma uma sugestão.",
    "exemplos_usuario": [
      "12310",
      "quero a primeira",
      "prefiro a segunda",
      "é a OS 1234",
      "vou querer a terceira",
      "escolho a OS número 5678",
      "a ordem de serviço 9876, por favor",
      "pode ser a última da lista"
    ],
    "exemplo_resposta": "Perfeito! Vamos seguir com a OS ${numero} para ${assunto}. Podemos agendar a visita? Me diga qual seria a melhor data para você."
  },

  confirmar_escolha_os: {
    "intent": "confirmar_escolha_os",
    "descricao": "Ativa quando o usuário apenas confirma uma escolha de OS já sugerida, sem especificar novamente o número ou posição. Reconhece expressões simples de concordância ou aceitação.",
    "exemplos_usuario": [
      "ok",
      "pode ser",
      "fechado",
      "serve",
      "isso mesmo",
      "perfeito",
      "concordo",
      "tá bom assim"
    ],
    "exemplo_resposta": "Beleza! Vamos agendar sua visita para ${assunto}. Por favor, me diga qual seria a melhor data para você. Temos disponibilidade nos próximos dias."
  },

  agendar_data: {
    "intent": "agendar_data",
    "descricao": "Ativa quando o usuário expressa interesse em marcar, agendar ou sugerir uma data para atendimento. Reconhece solicitações diretas ou indiretas de agendamento.",
    "exemplos_usuario": [
      "quero agendar",
      "pode marcar pra mim?",
      "pode ser amanhã?",
      "pode ser na próxima sexta",
      "gostaria de marcar uma visita",
      "quando vocês têm disponibilidade?",
      "preciso agendar um horário",
      "tem como marcar para semana que vem?"
    ],
    "exemplo_resposta": "Claro! Vamos agendar sua visita para ${assunto}. Me diga qual seria a melhor data para você. Temos disponibilidade nos próximos dias, tanto pela manhã quanto à tarde."
  },

  extrair_data: {
    "intent": "extrair_data",
    "descricao": "Ativa quando o usuário menciona uma data específica em qualquer formato (numérico ou por extenso). Identifica referências a dias da semana, datas relativas (amanhã, próxima semana) ou datas absolutas (dia 20/05).",
    "exemplos_usuario": [
      "amanhã",
      "dia 20",
      "sábado",
      "Pode ser amanhã?",
      "na próxima segunda-feira",
      "dia 15/06",
      "semana que vem",
      "depois de amanhã",
      "no dia vinte e cinco deste mês"
    ],
    "exemplo_resposta": "Entendi! Você gostaria de agendar para ${diaSemana}, dia ${data}. Vou verificar a disponibilidade. Você prefere pela manhã ou à tarde?"
  },

  extrair_hora: {
    "intent": "extrair_hora",
    "descricao": "Ativa quando o usuário menciona um horário específico ou período do dia. Identifica horas exatas, intervalos de tempo ou referências a períodos (manhã, tarde, noite).",
    "exemplos_usuario": [
      "às 10",
      "no fim da tarde",
      "pela manhã",
      "entre 14h e 16h",
      "depois das 18h",
      "qualquer horário de manhã",
      "pode ser às 9:30",
      "prefiro no período da tarde"
    ],
    "exemplo_resposta": "Perfeito! Você prefere ${periodo}. Vou verificar a disponibilidade para ${diaSemana}, dia ${data}, ${periodo}. Aguarde um momento enquanto consulto o sistema."
  },

  confirmar_agendamento: {
    "intent": "confirmar_agendamento",
    "descricao": "Ativa quando o usuário aceita ou confirma uma proposta de data e horário para agendamento. Reconhece expressões de concordância com a sugestão apresentada.",
    "exemplos_usuario": [
      "pode ser",
      "fechado",
      "confirmo sim",
      "está ótimo",
      "concordo com esse horário",
      "perfeito, pode agendar",
      "sim, essa data funciona para mim",
      "tudo certo, confirmo"
    ],
    "exemplo_resposta": "Prontinho! Sua visita para ${assunto} está agendada! Ficou para ${diaSemana}, dia ${data} ${periodo}. Estou finalizando nosso atendimento. Caso precise de mim, estou por aqui. 🚀"
  },

  finalizado: {
    "intent": "finalizado",
    "descricao": "Ativa quando o usuário indica que o atendimento pode ser encerrado, seja por agradecimento, despedida ou confirmação de que não há mais dúvidas ou necessidades.",
    "exemplos_usuario": [
      "ok obrigado",
      "muito obrigada pela ajuda",
      "era só isso mesmo",
      "tchau",
      "até mais",
      "valeu, já resolveu",
      "obrigado pelo atendimento",
      "tudo certo, não preciso de mais nada"
    ],
    "exemplo_resposta": "Foi um prazer te atender! Seu agendamento está confirmado e nosso técnico estará no local na data combinada. Caso precise de mais alguma coisa, é só me chamar. Tenha um ótimo dia! 😄"
  },

  mais_detalhes: {
    "intent": "mais_detalhes",
    "descricao": "Ativa quando o usuário solicita informações adicionais sobre uma OS específica ou quando responde a uma pergunta sobre detalhes da OS. Reconhece pedidos de esclarecimento ou aprofundamento.",
    "exemplos_usuario": [
      "quero saber mais sobre essa OS",
      "pode me dar mais detalhes?",
      "o que exatamente será feito?",
      "qual o problema relatado na OS?",
      "preciso de mais informações",
      "me explica melhor o que será feito",
      "quais são os detalhes do serviço?",
      "tem mais informações sobre esse atendimento?"
    ],
    "exemplo_resposta": "Claro! Sobre a OS selecionada, posso informar que se trata de [detalhes específicos da OS]. O técnico irá [descrição do serviço] e o tempo estimado é de [duração]. Há alguma outra informação que você gostaria de saber?"
  },

  agendar_outra_data: {
    "intent": "agendar_outra_data",
    "descricao": "Ativa quando o usuário deseja alterar uma data já informada ou sugerida anteriormente. Reconhece solicitações de mudança para outro dia ou período.",
    "exemplos_usuario": [
      "Na verdade, pode marcar para outro dia",
      "Prefiro agendar para semana que vem",
      "Quero mudar a data",
      "Não, melhor marcar para sexta",
      "Decidi mudar, pode ser dia 10",
      "Pensando melhor, prefiro outro dia",
      "Essa data não vai dar, preciso reagendar",
      "Vamos tentar outra data"
    ],
    "exemplo_resposta": "Sem problemas! Vamos remarcar sua visita para ${assunto}. Me diga qual seria a nova data de sua preferência. Temos disponibilidade nos próximos dias, tanto pela manhã quanto à tarde."
  },

  datas_disponiveis: {
    "intent": "datas_disponiveis",
    "descricao": "Ativa quando o usuário solicita informações sobre opções de datas e horários disponíveis para agendamento. Reconhece pedidos de visualização de alternativas ou disponibilidade.",
    "exemplos_usuario": [
      "quero mais horários",
      "quais opções tenho de horário e data?",
      "pra quando posso agendar?",
      "quero outro horário",
      "quero outra data",
      "quais dias vocês têm disponíveis?",
      "me mostra os horários livres",
      "tem algum dia disponível na próxima semana?"
    ],
    "exemplo_resposta": "Claro! Para sua visita de ${assunto}, temos as seguintes opções de datas e horários disponíveis: ${listaOpcoes}. Qual dessas opções seria melhor para você?"
  },

  recusar_cancelar: {
    "intent": "recusar_cancelar",
    "descricao": "Ativa quando o usuário expressa desejo de cancelar, desistir ou interromper o processo atual em qualquer etapa do atendimento. Reconhece negativas e solicitações de cancelamento.Não confundir com por exemplo 'Não vai dar amanhã' nesse caso devemos mandar para 'alterar_periodo'",
    "exemplos_usuario": [
      "não",
      "desisti",
      "quero cancelar",
      "deixa pra lá",
      "não quero mais",
      "pode cancelar",
      "melhor não fazer",
      "vou pensar mais, cancela por enquanto"
    ],
    "exemplo_resposta": "Tudo bem, cancelei o processo para você. Se precisar retomar ou tiver outra dúvida, é só me chamar! 😊"
  },

  mudar_de_os: {
    "intent": "mudar_de_os",
    "descricao": "Ativa quando o usuário deseja reagendar a OS atual ou trocar para outra. Reconhece termos como 'reagendar', 'quero outra data', 'mudar OS'.",
    "exemplos_usuario": [
      "não quero essa, quero a outra OS",
      "quero reagendar outra OS",
      "prefiro agendar outra ordem",
      "quero mudar de OS",
      "posso escolher outra OS?",
      "essa não, vamos para a próxima da lista",
      "melhor verificar a outra ordem de serviço",
      "na verdade, preciso resolver a outra OS primeiro"
    ],
    "exemplo_resposta": "Sem problemas! Vamos escolher uma nova ordem de serviço para agendar. Por favor, me diga qual OS você deseja e depois selecione uma nova data para o agendamento."
  },

  alterar_periodo: {
    "intent": "alterar_periodo",
    "descricao": "Ativa quando o usuário aceita a data sugerida, mas solicita mudança apenas no período do dia (manhã, tarde ou noite). Reconhece ajustes de horário mantendo a mesma data. Por exemplo 'Amanhã não vai dar' ou 'No dia que vc me sugeriu eu tenho um aniversário'",
    "exemplos_usuario": [
      "pode ser nesse dia mas pela manhã",
      "quero no mesmo dia mas à tarde",
      "Amanhã não vai dar",
      "Ahh eu não sei",
      "Não sei dizer",
      "Não sei qual dia",
      'No dia que vc me sugeriu eu tenho um aniversário',
      "a data está boa, mas prefiro de manhã",
      "sim, mas no período da manhã",
      "concordo com o dia, mas quero mudar para o período da tarde",
      "o dia está bom, só muda para o período da manhã",
      "mantenha a data, só ajuste para depois do almoço",
      "esse dia serve, mas pode ser mais cedo?"
    ],
    "exemplo_resposta": "Entendi! Vou verificar a disponibilidade para o mesmo dia, mas no período que você prefere."
  },

  listar_opcoes: {
    "intent": "listar_opcoes",
    "descricao": "Ativa quando o usuário solicita visualizar novamente as opções disponíveis, seja de ordens de serviço ou datas para agendamento. Reconhece pedidos de repetição ou listagem de alternativas.",
    "exemplos_usuario": [
      "quais opções tenho?",
      "me mostra de novo as datas",
      "quero ver as OS disponíveis",
      "quais OS posso agendar?",
      "quais horários posso escolher?",
      "quero ver as opções de data",
      "Verificar minhas Os",
      "me mostra as OS de novo",
      "pode repetir as alternativas?",
      "queria ver as OS em aberto",
      "eu quero saber quais são em aberto",
      "me mostra as OS abertas",
      "quais são as OS em aberto?",
      "listar OS abertas",
      "ver minhas OS"
    ],
    "exemplo_resposta": "Claro! Aqui estão as opções disponíveis: Ordens de Serviço (OS): [listar OS do usuário]. Datas e horários disponíveis: [listar datas e horários sugeridos]. Se quiser escolher uma OS, basta me dizer o número. Para agendar, é só informar a data e horário que preferir!"
  },

  consultar_disponibilidade_data: {
    "intent": "consultar_disponibilidade_data",
    "descricao": "Ativa quando o usuário pergunta sobre a disponibilidade de uma data específica para agendamento. Reconhece consultas diretas sobre viabilidade de datas pontuais.",
    "exemplos_usuario": [
      "pode ser dia 25 de dezembro?",
      "tem vaga para o dia 15?", 
      "está disponível quinta-feira?",
      "consigo agendar para o próximo sábado?",
      "e se for dia 10, pode?",
      "vocês atendem dia 20?",
      "tem horário livre na próxima terça?",
      "dia 5 do mês que vem está disponível?"
    ],
    "exemplo_resposta": "Vou verificar a disponibilidade para ${diaSemana}, dia ${data}. Aguarde um momento enquanto consulto o sistema para sua visita de ${assunto}. Você tem preferência por período? Manhã ou tarde?"
  }
}

module.exports = intentsOtimizado;
