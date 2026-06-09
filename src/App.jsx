import { useState, useEffect, useRef } from "react";

const WEEKLY_GOAL = 62500;
const STORAGE_KEY_ENTRIES      = "kredit-tracker-entries";
const STORAGE_KEY_ANGEBOTE     = "kredit-tracker-angebote";
const STORAGE_KEY_TERMINE      = "kredit-tracker-termine";
const STORAGE_KEY_HISTORY      = "kredit-tracker-history";
const STORAGE_KEY_CURRENT_WEEK = "kredit-tracker-current-week";
const STORAGE_KEY_VERSION      = "kredit-tracker-version";
const TERMINE_GOAL = 8;
const MILESTONES   = [25, 50, 75, 100];

// Versionsnummer erhöhen → löscht bei allen Nutzern beim nächsten Laden alle Daten
const DATA_VERSION = "2";

function clearAllStorage() {
  [
    STORAGE_KEY_ENTRIES,
    STORAGE_KEY_ANGEBOTE,
    STORAGE_KEY_TERMINE,
    STORAGE_KEY_HISTORY,
    STORAGE_KEY_CURRENT_WEEK,
  ].forEach((key) => localStorage.removeItem(key));
  lsSet(STORAGE_KEY_VERSION, DATA_VERSION);
}

// ─── Sparkassen Design Palette ────────────────────────────────────────────────
const C = {
  red:         "#E2001A",   // Sparkassen-Rot  – Primärbuttons, Header, Akzente
  redDark:     "#B80016",   // Rot dunkel       – Hover
  redLight:    "#FDECEA",   // Rot hell         – Hintergründe für Alerts/Banner
  yellow:      "#FFCC00",   // Sparkassen-Gelb  – Erfolg-Highlight, Ziel erreicht
  yellowLight: "#FFFBEA",   // Gelb hell        – Hintergrund für Erfolgs-Banner
  white:       "#FFFFFF",   // Karten, Modals
  bgPage:      "#F5F5F5",   // Seiten-Hintergrund
  bgInput:     "#F0F0F0",   // Input / Counter-Buttons
  border:      "#E0E0E0",   // Trennlinien
  text:        "#333333",   // Primärtext Anthrazit
  textSub:     "#666666",   // Sekundärtext Mittelgrau
  textMuted:   "#999999",   // Hinweistext
  success:     "#2E7D32",   // Grün für erreichte Ziele
  successBg:   "#E8F5E9",
  purple:      "#7B1FA2",   // Termine-Akzent
  purpleLight: "#F3E5F5",
  blue:        "#1565C0",   // Angebote-Akzent
  blueLight:   "#E3F2FD",
};

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
  const day  = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const mon  = new Date(d);
  mon.setDate(diff);
  mon.setHours(0, 0, 0, 0);
  return mon;
}

function getKWLabel(mondayDate) {
  const d          = new Date(mondayDate);
  const jan4       = new Date(d.getFullYear(), 0, 4);
  const startWeek1 = new Date(jan4);
  startWeek1.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7));
  const weekNum = Math.round((d - startWeek1) / (7 * 86400000)) + 1;
  return `KW ${weekNum} / ${d.getFullYear()}`;
}

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

function getMotivation(pct) {
  return (
    MOTIVATION_STEPS.find((s) => pct >= s.min && pct < s.max) ||
    MOTIVATION_STEPS[MOTIVATION_STEPS.length - 1]
  ).text;
}

// ─── localStorage helpers ────────────────────────────────────────────────────
function lsGet(key)        { try { return localStorage.getItem(key); }    catch { return null; } }
function lsSet(key, value) { try { localStorage.setItem(key, value); }    catch {} }

