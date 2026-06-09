import { useState, useEffect, useRef, useCallback } from "react";

const WEEKLY_GOAL = 62500;
const STORAGE_KEY_ENTRIES = "kredit-tracker-entries";
const STORAGE_KEY_ANGEBOTE = "kredit-tracker-angebote";
const STORAGE_KEY_TERMINE = "kredit-tracker-termine";
const STORAGE_KEY_HISTORY = "kredit-tracker-history";
const STORAGE_KEY_CURRENT_WEEK = "kredit-tracker-current-week";
const TERMINE_GOAL = 8;
const MILESTONES = [25, 50, 75, 100];

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
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function getMonday(d = new Date()) {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const mon = new Date(d);
  mon.setDate(diff);
  mon.setHours(0, 0, 0, 0);
  return mon;
}

function getKWLabel(mondayDate) {
  const d = new Date(mondayDate);
  const jan4 = new Date(d.getFullYear(), 0, 4);
  const startOfWeek1 = new Date(jan4);
  startOfWeek1.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7));
  const weekNum = Math.round((d - startOfWeek1) / (7 * 86400000)) + 1;
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
  const step =
    MOTIVATION_STEPS.find((s) => pct >= s.min && pct < s.max) ||
    MOTIVATION_STEPS[MOTIVATION_STEPS.length - 1];
  return step.text;
}

// ---------- localStorage helpers ----------

function lsGet(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function lsSet(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {}
}

// ---------- Sub-components ----------

function ConfettiCanvas() {
  const canvasRef = useRef(null);
  const particles = useRef([]);
  const animRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const colors = ["#00C896", "#1A3560", "#FFD700", "#FFFFFF", "#4A9EFF"];
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
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.rotSpeed;
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
    <canvas
      ref={canvasRef}
      style={{ position: "fixed", top: 0, left: 0, pointerEvents: "none", zIndex: 9999 }}
    />
  );
}

function MilestoneBadge({ milestone, achieved }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
        opacity: achieved ? 1 : 0.35,
        transition: "opacity 0.5s, transform 0.3s",
        transform: achieved ? "scale(1.1)" : "scale(1)",
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: "50%",
          background: achieved
            ? "linear-gradient(135deg, #00C896, #00A87A)"
            : "#1E3A6E",
          border: achieved ? "2px solid #00C896" : "2px solid #2A4A8A",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 14,
          boxShadow: achieved ? "0 0 12px rgba(0,200,150,0.5)" : "none",
          transition: "all 0.4s",
        }}
      >
        {achieved ? "✓" : `${milestone}%`}
      </div>
      <span style={{ fontSize: 10, color: achieved ? "#00C896" : "#4A6490", fontWeight: 600 }}>
        {milestone}%
      </span>
    </div>
  );
}

