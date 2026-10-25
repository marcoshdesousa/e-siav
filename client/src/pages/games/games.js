// Lista dos mini jogos. id igual ao do servidor (server/games.js). Cada jogo é carregado só quando abre.
import {
  lazy } from 'react'; import { Apple, Bird, Blocks, BookOpen, Brain, Calculator, ChessKnight, CircleDot, Clock3, Crown, Dices, Disc3, Eye, Gamepad2, Gem, Grid2x2, Grid3x3, Hexagon, KeyRound, LayoutGrid, MessageCircleQuestion, Package, Radio, ScanEye, Search, Shuffle, SpellCheck, Spline, TrafficCone, Workflow } from 'lucide-react';

// mode: 'best' = vale o recorde de uma partida; 'sum' = os pontos das partidas vão somando.
const ALL = [
  { cat: 'acao', id: 'cobrinha', name: 'Cobrinha', icon: Apple, mode: 'best', file: 'Snake', how: 'Coma as frutas para crescer. Não bata nas paredes nem no próprio corpo. Setas, deslize o dedo ou use os botões.' },
  { cat: 'acao', id: 'aventura', name: 'Aventura do Desbravador', icon: Gamepad2, mode: 'best', file: 'Platformer', how: 'Corra, pule nos inimigos, pegue as moedas e vá o mais longe que conseguir. Setas/espaço ou os botões na tela.' },
  { cat: 'tabuleiro', id: 'velha', name: 'Jogo da velha', icon: Grid3x3, mode: 'sum', file: 'TicTacToe', how: 'Faça uma linha de 3 antes do computador. Vitória vale 3 pontos e empate 1.' },
  { cat: 'tabuleiro', id: 'domino', name: 'Dominó', icon: Dices, mode: 'sum', file: 'Domino', how: 'Encaixe as pedras pelas pontas. Quem bater primeiro ganha. Vitória vale 3 pontos.' },
  { cat: 'quebra', id: '2048', name: '2048', icon: LayoutGrid, mode: 'best', file: 'G2048', how: 'Deslize para juntar números iguais e chegar ao 2048.' },
  { cat: 'acao', id: 'blocos', name: 'Blocos', icon: Blocks, mode: 'best', file: 'Tetris', how: 'Encaixe as peças e complete linhas para elas sumirem.' },
  { cat: 'atencao', id: 'memoria', name: 'Jogo da memória', icon: Brain, mode: 'best', file: 'Memory', how: 'Vire duas cartas por vez e ache todos os pares com o menor número de jogadas.' },
  { cat: 'acao', id: 'passaro', name: 'Voo da pomba', icon: Bird, mode: 'best', file: 'Flappy', how: 'Ajude a pomba de Noé a levar o ramo de oliveira: toque (ou espaço) para bater as asas e passar entre as colunas.' },
  { cat: 'atencao', id: 'genius', name: 'Genius', icon: CircleDot, mode: 'best', file: 'Simon', how: 'Repita a sequência de cores. A cada rodada ela fica maior.' },
  { cat: 'palavras', id: 'forca', name: 'Forca', icon: SpellCheck, mode: 'best', file: 'Hangman', how: 'Descubra a palavra letra por letra antes de completar a forca.' },
  { cat: 'palavras', id: 'quiz', name: 'Quiz bíblico', icon: MessageCircleQuestion, mode: 'best', file: 'Quiz', how: 'Responda perguntas da Bíblia e dos Desbravadores. Errou três, acabou.' },
  { cat: 'atencao', id: 'matematica', name: 'Conta rápida', icon: Calculator, mode: 'best', file: 'MathRush', how: 'Responda as contas antes do tempo acabar. Cada acerto dá mais tempo.' },
  { cat: 'tabuleiro', id: 'lig4', name: 'Lig 4', icon: Grid2x2, mode: 'sum', file: 'Connect4', how: 'Ligue 4 peças em linha antes do computador. Vitória vale 3 pontos e empate 1.' },
  // ---------- Tabuleiro e cartas ----------
  { cat: 'tabuleiro', id: 'xadrez', name: 'Xadrez', icon: ChessKnight, mode: 'sum', file: 'Chess', how: 'Dê xeque-mate no computador. Toque na peça e depois na casa. Vitória vale 3 pontos e empate 1.' },
  { cat: 'tabuleiro', id: 'damas', name: 'Damas', icon: Crown, mode: 'sum', file: 'Checkers', how: 'Capture todas as peças do computador. Comer é obrigatório. Vitória vale 3 pontos.' },
  { cat: 'tabuleiro', id: 'reversi', name: 'Reversi', icon: Disc3, mode: 'sum', file: 'Reversi', how: 'Cerque as peças do adversário para virá-las. Quem tiver mais peças no fim ganha (3 pontos).' },
  { cat: 'tabuleiro', id: 'trilha', name: 'Trilha', icon: Hexagon, mode: 'sum', file: 'Morris', how: 'Forme linhas de 3 (moinho) para tirar peças do computador. Vitória vale 3 pontos.' },
  { cat: 'tabuleiro', id: 'pontinhos', name: 'Pontinhos', icon: Grid2x2, mode: 'sum', file: 'DotsBoxes', how: 'Ligue os pontos e feche quadrados. Quem fechar mais quadrados ganha (3 pontos).' },
  // ---------- Quebra-cabeças ----------
  { cat: 'quebra', id: 'senha', name: 'Senha', icon: KeyRound, mode: 'best', file: 'Mastermind', how: 'Descubra a senha de 4 cores. A cada tentativa você vê quantas cores e posições acertou.' },
  { cat: 'quebra', id: 'resta-um', name: 'Resta um', icon: CircleDot, mode: 'best', file: 'PegSolitaire', how: 'Pule uma peça por cima da outra para tirá-la. Tente deixar só uma.' },
  { cat: 'quebra', id: 'canos', name: 'Água da rocha', icon: Workflow, mode: 'best', file: 'Pipes', how: 'Moisés feriu a rocha e saiu água: gire os canais para levar a água da rocha até o acampamento do povo.' },
  { cat: 'quebra', id: 'sokoban', name: 'Pedras do muro', icon: Package, mode: 'best', file: 'Sokoban', how: 'Ajude Neemias a reconstruir o muro de Jerusalém: empurre as pedras até os lugares marcados. Não dá para puxar!' },
  { cat: 'quebra', id: 'ligue', name: 'Ligue as cores', icon: Spline, mode: 'best', file: 'Flow', how: 'Ligue os pontos da mesma cor sem cruzar os caminhos e preencha tudo.' },
  { cat: 'quebra', id: 'joias', name: 'Pedras do peitoral', icon: Gem, mode: 'best', file: 'Match3', how: 'As pedras preciosas do peitoral do sumo sacerdote: troque pedras vizinhas para formar linhas de 3 ou mais iguais.' },
  // ---------- Palavras, Bíblia e Desbravadores ----------
  { cat: 'palavras', id: 'caca-palavras', name: 'Caça-palavras', icon: Search, mode: 'best', file: 'WordSearch', how: 'Arraste o dedo sobre as letras para achar as palavras escondidas.' },
  { cat: 'palavras', id: 'embaralhada', name: 'Palavra embaralhada', icon: Shuffle, mode: 'best', file: 'Anagram', how: 'Coloque as letras na ordem certa para formar a palavra.' },
  { cat: 'palavras', id: 'versiculo', name: 'Versículo embaralhado', icon: BookOpen, mode: 'best', file: 'Verse', how: 'Toque nas palavras na ordem certa para montar o versículo.' },
  { cat: 'palavras', id: 'linha-tempo', name: 'Linha do tempo', icon: Clock3, mode: 'best', file: 'Timeline', how: 'Coloque as histórias da Bíblia na ordem em que aconteceram.' },
  { cat: 'palavras', id: 'morse', name: 'Código Morse', icon: Radio, mode: 'best', file: 'Morse', how: 'Decifre as letras em código Morse, como um bom desbravador.' },
  // ---------- Atenção e reflexo ----------
  { cat: 'atencao', id: 'diferenca', name: 'Cor diferente', icon: Eye, mode: 'best', file: 'OddColor', how: 'Ache o quadrado com a cor um pouquinho diferente. Fica mais difícil a cada acerto.' },
  { cat: 'atencao', id: 'grade', name: 'Grade da memória', icon: ScanEye, mode: 'best', file: 'GridMemory', how: 'Memorize os quadrados que acendem e toque neles depois.' },
  // ---------- Ação ----------
  { cat: 'acao', id: 'atravesse', name: 'Atravesse a rua', icon: TrafficCone, mode: 'best', file: 'Frogger', how: 'Atravesse ruas e rios sem ser pego pelos carros. Cada linha vale pontos.' },
];

/** Grupos dos jogos (para achar o jogo no ranking). */
export const CATS = [
  ['acao', 'Ação'],
  ['tabuleiro', 'Tabuleiro'],
  ['quebra', 'Quebra-cabeças'],
  ['palavras', 'Palavras e Bíblia'],
  ['atencao', 'Atenção'],
];

const modules = import.meta.glob('./g/*.jsx');
// Só aparecem os jogos que já existem.
export const GAMES = ALL.filter((g) => modules[`./g/${g.file}.jsx`]);
export const gameComponent = (g) => lazy(modules[`./g/${g.file}.jsx`]);
export const gameById = (id) => GAMES.find((g) => g.id === id);
