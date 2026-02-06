import { useState, useEffect, useCallback } from "react";

/* ═══════════════════════════════════════════════════════════════
   CONFIGURAÇÃO — Cola aqui o URL do Google Apps Script
   ═══════════════════════════════════════════════════════════════ */
const API_URL = "https://script.google.com/macros/s/AKfycbxFAQGzVgbTEP-j4fLqnPO-Vd8oCA88iREROhkDstlfr2YNakAzPUCMeL76g13XODHkIg/exec";
const DEMO_MODE = !API_URL;

/* ═══════════════════════
   PALETA CAIDI
   ═══════════════════════ */
const C = {
  teal: "#00A89D", tealDark: "#008F86", tealLight: "#E6F7F6", tealSoft: "#B2E8E4",
  dark: "#2D3436", darkSoft: "#636E72", gray: "#B2BEC3", grayLight: "#DFE6E9",
  grayBg: "#F7F9FA", white: "#FFFFFF",
  green: "#00B894", greenBg: "#E8F8F5",
  yellow: "#FDCB6E", yellowBg: "#FFF9E6",
  red: "#E17055", redBg: "#FFEAEA",
};

/* ═══════════════════════
   DEMO DATA
   ═══════════════════════ */
const DEMO = {
  terapeutas: [
    { ID: "sofia", Nome: "Sofia Costa", "Área": "Terapia da Fala", "Horas Semanais": 40, "Horas Letivas": 30, "Dias Férias": 22, "Dias Bónus Ganhos": 3, PIN: "1234" },
    { ID: "ana", Nome: "Ana Silva", "Área": "Psicologia", "Horas Semanais": 25, "Horas Letivas": 18, "Dias Férias": 22, "Dias Bónus Ganhos": 1, PIN: "1234" },
    { ID: "maria", Nome: "Maria Santos", "Área": "Psicomotricidade", "Horas Semanais": 35, "Horas Letivas": 28, "Dias Férias": 22, "Dias Bónus Ganhos": 0, PIN: "1234" },
    { ID: "rita", Nome: "Rita Ferreira", "Área": "Terapia da Fala", "Horas Semanais": 40, "Horas Letivas": 30, "Dias Férias": 22, "Dias Bónus Ganhos": 5, PIN: "1234" },
  ],
  apoios: (() => {
    const a = [];
    [{ id: "sofia", t: 287 }, { id: "ana", t: 142 }, { id: "maria", t: 230 }, { id: "rita", t: 310 }].forEach(x => {
      for (let i = 0; i < x.t; i++) a.push({ Data: `2026-01-${String(Math.min(5 + Math.floor(i / 6), 31)).padStart(2, "0")}`, ID_Terapeuta: x.id, Tipo: "Efetivado" });
      for (let i = 0; i < Math.floor(x.t * 0.08); i++) a.push({ Data: `2026-01-${String(Math.min(5 + Math.floor(i / 2), 31)).padStart(2, "0")}`, ID_Terapeuta: x.id, Tipo: "Agendado" });
    });
    return a;
  })(),
  ausencias: [
    { ID_Terapeuta: "sofia", Nome: "Sofia Costa", "Data Início": "2025-08-11", "Data Fim": "2025-08-22", Motivo: "Férias (Obrigatórias)", "Dias Úteis": 10, Estado: "Aprovado", Observações: "Fecho CAIDI", "Data Pedido": "2025-06-15", _linha: 2 },
    { ID_Terapeuta: "sofia", Nome: "Sofia Costa", "Data Início": "2025-12-22", "Data Fim": "2025-12-24", Motivo: "Férias (Obrigatórias)", "Dias Úteis": 2, Estado: "Aprovado", Observações: "", "Data Pedido": "2025-11-10", _linha: 3 },
    { ID_Terapeuta: "sofia", Nome: "Sofia Costa", "Data Início": "2026-04-06", "Data Fim": "2026-04-10", Motivo: "Férias (Obrigatórias)", "Dias Úteis": 5, Estado: "Pendente", Observações: "Semana Páscoa", "Data Pedido": "2026-01-28", _linha: 4 },
    { ID_Terapeuta: "ana", Nome: "Ana Silva", "Data Início": "2025-08-11", "Data Fim": "2025-08-22", Motivo: "Férias (Obrigatórias)", "Dias Úteis": 10, Estado: "Aprovado", Observações: "Fecho CAIDI", "Data Pedido": "2025-06-15", _linha: 5 },
    { ID_Terapeuta: "ana", Nome: "Ana Silva", "Data Início": "2025-11-03", "Data Fim": "2025-11-03", Motivo: "Férias (Obrigatórias)", "Dias Úteis": 1, Estado: "Aprovado", Observações: "Ponte", "Data Pedido": "2025-09-20", _linha: 6 },
    { ID_Terapeuta: "ana", Nome: "Ana Silva", "Data Início": "2025-12-24", "Data Fim": "2025-12-24", Motivo: "Férias (Obrigatórias)", "Dias Úteis": 1, Estado: "Aprovado", Observações: "Fecho CAIDI", "Data Pedido": "2025-06-15", _linha: 7 },
    { ID_Terapeuta: "ana", Nome: "Ana Silva", "Data Início": "2025-12-31", "Data Fim": "2025-12-31", Motivo: "Férias (Obrigatórias)", "Dias Úteis": 1, Estado: "Aprovado", Observações: "Fecho CAIDI", "Data Pedido": "2025-06-15", _linha: 8 },
    { ID_Terapeuta: "maria", Nome: "Maria Santos", "Data Início": "2025-08-11", "Data Fim": "2025-08-22", Motivo: "Férias (Obrigatórias)", "Dias Úteis": 10, Estado: "Aprovado", Observações: "Fecho CAIDI", "Data Pedido": "2025-06-15", _linha: 9 },
    { ID_Terapeuta: "maria", Nome: "Maria Santos", "Data Início": "2026-04-06", "Data Fim": "2026-04-08", Motivo: "Férias (Obrigatórias)", "Dias Úteis": 3, Estado: "Pendente", Observações: "Páscoa", "Data Pedido": "2026-02-03", _linha: 10 },
    { ID_Terapeuta: "rita", Nome: "Rita Ferreira", "Data Início": "2025-08-11", "Data Fim": "2025-08-22", Motivo: "Férias (Obrigatórias)", "Dias Úteis": 10, Estado: "Aprovado", Observações: "Fecho CAIDI", "Data Pedido": "2025-06-15", _linha: 11 },
    { ID_Terapeuta: "rita", Nome: "Rita Ferreira", "Data Início": "2025-10-06", "Data Fim": "2025-10-10", Motivo: "Baixa Médica", "Dias Úteis": 5, Estado: "Aprovado", Observações: "Gripe", "Data Pedido": "2025-10-06", _linha: 12 },
    { ID_Terapeuta: "rita", Nome: "Rita Ferreira", "Data Início": "2025-12-22", "Data Fim": "2025-12-31", Motivo: "Férias (Obrigatórias)", "Dias Úteis": 6, Estado: "Aprovado", Observações: "", "Data Pedido": "2025-11-10", _linha: 13 },
    { ID_Terapeuta: "rita", Nome: "Rita Ferreira", "Data Início": "2026-07-07", "Data Fim": "2026-07-11", Motivo: "Férias (Bónus)", "Dias Úteis": 5, Estado: "Pendente", Observações: "Dias bónus", "Data Pedido": "2026-02-01", _linha: 14 },
  ],
  periodos: [
    { "Período": "1.º Período", "Início": "2025-09-11", Fim: "2025-12-17" },
    { "Período": "2.º Período", "Início": "2026-01-05", Fim: "2026-03-27" },
    { "Período": "3.º Período", "Início": "2026-04-13", Fim: "2026-06-30" },
  ],
  fecho: [
    { Nome: "Agosto", "Data Início": "2025-08-11", "Data Fim": "2025-08-22", "Dias Úteis": 10 },
    { Nome: "Vésp. Natal", "Data Início": "2025-12-24", "Data Fim": "2025-12-24", "Dias Úteis": 1 },
    { Nome: "Vésp. Ano Novo", "Data Início": "2025-12-31", "Data Fim": "2025-12-31", "Dias Úteis": 1 },
    { Nome: "Carnaval", "Data Início": "2026-02-17", "Data Fim": "2026-02-17", "Dias Úteis": 1 },
    { Nome: "Ponte", "Data Início": "2025-11-03", "Data Fim": "2025-11-03", "Dias Úteis": 1 },
  ],
  config: {},
};

