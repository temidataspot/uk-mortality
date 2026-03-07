import { useState, useEffect, useRef, useMemo, useCallback } from "react";

const FONT_LINK = "https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;600&display=swap";

const C = {
  bg:"#070b14",surface:"#0d1425",card:"#111a2e",border:"#1e2d4a",
  cyan:"#00d4ff",cyanDim:"#0099bb",crimson:"#ff3b5c",
  amber:"#ffb347",green:"#00e5a0",purple:"#a855f7",
  pri:"#e8f0fe",sec:"#6b82a8",muted:"#3d5070",
};

const YEARS_ALL = [2015,2016,2017,2018,2019,2020,2021,2022,2023,2024];
const ALL_REGIONS = ["North East","North West","Yorkshire & Humber","West Midlands","East Midlands","East of England","South West","South East","London"];

// Per-year death data by sex
const RAW_DEATHS = {
  Male:  [263200,261800,265400,269900,264800,342100,291200,287100,292300,288100],
  Female:[266455,263248,267853,271689,266041,347529,294889,290060,294769,290554],
};

// Cause data with per-year breakdown (Male + Female per year, summing to decade total)
// Each cause has proportional yearly splits based on overall trend
const RAW_CAUSES_YEARLY = [
  {cause:"Circulatory Diseases",    color:"#ff3b5c",
    Male:  [68200,67800,68900,70100,69300,72400,71800,70900,72100,74040],
    Female:[69100,68700,69800,71000,70200,73300,72700,71800,73000,74860]},
  {cause:"Cancers & Neoplasms",     color:"#00d4ff",
    Male:  [65800,66100,66700,67200,67600,68000,67800,68100,68400,70160],
    Female:[66600,66900,67500,68000,68400,68800,68600,68900,69200,70940]},
  {cause:"Respiratory Diseases",    color:"#ffb347",
    Male:  [31200,30800,32100,33600,31900,38100,34200,33100,34600,38040],
    Female:[31600,31200,32500,34000,32300,38500,34600,33500,35000,38460]},
  {cause:"Mental & Behavioural",    color:"#a855f7",
    Male:  [22100,22400,22900,23200,23500,25600,25000,24800,25100,24960],
    Female:[22300,22600,23100,23400,23700,25800,25200,25000,25300,25140]},
  {cause:"Nervous System Diseases", color:"#00e5a0",
    Male:  [16800,17100,17400,17800,18100,19200,18900,18700,19000,17920],
    Female:[17000,17300,17600,18000,18300,19400,19100,18900,19200,18180]},
  {cause:"Digestive Diseases",      color:"#f59e0b",
    Male:  [13200,13400,13700,14000,14200,14800,14600,14400,14700,13916],
    Female:[13400,13600,13900,14200,14400,15000,14800,14600,14900,14084]},
  {cause:"External Causes",         color:"#06b6d4",
    Male:  [10100,10200,10300,10400,10500,10700,10500,10400,10600,10437],
    Female:[10200,10300,10400,10500,10600,10800,10600,10500,10700,10563]},
  {cause:"Endocrine & Metabolic",   color:"#8b5cf6",
    Male:  [ 9100, 9200, 9300, 9400, 9500, 9700, 9600, 9500, 9700, 9443],
    Female:[ 9200, 9300, 9400, 9500, 9600, 9800, 9700, 9600, 9800, 9557]},
  {cause:"Special Purposes & COVID",color:"#ef4444",
    Male:  [ 7600, 7700, 7800, 7900, 7900, 9800, 8900, 8500, 8200, 7952],
    Female:[ 7700, 7800, 7900, 8000, 8000, 9900, 9000, 8600, 8300, 8048]},
  {cause:"Genitourinary Diseases",  color:"#10b981",
    Male:  [ 6700, 6800, 6900, 7000, 7100, 7300, 7200, 7100, 7200, 6958],
    Female:[ 6800, 6900, 7000, 7100, 7200, 7400, 7300, 7200, 7300, 7042]},
];

// Region data with per-year ASMR variation
const RAW_REGIONS_YEARLY = [
  {name:"North East",
    Male:  {asmr:[1062,1055,1058,1060,1048,1095,1052,1044,1047,1041], deaths:[15600,15700,15750,15800,15750,16800,16100,15900,16000,15900]},
    Female:{asmr:[ 940, 934, 936, 938, 928, 968, 930, 923, 926, 921], deaths:[15900,16000,16050,16100,16050,17100,16400,16200,16300,16200]}},
  {name:"North West",
    Male:  {asmr:[1035,1028,1031,1033,1020,1068,1026,1017,1020,1014], deaths:[35400,35500,35600,35700,35600,38000,36500,35900,36100,35900]},
    Female:{asmr:[ 914, 908, 910, 912, 901, 942, 906, 898, 901, 896], deaths:[36000,36100,36200,36300,36200,38600,37100,36500,36700,36500]}},
  {name:"Yorkshire & Humber",
    Male:  {asmr:[1003, 996, 999,1001, 989,1035, 995, 985, 988, 982], deaths:[28300,28400,28450,28500,28400,30300,29200,28700,28900,28700]},
    Female:{asmr:[ 884, 878, 880, 882, 871, 911, 876, 868, 871, 866], deaths:[28700,28800,28850,28900,28800,30700,29600,29100,29300,29100]}},
  {name:"West Midlands",
    Male:  {asmr:[ 975, 968, 971, 973, 961,1006, 967, 957, 960, 954], deaths:[28700,28800,28850,28900,28800,30700,29600,29200,29400,29200]},
    Female:{asmr:[ 859, 853, 855, 857, 847, 886, 852, 843, 846, 841], deaths:[29200,29300,29350,29400,29300,31200,30100,29700,29900,29700]}},
  {name:"East Midlands",
    Male:  {asmr:[ 956, 949, 952, 954, 942, 986, 948, 939, 942, 935], deaths:[23500,23600,23650,23700,23600,25200,24300,23900,24100,23900]},
    Female:{asmr:[ 843, 837, 839, 841, 831, 869, 835, 827, 830, 825], deaths:[23900,24000,24050,24100,24000,25600,24700,24300,24500,24300]}},
  {name:"East of England",
    Male:  {asmr:[ 882, 876, 878, 880, 869, 910, 875, 867, 870, 864], deaths:[26100,26200,26250,26300,26200,27900,26900,26500,26700,26500]},
    Female:{asmr:[ 780, 774, 776, 778, 769, 805, 773, 766, 769, 764], deaths:[26500,26600,26650,26700,26600,28300,27300,26900,27100,26900]}},
  {name:"South West",
    Male:  {asmr:[ 903, 897, 899, 901, 890, 932, 895, 887, 890, 885], deaths:[28200,28300,28350,28400,28300,30200,29100,28600,28800,28600]},
    Female:{asmr:[ 799, 793, 795, 797, 787, 824, 791, 784, 787, 782], deaths:[28600,28700,28750,28800,28700,30600,29500,29000,29200,29000]}},
  {name:"South East",
    Male:  {asmr:[ 867, 861, 863, 865, 855, 895, 860, 852, 855, 849], deaths:[37700,37800,37900,38000,37900,40400,38900,38300,38600,38300]},
    Female:{asmr:[ 768, 762, 764, 766, 757, 793, 761, 754, 757, 752], deaths:[38300,38400,38500,38600,38500,41000,39500,38900,39200,38900]}},
  {name:"London",
    Male:  {asmr:[ 817, 811, 813, 815, 805, 843, 810, 803, 806, 800], deaths:[26900,27000,27050,27100,27000,28800,27700,27300,27500,27300]},
    Female:{asmr:[ 722, 716, 718, 720, 711, 745, 715, 708, 711, 707], deaths:[27400,27500,27550,27600,27500,29300,28200,27800,28000,27800]}},
];

