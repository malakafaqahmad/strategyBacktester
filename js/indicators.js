// ═══════════════════════════════════════════════════════
//  INDICATORS CALCULATIONS
// ═══════════════════════════════════════════════════════

function calcSMA(src, length) {
  var values = new Array(src.length).fill(null);
  if (src.length < length) return values;
  var sum = 0;
  for (var i = 0; i < length; i++) {
    sum += src[i].c;
  }
  values[length - 1] = sum / length;
  for (var i = length; i < src.length; i++) {
    sum = sum - src[i - length].c + src[i].c;
    values[i] = sum / length;
  }
  return values;
}

function calcEMA(src, length) {
  var values = new Array(src.length).fill(null);
  if (src.length < length) return values;
  var sum = 0;
  for (var i = 0; i < length; i++) {
    sum += src[i].c;
  }
  var sma = sum / length;
  values[length - 1] = sma;
  var alpha = 2 / (length + 1);
  for (var i = length; i < src.length; i++) {
    values[i] = src[i].c * alpha + values[i - 1] * (1 - alpha);
  }
  return values;
}

function calcSR(src, lookback) {
  var supports = [];
  var resistances = [];
  if (src.length < lookback * 2 + 1) return { supports: [], resistances: [] };
  
  for (var i = lookback; i < src.length - lookback; i++) {
    // Pivot High (Resistance)
    var isHigh = true;
    for (var j = i - lookback; j <= i + lookback; j++) {
      if (src[j].h > src[i].h) { isHigh = false; break; }
    }
    if (isHigh && resistances.indexOf(src[i].h) === -1) {
      resistances.push(src[i].h);
    }
    
    // Pivot Low (Support)
    var isLow = true;
    for (var j = i - lookback; j <= i + lookback; j++) {
      if (src[j].l < src[i].l) { isLow = false; break; }
    }
    if (isLow && supports.indexOf(src[i].l) === -1) {
      supports.push(src[i].l);
    }
  }
  
  return {
    supports: supports.slice(-4),
    resistances: resistances.slice(-4)
  };
}

// ──────────────────────────── ATR & Pivot OB Calculations ────────────────────────────
function calcTR(candles) {
  var tr = new Array(candles.length).fill(0);
  if (candles.length === 0) return tr;
  tr[0] = candles[0].h - candles[0].l;
  for (var i = 1; i < candles.length; i++) {
    var hl = candles[i].h - candles[i].l;
    var hpc = Math.abs(candles[i].h - candles[i - 1].c);
    var lpc = Math.abs(candles[i].l - candles[i - 1].c);
    tr[i] = Math.max(hl, hpc, lpc);
  }
  return tr;
}

function calcATR(candles, len) {
  var tr = calcTR(candles);
  var atr = new Array(candles.length).fill(0);
  if (candles.length < len) return atr;
  var sum = 0;
  for (var i = 0; i < len; i++) {
    sum += tr[i];
  }
  atr[len - 1] = sum / len;
  for (var i = len; i < candles.length; i++) {
    atr[i] = (atr[i - 1] * (len - 1) + tr[i]) / len;
  }
  return atr;
}

