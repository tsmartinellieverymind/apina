process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
/**
 * Serviço para integração com a API do IXC
 */

const axios = require('axios');
const https = require('https');
const dayjs = require('dayjs');
const isBetween = require('dayjs/plugin/isBetween');
const { isDiaUtil, getProximoDiaUtil } = require('./ixcUtilsData');
const configuracoesAgendamento = require('../app/data/configuracoes_agendamentos.js');

dayjs.extend(isBetween);

// Configuração do cliente API
const api = axios.create({

  baseURL: process.env.API_URL || 'https://demo.ixcsoft.com.br/webservice/v1',
  auth: {
    username: process.env.API_USER || 'user',
    password: process.env.API_PASS || 'pass'
  },

  headers: {
    'Content-Type': 'application/json',
    ixcsoft: 'listar'
  }
});

/**
 * Verifica a disponibilidade de uma data e período específicos para agendamento
 * @param {Object} os - Objeto da OS
 * @param {Object} opcoes - Opções de verificação
 * @param {string} opcoes.data - Data para verificar (YYYY-MM-DD)
 * @param {string} opcoes.periodo - Período para verificar (M ou T)
 * @returns {Object} Resultado da verificação de disponibilidade
 */
async function verificarDisponibilidade(os, opcoes = {}) {
  const { data, periodo } = opcoes;
  
  if (!data) {
    return { disponivel: false, motivo: 'Data não especificada' };
  }
  
  // Converter para objeto dayjs
  const dataObj = dayjs(data);
  if (!dataObj.isValid()) {
    return { disponivel: false, motivo: 'Data inválida' };
  }
  
  // Verificar se é dia útil
  if (!isDiaUtil(dataObj)) {
    return { disponivel: false, motivo: 'Não é um dia útil' };
  }
  
  // Gerar sugestões de agendamento para obter técnicos disponíveis
  const sugestoes = await gerarSugestoesDeAgendamento(os, { dataEspecifica: data, periodoEspecifico: periodo });
  
  // Se não há sugestões, não há disponibilidade
  if (!sugestoes.sugestao && (!sugestoes.alternativas || sugestoes.alternativas.length === 0)) {
    return { disponivel: false, motivo: 'Não há técnicos disponíveis' };
  }
  
  // Verificar se há disponibilidade para o período especificado
  let disponibilidadePeriodo = false;
  let tecnicoDisponivel = null;
  let ocupacaoTecnico = 0;
  let periodosDisponiveis = [];
  
  // Se um período específico foi solicitado, verificar apenas esse período
  if (periodo) {
    const opcaoDisponivel = sugestoes.alternativas.find(alt => 
      alt.data === data && alt.periodo === periodo
    ) || (sugestoes.sugestao && sugestoes.sugestao.data === data && sugestoes.sugestao.periodo === periodo ? sugestoes.sugestao : null);
    
    disponibilidadePeriodo = !!opcaoDisponivel;
    if (disponibilidadePeriodo) {
      tecnicoDisponivel = opcaoDisponivel.id_tecnico;
      ocupacaoTecnico = opcaoDisponivel.ocupacao;
    }
  } 
  // Se nenhum período específico foi solicitado, verificar todos os períodos disponíveis
  else {
    const opcoesDisponiveis = sugestoes.alternativas.filter(alt => alt.data === data);
    if (sugestoes.sugestao && sugestoes.sugestao.data === data) {
      opcoesDisponiveis.push(sugestoes.sugestao);
    }
    
    disponibilidadePeriodo = opcoesDisponiveis.length > 0;
    if (disponibilidadePeriodo) {
      // Obter todos os períodos disponíveis para esta data
      periodosDisponiveis = [...new Set(opcoesDisponiveis.map(op => op.periodo))];
      
      // Selecionar o primeiro técnico disponível como exemplo
      const primeiraOpcao = opcoesDisponiveis[0];
      tecnicoDisponivel = primeiraOpcao.id_tecnico;
      ocupacaoTecnico = primeiraOpcao.ocupacao;
    }
  }
  
  // Construir resposta
  const resposta = {
    disponivel: disponibilidadePeriodo,
    data: data,
    periodo: periodo,
    motivo: disponibilidadePeriodo ? 'Disponível' : 'Não há disponibilidade para o período solicitado',
    periodos_disponiveis: periodosDisponiveis,
    tecnico: tecnicoDisponivel ? {
      id: tecnicoDisponivel,
      ocupacao: ocupacaoTecnico
    } : null,
    alternativas: sugestoes.alternativas
  };
  
  return resposta;
}

/**
 * Valida se a data solicitada não ultrapassa o SLA da OS
 * @param {Object} os - Objeto da OS
 * @param {Object} dataObj - Objeto dayjs da data solicitada
 * @returns {Object|null} Retorna erro se ultrapassar SLA, null se estiver ok
 */
function validarSLA(os, dataObj) {
  const idAssunto = os.id_assunto;
  const config = configuracoesAgendamento.find(c => c.id_assunto == idAssunto);
  
  if (config) {
    const diasMax = config.dataMaximaAgendamentoDias;
    
    // Buscar data de criação/abertura da OS (campos comuns no IXC)
    const dataCriacao = os.data_cadastro || os.data_abertura || os.data_criacao || os.data_inicio;
    
    if (dataCriacao) {
      const dataCriacaoObj = dayjs(dataCriacao);
      if (dataCriacaoObj.isValid()) {
        // Calcular data limite do SLA (data de criação + diasMax)
        const dataLimiteSLA = dataCriacaoObj.add(diasMax, 'day');
        
        // Se hoje já passou do SLA, retornar erro
        const hoje = dayjs();
        if (hoje.isAfter(dataLimiteSLA)) {
          return { 
            disponivel: false, 
            motivo: 'Acima do SLA - prazo máximo para agendamento já foi ultrapassado' 
          };
        }
        
        // Se a data solicitada for maior que o limite do SLA, retornar erro
        if (dataObj.isAfter(dataLimiteSLA)) {
          return { 
            disponivel: false, 
            motivo: `Acima do SLA - data limite para agendamento: ${dataLimiteSLA.format('DD/MM/YYYY')}` 
          };
        }
      }
    }
  }
  
  return null; // SLA ok
}

/**
 * Verifica se uma data e período específicos estão disponíveis para agendamento
 * @param {Object} os - Objeto da OS
 * @param {Object} opcoes - Opções de verificação
 * @returns {Object} Resultado da verificação de disponibilidade
 */
