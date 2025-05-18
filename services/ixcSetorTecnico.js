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
  const vinculos = getVinculosSetoresTecnicos();
  return vinculos[idSetor] || [];
}

/**
 * Carrega os vínculos de setores com técnicos
 * @returns {Object} Objeto com a estrutura: { idSetor: [idTecnico1, idTecnico2, ...] }
 */
function getVinculosSetoresTecnicos() {
  try {
    // Carregar do caminho do arquivo
    const vinculosPath = path.join(__dirname, '../app/data/vinculos_setores_tecnicos.json');
    if (fs.existsSync(vinculosPath)) {
      return JSON.parse(fs.readFileSync(vinculosPath, 'utf8'));
    }
    
    // Se não encontrar o arquivo, retorna um objeto padrão
    return {
      "1": ["4", "5", "8", "9", "10", "11", "13"],
      "2": ["1", "2", "3"],
      "3": ["3", "4", "5", "7", "8", "10", "11", "12", "13"],
      "4": ["4", "5", "6", "7", "8", "10", "12"],
      "5": ["4", "9", "11", "12"],
      "6": ["1", "6"]
    };
  } catch (error) {
    console.error('Erro ao carregar vínculos de setores com técnicos:', error.message);
    return {};
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