function calcOB(src, pivotLen, obSearch, maxZones, invalMethod, showBreakers, showHistoric, useVolFilter, minVolStr, useAtrFilter, atrMult) {
  var bullOBs = [];
  var bearOBs = [];
  
  if (src.length < pivotLen * 2 + 1) return { bullOBs: [], bearOBs: [] };
  
  var avgVol = calcSMA(src, 20); // Default volMaLen = 20
  var atrVal = calcATR(src, 14);
  
  var swH = null;
  var swL = null;
  var swHBroken = true;
  var swLBroken = true;
  var maxAge = 5000;
  
  function overlapsActive(arr, t, b) {
    for (var k = 0; k < arr.length; k++) {
      var o = arr[k];
      if (!o.historic && !o.breaker) {
        if (Math.max(b, o.bottom) <= Math.min(t, o.top)) {
          return true;
        }
      }
    }
    return false;
  }
  
  for (var i = 0; i < src.length; i++) {
    // 1. Swing Detection (Pivots)
    var p = i - pivotLen;
    if (p >= pivotLen) {
      var isHigh = true;
      for (var j = p - pivotLen; j <= p + pivotLen; j++) {
        if (src[j].h > src[p].h) { isHigh = false; break; }
      }
      if (isHigh) {
        swH = src[p].h;
        swHBroken = false;
      }
      
      var isLow = true;
      for (var j = p - pivotLen; j <= p + pivotLen; j++) {
        if (src[j].l < src[p].l) { isLow = false; break; }
      }
      if (isLow) {
        swL = src[p].l;
        swLBroken = false;
      }
    }
    
    // 2. Break of Structure -> Spawn new OB
    if (swH !== null && !swHBroken && src[i].c > swH) {
      swHBroken = true;
      var idxBull = null;
      for (var k = i - 1; k >= Math.max(0, i - obSearch); k--) {
        if (src[k].c < src[k].o) { idxBull = k; break; }
      }
      if (idxBull !== null) {
        var t = src[idxBull].h;
        var b = src[idxBull].l;
        var v = src[idxBull].v;
        var base = avgVol[idxBull] || 1;
        var strength = v / base;
        
        var pass = true;
        if (useAtrFilter && (t - b) > (atrVal[idxBull] || 0) * atrMult) pass = false;
        if (useVolFilter && strength < minVolStr) pass = false;
        
        if (pass && !overlapsActive(bullOBs, t, b)) {
          var bv = (t - b) <= 0 ? v / 2 : v * (src[idxBull].c - b) / (t - b);
          var sv = (t - b) <= 0 ? v / 2 : v * (t - src[idxBull].c) / (t - b);
          bullOBs.unshift({
            top: t, bottom: b, startBar: idxBull, dir: 'Bull',
            vol: v, buyVol: bv, sellVol: sv, strength: strength,
            mitigated: false, breaker: false, historic: false, endBar: null
          });
        }
      }
    }
    
    if (swL !== null && !swLBroken && src[i].c < swL) {
      swLBroken = true;
      var idxBear = null;
      for (var k = i - 1; k >= Math.max(0, i - obSearch); k--) {
        if (src[k].c > src[k].o) { idxBear = k; break; }
      }
      if (idxBear !== null) {
        var t = src[idxBear].h;
        var b = src[idxBear].l;
        var v = src[idxBear].v;
        var base = avgVol[idxBear] || 1;
        var strength = v / base;
        
        var pass = true;
        if (useAtrFilter && (t - b) > (atrVal[idxBear] || 0) * atrMult) pass = false;
        if (useVolFilter && strength < minVolStr) pass = false;
        
        if (pass && !overlapsActive(bearOBs, t, b)) {
          var bv = (t - b) <= 0 ? v / 2 : v * (src[idxBear].c - b) / (t - b);
          var sv = (t - b) <= 0 ? v / 2 : v * (t - src[idxBear].c) / (t - b);
          bearOBs.unshift({
            top: t, bottom: b, startBar: idxBear, dir: 'Bear',
            vol: v, buyVol: bv, sellVol: sv, strength: strength,
            mitigated: false, breaker: false, historic: false, endBar: null
          });
        }
      }
    }
    
    updateLifecycle(bullOBs, true, i, src[i], invalMethod, showBreakers, showHistoric, maxAge);
    updateLifecycle(bearOBs, false, i, src[i], invalMethod, showBreakers, showHistoric, maxAge);
    
    capSide(bullOBs, maxZones, showHistoric, showBreakers);
    capSide(bearOBs, maxZones, showHistoric, showBreakers);
  }
  
  return { bullOBs: bullOBs, bearOBs: bearOBs };
}

