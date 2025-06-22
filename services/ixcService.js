/**
 * Serviço para integração com a API do IXC
 */

const axios = require('axios');
const https = require('https');
const dayjs = require('dayjs');
const isBetween = require('dayjs/plugin/isBetween');
const { isDiaUtil, getProximoDiaUtil } = require('./ixcUtilsData');
const configuracoesAgendamento = require('../app/data/configuracoes_agendamentos.js');
const path = require('path');
const fs = require('fs');

dayjs.extend(isBetween);

// Configuração do cliente API
const api = axios.create({

  baseURL: process.env.API_URL || 'https://demo.ixcsoft.com.br/webservice/v1',
  auth: {
    username: process.env.API_USER || 'user',
    password: process.env.API_PASS || 'pass'
  },
  httpsAgent: new https.Agent({
    rejectUnauthorized: false
  }),
  headers: {
    'Content-Type': 'application/json',
    ixcsoft: 'listar'
  }
});

console.log(api.defaults.baseURL);
// Log para debug da configuração
console.log(`[IXCService] Inicializando com URL: ${api.defaults.baseURL || 'Não configurada'}`);
console.log(`[IXCService] Token configurado: ${process.env.API_TOKEN ? 'Sim' : 'Não'}`);
console.log(`[IXCService] Usuário API configurado: ${process.env.API_USER ? 'Sim' : 'Não'}`);
console.log(`[IXCService] Senha API configurada: ${process.env.API_PASS ? 'Sim' : 'Não'}`);


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

// Modo mock para desenvolvimento
const MOCK_MODE = false; // Defina como true para usar dados mockados, false para API real
const TODOS_TECNICOS_ATIVOS = true; // No modo mock, define se todos os técnicos devem ser considerados ativos



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
    return gerarSugestoesDeAgendamentoOriginal(os, opcoes);
}

