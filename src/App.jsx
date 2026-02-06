import { useState, useEffect, useCallback, useRef } from "react";

/* ═══════════════════════════════════════════════════════════════
   CONFIGURAÇÃO — Cola aqui o URL do Google Apps Script
   ═══════════════════════════════════════════════════════════════ */
const API_URL = "https://script.google.com/macros/s/AKfycbyXVJRcHlgaRgUpLvf3WLJJ0eJRr3MeFkcDK6Q3av8fT1AwqVnI9opDA4EaaD8TlEht5Q/exec";

/* ═══════════════════════ PALETA CAIDI ═══════════════════════ */
const C = {
  teal: "#00A89D", tealDark: "#008F86", tealLight: "#E6F7F6", tealSoft: "#B2E8E4",
  dark: "#2D3436", darkSoft: "#636E72", gray: "#B2BEC3", grayLight: "#DFE6E9",
  grayBg: "#F7F9FA", white: "#FFFFFF",
  green: "#00B894", greenBg: "#E8F8F5",
  yellow: "#FDCB6E", yellowBg: "#FFF9E6",
  red: "#E17055", redBg: "#FFEAEA",
  purple: "#6C5CE7", purpleBg: "#F0EDFF",
  blue: "#0984E3", blueBg: "#E8F4FD",
  orange: "#E17055", orangeBg: "#FFF0EB",
};

/* ═══════════════════════ API ═══════════════════════ */
async function apiGet(action, params = {}) {
  const qs = new URLSearchParams({ action, ...params }).toString();
  const res = await fetch(`${API_URL}?${qs}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (data.erro) throw new Error(data.erro);
  return data;
}
async function apiPost(data) {
  const res = await fetch(API_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/* ═══════════════════════ FILE UTILS ═══════════════════════ */
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result.split(",")[1];
      resolve({ nome: file.name, tipo: file.type, dados: base64 });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* ═══════════════════════ CÁLCULOS ═══════════════════════ */
function contarDiasUteis(i, f) {
  let c = 0; const d = new Date(i), e = new Date(f);
  while (d <= e) { if (d.getDay() % 6 !== 0) c++; d.setDate(d.getDate() + 1); }
  return c;
}
function periodoAtual(p) {
  const h = new Date();
  for (const x of p) { if (h >= new Date(x["Início"]) && h <= new Date(x.Fim)) return x; }
  return p.length > 0 ? p[0] : { "Período": "?", "Início": "", Fim: "" };
}
function calc(t, apoios, aus, per, fecho) {
  const p = periodoAtual(per), h = new Date();
  const iP = new Date(p["Início"]), fP = new Date(p.Fim);
  const dLT = contarDiasUteis(iP, fP), dLH = contarDiasUteis(iP, h);
  const hLD = Number(t["Horas Letivas"]) / 5;
  const dB = aus.filter(a => a.Motivo === "Baixa Médica" && a.Estado === "Aprovado").reduce((s, a) => s + Number(a["Dias Úteis"] || 0), 0);
  const dFJ = aus.filter(a => a.Motivo === "Falta Justificada" && a.Estado === "Aprovado").reduce((s, a) => s + Number(a["Dias Úteis"] || 0), 0);
  const dFI = aus.filter(a => a.Motivo === "Falta Injustificada" && a.Estado === "Aprovado").reduce((s, a) => s + Number(a["Dias Úteis"] || 0), 0);
  const dFO = aus.filter(a => a.Motivo === "Formação" && a.Estado === "Aprovado").reduce((s, a) => s + Number(a["Dias Úteis"] || 0), 0);
  const mMin = Math.round(hLD * (dLT - dB)), mE2 = Math.round(mMin * 1.05);
  const mH = Math.round(hLD * (dLH - dB));
  const ef = apoios.filter(a => a.Tipo === "Efetivado" && a.Data >= p["Início"] && a.Data <= p.Fim).length;
  const pH = mH > 0 ? Math.round((ef / mH) * 100) : 100;
  const pM = mMin > 0 ? Math.round((ef / mMin) * 100) : 100;
  const tF = fecho.reduce((s, f) => s + Number(f["Dias Úteis"] || 0), 0);
  const fU = aus.filter(a => a.Motivo === "Férias (Obrigatórias)" && (a.Estado === "Aprovado" || a.Estado === "Pendente")).reduce((s, a) => s + Number(a["Dias Úteis"] || 0), 0);
  const bU = aus.filter(a => a.Motivo === "Férias (Bónus)" && (a.Estado === "Aprovado" || a.Estado === "Pendente")).reduce((s, a) => s + Number(a["Dias Úteis"] || 0), 0);
  const oR = Number(t["Dias Férias"]) - fU, dBn = Number(t["Dias Bónus Ganhos"] || 0), bR = dBn - bU;
  const fE2 = Math.max(mE2 - ef, 0);
  const proj = dLH > 0 ? Math.round((ef / dLH) * dLT) : 0;
  const sc = pH >= 95 ? C.green : pH >= 80 ? C.yellow : C.red;
  return { periodo: p, ef, mMin, mE2, mH, pH, pM, diff: ef - mH, proj, tF, fU, bU, oR, dBn, bR, dB, dFJ, dFI, dFO, fE2, sc, dLT, dLH };
}

/* ═══════════════════════ MOTIVO CONFIG ═══════════════════════ */
const MOTIVOS = {
  "Férias (Obrigatórias)": { icon: "🌴", color: C.teal, label: "Férias obrig.", short: "Férias", upload: false },
  "Férias (Bónus)": { icon: "🎁", color: C.green, label: "Férias bónus", short: "Bónus", upload: false },
  "Baixa Médica": { icon: "🏥", color: C.purple, label: "Baixa médica", short: "Baixa", upload: true },
  "Falta Justificada": { icon: "📋", color: C.blue, label: "Falta justificada", short: "F. Just.", upload: true },
  "Falta Injustificada": { icon: "⚠️", color: C.red, label: "Falta injustificada", short: "F. Injust.", upload: false },
  "Formação": { icon: "🎓", color: C.orange, label: "Formação", short: "Formação", upload: true },
};
const motivoInfo = (m) => MOTIVOS[m] || { icon: "❓", color: C.gray, label: m, short: m, upload: false };

const EST = {
  Aprovado: { bg: C.greenBg, c: C.green, icon: "✓", l: "Aprovado" },
  Pendente: { bg: C.yellowBg, c: "#E17055", icon: "⏳", l: "Pendente" },
  Rejeitado: { bg: C.redBg, c: C.red, icon: "✕", l: "Rejeitado" },
};

/* ═══════════════════════ UI COMPONENTS ═══════════════════════ */
function Ring({ value, max, size, stroke, color, children }) {
  const r = (size - stroke) / 2, ci = 2 * Math.PI * r, p = Math.min(value / (max || 1), 1);
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={C.grayLight} strokeWidth={stroke} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={ci} strokeDashoffset={ci * (1 - p)} strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 1.4s cubic-bezier(.25,.46,.45,.94)" }} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>{children}</div>
    </div>
  );
}

const fmtD = d => { if (!d) return ""; const [y,m,day] = String(d).split("-"); return `${day}/${m}`; };
const fmtDF = d => { if (!d) return ""; const [y,m,day] = String(d).split("-"); return `${day}/${m}/${y}`; };
const ini = n => n ? n.split(" ").map(w => w[0]).join("").slice(0,2).toUpperCase() : "?";

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&display=swap');
* { box-sizing: border-box; }
body { margin: 0; font-family: 'DM Sans', sans-serif; background: ${C.grayBg}; }
@keyframes up { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
@keyframes slideUp { from { transform:translateY(100%); } to { transform:translateY(0); } }
@keyframes pop { 0% { transform:scale(0.9); opacity:0; } 100% { transform:scale(1); opacity:1; } }
@keyframes float { 0%,100% { transform:translateY(0); } 50% { transform:translateY(-6px); } }
input:focus, select:focus { outline: none; border-color: ${C.teal} !important; box-shadow: 0 0 0 3px ${C.tealLight} !important; }
button { font-family: 'DM Sans', sans-serif; }
select { font-family: 'DM Sans', sans-serif; }
::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-thumb { background: ${C.grayLight}; border-radius: 4px; }
`;

const Card = ({ children, style = {}, delay = 0 }) => (
  <div style={{ background: C.white, borderRadius: 20, padding: "18px 16px", boxShadow: "0 2px 12px rgba(0,0,0,0.04)", border: `1px solid ${C.grayLight}`, animation: `up 0.5s ease ${delay}s both`, ...style }}>{children}</div>
);

const Btn = ({ children, onClick, disabled, variant = "primary", style = {} }) => {
  const s = {
    primary: { background: `linear-gradient(135deg, ${C.teal}, ${C.tealDark})`, color: C.white, border: "none", boxShadow: `0 4px 16px ${C.teal}44` },
    secondary: { background: C.white, color: C.dark, border: `1.5px solid ${C.grayLight}`, boxShadow: "none" },
    danger: { background: C.white, color: C.red, border: `1.5px solid ${C.grayLight}`, boxShadow: "none" },
    success: { background: C.green, color: C.white, border: "none", boxShadow: `0 4px 12px ${C.green}44` },
    purple: { background: `linear-gradient(135deg, ${C.purple}, #5a4bd1)`, color: C.white, border: "none", boxShadow: `0 4px 16px ${C.purple}44` },
  };
  return <button onClick={onClick} disabled={disabled} style={{ padding: "12px 20px", borderRadius: 14, fontSize: 14, fontWeight: 700, cursor: disabled ? "default" : "pointer", transition: "all 0.2s", opacity: disabled ? 0.5 : 1, width: "100%", ...s[variant], ...style }}>{children}</button>;
};

const FileBadge = ({ url }) => {
  if (!url) return null;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 4, background: C.blueBg, color: C.blue, padding: "3px 8px", borderRadius: 6, fontSize: 10, fontWeight: 700, textDecoration: "none", marginTop: 4 }}>
      📎 Ver comprovativo
    </a>
  );
};