/* ═══════════════════════ API ═══════════════════════ */
async function apiGet(action, params = {}) {
  if (DEMO_MODE) return null;
  const qs = new URLSearchParams({ action, ...params }).toString();
  const res = await fetch(`${API_URL}?${qs}`);
  return res.json();
}
async function apiPost(data) {
  if (DEMO_MODE) return { ok: true };
  const res = await fetch(API_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
  return res.json();
}

/* ═══════════════════════ CÁLCULOS ═══════════════════════ */
function contarDiasUteis(i, f) {
  let c = 0; const d = new Date(i), e = new Date(f);
  while (d <= e) { if (d.getDay() % 6 !== 0) c++; d.setDate(d.getDate() + 1); }
  return c;
}
function periodoAtual(p) {
  const h = new Date("2026-02-05");
  for (const x of p) { if (h >= new Date(x["Início"]) && h <= new Date(x.Fim)) return x; }
  return p[1];
}
function calc(t, apoios, aus, per, fecho) {
  const p = periodoAtual(per), h = new Date("2026-02-05");
  const iP = new Date(p["Início"]), fP = new Date(p.Fim);
  const dLT = contarDiasUteis(iP, fP), dLH = contarDiasUteis(iP, h);
  const hLD = Number(t["Horas Letivas"]) / 5, hSD = Number(t["Horas Semanais"]) / 5;
  const dB = aus.filter(a => a.Motivo === "Baixa Médica" && a.Estado === "Aprovado").reduce((s, a) => s + Number(a["Dias Úteis"] || 0), 0);
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
  return { periodo: p, ef, mMin, mE2, mH, pH, pM, diff: ef - mH, proj, tF, fU, bU, oR, dBn, bR, dB, fE2, sc, dLT, dLH };
}

/* ═══════════════════════ COMPONENTS ═══════════════════════ */
const EST = {
  Aprovado: { bg: C.greenBg, c: C.green, icon: "✓", l: "Aprovado" },
  Pendente: { bg: C.yellowBg, c: "#E17055", icon: "⏳", l: "Pendente" },
  Rejeitado: { bg: C.redBg, c: C.red, icon: "✕", l: "Rejeitado" },
};

function Ring({ value, max, size, stroke, color, children }) {
  const r = (size - stroke) / 2, ci = 2 * Math.PI * r, p = Math.min(value / max, 1);
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
input:focus { outline: none; border-color: ${C.teal} !important; box-shadow: 0 0 0 3px ${C.tealLight} !important; }
button { font-family: 'DM Sans', sans-serif; }
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
  };
  return <button onClick={onClick} disabled={disabled} style={{ padding: "12px 20px", borderRadius: 14, fontSize: 14, fontWeight: 700, cursor: disabled ? "default" : "pointer", transition: "all 0.2s", opacity: disabled ? 0.5 : 1, width: "100%", ...s[variant], ...style }}>{children}</button>;
};

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
    if (!t || String(t.PIN) !== pin) { setErr("PIN incorreto" + (DEMO_MODE ? " (usa 1234)" : "")); return; }
    onLogin(sel, false);
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: `linear-gradient(150deg, ${C.dark} 0%, #3d4f51 40%, ${C.tealDark} 100%)`, padding: 24, position: "relative", overflow: "hidden" }}>
      <style>{CSS}</style>
      <div style={{ position: "absolute", top: -60, right: -60, width: 200, height: 200, borderRadius: "50%", background: `${C.teal}15`, animation: "float 6s ease infinite" }} />
      <div style={{ position: "absolute", bottom: -40, left: -40, width: 160, height: 160, borderRadius: "50%", background: `${C.teal}10`, animation: "float 8s ease infinite 1s" }} />

      <div style={{ animation: "up 0.5s ease", textAlign: "center", marginBottom: 28, zIndex: 1 }}>
        <div style={{ width: 60, height: 60, borderRadius: 18, margin: "0 auto 12px", background: C.teal, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 900, color: C.white, boxShadow: `0 8px 24px ${C.teal}55`, letterSpacing: -0.5 }}>C</div>
        <h1 style={{ color: C.white, fontSize: 28, fontWeight: 900, margin: "0 0 2px", letterSpacing: -0.5 }}>CAIDI</h1>
        <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, margin: 0, fontWeight: 500 }}>Produtividade & Férias</p>
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
                  <div style={{ textAlign: "left" }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.dark }}>{t.Nome}</div>
                    <div style={{ fontSize: 10, color: C.darkSoft }}>{t["Área"]}</div>
                  </div>
                  {sel === t.ID && <span style={{ marginLeft: "auto", color: C.teal, fontSize: 16 }}>●</span>}
                </button>
              ))}
            </div>
            <label style={{ fontSize: 10, fontWeight: 700, color: C.gray, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 6 }}>PIN</label>
            <input type="password" maxLength={4} value={pin} onChange={e => { setPin(e.target.value.replace(/\D/g, "")); setErr(""); }} placeholder="••••"
              style={{ width: "100%", padding: 13, borderRadius: 14, border: `2px solid ${C.grayLight}`, fontSize: 24, textAlign: "center", letterSpacing: 10, color: C.dark, background: C.grayBg, fontWeight: 800 }} />
          </>
        ) : (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{ fontSize: 44, animation: "float 3s ease infinite" }}>📊</div>
            <div style={{ fontSize: 13, color: C.darkSoft, marginTop: 8 }}>Semáforos, pedidos, visão global</div>
          </div>
        )}

        {err && <div style={{ background: C.redBg, color: C.red, padding: "8px 12px", borderRadius: 10, fontSize: 12, fontWeight: 600, marginTop: 12 }}>⚠️ {err}</div>}
        <div style={{ marginTop: 18 }}><Btn onClick={go}>Entrar</Btn></div>
      </div>

      {DEMO_MODE && <div style={{ color: "rgba(255,255,255,0.25)", fontSize: 10, marginTop: 22, zIndex: 1 }}>modo demo · PIN 1234</div>}
      {!DEMO_MODE && <div style={{ color: "rgba(255,255,255,0.25)", fontSize: 10, marginTop: 22, zIndex: 1 }}>🟢 ligado ao Google Sheets</div>}
    </div>
  );
}