async function verificarDisponibilidadeData(os, opcoes = {}) {
  const { data, periodo } = opcoes;
  
  if (!data) {
    return { disponivel: false, motivo: 'Data não especificada' };
  }
  
  // Converter para objeto dayjs
  const dataObj = dayjs(data);
  if (!dataObj.isValid()) {
    return { disponivel: false, motivo: 'Data inválida' };
  }
  
  // Verificar se é dia útil
  if (!isDiaUtil(dataObj)) {
    return { disponivel: false, motivo: 'Não é um dia útil' };
  }
  
  // Verificar se não é agendamento para hoje
  const hoje = dayjs();
  if (dataObj.isSame(hoje, 'day')) {
    return { disponivel: false, motivo: 'Não é possível agendar para o dia atual' };
  }
  
  // Validar SLA
  const erroSLA = validarSLA(os, dataObj);
  if (erroSLA) {
    return erroSLA;
  }
  
  // Gerar sugestões de agendamento para obter técnicos disponíveis
  const sugestoes = await gerarSugestoesDeAgendamento(os, { dataEspecifica: data, periodoEspecifico: periodo });
  
  // Se não há sugestões, não há disponibilidade
  if (!sugestoes.sugestao && (!sugestoes.alternativas || sugestoes.alternativas.length === 0)) {
    return { disponivel: false, motivo: 'Não há técnicos disponíveis' };
  }
  
  // Verificar se há disponibilidade para o período especificado
  let disponibilidadePeriodo = false;
  let tecnicoDisponivel = null;
  let ocupacaoTecnico = 0;
  let periodosDisponiveis = [];
  
  // Se um período específico foi solicitado, verificar apenas esse período
  if (periodo) {
    const opcaoDisponivel = sugestoes.alternativas.find(alt => 
      alt.data === data && alt.periodo === periodo
    ) || (sugestoes.sugestao && sugestoes.sugestao.data === data && sugestoes.sugestao.periodo === periodo ? sugestoes.sugestao : null);
    
    disponibilidadePeriodo = !!opcaoDisponivel;
    if (disponibilidadePeriodo) {
      tecnicoDisponivel = opcaoDisponivel.id_tecnico;
      ocupacaoTecnico = opcaoDisponivel.ocupacao;
    }
  } 
  // Se nenhum período específico foi solicitado, verificar todos os períodos disponíveis
  else {
    const opcoesDisponiveis = sugestoes.alternativas.filter(alt => alt.data === data);
    if (sugestoes.sugestao && sugestoes.sugestao.data === data) {
      opcoesDisponiveis.push(sugestoes.sugestao);
    }
    
    disponibilidadePeriodo = opcoesDisponiveis.length > 0;
    if (disponibilidadePeriodo) {
      // Obter todos os períodos disponíveis para esta data
      periodosDisponiveis = [...new Set(opcoesDisponiveis.map(op => op.periodo))];
      
      // Selecionar o primeiro técnico disponível como exemplo
      const primeiraOpcao = opcoesDisponiveis[0];
      tecnicoDisponivel = primeiraOpcao.id_tecnico;
      ocupacaoTecnico = primeiraOpcao.ocupacao;
    }
  }
  
  // Construir resposta
  const resposta = {
    disponivel: disponibilidadePeriodo,
    data: data,
    periodo: periodo,
    motivo: disponibilidadePeriodo ? 'Disponível' : 'Não há disponibilidade para o período solicitado',
    periodos_disponiveis: periodosDisponiveis,
    tecnico: tecnicoDisponivel ? {
      id: tecnicoDisponivel,
      ocupacao: ocupacaoTecnico
    } : null,
    alternativas: sugestoes.alternativas
  };
  
  return resposta;
}

