// ═══════════════════════════════════════════════════════
//  STRATEGY SANDBOX EXECUTOR
// ═══════════════════════════════════════════════════════

var smaCache = {};
var emaCache = {};

function runStrategy() {
  var consoleEl = document.getElementById('tester-console');
  if (!consoleEl) return;
  consoleEl.innerHTML = '';
  
  var code = document.getElementById('script-textarea').value;
  var candles = S.allCandles;
  if (!candles || candles.length === 0) {
    writeConsole('Error: No historical data loaded. Please generate demo data or drop a CSV file.', 'var(--red)');
    return;
  }
  
  writeConsole('Initiating strategy backtest on ' + candles.length + ' candles…', 'var(--accent)');
  
  // Reset simulation state
  var initialBalance = 10000;
  var balance = initialBalance;
  var activePos = null;
  var closedTrades = [];
  var equityCurve = [];
  
  // Reset indicator caches
  smaCache = {};
  emaCache = {};
  
  // Custom API indicators
  function getSMA(len) {
    if (smaCache[len]) return smaCache[len];
    var val = calcSMA(candles, len);
    smaCache[len] = val;
    return val;
  }
  
  function getEMA(len) {
    if (emaCache[len]) return emaCache[len];
    var val = calcEMA(candles, len);
    emaCache[len] = val;
    return val;
  }
  
  function closePosition(exitPrice, exitIndex, reason) {
    if (!activePos) return;
    var pnl = 0;
    var size = activePos.size;
    if (activePos.side === 'long') {
      pnl = (exitPrice - activePos.entryPrice) / activePos.entryPrice * size;
    } else {
      pnl = (activePos.entryPrice - exitPrice) / activePos.entryPrice * size;
    }
    
    // Realistic 0.05% taker commission fee (entry + exit)
    var fee = size * 0.0005 * 2;
    pnl -= fee;
    balance += pnl;
    
    closedTrades.push({
      side: activePos.side,
      entryPrice: activePos.entryPrice,
      exitPrice: exitPrice,
      entryIndex: activePos.entryIndex,
      exitIndex: exitIndex,
      pnl: pnl,
      fee: fee,
      reason: reason
    });
    
    activePos = null;
  }
  
  var api = {
    buy: function(params) {
      if (activePos) return;
      var entryPrice = candles[index].c;
      activePos = {
        side: 'long',
        entryPrice: entryPrice,
        size: balance, // 100% account sizing (compounding)
        sl: params ? params.sl : null,
        tp: params ? params.tp : null,
        entryIndex: index
      };
    },
    sell: function(params) {
      if (activePos) return;
      var entryPrice = candles[index].c;
      activePos = {
        side: 'short',
        entryPrice: entryPrice,
        size: balance,
        sl: params ? params.sl : null,
        tp: params ? params.tp : null,
        entryIndex: index
      };
    },
    close: function() {
      if (!activePos) return;
      closePosition(candles[index].c, index, 'Exit Signal');
    }
  };
  
  // Wrap user logic inside a sandbox executable
  var tickFunc = null;
  try {
    tickFunc = new Function('index', 'price', 'candles', 'getSMA', 'getEMA', 'api', code);
  } catch (e) {
    writeConsole('Syntax Compilation Error:\n' + e.message, 'var(--red)');
    return;
  }
  
  var index = 0;
  // Execution loop
  for (var i = 0; i < candles.length; i++) {
    index = i;
    var price = candles[i].c;
    var c = candles[i];
    
    // Check SL/TP boundaries first
    if (activePos) {
      var isL = activePos.side === 'long';
      if (activePos.sl && ((isL && c.l <= activePos.sl) || (!isL && c.h >= activePos.sl))) {
        closePosition(activePos.sl, i, 'Stop Loss Hit');
      } else if (activePos.tp && ((isL && c.h >= activePos.tp) || (!isL && c.l <= activePos.tp))) {
        closePosition(activePos.tp, i, 'Take Profit Hit');
      }
    }
    
    // Execute tick function
    try {
      tickFunc(i, price, candles, getSMA, getEMA, api);
    } catch (e) {
      writeConsole('Runtime Simulation Error at index ' + i + ':\n' + e.message, 'var(--red)');
      return;
    }
    
    // Track equity
    var currentEquity = balance;
    if (activePos) {
      var unrealized = 0;
      if (activePos.side === 'long') {
        unrealized = (price - activePos.entryPrice) / activePos.entryPrice * activePos.size;
      } else {
        unrealized = (activePos.entryPrice - price) / activePos.entryPrice * activePos.size;
      }
      currentEquity += unrealized;
    }
    equityCurve.push({ index: i, balance: currentEquity });
  }
  
  // Liquidate active position at the end of the simulation
  if (activePos) {
    closePosition(candles[candles.length - 1].c, candles.length - 1, 'End of Backtest');
    equityCurve[equityCurve.length - 1].balance = balance;
  }
  
  // Evaluate Performance Metrics
  var totalTrades = closedTrades.length;
  var wins = closedTrades.filter(function(t) { return t.pnl >= 0; }).length;
  var losses = totalTrades - wins;
  var winRate = totalTrades > 0 ? (wins / totalTrades * 100) : 0;
  
  var grossWin = 0, grossLoss = 0;
  for (var t = 0; t < closedTrades.length; t++) {
    var pnl = closedTrades[t].pnl;
    if (pnl >= 0) grossWin += pnl;
    else grossLoss += Math.abs(pnl);
  }
  var profitFactor = grossLoss > 0 ? (grossWin / grossLoss) : grossWin > 0 ? Infinity : 0;
  
  // Drawdowns
  var maxDD = 0;
  var peak = initialBalance;
  for (var k = 0; k < equityCurve.length; k++) {
    var eq = equityCurve[k].balance;
    if (eq > peak) peak = eq;
    var dd = (peak - eq) / peak * 100;
    if (dd > maxDD) maxDD = dd;
  }
  
  S.strategyResult = {
    equityCurve: equityCurve,
    trades: closedTrades,
    initialBalance: initialBalance,
    finalBalance: balance,
    winRate: winRate,
    profitFactor: profitFactor,
    maxDrawdown: maxDD,
    totalTrades: totalTrades
  };
  
  // Render Console Metrics Output
  printMetricsReport();
}

