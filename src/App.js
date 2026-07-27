import { useState, useMemo, useEffect } from "react";
import { db } from "./firebase";
import { collection, doc, setDoc, deleteDoc, onSnapshot, getDoc } from "firebase/firestore";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail, updateProfile } from "firebase/auth";
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";

const auth = getAuth();
const provider = new GoogleAuthProvider();
const storage = getStorage();

// Brand colors (fixed across themes) + theme tokens via CSS variables.
// The neutral surface/text tokens resolve to CSS custom properties so they
// flip automatically when the [data-theme] attribute changes on <html>.
const B = {
  navy:"var(--c-navy)", navyMid:"var(--c-navyMid)", navyLight:"var(--c-navyLight)",
  green:"#33D69F", greenDim:"#1FAA7C", greenPale:"rgba(51,214,159,.12)",
  accent:"#0ED492", white:"#FFFFFF", gray:"#E8EEF2", grayMid:"var(--c-grayMid)",
  text:"var(--c-text)", textSub:"var(--c-textSub)", textMuted:"var(--c-textMuted)",
  bg:"var(--c-bg)", bgCard:"var(--c-bgCard)", border:"var(--c-border)",
  danger:"#F43F5E", warning:"#F59E0B",
};

const THEMES={
  light:{
    "--c-navy":"#071C2C","--c-navyMid":"#0A2540","--c-navyLight":"#0e2f4a",
    "--c-grayMid":"#C4D0D8","--c-text":"#071C2C","--c-textSub":"#4A6A7A","--c-textMuted":"#7A9AAA",
    "--c-bg":"#F0F5F9","--c-bgCard":"#FFFFFF","--c-border":"#DCE5EC",
  },
  dark:{
    // Header/nav stay deep navy; surfaces become dark slate, text inverts to light.
    "--c-navy":"#0A1520","--c-navyMid":"#0E1E2E","--c-navyLight":"#13283b",
    "--c-grayMid":"#3A4A56","--c-text":"#E8EEF2","--c-textSub":"#A8BCC8","--c-textMuted":"#6E8694",
    "--c-bg":"#0B1419","--c-bgCard":"#11202B","--c-border":"#1E3340",
  },
};

function applyTheme(theme){
  const vars=THEMES[theme]||THEMES.light;
  const root=document.documentElement;
  Object.entries(vars).forEach(([k,v])=>root.style.setProperty(k,v));
  root.setAttribute("data-theme",theme);
  root.style.background=vars["--c-bg"];
  document.body&&(document.body.style.background=vars["--c-bg"]);
}

