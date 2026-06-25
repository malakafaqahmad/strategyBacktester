// ═══════════════════════════════════════════════════════
//  DRAWINGS
// ═══════════════════════════════════════════════════════
function drawDrawingsOnCtx(c,vis,r,isOverlay){
  for(var i=0;i<S.drawings.length;i++){
    var d=S.drawings[i], hover=(d===S.hoverDraw);
    c.save();
    c.strokeStyle=hover?'#fff':(d.col||'#00d4ff');
    c.fillStyle=d.col||'#00d4ff';
    c.lineWidth=hover?2:1;
    c.font='9px Courier New,monospace';
    c.setLineDash([]);

    if(d.type==='hline'){
      var y=p2y(d.price,r);
      c.beginPath();c.moveTo(0,y);c.lineTo(CW,y);c.stroke();
      c.fillText(fmtP(d.price),4,y-2);
    } else if(d.type==='vline'){
      var x=gidx2x(d.gidx,vis);
      if(x!==null){c.beginPath();c.moveTo(x,0);c.lineTo(x,CH);c.stroke();}
    } else if(d.type==='tline'||d.type==='ray'){
      var x1=gidx2x(d.i1,vis),x2=gidx2x(d.i2,vis);
      var y1=p2y(d.p1,r),y2=p2y(d.p2,r);
      if(x1===null) {c.restore();continue;}
      var ex2=x2!==null?x2:CW;
      var slope=x1!==ex2?(y2-y1)/(ex2-x1):0;
      c.beginPath();
      if(d.type==='ray'){c.moveTo(x1,y1);c.lineTo(CW,y1+slope*(CW-x1));}
      else {c.moveTo(x1,y1);c.lineTo(ex2,y2);}
      c.stroke();
    } else if(d.type==='rect'){
      var x1=gidx2x(d.i1,vis),x2=gidx2x(d.i2,vis);
      var y1=p2y(d.p1,r),y2=p2y(d.p2,r);
      if(x1!==null&&x2!==null){
        var rx=Math.min(x1,x2),ry=Math.min(y1,y2),rw=Math.abs(x2-x1),rh=Math.abs(y2-y1);
        c.fillStyle=(d.col||'#00d4ff')+'16';c.fillRect(rx,ry,rw,rh);
        c.strokeRect(rx,ry,rw,rh);
      }
    } else if(d.type==='fib'){
      var y1=p2y(d.p1,r),y2=p2y(d.p2,r);
      var levels=[0,0.236,0.382,0.5,0.618,0.786,1];
      var cols2=['#ff5252','#ff9100','#ffd740','#69f0ae','#40c4ff','#e040fb','#ff5252'];
      for(var fi=0;fi<levels.length;fi++){
        var fy=y1+(y2-y1)*levels[fi];
        c.strokeStyle=cols2[fi]+'aa'; c.lineWidth=1;
        c.beginPath();c.moveTo(0,fy);c.lineTo(CW,fy);c.stroke();
        c.fillStyle=cols2[fi]; c.font='8px Courier New,monospace';
        c.fillText((levels[fi]*100).toFixed(1)+'%  '+fmtP(y2p(fy,r)),4,fy-2);
      }
    } else if(d.type==='measure'){
      var x1=gidx2x(d.i1,vis),x2=gidx2x(d.i2,vis);
      var y1=p2y(d.p1,r),y2=p2y(d.p2,r);
      if(x1!==null&&x2!==null){
        c.strokeStyle='#ffd740aa'; c.setLineDash([3,3]);
        c.strokeRect(Math.min(x1,x2),Math.min(y1,y2),Math.abs(x2-x1),Math.abs(y2-y1));
        c.setLineDash([]);
        var pct=((d.p2-d.p1)/d.p1*100).toFixed(2), bars=Math.abs(d.i2-d.i1);
        c.fillStyle='#ffd740'; c.font='9px Courier New,monospace'; c.textAlign='center';
        c.fillText(pct+'%  '+bars+' bars',(x1+x2)/2,Math.min(y1,y2)-3);
      }
    } else if(d.type==='long_pos'||d.type==='short_pos'){
      var x1=gidx2x_any(d.gidx);
      var x2=gidx2x_any(d.gidx + d.width);
      var yEntry=p2y(d.entry,r);
      var yTp=p2y(d.tp,r);
      var ySl=p2y(d.sl,r);
      var isL=(d.type==='long_pos');

      // Shaded Regions
      c.fillStyle=isL?'rgba(8, 153, 129, 0.16)':'rgba(242, 54, 69, 0.16)'; // TP region
      c.fillRect(Math.min(x1,x2), Math.min(yEntry,yTp), Math.abs(x2-x1), Math.abs(yTp-yEntry));
      c.fillStyle=isL?'rgba(242, 54, 69, 0.16)':'rgba(8, 153, 129, 0.16)'; // SL region
      c.fillRect(Math.min(x1,x2), Math.min(yEntry,ySl), Math.abs(x2-x1), Math.abs(ySl-yEntry));

      // Key boundary lines
      c.strokeStyle='#089981'; c.lineWidth=isL?1.5:1; c.beginPath(); c.moveTo(x1,yTp); c.lineTo(x2,yTp); c.stroke(); // Green Target
      c.strokeStyle='#f23645'; c.lineWidth=isL?1:1.5; c.beginPath(); c.moveTo(x1,ySl); c.lineTo(x2,ySl); c.stroke(); // Red Stop
      c.strokeStyle='#00d4ff'; c.lineWidth=1.5; c.beginPath(); c.moveTo(x1,yEntry); c.lineTo(x2,yEntry); c.stroke(); // Entry blue

      // Side vertical lines
      c.strokeStyle='rgba(255,255,255,0.15)'; c.lineWidth=1;
      c.beginPath(); c.moveTo(x1,yTp); c.lineTo(x1,ySl); c.stroke();
      c.beginPath(); c.moveTo(x2,yTp); c.lineTo(x2,ySl); c.stroke();

      // Stats calculations
      var targetPct=0, stopPct=0;
      if(isL){
        targetPct=((d.tp-d.entry)/d.entry*100);
        stopPct=((d.entry-d.sl)/d.entry*100);
      } else {
        targetPct=((d.entry-d.tp)/d.entry*100);
        stopPct=((d.sl-d.entry)/d.entry*100);
      }
      var rrRatio=stopPct>0?(targetPct/stopPct):0;

      // Stats Badge Overlay (centered, sticky within screen limits)
      var xMid=(x1+x2)/2;
      var xBadge=clamp(xMid, 70, CW-70);
      var yBadge=clamp(yEntry, 25, CH-25);

      c.fillStyle='rgba(13,16,23,0.92)';
      c.strokeStyle=hover?'#fff':'rgba(159,168,218,0.25)';
      c.lineWidth=1;
      c.beginPath();
      var bx=xBadge-65, by=yBadge-22, bw=130, bh=44, br=4;
      if(c.roundRect) c.roundRect(bx,by,bw,bh,br); else c.rect(bx,by,bw,bh);
      c.fill(); c.stroke();

      c.fillStyle='#fff'; c.font='bold 9px Courier New,monospace'; c.textAlign='center';
      c.fillText('Risk/Reward: '+rrRatio.toFixed(2), xBadge, yBadge-10);
      c.fillStyle='#00e676';
      c.fillText('Target: +'+targetPct.toFixed(2)+'%', xBadge, yBadge+2);
      c.fillStyle='#ff1744';
      c.fillText('Stop: -'+stopPct.toFixed(2)+'%', xBadge, yBadge+14);

      // Drag handles (only shown when hovered/selected)
      if(hover){
        drawHandle(c, xMid, yTp);
        drawHandle(c, xMid, ySl);
        drawHandle(c, xMid, yEntry);
        drawHandle(c, x2, (yTp+ySl)/2);
      }
    }
    c.restore();
  }
}

