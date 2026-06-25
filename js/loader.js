// ═══════════════════════════════════════════════════════
//  CSV / DEMO LOAD
// ═══════════════════════════════════════════════════════
var dropZone = document.getElementById('csv-drop');
var fileInput = document.getElementById('file-input');
dropZone.addEventListener('click', function(){ fileInput.click(); });
dropZone.addEventListener('dragover', function(e){ e.preventDefault(); dropZone.classList.add('drag-over'); });
dropZone.addEventListener('dragleave', function(){ dropZone.classList.remove('drag-over'); });
dropZone.addEventListener('drop', function(e){ e.preventDefault(); dropZone.classList.remove('drag-over'); var f=e.dataTransfer.files[0]; if(f) loadFile(f); });
fileInput.addEventListener('change', function(e){ if(e.target.files[0]) loadFile(e.target.files[0]); });
document.getElementById('demo-btn').addEventListener('click', loadDemo);

function setLP(txt, pct) {
  var el = document.getElementById('load-progress');
  el.style.display = 'block';
  document.getElementById('lp-text').textContent = txt;
  document.getElementById('lp-fill').style.width = (pct*100)+'%';
}

function loadFile(file) {
  setLP('Reading file…', 0.05);
  var r = new FileReader();
  r.onload = function(e){ setLP('Parsing…', 0.2); setTimeout(function(){ parseCSV(e.target.result); }, 20); };
  r.readAsText(file);
}

function parseCSV(text) {
  var lines = text.split('\n');
  var hdr = lines[0].toLowerCase().replace(/\r/g,'').split(',');
  var ti = hdr.findIndex(function(h){ return h.includes('timestamp')||h==='unix'; });
  var oi = hdr.findIndex(function(h){ return h.startsWith('open'); });
  var hi = hdr.findIndex(function(h){ return h.startsWith('high'); });
  var li = hdr.findIndex(function(h){ return h.startsWith('low'); });
  var ci = hdr.findIndex(function(h){ return h.startsWith('close'); });
  var vi = hdr.findIndex(function(h){ return h.includes('volume'); });
  if(ti<0||oi<0||ci<0){ alert('Cannot find expected columns (Timestamp, Open, High, Low, Close, Volume_BTC).'); return; }
  var out=[], total=lines.length, step=Math.max(1,Math.floor(total/20));
  for(var i=1;i<total;i++){
    var row=lines[i].replace(/\r/g,'').split(',');
    if(row.length<5) continue;
    var t=parseFloat(row[ti]),o=parseFloat(row[oi]),h=parseFloat(row[hi]),l=parseFloat(row[li]),c=parseFloat(row[ci]),v=vi>=0?parseFloat(row[vi]):0;
    if(!isFinite(t)||!isFinite(o)||!isFinite(c)||o<=0) continue;
    out.push({t:t,o:o,h:isFinite(h)?h:Math.max(o,c),l:isFinite(l)?l:Math.min(o,c),c:c,v:isFinite(v)?v:0});
    if(i%step===0) setLP('Parsed '+Math.round(i/total*100)+'%…', 0.2+i/total*0.7);
  }
  out.sort(function(a,b){ return a.t-b.t; });
  setLP('Done — '+out.length+' candles', 1);
  setTimeout(function(){ finishLoad(out); }, 300);
}

function loadDemo() {
  setLP('Generating demo…', 0.1);
  setTimeout(function(){
    var out=[], price=30000, t=Math.floor(Date.now()/1000)-5000*60;
    for(var i=0;i<5000;i++){
      var o=price, move=(Math.random()-0.48)*price*0.003;
      price=Math.max(500,price+move);
      var hi2=Math.max(o,price)+Math.random()*price*0.001;
      var lo=Math.min(o,price)-Math.random()*price*0.001;
      out.push({t:t,o:o,h:hi2,l:lo,c:price,v:Math.random()*80+5});
      t+=60;
    }
    setLP('Done — 5000 candles',1);
    setTimeout(function(){ finishLoad(out); },200);
  },30);
}

function finishLoad(raw) {
  S.rawMin = raw;
  buildTF();
  // default replay cursor = 20% into data so there's room to go back
  S.replayCursor = Math.max(50, Math.floor(S.allCandles.length*0.2));
  S.replayMode = false;
  S.viewStart = Math.max(0, S.allCandles.length - S.viewCount);
  // populate date input with last candle date
  if(S.allCandles.length){
    var d = new Date(S.allCandles[S.allCandles.length-1].t*1000);
    document.getElementById('replay-date-input').value = toDatetimeLocal(d);
  }
  document.getElementById('csv-overlay').style.display='none';
  document.getElementById('replay-bar').classList.remove('disabled');
  resize();
  render();
}