async function gerarSugestoesDeAgendamento(os, opcoes = {}) {
  // Lógica original da API
  const { dataEspecifica, periodoEspecifico } = opcoes;
  console.log('====[ gerarSugestoesDeAgendamento ]====');
  console.log('[LOG] Opções recebidas:', opcoes);
  console.log('[LOG] Objeto OS recebido:', JSON.stringify(os, null, 2));
  // Removed log referencing prioridade before it's defined

  // Encontrar configuração para o assunto da OS
  const idAssunto = os.id_assunto;
  const config = configuracoesAgendamento.find(c => c.id_assunto == idAssunto);

  if (!config) {
    console.error(`[ERRO] Configuração de agendamento não encontrada para o assunto ID: ${idAssunto}`);
    // Retorna vazio se não encontrar config, impedindo agendamento.
    return { sugestao: null, alternativas: [] };
  }else{
    console.log(`[LOG] Configuração de agendamento encontrada para o assunto ID: ${idAssunto}`);
  }

  // Extrair dados da configuração encontrada
  const prioridade = config.prioridade;
  const diasMin = config.dataMinimaAgendamentoDias;
  const diasMax = config.dataMaximaAgendamentoDias;

  console.log('[LOG] prioridade:', prioridade);
  console.log('[LOG] diasMin:', diasMin);
  console.log('[LOG] diasMax:', diasMax);
 
  // Calcular data mínima
  let dataMinimaObj;
  
  // Se foi especificada uma data, usar essa data como mínima
  if (dataEspecifica && dayjs(dataEspecifica).isValid()) {
    dataMinimaObj = dayjs(dataEspecifica);
    console.log(`[INFO] Usando data específica como mínima: ${dataMinimaObj.format('DD/MM/YYYY')}`);
  } else {
    dataMinimaObj = dayjs(); // Começa de hoje
    if (diasMin > 0) {
        dataMinimaObj = dataMinimaObj.add(diasMin, 'day');
    }
    // Garante que a data mínima seja um dia útil
    while (!isDiaUtil(dataMinimaObj)) {
        dataMinimaObj = dataMinimaObj.add(1, 'day');
    }
  }

  // Calcular data máxima
  let dataMaximaObj;
  
  // Se foi especificada uma data, usar essa data como máxima também
  if (dataEspecifica && dayjs(dataEspecifica).isValid()) {
    dataMaximaObj = dayjs(dataEspecifica);
    console.log(`[INFO] Usando data específica como máxima: ${dataMaximaObj.format('DD/MM/YYYY')}`);
  } else {
    // CORRE��O: Usar a data m�nima como base para o c�lculo da data m�xima
    dataMaximaObj = dataMinimaObj.clone(); // Come�a da data m�nima j� calculada // Começa da data base
    let diasUteisContados = 0;

    // Adiciona 'diasMax' dias úteis à data base
    while (diasUteisContados < diasMax) {
        dataMaximaObj = dataMaximaObj.add(1, 'day');
        if (isDiaUtil(dataMaximaObj)) {
            diasUteisContados++;
        }
    }
  }

  // Garante que a data máxima seja pelo menos um dia útil após a data mínima
  let dataMinimaMaisUmDiaUtil = getProximoDiaUtil(dataMinimaObj);
  if (dataMaximaObj.isBefore(dataMinimaMaisUmDiaUtil)) {
      dataMaximaObj = dataMinimaMaisUmDiaUtil;
      console.log(`[INFO] Data máxima ajustada para ${dataMaximaObj.format('DD/MM/YYYY')} para garantir intervalo mínimo.`);
  }

  console.log(`OS ID: ${os.id}, Assunto: ${idAssunto}, Setor: ${os.setor}`);
  console.log(`Config encontrada: Prioridade=${prioridade}, MinDias=${diasMin}, MaxDias=${diasMax}`);
  console.log(`[LOG] Datas para análise: mínima=${dataMinimaObj.format('YYYY-MM-DD')}, máxima=${dataMaximaObj.format('YYYY-MM-DD')}`);
  console.log(`Data mínima calculada: ${dataMinimaObj.format('DD/MM/YYYY')}`);
  console.log(`Data máxima calculada: ${dataMaximaObj.format('DD/MM/YYYY')}`);

  // Carregar vínculos de técnicos com setores de forma assíncrona
  const { vinculosTecnicoSetor } = require('./ixcConfigAgendamento');
  const vinculos = await vinculosTecnicoSetor();
  console.log(`[LOG] Vinculos: ${JSON.stringify(vinculos, null, 2)}`);  

  // Corrigir campo de setor
  const setor = String(os.id_setor || os.setor_id || os.setor);
  
  // Declarar variáveis que serão usadas fora do try block
  let idsTecnicosVinculados = [];
  let tecnicosSetor = [];
  
  try {
    // 1. Buscar OS agendadas do mesmo setor, status 'AG', dentro do período definido
    const body = new URLSearchParams();
    body.append('qtype', 'su_oss_chamado.status');
    body.append('query', 'AG');
    body.append('oper', '=');
    body.append('page', '1');
    body.append('rp', '1000');
    body.append('sortname', 'su_oss_chamado.id');
    body.append('sortorder', 'desc');

    const response = await api.post('/su_oss_chamado', body, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        ixcsoft: 'listar'
      }
    });

    const osAgendadas = response.data.registros.filter(o => 
      o.status === 'AG' && 
      o.data_agenda_final && 
      dayjs(o.data_agenda_final).isBetween(dataMinimaObj, dataMaximaObj, null, '[]')
      //  &&
      // o.id_tecnico
    );
    console.log('[1] Total de OS agendadas consideradas:', osAgendadas.length);
    osAgendadas.forEach(o => {
      console.log(`[1.1] OS ${o.id} - Técnico: ${o.id_tecnico}, Data: ${o.data_agenda_final}, Período: ${o.melhor_horario_agenda}`);
    });

    // 3. Montar períodos ocupados por técnico e data
    const ocupadosPorTecnico = {};
    for (const o of osAgendadas) {
      const idTec = o.id_tecnico;
      const data = dayjs(o.data_agenda_final).format('YYYY-MM-DD');
      const hora = dayjs(o.data_agenda_final).format('HH:mm:ss');
      const periodo = o.melhor_horario_agenda || (parseInt(hora) < 12 ? 'M' : 'T'); // Usa 'M' ou 'T' baseado na hora
      
      if (!ocupadosPorTecnico[idTec]) ocupadosPorTecnico[idTec] = {};
      if (!ocupadosPorTecnico[idTec][data]) ocupadosPorTecnico[idTec][data] = { M: 0, T: 0 };
      ocupadosPorTecnico[idTec][data][periodo]++;
    }
    
    console.log('[3] Mapeamento de ocupação por técnico concluído');
    Object.entries(ocupadosPorTecnico).forEach(([tec, datas]) => {
      Object.entries(datas).forEach(([data, periodos]) => {
        console.log(`[3.1] Técnico ${tec} - ${data}: manhã=${periodos.M}, tarde=${periodos.T}`);
      });
    });

    // 4. Buscar todos os técnicos na API e depois filtrar pelo vínculo com o setor da OS
    const bodyTec = new URLSearchParams();
    console.log('[4] Buscando técnicos ativos na API...');
    bodyTec.append('page', '1');
    bodyTec.append('rp', '2000');
    bodyTec.append('sortname', 'funcionarios.id');
    bodyTec.append('sortorder', 'asc');
    // Filtro simples apenas para ativos
    bodyTec.append('qtype', 'ativo');
    bodyTec.append('query', 'S');
    bodyTec.append('oper', '=');
    
    try {
      console.log('[DEBUG] Parâmetros da requisição:', Object.fromEntries(bodyTec.entries()));
      
      const respTec = await api.post('/funcionarios', bodyTec, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', ixcsoft: 'listar' }
      });
      
      console.log('[DEBUG] Status da resposta:', respTec.status);
      console.log('[DEBUG] Headers da resposta:', respTec.headers);
      console.log('[DEBUG] Estrutura da resposta:', Object.keys(respTec.data || {}));
      
      const registros = respTec.data?.registros || {};
      console.log('[DEBUG] Total de registros recebidos:', Object.keys(registros).length);
      
      let tecnicosApi = Object.values(registros);
      console.log('[DEBUG] Total técnicos retornados (antes de filtrar):', tecnicosApi.length);
      
      // Filtrar por id_funcao=2 no código
      tecnicosApi = tecnicosApi.filter(tec => tec.id_funcao === '2');
      console.log('[DEBUG] Total técnicos após filtrar por id_funcao=2:', tecnicosApi.length);
      console.log('[DEBUG] Primeiros 10 técnicos (se existirem):', 
                 tecnicosApi.slice(0, 10).map(t => ({ id: t.id, nome: t.funcionario, id_funcao: t.id_funcao })));
      
      // Usar a estrutura correta: vinculos[setor] contém os IDs dos técnicos vinculados
      idsTecnicosVinculados = vinculos[setor] || [];
      console.log('[DEBUG] Setor da OS:', setor);
      console.log('[DEBUG] IDs de técnicos vinculados ao setor:', idsTecnicosVinculados);
      
      // Filtrar técnicos que estão vinculados ao setor
      tecnicosSetor = tecnicosApi
        .filter(tec => {
          const matched = idsTecnicosVinculados.includes(String(tec.id));
          if (matched) console.log(`[DEBUG] Técnico ${tec.id} (${tec.funcionario}) está vinculado ao setor ${setor}`);
          return matched;
        })
        .map(tec => tec.id);
      
      console.log('[DEBUG] Técnicos ativos e vinculados ao setor:', tecnicosSetor);
        
    } catch (e) {
      console.error('Erro ao buscar técnicos ativos:', e.message, e.stack);
    }

    // 5. Gerar períodos disponíveis por técnico
    const alternativas = [];
    const limiteAgendamentos = { M: 2, T: 3 }; // 2 pela manhã, 3 à tarde
    
    for (const idTec of tecnicosSetor) {
      console.log(`[5] Gerando períodos disponíveis para técnico ${idTec}`);
      
      // Percorrer todas as datas dentro do período definido
      let dia = dataMinimaObj.clone();
      const datasDisponiveis = [];
      
      while (dia.isBefore(dataMaximaObj, 'day') || dia.isSame(dataMaximaObj, 'day')) {
        // Verificar se é dia útil (não é final de semana nem feriado)
        if (isDiaUtil(dia)) {
          const dataStr = dia.format('YYYY-MM-DD');
          const ocupados = ocupadosPorTecnico[idTec]?.[dataStr] || { M: 0, T: 0 };
          const periodosDisponiveis = [];
          // Só há dois períodos possíveis: manhã (M) e tarde (T)
          for (const periodo of ['M', 'T']) {
            if (ocupados[periodo] < limiteAgendamentos[periodo]) {
              periodosDisponiveis.push(periodo);
            }
          }
          
          if (periodosDisponiveis.length > 0) {
            console.log(`[5.1] Técnico ${idTec} - Data ${dataStr} disponível nos períodos: ${periodosDisponiveis.join(', ')}`);
            datasDisponiveis.push({ data: dataStr, periodos: periodosDisponiveis });
          }
        }
        dia = dia.add(1, 'day');
      }
      
      // Se há datas disponíveis para este técnico
      if (datasDisponiveis.length > 0) {
        // Se foi especificada uma data/período, filtrar apenas as opções que atendem
        if (dataEspecifica || periodoEspecifico) {
          const dataFiltro = dataEspecifica ? dayjs(dataEspecifica).format('YYYY-MM-DD') : null;
          
          for (const disp of datasDisponiveis) {
            // Verificar se a data corresponde ao filtro (se houver)
            if ((!dataFiltro || disp.data === dataFiltro)) {
              for (const p of disp.periodos) {
                // Verificar se o período corresponde ao filtro (se houver)
                if (!periodoEspecifico || p === periodoEspecifico) {
                  alternativas.push({
                    data: disp.data,
                    periodo: p,
                    id_tecnico: idTec,
                    ocupacao: ocupadosPorTecnico[idTec]?.[disp.data]?.[p] || 0,
                    limite: limiteAgendamentos[p]
                  });
                }
              }
            }
          }
        } 
        // Se não há filtros, adicionar todas as opções
        else {
          for (const disp of datasDisponiveis) {
            for (const p of disp.periodos) {
              alternativas.push({
                data: disp.data,
                periodo: p,
                id_tecnico: idTec,
                ocupacao: ocupadosPorTecnico[idTec]?.[disp.data]?.[p] || 0,
                limite: limiteAgendamentos[p]
              });
            }
          }
        }
      }
    }
    
    // 6. Ordenar alternativas por data, período preferido e ocupação
    // Determinar período preferido com base no horário atual
    const horaAtual = dayjs().hour();
    const periodoPreferido = os.melhor_horario_agenda || (horaAtual < 12 ? 'M' : 'T');
    console.log(`[INFO] Período preferido: ${periodoPreferido}`);
    
    alternativas.sort((a, b) => {
      // Primeiro ordenar por data
      if (a.data !== b.data) {
        return dayjs(a.data).isBefore(dayjs(b.data)) ? -1 : 1;
      }
      
      // Se mesma data, ordenar pelo período preferido
      if (a.periodo !== b.periodo) {
        return a.periodo === periodoPreferido ? -1 : 1;
      }
      
      // Se mesmo período, ordenar pela menor ocupação
      if (a.ocupacao !== b.ocupacao) {
        return a.ocupacao - b.ocupacao;
      }
      
      // Se mesma ocupação, ordenar pelo ID do técnico (apenas para estabilidade)
      return a.id_tecnico - b.id_tecnico;
    });
    
    console.log(`[7] Total de alternativas geradas: ${alternativas.length}`);
    
    // 7. Definir sugestão principal (primeira alternativa)
    const sugestao = alternativas.length > 0 ? alternativas[0] : null;
    if (sugestao) {
      console.log(`[8] Sugestão principal: { id_tecnico: '${sugestao.id_tecnico}', data: '${sugestao.data}', periodo: '${sugestao.periodo}' }`);
    } else {
      console.log('[8] Nenhuma sugestão disponível');
    }
    
    // 8. Retornar sugestão principal e alternativas
    return {
      sugestao,
      alternativas: alternativas.slice(1) // Todas as alternativas exceto a primeira (que é a sugestão principal)
    };
    
  } catch (error) {
    console.error('Erro ao gerar sugestões de agendamento:', error);
    return { sugestao: null, alternativas: [] };
  }
}