// ──────────────────────────── Power Order Blocks Calculations ────────────────────────────
function calcPOB(src, dispThresh, maxBlocks, strLookback) {
  var bullBlocks = [];
  var bearBlocks = [];
  
  if (src.length < 2) return { bullBlocks: [], bearBlocks: [], bullRetestSignals: [], bearRetestSignals: [] };
  
  var lastBullRetestBar = null;
  var lastBearRetestBar = null;
  var bullRetestSignals = [];
  var bearRetestSignals = [];
  
  var ranges = src.map(function(c) { return c.h - c.l; });
  var atrVal = calcATR(src, 14);
  
  for (var i = 1; i < src.length; i++) {
    var c = src[i];
    var prev = src[i - 1];
    
    var startIdx = Math.max(0, i - strLookback);
    var maxCandleSize = 0;
    for (var k = startIdx; k <= i; k++) {
      if (ranges[k] > maxCandleSize) maxCandleSize = ranges[k];
    }
    
    var bullRetestRaw = false;
    var bearRetestRaw = false;
    
    // Update bullish blocks
    for (var b = bullBlocks.length - 1; b >= 0; b--) {
      var ob = bullBlocks[b];
      if (c.c < ob.bottom) {
        bullBlocks.splice(b, 1);
      } else {
        if (prev.l <= ob.top && c.l >= ob.top) {
          bullRetestRaw = true;
          ob.touches += 1;
        }
      }
    }
    
    // Update bearish blocks
    for (var b = bearBlocks.length - 1; b >= 0; b--) {
      var ob = bearBlocks[b];
      if (c.c > ob.top) {
        bearBlocks.splice(b, 1);
      } else {
        if (prev.h >= ob.bottom && c.h <= ob.bottom) {
          bearRetestRaw = true;
          ob.touches += 1;
        }
      }
    }
    
    // Filter retests with 10-bar gap
    if (bullRetestRaw && (lastBullRetestBar === null || i - lastBullRetestBar >= 10)) {
      lastBullRetestBar = i;
      bullRetestSignals.push({ idx: i, price: c.l - (atrVal[i] || 0) * 0.2 });
    }
    if (bearRetestRaw && (lastBearRetestBar === null || i - lastBearRetestBar >= 10)) {
      lastBearRetestBar = i;
      bearRetestSignals.push({ idx: i, price: c.h + (atrVal[i] || 0) * 0.2 });
    }
    
    // Check for Bullish POB
    var isBearishCandle = prev.c < prev.o;
    var isBullishDisp = c.c > c.o && c.c > prev.h && (c.c - c.o) > (prev.h - prev.l) * dispThresh;
    if (isBearishCandle && isBullishDisp) {
      var obTop = prev.h;
      var obBtm = prev.l;
      var pct = maxCandleSize > 0 ? ((obTop - obBtm) / maxCandleSize) * 100 : 0;
      
      for (var b = bullBlocks.length - 1; b >= 0; b--) {
        var old = bullBlocks[b];
        if (obTop >= old.bottom && obBtm <= old.top) {
          bullBlocks.splice(b, 1);
        }
      }
      
      bullBlocks.push({
        top: obTop, bottom: obBtm, startBar: i - 1,
        touches: 0, powerPct: pct
      });
      
      if (bullBlocks.length > maxBlocks) {
        bullBlocks.shift();
      }
    }
    
    // Check for Bearish POB
    var isBullishCandle = prev.c > prev.o;
    var isBearishDisp = c.c < c.o && c.c < prev.l && (c.o - c.c) > (prev.h - prev.l) * dispThresh;
    if (isBullishCandle && isBearishDisp) {
      var obTop = prev.h;
      var obBtm = prev.l;
      var pct = maxCandleSize > 0 ? ((obTop - obBtm) / maxCandleSize) * 100 : 0;
      
      for (var b = bearBlocks.length - 1; b >= 0; b--) {
        var old = bearBlocks[b];
        if (obTop >= old.bottom && obBtm <= old.top) {
          bearBlocks.splice(b, 1);
        }
      }
      
      bearBlocks.push({
        top: obTop, bottom: obBtm, startBar: i - 1,
        touches: 0, powerPct: pct
      });
      
      if (bearBlocks.length > maxBlocks) {
        bearBlocks.shift();
      }
    }
  }
  
  return {
    bullBlocks: bullBlocks,
    bearBlocks: bearBlocks,
    bullRetestSignals: bullRetestSignals,
    bearRetestSignals: bearRetestSignals
  };
}