/* ═══════════════════════ ERROR SCREEN ═══════════════════════ */
function ErrorScreen({ error, onRetry }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: `linear-gradient(150deg, ${C.dark}, #3d4f51)`, padding: 24 }}>
      <style>{CSS}</style>
      <div style={{ background: C.white, borderRadius: 28, padding: "32px 24px", maxWidth: 360, width: "100%", textAlign: "center", animation: "up 0.5s ease" }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>⚠️</div>
        <h2 style={{ fontSize: 18, fontWeight: 900, color: C.dark, margin: "0 0 8px" }}>Erro de ligação</h2>
        <p style={{ fontSize: 13, color: C.darkSoft, margin: "0 0 6px", lineHeight: 1.5 }}>Não foi possível ligar ao Google Sheets.</p>
        <div style={{ background: C.redBg, borderRadius: 12, padding: "10px 14px", fontSize: 11, color: C.red, fontWeight: 600, marginBottom: 18, wordBreak: "break-word" }}>
          {error}
        </div>
        <p style={{ fontSize: 11, color: C.gray, margin: "0 0 16px", lineHeight: 1.5 }}>
          Verifica se o Apps Script está implementado e se o URL está correto.
        </p>
        <Btn onClick={onRetry}>🔄 Tentar novamente</Btn>
      </div>
    </div>
  );
}