/**
 * Busca cliente pelo ID
 * @param {string} clienteId - ID do cliente
 * @returns {Object} Resultado da busca
 */
async function buscarClientePorId(clienteId) {
  if (!clienteId) {
    return { mensagem: 'ID do cliente não fornecido' };
  }
  const body = new URLSearchParams();
  body.append('qtype', 'cliente.id');
  body.append('query', clienteId);
  body.append('oper', '=');
  body.append('page', '1');
  body.append('rp', '10');
  body.append('sortname', 'cliente.id');
  body.append('sortorder', 'asc');
  try {
    const response = await api.post('/cliente', body, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', ixcsoft: 'listar' }
    });
    const registros = response.data?.registros;
    if (!registros || Object.keys(registros).length === 0) {
      return { mensagem: `Não encontrei nenhum cliente com o ID ${clienteId} em nosso sistema.` };
    }
    const cliente = Object.values(registros).find(c => String(c.id) === String(clienteId));
    if (!cliente) {
      return { mensagem: `Não encontrei nenhum cliente com o ID ${clienteId} em nosso sistema.` };
    }
    return { mensagem: '✅ Cliente encontrado', cliente };
  } catch (error) {
    console.error('❌ Erro ao buscar cliente por ID:', error.message);
    return { mensagem: `❌ Erro ao buscar cliente por ID: ${error.message}` };
  }
}

