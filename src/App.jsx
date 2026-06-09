import { useState, useEffect, useRef, useContext, createContext, useMemo } from "react";
import { supabase } from "./supabase";

// ─── Constants ────────────────────────────────────────────────────────────────
const WEEKLY_GOAL   = 62500;
const TERMINE_GOAL  = 8;
const MILESTONES    = [25, 50, 75, 100];

// Theme only stays in localStorage (it's personal, not shared)
const STORAGE_KEY_THEME = "kredit-tracker-theme";
function lsGet(key)        { try { return localStorage.getItem(key);  } catch { return null; } }
function lsSet(key, value) { try { localStorage.setItem(key, value);  } catch {} }

// ─── Theme Palettes ───────────────────────────────────────────────────────────
const LIGHT = {
  red:         "#E2001A",
  redDark:     "#B80016",
  redLight:    "#FDECEA",
  yellow:      "#FFCC00",
  yellowLight: "#FFFBEA",
  bgCard:      "#FFFFFF",
  bgPage:      "#F5F5F5",
  bgInput:     "#F0F0F0",
  border:      "#E0E0E0",
  text:        "#333333",
  textSub:     "#666666",
  textMuted:   "#999999",
  success:     "#2E7D32",
  successBg:   "#E8F5E9",
  purple:      "#7B1FA2",
  purpleLight: "#F3E5F5",
  blue:        "#1565C0",
  blueLight:   "#E3F2FD",
  shadow:      "rgba(0,0,0,0.08)",
  shadowModal: "rgba(0,0,0,0.25)",
  overlay:     "rgba(0,0,0,0.5)",
};

const DARK = {
  red:         "#E2001A",
  redDark:     "#FF1A33",
  redLight:    "rgba(226,0,26,0.18)",
  yellow:      "#FFCC00",
  yellowLight: "rgba(255,204,0,0.15)",
  bgCard:      "#2A2A2A",
  bgPage:      "#1A1A1A",
  bgInput:     "#383838",
  border:      "#4A4A4A",
  text:        "#F5F5F5",
  textSub:     "#AAAAAA",
  textMuted:   "#777777",
  success:     "#66BB6A",
  successBg:   "rgba(102,187,106,0.15)",
  purple:      "#CE93D8",
  purpleLight: "rgba(206,147,216,0.18)",
  blue:        "#90CAF9",
  blueLight:   "rgba(144,202,249,0.18)",
  shadow:      "rgba(0,0,0,0.3)",
  shadowModal: "rgba(0,0,0,0.6)",
  overlay:     "rgba(0,0,0,0.7)",
};

// ─── Theme Context ────────────────────────────────────────────────────────────
const ThemeCtx = createContext({ T: LIGHT, dark: false, toggle: () => {} });
const useTheme = () => useContext(ThemeCtx);

// ─── Constant data ────────────────────────────────────────────────────────────
const PRAISE_MESSAGES = [
  { emoji: "💪", text: "Stark! Du bringst das Team voran." },
  { emoji: "🌟", text: "Ausgezeichnet! Das macht den Unterschied." },
  { emoji: "🚀", text: "So geht das! Weiter so." },
  { emoji: "🙌", text: "Klasse Beitrag — das Team dankt dir!" },
  { emoji: "🎯", text: "Perfekt! Wir kommen dem Ziel näher." },
  { emoji: "⚡", text: "Sehr stark! Echter Teamplayer." },
  { emoji: "✅", text: "Blitzschnell eingetragen — top!" },
  { emoji: "🏆", text: "Hervorragend! So wird das Ziel erreicht." },
  { emoji: "💥", text: "Treffer! Genau solche Beiträge braucht das Team." },
  { emoji: "🔥", text: "Exzellent! Das spürt die ganze Gruppe." },
];
const GOAL_PRAISE = [
  { emoji: "🎉", text: "Wochenziel geknackt! Du warst dabei — Chapeau!" },
  { emoji: "🥂", text: "Ziel erreicht! Dein Beitrag hat den Unterschied gemacht." },
  { emoji: "🏅", text: "Ausnahmslos stark. Das Ziel gehört dem Team — und dir!" },
  { emoji: "🎊", text: "Mission erfüllt! Was für eine Teamleistung." },
];
const MOTIVATION_STEPS = [
  { min: 0,   max: 10,       text: "Der erste Schritt ist getan — jetzt Fahrt aufnehmen!" },
  { min: 10,  max: 20,       text: "Gut gestartet! Jeder Euro bringt uns näher." },
  { min: 20,  max: 33,       text: "Wir kommen! Weiter so — das Team zieht an einem Strang." },
  { min: 33,  max: 45,       text: "Ein Drittel geschafft! Die Dynamik stimmt." },
  { min: 45,  max: 55,       text: "Halbzeit in Sicht — das Team liefert!" },
  { min: 55,  max: 67,       text: "Über die Hälfte — jetzt erst recht!" },
  { min: 67,  max: 80,       text: "Zwei Drittel durch! Die Ziellinie rückt näher." },
  { min: 80,  max: 90,       text: "Noch ein letzter Schub — wir schaffen das!" },
  { min: 90,  max: 100,      text: "Fast geschafft! Jeder Beitrag zählt jetzt doppelt." },
  { min: 100, max: Infinity, text: "Teamwork macht den Traum wahr! 🎉" },
];