// ─── ConfettiCanvas ──────────────────────────────────────────────────────────
function ConfettiCanvas() {
  const canvasRef = useRef(null);
  const particles = useRef([]);
  const animRef   = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx    = canvas.getContext("2d");
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    const colors  = [C.red, C.yellow, "#FFFFFF", "#FF6680", "#FFE57F"];
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
          ctx.save();
          ctx.globalAlpha = p.alpha;
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
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
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
      opacity: achieved ? 1 : 0.4,
      transition: "opacity 0.5s, transform 0.3s",
      transform: achieved ? "scale(1.12)" : "scale(1)",
    }}>
      <div style={{
        width: 38, height: 38, borderRadius: "50%",
        background: achieved ? C.red : C.bgInput,
        border: `2px solid ${achieved ? C.red : C.border}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 13, fontWeight: 700,
        color: achieved ? C.white : C.textMuted,
        boxShadow: achieved ? `0 2px 8px rgba(226,0,26,0.35)` : "none",
        transition: "all 0.4s",
      }}>
        {achieved ? "✓" : `${milestone}%`}
      </div>
      <span style={{ fontSize: 10, color: achieved ? C.red : C.textMuted, fontWeight: 700 }}>
        {milestone}%
      </span>
    </div>
  );
}

// ─── HistoryView ─────────────────────────────────────────────────────────────
function HistoryView({ history }) {
  if (history.length === 0) {
    return (
      <div style={styles.card}>
        <div style={{ textAlign: "center", padding: "32px 0", color: C.textMuted, fontSize: 14, lineHeight: 1.7 }}>
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
          { label: "Wochen gesamt", value: history.length,            color: C.blue },
          { label: "Kreditziel ✓",  value: `${kreditReachedCount}×`,  color: C.red },
          { label: "Terminziel ✓",  value: `${termineReachedCount}×`, color: C.purple },
        ].map(({ label, value, color }) => (
          <div key={label} style={styles.card}>
            <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
            <div style={{ fontSize: 10, color: C.textMuted, marginTop: 4, fontWeight: 600 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Averages */}
      <div style={styles.card}>
        <div style={styles.sectionLabel}>Ø Durchschnitt</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 13, color: C.textSub }}>Kredit</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: C.red }}>
                {new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(avgKredit)} ({avgKreditPct}%)
              </span>
            </div>
            <div style={styles.barWrap}>
              <div style={{ ...styles.barFill, width: `${Math.min(avgKreditPct, 100)}%`, background: C.red }} />
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 13, color: C.textSub }}>Ø Termine pro Woche</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: C.purple }}>{avgTermine} / 8</span>
          </div>
        </div>
      </div>

      {/* Week list */}
      <div style={{ ...styles.card, padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "14px 18px 10px", borderBottom: `1px solid ${C.border}` }}>
          <span style={styles.sectionLabel}>Wochendetails</span>
        </div>
        {history.map((h, i) => (
          <div key={i} style={{
            borderTop: i > 0 ? `1px solid ${C.border}` : "none",
            padding: "14px 18px",
            display: "flex", flexDirection: "column", gap: 8,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{h.label}</span>
              <div style={{ display: "flex", gap: 6 }}>
                {[
                  { ok: h.kreditReached,  yes: "✓ Kredit",  no: "✗ Kredit",
                    okColor: C.success, okBg: C.successBg, noColor: C.red, noBg: C.redLight },
                  { ok: h.termineReached, yes: "✓ Termine", no: "✗ Termine",
                    okColor: C.purple,  okBg: C.purpleLight, noColor: C.red, noBg: C.redLight },
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
                <div key={label} style={{ fontSize: 12, color: C.textMuted }}>
                  {label}: <span style={{ color: C.textSub, fontWeight: 600 }}>{val}</span>
                </div>
              ))}
            </div>
            <div style={{ height: 4, background: C.bgInput, borderRadius: 2, overflow: "hidden" }}>
              <div style={{
                height: "100%",
                width: `${Math.min((h.kredit / h.kreditGoal) * 100, 100)}%`,
                background: h.kreditReached ? C.success : C.red,
                borderRadius: 2,
              }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── GlobalStyle ─────────────────────────────────────────────────────────────
const GlobalStyle = () => (
  <style>{`
    *, *::before, *::after { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, system-ui, -apple-system, sans-serif; }
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
    input::placeholder { color: #AAAAAA; }
    ::-webkit-scrollbar { width: 4px; }
    ::-webkit-scrollbar-track { background: ${C.bgInput}; }
    ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 2px; }
  `}</style>
);

// ─── Main App ────────────────────────────────────────────────────────────────
export default function App() {
  const [entries,          setEntries]          = useState([]);
  const [amountInput,      setAmountInput]      = useState("");
  const [inputError,       setInputError]       = useState("");
  const [showConfetti,     setShowConfetti]     = useState(false);
  const [reachedMilestones,setReachedMilestones]= useState(new Set());
  const [pulsingMilestone, setPulsingMilestone] = useState(null);
  const [loading,          setLoading]          = useState(true);
  const [resetConfirm,     setResetConfirm]     = useState(false);
  const [praise,           setPraise]           = useState(null);
  const praiseTimer = useRef(null);
  const [angebote,  setAngebote]  = useState(0);
  const [termine,   setTermine]   = useState(0);
  const [history,   setHistory]   = useState([]);
  const [activeTab, setActiveTab] = useState("dashboard");
  const prevPct = useRef(0);

  // ── Load from localStorage ─────────────────────────────────────────────────
  useEffect(() => {
    // Versionscheck: alte Daten bei Versionsänderung automatisch löschen
    if (lsGet(STORAGE_KEY_VERSION) !== DATA_VERSION) {
      clearAllStorage();
    }

    const thisMonday = getMonday().getTime();

    const rawEntries  = lsGet(STORAGE_KEY_ENTRIES);
    let loadedEntries = rawEntries ? JSON.parse(rawEntries) : [];

    const rawAngebote    = lsGet(STORAGE_KEY_ANGEBOTE);
    let loadedAngebote   = rawAngebote ? parseInt(rawAngebote, 10) : 0;

    const rawTermine     = lsGet(STORAGE_KEY_TERMINE);
    let loadedTermine    = rawTermine ? parseInt(rawTermine, 10) : 0;

    const rawHistory     = lsGet(STORAGE_KEY_HISTORY);
    let loadedHistory    = rawHistory ? JSON.parse(rawHistory) : [];

    const storedWeek     = lsGet(STORAGE_KEY_CURRENT_WEEK);
    const storedWeekMs   = storedWeek ? parseInt(storedWeek, 10) : null;

    if (storedWeekMs && storedWeekMs < thisMonday) {
      const lastTotal = loadedEntries.reduce((s, e) => s + e.amount, 0);
      if (lastTotal > 0 || loadedAngebote > 0 || loadedTermine > 0) {
        const snapshot = {
          weekKey: storedWeekMs, label: getKWLabel(new Date(storedWeekMs)),
          kredit: lastTotal, kreditGoal: WEEKLY_GOAL, kreditReached: lastTotal >= WEEKLY_GOAL,
          angebote: loadedAngebote,
          termine: loadedTermine, termineGoal: TERMINE_GOAL, termineReached: loadedTermine >= TERMINE_GOAL,
        };
        loadedHistory = [snapshot, ...loadedHistory].slice(0, 52);
        lsSet(STORAGE_KEY_HISTORY, JSON.stringify(loadedHistory));
      }
      lsSet(STORAGE_KEY_ENTRIES,  JSON.stringify([]));
      lsSet(STORAGE_KEY_ANGEBOTE, "0");
      lsSet(STORAGE_KEY_TERMINE,  "0");
      setEntries([]); setAngebote(0); setTermine(0);
    } else {
      setEntries(loadedEntries);
      setAngebote(loadedAngebote);
      setTermine(loadedTermine);
    }

    if (!storedWeekMs || storedWeekMs < thisMonday) {
      lsSet(STORAGE_KEY_CURRENT_WEEK, String(thisMonday));
    }

    setHistory(loadedHistory);
    setLoading(false);
  }, []);

  const total     = entries.reduce((s, e) => s + e.amount, 0);
  const pct       = Math.min((total / WEEKLY_GOAL) * 100, 100);
  const remaining = Math.max(WEEKLY_GOAL - total, 0);
  const goalDone  = pct >= 100;

  // ── Milestones & confetti ──────────────────────────────────────────────────
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

  // ── Handlers ───────────────────────────────────────────────────────────────
  const saveEntries = (newEntries) => {
    lsSet(STORAGE_KEY_ENTRIES, JSON.stringify(newEntries));
    setEntries(newEntries);
  };

  const handleAddEntry = () => {
    const raw = amountInput.replace(/\./g, "").replace(",", ".");
    const val = parseFloat(raw);
    if (!val || isNaN(val) || val <= 0) {
      setInputError("Bitte einen gültigen Betrag eingeben.");
      return;
    }
    setInputError("");
    const updatedEntries  = [...entries, { amount: val, ts: Date.now() }];
    saveEntries(updatedEntries);
    setAmountInput("");
    const newTotal        = updatedEntries.reduce((s, e) => s + e.amount, 0);
    const justReachedGoal = newTotal >= WEEKLY_GOAL && total < WEEKLY_GOAL;
    const p = { ...getRandomPraise(justReachedGoal), isGoal: justReachedGoal };
    setPraise(p);
    if (praiseTimer.current) clearTimeout(praiseTimer.current);
    praiseTimer.current = setTimeout(() => setPraise(null), justReachedGoal ? 6000 : 3500);
  };

  const handleAddAngebot    = () => { const n = angebote + 1;              setAngebote(n); lsSet(STORAGE_KEY_ANGEBOTE, String(n)); };
  const handleRemoveAngebot = () => { const n = Math.max(0, angebote - 1); setAngebote(n); lsSet(STORAGE_KEY_ANGEBOTE, String(n)); };
  const handleAddTermin     = () => { const n = termine + 1;               setTermine(n);  lsSet(STORAGE_KEY_TERMINE,  String(n)); };
  const handleRemoveTermin  = () => { const n = Math.max(0, termine - 1);  setTermine(n);  lsSet(STORAGE_KEY_TERMINE,  String(n)); };

  const handleReset = () => {
    const thisMonday = getMonday().getTime();
    if (total > 0 || angebote > 0 || termine > 0) {
      const freshHist = JSON.parse(lsGet(STORAGE_KEY_HISTORY) || "[]");
      if (!freshHist.some((h) => h.weekKey === thisMonday)) {
        const snapshot = {
          weekKey: thisMonday, label: getKWLabel(new Date(thisMonday)),
          kredit: total, kreditGoal: WEEKLY_GOAL, kreditReached: total >= WEEKLY_GOAL,
          angebote, termine, termineGoal: TERMINE_GOAL, termineReached: termine >= TERMINE_GOAL,
        };
        const newHist = [snapshot, ...freshHist].slice(0, 52);
        lsSet(STORAGE_KEY_HISTORY, JSON.stringify(newHist));
        setHistory(newHist);
      }
    }
    lsSet(STORAGE_KEY_ENTRIES,       JSON.stringify([]));
    lsSet(STORAGE_KEY_ANGEBOTE,      "0");
    lsSet(STORAGE_KEY_TERMINE,       "0");
    lsSet(STORAGE_KEY_CURRENT_WEEK,  String(getMonday().getTime()));
    setEntries([]); setAngebote(0); setTermine(0);
    setReachedMilestones(new Set()); setShowConfetti(false); setResetConfirm(false);
    prevPct.current = 0;
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={styles.screen}>
      <GlobalStyle />
      {showConfetti && <ConfettiCanvas />}

      {/* ── Praise Toast (weißes Popup mit Overlay) ── */}
      {praise && (
        <>
          {/* Overlay */}
          <div style={{
            position: "fixed", inset: 0,
            background: "rgba(0,0,0,0.35)",
            zIndex: 9998,
            animation: "fadeIn 0.2s ease",
          }} onClick={() => setPraise(null)} />
          {/* Modal */}
          <div style={{
            position: "fixed", bottom: 40, left: "50%",
            transform: "translateX(-50%)",
            background: C.white,
            borderRadius: 14,
            overflow: "hidden",
            boxShadow: "0 12px 40px rgba(0,0,0,0.25)",
            zIndex: 9999,
            animation: "slideUp 0.35s cubic-bezier(0.34,1.56,0.64,1)",
            minWidth: 280, maxWidth: "90vw",
          }}>
            {/* Roter Akzentstreifen oben */}
            <div style={{ height: 4, background: praise.isGoal ? C.yellow : C.red }} />
            <div style={{ padding: "16px 22px", display: "flex", alignItems: "center", gap: 14 }}>
              <span style={{ fontSize: praise.isGoal ? 32 : 26 }}>{praise.emoji}</span>
              <div>
                {praise.isGoal && (
                  <div style={{ fontSize: 10, fontWeight: 700, color: C.red, letterSpacing: "0.1em", marginBottom: 3, textTransform: "uppercase" }}>
                    Wochenziel erreicht
                  </div>
                )}
                <span style={{ fontSize: praise.isGoal ? 15 : 14, fontWeight: 700, color: C.text }}>
                  {praise.text}
                </span>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Reset-Bestätigung (Modal mit Overlay) ── */}
      {resetConfirm && (
        <>
          <div style={{
            position: "fixed", inset: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 9998,
            animation: "fadeIn 0.2s ease",
          }} onClick={() => setResetConfirm(false)} />
          <div style={{
            position: "fixed", top: "50%", left: "50%",
            transform: "translate(-50%, -50%)",
            background: C.white,
            borderRadius: 14, overflow: "hidden",
            boxShadow: "0 16px 48px rgba(0,0,0,0.3)",
            zIndex: 9999,
            width: "min(400px, 90vw)",
            animation: "fadeIn 0.2s ease",
          }}>
            <div style={{ height: 4, background: C.red }} />
            <div style={{ padding: "24px 24px 20px" }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 8 }}>
                Woche zurücksetzen?
              </div>
              <div style={{ fontSize: 14, color: C.textSub, marginBottom: 20, lineHeight: 1.5 }}>
                Alle aktuellen Einträge werden gelöscht und in den Verlauf archiviert.
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button style={{ ...styles.btnPrimary, flex: 1 }} onClick={handleReset}>
                  Ja, zurücksetzen
                </button>
                <button style={{ ...styles.btnSecondary, flex: 1 }} onClick={() => setResetConfirm(false)}>
                  Abbrechen
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      <div style={styles.container}>

        {/* ── Header ── */}
        <div style={styles.header}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: C.red,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 20, flexShrink: 0,
              boxShadow: "0 2px 6px rgba(226,0,26,0.35)",
            }}>🏦</div>
            <h1 style={styles.title}>Fu-Fighters</h1>
          </div>
        </div>

        {/* ── Tab Nav ── */}
        <div style={{
          display: "flex", background: C.white,
          borderRadius: 10, padding: 3,
          border: `1px solid ${C.border}`,
          boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
        }}>
          {[["dashboard", "📊 Dashboard"], ["history", "📈 Verlauf"]].map(([tab, label]) => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              flex: 1, border: "none", borderRadius: 8, padding: "9px 0",
              fontSize: 13, fontWeight: 700, cursor: "pointer",
              background: activeTab === tab ? C.red : "transparent",
              color:      activeTab === tab ? C.white : C.textMuted,
              boxShadow:  activeTab === tab ? "0 1px 4px rgba(226,0,26,0.3)" : "none",
              transition: "all 0.2s",
            }}>{label}</button>
          ))}
        </div>

        {/* ── History Tab ── */}
        {activeTab === "history" ? (
          <HistoryView history={history} />
        ) : (
          <>
            {/* ── Ziel-Karte ── */}
            <div style={styles.card}>
              {/* Ziel-Beträge */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 18 }}>
                <div>
                  <div style={styles.label}>Gesamt eingetragen</div>
                  <div style={{ fontSize: 32, fontWeight: 800, color: C.text, lineHeight: 1, letterSpacing: "-0.5px" }}>
                    {formatEuro(total)}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={styles.label}>Wochenziel</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: C.red, lineHeight: 1 }}>
                    {formatEuro(WEEKLY_GOAL)}
                  </div>
                </div>
              </div>

              {/* Progress Bar */}
              <div style={styles.barWrap}>
                <div style={{
                  ...styles.barFill,
                  width: `${pct}%`,
                  background: goalDone
                    ? `linear-gradient(90deg, ${C.red}, ${C.yellow})`
                    : C.red,
                }}>
                  {pct > 8 && (
                    <span style={{ fontSize: 10, fontWeight: 700, color: C.white, paddingRight: 8, letterSpacing: "0.04em" }}>
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
              <div style={{
                textAlign: "center", fontSize: goalDone ? 17 : 14,
                fontWeight: goalDone ? 700 : 500,
                color: goalDone ? C.success : C.textSub,
                marginBottom: 12,
              }}>
                {goalDone ? "🎉 Ziel erreicht!" : `Noch ${formatEuro(remaining)} bis zum Ziel`}
              </div>

              {/* Motivation Banner */}
              <div style={{
                background: goalDone ? C.yellowLight : C.redLight,
                border: `1px solid ${goalDone ? C.yellow : C.red + "33"}`,
                borderLeft: `4px solid ${goalDone ? C.yellow : C.red}`,
                borderRadius: 8, padding: "10px 14px",
              }}>
                <span style={{ fontSize: 13, color: goalDone ? "#7A5800" : C.red, fontWeight: 600 }}>
                  {getMotivation(pct)}
                </span>
              </div>
            </div>

            {/* ── Betrag eintragen ── */}
            <div style={styles.card}>
              <div style={styles.cardTitle}>Kreditbetrag eintragen</div>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <div style={{ position: "relative", flex: 1 }}>
                  <span style={{
                    position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)",
                    color: C.textMuted, fontSize: 15, fontWeight: 600, pointerEvents: "none",
                  }}>€</span>
                  <input
                    style={{ ...styles.input, paddingLeft: 30 }}
                    placeholder="0"
                    value={amountInput}
                    onChange={(e) => { setInputError(""); setAmountInput(e.target.value); }}
                    onKeyDown={(e) => e.key === "Enter" && handleAddEntry()}
                    type="text"
                    inputMode="decimal"
                  />
                </div>
                <button style={styles.btnPrimary} onClick={handleAddEntry}>Eintragen</button>
              </div>
              {inputError && (
                <div style={{ color: C.red, fontSize: 12, marginTop: 6, fontWeight: 600 }}>
                  {inputError}
                </div>
              )}
              <p style={{ fontSize: 11, color: C.textMuted, margin: "10px 0 0", lineHeight: 1.5 }}>
                Dein Eintrag erscheint anonym in der Teamliste — kein Name, kein Profil.
              </p>
            </div>

            {/* ── Angebote & Termine ── */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              {/* Angebote */}
              <div style={styles.card}>
                <div style={{ fontSize: 10, fontWeight: 700, color: C.blue, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>
                  Angebote
                </div>
                <div style={{ fontSize: 42, fontWeight: 800, color: C.text, lineHeight: 1, marginBottom: 4 }}>{angebote}</div>
                <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 14 }}>erstellt diese Woche</div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={handleRemoveAngebot} style={styles.counterBtn}>−</button>
                  <button onClick={handleAddAngebot}    style={{ ...styles.counterBtn, ...styles.counterBtnBlue }}>+</button>
                </div>
              </div>

              {/* Termine */}
              <div style={styles.card}>
                <div style={{ fontSize: 10, fontWeight: 700, color: C.purple, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>
                  Termine
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 4 }}>
                  <span style={{ fontSize: 42, fontWeight: 800, color: C.text, lineHeight: 1 }}>{termine}</span>
                  <span style={{ fontSize: 13, color: C.textMuted, fontWeight: 600 }}>/ {TERMINE_GOAL}</span>
                </div>
                <div style={{ height: 5, background: C.bgInput, borderRadius: 3, marginBottom: 6, overflow: "hidden", border: `1px solid ${C.border}` }}>
                  <div style={{
                    height: "100%", borderRadius: 3,
                    width: `${Math.min((termine / TERMINE_GOAL) * 100, 100)}%`,
                    background: termine >= TERMINE_GOAL ? C.purple : "#9C6FCC",
                    transition: "width 0.5s ease",
                  }} />
                </div>
                <div style={{ fontSize: 11, color: termine >= TERMINE_GOAL ? C.purple : C.textMuted, marginBottom: 14, fontWeight: termine >= TERMINE_GOAL ? 700 : 400 }}>
                  {termine >= TERMINE_GOAL ? "Ziel erreicht! 🎉" : `Noch ${TERMINE_GOAL - termine} bis Ziel`}
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={handleRemoveTermin} style={styles.counterBtn}>−</button>
                  <button onClick={handleAddTermin}    style={{ ...styles.counterBtn, ...styles.counterBtnPurple }}>+</button>
                </div>
              </div>
            </div>

            {/* ── Teamaktivität ── */}
            <div style={styles.card}>
              <div style={styles.cardTitle}>
                Teamaktivität
                <span style={{ fontSize: 12, fontWeight: 500, color: C.textMuted }}>{entries.length} Einträge</span>
              </div>
              {loading ? (
                <div style={styles.emptyState}>Lade Daten …</div>
              ) : entries.length === 0 ? (
                <div style={styles.emptyState}>Noch keine Einträge — starte die Woche stark!</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 260, overflowY: "auto" }}>
                  {[...entries].sort((a, b) => b.ts - a.ts).slice(0, 20).map((e, i) => (
                    <div key={i} style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "9px 12px", borderRadius: 8,
                      background: C.bgInput, border: `1px solid ${C.border}`,
                    }}>
                      <div style={{ width: 7, height: 7, borderRadius: "50%", background: C.red, flexShrink: 0 }} />
                      <span style={{ fontSize: 13, color: C.textSub, flex: 1 }}>
                        Es wurden{" "}
                        <strong style={{ color: C.red }}>{formatEuro(e.amount)}</strong>{" "}
                        eingetragen
                      </span>
                      <span style={{ fontSize: 11, color: C.textMuted, fontVariantNumeric: "tabular-nums" }}>
                        {new Date(e.ts).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Reset ── */}
            <div style={{ display: "flex", justifyContent: "center", paddingTop: 4, paddingBottom: 8 }}>
              <button style={styles.resetBtn} onClick={() => setResetConfirm(true)}>
                ↺ Wöchentlicher Reset
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = {
  screen: {
    minHeight: "100vh",
    background: C.bgPage,
    fontFamily: "Arial, Helvetica, system-ui, -apple-system, sans-serif",
    display: "flex", justifyContent: "center", alignItems: "flex-start",
    padding: "24px 16px 60px",
    boxSizing: "border-box",
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
    color: C.text, letterSpacing: "-0.3px",
  },
  card: {
    background: C.white,
    border: `1px solid ${C.border}`,
    borderRadius: 14,
    padding: "20px 18px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
  },
  cardTitle: {
    fontSize: 13, fontWeight: 700,
    color: C.textSub,
    letterSpacing: "0.04em", textTransform: "uppercase",
    marginBottom: 14,
    display: "flex", justifyContent: "space-between", alignItems: "center",
  },
  sectionLabel: {
    display: "block",
    fontSize: 11, fontWeight: 700,
    color: C.textMuted,
    letterSpacing: "0.08em", textTransform: "uppercase",
    marginBottom: 12,
  },
  label: {
    fontSize: 11, color: C.textMuted, fontWeight: 600,
    letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 4,
  },
  barWrap: {
    height: 20, background: C.bgInput,
    borderRadius: 10, overflow: "hidden",
    marginBottom: 16, border: `1px solid ${C.border}`,
  },
  barFill: {
    height: "100%", borderRadius: 10,
    display: "flex", alignItems: "center", justifyContent: "flex-end",
    minWidth: 2,
    transition: "width 0.8s cubic-bezier(0.4,0,0.2,1)",
  },
  input: {
    width: "100%",
    background: C.white,
    border: `1.5px solid ${C.border}`,
    borderRadius: 9,
    padding: "11px 14px",
    color: C.text, fontSize: 16,
    outline: "none", boxSizing: "border-box",
    transition: "border-color 0.2s",
  },
  btnPrimary: {
    background: C.red, color: C.white,
    border: "none", borderRadius: 9,
    padding: "11px 22px", fontSize: 14, fontWeight: 700,
    cursor: "pointer", whiteSpace: "nowrap",
    letterSpacing: "0.02em",
    transition: "background 0.15s",
    boxShadow: "0 2px 6px rgba(226,0,26,0.3)",
  },
  btnSecondary: {
    background: C.white, color: C.red,
    border: `1.5px solid ${C.red}`,
    borderRadius: 9, padding: "11px 18px",
    fontSize: 14, fontWeight: 600,
    cursor: "pointer", transition: "background 0.15s",
  },
  counterBtn: {
    flex: 1, background: C.bgInput,
    border: `1px solid ${C.border}`,
    borderRadius: 8, color: C.textSub,
    fontSize: 18, fontWeight: 700,
    padding: "7px 0", cursor: "pointer",
    transition: "background 0.15s",
  },
  counterBtnBlue: {
    background: C.blue, color: C.white, border: "none",
  },
  counterBtnPurple: {
    background: C.purple, color: C.white, border: "none",
  },
  emptyState: {
    textAlign: "center", color: C.textMuted,
    fontSize: 14, padding: "20px 0",
  },
  resetBtn: {
    background: "transparent",
    border: `1px solid ${C.border}`,
    borderRadius: 8, color: C.textMuted,
    fontSize: 13, padding: "8px 18px",
    cursor: "pointer", transition: "color 0.2s, border-color 0.2s",
  },
};