/**
 * Busca cliente pelo CPF
 * @param {string} cpf - CPF do cliente
 * @returns {Object} Resultado da busca
 */
async function buscarClientePorCpf(cpf) {
  const cpfFormatado = formatarCpf(cpf);

  const body = new URLSearchParams();
  body.append('qtype', 'cliente.cnpj_cpf');
  body.append('query', cpfFormatado);
  body.append('oper', '=');
  body.append('page', '1');
  body.append('rp', '10000');
  body.append('sortname', 'cliente.id');
  body.append('sortorder', 'asc');

  try {
    const response = await api.post('/cliente', body, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', ixcsoft: 'listar' }
    });

    const registros = response.data?.registros;
    if (!registros || Object.keys(registros).length === 0) {
      return { mensagem: `Não encontrei nenhum cliente com o CPF ${cpfFormatado} em nosso sistema. Poderia verificar se o número está correto e tentar novamente?` };
    }

    const cliente = Object.values(registros).find(c => (c.cnpj_cpf || '').trim() === cpfFormatado);

    if (!cliente) {
      return { mensagem: `Não encontrei nenhum cliente com o CPF ${cpfFormatado} em nosso sistema. Poderia verificar se o número está correto e tentar novamente?` };
    }

    return { mensagem: '✅ Cliente encontrado', cliente };
  } catch (error) {
    console.error('❌ Erro ao buscar cliente:', error.message);
    return { mensagem: `❌ Erro ao buscar cliente: ${error.message}` };
  }
}

/**
 * Formata um CPF para o formato padrão XXX.XXX.XXX-XX
 * @param {string} cpf - CPF a ser formatado
 * @returns {string} CPF formatado
 */
function formatarCpf(cpf) {
  // Validação de segurança para evitar erro com valores null/undefined
  if (!cpf || typeof cpf !== 'string') {
    return cpf;
  }
  
  const apenasNumeros = cpf.replace(/\D/g, '');
  return apenasNumeros.length === 11
    ? apenasNumeros.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
    : cpf;
}

/**
 * Busca OSs de um cliente pelo ID
 * @param {string} clienteId - ID do cliente
 * @returns {Array} Lista de OSs do cliente
 */
async function buscarOSPorClienteId(clienteId) {
  console.log('buscarOSPorClienteId:', clienteId);

  const body = new URLSearchParams();
  body.append('qtype', 'su_oss_chamado.id_cliente');
  body.append('query', clienteId);
  body.append('oper', '=');
  body.append('page', '1');
  body.append('rp', '50');
  body.append('sortname', 'su_oss_chamado.id');
  body.append('sortorder', 'desc');

  try {
    const response = await api.post('/su_oss_chamado', body, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', ixcsoft: 'listar' }
    });

    const registros = response.data?.registros || [];
    
    // Enriquecer OSs com descrições dos assuntos
    const osEnriquecidas = await enriquecerOSComDescricoes(registros);
    
    return osEnriquecidas;
  } catch (error) {
    console.error('❌ Erro ao buscar OS por clienteId:', error);
    return [];
  }
}

/**
 * Atualiza uma OS
 * @param {string} osId - ID da OS
 * @param {Object} payload - Dados para atualização
 * @returns {Object} Resultado da atualização
 */
async function atualizarOS(osId, payload) {
  console.log('atualizarOS (PUT):', osId, payload);
  try {
    // Verificar se usuário e senha estão disponíveis
    if (!process.env.API_USER || !process.env.API_PASS) {
      console.error('❌ Erro: Usuário ou senha da API IXC não configurados para atualizar OS');
      throw new Error('Usuário ou senha da API não configurados');
    }

    const url = `/su_oss_chamado/${osId}`;
    const headers = {
      'Content-Type': 'application/json',
      'ixcsoft': ''
    };
    // Axios suporta basic auth diretamente
    const response = await api.put(url, payload, {
      headers,
      auth: {
        username: process.env.API_USER,
        password: process.env.API_PASS
      }
    });

    return response.data;
  } catch (error) {
    console.error('❌ Erro ao atualizar OS:', error);
    throw error;
  }
}

/**
 * Busca OSs abertas sem setor atribuído
 * @returns {Promise<Array>} Lista de OSs abertas sem setor
 */
async function buscarOSAbertas() {
  try {
    console.log('Buscando OSs abertas sem setor atribuído...');
    
    // Criar corpo da requisição exatamente como buscarClientePorCpf
    const body = new URLSearchParams();
    body.append('qtype', 'su_oss_chamado.status');
    body.append('query', 'A'); // Status A = Aberto
    body.append('oper', '=');
    body.append('page', '1');
    body.append('rp', '100');
    body.append('sortname', 'su_oss_chamado.id');
    body.append('sortorder', 'desc');
    
    // Usar o cliente API padrão com autenticação básica
    console.log('[buscarOSAbertas] Parâmetros da requisição:', body.toString());
    const response = await api.post('/su_oss_chamado', body, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', ixcsoft: 'listar' }
    });
    
    console.log(api.getUri());
    console.log('[buscarOSAbertas] Resposta bruta da API:', JSON.stringify(response.data, null, 2));

    // Filtrar OSs com bairro preenchido e limitar a 1 resultado
    let registros = response.data && response.data.registros ? response.data.registros : [];
    const registrosComBairro = registros.filter(os => os.bairro && os.bairro.trim() !== '');
    console.log(`[buscarOSAbertas] Total retornado da API: ${registros.length}, com bairro preenchido: ${registrosComBairro.length}`);
   
   
    return registrosComBairro.slice(0, 1);
    
  } catch (error) {
    console.error('Erro ao buscar OSs abertas:', error.message);
    return [];
  }
}

/**
 * Busca OSs abertas sem setor atribuído
 * @returns {Promise<Array>} Lista de OSs abertas sem setor
 */