function drawHandle(ctx, x, y) {
  ctx.save();
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = '#1b2030';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x, y, 4, 0, 2*Math.PI);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawWIP(c,vis,r){
  var d=S.wip; if(!d) return;
  var mx=S.mouseX,my=S.mouseY;
  c.strokeStyle='#00d4ff'; c.lineWidth=1; c.setLineDash([4,4]);
  if(d.type==='tline'||d.type==='ray'){
    var x1=gidx2x(d.i1,vis), y1=p2y(d.p1,r);
    if(x1!==null){c.beginPath();c.moveTo(x1,y1);c.lineTo(mx,my);c.stroke();}
  } else if(d.type==='rect'||d.type==='fib'||d.type==='measure'){
    var x1=gidx2x(d.i1,vis), y1=p2y(d.p1,r);
    if(x1!==null){
      c.fillStyle='#00d4ff10';
      c.fillRect(Math.min(x1,mx),Math.min(y1,my),Math.abs(mx-x1),Math.abs(my-y1));
      c.strokeRect(Math.min(x1,mx),Math.min(y1,my),Math.abs(mx-x1),Math.abs(my-y1));
    }
  }
  c.setLineDash([]);
}

// ═══════════════════════════════════════════════════════
//  DRAWING HIT TEST
// ═══════════════════════════════════════════════════════
function getPositionPart(d, mx, my, vis, r) {
  var x1=gidx2x_any(d.gidx);
  var x2=gidx2x_any(d.gidx + d.width);
  var yEntry=p2y(d.entry,r);
  var yTp=p2y(d.tp,r);
  var ySl=p2y(d.sl,r);
  var T=8; // mouse hover tolerance in pixels

  var insideX = (mx>=Math.min(x1,x2)-T && mx<=Math.max(x1,x2)+T);
  var insideY = (my>=Math.min(yTp,ySl)-T && my<=Math.max(yTp,ySl)+T);

  if(insideX){
    if(Math.abs(my-yTp)<T) return 'tp';
    if(Math.abs(my-ySl)<T) return 'sl';
    if(Math.abs(my-yEntry)<T) return 'entry';
    if(Math.abs(mx-x2)<T && insideY) return 'width';

    if(mx>=Math.min(x1,x2) && mx<=Math.max(x1,x2) && my>=Math.min(yTp,ySl) && my<=Math.max(yTp,ySl)){
      return 'move';
    }
  }
  return null;
}

