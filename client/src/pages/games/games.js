// Lista dos mini jogos. id igual ao do servidor (server/games.js). Cada jogo é carregado só quando abre.
import { lazy } from 'react';
import {
  Apple, Bird, Blocks, Bomb, Brain, Calculator, CircleDot, Crosshair, Dices, Gamepad2, Grid2x2, Grid3x3,
  Hammer, Layers, LayoutGrid, MessageCircleQuestion, Palette, Puzzle, Rocket, ShieldAlert, SpellCheck, Square, Swords,
} from 'lucide-react';

// mode: 'best' = vale o recorde de uma partida; 'sum' = os pontos das partidas vão somando.
const ALL = [
  { id: 'cobrinha', name: 'Cobrinha', icon: Apple, mode: 'best', file: 'Snake', how: 'Coma as frutas para crescer. Não bata nas paredes nem no próprio corpo. Setas, deslize o dedo ou use os botões.' },
  { id: 'aventura', name: 'Aventura do Desbravador', icon: Gamepad2, mode: 'best', file: 'Platformer', how: 'Corra, pule nos inimigos, pegue as moedas e chegue à bandeira. Setas/espaço ou os botões na tela.' },
  { id: 'velha', name: 'Jogo da velha', icon: Grid3x3, mode: 'sum', file: 'TicTacToe', how: 'Faça uma linha de 3 antes do computador. Vitória vale 3 pontos e empate 1.' },
  { id: 'domino', name: 'Dominó', icon: Dices, mode: 'sum', file: 'Domino', how: 'Encaixe as pedras pelas pontas. Quem bater primeiro ganha. Vitória vale 3 pontos.' },
  { id: '2048', name: '2048', icon: LayoutGrid, mode: 'best', file: 'G2048', how: 'Deslize para juntar números iguais e chegar ao 2048.' },
  { id: 'blocos', name: 'Blocos', icon: Blocks, mode: 'best', file: 'Tetris', how: 'Encaixe as peças e complete linhas para elas sumirem.' },
  { id: 'memoria', name: 'Jogo da memória', icon: Brain, mode: 'best', file: 'Memory', how: 'Vire duas cartas por vez e ache todos os pares com o menor número de jogadas.' },
  { id: 'passaro', name: 'Voo do pássaro', icon: Bird, mode: 'best', file: 'Flappy', how: 'Toque (ou espaço) para bater as asas e passar entre os canos.' },
  { id: 'tijolos', name: 'Quebra-tijolos', icon: Square, mode: 'best', file: 'Breakout', how: 'Mova a barra para rebater a bola e quebrar todos os tijolos.' },
  { id: 'minado', name: 'Campo minado', icon: Bomb, mode: 'best', file: 'Minesweeper', how: 'Abra os quadrados sem bombas. Os números dizem quantas bombas há em volta. Segure (ou use a bandeira) para marcar.' },
  { id: 'genius', name: 'Genius', icon: CircleDot, mode: 'best', file: 'Simon', how: 'Repita a sequência de cores. A cada rodada ela fica maior.' },
  { id: 'toupeira', name: 'Acerte a toupeira', icon: Hammer, mode: 'best', file: 'Whack', how: 'Toque nas toupeiras antes que elas se escondam. Cuidado com as bombas!' },
  { id: 'pong', name: 'Pingue-pongue', icon: Swords, mode: 'best', file: 'Pong', how: 'Arraste a sua raquete e não deixe a bola passar. Cada ponto contra o computador conta.' },
  { id: 'forca', name: 'Forca', icon: SpellCheck, mode: 'best', file: 'Hangman', how: 'Descubra a palavra letra por letra antes de completar a forca.' },
  { id: 'quiz', name: 'Quiz bíblico', icon: MessageCircleQuestion, mode: 'best', file: 'Quiz', how: 'Responda perguntas da Bíblia e dos Desbravadores. Errou três, acabou.' },
  { id: 'alvo', name: 'Tiro ao alvo', icon: Crosshair, mode: 'best', file: 'Target', how: 'Toque nos alvos o mais rápido possível em 30 segundos.' },
  { id: 'matematica', name: 'Conta rápida', icon: Calculator, mode: 'best', file: 'MathRush', how: 'Responda as contas antes do tempo acabar. Cada acerto dá mais tempo.' },
  { id: 'deslizante', name: 'Quebra-cabeça', icon: Puzzle, mode: 'best', file: 'Sliding', how: 'Deslize as peças até colocar os números em ordem.' },
  { id: 'nave', name: 'Nave espacial', icon: Rocket, mode: 'best', file: 'Shooter', how: 'Mova a nave e destrua os invasores. A nave atira sozinha.' },
  { id: 'lig4', name: 'Lig 4', icon: Grid2x2, mode: 'sum', file: 'Connect4', how: 'Ligue 4 peças em linha antes do computador. Vitória vale 3 pontos e empate 1.' },
  { id: 'empilhar', name: 'Empilhar', icon: Layers, mode: 'best', file: 'Stack', how: 'Toque na hora certa para empilhar o bloco em cima do outro.' },
  { id: 'desvie', name: 'Desvie!', icon: ShieldAlert, mode: 'best', file: 'Dodge', how: 'Arraste para desviar das pedras que caem e pegue as estrelas.' },
  { id: 'cores', name: 'Cor certa', icon: Palette, mode: 'best', file: 'Colors', how: 'Toque na COR em que a palavra está pintada, não no que está escrito.' },
];

const modules = import.meta.glob('./g/*.jsx');
// Só aparecem os jogos que já existem.
export const GAMES = ALL.filter((g) => modules[`./g/${g.file}.jsx`]);
export const gameComponent = (g) => lazy(modules[`./g/${g.file}.jsx`]);
export const gameById = (id) => GAMES.find((g) => g.id === id);
