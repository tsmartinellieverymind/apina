// Teste rápido para a função extrairCpf melhorada

const extrairCpf = (texto = '') => {
  // Remove todos os caracteres não numéricos para análise
  const apenasNumeros = texto.replace(/[^\d]/g, '');
  
  // CPF deve ter exatamente 11 dígitos
  if (apenasNumeros.length !== 11) return null;
  
  // Verifica se os dígitos não são todos iguais (validação básica)
  if (/^(\d)\1{10}$/.test(apenasNumeros)) return null;
  
  // Validação adicional: verifica se parece com um CPF real
  // CPFs válidos não começam com 000, 111, 222, etc.
  const primeirosTres = apenasNumeros.substring(0, 3);
  if (/^(\d)\1{2}$/.test(primeirosTres)) {
    // Se os 3 primeiros dígitos são iguais, pode ser um CPF inválido
    // Mas vamos permitir para não ser muito restritivo
  }
  
  return apenasNumeros;
};

// Casos de teste
const testCases = [
  // Casos que devem funcionar
  { input: "522 473 726  51", expected: "52247372651", description: "CPF com espaçamentos irregulares" },
  { input: "522.473.726-51", expected: "52247372651", description: "CPF formatado padrão" },
  { input: "52247372651", expected: "52247372651", description: "CPF sem formatação" },
  { input: "123 456 789 01", expected: "12345678901", description: "CPF com espaços regulares" },
  { input: "123.456.789-01", expected: "12345678901", description: "CPF com pontos e hífen" },
  
  // Casos que devem falhar
  { input: "522 473 726", expected: null, description: "CPF incompleto (10 dígitos)" },
  { input: "522 473 726 5", expected: null, description: "CPF incompleto (10 dígitos)" },
  { input: "522 473 726 512", expected: null, description: "CPF com dígitos demais (12 dígitos)" },
  { input: "11111111111", expected: null, description: "CPF com todos os dígitos iguais" },
  { input: "00000000000", expected: null, description: "CPF com zeros" },
  { input: "abc def ghi jk", expected: null, description: "Texto sem números" },
  { input: "12345", expected: null, description: "Número muito pequeno (possível OS)" },
];

console.log("🧪 TESTANDO FUNÇÃO extrairCpf MELHORADA\n");

let passedTests = 0;
let totalTests = testCases.length;

testCases.forEach((testCase, index) => {
  const result = extrairCpf(testCase.input);
  const passed = result === testCase.expected;
  
  console.log(`Teste ${index + 1}: ${testCase.description}`);
  console.log(`  Input: "${testCase.input}"`);
  console.log(`  Expected: ${testCase.expected}`);
  console.log(`  Result: ${result}`);
  console.log(`  Status: ${passed ? '✅ PASSOU' : '❌ FALHOU'}`);
  console.log('');
  
  if (passed) passedTests++;
});

console.log(`📊 RESULTADO FINAL: ${passedTests}/${totalTests} testes passaram`);

if (passedTests === totalTests) {
  console.log("🎉 TODOS OS TESTES PASSARAM! A função está funcionando corretamente.");
} else {
  console.log("⚠️  Alguns testes falharam. Verifique a implementação.");
}
