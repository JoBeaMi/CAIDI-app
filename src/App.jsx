import React, { useState, useEffect, useCallback, useRef } from "react";

/* ═══════════════════════════════════════════════════════════════
   CONFIGURAÇÃO — Cola aqui o URL do Google Apps Script
   ═══════════════════════════════════════════════════════════════ */
const API_URL = "https://script.google.com/macros/s/AKfycbxaz2PcPnXknzCdsUoSp3B3MSU5E34CUZdnrBFOCeMCAbedpJG-Cmg-wgwpGVxgrcELiQ/exec";
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

/* ═══════════════════════ FERIADOS NACIONAIS ═══════════════════════ */
const FERIADOS_NACIONAIS = new Set([
  // 2025
  "2025-01-01", "2025-04-18", "2025-04-20", "2025-04-25", "2025-05-01",
  "2025-06-10", "2025-06-19", "2025-08-15", "2025-10-05", "2025-11-01",
  "2025-12-01", "2025-12-08", "2025-12-25",
  // 2026
  "2026-01-01", // Ano Novo (Qui)
  "2026-04-03", // Sexta-feira Santa (Sex)
  "2026-04-05", // Páscoa (Dom)
  "2026-04-25", // Dia da Liberdade (Sáb)
  "2026-05-01", // Dia do Trabalhador (Sex)
  "2026-06-04", // Corpo de Deus (Qui)
  "2026-06-10", // Dia de Portugal (Qua)
  "2026-08-15", // Assunção de N. Senhora (Sáb)
  "2026-10-05", // Implantação da República (Seg)
  "2026-11-01", // Todos os Santos (Dom)
  "2026-12-01", // Restauração da Independência (Ter)
  "2026-12-08", // Imaculada Conceição (Ter)
  "2026-12-25", // Natal (Sex)
  // 2027
  "2027-01-01", // Ano Novo (Sex)
  "2027-03-26", // Sexta-feira Santa
  "2027-03-28", // Páscoa (Dom)
  "2027-04-25", // Dia da Liberdade (Dom)
  "2027-05-01", // Dia do Trabalhador (Sáb)
  "2027-05-27", // Corpo de Deus (Qui)
  "2027-06-10", // Dia de Portugal (Qui)
  "2027-08-15", // Assunção (Dom)
  "2027-10-05", // Implantação da República (Ter)
  "2027-11-01", // Todos os Santos (Seg)
  "2027-12-01", // Restauração (Qua)
  "2027-12-08", // Imaculada (Qua)
  "2027-12-25", // Natal (Sáb)
]);

function isFeriado(dateStr) {
  return FERIADOS_NACIONAIS.has(dateStr);
}

// Feriado incluindo municipal (por terapeuta)
function isFeriadoTerap(dateStr, feriadoMun) {
  return FERIADOS_NACIONAIS.has(dateStr) || (feriadoMun && dateStr === feriadoMun);
}

// Normalizar data de feriado municipal (pode vir como Date ISO ou string)
function normFeriadoMun(val) {
  if (!val) return null;
  const s = String(val).trim();
  if (!s) return null;
  if (s.includes("T")) return s.slice(0, 10);
  return s;
}