/* ═══════════════════════ LOGIN ═══════════════════════ */
function Login({ terapeutas, onLogin }) {
  const [sel, setSel] = useState(null);
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");
  const [mode, setMode] = useState("terapeuta");

  const go = () => {
    if (mode === "gestao") { onLogin(null, true); return; }
    if (!sel) { setErr("Seleciona o teu nome"); return; }
    const t = terapeutas.find(x => x.ID === sel);
    if (!t || String(t.PIN) !== pin) { setErr("PIN incorreto"); return; }
    onLogin(sel, false);
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: `linear-gradient(150deg, ${C.dark} 0%, #3d4f51 40%, ${C.tealDark} 100%)`, padding: 24, position: "relative", overflow: "hidden" }}>
      <style>{CSS}</style>
      <div style={{ position: "absolute", top: -60, right: -60, width: 200, height: 200, borderRadius: "50%", background: `${C.teal}15`, animation: "float 6s ease infinite" }} />
      <div style={{ position: "absolute", bottom: -40, left: -40, width: 160, height: 160, borderRadius: "50%", background: `${C.teal}10`, animation: "float 8s ease infinite 1s" }} />

      <div style={{ animation: "up 0.5s ease", textAlign: "center", marginBottom: 28, zIndex: 1 }}>
        <div style={{ width: 60, height: 60, borderRadius: 18, margin: "0 auto 12px", background: C.teal, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 900, color: C.white, boxShadow: `0 8px 24px ${C.teal}55` }}>C</div>
        <h1 style={{ color: C.white, fontSize: 28, fontWeight: 900, margin: "0 0 2px", letterSpacing: -0.5 }}>CAIDI</h1>
        <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, margin: 0 }}>Produtividade & Férias</p>
      </div>

      <div style={{ background: C.white, borderRadius: 28, padding: "26px 22px", width: "100%", maxWidth: 360, boxShadow: "0 24px 64px rgba(0,0,0,0.25)", animation: "up 0.5s ease 0.1s both", zIndex: 1 }}>
        <div style={{ display: "flex", background: C.grayBg, borderRadius: 14, padding: 3, marginBottom: 22 }}>
          {["terapeuta", "gestao"].map(m => (
            <button key={m} onClick={() => { setMode(m); setErr(""); }} style={{ flex: 1, padding: 10, borderRadius: 12, border: "none", cursor: "pointer", background: mode === m ? C.white : "transparent", color: mode === m ? C.dark : C.gray, fontWeight: mode === m ? 700 : 500, fontSize: 13, boxShadow: mode === m ? "0 2px 8px rgba(0,0,0,0.06)" : "none", transition: "all 0.25s" }}>
              {m === "terapeuta" ? "🧑‍⚕️ Terapeuta" : "📊 Gestão"}
            </button>
          ))}
        </div>

        {mode === "terapeuta" ? (
          <>
            <label style={{ fontSize: 10, fontWeight: 700, color: C.gray, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 8 }}>Quem és tu?</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 18, maxHeight: 210, overflowY: "auto", paddingRight: 4 }}>
              {terapeutas.map(t => (
                <button key={t.ID} onClick={() => { setSel(t.ID); setErr(""); }} style={{ display: "flex", alignItems: "center", gap: 11, padding: "10px 12px", borderRadius: 14, border: sel === t.ID ? `2px solid ${C.teal}` : `2px solid ${C.grayLight}`, background: sel === t.ID ? C.tealLight : C.grayBg, cursor: "pointer", transition: "all 0.2s" }}>
                  <div style={{ width: 36, height: 36, borderRadius: 12, background: sel === t.ID ? C.teal : C.grayLight, color: sel === t.ID ? C.white : C.gray, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, transition: "all 0.2s" }}>{ini(t.Nome)}</div>
                  <div style={{ textAlign: "left" }}><div style={{ fontSize: 13, fontWeight: 700, color: C.dark }}>{t.Nome}</div><div style={{ fontSize: 10, color: C.darkSoft }}>{t["Área"]}</div></div>
                  {sel === t.ID && <span style={{ marginLeft: "auto", color: C.teal }}>●</span>}
                </button>
              ))}
            </div>
            <label style={{ fontSize: 10, fontWeight: 700, color: C.gray, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 6 }}>PIN</label>
            <input type="password" maxLength={4} value={pin} onChange={e => { setPin(e.target.value.replace(/\D/g, "")); setErr(""); }} placeholder="••••" style={{ width: "100%", padding: 13, borderRadius: 14, border: `2px solid ${C.grayLight}`, fontSize: 24, textAlign: "center", letterSpacing: 10, color: C.dark, background: C.grayBg, fontWeight: 800 }} />
          </>
        ) : (
          <div style={{ textAlign: "center", padding: "20px 0" }}><div style={{ fontSize: 44, animation: "float 3s ease infinite" }}>📊</div><div style={{ fontSize: 13, color: C.darkSoft, marginTop: 8 }}>Semáforos, pedidos, visão global</div></div>
        )}

        {err && <div style={{ background: C.redBg, color: C.red, padding: "8px 12px", borderRadius: 10, fontSize: 12, fontWeight: 600, marginTop: 12 }}>⚠️ {err}</div>}
        <div style={{ marginTop: 18 }}><Btn onClick={go}>Entrar</Btn></div>
      </div>

      <div style={{ color: "rgba(255,255,255,0.25)", fontSize: 10, marginTop: 22, zIndex: 1 }}>🟢 ligado ao Google Sheets</div>
    </div>
  );
}

