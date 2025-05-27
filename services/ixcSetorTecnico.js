/**
 * Utilitário para gerenciar vínculos entre setores e técnicos
 */

const fs = require('fs');
const path = require('path');

/**
 * Retorna os técnicos vinculados a um determinado setor
 * @param {string} idSetor - ID do setor
 * @returns {Array} Lista de IDs de técnicos vinculados ao setor
 */
function getTecnicosPorSetor(idSetor) {
  try {
    const vinculos = getVinculosSetoresTecnicos();
    const tecnicos = vinculos[idSetor] || [];
    console.log(`[INFO] Técnicos vinculados ao setor ${idSetor}:`, tecnicos);
    return tecnicos;
  } catch (error) {
    console.error(`[ERRO] Falha ao obter técnicos para o setor ${idSetor}:`, error.message);
    throw new Error(`Não foi possível obter os técnicos vinculados ao setor ${idSetor}: ${error.message}`);
  }
}

/**
 * Carrega os vínculos de setores com técnicos
 * @returns {Object} Objeto com a estrutura: { idSetor: [idTecnico1, idTecnico2, ...] }
 * @throws {Error} Se o arquivo não for encontrado
 */
function getVinculosSetoresTecnicos() {
  try {
    // Tentar caminhos possíveis para o arquivo
    const caminhosPossiveis = [
      path.join(__dirname, '../app/data/vinculos_setores_tecnicos.json'),
      path.join(process.cwd(), 'app/data/vinculos_setores_tecnicos.json'),
      path.join(process.cwd(), 'backend/app/data/vinculos_setores_tecnicos.json')
    ];
    
    let vinculosPath = null;
    let arquivoEncontrado = false;
    
    // Verificar cada caminho possível
    for (const caminho of caminhosPossiveis) {
      if (fs.existsSync(caminho)) {
        vinculosPath = caminho;
        arquivoEncontrado = true;
        console.log(`[INFO] Arquivo de vínculos encontrado em: ${vinculosPath}`);
        break;
      }
    }
    
    if (!arquivoEncontrado) {
      throw new Error(`Arquivo de vínculos não encontrado em nenhum dos caminhos: ${caminhosPossiveis.join(', ')}`);
    }
    
    const conteudo = fs.readFileSync(vinculosPath, 'utf8');
    return JSON.parse(conteudo);
  } catch (error) {
    console.error('Erro ao carregar vínculos de setores com técnicos:', error.message);
    throw error; // Propagar o erro para que o chamador saiba que algo deu errado
  }
}

/**
 * Carrega o tipo de setor e número de instalações permitidas
 * @returns {Object} Objeto com a estrutura: { idSetor: quantidadeInstalacoes }
 */
function getVinculosSetoresTipo() {
  try {
    // Carregar do caminho do arquivo
    const vinculosPath = path.join(__dirname, '../app/data/vinculo_setores_tipo.json');
    if (fs.existsSync(vinculosPath)) {
      return JSON.parse(fs.readFileSync(vinculosPath, 'utf8'));
    }
    
    // Se não encontrar o arquivo, retorna um objeto padrão
    return {
      "1": "1",
      "2": "5",
      "3": "1",
      "4": "1",
      "5": "1",
      "6": "1"
    };
  } catch (error) {
    console.error('Erro ao carregar vínculos de setores com tipo:', error.message);
    return {};
  }
}

/**
 * Retorna o número de instalações permitidas para um setor
 * @param {string} idSetor - ID do setor
 * @returns {number} Número de instalações permitidas (padrão: 1)
 */
function getNumeroInstalacoesPermitidas(idSetor) {
  const vinculosTipo = getVinculosSetoresTipo();
  return parseInt(vinculosTipo[idSetor] || "1", 10);
}

module.exports = {
  getTecnicosPorSetor,
  getVinculosSetoresTecnicos,
  getVinculosSetoresTipo,
  getNumeroInstalacoesPermitidas
};