function getRandomPraise(isGoal = false) {
  const pool = isGoal ? GOAL_PRAISE : PRAISE_MESSAGES;
  return pool[Math.floor(Math.random() * pool.length)];
}
function formatEuro(amount) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency", currency: "EUR", maximumFractionDigits: 0,
  }).format(amount);
}
function getMonday(d = new Date()) {
  const day = d.getDay();
  const mon = new Date(d);
  mon.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
  mon.setHours(0, 0, 0, 0);
  return mon;
}
function getKWLabel(mondayDate) {
  const d    = new Date(mondayDate);
  const jan4 = new Date(d.getFullYear(), 0, 4);
  const sow1 = new Date(jan4);
  sow1.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7));
  return `KW ${Math.round((d - sow1) / (7 * 86400000)) + 1} / ${d.getFullYear()}`;
}
function getMotivation(pct) {
  return (
    MOTIVATION_STEPS.find((s) => pct >= s.min && pct < s.max) ||
    MOTIVATION_STEPS[MOTIVATION_STEPS.length - 1]
  ).text;
}

// Map DB snake_case row → camelCase JS object used by HistoryView
function mapHistoryRow(h) {
  return {
    weekKey:       h.week_key,
    label:         h.label,
    kredit:        h.kredit,
    kreditGoal:    h.kredit_goal,
    kreditReached: h.kredit_reached,
    angebote:      h.angebote,
    termine:       h.termine,
    termineGoal:   h.termine_goal,
    termineReached: h.termine_reached,
  };
}

// ─── makeStyles ───────────────────────────────────────────────────────────────
function makeStyles(T) {
  return {
    screen: {
      minHeight: "100vh",
      background: T.bgPage,
      fontFamily: "Arial, Helvetica, system-ui, -apple-system, sans-serif",
      display: "flex", justifyContent: "center", alignItems: "flex-start",
      padding: "24px 16px 60px",
      boxSizing: "border-box",
      transition: "background-color 0.3s",
    },
    container: {
      width: "100%", maxWidth: 560,
      display: "flex", flexDirection: "column", gap: 14,
    },
    header: {
      display: "flex", justifyContent: "space-between", alignItems: "center",
      paddingBottom: 4,
    },
    title: {
      margin: 0, fontSize: 22, fontWeight: 800,
      color: T.text, letterSpacing: "-0.3px",
      transition: "color 0.3s",
    },
    card: {
      background: T.bgCard,
      border: `1px solid ${T.border}`,
      borderRadius: 14,
      padding: "20px 18px",
      boxShadow: `0 2px 8px ${T.shadow}`,
      transition: "background-color 0.3s, border-color 0.3s",
    },
    cardTitle: {
      fontSize: 13, fontWeight: 700, color: T.textSub,
      letterSpacing: "0.04em", textTransform: "uppercase",
      marginBottom: 14,
      display: "flex", justifyContent: "space-between", alignItems: "center",
      transition: "color 0.3s",
    },
    sectionLabel: {
      display: "block",
      fontSize: 11, fontWeight: 700, color: T.textMuted,
      letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12,
      transition: "color 0.3s",
    },
    label: {
      fontSize: 11, color: T.textMuted, fontWeight: 600,
      letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 4,
      transition: "color 0.3s",
    },
    barWrap: {
      height: 20, background: T.bgInput,
      borderRadius: 10, overflow: "hidden",
      marginBottom: 16, border: `1px solid ${T.border}`,
      transition: "background-color 0.3s",
    },
    barFill: {
      height: "100%", borderRadius: 10,
      display: "flex", alignItems: "center", justifyContent: "flex-end",
      minWidth: 2,
      transition: "width 0.8s cubic-bezier(0.4,0,0.2,1)",
    },
    input: {
      width: "100%",
      background: T.bgInput,
      border: `1.5px solid ${T.border}`,
      borderRadius: 9,
      padding: "11px 14px",
      color: T.text, fontSize: 16,
      outline: "none", boxSizing: "border-box",
      transition: "border-color 0.2s, background-color 0.3s, color 0.3s",
    },
    btnPrimary: {
      background: T.red, color: "#FFFFFF",
      border: "none", borderRadius: 9,
      padding: "11px 22px", fontSize: 14, fontWeight: 700,
      cursor: "pointer", whiteSpace: "nowrap", letterSpacing: "0.02em",
      transition: "background 0.15s",
      boxShadow: "0 2px 6px rgba(226,0,26,0.35)",
    },
    btnSecondary: {
      background: T.bgCard, color: T.red,
      border: `1.5px solid ${T.red}`,
      borderRadius: 9, padding: "8px 14px",
      fontSize: 12, fontWeight: 600,
      cursor: "pointer",
      transition: "background 0.15s, color 0.3s",
    },
    btnSecondaryFull: {
      background: T.bgCard, color: T.red,
      border: `1.5px solid ${T.red}`,
      borderRadius: 9, padding: "11px 18px",
      fontSize: 14, fontWeight: 600,
      cursor: "pointer",
      transition: "background 0.15s, color 0.3s",
    },
    counterBtn: {
      flex: 1, background: T.bgInput,
      border: `1px solid ${T.border}`,
      borderRadius: 8, color: T.textSub,
      fontSize: 18, fontWeight: 700,
      padding: "7px 0", cursor: "pointer",
      transition: "background 0.15s",
    },
    counterBtnBlue:   { background: T.blue,   color: "#FFFFFF", border: "none" },
    counterBtnPurple: { background: T.purple, color: "#FFFFFF", border: "none" },
    emptyState: {
      textAlign: "center", color: T.textMuted,
      fontSize: 14, padding: "20px 0",
      transition: "color 0.3s",
    },
    resetBtn: {
      background: "transparent",
      border: `1px solid ${T.border}`,
      borderRadius: 8, color: T.textMuted,
      fontSize: 13, padding: "8px 18px",
      cursor: "pointer", transition: "color 0.2s, border-color 0.2s",
    },
    themeToggle: {
      width: 38, height: 38, borderRadius: 10,
      background: T.bgInput,
      border: `1px solid ${T.border}`,
      display: "flex", alignItems: "center", justifyContent: "center",
      cursor: "pointer", fontSize: 18,
      transition: "background 0.3s, border-color 0.3s",
      flexShrink: 0,
    },
    modalOverlay: {
      position: "fixed", inset: 0,
      background: T.overlay,
      zIndex: 9998, animation: "fadeIn 0.2s ease",
    },
    modalBox: {
      position: "fixed", top: "50%", left: "50%",
      transform: "translate(-50%, -50%)",
      background: T.bgCard,
      borderRadius: 14, overflow: "hidden",
      boxShadow: `0 16px 48px ${T.shadowModal}`,
      zIndex: 9999,
      width: "min(400px, 90vw)",
      animation: "fadeIn 0.2s ease",
      transition: "background-color 0.3s",
    },
    modalBody: {
      padding: "24px 24px 20px",
    },
    modalTitle: {
      fontSize: 16, fontWeight: 700, color: T.text, marginBottom: 8,
      transition: "color 0.3s",
    },
    modalDesc: {
      fontSize: 14, color: T.textSub, marginBottom: 20, lineHeight: 1.5,
      transition: "color 0.3s",
    },
  };
}

