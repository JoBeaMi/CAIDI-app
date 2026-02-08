import { useState, useEffect, useCallback, useRef } from "react";

/* ═══════════════════════════════════════════════════════════════
   CONFIGURAÇÃO — Cola aqui o URL do Google Apps Script
   ═══════════════════════════════════════════════════════════════ */
const API_URL = "https://script.google.com/macros/s/AKfycbwzwj_m6aZyIyGkYqK2jXiZ8BXiiB5Tax6_ZtaUS9A2n9R48oCpo291xPYwIBcnEbUD_A/exec";
/* ⚠️  Após atualizar o Apps Script, faz novo deploy e cola o URL atualizado acima */

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
  const res = await fetch(API_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(data) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/* ═══════════════════════ FILE UTILS ═══════════════════════ */
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => { resolve({ nome: file.name, tipo: file.type, dados: reader.result.split(",")[1] }); };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* ═══════════════════════ CÁLCULOS ═══════════════════════ */
function contarDiasUteis(i, f) {
  if (!i || !f) return 0;
  let c = 0; const d = new Date(i), e = new Date(f);
  while (d <= e) { if (d.getDay() % 6 !== 0) c++; d.setDate(d.getDate() + 1); }
  return c;
}

/* ─── QUADRIMESTRES ───
   Q1: 1 Set → 31 Dez  (contém 1.º Período letivo)
   Q2: 1 Jan → 13 Abr  (contém 2.º Período letivo)
   Q3: 14 Abr → 31 Ago (contém 3.º Período letivo)
   META = dias úteis do período LETIVO × horas letivas/dia
   Tempo para cumprir = quadrimestre inteiro */
function buildQuadrimestres(periodos) {
  if (!periodos || periodos.length === 0) return [];
  const sorted = [...periodos].sort((a, b) => (a["Início"] || "").localeCompare(b["Início"] || ""));
  return sorted.map((p, i) => {
    const y0 = parseInt((p["Início"] || "2025-09-01").substring(0, 4));
    const yFim = parseInt((p.Fim || "2026-08-31").substring(0, 4));
    let qInicio, qFim, label, meses;
    if (i === 0) {
      qInicio = y0 + "-09-01"; qFim = y0 + "-12-31";
      label = "1.º Quadrimestre"; meses = "Set–Dez";
    } else if (i === 1) {
      const qY = y0 >= 2026 ? y0 : y0 + 1;
      qInicio = qY + "-01-01"; qFim = qY + "-04-13";
      label = "2.º Quadrimestre"; meses = "Jan–Abr";
    } else {
      qInicio = yFim + "-04-14"; qFim = yFim + "-08-31";
      label = "3.º Quadrimestre"; meses = "Abr–Ago";
    }
    return { label, meses, periodo: p["Período"], letivoInicio: p["Início"], letivoFim: p.Fim, qInicio, qFim };
  });
}

function quadAtual(quads) {
  const hStr = new Date().toISOString().slice(0, 10);
  for (const q of quads) { if (hStr >= q.qInicio && hStr <= q.qFim) return q; }
  const future = quads.filter(q => q.qInicio > hStr);
  if (future.length) return future[0];
  return quads[quads.length - 1] || null;
}

/* ═══════════════════════ HORÁRIO HELPERS ═══════════════════════ */
function getHorario(horarios, tId) {
  if (!horarios || !horarios.length) return null;
  const h = horarios.find(x => x.ID_Terapeuta === tId);
  if (!h) return null;
  const dias = [0, Number(h.Seg||0), Number(h.Ter||0), Number(h.Qua||0), Number(h.Qui||0), Number(h.Sex||0), 0];
  const diasTrab = dias.filter(d => d > 0).length;
  if (diasTrab === 0) return null;
  return { dias, diasTrab, diasFeriasCAIDI: Math.round(diasTrab / 5 * 22) };
}
function trabalhaDia(hor, dayOfWeek) {
  if (!hor) return dayOfWeek >= 1 && dayOfWeek <= 5;
  return hor.dias[dayOfWeek] > 0;
}
function contarDiasTrabFecho(fecho, hor) {
  let count = 0;
  for (const f of fecho) {
    const d = new Date(f["Data Início"]), fim = new Date(f["Data Fim"]);
    while (d <= fim) { if (trabalhaDia(hor, d.getDay())) count++; d.setDate(d.getDate() + 1); }
  }
  return count;
}
function contarDiasTrabAus(ausList, hor) {
  let count = 0;
  for (const a of ausList) {
    if (Number(a["Dias Úteis"] || 0) === 0.5) {
      const d = new Date(a["Data Início"]);
      if (trabalhaDia(hor, d.getDay())) count += 0.5;
    } else {
      const d = new Date(a["Data Início"]), fim = new Date(a["Data Fim"]);
      while (d <= fim) { if (d.getDay() >= 1 && d.getDay() <= 5 && trabalhaDia(hor, d.getDay())) count++; d.setDate(d.getDate() + 1); }
    }
  }
  return count;
}

function calc(t, efCount, aus, periodos, fecho, horarios) {
  const quads = buildQuadrimestres(periodos);
  const q = quadAtual(quads);
  if (!q) return emptyMetrics();
  const hojeStr = new Date().toISOString().slice(0, 10);
  const hor = getHorario(horarios, t.ID);

  const dLetivoTotal = contarDiasUteis(q.letivoInicio, q.letivoFim);
  const dLetivoHoje = contarDiasUteis(q.letivoInicio, hojeStr > q.letivoFim ? q.letivoFim : hojeStr);
  const dQuadTotal = contarDiasUteis(q.qInicio, q.qFim);
  const dQuadHoje = contarDiasUteis(q.qInicio, hojeStr > q.qFim ? q.qFim : hojeStr);
  const hLD = Number(t["Horas Letivas"]) / 5;

  const ausQ = aus.filter(a => a.Estado === "Aprovado" && a["Data Início"] <= q.qFim && a["Data Fim"] >= q.qInicio);
  const dB  = ausQ.filter(a => a.Motivo === "Baixa Médica").reduce((s, a) => s + Number(a["Dias Úteis"] || 0), 0);
  const dFJ = ausQ.filter(a => a.Motivo === "Falta Justificada").reduce((s, a) => s + Number(a["Dias Úteis"] || 0), 0);
  const dFI = ausQ.filter(a => a.Motivo === "Falta Injustificada").reduce((s, a) => s + Number(a["Dias Úteis"] || 0), 0);
  const dFO = ausQ.filter(a => a.Motivo === "Formação").reduce((s, a) => s + Number(a["Dias Úteis"] || 0), 0);

  const mMin = Math.round(hLD * (dLetivoTotal - dB));
  const mBonus = Math.round(mMin * 0.85);
  const mE2 = Math.round(mMin * 1.05);
  const hSem = Number(t["Horas Semanais"]) / 5;
  const mE3 = Math.round(hSem * (dLetivoTotal - dB) * 1.05);
  const progQuad = dQuadTotal > 0 ? dQuadHoje / dQuadTotal : 1;
  const mH = Math.round(mMin * progQuad);
  const ef = typeof efCount === "number" ? efCount : (Array.isArray(efCount) ? efCount.filter(a => a.Tipo === "Efetivado" && a.Data >= q.qInicio && a.Data <= q.qFim).length : 0);
  const pH = mH > 0 ? Math.round((ef / mH) * 100) : (ef > 0 ? 100 : 0);
  const pM = mMin > 0 ? Math.round((ef / mMin) * 100) : (ef > 0 ? 100 : 0);
  // Cálculo de € ganhos
  const euros5 = ef > mE2 ? Math.min(ef, mE3) - mE2 : 0;
  const euros10 = ef > mE3 ? ef - mE3 : 0;
  const eurosTotal = (euros5 * 5) + (euros10 * 10);

  // ── Férias com horário proporcional ──
  const diasTrab = hor ? hor.diasTrab : 5;
  const diasFeriasCAIDI = hor ? hor.diasFeriasCAIDI : 22;
  const fechoCAIDI = contarDiasTrabFecho(fecho, hor);
  const tF = fecho.reduce((s, f) => s + Number(f["Dias Úteis"] || 0), 0);

  const feriasPedidas = aus.filter(a => a.Motivo.includes("Férias") && (a.Estado === "Aprovado" || a.Estado === "Pendente"));
  const feriasCAIDI = contarDiasTrabAus(feriasPedidas, hor);
  const fUPedidas = feriasPedidas.filter(a => a.Motivo === "Férias (Obrigatórias)").reduce((s, a) => s + Number(a["Dias Úteis"] || 0), 0);
  const fU = fUPedidas + tF;
  const bU = aus.filter(a => a.Motivo === "Férias (Bónus)" && (a.Estado === "Aprovado" || a.Estado === "Pendente")).reduce((s, a) => s + Number(a["Dias Úteis"] || 0), 0);
  const oR = Math.max(Number(t["Dias Férias"]) - fU, 0);
  const dBn = Number(t["Dias Bónus Ganhos"] || 0), bR = Math.max(dBn - bU, 0);
  const diasBonusCAIDI = diasTrab < 5 ? Math.round(dBn * diasTrab / 5) : dBn;
  const limiteCAIDI = diasFeriasCAIDI + diasBonusCAIDI;
  const usadosCAIDI = fechoCAIDI + feriasCAIDI;
  const restamCAIDI = Math.max(limiteCAIDI - usadosCAIDI, 0);

  const dExtraTotal = Math.max(dQuadTotal - dLetivoTotal, 0);
  const passado = new Date().toISOString().slice(0,10) > q.qFim;
  const fE2 = Math.max(mE2 - ef, 0);
  const proj = dQuadHoje > 0 ? Math.round((ef / dQuadHoje) * dQuadTotal) : 0;
  const sc = pH >= 95 ? C.green : pH >= 80 ? C.yellow : C.red;

  return { quad: q, quads, periodo: { "Período": q.label }, ef, mMin, mBonus, mE2, mE3, mH, pH, pM, diff: ef - mH, proj, tF, fU, bU, oR, dBn, bR, dB, dFJ, dFI, dFO, fE2, sc, dLetivoTotal, dLetivoHoje, dQuadTotal, dQuadHoje, dExtraTotal, progQuad: Math.round(progQuad * 100), hLD, hSem, euros5, euros10, eurosTotal, hor, diasTrab, diasFeriasCAIDI, diasBonusCAIDI, fechoCAIDI, feriasCAIDI, usadosCAIDI, limiteCAIDI, restamCAIDI, passado };
}

function emptyMetrics() {
  return { quad: null, quads: [], periodo: { "Período": "?" }, ef: 0, mMin: 0, mBonus: 0, mE2: 0, mE3: 0, mH: 0, pH: 0, pM: 0, diff: 0, proj: 0, tF: 0, fU: 0, bU: 0, oR: 0, dBn: 0, bR: 0, dB: 0, dFJ: 0, dFI: 0, dFO: 0, fE2: 0, sc: C.gray, dLetivoTotal: 0, dLetivoHoje: 0, dQuadTotal: 0, dQuadHoje: 0, dExtraTotal: 0, progQuad: 0, hLD: 0, hSem: 0, euros5: 0, euros10: 0, eurosTotal: 0, hor: null, diasTrab: 5, diasFeriasCAIDI: 22, diasBonusCAIDI: 0, fechoCAIDI: 0, feriasCAIDI: 0, usadosCAIDI: 0, limiteCAIDI: 22, restamCAIDI: 22, passado: false };
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
const fmtD = d => { if (!d) return ""; const [y,m,day] = String(d).split("-"); return day + "/" + m; };
const fmtDF = d => { if (!d) return ""; const [y,m,day] = String(d).split("-"); return day + "/" + m + "/" + y; };
const fmtDias = (d, per) => { const dias = Number(d) || 0; const label = dias === 0.5 ? "½d" : dias + "d"; const ico = per === "Manhã" ? " 🌅" : per === "Tarde" ? " 🌇" : ""; return label + ico; };
const ini = n => n ? n.split(" ").map(w => w[0]).join("").slice(0,2).toUpperCase() : "?";

const CSS = "@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&display=swap');\n* { box-sizing: border-box; }\nbody { margin: 0; font-family: 'DM Sans', sans-serif; background: " + C.grayBg + "; }\n@keyframes up { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }\n@keyframes slideUp { from { transform:translateY(100%); } to { transform:translateY(0); } }\n@keyframes pop { 0% { transform:scale(0.9); opacity:0; } 100% { transform:scale(1); opacity:1; } }\n@keyframes float { 0%,100% { transform:translateY(0); } 50% { transform:translateY(-6px); } }\ninput:focus, select:focus { outline: none; border-color: " + C.teal + " !important; box-shadow: 0 0 0 3px " + C.tealLight + " !important; }\nbutton { font-family: 'DM Sans', sans-serif; }\nselect { font-family: 'DM Sans', sans-serif; }\n::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-thumb { background: " + C.grayLight + "; border-radius: 4px; }";

const Card = ({ children, style = {}, delay = 0 }) => (
  <div style={{ background: C.white, borderRadius: 20, padding: "18px 16px", boxShadow: "0 2px 12px rgba(0,0,0,0.04)", border: "1px solid " + C.grayLight, animation: "up 0.5s ease " + delay + "s both", ...style }}>{children}</div>
);

const Btn = ({ children, onClick, disabled, variant = "primary", style = {} }) => {
  const s = {
    primary: { background: "linear-gradient(135deg, " + C.teal + ", " + C.tealDark + ")", color: C.white, border: "none", boxShadow: "0 4px 16px " + C.teal + "44" },
    secondary: { background: C.white, color: C.dark, border: "1.5px solid " + C.grayLight, boxShadow: "none" },
    danger: { background: C.white, color: C.red, border: "1.5px solid " + C.grayLight, boxShadow: "none" },
    success: { background: C.green, color: C.white, border: "none", boxShadow: "0 4px 12px " + C.green + "44" },
    purple: { background: "linear-gradient(135deg, " + C.purple + ", #5a4bd1)", color: C.white, border: "none", boxShadow: "0 4px 16px " + C.purple + "44" },
  };
  return <button onClick={onClick} disabled={disabled} style={{ padding: "12px 20px", borderRadius: 14, fontSize: 14, fontWeight: 700, cursor: disabled ? "default" : "pointer", transition: "all 0.2s", opacity: disabled ? 0.5 : 1, width: "100%", ...s[variant], ...style }}>{children}</button>;
};

const FileBadge = ({ url }) => {
  if (!url || String(url).indexOf("http") !== 0) return null;
  return <a href={url} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 4, background: C.blueBg, color: C.blue, padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 700, textDecoration: "none", marginTop: 4 }}>📎 Ver comprovativo</a>;
};

/* ═══════════════════════ ERROR SCREEN ═══════════════════════ */
function ErrorScreen({ error, onRetry }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "linear-gradient(150deg, " + C.dark + ", #3d4f51)", padding: 24 }}>
      <style>{CSS}</style>
      <div style={{ background: C.white, borderRadius: 28, padding: "32px 24px", maxWidth: 360, width: "100%", textAlign: "center", animation: "up 0.5s ease" }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>⚠️</div>
        <h2 style={{ fontSize: 18, fontWeight: 900, color: C.dark, margin: "0 0 8px" }}>Erro de ligação</h2>
        <p style={{ fontSize: 14, color: C.darkSoft, margin: "0 0 6px", lineHeight: 1.5 }}>Não foi possível ligar ao Google Sheets.</p>
        <div style={{ background: C.redBg, borderRadius: 12, padding: "10px 14px", fontSize: 12, color: C.red, fontWeight: 600, marginBottom: 18, wordBreak: "break-word" }}>{error}</div>
        <Btn onClick={onRetry}>🔄 Tentar novamente</Btn>
      </div>
    </div>
  );
}

