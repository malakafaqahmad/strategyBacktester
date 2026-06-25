// ═══════════════════════════════════════════════════════
//  MOUSE / KEYBOARD
// ═══════════════════════════════════════════════════════
OC.addEventListener('mousemove', function(e){
  var rect=OC.getBoundingClientRect();
  S.mouseX=e.clientX-rect.left; S.mouseY=e.clientY-rect.top;
  
  if (S.dragTarget) {
    var vis = getVisible(), r = priceRange(vis);
    var mousePrice = y2p(S.mouseY, r);
    var startPrice = y2p(S.dragStartY, r);
    var priceDiff = mousePrice - startPrice;
    
    var currentVi = x2vi(S.mouseX) + S.viewStart;
    var startVi = x2vi(S.dragStartX) + S.viewStart;
    var gidxDiff = currentVi - startVi;
    
    var d = S.dragTarget;
    if (d.type === 'long_pos' || d.type === 'short_pos') {
      if (S.dragPart === 'tp') {
        d.tp = mousePrice;
      } else if (S.dragPart === 'sl') {
        d.sl = mousePrice;
      } else if (S.dragPart === 'width') {
        d.width = Math.max(5, S.dragStartWidth + gidxDiff);
      } else if (S.dragPart === 'entry') {
        d.entry = mousePrice;
        var tpOffset = S.dragStartTp - S.dragStartEntry;
        var slOffset = S.dragStartSl - S.dragStartEntry;
        d.tp = d.entry + tpOffset;
        d.sl = d.entry + slOffset;
      } else if (S.dragPart === 'move') {
        d.entry = S.dragStartEntry + priceDiff;
        d.tp = S.dragStartTp + priceDiff;
        d.sl = S.dragStartSl + priceDiff;
        d.gidx = Math.max(0, S.dragStartGidx + gidxDiff);
      }
    } else if (d.type === 'hline') {
      d.price = mousePrice;
    }
    render();
    return;
  }

  if(S.dragging){
    var dx=S.mouseX-S.dragX0, cw2=CW/S.viewCount, shift=-Math.round(dx/cw2);
    S.viewStart=clampVS(S.dragVS0+shift);
  }

  // hover drawings
  S.hoverDraw=null;
  S.hoverPart=null;
  var vis=getVisible(),r=priceRange(vis);
  for(var i=S.drawings.length-1;i>=0;i--){
    var d = S.drawings[i];
    if (d.type === 'long_pos' || d.type === 'short_pos') {
      var part = getPositionPart(d, S.mouseX, S.mouseY, vis, r);
      if (part) {
        S.hoverDraw = d;
        S.hoverPart = part;
        break;
      }
    } else {
      if(nearDraw(d,S.mouseX,S.mouseY,vis,r)){
        S.hoverDraw=d;
        break;
      }
    }
  }

  // Handle visual cursor modes
  if (S.activeTool === 'cursor') {
    if (S.hoverPart === 'tp' || S.hoverPart === 'sl') {
      OC.style.cursor = 'ns-resize';
    } else if (S.hoverPart === 'width') {
      OC.style.cursor = 'ew-resize';
    } else if (S.hoverPart === 'entry' || S.hoverPart === 'move') {
      OC.style.cursor = 'move';
    } else if (S.hoverDraw) {
      OC.style.cursor = 'pointer';
    } else {
      OC.style.cursor = 'crosshair';
    }
  }

  render();
});