/* ═══════════════════════ ABSENCE FORM WITH FILE UPLOAD ═══════════════════════ */
function AbsenceForm({ type, terap, metrics, onSubmit, onClose }) {
  const [fD, setFD] = useState({ inicio: "", fim: "" });
  const [fN, setFN] = useState("");
  const [motivo, setMotivo] = useState(type === "ferias" ? "" : type === "baixa" ? "Baixa Médica" : type === "formacao" ? "Formação" : "Falta Justificada");
  const [ficheiro, setFicheiro] = useState(null);
  const [nomeF, setNomeF] = useState("");
  const [sub, setSub] = useState(false);
  const [done, setDone] = useState(false);
  const [errMsg, setErrMsg] = useState("");
  const fileRef = useRef(null);

  const isFerias = type === "ferias";
  const needsUpload = type !== "ferias";

  const handleFile = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) { alert("Ficheiro muito grande (máx. 10MB)"); return; }
    setNomeF(f.name);
    setFicheiro(f);
  };

  const removeFile = () => { setFicheiro(null); setNomeF(""); if (fileRef.current) fileRef.current.value = ""; };

  const submit = async () => {
    if (!fD.inicio || !fD.fim) return;
    setSub(true); setErrMsg("");
    const dias = contarDiasUteis(fD.inicio, fD.fim);
    let mot = motivo;
    if (isFerias) mot = metrics.oR > 0 ? "Férias (Obrigatórias)" : "Férias (Bónus)";

    let ficheiroData = null;
    if (ficheiro) {
      try { ficheiroData = await fileToBase64(ficheiro); } catch { /* ignore */ }
    }

    try {
      await apiPost({ action: "novoPedido", terapId: terap.ID, nome: terap.Nome, dataInicio: fD.inicio, dataFim: fD.fim, motivo: mot, nota: fN, ficheiro: ficheiroData });
      onSubmit({ ID_Terapeuta: terap.ID, Nome: terap.Nome, "Data Início": fD.inicio, "Data Fim": fD.fim, Motivo: mot, "Dias Úteis": dias, Estado: "Pendente", Observações: fN, "Data Pedido": new Date().toISOString().slice(0, 10), Ficheiro: ficheiro ? "(enviado)" : "" });
      setDone(true);
      setTimeout(() => { onClose(); }, 1800);
    } catch (err) {
      setErrMsg("Erro ao enviar: " + err.message);
    }
    setSub(false);
  };

  const titles = { ferias: "Pedir férias", baixa: "Registar baixa", falta: "Registar falta", formacao: "Registar formação" };
  const icons = { ferias: "🌴", baixa: "🏥", falta: "📋", formacao: "🎓" };
  const btnVariants = { ferias: "primary", baixa: "purple", falta: "primary", formacao: "primary" };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(45,52,54,0.5)", backdropFilter: "blur(4px)", zIndex: 100, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: C.white, borderRadius: "26px 26px 0 0", padding: "24px 20px 32px", width: "100%", maxWidth: 420, animation: "slideUp 0.3s ease", maxHeight: "90vh", overflowY: "auto" }}>
        {done ? (
          <div style={{ textAlign: "center", padding: "24px 0", animation: "pop 0.4s ease" }}><div style={{ fontSize: 48 }}>✅</div><div style={{ fontSize: 17, fontWeight: 800, color: C.green, marginTop: 10 }}>Pedido enviado!</div></div>
        ) : (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <h3 style={{ fontSize: 18, fontWeight: 900, color: C.dark, margin: 0 }}>{icons[type]} {titles[type]}</h3>
              <button onClick={onClose} style={{ background: C.grayBg, border: "none", borderRadius: "50%", width: 32, height: 32, fontSize: 14, cursor: "pointer", color: C.darkSoft }}>✕</button>
            </div>

            {type === "falta" && (
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 10, fontWeight: 700, color: C.gray, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 4 }}>Tipo</label>
                <select value={motivo} onChange={e => setMotivo(e.target.value)} style={{ width: "100%", padding: 12, borderRadius: 12, border: `2px solid ${C.grayLight}`, fontSize: 14, color: C.dark, background: C.grayBg }}>
                  <option value="Falta Justificada">Justificada</option>
                  <option value="Falta Injustificada">Injustificada</option>
                </select>
              </div>
            )}

            {["inicio", "fim"].map(k => (
              <div key={k} style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 10, fontWeight: 700, color: C.gray, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 4 }}>{k === "inicio" ? "De" : "Até"}</label>
                <input type="date" value={fD[k]} onChange={e => setFD(d => ({ ...d, [k]: e.target.value }))} style={{ width: "100%", padding: 12, borderRadius: 12, border: `2px solid ${C.grayLight}`, fontSize: 14, color: C.dark, background: C.grayBg }} />
              </div>
            ))}

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 10, fontWeight: 700, color: C.gray, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 4 }}>
                {type === "baixa" ? "Motivo" : type === "formacao" ? "Nome da formação" : type === "falta" ? "Justificação" : "Nota (opcional)"}
              </label>
              <input type="text" value={fN} onChange={e => setFN(e.target.value)} placeholder={type === "baixa" ? "Ex: Cirurgia" : type === "formacao" ? "Ex: Workshop PECS" : type === "falta" ? "Ex: Consulta" : "Ex: Páscoa"} style={{ width: "100%", padding: 12, borderRadius: 12, border: `2px solid ${C.grayLight}`, fontSize: 14, color: C.dark, background: C.grayBg }} />
            </div>

            {needsUpload && (
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 10, fontWeight: 700, color: C.gray, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 4 }}>📎 Comprovativo</label>
                {!ficheiro ? (
                  <div onClick={() => fileRef.current?.click()} style={{ border: `2px dashed ${C.grayLight}`, borderRadius: 14, padding: "16px 12px", textAlign: "center", cursor: "pointer", background: C.grayBg, transition: "border-color 0.2s" }}>
                    <div style={{ fontSize: 28 }}>📷</div>
                    <div style={{ fontSize: 12, color: C.darkSoft, marginTop: 4, fontWeight: 600 }}>Toca para enviar foto, PDF ou ficheiro</div>
                    <div style={{ fontSize: 10, color: C.gray, marginTop: 2 }}>Máx. 10MB</div>
                  </div>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: 10, background: C.greenBg, border: `1px solid #b2f5ea`, borderRadius: 14, padding: "10px 12px" }}>
                    <span style={{ fontSize: 22 }}>📄</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: C.dark, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nomeF}</div>
                      <div style={{ fontSize: 10, color: C.green, fontWeight: 600 }}>✓ Pronto a enviar</div>
                    </div>
                    <button onClick={removeFile} style={{ background: C.white, border: `1px solid ${C.grayLight}`, borderRadius: 8, width: 28, height: 28, fontSize: 12, cursor: "pointer", color: C.red, flexShrink: 0 }}>✕</button>
                  </div>
                )}
                <input ref={fileRef} type="file" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" capture="environment" onChange={handleFile} style={{ display: "none" }} />
              </div>
            )}

            {isFerias && <div style={{ background: C.tealLight, padding: "10px 12px", borderRadius: 12, fontSize: 12, color: C.tealDark, fontWeight: 600, marginBottom: 16 }}>💡 Tens <strong>{metrics.oR} dias obrigatórios</strong> por marcar</div>}
            {type === "baixa" && <div style={{ background: C.purpleBg, padding: "10px 12px", borderRadius: 12, fontSize: 12, color: C.purple, fontWeight: 600, marginBottom: 16 }}>🏥 A baixa <strong>não desconta</strong> férias. A meta ajusta-se.</div>}
            {type === "formacao" && <div style={{ background: C.orangeBg, padding: "10px 12px", borderRadius: 12, fontSize: 12, color: C.orange, fontWeight: 600, marginBottom: 16 }}>🎓 Formações <strong>não descontam</strong> férias nem afetam a meta.</div>}
            {type === "falta" && motivo === "Falta Injustificada" && <div style={{ background: C.redBg, padding: "10px 12px", borderRadius: 12, fontSize: 12, color: C.red, fontWeight: 600, marginBottom: 16 }}>⚠️ Faltas injustificadas podem ter <strong>impacto na avaliação</strong>.</div>}

            {errMsg && <div style={{ background: C.redBg, color: C.red, padding: "8px 12px", borderRadius: 10, fontSize: 12, fontWeight: 600, marginBottom: 12 }}>⚠️ {errMsg}</div>}

            <Btn onClick={submit} disabled={sub} variant={btnVariants[type]}>{sub ? "A enviar..." : "Enviar pedido"}</Btn>
          </>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════ THERAPIST VIEW ═══════════════════════ */
