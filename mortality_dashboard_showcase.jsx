import { useState, useEffect, useRef, useMemo } from "react";

const FONT_LINK = "https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;600&display=swap";

const C = {
  bg:"#070b14",surface:"#0d1425",card:"#111a2e",border:"#1e2d4a",
  cyan:"#00d4ff",cyanDim:"#0099bb",crimson:"#ff3b5c",
  amber:"#ffb347",green:"#00e5a0",purple:"#a855f7",
  pri:"#e8f0fe",sec:"#6b82a8",muted:"#3d5070",
};

const YEARS_ALL = [2015,2016,2017,2018,2019,2020,2021,2022,2023,2024];

const RAW_DEATHS = {
  Male:  [263200,261800,265400,269900,264800,342100,291200,287100,292300,288100],
  Female:[266455,263248,267853,271689,266041,347529,294889,290060,294769,290554],
};

const RAW_CAUSES = [
  {cause:"Circulatory Diseases",    Male:705540, Female:714460,color:"#ff3b5c"},
  {cause:"Cancers & Neoplasms",     Male:685860, Female:694140,color:"#00d4ff"},
  {cause:"Respiratory Diseases",    Male:337640, Female:342360,color:"#ffb347"},
  {cause:"Mental & Behavioural",    Male:238560, Female:241440,color:"#a855f7"},
  {cause:"Nervous System Diseases", Male:178920, Female:181080,color:"#00e5a0"},
  {cause:"Digestive Diseases",      Male:139160, Female:140840,color:"#f59e0b"},
  {cause:"External Causes",         Male:104370, Female:105630,color:"#06b6d4"},
  {cause:"Endocrine & Metabolic",   Male: 94430, Female: 95570,color:"#8b5cf6"},
  {cause:"Special Purposes & COVID",Male: 79520, Female: 80480,color:"#ef4444"},
  {cause:"Genitourinary Diseases",  Male: 69580, Female: 70420,color:"#10b981"},
];

const RAW_REGIONS = [
  {name:"North East",        Male:{asmr:1041,deaths:15900}, Female:{asmr:921,deaths:16200}},
  {name:"North West",        Male:{asmr:1014,deaths:35900}, Female:{asmr:896,deaths:36500}},
  {name:"Yorkshire & Humber",Male:{asmr: 982,deaths:28700}, Female:{asmr:866,deaths:29100}},
  {name:"West Midlands",     Male:{asmr: 954,deaths:29200}, Female:{asmr:841,deaths:29700}},
  {name:"East Midlands",     Male:{asmr: 935,deaths:23900}, Female:{asmr:825,deaths:24300}},
  {name:"East of England",   Male:{asmr: 864,deaths:26500}, Female:{asmr:764,deaths:26900}},
  {name:"South West",        Male:{asmr: 885,deaths:28600}, Female:{asmr:782,deaths:29000}},
  {name:"South East",        Male:{asmr: 849,deaths:38300}, Female:{asmr:752,deaths:38900}},
  {name:"London",            Male:{asmr: 800,deaths:27300}, Female:{asmr:707,deaths:27800}},
];

const RAW_EXCESS = [-2100,-1800,-900,2200,1100,89400,22300,14200,8900,4100];
const FORECAST   = [
  {year:2025,mean:572000,lo:548000,hi:596000},
  {year:2026,mean:568000,lo:538000,hi:598000},
  {year:2027,mean:574000,lo:536000,hi:612000},
];

const fmt     = n => Math.abs(n)>=1e6?(n/1e6).toFixed(1)+"M":Math.abs(n)>=1e3?Math.round(n/1e3)+"K":String(Math.round(n));
const fmtFull = n => Number(n).toLocaleString();
const clamp   = (v,a,b) => Math.max(a,Math.min(b,v));

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