// Construir set de dias de fecho a partir da lista
function buildFechoSet(fecho) {
  const set = new Set();
  if (!fecho) return set;
  fecho.forEach(f => {
    const d = new Date(f["Data Início"] + "T12:00:00"), fim = new Date(f["Data Fim"] + "T12:00:00");
    while (d <= fim) {
      set.add(d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0"));
      d.setDate(d.getDate() + 1);
    }
  });
  return set;
}

// Contar dias de férias reais: sem fds, feriados NEM fecho
function contarDiasFerias(i, f, fechoSet, feriadoMun) {
  if (!i || !f) return 0;
  let c = 0; const d = new Date(i), e = new Date(f);
  while (d <= e) {
    if (d.getDay() % 6 !== 0) {
      const ds = d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0");
      if (!isFeriadoTerap(ds, feriadoMun) && !fechoSet.has(ds)) c++;
    }
    d.setDate(d.getDate() + 1);
  }
  return c;
}

/* ═══════════════════════ ALTERAÇÕES (HISTÓRICO CONTRATUAL) ═══════════════════════ */
// Dado um terapeuta e uma data, retorna { hLetivas, hSemanais } em vigor nesse dia
function getAlteracoesTerap(alteracoes, tId) {
  if (!alteracoes || !alteracoes.length) return [];
  return alteracoes
    .filter(a => String(a.ID).trim() === String(tId).trim())
    .sort((a, b) => (a.Data || "").localeCompare(b.Data || ""));
}
function getHorasNoDia(altList, dia, fallbackHL, fallbackHS) {
  // altList já filtrado e ordenado para este terapeuta
  let hL = fallbackHL, hS = fallbackHS;
  for (const a of altList) {
    if (a.Data && a.Data <= dia) {
      hL = Number(a["Horas Letivas"]) || hL;
      hS = Number(a["Horas Semanais"]) || hS;
    } else break;
  }
  return { hL, hS };
}
// Calcular objetivo somando dia a dia (cada dia usa as horas em vigor)
function calcObjetivoDiario(altList, inicio, fim, diasBaixa, fallbackHL, fallbackHS, feriadoMun) {
  if (!inicio || !fim) return { mMin: 0, mE3: 0, hLDMedia: 0, hSMedia: 0 };
  let somaHL = 0, somaHS = 0, dias = 0;
  const d = new Date(inicio + "T12:00:00"), e = new Date(fim + "T12:00:00");
  while (d <= e) {
    if (d.getDay() !== 0 && d.getDay() !== 6) {
      const ds = d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0");
      if (!isFeriadoTerap(ds, feriadoMun)) {
        const { hL, hS } = getHorasNoDia(altList, ds, fallbackHL, fallbackHS);
        somaHL += hL / 5;
        somaHS += hS / 5;
        dias++;
      }
    }
    d.setDate(d.getDate() + 1);
  }
  // Subtrair dias de baixa proporcionalmente (usando média)
  const hLDMedia = dias > 0 ? Math.round((somaHL / dias) * 1000) / 1000 : fallbackHL / 5;
  const hSMedia = dias > 0 ? Math.round((somaHS / dias) * 1000) / 1000 : fallbackHS / 5;
  const mMin = Math.round(somaHL - (diasBaixa * hLDMedia));
  const mE3 = Math.round((somaHS - (diasBaixa * hSMedia)) * 1.05);
  return { mMin: Math.max(mMin, 0), mE3: Math.max(mE3, 0), hLDMedia, hSMedia };
}

/* ═══════════════════════ CÁLCULOS ═══════════════════════ */
function contarDiasUteis(i, f, feriadoMun) {
  if (!i || !f) return 0;
  let c = 0; const d = new Date(i), e = new Date(f);
  while (d <= e) { 
    if (d.getDay() % 6 !== 0) {
      const ds = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
      if (!isFeriadoTerap(ds, feriadoMun)) c++;
    }
    d.setDate(d.getDate() + 1); 
  }
  return c;
}

/* ─── QUADRIMESTRES ───
   Q1: 1 Set → 31 Dez  (contém 1.º Período letivo)
   Q2: 1 Jan → 13 Abr  (contém 2.º Período letivo)
   Q3: 14 Abr → 31 Ago (contém 3.º Período letivo)
   OBJETIVO = dias úteis do período LETIVO × horas letivas/dia
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

function calc(t, efCount, aus, periodos, fecho, horarios, alteracoes, compensacoes) {
  const quads = buildQuadrimestres(periodos);
  const q = quadAtual(quads);
  if (!q) return emptyMetrics();
  const hojeStr = new Date().toISOString().slice(0, 10);
  const hor = getHorario(horarios, t.ID);
  const feriadoMun = normFeriadoMun(t["Feriado Municipal"]);

  const dLetivoTotal = contarDiasUteis(q.letivoInicio, q.letivoFim, feriadoMun);
  const dLetivoHoje = contarDiasUteis(q.letivoInicio, hojeStr > q.letivoFim ? q.letivoFim : hojeStr, feriadoMun);
  const dQuadTotal = contarDiasUteis(q.qInicio, q.qFim, feriadoMun);
  const dQuadHoje = contarDiasUteis(q.qInicio, hojeStr > q.qFim ? q.qFim : hojeStr, feriadoMun);

  const ausQ = aus.filter(a => a.Estado === "Aprovado" && a["Data Início"] <= q.qFim && a["Data Fim"] >= q.qInicio);
  const dB  = ausQ.filter(a => a.Motivo === "Baixa Médica").reduce((s, a) => s + Number(a["Dias Úteis"] || 0), 0);
  const dFJ = ausQ.filter(a => a.Motivo === "Falta Justificada").reduce((s, a) => s + Number(a["Dias Úteis"] || 0), 0);
  const dFI = ausQ.filter(a => a.Motivo === "Falta Injustificada").reduce((s, a) => s + Number(a["Dias Úteis"] || 0), 0);
  const dFO = ausQ.filter(a => a.Motivo === "Formação").reduce((s, a) => s + Number(a["Dias Úteis"] || 0), 0);

  // Usar alterações dia a dia se disponíveis, senão fallback para valores fixos
  const altList = getAlteracoesTerap(alteracoes, t.ID);
  const fallbackHL = Number(t["Horas Letivas"]) || 0;
  const fallbackHS = Number(t["Horas Semanais"]) || 40;
  const obj = calcObjetivoDiario(altList, q.letivoInicio, q.letivoFim, dB, fallbackHL, fallbackHS, feriadoMun);
  const mMin = obj.mMin;
  const hLD = obj.hLDMedia;
  const hSem = obj.hSMedia;
  const mE3 = obj.mE3;
  const mBonus = Math.round(mMin * 0.85);
  const mE2 = Math.round(mMin * 1.05);
  const progQuad = dQuadTotal > 0 ? dQuadHoje / dQuadTotal : 1;
  const mH = Math.round(mMin * progQuad);
  const ef = typeof efCount === "number" ? efCount : (Array.isArray(efCount) ? efCount.filter(a => a.Tipo === "Efetivado" && a.Data >= q.qInicio && a.Data <= q.qFim).length : 0);
  const pH = mH > 0 ? Math.round((ef / mH) * 100) : (ef > 0 ? 100 : 0);
  const pM = mMin > 0 ? Math.round((ef / mMin) * 100) : (ef > 0 ? 100 : 0);
  // Cálculo de € ganhos
  const euros5 = ef > mE2 ? Math.min(ef, mE3) - mE2 : 0;
  const euros10 = ef > mE3 ? ef - mE3 : 0;
  const eurosTotal = (euros5 * 5) + (euros10 * 10);

  // ── Férias: 22 dias úteis para todas (lei) ──
  const diasTrab = hor ? hor.diasTrab : 5;
  const fechoSet = buildFechoSet(fecho);
  // Fecho CAIDI: conta em dias úteis do calendário para todas (igual)
  const tF = (() => {
    let count = 0;
    fecho.forEach(f => {
      const d = new Date(f["Data Início"] + "T12:00:00"), fim = new Date(f["Data Fim"] + "T12:00:00");
      while (d <= fim) {
        if (d.getDay() !== 0 && d.getDay() !== 6) {
          const ds = d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0");
          if (!isFeriadoTerap(ds, feriadoMun)) count++;
        }
        d.setDate(d.getDate() + 1);
      }
    });
    return count;
  })();

  const feriasPedidas = aus.filter(a => a.Motivo.includes("Férias") && (a.Estado === "Aprovado" || a.Estado === "Pendente"));
  
  // Contar dias reais de férias em dias úteis (merge intervalos, excluir fecho/feriados)
  const fmtYMDcalc = (d) => d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0");
  
  // Contar separadamente obrigatórias e bónus pelo Motivo real na folha
  // Fallback: pedidos antigos com Motivo "Férias (Obrigatórias)" que na verdade são isolados
  // → detectar retroativamente: se não cobre semana completa, conta como bónus
  const diasObrigSet = new Set();
  const diasBonusSet = new Set();
  feriasPedidas.forEach(fp => {
    if (!fp["Data Início"] || !fp["Data Fim"]) return;
    const isExplicitBonus = fp.Motivo === "Férias (Bónus)";
    
    // Recolher dias deste pedido (excl fecho/feriados/fds)
    const pedDias = [];
    const d2 = new Date(fp["Data Início"] + "T12:00:00"), fim2 = new Date(fp["Data Fim"] + "T12:00:00");
    while (d2 <= fim2) {
      const ds2 = fmtYMDcalc(d2);
      if (d2.getDay() !== 0 && d2.getDay() !== 6 && !isFeriadoTerap(ds2, feriadoMun) && !fechoSet.has(ds2)) {
        pedDias.push({ date: ds2, dow: d2.getDay() });
      }
      d2.setDate(d2.getDate() + 1);
    }
    
    // Se o pedido não tem dias reais (tudo fecho/feriado) → ignorar
    if (pedDias.length === 0) return;
    
    // Determinar se é bónus: explícito OU retroativo (não cobre semana completa)
    let isBonus = isExplicitBonus;
    if (!isExplicitBonus && pedDias.length > 0) {
      // Agrupar por semana e verificar se cobre semana completa
      const semCheck = {};
      pedDias.forEach(pd => {
        const dt = new Date(pd.date + "T12:00:00");
        const mon = new Date(dt);
        mon.setDate(mon.getDate() - (mon.getDay() === 0 ? 6 : mon.getDay() - 1));
        const key = mon.toISOString().slice(0,10);
        if (!semCheck[key]) semCheck[key] = new Set();
        semCheck[key].add(pd.date);
      });
      // Verificar cada semana: todos os 5 dias úteis cobertos? (pedido + fecho + feriado + não trabalha)
      let algumaSemIncompleta = false;
      Object.entries(semCheck).forEach(([monKey, diasPedSet]) => {
        for (let i = 0; i < 5; i++) {
          const wd = new Date(monKey + "T12:00:00");
          wd.setDate(wd.getDate() + i);
          const wds = wd.toISOString().slice(0,10);
          const dow = wd.getDay();
          const coberto = fechoSet.has(wds) || isFeriadoTerap(wds, feriadoMun) || !trabalhaDia(hor, dow) || diasPedSet.has(wds);
          if (!coberto) { algumaSemIncompleta = true; break; }
        }
      });
      if (algumaSemIncompleta) isBonus = true;
    }
    
    pedDias.forEach(pd => {
      if (isBonus) diasBonusSet.add(pd.date); else diasObrigSet.add(pd.date);
    });
  });
  const totalFeriasReais = diasObrigSet.size + diasBonusSet.size;
  
  const diasFeriasLegais = Number(t["Dias Férias"]) || 22;
  const fU = Math.min(diasObrigSet.size, diasFeriasLegais - tF) + tF;
  const bU = diasBonusSet.size;
  const oR = Math.max(diasFeriasLegais - fU, 0);
  const dBn = Number(t["Dias Bónus Ganhos"] || 0);
  const hSemanaisContrato = Number(t["Horas Semanais"]) || 40;
  const maxBonusPossivel = 15;
  const bR = Math.max(dBn - bU, 0);

  const dExtraTotal = Math.max(dQuadTotal - dLetivoTotal, 0);
  const passado = new Date().toISOString().slice(0,10) > q.qFim;
  const fE2 = Math.max(mE2 - ef, 0);
  const proj = dQuadHoje > 0 ? Math.round((ef / dQuadHoje) * dQuadTotal) : 0;
  const sc = pH >= 95 ? C.green : pH >= 80 ? C.yellow : C.red;

  // ── Assiduidade ──
  // Faltas que contam: baixa, falta justificada, falta injustificada (NÃO formação aprovada)
  // Agrupar compensações por Linha_Ausencia
  const compGrouped = {};
  (compensacoes || []).forEach(c => {
    const key = String(c.Linha_Ausencia);
    if (!compGrouped[key]) compGrouped[key] = { linhas: [], estado: c.Estado, perdidos: Number(c["Apoios Perdidos"] || 0) };
    compGrouped[key].linhas.push(c);
    compGrouped[key].estado = c.Estado; // todos têm o mesmo estado
  });
  const ausAssiduidade = aus.filter(a => a.Estado === "Aprovado" && a["Data Início"] <= (hojeStr > q.qFim ? q.qFim : hojeStr) && a["Data Fim"] >= q.qInicio && a.Motivo !== "Formação" && !a.Motivo.includes("Férias"));
  const diasFaltaTotal = ausAssiduidade.reduce((s, a) => s + Number(a["Dias Úteis"] || 0), 0);
  // Compensações aprovadas: reduzem as faltas proporcionalmente
  const diasCompensados = ausAssiduidade.reduce((s, a) => {
    const grupo = compGrouped[String(a._linha)];
    if (!grupo || grupo.estado !== "Aprovado") return s;
    const perdidos = grupo.perdidos;
    const compensados = grupo.linhas.length; // cada linha = 1 criança compensada
    if (perdidos <= 0) return s;
    const pct = Math.min(compensados / perdidos, 1);
    return s + (Number(a["Dias Úteis"] || 0) * pct);
  }, 0);
  const faltasEfetivas = Math.max(diasFaltaTotal - diasCompensados, 0);
  const diasUteisPeriodo = contarDiasUteis(q.qInicio, hojeStr > q.qFim ? q.qFim : hojeStr, feriadoMun);
  const pctAssiduidade = diasUteisPeriodo > 0 ? Math.round(((diasUteisPeriodo - faltasEfetivas) / diasUteisPeriodo) * 1000) / 10 : 100;
  const assiduidadeOk = pctAssiduidade >= 95;

  return { quad: q, quads, periodo: { "Período": q.label }, ef, mMin, mBonus, mE2, mE3, mH, pH, pM, diff: ef - mH, proj, tF, fU, bU, oR, dBn, bR, maxBonusPossivel, dB, dFJ, dFI, dFO, fE2, sc, dLetivoTotal, dLetivoHoje, dQuadTotal, dQuadHoje, dExtraTotal, progQuad: Math.round(progQuad * 100), hLD, hSem, euros5, euros10, eurosTotal, hor, diasTrab, passado, feriadoMun, pctAssiduidade, assiduidadeOk, diasFaltaTotal, diasCompensados, faltasEfetivas };
}

function emptyMetrics() {
  return { quad: null, quads: [], periodo: { "Período": "?" }, ef: 0, mMin: 0, mBonus: 0, mE2: 0, mE3: 0, mH: 0, pH: 0, pM: 0, diff: 0, proj: 0, tF: 0, fU: 0, bU: 0, oR: 0, dBn: 0, bR: 0, maxBonusPossivel: 15, dB: 0, dFJ: 0, dFI: 0, dFO: 0, fE2: 0, sc: C.gray, dLetivoTotal: 0, dLetivoHoje: 0, dQuadTotal: 0, dQuadHoje: 0, dExtraTotal: 0, progQuad: 0, hLD: 0, hSem: 0, euros5: 0, euros10: 0, eurosTotal: 0, hor: null, diasTrab: 5, passado: false, feriadoMun: null, pctAssiduidade: 100, assiduidadeOk: true, diasFaltaTotal: 0, diasCompensados: 0, faltasEfetivas: 0 };
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
  Cancelado: { bg: C.grayBg, c: C.gray, icon: "⊘", l: "Cancelado" },
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
  const [busca, setBusca] = useState("");

  const go = () => {
    if (mode === "gestao") {
      const pinCorreto = String(config.PIN_Gestao || "").trim();
      if (!pinCorreto) { setErr("PIN de gestão não configurado na folha Config"); return; }
      if (pinGestao !== pinCorreto) { setErr("PIN incorreto"); return; }
      onLogin(null, true); return;
    }
    if (!sel) { setErr("Seleciona o teu nome"); return; }
    const t = terapeutas.find(x => x.ID === sel);
    if (!t || String(t.PIN).toUpperCase().trim() !== pin.trim()) { setErr("Código incorreto"); return; }
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
            <input type="text" value={busca} onChange={e => setBusca(e.target.value)} placeholder="🔍 Procurar nome..." style={{ width: "100%", padding: "10px 12px", borderRadius: 12, border: "2px solid " + C.grayLight, fontSize: 13, color: C.dark, background: C.grayBg, marginBottom: 8, fontWeight: 500 }} />
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 18, maxHeight: 210, overflowY: "auto", paddingRight: 4 }}>
              {terapeutas.filter(t => !busca || t.Nome.toLowerCase().includes(busca.toLowerCase())).map(t => (
                <button key={t.ID} onClick={() => { setSel(t.ID); setErr(""); }} style={{ display: "flex", alignItems: "center", gap: 11, padding: "10px 12px", borderRadius: 14, border: sel === t.ID ? "2px solid " + C.teal : "2px solid " + C.grayLight, background: sel === t.ID ? C.tealLight : C.grayBg, cursor: "pointer", transition: "all 0.2s" }}>
                  <div style={{ width: 36, height: 36, borderRadius: 12, background: sel === t.ID ? C.teal : C.grayLight, color: sel === t.ID ? C.white : C.gray, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, transition: "all 0.2s" }}>{ini(t.Nome)}</div>
                  <div style={{ textAlign: "left" }}><div style={{ fontSize: 14, fontWeight: 700, color: C.dark }}>{t.Nome}</div><div style={{ fontSize: 11, color: C.darkSoft }}>{t["Área"]}</div></div>
                  {sel === t.ID && <span style={{ marginLeft: "auto", color: C.teal }}>●</span>}
                </button>
              ))}
            </div>
            <label style={{ fontSize: 11, fontWeight: 700, color: C.gray, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 6 }}>Código de acesso</label>
            <input type="password" maxLength={10} value={pin} onChange={e => { setPin(e.target.value.toUpperCase()); setErr(""); }} placeholder="••••••" style={{ width: "100%", padding: 13, borderRadius: 14, border: "2px solid " + C.grayLight, fontSize: 20, textAlign: "center", letterSpacing: 6, color: C.dark, background: C.grayBg, fontWeight: 800 }} />
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

/* ═══════════════════════ EDIT PEDIDO FORM ═══════════════════════ */
function EditPedidoForm({ pedido, onSave, onClose }) {
  const [fD, setFD] = useState({ inicio: pedido["Data Início"], fim: pedido["Data Fim"] });
  const [nota, setNota] = useState(pedido.Observações || "");
  const [sub, setSub] = useState(false);
  const [done, setDone] = useState(false);
  const [errMsg, setErrMsg] = useState("");
  const mi = motivoInfo(pedido.Motivo);
  const wasApproved = pedido.Estado === "Aprovado";

  const submit = async () => {
    if (!fD.inicio || !fD.fim) return;
    setSub(true); setErrMsg("");
    try {
      await onSave(pedido, { inicio: fD.inicio, fim: fD.fim, nota });
      setDone(true);
      setTimeout(onClose, 1500);
    } catch (err) {
      setErrMsg("Erro ao guardar: " + err.message);
    }
    setSub(false);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(45,52,54,0.5)", backdropFilter: "blur(4px)", zIndex: 100, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: C.white, borderRadius: "26px 26px 0 0", padding: "24px 20px 32px", width: "100%", maxWidth: 420, animation: "slideUp 0.3s ease", maxHeight: "90vh", overflowY: "auto" }}>
        {done ? (
          <div style={{ textAlign: "center", padding: "24px 0", animation: "pop 0.4s ease" }}><div style={{ fontSize: 48 }}>✅</div><div style={{ fontSize: 17, fontWeight: 800, color: C.green, marginTop: 10 }}>Pedido atualizado!</div></div>
        ) : (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <h3 style={{ fontSize: 18, fontWeight: 900, color: C.dark, margin: 0 }}>✏️ Editar pedido</h3>
              <button onClick={onClose} style={{ background: C.grayBg, border: "none", borderRadius: "50%", width: 32, height: 32, fontSize: 14, cursor: "pointer", color: C.darkSoft }}>✕</button>
            </div>

            <div style={{ background: mi.color + "15", padding: "8px 12px", borderRadius: 10, fontSize: 13, fontWeight: 700, color: mi.color, marginBottom: 14 }}>
              {mi.icon} {mi.label}
            </div>

            {wasApproved && (
              <div style={{ background: C.yellowBg, padding: "10px 12px", borderRadius: 12, fontSize: 12, color: "#E17055", fontWeight: 600, marginBottom: 14 }}>
                ⚠️ Este pedido já estava aprovado. Ao editar, volta a ficar <strong>pendente</strong> para re-aprovação.
              </div>
            )}

            {["inicio", "fim"].map(k => (
              <div key={k} style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: C.gray, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 4 }}>{k === "inicio" ? "De" : "Até"}</label>
                <input type="date" value={fD[k]} onChange={e => setFD(d => ({ ...d, [k]: e.target.value }))} style={{ width: "100%", padding: 12, borderRadius: 12, border: "2px solid " + C.grayLight, fontSize: 14, color: C.dark, background: C.grayBg }} />
              </div>
            ))}

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: C.gray, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 4 }}>Nota</label>
              <input type="text" value={nota} onChange={e => setNota(e.target.value)} placeholder="Opcional" style={{ width: "100%", padding: 12, borderRadius: 12, border: "2px solid " + C.grayLight, fontSize: 14, color: C.dark, background: C.grayBg }} />
            </div>

            {errMsg && <div style={{ background: C.redBg, color: C.red, padding: "8px 12px", borderRadius: 10, fontSize: 12, fontWeight: 600, marginBottom: 12 }}>⚠️ {errMsg}</div>}

            <Btn onClick={submit} disabled={sub}>{sub ? "A guardar..." : "Guardar alterações"}</Btn>
          </>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════ ABSENCE FORM ═══════════════════════ */
function AbsenceForm({ type, terap, metrics, periodos, fecho, onSubmit, onClose }) {
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

  // Calcular dias úteis do pedido
  const diasUteisPedido = (() => {
    if (!fD.inicio || !fD.fim) return 0;
    return contarDiasUteis(fD.inicio, fD.fim);
  })();

  // Calcular dias de fecho que caem no pedido (para info visual)
  const fechoNoPedido = (() => {
    if (!fD.inicio || !fD.fim || !fecho || !isFerias) return 0;
    const fs = buildFechoSet(fecho);
    return contarDiasUteis(fD.inicio, fD.fim) - contarDiasFerias(fD.inicio, fD.fim, fs, metrics.feriadoMun);
  })();

  // ── Smart férias type detection ──
  // Verifica se o pedido cobre todos os dias de trabalho em cada semana
  // Se sim → obrigatórias (conta 5 dias úteis por semana). Se não → bónus ou isolado.
  const feriasAnalise = (() => {
    if (!isFerias || !fD.inicio || !fD.fim) return { tipo: "obrigatorias", isolado: false, semIncompleta: null, diasReais: 0 };
    
    const fechoS = buildFechoSet(fecho);
    const hor = metrics.hor; // horário da terapeuta (null = full-time 5d)
    
    // Recolher dias úteis do pedido (excluindo fecho e feriados)
    const pedidoDias = [];
    const d = new Date(fD.inicio + "T12:00:00"), fim = new Date(fD.fim + "T12:00:00");
    while (d <= fim) {
      if (d.getDay() >= 1 && d.getDay() <= 5) {
        const ds = d.toISOString().slice(0,10);
        if (!fechoS.has(ds) && !isFeriadoTerap(ds, metrics.feriadoMun)) {
          pedidoDias.push({ date: ds, dow: d.getDay() });
        }
      }
      d.setDate(d.getDate() + 1);
    }
    if (pedidoDias.length === 0) return { tipo: "obrigatorias", isolado: false, semIncompleta: null, diasReais: 0 };
    
    // Agrupar por semana (segunda-feira)
    const semanas = {};
    pedidoDias.forEach(pd => {
      const dt = new Date(pd.date + "T12:00:00");
      const mon = new Date(dt);
      mon.setDate(mon.getDate() - (mon.getDay() === 0 ? 6 : mon.getDay() - 1));
      const key = mon.toISOString().slice(0,10);
      if (!semanas[key]) semanas[key] = [];
      semanas[key].push(pd);
    });
    
    // Para cada semana: verificar se TODOS os 5 dias úteis estão cobertos
    // Coberto = no pedido, OU fecho, OU feriado, OU dia em que não trabalha
    // Se tudo coberto → semana inteira sem CAIDI → obrigatórias
    let todasSemanasCobertas = true;
    const semsIncompletas = [];
    const dayNames = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
    
    Object.entries(semanas).forEach(([monKey, diasPedido]) => {
      const diasPedidoSet = new Set(diasPedido.map(dd => dd.date));
      const diasNaoCobertos = [];
      
      for (let i = 0; i < 5; i++) {
        const wd = new Date(monKey + "T12:00:00");
        wd.setDate(wd.getDate() + i);
        const wds = wd.toISOString().slice(0,10);
        const dow = wd.getDay();
        // Este dia está coberto se: é fecho, é feriado, não trabalha nesse dia, ou está no pedido
        const coberto = fechoS.has(wds) || isFeriadoTerap(wds, metrics.feriadoMun) || !trabalhaDia(hor, dow) || diasPedidoSet.has(wds);
        if (!coberto) {
          diasNaoCobertos.push({ date: wds, dow });
        }
      }
      
      if (diasNaoCobertos.length > 0) {
        todasSemanasCobertas = false;
        semsIncompletas.push({ weekOf: monKey, gaps: diasNaoCobertos.map(d2 => dayNames[d2.dow]) });
      }
    });
    
    if (todasSemanasCobertas) {
      // Cobre todos os dias de trabalho → verificar se selecionou 2ª a 6ª
      const semKeys = Object.keys(semanas);
      let datasCorretas = true;
      const semsParaCorrigir = [];
      const dayNames = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
      
      semKeys.forEach(monKey => {
        // Verificar se todos os 5 dias úteis da semana estão no pedido (excl. fecho/feriados)
        for (let i = 0; i < 5; i++) {
          const wd = new Date(monKey + "T12:00:00");
          wd.setDate(wd.getDate() + i);
          const wds = wd.toISOString().slice(0,10);
          const dow = wd.getDay();
          if (!fechoS.has(wds) && !isFeriadoTerap(wds, metrics.feriadoMun)) {
            // Este dia útil devia estar no pedido
            if (!pedidoDias.find(dd => dd.date === wds)) {
              datasCorretas = false;
              if (!semsParaCorrigir.find(s => s.weekOf === monKey)) {
                // Calcular 2ª e 6ª desta semana
                const mon = new Date(monKey + "T12:00:00");
                const fri = new Date(mon); fri.setDate(fri.getDate() + 4);
                semsParaCorrigir.push({ weekOf: monKey, de: mon.toISOString().slice(0,10), ate: fri.toISOString().slice(0,10) });
              }
            }
          }
        }
      });
      
      if (datasCorretas) {
        // Selecionou 2ª-6ª corretamente → obrigatórias, tudo ok
        return { tipo: "obrigatorias", isolado: false, semIncompleta: null, diasReais: pedidoDias.length, devExpandir: false };
      } else {
        // Cobriu dias de trabalho mas não selecionou semana completa → pedir para corrigir
        return { tipo: "obrigatorias", isolado: false, semIncompleta: null, diasReais: pedidoDias.length, devExpandir: true, semsParaCorrigir };
      }
    } else {
      if (metrics.bR > 0) {
        // Tem bónus → usar bónus (sem aviso)
        return { tipo: "bonus", isolado: false, semIncompleta: null, diasReais: pedidoDias.length };
      } else {
        // Sem bónus → obrigatórias com flag de isolado
        return { tipo: "obrigatorias", isolado: true, semIncompleta: semsIncompletas, diasReais: pedidoDias.length };
      }
    }
  })();

  const submit = async () => {
    if (!fD.inicio || !fD.fim) return;
    if (isFerias && emLetivo && !justLetivo.trim()) { setErrMsg("Pedido em período letivo — indica o motivo da exceção."); return; }
    if (isFerias && feriasAnalise.devExpandir) { setErrMsg("Seleciona de 2ª a 6ª para cobrir a semana completa."); return; }
    setSub(true); setErrMsg("");
    const fechoSetLocal = buildFechoSet(fecho);
    let dias = isFerias ? contarDiasFerias(fD.inicio, fD.fim, fechoSetLocal, metrics.feriadoMun) : contarDiasUteis(fD.inicio, fD.fim);
    if (mesmoDia && periodo !== "dia") dias = 0.5;
    const fechoNoDias = isFerias ? contarDiasUteis(fD.inicio, fD.fim) - dias : 0;
    const periodoLabel = mesmoDia && periodo !== "dia" ? (periodo === "manha" ? " (Manhã)" : " (Tarde)") : "";
    const notaFinal = (emLetivo && isFerias ? (fN ? fN + " | " : "") + "⚠️ LETIVO (" + emLetivo + "): " + justLetivo : fN) + periodoLabel;
    let ficheiroData = null;
    if (ficheiro) { try { ficheiroData = await fileToBase64(ficheiro); } catch {} }

    try {
      // Férias: tipo decidido automaticamente (semanas completas = obrigatórias, soltos = bónus)
      let mot = motivo;
      if (isFerias) {
        mot = feriasAnalise.tipo === "bonus" ? "Férias (Bónus)" : "Férias (Obrigatórias)";
      }
      const notaIsolado = isFerias && feriasAnalise.isolado ? " [⚠️ DIAS ISOLADOS SEM BÓNUS]" : "";
      const resp = await apiPost({ action: "novoPedido", terapId: terap.ID, nome: terap.Nome, dataInicio: fD.inicio, dataFim: fD.fim, motivo: mot, nota: notaFinal + notaIsolado, periodo: mesmoDia ? periodo : "dia", ficheiro: ficheiroData });
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
            {isFerias && <div style={{ background: C.tealLight, padding: "10px 12px", borderRadius: 12, fontSize: 13, color: C.tealDark, fontWeight: 600, marginBottom: 16 }}>💡 Tens <strong>{metrics.oR + metrics.bR} dias de férias</strong> por marcar</div>}
            {isFerias && fechoNoPedido > 0 && (
              <div style={{ background: C.grayBg, padding: "10px 12px", borderRadius: 12, fontSize: 13, color: C.darkSoft, fontWeight: 600, marginBottom: 16, border: "1px solid " + C.grayLight }}>🔒 Este período inclui <strong>{fechoNoPedido} dia{fechoNoPedido > 1 ? "s" : ""} de fecho</strong> do CAIDI — já descontado{fechoNoPedido > 1 ? "s" : ""} automaticamente.</div>
            )}
            {isFerias && feriasAnalise.devExpandir && (
              <div style={{ background: C.redBg, padding: "12px 14px", borderRadius: 14, fontSize: 13, fontWeight: 600, marginBottom: 16, border: "1px solid #f5c6c0" }}>
                <div style={{ color: C.red }}>📅 Seleciona a semana completa</div>
                <div style={{ fontSize: 12, fontWeight: 500, color: C.darkSoft, marginTop: 4, lineHeight: 1.5 }}>
                  Estás a cobrir todos os teus dias de trabalho nesta semana. Como descansas uma semana inteira, seleciona de <strong>2ª a 6ª</strong>.
                </div>
                {feriasAnalise.semsParaCorrigir && feriasAnalise.semsParaCorrigir.map((s, i) => (
                  <div key={i} style={{ fontSize: 11, color: C.red, marginTop: 4, fontWeight: 700 }}>
                    → Seleciona {fmtDF(s.de)} a {fmtDF(s.ate)}
                  </div>
                ))}
              </div>
            )}
            {feriasAnalise.isolado && (
              <div style={{ background: C.yellowBg, padding: "12px 14px", borderRadius: 14, fontSize: 13, fontWeight: 600, marginBottom: 16, border: "1px solid #FDEBD0" }}>
                <div style={{ color: "#E17055" }}>⚠️ Dias isolados</div>
                <div style={{ fontSize: 12, fontWeight: 500, color: C.darkSoft, marginTop: 4, lineHeight: 1.5 }}>
                  Os teus dias de férias isolados já foram usados. As férias restantes devem ser marcadas em dias consecutivos (semanas completas, 2ª a 6ª).
                </div>
                {feriasAnalise.semIncompleta && feriasAnalise.semIncompleta.map((w, i) => (
                  <div key={i} style={{ fontSize: 11, color: C.darkSoft, marginTop: 3 }}>Semana de {fmtDF(w.weekOf)}: faltam {w.gaps.join(", ")}</div>
                ))}
                <div style={{ fontSize: 11, color: C.darkSoft, marginTop: 4, fontStyle: "italic" }}>Podes submeter, mas a gestão poderá rejeitar.</div>
              </div>
            )}
            {type === "baixa" && <div style={{ background: C.purpleBg, padding: "10px 12px", borderRadius: 12, fontSize: 13, color: C.purple, fontWeight: 600, marginBottom: 16 }}>🏥 A baixa <strong>não desconta</strong> férias. O objetivo ajusta-se.</div>}
            {type === "formacao" && <div style={{ background: C.orangeBg, padding: "10px 12px", borderRadius: 12, fontSize: 13, color: C.orange, fontWeight: 600, marginBottom: 16 }}>🎓 Formações <strong>não descontam</strong> férias nem o objetivo.</div>}
            {type === "falta" && motivo === "Falta Injustificada" && <div style={{ background: C.redBg, padding: "10px 12px", borderRadius: 12, fontSize: 13, color: C.red, fontWeight: 600, marginBottom: 16 }}>⚠️ Faltas injustificadas podem ter <strong>impacto na avaliação</strong>.</div>}
            {errMsg && <div style={{ background: C.redBg, color: C.red, padding: "8px 12px", borderRadius: 10, fontSize: 13, fontWeight: 600, marginBottom: 12 }}>⚠️ {errMsg}</div>}
            <Btn onClick={submit} disabled={sub || (isFerias && feriasAnalise.devExpandir)} variant={btnV[type]}>{sub ? "A enviar..." : (isFerias && feriasAnalise.devExpandir) ? "Ajusta as datas (2ª a 6ª)" : "Enviar pedido"}</Btn>
          </>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════ COMPENSATION FORM ═══════════════════════ */
function CompensationForm({ pedido, existingComps, onSubmit, onClose, onRefresh }) {
  const [perdidos, setPerdidos] = useState(() => {
    // Se já tem compensações, usar o valor existente
    const existing = (existingComps || []).filter(c => String(c.Linha_Ausencia) === String(pedido._linha));
    return existing.length > 0 && existing[0]["Apoios Perdidos"] ? String(existing[0]["Apoios Perdidos"]) : "";
  });
  const [crianca, setCrianca] = useState("");
  const [dia, setDia] = useState("");
  const [hora, setHora] = useState("");
  const [adding, setAdding] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [errMsg, setErrMsg] = useState("");
  const [removendo, setRemovendo] = useState(null);

  // Crianças já registadas para esta ausência
  const minhas = (existingComps || []).filter(c => String(c.Linha_Ausencia) === String(pedido._linha));
  const nComp = minhas.length;
  const pctCalc = perdidos > 0 && nComp > 0 ? Math.min(Math.round((nComp / Number(perdidos)) * 100), 100) : 0;
  const estado = minhas.length > 0 ? minhas[0].Estado : null;

  const addCrianca = async () => {
    if (!perdidos || Number(perdidos) <= 0) { setErrMsg("Indica primeiro quantos apoios perdeste"); return; }
    if (!crianca.trim()) { setErrMsg("Indica o nome da criança"); return; }
    if (!dia) { setErrMsg("Indica o dia"); return; }
    if (!hora) { setErrMsg("Indica a hora"); return; }
    setAdding(true); setErrMsg("");
    try {
      await apiPost({
        action: "registarCompensacao",
        linha: pedido._linha,
        terapId: pedido.ID_Terapeuta,
        nome: pedido.Nome,
        motivoAusencia: pedido.Motivo,
        dataAusencia: pedido["Data Início"],
        apoiosPerdidos: Number(perdidos),
        crianca: crianca.trim(),
        dia: dia,
        hora: hora
      });
      setCrianca(""); setDia(""); setHora("");
      onRefresh();
    } catch (err) { setErrMsg("Erro: " + err.message); }
    setAdding(false);
  };

  const removeCrianca = async (linhaComp) => {
    setRemovendo(linhaComp);
    try {
      await apiPost({ action: "removerCompensacao", linha: linhaComp });
      onRefresh();
    } catch (err) { setErrMsg("Erro: " + err.message); }
    setRemovendo(null);
  };

  const submeterParaAprovacao = async () => {
    if (nComp === 0) { setErrMsg("Adiciona pelo menos uma criança compensada"); return; }
    setSubmitting(true); setErrMsg("");
    try {
      await apiPost({
        action: "submeterCompensacao",
        linhaAusencia: pedido._linha,
        apoiosPerdidos: Number(perdidos),
        apoiosCompensados: nComp
      });
      onSubmit(pedido._linha, { "Compensação Estado": "Pendente", "Comp Apoios Perdidos": Number(perdidos), "Comp Apoios Compensados": nComp });
      setDone(true);
      setTimeout(onClose, 1800);
    } catch (err) { setErrMsg("Erro: " + err.message); }
    setSubmitting(false);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(45,52,54,0.5)", backdropFilter: "blur(4px)", zIndex: 100, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: C.white, borderRadius: "26px 26px 0 0", padding: "24px 20px 32px", width: "100%", maxWidth: 420, animation: "slideUp 0.3s ease", maxHeight: "90vh", overflowY: "auto" }}>
        {done ? (
          <div style={{ textAlign: "center", padding: "24px 0", animation: "pop 0.4s ease" }}><div style={{ fontSize: 48 }}>✅</div><div style={{ fontSize: 17, fontWeight: 800, color: C.green, marginTop: 10 }}>Enviado para aprovação!</div><div style={{ fontSize: 12, color: C.darkSoft, marginTop: 4 }}>{nComp}/{perdidos} apoios compensados ({pctCalc}%)</div></div>
        ) : (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h3 style={{ fontSize: 18, fontWeight: 900, color: C.dark, margin: 0 }}>🔄 Compensar ausência</h3>
              <button onClick={onClose} style={{ background: C.grayBg, border: "none", borderRadius: "50%", width: 32, height: 32, fontSize: 14, cursor: "pointer", color: C.darkSoft }}>✕</button>
            </div>

            {/* Info da ausência */}
            <div style={{ background: C.grayBg, borderRadius: 12, padding: "10px 12px", marginBottom: 10, fontSize: 12, color: C.darkSoft }}>
              <div style={{ fontWeight: 700, color: C.dark }}>{motivoInfo(pedido.Motivo).icon} {pedido.Motivo} · {fmtD(pedido["Data Início"])}{pedido["Data Início"] !== pedido["Data Fim"] ? " → " + fmtD(pedido["Data Fim"]) : ""}</div>
              <div style={{ marginTop: 2 }}>{pedido["Dias Úteis"]} dia(s) útil(eis)</div>
            </div>

            <div style={{ background: C.blueBg, borderRadius: 12, padding: "10px 12px", marginBottom: 12, fontSize: 12, color: C.blue, fontWeight: 600, lineHeight: 1.5 }}>
              💡 Compensa-se reagendando os apoios que ficaram por dar. Indica que crianças reagendaste e quando.
            </div>

            {/* Apoios perdidos */}
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 10, fontWeight: 700, color: C.gray, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 4 }}>Quantos apoios perdeste neste dia?</label>
              <input type="number" min="1" value={perdidos} onChange={e => setPerdidos(e.target.value)} placeholder="Ex: 6" disabled={nComp > 0} style={{ width: "100%", padding: 12, borderRadius: 12, border: "2px solid " + C.grayLight, fontSize: 16, fontWeight: 800, color: C.dark, background: nComp > 0 ? C.grayLight : C.grayBg, textAlign: "center", opacity: nComp > 0 ? 0.7 : 1 }} />
            </div>

            {/* Progresso */}
            {perdidos > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: C.dark }}>{nComp}/{perdidos} compensados</span>
                  <span style={{ padding: "3px 12px", borderRadius: 12, background: pctCalc >= 100 ? C.greenBg : pctCalc >= 50 ? C.yellowBg : C.redBg, color: pctCalc >= 100 ? C.green : pctCalc >= 50 ? "#E17055" : C.red, fontSize: 13, fontWeight: 900 }}>{pctCalc}%</span>
                </div>
                <div style={{ height: 8, background: C.grayLight, borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ height: "100%", borderRadius: 4, width: pctCalc + "%", background: pctCalc >= 100 ? C.green : pctCalc >= 50 ? C.yellow : C.red, transition: "width 0.5s ease" }} />
                </div>
              </div>
            )}

            {/* Lista de crianças já adicionadas */}
            {minhas.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                {minhas.map((c, i) => (
                  <div key={c._linha || i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: i % 2 === 0 ? C.grayBg : C.white, borderRadius: 10, marginBottom: 3 }}>
                    <span style={{ fontSize: 16 }}>👶</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: C.dark, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.Criança || c.crianca || "?"}</div>
                      <div style={{ fontSize: 11, color: C.darkSoft }}>{c.Dia ? fmtDF(c.Dia) : ""}{c.Hora ? " · " + c.Hora : ""}</div>
                    </div>
                    {estado !== "Pendente" && estado !== "Aprovado" && (
                      <button onClick={() => removeCrianca(c._linha)} disabled={removendo === c._linha} style={{ background: C.white, border: "1px solid " + C.grayLight, borderRadius: 8, width: 28, height: 28, fontSize: 11, cursor: "pointer", color: C.red, flexShrink: 0, opacity: removendo === c._linha ? 0.4 : 1 }}>✕</button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Formulário para adicionar criança */}
            {estado !== "Pendente" && estado !== "Aprovado" && perdidos > 0 && (
              <div style={{ background: C.tealLight, borderRadius: 14, padding: "12px 12px 14px", marginBottom: 12, border: "1px solid " + C.tealSoft }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: C.tealDark, marginBottom: 8 }}>➕ Adicionar criança compensada</div>
                <input type="text" value={crianca} onChange={e => setCrianca(e.target.value)} placeholder="Nome da criança" style={{ width: "100%", padding: 10, borderRadius: 10, border: "2px solid " + C.white, fontSize: 13, color: C.dark, background: C.white, marginBottom: 6 }} />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 8 }}>
                  <input type="date" value={dia} onChange={e => setDia(e.target.value)} style={{ padding: 10, borderRadius: 10, border: "2px solid " + C.white, fontSize: 12, color: C.dark, background: C.white }} />
                  <input type="time" value={hora} onChange={e => setHora(e.target.value)} style={{ padding: 10, borderRadius: 10, border: "2px solid " + C.white, fontSize: 12, color: C.dark, background: C.white }} />
                </div>
                <button onClick={addCrianca} disabled={adding} style={{ width: "100%", padding: 10, borderRadius: 10, border: "none", background: C.teal, color: C.white, fontSize: 13, fontWeight: 700, cursor: adding ? "default" : "pointer", opacity: adding ? 0.6 : 1 }}>{adding ? "A adicionar..." : "➕ Adicionar"}</button>
              </div>
            )}

            {errMsg && <div style={{ background: C.redBg, color: C.red, padding: "8px 12px", borderRadius: 10, fontSize: 12, fontWeight: 600, marginBottom: 12 }}>⚠️ {errMsg}</div>}

            {/* Botão submeter */}
            {estado !== "Pendente" && estado !== "Aprovado" && nComp > 0 && (
              <Btn onClick={submeterParaAprovacao} disabled={submitting} variant="primary">{submitting ? "A enviar..." : "📤 Submeter para aprovação (" + nComp + "/" + perdidos + ")"}</Btn>
            )}
            {estado === "Pendente" && (
              <div style={{ textAlign: "center", padding: "10px 0", fontSize: 13, fontWeight: 700, color: "#E17055" }}>⏳ Já submetido — a aguardar aprovação</div>
            )}
            {estado === "Aprovado" && (
              <div style={{ textAlign: "center", padding: "10px 0", fontSize: 13, fontWeight: 700, color: C.green }}>✅ Compensação aprovada!</div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════ THERAPIST VIEW ═══════════════════════ */
function TherapistView({ data, terap, onLogout, onRefresh, onAddAusencia, onEditAusencia }) {
  const [tab, setTab] = useState("inicio");
  const [showForm, setShowForm] = useState(null);
  const [editPedido, setEditPedido] = useState(null);
  const [cancelando, setCancelando] = useState(null);
  const [quadIdx, setQuadIdx] = useState(null); // null = atual
  const [showComp, setShowComp] = useState(null); // pedido a compensar
  const aus = data.ausencias.filter(a => a.ID_Terapeuta === terap.ID);
  const ap = data.resumoApoios && data.resumoApoios[String(terap.ID)] ? data.resumoApoios[String(terap.ID)].ef : 0;
  const m = calc(terap, ap, aus, data.periodos, data.fecho, data.horarios, data.alteracoes, data.compensacoes);
  m._allAus = aus; // Pass all absences for week-gap detection in form
  const saudePedidos = aus.filter(a => !a.Motivo.includes("Férias")).sort((a, b) => (b["Data Pedido"]||"").localeCompare(a["Data Pedido"]||""));
  const todosPedidos = [...aus].sort((a, b) => (b["Data Pedido"]||"").localeCompare(a["Data Pedido"]||""));
  const pend = aus.filter(p => p.Estado === "Pendente").length;
  const handleSubmit = (n) => { onAddAusencia(n); onRefresh(); };
  const handleCancel = async (pedido) => {
    if (!confirm("Tens a certeza que queres cancelar este pedido?")) return;
    setCancelando(pedido._linha);
    try {
      await apiPost({ action: "cancelarPedido", linha: pedido._linha });
      onEditAusencia(pedido._linha, { Estado: "Cancelado" });
      onRefresh();
    } catch (err) { alert("Erro: " + err.message); }
    setCancelando(null);
  };
  const handleEdit = async (pedido, novosDados) => {
    try {
      await apiPost({ action: "editarPedido", linha: pedido._linha, dataInicio: novosDados.inicio, dataFim: novosDados.fim, nota: novosDados.nota });
      const dias = contarDiasUteis(novosDados.inicio, novosDados.fim);
      onEditAusencia(pedido._linha, { "Data Início": novosDados.inicio, "Data Fim": novosDados.fim, "Dias Úteis": dias, Observações: novosDados.nota, Estado: "Pendente" });
      onRefresh();
    } catch (err) { alert("Erro: " + err.message); throw err; }
  };
  const isADM = terap["Área"] === "ADM";
  const tabs = [{ id: "inicio", icon: "🏠", l: "Início" }, ...(!isADM ? [{ id: "objetivo", icon: "🎯", l: "Objetivo" }] : []), { id: "ferias", icon: "🌴", l: "Férias" }, { id: "ausencias", icon: "📑", l: "Ausências" }, { id: "pedidos", icon: "📋", l: "Pedidos" }];
  const q = m.quad;

  // Métricas para um quadrimestre específico (para navegação)
  const calcQuad = (qx) => {
    if (!qx) return m;
    const hojeStr = new Date().toISOString().slice(0, 10);
    const fallbackHL = Number(terap["Horas Letivas"]) || 0;
    const fallbackHS = Number(terap["Horas Semanais"]) || 40;
    const altList = getAlteracoesTerap(data.alteracoes, terap.ID);
    const dLetivoTotal = contarDiasUteis(qx.letivoInicio, qx.letivoFim);
    const dQuadTotal = contarDiasUteis(qx.qInicio, qx.qFim);
    const dQuadHoje = contarDiasUteis(qx.qInicio, hojeStr > qx.qFim ? qx.qFim : hojeStr);
    const dLetivoHoje = contarDiasUteis(qx.letivoInicio, hojeStr > qx.letivoFim ? qx.letivoFim : hojeStr);
    const dExtraTotal = Math.max(dQuadTotal - dLetivoTotal, 0);
    const ausQ = aus.filter(a => a.Estado === "Aprovado" && a["Data Início"] <= qx.qFim && a["Data Fim"] >= qx.qInicio);
    const dB = ausQ.filter(a => a.Motivo === "Baixa Médica").reduce((s, a) => s + Number(a["Dias Úteis"] || 0), 0);
    const obj = calcObjetivoDiario(altList, qx.letivoInicio, qx.letivoFim, dB, fallbackHL, fallbackHS);
    const mMin = obj.mMin;
    const hLD = obj.hLDMedia;
    const hSem = obj.hSMedia;
    const mE3 = obj.mE3;
    const mBonus = Math.round(mMin * 0.85);
    const mE2 = Math.round(mMin * 1.05);
    const progQuad = dQuadTotal > 0 ? dQuadHoje / dQuadTotal : 1;
    const progLetivo = dLetivoTotal > 0 ? dLetivoHoje / dLetivoTotal : 1;
    const mH = Math.round(mMin * progQuad);
    const resumoT = data.resumoApoios && data.resumoApoios[String(terap.ID)] || { ef: 0, efPorQuad: {} };
    const ef = resumoT.efPorQuad && resumoT.efPorQuad[qx.label] ? resumoT.efPorQuad[qx.label] : (qx === q ? ap : 0);
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
            {/* Frase motivacional */}
            {!isADM && (() => {
              const hoje = new Date();
              const dia = hoje.getDate() + hoje.getMonth() * 31;
              const frases = [
                { msg: "Existimos para garantir que nenhuma criança fica sem apoio pela sua condição socioeconómica. Esta é a nossa missão.", cta: "Cada criança que entra pela nossa porta traz consigo uma família inteira a acreditar que vai correr bem. Esta confiança é o nosso maior motor." },
                { msg: "Muitas das nossas famílias não têm alternativa. Para elas, o CAIDI não é uma opção. É a resposta.", cta: "Quando dás o teu melhor numa sessão, estás a mudar a história de alguém que não tinha outra opção." },
                { msg: "Não escolhemos as crianças pelo que as famílias podem pagar. Escolhemos todas. Porque todas merecem o melhor.", cta: "Cada sessão que fazes com dedicação é a prova de que o acesso à qualidade não depende do dinheiro." },
                { msg: "Há sessões que parecem pequenas. Mas para a criança que está do outro lado, aqueles 45 minutos são um momento muito importante da semana.", cta: "Tu és a pessoa que aquela criança procura com os olhos quando chega. Isso não se ensina. Conquista-se." },
                { msg: "Cada relatório que escrevemos abre portas. Cada sessão que fazemos muda o rumo de uma família.", cta: "Há famílias que mudaram de rumo por causa de um relatório teu, de uma sessão tua. Tu fizeste isso." },
                { msg: "Por trás de cada número na app, há uma criança real, uma família real, uma história real.", cta: "Cada número que vês aqui tem um rosto. Esse rosto sorriu porque estiveste lá." },
                { msg: "Uma sessão que não acontece é uma criança que espera mais uma semana. Para ela, uma semana é muito tempo.", cta: "Cada vez que entras naquela sala, lembra-te: aquela criança esteve a semana inteira à tua espera." },
                { msg: "Há crianças em lista de espera. Cada vaga que preenchemos é uma família que deixa de esperar por ajuda.", cta: "Se vires que um lugar pode ser libertado, diz. Há quem esteja à espera de uma oportunidade que tu podes abrir." },
                { msg: "O nosso trabalho vai além da terapia. Damos dignidade, damos oportunidade, damos futuro.", cta: "Tu não és só terapeuta. És a primeira pessoa que disse àquela família: vamos conseguir juntos. Isso muda tudo." },
                { msg: "Somos uma equipa. O que cada um faz afeta todos, principalmente as crianças que dependem de nós.", cta: "Se algo não está a correr bem contigo, não guardes. Pedir ajuda não é fraqueza. É cuidar de quem cuida." },
                { msg: "Escolheste trabalhar com crianças. Escolheste fazer a diferença. Isso diz tudo sobre ti.", cta: "Podias estar em qualquer lado. Escolheste estar aqui, com estas crianças, com estas famílias. Isso faz de ti alguém especial." },
                { msg: "Às vezes o cansaço pesa. Mas depois uma criança sorri, uma mãe agradece, e lembras-te do porquê.", cta: "Cuida de ti para poderes cuidar dos outros. O teu bem-estar também faz parte da missão." },
                { msg: "O CAIDI é onde se faz diferente. Mais rigor, mais coração, mais resultados. Não é por acaso que as famílias nos procuram.", cta: "Cada sessão tua mantém essa reputação viva. Tens orgulho no que fazemos? Nós também." },
                { msg: "As nossas avaliações são referência porque não olhamos só para uma área. Cruzamos olhares, partilhamos entre disciplinas, e por isso conseguimos ver para além da superfície.", cta: "Quando falas com uma colega de outra área sobre um caso, estás a dar àquela criança uma avaliação aprofundada e rica." },
                { msg: "Inovar é encontrar uma nova forma de chegar a uma criança que ninguém conseguiu alcançar.", cta: "Se tens uma ideia diferente, experimenta. As melhores soluções do CAIDI nasceram de alguém que tentou de outra forma." },
                { msg: "Não nos contentamos com suficiente. Queremos que cada criança saia daqui melhor do que qualquer um esperava.", cta: "Esse padrão de excelência não vem de nenhum manual. Vem de nós. É por isso que somos quem somos." },
                { msg: "O CAIDI cresceu por causa de pessoas como tu. Pessoas que não desistem, que estudam mais, que querem fazer melhor.", cta: "Continua a querer mais. A procurar formação e a partilhar com a equipa. É assim que nos mantemos à frente." },
                { msg: "Um bom diagnóstico não nasce de uma pessoa sozinha. Nasce quando juntamos o que cada um sabe.", cta: "Quando procuras a tua colega para perceber melhor um caso, não estás a pedir ajuda. Estás a fazer o que os melhores profissionais fazem." },
                { msg: "As famílias que nos procuram muitas vezes já passaram por outros sítios. Escolheram ficar connosco. Isso diz muito sobre o teu trabalho.", cta: "Essa confiança constrói-se sessão a sessão. És tu que a constróis." },
                { msg: "Há crianças que chegam aqui e um dia fazem algo que ninguém acreditava ser possível. Não foi sorte. Foi o teu trabalho, sessão após sessão, que fez isso acontecer.", cta: "Esses momentos não aparecem em nenhum relatório. Mas são a razão de tudo." },
                { msg: "Queremos ser sempre melhores. Não por obrigação, mas porque cada criança merece a melhor versão de nós.", cta: "Viste algo numa formação que te fez pensar? Leste um artigo que te mudou a forma de ver um caso? Partilha. É assim que crescemos juntos." },
                { msg: "Há dias em que sentes que não fizeste o suficiente. Mas a mãe que te agradeceu à porta sabe que fizeste.", cta: "Confia no teu trabalho. Tu sabes mais do que pensas e fazes mais do que imaginas." },
                { msg: "A maioria das nossas sessões acontece nas escolas. Estás lá dentro, no contexto real da criança. Isto é uma vantagem enorme.", cta: "Aproveita esta proximidade. Uma conversa de dois minutos com a docente depois da sessão pode valer mais do que horas de relatórios." },
                { msg: "Tens à tua volta colegas com experiências e conhecimentos diferentes dos teus.", cta: "Quando sentes que um caso te desafia, lembra-te: a resposta pode estar na sala ao lado. Usa a equipa. É para isso que cá estamos." },
                { msg: "A supervisão é o teu espaço para pensar, duvidar e crescer com quem já passou pelo mesmo.", cta: "Aproveita cada momento de supervisão e tutoria. É tempo que tens para ti, para o teu desenvolvimento. Nem todos os profissionais têm essa oportunidade." },
                { msg: "A intervisão é um espaço de crescimento. É onde descobres que a tua colega já resolveu exactamente aquilo que te está a tirar o sono.", cta: "Partilha os teus casos difíceis. Ouve os dos outros. Sais sempre de lá com algo novo." },
                { msg: "Não tens de saber tudo. Tens de saber a quem perguntar. Aqui dentro, há sempre alguém que pode ajudar.", cta: "Pedir ajuda e partilhar uma preocupação com a equipa pode ser uma maneira de dar a cada criança e à sua família o melhor que temos." },
                { msg: "Há profissionais que trabalham sozinhos sem nunca terem uma supervisão. Tu tens acesso a supervisão, tutoria e intervisão todas as semanas.", cta: "Isto não é um extra. É o que te permite ser melhor do que serias sem a equipa. Aproveita cada minuto." },
              ];
              const frase = frases[dia % frases.length];

              return (
                <Card delay={0} style={{ marginBottom: 8, background: "linear-gradient(135deg, " + C.tealLight + ", " + C.white + ")", border: "1px solid " + C.tealSoft, position: "relative", overflow: "hidden" }}>
                  <div style={{ position: "absolute", top: -15, right: -15, width: 60, height: 60, borderRadius: "50%", background: C.teal + "08" }} />
                  <div style={{ fontSize: 10, fontWeight: 800, color: C.tealDark, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>🤝 CAIDI</div>
                  <div style={{ fontSize: 13, color: C.dark, lineHeight: 1.7, marginBottom: 6 }}>
                    {frase.msg}
                  </div>
                  <div style={{ fontSize: 14, color: C.tealDark, fontWeight: 800, lineHeight: 1.6, marginBottom: 10, background: "rgba(0,168,157,0.08)", padding: "8px 10px", borderRadius: 10, borderLeft: "3px solid " + C.teal }}>
                    {frase.cta}
                  </div>
                </Card>
              );
            })()}



            {!isADM && (
            <Card delay={0}>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <Ring value={m.ef} max={m.mMin} size={96} stroke={9} color={m.sc}>
                  <div style={{ fontSize: 22, fontWeight: 900, color: C.dark, lineHeight: 1 }}>{m.pM}%</div>
                  <div style={{ fontSize: 9, color: C.gray, fontWeight: 700, textTransform: "uppercase" }}>do objetivo</div>
                </Ring>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                    <div><div style={{ fontSize: 24, fontWeight: 900, color: C.dark, lineHeight: 1 }}>{m.ef}</div><div style={{ fontSize: 11, color: C.gray }}>realizados</div></div>
                    <div style={{ textAlign: "right" }}><div style={{ fontSize: 24, fontWeight: 900, color: C.grayLight, lineHeight: 1 }}>{m.mMin}</div><div style={{ fontSize: 11, color: C.gray }}>objetivo</div></div>
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

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginTop: 8 }}>
              {[{ i: "🌴", v: (m.fU + m.bU) + "/" + ((Number(terap["Dias Férias"]) || 22) + m.dBn), l: "férias", c: C.teal }, { i: "🏥", v: m.dB, l: "baixa", c: m.dB > 0 ? C.purple : C.teal }, ...(!isADM ? [{ i: "🎓", v: m.dFO, l: "form.", c: C.orange }] : [{ i: "📋", v: m.dFJ + m.dFI, l: "faltas", c: m.dFI > 0 ? C.red : C.blue }])].map((x, idx) => (
                <Card key={idx} delay={0.1 + idx * 0.03} style={{ padding: 10, textAlign: "center" }}>
                  <div style={{ fontSize: 8, color: C.gray, fontWeight: 700, textTransform: "uppercase" }}>{x.i}</div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: x.c, lineHeight: 1.3 }}>{x.v}</div>
                  <div style={{ fontSize: 9, color: C.gray }}>{x.l}</div>
                </Card>
              ))}
            </div>

            {m.dFI > 0 && <Card delay={0.2} style={{ marginTop: 8, background: C.redBg, border: "1px solid #f5c6c0", padding: 12 }}><div style={{ display: "flex", alignItems: "center", gap: 8 }}><span>⚠️</span><span style={{ fontSize: 13, fontWeight: 700, color: C.red }}>{m.dFI} falta{m.dFI > 1 ? "s" : ""} injustificada{m.dFI > 1 ? "s" : ""}</span></div></Card>}

            {/* ═══ CONTEÚDO ADM ═══ */}
            {isADM && (() => {
              const hSemanais = Number(terap["Horas Semanais"]) || 0;
              const diasFerias = Number(terap["Dias Férias"]) || 22;
              const hojeStr = new Date().toISOString().slice(0, 10);
              
              // Próximo fecho CAIDI
              const proximoFecho = data.fecho.filter(f => f["Data Fim"] >= hojeStr).sort((a, b) => (a["Data Início"] || "").localeCompare(b["Data Início"] || ""))[0];
              
              // Frase do dia (mesma rotação dos terapeutas)
              const dia = new Date().getDate();
              const frasesADM = [
                "O CAIDI existe porque há quem, nos bastidores, garanta que tudo funciona. O trabalho administrativo é a base que sustenta tudo o resto.",
                "Cada documento tratado, cada agenda organizada, cada resposta dada a tempo — tudo isso permite que as crianças recebam o apoio que precisam.",
                "Sem uma equipa administrativa forte, nenhuma organização funciona. O teu trabalho faz diferença todos os dias.",
                "A organização, o rigor e a eficiência são pilares do CAIDI. E isso começa contigo.",
                "Há famílias que dependem de nós. O teu trabalho garante que conseguimos dar-lhes resposta.",
              ];
              const frase = frasesADM[dia % frasesADM.length];

              return (
                <>
                  {/* Frase do dia */}
                  <Card delay={0.1} style={{ marginTop: 8, background: "linear-gradient(135deg, " + C.tealLight + ", " + C.white + ")", border: "1px solid " + C.tealSoft }}>
                    <div style={{ fontSize: 10, fontWeight: 800, color: C.tealDark, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>🤝 Equipa CAIDI</div>
                    <div style={{ fontSize: 13, color: C.dark, lineHeight: 1.7 }}>{frase}</div>
                  </Card>

                  {/* O teu contrato */}
                  <Card delay={0.15} style={{ marginTop: 8 }}>
                    <div style={{ fontSize: 10, fontWeight: 800, color: C.darkSoft, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>📄 O teu contrato</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      {[
                        ["Horas semanais", hSemanais + "h", C.dark],
                        ["Dias de férias (total)", diasFerias + "d", C.teal],
                        ["Férias usadas", m.fU + "d", C.darkSoft],
                        ["Férias por marcar", m.oR + "d", m.oR <= 3 ? C.red : C.green],
                        ["Bónus ganhos", m.dBn + "d", C.green],
                        ["Bónus por marcar", m.bR + "d", m.bR > 0 ? C.green : C.gray],
                        ["Dias de baixa", m.dB + "d", m.dB > 0 ? C.purple : C.gray],
                        ["Faltas justificadas", m.dFJ + "d", C.blue],
                        ["Faltas injustificadas", m.dFI + "d", m.dFI > 0 ? C.red : C.gray],
                        ["Formações", m.dFO + "d", m.dFO > 0 ? C.orange : C.gray],
                      ].map(([label, val, color], i) => (
                        <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 10px", background: i % 2 === 0 ? C.grayBg : C.white, borderRadius: 8 }}>
                          <span style={{ fontSize: 12, color: C.darkSoft }}>{label}</span>
                          <span style={{ fontSize: 13, fontWeight: 800, color }}>{val}</span>
                        </div>
                      ))}
                    </div>
                  </Card>

                  {/* Próximo fecho */}
                  {proximoFecho && (
                    <Card delay={0.2} style={{ marginTop: 8, background: "linear-gradient(135deg, " + C.purpleBg + ", " + C.white + ")", border: "1px solid #e0d6ff" }}>
                      <div style={{ fontSize: 10, fontWeight: 800, color: C.purple, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>🏢 Próximo fecho CAIDI</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ fontSize: 32 }}>📅</div>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 800, color: C.dark }}>{proximoFecho.Nome}</div>
                          <div style={{ fontSize: 12, color: C.darkSoft }}>{fmtDF(proximoFecho["Data Início"])}{proximoFecho["Data Início"] !== proximoFecho["Data Fim"] ? " → " + fmtDF(proximoFecho["Data Fim"]) : ""}</div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: C.purple, marginTop: 2 }}>{proximoFecho["Dias Úteis"]} dias úteis</div>
                        </div>
                      </div>
                    </Card>
                  )}
                </>
              );
            })()}

            {!isADM && (
            <div style={{ marginTop: 8 }}>
              {m.ef < m.mBonus ? (
                <Card delay={0.22} style={{ background: "linear-gradient(135deg, " + C.yellowBg + ", " + C.white + ")", border: "1px solid #FDEBD0" }}><div style={{ display: "flex", alignItems: "center", gap: 10 }}><span style={{ fontSize: 28, animation: "float 3s ease infinite" }}>🌴</span><div><div style={{ fontSize: 14, fontWeight: 800, color: "#E17055" }}>Faltam-te {m.mBonus - m.ef} apoios para o Dia Extra!</div><div style={{ fontSize: 12, color: C.darkSoft }}>85% do objetivo = +1 dia de férias</div></div></div></Card>
              ) : m.ef < m.mMin ? (
                <Card delay={0.22} style={{ background: "linear-gradient(135deg, " + C.greenBg + ", " + C.white + ")", border: "1px solid #b2f5ea" }}><div style={{ display: "flex", alignItems: "center", gap: 10 }}><span style={{ fontSize: 28, animation: "float 3s ease infinite" }}>🌴</span><div><div style={{ fontSize: 14, fontWeight: 800, color: C.green }}>Dia Extra garantido! ✅</div><div style={{ fontSize: 12, color: C.darkSoft }}>Faltam {m.mMin - m.ef} para o objetivo mínimo</div></div></div></Card>
              ) : m.ef < m.mE2 ? (
                <Card delay={0.22} style={{ background: "linear-gradient(135deg, " + C.tealLight + ", " + C.white + ")", border: "1px solid " + C.tealSoft }}><div style={{ display: "flex", alignItems: "center", gap: 10 }}><span style={{ fontSize: 28, animation: "float 3s ease infinite" }}>🎯</span><div><div style={{ fontSize: 14, fontWeight: 800, color: C.tealDark }}>Objetivo cumprido! Faltam {m.mE2 - m.ef} para os 5€/apoio</div><div style={{ fontSize: 12, color: C.darkSoft }}>Cada apoio extra a partir daí = 5€</div></div></div></Card>
              ) : m.ef < m.mE3 ? (
                <Card delay={0.22} style={{ background: "linear-gradient(135deg, " + C.greenBg + ", " + C.white + ")", border: "1px solid #b2f5ea" }}><div style={{ display: "flex", alignItems: "center", gap: 10 }}><span style={{ fontSize: 28, animation: "float 3s ease infinite" }}>💰</span><div><div style={{ fontSize: 14, fontWeight: 800, color: C.green }}>A ganhar 5€/apoio! Já tens +{m.eurosTotal}€</div><div style={{ fontSize: 12, color: C.darkSoft }}>Faltam {m.mE3 - m.ef} para os 10€/apoio</div></div></div></Card>
              ) : (
                <Card delay={0.22} style={{ background: "linear-gradient(135deg, #FFF9E6, " + C.white + ")", border: "1px solid #FDEBD0" }}><div style={{ display: "flex", alignItems: "center", gap: 10 }}><span style={{ fontSize: 28, animation: "float 3s ease infinite" }}>⭐</span><div><div style={{ fontSize: 14, fontWeight: 800, color: "#E17055" }}>A ganhar 10€/apoio! Já tens +{m.eurosTotal}€</div><div style={{ fontSize: 12, color: C.darkSoft }}>Máximo atingido — continua!</div></div></div></Card>
              )}
            </div>
            )}

            {/* ═══ ASSIDUIDADE ═══ */}
            {!isADM && (
            <Card delay={0.26} style={{ marginTop: 8, background: m.assiduidadeOk ? "linear-gradient(135deg, " + C.greenBg + ", " + C.white + ")" : "linear-gradient(135deg, " + C.yellowBg + ", " + C.white + ")", border: "1px solid " + (m.assiduidadeOk ? "#b2f5ea" : "#FDEBD0") }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ position: "relative" }}>
                  <Ring value={m.pctAssiduidade} max={100} size={52} stroke={5} color={m.assiduidadeOk ? C.green : C.yellow}>
                    <span style={{ fontSize: 12, fontWeight: 900, color: m.assiduidadeOk ? C.green : "#E17055" }}>{m.pctAssiduidade}%</span>
                  </Ring>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: m.assiduidadeOk ? C.green : "#E17055" }}>
                    {m.assiduidadeOk ? "✅ Assiduidade OK — +1 dia de férias!" : "Assiduidade: " + m.pctAssiduidade + "% (falta ≥95%)"}
                  </div>
                  <div style={{ fontSize: 11, color: C.darkSoft, marginTop: 2 }}>
                    {m.faltasEfetivas > 0 ? m.faltasEfetivas + " falta" + (m.faltasEfetivas !== 1 ? "s" : "") + " efetiva" + (m.faltasEfetivas !== 1 ? "s" : "") + (m.diasCompensados > 0 ? " (" + Math.round(m.diasCompensados) + "d compensado" + (m.diasCompensados !== 1 ? "s" : "") + ")" : "") : "Sem faltas neste período"}
                  </div>
                </div>
              </div>
            </Card>
            )}

            {/* Férias marcadas com mini-calendário */}
            {(() => {
              const hoje = new Date();
              const hojeStr = hoje.getFullYear() + "-" + String(hoje.getMonth() + 1).padStart(2, "0") + "-" + String(hoje.getDate()).padStart(2, "0");
              const anoAtual = String(hoje.getFullYear());
              const anoInicio = anoAtual + "-01-01";
              const anoFim = anoAtual + "-12-31";
              
              // Férias aprovadas no ano civil atual
              const todasFerias = aus.filter(a => 
                (a.Motivo === "Férias (Obrigatórias)" || a.Motivo === "Férias (Bónus)") && 
                a.Estado === "Aprovado" &&
                a["Data Início"] <= anoFim && a["Data Fim"] >= anoInicio
              ).sort((a, b) => (a["Data Início"] || "").localeCompare(b["Data Início"] || ""));
              
              // Fecho CAIDI no ano civil atual
              const fechoCAIDI = (data.fecho || []).filter(f => 
                f["Data Início"] <= anoFim && f["Data Fim"] >= anoInicio
              );
              
              // Férias pendentes no ano civil atual
              const feriasPendentes = aus.filter(a => 
                (a.Motivo === "Férias (Obrigatórias)" || a.Motivo === "Férias (Bónus)") && 
                a.Estado === "Pendente" &&
                a["Data Início"] <= anoFim && a["Data Fim"] >= anoInicio
              );
              
              if (todasFerias.length === 0 && fechoCAIDI.length === 0) return null;
              
              // Construir set de dias de férias
              const diasFerias = new Set();
              const diasFecho = new Set();
              const diasPendentes = new Set();
              
              // Helper para formatar data sem timezone issues
              const fmtYMD = (d) => {
                const yy = d.getFullYear();
                const mm = String(d.getMonth() + 1).padStart(2, "0");
                const dd = String(d.getDate()).padStart(2, "0");
                return yy + "-" + mm + "-" + dd;
              };
              
              // Férias aprovadas
              todasFerias.forEach(f => {
                const d = new Date(f["Data Início"] + "T12:00:00");
                const fim = new Date(f["Data Fim"] + "T12:00:00");
                while (d <= fim) {
                  if (d.getDay() !== 0 && d.getDay() !== 6) {
                    diasFerias.add(fmtYMD(d));
                  }
                  d.setDate(d.getDate() + 1);
                }
              });
              
              // Férias pendentes
              feriasPendentes.forEach(f => {
                const d = new Date(f["Data Início"] + "T12:00:00");
                const fim = new Date(f["Data Fim"] + "T12:00:00");
                while (d <= fim) {
                  if (d.getDay() !== 0 && d.getDay() !== 6) {
                    diasPendentes.add(fmtYMD(d));
                  }
                  d.setDate(d.getDate() + 1);
                }
              });
              
              // Fecho CAIDI
              fechoCAIDI.forEach(f => {
                const d = new Date(f["Data Início"] + "T12:00:00");
                const fim = new Date(f["Data Fim"] + "T12:00:00");
                while (d <= fim) {
                  if (d.getDay() !== 0 && d.getDay() !== 6) {
                    diasFecho.add(fmtYMD(d));
                  }
                  d.setDate(d.getDate() + 1);
                }
              });
              
              // Mostrar sempre todos os 12 meses do ano civil
              const mesesOrdenados = [];
              for (let mm = 1; mm <= 12; mm++) {
                mesesOrdenados.push(anoAtual + "-" + String(mm).padStart(2, "0"));
              }
              
              const nomeMes = (ym) => {
                const [y, m] = ym.split("-");
                const nomes = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
                return nomes[parseInt(m) - 1];
              };
              
              const diasNoMes = (ym) => {
                const [y, m] = ym.split("-");
                return new Date(parseInt(y), parseInt(m), 0).getDate();
              };
              
              const primeiroDiaSemana = (ym) => {
                const [y, mm] = ym.split("-");
                const d = new Date(parseInt(y), parseInt(mm) - 1, 1, 12, 0, 0).getDay();
                return d === 0 ? 6 : d - 1; // Segunda = 0
              };

              return (
                <Card delay={0.25} style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: C.teal, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>📅 As tuas férias · {anoAtual}</div>
                  
                  {/* Legenda */}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 10, fontSize: 10 }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: C.green, display: "inline-block" }} /> Aprovadas</span>
                    <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: C.yellow, display: "inline-block" }} /> Pendentes</span>
                    <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: C.gray, display: "inline-block" }} /> Fecho</span>
                    <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: C.blue, display: "inline-block" }} /> Feriado</span>
                    <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 3, border: "2px solid " + C.dark, background: "transparent", display: "inline-block" }} /> Hoje</span>
                  </div>
                  
                  {/* Calendários */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    {mesesOrdenados.map(ym => {
                      const total = diasNoMes(ym);
                      const offset = primeiroDiaSemana(ym);
                      const cells = [];
                      const mesAtual = hojeStr.substring(0, 7) === ym;
                      const mesPassado = ym < hojeStr.substring(0, 7);
                      
                      // Verificar se este mês tem algo marcado
                      let temAlgo = false;
                      
                      // Células vazias para offset
                      for (let i = 0; i < offset; i++) cells.push(null);
                      // Dias do mês
                      for (let d = 1; d <= total; d++) {
                        const ds = ym + "-" + String(d).padStart(2, "0");
                        const dow = new Date(ds + "T12:00:00").getDay();
                        const isWe = dow === 0 || dow === 6;
                        const isFerias = diasFerias.has(ds);
                        const isFecho = diasFecho.has(ds);
                        const isPendente = diasPendentes.has(ds);
                        const isHoje = ds === hojeStr;
                        const isFeriadoNac = FERIADOS_NACIONAIS.has(ds);
                        const isFeriadoMun = m.feriadoMun && ds === m.feriadoMun;
                        if (isFerias || isFecho || isPendente || isFeriadoNac || isFeriadoMun) temAlgo = true;
                        cells.push({ d, ds, isWe, isFerias, isFecho, isPendente, isHoje, isFeriadoNac, isFeriadoMun });
                      }
                      
                      return (
                        <div key={ym} style={{ opacity: mesPassado && !temAlgo ? 0.35 : 1 }}>
                          <div style={{ fontSize: 11, fontWeight: 800, color: mesAtual ? C.teal : C.dark, marginBottom: 3 }}>{nomeMes(ym)}</div>
                          {/* Cabeçalho dias da semana */}
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, textAlign: "center" }}>
                            {["S", "T", "Q", "Q", "S", "S", "D"].map((dl, i) => (
                              <div key={i} style={{ fontSize: 7, fontWeight: 700, color: i >= 5 ? C.grayLight : C.gray, padding: "1px 0" }}>{dl}</div>
                            ))}
                            {cells.map((c, i) => {
                              if (!c) return <div key={"e" + i} />;
                              const bg = c.isFecho ? C.gray : c.isFerias ? C.green : c.isPendente ? C.yellow : (c.isFeriadoNac || c.isFeriadoMun) ? C.blue : "transparent";
                              const color = (c.isFecho || c.isFerias || c.isFeriadoNac || c.isFeriadoMun) ? C.white : c.isPendente ? C.dark : c.isWe ? C.grayLight : C.darkSoft;
                              const fw = (c.isFecho || c.isFerias || c.isPendente || c.isHoje || c.isFeriadoNac || c.isFeriadoMun) ? 800 : 400;
                              const border = c.isHoje ? "2px solid " + C.dark : "2px solid transparent";
                              return (
                                <div key={c.ds} style={{ fontSize: 9, fontWeight: fw, color, background: bg, borderRadius: 3, padding: "1px 0", lineHeight: 1.5, border, position: "relative" }}>
                                  {c.d}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  
                  {/* Lista resumida */}
                  {todasFerias.filter(f => f["Data Fim"] >= hojeStr).length > 0 && (
                    <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid " + C.grayLight }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        {todasFerias.filter(f => f["Data Fim"] >= hojeStr).map((f, i) => {
                          const mi = motivoInfo(f.Motivo);
                          const ativa = hojeStr >= f["Data Início"] && hojeStr <= f["Data Fim"];
                          return (
                            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", background: ativa ? C.greenBg : C.grayBg, borderRadius: 8 }}>
                              <span style={{ fontSize: 14 }}>{mi.icon}</span>
                              <div style={{ flex: 1 }}>
                                <span style={{ fontSize: 12, fontWeight: 700, color: C.dark }}>{fmtD(f["Data Início"])}{f["Data Início"] !== f["Data Fim"] ? " → " + fmtD(f["Data Fim"]) : ""}</span>
                                <span style={{ fontSize: 10, color: C.darkSoft, marginLeft: 6 }}>{f["Dias Úteis"]}d{f.Observações ? " · " + f.Observações : ""}</span>
                              </div>
                              {ativa && <span style={{ fontSize: 9, fontWeight: 800, color: C.green, background: C.white, padding: "2px 6px", borderRadius: 4 }}>Agora</span>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </Card>
              );
            })()}

            {pend > 0 && <Card delay={0.28} style={{ marginTop: 8, background: C.yellowBg, border: "1px solid #FDEBD0" }}><div style={{ display: "flex", alignItems: "center", gap: 8 }}><span>⏳</span><span style={{ fontSize: 13, fontWeight: 700, color: C.red, flex: 1 }}>{pend} pendente{pend > 1 ? "s" : ""}</span><button onClick={() => setTab("pedidos")} style={{ background: C.red + "15", border: "none", borderRadius: 8, padding: "5px 10px", fontSize: 11, fontWeight: 700, color: C.red, cursor: "pointer" }}>Ver →</button></div></Card>}
          </div>
        )}

        {/* ═══ TAB OBJETIVO ═══ */}
        {tab === "objetivo" && !isADM && (
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
                O teu objetivo é calculado com base nos <strong>{mq.dLetivoTotal} dias do período letivo</strong> ({viewQuad ? viewQuad.periodo : "—"}). É nestes dias que deves, idealmente, cumprir os apoios.
              </div>
              <div style={{ fontSize: 13, color: C.darkSoft, lineHeight: 1.7, marginTop: 6 }}>
                Mas tens <strong>o quadrimestre inteiro</strong> ({mq.dQuadTotal} dias úteis) para os atingir. Os <strong>{mq.dExtraTotal} dias extra</strong> fora do letivo são a tua margem — para recuperar ou ultrapassar o objetivo.
              </div>
            </Card>

            {/* Barra visual dupla: letivo + margem */}
            <Card delay={0.08} style={{ marginTop: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.darkSoft, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>📊 Tempo e objetivo</div>
              
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
                  <span style={{ color: mq.sc, fontWeight: 700 }}>{mq.pM}% do objetivo</span>
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
                  <div style={{ fontSize: 10, color: C.gray, fontWeight: 700, textTransform: "uppercase" }}>{mq.passado ? "Objetivo" : "Esperado"}</div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: mq.diff >= 0 ? C.green : C.red }}>{mq.passado ? mq.mMin : mq.mH}</div>
                </div>
                <div style={{ padding: 10, background: C.tealLight, borderRadius: 12 }}>
                  <div style={{ fontSize: 10, color: C.gray, fontWeight: 700, textTransform: "uppercase" }}>Objetivo total</div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: C.teal }}>{mq.mMin}</div>
                </div>
              </div>
              <div style={{ marginTop: 10, padding: "8px 12px", borderRadius: 10, background: mq.diff >= 0 ? C.greenBg : C.yellowBg, textAlign: "center" }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: mq.diff >= 0 ? C.green : C.red }}>
                  {mq.passado ? (mq.ef >= mq.mMin ? "✅ Objetivo atingida!" : "❌ Objetivo não atingido") : (mq.diff >= 0 ? "🟢 +" + mq.diff + " à frente do ritmo" : "🔴 " + Math.abs(mq.diff) + " abaixo do ritmo")}
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
                <div style={{ fontSize: 11, color: C.gray, fontWeight: 700 }}>OBJETIVO = ({mq.dLetivoTotal}{mq.dB > 0 ? " − " + mq.dB : ""}) × {mq.hLD.toFixed(1)}h</div>
                <div style={{ fontSize: 28, fontWeight: 900, color: C.teal }}>{mq.mMin}</div>
              </div>
            </Card>

            {/* Análise semanal de produtividade */}
            <Card delay={0.17} style={{ marginTop: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.darkSoft, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>📊 O teu ritmo real</div>
              {(() => {
                const hLetivas = Math.round(mq.hLD * 5 * 100) / 100; // média ponderada do quadrimestre
                const hSemanais = Math.round(mq.hSem * 5 * 100) / 100;
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
                const aphColor = apoiosPorHora >= 1.0 ? C.green : apoiosPorHora >= 0.90 ? C.tealDark : apoiosPorHora >= 0.75 ? "#d4a017" : apoiosPorHora >= 0.50 ? C.orange : C.red;
                const aphBg = apoiosPorHora >= 1.0 ? C.greenBg : apoiosPorHora >= 0.90 ? C.tealLight : apoiosPorHora >= 0.75 ? C.yellowBg : apoiosPorHora >= 0.50 ? C.orangeBg : C.redBg;
                // Quanto tempo direto fica sem apoios registados
                const horasDiretasPorSemana = apoiosSemana; // ~1 apoio = ~1 hora
                const tempoLivre = Math.max(hLetivas - horasDiretasPorSemana, 0);

                return (
                  <div>
                    {/* Dois indicadores principais */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
                      <div style={{ padding: 12, background: aphBg, borderRadius: 14, textAlign: "center" }}>
                        <div style={{ fontSize: 9, color: C.gray, fontWeight: 700, textTransform: "uppercase" }}>Média semanal</div>
                        <div style={{ fontSize: 28, fontWeight: 900, color: aphColor, lineHeight: 1.2 }}>{apoiosSemana}</div>
                        <div style={{ fontSize: 10, color: C.darkSoft }}>apoios / semana</div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: C.gray, marginTop: 2 }}>objetivo: {metaSemanal}</div>
                      </div>
                      <div style={{ padding: 12, background: aphBg, borderRadius: 14, textAlign: "center" }}>
                        <div style={{ fontSize: 9, color: C.gray, fontWeight: 700, textTransform: "uppercase" }}>Rendimento</div>
                        <div style={{ fontSize: 28, fontWeight: 900, color: aphColor, lineHeight: 1.2 }}>{apoiosPorHora}</div>
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
                        Em <strong>{hLetivas}h diretas</strong>, o esperado é pelo menos <strong>1 apoio por hora direta</strong> — ou seja, ~{metaSemanal} apoios por semana.
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
                        ["Apoios por hora direta", apoiosPorHora, aphColor],
                      ].map(([label, val, color], i) => (
                        <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "5px 10px", background: i % 2 === 0 ? C.grayBg : C.white, borderRadius: 8 }}>
                          <span style={{ fontSize: 12, color: C.darkSoft }}>{label}</span>
                          <span style={{ fontSize: 13, fontWeight: 800, color }}>{val}</span>
                        </div>
                      ))}
                    </div>

                    {/* Mensagem pessoal por prémio */}
                    <div style={{ marginTop: 10 }}>
                      {(() => {
                        const nome = terap.Nome.split(" ")[0];
                        const aph = Number(apoiosPorHora);
                        const acimaObjetivo = mq.ef >= mq.mMin;
                        const acimaE2 = mq.ef >= mq.mE2;
                        const acimaE3 = mq.ef >= mq.mE3;
                        const pct = mq.mMin > 0 ? Math.round((mq.ef / mq.mMin) * 100) : 100;
                        
                        // Badges
                        const badges = [];
                        if (acimaE3) badges.push({ icon: "💎", label: "10€ por apoio", desc: "Patamar máximo!" });
                        else if (acimaE2) badges.push({ icon: "💰", label: "5€ por apoio", desc: "Cada apoio extra = 5€" });
                        if (acimaObjetivo && mq.ef >= mq.mBonus) badges.push({ icon: "🌴", label: "Dia Extra garantido", desc: "+1 dia de férias" });
                        if (aph >= 1.2) badges.push({ icon: "⚡", label: "Alta eficiência", desc: aph + " apoios/hora direta" });

                        // 🔴 CRÍTICO < 0.5
                        if (aph < 0.5) return (
                          <div>
                            <div style={{ padding: "14px", background: C.redBg, borderRadius: "14px 14px 0 0", border: "1px solid #f5c6c0", borderBottom: "none" }}>
                              <div style={{ fontSize: 15, fontWeight: 900, color: C.red, marginBottom: 8 }}>{nome}, estás a {aph} apoios por hora direta.</div>
                              <div style={{ fontSize: 13, color: C.dark, lineHeight: 1.7 }}>
                                Em {semanasDecorridas} semanas com {horasLetivasTrabalhadas}h de tempo direto realizaste {mq.ef} apoios. Precisamos de perceber o que se passa. Contacta a coordenação para conversarmos.
                              </div>
                            </div>
                            <div style={{ padding: "10px 14px", background: C.grayBg, borderRadius: "0 0 14px 14px", border: "1px solid " + C.grayLight }}>
                              <div style={{ fontSize: 10, color: C.gray, fontStyle: "italic" }}>Este alerta constitui um aviso formal e fica registado no teu histórico de desempenho.</div>
                            </div>
                          </div>
                        );

                        // 🟠 SÉRIO 0.5 - 0.75
                        if (aph < 0.75) return (
                          <div>
                            <div style={{ padding: "14px", background: C.orangeBg, borderRadius: "14px 14px 0 0", border: "1px solid #f5c6c0", borderBottom: "none" }}>
                              <div style={{ fontSize: 15, fontWeight: 900, color: C.orange, marginBottom: 8 }}>{nome}, estás a {aph} apoios por hora direta.</div>
                              <div style={{ fontSize: 13, color: C.dark, lineHeight: 1.7 }}>
                                Em {semanasDecorridas} semanas com {horasLetivasTrabalhadas}h de tempo direto realizaste {mq.ef} apoios. Há alguma razão para estares abaixo? Precisamos que fales com a coordenação para percebermos o que se passa e como podemos ajudar.
                              </div>
                            </div>
                            <div style={{ padding: "10px 14px", background: C.grayBg, borderRadius: "0 0 14px 14px", border: "1px solid " + C.grayLight }}>
                              <div style={{ fontSize: 10, color: C.gray, fontStyle: "italic" }}>Este registo fica associado ao teu histórico de desempenho.</div>
                            </div>
                          </div>
                        );

                        // 🟡 ABAIXO 0.75 - 0.90
                        if (aph < 0.90) return (
                          <div style={{ padding: "14px", background: C.yellowBg, borderRadius: 14, border: "1px solid #FDEBD0" }}>
                            <div style={{ fontSize: 15, fontWeight: 900, color: "#d4a017", marginBottom: 8 }}>{nome}, estás a {aph} apoios por hora direta.</div>
                            <div style={{ fontSize: 13, color: C.dark, lineHeight: 1.7 }}>
                              Em {semanasDecorridas} semanas com {horasLetivasTrabalhadas}h de tempo direto realizaste {mq.ef} apoios. Se há algo a afetar os teus resultados, fala com a coordenação para encontrarmos solução.
                            </div>
                          </div>
                        );

                        // 🟢 QUASE 0.90 - 1.0 (verde claro)
                        if (aph < 1.0) return (
                          <div style={{ padding: "14px", background: C.tealLight, borderRadius: 14, border: "1px solid " + C.tealSoft }}>
                            <div style={{ fontSize: 15, fontWeight: 900, color: C.tealDark, marginBottom: 8 }}>
                              {nome}, estás a {aph} apoios por hora direta. Falta pouco.
                            </div>
                            <div style={{ fontSize: 13, color: C.dark, lineHeight: 1.7 }}>
                              Se sentes que algo está a afetar os teus números, fala com a coordenação para encontrarmos solução juntos.
                            </div>
                          </div>
                        );

                        // 🟢 ACIMA >= 1.0
                        return (
                          <div>
                            <div style={{ padding: "14px", background: acimaE2 ? "linear-gradient(135deg, #FFF9E6, " + C.greenBg + ")" : C.greenBg, borderRadius: badges.length > 0 ? "14px 14px 0 0" : 14, border: "1px solid " + (acimaE2 ? "#FDEBD0" : "#b2f5ea"), borderBottom: badges.length > 0 ? "none" : undefined }}>
                              <div style={{ fontSize: 15, fontWeight: 900, color: acimaE3 ? "#E17055" : acimaE2 ? "#d4a017" : C.green }}>
                                {acimaE3 ? "💎" : acimaE2 ? "⭐" : "✅"} {nome}, {acimaE3 ? "estás a dar o exemplo!" : acimaE2 ? "estás acima do objetivo!" : "estás a cumprir!"} 
                              </div>
                              <div style={{ fontSize: 13, color: C.dark, marginTop: 6, lineHeight: 1.7 }}>
                                <strong>{aph} apoios por hora direta</strong> e <strong>{apoiosSemana} por semana</strong> — {pct}% do objetivo. {acimaE3 ? "O teu esforço é notável e faz toda a diferença. A equipa agradece o teu compromisso." : acimaE2 ? "Estás a ir além do esperado e a equipa beneficia disso. Cada apoio extra conta." : "O teu contributo faz diferença e está a ajudar a equipa a cumprir a sua missão. Obrigado pelo teu compromisso. Continua assim."}
                              </div>
                              {mq.eurosTotal > 0 && (
                                <div style={{ marginTop: 8, padding: "6px 10px", background: "rgba(255,255,255,0.7)", borderRadius: 8, display: "inline-block" }}>
                                  <span style={{ fontSize: 12, fontWeight: 800, color: "#E17055" }}>💶 +{mq.eurosTotal}€ acumulados este quadrimestre</span>
                                </div>
                              )}
                            </div>
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
                  </div>
                );
              })()}
            </Card>

            {/* Objetivos */}
            <Card delay={0.2} style={{ marginTop: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.darkSoft, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>⭐ Objetivos</div>
              {[
                { l: "🌴 Dia Extra", desc: "85% do objetivo", v: mq.mBonus, icon: "🌴", active: mq.ef >= mq.mBonus, color: C.green },
                { l: "🎯 Objetivo", desc: "100%", v: mq.mMin, icon: "🎯", active: mq.ef >= mq.mMin, color: C.teal },
                { l: "💰 5€ por apoio", desc: "Objetivo + 5%", v: mq.mE2, icon: "💰", active: mq.ef >= mq.mE2, color: C.green },
                { l: "⭐ 10€ por apoio", desc: "H. semanais + 5%", v: mq.mE3, icon: "⭐", active: mq.ef >= mq.mE3, color: "#E17055" },
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
              {(() => {
                const totalDias = (Number(terap["Dias Férias"]) || 22) + m.dBn;
                const marcados = m.fU + m.bU;
                const restam = Math.max(totalDias - marcados, 0);
                return (
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: C.dark }}>🌴 Dias de férias</span>
                      <span style={{ fontSize: 14, fontWeight: 800, color: C.teal }}>{marcados}/{totalDias}</span>
                    </div>
                    <div style={{ height: 10, background: C.grayLight, borderRadius: 6, overflow: "hidden", display: "flex" }}>
                      {m.tF > 0 && <div style={{ width: Math.min(totalDias > 0 ? (m.tF / totalDias) * 100 : 0, 100) + "%", background: C.gray, height: "100%" }} />}
                      {(marcados - m.tF) > 0 && <div style={{ width: Math.min(totalDias > 0 ? ((marcados - m.tF) / totalDias) * 100 : 0, 100) + "%", background: C.teal, height: "100%" }} />}
                    </div>
                    <div style={{ fontSize: 10, color: C.darkSoft, marginTop: 4 }}>
                      {m.tF > 0 && <span>⬛ Fecho ({m.tF}d) · </span>}
                      <span style={{ fontWeight: 700, color: restam <= 3 ? C.red : C.green }}>Restam {restam}d</span>
                      <span style={{ color: C.gray }}> · {(Number(terap["Dias Férias"]) || 22)} + {m.dBn} bónus</span>
                    </div>
                  </div>
                );
              })()}
            </Card>
            <div style={{ fontSize: 10, color: C.gray, textAlign: "center", marginTop: 6, fontStyle: "italic" }}>Os primeiros 22 dias são contabilizados como férias legais.</div>
            <div style={{ marginTop: 10 }}><Btn onClick={() => setShowForm("ferias")}>📝 Pedir Férias</Btn></div>
            {m.feriadoMun && (
              <Card delay={0.08} style={{ marginTop: 10, background: "linear-gradient(135deg, " + C.blueBg + ", " + C.white + ")", border: "1px solid #b8d4e3" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 24 }}>🏛️</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: C.blue }}>Feriado municipal</div>
                    <div style={{ fontSize: 12, color: C.darkSoft }}>{fmtDF(m.feriadoMun)} — não desconta férias</div>
                  </div>
                </div>
              </Card>
            )}
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
                {(() => { const compLinhas = (data.compensacoes || []).filter(c => String(c.Linha_Ausencia) === String(p._linha)); const nC = compLinhas.length; const perdidos = nC > 0 && compLinhas[0]["Apoios Perdidos"] ? Number(compLinhas[0]["Apoios Perdidos"]) : 0; const pct = perdidos > 0 ? Math.round((nC / perdidos) * 100) : 0; const est = p["Compensação Estado"]; if (est === "Aprovado") return <div style={{ marginTop: 4, fontSize: 11, fontWeight: 700, color: C.green }}>🔄 Compensada {pct}% ({nC}/{perdidos})</div>; if (est === "Pendente") return <div style={{ marginTop: 4, fontSize: 11, fontWeight: 700, color: "#E17055" }}>⏳ Compensação pendente ({nC}/{perdidos})</div>; if (nC > 0) return <div style={{ marginTop: 4, fontSize: 11, fontWeight: 700, color: C.teal }}>🔄 Em curso: {nC}/{perdidos}</div>; return null; })()}
              </Card>
            ); })}
          </div>
        )}

        {/* ═══ TAB PEDIDOS ═══ */}
        {tab === "pedidos" && (
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 900, color: C.dark, margin: "0 0 12px" }}>Todos os pedidos</h2>
            {todosPedidos.length === 0 ? <Card><div style={{ textAlign: "center", padding: 20, color: C.gray }}><div style={{ fontSize: 36 }}>📋</div><div style={{ fontSize: 14, marginTop: 6 }}>Sem pedidos</div></div></Card>
            : todosPedidos.map((p, i) => { const mi = motivoInfo(p.Motivo); const e = EST[p.Estado] || EST.Pendente; const hojeStr = new Date().toISOString().slice(0, 10); const passado = p["Data Início"] <= hojeStr; const canEdit = !passado && p.Estado === "Pendente"; const canCancel = !passado && (p.Estado === "Pendente" || p.Estado === "Aprovado"); return (
              <Card key={i} delay={i * 0.03} style={{ marginBottom: 8, borderLeft: "4px solid " + mi.color, borderRadius: "4px 20px 20px 4px", opacity: p.Estado === "Cancelado" ? 0.5 : 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div><div style={{ fontSize: 14, fontWeight: 800, color: C.dark }}>{fmtD(p["Data Início"])}{p["Data Início"] !== p["Data Fim"] ? " → " + fmtD(p["Data Fim"]) : ""}</div><div style={{ fontSize: 11, color: C.darkSoft, marginTop: 2 }}>{mi.icon} {mi.short} · {fmtDias(p["Dias Úteis"], p["Período"])}</div></div>
                  <span style={{ background: e.bg, color: e.c, padding: "3px 9px", borderRadius: 8, fontSize: 11, fontWeight: 700 }}>{e.icon} {e.l}</span>
                </div>
                {p.Observações && <div style={{ fontSize: 12, color: C.darkSoft, fontStyle: "italic", marginTop: 4 }}>"{p.Observações}"</div>}
                {p["Resposta Gestão"] && <div style={{ fontSize: 12, marginTop: 4, padding: "6px 10px", borderRadius: 8, background: p.Estado === "Rejeitado" ? C.redBg : C.greenBg, color: p.Estado === "Rejeitado" ? C.red : C.green, fontWeight: 600 }}>💬 Gestão: {p["Resposta Gestão"]}</div>}
                <FileBadge url={p.Ficheiro} />
                {(canEdit || canCancel) && (
                  <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                    {canEdit && <button onClick={() => setEditPedido(p)} style={{ flex: 1, padding: "7px 0", borderRadius: 10, border: "1.5px solid " + C.grayLight, background: C.white, fontSize: 11, fontWeight: 700, color: C.dark, cursor: "pointer" }}>✏️ Editar</button>}
                    {canCancel && <button onClick={() => handleCancel(p)} disabled={cancelando === p._linha} style={{ flex: 1, padding: "7px 0", borderRadius: 10, border: "1.5px solid " + C.grayLight, background: C.white, fontSize: 11, fontWeight: 700, color: C.red, cursor: cancelando === p._linha ? "default" : "pointer", opacity: cancelando === p._linha ? 0.5 : 1 }}>{cancelando === p._linha ? "..." : "🗑 Cancelar"}</button>}
                  </div>
                )}
                {passado && (p.Estado === "Pendente" || p.Estado === "Aprovado") && (
                  <div style={{ fontSize: 10, color: C.gray, marginTop: 6, fontStyle: "italic" }}>Data já passou. Para alterar, contacta a gestão.</div>
                )}
                {/* Compensação: mostrar estado ou botão */}
                {(() => {
                  const isCompensavel = p.Estado === "Aprovado" && passado && !p.Motivo.includes("Férias") && p.Motivo !== "Formação";
                  const compEstado = p["Compensação Estado"];
                  const compLinhas = (data.compensacoes || []).filter(c => String(c.Linha_Ausencia) === String(p._linha));
                  const nComp = compLinhas.length;
                  const perdidos = Number(p["Comp Apoios Perdidos"] || (compLinhas[0] && compLinhas[0]["Apoios Perdidos"]) || 0);
                  const pct = perdidos > 0 ? Math.round((nComp / perdidos) * 100) : 0;
                  const dentroPrazo = (() => { if (!p["Data Fim"]) return false; const fim = new Date(p["Data Fim"]); const agora = new Date(); const diff = (agora - fim) / (1000*60*60*24); return diff <= 10; })();
                  if (compEstado === "Aprovado") {
                    return <div style={{ marginTop: 6, padding: "6px 10px", borderRadius: 8, background: C.greenBg, fontSize: 11, fontWeight: 700, color: C.green }}>🔄 Compensação aprovada · {pct}% ({nComp}/{perdidos} apoios)</div>;
                  }
                  if (compEstado === "Pendente") {
                    return <div style={{ marginTop: 6, padding: "6px 10px", borderRadius: 8, background: C.yellowBg, fontSize: 11, fontWeight: 700, color: "#E17055" }}>⏳ Compensação pendente · {nComp}/{perdidos} apoios ({pct}%)</div>;
                  }
                  if (compEstado === "Rejeitado") {
                    return <div style={{ marginTop: 6, padding: "6px 10px", borderRadius: 8, background: C.redBg, fontSize: 11, fontWeight: 700, color: C.red }}>✕ Compensação rejeitada</div>;
                  }
                  // Em curso (tem linhas mas não submeteu)
                  if (nComp > 0 && dentroPrazo) {
                    return <button onClick={() => setShowComp(p)} style={{ marginTop: 6, width: "100%", padding: "8px 0", borderRadius: 10, border: "1.5px solid " + C.teal, background: C.tealLight, fontSize: 11, fontWeight: 700, color: C.tealDark, cursor: "pointer" }}>🔄 Em curso: {nComp}/{perdidos} · Continuar compensação</button>;
                  }
                  if (isCompensavel && dentroPrazo) {
                    return <button onClick={() => setShowComp(p)} style={{ marginTop: 6, width: "100%", padding: "8px 0", borderRadius: 10, border: "1.5px dashed " + C.teal, background: C.tealLight, fontSize: 11, fontWeight: 700, color: C.tealDark, cursor: "pointer" }}>🔄 Compensar esta ausência</button>;
                  }
                  if (isCompensavel && !dentroPrazo && nComp === 0) {
                    return <div style={{ marginTop: 6, fontSize: 10, color: C.gray, fontStyle: "italic" }}>Prazo de compensação expirado (10 dias)</div>;
                  }
                  return null;
                })()}
              </Card>
            ); })}
          </div>
        )}
      </div>

      {showForm && <AbsenceForm type={showForm} terap={terap} metrics={m} periodos={data.periodos} fecho={data.fecho} onSubmit={handleSubmit} onClose={() => setShowForm(null)} />}
      {editPedido && <EditPedidoForm pedido={editPedido} onSave={handleEdit} onClose={() => setEditPedido(null)} />}
      {showComp && <CompensationForm pedido={showComp} existingComps={data.compensacoes || []} onSubmit={(ln, compData) => { onEditAusencia(ln, compData); onRefresh(); }} onClose={() => setShowComp(null)} onRefresh={onRefresh} />}

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

  const handleComp = async (linhaAusencia, est) => {
    setUpd("comp" + linhaAusencia);
    try {
      await apiPost({ action: "validarCompensacao", linhaAusencia: linhaAusencia, estado: est });
      // Update local ausencia state
      const comps = (data.compensacoes || []).filter(c => String(c.Linha_Ausencia) === String(linhaAusencia));
      const nComp = comps.length;
      const perdidos = comps.length > 0 ? Number(comps[0]["Apoios Perdidos"] || 0) : 0;
      onUpdateEstado(linhaAusencia, null, null, { "Compensação Estado": est, "Comp Apoios Perdidos": perdidos, "Comp Apoios Compensados": nComp });
    } catch (err) { alert("Erro: " + err.message); }
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
  const compPendCount = (() => { const seen = new Set(); (data.compensacoes || []).filter(c => c.Estado === "Pendente").forEach(c => seen.add(c.Linha_Ausencia)); return seen.size; })();
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
    { id: "pendentes", icon: "⏳", l: "Pedidos", badge: pend.length + compPendCount },
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
                    const tFerMun = normFeriadoMun(t["Feriado Municipal"]);
                    if (tFerMun && dStr === tFerMun) return <div key={di} style={{ display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: C.blue, background: bgCol }} title="Feriado municipal">🏛️</div>;
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
              {[{ i: "✓", l: "Trabalha", c: C.green }, { i: "—", l: "S/horário", c: C.gray }, { i: "🔒", l: "Fecho", c: C.gray }, { i: "🏛️", l: "Fer.mun.", c: C.blue }, { i: "🌴", l: "Férias", c: C.teal }, { i: "🎁", l: "F. bónus", c: C.green }, { i: "🏥", l: "Baixa", c: C.purple }, { i: "📋", l: "Falta", c: C.blue }, { i: "⚠️", l: "F.Inj.", c: C.red }, { i: "🎓", l: "Form.", c: C.orange }].map((x, i) => (
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
                      const tFerMun = normFeriadoMun(t["Feriado Municipal"]);
                      if (tFerMun && dStr === tFerMun) return <div key={di} style={{ minWidth: 28, maxWidth: 28, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: C.blue, background: bgCol }} title="Feriado municipal">🏛️</div>;
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
              {[{ i: "✓", l: "Trabalha" }, { i: "—", l: "S/horário" }, { i: "🔒", l: "Fecho" }, { i: "🏛️", l: "Fer.mun." }, { i: "🌴", l: "Férias" }, { i: "🎁", l: "F. bónus" }, { i: "🏥", l: "Baixa" }, { i: "📋", l: "Falta" }, { i: "⚠️", l: "F.Inj." }, { i: "🎓", l: "Form." }].map((x, i) => (
                <span key={i} style={{ fontSize: 10, color: C.darkSoft, fontWeight: 600 }}>{x.i} {x.l}</span>
              ))}
            </div>
            <div style={{ display: "flex", gap: 12, marginTop: 4, padding: "0 4px" }}>
              <span style={{ fontSize: 10, color: C.darkSoft, fontWeight: 600 }}><span style={{ display: "inline-block", width: 12, height: 12, borderRadius: 3, background: "#FFF0F3", border: "1px solid #f5c6c0", verticalAlign: "middle", marginRight: 3 }} /> Letivo</span>
              <span style={{ fontSize: 10, color: C.darkSoft, fontWeight: 600 }}><span style={{ display: "inline-block", width: 12, height: 12, borderRadius: 3, background: "#F0FFF4", border: "1px solid #b2f5ea", verticalAlign: "middle", marginRight: 3 }} /> Não letivo</span>
            </div>

            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
              {[
                { label: "🌴 Exportar mapa de férias", filename: "Mapa_Ferias", filtro: "ferias" },
                { label: "📋 Exportar mapa de ausências", filename: "Mapa_Ausencias", filtro: "todas" },
              ].map((exp, ei) => (
              <Btn key={ei} onClick={async () => {
                if (!window.XLSX) {
                  const script = document.createElement("script");
                  script.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
                  document.head.appendChild(script);
                  await new Promise((res, rej) => { script.onload = res; script.onerror = rej; });
                }
                const XLSX = window.XLSX;
                const soFerias = exp.filtro === "ferias";
                
                const header = ["Terapeuta", ...diasMes.map(d => d.getDate() + "/" + (mesNum + 1)), "Total"];
                const rows = [header];
                const nDia = ["", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
                rows.push(["", ...diasMes.map(d => nDia[d.getDay()] || ""), ""]);
                
                data.terapeutas.forEach(t => {
                  const row = [t.Nome];
                  let totalDias = 0;
                  diasMesStr.forEach(dStr => {
                    const fecho = fechoDia(dStr);
                    if (fecho) {
                      if (soFerias) {
                        // Fecho conta como férias
                        const tHor = getHorario(data.horarios, t.ID);
                        const dObj = new Date(dStr);
                        if (tHor && !trabalhaDia(tHor, dObj.getDay())) { row.push("—"); return; }
                        row.push("FECHO"); totalDias++; return;
                      }
                      row.push("FECHO"); return;
                    }
                    const tHor = getHorario(data.horarios, t.ID);
                    const dObj = new Date(dStr);
                    if (tHor && !trabalhaDia(tHor, dObj.getDay())) { row.push("—"); return; }
                    const tFerMun = normFeriadoMun(t["Feriado Municipal"]);
                    if (tFerMun && dStr === tFerMun) { row.push("FER.MUN."); return; }
                    const aus = terapAusenteDia(t.ID, dStr);
                    if (aus) {
                      const isFerias = aus.Motivo.includes("Férias");
                      const isBaixaFalta = !isFerias;
                      if (soFerias && isBaixaFalta) { row.push(""); return; }
                      totalDias++;
                      if (aus.Motivo === "Férias (Bónus)") row.push("BÓNUS");
                      else if (isFerias) row.push("FÉRIAS");
                      else if (aus.Motivo === "Baixa Médica") row.push("BAIXA");
                      else if (aus.Motivo === "Falta Justificada") row.push("F.JUST");
                      else if (aus.Motivo === "Falta Injustificada") row.push("F.INJ");
                      else if (aus.Motivo === "Formação") row.push("FORM");
                      else row.push(aus.Motivo);
                      return;
                    }
                    row.push("");
                  });
                  row.push(totalDias);
                  rows.push(row);
                });
                
                const ws = XLSX.utils.aoa_to_sheet(rows);
                ws["!cols"] = [{ wch: 25 }, ...diasMes.map(() => ({ wch: 7 })), { wch: 6 }];
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, mesNomes[mesNum] + " " + mesAno);
                XLSX.writeFile(wb, exp.filename + "_" + mesNomes[mesNum] + "_" + mesAno + ".xlsx");
              }} variant="secondary" style={{ fontSize: 12 }}>{exp.label} · {mesNomes[mesNum]}</Btn>
              ))}
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
            const resumo = data.resumoApoios && data.resumoApoios[String(t.ID)] || { ef: 0, efPorQuad: {} };
            const efAtual = resumo.ef || 0;
            if (!qx) return calc(t, efAtual, aus2, data.periodos, data.fecho, data.horarios, data.alteracoes, data.compensacoes);
            // Para quadrimestre específico, usar efPorQuad
            const ef = resumo.efPorQuad && resumo.efPorQuad[qx.label] ? resumo.efPorQuad[qx.label] : (qx.label === (allQuads[currentIdx] || {}).label ? efAtual : 0);
            const fallbackHL = Number(t["Horas Letivas"]) || 0;
            const fallbackHS = Number(t["Horas Semanais"]) || 40;
            const altList = getAlteracoesTerap(data.alteracoes, t.ID);
            const dLT = contarDiasUteis(qx.letivoInicio, qx.letivoFim);
            const dQT = contarDiasUteis(qx.qInicio, qx.qFim);
            const dQH = contarDiasUteis(qx.qInicio, hojeStr > qx.qFim ? qx.qFim : hojeStr);
            const ausQ = aus2.filter(a => a.Estado === "Aprovado" && a["Data Início"] <= qx.qFim && a["Data Fim"] >= qx.qInicio);
            const dB = ausQ.filter(a => a.Motivo === "Baixa Médica").reduce((s, a) => s + Number(a["Dias Úteis"] || 0), 0);
            const obj = calcObjetivoDiario(altList, qx.letivoInicio, qx.letivoFim, dB, fallbackHL, fallbackHS);
            const mMin = obj.mMin;
            const hLD = obj.hLDMedia;
            const hSem = obj.hSMedia;
            const mE3 = obj.mE3;
            const mBonus = Math.round(mMin * 0.85);
            const mE2 = Math.round(mMin * 1.05);
            const progQ = dQT > 0 ? dQH / dQT : 1;
            const mH = Math.round(mMin * progQ);
            const pH = mH > 0 ? Math.round((ef / mH) * 100) : (ef > 0 ? 100 : 0);
            const pM = mMin > 0 ? Math.round((ef / mMin) * 100) : (ef > 0 ? 100 : 0);
            const euros5 = ef > mE2 ? Math.min(ef, mE3) - mE2 : 0;
            const euros10 = ef > mE3 ? ef - mE3 : 0;
            const eurosTotal = (euros5 * 5) + (euros10 * 10);
            const sc = pH >= 95 ? C.green : pH >= 80 ? C.yellow : C.red;
            const mBase = calc(t, efAtual, aus2, data.periodos, data.fecho, data.horarios, data.alteracoes, data.compensacoes);
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
                    {!tIsADM && m2.ef >= m2.mE3 && <div style={{ fontSize: 10, color: "#E17055", fontWeight: 800, marginTop: 2 }}>💎 10€ por apoio</div>}
                    {!tIsADM && m2.ef >= m2.mE2 && m2.ef < m2.mE3 && <div style={{ fontSize: 10, color: "#d4a017", fontWeight: 700, marginTop: 2 }}>⭐ 5€ por apoio</div>}
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0, fontSize: 10 }}>
                    {m2.diasTrab < 5 && <div title={m2.diasTrab + " dias/semana"}>📋 <span style={{ fontWeight: 800, color: C.blue }}>{m2.diasTrab}d/sem</span></div>}
                    <div>🌴 <span style={{ fontWeight: 800, color: (m2.oR + m2.bR) <= 3 ? C.red : C.teal }}>{m2.oR + m2.bR}d</span>{m2.bU > 0 && <span style={{ fontSize: 9, color: C.green, marginLeft: 3 }}>({m2.bU}b)</span>}</div>
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
            ) : pend.map((p, i) => { const t = data.terapeutas.find(x => x.ID === p.ID_Terapeuta); const mi = motivoInfo(p.Motivo); const isLetivo = p["Em Letivo?"] === "Sim" || (p.Observações && p.Observações.indexOf("⚠️ LETIVO") >= 0); const m2t = t ? calc(t, data.resumoApoios && data.resumoApoios[String(t.ID)] ? data.resumoApoios[String(t.ID)].ef : 0, data.ausencias.filter(a => a.ID_Terapeuta === t.ID), data.periodos, data.fecho, data.horarios, data.alteracoes, data.compensacoes) : null; return (
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
                      📋 {m2t.diasTrab}d/semana · Restam {m2t.oR + m2t.bR}d férias
                    </div>
                  )}
                  {m2t && p.Motivo.includes("Férias") && (
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 4, background: C.greenBg, color: C.green, padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 700, marginTop: 4, marginLeft: 4 }}>
                      🎁 Bónus: {m2t.bU}/{m2t.dBn} usados
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

            {/* ═══ COMPENSAÇÕES PENDENTES ═══ */}
            {(() => {
              // Agrupar compensações por Linha_Ausencia, só mostrar as Pendentes
              const allComp = data.compensacoes || [];
              const grouped = {};
              allComp.forEach(c => {
                const key = c.Linha_Ausencia;
                if (!grouped[key]) grouped[key] = [];
                grouped[key].push(c);
              });
              const pendGroups = Object.entries(grouped).filter(([_, comps]) => comps[0].Estado === "Pendente");
              if (pendGroups.length === 0) return null;
              return (
                <>
                  <h2 style={{ fontSize: 16, fontWeight: 900, color: C.dark, margin: "18px 0 10px" }}>🔄 Compensações pendentes <span style={{ background: C.blueBg, color: C.blue, padding: "2px 8px", borderRadius: 8, fontSize: 13, fontWeight: 800, marginLeft: 8 }}>{pendGroups.length}</span></h2>
                  {pendGroups.map(([linhaAus, comps], i) => {
                    const ausRef = data.ausencias.find(a => a._linha === Number(linhaAus));
                    const t = data.terapeutas.find(x => x.ID === comps[0].ID_Terapeuta);
                    const mi = ausRef ? motivoInfo(ausRef.Motivo) : { icon: "❓", color: C.gray, short: "?" };
                    const perdidos = Number(comps[0]["Apoios Perdidos"] || 0);
                    const nComp = comps.length;
                    const pct = perdidos > 0 ? Math.round((nComp / perdidos) * 100) : 0;
                    return (
                      <Card key={"comp" + i} delay={i * 0.05} style={{ marginBottom: 8, borderLeft: "4px solid " + C.blue, borderRadius: "4px 20px 20px 4px" }}>
                        <div style={{ marginBottom: 6 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div style={{ fontSize: 14, fontWeight: 800, color: C.dark }}>{t ? t.Nome : comps[0].ID_Terapeuta}</div>
                            <span style={{ background: mi.color + "18", color: mi.color, padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 700 }}>{mi.icon} {mi.short}</span>
                          </div>
                          {ausRef && <div style={{ fontSize: 12, color: C.darkSoft, marginTop: 2 }}>Ausência: {fmtDF(ausRef["Data Início"])} → {fmtDF(ausRef["Data Fim"])} · {ausRef["Dias Úteis"]}d</div>}
                        </div>
                        <div style={{ background: C.grayBg, borderRadius: 10, padding: "10px 12px", marginBottom: 8 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                            <span style={{ fontSize: 12, fontWeight: 800, color: C.dark }}>🔄 {nComp}/{perdidos} compensados</span>
                            <span style={{ padding: "3px 10px", borderRadius: 12, background: pct >= 100 ? C.greenBg : pct >= 50 ? C.yellowBg : C.redBg, color: pct >= 100 ? C.green : pct >= 50 ? "#E17055" : C.red, fontSize: 12, fontWeight: 900 }}>{pct}%</span>
                          </div>
                          {comps.map((c, j) => (
                            <div key={j} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderTop: j > 0 ? "1px solid " + C.grayLight : "none" }}>
                              <span style={{ fontSize: 14 }}>👶</span>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 13, fontWeight: 700, color: C.dark }}>{c["Criança"] || "?"}</div>
                                <div style={{ fontSize: 11, color: C.darkSoft }}>{c.Dia ? fmtDF(c.Dia) : ""}{c.Hora ? " · " + c.Hora : ""}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <Btn onClick={() => handleComp(Number(linhaAus), "Aprovado")} disabled={upd === "comp" + linhaAus} variant="success" style={{ flex: 1, padding: 10 }}>✓ Validar</Btn>
                          <Btn onClick={() => handleComp(Number(linhaAus), "Rejeitado")} disabled={upd === "comp" + linhaAus} variant="danger" style={{ flex: 1, padding: 10 }}>✕ Rejeitar</Btn>
                        </div>
                      </Card>
                    );
                  })}
                </>
              );
            })()}
          </div>
        )}
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
                const ap2 = data.resumoApoios && data.resumoApoios[String(t.ID)] ? data.resumoApoios[String(t.ID)].ef : 0;
                const m2 = calc(t, ap2, a2, data.periodos, data.fecho, data.horarios, data.alteracoes, data.compensacoes);
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
                          <div style={{ fontSize: 8, color: C.gray, fontWeight: 700, textTransform: "uppercase" }}>🌴 Férias</div>
                          <div style={{ fontSize: 18, fontWeight: 900, color: (m2.oR + m2.bR) <= 3 ? C.red : C.teal }}>{m2.oR + m2.bR}</div>
                          <div style={{ fontSize: 9, color: C.gray }}>restam</div>
                        </div>
                        <div style={{ padding: 8, background: C.white, borderRadius: 10 }}>
                          <div style={{ fontSize: 8, color: C.gray, fontWeight: 700, textTransform: "uppercase" }}>🎁 Bónus</div>
                          <div style={{ fontSize: 18, fontWeight: 900, color: C.green }}>{m2.bU}/{m2.dBn}</div>
                          <div style={{ fontSize: 9, color: C.gray }}>usados</div>
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
                          📋 Trabalha {m2.diasTrab} dias/semana
                        </div>
                      )}
                      {!tIsADM && (
                        <div style={{ marginTop: 8, padding: "6px 10px", background: C.white, borderRadius: 8, fontSize: 11, color: C.darkSoft }}>
                          🎯 Objetivo: <strong>{m2.ef}/{m2.mMin}</strong> ({m2.pM}%){m2.eurosTotal > 0 ? " · 💶 +" + m2.eurosTotal + "€" : ""}
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

/* ═══════════════════════ ERROR BOUNDARY ═══════════════════════ */
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F7F9FA", padding: 24, fontFamily: "sans-serif" }}>
          <div style={{ background: "#fff", borderRadius: 20, padding: 24, maxWidth: 400, width: "100%", boxShadow: "0 4px 20px rgba(0,0,0,0.08)" }}>
            <div style={{ fontSize: 36, textAlign: "center", marginBottom: 12 }}>⚠️</div>
            <h2 style={{ fontSize: 16, fontWeight: 800, textAlign: "center", margin: "0 0 8px", color: "#2D3436" }}>Algo correu mal</h2>
            <div style={{ background: "#FFEAEA", borderRadius: 12, padding: "10px 14px", fontSize: 12, color: "#E17055", wordBreak: "break-all", marginBottom: 16 }}>
              {String(this.state.error)}
            </div>
            <button onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }} style={{ width: "100%", padding: 12, borderRadius: 14, border: "none", background: "linear-gradient(135deg, #00A89D, #008F86)", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
              🔄 Recarregar
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function AppInner() {
  const [user, setUser] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const r = await apiGet("tudo");
      // Enriquecer ausências com dados de compensação (agrupados)
      if (r.compensacoes && r.compensacoes.length > 0) {
        const compGrouped = {};
        r.compensacoes.forEach(c => {
          const key = String(c.Linha_Ausencia);
          if (!compGrouped[key]) compGrouped[key] = { linhas: [], estado: c.Estado, perdidos: Number(c["Apoios Perdidos"] || 0) };
          compGrouped[key].linhas.push(c);
          compGrouped[key].estado = c.Estado;
        });
        r.ausencias = r.ausencias.map(a => {
          const grupo = compGrouped[String(a._linha)];
          if (!grupo) return a;
          return { ...a, "Compensação Estado": grupo.estado, "Comp Apoios Perdidos": grupo.perdidos, "Comp Apoios Compensados": grupo.linhas.length };
        });
      }
      setData(r);
    } catch (err) { setError(err.message || "Erro desconhecido"); setData(null); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  const refresh = () => fetchData();
  const addAus = (n) => setData(p => ({ ...p, ausencias: [...p.ausencias, { ...n, _linha: p.ausencias.length + 2 }] }));
  const updEst = (ln, est, obs, extra) => setData(p => ({ ...p, ausencias: p.ausencias.map(a => a._linha === ln ? { ...a, ...(est ? { Estado: est } : {}), ...(obs ? { "Resposta Gestão": obs } : {}), ...(extra || {}) } : a) }));
  const editAus = (ln, changes) => setData(p => ({ ...p, ausencias: p.ausencias.map(a => a._linha === ln ? { ...a, ...changes } : a) }));

  if (loading) return <Loading />;
  if (error || !data) return <ErrorScreen error={error || "Sem dados"} onRetry={fetchData} />;
  if (!user) return <Login terapeutas={data.terapeutas} config={data.config || {}} onLogin={(id, adm) => setUser({ id, isAdmin: adm })} />;
  if (user.isAdmin) return <AdminView data={data} onLogout={() => setUser(null)} onRefresh={refresh} onUpdateEstado={updEst} />;
  const t = data.terapeutas.find(x => x.ID === user.id);
  if (!t) { setUser(null); return null; }
  return <TherapistView data={data} terap={t} onLogout={() => setUser(null)} onRefresh={refresh} onAddAusencia={addAus} onEditAusencia={editAus} />;
}

export default function App() {
  return <ErrorBoundary><AppInner /></ErrorBoundary>;
}