function HistoryView({ history }) {
  if (history.length === 0) {
    return (
      <div
        style={{
          textAlign: "center",
          padding: "48px 24px",
          color: "#3A5278",
          fontSize: 14,
          lineHeight: 1.7,
        }}
      >
        <div style={{ fontSize: 36, marginBottom: 12 }}>📊</div>
        Noch keine abgeschlossenen Wochen.
        <br />
        Nach dem ersten Reset erscheinen hier die Ergebnisse.
      </div>
    );
  }

  const kreditReachedCount = history.filter((h) => h.kreditReached).length;
  const termineReachedCount = history.filter((h) => h.termineReached).length;
  const avgKredit = history.reduce((s, h) => s + h.kredit, 0) / history.length;
  const avgKreditPct = Math.round((avgKredit / 62500) * 100);
  const avgTermine = (history.reduce((s, h) => s + h.termine, 0) / history.length).toFixed(1);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        {[
          { label: "Wochen gesamt", value: history.length, color: "#4A9EFF" },
          { label: "Kreditziel ✓", value: `${kreditReachedCount}×`, color: "#00C896" },
          { label: "Terminziel ✓", value: `${termineReachedCount}×`, color: "#C084FC" },
        ].map(({ label, value, color }) => (
          <div
            key={label}
            style={{
              background: "#132040",
              border: "1px solid #1E3A6E",
              borderRadius: 12,
              padding: "14px 10px",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 20, fontWeight: 800, color }}>{value}</div>
            <div style={{ fontSize: 10, color: "#4A6490", marginTop: 4, fontWeight: 600 }}>
              {label}
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          background: "#132040",
          border: "1px solid #1E3A6E",
          borderRadius: 12,
          padding: "16px 18px",
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "#94B8E8",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            marginBottom: 14,
          }}
        >
          Ø Durchschnitt
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
              <span style={{ fontSize: 13, color: "#CBD5E1" }}>Kredit</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#00C896" }}>
                {new Intl.NumberFormat("de-DE", {
                  style: "currency",
                  currency: "EUR",
                  maximumFractionDigits: 0,
                }).format(avgKredit)}{" "}
                ({avgKreditPct}%)
              </span>
            </div>
            <div
              style={{
                height: 6,
                background: "#0A1628",
                borderRadius: 3,
                overflow: "hidden",
                border: "1px solid #1E3A6E",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${Math.min(avgKreditPct, 100)}%`,
                  background: "linear-gradient(90deg,#0077CC,#00C896)",
                  borderRadius: 3,
                }}
              />
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 13, color: "#CBD5E1" }}>Ø Termine pro Woche</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#C084FC" }}>
              {avgTermine} / 8
            </span>
          </div>
        </div>
      </div>

      <div
        style={{
          background: "#132040",
          border: "1px solid #1E3A6E",
          borderRadius: 12,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "14px 18px 10px",
            fontSize: 11,
            fontWeight: 700,
            color: "#94B8E8",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          Wochendetails
        </div>
        {history.map((h, i) => (
          <div
            key={i}
            style={{
              borderTop: "1px solid #1A3060",
              padding: "14px 18px",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#FFFFFF" }}>{h.label}</span>
              <div style={{ display: "flex", gap: 6 }}>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    padding: "3px 8px",
                    borderRadius: 20,
                    background: h.kreditReached
                      ? "rgba(0,200,150,0.15)"
                      : "rgba(255,100,100,0.1)",
                    color: h.kreditReached ? "#00C896" : "#FF8080",
                    border: `1px solid ${
                      h.kreditReached ? "rgba(0,200,150,0.3)" : "rgba(255,100,100,0.2)"
                    }`,
                  }}
                >
                  {h.kreditReached ? "✓ Kredit" : "✗ Kredit"}
                </span>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    padding: "3px 8px",
                    borderRadius: 20,
                    background: h.termineReached
                      ? "rgba(192,132,252,0.15)"
                      : "rgba(255,100,100,0.1)",
                    color: h.termineReached ? "#C084FC" : "#FF8080",
                    border: `1px solid ${
                      h.termineReached ? "rgba(192,132,252,0.3)" : "rgba(255,100,100,0.2)"
                    }`,
                  }}
                >
                  {h.termineReached ? "✓ Termine" : "✗ Termine"}
                </span>
              </div>
            </div>
            <div style={{ display: "flex", gap: 20 }}>
              <div style={{ fontSize: 12, color: "#4A6490" }}>
                Kredit:{" "}
                <span style={{ color: "#94B8E8", fontWeight: 600 }}>
                  {new Intl.NumberFormat("de-DE", {
                    style: "currency",
                    currency: "EUR",
                    maximumFractionDigits: 0,
                  }).format(h.kredit)}
                </span>
                <span style={{ color: h.kreditReached ? "#00C896" : "#4A6490" }}>
                  {" "}
                  ({Math.round((h.kredit / h.kreditGoal) * 100)}%)
                </span>
              </div>
              <div style={{ fontSize: 12, color: "#4A6490" }}>
                Angebote:{" "}
                <span style={{ color: "#94B8E8", fontWeight: 600 }}>{h.angebote}</span>
              </div>
              <div style={{ fontSize: 12, color: "#4A6490" }}>
                Termine:{" "}
                <span style={{ color: "#94B8E8", fontWeight: 600 }}>
                  {h.termine}/{h.termineGoal}
                </span>
              </div>
            </div>
            <div
              style={{ height: 4, background: "#0A1628", borderRadius: 2, overflow: "hidden" }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${Math.min((h.kredit / h.kreditGoal) * 100, 100)}%`,
                  background: h.kreditReached
                    ? "linear-gradient(90deg,#00C896,#00FFC0)"
                    : "linear-gradient(90deg,#1E5FA0,#2A7FCC)",
                  borderRadius: 2,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const GlobalStyle = () => (
  <style>{`
    @keyframes slideUp {
      from { opacity: 0; transform: translateX(-50%) translateY(20px); }
      to   { opacity: 1; transform: translateX(-50%) translateY(0); }
    }
    button:hover { filter: brightness(1.1); }
  `}</style>
);

// ---------- Main App ----------

export default function App() {
  const [nickname, setNickname] = useState("");
  const [nickInput, setNickInput] = useState("");
  const [entries, setEntries] = useState([]);
  const [amountInput, setAmountInput] = useState("");
  const [inputError, setInputError] = useState("");
  const [showConfetti, setShowConfetti] = useState(false);
  const [reachedMilestones, setReachedMilestones] = useState(new Set());
  const [pulsingMilestone, setPulsingMilestone] = useState(null);
  const [loading, setLoading] = useState(true);
  const [resetConfirm, setResetConfirm] = useState(false);
  const [praise, setPraise] = useState(null);
  const praiseTimer = useRef(null);
  const [angebote, setAngebote] = useState(0);
  const [termine, setTermine] = useState(0);
  const [history, setHistory] = useState([]);
  const [activeTab, setActiveTab] = useState("dashboard");
  const prevPct = useRef(0);

  // Load from localStorage on mount
  useEffect(() => {
    const thisMonday = getMonday().getTime();

    // Load current entries
    const rawEntries = lsGet(STORAGE_KEY_ENTRIES);
    const loadedEntries = rawEntries ? JSON.parse(rawEntries) : [];

    const rawAngebote = lsGet(STORAGE_KEY_ANGEBOTE);
    const loadedAngebote = rawAngebote ? parseInt(rawAngebote, 10) : 0;

    const rawTermine = lsGet(STORAGE_KEY_TERMINE);
    const loadedTermine = rawTermine ? parseInt(rawTermine, 10) : 0;

    const rawHistory = lsGet(STORAGE_KEY_HISTORY);
    let loadedHistory = rawHistory ? JSON.parse(rawHistory) : [];

    // Auto-reset: if we crossed into a new week, archive last week
    const storedWeek = lsGet(STORAGE_KEY_CURRENT_WEEK);
    const storedWeekMs = storedWeek ? parseInt(storedWeek, 10) : null;

    if (storedWeekMs && storedWeekMs < thisMonday) {
      const lastTotal = loadedEntries.reduce((s, e) => s + e.amount, 0);
      if (lastTotal > 0 || loadedAngebote > 0 || loadedTermine > 0) {
        const snapshot = {
          weekKey: storedWeekMs,
          label: getKWLabel(new Date(storedWeekMs)),
          kredit: lastTotal,
          kreditGoal: WEEKLY_GOAL,
          kreditReached: lastTotal >= WEEKLY_GOAL,
          angebote: loadedAngebote,
          termine: loadedTermine,
          termineGoal: TERMINE_GOAL,
          termineReached: loadedTermine >= TERMINE_GOAL,
        };
        loadedHistory = [snapshot, ...loadedHistory].slice(0, 52);
        lsSet(STORAGE_KEY_HISTORY, JSON.stringify(loadedHistory));
      }
      // Clear current week
      lsSet(STORAGE_KEY_ENTRIES, JSON.stringify([]));
      lsSet(STORAGE_KEY_ANGEBOTE, "0");
      lsSet(STORAGE_KEY_TERMINE, "0");
      setEntries([]);
      setAngebote(0);
      setTermine(0);
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

  const total = entries.reduce((s, e) => s + e.amount, 0);
  const pct = Math.min((total / WEEKLY_GOAL) * 100, 100);
  const remaining = Math.max(WEEKLY_GOAL - total, 0);

  // Milestone & confetti detection
  useEffect(() => {
    if (loading) return;
    MILESTONES.forEach((m) => {
      if (pct >= m && !reachedMilestones.has(m)) {
        setReachedMilestones((prev) => new Set([...prev, m]));
        setPulsingMilestone(m);
        setTimeout(() => setPulsingMilestone(null), 2000);
        if (m === 100) {
          setShowConfetti(true);
          setTimeout(() => setShowConfetti(false), 5000);
        }
      }
    });
    prevPct.current = pct;
  }, [pct, loading]);

  const saveEntries = useCallback((newEntries) => {
    lsSet(STORAGE_KEY_ENTRIES, JSON.stringify(newEntries));
    setEntries(newEntries);
  }, []);

  const handleAddEntry = () => {
    const raw = amountInput.replace(/\./g, "").replace(",", ".");
    const val = parseFloat(raw);
    if (!val || isNaN(val) || val <= 0) {
      setInputError("Bitte einen gültigen Betrag eingeben.");
      return;
    }
    setInputError("");
    const newEntry = { amount: val, ts: Date.now() };
    const updatedEntries = [...entries, newEntry];
    saveEntries(updatedEntries);
    setAmountInput("");

    const newTotal = updatedEntries.reduce((s, e) => s + e.amount, 0);
    const justReachedGoal = newTotal >= WEEKLY_GOAL && total < WEEKLY_GOAL;
    const p = { ...getRandomPraise(justReachedGoal), isGoal: justReachedGoal };
    setPraise(p);
    if (praiseTimer.current) clearTimeout(praiseTimer.current);
    praiseTimer.current = setTimeout(() => setPraise(null), justReachedGoal ? 6000 : 3500);
  };

  const handleAddAngebot = () => {
    const next = angebote + 1;
    setAngebote(next);
    lsSet(STORAGE_KEY_ANGEBOTE, String(next));
  };

  const handleRemoveAngebot = () => {
    const next = Math.max(0, angebote - 1);
    setAngebote(next);
    lsSet(STORAGE_KEY_ANGEBOTE, String(next));
  };

  const handleAddTermin = () => {
    const next = termine + 1;
    setTermine(next);
    lsSet(STORAGE_KEY_TERMINE, String(next));
  };

  const handleRemoveTermin = () => {
    const next = Math.max(0, termine - 1);
    setTermine(next);
    lsSet(STORAGE_KEY_TERMINE, String(next));
  };

  const handleReset = () => {
    const thisMonday = getMonday().getTime();

    if (total > 0 || angebote > 0 || termine > 0) {
      const rawHistory = lsGet(STORAGE_KEY_HISTORY);
      const freshHist = rawHistory ? JSON.parse(rawHistory) : [];
      const alreadyArchived = freshHist.some((h) => h.weekKey === thisMonday);
      if (!alreadyArchived) {
        const snapshot = {
          weekKey: thisMonday,
          label: getKWLabel(new Date(thisMonday)),
          kredit: total,
          kreditGoal: WEEKLY_GOAL,
          kreditReached: total >= WEEKLY_GOAL,
          angebote,
          termine,
          termineGoal: TERMINE_GOAL,
          termineReached: termine >= TERMINE_GOAL,
        };
        const newHist = [snapshot, ...freshHist].slice(0, 52);
        lsSet(STORAGE_KEY_HISTORY, JSON.stringify(newHist));
        setHistory(newHist);
      }
    }

    lsSet(STORAGE_KEY_ENTRIES, JSON.stringify([]));
    lsSet(STORAGE_KEY_ANGEBOTE, "0");
    lsSet(STORAGE_KEY_TERMINE, "0");
    lsSet(STORAGE_KEY_CURRENT_WEEK, String(thisMonday));
    setEntries([]);
    setAngebote(0);
    setTermine(0);
    setReachedMilestones(new Set());
    setShowConfetti(false);
    setResetConfirm(false);
    prevPct.current = 0;
  };

  // Login screen
  if (!nickname) {
    return (
      <div style={styles.screen}>
        <div style={styles.loginCard}>
          <div style={styles.bankIcon}>🏦</div>
          <h1 style={styles.loginTitle}>Team-Kredit-Tracker</h1>
          <p style={styles.loginSub}>
            Wähle einen anonymen Spitznamen für diese Session. Kein echter Name — nur für dich.
          </p>
          <input
            style={styles.input}
            placeholder="z.B. Falke, Titan, Blitz …"
            value={nickInput}
            onChange={(e) => setNickInput(e.target.value)}
            onKeyDown={(e) =>
              e.key === "Enter" && nickInput.trim() && setNickname(nickInput.trim())
            }
            maxLength={20}
          />
          <button
            style={{
              ...styles.btn,
              opacity: nickInput.trim() ? 1 : 0.5,
              cursor: nickInput.trim() ? "pointer" : "not-allowed",
            }}
            onClick={() => nickInput.trim() && setNickname(nickInput.trim())}
          >
            Beitreten
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.screen}>
      <GlobalStyle />
      {showConfetti && <ConfettiCanvas />}
      {praise && (
        <div
          style={{
            position: "fixed",
            bottom: 32,
            left: "50%",
            transform: "translateX(-50%)",
            background: praise.isGoal
              ? "linear-gradient(135deg, #1A2A00, #243800)"
              : "linear-gradient(135deg, #0D2A1F, #0F3828)",
            border: praise.isGoal ? "1.5px solid #FFD700" : "1px solid #00C896",
            borderRadius: praise.isGoal ? 18 : 14,
            padding: praise.isGoal ? "18px 30px" : "14px 24px",
            display: "flex",
            alignItems: "center",
            gap: 12,
            boxShadow: praise.isGoal
              ? "0 8px 40px rgba(255,215,0,0.3), 0 2px 8px rgba(0,0,0,0.5)"
              : "0 8px 32px rgba(0,200,150,0.25), 0 2px 8px rgba(0,0,0,0.4)",
            zIndex: 10000,
            animation: "slideUp 0.35s cubic-bezier(0.34,1.56,0.64,1)",
            whiteSpace: "nowrap",
            maxWidth: "90vw",
          }}
        >
          <span style={{ fontSize: praise.isGoal ? 34 : 26 }}>{praise.emoji}</span>
          <div>
            {praise.isGoal && (
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: "#FFD700",
                  letterSpacing: "0.12em",
                  marginBottom: 3,
                  textTransform: "uppercase",
                }}
              >
                Wochenziel erreicht
              </div>
            )}
            <span
              style={{
                fontSize: praise.isGoal ? 16 : 15,
                fontWeight: 700,
                color: praise.isGoal ? "#FFFDE0" : "#E0FFF5",
                letterSpacing: "-0.1px",
              }}
            >
              {praise.text}
            </span>
          </div>
        </div>
      )}

      <div style={styles.container}>
        {/* Header */}
        <div style={styles.header}>
          <div>
            <div style={styles.eyebrow}>WOCHENZIEL 2025</div>
            <h1 style={styles.title}>Team-Kredit-Tracker</h1>
          </div>
          <div style={styles.nicknameTag}>
            <span style={styles.dot} />
            {nickname}
          </div>
        </div>

        {/* Tab Nav */}
        <div
          style={{
            display: "flex",
            background: "#0A1628",
            borderRadius: 12,
            padding: 4,
            border: "1px solid #1E3A6E",
          }}
        >
          {[
            ["dashboard", "📊 Dashboard"],
            ["history", "📈 Verlauf"],
          ].map(([tab, label]) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                flex: 1,
                border: "none",
                borderRadius: 9,
                padding: "9px 0",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: "inherit",
                background: activeTab === tab ? "#132040" : "transparent",
                color: activeTab === tab ? "#FFFFFF" : "#4A6490",
                boxShadow: activeTab === tab ? "0 1px 4px rgba(0,0,0,0.4)" : "none",
                transition: "all 0.2s",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {activeTab === "history" ? (
          <HistoryView history={history} />
        ) : (
          <>
            {/* Goal Card */}
            <div style={styles.card}>
              <div style={styles.goalRow}>
                <div>
                  <div style={styles.label}>Gesamt eingetragen</div>
                  <div style={styles.bigNumber}>{formatEuro(total)}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={styles.label}>Wochenziel</div>
                  <div style={{ ...styles.bigNumber, color: "#4A9EFF" }}>
                    {formatEuro(WEEKLY_GOAL)}
                  </div>
                </div>
              </div>

              {/* Progress bar */}
              <div style={styles.barWrap}>
                <div
                  style={{
                    ...styles.barFill,
                    width: `${pct}%`,
                    background:
                      pct >= 100
                        ? "linear-gradient(90deg, #00C896, #00FFC0)"
                        : "linear-gradient(90deg, #0077CC, #00C896)",
                  }}
                >
                  {pct > 8 && <span style={styles.barLabel}>{Math.round(pct)}%</span>}
                  <div style={styles.barGlow} />
                </div>
              </div>

              {/* Milestones */}
              <div style={styles.milestoneRow}>
                {MILESTONES.map((m) => (
                  <MilestoneBadge
                    key={m}
                    milestone={m}
                    achieved={reachedMilestones.has(m)}
                    pulsing={pulsingMilestone === m}
                  />
                ))}
              </div>

              {/* Status text */}
              <div style={pct >= 100 ? styles.statusSuccess : styles.statusNeutral}>
                {pct >= 100 ? "🎉 Ziel erreicht!" : `Noch ${formatEuro(remaining)} bis zum Ziel`}
              </div>

              {/* Motivation */}
              <div
                style={{
                  ...styles.motivationBanner,
                  borderLeft:
                    pct >= 100
                      ? "3px solid #FFD700"
                      : pct >= 67
                      ? "3px solid #00C896"
                      : "3px solid #4A9EFF",
                }}
              >
                <span
                  style={{
                    ...styles.motivationText,
                    color:
                      pct >= 100 ? "#FFFDE0" : pct >= 67 ? "#B8FFE8" : "#CBD5E1",
                  }}
                >
                  {getMotivation(pct)}
                </span>
              </div>
            </div>

            {/* Input Card */}
            <div style={styles.card}>
              <div style={styles.cardTitle}>Kreditbetrag eintragen</div>
              <div style={styles.inputRow}>
                <div style={{ position: "relative", flex: 1 }}>
                  <span style={styles.euroSign}>€</span>
                  <input
                    style={{ ...styles.input, paddingLeft: 32, margin: 0 }}
                    placeholder="0"
                    value={amountInput}
                    onChange={(e) => {
                      setInputError("");
                      setAmountInput(e.target.value);
                    }}
                    onKeyDown={(e) => e.key === "Enter" && handleAddEntry()}
                    type="text"
                    inputMode="decimal"
                  />
                </div>
                <button style={styles.btn} onClick={handleAddEntry}>
                  Eintragen
                </button>
              </div>
              {inputError && <div style={styles.error}>{inputError}</div>}
              <p style={styles.hint}>
                Dein Eintrag erscheint anonym in der Teamliste — kein Name, kein Profil.
              </p>
            </div>

            {/* Angebote & Termine */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {/* Angebote */}
              <div style={styles.card}>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: "#4A9EFF",
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    marginBottom: 10,
                  }}
                >
                  Angebote
                </div>
                <div
                  style={{
                    fontSize: 38,
                    fontWeight: 800,
                    color: "#FFFFFF",
                    lineHeight: 1,
                    marginBottom: 6,
                  }}
                >
                  {angebote}
                </div>
                <div style={{ fontSize: 11, color: "#4A6490", marginBottom: 14 }}>
                  erstellt diese Woche
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={handleRemoveAngebot} style={styles.counterBtn}>
                    −
                  </button>
                  <button
                    onClick={handleAddAngebot}
                    style={{ ...styles.counterBtn, ...styles.counterBtnAdd }}
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Termine */}
              <div style={styles.card}>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: "#C084FC",
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    marginBottom: 10,
                  }}
                >
                  Termine
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    gap: 6,
                    marginBottom: 6,
                  }}
                >
                  <span
                    style={{ fontSize: 38, fontWeight: 800, color: "#FFFFFF", lineHeight: 1 }}
                  >
                    {termine}
                  </span>
                  <span style={{ fontSize: 13, color: "#4A6490", fontWeight: 600 }}>
                    / {TERMINE_GOAL}
                  </span>
                </div>
                <div
                  style={{
                    height: 5,
                    background: "#0A1628",
                    borderRadius: 3,
                    marginBottom: 6,
                    overflow: "hidden",
                    border: "1px solid #1E3A6E",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      borderRadius: 3,
                      width: `${Math.min((termine / TERMINE_GOAL) * 100, 100)}%`,
                      background:
                        termine >= TERMINE_GOAL
                          ? "linear-gradient(90deg,#C084FC,#A855F7)"
                          : "linear-gradient(90deg,#7C3AED,#C084FC)",
                      transition: "width 0.5s cubic-bezier(0.4,0,0.2,1)",
                    }}
                  />
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: termine >= TERMINE_GOAL ? "#C084FC" : "#4A6490",
                    marginBottom: 14,
                    fontWeight: termine >= TERMINE_GOAL ? 700 : 400,
                  }}
                >
                  {termine >= TERMINE_GOAL
                    ? "Ziel erreicht! 🎉"
                    : `Noch ${TERMINE_GOAL - termine} bis Ziel`}
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={handleRemoveTermin} style={styles.counterBtn}>
                    −
                  </button>
                  <button
                    onClick={handleAddTermin}
                    style={{
                      ...styles.counterBtn,
                      background: "linear-gradient(135deg,#7C3AED,#A855F7)",
                      border: "none",
                    }}
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            {/* Activity Log */}
            <div style={styles.card}>
              <div style={styles.cardTitle}>
                Teamaktivität
                <span style={styles.entryCount}>{entries.length} Einträge</span>
              </div>
              {loading ? (
                <div style={styles.emptyState}>Lade Teamdaten …</div>
              ) : entries.length === 0 ? (
                <div style={styles.emptyState}>
                  Noch keine Einträge — starte die Woche stark!
                </div>
              ) : (
                <div style={styles.activityList}>
                  {[...entries]
                    .sort((a, b) => b.ts - a.ts)
                    .slice(0, 20)
                    .map((e, i) => (
                      <div key={i} style={styles.activityItem}>
                        <div style={styles.activityDot} />
                        <span style={styles.activityText}>
                          Es wurden{" "}
                          <strong style={{ color: "#00C896" }}>{formatEuro(e.amount)}</strong>{" "}
                          eingetragen
                        </span>
                        <span style={styles.activityTime}>
                          {new Date(e.ts).toLocaleTimeString("de-DE", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    ))}
                </div>
              )}
            </div>

            {/* Reset */}
            <div style={styles.resetArea}>
              {!resetConfirm ? (
                <button style={styles.resetBtn} onClick={() => setResetConfirm(true)}>
                  ↺ Wöchentlicher Reset
                </button>
              ) : (
                <div style={styles.confirmBox}>
                  <span style={{ color: "#CBD5E1", fontSize: 14 }}>
                    Alle Einträge für das Team löschen?
                  </span>
                  <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                    <button style={styles.confirmYes} onClick={handleReset}>
                      Ja, zurücksetzen
                    </button>
                    <button style={styles.confirmNo} onClick={() => setResetConfirm(false)}>
                      Abbrechen
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ---------- Styles ----------

const styles = {
  screen: {
    minHeight: "100vh",
    background: "linear-gradient(160deg, #0A1628 0%, #0F2244 60%, #0A1628 100%)",
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
    display: "flex",
    justifyContent: "center",
    alignItems: "flex-start",
    padding: "24px 16px 48px",
    boxSizing: "border-box",
  },
  container: {
    width: "100%",
    maxWidth: 560,
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingBottom: 4,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: "0.14em",
    color: "#4A9EFF",
    marginBottom: 4,
  },
  title: {
    margin: 0,
    fontSize: 22,
    fontWeight: 700,
    color: "#FFFFFF",
    letterSpacing: "-0.3px",
  },
  nicknameTag: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    background: "#1A3560",
    border: "1px solid #2A4A8A",
    borderRadius: 20,
    padding: "5px 12px",
    fontSize: 13,
    color: "#94B8E8",
    fontWeight: 500,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: "50%",
    background: "#00C896",
    boxShadow: "0 0 6px #00C896",
  },
  card: {
    background: "#132040",
    border: "1px solid #1E3A6E",
    borderRadius: 16,
    padding: "22px 20px",
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: 700,
    color: "#94B8E8",
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    marginBottom: 16,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  entryCount: {
    fontSize: 12,
    fontWeight: 500,
    color: "#4A6490",
    textTransform: "none",
    letterSpacing: 0,
  },
  goalRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 20,
  },
  label: {
    fontSize: 11,
    color: "#4A6490",
    fontWeight: 600,
    letterSpacing: "0.05em",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  bigNumber: {
    fontSize: 28,
    fontWeight: 800,
    color: "#FFFFFF",
    letterSpacing: "-0.5px",
    lineHeight: 1,
  },
  barWrap: {
    height: 18,
    background: "#0A1628",
    borderRadius: 9,
    overflow: "hidden",
    marginBottom: 16,
    position: "relative",
    border: "1px solid #1E3A6E",
  },
  barFill: {
    height: "100%",
    borderRadius: 9,
    position: "relative",
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    minWidth: 2,
    transition: "width 0.8s cubic-bezier(0.4,0,0.2,1)",
  },
  barLabel: {
    fontSize: 10,
    fontWeight: 700,
    color: "#fff",
    paddingRight: 8,
    letterSpacing: "0.04em",
    textShadow: "0 1px 2px rgba(0,0,0,0.4)",
  },
  barGlow: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: 30,
    background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.25))",
    borderRadius: 9,
  },
  milestoneRow: {
    display: "flex",
    justifyContent: "space-around",
    marginBottom: 16,
    padding: "0 8px",
  },
  statusNeutral: {
    textAlign: "center",
    fontSize: 15,
    color: "#94B8E8",
    fontWeight: 500,
    marginBottom: 12,
  },
  statusSuccess: {
    textAlign: "center",
    fontSize: 18,
    color: "#00C896",
    fontWeight: 700,
    marginBottom: 12,
    textShadow: "0 0 20px rgba(0,200,150,0.4)",
  },
  motivationBanner: {
    background: "#0A1A35",
    border: "1px solid #1E3A6E",
    borderLeft: "3px solid #00C896",
    borderRadius: 8,
    padding: "10px 14px",
  },
  motivationText: {
    fontSize: 13,
    color: "#CBD5E1",
    fontWeight: 500,
    fontStyle: "italic",
  },
  inputRow: {
    display: "flex",
    gap: 10,
    alignItems: "center",
  },
  euroSign: {
    position: "absolute",
    left: 11,
    top: "50%",
    transform: "translateY(-50%)",
    color: "#4A6490",
    fontSize: 15,
    fontWeight: 600,
    pointerEvents: "none",
  },
  input: {
    width: "100%",
    background: "#0A1628",
    border: "1px solid #1E3A6E",
    borderRadius: 10,
    padding: "11px 14px",
    color: "#FFFFFF",
    fontSize: 15,
    outline: "none",
    boxSizing: "border-box",
    fontFamily: "inherit",
    margin: "12px 0",
    transition: "border-color 0.2s",
  },
  btn: {
    background: "linear-gradient(135deg, #00A87A, #00C896)",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    padding: "11px 20px",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
    whiteSpace: "nowrap",
    letterSpacing: "0.02em",
    transition: "opacity 0.2s, transform 0.1s",
    fontFamily: "inherit",
  },
  error: {
    color: "#FF6B6B",
    fontSize: 12,
    marginTop: 6,
    fontWeight: 500,
  },
  hint: {
    fontSize: 11,
    color: "#3A5278",
    margin: "10px 0 0",
    lineHeight: 1.5,
  },
  activityList: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
    maxHeight: 240,
    overflowY: "auto",
  },
  activityItem: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "9px 12px",
    borderRadius: 8,
    background: "#0A1628",
    border: "1px solid #1A3560",
  },
  activityDot: {
    width: 6,
    height: 6,
    borderRadius: "50%",
    background: "#00C896",
    flexShrink: 0,
  },
  activityText: {
    fontSize: 13,
    color: "#94B8E8",
    flex: 1,
  },
  activityTime: {
    fontSize: 11,
    color: "#3A5278",
    fontVariantNumeric: "tabular-nums",
  },
  emptyState: {
    textAlign: "center",
    color: "#3A5278",
    fontSize: 14,
    padding: "20px 0",
  },
  resetArea: {
    display: "flex",
    justifyContent: "center",
    paddingTop: 4,
  },
  resetBtn: {
    background: "transparent",
    border: "1px solid #1E3A6E",
    borderRadius: 8,
    color: "#3A5278",
    fontSize: 13,
    padding: "8px 18px",
    cursor: "pointer",
    fontFamily: "inherit",
    transition: "color 0.2s, border-color 0.2s",
  },
  confirmBox: {
    background: "#132040",
    border: "1px solid #2A4A8A",
    borderRadius: 12,
    padding: "16px 20px",
    textAlign: "center",
    width: "100%",
  },
  confirmYes: {
    background: "#C0392B",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    padding: "8px 16px",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "inherit",
  },
  confirmNo: {
    background: "#1A3560",
    color: "#94B8E8",
    border: "none",
    borderRadius: 8,
    padding: "8px 16px",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "inherit",
  },
  counterBtn: {
    flex: 1,
    background: "#0A1628",
    border: "1px solid #1E3A6E",
    borderRadius: 8,
    color: "#94B8E8",
    fontSize: 18,
    fontWeight: 700,
    padding: "6px 0",
    cursor: "pointer",
    fontFamily: "inherit",
    transition: "background 0.15s",
  },
  counterBtnAdd: {
    background: "linear-gradient(135deg, #00A87A, #00C896)",
    border: "none",
    color: "#fff",
  },
  loginCard: {
    background: "#132040",
    border: "1px solid #1E3A6E",
    borderRadius: 20,
    padding: "40px 32px",
    maxWidth: 400,
    width: "100%",
    textAlign: "center",
  },
  bankIcon: {
    fontSize: 40,
    marginBottom: 16,
  },
  loginTitle: {
    margin: "0 0 10px",
    fontSize: 22,
    fontWeight: 800,
    color: "#FFFFFF",
    letterSpacing: "-0.3px",
  },
  loginSub: {
    fontSize: 14,
    color: "#4A6490",
    lineHeight: 1.6,
    marginBottom: 24,
  },
};
