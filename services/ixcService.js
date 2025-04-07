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

async function buscarOSPorClienteId(clienteId) {
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
    console.log('📦 OS encontradas por clienteId:', registros);
    
    console.log(' clienteId:', clienteId);
    return registros;
  } catch (error) {
    console.error('❌ Erro ao buscar OS por clienteId:', error);
    return [];
  }
}

async function atualizarOS(osId, payloadOriginal) {
  const payload = { ...payloadOriginal };

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

  const removerCampos = ['idx', 'preview', 'id_tecnico', 'id', 'id_condominio'];
  removerCampos.forEach((campo) => delete payload[campo]);

  console.log('📦 Payload enviado para o IXC (atualizarOS):');
  console.dir(payload, { depth: null });

  const response = await api.put(`/su_oss_chamado/${osId}`, payload, {
    headers: { ixcsoft: '' }
  });

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
    body.append('rp', '50');
    body.append('sortname', 'cliente.id');
    body.append('sortorder', 'asc');
  
    try {
      const response = await api.post('/cliente', body);
      
      
    console.log('body:', body);

      const registros = response.data?.registros;
      console.log('registros:', registros);
      if (!registros || Object.keys(registros).length === 0) {
        return { mensagem: `❌ Cliente com CPF ${cpf} não encontrado.` };
      }
  
      // Aqui garantimos que o CPF bate 100%
      const cliente = Object.values(registros).find(c => c.cnpj_cpf === cpf);
  
      if (!cliente) {
        return { mensagem: `❌ Cliente com CPF ${cpf} não encontrado com correspondência exata.` };
      }
  
      return { mensagem: '✅ Cliente encontrado', cliente };
    } catch (error) {
      return { mensagem: `❌ Erro ao buscar cliente: ${error.message}` };
    }
  }

module.exports = {
  buscarOS,
  buscarOSPorClienteId,
  atualizarOS,
  buscarColaboradorPorCpf,
  buscarClientePorCpf
};
