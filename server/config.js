// Configurações editáveis do App do DBV.
// A lista de cargos fica aqui para ser fácil de alterar depois.

export const CARGOS = {
  desbravador: ['Desbravador', 'Capitão', 'Secretário', 'Tesoureiro', 'Padioleiro', 'Almoxarife', 'Capelão'],
  lideranca: ['Diretor', 'Diretor Associado', 'Secretário', 'Tesoureiro', 'Conselheiro', 'Instrutor', 'Capelão'],
};

export const CARGO_PADRAO = { desbravador: 'Desbravador', lideranca: 'Conselheiro' };

// Faixas de idade que definem o tipo de conta do membro.
export const IDADE_MIN_DESBRAVADOR = 10;
export const IDADE_MAX_DESBRAVADOR = 15;

export const MODELOS_ENVIO = {
  texto: 'Texto (relatório)',
  foto: 'Foto',
  quiz: 'Quiz',
  texto_foto: 'Relatório + foto',
  quiz_foto: 'Quiz + foto',
};

export const NOME_UNIDADE_LIDERANCA = 'Liderança';

export const MAX_FOTOS_ENVIO = 5;
export const MAX_UPLOAD_MB = 10;