OC.addEventListener('mousedown', function(e){
  if(e.button!==0) return;
  var vis=getVisible(),r=priceRange(vis);
  var vi=x2vi(S.mouseX)+S.viewStart;
  var price=y2p(S.mouseY,r);
  var tool=S.activeTool;
  
  if(tool==='cursor'){
    if (S.hoverDraw) {
      S.dragTarget = S.hoverDraw;
      S.dragPart = S.hoverPart || 'move';
      S.dragStartX = S.mouseX;
      S.dragStartY = S.mouseY;
      S.dragStartEntry = S.hoverDraw.entry;
      S.dragStartTp = S.hoverDraw.tp;
      S.dragStartSl = S.hoverDraw.sl;
      S.dragStartGidx = S.hoverDraw.gidx;
      S.dragStartWidth = S.hoverDraw.width;
      return;
    }
    S.dragging=true; S.dragX0=S.mouseX; S.dragVS0=S.viewStart;
    OC.style.cursor='grabbing'; return;
  }
  if(tool==='hline'){ S.drawings.push({type:'hline',price:price,col:'#00d4ff'}); activateTool('cursor'); render(); return; }
  if(tool==='vline'){ S.drawings.push({type:'vline',gidx:vi,col:'#00d4ff'}); activateTool('cursor'); render(); return; }
  if(tool==='long'){
    S.drawings.push({
      type: 'long_pos',
      gidx: vi,
      entry: price,
      tp: price * 1.02,
      sl: price * 0.99,
      width: 25
    });
    activateTool('cursor');
    render();
    return;
  }
  if(tool==='short'){
    S.drawings.push({
      type: 'short_pos',
      gidx: vi,
      entry: price,
      tp: price * 0.98,
      sl: price * 1.01,
      width: 25
    });
    activateTool('cursor');
    render();
    return;
  }
  if(['tline','ray','rect','fib','measure'].indexOf(tool)>=0){
    if(!S.wip){ S.wip={type:tool,i1:vi,p1:price}; }
    else {
      S.drawings.push({type:S.wip.type,i1:S.wip.i1,p1:S.wip.p1,i2:vi,p2:price,col:'#00d4ff'});
      S.wip=null;
      activateTool('cursor');
    }
    render(); return;
  }
});

OC.addEventListener('mouseup', function(e){
  if(e.button!==0) return;
  S.dragging=false;
  S.dragTarget = null;
  S.dragPart = null;
  OC.style.cursor='crosshair';
});
OC.addEventListener('mouseleave', function(){ S.mouseX=-1;S.mouseY=-1; S.dragTarget=null; S.dragPart=null; render(); });

OC.addEventListener('wheel', function(e){
  e.preventDefault();
  var factor=e.deltaY>0?1.12:0.88;
  S.viewCount=Math.round(clamp(S.viewCount*factor,8,Math.min(2000,S.allCandles.length||2000)));
  S.viewStart=clampVS(S.viewStart);
  render();
},{passive:false});

OC.addEventListener('contextmenu', function(e){
  e.preventDefault();
  var vis=getVisible(),r=priceRange(vis);
  S.ctxPrice=y2p(S.mouseY,r);
  S.ctxCandle=vis[x2vi(S.mouseX)];
  var del=document.getElementById('ctx-del');
  del.style.display=S.hoverDraw?'block':'none';
  var m=document.getElementById('ctx-menu');
  m.style.left=e.clientX+'px'; m.style.top=e.clientY+'px'; m.style.display='block';
});
document.addEventListener('click',function(){ document.getElementById('ctx-menu').style.display='none'; });

document.getElementById('ctx-long').addEventListener('click',function(){ if(S.ctxCandle) doOpenTrade('long',S.ctxCandle.c); });
document.getElementById('ctx-short').addEventListener('click',function(){ if(S.ctxCandle) doOpenTrade('short',S.ctxCandle.c); });
document.getElementById('ctx-hline').addEventListener('click',function(){ S.drawings.push({type:'hline',price:S.ctxPrice,col:'#00d4ff'}); render(); });
document.getElementById('ctx-del').addEventListener('click',function(){ if(S.hoverDraw){S.drawings=S.drawings.filter(function(d){return d!==S.hoverDraw;});S.hoverDraw=null;render();} });
document.getElementById('ctx-clear-all').addEventListener('click',function(){ S.drawings=[];S.wip=null;render(); });

// KEYBOARD
document.addEventListener('keydown',function(e){
  if(['INPUT','TEXTAREA','SELECT'].indexOf(e.target.tagName)>=0) return;
  if(e.key==='Escape'){ S.wip=null; render(); }
  if(e.key==='Delete'&&S.hoverDraw){ S.drawings=S.drawings.filter(function(d){return d!==S.hoverDraw;}); S.hoverDraw=null; render(); }
  if(e.key==='ArrowRight'){ if(S.replayMode) stepReplay(1); else { S.viewStart=clampVS(S.viewStart+5); render(); } }
  if(e.key==='ArrowLeft'){ if(S.replayMode) stepReplay(-1); else { S.viewStart=clampVS(S.viewStart-5); render(); } }
  if(e.key==='ArrowRight'&&e.shiftKey){ stepReplay(10); }
  if(e.key===' '){ e.preventDefault(); if(S.replayMode) togglePlay(); }
  if(e.key==='+'||e.key==='='){ S.viewCount=Math.max(8,S.viewCount-10); render(); }
  if(e.key==='-'){ S.viewCount=Math.min(2000,S.viewCount+10); render(); }
  var tmap={v:'cursor',h:'hline',t:'tline',r:'rect',f:'fib',m:'measure',l:'long',s:'short'};
  if(tmap[e.key]&&!e.ctrlKey&&!e.metaKey){ activateTool(tmap[e.key]); }
});

