// Configurações editáveis do App do DBV.
// A lista de cargos fica aqui para ser fácil de alterar depois.

// desbravador = Desbravador (10–15 anos); lideranca = Liderança (16+). Os nomes internos não mudam.
// Diretoria do clube e conselheiros/instrutores (16+).
export const CARGOS_LIDERANCA = ['Diretoria', 'Diretor', 'Diretora', 'Diretor Associado', 'Diretora Associada', 'Secretário', 'Tesoureiro', 'Capelão'];
export const CARGOS_TUTORES = ['Conselheiro', 'Conselheira', 'Conselheiro Associado', 'Conselheira Associada', 'Instrutor', 'Instrutora'];
export const CARGOS = {
  desbravador: ['Desbravador', 'Capitão', 'Secretário', 'Tesoureiro', 'Padioleiro', 'Almoxarife', 'Capelão'],
  lideranca: [...CARGOS_LIDERANCA, ...CARGOS_TUTORES],
};

// Diretoria (diretor e diretor associado) só a partir de 18 anos. Os demais cargos da liderança, a partir de 16.
export const CARGOS_18 = ['Diretor', 'Diretora', 'Diretor Associado', 'Diretora Associada'];
export const IDADE_MIN_DIRETOR = 18;

export const CARGO_PADRAO = { desbravador: 'Desbravador', lideranca: 'Conselheiro' };

/** Cargos do tempo dos Exploradores → cargos dos Desbravadores (aplicado ao iniciar o servidor). */
export const CARGOS_RENOMEADOS = {
  Explorador: 'Desbravador', 'Diretor Geral': 'Diretor', 'Diretora Geral': 'Diretora', 'Diretor Mirins': 'Diretor Associado', 'Diretora Mirins': 'Diretora Associada',
  Secretaria: 'Secretário', Tesoureira: 'Tesoureiro', Orador: 'Capelão', Enfermeiros: 'Instrutor',
  'Tutor de Ordem Unida': 'Instrutor', 'Tutor de Atividades': 'Conselheiro', 'Tutor Criativo': 'Instrutor', 'Tutor de Atividades Mirins': 'Conselheiro',
  'Tutor de Especialidades': 'Instrutor', 'Tutor de Especialidades Mirins': 'Instrutor', 'Tutor de Acampamentos': 'Instrutor', 'Tutor de Acampamentos Mirins': 'Instrutor',
  'Padrinho Líder': 'Conselheiro', 'Padrinho Excelente': 'Conselheiro Associado', Tutor: 'Conselheiro',
  'Conselheiro de Atividades': 'Conselheiro', 'Conselheiro de Especialidades': 'Instrutor', 'Conselheiro Líder': 'Conselheiro',
};

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
// Unidades por clube, numeradas de 1 a 10 (a unidade Liderança fica fora da conta).
export const MAX_GRUPOS = 10;

export const MAX_FOTOS_ENVIO = 5;
export const MAX_UPLOAD_MB = 10;
