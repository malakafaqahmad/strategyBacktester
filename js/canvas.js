// ═══════════════════════════════════════════════════════
//  CANVAS
// ═══════════════════════════════════════════════════════
var CC = document.getElementById('chart-canvas');
var OC = document.getElementById('overlay-canvas');
var PAC= document.getElementById('price-axis-canvas');
var VC = document.getElementById('vol-canvas');
var cx=CC.getContext('2d'), ox=OC.getContext('2d'), px=PAC.getContext('2d'), vx=VC.getContext('2d');
var CW=0,CH=0,PAW=70,VAH=72;

function resize(){
  var area=document.getElementById('canvas-area');
  CW=area.clientWidth; CH=area.clientHeight;
  CC.width=OC.width=CW; CC.height=OC.height=CH;
  PAC.width=PAW; PAC.height=CH;
  VC.width=area.clientWidth; VC.height=VAH;
  document.getElementById('price-axis').style.height=CH+'px';
  render();
}
window.addEventListener('resize', resize);

// ═══════════════════════════════════════════════════════
//  COORDINATE HELPERS
// ═══════════════════════════════════════════════════════
function priceRange(candles){
  if(!candles.length) return {mn:0,mx:1};
  var mn=Infinity,mx=-Infinity;
  for(var i=0;i<candles.length;i++){ if(candles[i].l<mn)mn=candles[i].l; if(candles[i].h>mx)mx=candles[i].h; }
  var pad=(mx-mn)*0.08||mx*0.04;
  return {mn:mn-pad,mx:mx+pad};
}
function p2y(p,r){ return CH-(p-r.mn)/(r.mx-r.mn)*CH; }
function y2p(y,r){ return r.mn+(1-y/CH)*(r.mx-r.mn); }
function cxPos(i){ var cw=CW/S.viewCount; return i*cw+cw/2; }
function x2vi(x){ return Math.floor(x/(CW/S.viewCount)); }

// global index → local visible index → x
function gidx2x(gidx, vis){
  var li = gidx - S.viewStart;
  if(li<0||li>=vis.length) return null;
  return cxPos(li);
}
function gidx2x_any(gidx) {
  var li = gidx - S.viewStart;
  var cw = CW / S.viewCount;
  return li * cw + cw / 2;
}

// ═══════════════════════════════════════════════════════
//  MAIN RENDER
// ═══════════════════════════════════════════════════════
function render(){
  if(!S.allCandles.length) return;
  var vis = getVisible();
  var r = priceRange(vis);
  drawCandles(vis,r);
  drawPriceAxis(r);
  drawVolume(vis);
  drawOverlay(vis,r);
  updateTopBar(vis);
  updateStatusBar(vis);
  if(S.openPos){
    var lastC = vis[vis.length-1];
    if(lastC) updateOpenPosUI(lastC.c);
  }
}

function drawCandles(vis,r){
  cx.clearRect(0,0,CW,CH);
  // grid
  cx.strokeStyle='rgba(92,107,192,0.07)'; cx.lineWidth=1;
  for(var i=0;i<=8;i++){ var y=i/8*CH; cx.beginPath();cx.moveTo(0,y);cx.lineTo(CW,y);cx.stroke(); }
  for(var i=0;i<=6;i++){ var x=i/6*CW; cx.beginPath();cx.moveTo(x,0);cx.lineTo(x,CH);cx.stroke(); }

  if (typeof drawIndicators === 'function') {
    drawIndicators(cx, vis, r);
  }
  if (S.strategyResult && S.showEquityCurve && typeof drawEquityCurve === 'function') {
    drawEquityCurve(cx, vis, r);
  }

  var cw=CW/S.viewCount, bw=Math.max(1,cw*0.7);
  for(var i=0;i<vis.length;i++){
    var c=vis[i], x=cxPos(i), up=c.c>=c.o;
    var col=up?'#00e676':'#ff1744';
    var bt=p2y(Math.max(c.o,c.c),r), bb=p2y(Math.min(c.o,c.c),r), bh=Math.max(1,bb-bt);
    cx.strokeStyle=col; cx.lineWidth=1;
    cx.beginPath();cx.moveTo(x,p2y(c.h,r));cx.lineTo(x,p2y(c.l,r));cx.stroke();
    if(bw>=2){
      cx.fillStyle=up?'rgba(0,230,118,0.88)':'rgba(255,23,68,0.88)';
      cx.fillRect(x-bw/2,bt,bw,bh);
    } else {
      cx.strokeStyle=col;cx.beginPath();cx.moveTo(x,bt);cx.lineTo(x,bb);cx.stroke();
    }
  }

  // Time labels
  cx.fillStyle='rgba(74,85,128,0.7)'; cx.font='9px Courier New,monospace'; cx.textAlign='center';
  var every=Math.max(1,Math.floor(vis.length/7));
  for(var i=0;i<vis.length;i+=every){
    cx.fillText(fmtTimeAxis(vis[i].t), cxPos(i), CH-3);
  }

  // Last price dashed line
  if(vis.length){
    var last=vis[vis.length-1];
    var lpy=p2y(last.c,r);
    cx.setLineDash([3,3]); cx.strokeStyle=last.c>=last.o?'rgba(0,230,118,0.4)':'rgba(255,23,68,0.4)';
    cx.lineWidth=1; cx.beginPath();cx.moveTo(0,lpy);cx.lineTo(CW,lpy);cx.stroke();
    cx.setLineDash([]);
  }

  // Replay cursor vertical line
  if(S.replayMode){
    var li = S.replayCursor - S.viewStart;
    if(li>=0&&li<vis.length){
      var rx=cxPos(li);
      cx.strokeStyle='rgba(255,145,0,0.6)'; cx.lineWidth=1; cx.setLineDash([4,4]);
      cx.beginPath();cx.moveTo(rx,0);cx.lineTo(rx,CH);cx.stroke();
      cx.setLineDash([]);
      cx.fillStyle='rgba(255,145,0,0.15)';
      cx.fillRect(rx,0,CW-rx,CH);
    }
  }

  drawDrawingsOnCtx(cx, vis, r, false);
}

