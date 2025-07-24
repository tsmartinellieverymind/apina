// prompts.js

const promptMap = {
    status: `{
            Campo: Status
            Campo obrigatório: Sim
            Valor Padrão: Aberta
            Valores disponíveis:
            A = Aberta
            AN = Análise
            EN = Encaminhada
            AS = Assumida
            AG = Agendada
            DS = Deslocamento
            EX = Execução
            F = Finalizada
            RAG = Aguardando reagendamento
    }`,
  
    outro: `{
    ??
    }`,
 
  };
  
  module.exports = promptMap;
  