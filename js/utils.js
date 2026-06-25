// ═══════════════════════════════════════════════════════
//  UTILS
// ═══════════════════════════════════════════════════════
function fmtP(p){
  if(p>=10000) return '$'+Math.round(p).toLocaleString('en');
  if(p>=1000) return '$'+p.toLocaleString('en',{minimumFractionDigits:0,maximumFractionDigits:0});
  if(p>=1) return '$'+p.toFixed(2);
  return '$'+p.toFixed(6);
}
function fmtDate(t){
  var d=new Date(t*1000);
  return d.toLocaleDateString('en',{month:'short',day:'numeric',year:'2-digit'})+' '+
         d.toLocaleTimeString('en',{hour:'2-digit',minute:'2-digit',hour12:false});
}
function fmtTimeAxis(t){
  var d=new Date(t*1000);
  if(S.tf>=1440) return d.toLocaleDateString('en',{month:'short',day:'numeric'});
  if(S.tf>=60) return d.toLocaleDateString('en',{month:'short',day:'numeric'})+'\n'+d.toLocaleTimeString('en',{hour:'2-digit',minute:'2-digit',hour12:false});
  return d.toLocaleTimeString('en',{hour:'2-digit',minute:'2-digit',hour12:false});
}
function toDatetimeLocal(d){
  var pad=function(n){return n<10?'0'+n:n;};
  return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())+'T'+pad(d.getHours())+':'+pad(d.getMinutes());
}
function clamp(v,a,b){ return Math.min(Math.max(v,a),b); }
function clampVS(vs){ return Math.max(0, Math.min(vs, Math.max(0,(visibleSource().length)-S.viewCount))); }

// ═══════════════════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════════════════
window.addEventListener('load', function(){ resize(); });