// ─── GlobalStyle ─────────────────────────────────────────────────────────────
function GlobalStyle({ T }) {
  return (
    <style>{`
      *, *::before, *::after { box-sizing: border-box; }
      body {
        font-family: Arial, Helvetica, system-ui, -apple-system, sans-serif;
        background: ${T.bgPage};
        transition: background-color 0.3s;
      }
      @keyframes slideUp {
        from { opacity: 0; transform: translateX(-50%) translateY(18px); }
        to   { opacity: 1; transform: translateX(-50%) translateY(0); }
      }
      @keyframes fadeIn {
        from { opacity: 0; }
        to   { opacity: 1; }
      }
      button { font-family: Arial, Helvetica, system-ui, -apple-system, sans-serif; }
      input  { font-family: Arial, Helvetica, system-ui, -apple-system, sans-serif; }
      input::placeholder { color: ${T.textMuted}; }
      ::-webkit-scrollbar { width: 4px; }
      ::-webkit-scrollbar-track { background: ${T.bgInput}; }
      ::-webkit-scrollbar-thumb { background: ${T.border}; border-radius: 2px; }
    `}</style>
  );
}

// ─── ConfettiCanvas ──────────────────────────────────────────────────────────
function ConfettiCanvas() {
  const { T } = useTheme();
  const canvasRef = useRef(null);
  const particles = useRef([]);
  const animRef   = useRef(null);

  useEffect(() => {
    const canvas  = canvasRef.current;
    const ctx     = canvas.getContext("2d");
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    const colors  = [T.red, T.yellow, "#FFFFFF", "#FF6680", "#FFE57F"];
    particles.current = Array.from({ length: 140 }, () => ({
      x: Math.random() * canvas.width,
      y: -20 - Math.random() * 100,
      w: 6 + Math.random() * 8,
      h: 10 + Math.random() * 6,
      color: colors[Math.floor(Math.random() * colors.length)],
      rot: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.15,
      vx: (Math.random() - 0.5) * 3,
      vy: 2.5 + Math.random() * 3,
      alpha: 1,
    }));
    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let alive = false;
      particles.current.forEach((p) => {
        p.x += p.vx; p.y += p.vy; p.rot += p.rotSpeed;
        if (p.y > canvas.height * 0.7) p.alpha -= 0.025;
        if (p.alpha > 0) {
          alive = true;
          ctx.save(); ctx.globalAlpha = p.alpha;
          ctx.translate(p.x, p.y); ctx.rotate(p.rot);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
          ctx.restore();
        }
      });
      if (alive) animRef.current = requestAnimationFrame(draw);
    }
    draw();
    return () => cancelAnimationFrame(animRef.current);
  }, []);

  return (
    <canvas ref={canvasRef}
      style={{ position: "fixed", top: 0, left: 0, pointerEvents: "none", zIndex: 9999 }} />
  );
}

