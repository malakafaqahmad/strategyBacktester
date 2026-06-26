// ═══════════════════════════════════════════════════════
//  STATE
// ═══════════════════════════════════════════════════════
var S = {
  rawMin: [],          // all 1-min {t,o,h,l,c,v}
  allCandles: [],      // current TF candles (full dataset)
  tf: 1,

  // REPLAY
  replayMode: false,
  replayCursor: 0,     // index into allCandles — last revealed candle
  playing: false,
  playTimer: null,

  // VIEW (pan/zoom over revealed candles)
  viewStart: 0,
  viewCount: 120,

  // INTERACTION
  mouseX: -1, mouseY: -1,
  dragging: false, dragX0: 0, dragVS0: 0,
  activeTool: 'cursor',
  drawings: [],
  indicators: [],      // active indicators
  strategyResult: null, // holds simulation stats
  showEquityCurve: false, // toggle rendering
  wip: null,           // drawing in progress
  hoverDraw: null,
  ctxPrice: 0, ctxCandle: null,

  // TRADING
  openPos: null,
  trades: [],
  side: 'long',
  sessionPnl: 0, wins: 0, losses: 0,
  bestTrade: null, worstTrade: null, grossWin: 0, grossLoss: 0,
  pricePanOffset: 0,   // vertical price offset for panning
};