function nearDraw(d,mx,my,vis,r){
  var T=9;
  if(d.type==='hline') return Math.abs(my-p2y(d.price,r))<T;
  if(d.type==='tline'||d.type==='ray'){
    var x1=gidx2x(d.i1,vis),x2=gidx2x(d.i2,vis),y1=p2y(d.p1,r),y2=p2y(d.p2,r);
    if(x1===null) return false;
    return seg_dist(mx,my,x1,y1,x2!==null?x2:CW,y2)<T;
  }
  if(d.type==='rect'){
    var x1=gidx2x(d.i1,vis),x2=gidx2x(d.i2,vis),y1=p2y(d.p1,r),y2=p2y(d.p2,r);
    if(x1===null||x2===null) return false;
    return mx>=Math.min(x1,x2)-T&&mx<=Math.max(x1,x2)+T&&my>=Math.min(y1,y2)-T&&my<=Math.max(y1,y2)+T;
  }
  if(d.type==='long_pos'||d.type==='short_pos'){
    return getPositionPart(d,mx,my,vis,r) !== null;
  }
  return false;
}
function seg_dist(px,py,x1,y1,x2,y2){
  var dx=x2-x1,dy=y2-y1,t=((px-x1)*dx+(py-y1)*dy)/(dx*dx+dy*dy||1);
  t=Math.max(0,Math.min(1,t));
  return Math.hypot(px-x1-t*dx,py-y1-t*dy);
}