function TherapistView({ data, terap, onLogout, onRefresh, onAddAusencia }) {
  const [tab, setTab] = useState("inicio");
  const [showForm, setShowForm] = useState(null);

  const aus = data.ausencias.filter(a => a.ID_Terapeuta === terap.ID);
  const ap = data.apoios.filter(a => a.ID_Terapeuta === terap.ID);
  const m = calc(terap, ap, aus, data.periodos, data.fecho);
  const saudePedidos = aus.filter(a => !a.Motivo.includes("Férias")).sort((a, b) => (b["Data Pedido"]||"").localeCompare(a["Data Pedido"]||""));
  const todosPedidos = [...aus].sort((a, b) => (b["Data Pedido"]||"").localeCompare(a["Data Pedido"]||""));
  const pend = aus.filter(p => p.Estado === "Pendente").length;

  const handleSubmit = (n) => { onAddAusencia(n); onRefresh(); };
  const tabs = [{ id: "inicio", icon: "🏠", l: "Início" }, { id: "ferias", icon: "🌴", l: "Férias" }, { id: "saude", icon: "🏥", l: "Saúde" }, { id: "pedidos", icon: "📋", l: "Pedidos" }, { id: "info", icon: "💡", l: "Info" }];

  return (
    <div style={{ maxWidth: 420, margin: "0 auto", minHeight: "100vh", background: C.grayBg, fontFamily: "'DM Sans', sans-serif", position: "relative", paddingBottom: 80 }}>
      <style>{CSS}</style>
      <div style={{ background: `linear-gradient(140deg, ${C.dark} 0%, ${C.tealDark} 100%)`, padding: "24px 20px 20px", color: C.white, borderRadius: "0 0 28px 28px", boxShadow: `0 8px 32px ${C.dark}33`, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -30, right: -30, width: 120, height: 120, borderRadius: "50%", background: `${C.teal}18` }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", position: "relative" }}>
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, opacity: 0.4, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 4 }}>CAIDI · {m.periodo["Período"]}</div>
            <div style={{ fontSize: 20, fontWeight: 800 }}>Olá, {terap.Nome.split(" ")[0]}! 👋</div>
            <div style={{ fontSize: 11, opacity: 0.5, marginTop: 1 }}>{terap["Área"]}</div>
          </div>
          <button onClick={onLogout} style={{ background: "rgba(255,255,255,0.12)", border: "none", borderRadius: 12, width: 38, height: 38, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: C.white, cursor: "pointer" }}>{ini(terap.Nome)}</button>
        </div>
      </div>

      <div style={{ padding: "16px 16px 0" }}>
        {tab === "inicio" && (
          <div>
            <Card delay={0}>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <Ring value={m.ef} max={m.mMin} size={96} stroke={9} color={m.sc}>
                  <div style={{ fontSize: 22, fontWeight: 900, color: C.dark, lineHeight: 1 }}>{m.pM}%</div>
                  <div style={{ fontSize: 8, color: C.gray, fontWeight: 700, textTransform: "uppercase" }}>da meta</div>
                </Ring>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                    <div><div style={{ fontSize: 24, fontWeight: 900, color: C.dark, lineHeight: 1 }}>{m.ef}</div><div style={{ fontSize: 10, color: C.gray }}>realizados</div></div>
                    <div style={{ textAlign: "right" }}><div style={{ fontSize: 24, fontWeight: 900, color: C.grayLight, lineHeight: 1 }}>{m.mMin}</div><div style={{ fontSize: 10, color: C.gray }}>meta</div></div>
                  </div>
                  <div style={{ height: 6, background: C.grayLight, borderRadius: 3, overflow: "hidden" }}><div style={{ height: "100%", borderRadius: 3, width: `${Math.min(m.pM, 100)}%`, background: `linear-gradient(90deg, ${m.sc}, ${m.sc}cc)`, transition: "width 1.2s ease" }} /></div>
                  <div style={{ fontSize: 10, color: m.sc, fontWeight: 700, marginTop: 5 }}>{m.pH >= 95 ? "🟢 Excelente!" : m.pH >= 80 ? "🟡 Atenção" : "🔴 Abaixo"} · {m.diff >= 0 ? "+" : ""}{m.diff} vs hoje</div>
                </div>
              </div>
            </Card>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 6, marginTop: 10 }}>
              {[{ i: "🌴", v: m.oR, l: "férias", c: m.oR <= 3 ? C.red : C.teal }, { i: "🏥", v: m.dB, l: "baixa", c: m.dB > 0 ? C.purple : C.teal }, { i: "🎓", v: m.dFO, l: "form.", c: C.orange }, { i: "🎁", v: m.dBn, l: "bónus", c: C.green }].map((x, idx) => (
                <Card key={idx} delay={0.1 + idx * 0.03} style={{ padding: 10, textAlign: "center" }}>
                  <div style={{ fontSize: 7, color: C.gray, fontWeight: 700, textTransform: "uppercase" }}>{x.i}</div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: x.c, lineHeight: 1.3 }}>{x.v}</div>
                  <div style={{ fontSize: 8, color: C.gray }}>{x.l}</div>
                </Card>
              ))}
            </div>
            {m.dFI > 0 && <Card delay={0.2} style={{ marginTop: 8, background: C.redBg, border: `1px solid #f5c6c0`, padding: 12 }}><div style={{ display: "flex", alignItems: "center", gap: 8 }}><span>⚠️</span><span style={{ fontSize: 12, fontWeight: 700, color: C.red }}>{m.dFI} falta{m.dFI > 1 ? "s" : ""} injustificada{m.dFI > 1 ? "s" : ""}</span></div></Card>}
            <div style={{ marginTop: 8 }}>
              {m.fE2 > 0 ? (
                <Card delay={0.22} style={{ background: `linear-gradient(135deg, ${C.tealLight}, ${C.white})`, border: `1px solid ${C.tealSoft}` }}><div style={{ display: "flex", alignItems: "center", gap: 10 }}><span style={{ fontSize: 28, animation: "float 3s ease infinite" }}>🎯</span><div><div style={{ fontSize: 13, fontWeight: 800, color: C.tealDark }}>Faltam-te {m.fE2} apoios para o Escalão 2!</div><div style={{ fontSize: 11, color: C.darkSoft }}>Cada apoio extra = 5€</div></div></div></Card>
              ) : (
                <Card delay={0.22} style={{ background: `linear-gradient(135deg, ${C.greenBg}, ${C.white})`, border: `1px solid #b2f5ea` }}><div style={{ display: "flex", alignItems: "center", gap: 10 }}><span style={{ fontSize: 28, animation: "float 3s ease infinite" }}>⭐</span><div><div style={{ fontSize: 13, fontWeight: 800, color: C.green }}>Acima do Escalão 2!</div><div style={{ fontSize: 11, color: C.darkSoft }}>Cada apoio extra vale 5€</div></div></div></Card>
              )}
            </div>
            {pend > 0 && <Card delay={0.28} style={{ marginTop: 8, background: C.yellowBg, border: "1px solid #FDEBD0" }}><div style={{ display: "flex", alignItems: "center", gap: 8 }}><span>⏳</span><span style={{ fontSize: 12, fontWeight: 700, color: C.red, flex: 1 }}>{pend} pendente{pend > 1 ? "s" : ""}</span><button onClick={() => setTab("pedidos")} style={{ background: `${C.red}15`, border: "none", borderRadius: 8, padding: "5px 10px", fontSize: 10, fontWeight: 700, color: C.red, cursor: "pointer" }}>Ver →</button></div></Card>}
          </div>
        )}

        {tab === "ferias" && (
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 900, color: C.dark, margin: "0 0 12px" }}>As tuas férias</h2>
            <Card delay={0}>
              {[{ l: "🌴 Obrigatórias", u: m.fU, t: terap["Dias Férias"], r: m.oR, c: C.teal, f: m.tF }, { l: "🎁 Bónus", u: m.bU, t: m.dBn, r: m.bR, c: C.green }].map((f, i) => (
                <div key={i} style={{ marginBottom: i === 0 ? 16 : 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}><span style={{ fontSize: 13, fontWeight: 700, color: C.dark }}>{f.l}</span><span style={{ fontSize: 13, fontWeight: 800, color: f.c }}>{f.u}/{f.t}</span></div>
                  <div style={{ height: 10, background: C.grayLight, borderRadius: 6, overflow: "hidden", display: "flex" }}>{f.f && <div style={{ width: `${f.t > 0 ? (f.f / f.t) * 100 : 0}%`, background: C.gray, height: "100%" }} />}<div style={{ width: `${f.t > 0 ? ((f.u - (f.f || 0)) / f.t) * 100 : 0}%`, background: f.c, height: "100%" }} /></div>
                  <div style={{ fontSize: 9, color: C.darkSoft, marginTop: 4 }}>{f.f ? `⬛ Fecho (${f.f}d) · ` : ""}<span style={{ fontWeight: 700, color: C.green }}>Restam {f.r}d</span>{i === 1 && m.oR > 0 && <span style={{ color: C.red }}> · ⚠️ só após os 22</span>}</div>
                </div>
              ))}
            </Card>
            <div style={{ marginTop: 12 }}><Btn onClick={() => setShowForm("ferias")}>📝 Pedir Férias</Btn></div>
            <h3 style={{ fontSize: 13, fontWeight: 800, color: C.dark, margin: "16px 0 8px" }}>📅 Fecho do CAIDI</h3>
            <Card delay={0.1} style={{ padding: 0, overflow: "hidden" }}>{data.fecho.map((f, i) => (<div key={i} style={{ padding: "10px 14px", borderBottom: i < data.fecho.length - 1 ? `1px solid ${C.grayLight}` : "none", display: "flex", justifyContent: "space-between", fontSize: 12, background: i % 2 ? C.white : C.grayBg }}><div><span style={{ fontWeight: 700, color: C.dark }}>{f.Nome}</span><br/><span style={{ fontSize: 10, color: C.gray }}>{fmtDF(f["Data Início"])}{f["Data Início"] !== f["Data Fim"] ? ` → ${fmtDF(f["Data Fim"])}` : ""}</span></div><span style={{ fontSize: 10, fontWeight: 800, color: C.darkSoft, background: C.grayLight, padding: "3px 8px", borderRadius: 6 }}>{f["Dias Úteis"]}d</span></div>))}</Card>
            <h3 style={{ fontSize: 13, fontWeight: 800, color: C.dark, margin: "14px 0 8px" }}>🏫 Períodos letivos</h3>
            {data.periodos.map((p, i) => (<Card key={i} delay={0.15} style={{ padding: "10px 14px", marginBottom: 6, border: `1px solid ${C.redBg}` }}><div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}><div><span style={{ fontWeight: 800, color: C.red }}>{p["Período"]}</span><span style={{ color: C.gray, marginLeft: 8, fontSize: 10 }}>{fmtDF(p["Início"])} → {fmtDF(p.Fim)}</span></div><span style={{ fontSize: 8, background: C.redBg, color: C.red, padding: "3px 6px", borderRadius: 4, fontWeight: 800 }}>🔒</span></div></Card>))}
          </div>
        )}

        {tab === "saude" && (
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 900, color: C.dark, margin: "0 0 12px" }}>Baixas, Faltas & Formações</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 6, marginBottom: 12 }}>
              {[{ i: "🏥", v: m.dB, l: "Baixa", c: C.purple }, { i: "📋", v: m.dFJ, l: "F.Just.", c: C.blue }, { i: "⚠️", v: m.dFI, l: "F.Inj.", c: m.dFI > 0 ? C.red : C.teal }, { i: "🎓", v: m.dFO, l: "Form.", c: C.orange }].map((x, idx) => (
                <Card key={idx} delay={idx * 0.05} style={{ padding: 10, textAlign: "center" }}>
                  <div style={{ fontSize: 8, color: C.gray, fontWeight: 700, textTransform: "uppercase" }}>{x.i}</div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: x.c, lineHeight: 1.3 }}>{x.v}</div>
                  <div style={{ fontSize: 8, color: C.gray }}>{x.l}</div>
                </Card>
              ))}
            </div>
            <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
              <Btn onClick={() => setShowForm("baixa")} variant="purple" style={{ flex: 1, padding: 10, fontSize: 11 }}>🏥 Baixa</Btn>
              <Btn onClick={() => setShowForm("falta")} variant="secondary" style={{ flex: 1, padding: 10, fontSize: 11 }}>📋 Falta</Btn>
              <Btn onClick={() => setShowForm("formacao")} variant="secondary" style={{ flex: 1, padding: 10, fontSize: 11 }}>🎓 Formação</Btn>
            </div>
            <h3 style={{ fontSize: 13, fontWeight: 800, color: C.dark, margin: "0 0 8px" }}>Histórico</h3>
            {saudePedidos.length === 0 ? (
              <Card><div style={{ textAlign: "center", padding: 16, color: C.gray }}><div style={{ fontSize: 32 }}>🎉</div><div style={{ fontSize: 13, marginTop: 6 }}>Nada a registar</div></div></Card>
            ) : saudePedidos.map((p, i) => {
              const mi = motivoInfo(p.Motivo); const e = EST[p.Estado] || EST.Pendente;
              return (
                <Card key={i} delay={i * 0.04} style={{ marginBottom: 8, borderLeft: `4px solid ${mi.color}`, borderRadius: "4px 20px 20px 4px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: C.dark }}>{mi.icon} {mi.label}</div>
                      <div style={{ fontSize: 11, color: C.darkSoft, marginTop: 2 }}>{fmtD(p["Data Início"])}{p["Data Início"] !== p["Data Fim"] ? ` → ${fmtD(p["Data Fim"])}` : ""} · {p["Dias Úteis"]}d</div>
                    </div>
                    <span style={{ background: e.bg, color: e.c, padding: "3px 9px", borderRadius: 8, fontSize: 10, fontWeight: 700 }}>{e.icon} {e.l}</span>
                  </div>
                  {p.Observações && <div style={{ fontSize: 11, color: C.darkSoft, fontStyle: "italic", marginTop: 4 }}>"{p.Observações}"</div>}
                  <FileBadge url={p.Ficheiro} />
                </Card>
              );
            })}
          </div>
        )}

        {tab === "pedidos" && (
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 900, color: C.dark, margin: "0 0 12px" }}>Todos os pedidos</h2>
            {todosPedidos.length === 0 ? <Card><div style={{ textAlign: "center", padding: 20, color: C.gray }}><div style={{ fontSize: 36 }}>📋</div><div style={{ fontSize: 13, marginTop: 6 }}>Sem pedidos</div></div></Card>
            : todosPedidos.map((p, i) => {
              const mi = motivoInfo(p.Motivo); const e = EST[p.Estado] || EST.Pendente;
              return (
                <Card key={i} delay={i * 0.03} style={{ marginBottom: 8, borderLeft: `4px solid ${mi.color}`, borderRadius: "4px 20px 20px 4px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: C.dark }}>{fmtD(p["Data Início"])}{p["Data Início"] !== p["Data Fim"] ? ` → ${fmtD(p["Data Fim"])}` : ""}</div>
                      <div style={{ fontSize: 10, color: C.darkSoft, marginTop: 2 }}>{mi.icon} {mi.short} · {p["Dias Úteis"]}d</div>
                    </div>
                    <span style={{ background: e.bg, color: e.c, padding: "3px 9px", borderRadius: 8, fontSize: 10, fontWeight: 700 }}>{e.icon} {e.l}</span>
                  </div>
                  {p.Observações && <div style={{ fontSize: 11, color: C.darkSoft, fontStyle: "italic", marginTop: 4 }}>"{p.Observações}"</div>}
                  <FileBadge url={p.Ficheiro} />
                </Card>
              );
            })}
          </div>
        )}

        {tab === "info" && (
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 900, color: C.dark, margin: "0 0 12px" }}>Como funciona</h2>
            {[
              { i: "🌴", t: "Férias obrigatórias (22d)", d: "Fora dos períodos letivos. Fecho CAIDI desconta automaticamente." },
              { i: "🎁", t: "Férias bónus (até 15d)", d: "Ganhas por produtividade! Só após os 22 obrigatórios." },
              { i: "⭐", t: "Escalões", d: "Meta = +1 dia · +5% = 5€/apoio · Teto = 10€/apoio." },
              { i: "🏥", t: "Baixa médica", d: "Não desconta férias. Meta ajusta automaticamente. Envia comprovativo." },
              { i: "📋", t: "Falta justificada", d: "Consultas, tribunal, óbito. Precisa de comprovativo." },
              { i: "⚠️", t: "Falta injustificada", d: "Registada no histórico. Pode afetar avaliação." },
              { i: "🎓", t: "Formação", d: "Não desconta férias nem meta. Envia certificado/inscrição." },
              { i: "🔴", t: "Período letivo", d: "Sem férias. Exceções requerem autorização." },
            ].map((x, i) => (
              <Card key={i} delay={i * 0.04} style={{ marginBottom: 8 }}><div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}><span style={{ fontSize: 22, flexShrink: 0 }}>{x.i}</span><div><div style={{ fontSize: 13, fontWeight: 800, color: C.dark }}>{x.t}</div><div style={{ fontSize: 11, color: C.darkSoft, lineHeight: 1.5, marginTop: 2 }}>{x.d}</div></div></div></Card>
            ))}
            <div style={{ marginTop: 10 }}><Btn onClick={onLogout} variant="secondary">Sair</Btn></div>
          </div>
        )}
      </div>

      {showForm && <AbsenceForm type={showForm} terap={terap} metrics={m} onSubmit={handleSubmit} onClose={() => setShowForm(null)} />}

      <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 420, background: C.white, borderTop: `1px solid ${C.grayLight}`, display: "flex", justifyContent: "space-around", padding: "6px 0 12px", boxShadow: "0 -4px 20px rgba(0,0,0,0.04)" }}>
        {tabs.map(tb => (
          <button key={tb.id} onClick={() => setTab(tb.id)} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 1, color: tab === tb.id ? C.teal : C.gray, padding: "2px 6px", transition: "all 0.2s" }}>
            <span style={{ fontSize: 18, transform: tab === tb.id ? "scale(1.15)" : "scale(1)", transition: "transform 0.2s" }}>{tb.icon}</span>
            <span style={{ fontSize: 8, fontWeight: tab === tb.id ? 800 : 500 }}>{tb.l}</span>
            {tab === tb.id && <div style={{ width: 4, height: 4, borderRadius: "50%", background: C.teal, marginTop: -1 }} />}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════ ADMIN VIEW ═══════════════════════ */
function AdminView({ data, onLogout, onRefresh, onUpdateEstado }) {
  const [upd, setUpd] = useState(null);
  const [filtro, setFiltro] = useState("todos");

  const handle = async (ln, est) => {
    setUpd(ln);
    try {
      await apiPost({ action: est === "Aprovado" ? "aprovarPedido" : "rejeitarPedido", linha: ln });
      onUpdateEstado(ln, est);
    } catch (err) { alert("Erro: " + err.message); }
    setUpd(null); onRefresh();
  };

  const pend = data.ausencias.filter(a => a.Estado === "Pendente");
  const hist = data.ausencias.filter(a => a.Estado !== "Pendente");
  const histFilt = hist.filter(a => {
    if (filtro === "ferias") return a.Motivo.includes("Férias");
    if (filtro === "baixas") return a.Motivo === "Baixa Médica";
    if (filtro === "faltas") return a.Motivo.includes("Falta");
    if (filtro === "formacao") return a.Motivo === "Formação";
    return true;
  });

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", minHeight: "100vh", background: C.grayBg, fontFamily: "'DM Sans', sans-serif", padding: "0 0 24px" }}>
      <style>{CSS}</style>
      <div style={{ background: `linear-gradient(140deg, ${C.dark} 0%, #3d4f51 100%)`, padding: "24px 20px 20px", color: C.white, borderRadius: "0 0 28px 28px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -20, right: -20, width: 100, height: 100, borderRadius: "50%", background: `${C.teal}12` }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", position: "relative" }}>
          <div><div style={{ fontSize: 9, fontWeight: 700, opacity: 0.4, letterSpacing: 1.5, textTransform: "uppercase" }}>CAIDI · Gestão</div><div style={{ fontSize: 20, fontWeight: 900 }}>Painel de Gestão 📊</div></div>
          <button onClick={onLogout} style={{ background: "rgba(255,255,255,0.1)", border: "none", borderRadius: 10, padding: "7px 14px", color: C.white, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Sair</button>
        </div>
      </div>

      <div style={{ padding: "16px 16px 0" }}>
        <h2 style={{ fontSize: 16, fontWeight: 900, color: C.dark, margin: "0 0 10px" }}>Equipa</h2>
        {data.terapeutas.map((t, idx) => {
          const a2 = data.ausencias.filter(a => a.ID_Terapeuta === t.ID);
          const ap2 = data.apoios.filter(a => a.ID_Terapeuta === t.ID);
          const m2 = calc(t, ap2, a2, data.periodos, data.fecho);
          return (
            <Card key={t.ID} delay={idx * 0.05} style={{ marginBottom: 8, display: "flex", alignItems: "center", gap: 12 }}>
              <Ring value={m2.ef} max={m2.mMin} size={48} stroke={5} color={m2.sc}><span style={{ fontSize: 11, fontWeight: 900, color: m2.sc }}>{m2.pM}%</span></Ring>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ fontSize: 13, fontWeight: 800, color: C.dark }}>{t.Nome}</span><span>{m2.pH >= 95 ? "🟢" : m2.pH >= 80 ? "🟡" : "🔴"}</span></div>
                <div style={{ fontSize: 10, color: C.darkSoft }}>{m2.ef}/{m2.mMin} · {t["Área"]}</div>
                <div style={{ height: 4, background: C.grayLight, borderRadius: 2, marginTop: 4, overflow: "hidden" }}><div style={{ height: "100%", width: `${Math.min(m2.pM, 100)}%`, background: m2.sc, borderRadius: 2 }} /></div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0, fontSize: 10 }}>
                <div>🌴 <span style={{ fontWeight: 800, color: m2.oR <= 3 ? C.red : C.teal }}>{m2.oR}</span></div>
                {m2.dB > 0 && <div>🏥 <span style={{ fontWeight: 800, color: C.purple }}>{m2.dB}d</span></div>}
                {m2.dFI > 0 && <div>⚠️ <span style={{ fontWeight: 800, color: C.red }}>{m2.dFI}</span></div>}
                {m2.dFO > 0 && <div>🎓 <span style={{ fontWeight: 800, color: C.orange }}>{m2.dFO}d</span></div>}
              </div>
            </Card>
          );
        })}

        <h2 style={{ fontSize: 16, fontWeight: 900, color: C.dark, margin: "18px 0 10px" }}>Pedidos pendentes {pend.length > 0 && <span style={{ background: C.redBg, color: C.red, padding: "2px 8px", borderRadius: 8, fontSize: 12, fontWeight: 800, marginLeft: 8 }}>{pend.length}</span>}</h2>

        {pend.length === 0 ? (
          <Card style={{ background: C.greenBg, border: `1px solid #b2f5ea` }}><div style={{ textAlign: "center", fontSize: 13, fontWeight: 700, color: C.green }}>✓ Sem pedidos pendentes!</div></Card>
        ) : pend.map((p, i) => {
          const t = data.terapeutas.find(x => x.ID === p.ID_Terapeuta);
          const mi = motivoInfo(p.Motivo);
          return (
            <Card key={i} delay={i * 0.05} style={{ marginBottom: 8, borderLeft: `4px solid ${mi.color}`, borderRadius: "4px 20px 20px 4px" }}>
              <div style={{ marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: C.dark }}>{t ? t.Nome : p.ID_Terapeuta}</div>
                  <span style={{ background: `${mi.color}18`, color: mi.color, padding: "3px 8px", borderRadius: 6, fontSize: 10, fontWeight: 700 }}>{mi.icon} {mi.short}</span>
                </div>
                <div style={{ fontSize: 11, color: C.darkSoft, marginTop: 2 }}>{fmtDF(p["Data Início"])} → {fmtDF(p["Data Fim"])} · {p["Dias Úteis"]}d</div>
                {p.Observações && <div style={{ fontSize: 11, color: C.darkSoft, fontStyle: "italic", marginTop: 3 }}>"{p.Observações}"</div>}
                <FileBadge url={p.Ficheiro} />
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <Btn onClick={() => handle(p._linha, "Aprovado")} disabled={upd === p._linha} variant="success" style={{ flex: 1, padding: 10 }}>✓ Aprovar</Btn>
                <Btn onClick={() => handle(p._linha, "Rejeitado")} disabled={upd === p._linha} variant="danger" style={{ flex: 1, padding: 10 }}>✕ Rejeitar</Btn>
              </div>
            </Card>
          );
        })}

        {hist.length > 0 && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "18px 0 8px" }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: C.gray, margin: 0 }}>Histórico</h3>
              <div style={{ display: "flex", gap: 3 }}>
                {[{ k: "todos", l: "Tudo" }, { k: "ferias", l: "🌴" }, { k: "baixas", l: "🏥" }, { k: "faltas", l: "⚠️" }, { k: "formacao", l: "🎓" }].map(f => (
                  <button key={f.k} onClick={() => setFiltro(f.k)} style={{ background: filtro === f.k ? C.tealLight : C.white, border: `1px solid ${filtro === f.k ? C.tealSoft : C.grayLight}`, borderRadius: 8, padding: "4px 7px", fontSize: 10, fontWeight: 700, color: filtro === f.k ? C.tealDark : C.gray, cursor: "pointer" }}>{f.l}</button>
                ))}
              </div>
            </div>
            {histFilt.slice(0, 12).map((p, i) => {
              const t = data.terapeutas.find(x => x.ID === p.ID_Terapeuta);
              const mi = motivoInfo(p.Motivo); const e = EST[p.Estado] || EST.Pendente;
              return (
                <div key={i} style={{ background: C.white, borderRadius: 14, padding: "9px 14px", border: `1px solid ${C.grayLight}`, marginBottom: 4, opacity: 0.65, fontSize: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div><span style={{ fontWeight: 700 }}>{t ? t.Nome : p.ID_Terapeuta}</span><span style={{ color: C.gray, marginLeft: 6, fontSize: 10 }}>{mi.icon} {fmtD(p["Data Início"])}{p["Data Início"] !== p["Data Fim"] ? `→${fmtD(p["Data Fim"])}` : ""}</span></div>
                    <span style={{ background: e.bg, color: e.c, padding: "2px 7px", borderRadius: 6, fontSize: 9, fontWeight: 700 }}>{e.icon}</span>
                  </div>
                  {p.Ficheiro && <FileBadge url={p.Ficheiro} />}
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════ LOADING ═══════════════════════ */
function Loading() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: `linear-gradient(150deg, ${C.dark}, ${C.tealDark})` }}>
      <style>{CSS}</style>
      <div style={{ width: 52, height: 52, borderRadius: 16, background: C.teal, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 900, color: C.white, boxShadow: `0 8px 24px ${C.teal}55`, animation: "float 2s ease infinite" }}>C</div>
      <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, marginTop: 16 }}>A carregar...</div>
    </div>
  );
}