async function buscarOSAbertaComBairro() {
  try {
    console.log('Buscando OSs abertas COM bairro preenchido...');
    
    const body = new URLSearchParams();
    // body.append('qtype', 'su_oss_chamado.status');
    // body.append('query', 'A'); // Status A = Aberto AG = Agendada 
    // inclui o qtype de setor
    body.append('qtype', 'su_oss_chamado.setor');
    body.append('query', '17'); // Status A = Aberto AG = Agendada 
    body.append('oper', '=');
    body.append('page', '1');
    body.append('rp', '100');
    body.append('sortname', 'su_oss_chamado.id');
    body.append('sortorder', 'desc');
    
    console.log('[buscarOSAbertaComBairro] Parâmetros da requisição:', body.toString());
    const response = await api.post('/su_oss_chamado', body, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', ixcsoft: 'listar' }
    });
    
    console.log(api.getUri());
    //console.log('[buscarOSAbertaComBairro] Resposta bruta da API:', JSON.stringify(response.data, null, 2));

    // Filtrar OSs com bairro preenchido e limitar a 1 resultado
    let registros = response.data && response.data.registros ? response.data.registros : [];
    const registrosComBairro = registros.filter(os => os.bairro && os.bairro.trim() !== '');
    console.log(`[buscarOSAbertaComBairro] Total retornado da API: ${registros.length}, com bairro preenchido: ${registrosComBairro.length}`);
    // Retorna apenas o primeiro registro com bairro preenchido
    return registrosComBairro.slice(0, 1);

  } catch (error) {
    console.error('Erro ao buscar OSs abertas:', error.message);
    return [];
  }
}

/**
 * Busca detalhes da OS incluindo bairro e tipo de serviço
 * @param {Object} os - Objeto da OS
 * @returns {Promise<Object>} Detalhes da OS
 */
async function buscarDetalhesOS(os) {
  try {
    // Buscar detalhes da OS
    const params = {
      token: process.env.API_TOKEN,
      qtype: 'su_oss.id',
      query: os.id,
      oper: '=',
      page: '1',
      rp: '1',
      sortname: 'su_oss.id',
      sortorder: 'desc'
    };

    const response = await api.post('su_oss', params);
    
    if (!response.data || !response.data.registros || response.data.registros.length === 0) {
      console.error(`OS não encontrada com o ID ${os.id}`);
      return null;
    }
    
    const osDetalhes = response.data.registros[0];
    
    // Buscar detalhes do cliente para obter o bairro
    const clienteParams = {
      token: process.env.API_TOKEN,
      qtype: 'cliente.id',
      query: osDetalhes.id_cliente,
      oper: '=',
      page: '1',
      rp: '1'
    };
    
    const clienteResponse = await api.post('cliente', clienteParams);
    
    if (!clienteResponse.data || !clienteResponse.data.registros || clienteResponse.data.registros.length === 0) {
      console.error(`Cliente não encontrado para a OS ${os.id}`);
      return null;
    }
    
    const cliente = clienteResponse.data.registros[0];
    
    // Buscar detalhes do assunto para determinar o tipo de serviço
    const assuntoParams = {
      token: process.env.API_TOKEN,
      qtype: 'su_oss_assunto.id',
      query: os.id_assunto,
      oper: '=',
      page: '1',
      rp: '1'
    };
    
    const assuntoResponse = await api.post('su_oss_assunto', assuntoParams);
    
    let tipoServico = 'instalação'; // Valor padrão
    
    if (assuntoResponse.data && assuntoResponse.data.registros && assuntoResponse.data.registros.length > 0) {
      const assunto = assuntoResponse.data.registros[0];
      
      // Determinar o tipo de serviço com base no assunto
      if (assunto.descricao.toLowerCase().includes('manuten')) {
        tipoServico = 'manutenção';
      }
    }
    
    return {
      osId: os.id,
      bairro: cliente.bairro,
      tipoServico: tipoServico
    };
  } catch (error) {
    console.error(`Erro ao buscar detalhes da OS ${os.id}:`, error.message);
    return null;
  }
}

/**
 * Atualiza a OS com o setor determinado
 * @param {string} osId - ID da OS
 * @param {string} setorId - ID do setor
 * @returns {Promise<boolean>} Sucesso da atualização
 */