function updateLifecycle(arr, bull, i, c, invalMethod, showBreakers, showHistoric, maxAge) {
  for (var k = arr.length - 1; k >= 0; k--) {
    var o = arr[k];
    if (i - o.startBar > maxAge) {
      arr.splice(k, 1);
    } else if (!o.historic) {
      var doBreaker = false;
      var doHistoric = false;
      var doKill = false;
      var doMitigate = false;
      
      if (!o.breaker) {
        var violated = bull ? 
          (invalMethod === 'Wick' ? c.l : c.c) < o.bottom : 
          (invalMethod === 'Wick' ? c.h : c.c) > o.top;
          
        if (violated) {
          doBreaker = showBreakers;
          doHistoric = !showBreakers && showHistoric;
          doKill = !showBreakers && !showHistoric;
        } else {
          doMitigate = (c.h >= o.bottom && c.l <= o.top) && !o.mitigated;
        }
      } else {
        var breakerGone = bull ? 
          (invalMethod === 'Wick' ? c.h : c.c) > o.top : 
          (invalMethod === 'Wick' ? c.l : c.c) < o.bottom;
        doHistoric = breakerGone && showHistoric;
        doKill = breakerGone && !showHistoric;
      }
      
      if (doBreaker) o.breaker = true;
      if (doHistoric) { o.historic = true; o.endBar = i; }
      if (doMitigate) o.mitigated = true;
      if (doKill) arr.splice(k, 1);
    }
  }
}

function capSide(arr, maxZones, showHistoric, showBreakers) {
  var storeCap = (showHistoric || showBreakers) ? maxZones * 3 : maxZones;
  while (arr.length > storeCap) {
    arr.pop();
  }
}

function recalculateIndicators() {
  var src = visibleSource();
  if (!src.length) return;
  for (var i = 0; i < S.indicators.length; i++) {
    var ind = S.indicators[i];
    if (ind.type === 'sma') {
      ind.values = calcSMA(src, ind.length);
    } else if (ind.type === 'ema') {
      ind.values = calcEMA(src, ind.length);
    } else if (ind.type === 'sr') {
      ind.values = calcSR(src, ind.lookback || ind.length);
    } else if (ind.type === 'ob') {
      var pl = ind.pivotLen || 10;
      var obs = ind.obSearch || 15;
      var mz = ind.maxZones || 4;
      var inv = ind.invalMethod || 'Wick';
      var sb = ind.showBreakers !== false;
      var sh = ind.showHistoric !== false;
      ind.values = calcOB(src, pl, obs, mz, inv, sb, sh, false, 1.5, true, 3.0);
    } else if (ind.type === 'pob') {
      var dt = ind.dispThresh !== undefined ? ind.dispThresh : 0.5;
      var mb = ind.maxBlocks || 10;
      ind.values = calcPOB(src, dt, mb, 100);
    }
  }
}

// ═══════════════════════════════════════════════════════
//  RENDER INDICATORS
// ═══════════════════════════════════════════════════════

function formatVolume(v) {
  if (v >= 1000000) return (v / 1000000).toFixed(2) + 'M';
  if (v >= 1000) return (v / 1000).toFixed(1) + 'K';
  return v.toFixed(0);
}

