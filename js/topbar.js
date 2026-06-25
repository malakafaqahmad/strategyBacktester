// ═══════════════════════════════════════════════════════
//  TOP BAR + STATUS
// ═══════════════════════════════════════════════════════
function updateTopBar(vis){
  if(!vis.length) return;
  var last=vis[vis.length-1], prev=vis[vis.length-2];
  document.getElementById('cur-price').textContent=fmtP(last.c);
  if(prev){
    var pct=((last.c-prev.c)/prev.c*100).toFixed(2);
    var el=document.getElementById('cur-chg');
    el.textContent=(pct>=0?'+':'')+pct+'%';
    el.className=pct>=0?'up':'dn';
    el.style.background=pct>=0?'rgba(0,230,118,0.15)':'rgba(255,23,68,0.15)';
    el.style.color=pct>=0?'var(--green)':'var(--red)';
    el.style.padding='2px 5px'; el.style.borderRadius='3px';
  }
}

function updateStatusBar(vis){
  if(vis.length){
    document.getElementById('sb-range').textContent=fmtDate(vis[0].t)+' – '+fmtDate(vis[vis.length-1].t);
    document.getElementById('sb-count').textContent=vis.length+' candles shown';
  }
  updateReplayUI();
}