async function atualizarOSComSetor(osCompleta, setorId) {
  try {
    if (!osCompleta || !osCompleta.id) {
      console.error('[atualizarOSComSetor] Objeto da OS não fornecido ou inválido!');
      return false;
    }
    const osId = osCompleta.id;
    const payload = { ...osCompleta, setor: setorId };
    console.log(`[atualizarOSComSetor] Iniciando atualização da OS ${osId} para setor ${setorId}`);
    console.log('[atualizarOSComSetor] Payload enviado:', JSON.stringify(payload, null, 2));
    let resultado;
    try {
      resultado = await atualizarOS(osId, payload);
      console.log('[atualizarOSComSetor] Resposta da API:', JSON.stringify(resultado, null, 2));
    } catch (errorAtualizar) {
      console.error('[atualizarOSComSetor] Erro ao chamar atualizarOS:', errorAtualizar.message);
      if (errorAtualizar.response) {
        console.error('Status HTTP:', errorAtualizar.response.status);
        console.error('Body da resposta:', JSON.stringify(errorAtualizar.response.data, null, 2));
      }
      console.error('[atualizarOSComSetor] Payload enviado para atualizarOS:', JSON.stringify(payload, null, 2));
      console.error('Stack trace:', errorAtualizar.stack);
      return false;
    }
    if ((resultado && resultado.status === 'success') || (resultado && resultado.type === 'success')) {
      console.log(`✅ OS ${osId} atualizada com sucesso para o setor ${setorId}`);
      // Buscar cliente pelo id_cliente da OS
      const idCliente = osCompleta.id_cliente || osCompleta.idCliente || osCompleta.cliente_id;
      if (idCliente) {
        try {
          const resultadoCliente = await buscarClientePorId(idCliente);
          console.log('[atualizarOSComSetor] Retorno bruto da API buscarClientePorId:', JSON.stringify(resultadoCliente, null, 2));
          if (resultadoCliente && resultadoCliente.cliente) {
            const c = resultadoCliente.cliente;
            console.log(`[atualizarOSComSetor] Dados do cliente vinculado à OS ${osId}: Nome: ${c.razao || c.nome} | Telefones: ${c.fone || c.telefone_celular || c.whatsapp}`);
            // Enviar mensagem WhatsApp para o cliente usando twillioService.js
            try {
              const { enviarMensagemWhatsApp } = require('./twillioService');
              const numeroDestino = c.whatsapp || c.telefone_celular || c.fone;
              if (numeroDestino) {
                const numeroFormatado = numeroDestino.startsWith('+') ? numeroDestino : `+55${numeroDestino.replace(/\D/g, '')}`;
                const messageData = {
                  to: `whatsapp:${numeroFormatado}`,
                  from: process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886', // ou seu número aprovado
                  body: 'Olá'
                };
                const sid = await enviarMensagemWhatsApp(messageData);
                console.log(`[atualizarOSComSetor] WhatsApp enviado para ${numeroFormatado}: SID ${sid} (aguardando status...)`);
                // Buscar status atualizado após 5 segundos
                setTimeout(async () => {
                  try {
                    const twilio = require('twilio');
                    const accountSid = process.env.TWILIO_ACCOUNT;
                    const authToken = process.env.TWILIO_API_TOKEN;
                    const client = twilio(accountSid, authToken);
                    const msgStatus = await client.messages(sid).fetch();
                    console.log('[Twilio][DEBUG] Detalhes completos da mensagem:', JSON.stringify(msgStatus, null, 2));
                    console.log(`[Twilio] Status atualizado da mensagem SID ${sid}: ${msgStatus.status}`);
                    if (msgStatus.errorCode || msgStatus.errorMessage) {
                      console.error(`[Twilio] Erro no envio: code=${msgStatus.errorCode}, message=${msgStatus.errorMessage}`);
                    }
                  } catch (e) {
                    console.error(`[Twilio] Erro ao buscar status da mensagem:`, e.message, e.stack);
                  }
                }, 5000);
              } else {
                console.log('[atualizarOSComSetor] Nenhum número válido encontrado para envio de WhatsApp.');
              }
            } catch (erroWhats) {
              console.error('[atualizarOSComSetor] Erro ao enviar WhatsApp via Twilio:', erroWhats.message);
            }
          } else {
            console.log(`[atualizarOSComSetor] Não foi possível obter detalhes do cliente para OS ${osId}:`, resultadoCliente && resultadoCliente.mensagem);
          }
        } catch (erroBuscaCliente) {
          console.error(`[atualizarOSComSetor] Erro ao buscar cliente vinculado à OS ${osId}:`, erroBuscaCliente.message);
        }
      } else {
        console.log(`[atualizarOSComSetor] id_cliente não encontrado na OS ${osId}, não foi possível buscar dados do cliente.`);
      }
      return true;
    }
    console.error(`❌ Erro ao atualizar OS ${osId}:`);
    if (resultado) {
      console.error('Resposta da API:', JSON.stringify(resultado, null, 2));
    }
    console.error('[atualizarOSComSetor] Payload enviado para atualizarOS:', JSON.stringify(payload, null, 2));
    return false;
  } catch (error) {
    console.error(`[atualizarOSComSetor] Exceção ao atualizar OS com o setor ${setorId}:`, error.message);
    if (error.response) {
      console.error('Status HTTP:', error.response.status);
      console.error('Body da resposta:', JSON.stringify(error.response.data, null, 2));
    }
    console.error('Stack trace:', error.stack);
    return false;
  }
}

/**
}

/**
 * Usa o OpenAI para encontrar o setor mais próximo com base no bairro
 * @param {string} bairro - Nome do bairro
 * @param {string} tipoServico - Tipo de serviço (instalação ou manutenção)
 * @returns {Promise<string|null>} ID do setor ou null se não encontrado
 */
async function findSetorByBairro(bairro, tipoServico) {
  console.log(`[findSetorByBairro] Iniciando busca para bairro: ${bairro}, tipoServico: ${tipoServico}`);
  try {
    const mongoose = require('mongoose');
    const { OpenAI } = require('openai');
    
    // Log do estado da conexão MongoDB
    console.log(`[findSetorByBairro] Estado atual da conexão MongoDB: ${mongoose.connection.readyState} (0=desconectado, 1=conectado, 2=conectando, 3=desconectando)`);
    console.log(`[findSetorByBairro] MONGO_URI definida: ${process.env.MONGO_URI ? 'Sim' : 'Não'}`);
    
    // Verificar se a chave da OpenAI está definida
    console.log(`[findSetorByBairro] OPENAI_API_KEY definida: ${process.env.OPENAI_API_KEY ? 'Sim' : 'Não'}`);
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    
    // Conectar ao MongoDB se ainda não estiver conectado
    if (mongoose.connection.readyState !== 1) {
      console.log(`[findSetorByBairro] Tentando conectar ao MongoDB...`);
      try {
        
        await mongoose.connect(process.env.MONGO_URI, {
          tls: true,
          tlsAllowInvalidCertificates: true
        });
        console.log(`[findSetorByBairro] Conexão com MongoDB estabelecida com sucesso!`);
      } catch (mongoError) {
        console.error(`[findSetorByBairro] ERRO ao conectar ao MongoDB:`, mongoError);
        throw mongoError; // Propagar o erro para ser capturado pelo catch externo
      }
    }
    
    // Buscar todos os setores disponíveis
    console.log(`[findSetorByBairro] Tentando acessar a coleção 'configuracoes.setores'...`);
   
    const db = mongoose.connection.useDb('configuracoes');
    const setoresCollection = db.collection('setores');
    console.log(`[findSetorByBairro] Buscando todos os setores...`);
    const todosSetores = await setoresCollection.find({setores: {$exists: true}}).toArray();
    console.log('[findSetorByBairro][DADOS DO BANCO]:', JSON.stringify(todosSetores, null, 2));
    if (todosSetores.length === 0) {
      console.log('[findSetorByBairro] Nenhum setor encontrado na base de dados.');
      return null;
    }
    // Montar lista filtrando apenas bairros que possuem id válido para o tipo solicitado
    const tipoId = tipoServico === 'instalação' ? 'instalacao' : 'manutencao';
    const bairrosComIds = todosSetores
      .filter(s => s.setores && s.setores[tipoId])
      .map(s => ({
        bairro: s.bairro,
        instalacao: s.setores.instalacao,
        manutencao: s.setores.manutencao
      }));
    console.log(`[findSetorByBairro] Bairros conhecidos com ids válidos para o tipo '${tipoServico}': ${JSON.stringify(bairrosComIds)}`);

    // Prompt estruturado para o OpenAI
    const prompt = ` Dada a lista abaixo de bairros e seus respectivos ids para instalação e manutenção, encontre o bairro com nome mais similar ao bairro "${bairro}".

A similaridade deve ser baseada nos seguintes critérios (nesta ordem de prioridade):

Ter o mesmo id de manutenção que o bairro "${bairro}"

O tipo de serviço é "${tipoServico}".

Retorne apenas um JSON no formato: 
{ 
"sucesso_busca": <true ou false bairro foi encontrado?>,
"bairro": <nome do bairro encontrado>,
 "id": <id correspondente ao tipo>, 
 "tipo": "${tipoServico}" 
 }

 Caso não encontre o bairro, retorne:
 { 
 "sucesso_busca": false,
 "bairro": "",
 "id": "",
 "tipo": "${tipoServico}" 
 }


 Lista:
${JSON.stringify(bairrosComIds)}
Apenas retorne o JSON, sem explicações.`;
    console.log(`[findSetorByBairro][PROMPT ENVIADO AO OPENAI]:`, prompt);
    // Usar OpenAI para encontrar o bairro mais próximo
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "Você é um assistente especializado em encontrar correspondências entre bairros e ids de setor. Sempre retorne apenas o JSON solicitado."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 150
      });
      let resposta = completion.choices[0].message.content.trim();
      resposta = resposta.replace(/^```json[\s\r\n]*/i, '').replace(/^```[\s\r\n]*/i, '').replace(/```$/g, '').trim();
      console.log(`[findSetorByBairro][RESPOSTA OPENAI]:`, resposta);
      // Remover blocos de markdown ```json ... ``` ou ```
      try {
        return  JSON.parse(resposta);
      } catch (e) {
        console.error('[findSetorByBairro][ERRO PARSE JSON]:', e, resposta);
        return null;
      }
      // if (respostaJson && respostaJson.id) {
      //   // Salvar correspondência para uso futuro
      //   console.log(`[findSetorByBairro] Setor encontrado via IA para o bairro ${bairro} (similar a ${respostaJson.bairro}): ${respostaJson.id}`);
      //   try {
      //     await setoresCollection.insertOne({
      //       bairro: bairro,
      //       tipoServico: tipoServico,
      //       id_setor: respostaJson.id,
      //       bairroOriginal: respostaJson.bairro,
      //       criadoEm: new Date(),
      //       criadoPor: 'IA'
      //     });
      //     console.log(`[findSetorByBairro] Correspondência salva com sucesso!`);
      //   } catch (insertError) {
      //     console.error(`[findSetorByBairro] ERRO ao salvar correspondência:`, insertError);
      //   }
      //   return respostaJson.id;
      // } else {
      //   console.log(`[findSetorByBairro] Nenhum setor encontrado para o bairro similar.`);
      //   return null;
      // }
      
    } catch (openaiError) {
      console.error(`[findSetorByBairro] ERRO ao chamar OpenAI:`, openaiError);
      throw openaiError; // Propagar o erro para ser capturado pelo catch externo
    }
    
  } catch (error) {
    console.error(`[findSetorByBairro] ERRO GERAL ao buscar setor via IA para o bairro ${bairro}:`, error);
    console.error(`[findSetorByBairro] Stack trace:`, error.stack);
    return null;
  }
}