// ═══════════════════════════════════════════════════════
//  TOOL BUTTONS
// ═══════════════════════════════════════════════════════
document.querySelectorAll('.tool-btn[data-tool]').forEach(function(btn){
  btn.addEventListener('click',function(){ activateTool(btn.dataset.tool); });
});
document.getElementById('btn-clear-draws').addEventListener('click',function(){ S.drawings=[];S.wip=null;render(); });

function activateTool(name){
  S.activeTool=name; S.wip=null;
  document.querySelectorAll('.tool-btn').forEach(function(b){ b.classList.remove('active'); });
  var tb=document.querySelector('.tool-btn[data-tool="'+name+'"]');
  if(tb) tb.classList.add('active');
}

// ═══════════════════════════════════════════════════════
//  TIMEFRAME BUTTONS
// ═══════════════════════════════════════════════════════
document.querySelectorAll('.tf-btn').forEach(function(btn){
  btn.addEventListener('click',function(){
    document.querySelectorAll('.tf-btn').forEach(function(b){b.classList.remove('active');});
    btn.classList.add('active');
    S.tf=parseInt(btn.dataset.tf);
    if(S.rawMin.length){ buildTF(); S.replayCursor=Math.min(S.replayCursor,S.allCandles.length-1); S.viewStart=clampVS(S.viewStart); }
    document.getElementById('sb-tf').textContent=btn.textContent;
    render();
  });
});

// ═══════════════════════════════════════════════════════
//  DOUBLE CLICK & EDIT MODAL
// ═══════════════════════════════════════════════════════
OC.addEventListener('dblclick', function(e){
  var vis=getVisible(), r=priceRange(vis);
  var clickedDraw = null;
  for(var i=S.drawings.length-1;i>=0;i--){
    var d = S.drawings[i];
    if (d.type === 'long_pos' || d.type === 'short_pos') {
      if (getPositionPart(d, S.mouseX, S.mouseY, vis, r)) {
        clickedDraw = d;
        break;
      }
    } else {
      if (nearDraw(d, S.mouseX, S.mouseY, vis, r)) {
        clickedDraw = d;
        break;
      }
    }
  }
  if (clickedDraw) {
    openEditModal(clickedDraw);
  }
});

function openEditModal(d) {
  S.editingDrawing = d;
  var modal = document.getElementById('edit-modal');
  var entryRow = document.getElementById('em-entry-row');
  var tpRow = document.getElementById('em-tp-row');
  var slRow = document.getElementById('em-sl-row');
  var priceRow = document.getElementById('em-price-row');
  var title = document.getElementById('em-title');

  if (d.type === 'long_pos' || d.type === 'short_pos') {
    entryRow.style.display = 'block';
    tpRow.style.display = 'block';
    slRow.style.display = 'block';
    priceRow.style.display = 'none';
    title.textContent = d.type === 'long_pos' ? 'Edit Long Position' : 'Edit Short Position';
    document.getElementById('em-entry').value = d.entry.toFixed(2);
    document.getElementById('em-tp').value = d.tp.toFixed(2);
    document.getElementById('em-sl').value = d.sl.toFixed(2);
  } else if (d.type === 'hline') {
    entryRow.style.display = 'none';
    tpRow.style.display = 'none';
    slRow.style.display = 'none';
    priceRow.style.display = 'block';
    title.textContent = 'Edit Horizontal Line';
    document.getElementById('em-price').value = d.price.toFixed(2);
  } else {
    S.editingDrawing = null;
    return;
  }
  modal.style.display = 'flex';
}

document.getElementById('em-cancel').addEventListener('click', function(){
  document.getElementById('edit-modal').style.display = 'none';
  S.editingDrawing = null;
});

document.getElementById('em-save').addEventListener('click', function(){
  var d = S.editingDrawing;
  if (!d) return;

  if (d.type === 'long_pos' || d.type === 'short_pos') {
    d.entry = parseFloat(document.getElementById('em-entry').value) || d.entry;
    d.tp = parseFloat(document.getElementById('em-tp').value) || d.tp;
    d.sl = parseFloat(document.getElementById('em-sl').value) || d.sl;
  } else if (d.type === 'hline') {
    d.price = parseFloat(document.getElementById('em-price').value) || d.price;
  }

  document.getElementById('edit-modal').style.display = 'none';
  S.editingDrawing = null;
  render();
});
