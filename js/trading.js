// ═══════════════════════════════════════════════════════
//  TRADING PANEL
// ═══════════════════════════════════════════════════════
document.getElementById('side-long').addEventListener('click',function(){
  S.side='long';
  document.getElementById('side-long').classList.add('active');
  document.getElementById('side-short').classList.remove('active');
  document.getElementById('exec-btn').textContent='⬆ OPEN LONG';
  document.getElementById('exec-btn').className='exec-btn long-btn';
});
document.getElementById('side-short').addEventListener('click',function(){
  S.side='short';
  document.getElementById('side-short').classList.add('active');
  document.getElementById('side-long').classList.remove('active');
  document.getElementById('exec-btn').textContent='⬇ OPEN SHORT';
  document.getElementById('exec-btn').className='exec-btn short-btn';
});

document.getElementById('exec-btn').addEventListener('click',function(){
  if(S.openPos){alert('Close current position first.');return;}
  var src=visibleSource(), last=src[src.length-1];
  if(!last){alert('Load data first.');return;}
  var entry=parseFloat(document.getElementById('f-entry').value)||last.c;
  var sl=parseFloat(document.getElementById('f-sl').value)||null;
  var tp=parseFloat(document.getElementById('f-tp').value)||null;
  var size=parseFloat(document.getElementById('f-size').value)||1000;
  doOpenTrade(S.side,entry,sl,tp,size);
});

function doOpenTrade(side,entry,sl,tp,size){
  if(S.openPos){alert('Already in a position.');return;}
  sl=sl||parseFloat(document.getElementById('f-sl').value)||null;
  tp=tp||parseFloat(document.getElementById('f-tp').value)||null;
  size=size||parseFloat(document.getElementById('f-size').value)||1000;
  S.openPos={side:side,entry:entry,sl:sl,tp:tp,size:size};
  document.getElementById('open-pos-sec').style.display='block';
  document.getElementById('ps-side').textContent=side.toUpperCase();
  document.getElementById('ps-side').className='sval '+(side==='long'?'pos':'neg');
  document.getElementById('ps-entry').textContent=fmtP(entry);
  document.getElementById('ps-sl').textContent=sl?fmtP(sl):'—';
  document.getElementById('ps-tp').textContent=tp?fmtP(tp):'—';
  render();
}

function updateOpenPosUI(curPrice){
  var pos=S.openPos; if(!pos) return;
  var pnl=calcPnl(pos,curPrice);
  document.getElementById('ps-cur').textContent=fmtP(curPrice);
  document.getElementById('ps-pnl').textContent=(pnl>=0?'+':'')+'$'+pnl.toFixed(2);
  document.getElementById('ps-pnl').className='sval '+(pnl>=0?'pos':'neg');
}

document.getElementById('btn-close-pos').addEventListener('click',function(){
  if(!S.openPos) return;
  var src=visibleSource(), last=src[src.length-1];
  if(!last) return;
  forceClose(last.c,'Manual Close');
});

function calcPnl(pos,cur){ return (pos.side==='long'?1:-1)*(cur-pos.entry)/pos.entry*pos.size; }

function recordTrade(pos,exit,pnl,reason){
  S.trades.push({side:pos.side,entry:pos.entry,exit:exit,pnl:pnl,size:pos.size,reason:reason,t:Date.now()/1000});
  S.sessionPnl+=pnl;
  if(pnl>=0){S.wins++;S.grossWin+=pnl;if(S.bestTrade===null||pnl>S.bestTrade)S.bestTrade=pnl;}
  else{S.losses++;S.grossLoss+=Math.abs(pnl);if(S.worstTrade===null||pnl<S.worstTrade)S.worstTrade=pnl;}
  addTradeLog(pos.side,pos.entry,exit,pnl,reason);
}

function updateStats(){
  var total=S.wins+S.losses;
  var pnl=S.sessionPnl;
  document.getElementById('st-pnl').textContent=(pnl>=0?'+':'')+'$'+pnl.toFixed(2);
  document.getElementById('st-pnl').className='sval '+(pnl>=0?'pos':'neg');
  document.getElementById('st-wr').textContent=total?(S.wins/total*100).toFixed(0)+'%':'—';
  document.getElementById('st-trades').textContent=total;
  document.getElementById('st-best').textContent=S.bestTrade!==null?'+$'+S.bestTrade.toFixed(2):'—';
  document.getElementById('st-worst').textContent=S.worstTrade!==null?'$'+S.worstTrade.toFixed(2):'—';
  var pf=S.grossLoss>0?(S.grossWin/S.grossLoss).toFixed(2):S.grossWin>0?'∞':'—';
  document.getElementById('st-pf').textContent=pf;
}

function addTradeLog(side,entry,exit,pnl,reason){
  var log=document.getElementById('trade-log');
  var d=document.createElement('div');
  d.className='trade-item';
  d.innerHTML='<div class="tbadge '+side+'">'+side.toUpperCase()+'</div>'+
    '<div style="flex:1"><div style="color:var(--text1)">'+fmtP(entry)+' → '+fmtP(exit)+'</div>'+
    '<div style="color:var(--text2);font-size:9px">'+reason+'</div></div>'+
    '<div class="tpnl '+(pnl>=0?'pos':'neg')+'">'+(pnl>=0?'+':'')+'$'+pnl.toFixed(2)+'</div>';
  log.prepend(d);
  updateStats();
}