function drawPriceAxis(r){
  px.clearRect(0,0,PAW,CH);
  px.fillStyle='#0d1017'; px.fillRect(0,0,PAW,CH);
  px.strokeStyle='rgba(92,107,192,0.2)'; px.lineWidth=1;
  px.beginPath();px.moveTo(0,0);px.lineTo(0,CH);px.stroke();
  px.font='9px Courier New,monospace'; px.textAlign='right'; px.fillStyle='rgba(159,168,218,0.7)';
  for(var i=0;i<=8;i++){
    var price=r.mn+i/8*(r.mx-r.mn), y=p2y(price,r);
    px.fillText(fmtP(price),PAW-3,y+3);
  }
  // current price label
  var src=visibleSource();
  if(src.length){
    var lc=src[src.length-1], ly=p2y(lc.c,r);
    px.fillStyle=lc.c>=lc.o?'#00c853':'#c62828';
    px.fillRect(0,ly-8,PAW,16);
    px.fillStyle='#fff'; px.font='bold 9px Courier New,monospace';
    px.fillText(fmtP(lc.c),PAW-3,ly+3);
  }
}

function drawVolume(vis){
  vx.clearRect(0,0,CW,VAH);
  if(!vis.length) return;
  var maxV=0;
  for(var i=0;i<vis.length;i++) if(vis[i].v>maxV) maxV=vis[i].v;
  if(!maxV) return;
  var cw=CW/S.viewCount, bw=Math.max(1,cw*0.7);
  for(var i=0;i<vis.length;i++){
    var c=vis[i], x=cxPos(i), h=(c.v/maxV)*(VAH-8);
    vx.fillStyle=c.c>=c.o?'rgba(0,230,118,0.3)':'rgba(255,23,68,0.3)';
    vx.fillRect(x-bw/2,VAH-h,bw,h);
  }
  vx.font='8px Courier New,monospace'; vx.fillStyle='rgba(74,85,128,0.6)'; vx.textAlign='left';
  vx.fillText('VOL',3,10);
}

// ═══════════════════════════════════════════════════════
//  OVERLAY (crosshair + drawings in progress + pos lines)
// ═══════════════════════════════════════════════════════
function drawOverlay(vis,r){
  ox.clearRect(0,0,CW,CH);
  var mx=S.mouseX, my=S.mouseY;

  // crosshair
  if(mx>=0&&my>=0){
    ox.strokeStyle='rgba(92,107,192,0.45)'; ox.lineWidth=1; ox.setLineDash([3,3]);
    ox.beginPath();ox.moveTo(mx,0);ox.lineTo(mx,CH);ox.stroke();
    ox.beginPath();ox.moveTo(0,my);ox.lineTo(CW,my);ox.stroke();
    ox.setLineDash([]);
    var hp=y2p(my,r);
    ox.fillStyle='rgba(20,24,32,0.92)'; ox.fillRect(1,my-9,65,18);
    ox.fillStyle='#00d4ff'; ox.font='9px Courier New,monospace'; ox.textAlign='right';
    ox.fillText(fmtP(hp),64,my+4);
    // OHLCV
    var vi2=x2vi(mx);
    if(vi2>=0&&vi2<vis.length){
      var c=vis[vi2];
      document.getElementById('ci-o').textContent=fmtP(c.o);
      document.getElementById('ci-h').textContent=fmtP(c.h);
      document.getElementById('ci-l').textContent=fmtP(c.l);
      document.getElementById('ci-c').textContent=fmtP(c.c);
      document.getElementById('ci-v').textContent=c.v.toFixed(2);
      document.getElementById('ci-date').textContent=fmtDate(c.t);
    }
  }

  // drawing overlay (wip)
  drawDrawingsOnCtx(ox,vis,r,true);
  drawWIP(ox,vis,r);

  // open position lines
  if(S.openPos) drawPositionLines(ox,r);
}

function drawPositionLines(c,r){
  var pos=S.openPos;
  var ey=p2y(pos.entry,r);
  var isL=pos.side==='long';
  hline(c,ey,'#00d4ff','ENTRY '+fmtP(pos.entry));
  if(pos.sl){
    var sy=p2y(pos.sl,r);
    hline(c,sy,'#ff1744','SL '+fmtP(pos.sl));
    c.fillStyle=isL?'rgba(255,23,68,0.04)':'rgba(255,23,68,0.04)';
    if(isL) c.fillRect(0,sy,CW,ey-sy); else c.fillRect(0,ey,CW,sy-ey);
  }
  if(pos.tp){
    var ty=p2y(pos.tp,r);
    hline(c,ty,'#00e676','TP '+fmtP(pos.tp));
    c.fillStyle='rgba(0,230,118,0.04)';
    if(isL) c.fillRect(0,ty,CW,ey-ty); else c.fillRect(0,ey,CW,ty-ey);
  }
}

function hline(c,y,col,label){
  c.strokeStyle=col; c.lineWidth=1; c.setLineDash([5,3]);
  c.beginPath();c.moveTo(0,y);c.lineTo(CW,y);c.stroke(); c.setLineDash([]);
  c.fillStyle=col+'28'; c.fillRect(CW-110,y-10,110,20);
  c.fillStyle=col; c.font='bold 9px Courier New,monospace'; c.textAlign='right';
  c.fillText(label,CW-3,y+4);
}