/* ═══════════════════════ MAIN ═══════════════════════ */
export default function App() {
  const [user, setUser] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const r = await apiGet("tudo");
      setData(r);
    } catch (err) {
      setError(err.message || "Erro desconhecido");
      setData(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  const refresh = () => fetchData();
  const addAus = (n) => setData(p => ({ ...p, ausencias: [...p.ausencias, { ...n, _linha: p.ausencias.length + 2 }] }));
  const updEst = (ln, est) => setData(p => ({ ...p, ausencias: p.ausencias.map(a => a._linha === ln ? { ...a, Estado: est } : a) }));

  if (loading) return <Loading />;
  if (error || !data) return <ErrorScreen error={error || "Sem dados"} onRetry={fetchData} />;
  if (!user) return <Login terapeutas={data.terapeutas} onLogin={(id, adm) => setUser({ id, isAdmin: adm })} />;
  if (user.isAdmin) return <AdminView data={data} onLogout={() => setUser(null)} onRefresh={refresh} onUpdateEstado={updEst} />;
  const t = data.terapeutas.find(x => x.ID === user.id);
  if (!t) { setUser(null); return null; }
  return <TherapistView data={data} terap={t} onLogout={() => setUser(null)} onRefresh={refresh} onAddAusencia={addAus} />;
}
