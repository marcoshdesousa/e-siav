// Configurações editáveis do Exploradores do Brasil.
// A lista de cargos fica aqui para ser fácil de alterar depois.

// desbravador = Explorador (10–15 anos); lideranca = Tutor (16+). Os nomes internos não mudam.
export const CARGOS = {
  desbravador: ['Explorador', 'Capitão', 'Secretário', 'Tesoureiro', 'Padioleiro', 'Almoxarife', 'Capelão'],
  lideranca: ['Diretor', 'Diretor Associado', 'Tutor', 'Tutor de Insígnias', 'Tutor de Acampamento', 'Secretário', 'Tesoureiro', 'Capelão'],
};

export const CARGO_PADRAO = { desbravador: 'Explorador', lideranca: 'Tutor' };

/** Cargos antigos → novos (aplicado ao iniciar o servidor). */
export const CARGOS_RENOMEADOS = { Desbravador: 'Explorador', Conselheiro: 'Tutor', Instrutor: 'Tutor' };

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

export const NOME_UNIDADE_LIDERANCA = 'Tutores';

export const MAX_FOTOS_ENVIO = 5;
export const MAX_UPLOAD_MB = 10;