async function gerarSugestoesDeAgendamentoOriginal(os, opcoes = {}) {
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

  const periodos = ['M', 'T']; // M = manhã, T = tarde
  const vinculos = require('./ixcConfigAgendamento').vinculosTecnicoSetor; // Carregar vínculos aqui (já é o resultado da função)
  
  // Carregar vínculos de técnicos com setores
  // const vinculos = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/vinculos_tecnicos_setores.json'), 'utf8'));

  // Corrigir campo de setor
  const setor = String(os.id_setor || os.setor_id || os.setor);
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

    // 4. Buscar todos os técnicos ativos (id_funcao=2) na API e filtrar pelo vínculo com o setor da OS
    const bodyTec = new URLSearchParams();
    console.log('[4] Buscando técnicos ativos (id_funcao=2) na API...');
    bodyTec.append('qtype', 'funcionarios.id'); // buscar todos
    bodyTec.append('query', '0');
    bodyTec.append('oper', '!=');
    bodyTec.append('page', '1');
    bodyTec.append('rp', '1000');
    bodyTec.append('sortname', 'funcionarios.id');
    bodyTec.append('sortorder', 'asc');
    bodyTec.append('filter', JSON.stringify({ ativo: 'S', id_funcao: '2' }));
    let tecnicosSetor = [];
    try {
      const respTec = await api.post('/funcionarios', bodyTec, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', ixcsoft: 'listar' }
      });
      const tecnicosApi = Object.values(respTec.data?.registros || {});
      //console.log('[4.1] Técnicos ativos retornados pela API:', tecnicosApi.map(t => ({id: t.id, nome: t.nome, setores: vinculos[t.id]})));
      
      // Usar a estrutura correta: vinculos[setor] contém os IDs dos técnicos vinculados
      const idsTecnicosVinculados = vinculos[setor] || [];
      tecnicosSetor = tecnicosApi
        .filter(tec => idsTecnicosVinculados.includes(String(tec.id)))
        .map(tec => tec.id);
        
      console.log('[4.2] Técnicos ativos e vinculados ao setor:', tecnicosSetor);
    } catch (e) {
      console.error('Erro ao buscar técnicos ativos:', e.message);
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
    return registros;
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
  try {
    // Verificar se o token está disponível
    if (!process.env.API_TOKEN) {
      console.error('❌ Erro: Token da API IXC não configurado para atualizar OS');
      throw new Error('Token da API não configurado');
    }
    
    const body = new URLSearchParams();
    body.append('token', process.env.API_TOKEN);
    body.append('id', osId);
    body.append('data', JSON.stringify(payload));

    console.log(`Atualizando OS ${osId} usando token: ${process.env.API_TOKEN ? 'Configurado' : 'Não configurado'}`);
    const response = await api.post('/su_oss_chamado/alterar', body, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
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
    
    if (response.data && response.data.registros) {
      // Filtrar apenas OSs sem setor atribuído
      const osSemSetor = Object.values(response.data.registros).filter(os => 
        !os.id_setor || os.id_setor === '0' || os.id_setor === '' || os.id_setor === null
      );
      
      console.log(`Encontradas ${osSemSetor.length} OSs sem setor atribuído.`);
      return osSemSetor;
    }
    
    console.log('Nenhuma OS encontrada sem setor atribuído. Resposta completa:', JSON.stringify(response.data, null, 2));
    return [];
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
async function atualizarOSComSetor(osId, setorId) {
  try {
    console.log(`Atualizando OS ${osId} com o setor ${setorId}...`);
    
    // Usando o mesmo padrão da função atualizarOS
    const payload = {
      setor: setorId
    };
    
    // Reutilizando a função atualizarOS para manter consistência
    const resultado = await atualizarOS(osId, payload);
    
    if (resultado && resultado.status === 'success') {
      console.log(`✅ OS ${osId} atualizada com sucesso para o setor ${setorId}`);
      return true;
    }
    
    console.error(`❌ Erro ao atualizar OS ${osId}:`, resultado);
    return false;
  } catch (error) {
    console.error(`❌ Erro ao atualizar OS ${osId} com o setor ${setorId}:`, error.message);
    return false;
  }
}

/**
 * Busca o setor correspondente ao bairro no MongoDB
 * @param {string} bairro - Nome do bairro
 * @param {string} tipoServico - Tipo de serviço (instalação ou manutenção)
 * @returns {Promise<string|null>} ID do setor ou null se não encontrado
 */
async function buscarSetorPorBairro(bairro, tipoServico) {
  try {
    const mongoose = require('mongoose');
    
    // Conectar ao MongoDB se ainda não estiver conectado
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(process.env.MONGO_URI, {
        tls: true,
        tlsAllowInvalidCertificates: true
      });
    }
    
    // Buscar na coleção de configurações de setores
    const setoresCollection = mongoose.connection.db.collection('configuracoes.setores');
    
    // Primeiro tenta encontrar uma correspondência exata
    let setor = await setoresCollection.findOne({ 
      bairro: { $regex: new RegExp(`^${bairro}$`, 'i') },
      tipoServico: tipoServico
    });
    
    // Se não encontrar, tenta buscar apenas pelo bairro
    if (!setor) {
      setor = await setoresCollection.findOne({ 
        bairro: { $regex: new RegExp(`^${bairro}$`, 'i') }
      });
    }
    
    if (setor) {
      console.log(`Setor encontrado para o bairro ${bairro}: ${setor.id_setor}`);
      return setor.id_setor;
    }
    
    // Se ainda não encontrou, usa o OpenAI para tentar encontrar o melhor match
    return await findSetorByBairro(bairro, tipoServico);
  } catch (error) {
    console.error(`Erro ao buscar setor para o bairro ${bairro}:`, error.message);
    return null;
  }
}

/**
 * Usa o OpenAI para encontrar o setor mais próximo com base no bairro
 * @param {string} bairro - Nome do bairro
 * @param {string} tipoServico - Tipo de serviço (instalação ou manutenção)
 * @returns {Promise<string|null>} ID do setor ou null se não encontrado
 */
async function findSetorByBairro(bairro, tipoServico) {
  try {
    const mongoose = require('mongoose');
    const { OpenAI } = require('openai');
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    
    // Conectar ao MongoDB se ainda não estiver conectado
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(process.env.MONGO_URI, {
        tls: true,
        tlsAllowInvalidCertificates: true
      });
    }
    
    // Buscar todos os setores disponíveis
    const setoresCollection = mongoose.connection.db.collection('configuracoes.setores');
    const todosSetores = await setoresCollection.find({}).toArray();
    
    if (todosSetores.length === 0) {
      console.log('Nenhum setor encontrado na base de dados.');
      return null;
    }
    
    // Criar uma lista de bairros conhecidos
    const bairrosConhecidos = todosSetores.map(s => s.bairro);
    
    // Usar OpenAI para encontrar o bairro mais próximo
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "Você é um assistente especializado em encontrar correspondências entre bairros. Sua tarefa é identificar qual bairro da lista é mais similar ao bairro fornecido."
        },
        {
          role: "user",
          content: `Encontre o bairro mais similar a "${bairro}" na seguinte lista: ${JSON.stringify(bairrosConhecidos)}. Responda apenas com o nome do bairro mais similar, sem explicações adicionais.`
        }
      ],
      temperature: 0.3,
      max_tokens: 50
    });
    
    const bairroSimilar = completion.choices[0].message.content.trim();
    
    // Buscar o setor correspondente ao bairro similar
    const setorEncontrado = todosSetores.find(s => 
      s.bairro.toLowerCase() === bairroSimilar.toLowerCase() && 
      (!s.tipoServico || s.tipoServico === tipoServico)
    );
    
    if (setorEncontrado) {
      console.log(`Setor encontrado via IA para o bairro ${bairro} (similar a ${bairroSimilar}): ${setorEncontrado.id_setor}`);
      
      // Salvar esta correspondência para uso futuro
      await setoresCollection.insertOne({
        bairro: bairro,
        tipoServico: tipoServico,
        id_setor: setorEncontrado.id_setor,
        bairroOriginal: bairroSimilar,
        criadoEm: new Date(),
        criadoPor: 'IA'
      });
      
      return setorEncontrado.id_setor;
    }
    
    console.log(`Nenhum setor encontrado para o bairro ${bairro}, mesmo após busca por similaridade.`);
    return null;
  } catch (error) {
    console.error(`Erro ao buscar setor via IA para o bairro ${bairro}:`, error.message);
    return null;
  }
}

module.exports = {
  verificarDisponibilidade,
  verificarDisponibilidadeData,
  gerarSugestoesDeAgendamento,
  buscarClientePorCpf,
  formatarCpf,
  buscarOSPorClienteId,
  atualizarOS,
  // Funções para atribuição de setores
  buscarOSAbertas,
  buscarDetalhesOS,
  atualizarOSComSetor,
  buscarSetorPorBairro,
  findSetorByBairro
};