// ─── MilestoneBadge ──────────────────────────────────────────────────────────
function MilestoneBadge({ milestone, achieved }) {
  const { T } = useTheme();
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
      opacity: achieved ? 1 : 0.4,
      transition: "opacity 0.5s, transform 0.3s",
      transform: achieved ? "scale(1.12)" : "scale(1)",
    }}>
      <div style={{
        width: 38, height: 38, borderRadius: "50%",
        background: achieved ? T.red : T.bgInput,
        border: `2px solid ${achieved ? T.red : T.border}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 13, fontWeight: 700,
        color: achieved ? "#FFFFFF" : T.textMuted,
        boxShadow: achieved ? `0 2px 8px rgba(226,0,26,0.4)` : "none",
        transition: "all 0.4s",
      }}>
        {achieved ? "✓" : `${milestone}%`}
      </div>
      <span style={{ fontSize: 10, color: achieved ? T.red : T.textMuted, fontWeight: 700, transition: "color 0.3s" }}>
        {milestone}%
      </span>
    </div>
  );
}

// ─── HistoryView ─────────────────────────────────────────────────────────────
function HistoryView({ history, onClearHistory }) {
  const { T, S } = useTheme();
  const [confirmClear, setConfirmClear] = useState(false);

  if (history.length === 0) {
    return (
      <div style={S.card}>
        <div style={{ textAlign: "center", padding: "32px 0", color: T.textMuted, fontSize: 14, lineHeight: 1.7 }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📊</div>
          Noch keine abgeschlossenen Wochen.<br />
          Nach dem ersten Reset erscheinen hier die Ergebnisse.
        </div>
      </div>
    );
  }

  const kreditReachedCount  = history.filter((h) => h.kreditReached).length;
  const termineReachedCount = history.filter((h) => h.termineReached).length;
  const avgKredit    = history.reduce((s, h) => s + h.kredit, 0) / history.length;
  const avgKreditPct = Math.round((avgKredit / 62500) * 100);
  const avgTermine   = (history.reduce((s, h) => s + h.termine, 0) / history.length).toFixed(1);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

      {/* Summary stats */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        {[
          { label: "Wochen gesamt", value: history.length,            color: T.blue },
          { label: "Kreditziel ✓",  value: `${kreditReachedCount}×`,  color: T.red },
          { label: "Terminziel ✓",  value: `${termineReachedCount}×`, color: T.purple },
        ].map(({ label, value, color }) => (
          <div key={label} style={S.card}>
            <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
            <div style={{ fontSize: 10, color: T.textMuted, marginTop: 4, fontWeight: 600 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Averages */}
      <div style={S.card}>
        <span style={S.sectionLabel}>Ø Durchschnitt</span>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 13, color: T.textSub }}>Kredit</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: T.red }}>
                {new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(avgKredit)} ({avgKreditPct}%)
              </span>
            </div>
            <div style={S.barWrap}>
              <div style={{ ...S.barFill, width: `${Math.min(avgKreditPct, 100)}%`, background: T.red }} />
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 13, color: T.textSub }}>Ø Termine pro Woche</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: T.purple }}>{avgTermine} / 8</span>
          </div>
        </div>
      </div>

      {/* Week list */}
      <div style={{ ...S.card, padding: 0, overflow: "hidden" }}>
        <div style={{
          padding: "14px 18px 10px", borderBottom: `1px solid ${T.border}`,
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <span style={{ ...S.sectionLabel, marginBottom: 0 }}>Wochendetails</span>
          <button style={S.btnSecondary} onClick={() => setConfirmClear(true)}>
            🗑 Verlauf löschen
          </button>
        </div>
        {history.map((h, i) => (
          <div key={h.weekKey ?? i} style={{
            borderTop: i > 0 ? `1px solid ${T.border}` : "none",
            padding: "14px 18px",
            display: "flex", flexDirection: "column", gap: 8,
            transition: "border-color 0.3s",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{h.label}</span>
              <div style={{ display: "flex", gap: 6 }}>
                {[
                  { ok: h.kreditReached,  yes: "✓ Kredit",  no: "✗ Kredit",
                    okColor: T.success, okBg: T.successBg, noColor: T.red, noBg: T.redLight },
                  { ok: h.termineReached, yes: "✓ Termine", no: "✗ Termine",
                    okColor: T.purple,  okBg: T.purpleLight, noColor: T.red, noBg: T.redLight },
                ].map(({ ok, yes, no, okColor, okBg, noColor, noBg }) => (
                  <span key={yes} style={{
                    fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 20,
                    background: ok ? okBg : noBg,
                    color: ok ? okColor : noColor,
                    border: `1px solid ${ok ? okColor + "44" : noColor + "44"}`,
                  }}>{ok ? yes : no}</span>
                ))}
              </div>
            </div>
            <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
              {[
                { label: "Kredit",   val: new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(h.kredit) + ` (${Math.round((h.kredit / h.kreditGoal) * 100)}%)` },
                { label: "Angebote", val: h.angebote },
                { label: "Termine",  val: `${h.termine}/${h.termineGoal}` },
              ].map(({ label, val }) => (
                <div key={label} style={{ fontSize: 12, color: T.textMuted }}>
                  {label}: <span style={{ color: T.textSub, fontWeight: 600 }}>{val}</span>
                </div>
              ))}
            </div>
            <div style={{ height: 4, background: T.bgInput, borderRadius: 2, overflow: "hidden" }}>
              <div style={{
                height: "100%",
                width: `${Math.min((h.kredit / h.kreditGoal) * 100, 100)}%`,
                background: h.kreditReached ? T.success : T.red,
                borderRadius: 2,
              }} />
            </div>
          </div>
        ))}
      </div>

      {/* Verlauf-löschen Modal */}
      {confirmClear && (
        <>
          <div style={S.modalOverlay} onClick={() => setConfirmClear(false)} />
          <div style={S.modalBox}>
            <div style={{ height: 4, background: T.red }} />
            <div style={S.modalBody}>
              <div style={S.modalTitle}>Gesamten Verlauf löschen?</div>
              <div style={S.modalDesc}>
                Alle Wochen-Einträge werden unwiderruflich gelöscht. Aktuelle Wochenwerte werden ebenfalls zurückgesetzt.<br />
                <strong style={{ color: T.red }}>Diese Aktion kann nicht rückgängig gemacht werden.</strong>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button style={{ ...S.btnSecondaryFull, flex: 1 }} onClick={() => setConfirmClear(false)}>
                  Abbrechen
                </button>
                <button style={{ ...S.btnPrimary, flex: 1 }} onClick={() => { setConfirmClear(false); onClearHistory(); }}>
                  Löschen
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Main App ────────────────────────────────────────────────────────────────
export default function App() {
  // ── Theme state (localStorage — personal, not shared) ─────────────────────
  const [dark, setDark] = useState(() => lsGet(STORAGE_KEY_THEME) === "dark");
  const T = dark ? DARK : LIGHT;
  const S = useMemo(() => makeStyles(T), [dark]);

  const toggleDark = () => {
    const next = !dark;
    setDark(next);
    lsSet(STORAGE_KEY_THEME, next ? "dark" : "light");
  };

  // ── App state ──────────────────────────────────────────────────────────────
  const [entries,           setEntries]          = useState([]);
  const [amountInput,       setAmountInput]       = useState("");
  const [inputError,        setInputError]        = useState("");
  const [showConfetti,      setShowConfetti]      = useState(false);
  const [reachedMilestones, setReachedMilestones] = useState(new Set());
  const [pulsingMilestone,  setPulsingMilestone]  = useState(null);
  const [loading,           setLoading]           = useState(true);
  const [resetConfirm,      setResetConfirm]      = useState(false);
  const [praise,            setPraise]            = useState(null);
  const praiseTimer = useRef(null);
  const [angebote,  setAngebote]  = useState(0);
  const [termine,   setTermine]   = useState(0);
  const [history,   setHistory]   = useState([]);
  const [activeTab, setActiveTab] = useState("dashboard");
  const prevPct = useRef(0);

  // ── Supabase loaders ───────────────────────────────────────────────────────
  async function reloadEntries() {
    const { data } = await supabase.from("entries").select("*").order("ts");
    setEntries(data || []);
  }

  async function reloadWeekState() {
    const { data } = await supabase.from("week_state").select("*").eq("id", 1).single();
    if (data) {
      setAngebote(data.angebote ?? 0);
      setTermine(data.termine ?? 0);
    }
  }

  async function reloadHistory() {
    const { data } = await supabase
      .from("history").select("*").order("week_key", { ascending: false });
    setHistory((data || []).map(mapHistoryRow));
  }

  // ── Initial load + week-rollover logic ────────────────────────────────────
  useEffect(() => {
    async function loadAll() {
      setLoading(true);
      const thisMonday = getMonday().getTime();

      const [{ data: entriesData }, { data: wsData }, { data: histData }] =
        await Promise.all([
          supabase.from("entries").select("*").order("ts"),
          supabase.from("week_state").select("*").eq("id", 1).single(),
          supabase.from("history").select("*").order("week_key", { ascending: false }),
        ]);

      const ws         = wsData  || { angebote: 0, termine: 0, current_week_ms: thisMonday };
      const rawEntries = entriesData || [];

      // Auto-rollover when a new week has started
      if (ws.current_week_ms && ws.current_week_ms < thisMonday) {
        const weekTotal = rawEntries.reduce((s, e) => s + e.amount, 0);

        if (weekTotal > 0 || ws.angebote > 0 || ws.termine > 0) {
          // Only insert history snapshot if this weekKey isn't already there
          const { data: existing } = await supabase
            .from("history").select("id").eq("week_key", ws.current_week_ms).maybeSingle();
          if (!existing) {
            await supabase.from("history").insert({
              week_key:       ws.current_week_ms,
              label:          getKWLabel(new Date(ws.current_week_ms)),
              kredit:         weekTotal,
              kredit_goal:    WEEKLY_GOAL,
              kredit_reached: weekTotal >= WEEKLY_GOAL,
              angebote:       ws.angebote,
              termine:        ws.termine,
              termine_goal:   TERMINE_GOAL,
              termine_reached: ws.termine >= TERMINE_GOAL,
            });
          }
        }

        // Clear entries and reset week_state to new week
        await supabase.from("entries").delete().neq("id", "00000000-0000-0000-0000-000000000000");
        await supabase.from("week_state")
          .update({ angebote: 0, termine: 0, current_week_ms: thisMonday })
          .eq("id", 1);

        setEntries([]);
        setAngebote(0);
        setTermine(0);

        // Reload history after insert
        const { data: newHist } = await supabase
          .from("history").select("*").order("week_key", { ascending: false });
        setHistory((newHist || []).map(mapHistoryRow));
      } else {
        setEntries(rawEntries);
        setAngebote(ws.angebote ?? 0);
        setTermine(ws.termine  ?? 0);
        setHistory((histData || []).map(mapHistoryRow));
      }

      setLoading(false);
    }

    loadAll();
  }, []);

  // ── Realtime subscriptions ─────────────────────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel("db-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "entries" },    reloadEntries)
      .on("postgres_changes", { event: "*", schema: "public", table: "week_state" }, reloadWeekState)
      .on("postgres_changes", { event: "*", schema: "public", table: "history" },    reloadHistory)
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  const total    = entries.reduce((s, e) => s + e.amount, 0);
  const pct      = Math.min((total / WEEKLY_GOAL) * 100, 100);
  const remaining = Math.max(WEEKLY_GOAL - total, 0);
  const goalDone  = pct >= 100;

  // ── Milestones ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (loading) return;
    MILESTONES.forEach((m) => {
      if (pct >= m && !reachedMilestones.has(m)) {
        setReachedMilestones((prev) => new Set([...prev, m]));
        setPulsingMilestone(m);
        setTimeout(() => setPulsingMilestone(null), 2000);
        if (m === 100) { setShowConfetti(true); setTimeout(() => setShowConfetti(false), 5000); }
      }
    });
    prevPct.current = pct;
  }, [pct, loading]);

  // ── Toast helper ───────────────────────────────────────────────────────────
  const showToast = (emoji, text, isGoal = false, isInfo = false, ms = 3500) => {
    setPraise({ emoji, text, isGoal, isInfo });
    if (praiseTimer.current) clearTimeout(praiseTimer.current);
    praiseTimer.current = setTimeout(() => setPraise(null), ms);
  };

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleAddEntry = async () => {
    const val = parseFloat(amountInput.replace(/\./g, "").replace(",", "."));
    if (!val || isNaN(val) || val <= 0) { setInputError("Bitte einen gültigen Betrag eingeben."); return; }
    setInputError("");

    const { error } = await supabase.from("entries").insert({ amount: val, ts: Date.now() });
    if (error) { setInputError("Fehler beim Speichern. Bitte nochmal versuchen."); return; }

    setAmountInput("");
    const newTotal    = total + val;
    const justReached = newTotal >= WEEKLY_GOAL && total < WEEKLY_GOAL;
    const p = getRandomPraise(justReached);
    showToast(p.emoji, p.text, justReached, false, justReached ? 6000 : 3500);
  };

  const handleAddAngebot    = async () => { const n = angebote + 1;              setAngebote(n); await supabase.from("week_state").update({ angebote: n }).eq("id", 1); };
  const handleRemoveAngebot = async () => { const n = Math.max(0, angebote - 1); setAngebote(n); await supabase.from("week_state").update({ angebote: n }).eq("id", 1); };
  const handleAddTermin     = async () => { const n = termine + 1;               setTermine(n);  await supabase.from("week_state").update({ termine: n }).eq("id", 1); };
  const handleRemoveTermin  = async () => { const n = Math.max(0, termine - 1);  setTermine(n);  await supabase.from("week_state").update({ termine: n }).eq("id", 1); };

  const handleReset = async () => {
    const mon = getMonday().getTime();

    if (total > 0 || angebote > 0 || termine > 0) {
      const { data: existing } = await supabase
        .from("history").select("id").eq("week_key", mon).maybeSingle();
      if (!existing) {
        await supabase.from("history").insert({
          week_key:        mon,
          label:           getKWLabel(new Date(mon)),
          kredit:          total,
          kredit_goal:     WEEKLY_GOAL,
          kredit_reached:  total >= WEEKLY_GOAL,
          angebote,
          termine,
          termine_goal:    TERMINE_GOAL,
          termine_reached: termine >= TERMINE_GOAL,
        });
      }
    }

    await supabase.from("entries").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("week_state")
      .update({ angebote: 0, termine: 0, current_week_ms: mon })
      .eq("id", 1);

    setEntries([]); setAngebote(0); setTermine(0);
    setReachedMilestones(new Set()); setShowConfetti(false); setResetConfirm(false);
    prevPct.current = 0;
  };

  const handleClearHistory = async () => {
    await supabase.from("history").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("entries").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("week_state")
      .update({ angebote: 0, termine: 0, current_week_ms: getMonday().getTime() })
      .eq("id", 1);

    setHistory([]); setEntries([]); setAngebote(0); setTermine(0);
    setReachedMilestones(new Set()); setShowConfetti(false);
    prevPct.current = 0;
    showToast("🗑", "Verlauf wurde gelöscht.", false, true, 3000);
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <ThemeCtx.Provider value={{ T, S, dark, toggle: toggleDark }}>
      <div style={S.screen}>
        <GlobalStyle T={T} />
        {showConfetti && <ConfettiCanvas />}

        {/* ── Praise Toast ── */}
        {praise && (
          <>
            <div style={{ ...S.modalOverlay, background: "rgba(0,0,0,0.2)" }}
              onClick={() => setPraise(null)} />
            <div style={{
              position: "fixed", bottom: 40, left: "50%",
              transform: "translateX(-50%)",
              background: T.bgCard,
              borderRadius: 14, overflow: "hidden",
              boxShadow: `0 12px 40px ${T.shadowModal}`,
              zIndex: 9999,
              animation: "slideUp 0.35s cubic-bezier(0.34,1.56,0.64,1)",
              minWidth: 280, maxWidth: "90vw",
              transition: "background-color 0.3s",
            }}>
              <div style={{ height: 4, background: praise.isGoal ? T.yellow : praise.isInfo ? T.border : T.red }} />
              <div style={{ padding: "16px 22px", display: "flex", alignItems: "center", gap: 14 }}>
                <span style={{ fontSize: praise.isGoal ? 32 : 26 }}>{praise.emoji}</span>
                <div>
                  {praise.isGoal && (
                    <div style={{ fontSize: 10, fontWeight: 700, color: T.red, letterSpacing: "0.1em", marginBottom: 3, textTransform: "uppercase" }}>
                      Wochenziel erreicht
                    </div>
                  )}
                  <span style={{ fontSize: praise.isGoal ? 15 : 14, fontWeight: 700, color: T.text }}>
                    {praise.text}
                  </span>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ── Reset Modal ── */}
        {resetConfirm && (
          <>
            <div style={S.modalOverlay} onClick={() => setResetConfirm(false)} />
            <div style={S.modalBox}>
              <div style={{ height: 4, background: T.red }} />
              <div style={S.modalBody}>
                <div style={S.modalTitle}>Woche zurücksetzen?</div>
                <div style={S.modalDesc}>Alle aktuellen Einträge werden gelöscht und in den Verlauf archiviert.</div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button style={{ ...S.btnPrimary, flex: 1 }} onClick={handleReset}>Ja, zurücksetzen</button>
                  <button style={{ ...S.btnSecondaryFull, flex: 1 }} onClick={() => setResetConfirm(false)}>Abbrechen</button>
                </div>
              </div>
            </div>
          </>
        )}

        <div style={S.container}>

          {/* ── Header ── */}
          <div style={S.header}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10, background: T.red,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 20, flexShrink: 0, boxShadow: "0 2px 6px rgba(226,0,26,0.35)",
              }}>🏦</div>
              <h1 style={S.title}>Fu-Fighters</h1>
            </div>
            <button style={S.themeToggle} onClick={toggleDark} title={dark ? "Light Mode" : "Dark Mode"}>
              {dark ? "☀️" : "🌙"}
            </button>
          </div>

          {/* ── Tab Nav ── */}
          <div style={{
            display: "flex", background: T.bgCard,
            borderRadius: 10, padding: 3,
            border: `1px solid ${T.border}`,
            boxShadow: `0 1px 4px ${T.shadow}`,
            transition: "background-color 0.3s, border-color 0.3s",
          }}>
            {[["dashboard", "📊 Dashboard"], ["history", "📈 Verlauf"]].map(([tab, label]) => (
              <button key={tab} onClick={() => setActiveTab(tab)} style={{
                flex: 1, border: "none", borderRadius: 8, padding: "9px 0",
                fontSize: 13, fontWeight: 700, cursor: "pointer",
                background: activeTab === tab ? T.red : "transparent",
                color:      activeTab === tab ? "#FFFFFF" : T.textMuted,
                boxShadow:  activeTab === tab ? "0 1px 4px rgba(226,0,26,0.3)" : "none",
                transition: "all 0.2s",
              }}>{label}</button>
            ))}
          </div>

          {/* ── History Tab ── */}
          {activeTab === "history" ? (
            <HistoryView history={history} onClearHistory={handleClearHistory} />
          ) : (
            <>
              {/* ── Ziel-Karte ── */}
              <div style={S.card}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 18 }}>
                  <div>
                    <div style={S.label}>Gesamt eingetragen</div>
                    <div style={{ fontSize: 32, fontWeight: 800, color: T.text, lineHeight: 1, letterSpacing: "-0.5px", transition: "color 0.3s" }}>
                      {formatEuro(total)}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={S.label}>Wochenziel</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: T.red, lineHeight: 1 }}>
                      {formatEuro(WEEKLY_GOAL)}
                    </div>
                  </div>
                </div>

                {/* Progress Bar */}
                <div style={S.barWrap}>
                  <div style={{
                    ...S.barFill, width: `${pct}%`,
                    background: goalDone ? `linear-gradient(90deg, ${T.red}, ${T.yellow})` : T.red,
                  }}>
                    {pct > 8 && (
                      <span style={{ fontSize: 10, fontWeight: 700, color: "#FFFFFF", paddingRight: 8, letterSpacing: "0.04em" }}>
                        {Math.round(pct)}%
                      </span>
                    )}
                  </div>
                </div>

                {/* Milestones */}
                <div style={{ display: "flex", justifyContent: "space-around", marginBottom: 14, padding: "0 4px" }}>
                  {MILESTONES.map((m) => (
                    <MilestoneBadge key={m} milestone={m} achieved={reachedMilestones.has(m)} pulsing={pulsingMilestone === m} />
                  ))}
                </div>

                {/* Status */}
                <div style={{ textAlign: "center", fontSize: goalDone ? 17 : 14, fontWeight: goalDone ? 700 : 500,
                  color: goalDone ? T.success : T.textSub, marginBottom: 12, transition: "color 0.3s" }}>
                  {goalDone ? "🎉 Ziel erreicht!" : `Noch ${formatEuro(remaining)} bis zum Ziel`}
                </div>

                {/* Motivation Banner */}
                <div style={{
                  background: goalDone ? T.yellowLight : T.redLight,
                  border: `1px solid ${goalDone ? T.yellow + "88" : T.red + "33"}`,
                  borderLeft: `4px solid ${goalDone ? T.yellow : T.red}`,
                  borderRadius: 8, padding: "10px 14px",
                  transition: "background-color 0.3s",
                }}>
                  <span style={{ fontSize: 13, color: goalDone ? (dark ? T.yellow : "#7A5800") : T.red, fontWeight: 600 }}>
                    {getMotivation(pct)}
                  </span>
                </div>
              </div>

              {/* ── Betrag eintragen ── */}
              <div style={S.card}>
                <div style={S.cardTitle}>Kreditbetrag eintragen</div>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <div style={{ position: "relative", flex: 1 }}>
                    <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)",
                      color: T.textMuted, fontSize: 15, fontWeight: 600, pointerEvents: "none" }}>€</span>
                    <input
                      style={{ ...S.input, paddingLeft: 30 }}
                      placeholder="0"
                      value={amountInput}
                      onChange={(e) => { setInputError(""); setAmountInput(e.target.value); }}
                      onKeyDown={(e) => e.key === "Enter" && handleAddEntry()}
                      type="text" inputMode="decimal"
                    />
                  </div>
                  <button style={S.btnPrimary} onClick={handleAddEntry}>Eintragen</button>
                </div>
                {inputError && <div style={{ color: T.red, fontSize: 12, marginTop: 6, fontWeight: 600 }}>{inputError}</div>}
                <p style={{ fontSize: 11, color: T.textMuted, margin: "10px 0 0", lineHeight: 1.5 }}>
                  Dein Eintrag erscheint anonym in der Teamliste — kein Name, kein Profil.
                </p>
              </div>

              {/* ── Angebote & Termine ── */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div style={S.card}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: T.blue, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>Angebote</div>
                  <div style={{ fontSize: 42, fontWeight: 800, color: T.text, lineHeight: 1, marginBottom: 4, transition: "color 0.3s" }}>{angebote}</div>
                  <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 14 }}>erstellt diese Woche</div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={handleRemoveAngebot} style={S.counterBtn}>−</button>
                    <button onClick={handleAddAngebot}    style={{ ...S.counterBtn, ...S.counterBtnBlue }}>+</button>
                  </div>
                </div>

                <div style={S.card}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: T.purple, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>Termine</div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 4 }}>
                    <span style={{ fontSize: 42, fontWeight: 800, color: T.text, lineHeight: 1, transition: "color 0.3s" }}>{termine}</span>
                    <span style={{ fontSize: 13, color: T.textMuted, fontWeight: 600 }}>/ {TERMINE_GOAL}</span>
                  </div>
                  <div style={{ height: 5, background: T.bgInput, borderRadius: 3, marginBottom: 6, overflow: "hidden", border: `1px solid ${T.border}` }}>
                    <div style={{
                      height: "100%", borderRadius: 3,
                      width: `${Math.min((termine / TERMINE_GOAL) * 100, 100)}%`,
                      background: termine >= TERMINE_GOAL ? T.purple : T.purple + "99",
                      transition: "width 0.5s ease",
                    }} />
                  </div>
                  <div style={{ fontSize: 11, color: termine >= TERMINE_GOAL ? T.purple : T.textMuted, marginBottom: 14, fontWeight: termine >= TERMINE_GOAL ? 700 : 400 }}>
                    {termine >= TERMINE_GOAL ? "Ziel erreicht! 🎉" : `Noch ${TERMINE_GOAL - termine} bis Ziel`}
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={handleRemoveTermin} style={S.counterBtn}>−</button>
                    <button onClick={handleAddTermin}    style={{ ...S.counterBtn, ...S.counterBtnPurple }}>+</button>
                  </div>
                </div>
              </div>

              {/* ── Teamaktivität ── */}
              <div style={S.card}>
                <div style={S.cardTitle}>
                  Teamaktivität
                  <span style={{ fontSize: 12, fontWeight: 500, color: T.textMuted }}>{entries.length} Einträge</span>
                </div>
                {loading ? (
                  <div style={S.emptyState}>Verbinde mit Supabase …</div>
                ) : entries.length === 0 ? (
                  <div style={S.emptyState}>Noch keine Einträge — starte die Woche stark!</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 260, overflowY: "auto" }}>
                    {[...entries].sort((a, b) => b.ts - a.ts).slice(0, 20).map((e, i) => (
                      <div key={e.id ?? i} style={{
                        display: "flex", alignItems: "center", gap: 10,
                        padding: "9px 12px", borderRadius: 8,
                        background: T.bgInput, border: `1px solid ${T.border}`,
                        transition: "background-color 0.3s, border-color 0.3s",
                      }}>
                        <div style={{ width: 7, height: 7, borderRadius: "50%", background: T.red, flexShrink: 0 }} />
                        <span style={{ fontSize: 13, color: T.textSub, flex: 1 }}>
                          Es wurden <strong style={{ color: T.red }}>{formatEuro(e.amount)}</strong> eingetragen
                        </span>
                        <span style={{ fontSize: 11, color: T.textMuted, fontVariantNumeric: "tabular-nums" }}>
                          {new Date(e.ts).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ── Reset ── */}
              <div style={{ display: "flex", justifyContent: "center", paddingTop: 4, paddingBottom: 8 }}>
                <button style={S.resetBtn} onClick={() => setResetConfirm(true)}>
                  ↺ Wöchentlicher Reset
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </ThemeCtx.Provider>
  );
}