const Icon = ({ d, size=16, stroke="currentColor", fill="none", strokeWidth=1.8 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"><path d={d}/></svg>
);
const ic = {
  eye:"M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6",
  eyeOff:"M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24 M1 1l22 22",
  user:"M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  plus:"M12 5v14M5 12h14", check:"M20 6L9 17l-5-5", trash:"M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6",
  edit:"M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z",
  car:"M5 17H3a2 2 0 01-2-2V9a2 2 0 012-2h14l4 4v4a2 2 0 01-2 2h-2M5 17a2 2 0 104 0 2 2 0 00-4 0zm10 0a2 2 0 104 0 2 2 0 00-4 0z",
  home:"M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z M9 22V12h6v10",
  heart:"M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z",
  bolt:"M13 2L3 14h9l-1 8 10-12h-9l1-8z",
  chart:"M18 20V10M12 20V4M6 20v-6",
  warning:"M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01",
  x:"M18 6L6 18M6 6l12 12", chevron_right:"M9 18l6-6-6-6", chevron_down:"M6 9l6 6 6-6",
  repeat:"M17 1l4 4-4 4M3 11V9a4 4 0 014-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 01-4 4H3",
  target:"M12 22a10 10 0 100-20 10 10 0 000 20zM12 18a6 6 0 100-12 6 6 0 000 12zM12 14a2 2 0 100-4 2 2 0 000 4z",
  wallet:"M21 12V7H5a2 2 0 010-4h14v4M3 5v14a2 2 0 002 2h16v-5M3 5a2 2 0 000 4M21 16a1 1 0 110 2 1 1 0 010-2z",
  tag:"M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82zM7 7h.01",
  grid:"M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z",
  coin:"M12 2a10 10 0 100 20A10 10 0 0012 2zM12 8v8M8 12h8",
  logout:"M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9",
  filter:"M22 3H2l8 9.46V19l4 2v-8.54L22 3z",
  star:"M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z",
  credit:"M1 4h22v4H1zM1 10h22v10a2 2 0 01-2 2H3a2 2 0 01-2-2V10zM6 16h4",
  plane:"M21 16v-2l-8-5V3.5a1.5 1.5 0 00-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z",
  users:"M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75",
  key:"M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4",
  mic:"M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3zM19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8",
  send:"M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z",
  bot:"M12 2a2 2 0 012 2v1h3a2 2 0 012 2v10a2 2 0 01-2 2H7a2 2 0 01-2-2V7a2 2 0 012-2h3V4a2 2 0 012-2zM9 12h.01M15 12h.01M9 16s1 1 3 1 3-1 3-1",
  sparkle:"M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3zM5 17l.75 2.25L8 20l-2.25.75L5 23l-.75-2.25L2 20l2.25-.75L5 17z",
  sun:"M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42M12 8a4 4 0 100 8 4 4 0 000-8z",
  moon:"M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z",
};

const MONTHS_FULL=["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const MONTHS=["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const fmt=(v)=>(v||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const pct=(part,total)=>total===0?0:Math.min(100,Math.round((part/total)*100));
const TODAY=new Date();
const CURRENT_MONTH=TODAY.getMonth();
const CURRENT_YEAR=TODAY.getFullYear();
const genCode=()=>"CASA-"+Math.random().toString(36).substring(2,6).toUpperCase();

const DEFAULT_GROUPS=[
  {id:"g1",name:"Moradia",icon:"home",color:"#6366f1"},
  {id:"g2",name:"Transporte",icon:"car",color:B.warning},
  {id:"g3",name:"Saúde",icon:"heart",color:"#ec4899"},
  {id:"g4",name:"Energia & Utilities",icon:"bolt",color:B.green},
];
const DEFAULT_REV_GROUPS=[
  {id:"rg1",name:"Salário",icon:"wallet",color:B.green},
  {id:"rg2",name:"Freelance",icon:"star",color:"#6366f1"},
  {id:"rg3",name:"Outros",icon:"coin",color:B.warning},
];

function SplashScreen({onDone}){
  useEffect(()=>{const t=setTimeout(onDone,2800);return()=>clearTimeout(t);},[onDone]);
  return(
    <div style={{position:"fixed",inset:0,zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",background:"#071C2C",flexDirection:"column"}}>
      <div style={{position:"absolute",inset:0,backgroundImage:`radial-gradient(ellipse at 30% 40%,rgba(51,214,159,.09) 0%,transparent 60%), radial-gradient(ellipse at 75% 65%,rgba(51,214,159,.05) 0%,transparent 55%)`}}/>
      <div style={{position:"relative",zIndex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:20}}>
        <div style={{animation:"logo-pop 0.7s cubic-bezier(.34,1.56,.64,1) forwards",opacity:0}}>
          <div style={{width:100,height:100,borderRadius:28,background:"rgba(51,214,159,.08)",border:`1.5px solid rgba(51,214,159,.22)`,display:"flex",alignItems:"center",justifyContent:"center",boxShadow:`0 0 60px rgba(51,214,159,.12), inset 0 1px 0 rgba(255,255,255,.06)`}}>
            <svg width="58" height="58" viewBox="0 0 52 52" fill="none">
              <polygon points="26,10 42,23 10,23" fill="#33D69F" opacity=".14"/>
              <line x1="26" y1="10" x2="42" y2="23" stroke="#33D69F" strokeWidth="2.2" strokeLinecap="round"/>
              <line x1="26" y1="10" x2="10" y2="23" stroke="#33D69F" strokeWidth="2.2" strokeLinecap="round"/>
              <rect x="14" y="23" width="24" height="17" rx="2.5" fill="none" stroke="#33D69F" strokeWidth="1.7"/>
              <polyline points="17,37 21,32 26,34 35,26" stroke="#33D69F" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
              <circle cx="35" cy="26" r="2.2" fill="#33D69F"/>
            </svg>
          </div>
        </div>
        <div style={{animation:"fade-up 0.6s ease 0.5s both",textAlign:"center"}}>
          <div style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:36,fontWeight:900,color:"#E8F4F0",letterSpacing:-1.2,lineHeight:1}}>Dom<span style={{color:"rgba(51,214,159,.3)",margin:"0 8px",fontWeight:200}}>/</span><span style={{color:"#33D69F"}}>Donna</span></div>
          <div style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:10,letterSpacing:"0.16em",color:"rgba(51,214,159,.45)",fontWeight:700,marginTop:10,textTransform:"uppercase"}}>Seu concierge digital pessoal</div>
        </div>
        <div style={{animation:"fade-up 0.6s ease 0.8s both",width:180,height:1,background:`linear-gradient(90deg,transparent,rgba(51,214,159,.5),transparent)`,borderRadius:99,marginTop:4}}/>
        <div style={{display:"flex",gap:8,animation:"fade-up 0.6s ease 1s both"}}>
          {[0,0.2,0.4].map((d,i)=><div key={i} style={{width:6,height:6,borderRadius:"50%",background:"#33D69F",animation:`dot-bounce 1.2s ease ${d}s infinite`}}/>)}
        </div>
      </div>
      <style>{`
        @keyframes logo-pop{0%{transform:scale(0) rotate(-10deg);opacity:0}60%{transform:scale(1.1) rotate(2deg)}100%{transform:scale(1) rotate(0deg);opacity:1}}
        @keyframes fade-up{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
        @keyframes dot-bounce{0%,80%,100%{transform:scale(0.6);opacity:.4}40%{transform:scale(1);opacity:1}}
      `}</style>
    </div>
  );
}
function LoginScreen(){
  const [loading,setLoading]=useState(false);
  const [mode,setMode]=useState("main"); // main | email-login | email-register | reset
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [name,setName]=useState("");
  const [confirmPassword,setConfirmPassword]=useState("");
  const [error,setError]=useState("");
  const [resetSent,setResetSent]=useState(false);

  const handleGoogle=async()=>{setLoading(true);setError("");try{await signInWithPopup(auth,provider);}catch(e){setError("Erro ao entrar com Google.");setLoading(false);}};

  const handleEmailLogin=async()=>{
    if(!email||!password){setError("Preencha email e senha.");return;}
    setLoading(true);setError("");
    try{await signInWithEmailAndPassword(auth,email,password);}
    catch(e){
      if(e.code==="auth/user-not-found"||e.code==="auth/wrong-password"||e.code==="auth/invalid-credential")setError("Email ou senha incorretos.");
      else setError("Erro ao entrar. Tente novamente.");
      setLoading(false);
    }
  };

  const handleEmailRegister=async()=>{
    if(!email||!password||!name||!confirmPassword){setError("Preencha todos os campos.");return;}
    if(password.length<6){setError("A senha deve ter pelo menos 6 caracteres.");return;}
    if(password!==confirmPassword){setError("As senhas não coincidem.");return;}
    setLoading(true);setError("");
    try{
      const cred=await createUserWithEmailAndPassword(auth,email,password);
      await updateProfile(cred.user,{displayName:name});
    }catch(e){
      if(e.code==="auth/email-already-in-use")setError("Este email já está cadastrado.");
      else setError("Erro ao criar conta. Tente novamente.");
      setLoading(false);
    }
  };

  const handleReset=async()=>{
    if(!email){setError("Digite seu email para recuperar a senha.");return;}
    setLoading(true);setError("");
    try{await sendPasswordResetEmail(auth,email);setResetSent(true);}
    catch(e){setError("Email não encontrado.");setLoading(false);}
  };

  const inp={width:"100%",padding:"12px 14px",border:`1.5px solid rgba(51,214,159,.2)`,borderRadius:10,fontSize:14,color:B.white,background:"rgba(255,255,255,.06)",boxSizing:"border-box",outline:"none",fontFamily:"'Plus Jakarta Sans',sans-serif"};

  return(
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:B.navy,padding:16,fontFamily:"'Plus Jakarta Sans',sans-serif",position:"relative"}}>
      <div style={{position:"absolute",inset:0,backgroundImage:`radial-gradient(ellipse at 25% 50%,rgba(51,214,159,.07) 0%,transparent 55%)`}}/>
      <div style={{background:"rgba(255,255,255,.03)",backdropFilter:"blur(24px)",border:"1px solid rgba(51,214,159,.12)",borderRadius:24,padding:32,maxWidth:380,width:"100%",display:"flex",flexDirection:"column",alignItems:"center",gap:14,position:"relative",zIndex:1,animation:"fade-up 0.6s ease",boxShadow:"0 40px 80px rgba(0,0,0,.5)"}}>
        <div style={{width:72,height:72,borderRadius:20,background:B.navyMid,border:`1.5px solid rgba(51,214,159,.2)`,display:"flex",alignItems:"center",justifyContent:"center",marginBottom:2}}>
          <svg width="42" height="42" viewBox="0 0 52 52" fill="none">
            <polygon points="26,10 42,23 10,23" fill="#33D69F" opacity=".14"/>
            <line x1="26" y1="10" x2="42" y2="23" stroke="#33D69F" strokeWidth="2.4" strokeLinecap="round"/>
            <line x1="26" y1="10" x2="10" y2="23" stroke="#33D69F" strokeWidth="2.4" strokeLinecap="round"/>
            <rect x="14" y="23" width="24" height="17" rx="2.5" fill="none" stroke="#33D69F" strokeWidth="1.8"/>
            <polyline points="17,37 21,32 26,34 35,26" stroke="#0ED492" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
            <circle cx="35" cy="26" r="2.4" fill="#33D69F"/>
          </svg>
        </div>
        <div style={{fontSize:26,fontWeight:800,color:B.white,letterSpacing:-0.5}}>Home<span style={{color:B.green}}> Finance</span></div>
        <div style={{fontSize:10,letterSpacing:"0.18em",color:"#2C6E7A",fontWeight:600,textTransform:"uppercase",marginTop:-8}}>Controle Financeiro Doméstico</div>
        <div style={{width:"100%",height:1,background:"rgba(51,214,159,.1)",margin:"4px 0"}}/>

        {mode==="main"&&(<>
          <div style={{fontSize:16,fontWeight:700,color:B.white}}>Bem-vindo de volta!</div>
          <div style={{fontSize:13,color:B.textMuted,textAlign:"center"}}>Escolha como deseja entrar.</div>
          <button style={{display:"flex",alignItems:"center",gap:12,background:B.white,color:B.text,border:"none",borderRadius:12,padding:"13px 20px",fontSize:14,fontWeight:700,cursor:"pointer",width:"100%",justifyContent:"center",opacity:loading?0.7:1,fontFamily:"'Plus Jakarta Sans',sans-serif"}} onClick={handleGoogle} disabled={loading}>
            <svg width="20" height="20" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            {loading?"Entrando...":"Entrar com Google"}
          </button>
          <div style={{display:"flex",alignItems:"center",gap:10,width:"100%"}}>
            <div style={{flex:1,height:1,background:"rgba(51,214,159,.1)"}}/>
            <span style={{fontSize:11,color:"#2C6E7A"}}>ou</span>
            <div style={{flex:1,height:1,background:"rgba(51,214,159,.1)"}}/>
          </div>
          <button style={{display:"flex",alignItems:"center",gap:10,background:"transparent",color:B.white,border:"1.5px solid rgba(51,214,159,.25)",borderRadius:12,padding:"13px 20px",fontSize:14,fontWeight:600,cursor:"pointer",width:"100%",justifyContent:"center",fontFamily:"'Plus Jakarta Sans',sans-serif"}} onClick={()=>{setMode("email-login");setError("");}}>
            ✉️ Entrar com Email
          </button>
          <button style={{fontSize:12,color:B.green,background:"none",border:"none",cursor:"pointer",fontFamily:"'Plus Jakarta Sans',sans-serif",fontWeight:600}} onClick={()=>{setMode("email-register");setError("");}}>
            Criar conta com email
          </button>
        </>)}

        {mode==="email-login"&&(<>
          <div style={{fontSize:16,fontWeight:700,color:B.white,alignSelf:"flex-start"}}>Entrar com email</div>
          <input style={inp} type="email" placeholder="Seu email" value={email} onChange={e=>setEmail(e.target.value)}/>
          <input style={inp} type="password" placeholder="Senha" value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleEmailLogin()}/>
          {error&&<div style={{fontSize:12,color:B.danger,textAlign:"center",width:"100%"}}>{error}</div>}
          <button style={{display:"flex",alignItems:"center",justifyContent:"center",background:B.green,color:B.navy,border:"none",borderRadius:12,padding:"13px 20px",fontSize:14,fontWeight:700,cursor:"pointer",width:"100%",opacity:loading?0.7:1,fontFamily:"'Plus Jakarta Sans',sans-serif"}} onClick={handleEmailLogin} disabled={loading}>
            {loading?"Entrando...":"Entrar"}
          </button>
          <button style={{fontSize:12,color:B.textMuted,background:"none",border:"none",cursor:"pointer",fontFamily:"'Plus Jakarta Sans',sans-serif"}} onClick={()=>{setMode("reset");setError("");}}>
            Esqueci minha senha
          </button>
          <button style={{fontSize:12,color:B.green,background:"none",border:"none",cursor:"pointer",fontFamily:"'Plus Jakarta Sans',sans-serif",fontWeight:600}} onClick={()=>{setMode("main");setError("");}}>
            ← Voltar
          </button>
        </>)}

        {mode==="email-register"&&(<>
          <div style={{fontSize:16,fontWeight:700,color:B.white,alignSelf:"flex-start"}}>Criar conta</div>
          <input style={inp} type="text" placeholder="Seu nome completo" value={name} onChange={e=>setName(e.target.value)}/>
          <input style={inp} type="email" placeholder="Seu email" value={email} onChange={e=>setEmail(e.target.value)}/>
          <input style={inp} type="password" placeholder="Senha (mín. 6 caracteres)" value={password} onChange={e=>setPassword(e.target.value)}/>
          <input style={inp} type="password" placeholder="Confirme sua senha" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleEmailRegister()}/>
          {error&&<div style={{fontSize:12,color:B.danger,textAlign:"center",width:"100%"}}>{error}</div>}
          <button style={{display:"flex",alignItems:"center",justifyContent:"center",background:B.green,color:B.navy,border:"none",borderRadius:12,padding:"13px 20px",fontSize:14,fontWeight:700,cursor:"pointer",width:"100%",opacity:loading?0.7:1,fontFamily:"'Plus Jakarta Sans',sans-serif"}} onClick={handleEmailRegister} disabled={loading}>
            {loading?"Criando conta...":"Criar conta"}
          </button>
          <button style={{fontSize:12,color:B.green,background:"none",border:"none",cursor:"pointer",fontFamily:"'Plus Jakarta Sans',sans-serif",fontWeight:600}} onClick={()=>{setMode("main");setError("");}}>
            ← Voltar
          </button>
        </>)}

        {mode==="reset"&&(<>
          <div style={{fontSize:16,fontWeight:700,color:B.white,alignSelf:"flex-start"}}>Recuperar senha</div>
          {resetSent?(<>
            <div style={{fontSize:13,color:B.green,textAlign:"center"}}>✅ Email enviado! Verifique sua caixa de entrada.</div>
            <button style={{fontSize:12,color:B.green,background:"none",border:"none",cursor:"pointer",fontFamily:"'Plus Jakarta Sans',sans-serif",fontWeight:600}} onClick={()=>{setMode("email-login");setResetSent(false);setError("");}}>
              ← Voltar para login
            </button>
          </>):(<>
            <div style={{fontSize:13,color:B.textMuted,textAlign:"center"}}>Digite seu email e enviaremos um link para redefinir sua senha.</div>
            <input style={inp} type="email" placeholder="Seu email" value={email} onChange={e=>setEmail(e.target.value)}/>
            {error&&<div style={{fontSize:12,color:B.danger,textAlign:"center",width:"100%"}}>{error}</div>}
            <button style={{display:"flex",alignItems:"center",justifyContent:"center",background:B.green,color:B.navy,border:"none",borderRadius:12,padding:"13px 20px",fontSize:14,fontWeight:700,cursor:"pointer",width:"100%",opacity:loading?0.7:1,fontFamily:"'Plus Jakarta Sans',sans-serif"}} onClick={handleReset} disabled={loading}>
              {loading?"Enviando...":"Enviar link de recuperação"}
            </button>
            <button style={{fontSize:12,color:B.green,background:"none",border:"none",cursor:"pointer",fontFamily:"'Plus Jakarta Sans',sans-serif",fontWeight:600}} onClick={()=>{setMode("email-login");setError("");}}>
              ← Voltar
            </button>
          </>)}
        </>)}

        <div style={{fontSize:11,color:"#2C6E7A"}}>🔒 Seus dados são privados e protegidos</div>
      </div>
      <style>{`@keyframes fade-up{from{opacity:0;transform:translateY(30px)}to{opacity:1;transform:translateY(0)}}input::placeholder{color:#2C6E7A;}`}</style>
    </div>
  );
}
function FamilySetup({user,onComplete}){
  const [mode,setMode]=useState(null);
  const [code,setCode]=useState("");
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");

  const createFamily=async()=>{
    setLoading(true);
    const familyId=`fam_${Date.now()}`;
    const inviteCode=genCode();
    const familyData={id:familyId,inviteCode,createdBy:user.uid,members:[{uid:user.uid,name:user.displayName,photo:user.photoURL,role:"admin"}],createdAt:new Date().toISOString()};
    await setDoc(doc(db,"families",familyId),familyData);
    await setDoc(doc(db,"userFamily",user.uid),{familyId,role:"admin"});
    onComplete(familyId);
  };

  const joinFamily=async()=>{
    setLoading(true);setError("");
    try{
      const {getDocs,query,collection:col,where}=await import("firebase/firestore");
      const q=query(col(db,"families"),where("inviteCode","==",code.trim().toUpperCase()));
      const res=await getDocs(q);
      if(res.empty){setError("Código inválido. Verifique e tente novamente.");setLoading(false);return;}
      const famData=res.docs[0].data();
      const updated={...famData,members:[...famData.members,{uid:user.uid,name:user.displayName,photo:user.photoURL,role:"member"}]};
      await setDoc(doc(db,"families",famData.id),updated);
      await setDoc(doc(db,"userFamily",user.uid),{familyId:famData.id,role:"member"});
      onComplete(famData.id);
    }catch(e){setError("Erro ao entrar. Tente novamente.");setLoading(false);}
  };

  return(
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:B.navy,padding:16,fontFamily:"'Plus Jakarta Sans',sans-serif"}}>
      <div style={{background:"rgba(255,255,255,.03)",backdropFilter:"blur(24px)",border:"1px solid rgba(51,214,159,.12)",borderRadius:24,padding:32,maxWidth:400,width:"100%",display:"flex",flexDirection:"column",gap:16}}>
        <div style={{textAlign:"center"}}>
          <div style={{fontSize:40,marginBottom:8}}>🏠</div>
          <div style={{fontSize:22,fontWeight:800,color:B.white}}>Configurar Família</div>
          <div style={{fontSize:13,color:B.textMuted,marginTop:4}}>Olá, {user.displayName?.split(" ")[0]}! Como deseja continuar?</div>
        </div>
        {!mode&&(
          <div style={{display:"flex",flexDirection:"column",gap:12,marginTop:8}}>
            <button style={{padding:"16px",background:B.green,color:"#071C2C",border:"none",borderRadius:14,fontWeight:700,fontSize:15,cursor:"pointer",fontFamily:"'Plus Jakarta Sans',sans-serif",display:"flex",alignItems:"center",justifyContent:"center",gap:10}} onClick={()=>setMode("create")}>
              <Icon d={ic.users} size={20} stroke={B.navy}/> Criar nova família
            </button>
            <button style={{padding:"16px",background:"rgba(255,255,255,.06)",color:B.white,border:"1px solid rgba(51,214,159,.2)",borderRadius:14,fontWeight:600,fontSize:15,cursor:"pointer",fontFamily:"'Plus Jakarta Sans',sans-serif",display:"flex",alignItems:"center",justifyContent:"center",gap:10}} onClick={()=>setMode("join")}>
              <Icon d={ic.key} size={20} stroke={B.green}/> Entrar com código de convite
            </button>
          </div>
        )}
        {mode==="create"&&(
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <div style={{background:"rgba(51,214,159,.08)",borderRadius:12,padding:16,textAlign:"center"}}>
              <div style={{fontSize:13,color:B.grayMid,marginBottom:4}}>Você será o administrador da família.</div>
              <div style={{fontSize:12,color:B.textMuted}}>Após criar, compartilhe o código de convite com sua esposa.</div>
            </div>
            <button style={{padding:"14px",background:B.green,color:"#071C2C",border:"none",borderRadius:12,fontWeight:700,fontSize:14,cursor:"pointer",fontFamily:"'Plus Jakarta Sans',sans-serif",opacity:loading?0.7:1}} onClick={createFamily} disabled={loading}>
              {loading?"Criando...":"✓ Criar minha família"}
            </button>
            <button style={{padding:"10px",background:"transparent",color:B.textMuted,border:"none",cursor:"pointer",fontSize:13}} onClick={()=>setMode(null)}>← Voltar</button>
          </div>
        )}
        {mode==="join"&&(
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <div style={{fontSize:13,color:B.grayMid}}>Digite o código de convite:</div>
            <input style={{padding:"12px",border:"1px solid rgba(51,214,159,.2)",borderRadius:10,background:"rgba(255,255,255,.06)",color:B.white,textAlign:"center",fontSize:20,fontWeight:700,letterSpacing:4,fontFamily:"'Plus Jakarta Sans',sans-serif",outline:"none"}} value={code} onChange={e=>setCode(e.target.value.toUpperCase())} placeholder="CASA-XXXX"/>
            {error&&<div style={{fontSize:12,color:B.danger,textAlign:"center"}}>{error}</div>}
            <button style={{padding:"14px",background:B.green,color:"#071C2C",border:"none",borderRadius:12,fontWeight:700,fontSize:14,cursor:"pointer",fontFamily:"'Plus Jakarta Sans',sans-serif",opacity:loading?0.7:1}} onClick={joinFamily} disabled={loading||!code}>
              {loading?"Entrando...":"Entrar na família"}
            </button>
            <button style={{padding:"10px",background:"transparent",color:B.textMuted,border:"none",cursor:"pointer",fontSize:13}} onClick={()=>setMode(null)}>← Voltar</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── ONBOARDING: escolha Dom ou Donna ───────────────────────────────────────
function OnboardingScreen({onChoose}){
  const [chosen,setChosen]=useState(null);
  const [loading,setLoading]=useState(false);
  const choose=(mode)=>{
    setChosen(mode);
    setLoading(true);
    setTimeout(()=>{
      try{localStorage.setItem("dd_mode",mode);}catch(e){}
      onChoose(mode);
    },800);
  };
  return(
    <div style={{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:"#071C2C",padding:24,fontFamily:"'Plus Jakarta Sans',sans-serif",position:"relative",overflow:"hidden"}}>
      <div style={{position:"absolute",inset:0,background:"radial-gradient(ellipse 55% 45% at 25% 35%, rgba(51,214,159,.09) 0%,transparent 60%)",pointerEvents:"none"}}/>
      <div style={{maxWidth:360,width:"100%",zIndex:1}}>
        <div style={{textAlign:"center",marginBottom:48}}>
          <div style={{width:64,height:64,borderRadius:20,background:"rgba(51,214,159,.09)",border:"1px solid rgba(51,214,159,.2)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 20px",boxShadow:"0 0 32px rgba(51,214,159,.10)"}}>
            <svg width="34" height="34" viewBox="0 0 52 52" fill="none" stroke="#33D69F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="10,23 26,10 42,23"/><rect x="14" y="23" width="24" height="17" rx="2"/>
              <polyline points="17,37 21,32 26,34 35,26"/><circle cx="35" cy="26" r="2" fill="#33D69F" stroke="none"/>
            </svg>
          </div>
          <div style={{fontSize:13,fontWeight:700,color:"rgba(51,214,159,.6)",textTransform:"uppercase",letterSpacing:"0.14em",marginBottom:12}}>Bem-vindo ao</div>
          <div style={{fontSize:38,fontWeight:900,letterSpacing:-1.2,color:"#E8F4F0",lineHeight:1.1,marginBottom:12}}>Dom<span style={{color:"rgba(51,214,159,.3)",margin:"0 8px",fontWeight:200}}>/</span><span style={{color:"#33D69F"}}>Donna</span></div>
          <div style={{fontSize:14,color:"rgba(180,215,205,.6)",fontWeight:500,lineHeight:1.6,marginTop:8}}>Como você prefere que eu me apresente?</div>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <button onClick={()=>choose("dom")} disabled={loading} style={{padding:"22px 24px",borderRadius:20,border:`1.5px solid ${chosen==="dom"?"#33D69F":"rgba(255,255,255,.08)"}`,background:chosen==="dom"?"rgba(51,214,159,.10)":"rgba(255,255,255,.03)",cursor:"pointer",display:"flex",alignItems:"center",gap:16,fontFamily:"'Plus Jakarta Sans',sans-serif",transition:"all .25s",backdropFilter:"blur(16px)"}}>
            <div style={{width:52,height:52,borderRadius:16,background:"rgba(51,214,159,.08)",border:"1px solid rgba(51,214,159,.2)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#33D69F" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
              </svg>
            </div>
            <div style={{textAlign:"left"}}>
              <div style={{fontSize:20,fontWeight:900,color:"#E8F4F0",letterSpacing:-.3}}>Dom</div>
              <div style={{fontSize:12,color:"rgba(180,215,205,.55)",marginTop:2}}>Seu mordomo digital</div>
            </div>
            {chosen==="dom"&&<div style={{marginLeft:"auto",color:"#33D69F",fontSize:20}}>✓</div>}
          </button>
          <button onClick={()=>choose("donna")} disabled={loading} style={{padding:"22px 24px",borderRadius:20,border:`1.5px solid ${chosen==="donna"?"#33D69F":"rgba(255,255,255,.08)"}`,background:chosen==="donna"?"rgba(51,214,159,.10)":"rgba(255,255,255,.03)",cursor:"pointer",display:"flex",alignItems:"center",gap:16,fontFamily:"'Plus Jakarta Sans',sans-serif",transition:"all .25s",backdropFilter:"blur(16px)"}}>
            <div style={{width:52,height:52,borderRadius:16,background:"rgba(51,214,159,.08)",border:"1px solid rgba(51,214,159,.2)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#33D69F" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
              </svg>
            </div>
            <div style={{textAlign:"left"}}>
              <div style={{fontSize:20,fontWeight:900,color:"#E8F4F0",letterSpacing:-.3}}>Donna</div>
              <div style={{fontSize:12,color:"rgba(180,215,205,.55)",marginTop:2}}>Sua concierge digital</div>
            </div>
            {chosen==="donna"&&<div style={{marginLeft:"auto",color:"#33D69F",fontSize:20}}>✓</div>}
          </button>
        </div>
        <div style={{marginTop:32,textAlign:"center",fontSize:11,color:"rgba(180,215,205,.3)",fontWeight:500}}>Você poderá alterar essa escolha nas configurações</div>
      </div>
    </div>
  );
}

// ─── PERFIL PROGRESSIVO ──────────────────────────────────────────────────────
function ProfileModal({user,domMode,profile,onSave,onClose}){
  const [name,setName]=useState(profile.name||user?.displayName||"");
  const [birthdate,setBirthdate]=useState(profile.birthdate||"");
  const [weight,setWeight]=useState(profile.weight||"");
  const [height,setHeight]=useState(profile.height||"");
  const [photoUrl,setPhotoUrl]=useState(profile.photoUrl||user?.photoURL||"");
  const [saving,setSaving]=useState(false);

  const imc=weight&&height?((parseFloat(weight)/((parseFloat(height)/100)**2)).toFixed(1)):null;
  const imcLabel=imc?imc<18.5?"Abaixo do peso":imc<25?"Peso ideal":imc<30?"Sobrepeso":"Obesidade":null;
  const imcColor=imc?imc<18.5?"#60a5fa":imc<25?"#33D69F":imc<30?"#fbbf24":"#f87171":"#33D69F";

  const save=async()=>{
    setSaving(true);
    const p={name,birthdate,weight,height,photoUrl,updatedAt:new Date().toISOString()};
    try{localStorage.setItem("dd_profile",JSON.stringify(p));}catch(e){}
    onSave(p);
    setSaving(false);
    onClose();
  };

  const inp={width:"100%",padding:"12px 14px",border:"1.5px solid rgba(51,214,159,.15)",borderRadius:12,fontSize:14,color:"#E8F4F0",background:"rgba(255,255,255,.04)",boxSizing:"border-box",outline:"none",fontFamily:"'Plus Jakarta Sans',sans-serif"};
  const lbl={fontSize:11,fontWeight:700,color:"rgba(51,214,159,.7)",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:6,display:"block"};

  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.7)",zIndex:500,display:"flex",alignItems:"flex-end",backdropFilter:"blur(8px)"}} onClick={onClose}>
      <div style={{width:"100%",maxWidth:420,margin:"0 auto",background:"#0E2A40",borderRadius:"24px 24px 0 0",border:"1px solid rgba(51,214,159,.12)",padding:24,maxHeight:"90vh",overflowY:"auto",fontFamily:"'Plus Jakarta Sans',sans-serif"}} onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24}}>
          <div style={{fontSize:18,fontWeight:800,color:"#E8F4F0"}}>Meu Perfil</div>
          <button onClick={onClose} style={{background:"none",border:"none",color:"rgba(180,215,205,.5)",cursor:"pointer",fontSize:20}}>✕</button>
        </div>

        {/* Foto de perfil */}
        <div style={{textAlign:"center",marginBottom:24}}>
          <div style={{width:80,height:80,borderRadius:24,background:"rgba(51,214,159,.08)",border:"2px solid rgba(51,214,159,.2)",margin:"0 auto",display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden",position:"relative"}}>
            {photoUrl?<img src={photoUrl} alt="perfil" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#33D69F" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>}
          </div>
          <div style={{fontSize:11,color:"rgba(180,215,205,.4)",marginTop:8}}>Foto opcional</div>
        </div>

        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          <div><label style={lbl}>Nome</label><input style={inp} value={name} onChange={e=>setName(e.target.value)} placeholder="Seu nome"/></div>
          <div><label style={lbl}>Data de nascimento</label><input style={inp} type="date" value={birthdate} onChange={e=>setBirthdate(e.target.value)}/></div>
          <div style={{display:"flex",gap:12}}>
            <div style={{flex:1}}><label style={lbl}>Peso (kg)</label><input style={inp} type="number" value={weight} onChange={e=>setWeight(e.target.value)} placeholder="70"/></div>
            <div style={{flex:1}}><label style={lbl}>Altura (cm)</label><input style={inp} type="number" value={height} onChange={e=>setHeight(e.target.value)} placeholder="175"/></div>
          </div>
          {imc&&(<div style={{background:"rgba(51,214,159,.06)",border:`1px solid ${imcColor}30`,borderRadius:12,padding:"12px 16px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span style={{fontSize:12,color:"rgba(180,215,205,.6)"}}>IMC calculado</span>
            <span style={{fontSize:14,fontWeight:800,color:imcColor}}>{imc} · {imcLabel}</span>
          </div>)}
          <div style={{fontSize:11,color:"rgba(180,215,205,.3)",textAlign:"center",marginTop:4}}>Todos os campos são opcionais e privados</div>
          <button onClick={save} disabled={saving} style={{background:"#33D69F",color:"#071C2C",border:"none",borderRadius:14,padding:"14px 24px",fontSize:14,fontWeight:800,cursor:"pointer",fontFamily:"'Plus Jakarta Sans',sans-serif",marginTop:4}}>{saving?"Salvando...":"Salvar perfil"}</button>
        </div>
      </div>
    </div>
  );
}

export default function App(){
  const [splash,setSplash]=useState(true);
  const [user,setUser]=useState(null);
  const [authLoading,setAuthLoading]=useState(true);
  const [familyId,setFamilyId]=useState(null);
  const [familyLoading,setFamilyLoading]=useState(false);
  const [theme,setTheme]=useState(()=>{try{return localStorage.getItem("hf_theme")||"light";}catch(e){return "light";}});

  useEffect(()=>{applyTheme(theme);try{localStorage.setItem("hf_theme",theme);}catch(e){}},[theme]);

  useEffect(()=>{
    const unsub=onAuthStateChanged(auth,async u=>{
      setUser(u);
      if(u){
        setFamilyLoading(true);
        setFamilyId(null);
        const snap=await getDoc(doc(db,"userFamily",u.uid));
        if(snap.exists()) setFamilyId(snap.data().familyId);
        setFamilyLoading(false);
      } else {
        setFamilyId(null);
      }
      setAuthLoading(false);
    });
    return unsub;
  },[]);

  if(splash) return <SplashScreen onDone={()=>setSplash(false)}/>;
  if(authLoading||familyLoading) return <Loading/>;
  if(!user) return <LoginScreen/>;
  if(!domMode) return <OnboardingScreen onChoose={mode=>setDomMode(mode)}/>;
  if(!familyId) return <FamilySetup user={user} onComplete={id=>setFamilyId(id)}/>;
  return <Dashboard user={user} familyId={familyId} theme={theme} setTheme={setTheme} domMode={domMode} userProfile={userProfile} setUserProfile={setUserProfile} showProfile={showProfile} setShowProfile={setShowProfile}/>;
}

function Loading(){return(
  <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",flexDirection:"column",gap:16,fontFamily:"'Plus Jakarta Sans',sans-serif",background:B.navy}}>
    <div style={{fontSize:48}}>🏠</div>
    <div style={{fontSize:22,fontWeight:800,color:"#FFFFFF"}}>Home<span style={{color:"#33D69F"}}> Finance</span></div>
    <div style={{color:"#7A9AAA",fontSize:13}}>Carregando...</div>
  </div>
);}
function Dashboard({user,familyId,theme,setTheme,domMode:domModeProp,userProfile:userProfileProp,setUserProfile,showProfile,setShowProfile}){
  const domMode=domModeProp||"dom";
  const [userProfile,setUserProfileLocal]=useState(userProfileProp||{});
  const setUserProfileCombined=(p)=>{setUserProfileLocal(p);if(setUserProfile)setUserProfile(p);};
  const base=`families/${familyId}`;
  const [activeTab,setActiveTab]=useState("dashboard");
  const [selMonth,setSelMonth]=useState(CURRENT_MONTH);
  const [selYear,setSelYear]=useState(CURRENT_YEAR);
  const [expenses,setExpenses]=useState([]);
  const [groups,setGroups]=useState(DEFAULT_GROUPS);
  const [revenues,setRevenues]=useState([]);
  const [revGroups,setRevGroups]=useState(DEFAULT_REV_GROUPS);
  const [goals,setGoals]=useState([]);
  const [cards,setCards]=useState([]);
  const [miles,setMiles]=useState([]);
  const [members,setMembers]=useState([]);
  const [family,setFamily]=useState(null);
  const [savingGoal,setSavingGoal]=useState(20);
  const [loading,setLoading]=useState(true);
  const [showForm,setShowForm]=useState(false);
  const [editItem,setEditItem]=useState(null);
  const [showGroupForm,setShowGroupForm]=useState(false);
  const [editGroup,setEditGroup]=useState(null);
  const [showRevForm,setShowRevForm]=useState(false);
  const [showRevGroupForm,setShowRevGroupForm]=useState(false);
  const [editRevGroup,setEditRevGroup]=useState(null);
  const [showGoalForm,setShowGoalForm]=useState(false);
  const [selectMode,setSelectMode]=useState(false);
  const [selectedExp,setSelectedExp]=useState([]);
  const [selectRevMode,setSelectRevMode]=useState(false);
  const [selectedRev,setSelectedRev]=useState([]);
  const [editGoal,setEditGoal]=useState(null);
  const [showCardForm,setShowCardForm]=useState(false);
  const [editCard,setEditCard]=useState(null);
  const [showMilesForm,setShowMilesForm]=useState(false);
  const [editMiles,setEditMiles]=useState(null);
  const [showFamilyPanel,setShowFamilyPanel]=useState(false);
  const [showAIPanel,setShowAIPanel]=useState(false);
  const [histFilter,setHistFilter]=useState("all");
  const [memberFilter,setMemberFilter]=useState("all");
  const [toast,setToast]=useState(null);
  const [lightboxGroup,setLightboxGroup]=useState(null);
  const [copiedCode,setCopiedCode]=useState(false);
  const [hideValues,setHideValues]=useState(false);
  const fmtH=(v)=>hideValues?"R$ ••••":fmt(v);
  const [menuOpen,setMenuOpen]=useState(false);
  const [compactMode,setCompactMode]=useState(false);

  const notify=(msg,type="success")=>{setToast({msg,type});setTimeout(()=>setToast(null),3000);};

  useEffect(()=>{
    const unsubs=[
      onSnapshot(collection(db,`${base}/expenses`),snap=>{setExpenses(snap.docs.map(d=>({id:d.id,...d.data()})));setLoading(false);}),
      onSnapshot(collection(db,`${base}/revenues`),snap=>setRevenues(snap.docs.map(d=>({id:d.id,...d.data()})))),
      onSnapshot(collection(db,`${base}/groups`),snap=>{const g=snap.docs.map(d=>({id:d.id,...d.data()}));if(g.length>0)setGroups(g);}),
      onSnapshot(collection(db,`${base}/revGroups`),snap=>{const g=snap.docs.map(d=>({id:d.id,...d.data()}));if(g.length>0)setRevGroups(g);}),
      onSnapshot(collection(db,`${base}/goals`),snap=>setGoals(snap.docs.map(d=>({id:d.id,...d.data()})))),
      onSnapshot(collection(db,`${base}/cards`),snap=>setCards(snap.docs.map(d=>({id:d.id,...d.data()})))),
      onSnapshot(collection(db,`${base}/miles`),snap=>setMiles(snap.docs.map(d=>({id:d.id,...d.data()})))),
      onSnapshot(doc(db,`${base}/settings/prefs`),snap=>{if(snap.exists()&&snap.data().savingGoal)setSavingGoal(snap.data().savingGoal);}),
      onSnapshot(doc(db,"families",familyId),snap=>{if(snap.exists()){setFamily(snap.data());setMembers(snap.data().members||[]);}}),
    ];
    return()=>unsubs.forEach(u=>u());
  },[familyId]);

  const allMonthExpenses=useMemo(()=>expenses.filter(e=>e.month===selMonth&&e.year===selYear),[expenses,selMonth,selYear]);
  const monthExpenses=useMemo(()=>memberFilter==="all"?allMonthExpenses:allMonthExpenses.filter(e=>e.authorUid===memberFilter),[allMonthExpenses,memberFilter]);
  const allMonthRevenues=useMemo(()=>revenues.filter(r=>r.month===selMonth&&r.year===selYear),[revenues,selMonth,selYear]);
  const monthRevenues=useMemo(()=>memberFilter==="all"?allMonthRevenues:allMonthRevenues.filter(r=>r.authorUid===memberFilter),[allMonthRevenues,memberFilter]);
  const totalExpenses=useMemo(()=>monthExpenses.reduce((s,e)=>s+(e.value||0),0),[monthExpenses]);
  const totalRevenue=useMemo(()=>monthRevenues.reduce((s,r)=>s+(r.value||0),0),[monthRevenues]);
  const paidExp=useMemo(()=>monthExpenses.filter(e=>e.paid).reduce((s,e)=>s+(e.value||0),0),[monthExpenses]);
  const receivedRev=useMemo(()=>monthRevenues.filter(r=>r.received).reduce((s,r)=>s+(r.value||0),0),[monthRevenues]);
  const balance=totalRevenue-totalExpenses;
  const savingTarget=totalRevenue*(savingGoal/100);

  const prevMonthBalance=useMemo(()=>{
    const pm=selMonth===0?11:selMonth-1;
    const py=selMonth===0?selYear-1:selYear;
    const prevExp=expenses.filter(e=>e.month===pm&&e.year===py).reduce((s,e)=>s+(e.value||0),0);
    const prevRev=revenues.filter(r=>r.month===pm&&r.year===py).reduce((s,r)=>s+(r.value||0),0);
    return prevRev-prevExp;
  },[expenses,revenues,selMonth,selYear]);

  // Comparativo com mês anterior
  const prevMonthExpenses=useMemo(()=>{
    const pm=selMonth===0?11:selMonth-1;
    const py=selMonth===0?selYear-1:selYear;
    return expenses.filter(e=>e.month===pm&&e.year===py).reduce((s,e)=>s+(e.value||0),0);
  },[expenses,selMonth,selYear]);

  const prevMonthRevenue=useMemo(()=>{
    const pm=selMonth===0?11:selMonth-1;
    const py=selMonth===0?selYear-1:selYear;
    return revenues.filter(r=>r.month===pm&&r.year===py).reduce((s,r)=>s+(r.value||0),0);
  },[revenues,selMonth,selYear]);

  const expDiff=totalExpenses-prevMonthExpenses;
  const expDiffPct=prevMonthExpenses>0?Math.round((expDiff/prevMonthExpenses)*100):0;

  // Previsão de fechamento do mês
  const today=new Date();
  const daysInMonth=new Date(selYear,selMonth+1,0).getDate();
  const dayOfMonth=selMonth===CURRENT_MONTH&&selYear===CURRENT_YEAR?today.getDate():daysInMonth;
  const projectedExpenses=dayOfMonth>0?Math.round((totalExpenses/dayOfMonth)*daysInMonth):totalExpenses;
  const projectedBalance=totalRevenue-projectedExpenses;

  // Alertas de vencimento próximo (próximos 3 dias)
  const upcomingDue=useMemo(()=>{
    const now=new Date();
    return monthExpenses.filter(e=>{
      if(e.paid)return false;
      if(e.dueDate){const d=new Date(e.dueDate);const diff=(d-now)/(1000*60*60*24);return diff>=0&&diff<=3;}
      if(e.dueDay){const d=new Date(selYear,selMonth,e.dueDay);const diff=(d-now)/(1000*60*60*24);return diff>=0&&diff<=3;}
      return false;
    }).sort((a,b)=>{
      const da=a.dueDate?new Date(a.dueDate):new Date(selYear,selMonth,a.dueDay||31);
      const db2=b.dueDate?new Date(b.dueDate):new Date(selYear,selMonth,b.dueDay||31);
      return da-db2;
    });
  },[monthExpenses,selMonth,selYear]);

  // Receitas pendentes
  const pendingRevenues=useMemo(()=>monthRevenues.filter(r=>!r.received),[monthRevenues]);

  // Cartões próximos do limite (>80%)
  const cardsNearLimit=useMemo(()=>cards.filter(c=>{const used=c.used||0;return c.limit>0&&(used/c.limit)>=0.8;}),[cards]);

  const history=useMemo(()=>{
    const arr=[];
    for(let i=11;i>=0;i--){
      let m=CURRENT_MONTH-i;let y=CURRENT_YEAR;
      if(m<0){m+=12;y-=1;}
      const total=expenses.filter(e=>e.month===m&&e.year===y).reduce((s,e)=>s+(e.value||0),0);
      const rev=revenues.filter(r=>r.month===m&&r.year===y).reduce((s,r)=>s+(r.value||0),0);
      arr.push({month:m,year:y,total,rev,label:MONTHS[m]});
    }
    return arr;
  },[expenses,revenues]);

  const alerts=useMemo(()=>{
    const warns=[];
    const pm=selMonth===0?11:selMonth-1;
    const py=selMonth===0?selYear-1:selYear;
    allMonthExpenses.forEach(curr=>{
      const prev=expenses.find(e=>e.description===curr.description&&e.groupId===curr.groupId&&e.month===pm&&e.year===py);
      if(prev&&curr.value>prev.value*1.15)warns.push({desc:curr.description,curr:curr.value,prev:prev.value,pct:Math.round(((curr.value-prev.value)/prev.value)*100)});
    });
    return warns;
  },[allMonthExpenses,expenses,selMonth,selYear]);

  const byGroup=useMemo(()=>
    groups.map(g=>({...g,items:monthExpenses.filter(e=>e.groupId===g.id),total:monthExpenses.filter(e=>e.groupId===g.id).reduce((s,e)=>s+(e.value||0),0)})).filter(g=>g.items.length>0),
    [groups,monthExpenses]
  );

  const pieData=useMemo(()=>{
    const total=byGroup.reduce((s,g)=>s+g.total,0);
    let cum=0;
    return byGroup.map(g=>{const slice=total>0?(g.total/total)*360:0;const start=cum;cum+=slice;return{...g,slice,start,pct:pct(g.total,total)};});
  },[byGroup]);

  const filteredHistory=useMemo(()=>{
    if(histFilter==="all"||histFilter==="revenue") return history;
    return history.map(h=>({...h,total:expenses.filter(e=>e.month===h.month&&e.year===h.year&&e.groupId===histFilter).reduce((s,e)=>s+(e.value||0),0)}));
  },[history,histFilter,expenses]);

  const memberContrib=useMemo(()=>members.map(m=>({...m,expTotal:allMonthExpenses.filter(e=>e.authorUid===m.uid).reduce((s,e)=>s+(e.value||0),0),revTotal:allMonthRevenues.filter(r=>r.authorUid===m.uid).reduce((s,r)=>s+(r.value||0),0)})),[members,allMonthExpenses,allMonthRevenues]);

  // Evolução do saldo dia a dia no mês
  const dailyBalance=useMemo(()=>{
    const daysInMonth=new Date(selYear,selMonth+1,0).getDate();
    const todayDay=selMonth===CURRENT_MONTH&&selYear===CURRENT_YEAR?new Date().getDate():daysInMonth;
    const days=[];
    let cumExp=0;
    const rev=totalRevenue;
    for(let d=1;d<=Math.min(todayDay,daysInMonth);d++){
      const dayExp=monthExpenses.filter(e=>{
        if(e.dueDate){const dd=new Date(e.dueDate);return dd.getDate()===d&&dd.getMonth()===selMonth&&dd.getFullYear()===selYear;}
        if(e.dueDay)return e.dueDay===d;
        return false;
      }).reduce((s,e)=>s+(e.value||0),0);
      cumExp+=dayExp;
      days.push({day:d,balance:rev-cumExp,exp:cumExp});
    }
    return days;
  },[monthExpenses,totalRevenue,selMonth,selYear]);

  const isExpenseOverdue=(item)=>{if(item.paid)return false;if(item.dueDate){const d=new Date(item.dueDate);return d<TODAY;}if(item.dueDay&&item.month===CURRENT_MONTH&&item.year===CURRENT_YEAR)return item.dueDay<TODAY.getDate();if(item.month<CURRENT_MONTH&&item.year<=CURRENT_YEAR)return true;return false;};
  const isRevenueOverdue=(item)=>{if(item.received)return false;if(item.expectedDate){const d=new Date(item.expectedDate);return d<TODAY;}if(item.month<CURRENT_MONTH&&item.year<=CURRENT_YEAR)return true;return false;};

  const togglePaid=async(id)=>{
    const item=expenses.find(e=>e.id===id);
    const nowPaid=!item.paid;
    await setDoc(doc(db,`${base}/expenses`,id),{...item,paid:nowPaid});
    // Sincroniza limite do cartão vinculado
    const cardGroup=groups.find(g=>g.id===item.groupId);
    const isCardGroup=cardGroup&&cardGroup.name.toLowerCase().includes("cart");
    if(isCardGroup){
      const linkedCard=cards.find(c=>c.name===item.description);
      if(linkedCard){
        const newUsed=nowPaid?0:item.value||0;
        await setDoc(doc(db,`${base}/cards`,linkedCard.id),{...linkedCard,used:newUsed});
      }
    }
  };
  const deleteExpense=async(id)=>{
    const item=expenses.find(e=>e.id===id);
    if(item?.attachmentPath){try{await deleteObject(ref(storage,item.attachmentPath));}catch(e){}}
    await deleteDoc(doc(db,`${base}/expenses`,id));
    notify("Despesa removida");
  };

  const uploadAttachment=async(file,path)=>{
    if(!file)return null;
    const maxSize=2*1024*1024; // 2MB
    if(file.size>maxSize){notify("Arquivo muito grande! Máximo 2MB.");return null;}
    const storageRef=ref(storage,path);
    await uploadBytes(storageRef,file);
    const url=await getDownloadURL(storageRef);
    return {url,path,name:file.name,type:file.type};
  };

  const saveExpense=async(data)=>{
    const months=data.recurring?parseInt(data.recurMonths||12):1;
    if(data.id){
      // Atualiza o cartão vinculado automaticamente se for grupo de cartões
      const cardGroup=groups.find(g=>g.id===data.groupId);
      const isCardGroup=cardGroup&&cardGroup.name.toLowerCase().includes("cart");
      if(isCardGroup){
        const linkedCard=cards.find(c=>c.name===data.description);
        if(linkedCard){await setDoc(doc(db,`${base}/cards`,linkedCard.id),{...linkedCard,used:parseFloat(data.value)||0});}
      }
      await setDoc(doc(db,`${base}/expenses`,data.id),{...data,authorUid:data.authorUid||user.uid,authorName:data.authorName||user.displayName});
      if(data.recurring&&data.updateFuture){
        const futureItems=expenses.filter(e=>e.description===data.description&&e.groupId===data.groupId&&e.id!==data.id&&(e.year>data.year||(e.year===data.year&&e.month>data.month)));
        for(const fi of futureItems){await setDoc(doc(db,`${base}/expenses`,fi.id),{...fi,value:data.value,creditor:data.creditor,groupId:data.groupId,recurring:true});}
        notify(`Despesa atualizada em ${futureItems.length+1} meses!`);
      } else if(data.recurring&&data.generateFuture){
        // Nova lógica: gerar meses futuros ao marcar recorrente em edição
        const startMonth=data.month+1;
        const startYear=data.year;
        const totalMonths=parseInt(data.recurMonths||12);
        let created=0;
        for(let i=0;i<totalMonths-1;i++){
          let m=startMonth+i;let y=startYear;
          if(m>11){m-=12;y+=1;}
          // Só cria se não existir lançamento igual nesse mês
          const exists=expenses.find(e=>e.description===data.description&&e.groupId===data.groupId&&e.month===m&&e.year===y);
          if(!exists){
            const id=`exp_${Date.now()}_${i}`;
            let dueDate=data.dueDate;
            if(data.dueDate){const d=new Date(data.dueDate);d.setMonth(d.getMonth()+i+1);dueDate=d.toISOString().slice(0,10);}
            const refMonth=(data.refMonth+i+1)%12;
            const refYear=data.refYear+Math.floor((data.refMonth+i+1)/12);
            await setDoc(doc(db,`${base}/expenses`,id),{...data,id,month:m,year:y,paid:false,dueDate,refMonth,refYear,authorUid:user.uid,authorName:user.displayName});
            created++;
          }
        }
        notify(`Recorrência criada para ${created} meses futuros!`);
      } else notify("Despesa atualizada!");
    } else {
      for(let i=0;i<months;i++){
        let m=data.month+i;let y=data.year;
        if(m>11){m-=12;y+=1;}
        const id=`exp_${Date.now()}_${i}`;
        let dueDate=data.dueDate;
        if(data.recurring&&data.dueDate&&i>0){const d=new Date(data.dueDate);d.setMonth(d.getMonth()+i);dueDate=d.toISOString().slice(0,10);}
        const refMonth=(data.refMonth+i)%12;
        const refYear=data.refYear+Math.floor((data.refMonth+i)/12);
        let attachment=data.attachment||null;
        if(i===0&&data.attachmentFile){attachment=await uploadAttachment(data.attachmentFile,`families/${familyId}/expenses/${id}_${data.attachmentFile.name}`);}
        await setDoc(doc(db,`${base}/expenses`,id),{...data,id,month:m,year:y,paid:i===0?(data.paid||false):false,dueDate,refMonth,refYear,authorUid:user.uid,authorName:user.displayName,observation:data.observation||"",attachment:attachment||null,attachmentFile:null});
      }
      notify(months>1?`Lançado para ${months} meses!`:"Despesa adicionada!");
    }
    setShowForm(false);setEditItem(null);
  };

  const saveGroup=async(name,icon,color,id)=>{
    if(id){await setDoc(doc(db,`${base}/groups`,id),{id,name,icon,color});notify("Grupo atualizado!");}
    else{for(const g of groups){await setDoc(doc(db,`${base}/groups`,g.id),g);}const newId=`g_${Date.now()}`;await setDoc(doc(db,`${base}/groups`,newId),{id:newId,name,icon,color});notify("Grupo criado!");}
    setShowGroupForm(false);setEditGroup(null);
  };
  const deleteGroup=async(id)=>{await deleteDoc(doc(db,`${base}/groups`,id));notify("Grupo removido");};

  const saveRevenue=async(data)=>{
    const months=data.recurring?parseInt(data.recurMonths||12):1;
    if(data.id){
      await setDoc(doc(db,`${base}/revenues`,data.id),{...data,authorUid:data.authorUid||user.uid,authorName:data.authorName||user.displayName});
      if(data.recurring&&data.updateFuture){
        const futureItems=revenues.filter(r=>r.description===data.description&&r.groupId===data.groupId&&r.id!==data.id&&(r.year>data.year||(r.year===data.year&&r.month>data.month)));
        for(const r of futureItems){await setDoc(doc(db,`${base}/revenues`,r.id),{...r,value:data.value,source:data.source,groupId:data.groupId});}
        notify(`Receita atualizada em ${futureItems.length+1} meses!`);
      } else notify("Receita atualizada!");
    } else {
      for(let i=0;i<months;i++){
        let m=data.month+i;let y=data.year;
        if(m>11){m-=12;y+=1;}
        const id=`rev_${Date.now()}_${i}`;
        let expectedDate=data.expectedDate;
        if(data.recurring&&data.expectedDate&&i>0){const d=new Date(data.expectedDate);d.setMonth(d.getMonth()+i);expectedDate=d.toISOString().slice(0,10);}
        let attachment=data.attachment||null;
        if(i===0&&data.attachmentFile){attachment=await uploadAttachment(data.attachmentFile,`families/${familyId}/revenues/${id}_${data.attachmentFile.name}`);}
        await setDoc(doc(db,`${base}/revenues`,id),{...data,id,month:m,year:y,received:i===0?(data.received||false):false,expectedDate,authorUid:user.uid,authorName:user.displayName,observation:data.observation||"",attachment:attachment||null,attachmentFile:null});
      }
      notify(months>1?`Receita lançada para ${months} meses!`:"Receita adicionada!");
    }
    setShowRevForm(false);setEditItem(null);
  };

  const toggleReceived=async(id)=>{const item=revenues.find(r=>r.id===id);await setDoc(doc(db,`${base}/revenues`,id),{...item,received:!item.received});};
  const deleteRevenue=async(id)=>{await deleteDoc(doc(db,`${base}/revenues`,id));notify("Receita removida");};
  const duplicateExpense=async(item)=>{const id=`exp_${Date.now()}_dup`;await setDoc(doc(db,`${base}/expenses`,id),{...item,id,paid:false,authorUid:user.uid,authorName:user.displayName});notify("Despesa duplicada! Edite conforme necessário.");};
  const duplicateRevenue=async(item)=>{const id=`rev_${Date.now()}_dup`;await setDoc(doc(db,`${base}/revenues`,id),{...item,id,received:false,authorUid:user.uid,authorName:user.displayName});notify("Receita duplicada! Edite conforme necessário.");};

  const copyExpensesToNextMonth=async()=>{
    if(selectedExp.length===0){notify("Selecione ao menos uma despesa.");return;}
    let nextMonth=selMonth+1, nextYear=selYear;
    if(nextMonth>11){nextMonth=0;nextYear+=1;}
    let count=0;
    for(const expId of selectedExp){
      const item=expenses.find(e=>e.id===expId);
      if(!item)continue;
      const existing=expenses.find(e=>e.description===item.description&&e.groupId===item.groupId&&e.month===nextMonth&&e.year===nextYear);
      const targetId=existing?existing.id:`exp_${Date.now()}_${count}`;
      let dueDate=item.dueDate;
      if(dueDate){const d=new Date(dueDate);d.setMonth(d.getMonth()+1);dueDate=d.toISOString().slice(0,10);}
      const refMonth=(item.refMonth+1)%12;
      const refYear=item.refYear+Math.floor((item.refMonth+1)/12);
      await setDoc(doc(db,`${base}/expenses`,targetId),{...item,id:targetId,month:nextMonth,year:nextYear,paid:false,dueDate,refMonth,refYear,authorUid:user.uid,authorName:user.displayName});
      count++;
    }
    notify(`${count} despesa(s) copiada(s) para ${MONTHS_FULL[nextMonth]}!`);
    setSelectedExp([]);setSelectMode(false);
  };

  const copyRevenuesToNextMonth=async()=>{
    if(selectedRev.length===0){notify("Selecione ao menos uma receita.");return;}
    let nextMonth=selMonth+1, nextYear=selYear;
    if(nextMonth>11){nextMonth=0;nextYear+=1;}
    let count=0;
    for(const revId of selectedRev){
      const item=revenues.find(r=>r.id===revId);
      if(!item)continue;
      const existing=revenues.find(r=>r.description===item.description&&r.groupId===item.groupId&&r.month===nextMonth&&r.year===nextYear);
      const targetId=existing?existing.id:`rev_${Date.now()}_${count}`;
      let expectedDate=item.expectedDate;
      if(expectedDate){const d=new Date(expectedDate);d.setMonth(d.getMonth()+1);expectedDate=d.toISOString().slice(0,10);}
      await setDoc(doc(db,`${base}/revenues`,targetId),{...item,id:targetId,month:nextMonth,year:nextYear,received:false,expectedDate,authorUid:user.uid,authorName:user.displayName});
      count++;
    }
    notify(`${count} receita(s) copiada(s) para ${MONTHS_FULL[nextMonth]}!`);
    setSelectedRev([]);setSelectRevMode(false);
  };

  const saveRevGroup=async(name,icon,color,id)=>{
    if(id){await setDoc(doc(db,`${base}/revGroups`,id),{id,name,icon,color});notify("Categoria atualizada!");}
    else{for(const g of revGroups){await setDoc(doc(db,`${base}/revGroups`,g.id),g);}const newId=`rg_${Date.now()}`;await setDoc(doc(db,`${base}/revGroups`,newId),{id:newId,name,icon,color});notify("Categoria criada!");}
    setShowRevGroupForm(false);setEditRevGroup(null);
  };

  const saveGoal=async(data)=>{const id=data.id||`goal_${Date.now()}`;await setDoc(doc(db,`${base}/goals`,id),{...data,id});setShowGoalForm(false);setEditGoal(null);notify(data.id?"Meta atualizada!":"Meta criada! 🎯");};
  const depositGoal=async(goal,value,note)=>{const updated={...goal,saved:(goal.saved||0)+value,deposits:[...(goal.deposits||[]),{date:new Date().toISOString().slice(0,10),value,note}]};await setDoc(doc(db,`${base}/goals`,goal.id),updated);notify("Depósito realizado! 💰");};
  const deleteGoal=async(id)=>{await deleteDoc(doc(db,`${base}/goals`,id));notify("Meta removida");};
  const saveCard=async(data)=>{const id=data.id||`card_${Date.now()}`;await setDoc(doc(db,`${base}/cards`,id),{...data,id});setShowCardForm(false);setEditCard(null);notify(data.id?"Cartão atualizado!":"Cartão adicionado!");};
  const deleteCard=async(id)=>{await deleteDoc(doc(db,`${base}/cards`,id));notify("Cartão removido");};
  const saveMiles=async(data)=>{const id=data.id||`miles_${Date.now()}`;await setDoc(doc(db,`${base}/miles`,id),{...data,id});setShowMilesForm(false);setEditMiles(null);notify(data.id?"Milhas atualizadas!":"Programa adicionado!");};
  const deleteMiles=async(id)=>{await deleteDoc(doc(db,`${base}/miles`,id));notify("Programa removido");};
  const saveSavingGoal=async(val)=>{setSavingGoal(val);await setDoc(doc(db,`${base}/settings/prefs`),{savingGoal:val});};

  const addCarryover=async()=>{
    if(prevMonthBalance<=0){notify("Saldo do mês anterior não é positivo","error");return;}
    const id=`rev_carryover_${selMonth}_${selYear}`;
    await setDoc(doc(db,`${base}/revenues`,id),{id,description:`Saldo transitado de ${MONTHS[selMonth===0?11:selMonth-1]}`,value:prevMonthBalance,groupId:"rg3",month:selMonth,year:selYear,received:true,isCarryover:true,authorUid:user.uid,authorName:user.displayName});
    notify(`Saldo de ${fmt(prevMonthBalance)} adicionado como receita!`);
  };

  const copyCode=()=>{if(family?.inviteCode){navigator.clipboard.writeText(family.inviteCode);setCopiedCode(true);setTimeout(()=>setCopiedCode(false),2000);}};
  const greet=()=>{const h=TODAY.getHours();return h<12?"Bom dia":h<18?"Boa tarde":"Boa noite";};
  const assistantName=domMode==="donna"?"Donna":"Dom";
  const userName=(userProfile?.name||user?.displayName||"").split(" ")[0]||"você";
  const lightboxItems=lightboxGroup?monthExpenses.filter(e=>e.groupId===lightboxGroup.id):[];
  const memberColors=["#6366f1","#ec4899","#f59e0b","#10b981","#3b82f6"];

  if(loading) return <Loading/>;

  return(
    <div style={S.app}>
      <style>{`*{box-sizing:border-box;}html,body,#root{overflow-x:hidden;max-width:100vw;}@keyframes toast-in{from{opacity:0;transform:translate(-50%,-20px)}to{opacity:1;transform:translate(-50%,0)}}input[type=range]{-webkit-appearance:none;height:5px;border-radius:99px;background:#0e2f4a;outline:none;width:100%}input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:18px;height:18px;border-radius:50%;background:#33D69F;cursor:pointer;box-shadow:0 2px 8px rgba(51,214,159,.4)}select{appearance:none;}::-webkit-scrollbar{width:4px;height:4px}::-webkit-scrollbar-thumb{background:rgba(51,214,159,.2);border-radius:99px}`}</style>

      {toast&&<div style={{...S.toast,background:toast.type==="success"?B.greenDim:B.danger}}>{toast.msg}</div>}

      {lightboxGroup&&(
        <div style={S.overlay} onClick={e=>e.target===e.currentTarget&&setLightboxGroup(null)}>
          <div style={S.modal}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <div style={{width:10,height:10,borderRadius:"50%",background:lightboxGroup.color}}/>
                <span style={{fontWeight:700,fontSize:16,color:B.text}}>{lightboxGroup.name}</span>
                <span style={{fontSize:13,color:B.textMuted}}>· {fmt(lightboxGroup.total)}</span>
              </div>
              <button style={S.closeBtn} onClick={()=>setLightboxGroup(null)}><Icon d={ic.x} size={16} stroke={B.textSub}/></button>
            </div>
            <div style={{overflowY:"auto",maxHeight:"60vh"}}>
              {lightboxItems.map(item=>(
                <div key={item.id} style={{display:"flex",alignItems:"center",gap:10,padding:"12px 0",borderBottom:`1px solid ${B.border}`}}>
                  <button style={{width:24,height:24,borderRadius:6,border:`2px solid ${item.paid?B.green:isExpenseOverdue(item)?B.danger:B.grayMid}`,background:item.paid?B.green:"transparent",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}} onClick={()=>togglePaid(item.id)}>
                    {item.paid&&<Icon d={ic.check} size={12} stroke="#fff" strokeWidth={2.5}/>}
                  </button>
                  <div style={{flex:1}}>
                    <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                      <span style={{fontSize:13,fontWeight:600,color:B.text,textDecoration:item.paid?"line-through":"none"}}>{item.description}</span>
                      {isExpenseOverdue(item)&&<span style={{fontSize:10,color:"#fff",background:B.danger,padding:"2px 7px",borderRadius:99,fontWeight:700}}>● EM ATRASO</span>}
                    </div>
                    <div style={{fontSize:11,color:B.textMuted}}>{item.creditor}{item.dueDate?` · Vence ${item.dueDate}`:""}</div>
                    {item.authorName&&<div style={{fontSize:10,color:B.green}}>👤 {item.authorName}</div>}
                  </div>
                  <div style={{fontWeight:700,fontSize:14,color:item.paid?B.green:isExpenseOverdue(item)?B.danger:B.navy}}>{fmt(item.value)}</div>
                  <div style={{display:"flex",gap:4}}>
                    <button style={S.iconBtn} onClick={()=>{setEditItem(item);setShowForm(true);setLightboxGroup(null);}}><Icon d={ic.edit} size={13} stroke="#6366f1"/></button>
                    <button style={S.iconBtn} onClick={()=>deleteExpense(item.id)}><Icon d={ic.trash} size={13} stroke={B.danger}/></button>
                  </div>
                </div>
              ))}
              {lightboxItems.length===0&&<div style={S.empty}>Nenhuma despesa neste grupo</div>}
            </div>
            <button style={{...S.btnPrimary,justifyContent:"center",marginTop:16}} onClick={()=>{setEditItem(null);setShowForm(true);setLightboxGroup(null);}}><Icon d={ic.plus} size={14}/> Nova Despesa em {lightboxGroup.name}</button>
          </div>
        </div>
      )}

      {showProfile&&<ProfileModal user={user} domMode={domMode} profile={userProfile||{}} onSave={p=>setUserProfile(p)} onClose={()=>setShowProfile(false)}/>}
      {showAIPanel&&<AIPanel onClose={()=>setShowAIPanel(false)} expenses={expenses} revenues={revenues} groups={groups} revGroups={revGroups} selMonth={selMonth} selYear={selYear} totalExpenses={totalExpenses} totalRevenue={totalRevenue} balance={balance} paidExp={paidExp} receivedRev={receivedRev} savingGoal={savingGoal} memberFilter={memberFilter} members={members} user={user} onSaveExpense={saveExpense} onSaveRevenue={saveRevenue} groups_list={groups} revGroups_list={revGroups}/> }

      {showFamilyPanel&&(
        <div style={S.overlay} onClick={e=>e.target===e.currentTarget&&setShowFamilyPanel(false)}>
          <div style={S.modal}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
              <span style={{fontWeight:700,fontSize:16,color:B.text}}>👨‍👩‍👧 Família</span>
              <button style={S.closeBtn} onClick={()=>setShowFamilyPanel(false)}><Icon d={ic.x} size={16} stroke={B.textSub}/></button>
            </div>
            <div style={{background:B.navyMid,borderRadius:14,padding:16,marginBottom:16}}>
              <div style={{fontSize:12,color:B.textMuted,marginBottom:8,fontWeight:600}}>CÓDIGO DE CONVITE</div>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <div style={{fontSize:24,fontWeight:800,color:B.green,letterSpacing:4,flex:1}}>{family?.inviteCode||"---"}</div>
                <button style={{background:copiedCode?B.green:B.navyLight,border:`1px solid ${B.green}33`,borderRadius:8,padding:"8px 14px",color:copiedCode?B.navy:B.green,cursor:"pointer",fontWeight:700,fontSize:12,fontFamily:"'Plus Jakarta Sans',sans-serif"}} onClick={copyCode}>{copiedCode?"✓ Copiado!":"Copiar"}</button>
              </div>
              <div style={{fontSize:11,color:B.textMuted,marginTop:8}}>Compartilhe este código com os membros da família para que eles entrem no app.</div>
            </div>
            <div style={{fontSize:12,color:B.textMuted,marginBottom:10,fontWeight:600}}>MEMBROS ({members.length})</div>
            {members.map((m,i)=>(
              <div key={m.uid} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 0",borderBottom:`1px solid ${B.border}`}}>
                <div style={{width:38,height:38,borderRadius:"50%",background:memberColors[i%memberColors.length],display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:700,fontSize:15,flexShrink:0}}>{m.name?m.name[0].toUpperCase():"?"}</div>
                <div style={{flex:1}}>
                  <div style={{fontWeight:600,fontSize:14,color:B.text}}>{m.name}{m.uid===user.uid?" (você)":""}</div>
                  <div style={{fontSize:11,color:B.textMuted}}>{m.role==="admin"?"Administrador":"Membro"}</div>
                </div>
              </div>
            ))}
            <button style={{...S.btnSecondary,justifyContent:"center",marginTop:16}} onClick={()=>{signOut(auth);setShowFamilyPanel(false);}}><Icon d={ic.logout} size={14}/> Sair da conta</button>
          </div>
        </div>
      )}

      <header style={S.header}>
        <div style={S.headerInner}>
          {/* LOGO + SAUDAÇÃO */}
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:38,height:38,borderRadius:11,background:B.navyMid,border:`1px solid rgba(51,214,159,.2)`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
              <svg width="22" height="22" viewBox="0 0 52 52" fill="none"><polygon points="26,10 42,23 10,23" fill="#33D69F" opacity=".14"/><line x1="26" y1="10" x2="42" y2="23" stroke="#33D69F" strokeWidth="2.4" strokeLinecap="round"/><line x1="26" y1="10" x2="10" y2="23" stroke="#33D69F" strokeWidth="2.4" strokeLinecap="round"/><rect x="14" y="23" width="24" height="17" rx="2.5" fill="none" stroke="#33D69F" strokeWidth="1.8"/><polyline points="17,37 21,32 26,34 35,26" stroke="#0ED492" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/><circle cx="35" cy="26" r="2.4" fill="#33D69F"/></svg>
            </div>
            <div>
              <div style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:15,fontWeight:800,color:B.white,letterSpacing:-0.3}}>Home<span style={{color:B.green}}> Finance</span></div>
              <div style={{fontSize:10,color:"#2C6E7A",fontWeight:600}}>{greet()}, {userName}!</div>
            </div>
          </div>

          {/* BOTÕES DIREITA */}
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            {/* Olhinho — sempre visível */}
            <button style={{background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.1)",cursor:"pointer",padding:"8px",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}} onClick={()=>setHideValues(v=>!v)} title={hideValues?"Mostrar valores":"Ocultar valores"}>
              <Icon d={hideValues?ic.eyeOff:ic.eye} size={18} stroke={hideValues?B.textMuted:B.green}/>
            </button>
            {/* Nav mês */}
            <div style={S.monthNav}>
              <button style={S.navBtn} onClick={()=>{if(selMonth===0){setSelMonth(11);setSelYear(y=>y-1);}else setSelMonth(m=>m-1);}}>‹</button>
              <span style={S.monthLabel}>{MONTHS[selMonth]}/{selYear}</span>
              <button style={S.navBtn} onClick={()=>{if(selMonth===11){setSelMonth(0);setSelYear(y=>y+1);}else setSelMonth(m=>m+1);}}>›</button>
            </div>
            {/* Menu sanduíche mobile */}
            <button style={{background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.1)",cursor:"pointer",padding:"8px",borderRadius:8,display:"flex",flexDirection:"column",gap:4,alignItems:"center",justifyContent:"center",flexShrink:0}} onClick={()=>setMenuOpen(o=>!o)}>
              <div style={{width:16,height:2,background:menuOpen?B.green:B.white,borderRadius:2,transition:"all .2s"}}/>
              <div style={{width:16,height:2,background:menuOpen?B.green:B.white,borderRadius:2,transition:"all .2s",opacity:menuOpen?0:1}}/>
              <div style={{width:16,height:2,background:menuOpen?B.green:B.white,borderRadius:2,transition:"all .2s"}}/>
            </button>
          </div>
        </div>

        {/* FILTRO DE MEMBROS */}
        {members.length>1&&(
          <div style={{display:"flex",gap:6,paddingBottom:10,overflowX:"auto"}}>
            <button style={{...S.memberBtn,...(memberFilter==="all"?S.memberBtnActive:{})}} onClick={()=>setMemberFilter("all")}>Todos</button>
            {members.map((m,i)=>(
              <button key={m.uid} style={{...S.memberBtn,...(memberFilter===m.uid?{background:memberColors[i%memberColors.length],color:"#fff",borderColor:memberColors[i%memberColors.length]}:{})}} onClick={()=>setMemberFilter(m.uid)}>{m.name?.split(" ")[0]}</button>
            ))}
          </div>
        )}
      </header>

      {/* MENU DROPDOWN MOBILE */}
      {menuOpen&&(
        <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,zIndex:200,background:"rgba(0,0,0,.5)"}} onClick={()=>setMenuOpen(false)}>
          <div style={{position:"absolute",top:0,right:0,bottom:0,width:260,background:B.navyMid,boxShadow:"-8px 0 32px rgba(0,0,0,.5)",display:"flex",flexDirection:"column",padding:24,gap:8}} onClick={e=>e.stopPropagation()}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
              <div style={{fontWeight:800,fontSize:16,color:B.white}}>Menu</div>
              <button style={{background:"none",border:"none",cursor:"pointer",color:B.textMuted}} onClick={()=>setMenuOpen(false)}><Icon d={ic.x} size={20} stroke={B.textMuted}/></button>
            </div>
            {[{id:"dashboard",label:"Painel",icon:"grid"},{id:"expenses",label:"Despesas",icon:"tag"},{id:"revenues",label:"Receitas",icon:"wallet"},{id:"goals",label:"Metas",icon:"target"},{id:"cards",label:"Cartões",icon:"credit"},{id:"history",label:"Histórico",icon:"chart"}].map(t=>(
              <button key={t.id} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",borderRadius:12,border:"none",cursor:"pointer",fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:14,fontWeight:activeTab===t.id?700:500,background:activeTab===t.id?`${B.green}18`:"transparent",color:activeTab===t.id?B.green:B.textSub,textAlign:"left"}} onClick={()=>{setActiveTab(t.id);setMenuOpen(false);}}>
                <Icon d={ic[t.icon]} size={18} stroke={activeTab===t.id?B.green:B.textMuted}/>{t.label}
              </button>
            ))}
            <div style={{height:1,background:B.border,margin:"8px 0"}}/>
            <button style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",borderRadius:12,border:"none",cursor:"pointer",fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:14,fontWeight:500,background:"transparent",color:B.green,textAlign:"left"}} onClick={()=>{setShowFamilyPanel(true);setMenuOpen(false);}}>
              <Icon d={ic.users} size={18} stroke={B.green}/>{members.length>1?`${members.length} membros`:"Família"}
            </button>
            <button style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",borderRadius:12,border:"none",cursor:"pointer",fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:14,fontWeight:500,background:"rgba(51,214,159,.06)",color:B.green,textAlign:"left"}} onClick={()=>{setShowProfile(true);setMenuOpen(false);}}>
              <Icon d={ic.user} size={18} stroke={B.green}/>Meu Perfil
            </button>
            <button style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",borderRadius:12,border:"none",cursor:"pointer",fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:14,fontWeight:500,background:"linear-gradient(135deg,rgba(99,102,241,.15),rgba(51,214,159,.1))",color:"#a5b4fc",textAlign:"left"}} onClick={()=>{setShowAIPanel(true);setMenuOpen(false);}}>
              <Icon d={ic.sparkle} size={18} stroke="#a5b4fc"/> Assistente IA
            </button>
            <button style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",borderRadius:12,border:"none",cursor:"pointer",fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:14,fontWeight:500,background:"transparent",color:compactMode?B.green:B.textSub,textAlign:"left"}} onClick={()=>setCompactMode(c=>!c)}>
              <Icon d={ic.grid} size={18} stroke={compactMode?B.green:B.textMuted}/>{compactMode?"Modo completo":"Modo compacto"}
            </button>
            <div style={{flex:1}}/>
            <button style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",borderRadius:12,border:"none",cursor:"pointer",fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:14,fontWeight:500,background:"rgba(239,68,68,.1)",color:B.danger,textAlign:"left"}} onClick={()=>signOut(auth)}>
              <Icon d={ic.logout||ic.x} size={18} stroke={B.danger}/> Sair da conta
            </button>
          </div>
        </div>
      )}

      <main style={S.main}>
        {activeTab==="dashboard"&&(
          <div style={S.section}>

            {/* MODO COMPACTO - RESUMO EXECUTIVO */}
            {compactMode&&(
              <div style={{display:"flex",flexDirection:"column",gap:12}}>
                <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
                  <div style={{flex:1,minWidth:140,background:B.navyMid,borderRadius:14,padding:16,border:`1px solid rgba(51,214,159,.12)`}}>
                    <div style={{fontSize:10,color:B.textMuted,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em"}}>Receita</div>
                    <div style={{fontSize:22,fontWeight:800,color:B.green,marginTop:4}}>{fmtH(totalRevenue)}</div>
                    <div style={{fontSize:11,color:B.textMuted,marginTop:2}}>Recebido: {fmtH(receivedRev)}</div>
                  </div>
                  <div style={{flex:1,minWidth:140,background:B.navyMid,borderRadius:14,padding:16,border:`1px solid rgba(251,191,36,.12)`}}>
                    <div style={{fontSize:10,color:B.textMuted,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em"}}>Despesas</div>
                    <div style={{fontSize:22,fontWeight:800,color:B.warning,marginTop:4}}>{fmtH(totalExpenses)}</div>
                    <div style={{fontSize:11,color:B.textMuted,marginTop:2}}>Pago: {fmtH(paidExp)}</div>
                  </div>
                </div>
                <div style={{background:B.navyMid,borderRadius:14,padding:16,border:`1px solid ${balance>=0?"rgba(99,102,241,.2)":"rgba(239,68,68,.2)"}`}}>
                  <div style={{fontSize:10,color:B.textMuted,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em"}}>Saldo</div>
                  <div style={{fontSize:28,fontWeight:800,color:balance>=0?"#6366f1":B.danger,marginTop:4}}>{fmtH(balance)}</div>
                  <div style={{height:6,background:B.border,borderRadius:99,marginTop:10,overflow:"hidden"}}><div style={{width:`${Math.min(pct(totalExpenses,totalRevenue),100)}%`,height:"100%",borderRadius:99,background:pct(totalExpenses,totalRevenue)>80?B.danger:pct(totalExpenses,totalRevenue)>60?B.warning:B.green}}/></div>
                  <div style={{fontSize:11,color:B.textMuted,marginTop:4}}>{pct(totalExpenses,totalRevenue)}% da receita comprometida</div>
                </div>
                {upcomingDue.length>0&&(
                  <div style={{background:"rgba(251,191,36,.08)",border:"1px solid rgba(251,191,36,.2)",borderRadius:12,padding:12}}>
                    <div style={{fontWeight:700,fontSize:12,color:B.warning,marginBottom:6}}>⏰ Vencendo em breve</div>
                    {upcomingDue.slice(0,2).map(e=><div key={e.id} style={{fontSize:12,color:B.textSub,marginTop:2}}>{e.description} · {fmtH(e.value)}</div>)}
                  </div>
                )}
              </div>
            )}

            {/* MODO COMPLETO */}
            {!compactMode&&<>

            {/* ALERTAS NO TOPO */}
            {(upcomingDue.length>0||pendingRevenues.length>0||cardsNearLimit.length>0)&&(
              <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:4}}>
                {upcomingDue.length>0&&(
                  <div style={{background:"rgba(251,191,36,.08)",border:"1px solid rgba(251,191,36,.25)",borderRadius:14,padding:"12px 16px",display:"flex",alignItems:"center",gap:12}}>
                    <div style={{fontSize:22}}>⏰</div>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:700,fontSize:13,color:B.warning}}>Vencendo em breve</div>
                      {upcomingDue.slice(0,3).map(e=>(
                        <div key={e.id} style={{fontSize:12,color:B.textSub,marginTop:2}}>{e.description} · {fmtH(e.value)} · {e.dueDate||`dia ${e.dueDay}`}</div>
                      ))}
                    </div>
                  </div>
                )}
                {pendingRevenues.length>0&&(
                  <div style={{background:"rgba(51,214,159,.06)",border:"1px solid rgba(51,214,159,.2)",borderRadius:14,padding:"12px 16px",display:"flex",alignItems:"center",gap:12}}>
                    <div style={{fontSize:22}}>💰</div>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:700,fontSize:13,color:B.green}}>{pendingRevenues.length} receita(s) a receber</div>
                      <div style={{fontSize:12,color:B.textSub,marginTop:2}}>Total pendente: {fmtH(pendingRevenues.reduce((s,r)=>s+(r.value||0),0))}</div>
                    </div>
                  </div>
                )}
                {cardsNearLimit.length>0&&(
                  <div style={{background:"rgba(239,68,68,.07)",border:"1px solid rgba(239,68,68,.2)",borderRadius:14,padding:"12px 16px",display:"flex",alignItems:"center",gap:12}}>
                    <div style={{fontSize:22}}>💳</div>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:700,fontSize:13,color:B.danger}}>Cartão(ões) próximo(s) do limite</div>
                      {cardsNearLimit.map(c=>(
                        <div key={c.id} style={{fontSize:12,color:B.textSub,marginTop:2}}>{c.name} · {Math.round(((c.used||0)/c.limit)*100)}% utilizado</div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* KPIs PRINCIPAIS */}
            <div style={S.kpiGrid}>
              <KpiCard label="Receita" value={fmtH(totalRevenue)} icon="wallet" color={B.green} sub={`Recebido: ${fmtH(receivedRev)}`}/>
              <KpiCard label="Despesas" value={fmtH(totalExpenses)} icon="tag" color={B.warning} sub={`${pct(totalExpenses,totalRevenue)}% da receita`}/>
              <KpiCard label="Saldo" value={fmtH(balance)} icon="chart" color={balance>=0?"#6366f1":B.danger} sub={balance>=0?"✓ No azul":"⚠ No vermelho"}/>
              <KpiCard label="Meta Economia" value={fmtH(savingTarget)} icon="target" color="#ec4899" sub={`${savingGoal}% · ${balance>=savingTarget?"✓ Atingida!":"Faltam "+fmtH(savingTarget-balance)}`}/>
            </div>

            {/* COMPARATIVO COM MÊS ANTERIOR */}
            <div style={S.card}>
              <div style={S.cardTitle}>📊 Comparativo — {MONTHS_FULL[selMonth===0?11:selMonth-1]} vs {MONTHS_FULL[selMonth]}</div>
              <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
                <div style={{flex:1,minWidth:120,background:B.bg,borderRadius:10,padding:12,textAlign:"center"}}>
                  <div style={{fontSize:10,color:B.textMuted,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:6}}>Mês anterior</div>
                  <div style={{fontSize:16,fontWeight:800,color:B.warning}}>{fmtH(prevMonthExpenses)}</div>
                  <div style={{fontSize:10,color:B.textMuted,marginTop:2}}>em despesas</div>
                </div>
                <div style={{flex:1,minWidth:120,background:B.bg,borderRadius:10,padding:12,textAlign:"center"}}>
                  <div style={{fontSize:10,color:B.textMuted,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:6}}>Mês atual</div>
                  <div style={{fontSize:16,fontWeight:800,color:B.warning}}>{fmtH(totalExpenses)}</div>
                  <div style={{fontSize:10,marginTop:2,fontWeight:700,color:expDiff>0?B.danger:B.green}}>{expDiff>0?`▲ +${fmtH(expDiff)} (+${expDiffPct}%)`:`▼ ${fmtH(Math.abs(expDiff))} (${expDiffPct}%)`}</div>
                </div>
                <div style={{flex:1,minWidth:120,background:B.bg,borderRadius:10,padding:12,textAlign:"center"}}>
                  <div style={{fontSize:10,color:B.textMuted,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:6}}>Previsão fechamento</div>
                  <div style={{fontSize:16,fontWeight:800,color:projectedBalance>=0?"#6366f1":B.danger}}>{fmtH(projectedBalance)}</div>
                  <div style={{fontSize:10,color:B.textMuted,marginTop:2}}>saldo estimado</div>
                </div>
              </div>
            </div>

            {/* BARRA DE PROGRESSO DO ORÇAMENTO */}
            <div style={S.card}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                <div style={S.cardTitle}>💡 Orçamento — {MONTHS_FULL[selMonth]}</div>
                <div style={{fontSize:12,fontWeight:700,color:pct(totalExpenses,totalRevenue)>80?B.danger:pct(totalExpenses,totalRevenue)>60?B.warning:B.green}}>{pct(totalExpenses,totalRevenue)}% utilizado</div>
              </div>
              <div style={{height:10,background:B.border,borderRadius:99,overflow:"hidden",marginBottom:8}}>
                <div style={{width:`${Math.min(pct(totalExpenses,totalRevenue),100)}%`,height:"100%",borderRadius:99,background:pct(totalExpenses,totalRevenue)>80?B.danger:pct(totalExpenses,totalRevenue)>60?B.warning:B.green,transition:"width .5s"}}/>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:B.textMuted}}>
                <span>Gasto: {fmtH(totalExpenses)}</span>
                <span>Disponível: {fmtH(Math.max(totalRevenue-totalExpenses,0))}</span>
                <span>Receita: {fmtH(totalRevenue)}</span>
              </div>
            </div>

            {/* EVOLUÇÃO DO SALDO DIA A DIA */}
            {dailyBalance.length>1&&(
              <div style={S.card}>
                <div style={S.cardTitle}>📈 Evolução do Saldo — {MONTHS_FULL[selMonth]}</div>
                <div style={{position:"relative",height:100,display:"flex",alignItems:"flex-end",gap:2,marginBottom:8}}>
                  {dailyBalance.map((d,i)=>{
                    const maxB=Math.max(...dailyBalance.map(x=>Math.abs(x.balance)),1);
                    const h=Math.abs(d.balance)/maxB*80;
                    const isNeg=d.balance<0;
                    const isToday=d.day===new Date().getDate()&&selMonth===CURRENT_MONTH&&selYear===CURRENT_YEAR;
                    return(
                      <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
                        <div style={{width:"100%",height:h,borderRadius:"3px 3px 0 0",background:isNeg?B.danger:isToday?B.green:"#6366f1",opacity:isToday?1:0.6,minHeight:2,transition:"height .3s"}}/>
                        {(i===0||i===dailyBalance.length-1||isToday)&&<div style={{fontSize:8,color:isToday?B.green:B.textMuted,fontWeight:isToday?700:400}}>{d.day}</div>}
                      </div>
                    );
                  })}
                </div>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:B.textMuted}}>
                  <span>Dia 1</span>
                  <span style={{color:dailyBalance[dailyBalance.length-1]?.balance>=0?"#6366f1":B.danger,fontWeight:700}}>Hoje: {fmtH(dailyBalance[dailyBalance.length-1]?.balance||0)}</span>
                  <span>Dia {new Date(selYear,selMonth+1,0).getDate()}</span>
                </div>
              </div>
            )}

            {/* SALDO DO MÊS ANTERIOR */}
            {prevMonthBalance>0&&!revenues.find(r=>r.isCarryover&&r.month===selMonth&&r.year===selYear)&&(
              <div style={{background:`${B.green}12`,border:`1px solid ${B.green}33`,borderRadius:14,padding:14,display:"flex",alignItems:"center",gap:12}}>
                <div style={{fontSize:28}}>💰</div>
                <div style={{flex:1}}><div style={{fontWeight:700,fontSize:13,color:B.text}}>Saldo disponível do mês anterior</div><div style={{fontSize:20,fontWeight:800,color:B.green}}>{fmtH(prevMonthBalance)}</div><div style={{fontSize:11,color:B.textMuted}}>Sobra de {MONTHS[selMonth===0?11:selMonth-1]}</div></div>
                <button style={{background:B.green,color:"#071C2C",border:"none",borderRadius:10,padding:"10px 14px",fontWeight:700,fontSize:12,cursor:"pointer",fontFamily:"'Plus Jakarta Sans',sans-serif",whiteSpace:"nowrap"}} onClick={addCarryover}>+ Adicionar como receita</button>
              </div>
            )}

            {/* CARTÕES */}
            {cards.length>0&&(<div style={S.card}><div style={S.cardTitle}><Icon d={ic.credit} size={14} stroke={B.green}/>Limites Disponíveis</div><div style={{display:"flex",gap:10,flexWrap:"wrap"}}>{cards.map(c=>{const used=c.used||0;const avail=(c.limit||0)-used;return(<div key={c.id} style={{flex:"1 1 130px",minWidth:0,maxWidth:"100%",background:`linear-gradient(135deg,${c.color},${c.color}aa)`,borderRadius:12,padding:12,color:"#fff"}}><div style={{fontSize:11,opacity:.8,marginBottom:4}}>{c.name}</div><div style={{fontSize:18,fontWeight:800}}>{fmtH(avail)}</div><div style={{fontSize:10,opacity:.7}}>de {fmtH(c.limit)}</div><div style={{height:3,background:"rgba(255,255,255,.2)",borderRadius:99,marginTop:8}}><div style={{width:`${pct(used,c.limit)}%`,height:"100%",background:"rgba(255,255,255,.8)",borderRadius:99}}/></div></div>);})}</div></div>)}

            {/* RESUMO COM BARRAS */}
            <div style={S.card}>
              <div style={S.cardTitle}>Resumo Financeiro — {MONTHS_FULL[selMonth]}/{selYear}</div>
              <ProgressRow label="Pago" value={paidExp} total={totalRevenue} color={B.green}/>
              <ProgressRow label="Em Aberto" value={totalExpenses-paidExp} total={totalRevenue} color={B.warning}/>
              <ProgressRow label="Meta Economia" value={savingTarget} total={totalRevenue} color="#ec4899"/>
              <div style={{height:1,background:B.border,margin:"10px 0"}}/>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:13,color:B.textSub}}><span>Receita total</span><strong style={{color:B.text}}>{fmtH(totalRevenue)}</strong></div>
            </div>

            {/* CONTRIBUIÇÃO DA FAMÍLIA */}
            {members.length>1&&(<div style={S.card}><div style={S.cardTitle}><Icon d={ic.users} size={14} stroke={B.green}/>Contribuição da Família — {MONTHS_FULL[selMonth]}</div>{memberContrib.map((m,i)=>(<div key={m.uid} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 0",borderBottom:`1px solid ${B.border}`}}><div style={{width:36,height:36,borderRadius:"50%",background:memberColors[i%memberColors.length],display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:700,fontSize:15,flexShrink:0}}>{m.name?m.name[0].toUpperCase():"?"}</div><div style={{flex:1}}><div style={{fontWeight:700,fontSize:13,color:B.text}}>{m.name?.split(" ")[0]}{m.uid===user.uid?" 👤":""}</div><div style={{fontSize:11,color:B.textMuted}}>Receitas: {fmtH(m.revTotal)}</div></div><div style={{textAlign:"right"}}><div style={{fontWeight:700,fontSize:13,color:B.danger}}>{fmtH(m.expTotal)}</div><div style={{fontSize:10,color:B.textMuted}}>em despesas</div></div></div>))}</div>)}

            {/* ALERTAS DE VARIAÇÃO */}
            {alerts.length>0&&(<div style={S.card}><div style={S.cardTitle}>⚠ Variações de Gasto</div>{alerts.map((a,i)=>(<div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 0",borderBottom:`1px solid ${B.border}`}}><Icon d={ic.warning} size={16} stroke={B.warning}/><div style={{flex:1}}><div style={{fontSize:13,fontWeight:600,color:B.text}}>{a.desc}</div><div style={{fontSize:12,color:B.textMuted}}>{fmtH(a.prev)} → {fmtH(a.curr)}</div></div><div style={{background:"#fef9c3",color:"#b45309",fontWeight:700,fontSize:11,padding:"3px 8px",borderRadius:99}}>+{a.pct}%</div></div>))}</div>)}

            {/* GRÁFICO DE PIZZA */}
            {byGroup.length>0&&(<div style={S.card}><div style={S.cardTitle}>Distribuição por Grupo <span style={{fontSize:11,color:B.textMuted,fontWeight:400}}>· clique para detalhar</span></div><div style={{display:"flex",gap:24,alignItems:"center",flexWrap:"wrap"}}><PieChart data={pieData} onSliceClick={g=>{const full=byGroup.find(x=>x.id===g.id);setLightboxGroup(full);}}/><div style={{flex:1,display:"flex",flexDirection:"column",gap:8,minWidth:160}}>{pieData.map(g=>(<div key={g.id} style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",padding:"4px 8px",borderRadius:8}} onClick={()=>{const full=byGroup.find(x=>x.id===g.id);setLightboxGroup(full);}}><div style={{width:10,height:10,borderRadius:3,background:g.color,flexShrink:0}}/><span style={{fontSize:12,color:B.textSub,flex:1}}>{g.name}</span><span style={{fontSize:12,fontWeight:700,color:g.color}}>{g.pct}%</span><span style={{fontSize:11,color:B.textMuted}}>{fmtH(g.total)}</span></div>))}</div></div></div>)}

            {/* META DE ECONOMIA */}
            <div style={S.card}>
              <div style={S.cardTitle}>🎯 Meta de Economia — {MONTHS_FULL[selMonth]}</div>
              <div style={{background:B.bg,borderRadius:12,padding:14,marginBottom:12,border:`1px solid ${B.border}`}}>
                <div style={{fontSize:13,color:B.textSub,lineHeight:1.8}}>Receita: <strong style={{color:B.green}}>{fmtH(totalRevenue)}</strong> · Meta: <strong style={{color:"#6366f1"}}>{savingGoal}%</strong> = <strong style={{color:"#6366f1"}}>{fmtH(savingTarget)}</strong></div>
                <div style={{marginTop:8,fontSize:13,fontWeight:700,color:balance>=savingTarget?B.green:B.danger}}>{balance>=savingTarget?`✓ Saldo de ${fmtH(balance)} — meta atingida!`:`⚠ Saldo atual ${fmtH(balance)} — faltam ${fmtH(savingTarget-balance)}`}</div>
              </div>
              <input type="range" min={5} max={50} value={savingGoal} onChange={e=>saveSavingGoal(+e.target.value)}/>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:B.textMuted,marginTop:6}}><span>5%</span><span style={{fontWeight:700,color:B.green}}>{savingGoal}%</span><span>50%</span></div>
            </div>

            </>}
          </div>
        )}
        {activeTab==="expenses"&&(

          <div style={S.section}>
            <div style={S.card}>
              <div style={S.cardTitle}>Total Despesas — {MONTHS_FULL[selMonth]}</div>
              <div style={{fontSize:28,fontWeight:800,color:B.warning,letterSpacing:-1}}>{fmt(totalExpenses)}</div>
              <div style={{display:"flex",gap:16,marginTop:6,flexWrap:"wrap"}}>
                <div style={{fontSize:12,color:B.textMuted}}>{monthExpenses.length} lançamento(s)</div>
                <div style={{fontSize:12,color:B.green,fontWeight:600}}>✓ Pago: {fmt(paidExp)}</div>
                <div style={{fontSize:12,color:B.warning,fontWeight:600}}>⏳ Em aberto: {fmt(totalExpenses-paidExp)}</div>
                {monthExpenses.filter(e=>isExpenseOverdue(e)).length>0&&(<div style={{fontSize:12,color:B.danger,fontWeight:700}}>● {monthExpenses.filter(e=>isExpenseOverdue(e)).length} em atraso</div>)}
              </div>
            </div>
            <div style={S.rowBetween}>
              <button style={S.btnPrimary} onClick={()=>{setEditItem(null);setShowForm(true);}}><Icon d={ic.plus} size={14}/> Nova Despesa</button>
              <button style={S.btnSecondary} onClick={()=>{setEditGroup(null);setShowGroupForm(true);}}><Icon d={ic.plus} size={14}/> Grupo</button>
            </div>
            <div style={{display:"flex",justifyContent:"flex-end",marginTop:8}}>
              {!selectMode?(
                <button style={{...S.btnSecondary,fontSize:12}} onClick={()=>setSelectMode(true)}><Icon d={ic.copy||ic.check} size={13}/> Selecionar para copiar</button>
              ):(
                <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center",width:"100%",justifyContent:"flex-end"}}>
                  <span style={{fontSize:12,color:B.textMuted}}>{selectedExp.length} selecionado(s)</span>
                  <button style={{...S.btnSecondary,fontSize:12}} onClick={()=>setSelectedExp(selectedExp.length===monthExpenses.length?[]:monthExpenses.map(e=>e.id))}>{selectedExp.length===monthExpenses.length?"Desmarcar todos":"Selecionar todos"}</button>
                  <button style={{...S.btnPrimary,fontSize:12}} onClick={copyExpensesToNextMonth}>Copiar para {MONTHS[(selMonth+1)%12]}</button>
                  <button style={{...S.btnSecondary,fontSize:12}} onClick={()=>{setSelectMode(false);setSelectedExp([]);}}>Cancelar</button>
                </div>
              )}
            </div>
            {groups.map(g=>{const items=monthExpenses.filter(e=>e.groupId===g.id);if(items.length===0)return null;return <GroupSection key={g.id} group={g} items={items} total={items.reduce((s,e)=>s+(e.value||0),0)} onToggle={togglePaid} onEdit={item=>{setEditItem(item);setShowForm(true);}} onDelete={deleteExpense} onDeleteGroup={deleteGroup} onEditGroup={g=>{setEditGroup(g);setShowGroupForm(true);}} isOverdue={isExpenseOverdue} selectMode={selectMode} selectedIds={selectedExp} onSelectItem={id=>setSelectedExp(prev=>prev.includes(id)?prev.filter(x=>x!==id):[...prev,id])} onDuplicate={duplicateExpense}/>;
            })}
            {monthExpenses.length===0&&<div style={S.emptyState}><div style={{fontSize:48}}>📂</div><div style={{color:B.textMuted,fontSize:14}}>Nenhuma despesa em {MONTHS_FULL[selMonth]}</div><button style={S.btnPrimary} onClick={()=>setShowForm(true)}>Adicionar primeira despesa</button></div>}
            {showForm&&<Modal onClose={()=>{setShowForm(false);setEditItem(null);}} title={editItem?"Editar Despesa":"Nova Despesa"}><ExpenseForm groups={groups} cards={cards} item={editItem} selMonth={selMonth} selYear={selYear} onSave={saveExpense} onClose={()=>{setShowForm(false);setEditItem(null);}}/></Modal>}
            {showGroupForm&&<Modal onClose={()=>{setShowGroupForm(false);setEditGroup(null);}} title={editGroup?"Editar Grupo":"Novo Grupo"}><GroupForm item={editGroup} onSave={saveGroup} onClose={()=>{setShowGroupForm(false);setEditGroup(null);}}/></Modal>}
          </div>
        )}

        {activeTab==="revenues"&&(
          <div style={S.section}>
            <div style={S.rowBetween}>
              <button style={S.btnPrimary} onClick={()=>{setEditItem(null);setShowRevForm(true);}}><Icon d={ic.plus} size={14}/> Nova Receita</button>
              <button style={S.btnSecondary} onClick={()=>{setEditRevGroup(null);setShowRevGroupForm(true);}}><Icon d={ic.plus} size={14}/> Categoria</button>
            </div>
            <div style={{display:"flex",justifyContent:"flex-end",marginTop:8}}>
              {!selectRevMode?(
                <button style={{...S.btnSecondary,fontSize:12}} onClick={()=>setSelectRevMode(true)}><Icon d={ic.copy||ic.check} size={13}/> Selecionar para copiar</button>
              ):(
                <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center",width:"100%",justifyContent:"flex-end"}}>
                  <span style={{fontSize:12,color:B.textMuted}}>{selectedRev.length} selecionado(s)</span>
                  <button style={{...S.btnSecondary,fontSize:12}} onClick={()=>setSelectedRev(selectedRev.length===monthRevenues.length?[]:monthRevenues.map(r=>r.id))}>{selectedRev.length===monthRevenues.length?"Desmarcar todos":"Selecionar todos"}</button>
                  <button style={{...S.btnPrimary,fontSize:12}} onClick={copyRevenuesToNextMonth}>Copiar para {MONTHS[(selMonth+1)%12]}</button>
                  <button style={{...S.btnSecondary,fontSize:12}} onClick={()=>{setSelectRevMode(false);setSelectedRev([]);}}>Cancelar</button>
                </div>
              )}
            </div>
            <div style={S.card}>
              <div style={S.cardTitle}>Total — {MONTHS_FULL[selMonth]}</div>
              <div style={{fontSize:32,fontWeight:800,color:B.green,letterSpacing:-1}}>{fmt(totalRevenue)}</div>
              <div style={{display:"flex",gap:16,marginTop:6,flexWrap:"wrap"}}>
                <div style={{fontSize:12,color:B.textMuted}}>{monthRevenues.length} lançamento(s)</div>
                <div style={{fontSize:12,color:B.green,fontWeight:600}}>✓ Recebido: {fmt(receivedRev)}</div>
                <div style={{fontSize:12,color:B.warning,fontWeight:600}}>⏳ A receber: {fmt(totalRevenue-receivedRev)}</div>
                {monthRevenues.filter(r=>isRevenueOverdue(r)).length>0&&(<div style={{fontSize:12,color:B.danger,fontWeight:700}}>● {monthRevenues.filter(r=>isRevenueOverdue(r)).length} em atraso</div>)}
              </div>
            </div>
            {revGroups.map(rg=>{
              const items=monthRevenues.filter(r=>r.groupId===rg.id);
              if(items.length===0)return null;
              return(
                <div key={rg.id} style={S.groupCard}>
                  <div style={S.groupHeader}>
                    <div style={{display:"flex",alignItems:"center",gap:10}}><div style={{width:10,height:10,borderRadius:"50%",background:rg.color}}/><span style={{fontWeight:700,fontSize:14,color:B.text}}>{rg.name}</span></div>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <span style={{fontWeight:700,fontSize:14,color:B.green}}>{fmt(items.reduce((s,r)=>s+(r.value||0),0))}</span>
                      <button style={{...S.iconBtn,padding:2}} onClick={()=>{setEditRevGroup(rg);setShowRevGroupForm(true);}}><Icon d={ic.edit} size={12} stroke="#6366f1"/></button>
                    </div>
                  </div>
                  {items.map(r=>(
                    <div key={r.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 16px",borderBottom:`1px solid ${B.bg}`,opacity:r.received?0.7:1}}>
                      {selectRevMode&&<input type="checkbox" checked={selectedRev.includes(r.id)} onChange={()=>setSelectedRev(prev=>prev.includes(r.id)?prev.filter(x=>x!==r.id):[...prev,r.id])} style={{width:18,height:18,flexShrink:0,accentColor:B.green,cursor:"pointer"}}/>}
                      <button style={{width:22,height:22,borderRadius:6,border:`2px solid ${r.received?B.green:isRevenueOverdue(r)?B.danger:B.grayMid}`,background:r.received?B.green:"transparent",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}} onClick={()=>toggleReceived(r.id)}>
                        {r.received&&<Icon d={ic.check} size={11} stroke="#fff" strokeWidth={2.5}/>}
                      </button>
                      <div style={{flex:1}}>
                        <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                          <span style={{fontSize:13,fontWeight:600,color:B.text,textDecoration:r.received?"line-through":"none"}}>{r.description}</span>
                          {r.recurring&&<span style={{display:"inline-flex",alignItems:"center",gap:3,fontSize:10,color:B.greenDim,background:B.greenPale,padding:"2px 6px",borderRadius:99}}><Icon d={ic.repeat} size={10}/>recorrente</span>}
                          {isRevenueOverdue(r)&&<span style={{fontSize:10,color:"#fff",background:B.danger,padding:"2px 7px",borderRadius:99,fontWeight:700}}>● EM ATRASO</span>}
                          {r.isCarryover&&<span style={{fontSize:10,color:B.green,background:B.greenPale,padding:"2px 6px",borderRadius:99,fontWeight:600}}>saldo anterior</span>}
                        </div>
                        <div style={{fontSize:11,color:B.textMuted}}>{r.source||""}{r.expectedDate?` · Previsto ${r.expectedDate}`:""}</div>
                        {r.observation&&<div style={{fontSize:11,color:B.textMuted,marginTop:2,fontStyle:"italic"}}>📝 {r.observation}</div>}
                        {r.attachment&&<a href={r.attachment.url} target="_blank" rel="noreferrer" style={{fontSize:11,color:B.green,marginTop:2,display:"block"}}>📎 {r.attachment.name||"Ver comprovante"}</a>}
                        {r.authorName&&<div style={{fontSize:10,color:B.green}}>👤 {r.authorName}</div>}
                      </div>
                      <div style={{fontWeight:700,fontSize:14,color:r.received?B.green:isRevenueOverdue(r)?B.danger:B.navy}}>{fmt(r.value)}</div>
                      <button style={S.iconBtn} onClick={()=>duplicateRevenue(r)} title="Duplicar"><Icon d={ic.copy||ic.plus} size={13} stroke="#22d3ee"/></button>
                      <button style={S.iconBtn} onClick={()=>{setEditItem(r);setShowRevForm(true);}}><Icon d={ic.edit} size={13} stroke="#6366f1"/></button>
                      <button style={S.iconBtn} onClick={()=>deleteRevenue(r.id)}><Icon d={ic.trash} size={13} stroke={B.danger}/></button>
                    </div>
                  ))}
                </div>
              );
            })}
            {monthRevenues.length===0&&<div style={S.emptyState}><div style={{fontSize:48}}>💰</div><div style={{color:B.textMuted,fontSize:14}}>Nenhuma receita em {MONTHS_FULL[selMonth]}</div><button style={S.btnPrimary} onClick={()=>setShowRevForm(true)}>Lançar primeira receita</button></div>}
            {showRevForm&&<Modal onClose={()=>{setShowRevForm(false);setEditItem(null);}} title={editItem?"Editar Receita":"Nova Receita"}><RevenueForm revGroups={revGroups} item={editItem} selMonth={selMonth} selYear={selYear} onSave={saveRevenue} onClose={()=>{setShowRevForm(false);setEditItem(null);}}/></Modal>}
            {showRevGroupForm&&<Modal onClose={()=>{setShowRevGroupForm(false);setEditRevGroup(null);}} title={editRevGroup?"Editar Categoria":"Nova Categoria"}><GroupForm item={editRevGroup} onSave={saveRevGroup} onClose={()=>{setShowRevGroupForm(false);setEditRevGroup(null);}}/></Modal>}
          </div>
        )}

        {activeTab==="goals"&&(
          <div style={S.section}>
            <button style={{...S.btnPrimary,justifyContent:"center"}} onClick={()=>{setEditGoal(null);setShowGoalForm(true);}}><Icon d={ic.plus} size={14}/> Nova Meta 🎯</button>
            {goals.length===0&&<div style={S.emptyState}><div style={{fontSize:48}}>🐷</div><div style={{color:B.textMuted,fontSize:14}}>Crie sua primeira meta!</div></div>}
            {goals.map(goal=><GoalCard key={goal.id} goal={goal} onDeposit={depositGoal} onEdit={g=>{setEditGoal(g);setShowGoalForm(true);}} onDelete={deleteGoal}/>)}
            {showGoalForm&&<Modal onClose={()=>{setShowGoalForm(false);setEditGoal(null);}} title={editGoal?"Editar Meta":"Nova Meta 🎯"}><GoalForm item={editGoal} onSave={saveGoal} onClose={()=>{setShowGoalForm(false);setEditGoal(null);}}/></Modal>}
          </div>
        )}
        {activeTab==="cards"&&(
          <div style={S.section}>
            <div style={S.rowBetween}>
              <button style={S.btnPrimary} onClick={()=>{setEditCard(null);setShowCardForm(true);}}><Icon d={ic.plus} size={14}/> Novo Cartão</button>
              <button style={S.btnSecondary} onClick={()=>{setEditMiles(null);setShowMilesForm(true);}}><Icon d={ic.plus} size={14}/> Milhas</button>
            </div>
            {cards.length>0&&(()=>{
              const totalLimit=cards.reduce((s,c)=>s+(c.limit||0),0);
              const totalUsed=cards.reduce((s,c)=>s+(c.used||0),0);
              const totalAvail=totalLimit-totalUsed;
              const totalAnnual=cards.reduce((s,c)=>s+(c.annualFee||0),0);
              const todayDay=TODAY.getDate();
              const dueSoon=cards.filter(c=>c.dueDay&&Math.abs(c.dueDay-todayDay)<=5);
              return(<>
                {dueSoon.length>0&&(<div style={{background:"#fef9c3",border:"1px solid #fde68a",borderRadius:14,padding:14}}><div style={{fontWeight:700,fontSize:13,color:"#92400e",marginBottom:8}}>⚠ Faturas próximas do vencimento</div>{dueSoon.map(c=><div key={c.id} style={{display:"flex",justifyContent:"space-between",fontSize:13,color:"#92400e",padding:"4px 0"}}><span>💳 {c.name}</span><span>Vence dia {c.dueDay} · {fmt(c.used||0)}</span></div>)}</div>)}
                <div style={S.card}>
                  <div style={S.cardTitle}><Icon d={ic.credit} size={14} stroke={B.green}/>Resumo Geral</div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:16}}>
                    <div style={{textAlign:"center",background:B.bg,borderRadius:12,padding:12,border:`1px solid ${B.border}`}}><div style={{fontSize:10,color:B.textMuted,fontWeight:600,marginBottom:4}}>Limite Total</div><div style={{fontWeight:800,fontSize:16,color:B.text}}>{fmt(totalLimit)}</div></div>
                    <div style={{textAlign:"center",background:B.bg,borderRadius:12,padding:12,border:`1px solid ${B.border}`}}><div style={{fontSize:10,color:B.textMuted,fontWeight:600,marginBottom:4}}>Utilizado</div><div style={{fontWeight:800,fontSize:16,color:B.warning}}>{fmt(totalUsed)}</div></div>
                    <div style={{textAlign:"center",background:B.bg,borderRadius:12,padding:12,border:`1px solid ${B.border}`}}><div style={{fontSize:10,color:B.textMuted,fontWeight:600,marginBottom:4}}>Disponível</div><div style={{fontWeight:800,fontSize:16,color:B.green}}>{fmt(totalAvail)}</div></div>
                  </div>
                  <div style={{marginBottom:8}}><div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:B.textMuted,marginBottom:4}}><span>Utilização geral</span><span style={{fontWeight:700,color:pct(totalUsed,totalLimit)>80?B.danger:B.warning}}>{pct(totalUsed,totalLimit)}%</span></div><div style={{height:8,background:B.border,borderRadius:99,overflow:"hidden"}}><div style={{width:`${pct(totalUsed,totalLimit)}%`,height:"100%",background:pct(totalUsed,totalLimit)>80?B.danger:B.warning,borderRadius:99,transition:"width .5s"}}/></div></div>
                  <div style={{marginTop:16}}><div style={{fontSize:11,color:B.textMuted,fontWeight:600,marginBottom:10}}>Por Cartão</div>{cards.map(c=>{const used=c.used||0;const p=pct(used,c.limit||1);return(<div key={c.id} style={{marginBottom:10}}><div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:4}}><span style={{fontWeight:600,color:B.text}}>{c.name}</span><span style={{color:B.textMuted}}>{fmt(used)} / {fmt(c.limit)}</span></div><div style={{height:6,background:B.border,borderRadius:99,overflow:"hidden"}}><div style={{width:`${p}%`,height:"100%",background:c.color,borderRadius:99}}/></div></div>);})}</div>
                  {totalAnnual>0&&(<div style={{marginTop:16,background:`${B.warning}18`,border:`1px solid ${B.warning}44`,borderRadius:10,padding:12}}><div style={{fontSize:12,color:B.text,fontWeight:700}}>💰 Custo total de anuidades</div><div style={{fontSize:20,fontWeight:800,color:B.warning,marginTop:4}}>{fmt(totalAnnual)}<span style={{fontSize:11,color:B.textMuted,fontWeight:400}}>/ano</span></div><div style={{fontSize:11,color:B.textMuted}}>{fmt(totalAnnual/12)}/mês</div></div>)}
                </div>
                <div style={S.card}><div style={S.cardTitle}><Icon d={ic.credit} size={14} stroke={B.green}/>Meus Cartões</div>
                  {cards.map(c=>{const used=c.used||0;const avail=(c.limit||0)-used;const dueDiff=c.dueDay?c.dueDay-todayDay:null;const isUrgent=dueDiff!==null&&dueDiff>=0&&dueDiff<=5;return(
                    <div key={c.id} style={{marginBottom:12,background:`${c.color}0d`,border:`1.5px solid ${isUrgent?"#fde68a":c.color+"33"}`,borderRadius:14,padding:16}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:10}}>
                        <div><div style={{display:"flex",alignItems:"center",gap:8}}><div style={{width:10,height:10,borderRadius:"50%",background:c.color}}/><span style={{fontWeight:700,fontSize:15,color:B.text}}>{c.name}</span>{isUrgent&&<span style={{fontSize:10,background:"#fef9c3",color:"#92400e",padding:"2px 8px",borderRadius:99,fontWeight:700}}>⚠ Vence em {dueDiff===0?"hoje":`${dueDiff}d`}</span>}</div><div style={{fontSize:11,color:B.textMuted,marginTop:2}}>{c.bank||""}{c.dueDay?` · Vence dia ${c.dueDay}`:""}</div>{c.annualFee>0&&<div style={{fontSize:11,color:B.warning,fontWeight:600}}>Anuidade: {fmt(c.annualFee)}/ano</div>}</div>
                        <div style={{display:"flex",gap:4}}><button style={S.iconBtn} onClick={()=>{setEditCard(c);setShowCardForm(true);}}><Icon d={ic.edit} size={13} stroke="#6366f1"/></button><button style={S.iconBtn} onClick={()=>deleteCard(c.id)}><Icon d={ic.trash} size={13} stroke={B.danger}/></button></div>
                      </div>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:10}}><div style={{textAlign:"center"}}><div style={{fontSize:10,color:B.textMuted}}>Total</div><div style={{fontWeight:700,fontSize:13,color:B.text}}>{fmt(c.limit)}</div></div><div style={{textAlign:"center"}}><div style={{fontSize:10,color:B.textMuted}}>Utilizado</div><div style={{fontWeight:700,fontSize:13,color:B.warning}}>{fmt(used)}</div></div><div style={{textAlign:"center"}}><div style={{fontSize:10,color:B.textMuted}}>Disponível</div><div style={{fontWeight:700,fontSize:13,color:B.green}}>{fmt(avail)}</div></div></div>
                      <div style={{height:5,background:B.border,borderRadius:99,overflow:"hidden"}}><div style={{width:`${pct(used,c.limit)}%`,height:"100%",background:c.color,borderRadius:99}}/></div>
                    </div>
                  );})}
                </div>
              </>);
            })()}
            {cards.length===0&&<div style={S.emptyState}><div style={{fontSize:48}}>💳</div><div style={{color:B.textMuted,fontSize:14}}>Nenhum cartão cadastrado</div><button style={S.btnPrimary} onClick={()=>setShowCardForm(true)}>Adicionar cartão</button></div>}
            <div style={S.card}><div style={S.cardTitle}><Icon d={ic.plane} size={14} stroke={B.green}/>Milhas — {MONTHS_FULL[selMonth]}/{selYear}</div>
              {miles.filter(m=>m.month===selMonth&&m.year===selYear).length===0?<div style={S.empty}>Nenhum saldo lançado</div>:(miles.filter(m=>m.month===selMonth&&m.year===selYear).map(m=>(<div key={m.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 0",borderBottom:`1px solid ${B.border}`}}><div style={{width:36,height:36,borderRadius:10,background:B.navyMid,border:`1px solid rgba(51,214,159,.2)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>{m.emoji||"✈️"}</div><div style={{flex:1}}><div style={{fontWeight:700,fontSize:13,color:B.text}}>{m.program}</div><div style={{fontSize:11,color:B.textMuted}}>{m.card||""}</div></div><div style={{fontWeight:800,fontSize:16,color:B.green}}>{(m.points||0).toLocaleString("pt-BR")}<span style={{fontSize:10,color:B.textMuted,marginLeft:2}}>pts</span></div><button style={S.iconBtn} onClick={()=>{setEditMiles(m);setShowMilesForm(true);}}><Icon d={ic.edit} size={13} stroke="#6366f1"/></button><button style={S.iconBtn} onClick={()=>deleteMiles(m.id)}><Icon d={ic.trash} size={13} stroke={B.danger}/></button></div>)))}
              <button style={{...S.btnSecondary,marginTop:12,justifyContent:"center"}} onClick={()=>{setEditMiles(null);setShowMilesForm(true);}}><Icon d={ic.plus} size={13}/> Atualizar Milhas</button>
            </div>
            {showCardForm&&<Modal onClose={()=>{setShowCardForm(false);setEditCard(null);}} title={editCard?"Editar Cartão":"Novo Cartão 💳"}><CardForm item={editCard} onSave={saveCard} onClose={()=>{setShowCardForm(false);setEditCard(null);}}/></Modal>}
            {showMilesForm&&<Modal onClose={()=>{setShowMilesForm(false);setEditMiles(null);}} title={editMiles?"Editar Milhas":"Lançar Milhas ✈️"}><MilesForm item={editMiles} selMonth={selMonth} selYear={selYear} onSave={saveMiles} onClose={()=>{setShowMilesForm(false);setEditMiles(null);}}/></Modal>}
          </div>
        )}

        {activeTab==="history"&&(
          <div style={S.section}>
            <div style={S.card}><div style={S.cardTitle}><Icon d={ic.filter} size={14} stroke={B.green}/>Filtrar</div><div style={{display:"flex",gap:8,flexWrap:"wrap"}}><button style={{...S.filterBtn,...(histFilter==="all"?S.filterBtnActive:{})}} onClick={()=>setHistFilter("all")}>Geral</button><button style={{...S.filterBtn,...(histFilter==="revenue"?{background:B.green,color:"#071C2C",borderColor:B.green,fontWeight:700}:{})}} onClick={()=>setHistFilter("revenue")}>Receitas</button>{groups.map(g=><button key={g.id} style={{...S.filterBtn,...(histFilter===g.id?{background:g.color,color:"#fff",borderColor:g.color,fontWeight:700}:{})}} onClick={()=>setHistFilter(g.id)}>{g.name}</button>)}</div></div>
            <div style={S.card}>
              <div style={S.cardTitle}>Evolução 12 Meses</div>
              <div style={{display:"flex",gap:4,alignItems:"flex-end",height:160,borderBottom:`1px solid ${B.border}`}}>
                {filteredHistory.map((h,i)=>{const maxH=Math.max(...filteredHistory.map(x=>Math.max(x.total,x.rev)),1);return(<div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4}}><div style={{flex:1,width:"100%",display:"flex",gap:2,alignItems:"flex-end"}}>{(histFilter==="all"||histFilter==="revenue")&&<div style={{flex:1,minHeight:2,borderRadius:"3px 3px 0 0",height:`${pct(h.rev,maxH)}%`,background:B.green,opacity:0.8}}/>}{histFilter!=="revenue"&&<div style={{flex:1,minHeight:2,borderRadius:"3px 3px 0 0",height:`${pct(h.total,maxH)}%`,background:histFilter!=="all"?(groups.find(g=>g.id===histFilter)?.color||B.warning):B.warning}}/>}</div><div style={{fontSize:9,fontWeight:h.month===selMonth&&h.year===selYear?700:400,color:h.month===selMonth&&h.year===selYear?B.green:B.textMuted}}>{h.label}</div></div>);})}
              </div>
            </div>
            <div style={S.card}><div style={S.cardTitle}>Detalhe por Mês</div><div style={{overflowX:"auto",maxWidth:"100%"}}><table style={{width:"100%",borderCollapse:"collapse",minWidth:380}}><thead><tr>{["Mês","Receita","Despesas","Saldo","Var.%"].map(h=><th key={h} style={{fontSize:11,color:B.textMuted,fontWeight:600,textAlign:"left",padding:"6px 8px",borderBottom:`1px solid ${B.border}`}}>{h}</th>)}</tr></thead><tbody>{filteredHistory.map((h,i)=>{const prev=filteredHistory[i-1];const varPct=prev&&prev.total>0?Math.round(((h.total-prev.total)/prev.total)*100):null;const bal=h.rev-h.total;return(<tr key={i} style={{background:h.month===selMonth&&h.year===selYear?`${B.green}11`:"transparent"}}><td style={{fontSize:12,padding:"8px",color:B.textSub}}>{h.label}/{h.year}</td><td style={{fontSize:12,padding:"8px",color:B.green,fontWeight:600}}>{fmt(h.rev)}</td><td style={{fontSize:12,padding:"8px",color:B.warning,fontWeight:600}}>{fmt(h.total)}</td><td style={{fontSize:12,padding:"8px",color:bal>=0?"#6366f1":B.danger,fontWeight:600}}>{fmt(bal)}</td><td style={{fontSize:12,padding:"8px"}}>{varPct!==null?<span style={{color:varPct>15?B.danger:varPct>0?B.warning:B.green,fontWeight:700}}>{varPct>0?"+":""}{varPct}%</span>:"—"}</td></tr>);})}</tbody></table></div></div>
          </div>
        )}
      </main>

      <footer style={{maxWidth:900,margin:"0 auto",padding:"8px 16px 32px",display:"flex",flexDirection:"column",alignItems:"center",gap:10}}>
        <div style={{display:"inline-flex",background:B.bgCard,border:`1px solid ${B.border}`,borderRadius:99,padding:4,gap:2}}>
          <button onClick={()=>setTheme("light")} style={{display:"flex",alignItems:"center",gap:6,padding:"7px 16px",borderRadius:99,border:"none",cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:"'Plus Jakarta Sans',sans-serif",background:theme==="light"?B.green:"transparent",color:theme==="light"?B.navy:B.textMuted,transition:"all .2s"}}>
            <Icon d={ic.sun} size={14} stroke={theme==="light"?B.navy:B.textMuted}/> Claro
          </button>
          <button onClick={()=>setTheme("dark")} style={{display:"flex",alignItems:"center",gap:6,padding:"7px 16px",borderRadius:99,border:"none",cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:"'Plus Jakarta Sans',sans-serif",background:theme==="dark"?B.green:"transparent",color:theme==="dark"?B.navy:B.textMuted,transition:"all .2s"}}>
            <Icon d={ic.moon} size={14} stroke={theme==="dark"?B.navy:B.textMuted}/> Escuro
          </button>
        </div>
        <div style={{fontSize:11,color:B.textMuted,fontWeight:600}}>Home<span style={{color:B.green}}> Finance</span> · v6.2</div>
      </footer>
    </div>
  );
}

function PieChart({data,onSliceClick}){
  const cx=70,cy=70,r=54;
  const toRad=deg=>(deg-90)*Math.PI/180;
  const arc=(start,slice)=>{if(slice>=360)return`M ${cx} ${cy-r} A ${r} ${r} 0 1 1 ${cx-0.01} ${cy-r} Z`;const s=toRad(start),e=toRad(start+slice);return`M ${cx} ${cy} L ${cx+r*Math.cos(s)} ${cy+r*Math.sin(s)} A ${r} ${r} 0 ${slice>180?1:0} 1 ${cx+r*Math.cos(e)} ${cy+r*Math.sin(e)} Z`;};
  return(<svg width={140} height={140} style={{flexShrink:0,cursor:"pointer"}}>{data.map((d,i)=><path key={i} d={arc(d.start,d.slice)} fill={d.color} stroke={B.bgCard} strokeWidth={2} onClick={()=>onSliceClick&&onSliceClick(d)} onMouseEnter={e=>e.target.style.opacity=".8"} onMouseLeave={e=>e.target.style.opacity="1"}/>)}<circle cx={cx} cy={cy} r={34} fill={B.bgCard}/><text x={cx} y={cy-5} textAnchor="middle" fontSize={10} fill={B.textMuted}>Total</text><text x={cx} y={cy+10} textAnchor="middle" fontSize={9} fontWeight="bold" fill={B.text}>{data.reduce((s,d)=>s+d.total,0).toLocaleString("pt-BR",{style:"currency",currency:"BRL",maximumFractionDigits:0})}</text></svg>);
}

function KpiCard({label,value,icon,color,sub}){return(<div style={{...S.kpiCard,borderTop:`3px solid ${color}`}}><div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}><div style={{width:34,height:34,borderRadius:10,background:`${color}18`,display:"flex",alignItems:"center",justifyContent:"center"}}><Icon d={ic[icon]} size={16} stroke={color}/></div><div style={{fontSize:10,color:B.textMuted,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em"}}>{label}</div></div><div style={{fontSize:18,fontWeight:800,letterSpacing:-0.5,color,marginBottom:4}}>{value}</div>{sub&&<div style={{fontSize:11,color:B.textMuted}}>{sub}</div>}</div>);}

function ProgressRow({label,value,total,color}){return(<div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}><div style={{display:"flex",justifyContent:"space-between",fontSize:12,width:130,flexShrink:0,color:B.textSub}}><span>{label}</span><span style={{color}}>{fmt(value)}</span></div><div style={{flex:1,height:5,background:B.border,borderRadius:99}}><div style={{width:`${pct(value,total)}%`,height:"100%",borderRadius:99,background:color,transition:"width .5s"}}/></div><span style={{fontSize:11,color:B.textMuted,width:32,textAlign:"right"}}>{pct(value,total)}%</span></div>);}

function GroupSection({group,items,total,onToggle,onEdit,onDelete,onDeleteGroup,onEditGroup,isOverdue,selectMode,selectedIds,onSelectItem,onDuplicate}){
  const [open,setOpen]=useState(true);
  return(<div style={S.groupCard}><div style={S.groupHeader} onClick={()=>setOpen(o=>!o)}><div style={{display:"flex",alignItems:"center",gap:10}}><div style={{width:10,height:10,borderRadius:"50%",background:group.color}}/><span style={{fontWeight:700,fontSize:14,color:B.text}}>{group.name}</span><span style={{fontSize:11,fontWeight:700,padding:"2px 8px",borderRadius:99,background:`${group.color}18`,color:group.color}}>{items.length}</span></div><div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontWeight:700,fontSize:14,color:B.text}}>{fmt(total)}</span><button style={{...S.iconBtn,padding:2}} onClick={e=>{e.stopPropagation();onEditGroup&&onEditGroup(group);}}><Icon d={ic.edit} size={12} stroke="#6366f1"/></button><button style={{...S.iconBtn,padding:2}} onClick={e=>{e.stopPropagation();if(window.confirm("Remover grupo?"))onDeleteGroup(group.id);}}><Icon d={ic.trash} size={12} stroke={B.danger}/></button><Icon d={open?ic.chevron_down:ic.chevron_right} size={14} stroke={B.grayMid}/></div></div>{open&&items.map(item=><ExpenseRow key={item.id} item={item} onToggle={onToggle} onEdit={onEdit} onDelete={onDelete} isOverdue={isOverdue} selectMode={selectMode} selected={selectedIds&&selectedIds.includes(item.id)} onSelectItem={onSelectItem} onDuplicate={onDuplicate}/>)}</div>);
}

function ExpenseRow({item,onToggle,onEdit,onDelete,isOverdue,selectMode,selected,onSelectItem,onDuplicate}){
  const overdue=isOverdue?isOverdue(item):false;
  return(<div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 16px",borderBottom:`1px solid ${B.bg}`,opacity:item.paid?0.6:1}}>{selectMode&&<input type="checkbox" checked={!!selected} onChange={()=>onSelectItem&&onSelectItem(item.id)} style={{width:18,height:18,flexShrink:0,accentColor:B.green,cursor:"pointer"}}/>}<button style={{width:22,height:22,borderRadius:6,border:`2px solid ${item.paid?B.green:overdue?B.danger:B.grayMid}`,background:item.paid?B.green:"transparent",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}} onClick={()=>onToggle(item.id)}>{item.paid&&<Icon d={ic.check} size={11} stroke="#fff" strokeWidth={2.5}/>}</button><div style={{flex:1,minWidth:0}}><div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}><span style={{fontSize:13,fontWeight:600,color:B.text,textDecoration:item.paid?"line-through":"none"}}>{item.description}</span>{item.recurring&&<span style={{display:"inline-flex",alignItems:"center",gap:3,fontSize:10,color:B.greenDim,background:B.greenPale,padding:"2px 6px",borderRadius:99}}><Icon d={ic.repeat} size={10}/>recorrente</span>}{overdue&&<span style={{fontSize:10,color:"#fff",background:B.danger,padding:"2px 7px",borderRadius:99,fontWeight:700}}>● EM ATRASO</span>}</div><div style={{fontSize:11,color:B.textMuted,marginTop:2}}>{item.creditor}{item.dueDate?` · Vence ${item.dueDate}`:item.dueDay?` · Vence dia ${item.dueDay}`:""}{item.refMonth!==undefined?` · Ref: ${MONTHS[item.refMonth]}/${item.refYear||new Date().getFullYear()}`:""}</div>{item.observation&&<div style={{fontSize:11,color:B.textMuted,marginTop:2,fontStyle:"italic"}}>📝 {item.observation}</div>}{item.attachment&&<a href={item.attachment.url} target="_blank" rel="noreferrer" style={{fontSize:11,color:B.green,marginTop:2,display:"block"}}>📎 {item.attachment.name||"Ver comprovante"}</a>}{item.authorName&&<div style={{fontSize:10,color:B.green}}>👤 {item.authorName}</div>}</div><div style={{fontWeight:700,fontSize:14,flexShrink:0,color:item.paid?B.green:overdue?B.danger:B.navy}}>{fmt(item.value)}</div><div style={{display:"flex",gap:4,flexShrink:0}}><button style={S.iconBtn} onClick={()=>onDuplicate&&onDuplicate(item)} title="Duplicar"><Icon d={ic.copy||ic.plus} size={13} stroke="#22d3ee"/></button><button style={S.iconBtn} onClick={()=>onEdit(item)}><Icon d={ic.edit} size={13} stroke="#6366f1"/></button><button style={S.iconBtn} onClick={()=>onDelete(item.id)}><Icon d={ic.trash} size={13} stroke={B.danger}/></button></div></div>);
}

function Modal({onClose,title,children}){return(<div style={S.overlay} onClick={e=>e.target===e.currentTarget&&onClose()}><div style={S.modal}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}><span style={{fontWeight:700,fontSize:16,color:B.text}}>{title}</span><button style={S.closeBtn} onClick={onClose}><Icon d={ic.x} size={16} stroke={B.textSub}/></button></div>{children}</div></div>);}

function ExpenseForm({groups,item,selMonth,selYear,onSave,onClose,cards}){
  const [desc,setDesc]=useState(item?.description||"");const [creditor,setCreditor]=useState(item?.creditor||"");const [value,setValue]=useState(item?.value||"");const [dueDate,setDueDate]=useState(item?.dueDate||"");const [refMonth,setRefMonth]=useState(item?.refMonth??selMonth);const [refYear,setRefYear]=useState(item?.refYear||selYear);const [groupId,setGroupId]=useState(item?.groupId||groups[0]?.id||"");const [recurring,setRecurring]=useState(item?.recurring||false);const [recurMonths,setRecurMonths]=useState(item?.recurMonths||12);const [paid,setPaid]=useState(item?.paid||false);const [updateFuture,setUpdateFuture]=useState(false);const [generateFuture,setGenerateFuture]=useState(false);const [aiSuggestion,setAiSuggestion]=useState(null);
  const [observation,setObservation]=useState(item?.observation||"");
  const [attachmentFile,setAttachmentFile]=useState(null);
  const [attachmentPreview,setAttachmentPreview]=useState(item?.attachment||null);
  const isEdit=!!item?.id;
  const selectedGroup=groups.find(g=>g.id===groupId);
  const isCardGroup=selectedGroup&&selectedGroup.name.toLowerCase().includes("cart");

  const suggestCategory=(text)=>{
    if(text.length<4||!groups.length)return;
    const found=localCategorize(text,groups);
    if(found&&found.id!==groupId){setAiSuggestion(found);}
  };

  useEffect(()=>{const t=setTimeout(()=>{if(desc.length>3)suggestCategory(desc);},600);return()=>clearTimeout(t);},[desc]);
  return(<div style={S.form}><label style={S.label}>Grupo</label><select style={S.input} value={groupId} onChange={e=>{setGroupId(e.target.value);setAiSuggestion(null);}}>{groups.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select><label style={S.label}>Descrição *</label>{isCardGroup&&cards&&cards.length>0?(<select style={S.input} value={desc} onChange={e=>{setDesc(e.target.value);const c=cards.find(c=>c.name===e.target.value);if(c&&!value)setValue(c.used||c.limit||"");}}><option value="">Selecione o cartão...</option>{cards.map(c=><option key={c.id} value={c.name}>{c.name}</option>)}</select>):(<input style={S.input} value={desc} onChange={e=>setDesc(e.target.value)} placeholder="ex: Conta de energia"/>)}{aiSuggestion&&(<div style={{display:"flex",alignItems:"center",gap:8,background:`${aiSuggestion.color}15`,border:`1px solid ${aiSuggestion.color}40`,borderRadius:10,padding:"8px 12px"}}><Icon d={ic.sparkle} size={13} stroke="#6366f1"/><span style={{fontSize:12,color:B.text,flex:1}}>IA sugere: <strong>{aiSuggestion.name}</strong></span><button style={{fontSize:11,fontWeight:700,color:aiSuggestion.color,background:"none",border:"none",cursor:"pointer"}} onClick={()=>{setGroupId(aiSuggestion.id);setAiSuggestion(null);}}>Usar ✓</button><button style={{fontSize:11,color:B.textMuted,background:"none",border:"none",cursor:"pointer"}} onClick={()=>setAiSuggestion(null)}>✕</button></div>)}<label style={S.label}>Credor</label><input style={S.input} value={creditor} onChange={e=>setCreditor(e.target.value)} placeholder="ex: CEMIG"/><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}><div><label style={S.label}>Valor (R$) *</label><input style={S.input} type="number" value={value} onChange={e=>setValue(e.target.value)} placeholder="0,00"/></div><div><label style={S.label}>Data de Vencimento</label><input style={S.input} type="date" value={dueDate} onChange={e=>setDueDate(e.target.value)}/></div></div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}><div><label style={S.label}>Mês de Referência</label><select style={S.input} value={refMonth} onChange={e=>setRefMonth(+e.target.value)}>{MONTHS_FULL.map((m,i)=><option key={i} value={i}>{m}</option>)}</select></div><div><label style={S.label}>Ano</label><input style={S.input} type="number" value={refYear} onChange={e=>setRefYear(+e.target.value)} min={2020} max={2099}/></div></div><label style={{display:"flex",alignItems:"center",gap:8,fontSize:13,color:B.textSub,cursor:"pointer"}}><input type="checkbox" checked={recurring} onChange={e=>setRecurring(e.target.checked)}/><Icon d={ic.repeat} size={14} stroke={B.green}/> Lançar como recorrente</label>{recurring&&(<div style={{background:B.greenPale,borderRadius:10,padding:12}}><label style={{...S.label,color:B.greenDim}}>Repetir por quantos meses?</label><div style={{display:"flex",alignItems:"center",gap:12,marginTop:6}}><input type="range" min={1} max={24} value={recurMonths} onChange={e=>setRecurMonths(+e.target.value)}/><span style={{fontWeight:700,color:B.green,minWidth:60}}>{recurMonths} {recurMonths===1?"mês":"meses"}</span></div><div style={{fontSize:11,color:B.greenDim,marginTop:6}}>💡 Datas e mês de referência avançam automaticamente.</div>{isEdit&&(<div style={{marginTop:10,display:"flex",flexDirection:"column",gap:8}}><label style={{display:"flex",alignItems:"center",gap:8,fontSize:12,color:B.greenDim,cursor:"pointer"}}><input type="checkbox" checked={updateFuture} onChange={e=>setUpdateFuture(e.target.checked)}/>Atualizar valor nos meses seguintes</label><label style={{display:"flex",alignItems:"center",gap:8,fontSize:12,color:B.greenDim,cursor:"pointer"}}><input type="checkbox" checked={generateFuture} onChange={e=>setGenerateFuture(e.target.checked)}/>Gerar lançamentos nos meses futuros</label></div>)}</div>)}{!recurring&&<label style={{display:"flex",alignItems:"center",gap:8,fontSize:13,color:B.textSub,cursor:"pointer"}}><input type="checkbox" checked={paid} onChange={e=>setPaid(e.target.checked)}/><Icon d={ic.check} size={14} stroke={B.green}/> Já está pago</label>}<label style={S.label}>Observação</label><textarea style={{...S.input,height:72,resize:"vertical",fontFamily:"'Plus Jakarta Sans',sans-serif"}} value={observation} onChange={e=>setObservation(e.target.value)} placeholder="Detalhes adicionais sobre esse lançamento..."/><label style={S.label}>Comprovante (opcional)</label><div style={{border:`1.5px dashed ${B.border}`,borderRadius:10,padding:12,textAlign:"center",background:B.bg}}>{attachmentPreview?(<div style={{display:"flex",alignItems:"center",gap:10,justifyContent:"space-between"}}><div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:20}}>{attachmentPreview.type?.includes("pdf")?"📄":"🖼️"}</span><div style={{textAlign:"left"}}><div style={{fontSize:12,fontWeight:600,color:B.text}}>{attachmentPreview.name||"Arquivo anexado"}</div><a href={attachmentPreview.url} target="_blank" rel="noreferrer" style={{fontSize:11,color:B.green}}>Ver arquivo ↗</a></div></div><button style={{background:"none",border:"none",cursor:"pointer",color:B.danger,fontSize:12}} onClick={()=>{setAttachmentFile(null);setAttachmentPreview(null);}}>✕ Remover</button></div>):(<label style={{cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:6}}><span style={{fontSize:28}}>📎</span><span style={{fontSize:12,color:B.textMuted}}>Clique para anexar imagem ou PDF</span><span style={{fontSize:10,color:B.textMuted}}>Máximo 2MB</span><input type="file" accept="image/*,application/pdf" style={{display:"none"}} onChange={e=>{const f=e.target.files[0];if(f){setAttachmentFile(f);setAttachmentPreview({name:f.name,type:f.type,url:URL.createObjectURL(f)});}}}/></label>)}</div><div style={S.formActions}><button style={S.btnSecondary} onClick={onClose}>Cancelar</button><button style={S.btnPrimary} onClick={()=>desc&&value&&onSave({...(item||{}),description:desc,creditor,value:parseFloat(value),dueDate,refMonth,refYear,groupId,recurring,recurMonths,paid:recurring?false:paid,updateFuture,generateFuture,observation,attachmentFile,attachment:attachmentFile?null:attachmentPreview,month:item?.month??selMonth,year:item?.year??selYear})}>Salvar</button></div></div>);
}

function RevenueForm({revGroups,item,selMonth,selYear,onSave,onClose}){
  const [desc,setDesc]=useState(item?.description||"");const [source,setSource]=useState(item?.source||"");const [value,setValue]=useState(item?.value||"");const [groupId,setGroupId]=useState(item?.groupId||revGroups[0]?.id||"");const [recurring,setRecurring]=useState(item?.recurring||false);const [recurMonths,setRecurMonths]=useState(item?.recurMonths||12);const [received,setReceived]=useState(item?.received||false);const [expectedDate,setExpectedDate]=useState(item?.expectedDate||"");const [updateFuture,setUpdateFuture]=useState(false);const isEdit=!!item?.id;
  const [observation,setObservation]=useState(item?.observation||"");
  const [attachmentFile,setAttachmentFile]=useState(null);
  const [attachmentPreview,setAttachmentPreview]=useState(item?.attachment||null);
  return(<div style={S.form}><label style={S.label}>Categoria</label><select style={S.input} value={groupId} onChange={e=>setGroupId(e.target.value)}>{revGroups.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select><label style={S.label}>Descrição *</label><input style={S.input} value={desc} onChange={e=>setDesc(e.target.value)} placeholder="ex: Salário Junho"/><label style={S.label}>Fonte</label><input style={S.input} value={source} onChange={e=>setSource(e.target.value)} placeholder="ex: Empresa XYZ"/><label style={S.label}>Valor (R$) *</label><input style={S.input} type="number" value={value} onChange={e=>setValue(e.target.value)} placeholder="0,00"/><label style={S.label}>Data Prevista de Recebimento</label><input style={S.input} type="date" value={expectedDate} onChange={e=>setExpectedDate(e.target.value)}/><label style={{display:"flex",alignItems:"center",gap:8,fontSize:13,color:B.textSub,cursor:"pointer"}}><input type="checkbox" checked={recurring} onChange={e=>setRecurring(e.target.checked)}/><Icon d={ic.repeat} size={14} stroke={B.green}/> Lançar como recorrente</label>{recurring&&(<div style={{background:B.greenPale,borderRadius:10,padding:12}}><label style={{...S.label,color:B.greenDim}}>Repetir por quantos meses?</label><div style={{display:"flex",alignItems:"center",gap:12,marginTop:6}}><input type="range" min={1} max={24} value={recurMonths} onChange={e=>setRecurMonths(+e.target.value)}/><span style={{fontWeight:700,color:B.green,minWidth:60}}>{recurMonths} {recurMonths===1?"mês":"meses"}</span></div><div style={{fontSize:11,color:B.greenDim,marginTop:6}}>💡 Data prevista avança automaticamente mês a mês.</div>{isEdit&&(<label style={{display:"flex",alignItems:"center",gap:8,fontSize:12,color:B.greenDim,cursor:"pointer",marginTop:10}}><input type="checkbox" checked={updateFuture} onChange={e=>setUpdateFuture(e.target.checked)}/>Atualizar também os meses seguintes</label>)}</div>)}<label style={{display:"flex",alignItems:"center",gap:8,fontSize:13,color:B.textSub,cursor:"pointer"}}><input type="checkbox" checked={received} onChange={e=>setReceived(e.target.checked)}/><Icon d={ic.check} size={14} stroke={B.green}/> Já foi recebido ✓</label><label style={S.label}>Observação</label><textarea style={{...S.input,height:72,resize:"vertical",fontFamily:"'Plus Jakarta Sans',sans-serif"}} value={observation} onChange={e=>setObservation(e.target.value)} placeholder="Detalhes adicionais sobre esse recebimento..."/><label style={S.label}>Comprovante de recebimento (opcional)</label><div style={{border:`1.5px dashed ${B.border}`,borderRadius:10,padding:12,textAlign:"center",background:B.bg}}>{attachmentPreview?(<div style={{display:"flex",alignItems:"center",gap:10,justifyContent:"space-between"}}><div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:20}}>{attachmentPreview.type?.includes("pdf")?"📄":"🖼️"}</span><div style={{textAlign:"left"}}><div style={{fontSize:12,fontWeight:600,color:B.text}}>{attachmentPreview.name||"Arquivo anexado"}</div><a href={attachmentPreview.url} target="_blank" rel="noreferrer" style={{fontSize:11,color:B.green}}>Ver arquivo ↗</a></div></div><button style={{background:"none",border:"none",cursor:"pointer",color:B.danger,fontSize:12}} onClick={()=>{setAttachmentFile(null);setAttachmentPreview(null);}}>✕ Remover</button></div>):(<label style={{cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:6}}><span style={{fontSize:28}}>📎</span><span style={{fontSize:12,color:B.textMuted}}>Clique para anexar imagem ou PDF</span><span style={{fontSize:10,color:B.textMuted}}>Máximo 2MB</span><input type="file" accept="image/*,application/pdf" style={{display:"none"}} onChange={e=>{const f=e.target.files[0];if(f){setAttachmentFile(f);setAttachmentPreview({name:f.name,type:f.type,url:URL.createObjectURL(f)});}}}/></label>)}</div><div style={S.formActions}><button style={S.btnSecondary} onClick={onClose}>Cancelar</button><button style={S.btnPrimary} onClick={()=>desc&&value&&onSave({...(item||{}),description:desc,source,value:parseFloat(value),groupId,recurring,recurMonths,received,expectedDate,updateFuture,observation,attachmentFile,attachment:attachmentFile?null:attachmentPreview,month:item?.month??selMonth,year:item?.year??selYear})}>Salvar</button></div></div>);
}

function GroupForm({item,onSave,onClose}){
  const [name,setName]=useState(item?.name||"");const [color,setColor]=useState(item?.color||B.green);const [icon,setIcon]=useState(item?.icon||"tag");
  const ICONS=["home","car","heart","bolt","wallet","tag","star","chart","coin","plane"];
  return(<div style={S.form}><label style={S.label}>Nome *</label><input style={S.input} value={name} onChange={e=>setName(e.target.value)} placeholder="ex: Alimentação"/><label style={S.label}>Cor</label><input type="color" value={color} onChange={e=>setColor(e.target.value)} style={{...S.input,padding:4,height:44,cursor:"pointer"}}/><label style={S.label}>Ícone</label><div style={{display:"flex",gap:8,flexWrap:"wrap"}}>{ICONS.map(ico=><button key={ico} onClick={()=>setIcon(ico)} style={{width:44,height:44,borderRadius:10,border:`2px solid ${icon===ico?color:"transparent"}`,background:icon===ico?`${color}22`:B.bg,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}><Icon d={ic[ico]} size={18} stroke={icon===ico?color:B.textSub}/></button>)}</div><div style={S.formActions}><button style={S.btnSecondary} onClick={onClose}>Cancelar</button><button style={S.btnPrimary} onClick={()=>name&&onSave(name,icon,color,item?.id)}>{item?"Salvar Alterações":"Criar"}</button></div></div>);
}

function GoalForm({item,onSave,onClose}){
  const [name,setName]=useState(item?.name||"");const [description,setDescription]=useState(item?.description||"");const [target,setTarget]=useState(item?.target||"");const [deadline,setDeadline]=useState(item?.deadline||"");const [type,setType]=useState(item?.type||"outro");
  const TYPES=[{v:"emergencia",l:"🛡️ Emergência"},{v:"viagem",l:"✈️ Viagem"},{v:"eletrodomestico",l:"🏠 Eletrodoméstico"},{v:"carro",l:"🚗 Carro"},{v:"educacao",l:"📚 Educação"},{v:"outro",l:"🎯 Outro"}];
  return(<div style={S.form}><label style={S.label}>Tipo</label><div style={{display:"flex",gap:8,flexWrap:"wrap"}}>{TYPES.map(t=><button key={t.v} onClick={()=>setType(t.v)} style={{padding:"6px 12px",borderRadius:20,border:`1.5px solid ${type===t.v?B.green:B.border}`,background:type===t.v?B.greenPale:B.bg,cursor:"pointer",fontSize:12,fontWeight:type===t.v?700:400,color:type===t.v?B.greenDim:B.textSub}}>{t.l}</button>)}</div><label style={S.label}>Nome *</label><input style={S.input} value={name} onChange={e=>setName(e.target.value)} placeholder="ex: Geladeira nova"/><label style={S.label}>Descrição</label><input style={S.input} value={description} onChange={e=>setDescription(e.target.value)} placeholder="ex: Samsung frost free"/><label style={S.label}>Valor Alvo (R$) *</label><input style={S.input} type="number" value={target} onChange={e=>setTarget(e.target.value)} placeholder="0,00"/><label style={S.label}>Prazo (opcional)</label><input style={S.input} type="date" value={deadline} onChange={e=>setDeadline(e.target.value)}/><div style={S.formActions}><button style={S.btnSecondary} onClick={onClose}>Cancelar</button><button style={S.btnPrimary} onClick={()=>name&&target&&onSave({...(item||{}),name,description,target:parseFloat(target),deadline,type,saved:item?.saved||0,deposits:item?.deposits||[]})}>Salvar Meta</button></div></div>);
}

function GoalCard({goal,onDeposit,onEdit,onDelete}){
  const [showDep,setShowDep]=useState(false);const [depVal,setDepVal]=useState("");const [depNote,setDepNote]=useState("Depósito");
  const saved=goal.saved||0,progress=pct(saved,goal.target);
  const EMOJIS={emergencia:"🛡️",viagem:"✈️",eletrodomestico:"🏠",carro:"🚗",educacao:"📚",outro:"🎯"};
  return(<div style={S.goalCard}><div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}><div style={{display:"flex",alignItems:"center",gap:12}}><div style={{fontSize:32}}>{EMOJIS[goal.type]||"🎯"}</div><div><div style={{fontWeight:700,fontSize:15,color:B.text}}>{goal.name}</div><div style={{fontSize:11,color:B.textMuted}}>{goal.description||""}</div></div></div><div style={{display:"flex",gap:4}}><button style={S.iconBtn} onClick={()=>onEdit(goal)}><Icon d={ic.edit} size={13} stroke="#6366f1"/></button><button style={S.iconBtn} onClick={()=>onDelete(goal.id)}><Icon d={ic.trash} size={13} stroke={B.danger}/></button></div></div><div style={{background:B.bg,borderRadius:10,padding:12,border:`1px solid ${B.border}`}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}><span style={{fontSize:12,color:B.textSub}}>Economizado</span><span style={{fontSize:12,fontWeight:700,color:B.text}}>{fmt(saved)} / {fmt(goal.target)}</span></div><div style={{height:8,background:B.border,borderRadius:99,overflow:"hidden"}}><div style={{width:`${progress}%`,height:"100%",background:progress>=100?B.green:`linear-gradient(90deg,#6366f1,${B.green})`,borderRadius:99,transition:"width .6s"}}/></div><div style={{display:"flex",justifyContent:"space-between",marginTop:6}}><span style={{fontSize:11,color:progress>=100?B.green:"#6366f1",fontWeight:700}}>{progress}% {progress>=100?"✓ Concluída!":""}</span>{goal.deadline&&<span style={{fontSize:11,color:B.textMuted}}>Prazo: {goal.deadline}</span>}</div></div>{!showDep?<button style={{...S.btnPrimary,justifyContent:"center",marginTop:8}} onClick={()=>setShowDep(true)}><Icon d={ic.coin} size={14}/> Depositar</button>:(<div style={{marginTop:8,display:"flex",flexDirection:"column",gap:8}}><input style={S.input} type="number" value={depVal} onChange={e=>setDepVal(e.target.value)} placeholder="Valor (R$)"/><input style={S.input} value={depNote} onChange={e=>setDepNote(e.target.value)} placeholder="Observação"/><div style={{display:"flex",gap:8}}><button style={S.btnSecondary} onClick={()=>setShowDep(false)}>Cancelar</button><button style={S.btnPrimary} onClick={()=>{if(depVal){onDeposit(goal,parseFloat(depVal),depNote);setShowDep(false);setDepVal("");}}}>Confirmar</button></div></div>)}{(goal.deposits||[]).length>0&&(<div style={{marginTop:12,borderTop:`1px solid ${B.border}`,paddingTop:10}}><div style={{fontSize:11,color:B.textMuted,marginBottom:6,fontWeight:600}}>ÚLTIMOS DEPÓSITOS</div>{[...(goal.deposits||[])].reverse().slice(0,3).map((d,i)=>(<div key={i} style={{display:"flex",justifyContent:"space-between",fontSize:12,padding:"4px 0"}}><span style={{color:B.textSub}}>{d.note} · {d.date}</span><span style={{fontWeight:600,color:B.green}}>+{fmt(d.value)}</span></div>))}</div>)}</div>);
}

function CardForm({item,onSave,onClose}){
  const [name,setName]=useState(item?.name||"");const [bank,setBank]=useState(item?.bank||"");const [limit,setLimit]=useState(item?.limit||"");const [used,setUsed]=useState(item?.used||"");const [color,setColor]=useState(item?.color||B.navy);const [dueDay,setDueDay]=useState(item?.dueDay||"");const [annualFee,setAnnualFee]=useState(item?.annualFee||"");
  return(<div style={S.form}><label style={S.label}>Nome do Cartão *</label><input style={S.input} value={name} onChange={e=>setName(e.target.value)} placeholder="ex: Nubank Roxinho"/><label style={S.label}>Banco / Emissor</label><input style={S.input} value={bank} onChange={e=>setBank(e.target.value)} placeholder="ex: Nubank"/><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}><div><label style={S.label}>Limite Total (R$) *</label><input style={S.input} type="number" value={limit} onChange={e=>setLimit(e.target.value)} placeholder="0,00"/></div><div><label style={S.label}>Valor Utilizado (R$)</label><input style={S.input} type="number" value={used} onChange={e=>setUsed(e.target.value)} placeholder="0,00"/></div></div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}><div><label style={S.label}>Dia de Vencimento</label><input style={S.input} type="number" min={1} max={31} value={dueDay} onChange={e=>setDueDay(e.target.value)} placeholder="ex: 10"/></div><div><label style={S.label}>Anuidade/ano (R$)</label><input style={S.input} type="number" value={annualFee} onChange={e=>setAnnualFee(e.target.value)} placeholder="0,00"/></div></div><label style={S.label}>Cor do Cartão</label><input type="color" value={color} onChange={e=>setColor(e.target.value)} style={{...S.input,padding:4,height:44,cursor:"pointer"}}/><div style={S.formActions}><button style={S.btnSecondary} onClick={onClose}>Cancelar</button><button style={S.btnPrimary} onClick={()=>name&&limit&&onSave({...(item||{}),name,bank,limit:parseFloat(limit),used:parseFloat(used||0),color,dueDay:dueDay?parseInt(dueDay):null,annualFee:annualFee?parseFloat(annualFee):0})}>Salvar</button></div></div>);
}

function MilesForm({item,selMonth,selYear,onSave,onClose}){
  const [program,setProgram]=useState(item?.program||"");const [card,setCard]=useState(item?.card||"");const [points,setPoints]=useState(item?.points||"");const [emoji,setEmoji]=useState(item?.emoji||"✈️");
  return(<div style={S.form}><label style={S.label}>Programa *</label><input style={S.input} value={program} onChange={e=>setProgram(e.target.value)} placeholder="ex: Smiles, TudoAzul"/><label style={S.label}>Cartão Vinculado</label><input style={S.input} value={card} onChange={e=>setCard(e.target.value)} placeholder="ex: Nubank Ultravioleta"/><label style={S.label}>Saldo de Pontos *</label><input style={S.input} type="number" value={points} onChange={e=>setPoints(e.target.value)} placeholder="ex: 50000"/><label style={S.label}>Ícone</label><div style={{display:"flex",gap:8}}>{["✈️","🌟","💎","🏆","🎯","🚀"].map(e=><button key={e} onClick={()=>setEmoji(e)} style={{width:44,height:44,borderRadius:10,border:`2px solid ${emoji===e?B.green:B.border}`,background:emoji===e?B.greenPale:B.bg,cursor:"pointer",fontSize:20}}>{e}</button>)}</div><div style={S.formActions}><button style={S.btnSecondary} onClick={onClose}>Cancelar</button><button style={S.btnPrimary} onClick={()=>program&&points&&onSave({...(item||{}),program,card,points:parseInt(points),emoji,month:item?.month??selMonth,year:item?.year??selYear})}>Salvar</button></div></div>);
}

// ─── IA LOCAL (GRATUITA) ──────────────────────────────────────────────────────
const KEYWORD_MAP={
  "moradia":["aluguel","condominio","condomínio","iptu","casa","apartamento","reforma","faxina","diarista","limpeza","agua","água","esgoto","internet","wifi","telefone fixo"],
  "transporte":["combustivel","combustível","gasolina","etanol","alcool","álcool","uber","99","taxi","táxi","onibus","ônibus","metro","metrô","estacionamento","pedagio","pedágio","ipva","seguro carro","manutencao carro","manutenção","oficina","pneu","revisao","revisão","posto"],
  "saude":["saúde","farmacia","farmácia","remedio","remédio","medico","médico","consulta","exame","dentista","plano de saude","plano de saúde","academia","psicologo","psicólogo","terapia","hospital","laboratorio","laboratório"],
  "energia":["energia","luz","celpe","cemig","enel","light","coelba","eletricidade","conta de luz"],
  "alimentacao":["mercado","supermercado","feira","padaria","acougue","açougue","restaurante","lanche","ifood","delivery","pizza","hamburguer","almoço","almoco","jantar","cafe","café","comida"],
  "educacao":["escola","faculdade","curso","livro","material escolar","mensalidade escolar","universidade","pos","pós","mba"],
  "lazer":["cinema","show","viagem","passeio","netflix","spotify","disney","hbo","amazon prime","streaming","jogo","game","bar","festa"],
};

function localCategorize(text,groups){
  const lower=text.toLowerCase();
  for(const[key,words]of Object.entries(KEYWORD_MAP)){
    if(words.some(w=>lower.includes(w))){
      const found=groups.find(g=>g.name.toLowerCase().includes(key)||key.includes(g.name.toLowerCase().slice(0,5)));
      if(found)return found;
    }
  }
  // fallback: match group name directly
  return groups.find(g=>lower.includes(g.name.toLowerCase()))||null;
}

function parseValueBR(text){
  // captura "680", "680,50", "1.680,50", "R$ 680"
  const m=text.replace(/\./g,"").match(/(\d+)[,]?(\d{0,2})/);
  if(!m)return null;
  return parseFloat(m[1]+"."+(m[2]||"0"));
}

function parseMonthBR(text){
  const lower=text.toLowerCase();
  const idx=MONTHS_FULL.findIndex(m=>lower.includes(m.toLowerCase()));
  return idx>=0?idx:null;
}

function AIPanel({onClose,expenses,revenues,groups,revGroups,selMonth,selYear,totalExpenses,totalRevenue,balance,paidExp,receivedRev,savingGoal,members,user,onSaveExpense,onSaveRevenue}){
  const [messages,setMessages]=useState([{role:"assistant",content:`Olá! 👋 Sou o assistente do Home Finance!\n\nPosso responder sobre suas finanças e lançar despesas/receitas por voz ou texto.\n\nExemplos:\n• "Como estão minhas finanças?"\n• "Lançar despesa de energia 680 reais"\n• "Receita de aluguel 525 reais"\n• "Quanto posso gastar?"\n• "Tenho contas em atraso?"`}]);
  const [input,setInput]=useState("");
  const [listening,setListening]=useState(false);
  const [voiceSupported]=useState(()=>"webkitSpeechRecognition" in window||"SpeechRecognition" in window);

  const monthExp=expenses.filter(e=>e.month===selMonth&&e.year===selYear);
  const monthRev=revenues.filter(r=>r.month===selMonth&&r.year===selYear);

  const answerQuestion=(text)=>{
    const lower=text.toLowerCase();

    // Lançamento de despesa/receita
    if(lower.includes("lançar")||lower.includes("lancar")||lower.includes("adicionar")||lower.includes("registrar")){
      const value=parseValueBR(text);
      if(!value)return{content:"Não consegui identificar o valor. 🤔 Tente algo como: \"Lançar despesa de energia 680 reais\""};
      const targetMonth=parseMonthBR(text)??selMonth;
      const isRevenue=lower.includes("receita")||lower.includes("recebimento")||lower.includes("recebi ");
      if(isRevenue){
        const rg=revGroups.find(g=>lower.includes(g.name.toLowerCase()))||revGroups[0];
        const desc=text.replace(/lançar|lancar|adicionar|registrar|receita|de|r\$|reais|[\d.,]+/gi," ").replace(/\s+/g," ").trim()||"Receita";
        const descCap=desc.charAt(0).toUpperCase()+desc.slice(1);
        const data={description:descCap,value,groupId:rg.id,month:targetMonth,year:selYear,received:false,recurring:false,authorUid:user.uid,authorName:user.displayName,source:""};
        onSaveRevenue(data);
        return{content:`✅ Receita registrada!\n\n📝 ${descCap}\n💰 ${fmt(value)}\n📅 ${MONTHS_FULL[targetMonth]}/${selYear}\n🏷️ ${rg.name}`,action:true};
      } else {
        const g=localCategorize(text,groups)||groups[0];
        const desc=text.replace(/lançar|lancar|adicionar|registrar|despesa|de|r\$|reais|em janeiro|em fevereiro|em março|em abril|em maio|em junho|em julho|em agosto|em setembro|em outubro|em novembro|em dezembro|[\d.,]+/gi," ").replace(/\s+/g," ").trim()||"Despesa";
        const descCap=desc.charAt(0).toUpperCase()+desc.slice(1);
        const data={description:descCap,value,groupId:g.id,month:targetMonth,year:selYear,paid:false,recurring:false,authorUid:user.uid,authorName:user.displayName,creditor:"",refMonth:targetMonth,refYear:selYear};
        onSaveExpense(data);
        return{content:`✅ Despesa registrada!\n\n📝 ${descCap}\n💰 ${fmt(value)}\n📅 ${MONTHS_FULL[targetMonth]}/${selYear}\n🏷️ ${g.name} (categorizado automaticamente)`,action:true};
      }
    }

    // Perguntas sobre finanças
    if(lower.includes("finanças")||lower.includes("financas")||lower.includes("resumo")||lower.includes("como est")){
      const overdue=monthExp.filter(e=>!e.paid&&e.dueDate&&new Date(e.dueDate)<TODAY).length;
      const status=balance>=0?"✅ No azul!":"⚠️ No vermelho!";
      return{content:`📊 Resumo de ${MONTHS_FULL[selMonth]}/${selYear}:\n\n💰 Receitas: ${fmt(totalRevenue)}\n   └ Recebido: ${fmt(receivedRev)}\n\n💸 Despesas: ${fmt(totalExpenses)}\n   └ Pago: ${fmt(paidExp)}\n\n${status} Saldo: ${fmt(balance)}\n\n🎯 Meta de economia (${savingGoal}%): ${fmt(totalRevenue*savingGoal/100)}\n${balance>=totalRevenue*savingGoal/100?"✅ Meta atingida!":"⏳ Faltam "+fmt(totalRevenue*savingGoal/100-balance)}\n${overdue>0?`\n🔴 Atenção: ${overdue} conta(s) em atraso!`:""}`};
    }

    if(lower.includes("quanto")&&(lower.includes("gastar")||lower.includes("sobra")||lower.includes("disponivel")||lower.includes("disponível"))){
      const target=totalRevenue*savingGoal/100;
      const available=balance-target;
      return{content:available>0
        ?`💚 Você ainda pode gastar ${fmt(available)} mantendo sua meta de economia de ${savingGoal}%.\n\nSaldo atual: ${fmt(balance)}\nReserva da meta: ${fmt(target)}`
        :`⚠️ Cuidado! Seu saldo atual (${fmt(balance)}) já está ${balance<0?"negativo":"abaixo da meta de economia de "+fmt(target)}.\n\nRecomendo evitar novos gastos este mês.`};
    }

    if(lower.includes("atraso")||lower.includes("vencid")||lower.includes("atrasad")){
      const overdueExp=monthExp.filter(e=>!e.paid&&e.dueDate&&new Date(e.dueDate)<TODAY);
      const overdueRev=monthRev.filter(r=>!r.received&&r.expectedDate&&new Date(r.expectedDate)<TODAY);
      if(overdueExp.length===0&&overdueRev.length===0)return{content:"✅ Ótima notícia! Você não tem nenhuma conta em atraso. Tudo em dia! 🎉"};
      let msg="🔴 Lançamentos em atraso:\n";
      if(overdueExp.length>0){msg+=`\n💸 Despesas (${overdueExp.length}):\n`+overdueExp.map(e=>`• ${e.description} — ${fmt(e.value)} (venceu ${e.dueDate})`).join("\n");}
      if(overdueRev.length>0){msg+=`\n\n💰 Receitas (${overdueRev.length}):\n`+overdueRev.map(r=>`• ${r.description} — ${fmt(r.value)} (previsto ${r.expectedDate})`).join("\n");}
      return{content:msg};
    }

    if(lower.includes("maior")&&(lower.includes("gasto")||lower.includes("despesa"))){
      if(monthExp.length===0)return{content:"Você ainda não tem despesas lançadas este mês."};
      const sorted=[...monthExp].sort((a,b)=>(b.value||0)-(a.value||0)).slice(0,5);
      return{content:`💸 Maiores despesas de ${MONTHS_FULL[selMonth]}:\n\n`+sorted.map((e,i)=>`${i+1}. ${e.description} — ${fmt(e.value)}`).join("\n")};
    }

    if(lower.includes("grupo")||lower.includes("categoria")){
      const byG=groups.map(g=>({name:g.name,total:monthExp.filter(e=>e.groupId===g.id).reduce((s,e)=>s+(e.value||0),0)})).filter(g=>g.total>0).sort((a,b)=>b.total-a.total);
      if(byG.length===0)return{content:"Sem despesas lançadas este mês ainda."};
      return{content:`📂 Gastos por grupo em ${MONTHS_FULL[selMonth]}:\n\n`+byG.map(g=>`• ${g.name}: ${fmt(g.total)} (${pct(g.total,totalExpenses)}%)`).join("\n")};
    }

    if(lower.includes("previsão")||lower.includes("previsao")||lower.includes("projeção")||lower.includes("projecao")||lower.includes("fechar o mês")||lower.includes("fechar o mes")){
      const dayOfMonth=TODAY.getDate();
      const daysInMonth=new Date(selYear,selMonth+1,0).getDate();
      if(selMonth!==CURRENT_MONTH||selYear!==CURRENT_YEAR)return{content:`A projeção funciona apenas para o mês atual. O saldo de ${MONTHS_FULL[selMonth]} é ${fmt(balance)}.`};
      const dailyRate=paidExp/Math.max(dayOfMonth,1);
      const projected=dailyRate*daysInMonth;
      const projBalance=totalRevenue-projected;
      return{content:`🔮 Projeção para o fim de ${MONTHS_FULL[selMonth]}:\n\nGasto médio diário: ${fmt(dailyRate)}\nProjeção de despesas: ${fmt(projected)}\nSaldo projetado: ${fmt(projBalance)}\n\n${projBalance>=0?"✅ Tendência positiva!":"⚠️ Atenção: tendência de fechar no vermelho!"}\n\n💡 Baseado no seu ritmo de pagamentos até hoje (dia ${dayOfMonth}).`};
    }

    if(lower.includes("oi")||lower.includes("olá")||lower.includes("ola")||lower.includes("bom dia")||lower.includes("boa tarde")||lower.includes("boa noite")){
      return{content:`Olá, ${user.displayName?.split(" ")[0]}! 😊 Como posso ajudar com suas finanças hoje?`};
    }

    return{content:`Hmm, não entendi muito bem. 🤔 Posso ajudar com:\n\n• "Como estão minhas finanças?"\n• "Lançar despesa de [descrição] [valor] reais"\n• "Receita de [descrição] [valor] reais"\n• "Quanto posso gastar?"\n• "Tenho contas em atraso?"\n• "Maiores gastos do mês"\n• "Gastos por grupo"\n• "Previsão do mês"`};
  };

  const sendMessage=(text)=>{
    if(!text.trim())return;
    setMessages(prev=>[...prev,{role:"user",content:text}]);
    setInput("");
    setTimeout(()=>{
      const reply=answerQuestion(text);
      setMessages(prev=>[...prev,{role:"assistant",content:reply.content,action:reply.action}]);
    },400);
  };

  const startVoice=()=>{
    const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!SpeechRecognition){alert("Reconhecimento de voz não suportado neste navegador. Use o Chrome.");return;}
    const recognition=new SpeechRecognition();
    recognition.lang="pt-BR";
    recognition.continuous=false;
    recognition.interimResults=false;
    recognition.onstart=()=>setListening(true);
    recognition.onend=()=>setListening(false);
    recognition.onresult=(e)=>{
      const transcript=e.results[0][0].transcript;
      setInput(transcript);
      setTimeout(()=>sendMessage(transcript),300);
    };
    recognition.onerror=()=>setListening(false);
    recognition.start();
  };

  const quickActions=["Como estão minhas finanças?","Quanto posso gastar?","Tenho contas em atraso?","Previsão do mês"];

  return(
    <div style={{...S.overlay,alignItems:"flex-end"}} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{...S.modal,height:"85vh",display:"flex",flexDirection:"column",padding:0,borderRadius:"20px 20px 0 0"}}>
        <div style={{background:`linear-gradient(135deg,#0A2540,#1a1060)`,padding:"16px 20px",borderRadius:"20px 20px 0 0",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:36,height:36,borderRadius:10,background:"rgba(99,102,241,.3)",border:"1px solid rgba(99,102,241,.4)",display:"flex",alignItems:"center",justifyContent:"center"}}>
              <Icon d={ic.sparkle} size={18} stroke="#a5b4fc"/>
            </div>
            <div>
              <div style={{fontWeight:800,fontSize:15,color:"#FFFFFF"}}>Assistente IA</div>
              <div style={{fontSize:10,color:"#a5b4fc"}}>Home Finance · {MONTHS_FULL[selMonth]}/{selYear}</div>
            </div>
          </div>
          <button style={{...S.closeBtn,background:"rgba(255,255,255,.1)",border:"1px solid rgba(255,255,255,.1)"}} onClick={onClose}><Icon d={ic.x} size={16} stroke="#FFFFFF"/></button>
        </div>

        <div style={{flex:1,overflowY:"auto",padding:"16px",display:"flex",flexDirection:"column",gap:12}} ref={el=>{if(el)el.scrollTop=el.scrollHeight;}}>
          {messages.map((m,i)=>(
            <div key={i} style={{display:"flex",justifyContent:m.role==="user"?"flex-end":"flex-start"}}>
              <div style={{maxWidth:"82%",padding:"10px 14px",borderRadius:m.role==="user"?"16px 16px 4px 16px":"16px 16px 16px 4px",background:m.role==="user"?B.green:B.bg,color:m.role==="user"?"#071C2C":B.text,fontSize:13,lineHeight:1.6,whiteSpace:"pre-wrap",border:m.role==="assistant"?`1px solid ${B.border}`:"none",boxShadow:"0 1px 4px rgba(0,0,0,.06)"}}>
                {m.role==="assistant"&&<div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6,opacity:.6}}><Icon d={ic.sparkle} size={11} stroke="#6366f1"/><span style={{fontSize:10,fontWeight:700,color:"#6366f1"}}>ASSISTENTE</span></div>}
                {m.content}
              </div>
            </div>
          ))}
        </div>

        {messages.length<=1&&(
          <div style={{padding:"0 16px 10px",display:"flex",gap:6,flexWrap:"wrap",flexShrink:0}}>
            {quickActions.map((q,i)=>(
              <button key={i} style={{padding:"6px 12px",background:B.bg,border:`1px solid ${B.border}`,borderRadius:20,fontSize:11,color:B.textSub,cursor:"pointer",fontFamily:"'Plus Jakarta Sans',sans-serif"}} onClick={()=>sendMessage(q)}>{q}</button>
            ))}
          </div>
        )}

        <div style={{padding:"12px 16px",borderTop:`1px solid ${B.border}`,display:"flex",gap:8,alignItems:"center",flexShrink:0,background:B.bgCard}}>
          {voiceSupported&&(
            <button style={{width:42,height:42,borderRadius:12,border:`1.5px solid ${listening?"#ef4444":B.border}`,background:listening?"#fee2e2":B.bg,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,animation:listening?"pulse 1s infinite":"none"}} onClick={startVoice}>
              <Icon d={ic.mic} size={18} stroke={listening?"#ef4444":B.textMuted}/>
            </button>
          )}
          <input style={{...S.input,flex:1,margin:0}} value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&sendMessage(input)} placeholder={listening?"🎤 Ouvindo...":"Pergunte ou dite um comando..."}/>
          <button style={{width:42,height:42,borderRadius:12,background:input.trim()?B.green:B.bg,border:`1.5px solid ${input.trim()?B.green:B.border}`,cursor:input.trim()?"pointer":"default",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}} onClick={()=>sendMessage(input)} disabled={!input.trim()}>
            <Icon d={ic.send} size={16} stroke={input.trim()?B.navy:B.textMuted}/>
          </button>
        </div>
        <style>{`@keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.08)}}`}</style>
      </div>
    </div>
  );
}