function writeConsole(txt, color) {
  var consoleEl = document.getElementById('tester-console');
  if (!consoleEl) return;
  var d = document.createElement('div');
  d.style.color = color || 'var(--text1)';
  d.style.marginBottom = '4px';
  d.style.whiteSpace = 'pre-wrap';
  d.textContent = txt;
  consoleEl.appendChild(d);
  consoleEl.scrollTop = consoleEl.scrollHeight;
}

function printMetricsReport() {
  var consoleEl = document.getElementById('tester-console');
  if (!consoleEl || !S.strategyResult) return;
  
  var res = S.strategyResult;
  var netP = res.finalBalance - res.initialBalance;
  var netPct = (netP / res.initialBalance * 100).toFixed(2);
  
  var html = '<div style="margin-top: 10px; border-top: 1px solid var(--border); padding-top: 8px;">' +
    '<table style="width: 100%; border-collapse: collapse; font-size: 10px; text-align: left; color: var(--text1);">' +
      '<tr><td style="padding: 3px 0; color: var(--text2)">Net Profit:</td><td style="font-weight: 700; color: ' + (netP >= 0 ? 'var(--green)' : 'var(--red)') + '">$' + netP.toFixed(2) + ' (' + (netP >= 0 ? '+' : '') + netPct + '%)</td></tr>' +
      '<tr><td style="padding: 3px 0; color: var(--text2)">Total Trades:</td><td style="font-weight: 700;">' + res.totalTrades + '</td></tr>' +
      '<tr><td style="padding: 3px 0; color: var(--text2)">Win Rate:</td><td style="font-weight: 700;">' + res.winRate.toFixed(1) + '%</td></tr>' +
      '<tr><td style="padding: 3px 0; color: var(--text2)">Profit Factor:</td><td style="font-weight: 700; color: ' + (res.profitFactor >= 1 ? 'var(--green)' : 'var(--red)') + '">' + (res.profitFactor === Infinity ? '∞' : res.profitFactor.toFixed(2)) + '</td></tr>' +
      '<tr><td style="padding: 3px 0; color: var(--text2)">Max Drawdown:</td><td style="font-weight: 700; color: var(--red);">' + res.maxDrawdown.toFixed(2) + '%</td></tr>' +
    '</table>' +
  '</div>';
  
  // Render Trades log list
  html += '<div style="margin-top: 12px; font-weight: 700; font-size: 9px; color: var(--text2); text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid var(--border); padding-bottom: 3px; margin-bottom: 4px;">Simulation Trade Log</div>';
  html += '<div style="max-height: 100px; overflow-y: auto; display: flex; flex-direction: column; gap: 3px;">';
  
  var trades = res.trades;
  if (trades.length === 0) {
    html += '<div style="font-size: 9px; color: var(--text2)">No trades executed during backtest.</div>';
  } else {
    for (var i = trades.length - 1; i >= 0; i--) {
      var t = trades[i];
      var dir = t.side === 'long' ? 'BUY' : 'SELL';
      var dirCol = t.side === 'long' ? 'var(--green)' : 'var(--red)';
      var pnlCol = t.pnl >= 0 ? 'var(--green)' : 'var(--red)';
      
      html += '<div style="display: flex; justify-content: space-between; font-size: 9px; padding: 2px 0; border-bottom: 1px dashed rgba(92,107,192,0.1);">' +
        '<span><b style="color:' + dirCol + '">' + dir + '</b> @ ' + t.entryPrice.toFixed(2) + ' → ' + t.exitPrice.toFixed(2) + ' <i style="color:var(--text2)">(' + t.reason + ')</i></span>' +
        '<span style="font-weight: 700; color:' + pnlCol + '">' + (t.pnl >= 0 ? '+' : '') + '$' + t.pnl.toFixed(2) + '</span>' +
      '</div>';
    }
  }
  html += '</div>';
  
  // Append to console
  var divReport = document.createElement('div');
  divReport.innerHTML = html;
  consoleEl.appendChild(divReport);
  consoleEl.scrollTop = 0; // scroll to top to see statistics table first
}