function drawOBList(ctx, obs, vis, r, zoneCol, buyCol, sellCol, breakCol) {
  var src = visibleSource();
  var extendBars = 20;
  var volBarMax = 30;
  
  for (var i = 0; i < obs.length; i++) {
    var o = obs[i];
    
    var leftX = gidx2x_any(o.startBar);
    var rightBar = o.endBar !== null ? o.endBar : (src.length - 1 + extendBars);
    var rightX = gidx2x_any(rightBar);
    
    var topY = p2y(o.top, r);
    var bottomY = p2y(o.bottom, r);
    var midY = (topY + bottomY) / 2;
    var w = rightX - leftX;
    var h = bottomY - topY;
    
    var bg = (o.breaker || o.historic) ? breakCol : zoneCol;
    
    ctx.save();
    ctx.fillStyle = bg;
    ctx.fillRect(leftX, topY, w, h);
    ctx.strokeStyle = (o.breaker || o.historic) ? 'rgba(120, 123, 134, 0.4)' : (o.dir === 'Bull' ? 'rgba(8, 153, 129, 0.4)' : 'rgba(242, 54, 69, 0.4)');
    ctx.lineWidth = 1;
    ctx.strokeRect(leftX, topY, w, h);
    
    if (!o.breaker && !o.historic) {
      ctx.strokeStyle = o.dir === 'Bull' ? 'rgba(8, 153, 129, 0.6)' : 'rgba(242, 54, 69, 0.6)';
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(leftX, midY);
      ctx.lineTo(rightX, midY);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    
    if (o.vol > 0 && !o.breaker && !o.historic) {
      var maxPixelLen = (CW / S.viewCount) * volBarMax;
      var span = Math.min(maxPixelLen, Math.max(2, w - 1));
      var buyW = (o.buyVol / o.vol) * span;
      var sellW = (o.sellVol / o.vol) * span;
      
      ctx.fillStyle = buyCol;
      ctx.fillRect(leftX, topY, buyW, midY - topY);
      ctx.fillStyle = sellCol;
      ctx.fillRect(leftX, midY, sellW, bottomY - midY);
    }
    
    if (!o.historic) {
      var buyPct = o.vol > 0 ? (o.buyVol / o.vol) * 100 : 50;
      var sellPct = 100 - buyPct;
      ctx.fillStyle = 'rgba(232, 234, 246, 0.55)';
      ctx.font = '8px Courier New,monospace';
      ctx.textAlign = 'right';
      ctx.fillText(formatVolume(o.vol), rightX - 4, midY - 4);
      ctx.fillText(buyPct.toFixed(0) + '/' + sellPct.toFixed(0) + '%', rightX - 4, midY + 6);
    }
    ctx.restore();
  }
}

// ──────────────────────────── Render Power Order Blocks List ────────────────────────────
function drawPOBList(ctx, blocks, vis, r, color, showEq, powerFade, side) {
  var src = visibleSource();
  var extendBars = 25;
  var currentBarX = gidx2x_any(src.length - 1);
  var rightX = gidx2x_any(src.length - 1 + extendBars);
  
  for (var i = 0; i < blocks.length; i++) {
    var ob = blocks[i];
    var leftX = gidx2x_any(ob.startBar);
    var topY = p2y(ob.top, r);
    var bottomY = p2y(ob.bottom, r);
    var midY = (topY + bottomY) / 2;
    var h = bottomY - topY;
    var w = rightX - leftX;
    
    // Transparency calculation: Power 100% -> transp 60, Power 0% -> transp 92
    var transp = powerFade ? Math.round(92 - (ob.powerPct / 100.0) * 32) : 80;
    var alpha = 1.0 - (transp / 100);
    
    var rgbaFill = hexToRgba(color, alpha);
    var rgbaBorder = hexToRgba(color, 0.4);
    
    ctx.save();
    
    // 1. Draw Main Zone (dashed borders, transparent fill)
    ctx.fillStyle = rgbaFill;
    ctx.fillRect(leftX, topY, currentBarX - leftX, h);
    
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);
    ctx.strokeRect(leftX, topY, currentBarX - leftX, h);
    ctx.setLineDash([]);
    
    // 2. Draw Equilibrium (midpoint) line
    if (showEq) {
      ctx.strokeStyle = rgbaBorder;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(leftX, midY);
      ctx.lineTo(currentBarX, midY);
      ctx.stroke();
    }
    
    // 3. Draw Side Info Card at extension
    var infoW = rightX - currentBarX;
    ctx.fillStyle = hexToRgba(color, 0.08);
    ctx.fillRect(currentBarX, topY, infoW, h);
    
    ctx.strokeStyle = rgbaBorder;
    ctx.lineWidth = 1;
    ctx.strokeRect(currentBarX, topY, infoW, h);
    
    var label1 = side === 'Bull' ? 'Bullish OB' : 'Bearish OB';
    var label2 = 'Power: ' + Math.round(ob.powerPct) + '%';
    var label3 = 'Touches: ' + ob.touches;
    
    ctx.fillStyle = '#ffffff';
    ctx.font = '8px Courier New,monospace';
    ctx.textAlign = 'center';
    ctx.fillText(label1, currentBarX + infoW / 2, midY - 10);
    ctx.fillStyle = 'rgba(232, 234, 246, 0.65)';
    ctx.fillText(label2, currentBarX + infoW / 2, midY + 1);
    ctx.fillText(label3, currentBarX + infoW / 2, midY + 12);
    
    ctx.restore();
  }
}

function drawPOBRetests(ctx, signals, vis, r, color, arrow) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.font = 'bold 14px Courier New,monospace';
  ctx.textAlign = 'center';
  for (var i = 0; i < signals.length; i++) {
    var sig = signals[i];
    var x = gidx2x_any(sig.idx);
    var y = p2y(sig.price, r);
    ctx.fillText(arrow, x, y);
  }
  ctx.restore();
}