/* ═══════════════════════ LOGIN ═══════════════════════ */
function Login({ terapeutas, config, onLogin }) {
  const [sel, setSel] = useState(null);
  const [pin, setPin] = useState("");
  const [pinGestao, setPinGestao] = useState("");
  const [err, setErr] = useState("");
  const [mode, setMode] = useState("terapeuta");

  const go = () => {
    if (mode === "gestao") {
      const pinCorreto = String(config.PIN_Gestao || "").trim();
      if (!pinCorreto) { setErr("PIN de gestão não configurado na folha Config"); return; }
      if (pinGestao !== pinCorreto) { setErr("PIN incorreto"); return; }
      onLogin(null, true); return;
    }
    if (!sel) { setErr("Seleciona o teu nome"); return; }
    const t = terapeutas.find(x => x.ID === sel);
    if (!t || String(t.PIN) !== pin) { setErr("PIN incorreto"); return; }
    onLogin(sel, false);
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "linear-gradient(150deg, " + C.dark + " 0%, #3d4f51 40%, " + C.tealDark + " 100%)", padding: 24, position: "relative", overflow: "hidden" }}>
      <style>{CSS}</style>
      <div style={{ position: "absolute", top: -60, right: -60, width: 200, height: 200, borderRadius: "50%", background: C.teal + "15", animation: "float 6s ease infinite" }} />
      <div style={{ position: "absolute", bottom: -40, left: -40, width: 160, height: 160, borderRadius: "50%", background: C.teal + "10", animation: "float 8s ease infinite 1s" }} />
      <div style={{ animation: "up 0.5s ease", textAlign: "center", marginBottom: 28, zIndex: 1 }}>
        <div style={{ width: 60, height: 60, borderRadius: 18, margin: "0 auto 12px", background: C.teal, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 900, color: C.white, boxShadow: "0 8px 24px " + C.teal + "55" }}>C</div>
        <h1 style={{ color: C.white, fontSize: 28, fontWeight: 900, margin: "0 0 2px", letterSpacing: -0.5 }}>CAIDI</h1>
        <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, margin: 0 }}>Produtividade & Férias</p>
      </div>
      <div style={{ background: C.white, borderRadius: 28, padding: "26px 22px", width: "100%", maxWidth: 360, boxShadow: "0 24px 64px rgba(0,0,0,0.25)", animation: "up 0.5s ease 0.1s both", zIndex: 1 }}>
        <div style={{ display: "flex", background: C.grayBg, borderRadius: 14, padding: 3, marginBottom: 22 }}>
          {["terapeuta", "gestao"].map(m => (
            <button key={m} onClick={() => { setMode(m); setErr(""); setPin(""); setPinGestao(""); }} style={{ flex: 1, padding: 10, borderRadius: 12, border: "none", cursor: "pointer", background: mode === m ? C.white : "transparent", color: mode === m ? C.dark : C.gray, fontWeight: mode === m ? 700 : 500, fontSize: 14, boxShadow: mode === m ? "0 2px 8px rgba(0,0,0,0.06)" : "none", transition: "all 0.25s" }}>
              {m === "terapeuta" ? "🧑‍⚕️ Terapeuta" : "📊 Gestão"}
            </button>
          ))}
        </div>
        {mode === "terapeuta" ? (
          <>
            <label style={{ fontSize: 11, fontWeight: 700, color: C.gray, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 8 }}>Quem és tu?</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 18, maxHeight: 210, overflowY: "auto", paddingRight: 4 }}>
              {terapeutas.map(t => (
                <button key={t.ID} onClick={() => { setSel(t.ID); setErr(""); }} style={{ display: "flex", alignItems: "center", gap: 11, padding: "10px 12px", borderRadius: 14, border: sel === t.ID ? "2px solid " + C.teal : "2px solid " + C.grayLight, background: sel === t.ID ? C.tealLight : C.grayBg, cursor: "pointer", transition: "all 0.2s" }}>
                  <div style={{ width: 36, height: 36, borderRadius: 12, background: sel === t.ID ? C.teal : C.grayLight, color: sel === t.ID ? C.white : C.gray, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, transition: "all 0.2s" }}>{ini(t.Nome)}</div>
                  <div style={{ textAlign: "left" }}><div style={{ fontSize: 14, fontWeight: 700, color: C.dark }}>{t.Nome}</div><div style={{ fontSize: 11, color: C.darkSoft }}>{t["Área"]}</div></div>
                  {sel === t.ID && <span style={{ marginLeft: "auto", color: C.teal }}>●</span>}
                </button>
              ))}
            </div>
            <label style={{ fontSize: 11, fontWeight: 700, color: C.gray, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 6 }}>PIN</label>
            <input type="password" maxLength={4} value={pin} onChange={e => { setPin(e.target.value.replace(/\D/g, "")); setErr(""); }} placeholder="••••" style={{ width: "100%", padding: 13, borderRadius: 14, border: "2px solid " + C.grayLight, fontSize: 24, textAlign: "center", letterSpacing: 10, color: C.dark, background: C.grayBg, fontWeight: 800 }} />
          </>
        ) : (
          <div style={{ textAlign: "center", padding: "12px 0" }}>
            <div style={{ fontSize: 44, animation: "float 3s ease infinite" }}>📊</div>
            <div style={{ fontSize: 14, color: C.darkSoft, marginTop: 8, marginBottom: 16 }}>Semáforos, pedidos, visão global</div>
            <label style={{ fontSize: 11, fontWeight: 700, color: C.gray, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 6 }}>PIN de gestão</label>
            <input type="password" maxLength={6} value={pinGestao} onChange={e => { setPinGestao(e.target.value.replace(/\D/g, "")); setErr(""); }} placeholder="••••" style={{ width: "100%", padding: 13, borderRadius: 14, border: "2px solid " + C.grayLight, fontSize: 24, textAlign: "center", letterSpacing: 10, color: C.dark, background: C.grayBg, fontWeight: 800 }} />
          </div>
        )}
        {err && <div style={{ background: C.redBg, color: C.red, padding: "8px 12px", borderRadius: 10, fontSize: 13, fontWeight: 600, marginTop: 12 }}>⚠️ {err}</div>}
        <div style={{ marginTop: 18 }}><Btn onClick={go}>Entrar</Btn></div>
      </div>
      <div style={{ color: "rgba(255,255,255,0.25)", fontSize: 11, marginTop: 22, zIndex: 1 }}>🟢 ligado ao Google Sheets</div>
    </div>
  );
}

