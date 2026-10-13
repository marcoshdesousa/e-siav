// Mini jogos (mesmos ids de client/src/pages/games/games.js).
// mode 'best': vale o recorde de uma partida; 'sum': os pontos das partidas vão somando.
// max: maior pontuação aceita numa partida (evita números absurdos).
export const GAMES = {
  cobrinha: { mode: 'best', max: 5000 },
  aventura: { mode: 'best', max: 200000 },
  velha: { mode: 'sum', max: 3 },
  domino: { mode: 'sum', max: 3 },
  2048: { mode: 'best', max: 500000 },
  blocos: { mode: 'best', max: 2000000 },
  memoria: { mode: 'best', max: 1000 },
  passaro: { mode: 'best', max: 5000 },
  tijolos: { mode: 'best', max: 100000 },
  minado: { mode: 'best', max: 1000 },
  genius: { mode: 'best', max: 500 },
  toupeira: { mode: 'best', max: 20000 },
  pong: { mode: 'best', max: 1000 },
  forca: { mode: 'best', max: 100000 },
  quiz: { mode: 'best', max: 100000 },
  alvo: { mode: 'best', max: 10000 },
  matematica: { mode: 'best', max: 100000 },
  deslizante: { mode: 'best', max: 2000 },
  nave: { mode: 'best', max: 1000000 },
  lig4: { mode: 'sum', max: 3 },
  empilhar: { mode: 'best', max: 2000 },
  desvie: { mode: 'best', max: 1000000 },
  cores: { mode: 'best', max: 100000 },
};