function hexToRgba(hex, alpha) {
  if (/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)) {
    var c = hex.substring(1).split('');
    if (c.length === 3) {
      c = [c[0], c[0], c[1], c[1], c[2], c[2]];
    }
    c = '0x' + c.join('');
    return 'rgba(' + [(c >> 16) & 255, (c >> 8) & 255, c & 255].join(',') + ',' + alpha + ')';
  }
  return hex;
}

function drawIndicators(ctx, vis, r) {
  recalculateIndicators();
  
  var infoDiv = document.getElementById('ohlcv-info');
  var labels = [];
  
  for (var k = 0; k < S.indicators.length; k++) {
    var ind = S.indicators[k];
    if (!ind.values) continue;
    
    if (ind.type === 'sma' || ind.type === 'ema') {
      var valArr = ind.values;
      ctx.strokeStyle = ind.color || '#ff9100';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([]);
      ctx.beginPath();
      var first = true;
      for (var i = 0; i < vis.length; i++) {
        var gidx = S.viewStart + i;
        if (gidx < valArr.length && valArr[gidx] !== null) {
          var x = cxPos(i);
          var y = p2y(valArr[gidx], r);
          if (first) {
            ctx.moveTo(x, y);
            first = false;
          } else {
            ctx.lineTo(x, y);
          }
        }
      }
      ctx.stroke();
      
      var currVal = null;
      if (valArr.length) currVal = valArr[valArr.length - 1];
      var name = ind.type.toUpperCase() + '(' + ind.length + ')';
      var dispVal = currVal !== null ? fmtP(currVal) : '—';
      labels.push({ name: name, val: dispVal, color: ind.color });
      
    } else if (ind.type === 'sr') {
      var sr = ind.values;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      
      ctx.strokeStyle = 'rgba(255, 23, 68, 0.45)';
      for (var i = 0; i < sr.resistances.length; i++) {
        var price = sr.resistances[i];
        var y = p2y(price, r);
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CW, y); ctx.stroke();
        
        ctx.fillStyle = 'rgba(255, 23, 68, 0.7)';
        ctx.font = '8px Courier New,monospace';
        ctx.fillText('R: ' + fmtP(price), 5, y - 2);
      }
      
      ctx.strokeStyle = 'rgba(0, 230, 118, 0.45)';
      for (var i = 0; i < sr.supports.length; i++) {
        var price = sr.supports[i];
        var y = p2y(price, r);
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CW, y); ctx.stroke();
        
        ctx.fillStyle = 'rgba(0, 230, 118, 0.7)';
        ctx.font = '8px Courier New,monospace';
        ctx.fillText('S: ' + fmtP(price), 5, y - 2);
      }
      ctx.setLineDash([]);
      
      labels.push({ name: 'S&R(' + (ind.lookback || ind.length) + ')', val: 'Active', color: ind.color || '#ffd740' });
      
    } else if (ind.type === 'ob') {
      var obResult = ind.values;
      var bullZoneColor = 'rgba(8, 153, 129, 0.14)';
      var bearZoneColor = 'rgba(242, 54, 69, 0.14)';
      var buyBarColor = 'rgba(8, 153, 129, 0.35)';
      var sellBarColor = 'rgba(242, 54, 69, 0.35)';
      var breakerZoneColor = 'rgba(120, 123, 134, 0.11)';
      
      drawOBList(ctx, obResult.bullOBs, vis, r, bullZoneColor, buyBarColor, sellBarColor, breakerZoneColor);
      drawOBList(ctx, obResult.bearOBs, vis, r, bearZoneColor, buyBarColor, sellBarColor, breakerZoneColor);
      
      labels.push({ name: 'OrderBlocks(' + (ind.pivotLen || 10) + ')', val: 'Active', color: ind.color || '#089981' });
      
    } else if (ind.type === 'pob') {
      var pobResult = ind.values;
      var bullColor = '#1bd37a';
      var bearColor = '#bc14e6';
      
      drawPOBList(ctx, pobResult.bullBlocks, vis, r, bullColor, true, true, 'Bull');
      drawPOBList(ctx, pobResult.bearBlocks, vis, r, bearColor, true, true, 'Bear');
      
      drawPOBRetests(ctx, pobResult.bullRetestSignals, vis, r, bullColor, '⇡');
      drawPOBRetests(ctx, pobResult.bearRetestSignals, vis, r, bearColor, '⇣');
      
      labels.push({ name: 'PowerOB(' + (ind.dispThresh || 0.5) + ')', val: 'Active', color: bullColor });
    }
  }
  
  // Render labels on ohlcv-info bar
  var oldSpans = infoDiv.querySelectorAll('.ind-lbl');
  for (var i = 0; i < oldSpans.length; i++) {
    oldSpans[i].remove();
  }
  for (var i = 0; i < labels.length; i++) {
    var lbl = labels[i];
    var span = document.createElement('span');
    span.className = 'ind-lbl';
    span.style.color = lbl.color;
    span.style.marginLeft = '12px';
    span.textContent = lbl.name + ': ' + lbl.val;
    infoDiv.appendChild(span);
  }
}

