# IXC Backend

## Descrição
Backend Node.js responsável pela integração com IXCSoft, automação de agendamento de Ordens de Serviço (OS), sugestões inteligentes via IA (OpenAI), e integração com serviços de voz/texto.

## Funcionalidades Principais
- Sugestão de agendamento de OS por período (manhã/tarde) conforme disponibilidade de técnicos.
- Integração com IXCSoft (API REST) para consulta e atualização de OS.
- Suporte a respostas em texto e áudio (TTS/STT via Google Cloud/OpenAI).
- Controle de setores e vínculos de técnicos via arquivos de dados e API.
- Mensagens de confirmação e atualização de OS amigáveis e detalhadas.

## Estrutura do Projeto
```
backend/
  ├── app/                # Lógica principal, dados, mocks
  ├── routes/             # Rotas Express
  ├── services/           # Integrações externas (IXC, OpenAI, Voz)
  ├── config/             # Configurações gerais
  ├── tests/              # Scripts e testes automatizados
  ├── server.js           # Inicialização do servidor Express
  └── index.js            # Entry point
```

## Setup

1. **Variáveis de Ambiente:**
   Crie um arquivo `.env` com as seguintes variáveis (exemplo):
   ```env
   IXC_API_TOKEN=seu_token_ixc
   OPENAI_API_KEY=sua_api_key_openai
   GOOGLE_APPLICATION_CREDENTIALS=caminho/para/credencial.json
   PORT=3001
   ...
   ```
2. **Instale as dependências:**
   ```bash
   npm install
   ```

## Executando a Aplicação
```bash
npm start
```
O backend será iniciado na porta definida no `.env` (padrão: 3001).

## Testes
Scripts de teste estão em `/tests`. Exemplo de execução:
```bash
node tests/testeAgendamentoOsMock.js
```

## Exemplos de Uso
### Sugestão de Agendamento de OS
Requisição para endpoint de sugestão:
```http
POST /webhook
Content-Type: application/json
{
  "ordemServico": { ... },
  "responderComAudio": false
}
```
- O campo `responderComAudio` controla se a resposta será em áudio ou texto.
- O sistema retorna `{ sugestao, alternativas }`.

### Atualização de OS
Confirmações e mensagens de atualização são detalhadas e amigáveis, incluindo assunto, data e período (manhã/tarde).

## Observações
- Para integração de voz, configure as credenciais do Google Cloud no `.env`.
- Os vínculos de técnicos/setores são controlados via `app/data/vinculos_tecnicos_setores.json`.
- O filtro de técnicos ativos é feito via API de funcionários.

## Dependências Principais
- express, axios, mongoose, dotenv, openai, @google-cloud/text-to-speech, dayjs, twilio, etc.

## Contato
Dúvidas ou sugestões? Abra uma issue ou entre em contato com o time de desenvolvimento.