// ═══════════════════════════════════════════════════════
//  RENDER EQUITY CURVE OVERLAY
// ═══════════════════════════════════════════════════════

function drawEquityCurve(ctx, vis, r) {
  if (!S.strategyResult || !S.strategyResult.equityCurve.length) return;
  var eq = S.strategyResult.equityCurve;
  
  // Calculate viewport min/max balance for relative scale
  var minBal = Infinity;
  var maxBal = -Infinity;
  
  for (var i = 0; i < vis.length; i++) {
    var gidx = S.viewStart + i;
    if (gidx < eq.length) {
      var bal = eq[gidx].balance;
      if (bal < minBal) minBal = bal;
      if (bal > maxBal) maxBal = bal;
    }
  }
  
  if (minBal === Infinity) return;
  if (maxBal === minBal) {
    minBal = maxBal * 0.95;
    maxBal = maxBal * 1.05;
  }
  
  ctx.save();
  // 1. Draw sub-window container boundary at the bottom 25% of chart
  var boxH = CH * 0.20;
  var boxY = CH - 20 - boxH;
  
  ctx.fillStyle = 'rgba(13, 16, 23, 0.72)';
  ctx.fillRect(0, boxY, CW, boxH);
  ctx.strokeStyle = 'rgba(0, 212, 255, 0.2)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, boxY);
  ctx.lineTo(CW, boxY);
  ctx.stroke();
  
  // 2. Draw Equity Curve Line
  ctx.strokeStyle = '#ffd740';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  var first = true;
  var s = Math.max(0, Math.floor(S.viewStart));
  for (var i = 0; i < vis.length; i++) {
    var gidx = s + i;
    if (gidx < eq.length) {
      var li = gidx - S.viewStart;
      var x = cxPos(li);
      var bal = eq[gidx].balance;
      var y = boxY + boxH - ((bal - minBal) / (maxBal - minBal) * (boxH - 10)) - 5;
      if (first) {
        ctx.moveTo(x, y);
        first = false;
      } else {
        ctx.lineTo(x, y);
      }
    }
  }
  ctx.stroke();
  
  // 3. Render Titles & Ticks
  ctx.fillStyle = '#ffd740';
  ctx.font = 'bold 8px Courier New,monospace';
  ctx.textAlign = 'left';
  ctx.fillText('EQUITY CURVE (Max: $' + Math.round(maxBal).toLocaleString() + '  Min: $' + Math.round(minBal).toLocaleString() + ')', 10, boxY + 10);
  
  // Print current overlay value next to cursor
  var mx = S.mouseX;
  if (mx >= 0 && mx < CW) {
    var vi = x2vi(mx);
    var gidx = Math.floor(S.viewStart + vi);
    if (gidx >= 0 && gidx < eq.length) {
      var bal = eq[gidx].balance;
      ctx.textAlign = 'right';
      ctx.fillText('Eq: $' + bal.toFixed(2), CW - 10, boxY + 10);
    }
  }
  ctx.restore();
}

// ═══════════════════════════════════════════════════════
//  UI TRIGGERS BINDINGS
// ═══════════════════════════════════════════════════════

window.addEventListener('load', function() {
  var toggleBtn = document.getElementById('btn-toggle-editor');
  var editorPanel = document.getElementById('editor-panel');
  
  if (toggleBtn && editorPanel) {
    toggleBtn.addEventListener('click', function() {
      var isOpen = editorPanel.style.display === 'flex';
      editorPanel.style.display = isOpen ? 'none' : 'flex';
      toggleBtn.classList.toggle('active', !isOpen);
      resize(); // Recalculate dimensions of the canvas area dynamically
    });
  }
  
  var runBtn = document.getElementById('btn-run-script');
  if (runBtn) {
    runBtn.addEventListener('click', function() {
      runStrategy();
    });
  }
  
  var showEquityCheckbox = document.getElementById('chk-show-equity');
  if (showEquityCheckbox) {
    showEquityCheckbox.addEventListener('change', function() {
      S.showEquityCurve = showEquityCheckbox.checked;
      render();
    });
  }
});