// ═══════════════════════════════════════════════════════
//  UI MANAGEMENT (PANEL & MODAL)
// ═══════════════════════════════════════════════════════

var editingIndicatorId = null;

function updateIndicatorsUI() {
  var list = document.getElementById('active-indicators');
  if (!list) return;
  list.innerHTML = '';
  
  for (var i = 0; i < S.indicators.length; i++) {
    var ind = S.indicators[i];
    var row = document.createElement('div');
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.justifyContent = 'space-between';
    row.style.background = 'var(--bg2)';
    row.style.border = '1px solid var(--border)';
    row.style.padding = '5px 8px';
    row.style.borderRadius = '3px';
    row.style.fontSize = '10px';
    
    var textSpan = document.createElement('span');
    textSpan.style.color = ind.color || '#ffd740';
    textSpan.style.fontWeight = '700';
    if (ind.type === 'sr') {
      textSpan.textContent = 'S&R (' + (ind.lookback || ind.length) + ')';
    } else if (ind.type === 'ob') {
      textSpan.textContent = 'OB (' + (ind.pivotLen || 10) + ')';
    } else if (ind.type === 'pob') {
      textSpan.textContent = 'PowerOB (' + (ind.dispThresh || 0.5) + ')';
    } else {
      textSpan.textContent = ind.type.toUpperCase() + ' (' + ind.length + ')';
    }
    
    var btnGrp = document.createElement('div');
    btnGrp.style.display = 'flex';
    btnGrp.style.gap = '8px';
    
    var editBtn = document.createElement('span');
    editBtn.textContent = '✏️';
    editBtn.style.cursor = 'pointer';
    (function(id) {
      editBtn.addEventListener('click', function() {
        openIndicatorModal(id);
      });
    })(ind.id);
    
    var delBtn = document.createElement('span');
    delBtn.textContent = '✕';
    delBtn.style.cursor = 'pointer';
    delBtn.style.color = 'var(--red)';
    (function(id) {
      delBtn.addEventListener('click', function() {
        S.indicators = S.indicators.filter(function(x) { return x.id !== id; });
        updateIndicatorsUI();
        render();
      });
    })(ind.id);
    
    btnGrp.appendChild(editBtn);
    btnGrp.appendChild(delBtn);
    row.appendChild(textSpan);
    row.appendChild(btnGrp);
    list.appendChild(row);
  }
}

function openIndicatorModal(id) {
  editingIndicatorId = id;
  var modal = document.getElementById('indicator-modal');
  var typeSelect = document.getElementById('ind-type-select');
  var lengthInput = document.getElementById('ind-length');
  var lengthLabel = document.getElementById('ind-len-label');
  var colorInput = document.getElementById('ind-color');
  var title = document.getElementById('ind-modal-title');
  
  if (id) {
    title.textContent = 'Edit Indicator';
    var ind = S.indicators.find(function(x) { return x.id === id; });
    typeSelect.value = ind.type;
    typeSelect.disabled = true;
    
    if (ind.type === 'sr') {
      lengthInput.value = ind.lookback;
      lengthLabel.textContent = 'Lookback Period';
    } else if (ind.type === 'ob') {
      lengthInput.value = ind.pivotLen;
      lengthLabel.textContent = 'Swing Length (Pivot)';
    } else if (ind.type === 'pob') {
      lengthInput.value = ind.dispThresh;
      lengthLabel.textContent = 'Displacement Multiplier';
    } else {
      lengthInput.value = ind.length;
      lengthLabel.textContent = 'Length';
    }
    colorInput.value = ind.color || '#ffd740';
  } else {
    title.textContent = 'Add Indicator';
    typeSelect.value = 'sma';
    typeSelect.disabled = false;
    lengthInput.value = '20';
    lengthLabel.textContent = 'Length';
    colorInput.value = '#ff9100';
  }
  modal.style.display = 'flex';
}

