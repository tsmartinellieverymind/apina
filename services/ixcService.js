const axios = require('axios');
const https = require('https');
require('dotenv').config(); // carrega as variáveis do .env

const httpsAgent = new https.Agent({
  rejectUnauthorized: false
});

const api = axios.create({
  baseURL: 'https://demo.ixcsoft.com.br/webservice/v1',
  auth: {
    username: process.env.API_USER,
    password: process.env.API_PASS
  },
  httpsAgent,
  headers: {
    'Content-Type': 'application/json',
    ixcsoft: 'listar'
  }
});

async function buscarOS(osId) {
  const body = {
    qtype: 'su_oss_chamado.id',
    query: osId,
    oper: '=',
    page: '1',
    rp: '1',
    sortname: 'su_oss_chamado.id',
    sortorder: 'asc'
  };

  const response = await api.post('/su_oss_chamado', body);
  return response.data.registros;
}

async function atualizarOS(osId, payloadOriginal) {
    // Clona e ajusta payload com base no Postman
    const payload = { ...payloadOriginal };
  
    // Campos que devem ser enviados como string vazia se estiverem inválidos
    const limparCampos = [
      'data_hora_analise', 'data_hora_encaminhado', 'data_hora_assumido', 'data_hora_execucao',
      'data_agenda_final', 'status_sla', 'melhor_horario_agenda', 'origem_os_aberta', 'protocolo',
      'complemento', 'bloco', 'latitude', 'apartamento', 'longitude', 'bairro', 'referencia',
      'impresso', 'data_final', 'data_prazo_limite', 'data_reservada', 'justificativa_sla_atrasado',
      'origem_endereco_estrutura', 'data_reagendar', 'data_prev_final', 'origem_cadastro'
    ];
  
    limparCampos.forEach((campo) => {
      if (payload[campo] === '0000-00-00 00:00:00' || payload[campo] === '0000-00-00' || payload[campo] === undefined) {
        payload[campo] = '';
      }
    });
  
    // Campos que devem ser removidos completamente
    const removerCampos = ['idx', 'preview', 'id_tecnico', 'id', 'id_condominio'];
  
    removerCampos.forEach((campo) => delete payload[campo]);
  
    console.log('📦 Payload enviado para o IXC (atualizarOS):');
    console.dir(payload, { depth: null });
  
    const response = await api.put(`/su_oss_chamado/${osId}`, payload, {
      headers: {
        ixcsoft: '' // igual ao Postman
      }
    });
  
    // Retorna erro amigável se a resposta tiver type: 'error'
    if (response.data?.type === 'error') {
      return {
        mensagem: `❌ Falha ao atualizar OS ${osId}: ${response.data.message || 'Erro desconhecido'}`,
        detalhes: response.data
      };
    }
  
    return {
      mensagem: `A OS ${osId} foi atualizada com sucesso.`,
      data: response.data
    };
  }
  async function buscarColaboradorPorCpf(cpf) {
    console.log(`🔍 Buscando colaborador por CPF: ${cpf}`);
  
    const body = new URLSearchParams();
    body.append("qtype", "funcionarios.cpf_cnpj");
    body.append("query", cpf);
    body.append("oper", "=");
    body.append("page", "1");
    body.append("rp", "20");
    body.append("sortname", "funcionarios.id");
    body.append("sortorder", "asc");
  
    try {
      const response = await api.post('/funcionarios', body, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', ixcsoft: 'listar' }
      });
  
      console.log('📦 Resposta completa da API:', JSON.stringify(response.data, null, 2));
  
      const registros = response.data?.registros;
  
      if (!registros || registros.length === 0) {
        console.log('⚠️ Nenhum registro encontrado na resposta.');
        return {
          mensagem: `❌ Colaborador com CPF ${cpf} não encontrado.`,
          data: null
        };
      }
  
      const colaborador = registros[0];
  
      console.log('✅ Colaborador encontrado:', colaborador);
  
      return {
        mensagem: `✅ Colaborador encontrado com CPF ${cpf}`,
        data: colaborador
      };
    } catch (error) {
      console.log('🚨 Erro na API:', error);
      return {
        mensagem: `❌ Erro ao buscar colaborador: ${error.message}`,
        data: null
      };
    }
  }


  async function buscarClientePorCpf(cpf) {
    const body = new URLSearchParams();
    body.append('qtype', 'cliente.cnpj_cpf');
    body.append('query', cpf);
    body.append('oper', '=');
    body.append('page', '1');
    body.append('rp', '20');
    body.append('sortname', 'cliente.id');
    body.append('sortorder', 'asc');
  
    try {
      const response = await api.post('/cliente', body);
      const registros = response.data?.registros;
  
      if (!registros || registros.length === 0) {
        return { mensagem: `❌ Cliente com CPF ${cpf} não encontrado.` };
      }
  
      return { mensagem: '✅ Cliente encontrado', cliente: registros[0] };
    } catch (error) {
      return { mensagem: `❌ Erro ao buscar cliente: ${error.message}` };
    }
  }

  module.exports = {
    buscarOS,
    atualizarOS,
    buscarColaboradorPorCpf,
    buscarClientePorCpf
  };