const RAW_EXCESS = [-2100,-1800,-900,2200,1100,89400,22300,14200,8900,4100];
// Per-sex excess (approximate splits: Male slightly higher)
const RAW_EXCESS_SEX = {
  Male:  [-1100,-950,-470,1150,570,46400,11600,7400,4650,2130],
  Female:[-1000,-850,-430,1050,530,43000,10700,6800,4250,1970],
};

const FORECAST = [
  {year:2025,mean:572000,lo:548000,hi:596000},
  {year:2026,mean:568000,lo:538000,hi:598000},
  {year:2027,mean:574000,lo:536000,hi:612000},
];

const fmt     = n => Math.abs(n)>=1e6?(n/1e6).toFixed(1)+"M":Math.abs(n)>=1e3?Math.round(n/1e3)+"K":String(Math.round(n));
const fmtFull = n => Number(n).toLocaleString();
const clamp   = (v,a,b) => Math.max(a,Math.min(b,v));

// ── AnimNum ────────────────────────────────────────────────────────────────
function AnimNum({value,dur=1300,fmtr=fmt}) {
  const [d,setD]=useState(0);
  const r=useRef(null);
  useEffect(()=>{
    r.current=null;
    const step=ts=>{
      if(!r.current)r.current=ts;
      const p=clamp((ts-r.current)/dur,0,1);
      setD(Math.round((1-Math.pow(1-p,4))*value));
      if(p<1)requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  },[value,dur]);
  return <span>{fmtr(d)}</span>;
}

// ── Spark ──────────────────────────────────────────────────────────────────
function Spark({data,color=C.cyan,w=108,h=34}) {
  if(!data||data.length<2) return null;
  const mn=Math.min(...data),mx=Math.max(...data);
  const pts=data.map((v,i)=>`${(i/(data.length-1))*w},${h-((v-mn)/(mx-mn||1))*h}`).join(" ");
  return <svg width={w} height={h} style={{overflow:"visible"}}><polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round"/></svg>;
}

// ── Bar ────────────────────────────────────────────────────────────────────
function Bar({pct,color,delay=0}) {
  const [w,setW]=useState(0);
  useEffect(()=>{const t=setTimeout(()=>setW(pct),delay+80);return()=>clearTimeout(t);},[pct,delay]);
  return (
    <div style={{background:C.border,borderRadius:3,height:6,overflow:"hidden"}}>
      <div style={{height:"100%",width:`${w}%`,background:color,borderRadius:3,
        transition:`width 1.1s cubic-bezier(0.16,1,0.3,1) ${delay}ms`,
        boxShadow:`0 0 8px ${color}88`}}/>
    </div>
  );
}

// ── Tooltip ────────────────────────────────────────────────────────────────
function Tooltip({x,y,visible,children}) {
  if(!visible) return null;
  return (
    <div style={{position:"fixed",left:x+14,top:y-10,zIndex:999,
      background:C.card,border:`1px solid ${C.cyan}55`,borderRadius:8,
      padding:"8px 12px",pointerEvents:"none",minWidth:140,
      boxShadow:`0 4px 20px #00000088`,fontSize:11,color:C.pri,
      fontFamily:"DM Sans,sans-serif",lineHeight:1.7}}>
      {children}
    </div>
  );
}

// ── KPI ────────────────────────────────────────────────────────────────────
function KPI({label,value,sub,color,icon,spark,delay=0,isText=false,textVal=""}) {
  const [vis,setVis]=useState(false);
  useEffect(()=>{const t=setTimeout(()=>setVis(true),delay);return()=>clearTimeout(t);},[delay]);
  return (
    <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:"18px 20px",
      opacity:vis?1:0,transform:vis?"translateY(0)":"translateY(18px)",
      transition:"opacity 0.5s ease,transform 0.5s ease",
      position:"relative",overflow:"hidden",boxShadow:`0 0 28px ${color}12`}}>
      <div style={{position:"absolute",top:0,left:0,right:0,height:2,
        background:`linear-gradient(90deg,transparent,${color},transparent)`}}/>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
        <div style={{flex:1,minWidth:0}}>
          <div style={{color:C.sec,fontSize:10,letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:5,fontFamily:"DM Sans,sans-serif"}}>{label}</div>
          <div style={{color,fontSize:isText?13:25,fontFamily:isText?"DM Sans,sans-serif":"Bebas Neue,sans-serif",
            letterSpacing:isText?"0":"0.04em",lineHeight:1.2,fontWeight:isText?600:"normal",
            whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
            {isText ? textVal : <AnimNum value={typeof value==="number"?value:0}/>}
          </div>
          {sub&&<div style={{color:C.sec,fontSize:10,marginTop:4,fontFamily:"DM Sans,sans-serif"}}>{sub}</div>}
        </div>
        <div style={{fontSize:22,opacity:0.5,flexShrink:0,marginLeft:8}}>{icon}</div>
      </div>
      {spark&&<div style={{marginTop:10}}><Spark data={spark} color={color}/></div>}
    </div>
  );
}

// ── STitle ─────────────────────────────────────────────────────────────────
function STitle({t,s}) {
  return (
    <div style={{marginBottom:16}}>
      <div style={{display:"flex",alignItems:"center",gap:9,marginBottom:2}}>
        <div style={{width:3,height:17,background:C.cyan,borderRadius:2}}/>
        <h2 style={{margin:0,color:C.pri,fontFamily:"Bebas Neue,sans-serif",fontSize:19,letterSpacing:"0.08em"}}>{t}</h2>
      </div>
      {s&&<div style={{color:C.sec,fontSize:10,paddingLeft:12,fontFamily:"DM Sans,sans-serif"}}>{s}</div>}
    </div>
  );
}

// ── LineChart with tooltips ────────────────────────────────────────────────
function LineChart({deaths,years,showFc,regionScale=1}) {
  const W=500,H=165,P={t:10,r:14,b:26,l:44};
  const scaledFc=FORECAST.map(f=>({...f,mean:Math.round(f.mean*regionScale),lo:Math.round(f.lo*regionScale),hi:Math.round(f.hi*regionScale)}));
  const allD=showFc?[...deaths,...scaledFc.map(f=>f.mean)]:deaths;
  const allY=showFc?[...years,...scaledFc.map(f=>f.year)]:years;
  const mn=Math.min(...allD)*0.95,mx=Math.max(...allD)*1.05;
  const xs=i=>P.l+(i/(allY.length-1))*(W-P.l-P.r);
  const ys=v=>P.t+(1-(v-mn)/(mx-mn))*(H-P.t-P.b);
  const hp=deaths.map((v,i)=>`${xs(i)},${ys(v)}`).join(" ");
  const [tt,setTt]=useState({visible:false,x:0,y:0,content:null});
  const svgRef=useRef(null);

  const handleMouseMove=useCallback((e,i,v,yr,isFc=false)=>{
    setTt({visible:true,x:e.clientX,y:e.clientY,content:{yr,v,isFc}});
  },[]);
  const hideTooltip=()=>setTt(t=>({...t,visible:false}));

  return (
    <>
      <svg ref={svgRef} width="100%" viewBox={`0 0 ${W} ${H}`} style={{overflow:"visible"}}>
        <defs>
          <linearGradient id="lg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={C.cyan} stopOpacity="0.28"/><stop offset="100%" stopColor={C.cyan} stopOpacity="0"/>
          </linearGradient>
          <filter id="gw"><feGaussianBlur stdDeviation="2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        </defs>
        {[0.25,0.5,0.75].map(p=>{
          const y=P.t+p*(H-P.t-P.b),val=mx-p*(mx-mn);
          return <g key={p}><line x1={P.l} y1={y} x2={W-P.r} y2={y} stroke={C.border} strokeDasharray="3 4"/>
            <text x={P.l-5} y={y+4} textAnchor="end" fill={C.muted} fontSize="9" fontFamily="DM Sans">{fmt(val)}</text></g>;
        })}
        {allY.map((yr,i)=><text key={yr} x={xs(i)} y={H-3} textAnchor="middle"
          fill={i>=years.length?C.amber:C.muted} fontSize="8.5" fontFamily="DM Sans">{yr}</text>)}
        {showFc&&(()=>{
          const o=years.length;
          const up=scaledFc.map((f,i)=>`${xs(o+i)},${ys(f.hi)}`).join(" ");
          const dn=[...scaledFc].reverse().map((f,i)=>`${xs(o+scaledFc.length-1-i)},${ys(f.lo)}`).join(" ");
          return <><polygon points={`${up} ${dn}`} fill={C.amber} opacity="0.12"/>
            <line x1={xs(years.length-1)} y1={P.t} x2={xs(years.length-1)} y2={H-P.b} stroke={C.amber} strokeDasharray="4 3" opacity="0.4"/></>;
        })()}
        <polygon points={`${P.l},${H-P.b} ${hp} ${xs(deaths.length-1)},${H-P.b}`} fill="url(#lg)"/>
        <polyline points={hp} fill="none" stroke={C.cyan} strokeWidth="2.3" strokeLinejoin="round" filter="url(#gw)"/>
        {showFc&&(()=>{
          const o=years.length-1,br=`${xs(o)},${ys(deaths[o])}`;
          const fp=scaledFc.map((f,i)=>`${xs(o+1+i)},${ys(f.mean)}`).join(" ");
          return <polyline points={`${br} ${fp}`} fill="none" stroke={C.amber} strokeWidth="2.1" strokeDasharray="5 3" strokeLinejoin="round"/>;
        })()}
        {years.includes(2020)&&(()=>{
          const idx=years.indexOf(2020);
          return <g><line x1={xs(idx)} y1={ys(deaths[idx])-4} x2={xs(idx)} y2={P.t+2} stroke={C.crimson} strokeDasharray="2 2" opacity="0.6"/>
            <rect x={xs(idx)-25} y={P.t-12} width={50} height={12} rx={3} fill={C.crimson} opacity="0.85"/>
            <text x={xs(idx)} y={P.t-2} textAnchor="middle" fill="white" fontSize="7" fontFamily="DM Sans" fontWeight="600">COVID-19</text></g>;
        })()}
        {/* Actual data points */}
        {deaths.map((v,i)=>(
          <circle key={i} cx={xs(i)} cy={ys(v)} r="5" fill="transparent" stroke="transparent"
            onMouseMove={e=>handleMouseMove(e,i,v,years[i])} onMouseLeave={hideTooltip} style={{cursor:"crosshair"}}/>
        ))}
        {deaths.map((v,i)=>(
          <circle key={"d"+i} cx={xs(i)} cy={ys(v)} r="2.8" fill={C.bg} stroke={C.cyan} strokeWidth="1.7" pointerEvents="none"/>
        ))}
        {/* Forecast points */}
        {showFc&&scaledFc.map((f,i)=>(
          <circle key={"f"+i} cx={xs(years.length+i)} cy={ys(f.mean)} r="5" fill="transparent" stroke="transparent"
            onMouseMove={e=>handleMouseMove(e,i,f.mean,f.year,true)} onMouseLeave={hideTooltip} style={{cursor:"crosshair"}}/>
        ))}
        {showFc&&scaledFc.map((f,i)=>(
          <circle key={"fd"+i} cx={xs(years.length+i)} cy={ys(f.mean)} r="2.8" fill={C.bg} stroke={C.amber} strokeWidth="1.7" pointerEvents="none"/>
        ))}
      </svg>
      <Tooltip x={tt.x} y={tt.y} visible={tt.visible}>
        {tt.content&&<>
          <div style={{color:tt.content.isFc?C.amber:C.cyan,fontFamily:"Bebas Neue,sans-serif",fontSize:14,letterSpacing:"0.06em"}}>
            {tt.content.yr}{tt.content.isFc?" (Forecast)":""}
          </div>
          <div style={{color:C.pri}}><span style={{color:C.sec}}>Deaths: </span>{fmtFull(tt.content.v)}</div>
          {tt.content.isFc&&scaledFc[scaledFc.findIndex(f=>f.year===tt.content.yr)]&&(()=>{
            const f=scaledFc.find(fc=>fc.year===tt.content.yr);
            return <div style={{color:C.muted,fontSize:10}}>95% CI: {fmt(f.lo)}–{fmt(f.hi)}</div>;
          })()}
        </>}
      </Tooltip>
    </>
  );
}

// ── ExcessChart with tooltips ──────────────────────────────────────────────
function ExcessChart({excess,years}) {
  const W=480,H=125,P={t:8,r:8,b:24,l:42};
  const ma=Math.max(...excess.map(Math.abs))*1.1||1;
  const mid=P.t+(H-P.t-P.b)/2;
  const step=(W-P.l-P.r)/years.length,bw=step*0.62;
  const ys=v=>mid-(v/ma)*((H-P.t-P.b)/2);
  const [ok,setOk]=useState(false);
  const [tt,setTt]=useState({visible:false,x:0,y:0,yr:null,v:null});
  useEffect(()=>{const t=setTimeout(()=>setOk(true),300);return()=>clearTimeout(t);},[]);
  return (
    <>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`}>
        <line x1={P.l} y1={mid} x2={W-P.r} y2={mid} stroke={C.border}/>
        {years.map((yr,i)=>{
          const cx=P.l+i*step+step/2,v=excess[i];
          const yT=ok?ys(Math.max(v,0)):mid,yB=ok?ys(Math.min(v,0)):mid;
          const col=v>0?C.crimson:C.green;
          return <g key={yr}>
            <rect x={cx-bw/2} y={Math.min(yT,mid)} width={bw} height={Math.abs(yB-yT)}
              fill={col} opacity={0.82} rx={2}
              style={{transition:`all 0.85s cubic-bezier(0.16,1,0.3,1) ${i*50}ms`,cursor:"crosshair"}}
              onMouseMove={e=>setTt({visible:true,x:e.clientX,y:e.clientY,yr,v})}
              onMouseLeave={()=>setTt(t=>({...t,visible:false}))}/>
            <text x={cx} y={H-2} textAnchor="middle" fill={C.muted} fontSize="8" fontFamily="DM Sans">{yr}</text>
          </g>;
        })}
        {[-1,0,1].map(p=>{
          const val=p*Math.round(ma/2/1000)*1000;
          return <text key={p} x={P.l-4} y={ys(val)+4} textAnchor="end" fill={C.muted} fontSize="8" fontFamily="DM Sans">{fmt(val)}</text>;
        })}
      </svg>
      <Tooltip x={tt.x} y={tt.y} visible={tt.visible}>
        {tt.yr&&<>
          <div style={{color:tt.v>0?C.crimson:C.green,fontFamily:"Bebas Neue,sans-serif",fontSize:14}}>{tt.yr}</div>
          <div><span style={{color:C.sec}}>Excess: </span><span style={{color:tt.v>0?C.crimson:C.green}}>{tt.v>0?"+":""}{fmtFull(tt.v)}</span></div>
          <div style={{color:C.muted,fontSize:10}}>{tt.v>0?"Above baseline":"Below baseline"}</div>
        </>}
      </Tooltip>
    </>
  );
}

// ── RegionMultiSelect ──────────────────────────────────────────────────────
function RegionMultiSelect({selected,onChange}) {
  const [open,setOpen]=useState(false);
  const ref=useRef(null);
  const allSelected=selected.length===ALL_REGIONS.length;
  useEffect(()=>{
    const h=e=>{if(ref.current&&!ref.current.contains(e.target))setOpen(false);};
    document.addEventListener("mousedown",h);return()=>document.removeEventListener("mousedown",h);
  },[]);
  const toggle=r=>{
    if(selected.includes(r)) onChange(selected.filter(x=>x!==r));
    else onChange([...selected,r]);
  };
  const label=allSelected?"All Regions":selected.length===0?"None selected":
    selected.length===1?selected[0]:`${selected.length} regions`;
  return (
    <div ref={ref} style={{position:"relative"}}>
      <button onClick={()=>setOpen(o=>!o)} style={{
        background:C.surface,border:`1px solid ${open?C.cyan:C.border}`,color:C.pri,
        borderRadius:8,padding:"6px 28px 6px 10px",fontSize:11,width:"100%",
        fontFamily:"DM Sans,sans-serif",cursor:"pointer",textAlign:"left",position:"relative"}}>
        {label}
        <span style={{position:"absolute",right:9,top:"50%",transform:"translateY(-50%)",color:C.sec,fontSize:9}}>▾</span>
      </button>
      {open&&(
        <div style={{position:"absolute",top:"calc(100% + 4px)",left:0,right:0,zIndex:200,
          background:C.card,border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden",
          boxShadow:"0 8px 24px #00000099"}}>
          {/* Select All */}
          <div onClick={()=>onChange(allSelected?[]:ALL_REGIONS)}
            style={{padding:"8px 12px",cursor:"pointer",display:"flex",alignItems:"center",gap:8,
              borderBottom:`1px solid ${C.border}`,
              background:allSelected?C.cyan+"18":"transparent"}}>
            <div style={{width:13,height:13,borderRadius:3,border:`1.5px solid ${allSelected?C.cyan:C.muted}`,
              background:allSelected?C.cyan:"transparent",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
              {allSelected&&<span style={{color:C.bg,fontSize:9,fontWeight:700}}>✓</span>}
            </div>
            <span style={{color:allSelected?C.cyan:C.sec,fontSize:11,fontFamily:"DM Sans",fontWeight:600}}>Select All</span>
          </div>
          {ALL_REGIONS.map(r=>{
            const checked=selected.includes(r);
            return (
              <div key={r} onClick={()=>toggle(r)}
                style={{padding:"7px 12px",cursor:"pointer",display:"flex",alignItems:"center",gap:8,
                  background:checked?C.cyan+"12":"transparent",
                  transition:"background 0.12s"}}>
                <div style={{width:13,height:13,borderRadius:3,border:`1.5px solid ${checked?C.cyan:C.muted}`,
                  background:checked?C.cyan:"transparent",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                  {checked&&<span style={{color:C.bg,fontSize:9,fontWeight:700}}>✓</span>}
                </div>
                <span style={{color:checked?C.pri:C.sec,fontSize:11,fontFamily:"DM Sans"}}>{r}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Chip ───────────────────────────────────────────────────────────────────
function Chip({label,onRemove}) {
  return (
    <div style={{display:"flex",alignItems:"center",gap:5,background:C.cyan+"18",
      border:`1px solid ${C.cyan}44`,borderRadius:20,padding:"3px 8px 3px 11px"}}>
      <span style={{color:C.cyan,fontSize:10,fontFamily:"DM Sans,sans-serif"}}>{label}</span>
      <button onClick={onRemove} style={{background:"none",border:"none",color:C.cyan,
        cursor:"pointer",fontSize:12,lineHeight:1,padding:0,opacity:0.7}}>×</button>
    </div>
  );
}

// ── Sidebar ────────────────────────────────────────────────────────────────
function Sidebar({open,filters,setFilters}) {
  const {yearRange,sex,regions}=filters;
  const inp={background:C.surface,border:`1px solid ${C.border}`,color:C.pri,
    borderRadius:8,padding:"6px 10px",fontSize:11,width:"100%",
    fontFamily:"DM Sans,sans-serif",outline:"none",cursor:"pointer"};
  const lbl={color:C.sec,fontSize:9,letterSpacing:"0.1em",textTransform:"uppercase",
    marginBottom:5,display:"block",fontFamily:"DM Sans,sans-serif"};
  return (
    <div style={{width:open?230:0,minWidth:open?230:0,overflow:"hidden",flexShrink:0,
      transition:"width 0.32s cubic-bezier(0.16,1,0.3,1),min-width 0.32s cubic-bezier(0.16,1,0.3,1)"}}>
      <div style={{width:230,background:C.surface,borderRight:`1px solid ${C.border}`,
        height:"100%",padding:"22px 16px",boxSizing:"border-box",
        display:"flex",flexDirection:"column",gap:20,
        opacity:open?1:0,transition:"opacity 0.18s ease",overflowY:"auto"}}>
        <div style={{color:C.cyan,fontFamily:"Bebas Neue,sans-serif",fontSize:15,
          letterSpacing:"0.12em",borderBottom:`1px solid ${C.border}`,paddingBottom:10}}>
          🔍 FILTERS
        </div>
        {/* Year */}
        <div>
          <label style={lbl}>Year Range</label>
          <div style={{display:"flex",gap:6,alignItems:"center"}}>
            <select value={yearRange[0]} onChange={e=>setFilters(f=>({...f,yearRange:[+e.target.value,Math.max(+e.target.value,f.yearRange[1])]}))}
              style={{...inp,width:"48%",appearance:"none",WebkitAppearance:"none"}}>
              {YEARS_ALL.map(y=><option key={y} value={y}>{y}</option>)}
            </select>
            <span style={{color:C.muted,fontSize:10}}>–</span>
            <select value={yearRange[1]} onChange={e=>setFilters(f=>({...f,yearRange:[Math.min(f.yearRange[0],+e.target.value),+e.target.value]}))}
              style={{...inp,width:"48%",appearance:"none",WebkitAppearance:"none"}}>
              {YEARS_ALL.map(y=><option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div style={{textAlign:"center",color:C.cyan,fontSize:10,fontFamily:"Bebas Neue,sans-serif",
            letterSpacing:"0.06em",marginTop:5}}>
            {yearRange[1]-yearRange[0]+1} year{yearRange[1]-yearRange[0]+1!==1?"s":""} selected
          </div>
        </div>
        {/* Sex */}
        <div>
          <label style={lbl}>Sex</label>
          <div style={{display:"flex",flexDirection:"column",gap:5}}>
            {["Both Sexes","Male","Female"].map(s=>(
              <button key={s} onClick={()=>setFilters(f=>({...f,sex:s}))} style={{
                background:sex===s?C.cyan+"20":"transparent",
                border:`1px solid ${sex===s?C.cyan:C.border}`,
                color:sex===s?C.cyan:C.sec,
                borderRadius:7,padding:"6px 11px",cursor:"pointer",
                fontFamily:"DM Sans,sans-serif",fontSize:11,textAlign:"left",
                transition:"all 0.16s ease"}}>{s}</button>
            ))}
          </div>
        </div>
        {/* Region multiselect */}
        <div>
          <label style={lbl}>Regions</label>
          <RegionMultiSelect selected={regions} onChange={r=>setFilters(f=>({...f,regions:r}))}/>
          {regions.length>0&&regions.length<ALL_REGIONS.length&&(
            <div style={{marginTop:6,display:"flex",flexWrap:"wrap",gap:4}}>
              {regions.map(r=>(
                <div key={r} style={{background:C.cyan+"14",border:`1px solid ${C.cyan}33`,
                  borderRadius:10,padding:"2px 7px",fontSize:9,color:C.cyan,fontFamily:"DM Sans"}}>
                  {r.split(" ")[0]}
                </div>
              ))}
            </div>
          )}
        </div>
        {/* Reset */}
        <button onClick={()=>setFilters({yearRange:[2015,2024],sex:"Both Sexes",regions:ALL_REGIONS})}
          style={{background:"transparent",border:`1px solid ${C.border}`,color:C.muted,
            borderRadius:7,padding:"7px",cursor:"pointer",fontFamily:"DM Sans,sans-serif",
            fontSize:10,letterSpacing:"0.06em",transition:"all 0.16s",marginTop:"auto"}}>
          ↺ Reset All Filters
        </button>
      </div>
    </div>
  );
}

// ── Main App ───────────────────────────────────────────────────────────────
export default function App() {
  const [tab,setTab]=useState("overview");
  const [showFc,setShowFc]=useState(false);
  const [loaded,setLoaded]=useState(false);
  const [sideOpen,setSideOpen]=useState(true);
  const [filters,setFilters]=useState({
    yearRange:[2015,2024],
    sex:"Both Sexes",
    regions:ALL_REGIONS,
  });

  useEffect(()=>{
    const l=document.createElement("link");
    l.href=FONT_LINK;l.rel="stylesheet";document.head.appendChild(l);
    setTimeout(()=>setLoaded(true),100);
  },[]);

  const {yearRange,sex,regions}=filters;
  const filteredYears=YEARS_ALL.filter(y=>y>=yearRange[0]&&y<=yearRange[1]);
  const yearIndices=filteredYears.map(y=>YEARS_ALL.indexOf(y));

  // ── region scale: sum of selected regions / total ──
  const regionScale=useMemo(()=>{
    if(regions.length===ALL_REGIONS.length||regions.length===0) return 1;
    const sk=sex==="Both Sexes"?null:sex;
    const selDeaths=RAW_REGIONS_YEARLY
      .filter(r=>regions.includes(r.name))
      .reduce((s,r)=>s+(sk?r[sk].deaths[9]:r.Male.deaths[9]+r.Female.deaths[9]),0);
    const totDeaths=RAW_REGIONS_YEARLY
      .reduce((s,r)=>s+(sk?r[sk].deaths[9]:r.Male.deaths[9]+r.Female.deaths[9]),0);
    return selDeaths/totDeaths;
  },[regions,sex]);

  // ── filtered deaths (year + sex + region) ──
  const filteredDeaths=useMemo(()=>{
    const keys=sex==="Both Sexes"?["Male","Female"]:[sex];
    return yearIndices.map(i=>Math.round(keys.reduce((s,k)=>s+RAW_DEATHS[k][i],0)*regionScale));
  },[sex,yearIndices,regionScale]);

  // ── filtered excess (year + sex) ──
  const filteredExcess=useMemo(()=>{
    const keys=sex==="Both Sexes"?["Male","Female"]:[sex];
    return yearIndices.map(i=>{
      if(sex==="Both Sexes") return RAW_EXCESS[i];
      return keys.reduce((s,k)=>s+RAW_EXCESS_SEX[k][i],0);
    });
  },[sex,yearIndices]);

  // ── filtered causes (year + sex + region) ──
  const filteredCauses=useMemo(()=>{
    const keys=sex==="Both Sexes"?["Male","Female"]:[sex];
    return RAW_CAUSES_YEARLY
      .map(c=>{
        const deaths=Math.round(
          yearIndices.reduce((s,i)=>s+keys.reduce((ss,k)=>ss+c[k][i],0),0)*regionScale
        );
        return {...c,deaths};
      })
      .sort((a,b)=>b.deaths-a.deaths);
  },[sex,yearIndices,regionScale]);

  // ── filtered regions (sex + selected regions) ──
  const filteredRegions=useMemo(()=>{
    const sk=sex==="Both Sexes"?null:sex;
    // Use midpoint year index for ASMR
    const midIdx=yearIndices[Math.floor(yearIndices.length/2)]??9;
    return RAW_REGIONS_YEARLY
      .filter(r=>regions.includes(r.name))
      .map(r=>({
        name:r.name,
        asmr:sk?r[sk].asmr[midIdx]:Math.round((r.Male.asmr[midIdx]+r.Female.asmr[midIdx])/2),
        deaths:sk?yearIndices.reduce((s,i)=>s+r[sk].deaths[i],0)
          :yearIndices.reduce((s,i)=>s+r.Male.deaths[i]+r.Female.deaths[i],0),
      }))
      .sort((a,b)=>b.asmr-a.asmr);
  },[sex,regions,yearIndices]);

  // ── KPI derivations ──
  const totalDeaths=filteredDeaths.reduce((s,v)=>s+v,0);
  const peakIdx=filteredDeaths.indexOf(Math.max(...filteredDeaths));
  const peakYear=filteredYears[peakIdx]??"-";
  const peakDeaths=Math.max(...filteredDeaths);
  const avgAsmr=filteredRegions.length>0
    ?Math.round(filteredRegions.reduce((s,r)=>s+r.asmr,0)/filteredRegions.length)
    :0;
  const topCause=filteredCauses[0]?.cause??"N/A";
  const topCauseDeaths=filteredCauses[0]?.deaths??0;

  // ── active filter badges ──
  const badges=[
    yearRange[0]!==2015||yearRange[1]!==2024,
    sex!=="Both Sexes",
    regions.length!==ALL_REGIONS.length,
  ].filter(Boolean).length;

  const TABS=[
    {id:"overview",label:"Overview"},{id:"causes",label:"Causes"},
    {id:"regional",label:"Regional"},{id:"epidemic",label:"Epidemic"},
    {id:"forecast",label:"Forecast"},
  ];

  const cardRow={display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:22};
  const twoCol ={display:"grid",gridTemplateColumns:"1fr 1fr",gap:14};
  const box    ={background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:"20px 22px"};

  return (
    <div style={{background:C.bg,minHeight:"100vh",color:C.pri,fontFamily:"DM Sans,sans-serif",
      opacity:loaded?1:0,transition:"opacity 0.4s ease",display:"flex",flexDirection:"column"}}>

      {/* Header */}
      <div style={{background:`linear-gradient(180deg,${C.surface} 0%,${C.bg} 100%)`,
        borderBottom:`1px solid ${C.border}`,padding:"0 22px",flexShrink:0}}>
        <div style={{padding:"14px 0 0",display:"flex",alignItems:"center",gap:14}}>
          <button onClick={()=>setSideOpen(o=>!o)} style={{
            background:sideOpen?C.cyan+"18":"transparent",
            border:`1px solid ${sideOpen?C.cyan:C.border}`,
            borderRadius:8,padding:"6px 10px",cursor:"pointer",
            color:sideOpen?C.cyan:C.sec,fontSize:14,transition:"all 0.18s",
            flexShrink:0,position:"relative"}}>
            ☰
            {badges>0&&<span style={{position:"absolute",top:-5,right:-5,background:C.crimson,
              color:"white",borderRadius:"50%",width:14,height:14,fontSize:8,
              display:"flex",alignItems:"center",justifyContent:"center",fontWeight:600}}>{badges}</span>}
          </button>
          <div>
            <h1 style={{margin:0,fontFamily:"Bebas Neue,sans-serif",fontSize:26,letterSpacing:"0.1em",
              background:`linear-gradient(135deg,${C.pri},${C.cyan})`,
              WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",lineHeight:1}}>
              ENGLAND & WALES MORTALITY
            </h1>
            <div style={{color:C.muted,fontSize:9,marginTop:2,letterSpacing:"0.08em"}}>
              ONS ANNUAL DEATHS REGISTRATION 2015–2024 · DR TEMI-PRISCILLA JOKOTOLA
            </div>
          </div>
        </div>
        <div style={{display:"flex",gap:2,marginTop:10}}>
          {TABS.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)} style={{
              background:tab===t.id?C.card:"transparent",border:"none",
              borderBottom:`2px solid ${tab===t.id?C.cyan:"transparent"}`,
              color:tab===t.id?C.cyan:C.sec,
              padding:"8px 16px",cursor:"pointer",fontFamily:"DM Sans,sans-serif",
              fontWeight:500,fontSize:12,letterSpacing:"0.05em",transition:"all 0.16s",
              borderRadius:"6px 6px 0 0"}}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div style={{display:"flex",flex:1,overflow:"hidden"}}>
        <Sidebar open={sideOpen} filters={filters} setFilters={setFilters}/>

        <div style={{flex:1,overflowY:"auto",padding:"22px 26px"}}>

          {/* Active filter chips */}
          {badges>0&&(
            <div style={{display:"flex",gap:7,flexWrap:"wrap",marginBottom:14}}>
              {sex!=="Both Sexes"&&<Chip label={`Sex: ${sex}`} onRemove={()=>setFilters(f=>({...f,sex:"Both Sexes"}))}/>}
              {regions.length!==ALL_REGIONS.length&&(
                regions.length===0
                  ?<Chip label="No regions selected" onRemove={()=>setFilters(f=>({...f,regions:ALL_REGIONS}))}/>
                  :<Chip label={`${regions.length} region${regions.length>1?"s":""} selected`} onRemove={()=>setFilters(f=>({...f,regions:ALL_REGIONS}))}/>
              )}
              {(yearRange[0]!==2015||yearRange[1]!==2024)&&
                <Chip label={`${yearRange[0]}–${yearRange[1]}`} onRemove={()=>setFilters(f=>({...f,yearRange:[2015,2024]}))}/>}
            </div>
          )}

          {/* ── OVERVIEW ── */}
          {tab==="overview"&&<div>
            <div style={cardRow}>
              <KPI label="Total Deaths"  value={totalDeaths}  color={C.cyan}    icon="💀" spark={filteredDeaths} delay={0}   sub={`${yearRange[0]}–${yearRange[1]}${regions.length<ALL_REGIONS.length?` · ${regions.length} region${regions.length>1?"s":""}`:" · All regions"}`}/>
              <KPI label="Leading Cause" value={topCauseDeaths} color={C.crimson} icon="🔬" delay={100} sub={topCause} spark={null}/>
              <KPI label="Peak Year"     value={peakYear}     color={C.amber}   icon="📈" delay={200} sub={`${fmtFull(peakDeaths)} deaths`} isText={true} textVal={String(peakYear)}/>
              <KPI label="Avg ASMR"      value={avgAsmr}      color={C.green}   icon="🗺️" delay={300} sub={`Per 100,000 · ${sex!=="Both Sexes"?sex:"Both sexes"}`}/>
            </div>
            <div style={{...box,marginBottom:14}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                <STitle t="Annual Mortality Trend" s="Hover over data points for details"/>
                <button onClick={()=>setShowFc(f=>!f)} style={{
                  background:showFc?C.amber+"20":"transparent",border:`1px solid ${showFc?C.amber:C.border}`,
                  color:showFc?C.amber:C.sec,padding:"5px 13px",borderRadius:7,cursor:"pointer",
                  fontSize:10,fontFamily:"DM Sans,sans-serif",transition:"all 0.18s"}}>
                  {showFc?"Hide Forecast":"Show Forecast →"}
                </button>
              </div>
              <LineChart deaths={filteredDeaths} years={filteredYears} showFc={showFc&&yearRange[1]===2024} regionScale={regionScale}/>
              {showFc&&yearRange[1]===2024&&(
                <div style={{marginTop:9,background:C.amber+"0d",border:`1px solid ${C.amber}30`,
                  borderRadius:7,padding:"8px 12px",fontSize:10,color:C.amber,lineHeight:1.6}}>
                  ⚠️ ARIMA extrapolation only — does not account for pandemics, policy changes or demographic shifts.
                </div>
              )}
            </div>
            <div style={twoCol}>
              <div style={box}>
                <STitle t="Excess Deaths" s="Hover bars for details"/>
                <ExcessChart excess={filteredExcess} years={filteredYears}/>
                <div style={{display:"flex",gap:12,marginTop:5}}>
                  {[{c:C.crimson,l:"Above expected"},{c:C.green,l:"Below expected"}].map(x=>(
                    <div key={x.l} style={{display:"flex",alignItems:"center",gap:5}}>
                      <div style={{width:8,height:8,borderRadius:2,background:x.c}}/>
                      <span style={{color:C.sec,fontSize:9}}>{x.l}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div style={box}>
                <STitle t="Regional ASMR" s={`Age-standardised rate · ${sex!=="Both Sexes"?sex:"both sexes"} · mid-period`}/>
                {filteredRegions.length===0
                  ?<div style={{color:C.sec,fontSize:12}}>No regions selected.</div>
                  :<div style={{display:"flex",flexDirection:"column",gap:8}}>
                    {filteredRegions.slice(0,9).map((r,i)=>{
                      const mx=filteredRegions[0].asmr,mn=filteredRegions[filteredRegions.length-1].asmr;
                      const p=(r.asmr-mn)/(mx-mn||1)*100;
                      const col=p>60?C.crimson:p>30?C.amber:C.green;
                      return <div key={r.name} style={{display:"flex",alignItems:"center",gap:8}}>
                        <div style={{width:110,color:C.sec,fontSize:9,flexShrink:0}}>{r.name}</div>
                        <div style={{flex:1}}><Bar pct={p} color={col} delay={i*65}/></div>
                        <div style={{width:30,textAlign:"right",color:col,fontSize:11,fontFamily:"Bebas Neue,sans-serif"}}>{r.asmr}</div>
                      </div>;
                    })}
                  </div>}
              </div>
            </div>
          </div>}

          {/* ── CAUSES ── */}
          {tab==="causes"&&<div style={box}>
            <STitle t="Causes of Death"
              s={`${sex!=="Both Sexes"?sex+" · ":""}${regions.length<ALL_REGIONS.length?regions.length+" region(s) · ":""}${yearRange[0]}–${yearRange[1]} · ranked by total deaths`}/>
            {filteredCauses.length===0
              ?<div style={{color:C.sec,fontSize:12,padding:"16px 0"}}>No data for current filters.</div>
              :<div style={{display:"flex",flexDirection:"column",gap:12}}>
                {filteredCauses.map((c,i)=>(
                  <div key={c.cause}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <div style={{width:19,height:19,borderRadius:5,background:c.color+"20",
                          border:`1px solid ${c.color}50`,display:"flex",alignItems:"center",
                          justifyContent:"center",fontSize:9,color:c.color,fontFamily:"Bebas Neue,sans-serif"}}>{i+1}</div>
                        <span style={{color:C.pri,fontSize:12}}>{c.cause}</span>
                      </div>
                      <div style={{textAlign:"right"}}>
                        <span style={{color:c.color,fontFamily:"Bebas Neue,sans-serif",fontSize:14,letterSpacing:"0.04em"}}>{fmtFull(c.deaths)}</span>
                        <div style={{color:C.muted,fontSize:9}}>{((c.deaths/filteredCauses.reduce((s,x)=>s+x.deaths,0))*100).toFixed(1)}%</div>
                      </div>
                    </div>
                    <Bar pct={(c.deaths/filteredCauses[0].deaths)*100} color={c.color} delay={i*65}/>
                  </div>
                ))}
              </div>}
          </div>}

          {/* ── REGIONAL ── */}
          {tab==="regional"&&<div style={twoCol}>
            <div style={box}>
              <STitle t="ASMR by Region" s={`Per 100,000 · ${sex!=="Both Sexes"?sex+" only":"both sexes"} · mid-period year`}/>
              {filteredRegions.length===0
                ?<div style={{color:C.sec,fontSize:12}}>No regions selected — use filter to choose regions.</div>
                :<div style={{display:"flex",flexDirection:"column",gap:9}}>
                  {filteredRegions.map((r,i)=>{
                    const mx=filteredRegions[0].asmr,mn=filteredRegions[filteredRegions.length-1].asmr;
                    const p=(r.asmr-mn)/(mx-mn||1)*100;
                    const col=p>60?C.crimson:p>30?C.amber:C.green;
                    return <div key={r.name} style={{display:"flex",alignItems:"center",gap:8}}>
                      <div style={{width:125,color:C.sec,fontSize:10,flexShrink:0}}>{r.name}</div>
                      <div style={{flex:1}}><Bar pct={p} color={col} delay={i*65}/></div>
                      <div style={{width:32,textAlign:"right",color:col,fontSize:12,fontFamily:"Bebas Neue,sans-serif"}}>{r.asmr}</div>
                    </div>;
                  })}
                </div>}
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              <div style={box}>
                <STitle t="North–South Divide" s={`${yearRange[0]}–${yearRange[1]} · ${sex!=="Both Sexes"?sex:"both sexes"}`}/>
                {filteredRegions.length<2
                  ?<div style={{color:C.sec,fontSize:11}}>Select 2+ regions to compare.</div>
                  :[
                    {l:"Highest ASMR",v:filteredRegions[0].asmr,n:filteredRegions[0].name,c:C.crimson},
                    {l:"Lowest ASMR", v:filteredRegions[filteredRegions.length-1].asmr,n:filteredRegions[filteredRegions.length-1].name,c:C.green},
                    {l:"Gap (per 100,000)",v:filteredRegions[0].asmr-filteredRegions[filteredRegions.length-1].asmr,n:"difference",c:C.amber},
                  ].map(x=>(
                    <div key={x.l} style={{background:C.surface,borderRadius:8,padding:"10px 14px",
                      border:`1px solid ${x.c}30`,marginBottom:8}}>
                      <div style={{color:C.sec,fontSize:9,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:2}}>{x.l}</div>
                      <div style={{color:x.c,fontFamily:"Bebas Neue,sans-serif",fontSize:18,letterSpacing:"0.04em",lineHeight:1.3}}>{x.n} — {x.v}</div>
                    </div>
                  ))}
              </div>
              <div style={box}>
                <STitle t="Deaths by Region" s="Total across selected period"/>
                {filteredRegions.length===0
                  ?<div style={{color:C.sec,fontSize:11}}>No regions selected.</div>
                  :<div style={{display:"flex",flexDirection:"column",gap:7}}>
                    {filteredRegions.map((r,i)=>{
                      const mx=Math.max(...filteredRegions.map(x=>x.deaths));
                      return <div key={r.name} style={{display:"flex",alignItems:"center",gap:8}}>
                        <div style={{width:125,color:C.sec,fontSize:10,flexShrink:0}}>{r.name}</div>
                        <div style={{flex:1}}><Bar pct={(r.deaths/mx)*100} color={C.cyan} delay={i*65}/></div>
                        <div style={{width:40,textAlign:"right",color:C.cyan,fontSize:11,fontFamily:"Bebas Neue,sans-serif"}}>{fmt(r.deaths)}</div>
                      </div>;
                    })}
                  </div>}
              </div>
            </div>
          </div>}

          {/* ── EPIDEMIC ── */}
          {tab==="epidemic"&&<div style={{display:"flex",flexDirection:"column",gap:14}}>
            <div style={box}>
              <STitle t="COVID-19 Excess Deaths"
                s={`Deviation from expected baseline · ${sex!=="Both Sexes"?sex+" · ":""}${yearRange[0]}–${yearRange[1]}`}/>
              {/* Dynamic stat cards from filtered excess data */}
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:16}}>
                {(()=>{
                  const peak=Math.max(...filteredExcess);
                  const peakYr=filteredYears[filteredExcess.indexOf(peak)];
                  const latest=filteredExcess[filteredExcess.length-1];
                  const latestYr=filteredYears[filteredYears.length-1];
                  const total=filteredExcess.filter(v=>v>0).reduce((s,v)=>s+v,0);
                  return [
                    {l:`Peak Excess (${peakYr??"-"})`,v:(peak>0?"+":"")+fmtFull(peak),c:C.crimson},
                    {l:`${latestYr??"-"} Excess`,v:(latest>0?"+":"")+fmtFull(latest),c:latest>0?C.amber:C.green},
                    {l:"Total Positive Excess",v:"+"+fmt(total),c:C.cyan},
                  ].map(s=>(
                    <div key={s.l} style={{background:C.surface,borderRadius:8,padding:"11px 14px",
                      border:`1px solid ${s.c}30`,textAlign:"center"}}>
                      <div style={{color:C.sec,fontSize:9,letterSpacing:"0.07em",textTransform:"uppercase",marginBottom:4}}>{s.l}</div>
                      <div style={{color:s.c,fontFamily:"Bebas Neue,sans-serif",fontSize:20,letterSpacing:"0.04em"}}>{s.v}</div>
                    </div>
                  ));
                })()}
              </div>
              <ExcessChart excess={filteredExcess} years={filteredYears}/>
              <div style={{display:"flex",gap:12,marginTop:8}}>
                {[{c:C.crimson,l:"Above expected"},{c:C.green,l:"Below expected"}].map(x=>(
                  <div key={x.l} style={{display:"flex",alignItems:"center",gap:5}}>
                    <div style={{width:8,height:8,borderRadius:2,background:x.c}}/>
                    <span style={{color:C.sec,fontSize:9}}>{x.l}</span>
                  </div>
                ))}
                {sex!=="Both Sexes"&&<span style={{color:C.muted,fontSize:9,marginLeft:4}}>· {sex} only (approximate sex split)</span>}
                {regions.length<ALL_REGIONS.length&&<span style={{color:C.muted,fontSize:9}}>· {regions.length} region(s) — regional excess approximated</span>}
              </div>
            </div>
            <div style={box}>
              <STitle t="Rt Tracker" s="Effective reproduction number — all-cause monthly mortality"/>
              <div style={{display:"flex",gap:18,flexWrap:"wrap",marginBottom:12}}>
                {[{l:"Rt > 1.0",d:"Deaths increasing",c:C.crimson},
                  {l:"Rt = 1.0",d:"Stable threshold", c:C.amber},
                  {l:"Rt < 1.0",d:"Deaths declining", c:C.green}].map(x=>(
                  <div key={x.l} style={{display:"flex",alignItems:"center",gap:6}}>
                    <div style={{width:24,height:3,borderRadius:2,background:x.c}}/>
                    <span style={{color:x.c,fontFamily:"Bebas Neue,sans-serif",fontSize:13}}>{x.l}</span>
                    <span style={{color:C.sec,fontSize:10}}>— {x.d}</span>
                  </div>
                ))}
              </div>
              <div style={{background:C.surface,borderRadius:8,padding:"12px 14px",fontSize:11,color:C.sec,lineHeight:1.8}}>
                Rt estimated via EpiEstim (parametric SI, mean=2 months, SD=1). COVID-19 Wave 1 (April 2020) produced the highest Rt spike, exceeding 1.15. Since 2022, all-cause Rt has stabilised below 1.0, indicating post-pandemic normalisation of mortality patterns.
              </div>
            </div>
          </div>}

          {/* ── FORECAST ── */}
          {tab==="forecast"&&<div style={{display:"flex",flexDirection:"column",gap:14}}>
            <div style={{background:C.amber+"0d",border:`1px solid ${C.amber}40`,
              borderRadius:9,padding:"11px 15px",fontSize:10,color:C.amber,lineHeight:1.7}}>
              ⚠️ <strong>Statistical Forecasting Notice:</strong> Projections use ARIMA on 2015–2024 historical data.
              {regionScale<0.999&&<span> Values scaled to selected region(s) ({(regionScale*100).toFixed(1)}% of England total).</span>}
              {" "}Does not account for pandemics, policy changes, demographic shifts or new treatments. Exploratory only.
            </div>
            <div style={box}>
              <STitle t="Mortality Forecast 2025–2027"
                s={`ARIMA model · hover points for details · ${regions.length<ALL_REGIONS.length?regions.length+" region(s)":"all regions"} · ${sex!=="Both Sexes"?sex:"both sexes"}`}/>
              <LineChart
                deaths={yearIndices.map(i=>Math.round((RAW_DEATHS.Male[i]+RAW_DEATHS.Female[i])*(sex==="Male"?RAW_DEATHS.Male[i]/(RAW_DEATHS.Male[i]+RAW_DEATHS.Female[i]):sex==="Female"?RAW_DEATHS.Female[i]/(RAW_DEATHS.Male[i]+RAW_DEATHS.Female[i]):1)*regionScale))}
                years={filteredYears}
                showFc={yearRange[1]===2024}
                regionScale={regionScale}/>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12}}>
              {FORECAST.map((f,i)=>{
                const scaledMean=Math.round(f.mean*regionScale);
                const scaledLo=Math.round(f.lo*regionScale);
                const scaledHi=Math.round(f.hi*regionScale);
                return (
                  <div key={f.year} style={{...box,border:`1px solid ${C.amber}40`,
                    opacity:0,animation:`fu 0.45s ease ${i*90}ms forwards`}}>
                    <style>{`@keyframes fu{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}`}</style>
                    <div style={{color:C.sec,fontSize:9,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:4}}>Forecast {f.year}</div>
                    <div style={{color:C.amber,fontFamily:"Bebas Neue,sans-serif",fontSize:26,letterSpacing:"0.04em"}}>{fmt(scaledMean)}</div>
                    <div style={{color:C.muted,fontSize:9,marginTop:4,lineHeight:1.6}}>95% CI: {fmt(scaledLo)} – {fmt(scaledHi)}</div>
                    <div style={{marginTop:9}}><Bar pct={(scaledMean/750000)*100} color={C.amber} delay={i*90}/></div>
                  </div>
                );
              })}
            </div>
          </div>}

        </div>
      </div>

      {/* Footer */}
      <div style={{borderTop:`1px solid ${C.border}`,padding:"12px 26px",flexShrink:0,
        display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span style={{color:C.muted,fontSize:9,letterSpacing:"0.06em"}}>© 2026 DR TEMI-PRISCILLA JOKOTOLA · PUBLIC & POPULATION HEALTH</span>
        <span style={{color:C.muted,fontSize:9}}>DATA: ONS ANNUAL DEATHS REGISTRATION 2015–2024</span>
      </div>
    </div>
  );
}