/* ═══════════════════════ ABSENCE FORM ═══════════════════════ */
function AbsenceForm({ type, terap, metrics, periodos, onSubmit, onClose }) {
  const [fD, setFD] = useState({ inicio: "", fim: "" });
  const [fN, setFN] = useState("");
  const [justLetivo, setJustLetivo] = useState("");
  const [periodo, setPeriodo] = useState("dia");
  const [motivo, setMotivo] = useState(type === "ferias" ? "" : type === "baixa" ? "Baixa Médica" : type === "formacao" ? "Formação" : "Falta Justificada");
  const [ficheiro, setFicheiro] = useState(null);
  const [nomeF, setNomeF] = useState("");
  const [sub, setSub] = useState(false);
  const [done, setDone] = useState(false);
  const [errMsg, setErrMsg] = useState("");
  const fileRef = useRef(null);
  const isFerias = type === "ferias";
  const needsUpload = type !== "ferias";

  const mesmoDia = fD.inicio && fD.fim && fD.inicio === fD.fim;

  // Detetar se datas caem em período letivo
  const emLetivo = (() => {
    if (!fD.inicio || !fD.fim || !periodos) return null;
    const ini = new Date(fD.inicio), fim = new Date(fD.fim);
    for (const p of periodos) {
      const pI = new Date(p["Início"]), pF = new Date(p.Fim);
      if (ini <= pF && fim >= pI) return p["Período"];
    }
    return null;
  })();

  const handleFile = (e) => { const f = e.target.files[0]; if (!f) return; if (f.size > 10*1024*1024) { alert("Máx 10MB"); return; } setNomeF(f.name); setFicheiro(f); };
  const removeFile = () => { setFicheiro(null); setNomeF(""); if (fileRef.current) fileRef.current.value = ""; };

  // Calcular quantos dias de trabalho CAIDI este pedido usa
  const diasTrabPedido = (() => {
    if (!fD.inicio || !fD.fim || !metrics.hor) return 0;
    if (mesmoDia && periodo !== "dia") {
      const d = new Date(fD.inicio);
      return trabalhaDia(metrics.hor, d.getDay()) ? 0.5 : 0;
    }
    let count = 0;
    const d = new Date(fD.inicio), fim = new Date(fD.fim);
    while (d <= fim) { if (d.getDay() >= 1 && d.getDay() <= 5 && trabalhaDia(metrics.hor, d.getDay())) count++; d.setDate(d.getDate() + 1); }
    return count;
  })();
  const ultrapassaCAIDI = isFerias && metrics.diasTrab < 5 && metrics.restamCAIDI < diasTrabPedido;
  const esgotouCAIDI = isFerias && metrics.diasTrab < 5 && metrics.restamCAIDI <= 0;

  const submit = async () => {
    if (!fD.inicio || !fD.fim) return;
    if (isFerias && emLetivo && !justLetivo.trim()) { setErrMsg("Pedido em período letivo — indica o motivo da exceção."); return; }
    if (esgotouCAIDI) { setErrMsg("Já usaste todos os dias de trabalho disponíveis no CAIDI. Contacta a gestão."); return; }
    if (ultrapassaCAIDI) { setErrMsg("Este pedido usa " + diasTrabPedido + " dias de trabalho mas só tens " + metrics.restamCAIDI + " disponíveis. Ajusta as datas."); return; }
    setSub(true); setErrMsg("");
    let dias = contarDiasUteis(fD.inicio, fD.fim);
    if (mesmoDia && periodo !== "dia") dias = 0.5;
    let mot = motivo;
    if (isFerias) mot = metrics.oR > 0 ? "Férias (Obrigatórias)" : "Férias (Bónus)";
    const periodoLabel = mesmoDia && periodo !== "dia" ? (periodo === "manha" ? " (Manhã)" : " (Tarde)") : "";
    const notaFinal = (emLetivo && isFerias ? (fN ? fN + " | " : "") + "⚠️ LETIVO (" + emLetivo + "): " + justLetivo : fN) + periodoLabel;
    let ficheiroData = null;
    if (ficheiro) { try { ficheiroData = await fileToBase64(ficheiro); } catch {} }
    try {
      const resp = await apiPost({ action: "novoPedido", terapId: terap.ID, nome: terap.Nome, dataInicio: fD.inicio, dataFim: fD.fim, motivo: mot, nota: notaFinal, periodo: mesmoDia ? periodo : "dia", ficheiro: ficheiroData });
      const linkReal = (resp && resp.ficheiro && resp.ficheiro.indexOf("http") === 0) ? resp.ficheiro : "";
      onSubmit({ ID_Terapeuta: terap.ID, Nome: terap.Nome, "Data Início": fD.inicio, "Data Fim": fD.fim, Motivo: mot, "Dias Úteis": dias, Período: mesmoDia ? periodo : "dia", Estado: "Pendente", Observações: notaFinal, "Data Pedido": new Date().toISOString().slice(0,10), Ficheiro: linkReal });
      setDone(true); setTimeout(onClose, 1800);
    } catch (err) { setErrMsg("Erro: " + err.message); }
    setSub(false);
  };

  const titles = { ferias: "Pedir férias", baixa: "Registar baixa", falta: "Registar falta", formacao: "Registar formação" };
  const icons = { ferias: "🌴", baixa: "🏥", falta: "📋", formacao: "🎓" };
  const btnV = { ferias: "primary", baixa: "purple", falta: "primary", formacao: "primary" };

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
                <label style={{ fontSize: 11, fontWeight: 700, color: C.gray, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 4 }}>Tipo</label>
                <select value={motivo} onChange={e => setMotivo(e.target.value)} style={{ width: "100%", padding: 12, borderRadius: 12, border: "2px solid " + C.grayLight, fontSize: 14, color: C.dark, background: C.grayBg }}>
                  <option value="Falta Justificada">Justificada</option>
                  <option value="Falta Injustificada">Injustificada</option>
                </select>
              </div>
            )}
            {["inicio", "fim"].map(k => (
              <div key={k} style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: C.gray, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 4 }}>{k === "inicio" ? "De" : "Até"}</label>
                <input type="date" value={fD[k]} onChange={e => setFD(d => ({ ...d, [k]: e.target.value }))} style={{ width: "100%", padding: 12, borderRadius: 12, border: "2px solid " + C.grayLight, fontSize: 14, color: C.dark, background: C.grayBg }} />
              </div>
            ))}
            {mesmoDia && (
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: C.gray, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 6 }}>Duração</label>
                <div style={{ display: "flex", gap: 6 }}>
                  {[{ v: "dia", l: "☀️ Dia inteiro", d: "1 dia" }, { v: "manha", l: "🌅 Manhã", d: "0.5 dia" }, { v: "tarde", l: "🌇 Tarde", d: "0.5 dia" }].map(p => (
                    <button key={p.v} onClick={() => setPeriodo(p.v)} style={{ flex: 1, padding: "10px 6px", borderRadius: 12, border: periodo === p.v ? "2px solid " + C.teal : "2px solid " + C.grayLight, background: periodo === p.v ? C.tealLight : C.grayBg, cursor: "pointer", transition: "all 0.2s" }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: periodo === p.v ? C.tealDark : C.dark }}>{p.l}</div>
                      <div style={{ fontSize: 10, color: C.gray, marginTop: 2 }}>{p.d}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: C.gray, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 4 }}>
                {type === "baixa" ? "Motivo" : type === "formacao" ? "Nome da formação" : type === "falta" ? "Justificação" : "Nota (opcional)"}
              </label>
              <input type="text" value={fN} onChange={e => setFN(e.target.value)} placeholder={type === "baixa" ? "Ex: Cirurgia" : type === "formacao" ? "Ex: Workshop PECS" : type === "falta" ? "Ex: Consulta" : "Ex: Páscoa"} style={{ width: "100%", padding: 12, borderRadius: 12, border: "2px solid " + C.grayLight, fontSize: 14, color: C.dark, background: C.grayBg }} />
            </div>
            {needsUpload && (
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: C.gray, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 4 }}>📎 Comprovativo</label>
                {!ficheiro ? (
                  <div onClick={() => fileRef.current?.click()} style={{ border: "2px dashed " + C.grayLight, borderRadius: 14, padding: "16px 12px", textAlign: "center", cursor: "pointer", background: C.grayBg }}>
                    <div style={{ fontSize: 28 }}>📷</div>
                    <div style={{ fontSize: 13, color: C.darkSoft, marginTop: 4, fontWeight: 600 }}>Toca para enviar foto, PDF ou ficheiro</div>
                    <div style={{ fontSize: 11, color: C.gray, marginTop: 2 }}>Máx. 10MB</div>
                  </div>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: 10, background: C.greenBg, border: "1px solid #b2f5ea", borderRadius: 14, padding: "10px 12px" }}>
                    <span style={{ fontSize: 22 }}>📄</span>
                    <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 13, fontWeight: 700, color: C.dark, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nomeF}</div><div style={{ fontSize: 11, color: C.green, fontWeight: 600 }}>✓ Pronto</div></div>
                    <button onClick={removeFile} style={{ background: C.white, border: "1px solid " + C.grayLight, borderRadius: 8, width: 28, height: 28, fontSize: 13, cursor: "pointer", color: C.red, flexShrink: 0 }}>✕</button>
                  </div>
                )}
                <input ref={fileRef} type="file" accept="image/*,.pdf,.doc,.docx" capture="environment" onChange={handleFile} style={{ display: "none" }} />
              </div>
            )}
            {isFerias && fD.inicio && fD.fim && emLetivo && (
              <div style={{ background: C.redBg, padding: "12px 14px", borderRadius: 14, marginBottom: 14, border: "1px solid #f5c6c0" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 20 }}>🔴</span>
                  <div><div style={{ fontSize: 14, fontWeight: 800, color: C.red }}>Período letivo ({emLetivo})</div><div style={{ fontSize: 12, color: C.darkSoft, marginTop: 1 }}>Podes pedir, mas precisas de justificar.</div></div>
                </div>
                <label style={{ fontSize: 11, fontWeight: 700, color: C.red, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 4 }}>Motivo da exceção *</label>
                <input type="text" value={justLetivo} onChange={e => setJustLetivo(e.target.value)} placeholder="Ex: Casamento, compromisso inadiável..." style={{ width: "100%", padding: 12, borderRadius: 12, border: "2px solid #f5c6c0", fontSize: 14, color: C.dark, background: C.white }} />
              </div>
            )}
            {isFerias && fD.inicio && fD.fim && !emLetivo && (
              <div style={{ background: C.greenBg, padding: "12px 14px", borderRadius: 14, marginBottom: 14, border: "1px solid #b2f5ea" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 20 }}>✅</span>
                  <div><div style={{ fontSize: 14, fontWeight: 800, color: C.green }}>Fora do período letivo</div><div style={{ fontSize: 12, color: C.darkSoft, marginTop: 1 }}>Boa escolha! Aguarda confirmação da gestão.</div></div>
                </div>
              </div>
            )}
            {isFerias && <div style={{ background: C.tealLight, padding: "10px 12px", borderRadius: 12, fontSize: 13, color: C.tealDark, fontWeight: 600, marginBottom: 16 }}>💡 Tens <strong>{metrics.oR} dias obrigatórios</strong> por marcar</div>}
            {isFerias && metrics.diasTrab < 5 && fD.inicio && fD.fim && diasTrabPedido > 0 && (
              <div style={{ background: C.blueBg, padding: "10px 12px", borderRadius: 12, fontSize: 13, color: C.blue, fontWeight: 600, marginBottom: 16 }}>📊 Este pedido usa <strong>{diasTrabPedido} dia{diasTrabPedido !== 1 ? "s" : ""} de trabalho</strong> no CAIDI. Tens <strong>{metrics.restamCAIDI}</strong> disponíve{metrics.restamCAIDI !== 1 ? "is" : "l"}.</div>
            )}
            {esgotouCAIDI && (
              <div style={{ background: C.redBg, padding: "12px 14px", borderRadius: 14, marginBottom: 14, border: "1px solid #f5c6c0" }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: C.red }}>🔴 Dias de trabalho esgotados</div>
                <div style={{ fontSize: 12, color: C.darkSoft, marginTop: 4, lineHeight: 1.5 }}>As tuas {Number(terap["Horas Semanais"])}h semanais estão concentradas em {metrics.diasTrab} dias, por isso tens {metrics.diasFeriasCAIDI} dias de férias{metrics.diasBonusCAIDI > 0 ? " + " + metrics.diasBonusCAIDI + " bónus" : ""} no CAIDI. Já os usaste todos. Se precisares de faltar, contacta a gestão.</div>
              </div>
            )}
            {ultrapassaCAIDI && !esgotouCAIDI && (
              <div style={{ background: C.redBg, padding: "10px 12px", borderRadius: 12, fontSize: 13, color: C.red, fontWeight: 600, marginBottom: 16 }}>⚠️ Este pedido usa <strong>{diasTrabPedido} dias de trabalho</strong> mas só tens <strong>{metrics.restamCAIDI}</strong>. Ajusta as datas.</div>
            )}
            {isFerias && metrics.diasTrab < 5 && !esgotouCAIDI && !ultrapassaCAIDI && metrics.restamCAIDI > 0 && metrics.restamCAIDI <= 3 && (
              <div style={{ background: C.yellowBg, padding: "10px 12px", borderRadius: 12, fontSize: 13, color: "#E17055", fontWeight: 600, marginBottom: 16 }}>⚠️ Restam-te <strong>{metrics.restamCAIDI} dias de trabalho</strong> disponíveis no CAIDI (de {metrics.limiteCAIDI})</div>
            )}
            {type === "baixa" && <div style={{ background: C.purpleBg, padding: "10px 12px", borderRadius: 12, fontSize: 13, color: C.purple, fontWeight: 600, marginBottom: 16 }}>🏥 A baixa <strong>não desconta</strong> férias. A meta ajusta-se.</div>}
            {type === "formacao" && <div style={{ background: C.orangeBg, padding: "10px 12px", borderRadius: 12, fontSize: 13, color: C.orange, fontWeight: 600, marginBottom: 16 }}>🎓 Formações <strong>não descontam</strong> férias nem meta.</div>}
            {type === "falta" && motivo === "Falta Injustificada" && <div style={{ background: C.redBg, padding: "10px 12px", borderRadius: 12, fontSize: 13, color: C.red, fontWeight: 600, marginBottom: 16 }}>⚠️ Faltas injustificadas podem ter <strong>impacto na avaliação</strong>.</div>}
            {errMsg && <div style={{ background: C.redBg, color: C.red, padding: "8px 12px", borderRadius: 10, fontSize: 13, fontWeight: 600, marginBottom: 12 }}>⚠️ {errMsg}</div>}
            <Btn onClick={submit} disabled={sub || esgotouCAIDI || ultrapassaCAIDI} variant={btnV[type]}>{sub ? "A enviar..." : esgotouCAIDI ? "Sem dias disponíveis" : ultrapassaCAIDI ? "Dias insuficientes" : "Enviar pedido"}</Btn>
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
  const [quadIdx, setQuadIdx] = useState(null); // null = atual
  const aus = data.ausencias.filter(a => a.ID_Terapeuta === terap.ID);
  const ap = data.resumoApoios && data.resumoApoios[terap.ID] ? data.resumoApoios[terap.ID].ef : 0;
  const m = calc(terap, ap, aus, data.periodos, data.fecho, data.horarios);
  const saudePedidos = aus.filter(a => !a.Motivo.includes("Férias")).sort((a, b) => (b["Data Pedido"]||"").localeCompare(a["Data Pedido"]||""));
  const todosPedidos = [...aus].sort((a, b) => (b["Data Pedido"]||"").localeCompare(a["Data Pedido"]||""));
  const pend = aus.filter(p => p.Estado === "Pendente").length;
  const handleSubmit = (n) => { onAddAusencia(n); onRefresh(); };
  const isADM = terap["Área"] === "ADM";
  const tabs = [{ id: "inicio", icon: "🏠", l: "Início" }, ...(!isADM ? [{ id: "meta", icon: "🎯", l: "Meta" }] : []), { id: "ferias", icon: "🌴", l: "Férias" }, { id: "ausencias", icon: "📑", l: "Ausências" }, { id: "pedidos", icon: "📋", l: "Pedidos" }];
  const q = m.quad;

  // Métricas para um quadrimestre específico (para navegação)
  const calcQuad = (qx) => {
    if (!qx) return m;
    const hojeStr = new Date().toISOString().slice(0, 10);
    const hLD = Number(terap["Horas Letivas"]) / 5;
    const hSem = Number(terap["Horas Semanais"]) / 5;
    const dLetivoTotal = contarDiasUteis(qx.letivoInicio, qx.letivoFim);
    const dQuadTotal = contarDiasUteis(qx.qInicio, qx.qFim);
    const dQuadHoje = contarDiasUteis(qx.qInicio, hojeStr > qx.qFim ? qx.qFim : hojeStr);
    const dLetivoHoje = contarDiasUteis(qx.letivoInicio, hojeStr > qx.letivoFim ? qx.letivoFim : hojeStr);
    const dExtraTotal = Math.max(dQuadTotal - dLetivoTotal, 0);
    const ausQ = aus.filter(a => a.Estado === "Aprovado" && a["Data Início"] <= qx.qFim && a["Data Fim"] >= qx.qInicio);
    const dB = ausQ.filter(a => a.Motivo === "Baixa Médica").reduce((s, a) => s + Number(a["Dias Úteis"] || 0), 0);
    const mMin = Math.round(hLD * (dLetivoTotal - dB));
    const mBonus = Math.round(mMin * 0.85);
    const mE2 = Math.round(mMin * 1.05);
    const mE3 = Math.round(hSem * (dLetivoTotal - dB) * 1.05);
    const progQuad = dQuadTotal > 0 ? dQuadHoje / dQuadTotal : 1;
    const progLetivo = dLetivoTotal > 0 ? dLetivoHoje / dLetivoTotal : 1;
    const mH = Math.round(mMin * progQuad);
    const ef = ap.filter(a => a.Tipo === "Efetivado" && a.Data >= qx.qInicio && a.Data <= qx.qFim).length;
    const pH = mH > 0 ? Math.round((ef / mH) * 100) : (ef > 0 ? 100 : 0);
    const pM = mMin > 0 ? Math.round((ef / mMin) * 100) : (ef > 0 ? 100 : 0);
    const diff = ef - mH;
    const proj = dQuadHoje > 0 ? Math.round((ef / dQuadHoje) * dQuadTotal) : 0;
    const fE2 = Math.max(mE2 - ef, 0);
    const euros5 = ef > mE2 ? Math.min(ef, mE3) - mE2 : 0;
    const euros10 = ef > mE3 ? ef - mE3 : 0;
    const eurosTotal = (euros5 * 5) + (euros10 * 10);
    const sc = pH >= 95 ? C.green : pH >= 80 ? C.yellow : C.red;
    const passado = hojeStr > qx.qFim;
    return { ...m, quad: qx, ef, mMin, mBonus, mE2, mE3, mH, pH, pM, diff, proj, fE2, sc, dLetivoTotal, dQuadTotal, dQuadHoje, dLetivoHoje, dExtraTotal, progQuad: Math.round(progQuad * 100), progLetivo: Math.round(progLetivo * 100), hLD, hSem, dB, euros5, euros10, eurosTotal, passado };
  };

  const allQuads = m.quads || [];
  const currentQuadIdx = allQuads.findIndex(qx => q && qx.qInicio === q.qInicio);
  const viewIdx = quadIdx !== null ? quadIdx : currentQuadIdx;
  const viewQuad = allQuads[viewIdx] || q;
  const mq = calcQuad(viewQuad);
  const canPrev = viewIdx > 0;
  const canNext = viewIdx < allQuads.length - 1;
  const isCurrentView = viewIdx === currentQuadIdx;

  return (
    <div style={{ maxWidth: 420, margin: "0 auto", minHeight: "100vh", background: C.grayBg, fontFamily: "'DM Sans', sans-serif", position: "relative", paddingBottom: 80 }}>
      <style>{CSS}</style>
      <div style={{ background: "linear-gradient(140deg, " + C.dark + " 0%, " + C.tealDark + " 100%)", padding: "24px 20px 20px", color: C.white, borderRadius: "0 0 28px 28px", boxShadow: "0 8px 32px " + C.dark + "33", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -30, right: -30, width: 120, height: 120, borderRadius: "50%", background: C.teal + "18" }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", position: "relative" }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, opacity: 0.4, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 4 }}>CAIDI · {q ? q.label : "—"} ({q ? q.meses : ""})</div>
            <div style={{ fontSize: 20, fontWeight: 800 }}>Olá, {terap.Nome.split(" ")[0]}! 👋</div>
            <div style={{ fontSize: 12, opacity: 0.5, marginTop: 1 }}>{terap["Área"]} · {q ? q.periodo : ""}</div>
          </div>
          <button onClick={onLogout} style={{ background: "rgba(255,255,255,0.12)", border: "none", borderRadius: 12, width: 38, height: 38, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800, color: C.white, cursor: "pointer" }}>{ini(terap.Nome)}</button>
        </div>
      </div>

      <div style={{ padding: "16px 16px 0" }}>
        {/* ═══ TAB INÍCIO ═══ */}
        {tab === "inicio" && (
          <div>
            {/* Mensagem da equipa */}
            {!isADM && (() => {
              const equipaTeraps = data.terapeutas.filter(t => t["Área"] !== "ADM");
              const hojeStr = new Date().toISOString().slice(0, 10);
              const hoje = new Date();
              const equipaData = equipaTeraps.map(t => {
                const tAus = data.ausencias.filter(a => a.ID_Terapeuta === t.ID);
                const tEf = data.resumoApoios && data.resumoApoios[t.ID] ? data.resumoApoios[t.ID].ef : 0;
                const tM = calc(t, tEf, tAus, data.periodos, data.fecho, data.horarios);
                const emBaixa = tAus.some(a => a.Motivo === "Baixa Médica" && a.Estado === "Aprovado" && hojeStr >= a["Data Início"] && hojeStr <= a["Data Fim"]);
                return { ...t, m: tM, emBaixa, hLetivas: Number(t["Horas Letivas"]) || 0 };
              });
              
              const emBaixaCount = equipaData.filter(t => t.emBaixa).length;
              
              // --- SEMANAL ---
              const diaSem = hoje.getDay() || 7;
              
              // Capacidade semanal = soma horas letivas de todos os ativos (não de baixa)
              const ativos = equipaData.filter(t => !t.emBaixa && t.hLetivas > 0);
              const capSemanal = ativos.reduce((s, t) => s + t.hLetivas, 0);
              
              // Somar semanas do resumo pré-calculado no servidor
              let apoiosEstaSem = 0, apoiosSemPassada = 0;
              equipaTeraps.forEach(t => {
                const r = data.resumoApoios && data.resumoApoios[t.ID];
                if (r) { apoiosEstaSem += r.semanaAtual || 0; apoiosSemPassada += r.semanaPassada || 0; }
              });
              
              // Dias úteis já passados esta semana (para proporcionalizar)
              const diasUteisSem = Math.min(diaSem <= 5 ? diaSem : 5, 5);
              // Capacidade proporcional ao dia da semana
              const capProporcional = Math.round(capSemanal * (diasUteisSem / 5));
              
              const pctSemana = capProporcional > 0 ? Math.round((apoiosEstaSem / capProporcional) * 100) : 0;
              const gapSemana = Math.max(capProporcional - apoiosEstaSem, 0);
              const semBem = pctSemana >= 95;
              
              // Gap traduzido em crianças (1 sessão/semana por criança)
              const criancasGap = gapSemana;
              
              // Tendência
              const temPassada = apoiosSemPassada > 0;
              const tendencia = temPassada ? apoiosEstaSem - Math.round(apoiosSemPassada * (diasUteisSem / 5)) : 0;
              
              // Frases rotativas
              const dia = hoje.getDate();
              const frases = [
                { msg: "Existimos para garantir que nenhuma criança fica sem apoio por causa da condição socioeconómica da sua família. Essa é a nossa missão.", cta: "Cumpre o teu horário, prepara cada sessão, dá o teu melhor. Estas famílias contam contigo." },
                { msg: "Trabalhar no CAIDI é uma responsabilidade: muitas das nossas famílias não têm alternativa. Somos a única resposta que conhecem.", cta: "Se tens vagas por preencher, sinaliza. Há quem esteja à espera." },
                { msg: "Não escolhemos as crianças pelo que as famílias podem pagar. Escolhemos todas — porque todas merecem o melhor.", cta: "Dá a cada sessão a mesma qualidade, a cada criança a mesma atenção. É isso que nos define." },
                { msg: "Somos referência em avaliação, relatórios e intervenção. A qualidade do nosso trabalho é o que nos distingue — e não baixamos a fasquia.", cta: "Mantém os teus relatórios em dia, prepara as sessões com rigor. A excelência é um hábito, não um acaso." },
                { msg: "Formamos, avaliamos, intervimos. Cada relatório que escrevemos abre portas. Cada sessão que fazemos muda o rumo de uma família.", cta: "Não deixes sessões por fazer nem relatórios por escrever. Cada atraso é uma porta que demora a abrir." },
                { msg: "Ser bom não basta — queremos ser os melhores. Porque as crianças que nos chegam merecem o mesmo que qualquer outra.", cta: "Investe na tua formação, partilha o que aprendes, exige de ti o que exigirias para o teu filho." },
                { msg: "Cada sessão é uma criança que recebe o acompanhamento que precisa, quando precisa, independentemente de onde vem.", cta: "Uma sessão que não acontece é uma criança que espera mais uma semana. Sê pontual, sê presente." },
                { msg: "Há crianças em lista de espera. Cada vaga que preenchemos é uma família que deixa de esperar por ajuda.", cta: "Se um utente falta sistematicamente, sinaliza. Essa vaga pode mudar a vida de outra criança." },
                { msg: "O nosso trabalho vai além da terapia. Damos dignidade, damos oportunidade, damos futuro.", cta: "Trata cada família com o respeito que merece. O profissionalismo começa na forma como acolhemos." },
                { msg: "Somos uma equipa social. Quem nos procura muitas vezes não tem mais nenhum sítio onde ir. Essa confiança obriga-nos a dar o melhor todos os dias.", cta: "Se algo não está a correr bem, fala. Um problema partilhado resolve-se; um problema escondido cresce." },
                { msg: "Trabalhar aqui é um privilégio e uma responsabilidade. Cada um de nós faz parte da resposta que estas famílias precisam.", cta: "Assume o teu papel. A equipa precisa que cada um faça a sua parte com compromisso e ética." },
                { msg: "Quando damos o nosso melhor, não é por números — é porque há crianças que dependem de nós para ter as mesmas oportunidades que as outras.", cta: "Olha para a tua agenda. Estás a dar tudo o que podes? Se não, hoje é um bom dia para começar." },
              ];
              const frase = frases[dia % frases.length];

              return (
                <Card delay={0} style={{ marginBottom: 8, background: "linear-gradient(135deg, " + C.tealLight + ", " + C.white + ")", border: "1px solid " + C.tealSoft, position: "relative", overflow: "hidden" }}>
                  <div style={{ position: "absolute", top: -15, right: -15, width: 60, height: 60, borderRadius: "50%", background: C.teal + "08" }} />
                  
                  <div style={{ fontSize: 10, fontWeight: 800, color: C.tealDark, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>🤝 Equipa CAIDI</div>
                  
                  {/* Frase + CTA */}
                  <div style={{ fontSize: 13, color: C.dark, lineHeight: 1.7, fontStyle: "italic", marginBottom: 4 }}>
                    "{frase.msg}"
                  </div>
                  <div style={{ fontSize: 12, color: C.tealDark, fontWeight: 700, lineHeight: 1.6, marginBottom: 10 }}>
                    → {frase.cta}
                  </div>
                  
                  {/* Esta semana */}
                  <div style={{ background: "rgba(255,255,255,0.7)", borderRadius: 14, padding: "12px" }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: C.gray, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Esta semana ({diasUteisSem} de 5 dias)</div>
                    
                    {/* Capacidade */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <span style={{ fontSize: 11, color: C.darkSoft }}>Capacidade: {capSemanal}h diretas × 1/hora</span>
                      <span style={{ fontSize: 11, fontWeight: 800, color: C.grayLight }}>{capProporcional}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <span style={{ fontSize: 11, color: C.darkSoft }}>Realizadas</span>
                      <span style={{ fontSize: 18, fontWeight: 900, color: semBem ? C.green : C.teal }}>{apoiosEstaSem}</span>
                    </div>
                    
                    {/* Barra */}
                    <div style={{ height: 10, background: C.grayLight, borderRadius: 5, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: Math.min(pctSemana, 100) + "%", background: semBem ? C.green : "linear-gradient(90deg, " + C.teal + ", " + C.tealDark + ")", borderRadius: 5, transition: "width 1s ease" }} />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 900, color: semBem ? C.green : C.teal }}>{pctSemana}%</span>
                      {diasUteisSem < 5 && <span style={{ fontSize: 10, color: C.gray }}>faltam {5 - diasUteisSem} dias</span>}
                    </div>
                  </div>
                  
                  {/* Impacto do gap */}
                  {gapSemana > 0 && !semBem && (
                    <div style={{ marginTop: 8, padding: "8px 12px", background: C.redBg, borderRadius: 10, fontSize: 12, color: C.red, fontWeight: 600, lineHeight: 1.6 }}>
                      Só esta semana, já ficaram <strong>{gapSemana} sessões</strong> por realizar — são <strong>{criancasGap} crianças</strong> que podiam ter tido acompanhamento e não tiveram.
                    </div>
                  )}
                  {semBem && (
                    <div style={{ marginTop: 8, padding: "8px 12px", background: C.greenBg, borderRadius: 10, fontSize: 12, color: C.green, fontWeight: 700 }}>
                      ✅ A equipa está a dar resposta esta semana. Cada criança que nos procura está a ser acompanhada.
                    </div>
                  )}
                  
                  {/* Tendência */}
                  {temPassada && (
                    <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", background: "rgba(255,255,255,0.7)", borderRadius: 8 }}>
                      <span style={{ fontSize: 16 }}>{tendencia > 0 ? "📈" : tendencia < 0 ? "📉" : "➡️"}</span>
                      <div style={{ fontSize: 11, color: C.darkSoft }}>
                        <span style={{ fontWeight: 800, color: tendencia > 0 ? C.green : tendencia < 0 ? C.red : C.dark }}>
                          {tendencia > 0 ? "+" : ""}{tendencia} vs mesmo ponto da semana passada
                        </span>
                        {" "}({apoiosSemPassada} → {apoiosEstaSem})
                      </div>
                    </div>
                  )}
                  
                  {/* Baixas */}
                  {emBaixaCount > 0 && (
                    <div style={{ marginTop: 6, fontSize: 11, color: C.purple, fontWeight: 600 }}>
                      🏥 {emBaixaCount} colega{emBaixaCount > 1 ? "s" : ""} de baixa — a capacidade já está ajustada.
                    </div>
                  )}
                </Card>
              );
            })()}



            {!isADM && (
            <Card delay={0}>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <Ring value={m.ef} max={m.mMin} size={96} stroke={9} color={m.sc}>
                  <div style={{ fontSize: 22, fontWeight: 900, color: C.dark, lineHeight: 1 }}>{m.pM}%</div>
                  <div style={{ fontSize: 9, color: C.gray, fontWeight: 700, textTransform: "uppercase" }}>da meta</div>
                </Ring>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                    <div><div style={{ fontSize: 24, fontWeight: 900, color: C.dark, lineHeight: 1 }}>{m.ef}</div><div style={{ fontSize: 11, color: C.gray }}>realizados</div></div>
                    <div style={{ textAlign: "right" }}><div style={{ fontSize: 24, fontWeight: 900, color: C.grayLight, lineHeight: 1 }}>{m.mMin}</div><div style={{ fontSize: 11, color: C.gray }}>meta</div></div>
                  </div>
                  <div style={{ height: 6, background: C.grayLight, borderRadius: 3, overflow: "hidden" }}><div style={{ height: "100%", borderRadius: 3, width: Math.min(m.pM, 100) + "%", background: "linear-gradient(90deg, " + m.sc + ", " + m.sc + "cc)", transition: "width 1.2s ease" }} /></div>
                  <div style={{ fontSize: 11, color: m.sc, fontWeight: 700, marginTop: 5 }}>{m.pH >= 95 ? "🟢 Excelente!" : m.pH >= 80 ? "🟡 Atenção" : "🔴 Abaixo"} · {m.diff >= 0 ? "+" : ""}{m.diff} vs ritmo</div>
                </div>
              </div>
            </Card>
            )}

            {!isADM && (
            <Card delay={0.06} style={{ padding: "12px 14px", marginTop: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: C.darkSoft, textTransform: "uppercase", letterSpacing: 0.5 }}>⏱ Tempo do quadrimestre</span>
                <span style={{ fontSize: 12, fontWeight: 900, color: C.teal }}>{m.progQuad}%</span>
              </div>
              <div style={{ height: 8, background: C.grayLight, borderRadius: 4, overflow: "hidden" }}>
                <div style={{ height: "100%", borderRadius: 4, width: m.progQuad + "%", background: "linear-gradient(90deg, " + C.tealSoft + ", " + C.teal + ")", transition: "width 1s ease" }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: C.gray, marginTop: 4 }}>
                <span>{q ? fmtD(q.qInicio) : ""}</span>
                <span style={{ fontWeight: 700, color: C.darkSoft }}>{m.dQuadHoje}/{m.dQuadTotal} dias úteis</span>
                <span>{q ? fmtD(q.qFim) : ""}</span>
              </div>
            </Card>
            )}

            <div style={{ display: "grid", gridTemplateColumns: isADM ? "1fr 1fr 1fr" : "1fr 1fr 1fr 1fr", gap: 6, marginTop: 8 }}>
              {[{ i: "🌴", v: m.oR, l: "férias", c: m.oR <= 3 ? C.red : C.teal }, { i: "🏥", v: m.dB, l: "baixa", c: m.dB > 0 ? C.purple : C.teal }, ...(!isADM ? [{ i: "🎓", v: m.dFO, l: "form.", c: C.orange }, { i: "🎁", v: m.dBn, l: "bónus", c: C.green }] : [{ i: "📋", v: m.dFJ + m.dFI, l: "faltas", c: m.dFI > 0 ? C.red : C.blue }])].map((x, idx) => (
                <Card key={idx} delay={0.1 + idx * 0.03} style={{ padding: 10, textAlign: "center" }}>
                  <div style={{ fontSize: 8, color: C.gray, fontWeight: 700, textTransform: "uppercase" }}>{x.i}</div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: x.c, lineHeight: 1.3 }}>{x.v}</div>
                  <div style={{ fontSize: 9, color: C.gray }}>{x.l}</div>
                </Card>
              ))}
            </div>

            {m.dFI > 0 && <Card delay={0.2} style={{ marginTop: 8, background: C.redBg, border: "1px solid #f5c6c0", padding: 12 }}><div style={{ display: "flex", alignItems: "center", gap: 8 }}><span>⚠️</span><span style={{ fontSize: 13, fontWeight: 700, color: C.red }}>{m.dFI} falta{m.dFI > 1 ? "s" : ""} injustificada{m.dFI > 1 ? "s" : ""}</span></div></Card>}

            {!isADM && (
            <div style={{ marginTop: 8 }}>
              {m.ef < m.mBonus ? (
                <Card delay={0.22} style={{ background: "linear-gradient(135deg, " + C.yellowBg + ", " + C.white + ")", border: "1px solid #FDEBD0" }}><div style={{ display: "flex", alignItems: "center", gap: 10 }}><span style={{ fontSize: 28, animation: "float 3s ease infinite" }}>🎁</span><div><div style={{ fontSize: 14, fontWeight: 800, color: "#E17055" }}>Faltam-te {m.mBonus - m.ef} apoios para o dia bónus!</div><div style={{ fontSize: 12, color: C.darkSoft }}>85% da meta = +1 dia de férias</div></div></div></Card>
              ) : m.ef < m.mMin ? (
                <Card delay={0.22} style={{ background: "linear-gradient(135deg, " + C.greenBg + ", " + C.white + ")", border: "1px solid #b2f5ea" }}><div style={{ display: "flex", alignItems: "center", gap: 10 }}><span style={{ fontSize: 28, animation: "float 3s ease infinite" }}>🎁</span><div><div style={{ fontSize: 14, fontWeight: 800, color: C.green }}>Dia bónus garantido! ✅</div><div style={{ fontSize: 12, color: C.darkSoft }}>Faltam {m.mMin - m.ef} para a meta mínima</div></div></div></Card>
              ) : m.ef < m.mE2 ? (
                <Card delay={0.22} style={{ background: "linear-gradient(135deg, " + C.tealLight + ", " + C.white + ")", border: "1px solid " + C.tealSoft }}><div style={{ display: "flex", alignItems: "center", gap: 10 }}><span style={{ fontSize: 28, animation: "float 3s ease infinite" }}>🎯</span><div><div style={{ fontSize: 14, fontWeight: 800, color: C.tealDark }}>Meta cumprida! Faltam {m.mE2 - m.ef} para os 5€/apoio</div><div style={{ fontSize: 12, color: C.darkSoft }}>Cada apoio extra a partir daí = 5€</div></div></div></Card>
              ) : m.ef < m.mE3 ? (
                <Card delay={0.22} style={{ background: "linear-gradient(135deg, " + C.greenBg + ", " + C.white + ")", border: "1px solid #b2f5ea" }}><div style={{ display: "flex", alignItems: "center", gap: 10 }}><span style={{ fontSize: 28, animation: "float 3s ease infinite" }}>💰</span><div><div style={{ fontSize: 14, fontWeight: 800, color: C.green }}>A ganhar 5€/apoio! Já tens +{m.eurosTotal}€</div><div style={{ fontSize: 12, color: C.darkSoft }}>Faltam {m.mE3 - m.ef} para os 10€/apoio</div></div></div></Card>
              ) : (
                <Card delay={0.22} style={{ background: "linear-gradient(135deg, #FFF9E6, " + C.white + ")", border: "1px solid #FDEBD0" }}><div style={{ display: "flex", alignItems: "center", gap: 10 }}><span style={{ fontSize: 28, animation: "float 3s ease infinite" }}>💎</span><div><div style={{ fontSize: 14, fontWeight: 800, color: "#E17055" }}>A ganhar 10€/apoio! Já tens +{m.eurosTotal}€</div><div style={{ fontSize: 12, color: C.darkSoft }}>Máximo atingido — continua!</div></div></div></Card>
              )}
            </div>
            )}

            {pend > 0 && <Card delay={0.28} style={{ marginTop: 8, background: C.yellowBg, border: "1px solid #FDEBD0" }}><div style={{ display: "flex", alignItems: "center", gap: 8 }}><span>⏳</span><span style={{ fontSize: 13, fontWeight: 700, color: C.red, flex: 1 }}>{pend} pendente{pend > 1 ? "s" : ""}</span><button onClick={() => setTab("pedidos")} style={{ background: C.red + "15", border: "none", borderRadius: 8, padding: "5px 10px", fontSize: 11, fontWeight: 700, color: C.red, cursor: "pointer" }}>Ver →</button></div></Card>}
          </div>
        )}

        {/* ═══ TAB META ═══ */}
        {tab === "meta" && !isADM && (
          <div>
            {/* Navegação quadrimestres */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <button onClick={() => canPrev && setQuadIdx(viewIdx - 1)} disabled={!canPrev} style={{ background: canPrev ? C.tealLight : C.grayBg, border: "none", borderRadius: 10, width: 36, height: 36, fontSize: 16, cursor: canPrev ? "pointer" : "default", color: canPrev ? C.teal : C.grayLight, fontWeight: 800 }}>←</button>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 16, fontWeight: 900, color: C.dark }}>{viewQuad ? viewQuad.label : "—"}</div>
                <div style={{ fontSize: 12, color: C.darkSoft }}>{viewQuad ? viewQuad.meses : ""}{isCurrentView ? "" : ""}</div>
                {!isCurrentView && <span style={{ fontSize: 10, fontWeight: 700, color: mq.passado ? C.gray : C.blue, background: mq.passado ? C.grayBg : C.blueBg, padding: "2px 8px", borderRadius: 6 }}>{mq.passado ? "Encerrado" : "Futuro"}</span>}
                {isCurrentView && <span style={{ fontSize: 10, fontWeight: 700, color: C.teal, background: C.tealLight, padding: "2px 8px", borderRadius: 6 }}>Atual</span>}
              </div>
              <button onClick={() => canNext && setQuadIdx(viewIdx + 1)} disabled={!canNext} style={{ background: canNext ? C.tealLight : C.grayBg, border: "none", borderRadius: 10, width: 36, height: 36, fontSize: 16, cursor: canNext ? "pointer" : "default", color: canNext ? C.teal : C.grayLight, fontWeight: 800 }}>→</button>
            </div>

            {/* Explicação letivo vs quadrimestre */}
            <Card delay={0} style={{ background: "linear-gradient(135deg, " + C.tealLight + ", " + C.white + ")", border: "1px solid " + C.tealSoft }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.teal, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>💡 Como funciona</div>
              <div style={{ fontSize: 13, color: C.darkSoft, lineHeight: 1.7 }}>
                A tua meta é calculada com base nos <strong>{mq.dLetivoTotal} dias do período letivo</strong> ({viewQuad ? viewQuad.periodo : "—"}). É nestes dias que deves, idealmente, cumprir os apoios.
              </div>
              <div style={{ fontSize: 13, color: C.darkSoft, lineHeight: 1.7, marginTop: 6 }}>
                Mas tens <strong>o quadrimestre inteiro</strong> ({mq.dQuadTotal} dias úteis) para os atingir. Os <strong>{mq.dExtraTotal} dias extra</strong> fora do letivo são a tua margem — para recuperar ou ultrapassar a meta.
              </div>
            </Card>

            {/* Barra visual dupla: letivo + margem */}
            <Card delay={0.08} style={{ marginTop: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.darkSoft, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>📊 Tempo e meta</div>
              
              {/* Barra de tempo */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: C.darkSoft, marginBottom: 4 }}>
                  <span>⏱ Tempo</span>
                  <span style={{ fontWeight: 800, color: C.dark }}>{mq.dQuadHoje} / {mq.dQuadTotal} dias</span>
                </div>
                <div style={{ height: 12, background: C.grayLight, borderRadius: 6, overflow: "hidden", position: "relative" }}>
                  {/* Zona letiva */}
                  <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: (mq.dQuadTotal > 0 ? (mq.dLetivoTotal / mq.dQuadTotal) * 100 : 0) + "%", background: C.tealLight, borderRadius: 6 }} />
                  {/* Progresso atual */}
                  <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: mq.progQuad + "%", background: C.teal, borderRadius: 6, transition: "width 1s ease" }} />
                  {/* Separador letivo/extra */}
                  {mq.dExtraTotal > 0 && <div style={{ position: "absolute", left: (mq.dQuadTotal > 0 ? (mq.dLetivoTotal / mq.dQuadTotal) * 100 : 0) + "%", top: 0, height: "100%", width: 2, background: C.white, zIndex: 2 }} />}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, marginTop: 3 }}>
                  <span style={{ color: C.teal, fontWeight: 700 }}>Letivo ({mq.dLetivoTotal}d)</span>
                  {mq.dExtraTotal > 0 && <span style={{ color: C.gray, fontWeight: 600 }}>Margem extra ({mq.dExtraTotal}d)</span>}
                </div>
              </div>

              {/* Barra de apoios */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: C.darkSoft, marginBottom: 4 }}>
                  <span>🎯 Apoios</span>
                  <span style={{ fontWeight: 800, color: C.dark }}>{mq.ef} / {mq.mMin}</span>
                </div>
                <div style={{ height: 12, background: C.grayLight, borderRadius: 6, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: Math.min(mq.pM, 100) + "%", background: "linear-gradient(90deg, " + mq.sc + ", " + mq.sc + "cc)", borderRadius: 6, transition: "width 1s ease" }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, marginTop: 3 }}>
                  <span style={{ color: mq.sc, fontWeight: 700 }}>{mq.pM}% da meta</span>
                  <span style={{ color: C.gray }}>+5%: {mq.mE2}</span>
                </div>
              </div>
            </Card>

            {/* Números de progresso */}
            <Card delay={0.12} style={{ marginTop: 8 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, textAlign: "center" }}>
                <div style={{ padding: 10, background: C.grayBg, borderRadius: 12 }}>
                  <div style={{ fontSize: 10, color: C.gray, fontWeight: 700, textTransform: "uppercase" }}>Feitos</div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: C.dark }}>{mq.ef}</div>
                </div>
                <div style={{ padding: 10, background: mq.diff >= 0 ? C.greenBg : C.redBg, borderRadius: 12 }}>
                  <div style={{ fontSize: 10, color: C.gray, fontWeight: 700, textTransform: "uppercase" }}>{mq.passado ? "Meta" : "Esperado"}</div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: mq.diff >= 0 ? C.green : C.red }}>{mq.passado ? mq.mMin : mq.mH}</div>
                </div>
                <div style={{ padding: 10, background: C.tealLight, borderRadius: 12 }}>
                  <div style={{ fontSize: 10, color: C.gray, fontWeight: 700, textTransform: "uppercase" }}>Meta total</div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: C.teal }}>{mq.mMin}</div>
                </div>
              </div>
              <div style={{ marginTop: 10, padding: "8px 12px", borderRadius: 10, background: mq.diff >= 0 ? C.greenBg : C.yellowBg, textAlign: "center" }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: mq.diff >= 0 ? C.green : C.red }}>
                  {mq.passado ? (mq.ef >= mq.mMin ? "✅ Meta atingida!" : "❌ Meta não atingida") : (mq.diff >= 0 ? "🟢 +" + mq.diff + " à frente do ritmo" : "🔴 " + Math.abs(mq.diff) + " abaixo do ritmo")}
                </span>
                {!mq.passado && mq.proj > 0 && <div style={{ fontSize: 12, color: C.darkSoft, marginTop: 2 }}>📈 Projeção: ~{mq.proj} apoios até ao fim</div>}
              </div>
            </Card>

            {/* Detalhe do cálculo */}
            <Card delay={0.16} style={{ marginTop: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.darkSoft, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>📐 Detalhe do cálculo</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {[
                  ["Período letivo", viewQuad ? viewQuad.periodo : "—"],
                  ["Datas letivas", (viewQuad ? fmtD(viewQuad.letivoInicio) : "") + " → " + (viewQuad ? fmtD(viewQuad.letivoFim) : "")],
                  ["Dias úteis letivos", mq.dLetivoTotal + " dias"],
                  ["Quadrimestre", (viewQuad ? fmtD(viewQuad.qInicio) : "") + " → " + (viewQuad ? fmtD(viewQuad.qFim) : "")],
                  ["Dias úteis quadrimestre", mq.dQuadTotal + " dias"],
                  ["Dias extra (margem)", mq.dExtraTotal + " dias"],
                  ["Horas letivas / dia", mq.hLD.toFixed(1) + "h"],
                ].map(([label, val], i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 10px", background: i % 2 === 0 ? C.grayBg : C.white, borderRadius: 8 }}>
                    <span style={{ fontSize: 12, color: C.darkSoft }}>{label}</span>
                    <span style={{ fontSize: 13, fontWeight: 800, color: C.dark }}>{val}</span>
                  </div>
                ))}
                {mq.dB > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 10px", background: C.purpleBg, borderRadius: 8 }}>
                    <span style={{ fontSize: 12, color: C.purple }}>🏥 Baixa (descontada)</span>
                    <span style={{ fontSize: 13, fontWeight: 800, color: C.purple }}>−{mq.dB} dias</span>
                  </div>
                )}
              </div>
              <div style={{ marginTop: 10, padding: "8px 12px", background: C.white, borderRadius: 10, border: "2px solid " + C.teal, textAlign: "center" }}>
                <div style={{ fontSize: 11, color: C.gray, fontWeight: 700 }}>META = ({mq.dLetivoTotal}{mq.dB > 0 ? " − " + mq.dB : ""}) × {mq.hLD.toFixed(1)}h</div>
                <div style={{ fontSize: 28, fontWeight: 900, color: C.teal }}>{mq.mMin}</div>
              </div>
            </Card>

            {/* Análise semanal de produtividade */}
            <Card delay={0.17} style={{ marginTop: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.darkSoft, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>📊 O teu ritmo real</div>
              {(() => {
                const hLetivas = Number(terap["Horas Letivas"]);
                const hSemanais = Number(terap["Horas Semanais"]);
                const hIndiretas = hSemanais - hLetivas;
                // Usar dias LETIVOS decorridos (descontando baixa) — não dias do quadrimestre
                const diasLetivosTrab = Math.max((mq.dLetivoHoje || mq.dQuadHoje) - mq.dB, 1);
                const semanasLetivas = Math.max(Math.floor(mq.dLetivoTotal / 5), 1);
                const semanasDecorridas = Math.max(Math.round(diasLetivosTrab / 5 * 10) / 10, 0.2);
                const apoiosSemana = Math.round((mq.ef / semanasDecorridas) * 10) / 10;
                const metaSemanal = Math.round(hLetivas * 10) / 10; // 1 apoio/hora × horas letivas
                // Apoios por hora = total apoios / horas letivas realmente trabalhadas
                const horasLetivasTrabalhadas = Math.round(diasLetivosTrab * (hLetivas / 5));
                const apoiosPorHora = horasLetivasTrabalhadas > 0 ? Math.round((mq.ef / horasLetivasTrabalhadas) * 100) / 100 : 0;
                const menosDeUmPorHora = apoiosPorHora < 1;
                // Quanto tempo direto fica sem apoios registados
                const horasDiretasPorSemana = apoiosSemana; // ~1 apoio = ~1 hora
                const tempoLivre = Math.max(hLetivas - horasDiretasPorSemana, 0);

                return (
                  <div>
                    {/* Dois indicadores principais */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
                      <div style={{ padding: 12, background: menosDeUmPorHora ? C.redBg : C.greenBg, borderRadius: 14, textAlign: "center" }}>
                        <div style={{ fontSize: 9, color: C.gray, fontWeight: 700, textTransform: "uppercase" }}>Média semanal</div>
                        <div style={{ fontSize: 28, fontWeight: 900, color: menosDeUmPorHora ? C.red : C.green, lineHeight: 1.2 }}>{apoiosSemana}</div>
                        <div style={{ fontSize: 10, color: C.darkSoft }}>apoios / semana</div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: C.gray, marginTop: 2 }}>objetivo: {metaSemanal}</div>
                      </div>
                      <div style={{ padding: 12, background: menosDeUmPorHora ? C.redBg : C.greenBg, borderRadius: 14, textAlign: "center" }}>
                        <div style={{ fontSize: 9, color: C.gray, fontWeight: 700, textTransform: "uppercase" }}>Rendimento</div>
                        <div style={{ fontSize: 28, fontWeight: 900, color: menosDeUmPorHora ? C.red : C.green, lineHeight: 1.2 }}>{apoiosPorHora}</div>
                        <div style={{ fontSize: 10, color: C.darkSoft }}>apoios / hora direta</div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: C.gray, marginTop: 2 }}>mínimo: 1.0</div>
                      </div>
                    </div>

                    {/* Explicação clara */}
                    <div style={{ padding: "10px 12px", background: C.grayBg, borderRadius: 10, marginBottom: 10 }}>
                      <div style={{ fontSize: 12, color: C.darkSoft, lineHeight: 1.6 }}>
                        O teu contrato tem <strong>{hSemanais}h semanais</strong>: {hLetivas}h de trabalho direto (apoios, avaliações, reuniões) e {hIndiretas}h de trabalho indireto (relatórios, preparação).
                      </div>
                      <div style={{ fontSize: 12, color: C.darkSoft, lineHeight: 1.6, marginTop: 4 }}>
                        Em <strong>{hLetivas}h diretas</strong>, o esperado é pelo menos <strong>1 apoio por hora</strong> — ou seja, ~{metaSemanal} apoios por semana.
                      </div>
                    </div>

                    {/* Barra: como usas as tuas horas */}
                    <div style={{ fontSize: 11, fontWeight: 700, color: C.darkSoft, marginBottom: 4 }}>As tuas {hSemanais}h por semana:</div>
                    <div style={{ height: 28, borderRadius: 8, overflow: "hidden", display: "flex", marginBottom: 4 }}>
                      <div style={{ width: Math.min(horasDiretasPorSemana / hSemanais * 100, hLetivas / hSemanais * 100) + "%", background: C.teal, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: C.white, fontWeight: 800 }}>{horasDiretasPorSemana}h usadas</div>
                      {tempoLivre > 0 && <div style={{ width: (tempoLivre / hSemanais * 100) + "%", background: C.yellow, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: C.dark, fontWeight: 800 }}>{Math.round(tempoLivre * 10)/10}h ?</div>}
                      <div style={{ flex: 1, background: C.gray, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: C.white, fontWeight: 800 }}>{hIndiretas}h indiretas</div>
                    </div>
                    <div style={{ display: "flex", gap: 10, marginBottom: 10, fontSize: 10 }}>
                      <span style={{ color: C.teal, fontWeight: 700 }}>■ Apoios realizados</span>
                      {tempoLivre > 0 && <span style={{ color: "#d4a017", fontWeight: 700 }}>■ Diretas sem apoios</span>}
                      <span style={{ color: C.gray, fontWeight: 700 }}>■ Indiretas</span>
                    </div>

                    {/* Números detalhados */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                      {[
                        ["Total de apoios feitos", mq.ef, C.dark],
                        ["Semanas decorridas", semanasDecorridas, C.dark],
                        ["Horas diretas disponíveis", horasLetivasTrabalhadas + "h (" + semanasDecorridas + " × " + hLetivas + "h)", C.teal],
                        ["Apoios por hora direta", apoiosPorHora, menosDeUmPorHora ? C.red : C.green],
                      ].map(([label, val, color], i) => (
                        <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "5px 10px", background: i % 2 === 0 ? C.grayBg : C.white, borderRadius: 8 }}>
                          <span style={{ fontSize: 12, color: C.darkSoft }}>{label}</span>
                          <span style={{ fontSize: 13, fontWeight: 800, color }}>{val}</span>
                        </div>
                      ))}
                    </div>

                    {/* Mensagem */}
                    {menosDeUmPorHora ? (
                      <div style={{ marginTop: 10 }}>
                        {/* Situação */}
                        <div style={{ padding: "14px", background: C.redBg, borderRadius: "14px 14px 0 0", border: "1px solid #f5c6c0", borderBottom: "none" }}>
                          <div style={{ fontSize: 15, fontWeight: 900, color: C.red, marginBottom: 8 }}>{terap.Nome.split(" ")[0]}, estás abaixo de 1 apoio por hora.</div>
                          <div style={{ fontSize: 13, color: C.dark, lineHeight: 1.7 }}>
                            Nas últimas <strong>{semanasDecorridas} semanas</strong> tiveste <strong>{horasLetivasTrabalhadas}h de tempo direto disponível</strong> e realizaste <strong>{mq.ef} apoios</strong>. Isso dá uma média de <strong>{apoiosPorHora} apoios por cada hora direta</strong>.
                          </div>
                          <div style={{ fontSize: 13, color: C.dark, lineHeight: 1.7, marginTop: 6 }}>
                            Sabemos que nem sempre depende só de ti — utentes faltam, horários ficam com buracos, há semanas mais difíceis. Mas <strong>1 apoio por hora não é uma meta ambiciosa: é o mínimo</strong> para que o CAIDI funcione de forma sustentável. É a base do que precisamos, não o teto.
                          </div>
                        </div>
                        {/* Equipa */}
                        <div style={{ padding: "14px", background: C.yellowBg, border: "1px solid #FDEBD0", borderBottom: "none" }}>
                          <div style={{ fontSize: 13, fontWeight: 800, color: C.dark, marginBottom: 8 }}>🤝 O CAIDI somos todos, {terap.Nome.split(" ")[0]}</div>
                          <div style={{ fontSize: 12, color: C.darkSoft, lineHeight: 1.7 }}>
                            O teu trabalho sustenta o trabalho dos outros — e o dos outros sustenta o teu. Quando alguém fica abaixo, os recursos apertam, a organização ressente-se e são os utentes que acabam prejudicados. <strong>Quando um elemento da equipa falha, todos sentimos.</strong>
                          </div>
                          <div style={{ fontSize: 12, color: C.darkSoft, lineHeight: 1.7, marginTop: 6 }}>
                            Por isso precisamos que sejas transparente connosco. Se tens dificuldades — utentes que faltam sempre, agenda com buracos, casos que não avançam, o que quer que seja — <strong>tens de nos dizer</strong>. Não guardes o problema para ti. Pedir ajuda não é fraqueza, é responsabilidade. Quanto mais cedo soubermos, mais depressa encontramos solução juntos.
                          </div>
                        </div>
                        {/* Ações */}
                        <div style={{ padding: "14px", background: C.white, borderRadius: "0 0 14px 14px", border: "1px solid " + C.grayLight }}>
                          <div style={{ fontSize: 12, fontWeight: 800, color: C.dark, marginBottom: 8 }}>📋 O que podes fazer já:</div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            {[
                              { icon: "📢", text: "Tens horários por preencher? Avisa a coordenação — há lista de espera e podemos encaminhar novos utentes para ti. Agenda vazia não beneficia ninguém." },
                              { icon: "🔍", text: "Utentes que faltam sempre? Sinaliza esses casos. Uma vaga ocupada por quem não aparece é uma vaga que faz falta a quem precisa de verdade." },
                              { icon: "💬", text: "Algo não está a correr bem e não sabes como resolver? Fala com a coordenação. Estamos cá para ajudar, mas só podemos fazê-lo se soubermos o que se passa." },
                              { icon: "⏰", text: "Não deixes arrastar. Cada semana que passa abaixo do mínimo é mais difícil de recuperar — e a equipa inteira sente o peso." },
                            ].map((a, i) => (
                              <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                                <span style={{ fontSize: 15, flexShrink: 0 }}>{a.icon}</span>
                                <span style={{ fontSize: 12, color: C.darkSoft, lineHeight: 1.6 }}>{a.text}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div style={{ marginTop: 10 }}>
                        {(() => {
                          const nome = terap.Nome.split(" ")[0];
                          const acimaMeta = mq.ef >= mq.mMin;
                          const acimaE2 = mq.ef >= mq.mE2;
                          const acimaE3 = mq.ef >= mq.mE3;
                          const pct = mq.mMin > 0 ? Math.round((mq.ef / mq.mMin) * 100) : 100;
                          
                          // Badges conquistados
                          const badges = [];
                          if (acimaE3) badges.push({ icon: "💎", label: "Top Performer", desc: "Acima do escalão máximo!" });
                          else if (acimaE2) badges.push({ icon: "💰", label: "Escalão 2", desc: "5€ por apoio extra" });
                          if (acimaMeta && mq.ef >= mq.mBonus) badges.push({ icon: "🎁", label: "Dia bónus garantido", desc: "+1 dia de férias" });
                          if (apoiosPorHora >= 1.2) badges.push({ icon: "⚡", label: "Alta eficiência", desc: apoiosPorHora + " apoios/hora" });

                          return (
                            <div>
                              {/* Mensagem principal */}
                              <div style={{ padding: "14px", background: acimaE2 ? "linear-gradient(135deg, #FFF9E6, " + C.greenBg + ")" : C.greenBg, borderRadius: badges.length > 0 ? "14px 14px 0 0" : 14, border: "1px solid " + (acimaE2 ? "#FDEBD0" : "#b2f5ea"), borderBottom: badges.length > 0 ? "none" : undefined }}>
                                <div style={{ fontSize: 15, fontWeight: 900, color: acimaE3 ? "#E17055" : acimaE2 ? "#d4a017" : C.green }}>
                                  {acimaE3 ? "💎" : acimaE2 ? "⭐" : "✅"} {nome}, {acimaE3 ? "estás a dar o exemplo!" : acimaE2 ? "estás acima da meta!" : "estás a cumprir!"} 
                                </div>
                                <div style={{ fontSize: 13, color: C.dark, marginTop: 6, lineHeight: 1.7 }}>
                                  <strong>{apoiosPorHora} apoios por hora</strong> e <strong>{apoiosSemana} por semana</strong> — {pct}% da meta. {acimaE3 ? "O teu esforço é notável e faz toda a diferença. A equipa agradece o teu compromisso — é este o espírito que queremos para o CAIDI." : acimaE2 ? "Estás a ir além do esperado e a equipa beneficia disso. Cada apoio extra conta — para ti e para todos." : "O teu trabalho faz diferença para toda a equipa. É assim que o CAIDI funciona bem — continua com este ritmo!"}
                                </div>
                                {mq.eurosTotal > 0 && (
                                  <div style={{ marginTop: 8, padding: "6px 10px", background: "rgba(255,255,255,0.7)", borderRadius: 8, display: "inline-block" }}>
                                    <span style={{ fontSize: 12, fontWeight: 800, color: "#E17055" }}>💶 +{mq.eurosTotal}€ acumulados este quadrimestre</span>
                                  </div>
                                )}
                              </div>
                              {/* Badges */}
                              {badges.length > 0 && (
                                <div style={{ padding: "10px 14px", background: C.white, borderRadius: "0 0 14px 14px", border: "1px solid " + C.grayLight, display: "flex", flexWrap: "wrap", gap: 6 }}>
                                  {badges.map((b, i) => (
                                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, background: C.grayBg, borderRadius: 10, padding: "5px 10px" }}>
                                      <span style={{ fontSize: 16 }}>{b.icon}</span>
                                      <div>
                                        <div style={{ fontSize: 11, fontWeight: 800, color: C.dark }}>{b.label}</div>
                                        <div style={{ fontSize: 9, color: C.darkSoft }}>{b.desc}</div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                );
              })()}
            </Card>

            {/* Objetivos */}
            <Card delay={0.2} style={{ marginTop: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.darkSoft, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>⭐ Objetivos</div>
              {[
                { l: "Dia bónus de férias", desc: "85% da meta", v: mq.mBonus, icon: "🎁", active: mq.ef >= mq.mBonus, color: C.green },
                { l: "Meta mínima", desc: "100%", v: mq.mMin, icon: "🎯", active: mq.ef >= mq.mMin, color: C.teal },
                { l: "5€ por apoio extra", desc: "Meta + 5%", v: mq.mE2, icon: "💰", active: mq.ef >= mq.mE2, color: C.green },
                { l: "10€ por apoio extra", desc: "H. semanais + 5%", v: mq.mE3, icon: "💎", active: mq.ef >= mq.mE3, color: "#E17055" },
              ].map((e, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 10, marginBottom: 4, background: e.active ? C.greenBg : C.grayBg, border: "1px solid " + (e.active ? "#b2f5ea" : C.grayLight) }}>
                  <span style={{ fontSize: 18 }}>{e.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: e.active ? C.green : C.dark }}>{e.l}</div>
                    <div style={{ fontSize: 11, color: C.darkSoft }}>{e.v} apoios <span style={{ color: C.gray }}>({e.desc})</span></div>
                  </div>
                  <span style={{ fontSize: e.active ? 16 : 12, fontWeight: 700, color: e.active ? C.green : C.red }}>{e.active ? "✅" : Math.max(e.v - mq.ef, 0) + " faltam"}</span>
                </div>
              ))}
              {mq.eurosTotal > 0 && (
                <div style={{ marginTop: 8, padding: "10px 12px", borderRadius: 10, background: "linear-gradient(135deg, #FFF9E6, " + C.white + ")", border: "1px solid #FDEBD0", textAlign: "center" }}>
                  <div style={{ fontSize: 11, color: C.gray, fontWeight: 700 }}>💶 Valor acumulado este quadrimestre</div>
                  <div style={{ fontSize: 28, fontWeight: 900, color: "#E17055" }}>+{mq.eurosTotal}€</div>
                  <div style={{ fontSize: 11, color: C.darkSoft }}>{mq.euros5 > 0 ? mq.euros5 + " apoios × 5€" : ""}{mq.euros5 > 0 && mq.euros10 > 0 ? " + " : ""}{mq.euros10 > 0 ? mq.euros10 + " apoios × 10€" : ""}</div>
                </div>
              )}
            </Card>
          </div>
        )}

        {/* ═══ TAB FÉRIAS ═══ */}
        {tab === "ferias" && (
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 900, color: C.dark, margin: "0 0 12px" }}>As tuas férias</h2>
            <Card delay={0}>
              {[{ l: "🌴 Obrigatórias", u: m.fU, t: terap["Dias Férias"], r: m.oR, c: C.teal, f: m.tF }, { l: "🎁 Bónus", u: m.bU, t: m.dBn, r: m.bR, c: C.green }].map((f, i) => (
                <div key={i} style={{ marginBottom: i === 0 ? 16 : 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}><span style={{ fontSize: 14, fontWeight: 700, color: C.dark }}>{f.l}</span><span style={{ fontSize: 14, fontWeight: 800, color: f.c }}>{f.u}/{f.t}</span></div>
                  <div style={{ height: 10, background: C.grayLight, borderRadius: 6, overflow: "hidden", display: "flex" }}>{f.f > 0 && <div style={{ width: (f.t > 0 ? (f.f / f.t) * 100 : 0) + "%", background: C.gray, height: "100%" }} />}<div style={{ width: (f.t > 0 ? ((f.u - (f.f||0)) / f.t) * 100 : 0) + "%", background: f.c, height: "100%" }} /></div>
                  <div style={{ fontSize: 10, color: C.darkSoft, marginTop: 4 }}>{f.f ? "⬛ Fecho (" + f.f + "d) · " : ""}<span style={{ fontWeight: 700, color: C.green }}>Restam {f.r}d</span>{i === 1 && m.oR > 0 && <span style={{ color: C.red }}> · ⚠️ só após os 22</span>}</div>
                </div>
              ))}
            </Card>
            {m.diasTrab < 5 && (() => {
              const hPorDia = Math.round(Number(terap["Horas Semanais"]) / 5 * 10) / 10;
              const diasLivres = 5 - m.diasTrab;
              return (
              <Card delay={0.05} style={{ marginTop: 8, background: "linear-gradient(135deg, " + C.blueBg + ", " + C.white + ")", border: "1px solid #b8d4e3" }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: C.blue, marginBottom: 6 }}>📋 Férias e horário</div>
                <div style={{ fontSize: 14, color: C.darkSoft, lineHeight: 1.7 }}>
                  O teu contrato é de <strong>{Number(terap["Horas Semanais"])}h semanais</strong>. Normalmente, estas horas seriam distribuídas pelos 5 dias úteis ({hPorDia}h por dia) e trabalhavas todos os dias. O CAIDI permite-te concentrar essas horas em apenas <strong>{m.diasTrab} dias</strong> — ou seja, já tens <strong>{diasLivres} dia{diasLivres > 1 ? "s" : ""} livre{diasLivres > 1 ? "s" : ""} por semana</strong> sem precisar de usar férias.
                </div>
                <div style={{ fontSize: 14, color: C.darkSoft, lineHeight: 1.7, marginTop: 8 }}>
                  Se as tuas horas estivessem distribuídas por 5 dias, os 22 dias de férias cobriam todos os dias da semana. Mas como trabalhas {m.diasTrab} dias, marcar férias num dia em que não estás no CAIDI não faz sentido — já é um dia livre.
                </div>
                <div style={{ fontSize: 14, color: C.darkSoft, lineHeight: 1.7, marginTop: 8 }}>
                  Por isso, dos 22 dias, <strong>{m.diasFeriasCAIDI} correspondem a dias em que efetivamente trabalhas</strong> no CAIDI.{m.diasBonusCAIDI > 0 ? <span> Com os <strong>{m.diasBonusCAIDI} dias bónus</strong> ganhos, tens <strong>{m.limiteCAIDI} dias</strong> no total.</span> : " São esses os dias que podes usar."}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12, padding: "10px 4px", borderTop: "1px solid #d4e6f1" }}>
                  <div style={{ textAlign: "center" }}><div style={{ fontSize: 18, fontWeight: 900, color: C.gray }}>{m.fechoCAIDI}</div><div style={{ fontSize: 9, color: C.gray }}>Fecho</div></div>
                  <div style={{ textAlign: "center" }}><div style={{ fontSize: 18, fontWeight: 900, color: C.blue }}>{m.feriasCAIDI}</div><div style={{ fontSize: 9, color: C.gray }}>Marcados</div></div>
                  <div style={{ textAlign: "center" }}><div style={{ fontSize: 18, fontWeight: 900, color: m.restamCAIDI <= 2 ? C.red : C.green }}>{m.restamCAIDI}</div><div style={{ fontSize: 9, color: C.gray }}>Disponíveis</div></div>
                  <div style={{ textAlign: "center" }}><div style={{ fontSize: 18, fontWeight: 900, color: C.tealDark }}>{m.limiteCAIDI}</div><div style={{ fontSize: 9, color: C.gray }}>Total{m.diasBonusCAIDI > 0 ? " (+" + m.diasBonusCAIDI + " bónus)" : ""}</div></div>
                </div>
                {m.restamCAIDI <= 2 && m.restamCAIDI > 0 && <div style={{ fontSize: 11, color: C.red, fontWeight: 700, marginTop: 6 }}>⚠️ Tens poucos dias de trabalho disponíveis.</div>}
                {m.restamCAIDI <= 0 && <div style={{ fontSize: 11, color: C.red, fontWeight: 700, marginTop: 6 }}>🔴 Já usaste todos os dias de trabalho. Se precisares de faltar, contacta a gestão.</div>}
              </Card>
              );
            })()}
            <div style={{ marginTop: 12 }}><Btn onClick={() => setShowForm("ferias")}>📝 Pedir Férias</Btn></div>
            <h3 style={{ fontSize: 14, fontWeight: 800, color: C.dark, margin: "16px 0 8px" }}>📅 Fecho do CAIDI</h3>
            <Card delay={0.1} style={{ padding: 0, overflow: "hidden" }}>{data.fecho.map((f, i) => (<div key={i} style={{ padding: "10px 14px", borderBottom: i < data.fecho.length - 1 ? "1px solid " + C.grayLight : "none", display: "flex", justifyContent: "space-between", fontSize: 13, background: i % 2 ? C.white : C.grayBg }}><div><span style={{ fontWeight: 700, color: C.dark }}>{f.Nome}</span><br/><span style={{ fontSize: 11, color: C.gray }}>{fmtDF(f["Data Início"])}{f["Data Início"] !== f["Data Fim"] ? " → " + fmtDF(f["Data Fim"]) : ""}</span></div><span style={{ fontSize: 11, fontWeight: 800, color: C.darkSoft, background: C.grayLight, padding: "3px 8px", borderRadius: 6 }}>{f["Dias Úteis"]}d</span></div>))}</Card>
            <h3 style={{ fontSize: 14, fontWeight: 800, color: C.dark, margin: "14px 0 8px" }}>🏫 Períodos letivos</h3>
            {data.periodos.map((p, i) => (<Card key={i} delay={0.15} style={{ padding: "10px 14px", marginBottom: 6, border: "1px solid " + C.redBg }}><div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}><div><span style={{ fontWeight: 800, color: C.red }}>{p["Período"]}</span><span style={{ color: C.gray, marginLeft: 8, fontSize: 10 }}>{fmtDF(p["Início"])} → {fmtDF(p.Fim)}</span></div><span style={{ fontSize: 9, background: C.redBg, color: C.red, padding: "3px 6px", borderRadius: 4, fontWeight: 800 }}>🔒</span></div></Card>))}
          </div>
        )}

        {/* ═══ TAB SAÚDE ═══ */}
        {tab === "ausencias" && (
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 900, color: C.dark, margin: "0 0 12px" }}>Ausências</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 6, marginBottom: 12 }}>
              {[{ i: "🏥", v: m.dB, l: "Baixa", c: C.purple }, { i: "📋", v: m.dFJ, l: "F.Just.", c: C.blue }, { i: "⚠️", v: m.dFI, l: "F.Inj.", c: m.dFI > 0 ? C.red : C.teal }, { i: "🎓", v: m.dFO, l: "Form.", c: C.orange }].map((x, idx) => (
                <Card key={idx} delay={idx * 0.05} style={{ padding: 10, textAlign: "center" }}><div style={{ fontSize: 9, color: C.gray, fontWeight: 700, textTransform: "uppercase" }}>{x.i}</div><div style={{ fontSize: 22, fontWeight: 900, color: x.c, lineHeight: 1.3 }}>{x.v}</div><div style={{ fontSize: 9, color: C.gray }}>{x.l}</div></Card>
              ))}
            </div>
            <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
              <Btn onClick={() => setShowForm("baixa")} variant="purple" style={{ flex: 1, padding: 10, fontSize: 11 }}>🏥 Baixa</Btn>
              <Btn onClick={() => setShowForm("falta")} variant="secondary" style={{ flex: 1, padding: 10, fontSize: 11 }}>📋 Falta</Btn>
              <Btn onClick={() => setShowForm("formacao")} variant="secondary" style={{ flex: 1, padding: 10, fontSize: 11 }}>🎓 Formação</Btn>
            </div>
            <h3 style={{ fontSize: 14, fontWeight: 800, color: C.dark, margin: "0 0 8px" }}>Histórico</h3>
            {saudePedidos.length === 0 ? (
              <Card><div style={{ textAlign: "center", padding: 16, color: C.gray }}><div style={{ fontSize: 32 }}>🎉</div><div style={{ fontSize: 14, marginTop: 6 }}>Nada a registar</div></div></Card>
            ) : saudePedidos.map((p, i) => { const mi = motivoInfo(p.Motivo); const e = EST[p.Estado] || EST.Pendente; return (
              <Card key={i} delay={i * 0.04} style={{ marginBottom: 8, borderLeft: "4px solid " + mi.color, borderRadius: "4px 20px 20px 4px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div><div style={{ fontSize: 14, fontWeight: 800, color: C.dark }}>{mi.icon} {mi.label}</div><div style={{ fontSize: 12, color: C.darkSoft, marginTop: 2 }}>{fmtD(p["Data Início"])}{p["Data Início"] !== p["Data Fim"] ? " → " + fmtD(p["Data Fim"]) : ""} · {fmtDias(p["Dias Úteis"], p["Período"])}</div></div>
                  <span style={{ background: e.bg, color: e.c, padding: "3px 9px", borderRadius: 8, fontSize: 11, fontWeight: 700 }}>{e.icon} {e.l}</span>
                </div>
                {p.Observações && <div style={{ fontSize: 12, color: C.darkSoft, fontStyle: "italic", marginTop: 4 }}>"{p.Observações}"</div>}
                {p["Resposta Gestão"] && <div style={{ fontSize: 12, marginTop: 4, padding: "6px 10px", borderRadius: 8, background: p.Estado === "Rejeitado" ? C.redBg : C.greenBg, color: p.Estado === "Rejeitado" ? C.red : C.green, fontWeight: 600 }}>💬 Gestão: {p["Resposta Gestão"]}</div>}
                <FileBadge url={p.Ficheiro} />
              </Card>
            ); })}
          </div>
        )}

        {/* ═══ TAB PEDIDOS ═══ */}
        {tab === "pedidos" && (
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 900, color: C.dark, margin: "0 0 12px" }}>Todos os pedidos</h2>
            {todosPedidos.length === 0 ? <Card><div style={{ textAlign: "center", padding: 20, color: C.gray }}><div style={{ fontSize: 36 }}>📋</div><div style={{ fontSize: 14, marginTop: 6 }}>Sem pedidos</div></div></Card>
            : todosPedidos.map((p, i) => { const mi = motivoInfo(p.Motivo); const e = EST[p.Estado] || EST.Pendente; return (
              <Card key={i} delay={i * 0.03} style={{ marginBottom: 8, borderLeft: "4px solid " + mi.color, borderRadius: "4px 20px 20px 4px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div><div style={{ fontSize: 14, fontWeight: 800, color: C.dark }}>{fmtD(p["Data Início"])}{p["Data Início"] !== p["Data Fim"] ? " → " + fmtD(p["Data Fim"]) : ""}</div><div style={{ fontSize: 11, color: C.darkSoft, marginTop: 2 }}>{mi.icon} {mi.short} · {fmtDias(p["Dias Úteis"], p["Período"])}</div></div>
                  <span style={{ background: e.bg, color: e.c, padding: "3px 9px", borderRadius: 8, fontSize: 11, fontWeight: 700 }}>{e.icon} {e.l}</span>
                </div>
                {p.Observações && <div style={{ fontSize: 12, color: C.darkSoft, fontStyle: "italic", marginTop: 4 }}>"{p.Observações}"</div>}
                {p["Resposta Gestão"] && <div style={{ fontSize: 12, marginTop: 4, padding: "6px 10px", borderRadius: 8, background: p.Estado === "Rejeitado" ? C.redBg : C.greenBg, color: p.Estado === "Rejeitado" ? C.red : C.green, fontWeight: 600 }}>💬 Gestão: {p["Resposta Gestão"]}</div>}
                <FileBadge url={p.Ficheiro} />
              </Card>
            ); })}
          </div>
        )}
      </div>

      {showForm && <AbsenceForm type={showForm} terap={terap} metrics={m} periodos={data.periodos} onSubmit={handleSubmit} onClose={() => setShowForm(null)} />}

      <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 420, background: C.white, borderTop: "1px solid " + C.grayLight, display: "flex", justifyContent: "space-around", padding: "6px 0 12px", boxShadow: "0 -4px 20px rgba(0,0,0,0.04)" }}>
        {tabs.map(tb => (
          <button key={tb.id} onClick={() => setTab(tb.id)} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 1, color: tab === tb.id ? C.teal : C.gray, padding: "2px 6px", transition: "all 0.2s" }}>
            <span style={{ fontSize: 18, transform: tab === tb.id ? "scale(1.15)" : "scale(1)", transition: "transform 0.2s" }}>{tb.icon}</span>
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
  const [filtro, setFiltro] = useState("todos");
  const [obsGestao, setObsGestao] = useState({});
  const [adminTab, setAdminTab] = useState("semana");
  const [semanaOffset, setSemanaOffset] = useState(0);
  const [mesOffset, setMesOffset] = useState(0);
  const [searchTer, setSearchTer] = useState("");
  const [adminQuadIdx, setAdminQuadIdx] = useState(null);

  // Form registar falta
  const [faltaTer, setFaltaTer] = useState("");
  const [faltaInicio, setFaltaInicio] = useState("");
  const [faltaFim, setFaltaFim] = useState("");
  const [faltaMotivo, setFaltaMotivo] = useState("Falta Injustificada");
  const [faltaNota, setFaltaNota] = useState("");
  const [faltaPeriodo, setFaltaPeriodo] = useState("dia");
  const [faltaSub, setFaltaSub] = useState(false);
  const [faltaDone, setFaltaDone] = useState(false);

  const handle = async (ln, est) => {
    setUpd(ln);
    const obs = obsGestao[ln] || "";
    try { await apiPost({ action: est === "Aprovado" ? "aprovarPedido" : "rejeitarPedido", linha: ln, observacao: obs }); onUpdateEstado(ln, est, obs); } catch (err) { alert("Erro: " + err.message); }
    setUpd(null); onRefresh();
  };

  const submitFalta = async () => {
    if (!faltaTer || !faltaInicio || !faltaFim) return;
    setFaltaSub(true);
    const t = data.terapeutas.find(x => x.ID === faltaTer);
    const mesmoDiaF = faltaInicio === faltaFim;
    const periodoLabel = mesmoDiaF && faltaPeriodo !== "dia" ? (faltaPeriodo === "manha" ? " (Manhã)" : " (Tarde)") : "";
    try {
      await apiPost({ action: "registarFaltaGestao", terapId: faltaTer, nome: t ? t.Nome : "", dataInicio: faltaInicio, dataFim: faltaFim, motivo: faltaMotivo, nota: (faltaNota || "Registado pela gestão") + periodoLabel, periodo: mesmoDiaF ? faltaPeriodo : "dia" });
      setFaltaDone(true);
      setTimeout(() => { setFaltaDone(false); setFaltaTer(""); setFaltaInicio(""); setFaltaFim(""); setFaltaNota(""); setFaltaMotivo("Falta Injustificada"); setFaltaPeriodo("dia"); }, 1500);
      onRefresh();
    } catch (err) { alert("Erro: " + err.message); }
    setFaltaSub(false);
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

  // ── Vista semanal ──
  const hoje = new Date();
  const seg = new Date(hoje); seg.setDate(hoje.getDate() - ((hoje.getDay() + 6) % 7) + semanaOffset * 7);
  const semDias = Array.from({ length: 5 }, (_, i) => { const d = new Date(seg); d.setDate(seg.getDate() + i); return d; });
  const semStr = semDias.map(d => d.toISOString().slice(0, 10));
  const semLabel = fmtD(semStr[0]) + " → " + fmtD(semStr[4]);
  const nomeDia = ["Seg", "Ter", "Qua", "Qui", "Sex"];

  const ausAprov = data.ausencias.filter(a => a.Estado === "Aprovado" || a.Estado === "Pendente");
  function terapAusenteDia(tId, diaStr) {
    return ausAprov.find(a => a.ID_Terapeuta === tId && a["Data Início"] <= diaStr && a["Data Fim"] >= diaStr);
  }

  // Fecho CAIDI também conta como ausência
  function fechoDia(diaStr) {
    return data.fecho.find(f => f["Data Início"] <= diaStr && f["Data Fim"] >= diaStr);
  }

  // Verificar se um dia está em período letivo
  function isLetivo(diaStr) {
    return data.periodos.some(p => diaStr >= p["Início"] && diaStr <= p.Fim);
  }

  // ── Vista mensal ──
  const mesBase = new Date();
  mesBase.setMonth(mesBase.getMonth() + mesOffset);
  const mesAno = mesBase.getFullYear();
  const mesNum = mesBase.getMonth();
  const mesNomes = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  const primDiaMes = new Date(mesAno, mesNum, 1);
  const ultDiaMes = new Date(mesAno, mesNum + 1, 0);
  const diasMes = [];
  for (let d = 1; d <= ultDiaMes.getDate(); d++) {
    const dt = new Date(mesAno, mesNum, d);
    const dow = dt.getDay();
    if (dow !== 0 && dow !== 6) diasMes.push(dt);
  }
  const diasMesStr = diasMes.map(d => d.toISOString().slice(0, 10));

  const adminTabs = [
    { id: "semana", icon: "📅", l: "Semana" },
    { id: "mes", icon: "🗓️", l: "Mês" },
    { id: "equipa", icon: "👥", l: "Equipa" },
    { id: "pendentes", icon: "⏳", l: "Pedidos", badge: pend.length },
    { id: "falta", icon: "⚠️", l: "Reg. Falta" },
    { id: "historico", icon: "📋", l: "Histórico" },
  ];

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", minHeight: "100vh", background: C.grayBg, fontFamily: "'DM Sans', sans-serif", position: "relative", paddingBottom: 80 }}>
      <style>{CSS}</style>
      <div style={{ background: "linear-gradient(140deg, " + C.dark + " 0%, #3d4f51 100%)", padding: "24px 20px 20px", color: C.white, borderRadius: "0 0 28px 28px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -20, right: -20, width: 100, height: 100, borderRadius: "50%", background: C.teal + "12" }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", position: "relative" }}>
          <div><div style={{ fontSize: 10, fontWeight: 700, opacity: 0.4, letterSpacing: 1.5, textTransform: "uppercase" }}>CAIDI · Gestão</div><div style={{ fontSize: 20, fontWeight: 900 }}>Painel de Gestão 📊</div></div>
          <button onClick={onLogout} style={{ background: "rgba(255,255,255,0.1)", border: "none", borderRadius: 10, padding: "7px 14px", color: C.white, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Sair</button>
        </div>
      </div>

      <div style={{ padding: "16px 16px 0" }}>

        {/* ═══ TAB SEMANA ═══ */}
        {adminTab === "semana" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <button onClick={() => setSemanaOffset(o => o - 1)} style={{ background: C.white, border: "1px solid " + C.grayLight, borderRadius: 10, width: 36, height: 36, fontSize: 16, cursor: "pointer", color: C.dark }}>‹</button>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 15, fontWeight: 900, color: C.dark }}>📅 {semLabel}</div>
                <div style={{ fontSize: 11, color: C.darkSoft }}>{semanaOffset === 0 ? "Esta semana" : semanaOffset === 1 ? "Próxima semana" : semanaOffset === -1 ? "Semana passada" : ""}</div>
              </div>
              <button onClick={() => setSemanaOffset(o => o + 1)} style={{ background: C.white, border: "1px solid " + C.grayLight, borderRadius: 10, width: 36, height: 36, fontSize: 16, cursor: "pointer", color: C.dark }}>›</button>
            </div>

            {(() => {
              const hojeStr = hoje.toISOString().slice(0, 10);
              const ausHoje = data.terapeutas.filter(t => terapAusenteDia(t.ID, hojeStr) || fechoDia(hojeStr));
              const hojeDow = hoje.getDay();
              const terapHoje = data.terapeutas.filter(t => { const h = getHorario(data.horarios, t.ID); return trabalhaDia(h, hojeDow); });
              const presHoje = terapHoje.filter(t => !terapAusenteDia(t.ID, hojeStr) && !fechoDia(hojeStr)).length;
              return (
                <Card delay={0} style={{ marginBottom: 10, background: "linear-gradient(135deg, " + C.tealLight + ", " + C.white + ")", border: "1px solid " + C.tealSoft }}>
                  <div style={{ display: "flex", justifyContent: "space-around", textAlign: "center" }}>
                    <div><div style={{ fontSize: 24, fontWeight: 900, color: C.green }}>{presHoje}</div><div style={{ fontSize: 10, color: C.darkSoft, fontWeight: 700, textTransform: "uppercase" }}>A trabalhar hoje</div></div>
                    <div style={{ width: 1, background: C.grayLight }} />
                    <div><div style={{ fontSize: 24, fontWeight: 900, color: ausHoje.length > 0 ? C.red : C.gray }}>{ausHoje.length}</div><div style={{ fontSize: 10, color: C.darkSoft, fontWeight: 700, textTransform: "uppercase" }}>Ausentes hoje</div></div>
                  </div>
                </Card>
              );
            })()}

            <Card delay={0.05} style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr " + "40px ".repeat(5), background: C.grayBg, borderBottom: "1px solid " + C.grayLight }}>
                <div style={{ padding: "8px 10px", fontSize: 11, fontWeight: 800, color: C.darkSoft }}>Terapeuta</div>
                {semDias.map((d, i) => {
                  const isHoje = d.toISOString().slice(0, 10) === hoje.toISOString().slice(0, 10);
                  const dStr = d.toISOString().slice(0, 10);
                  const letivo = isLetivo(dStr);
                  return <div key={i} style={{ padding: "8px 2px", fontSize: 10, fontWeight: 800, color: isHoje ? C.teal : C.gray, textAlign: "center", background: letivo ? "#FFF0F3" : "#F0FFF4" }}>{nomeDia[i]}<br/><span style={{ fontSize: 12, fontWeight: 900 }}>{d.getDate()}</span></div>;
                })}
              </div>
              {data.terapeutas.map((t, ti) => (
                <div key={t.ID} style={{ display: "grid", gridTemplateColumns: "1fr " + "40px ".repeat(5), borderBottom: ti < data.terapeutas.length - 1 ? "1px solid " + C.grayLight : "none" }}>
                  <div style={{ padding: "6px 10px", fontSize: 12, fontWeight: 600, color: C.dark, display: "flex", alignItems: "center", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis", background: ti % 2 === 0 ? C.white : C.grayBg }}>{t.Nome.split(" ")[0]} {(t.Nome.split(" ").pop() || "")}</div>
                  {semStr.map((dStr, di) => {
                    const letivo = isLetivo(dStr);
                    const bgCol = letivo ? "#FFF0F3" : "#F0FFF4";
                    const fecho = fechoDia(dStr);
                    if (fecho) return <div key={di} style={{ display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: C.gray, background: bgCol }} title={"Fecho: " + fecho.Nome}>🔒</div>;
                    const tHor = getHorario(data.horarios, t.ID);
                    const dObj = new Date(dStr);
                    if (tHor && !trabalhaDia(tHor, dObj.getDay())) return <div key={di} style={{ display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: C.grayLight, fontWeight: 700, background: bgCol }} title="Sem horário">—</div>;
                    const aus = terapAusenteDia(t.ID, dStr);
                    if (aus) {
                      const isBonusF = aus.Motivo === "Férias (Bónus)";
                      const icon = isBonusF ? "🎁" : motivoInfo(aus.Motivo).icon;
                      const label = isBonusF ? "Férias bónus" : motivoInfo(aus.Motivo).label;
                      return <div key={di} style={{ display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, background: bgCol }} title={label + (aus.Estado === "Pendente" ? " (pendente)" : "")}><span style={{ opacity: aus.Estado === "Pendente" ? 0.5 : 1 }}>{icon}</span></div>;
                    }
                    return <div key={di} style={{ display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: C.green, background: bgCol }}>✓</div>;
                  })}
                </div>
              ))}
            </Card>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8, padding: "0 4px" }}>
              {[{ i: "✓", l: "Trabalha", c: C.green }, { i: "—", l: "S/horário", c: C.gray }, { i: "🔒", l: "Fecho", c: C.gray }, { i: "🌴", l: "Férias", c: C.teal }, { i: "🎁", l: "F. bónus", c: C.green }, { i: "🏥", l: "Baixa", c: C.purple }, { i: "📋", l: "Falta", c: C.blue }, { i: "⚠️", l: "F.Inj.", c: C.red }, { i: "🎓", l: "Form.", c: C.orange }].map((x, i) => (
                <span key={i} style={{ fontSize: 10, color: C.darkSoft, fontWeight: 600 }}>{x.i} {x.l}</span>
              ))}
            </div>
            <div style={{ display: "flex", gap: 12, marginTop: 4, padding: "0 4px" }}>
              <span style={{ fontSize: 10, color: C.darkSoft, fontWeight: 600 }}><span style={{ display: "inline-block", width: 12, height: 12, borderRadius: 3, background: "#FFF0F3", border: "1px solid #f5c6c0", verticalAlign: "middle", marginRight: 3 }} /> Letivo</span>
              <span style={{ fontSize: 10, color: C.darkSoft, fontWeight: 600 }}><span style={{ display: "inline-block", width: 12, height: 12, borderRadius: 3, background: "#F0FFF4", border: "1px solid #b2f5ea", verticalAlign: "middle", marginRight: 3 }} /> Não letivo</span>
              <span style={{ fontSize: 10, color: C.gray, fontWeight: 600, fontStyle: "italic" }}>· semi-transparente = pendente</span>
            </div>
          </div>
        )}

        {/* ═══ TAB MÊS ═══ */}
        {adminTab === "mes" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <button onClick={() => setMesOffset(o => o - 1)} style={{ background: C.white, border: "1px solid " + C.grayLight, borderRadius: 10, width: 36, height: 36, fontSize: 16, cursor: "pointer", color: C.dark }}>‹</button>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 15, fontWeight: 900, color: C.dark }}>🗓️ {mesNomes[mesNum]} {mesAno}</div>
                <div style={{ fontSize: 11, color: C.darkSoft }}>{diasMes.length} dias úteis</div>
              </div>
              <button onClick={() => setMesOffset(o => o + 1)} style={{ background: C.white, border: "1px solid " + C.grayLight, borderRadius: 10, width: 36, height: 36, fontSize: 16, cursor: "pointer", color: C.dark }}>›</button>
            </div>

            <Card delay={0} style={{ padding: 0, overflow: "auto" }}>
              <div style={{ minWidth: diasMes.length * 28 + 120 }}>
                {/* Header com dias */}
                <div style={{ display: "flex", borderBottom: "1px solid " + C.grayLight, position: "sticky", top: 0, background: C.white, zIndex: 2 }}>
                  <div style={{ minWidth: 120, maxWidth: 120, padding: "6px 8px", fontSize: 11, fontWeight: 800, color: C.darkSoft, borderRight: "1px solid " + C.grayLight }}>Terapeuta</div>
                  {diasMes.map((d, i) => {
                    const dStr = diasMesStr[i];
                    const letivo = isLetivo(dStr);
                    const isHoje = dStr === hoje.toISOString().slice(0, 10);
                    return <div key={i} style={{ minWidth: 28, maxWidth: 28, padding: "4px 0", fontSize: 9, fontWeight: 700, color: isHoje ? C.teal : C.gray, textAlign: "center", background: letivo ? "#FFF0F3" : "#F0FFF4", borderBottom: isHoje ? "2px solid " + C.teal : "none" }}>
                      <div>{nomeDia[(d.getDay() + 6) % 7]?.charAt(0)}</div>
                      <div style={{ fontSize: 10, fontWeight: 900 }}>{d.getDate()}</div>
                    </div>;
                  })}
                </div>
                {/* Linhas de terapeutas */}
                {data.terapeutas.map((t, ti) => (
                  <div key={t.ID} style={{ display: "flex", borderBottom: ti < data.terapeutas.length - 1 ? "1px solid " + C.grayLight : "none" }}>
                    <div style={{ minWidth: 120, maxWidth: 120, padding: "4px 8px", fontSize: 11, fontWeight: 600, color: C.dark, display: "flex", alignItems: "center", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis", background: ti % 2 === 0 ? C.white : C.grayBg, borderRight: "1px solid " + C.grayLight }}>{t.Nome.split(" ")[0]} {(t.Nome.split(" ").pop() || "").charAt(0)}.</div>
                    {diasMesStr.map((dStr, di) => {
                      const letivo = isLetivo(dStr);
                      const bgCol = letivo ? "#FFF0F3" : "#F0FFF4";
                      const fecho = fechoDia(dStr);
                      if (fecho) return <div key={di} style={{ minWidth: 28, maxWidth: 28, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: C.gray, background: bgCol }}>🔒</div>;
                      const tHor = getHorario(data.horarios, t.ID);
                      const dObj = new Date(dStr);
                      if (tHor && !trabalhaDia(tHor, dObj.getDay())) return <div key={di} style={{ minWidth: 28, maxWidth: 28, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: C.grayLight, background: bgCol }}>—</div>;
                      const aus = terapAusenteDia(t.ID, dStr);
                      if (aus) {
                        const isBonusF = aus.Motivo === "Férias (Bónus)";
                        const icon = isBonusF ? "🎁" : motivoInfo(aus.Motivo).icon;
                        return <div key={di} style={{ minWidth: 28, maxWidth: 28, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, background: bgCol }} title={(isBonusF ? "Férias bónus" : motivoInfo(aus.Motivo).label) + (aus.Estado === "Pendente" ? " (pendente)" : "")}><span style={{ opacity: aus.Estado === "Pendente" ? 0.5 : 1 }}>{icon}</span></div>;
                      }
                      return <div key={di} style={{ minWidth: 28, maxWidth: 28, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: C.green, background: bgCol }}>✓</div>;
                    })}
                  </div>
                ))}
              </div>
            </Card>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8, padding: "0 4px" }}>
              {[{ i: "✓", l: "Trabalha" }, { i: "—", l: "S/horário" }, { i: "🔒", l: "Fecho" }, { i: "🌴", l: "Férias" }, { i: "🎁", l: "F. bónus" }, { i: "🏥", l: "Baixa" }, { i: "📋", l: "Falta" }, { i: "⚠️", l: "F.Inj." }, { i: "🎓", l: "Form." }].map((x, i) => (
                <span key={i} style={{ fontSize: 10, color: C.darkSoft, fontWeight: 600 }}>{x.i} {x.l}</span>
              ))}
            </div>
            <div style={{ display: "flex", gap: 12, marginTop: 4, padding: "0 4px" }}>
              <span style={{ fontSize: 10, color: C.darkSoft, fontWeight: 600 }}><span style={{ display: "inline-block", width: 12, height: 12, borderRadius: 3, background: "#FFF0F3", border: "1px solid #f5c6c0", verticalAlign: "middle", marginRight: 3 }} /> Letivo</span>
              <span style={{ fontSize: 10, color: C.darkSoft, fontWeight: 600 }}><span style={{ display: "inline-block", width: 12, height: 12, borderRadius: 3, background: "#F0FFF4", border: "1px solid #b2f5ea", verticalAlign: "middle", marginRight: 3 }} /> Não letivo</span>
            </div>
          </div>
        )}

        {/* ═══ TAB EQUIPA ═══ */}
        {adminTab === "equipa" && (() => {
          const allQuads = buildQuadrimestres(data.periodos);
          const hojeStr = new Date().toISOString().slice(0, 10);
          const curIdx = allQuads.findIndex(q => hojeStr >= q.qInicio && hojeStr <= q.qFim);
          const currentIdx = curIdx >= 0 ? curIdx : allQuads.length - 1;
          const vIdx = adminQuadIdx !== null ? adminQuadIdx : currentIdx;
          const vQuad = allQuads[vIdx] || null;
          const isCurrent = vIdx === currentIdx;
          const canP = vIdx > 0;
          const canN = vIdx < allQuads.length - 1;
          const isPassado = vQuad && hojeStr > vQuad.qFim;

          // Calc metrics for a specific quad
          const calcQ = (t, qx) => {
            const aus2 = data.ausencias.filter(a => a.ID_Terapeuta === t.ID);
            const ap2 = data.resumoApoios && data.resumoApoios[t.ID] ? data.resumoApoios[t.ID].ef : 0;
            if (!qx) return calc(t, ap2, aus2, data.periodos, data.fecho, data.horarios);
            const hLD = Number(t["Horas Letivas"]) / 5;
            const hSem = Number(t["Horas Semanais"]) / 5;
            const dLT = contarDiasUteis(qx.letivoInicio, qx.letivoFim);
            const dQT = contarDiasUteis(qx.qInicio, qx.qFim);
            const dQH = contarDiasUteis(qx.qInicio, hojeStr > qx.qFim ? qx.qFim : hojeStr);
            const ausQ = aus2.filter(a => a.Estado === "Aprovado" && a["Data Início"] <= qx.qFim && a["Data Fim"] >= qx.qInicio);
            const dB = ausQ.filter(a => a.Motivo === "Baixa Médica").reduce((s, a) => s + Number(a["Dias Úteis"] || 0), 0);
            const mMin = Math.round(hLD * (dLT - dB));
            const mBonus = Math.round(mMin * 0.85);
            const mE2 = Math.round(mMin * 1.05);
            const mE3 = Math.round(hSem * (dLT - dB) * 1.05);
            const progQ = dQT > 0 ? dQH / dQT : 1;
            const mH = Math.round(mMin * progQ);
            const ef = ap2.filter(a => a.Tipo === "Efetivado" && a.Data >= qx.qInicio && a.Data <= qx.qFim).length;
            const pH = mH > 0 ? Math.round((ef / mH) * 100) : (ef > 0 ? 100 : 0);
            const pM = mMin > 0 ? Math.round((ef / mMin) * 100) : (ef > 0 ? 100 : 0);
            const euros5 = ef > mE2 ? Math.min(ef, mE3) - mE2 : 0;
            const euros10 = ef > mE3 ? ef - mE3 : 0;
            const eurosTotal = (euros5 * 5) + (euros10 * 10);
            const sc = pH >= 95 ? C.green : pH >= 80 ? C.yellow : C.red;
            const mBase = calc(t, ap2, aus2, data.periodos, data.fecho, data.horarios);
            return { ...mBase, ef, mMin, mBonus, mE2, mE3, mH, pH, pM, sc, eurosTotal, dB, quad: qx, passado: hojeStr > qx.qFim };
          };

          return (
          <div>
            {/* Navegação quadrimestres */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <button onClick={() => canP && setAdminQuadIdx(vIdx - 1)} disabled={!canP} style={{ background: canP ? C.tealLight : C.grayBg, border: "none", borderRadius: 10, width: 36, height: 36, fontSize: 16, cursor: canP ? "pointer" : "default", color: canP ? C.teal : C.grayLight, fontWeight: 800 }}>←</button>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 16, fontWeight: 900, color: C.dark }}>{vQuad ? vQuad.label : "—"}</div>
                <div style={{ fontSize: 12, color: C.darkSoft }}>{vQuad ? vQuad.meses : ""}</div>
                {isCurrent && <span style={{ fontSize: 10, fontWeight: 700, color: C.teal, background: C.tealLight, padding: "2px 8px", borderRadius: 6 }}>Atual</span>}
                {!isCurrent && <span style={{ fontSize: 10, fontWeight: 700, color: isPassado ? C.gray : C.blue, background: isPassado ? C.grayBg : C.blueBg, padding: "2px 8px", borderRadius: 6 }}>{isPassado ? "Encerrado" : "Futuro"}</span>}
              </div>
              <button onClick={() => canN && setAdminQuadIdx(vIdx + 1)} disabled={!canN} style={{ background: canN ? C.tealLight : C.grayBg, border: "none", borderRadius: 10, width: 36, height: 36, fontSize: 16, cursor: canN ? "pointer" : "default", color: canN ? C.teal : C.grayLight, fontWeight: 800 }}>→</button>
            </div>

            {/* Ranking - Top 3 */}
            {(() => {
              const ranked = data.terapeutas
                .filter(t => t["Área"] !== "ADM")
                .map(t => ({ ...t, m: calcQ(t, vQuad) }))
                .filter(t => t.m.mMin > 0)
                .sort((a, b) => b.m.pM - a.m.pM);
              const top3 = ranked.slice(0, 3);
              const podiumOrder = top3.length >= 3 ? [top3[1], top3[0], top3[2]] : top3;
              const podiumHeights = top3.length >= 3 ? [64, 80, 52] : (top3.length === 2 ? [64, 80] : [80]);
              const medals = ["🥈", "🥇", "🥉"];
              const podiumMedals = top3.length >= 3 ? [medals[1], medals[0], medals[2]] : (top3.length === 2 ? [medals[1], medals[0]] : [medals[0]]);
              if (top3.length === 0) return null;
              return (
                <Card delay={0} style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.darkSoft, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>🏆 Ranking</div>
                  <div style={{ display: "flex", justifyContent: "center", alignItems: "flex-end", gap: 8, marginBottom: 6 }}>
                    {podiumOrder.map((t, i) => {
                      const isFirst = (top3.length >= 3 ? i === 1 : i === (top3.length - top3.length));
                      return (
                        <div key={t.ID} style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1 }}>
                          <div style={{ fontSize: isFirst ? 24 : 18, marginBottom: 4 }}>{podiumMedals[i]}</div>
                          <div style={{ width: 40, height: 40, borderRadius: 12, background: isFirst ? C.teal : C.grayLight, color: isFirst ? C.white : C.darkSoft, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 900 }}>{ini(t.Nome)}</div>
                          <div style={{ fontSize: 11, fontWeight: 800, color: C.dark, marginTop: 4, textAlign: "center" }}>{t.Nome.split(" ")[0]}</div>
                          <div style={{ fontSize: 18, fontWeight: 900, color: t.m.sc, lineHeight: 1 }}>{t.m.pM}%</div>
                          <div style={{ fontSize: 9, color: C.darkSoft }}>{t.m.ef}/{t.m.mMin}</div>
                          <div style={{ width: "100%", height: podiumHeights[i], background: isFirst ? "linear-gradient(180deg, " + C.teal + ", " + C.tealDark + ")" : C.grayLight, borderRadius: "8px 8px 0 0", marginTop: 6, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            {t.m.eurosTotal > 0 && <span style={{ fontSize: 10, fontWeight: 800, color: isFirst ? C.white : C.darkSoft }}>💶{t.m.eurosTotal}€</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {/* Alertas - quem está abaixo */}
                  {ranked.filter(t => t.m.pH < 80 && t.m.dB === 0).length > 0 && (
                    <div style={{ marginTop: 8, padding: "8px 10px", background: C.redBg, borderRadius: 10 }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: C.red, marginBottom: 4 }}>🚨 Abaixo do mínimo (sem baixa):</div>
                      {ranked.filter(t => t.m.pH < 80 && t.m.dB === 0).map(t => (
                        <div key={t.ID} style={{ fontSize: 11, color: C.red, fontWeight: 600 }}>• {t.Nome} — {t.m.pM}% ({t.m.ef}/{t.m.mMin})</div>
                      ))}
                    </div>
                  )}
                </Card>
              );
            })()}

            {data.terapeutas.map((t, idx) => {
              const m2 = calcQ(t, vQuad);
              const tIsADM = t["Área"] === "ADM";
              return (
                <Card key={t.ID} delay={idx * 0.05} style={{ marginBottom: 8, display: "flex", alignItems: "center", gap: 12 }}>
                  {!tIsADM ? (
                    <Ring value={m2.ef} max={m2.mMin} size={48} stroke={5} color={m2.sc}><span style={{ fontSize: 12, fontWeight: 900, color: m2.sc }}>{m2.pM}%</span></Ring>
                  ) : (
                    <div style={{ width: 48, height: 48, borderRadius: 14, background: C.blueBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>🏢</div>
                  )}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 14, fontWeight: 800, color: C.dark }}>{t.Nome}</span>
                      {!tIsADM && <span>{m2.passado ? (m2.ef >= m2.mMin ? "✅" : "❌") : (m2.pH >= 95 ? "🟢" : m2.pH >= 80 ? "🟡" : "🔴")}</span>}
                      {tIsADM && <span style={{ fontSize: 10, fontWeight: 700, color: C.blue, background: C.blueBg, padding: "2px 6px", borderRadius: 6 }}>ADM</span>}
                    </div>
                    <div style={{ fontSize: 11, color: C.darkSoft }}>{!tIsADM ? m2.ef + "/" + m2.mMin + " · " : ""}{t["Área"]}</div>
                    {!tIsADM && <div style={{ height: 4, background: C.grayLight, borderRadius: 2, marginTop: 4, overflow: "hidden" }}><div style={{ height: "100%", width: Math.min(m2.pM, 100) + "%", background: m2.sc, borderRadius: 2 }} /></div>}
                    {!tIsADM && m2.eurosTotal > 0 && <div style={{ fontSize: 10, color: "#E17055", fontWeight: 700, marginTop: 3 }}>💶 +{m2.eurosTotal}€</div>}
                    {!tIsADM && m2.ef >= m2.mE3 && <div style={{ fontSize: 10, color: "#E17055", fontWeight: 800, marginTop: 2 }}>💎 Top Performer</div>}
                    {!tIsADM && m2.ef >= m2.mE2 && m2.ef < m2.mE3 && <div style={{ fontSize: 10, color: "#d4a017", fontWeight: 700, marginTop: 2 }}>⭐ Escalão 2</div>}
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0, fontSize: 10 }}>
                    {m2.diasTrab < 5 && <div title={m2.diasTrab + " dias/sem → " + m2.limiteCAIDI + " dias CAIDI"}>📋 <span style={{ fontWeight: 800, color: m2.restamCAIDI <= 2 ? C.red : C.blue }}>{m2.restamCAIDI}</span><span style={{ color: C.gray }}>/{m2.limiteCAIDI}</span></div>}
                    <div>🌴 <span style={{ fontWeight: 800, color: m2.oR <= 3 ? C.red : C.teal }}>{m2.oR}</span></div>
                    {m2.dB > 0 && <div>🏥 <span style={{ fontWeight: 800, color: C.purple }}>{m2.dB}d</span></div>}
                    {m2.dFI > 0 && <div>⚠️ <span style={{ fontWeight: 800, color: C.red }}>{m2.dFI}</span></div>}
                    {!tIsADM && m2.ef >= m2.mBonus && m2.ef < m2.mMin && <div>🎁 <span style={{ fontWeight: 800, color: C.green }}>bónus</span></div>}
                  </div>
                </Card>
              );
            })}
          </div>
          );
        })()}

        {/* ═══ TAB PENDENTES ═══ */}
        {adminTab === "pendentes" && (
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 900, color: C.dark, margin: "0 0 10px" }}>Pedidos pendentes {pend.length > 0 && <span style={{ background: C.redBg, color: C.red, padding: "2px 8px", borderRadius: 8, fontSize: 13, fontWeight: 800, marginLeft: 8 }}>{pend.length}</span>}</h2>
            {pend.length === 0 ? (
              <Card style={{ background: C.greenBg, border: "1px solid #b2f5ea" }}><div style={{ textAlign: "center", fontSize: 14, fontWeight: 700, color: C.green }}>✓ Sem pedidos pendentes!</div></Card>
            ) : pend.map((p, i) => { const t = data.terapeutas.find(x => x.ID === p.ID_Terapeuta); const mi = motivoInfo(p.Motivo); const isLetivo = p["Em Letivo?"] === "Sim" || (p.Observações && p.Observações.indexOf("⚠️ LETIVO") >= 0); const m2t = t ? calc(t, data.resumoApoios && data.resumoApoios[t.ID] ? data.resumoApoios[t.ID].ef : 0, data.ausencias.filter(a => a.ID_Terapeuta === t.ID), data.periodos, data.fecho, data.horarios) : null; return (
              <Card key={i} delay={i * 0.05} style={{ marginBottom: 8, borderLeft: "4px solid " + mi.color, borderRadius: "4px 20px 20px 4px" }}>
                <div style={{ marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: C.dark }}>{t ? t.Nome : p.ID_Terapeuta}</div>
                    <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                      {isLetivo && <span style={{ background: C.redBg, color: C.red, padding: "3px 8px", borderRadius: 6, fontSize: 10, fontWeight: 800 }}>🔴 LETIVO</span>}
                      <span style={{ background: mi.color + "18", color: mi.color, padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 700 }}>{mi.icon} {mi.short}</span>
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: C.darkSoft, marginTop: 2 }}>{fmtDF(p["Data Início"])} → {fmtDF(p["Data Fim"])} · {fmtDias(p["Dias Úteis"], p["Período"])}</div>
                  {m2t && m2t.diasTrab < 5 && p.Motivo.includes("Férias") && (
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 4, background: C.blueBg, color: C.blue, padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 700, marginTop: 4 }}>
                      📋 {m2t.diasTrab}d/sem · CAIDI: {m2t.restamCAIDI}/{m2t.limiteCAIDI} disponíveis
                    </div>
                  )}
                  {p.Observações && <div style={{ fontSize: 12, color: C.darkSoft, fontStyle: "italic", marginTop: 3 }}>"{p.Observações}"</div>}
                  <FileBadge url={p.Ficheiro} />
                </div>
                <div style={{ marginBottom: 8 }}>
                  <input type="text" placeholder="Observação da gestão (opcional)" value={obsGestao[p._linha] || ""} onChange={e => setObsGestao(o => ({ ...o, [p._linha]: e.target.value }))} style={{ width: "100%", padding: 10, borderRadius: 10, border: "2px solid " + C.grayLight, fontSize: 13, color: C.dark, background: C.grayBg }} />
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <Btn onClick={() => handle(p._linha, "Aprovado")} disabled={upd === p._linha} variant="success" style={{ flex: 1, padding: 10 }}>✓ Aprovar</Btn>
                  <Btn onClick={() => handle(p._linha, "Rejeitado")} disabled={upd === p._linha} variant="danger" style={{ flex: 1, padding: 10 }}>✕ Rejeitar</Btn>
                </div>
              </Card>
            ); })}
          </div>
        )}

        {/* ═══ TAB REGISTAR FALTA ═══ */}
        {adminTab === "falta" && (
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 900, color: C.dark, margin: "0 0 12px" }}>⚠️ Registar falta</h2>
            {faltaDone ? (
              <Card style={{ background: C.greenBg, border: "1px solid #b2f5ea" }}>
                <div style={{ textAlign: "center", padding: 16, animation: "pop 0.4s ease" }}><div style={{ fontSize: 40 }}>✅</div><div style={{ fontSize: 14, fontWeight: 800, color: C.green, marginTop: 8 }}>Falta registada!</div></div>
              </Card>
            ) : (
              <Card delay={0}>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: C.gray, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 4 }}>Terapeuta</label>
                  <select value={faltaTer} onChange={e => setFaltaTer(e.target.value)} style={{ width: "100%", padding: 12, borderRadius: 12, border: "2px solid " + C.grayLight, fontSize: 14, color: C.dark, background: C.grayBg }}>
                    <option value="">Seleciona...</option>
                    {data.terapeutas.map(t => <option key={t.ID} value={t.ID}>{t.Nome}</option>)}
                  </select>
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: C.gray, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 4 }}>Tipo</label>
                  <select value={faltaMotivo} onChange={e => setFaltaMotivo(e.target.value)} style={{ width: "100%", padding: 12, borderRadius: 12, border: "2px solid " + C.grayLight, fontSize: 14, color: C.dark, background: C.grayBg }}>
                    <option value="Falta Injustificada">Falta Injustificada</option>
                    <option value="Falta Justificada">Falta Justificada</option>
                    <option value="Baixa Médica">Baixa Médica</option>
                  </select>
                </div>
                {["inicio", "fim"].map(k => (
                  <div key={k} style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: 11, fontWeight: 700, color: C.gray, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 4 }}>{k === "inicio" ? "De" : "Até"}</label>
                    <input type="date" value={k === "inicio" ? faltaInicio : faltaFim} onChange={e => k === "inicio" ? setFaltaInicio(e.target.value) : setFaltaFim(e.target.value)} style={{ width: "100%", padding: 12, borderRadius: 12, border: "2px solid " + C.grayLight, fontSize: 14, color: C.dark, background: C.grayBg }} />
                  </div>
                ))}
                {faltaInicio && faltaFim && faltaInicio === faltaFim && (
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: 11, fontWeight: 700, color: C.gray, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 6 }}>Duração</label>
                    <div style={{ display: "flex", gap: 6 }}>
                      {[{ v: "dia", l: "☀️ Dia inteiro", d: "1 dia" }, { v: "manha", l: "🌅 Manhã", d: "0.5 dia" }, { v: "tarde", l: "🌇 Tarde", d: "0.5 dia" }].map(p => (
                        <button key={p.v} onClick={() => setFaltaPeriodo(p.v)} style={{ flex: 1, padding: "10px 6px", borderRadius: 12, border: faltaPeriodo === p.v ? "2px solid " + C.teal : "2px solid " + C.grayLight, background: faltaPeriodo === p.v ? C.tealLight : C.grayBg, cursor: "pointer", transition: "all 0.2s" }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: faltaPeriodo === p.v ? C.tealDark : C.dark }}>{p.l}</div>
                          <div style={{ fontSize: 10, color: C.gray, marginTop: 2 }}>{p.d}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: C.gray, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 4 }}>Nota</label>
                  <input type="text" value={faltaNota} onChange={e => setFaltaNota(e.target.value)} placeholder="Ex: Não apareceu, não avisou" style={{ width: "100%", padding: 12, borderRadius: 12, border: "2px solid " + C.grayLight, fontSize: 14, color: C.dark, background: C.grayBg }} />
                </div>
                {faltaMotivo === "Falta Injustificada" && <div style={{ background: C.redBg, padding: "10px 12px", borderRadius: 12, fontSize: 13, color: C.red, fontWeight: 600, marginBottom: 14 }}>⚠️ A terapeuta verá esta falta no seu perfil.</div>}
                <Btn onClick={submitFalta} disabled={faltaSub} variant="danger">{faltaSub ? "A registar..." : "Registar falta"}</Btn>
              </Card>
            )}
          </div>
        )}

        {/* ═══ TAB HISTÓRICO ═══ */}
        {adminTab === "historico" && (
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 900, color: C.dark, margin: "0 0 10px" }}>Histórico</h2>
            
            {/* Pesquisa por terapeuta */}
            <div style={{ marginBottom: 10 }}>
              <input type="text" value={searchTer} onChange={e => setSearchTer(e.target.value)} placeholder="🔍 Pesquisar terapeuta..." style={{ width: "100%", padding: "10px 14px", borderRadius: 12, border: "2px solid " + C.grayLight, fontSize: 14, color: C.dark, background: C.white, fontFamily: "'DM Sans', sans-serif" }} />
            </div>

            {/* Se pesquisou, mostrar resumo da terapeuta */}
            {searchTer.trim().length > 0 && (() => {
              const terFilt = data.terapeutas.filter(t => t.Nome.toLowerCase().includes(searchTer.toLowerCase()));
              if (terFilt.length === 0) return <Card style={{ marginBottom: 10 }}><div style={{ textAlign: "center", fontSize: 13, color: C.gray }}>Nenhum terapeuta encontrado</div></Card>;
              return terFilt.map(t => {
                const a2 = data.ausencias.filter(a => a.ID_Terapeuta === t.ID);
                const ap2 = data.resumoApoios && data.resumoApoios[t.ID] ? data.resumoApoios[t.ID].ef : 0;
                const m2 = calc(t, ap2, a2, data.periodos, data.fecho, data.horarios);
                const tIsADM = t["Área"] === "ADM";
                const pedidos = a2.sort((a, b) => (b["Data Pedido"]||"").localeCompare(a["Data Pedido"]||""));
                return (
                  <div key={t.ID}>
                    <Card delay={0} style={{ marginBottom: 8, background: "linear-gradient(135deg, " + C.tealLight + ", " + C.white + ")", border: "1px solid " + C.tealSoft }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                        <div style={{ width: 40, height: 40, borderRadius: 12, background: C.teal, color: C.white, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800 }}>{ini(t.Nome)}</div>
                        <div>
                          <div style={{ fontSize: 15, fontWeight: 800, color: C.dark }}>{t.Nome}</div>
                          <div style={{ fontSize: 11, color: C.darkSoft }}>{t["Área"]}{m2.diasTrab < 5 ? " · " + m2.diasTrab + "d/sem" : ""}</div>
                        </div>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 6, textAlign: "center" }}>
                        <div style={{ padding: 8, background: C.white, borderRadius: 10 }}>
                          <div style={{ fontSize: 8, color: C.gray, fontWeight: 700, textTransform: "uppercase" }}>🌴 Obrig.</div>
                          <div style={{ fontSize: 18, fontWeight: 900, color: m2.oR <= 3 ? C.red : C.teal }}>{m2.oR}</div>
                          <div style={{ fontSize: 9, color: C.gray }}>restam</div>
                        </div>
                        <div style={{ padding: 8, background: C.white, borderRadius: 10 }}>
                          <div style={{ fontSize: 8, color: C.gray, fontWeight: 700, textTransform: "uppercase" }}>🎁 Bónus</div>
                          <div style={{ fontSize: 18, fontWeight: 900, color: C.green }}>{m2.bR}</div>
                          <div style={{ fontSize: 9, color: C.gray }}>restam</div>
                        </div>
                        <div style={{ padding: 8, background: C.white, borderRadius: 10 }}>
                          <div style={{ fontSize: 8, color: C.gray, fontWeight: 700, textTransform: "uppercase" }}>🏥 Baixa</div>
                          <div style={{ fontSize: 18, fontWeight: 900, color: m2.dB > 0 ? C.purple : C.gray }}>{m2.dB}d</div>
                          <div style={{ fontSize: 9, color: C.gray }}>usados</div>
                        </div>
                        <div style={{ padding: 8, background: C.white, borderRadius: 10 }}>
                          <div style={{ fontSize: 8, color: C.gray, fontWeight: 700, textTransform: "uppercase" }}>⚠️ F.Inj.</div>
                          <div style={{ fontSize: 18, fontWeight: 900, color: m2.dFI > 0 ? C.red : C.gray }}>{m2.dFI}</div>
                          <div style={{ fontSize: 9, color: C.gray }}>dias</div>
                        </div>
                      </div>
                      {m2.diasTrab < 5 && (
                        <div style={{ marginTop: 8, padding: "6px 10px", background: C.white, borderRadius: 8, fontSize: 11, color: C.darkSoft }}>
                          📋 Dias CAIDI: <strong>{m2.usadosCAIDI}</strong> usados de <strong>{m2.limiteCAIDI}</strong> ({m2.diasFeriasCAIDI} obrig.{m2.diasBonusCAIDI > 0 ? " + " + m2.diasBonusCAIDI + " bónus" : ""}) · <strong style={{ color: m2.restamCAIDI <= 2 ? C.red : C.green }}>{m2.restamCAIDI} disponíveis</strong>
                        </div>
                      )}
                      {!tIsADM && (
                        <div style={{ marginTop: 8, padding: "6px 10px", background: C.white, borderRadius: 8, fontSize: 11, color: C.darkSoft }}>
                          🎯 Meta: <strong>{m2.ef}/{m2.mMin}</strong> ({m2.pM}%){m2.eurosTotal > 0 ? " · 💶 +" + m2.eurosTotal + "€" : ""}
                        </div>
                      )}
                    </Card>
                    
                    {/* Pedidos desta terapeuta */}
                    {pedidos.length === 0 ? (
                      <Card style={{ marginBottom: 12 }}><div style={{ textAlign: "center", fontSize: 13, color: C.gray }}>Sem pedidos registados</div></Card>
                    ) : pedidos.map((p, i) => {
                      const mi = motivoInfo(p.Motivo); const e = EST[p.Estado] || EST.Pendente;
                      return (
                        <div key={i} style={{ background: C.white, borderRadius: 14, padding: "9px 14px", border: "1px solid " + C.grayLight, borderLeft: "4px solid " + mi.color, marginBottom: 4, fontSize: 12 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div><span style={{ color: C.gray, fontSize: 10 }}>{mi.icon} {mi.short}</span><span style={{ marginLeft: 6, fontWeight: 700 }}>{fmtD(p["Data Início"])}{p["Data Início"] !== p["Data Fim"] ? " → " + fmtD(p["Data Fim"]) : ""}</span><span style={{ color: C.gray, marginLeft: 4, fontSize: 10 }}>{p["Dias Úteis"]}d</span></div>
                            <span style={{ background: e.bg, color: e.c, padding: "2px 7px", borderRadius: 6, fontSize: 10, fontWeight: 700 }}>{e.icon}</span>
                          </div>
                          {p.Observações && <div style={{ fontSize: 11, color: C.darkSoft, marginTop: 2, fontStyle: "italic" }}>"{p.Observações}"</div>}
                          {p["Resposta Gestão"] && <div style={{ fontSize: 11, color: C.darkSoft, marginTop: 2 }}>💬 {p["Resposta Gestão"]}</div>}
                          {p.Ficheiro && <FileBadge url={p.Ficheiro} />}
                        </div>
                      );
                    })}
                  </div>
                );
              });
            })()}

            {/* Filtros de tipo (quando não há pesquisa) */}
            {searchTer.trim().length === 0 && (
              <>
                <div style={{ display: "flex", gap: 3, marginBottom: 8 }}>
                  {[{ k: "todos", l: "Tudo" }, { k: "ferias", l: "🌴" }, { k: "baixas", l: "🏥" }, { k: "faltas", l: "⚠️" }, { k: "formacao", l: "🎓" }].map(f => (
                    <button key={f.k} onClick={() => setFiltro(f.k)} style={{ background: filtro === f.k ? C.tealLight : C.white, border: "1px solid " + (filtro === f.k ? C.tealSoft : C.grayLight), borderRadius: 8, padding: "4px 7px", fontSize: 11, fontWeight: 700, color: filtro === f.k ? C.tealDark : C.gray, cursor: "pointer" }}>{f.l}</button>
                  ))}
                </div>
                {hist.length === 0 ? (
                  <Card><div style={{ textAlign: "center", padding: 20, color: C.gray }}><div style={{ fontSize: 36 }}>📋</div><div style={{ fontSize: 14, marginTop: 6 }}>Sem histórico</div></div></Card>
                ) : histFilt.slice(0, 20).map((p, i) => { const t = data.terapeutas.find(x => x.ID === p.ID_Terapeuta); const mi = motivoInfo(p.Motivo); const e = EST[p.Estado] || EST.Pendente; return (
                  <div key={i} style={{ background: C.white, borderRadius: 14, padding: "9px 14px", border: "1px solid " + C.grayLight, marginBottom: 4, opacity: 0.65, fontSize: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div><span style={{ fontWeight: 700 }}>{t ? t.Nome : p.ID_Terapeuta}</span><span style={{ color: C.gray, marginLeft: 6, fontSize: 10 }}>{mi.icon} {fmtD(p["Data Início"])}{p["Data Início"] !== p["Data Fim"] ? "→" + fmtD(p["Data Fim"]) : ""}</span></div>
                      <span style={{ background: e.bg, color: e.c, padding: "2px 7px", borderRadius: 6, fontSize: 10, fontWeight: 700 }}>{e.icon}</span>
                    </div>
                    {p["Resposta Gestão"] && <div style={{ fontSize: 11, color: C.darkSoft, marginTop: 2 }}>💬 {p["Resposta Gestão"]}</div>}
                    {p.Ficheiro && <FileBadge url={p.Ficheiro} />}
                  </div>
                ); })}
              </>
            )}
          </div>
        )}
      </div>

      {/* Bottom nav */}
      <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 480, background: C.white, borderTop: "1px solid " + C.grayLight, display: "flex", justifyContent: "space-around", padding: "6px 0 12px", boxShadow: "0 -4px 20px rgba(0,0,0,0.04)" }}>
        {adminTabs.map(tb => (
          <button key={tb.id} onClick={() => setAdminTab(tb.id)} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 1, color: adminTab === tb.id ? C.teal : C.gray, padding: "2px 6px", transition: "all 0.2s", position: "relative" }}>
            <span style={{ fontSize: 18, transform: adminTab === tb.id ? "scale(1.15)" : "scale(1)", transition: "transform 0.2s" }}>{tb.icon}</span>
            <span style={{ fontSize: 9, fontWeight: adminTab === tb.id ? 800 : 500 }}>{tb.l}</span>
            {adminTab === tb.id && <div style={{ width: 4, height: 4, borderRadius: "50%", background: C.teal, marginTop: -1 }} />}
            {tb.badge > 0 && <div style={{ position: "absolute", top: -2, right: -2, background: C.red, color: C.white, fontSize: 9, fontWeight: 800, width: 16, height: 16, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>{tb.badge}</div>}
          </button>
        ))}
      </div>
    </div>
  );
}
/* ═══════════════════════ LOADING ═══════════════════════ */
function Loading() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "linear-gradient(150deg, " + C.dark + ", " + C.tealDark + ")" }}>
      <style>{CSS}</style>
      <div style={{ width: 52, height: 52, borderRadius: 16, background: C.teal, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 900, color: C.white, boxShadow: "0 8px 24px " + C.teal + "55", animation: "float 2s ease infinite" }}>C</div>
      <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, marginTop: 16 }}>A carregar...</div>
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
    try { const r = await apiGet("tudo"); setData(r); } catch (err) { setError(err.message || "Erro desconhecido"); setData(null); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  const refresh = () => fetchData();
  const addAus = (n) => setData(p => ({ ...p, ausencias: [...p.ausencias, { ...n, _linha: p.ausencias.length + 2 }] }));
  const updEst = (ln, est, obs) => setData(p => ({ ...p, ausencias: p.ausencias.map(a => a._linha === ln ? { ...a, Estado: est, "Resposta Gestão": obs || "" } : a) }));

  if (loading) return <Loading />;
  if (error || !data) return <ErrorScreen error={error || "Sem dados"} onRetry={fetchData} />;
  if (!user) return <Login terapeutas={data.terapeutas} config={data.config || {}} onLogin={(id, adm) => setUser({ id, isAdmin: adm })} />;
  if (user.isAdmin) return <AdminView data={data} onLogout={() => setUser(null)} onRefresh={refresh} onUpdateEstado={updEst} />;
  const t = data.terapeutas.find(x => x.ID === user.id);
  if (!t) { setUser(null); return null; }
  return <TherapistView data={data} terap={t} onLogout={() => setUser(null)} onRefresh={refresh} onAddAusencia={addAus} />;
}