const S={
  app:{fontFamily:"'Plus Jakarta Sans','Segoe UI',sans-serif",background:B.bg,minHeight:"100vh",color:B.text},
  header:{background:B.navy,padding:"0 16px",borderBottom:`1px solid rgba(51,214,159,.08)`},
  headerInner:{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 0"},
  monthNav:{display:"flex",alignItems:"center",gap:8},
  navBtn:{background:"rgba(51,214,159,.08)",border:`1px solid rgba(51,214,159,.15)`,color:"#FFFFFF",width:28,height:28,borderRadius:8,cursor:"pointer",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center"},
  monthLabel:{color:"#FFFFFF",fontWeight:700,fontSize:13,minWidth:70,textAlign:"center"},
  nav:{background:B.navy,borderBottom:`1px solid rgba(51,214,159,.08)`,display:"flex",padding:"0 8px",overflowX:"auto",width:"100%",maxWidth:"100vw"},
  tab:{display:"flex",alignItems:"center",gap:5,padding:"11px 10px",border:"none",background:"transparent",cursor:"pointer",color:B.textMuted,fontSize:12,fontWeight:500,borderBottom:"2px solid transparent",whiteSpace:"nowrap",flexShrink:0,fontFamily:"'Plus Jakarta Sans',sans-serif"},
  tabActive:{color:B.green,borderBottomColor:B.green,fontWeight:700},
  memberBtn:{padding:"4px 12px",borderRadius:20,border:`1px solid rgba(51,214,159,.2)`,background:"rgba(51,214,159,.06)",color:B.grayMid,cursor:"pointer",fontSize:11,fontWeight:500,fontFamily:"'Plus Jakarta Sans',sans-serif",whiteSpace:"nowrap"},
  memberBtnActive:{background:B.green,color:"#071C2C",borderColor:B.green,fontWeight:700},
  main:{padding:16,maxWidth:900,margin:"0 auto",paddingBottom:40,overflowX:"hidden"},
  section:{display:"flex",flexDirection:"column",gap:14},
  kpiGrid:{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10},
  kpiCard:{background:B.bgCard,borderRadius:16,padding:14,boxShadow:`0 1px 4px rgba(7,28,44,.06)`,border:`1px solid ${B.border}`},
  card:{background:B.bgCard,borderRadius:16,padding:16,boxShadow:`0 1px 4px rgba(7,28,44,.06)`,border:`1px solid ${B.border}`},
  cardTitle:{fontWeight:700,fontSize:14,marginBottom:14,color:B.text,display:"flex",alignItems:"center",gap:6},
  empty:{fontSize:13,color:B.textMuted,textAlign:"center",padding:"16px 0"},
  rowBetween:{display:"flex",gap:10},
  btnPrimary:{display:"flex",alignItems:"center",gap:6,padding:"10px 16px",background:B.green,color:"#071C2C",border:"none",borderRadius:10,cursor:"pointer",fontWeight:700,fontSize:13,flex:1,fontFamily:"'Plus Jakarta Sans',sans-serif"},
  btnSecondary:{display:"flex",alignItems:"center",gap:6,padding:"10px 16px",background:B.bg,color:B.textSub,border:`1px solid ${B.border}`,borderRadius:10,cursor:"pointer",fontWeight:600,fontSize:13,flex:1,fontFamily:"'Plus Jakarta Sans',sans-serif"},
  groupCard:{background:B.bgCard,borderRadius:16,overflow:"hidden",boxShadow:`0 1px 4px rgba(7,28,44,.06)`,border:`1px solid ${B.border}`},
  groupHeader:{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 16px",cursor:"pointer",background:B.bg,borderBottom:`1px solid ${B.border}`},
  emptyState:{display:"flex",flexDirection:"column",alignItems:"center",gap:12,padding:"48px 16px",background:B.bgCard,borderRadius:16,border:`1px solid ${B.border}`},
  overlay:{position:"fixed",inset:0,background:"rgba(7,28,44,.7)",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:100,backdropFilter:"blur(6px)"},
  modal:{background:B.bgCard,borderRadius:"20px 20px 0 0",padding:20,width:"100%",maxWidth:540,maxHeight:"90vh",overflowY:"auto"},
  closeBtn:{background:B.bg,border:`1px solid ${B.border}`,borderRadius:8,cursor:"pointer",padding:6,display:"flex",alignItems:"center"},
  form:{display:"flex",flexDirection:"column",gap:10},
  label:{fontSize:12,fontWeight:600,color:B.textSub,marginBottom:2},
  input:{width:"100%",padding:"10px 12px",border:`1.5px solid ${B.border}`,borderRadius:10,fontSize:14,color:B.text,background:B.bg,boxSizing:"border-box",outline:"none",fontFamily:"'Plus Jakarta Sans',sans-serif"},
  formActions:{display:"flex",gap:10,marginTop:8},
  iconBtn:{background:"none",border:"none",cursor:"pointer",padding:6,borderRadius:6,display:"flex",alignItems:"center"},
  goalCard:{background:B.bgCard,borderRadius:16,padding:16,boxShadow:`0 1px 4px rgba(7,28,44,.06)`,border:`1px solid ${B.border}`},
  filterBtn:{padding:"6px 14px",borderRadius:20,border:`1.5px solid ${B.border}`,background:B.bg,cursor:"pointer",fontSize:12,fontWeight:500,color:B.textSub,fontFamily:"'Plus Jakarta Sans',sans-serif"},
  filterBtnActive:{background:B.green,color:"#071C2C",borderColor:B.green,fontWeight:700},
  toast:{position:"fixed",top:16,left:"50%",transform:"translateX(-50%)",color:"#FFFFFF",padding:"10px 20px",borderRadius:10,fontWeight:600,fontSize:13,zIndex:200,boxShadow:"0 4px 20px rgba(0,0,0,.3)",animation:"toast-in .3s ease",whiteSpace:"nowrap",fontFamily:"'Plus Jakarta Sans',sans-serif"},
};