/**
 * Busca descrições dos assuntos das OSs
 * @param {Array} osIds - Array de IDs dos assuntos
 * @returns {Object} Mapeamento de ID do assunto para descrição
 */
async function buscarDescricoesAssuntos(assuntoIds) {
  try {
    if (!assuntoIds || assuntoIds.length === 0) {
      return {};
    }

    // Remover duplicatas
    const idsUnicos = [...new Set(assuntoIds.filter(id => id))];
    
    const descricoes = {};
    
    // Buscar cada assunto individualmente
    for (const assuntoId of idsUnicos) {
      try {
        const body = new URLSearchParams();
        body.append('qtype', 'id');
        body.append('query', assuntoId);
        body.append('oper', '=');
        body.append('page', '1');
        body.append('rp', '1');
        
        const response = await api.post('/su_oss_assunto', body, {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            ixcsoft: 'listar'
          }
        });
        
        if (response.data && response.data.registros && Object.keys(response.data.registros).length > 0) {
          const assunto = Object.values(response.data.registros)[0];
          descricoes[assuntoId] = assunto.assunto || 'Sem descrição';
        } else {
          descricoes[assuntoId] = 'Sem descrição';
        }
      } catch (error) {
        console.error(`Erro ao buscar assunto ${assuntoId}:`, error.message);
        descricoes[assuntoId] = 'Sem descrição';
      }
    }
    
    return descricoes;
  } catch (error) {
    console.error('Erro ao buscar descrições dos assuntos:', error.message);
    return {};
  }
}

/**
 * Enriquece uma lista de OSs com as descrições dos assuntos
 * @param {Array} osList - Lista de OSs
 * @returns {Array} Lista de OSs com descrições enriquecidas
 */
async function enriquecerOSComDescricoes(osList) {
  try {
    if (!osList || osList.length === 0) {
      return osList;
    }

    // Extrair IDs dos assuntos
    const assuntoIds = osList.map(os => os.id_assunto).filter(id => id);
    
    // Buscar descrições
    const descricoes = await buscarDescricoesAssuntos(assuntoIds);
    
    // Enriquecer OSs com descrições
    return osList.map(os => {
      let descricaoFinal = descricoes[os.id_assunto];
      
      // Se não conseguiu buscar a descrição do assunto ou retornou 'Sem descrição',
      // usar titulo ou mensagem como fallback
      if (!descricaoFinal || descricaoFinal === 'Sem descrição') {
        descricaoFinal = os.titulo || os.mensagem || 'Sem descrição';
      }
      
      return {
        ...os,
        descricaoAssunto: descricaoFinal
      };
    });
  } catch (error) {
    console.error('Erro ao enriquecer OSs com descrições:', error.message);
    // Mesmo com erro, retornar OSs com fallback para titulo/mensagem
    return osList.map(os => ({
      ...os,
      descricaoAssunto: os.titulo || os.mensagem || 'Sem descrição'
    }));
  }
}

module.exports = {
  verificarDisponibilidade,
  verificarDisponibilidadeData,
  gerarSugestoesDeAgendamento,
  buscarDescricoesAssuntos,
  enriquecerOSComDescricoes,
  buscarClientePorCpf,
  formatarCpf,
  buscarOSPorClienteId,
  atualizarOS,
  // Funções para atribuição de setores
  buscarOSAbertas,
  buscarDetalhesOS,
  atualizarOSComSetor,
  buscarOSAbertaComBairro,
  findSetorByBairro,
  buscarClientePorId
};
