// Configurações editáveis do Exploradores do Brasil.
// A lista de cargos fica aqui para ser fácil de alterar depois.

// desbravador = Explorador (10–15 anos); lideranca = Liderança e Tutores (16+). Os nomes internos não mudam.
export const CARGOS_LIDERANCA = ['Diretor Geral', 'Diretora Geral', 'Diretor Mirins', 'Diretora Mirins', 'Secretaria', 'Tesoureira', 'Orador', 'Enfermeiros'];
export const CARGOS_TUTORES = [
  'Tutor de Ordem Unida', 'Tutor de Atividades', 'Tutor Criativo', 'Tutor de Atividades Mirins', 'Tutor de Especialidades',
  'Tutor de Especialidades Mirins', 'Tutor de Acampamentos', 'Tutor de Acampamentos Mirins', 'Padrinho Líder', 'Padrinho Excelente',
];
export const CARGOS = {
  desbravador: ['Explorador'],
  lideranca: [...CARGOS_LIDERANCA, ...CARGOS_TUTORES],
};

export const CARGO_PADRAO = { desbravador: 'Explorador', lideranca: 'Tutor de Atividades' };

/** Cargos antigos → novos (aplicado ao iniciar o servidor). */
export const CARGOS_RENOMEADOS = {
  Desbravador: 'Explorador', Conselheiro: 'Tutor de Atividades', Instrutor: 'Tutor de Atividades', Tutor: 'Tutor de Atividades',
  'Tutor de Insígnias': 'Tutor de Especialidades', 'Tutor de Acampamento': 'Tutor de Acampamentos', Diretor: 'Diretor Geral', 'Diretor Associado': 'Diretor Geral',
  Secretário: 'Secretaria', Tesoureiro: 'Tesoureira', Capelão: 'Orador',
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

export const NOME_UNIDADE_LIDERANCA = 'Tutores';

export const MAX_FOTOS_ENVIO = 5;
export const MAX_UPLOAD_MB = 10;