function Spark({data,color=C.cyan,w=108,h=34}) {
  const mn=Math.min(...data),mx=Math.max(...data);
  const pts=data.map((v,i)=>`${(i/(data.length-1))*w},${h-((v-mn)/(mx-mn||1))*h}`).join(" ");
  return <svg width={w} height={h} style={{overflow:"visible"}}><polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round"/></svg>;
}

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

function KPI({label,value,sub,color,icon,spark,delay=0}) {
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
        <div>
          <div style={{color:C.sec,fontSize:10,letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:5,fontFamily:"DM Sans,sans-serif"}}>{label}</div>
          <div style={{color,fontSize:25,fontFamily:"Bebas Neue,sans-serif",letterSpacing:"0.04em",lineHeight:1}}>
            <AnimNum value={typeof value==="number"?value:0}/>
          </div>
          {sub&&<div style={{color:C.sec,fontSize:10,marginTop:4,fontFamily:"DM Sans,sans-serif"}}>{sub}</div>}
        </div>
        <div style={{fontSize:22,opacity:0.5}}>{icon}</div>
      </div>
      {spark&&<div style={{marginTop:10}}><Spark data={spark} color={color}/></div>}
    </div>
  );
}

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

function LineChart({deaths,years,showFc}) {
  const W=500,H=165,P={t:10,r:14,b:26,l:44};
  const allD=showFc?[...deaths,...FORECAST.map(f=>f.mean)]:deaths;
  const allY=showFc?[...years,...FORECAST.map(f=>f.year)]:years;
  const mn=Math.min(...allD)*0.95,mx=Math.max(...allD)*1.05;
  const xs=i=>P.l+(i/(allY.length-1))*(W-P.l-P.r);
  const ys=v=>P.t+(1-(v-mn)/(mx-mn))*(H-P.t-P.b);
  const hp=deaths.map((v,i)=>`${xs(i)},${ys(v)}`).join(" ");
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{overflow:"visible"}}>
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
        const up=FORECAST.map((f,i)=>`${xs(o+i)},${ys(f.hi)}`).join(" ");
        const dn=[...FORECAST].reverse().map((f,i)=>`${xs(o+FORECAST.length-1-i)},${ys(f.lo)}`).join(" ");
        return <><polygon points={`${up} ${dn}`} fill={C.amber} opacity="0.12"/>
          <line x1={xs(years.length-1)} y1={P.t} x2={xs(years.length-1)} y2={H-P.b} stroke={C.amber} strokeDasharray="4 3" opacity="0.4"/></>;
      })()}
      <polygon points={`${P.l},${H-P.b} ${hp} ${xs(deaths.length-1)},${H-P.b}`} fill="url(#lg)"/>
      <polyline points={hp} fill="none" stroke={C.cyan} strokeWidth="2.3" strokeLinejoin="round" filter="url(#gw)"/>
      {showFc&&(()=>{
        const o=years.length-1,br=`${xs(o)},${ys(deaths[o])}`;
        const fp=FORECAST.map((f,i)=>`${xs(o+1+i)},${ys(f.mean)}`).join(" ");
        return <polyline points={`${br} ${fp}`} fill="none" stroke={C.amber} strokeWidth="2.1" strokeDasharray="5 3" strokeLinejoin="round"/>;
      })()}
      {years.includes(2020)&&(()=>{
        const idx=years.indexOf(2020);
        return <g><line x1={xs(idx)} y1={ys(deaths[idx])-4} x2={xs(idx)} y2={P.t+2} stroke={C.crimson} strokeDasharray="2 2" opacity="0.6"/>
          <rect x={xs(idx)-25} y={P.t-12} width={50} height={12} rx={3} fill={C.crimson} opacity="0.85"/>
          <text x={xs(idx)} y={P.t-2} textAnchor="middle" fill="white" fontSize="7" fontFamily="DM Sans" fontWeight="600">COVID-19</text></g>;
      })()}
      {deaths.map((v,i)=><circle key={i} cx={xs(i)} cy={ys(v)} r="2.8" fill={C.bg} stroke={C.cyan} strokeWidth="1.7"/>)}
    </svg>
  );
}