/* ═══════════════════════ THERAPIST VIEW ═══════════════════════ */
function TherapistView({ data, terap, onLogout, onRefresh, onAddAusencia }) {
  const [tab, setTab] = useState("inicio");
  const [showForm, setShowForm] = useState(false);
  const [fD, setFD] = useState({ inicio: "", fim: "" });
  const [fN, setFN] = useState("");
  const [sub, setSub] = useState(false);
  const [done, setDone] = useState(false);

  const aus = data.ausencias.filter(a => a.ID_Terapeuta === terap.ID);
  const ap = data.apoios.filter(a => a.ID_Terapeuta === terap.ID);
  const m = calc(terap, ap, aus, data.periodos, data.fecho);
  const pedidos = aus.filter(a => a.Motivo.includes("Férias")).sort((a, b) => (b["Data Pedido"]||"").localeCompare(a["Data Pedido"]||""));
  const pend = pedidos.filter(p => p.Estado === "Pendente").length;

  const submit = async () => {
    if (!fD.inicio || !fD.fim) return;
    setSub(true);
    const dias = contarDiasUteis(fD.inicio, fD.fim);
    const motivo = m.oR > 0 ? "Férias (Obrigatórias)" : "Férias (Bónus)";
    await apiPost({ action: "novoPedido", terapId: terap.ID, nome: terap.Nome, dataInicio: fD.inicio, dataFim: fD.fim, motivo, nota: fN });
    onAddAusencia({ ID_Terapeuta: terap.ID, Nome: terap.Nome, "Data Início": fD.inicio, "Data Fim": fD.fim, Motivo: motivo, "Dias Úteis": dias, Estado: "Pendente", Observações: fN, "Data Pedido": new Date().toISOString().slice(0, 10) });
    setSub(false); setDone(true);
    setTimeout(() => { setShowForm(false); setDone(false); setFD({ inicio: "", fim: "" }); setFN(""); onRefresh(); }, 1800);
  };

  const tabs = [{ id: "inicio", icon: "🏠", l: "Início" }, { id: "ferias", icon: "🌴", l: "Férias" }, { id: "pedidos", icon: "📋", l: "Pedidos" }, { id: "info", icon: "💡", l: "Info" }];

  return (
    <div style={{ maxWidth: 420, margin: "0 auto", minHeight: "100vh", background: C.grayBg, fontFamily: "'DM Sans', sans-serif", position: "relative", paddingBottom: 80 }}>
      <style>{CSS}</style>
      <div style={{ background: `linear-gradient(140deg, ${C.dark} 0%, ${C.tealDark} 100%)`, padding: "24px 20px 20px", color: C.white, borderRadius: "0 0 28px 28px", boxShadow: `0 8px 32px ${C.dark}33`, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -30, right: -30, width: 120, height: 120, borderRadius: "50%", background: `${C.teal}18` }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", position: "relative" }}>
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, opacity: 0.4, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 4 }}>CAIDI · {m.periodo["Período"]}{DEMO_MODE ? " · demo" : ""}</div>
            <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: -0.3 }}>Olá, {terap.Nome.split(" ")[0]}! 👋</div>
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
                  <div style={{ fontSize: 8, color: C.gray, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>da meta</div>
                </Ring>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                    <div><div style={{ fontSize: 24, fontWeight: 900, color: C.dark, lineHeight: 1 }}>{m.ef}</div><div style={{ fontSize: 10, color: C.gray }}>realizados</div></div>
                    <div style={{ textAlign: "right" }}><div style={{ fontSize: 24, fontWeight: 900, color: C.grayLight, lineHeight: 1 }}>{m.mMin}</div><div style={{ fontSize: 10, color: C.gray }}>meta</div></div>
                  </div>
                  <div style={{ height: 6, background: C.grayLight, borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ height: "100%", borderRadius: 3, width: `${Math.min(m.pM, 100)}%`, background: `linear-gradient(90deg, ${m.sc}, ${m.sc}cc)`, transition: "width 1.2s ease" }} />
                  </div>
                  <div style={{ fontSize: 10, color: m.sc, fontWeight: 700, marginTop: 5 }}>
                    {m.pH >= 95 ? "🟢 Excelente!" : m.pH >= 80 ? "🟡 Atenção" : "🔴 Abaixo"} · {m.diff >= 0 ? "+" : ""}{m.diff} vs hoje
                  </div>
                  <div style={{ fontSize: 9, color: C.gray, marginTop: 1 }}>Projeção: ~{m.proj} apoios</div>
                </div>
              </div>
            </Card>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
              <Card delay={0.1} style={{ padding: 14 }}>
                <div style={{ fontSize: 9, color: C.gray, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>🌴 Férias rest.</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginTop: 4 }}>
                  <span style={{ fontSize: 30, fontWeight: 900, color: m.oR <= 3 ? C.red : C.teal, lineHeight: 1 }}>{m.oR}</span>
                  <span style={{ fontSize: 11, color: C.gray }}>de 22</span>
                </div>
              </Card>
              <Card delay={0.15} style={{ padding: 14 }}>
                <div style={{ fontSize: 9, color: C.gray, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>🎁 Bónus</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginTop: 4 }}>
                  <span style={{ fontSize: 30, fontWeight: 900, color: C.green, lineHeight: 1 }}>{m.dBn}</span>
                  <span style={{ fontSize: 11, color: C.gray }}>ganhos</span>
                </div>
              </Card>
            </div>

            <div style={{ marginTop: 10 }}>
              {m.fE2 > 0 ? (
                <Card delay={0.2} style={{ background: `linear-gradient(135deg, ${C.tealLight}, ${C.white})`, border: `1px solid ${C.tealSoft}` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 28, animation: "float 3s ease infinite" }}>🎯</span>
                    <div><div style={{ fontSize: 13, fontWeight: 800, color: C.tealDark }}>Faltam-te {m.fE2} apoios para o Escalão 2!</div><div style={{ fontSize: 11, color: C.darkSoft }}>A partir daí, cada apoio extra = 5€</div></div>
                  </div>
                </Card>
              ) : (
                <Card delay={0.2} style={{ background: `linear-gradient(135deg, ${C.greenBg}, ${C.white})`, border: `1px solid #b2f5ea` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 28, animation: "float 3s ease infinite" }}>⭐</span>
                    <div><div style={{ fontSize: 13, fontWeight: 800, color: C.green }}>Acima do Escalão 2!</div><div style={{ fontSize: 11, color: C.darkSoft }}>Cada apoio extra vale 5€</div></div>
                  </div>
                </Card>
              )}
            </div>

            {pend > 0 && (
              <Card delay={0.25} style={{ marginTop: 10, background: C.yellowBg, border: "1px solid #FDEBD0" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span>⏳</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: C.red, flex: 1 }}>{pend} pedido{pend > 1 ? "s" : ""} pendente{pend > 1 ? "s" : ""}</span>
                  <button onClick={() => setTab("pedidos")} style={{ background: `${C.red}15`, border: "none", borderRadius: 8, padding: "5px 10px", fontSize: 10, fontWeight: 700, color: C.red, cursor: "pointer" }}>Ver →</button>
                </div>
              </Card>
            )}
          </div>
        )}

        {tab === "ferias" && (
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 900, color: C.dark, margin: "0 0 12px" }}>As tuas férias</h2>
            <Card delay={0}>
              {[{ l: "🌴 Obrigatórias", u: m.fU, t: terap["Dias Férias"], r: m.oR, c: C.teal, f: m.tF },
                { l: "🎁 Bónus", u: m.bU, t: m.dBn, r: m.bR, c: C.green }].map((f, i) => (
                <div key={i} style={{ marginBottom: i === 0 ? 16 : 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: C.dark }}>{f.l}</span>
                    <span style={{ fontSize: 13, fontWeight: 800, color: f.c }}>{f.u}/{f.t}</span>
                  </div>
                  <div style={{ height: 10, background: C.grayLight, borderRadius: 6, overflow: "hidden", display: "flex" }}>
                    {f.f && <div style={{ width: `${f.t > 0 ? (f.f / f.t) * 100 : 0}%`, background: C.gray, height: "100%" }} />}
                    <div style={{ width: `${f.t > 0 ? ((f.u - (f.f || 0)) / f.t) * 100 : 0}%`, background: f.c, height: "100%" }} />
                  </div>
                  <div style={{ fontSize: 9, color: C.darkSoft, marginTop: 4 }}>
                    {f.f ? `⬛ Fecho (${f.f}d) · 🟩 Marcadas (${Math.max(f.u - f.f, 0)}d) · ` : ""}<span style={{ fontWeight: 700, color: C.green }}>Restam {f.r}d</span>
                    {i === 1 && m.oR > 0 && <span style={{ color: C.red }}> · ⚠️ só após os 22</span>}
                  </div>
                </div>
              ))}
            </Card>
            <div style={{ marginTop: 12 }}><Btn onClick={() => setShowForm(true)}>📝 Pedir Férias</Btn></div>

            <h3 style={{ fontSize: 13, fontWeight: 800, color: C.dark, margin: "16px 0 8px" }}>📅 Fecho do CAIDI</h3>
            <Card delay={0.1} style={{ padding: 0, overflow: "hidden" }}>
              {data.fecho.map((f, i) => (
                <div key={i} style={{ padding: "10px 14px", borderBottom: i < data.fecho.length - 1 ? `1px solid ${C.grayLight}` : "none", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, background: i % 2 ? C.white : C.grayBg }}>
                  <div><span style={{ fontWeight: 700, color: C.dark }}>{f.Nome}</span><br/><span style={{ fontSize: 10, color: C.gray }}>{fmtDF(f["Data Início"])}{f["Data Início"] !== f["Data Fim"] ? ` → ${fmtDF(f["Data Fim"])}` : ""}</span></div>
                  <span style={{ fontSize: 10, fontWeight: 800, color: C.darkSoft, background: C.grayLight, padding: "3px 8px", borderRadius: 6 }}>{f["Dias Úteis"]}d</span>
                </div>
              ))}
            </Card>

            <h3 style={{ fontSize: 13, fontWeight: 800, color: C.dark, margin: "14px 0 8px" }}>🏫 Períodos letivos</h3>
            {data.periodos.map((p, i) => (
              <Card key={i} delay={0.1 + i * 0.05} style={{ padding: "10px 14px", marginBottom: 6, border: `1px solid ${C.redBg}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 }}>
                  <div><span style={{ fontWeight: 800, color: C.red }}>{p["Período"]}</span><span style={{ color: C.gray, marginLeft: 8, fontSize: 10 }}>{fmtDF(p["Início"])} → {fmtDF(p.Fim)}</span></div>
                  <span style={{ fontSize: 8, background: C.redBg, color: C.red, padding: "3px 6px", borderRadius: 4, fontWeight: 800 }}>🔒</span>
                </div>
              </Card>
            ))}
          </div>
        )}

        {tab === "pedidos" && (
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 900, color: C.dark, margin: "0 0 12px" }}>Os teus pedidos</h2>
            {pedidos.length === 0 ? <Card><div style={{ textAlign: "center", padding: 20, color: C.gray }}><div style={{ fontSize: 36 }}>📋</div><div style={{ fontSize: 13, marginTop: 6 }}>Sem pedidos</div></div></Card>
            : pedidos.map((p, i) => {
              const e = EST[p.Estado] || EST.Pendente;
              return (
                <Card key={i} delay={i * 0.05} style={{ marginBottom: 8, borderLeft: `4px solid ${e.c}`, borderRadius: "4px 20px 20px 4px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: C.dark }}>{fmtD(p["Data Início"])} → {fmtD(p["Data Fim"])}</div>
                      <div style={{ fontSize: 10, color: C.darkSoft, marginTop: 2 }}>{p["Dias Úteis"]}d · {p.Motivo.includes("Bónus") ? "🎁 Bónus" : "🌴 Obrigatórias"}</div>
                    </div>
                    <span style={{ background: e.bg, color: e.c, padding: "3px 9px", borderRadius: 8, fontSize: 10, fontWeight: 700 }}>{e.icon} {e.l}</span>
                  </div>
                  {p.Observações && <div style={{ fontSize: 11, color: C.darkSoft, fontStyle: "italic", marginTop: 5 }}>"{p.Observações}"</div>}
                </Card>
              );
            })}
          </div>
        )}

        {tab === "info" && (
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 900, color: C.dark, margin: "0 0 12px" }}>Como funciona</h2>
            {[
              { i: "🌴", t: "Férias obrigatórias (22 dias)", d: "Fora dos períodos letivos. Dias de fecho CAIDI descontam automaticamente." },
              { i: "🎁", t: "Férias bónus (até 15)", d: "Ganhas por produtividade! Só após gastar os 22 obrigatórios." },
              { i: "⭐", t: "Escalões", d: "Meta mínima = +1 dia férias · +5% = 5€/apoio · Teto = 10€/apoio." },
              { i: "🏥", t: "Baixa médica", d: "Separada das férias. A meta ajusta automaticamente." },
              { i: "🔴", t: "Período letivo = sem férias", d: "Exceções requerem autorização." },
            ].map((x, i) => (
              <Card key={i} delay={i * 0.06} style={{ marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <span style={{ fontSize: 22, flexShrink: 0 }}>{x.i}</span>
                  <div><div style={{ fontSize: 13, fontWeight: 800, color: C.dark }}>{x.t}</div><div style={{ fontSize: 11, color: C.darkSoft, lineHeight: 1.5, marginTop: 2 }}>{x.d}</div></div>
                </div>
              </Card>
            ))}
            <div style={{ marginTop: 10 }}><Btn onClick={onLogout} variant="secondary">Sair</Btn></div>
          </div>
        )}
      </div>

      {showForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(45,52,54,0.5)", backdropFilter: "blur(4px)", zIndex: 100, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={e => { if (e.target === e.currentTarget) setShowForm(false); }}>
          <div style={{ background: C.white, borderRadius: "26px 26px 0 0", padding: "24px 20px 32px", width: "100%", maxWidth: 420, animation: "slideUp 0.3s ease" }}>
            {done ? (
              <div style={{ textAlign: "center", padding: "24px 0", animation: "pop 0.4s ease" }}><div style={{ fontSize: 48 }}>✅</div><div style={{ fontSize: 17, fontWeight: 800, color: C.green, marginTop: 10 }}>Pedido enviado!</div></div>
            ) : (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
                  <h3 style={{ fontSize: 18, fontWeight: 900, color: C.dark, margin: 0 }}>Pedir férias</h3>
                  <button onClick={() => setShowForm(false)} style={{ background: C.grayBg, border: "none", borderRadius: "50%", width: 32, height: 32, fontSize: 14, cursor: "pointer", color: C.darkSoft }}>✕</button>
                </div>
                {["inicio", "fim"].map(k => (
                  <div key={k} style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: 10, fontWeight: 700, color: C.gray, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 4 }}>{k === "inicio" ? "De" : "Até"}</label>
                    <input type="date" value={fD[k]} onChange={e => setFD(d => ({ ...d, [k]: e.target.value }))} style={{ width: "100%", padding: 12, borderRadius: 12, border: `2px solid ${C.grayLight}`, fontSize: 14, color: C.dark, background: C.grayBg }} />
                  </div>
                ))}
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 10, fontWeight: 700, color: C.gray, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 4 }}>Nota</label>
                  <input type="text" value={fN} onChange={e => setFN(e.target.value)} placeholder="Ex: Semana da Páscoa" style={{ width: "100%", padding: 12, borderRadius: 12, border: `2px solid ${C.grayLight}`, fontSize: 14, color: C.dark, background: C.grayBg }} />
                </div>
                <div style={{ background: C.tealLight, padding: "10px 12px", borderRadius: 12, fontSize: 12, color: C.tealDark, fontWeight: 600, marginBottom: 16 }}>
                  💡 Tens <strong>{m.oR} dias obrigatórios</strong> por marcar
                </div>
                <Btn onClick={submit} disabled={sub}>{sub ? "A enviar..." : "Enviar pedido"}</Btn>
              </>
            )}
          </div>
        </div>
      )}

      <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 420, background: C.white, borderTop: `1px solid ${C.grayLight}`, display: "flex", justifyContent: "space-around", padding: "8px 0 14px", boxShadow: "0 -4px 20px rgba(0,0,0,0.04)" }}>
        {tabs.map(tb => (
          <button key={tb.id} onClick={() => setTab(tb.id)} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 2, color: tab === tb.id ? C.teal : C.gray, padding: "2px 12px", transition: "all 0.2s" }}>
            <span style={{ fontSize: 20, transform: tab === tb.id ? "scale(1.15)" : "scale(1)", transition: "transform 0.2s" }}>{tb.icon}</span>
            <span style={{ fontSize: 9, fontWeight: tab === tb.id ? 800 : 500 }}>{tb.l}</span>
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
  const handle = async (ln, est) => {
    setUpd(ln);
    await apiPost({ action: est === "Aprovado" ? "aprovarPedido" : "rejeitarPedido", linha: ln });
    onUpdateEstado(ln, est); setUpd(null); onRefresh();
  };
  const pend = data.ausencias.filter(a => a.Estado === "Pendente");
  const hist = data.ausencias.filter(a => a.Estado !== "Pendente" && a.Motivo.includes("Férias"));

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", minHeight: "100vh", background: C.grayBg, fontFamily: "'DM Sans', sans-serif", padding: "0 0 24px" }}>
      <style>{CSS}</style>
      <div style={{ background: `linear-gradient(140deg, ${C.dark} 0%, #3d4f51 100%)`, padding: "24px 20px 20px", color: C.white, borderRadius: "0 0 28px 28px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -20, right: -20, width: 100, height: 100, borderRadius: "50%", background: `${C.teal}12` }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", position: "relative" }}>
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, opacity: 0.4, letterSpacing: 1.5, textTransform: "uppercase" }}>CAIDI · Gestão{DEMO_MODE ? " · demo" : ""}</div>
            <div style={{ fontSize: 20, fontWeight: 900 }}>Painel de Gestão 📊</div>
          </div>
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
              <Ring value={m2.ef} max={m2.mMin} size={48} stroke={5} color={m2.sc}>
                <span style={{ fontSize: 11, fontWeight: 900, color: m2.sc }}>{m2.pM}%</span>
              </Ring>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: C.dark }}>{t.Nome}</span>
                  <span>{m2.pH >= 95 ? "🟢" : m2.pH >= 80 ? "🟡" : "🔴"}</span>
                </div>
                <div style={{ fontSize: 10, color: C.darkSoft }}>{m2.ef}/{m2.mMin} · {t["Área"]}</div>
                <div style={{ height: 4, background: C.grayLight, borderRadius: 2, marginTop: 4, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${Math.min(m2.pM, 100)}%`, background: m2.sc, borderRadius: 2 }} />
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 8, color: C.gray, fontWeight: 700, textTransform: "uppercase" }}>Férias</div>
                <div style={{ fontSize: 16, fontWeight: 900, color: m2.oR <= 3 ? C.red : C.teal }}>{m2.oR}</div>
                {m2.dB > 0 && <div style={{ fontSize: 9, color: C.red }}>{m2.dB}d baixa</div>}
              </div>
            </Card>
          );
        })}

        <h2 style={{ fontSize: 16, fontWeight: 900, color: C.dark, margin: "18px 0 10px" }}>
          Pedidos pendentes {pend.length > 0 && <span style={{ background: C.redBg, color: C.red, padding: "2px 8px", borderRadius: 8, fontSize: 12, fontWeight: 800, marginLeft: 8 }}>{pend.length}</span>}
        </h2>

        {pend.length === 0 ? (
          <Card style={{ background: C.greenBg, border: `1px solid #b2f5ea` }}><div style={{ textAlign: "center", fontSize: 13, fontWeight: 700, color: C.green }}>✓ Sem pedidos pendentes!</div></Card>
        ) : pend.map((p, i) => {
          const t = data.terapeutas.find(x => x.ID === p.ID_Terapeuta);
          return (
            <Card key={i} delay={i * 0.05} style={{ marginBottom: 8 }}>
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: C.dark }}>{t ? t.Nome : p.ID_Terapeuta}</div>
                <div style={{ fontSize: 11, color: C.darkSoft, marginTop: 2 }}>{fmtDF(p["Data Início"])} → {fmtDF(p["Data Fim"])} · {p["Dias Úteis"]}d · {p.Motivo.includes("Bónus") ? "🎁 Bónus" : "🌴 Obrig."}</div>
                {p.Observações && <div style={{ fontSize: 11, color: C.darkSoft, fontStyle: "italic", marginTop: 3 }}>"{p.Observações}"</div>}
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
            <h3 style={{ fontSize: 13, fontWeight: 700, color: C.gray, margin: "16px 0 8px" }}>Histórico</h3>
            {hist.slice(0, 8).map((p, i) => {
              const t = data.terapeutas.find(x => x.ID === p.ID_Terapeuta);
              const e = EST[p.Estado] || EST.Pendente;
              return (
                <div key={i} style={{ background: C.white, borderRadius: 14, padding: "9px 14px", border: `1px solid ${C.grayLight}`, marginBottom: 4, display: "flex", justifyContent: "space-between", alignItems: "center", opacity: 0.6, fontSize: 12 }}>
                  <div><span style={{ fontWeight: 700 }}>{t ? t.Nome : p.ID_Terapeuta}</span><span style={{ color: C.gray, marginLeft: 8, fontSize: 10 }}>{fmtD(p["Data Início"])} → {fmtD(p["Data Fim"])}</span></div>
                  <span style={{ background: e.bg, color: e.c, padding: "2px 7px", borderRadius: 6, fontSize: 9, fontWeight: 700 }}>{e.icon} {e.l}</span>
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

/* ═══════════════════════ MAIN APP ═══════════════════════ */
export default function App() {
  const [user, setUser] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (DEMO_MODE) { setData(JSON.parse(JSON.stringify(DEMO))); setLoading(false); return; }
    try {
      const r = await apiGet("tudo");
      setData(r && !r.erro ? r : JSON.parse(JSON.stringify(DEMO)));
    } catch { setData(JSON.parse(JSON.stringify(DEMO))); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  const refresh = () => { if (!DEMO_MODE) fetchData(); };
  const addAus = (n) => setData(p => ({ ...p, ausencias: [...p.ausencias, { ...n, _linha: p.ausencias.length + 2 }] }));
  const updEst = (ln, est) => setData(p => ({ ...p, ausencias: p.ausencias.map(a => a._linha === ln ? { ...a, Estado: est } : a) }));

  if (loading || !data) return <Loading />;
  if (!user) return <Login terapeutas={data.terapeutas} onLogin={(id, adm) => setUser({ id, isAdmin: adm })} />;
  if (user.isAdmin) return <AdminView data={data} onLogout={() => setUser(null)} onRefresh={refresh} onUpdateEstado={updEst} />;
  const t = data.terapeutas.find(x => x.ID === user.id);
  if (!t) { setUser(null); return null; }
  return <TherapistView data={data} terap={t} onLogout={() => setUser(null)} onRefresh={refresh} onAddAusencia={addAus} />;
}
