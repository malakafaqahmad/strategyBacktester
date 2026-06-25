// ═══════════════════════════════════════════════════════
//  TF AGGREGATION
// ═══════════════════════════════════════════════════════
function buildTF() {
  var tf=S.tf, raw=S.rawMin;
  if(tf===1){ S.allCandles=raw.slice(); return; }
  var out=[], bucket=null;
  for(var i=0;i<raw.length;i++){
    var m=raw[i], bt=Math.floor(m.t/(tf*60))*(tf*60);
    if(!bucket||bucket.t!==bt){
      if(bucket) out.push(bucket);
      bucket={t:bt,o:m.o,h:m.h,l:m.l,c:m.c,v:m.v};
    } else {
      bucket.h=Math.max(bucket.h,m.h); bucket.l=Math.min(bucket.l,m.l);
      bucket.c=m.c; bucket.v+=m.v;
    }
  }
  if(bucket) out.push(bucket);
  S.allCandles=out;
}

// ═══════════════════════════════════════════════════════
//  REPLAY SYSTEM
// ═══════════════════════════════════════════════════════
// "revealed" candles = allCandles[0..replayCursor] when in replay mode
// when NOT in replay mode, all candles are shown

function visibleSource() {
  // returns the array of candles to show (may be sliced by replay)
  if(S.replayMode) return S.allCandles.slice(0, S.replayCursor+1);
  return S.allCandles;
}

function getVisible() {
  var src = visibleSource();
  var s = Math.max(0, S.viewStart);
  var e = Math.min(src.length, s + S.viewCount);
  return src.slice(s, e);
}

function enterReplay(cursorIdx) {
  S.replayMode = true;
  S.replayCursor = clamp(cursorIdx, 0, S.allCandles.length-1);
  S.viewStart = Math.max(0, S.replayCursor - S.viewCount + 20);
  stopPlay();
  updateReplayUI();
  render();
}

function stepReplay(delta) {
  if(!S.replayMode) return;
  S.replayCursor = clamp(S.replayCursor + delta, 0, S.allCandles.length-1);
  // auto-scroll: keep cursor visible with ~20 candle right margin
  var margin = 20;
  var localIdx = S.replayCursor - S.viewStart;
  if(localIdx >= S.viewCount - margin) S.viewStart = S.replayCursor - S.viewCount + margin;
  if(localIdx < 5) S.viewStart = Math.max(0, S.replayCursor - 5);
  S.viewStart = Math.max(0, S.viewStart);
  // check SL/TP hits
  if(S.openPos) checkSLTP();
  updateReplayUI();
  render();
}

function checkSLTP() {
  var pos = S.openPos;
  var c = S.allCandles[S.replayCursor];
  if(!c) return;
  var isLong = pos.side==='long';
  if(pos.sl && ((isLong && c.l<=pos.sl)||(!isLong && c.h>=pos.sl))){
    forceClose(pos.sl, 'SL Hit');
  } else if(pos.tp && ((isLong && c.h>=pos.tp)||(!isLong && c.l<=pos.tp))){
    forceClose(pos.tp, 'TP Hit');
  }
}

function forceClose(exitPrice, reason) {
  var pos = S.openPos;
  var pnl = calcPnl(pos, exitPrice);
  recordTrade(pos, exitPrice, pnl, reason);
  S.openPos = null;
  document.getElementById('open-pos-sec').style.display='none';
  updateStats();
}

function togglePlay() {
  if(S.playing) stopPlay();
  else startPlay();
}

function startPlay() {
  if(!S.replayMode) return;
  S.playing = true;
  document.getElementById('btn-play').textContent='⏸';
  document.getElementById('btn-play').classList.add('active-play');
  function tick(){
    if(!S.playing) return;
    if(S.replayCursor >= S.allCandles.length-1){ stopPlay(); return; }
    stepReplay(1);
    var spd = parseInt(document.getElementById('step-size-select').value)||400;
    S.playTimer = setTimeout(tick, spd);
  }
  tick();
}

function stopPlay() {
  S.playing = false;
  if(S.playTimer){ clearTimeout(S.playTimer); S.playTimer=null; }
  document.getElementById('btn-play').textContent='▶';
  document.getElementById('btn-play').classList.remove('active-play');
}

function updateReplayUI() {
  var c = S.allCandles[S.replayCursor];
  if(c) document.getElementById('replay-cursor-label').textContent = fmtDate(c.t);
  var pct = S.allCandles.length ? S.replayCursor/S.allCandles.length : 0;
  document.getElementById('replay-fill').style.width = (pct*100)+'%';
  document.getElementById('replay-status').textContent = S.replayMode ? '● REPLAY '+fmtDate(c?c.t:0) : '';
}

// SET START button
document.getElementById('btn-set-start').addEventListener('click', function(){
  var val = document.getElementById('replay-date-input').value;
  if(!val||!S.allCandles.length){ alert('Load data first, then pick a date.'); return; }
  var ts = Math.floor(new Date(val).getTime()/1000);
  // find closest candle index
  var idx = 0, best=Infinity;
  for(var i=0;i<S.allCandles.length;i++){
    var d=Math.abs(S.allCandles[i].t-ts);
    if(d<best){ best=d; idx=i; }
  }
  enterReplay(idx);
  document.getElementById('sb-range'); // just trigger
});

document.getElementById('btn-back10').addEventListener('click', function(){ stepReplay(-10); });
document.getElementById('btn-back1').addEventListener('click', function(){ stepReplay(-1); });
document.getElementById('btn-play').addEventListener('click', function(){
  if(!S.replayMode && S.allCandles.length) enterReplay(S.replayCursor);
  togglePlay();
});
document.getElementById('btn-fwd1').addEventListener('click', function(){
  if(!S.replayMode && S.allCandles.length) enterReplay(S.replayCursor);
  stepReplay(1);
});
document.getElementById('btn-fwd10').addEventListener('click', function(){ stepReplay(10); });
document.getElementById('btn-fwd50').addEventListener('click', function(){ stepReplay(50); });