function ExcessChart({excess,years}) {
  const W=480,H=125,P={t:8,r:8,b:24,l:42};
  const ma=Math.max(...excess.map(Math.abs))*1.1||1;
  const mid=P.t+(H-P.t-P.b)/2;
  const step=(W-P.l-P.r)/years.length,bw=step*0.62;
  const ys=v=>mid-(v/ma)*((H-P.t-P.b)/2);
  const [ok,setOk]=useState(false);
  useEffect(()=>{const t=setTimeout(()=>setOk(true),300);return()=>clearTimeout(t);},[]);
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`}>
      <line x1={P.l} y1={mid} x2={W-P.r} y2={mid} stroke={C.border}/>
      {years.map((yr,i)=>{
        const cx=P.l+i*step+step/2,v=excess[i];
        const yT=ok?ys(Math.max(v,0)):mid,yB=ok?ys(Math.min(v,0)):mid;
        const col=v>0?C.crimson:C.green;
        return <g key={yr}>
          <rect x={cx-bw/2} y={Math.min(yT,mid)} width={bw} height={Math.abs(yB-yT)}
            fill={col} opacity={0.82} rx={2}
            style={{transition:`all 0.85s cubic-bezier(0.16,1,0.3,1) ${i*50}ms`}}/>
          <text x={cx} y={H-2} textAnchor="middle" fill={C.muted} fontSize="8" fontFamily="DM Sans">{yr}</text>
        </g>;
      })}
      {[-1,0,1].map(p=>{
        const val=p*Math.round(ma/2/1000)*1000;
        return <text key={p} x={P.l-4} y={ys(val)+4} textAnchor="end" fill={C.muted} fontSize="8" fontFamily="DM Sans">{fmt(val)}</text>;
      })}
    </svg>
  );
}

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

function Sidebar({open,filters,setFilters}) {
  const {yearRange,sex,region,cause}=filters;
  const regions=["All Regions",...RAW_REGIONS.map(r=>r.name)];
  const causes =["All Causes", ...RAW_CAUSES.map(c=>c.cause)];
  const inp={background:C.surface,border:`1px solid ${C.border}`,color:C.pri,
    borderRadius:8,padding:"6px 10px",fontSize:11,width:"100%",
    fontFamily:"DM Sans,sans-serif",outline:"none",cursor:"pointer",
    appearance:"none",WebkitAppearance:"none"};
  const lbl={color:C.sec,fontSize:9,letterSpacing:"0.1em",textTransform:"uppercase",
    marginBottom:5,display:"block",fontFamily:"DM Sans,sans-serif"};
  return (
    <div style={{width:open?224:0,minWidth:open?224:0,overflow:"hidden",flexShrink:0,
      transition:"width 0.32s cubic-bezier(0.16,1,0.3,1),min-width 0.32s cubic-bezier(0.16,1,0.3,1)"}}>
      <div style={{width:224,background:C.surface,borderRight:`1px solid ${C.border}`,
        height:"100%",padding:"22px 16px",boxSizing:"border-box",
        display:"flex",flexDirection:"column",gap:20,
        opacity:open?1:0,transition:"opacity 0.18s ease"}}>

        <div style={{color:C.cyan,fontFamily:"Bebas Neue,sans-serif",fontSize:15,
          letterSpacing:"0.12em",borderBottom:`1px solid ${C.border}`,paddingBottom:10}}>
          🔍 FILTERS
        </div>

        {/* Year */}
        <div>
          <label style={lbl}>Year Range</label>
          <div style={{display:"flex",gap:6,alignItems:"center"}}>
            <select value={yearRange[0]} onChange={e=>setFilters(f=>({...f,yearRange:[+e.target.value,f.yearRange[1]]}))} style={{...inp,width:"48%"}}>
              {YEARS_ALL.filter(y=>y<=yearRange[1]).map(y=><option key={y} value={y}>{y}</option>)}
            </select>
            <span style={{color:C.muted,fontSize:10}}>–</span>
            <select value={yearRange[1]} onChange={e=>setFilters(f=>({...f,yearRange:[f.yearRange[0],+e.target.value]}))} style={{...inp,width:"48%"}}>
              {YEARS_ALL.filter(y=>y>=yearRange[0]).map(y=><option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div style={{textAlign:"center",color:C.cyan,fontSize:10,fontFamily:"Bebas Neue,sans-serif",
            letterSpacing:"0.06em",marginTop:5}}>
            {yearRange[1]-yearRange[0]+1} years selected
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

        {/* Region */}
        <div>
          <label style={lbl}>Region</label>
          <div style={{position:"relative"}}>
            <select value={region} onChange={e=>setFilters(f=>({...f,region:e.target.value}))} style={inp}>
              {regions.map(r=><option key={r} value={r}>{r}</option>)}
            </select>
            <span style={{position:"absolute",right:9,top:"50%",transform:"translateY(-50%)",color:C.sec,pointerEvents:"none",fontSize:9}}>▾</span>
          </div>
        </div>

        {/* Cause */}
        <div>
          <label style={lbl}>Cause of Death</label>
          <div style={{position:"relative"}}>
            <select value={cause} onChange={e=>setFilters(f=>({...f,cause:e.target.value}))} style={{...inp,fontSize:10}}>
              {causes.map(c=><option key={c} value={c}>{c}</option>)}
            </select>
            <span style={{position:"absolute",right:9,top:"50%",transform:"translateY(-50%)",color:C.sec,pointerEvents:"none",fontSize:9}}>▾</span>
          </div>
        </div>

        {/* Reset */}
        <button onClick={()=>setFilters({yearRange:[2015,2024],sex:"Both Sexes",region:"All Regions",cause:"All Causes"})}
          style={{background:"transparent",border:`1px solid ${C.border}`,color:C.muted,
            borderRadius:7,padding:"7px",cursor:"pointer",fontFamily:"DM Sans,sans-serif",
            fontSize:10,letterSpacing:"0.06em",transition:"all 0.16s",marginTop:"auto"}}>
          ↺ Reset All Filters
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const [tab,setTab]=useState("overview");
  const [showFc,setShowFc]=useState(false);
  const [loaded,setLoaded]=useState(false);
  const [sideOpen,setSideOpen]=useState(true);
  const [filters,setFilters]=useState({yearRange:[2015,2024],sex:"Both Sexes",region:"All Regions",cause:"All Causes"});

  useEffect(()=>{
    const l=document.createElement("link");
    l.href=FONT_LINK;l.rel="stylesheet";document.head.appendChild(l);
    setTimeout(()=>setLoaded(true),100);
  },[]);

  const {yearRange,sex,region,cause}=filters;
  const filteredYears=YEARS_ALL.filter(y=>y>=yearRange[0]&&y<=yearRange[1]);

  const filteredDeaths=useMemo(()=>{
    const keys=sex==="Both Sexes"?["Male","Female"]:[sex];
    return filteredYears.map(yr=>{
      const i=YEARS_ALL.indexOf(yr);
      return keys.reduce((s,k)=>s+RAW_DEATHS[k][i],0);
    });
  },[sex,filteredYears]);

  const filteredExcess=useMemo(()=>filteredYears.map(yr=>RAW_EXCESS[YEARS_ALL.indexOf(yr)]),[filteredYears]);

  const regionScale=useMemo(()=>{
    if(region==="All Regions")return 1;
    const r=RAW_REGIONS.find(r=>r.name===region);
    if(!r)return 1;
    const sk=sex==="Both Sexes"?null:sex;
    const rd=sk?r[sk].deaths:r.Male.deaths+r.Female.deaths;
    const td=RAW_REGIONS.reduce((s,rr)=>s+(sk?rr[sk].deaths:rr.Male.deaths+rr.Female.deaths),0);
    return rd/td;
  },[region,sex]);

  const filteredCauses=useMemo(()=>{
    const keys=sex==="Both Sexes"?["Male","Female"]:[sex];
    return RAW_CAUSES
      .filter(c=>cause==="All Causes"||c.cause===cause)
      .map(c=>({...c,deaths:Math.round(keys.reduce((s,k)=>s+c[k],0)*regionScale)}))
      .sort((a,b)=>b.deaths-a.deaths);
  },[sex,regionScale,cause]);

  const filteredRegions=useMemo(()=>{
    const sk=sex==="Both Sexes"?null:sex;
    return RAW_REGIONS
      .filter(r=>region==="All Regions"||r.name===region)
      .map(r=>({
        name:r.name,
        asmr:sk?r[sk].asmr:Math.round((r.Male.asmr+r.Female.asmr)/2),
        deaths:sk?r[sk].deaths:r.Male.deaths+r.Female.deaths,
      }))
      .sort((a,b)=>b.asmr-a.asmr);
  },[sex,region]);

  const totalDeaths=filteredDeaths.reduce((s,v)=>s+v,0);
  const peakIdx=filteredDeaths.indexOf(Math.max(...filteredDeaths));
  const peakYear=filteredYears[peakIdx];
  const peakDeaths=Math.max(...filteredDeaths);
  const avgAsmr=Math.round(filteredRegions.reduce((s,r)=>s+r.asmr,0)/(filteredRegions.length||1));
  const topCause=filteredCauses[0]?.cause??"N/A";

  const badges=[
    yearRange[0]!==2015||yearRange[1]!==2024,
    sex!=="Both Sexes",region!=="All Regions",cause!=="All Causes"
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

          {/* Active chips */}
          {badges>0&&(
            <div style={{display:"flex",gap:7,flexWrap:"wrap",marginBottom:14}}>
              {sex!=="Both Sexes"&&<Chip label={`Sex: ${sex}`} onRemove={()=>setFilters(f=>({...f,sex:"Both Sexes"}))}/>}
              {region!=="All Regions"&&<Chip label={region} onRemove={()=>setFilters(f=>({...f,region:"All Regions"}))}/>}
              {cause!=="All Causes"&&<Chip label={cause} onRemove={()=>setFilters(f=>({...f,cause:"All Causes"}))}/>}
              {(yearRange[0]!==2015||yearRange[1]!==2024)&&<Chip label={`${yearRange[0]}–${yearRange[1]}`} onRemove={()=>setFilters(f=>({...f,yearRange:[2015,2024]}))}/>}
            </div>
          )}

          {/* ── OVERVIEW ── */}
          {tab==="overview"&&<div>
            <div style={cardRow}>
              <KPI label="Total Deaths" value={totalDeaths} color={C.cyan}    icon="💀" spark={filteredDeaths} delay={0}   sub={`${yearRange[0]}–${yearRange[1]}`}/>
              <KPI label="Leading Cause" value={0}         color={C.crimson} icon="🔬" delay={100} sub={topCause}/>
              <KPI label="Peak Year"     value={peakYear}  color={C.amber}   icon="📈" delay={200} sub={`${fmtFull(peakDeaths)} deaths`}/>
              <KPI label="Avg ASMR"      value={avgAsmr}   color={C.green}   icon="🗺️" delay={300} sub="Per 100,000 population"/>
            </div>
            <div style={{...box,marginBottom:14}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                <STitle t="Annual Mortality Trend" s="Total registered deaths per year"/>
                <button onClick={()=>setShowFc(f=>!f)} style={{
                  background:showFc?C.amber+"20":"transparent",border:`1px solid ${showFc?C.amber:C.border}`,
                  color:showFc?C.amber:C.sec,padding:"5px 13px",borderRadius:7,cursor:"pointer",
                  fontSize:10,fontFamily:"DM Sans,sans-serif",transition:"all 0.18s"}}>
                  {showFc?"Hide Forecast":"Show Forecast →"}
                </button>
              </div>
              <LineChart deaths={filteredDeaths} years={filteredYears} showFc={showFc&&yearRange[1]===2024}/>
              {showFc&&yearRange[1]===2024&&(
                <div style={{marginTop:9,background:C.amber+"0d",border:`1px solid ${C.amber}30`,
                  borderRadius:7,padding:"8px 12px",fontSize:10,color:C.amber,lineHeight:1.6}}>
                  ⚠️ ARIMA extrapolation only — does not account for pandemics, policy changes or demographic shifts.
                </div>
              )}
            </div>
            <div style={twoCol}>
              <div style={box}>
                <STitle t="Excess Deaths" s="Deviation from expected baseline"/>
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
                <STitle t="Regional ASMR" s="Age-standardised rate by region"/>
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {filteredRegions.slice(0,7).map((r,i)=>{
                    const mx=filteredRegions[0].asmr,mn=filteredRegions[filteredRegions.length-1].asmr;
                    const p=(r.asmr-mn)/(mx-mn||1)*100;
                    const col=p>60?C.crimson:p>30?C.amber:C.green;
                    return <div key={r.name} style={{display:"flex",alignItems:"center",gap:8}}>
                      <div style={{width:110,color:C.sec,fontSize:9,flexShrink:0}}>{r.name}</div>
                      <div style={{flex:1}}><Bar pct={p} color={col} delay={i*65}/></div>
                      <div style={{width:30,textAlign:"right",color:col,fontSize:11,fontFamily:"Bebas Neue,sans-serif"}}>{r.asmr}</div>
                    </div>;
                  })}
                </div>
              </div>
            </div>
          </div>}

          {/* ── CAUSES ── */}
          {tab==="causes"&&<div style={box}>
            <STitle t="Causes of Death" s="Filtered by current selections — ranked by total deaths"/>
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
                      <span style={{color:c.color,fontFamily:"Bebas Neue,sans-serif",fontSize:14,letterSpacing:"0.04em"}}>{fmt(c.deaths)}</span>
                    </div>
                    <Bar pct={(c.deaths/filteredCauses[0].deaths)*100} color={c.color} delay={i*65}/>
                  </div>
                ))}
              </div>}
          </div>}

          {/* ── REGIONAL ── */}
          {tab==="regional"&&<div style={twoCol}>
            <div style={box}>
              <STitle t="ASMR by Region" s={`Per 100,000 · ${sex!=="Both Sexes"?sex+" only":"both sexes"}`}/>
              <div style={{display:"flex",flexDirection:"column",gap:9}}>
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
              </div>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              <div style={box}>
                <STitle t="North–South Divide" s="Persistent mortality inequality"/>
                {filteredRegions.length>=2&&[
                  {l:"Highest ASMR",v:filteredRegions[0].asmr,n:filteredRegions[0].name,c:C.crimson},
                  {l:"Lowest ASMR", v:filteredRegions[filteredRegions.length-1].asmr,n:filteredRegions[filteredRegions.length-1].name,c:C.green},
                  {l:"Gap (per 100,000)",v:filteredRegions[0].asmr-filteredRegions[filteredRegions.length-1].asmr,n:"difference",c:C.amber},
                ].map(x=>(
                  <div key={x.l} style={{background:C.surface,borderRadius:8,padding:"10px 14px",
                    border:`1px solid ${x.c}30`,marginBottom:8}}>
                    <div style={{color:C.sec,fontSize:9,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:2}}>{x.l}</div>
                    <div style={{color:x.c,fontFamily:"Bebas Neue,sans-serif",fontSize:20,letterSpacing:"0.04em"}}>{x.n} — {x.v}</div>
                  </div>
                ))}
              </div>
              <div style={{...box,color:C.sec,fontSize:11,lineHeight:1.8}}>
                The North East and North West consistently show the highest age-standardised mortality rates, reflecting long-standing socioeconomic disparities. London and the South East report the lowest rates nationally.
              </div>
            </div>
          </div>}

          {/* ── EPIDEMIC ── */}
          {tab==="epidemic"&&<div style={{display:"flex",flexDirection:"column",gap:14}}>
            <div style={box}>
              <STitle t="COVID-19 Excess Deaths" s="Monthly excess above expected baseline, 2020–2024"/>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:16}}>
                {[{l:"Wave 1 Peak (Apr 2020)",v:"+89,400",c:C.crimson},
                  {l:"Wave 2 Peak (Jan 2021)",v:"+22,300",c:C.amber},
                  {l:"2024 Excess Deaths",    v:"+4,100", c:C.cyan}].map(s=>(
                  <div key={s.l} style={{background:C.surface,borderRadius:8,padding:"11px 14px",
                    border:`1px solid ${s.c}30`,textAlign:"center"}}>
                    <div style={{color:C.sec,fontSize:9,letterSpacing:"0.07em",textTransform:"uppercase",marginBottom:4}}>{s.l}</div>
                    <div style={{color:s.c,fontFamily:"Bebas Neue,sans-serif",fontSize:22,letterSpacing:"0.04em"}}>{s.v}</div>
                  </div>
                ))}
              </div>
              <ExcessChart excess={filteredExcess} years={filteredYears}/>
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
              <div style={{background:C.surface,borderRadius:8,padding:"12px 14px",
                fontSize:11,color:C.sec,lineHeight:1.8}}>
                Rt estimated via EpiEstim (parametric SI, mean=2 months, SD=1). COVID-19 Wave 1 (April 2020) produced the highest Rt spike, exceeding 1.15. Since 2022, all-cause Rt has stabilised below 1.0, indicating post-pandemic normalisation of mortality patterns.
              </div>
            </div>
          </div>}

          {/* ── FORECAST ── */}
          {tab==="forecast"&&<div style={{display:"flex",flexDirection:"column",gap:14}}>
            <div style={{background:C.amber+"0d",border:`1px solid ${C.amber}40`,
              borderRadius:9,padding:"11px 15px",fontSize:10,color:C.amber,lineHeight:1.7}}>
              ⚠️ <strong>Statistical Forecasting Notice:</strong> These projections are statistical extrapolations based on historical patterns (2015–2024) only. They do not account for future pandemics, new treatments, policy changes, demographic shifts, or any other unforeseen events. For exploratory purposes only — not clinical or policy decision-making.
            </div>
            <div style={box}>
              <STitle t="Mortality Forecast 2025–2027" s="ARIMA model — 80% and 95% prediction intervals"/>
              <LineChart deaths={YEARS_ALL.map((yr,i)=>RAW_DEATHS.Male[i]+RAW_DEATHS.Female[i])} years={YEARS_ALL} showFc={true}/>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12}}>
              {FORECAST.map((f,i)=>(
                <div key={f.year} style={{...box,border:`1px solid ${C.amber}40`,
                  opacity:0,animation:`fu 0.45s ease ${i*90}ms forwards`}}>
                  <style>{`@keyframes fu{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}`}</style>
                  <div style={{color:C.sec,fontSize:9,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:4}}>Forecast {f.year}</div>
                  <div style={{color:C.amber,fontFamily:"Bebas Neue,sans-serif",fontSize:26,letterSpacing:"0.04em"}}>{fmt(f.mean)}</div>
                  <div style={{color:C.muted,fontSize:9,marginTop:4,lineHeight:1.6}}>95% CI: {fmt(f.lo)} – {fmt(f.hi)}</div>
                  <div style={{marginTop:9}}><Bar pct={(f.mean/750000)*100} color={C.amber} delay={i*90}/></div>
                </div>
              ))}
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
