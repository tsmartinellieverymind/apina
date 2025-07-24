# Configuração do Job de Atribuição de Setores

## Visão Geral

O sistema possui um job automático que atribui setores às Ordens de Serviço (OS) que não possuem setor definido. Este job pode ser habilitado ou desabilitado conforme necessário.

## Configuração

### Variável de Ambiente

A flag `ENABLE_SETOR_JOB` controla se o job deve ser executado:

```bash
# Para HABILITAR o job
ENABLE_SETOR_JOB=true

# Para DESABILITAR o job (padrão)
ENABLE_SETOR_JOB=false
# ou simplesmente omitir a variável
```

### Comportamento Padrão

- **Por padrão, o job está DESABILITADO**
- O job só é iniciado se:
  1. `ENABLE_SETOR_JOB=true` estiver definido no `.env`
  2. MongoDB estiver conectado
  3. `API_TOKEN` estiver configurado

## Mensagens do Sistema

### Job Habilitado e Funcionando
```
✅ Job de atribuição de setores iniciado com sucesso!
```

### Job Desabilitado
```
ℹ️ Job de atribuição de setores está desabilitado (ENABLE_SETOR_JOB=false).
Para habilitar, defina ENABLE_SETOR_JOB=true no arquivo .env.
```

### Problemas de Configuração
```
⚠️ Job de atribuição de setores não pôde ser iniciado.
Verifique se a variável API_TOKEN está configurada no arquivo .env.
```

### MongoDB Desconectado
```
⚠️ Servidor iniciando sem conexão com MongoDB. Job de atribuição de setores não será iniciado.
```

## Como Habilitar

1. Abra o arquivo `.env` na raiz do projeto backend
2. Adicione ou modifique a linha:
   ```
   ENABLE_SETOR_JOB=true
   ```
3. Reinicie o servidor:
   ```bash
   node server.js
   ```

## Como Desabilitar

1. Abra o arquivo `.env` na raiz do projeto backend
2. Modifique a linha para:
   ```
   ENABLE_SETOR_JOB=false
   ```
   Ou simplesmente remova a linha
3. Reinicie o servidor

## Funcionalidade do Job

Quando habilitado, o job:

1. **Executa automaticamente** a cada intervalo definido
2. **Busca OS abertas** sem setor atribuído
3. **Atribui setores** baseado nas regras de negócio
4. **Envia notificações** via WhatsApp quando necessário
5. **Registra logs** de todas as operações

## Dependências

- **MongoDB**: Necessário para armazenar dados de usuários e sessões
- **API IXC**: Token necessário para buscar e atualizar OS
- **Twilio**: Para envio de notificações via WhatsApp (opcional)

## Troubleshooting

### Job não inicia mesmo com ENABLE_SETOR_JOB=true

1. Verifique se o MongoDB está conectado
2. Verifique se `API_TOKEN` está configurado
3. Verifique os logs do servidor para erros específicos

### Job para de funcionar

1. Verifique a conexão com MongoDB
2. Verifique se o token da API IXC não expirou
3. Verifique os logs para identificar erros específicos

## Logs Relevantes

O sistema registra logs importantes sobre o job:

- Início e parada do job
- Processamento de cada OS
- Erros de API ou conexão
- Status de envio de notificações

Monitore os logs para acompanhar o funcionamento do job.