window.addEventListener('load', function() {
  var addBtn = document.getElementById('btn-add-indicator');
  if (addBtn) {
    addBtn.addEventListener('click', function() {
      openIndicatorModal(null);
    });
  }
  
  var typeSelect = document.getElementById('ind-type-select');
  if (typeSelect) {
    typeSelect.addEventListener('change', function() {
      var lengthLabel = document.getElementById('ind-len-label');
      var lengthInput = document.getElementById('ind-length');
      lengthInput.step = '1';
      
      if (typeSelect.value === 'sr') {
        lengthLabel.textContent = 'Lookback Period';
        lengthInput.value = '15';
        document.getElementById('ind-color').value = '#ffd740';
      } else if (typeSelect.value === 'ob') {
        lengthLabel.textContent = 'Swing Length (Pivot)';
        lengthInput.value = '10';
        document.getElementById('ind-color').value = '#089981';
      } else if (typeSelect.value === 'pob') {
        lengthLabel.textContent = 'Displacement Multiplier';
        lengthInput.value = '0.5';
        lengthInput.step = '0.1';
        document.getElementById('ind-color').value = '#1bd37a';
      } else {
        lengthLabel.textContent = 'Length';
        lengthInput.value = '20';
        document.getElementById('ind-color').value = typeSelect.value === 'sma' ? '#ff9100' : '#e040fb';
      }
    });
  }
  
  var cancelBtn = document.getElementById('ind-cancel');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', function() {
      document.getElementById('indicator-modal').style.display = 'none';
      editingIndicatorId = null;
    });
  }
  
  var saveBtn = document.getElementById('ind-save');
  if (saveBtn) {
    saveBtn.addEventListener('click', function() {
      var modal = document.getElementById('indicator-modal');
      var typeSelect = document.getElementById('ind-type-select');
      var lengthInput = document.getElementById('ind-length');
      var colorVal = document.getElementById('ind-color').value;
      
      if (editingIndicatorId) {
        var ind = S.indicators.find(function(x) { return x.id === editingIndicatorId; });
        if (ind) {
          if (ind.type === 'sr') {
            ind.lookback = parseInt(lengthInput.value) || 15;
          } else if (ind.type === 'ob') {
            ind.pivotLen = parseInt(lengthInput.value) || 10;
          } else if (ind.type === 'pob') {
            ind.dispThresh = parseFloat(lengthInput.value) || 0.5;
          } else {
            ind.length = parseInt(lengthInput.value) || 20;
          }
          ind.color = colorVal;
        }
      } else {
        var newId = 'ind_' + Date.now();
        var typeVal = typeSelect.value;
        var newInd = {
          id: newId,
          type: typeVal,
          color: colorVal
        };
        if (typeVal === 'sr') {
          newInd.lookback = parseInt(lengthInput.value) || 15;
        } else if (typeVal === 'ob') {
          newInd.pivotLen = parseInt(lengthInput.value) || 10;
          newInd.obSearch = 15;
          newInd.maxZones = 4;
          newInd.invalMethod = 'Wick';
          newInd.showBreakers = true;
          newInd.showHistoric = true;
        } else if (typeVal === 'pob') {
          newInd.dispThresh = parseFloat(lengthInput.value) || 0.5;
          newInd.maxBlocks = 10;
        } else {
          newInd.length = parseInt(lengthInput.value) || 20;
        }
        S.indicators.push(newInd);
      }
      
      modal.style.display = 'none';
      editingIndicatorId = null;
      updateIndicatorsUI();
      render();
    });
  }
  
  updateIndicatorsUI();
});
