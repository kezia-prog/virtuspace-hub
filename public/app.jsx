/* VirtuSpace Daily Hub — front-end
   Minimalist: ivory canvas, deep indigo accent, hairline structure. */

const { useState, useEffect, useRef, useMemo } = React;

const T = {
  pine: "#1F0D9E",
  pineSoft: "#3629B5",
  mist: "#E9EBF8",
  mistDeep: "#C9CEEC",
  lavender: "#7C73C0",
  paper: "#F1F0E8",
  card: "#FFFFFF",
  ink: "#33343A",
  inkSoft: "#6A6B75",
  line: "#E1E0D6",
};
const serif = { fontFamily: "'Poppins', system-ui, sans-serif" };
const MOODS = [
  ["great", "😄", "Great"],
  ["good", "🙂", "Good"],
  ["okay", "😐", "Okay"],
  ["stretched", "😥", "Stretched"],
  ["struggling", "😔", "Struggling"],
];
const moodMeta = (m) => MOODS.find((x) => x[0] === m);

const BRAND = {
  name: "VirtuSpace",
  tagline: "Your Partner in Professional Success",
  email: "hello@virtuspacett.com",
  phone: "1-868-307-6949",
  site: "virtuspacett.com",
};

/* ── helpers ── */
const pad = (n) => String(n).padStart(2, "0");
const fmtMins = (m) => {
  m = Math.round(m);
  const h = Math.floor(m / 60);
  return h ? `${h}h ${m % 60 ? (m % 60) + "m" : ""}`.trim() : `${m}m`;
};
const shortDate = (k) => {
  const [y, m, d] = k.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-TT", { day: "numeric", month: "short" });
};
const timeAgo = (ts) => {
  const s = (Date.now() - ts) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};
const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
};
const firstName = (n) => (n || "").split(" ")[0];
const niceDate = (d) =>
  d.toLocaleDateString("en-TT", { weekday: "long", day: "numeric", month: "long" });
const money = (n) =>
  "TT$" + n.toLocaleString("en-TT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* ── api ── */
let TOKEN = localStorage.getItem("vs-token") || "";
async function api(path, opts = {}) {
  const res = await fetch(`/api${path}`, {
    method: opts.method || (opts.body ? "POST" : "GET"),
    headers: {
      "content-type": "application/json",
      ...(TOKEN ? { authorization: `Bearer ${TOKEN}` } : {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

/* ═════════════════ APP ═════════════════ */
function App() {
  const [session, setSession] = useState(null); // /me payload
  const [tab, setTab] = useState("today");
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [printDoc, setPrintDoc] = useState(null);

  const flash = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  };

  const refresh = async () => {
    try {
      const s = await api("/me");
      setSession(s);
    } catch (e) {
      if (String(e.message).includes("Not signed in")) {
        TOKEN = "";
        localStorage.removeItem("vs-token");
        setSession(null);
      }
    }
  };

  useEffect(() => {
    (async () => {
      if (TOKEN) await refresh();
      setLoading(false);
    })();
  }, []);

  const signOut = () => {
    TOKEN = "";
    localStorage.removeItem("vs-token");
    setSession(null);
    setTab("today");
  };

  if (loading)
    return (
      <div style={{ textAlign: "center", padding: "5rem 1rem", color: T.inkSoft }}>
        Opening the studio…
      </div>
    );

  if (!session)
    return (
      <Auth
        onSignedIn={async (token) => {
          TOKEN = token;
          localStorage.setItem("vs-token", token);
          await refresh();
        }}
      />
    );

  const { me } = session;
  const unread = session.announcements.filter(
    (a) => a.author !== me.name && !(a.acks || []).includes(me.name)
  ).length;

  return (
    <div style={{ minHeight: "100vh", background: T.paper }}>
      <Header me={me} onSignOut={signOut} />
      <Tabs tab={tab} isAdmin={me.role === "admin" || me.role === "owner"} unread={unread} onTab={(t) => { setTab(t); refresh(); }} />
      <div style={{ padding: "0 1rem 5rem", maxWidth: 720, margin: "0 auto" }}>
        {tab === "today" && <Today session={session} refresh={refresh} flash={flash} />}
        {tab === "log" && <LogBook session={session} refresh={refresh} flash={flash} />}
        {tab === "team" && <TeamBoard session={session} refresh={refresh} flash={flash} />}
        {tab === "report" && <Report session={session} onPrint={setPrintDoc} flash={flash} />}
        {tab === "admin" && (me.role === "admin" || me.role === "owner") && <Admin flash={flash} refresh={refresh} onPrint={setPrintDoc} />}
      </div>
      {toast && (
        <div
          style={{
            position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)",
            background: "#2A2A30", color: "#fff", padding: "0.6rem 1.1rem",
            borderRadius: 999, fontSize: 14, boxShadow: "0 6px 20px rgba(0,0,0,0.25)", zIndex: 50,
          }}
        >
          {toast}
        </div>
      )}
      {printDoc && (
        <PrintOverlay onClose={() => setPrintDoc(null)} filename={printDoc.filename} flash={flash}>
          {printDoc.doc}
        </PrintOverlay>
      )}
    </div>
  );
}

/* ── chrome ── */
function Header({ me, onSignOut }) {
  return (
    <div style={{ background: T.paper, padding: "1.4rem 1.25rem 0.6rem" }}>
      <div style={{ maxWidth: 720, margin: "0 auto", display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <div>
          <div style={{ ...serif, fontSize: 19, fontWeight: 600, color: T.pine }}>
            VirtuSpace <span style={{ color: T.inkSoft, fontWeight: 400 }}>Daily Hub</span>
          </div>
          <div style={{ fontSize: 13, color: T.inkSoft, marginTop: 2 }}>{niceDate(new Date())}</div>
        </div>
        <button
          onClick={onSignOut}
          style={{ background: "none", color: T.inkSoft, border: `1px solid ${T.line}`, borderRadius: 999, padding: "0.3rem 0.85rem", fontSize: 12.5 }}
        >
          {firstName(me.name)} · sign out
        </button>
      </div>
    </div>
  );
}

function Tabs({ tab, onTab, unread, isAdmin }) {
  const tabs = [
    ["today", "Today"],
    ["log", "Time log"],
    ["team", "Team"],
    ["report", "Reports"],
  ];
  if (isAdmin) tabs.push(["admin", "Admin"]);
  return (
    <div style={{ background: T.paper, borderBottom: `1px solid ${T.line}`, position: "sticky", top: 0, zIndex: 10 }}>
      <div style={{ maxWidth: 720, margin: "0 auto", display: "flex", gap: 4, padding: "0 1rem" }}>
        {tabs.map(([k, label]) => (
          <button
            key={k}
            onClick={() => onTab(k)}
            style={{
              flex: 1, border: "none", background: "none",
              padding: "0.7rem 0.25rem 0.65rem", fontSize: 13.5,
              fontWeight: tab === k ? 700 : 500,
              color: tab === k ? T.pine : T.inkSoft,
              borderBottom: tab === k ? `2px solid ${T.pine}` : "2px solid transparent",
              position: "relative",
            }}
          >
            {label}
            {k === "team" && unread > 0 && (
              <span style={{ position: "absolute", top: 7, right: "12%", background: T.pine, color: "#fff", fontSize: 10.5, minWidth: 16, height: 16, lineHeight: "16px", borderRadius: 999, padding: "0 4px" }}>
                {unread}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

function Card({ children, style }) {
  return (
    <div style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 12, padding: "1.3rem 1.35rem", marginTop: "1.1rem", ...style }}>
      {children}
    </div>
  );
}

function SectionTitle({ children, right }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
      <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: 1.6, textTransform: "uppercase", color: T.inkSoft }}>
        {children}
      </div>
      {right}
    </div>
  );
}

const btnPrimary = { background: T.pine, color: "#fff", border: "none", borderRadius: 10, padding: "0.55rem 1.1rem", fontWeight: 700 };
const btnQuiet = { background: T.mist, color: T.pine, border: "none", borderRadius: 10, padding: "0.55rem 0.9rem", fontWeight: 700 };
const inputStyle = { border: `1px solid ${T.line}`, borderRadius: 10, padding: "0.55rem 0.8rem", background: "#fff" };

/* ── auth ── */
function Auth({ onSignedIn }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [invite, setInvite] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // invite links: #setup=email:CODE
    const m = location.hash.match(/^#setup=([^:]+):(.+)$/);
    if (m) {
      setMode("setup");
      setEmail(decodeURIComponent(m[1]));
      setInvite(m[2]);
    }
  }, []);

  const submit = async () => {
    setErr("");
    if (mode === "setup" && password !== password2) {
      setErr("Passwords don't match.");
      return;
    }
    setBusy(true);
    try {
      const data =
        mode === "login"
          ? await api("/login", { body: { email, password } })
          : await api("/setup", { body: { email, invite, password } });
      await onSignedIn(data.token);
    } catch (e) {
      setErr(e.message);
    }
    setBusy(false);
  };

  return (
    <div style={{ minHeight: "100vh", background: T.paper, display: "flex", alignItems: "flex-start", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: 400, padding: "4rem 1.5rem" }}>
        <div style={{ ...serif, fontSize: 22, fontWeight: 600, color: T.pine }}>
          VirtuSpace <span style={{ color: T.inkSoft, fontWeight: 400 }}>Daily Hub</span>
        </div>
        <div style={{ ...serif, fontSize: 27, fontWeight: 600, color: T.ink, marginTop: 26, lineHeight: 1.2 }}>
          {mode === "login" ? "Welcome back." : "Set up your account."}
        </div>
        <p style={{ color: T.inkSoft, fontSize: 14.5, marginTop: 8 }}>
          {mode === "login"
            ? "Sign in to open your day — priorities, hours, and the team board."
            : "Enter the invite code from your welcome email and choose a password."}
        </p>
        <div style={{ display: "grid", gap: 10, marginTop: 20 }}>
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" type="email" autoComplete="email" style={inputStyle} />
          {mode === "setup" && (
            <input value={invite} onChange={(e) => setInvite(e.target.value)} placeholder="Invite code (first person to set up can leave this blank)" style={inputStyle} />
          )}
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && mode === "login" && submit()}
            placeholder={mode === "login" ? "Password" : "Choose a password (8+ characters)"}
            type="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            style={inputStyle}
          />
          {mode === "setup" && (
            <input
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="Confirm password"
              type="password"
              autoComplete="new-password"
              style={inputStyle}
            />
          )}
          {err && <div style={{ color: "#A33", fontSize: 13.5 }}>{err}</div>}
          <button onClick={submit} disabled={busy} style={{ ...btnPrimary, padding: "0.7rem", opacity: busy ? 0.6 : 1 }}>
            {busy ? "One moment…" : mode === "login" ? "Sign in" : "Create my account"}
          </button>
          <button
            onClick={() => { setMode(mode === "login" ? "setup" : "login"); setErr(""); }}
            style={{ background: "none", border: "none", color: T.inkSoft, fontSize: 13.5, textDecoration: "underline", padding: "0.3rem" }}
          >
            {mode === "login" ? "First time here? Set up your account" : "Already set up? Sign in"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── TODAY ── */
function Today({ session, refresh, flash }) {
  const { me, data, config, today } = session;
  const priorities = data.priorities[today] || [];
  const todaysLogs = data.logs.filter((l) => l.date === today);
  const todayTotal = todaysLogs.reduce((s, l) => s + l.minutes, 0);

  const yesterday = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }, []);
  const carryable = (data.priorities[yesterday] || []).filter(
    (p) => !p.done && !priorities.some((q) => q.text === p.text)
  );

  const savePriorities = async (list) => {
    try {
      await api("/priorities", { body: { date: today, list } });
      await refresh();
    } catch (e) {
      flash(e.message);
    }
  };

  const [newPri, setNewPri] = useState("");
  const addPriority = () => {
    if (!newPri.trim() || priorities.length >= 3) return;
    savePriorities([...priorities, { text: newPri.trim(), done: false }]);
    setNewPri("");
  };

  return (
    <React.Fragment>
      <div style={{ marginTop: "1.4rem" }}>
        <div style={{ ...serif, fontSize: 25, fontWeight: 600, color: T.ink, lineHeight: 1.15 }}>
          {greeting()}, {firstName(me.name)}.
        </div>
        <div style={{ color: T.inkSoft, fontSize: 14, marginTop: 6 }}>
          {todayTotal > 0 ? (
            <span><b style={{ color: T.pine }}>{fmtMins(todayTotal)}</b> logged so far today</span>
          ) : (
            "Nothing logged yet — set your top three and start the clock."
          )}
        </div>
      </div>

      <CheckinCard session={session} refresh={refresh} flash={flash} />

      <Card>
        <SectionTitle right={<span style={{ fontSize: 12, color: T.inkSoft }}>{priorities.length}/3</span>}>
          Today's top three
        </SectionTitle>
        {priorities.length === 0 && (
          <div style={{ color: T.inkSoft, fontSize: 14, marginBottom: 8 }}>
            What are the three things that would make today a win?
          </div>
        )}
        {priorities.map((p, i) => (
          <div key={p.id || i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "0.45rem 0" }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: p.done ? T.mistDeep : T.inkSoft, width: 18 }}>{i + 1}</span>
            <button
              onClick={() => savePriorities(priorities.map((q, j) => (j === i ? { ...q, done: !q.done } : q)))}
              aria-label={p.done ? "Mark not done" : "Mark done"}
              style={{ width: 22, height: 22, borderRadius: 7, border: `2px solid ${p.done ? T.pine : T.mistDeep}`, background: p.done ? T.pine : "#fff", color: "#fff", fontSize: 13, lineHeight: "18px", flexShrink: 0 }}
            >
              {p.done ? "✓" : ""}
            </button>
            <span style={{ flex: 1, fontSize: 15.5, textDecoration: p.done ? "line-through" : "none", color: p.done ? T.inkSoft : T.ink }}>
              {p.text}
            </span>
            <button
              onClick={() => savePriorities(priorities.filter((_, j) => j !== i))}
              aria-label="Remove"
              style={{ border: "none", background: "none", color: T.inkSoft, fontSize: 16 }}
            >
              ×
            </button>
          </div>
        ))}
        {priorities.length < 3 && (
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <input
              value={newPri}
              onChange={(e) => setNewPri(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addPriority()}
              placeholder="Add a priority…"
              style={{ ...inputStyle, flex: 1 }}
            />
            <button onClick={addPriority} style={{ ...btnPrimary, padding: "0 1rem" }}>Add</button>
          </div>
        )}
        {carryable.length > 0 && (
          <div style={{ marginTop: 14, paddingTop: 10, borderTop: `1px solid ${T.paper}` }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.4, textTransform: "uppercase", color: T.inkSoft, marginBottom: 4 }}>
              From yesterday
            </div>
            {carryable.map((p) => (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "0.35rem 0" }}>
                <button
                  onClick={async () => {
                    try {
                      const list = (session.data.priorities[yesterday] || []).map((q) =>
                        q.id === p.id ? { ...q, done: true } : q
                      );
                      await api("/priorities", { body: { date: yesterday, list } });
                      flash("Marked done for yesterday");
                      await refresh();
                    } catch (e) { flash(e.message); }
                  }}
                  aria-label="Mark done for yesterday"
                  style={{ width: 20, height: 20, borderRadius: 6, border: `2px solid ${T.mistDeep}`, background: "#fff", flexShrink: 0 }}
                ></button>
                <span style={{ flex: 1, fontSize: 14, color: T.inkSoft }}>{p.text}</span>
              </div>
            ))}
            <button
              onClick={() => savePriorities([...priorities, ...carryable.map((p) => ({ text: p.text, done: false }))].slice(0, 3))}
              style={{ marginTop: 6, background: "none", border: `1px solid ${T.line}`, color: T.inkSoft, borderRadius: 999, padding: "0.4rem 0.9rem", fontSize: 13 }}
            >
              Carry over to today →
            </button>
          </div>
        )}
      </Card>

      <TimeLogger session={session} refresh={refresh} flash={flash} />

      {todaysLogs.length > 0 && (
        <Card>
          <SectionTitle right={<b style={{ color: T.pine, fontSize: 14 }}>{fmtMins(todayTotal)}</b>}>
            Logged today
          </SectionTitle>
          {todaysLogs.map((l) => (
            <LogRow key={l.id} log={l} refresh={refresh} flash={flash} />
          ))}
        </Card>
      )}
    </React.Fragment>
  );
}

function CheckinCard({ session, refresh, flash }) {
  const saved = (session.data.checkins || {})[session.today];
  const [mood, setMood] = useState(saved?.mood || "");
  const [note, setNote] = useState(saved?.note || "");
  const [editing, setEditing] = useState(!saved);

  const save = async () => {
    if (!mood) { flash("Pick how you're feeling first"); return; }
    try {
      await api("/checkin", { body: { mood, note } });
      setEditing(false);
      flash("Checked in — have a good one");
      await refresh();
    } catch (e) { flash(e.message); }
  };

  if (!editing && saved) {
    const mm = moodMeta(saved.mood);
    return (
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div style={{ fontSize: 14.5 }}>
            Checked in: <b style={{ color: T.pine }}>{mm ? `${mm[1]} ${mm[2]}` : saved.mood}</b>
            {saved.note ? <span style={{ color: T.inkSoft }}> — {saved.note}</span> : null}
          </div>
          <button onClick={() => setEditing(true)} style={{ background: "none", border: "none", color: T.inkSoft, fontSize: 12.5, textDecoration: "underline" }}>
            Change
          </button>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <SectionTitle>How are you feeling today?</SectionTitle>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {MOODS.map(([key, emoji, label]) => (
          <button
            key={key}
            onClick={() => setMood(key)}
            style={{
              border: `1.5px solid ${mood === key ? T.pine : T.line}`,
              background: mood === key ? T.mist : "#fff",
              color: mood === key ? T.pine : T.inkSoft,
              borderRadius: 999, padding: "0.4rem 0.85rem", fontSize: 13.5, fontWeight: mood === key ? 700 : 500,
            }}
          >
            {emoji} {label}
          </button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && save()}
          placeholder="Anything on your plate today? (optional)"
          style={{ ...inputStyle, flex: 1 }}
        />
        <button onClick={save} style={{ ...btnPrimary, padding: "0 1rem" }}>Check in</button>
      </div>
    </Card>
  );
}

function LogRow({ log, refresh, flash }) {
  const del = async () => {
    try {
      await api("/log/delete", { body: { id: log.id } });
      await refresh();
    } catch (e) {
      flash(e.message);
    }
  };
  const st = log.status || "pending";
  const stColor = st === "approved" ? T.pine : st === "queried" ? "#A33333" : T.lavender;
  const stLabel = st === "approved" ? "Approved" : st === "queried" ? "Queried" : "Pending";
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 10, padding: "0.5rem 0", borderTop: `1px solid ${T.paper}` }}>
      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase", color: T.inkSoft, whiteSpace: "nowrap" }}>
        {log.client}
      </span>
      <span style={{ flex: 1, fontSize: 14.5, color: T.ink }}>{log.task}</span>
      <span title={st === "queried" ? "Kezia has a question about this entry — check in with her" : ""} style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase", color: stColor, whiteSpace: "nowrap" }}>
        {stLabel}
      </span>
      <span style={{ fontSize: 13.5, fontWeight: 700, color: T.pine, whiteSpace: "nowrap" }}>{fmtMins(log.minutes)}</span>
      {refresh && (
        <button onClick={del} aria-label="Delete entry" style={{ border: "none", background: "none", color: T.inkSoft }}>×</button>
      )}
    </div>
  );
}

function TimeLogger({ session, refresh, flash }) {
  const clients = (session.config.clients || []).map((c) => c.name || c);
  const [client, setClient] = useState(clients[0] || "");
  const [task, setTask] = useState("");
  const [logDate, setLogDate] = useState(session.today);
  const [hrs, setHrs] = useState("");
  const [mins, setMins] = useState("");
  const [startedAt, setStartedAt] = useState(null);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (startedAt) {
      const t = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);
      return () => clearInterval(t);
    }
  }, [startedAt]);

  const logEntry = async (minutes, date) => {
    if (!task.trim()) {
      flash("Add a short task description first");
      return false;
    }
    try {
      await api("/log", { body: { client, task: task.trim(), minutes: Math.max(1, Math.round(minutes)), date: date || session.today } });
      setTask("");
      setHrs("");
      setMins("");
      flash(`Logged ${fmtMins(Math.max(1, Math.round(minutes)))} · ${client}`);
      await refresh();
      return true;
    } catch (e) {
      flash(e.message);
      return false;
    }
  };

  const clock = `${pad(Math.floor(elapsed / 3600))}:${pad(Math.floor((elapsed % 3600) / 60))}:${pad(elapsed % 60)}`;

  return (
    <Card style={startedAt ? { borderColor: T.pine } : {}}>
      <SectionTitle>Log time</SectionTitle>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <select value={client} onChange={(e) => setClient(e.target.value)} style={{ ...inputStyle, maxWidth: "100%" }}>
          {clients.map((c) => <option key={c}>{c}</option>)}
        </select>
        <input
          value={task}
          onChange={(e) => setTask(e.target.value)}
          placeholder="What are you working on?"
          style={{ ...inputStyle, flex: 1, minWidth: 180 }}
        />
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center", flexWrap: "wrap" }}>
        {!startedAt ? (
          <button
            onClick={() => {
              if (!task.trim()) { flash("Add a task description, then start the clock"); return; }
              setStartedAt(Date.now());
              setElapsed(0);
            }}
            style={btnPrimary}
          >
            Start timer
          </button>
        ) : (
          <React.Fragment>
            <span style={{ ...serif, fontSize: 20, fontWeight: 600, color: T.pine, fontVariantNumeric: "tabular-nums" }}>{clock}</span>
            <button onClick={async () => { if (await logEntry(elapsed / 60, session.today)) setStartedAt(null); }} style={btnPrimary}>
              Stop & log
            </button>
            <button onClick={() => setStartedAt(null)} style={{ background: "none", border: `1px solid ${T.line}`, borderRadius: 10, padding: "0.55rem 0.8rem", color: T.inkSoft, fontSize: 13 }}>
              Discard
            </button>
          </React.Fragment>
        )}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ color: T.inkSoft, fontSize: 13 }}>or log by day:</span>
        <input
          type="date"
          value={logDate}
          max={session.today}
          onChange={(e) => setLogDate(e.target.value)}
          style={{ ...inputStyle, padding: "0.45rem 0.6rem" }}
        />
        <input
          value={hrs}
          onChange={(e) => setHrs(e.target.value.replace(/[^0-9]/g, ""))}
          placeholder="hrs"
          inputMode="numeric"
          style={{ ...inputStyle, width: 58 }}
        />
        <input
          value={mins}
          onChange={(e) => setMins(e.target.value.replace(/[^0-9]/g, ""))}
          placeholder="mins"
          inputMode="numeric"
          style={{ ...inputStyle, width: 62 }}
        />
        <button
          onClick={() => {
            const total = (Number(hrs) || 0) * 60 + (Number(mins) || 0);
            if (total > 0) logEntry(total, logDate);
            else flash("Enter hours and/or minutes");
          }}
          style={btnQuiet}
        >
          Log
        </button>
      </div>
      {startedAt && (
        <div style={{ marginTop: 8, fontSize: 12.5, color: T.inkSoft }}>
          Keep this page open while the timer runs.
        </div>
      )}
    </Card>
  );
}

/* ── TIME LOG ── */
function LogBook({ session, refresh, flash }) {
  const byDate = useMemo(() => {
    const g = {};
    for (const l of session.data.logs) (g[l.date] = g[l.date] || []).push(l);
    return Object.entries(g).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [session.data.logs]);

  if (byDate.length === 0)
    return (
      <Card>
        <div style={{ color: T.inkSoft, fontSize: 14.5 }}>
          No entries yet. Log your first block of time from the Today tab and it will appear here, grouped by day.
        </div>
      </Card>
    );

  return byDate.map(([date, logs]) => {
    const total = logs.reduce((s, l) => s + l.minutes, 0);
    return (
      <Card key={date}>
        <SectionTitle right={<b style={{ color: T.pine, fontSize: 14 }}>{fmtMins(total)}</b>}>
          {date === session.today ? "Today" : shortDate(date)}
        </SectionTitle>
        {logs.map((l) => (
          <LogRow key={l.id} log={l} refresh={refresh} flash={flash} />
        ))}
      </Card>
    );
  });
}

/* ── TEAM ── */
function TeamBoard({ session, refresh, flash }) {
  const { me, team, announcements } = session;
  const [text, setText] = useState("");

  const post = async () => {
    if (!text.trim()) return;
    try {
      await api("/announce", { body: { text: text.trim() } });
      setText("");
      await refresh();
    } catch (e) {
      flash(e.message);
    }
  };
  const ack = async (id) => {
    try { await api("/announce/ack", { body: { id } }); await refresh(); } catch (e) { flash(e.message); }
  };
  const del = async (id) => {
    try { await api("/announce/delete", { body: { id } }); await refresh(); } catch (e) { flash(e.message); }
  };

  return (
    <React.Fragment>
      <Card>
        <SectionTitle>Announcements</SectionTitle>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && post()}
            placeholder="Share something with the team…"
            style={{ ...inputStyle, flex: 1 }}
          />
          <button onClick={post} style={{ ...btnPrimary, padding: "0 1rem" }}>Post</button>
        </div>
        {announcements.length === 0 && (
          <div style={{ color: T.inkSoft, fontSize: 14, marginTop: 12 }}>
            Nothing on the board yet. Posts here reach everyone the next time they open the hub.
          </div>
        )}
        {announcements.map((a) => {
          const seen = (a.acks || []).includes(me.name) || a.author === me.name;
          return (
            <div
              key={a.id}
              style={{
                marginTop: 12, padding: "0.75rem 0.9rem", borderRadius: 12,
                background: "#fff", border: `1px solid ${T.line}`,
                borderLeft: seen ? `1px solid ${T.line}` : `3px solid ${T.pine}`,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: T.inkSoft }}>
                <b style={{ color: T.pine }}>{a.author}</b>
                <span>{timeAgo(a.ts)}</span>
              </div>
              <div style={{ fontSize: 15, marginTop: 4 }}>{a.text}</div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                <span style={{ fontSize: 12, color: T.inkSoft }}>
                  {(a.acks || []).length > 0 ? `Seen by ${a.acks.map(firstName).join(", ")}` : "Not yet acknowledged"}
                </span>
                <span style={{ display: "flex", gap: 8 }}>
                  {!seen && (
                    <button onClick={() => ack(a.id)} style={{ background: T.pine, color: "#fff", border: "none", borderRadius: 999, padding: "0.25rem 0.8rem", fontSize: 12.5, fontWeight: 700 }}>
                      Got it
                    </button>
                  )}
                  {(a.author === me.name || me.role === "admin" || me.role === "owner") && (
                    <button onClick={() => del(a.id)} style={{ background: "none", border: "none", color: T.inkSoft, fontSize: 12.5 }}>
                      Delete
                    </button>
                  )}
                </span>
              </div>
            </div>
          );
        })}
      </Card>

      <Card>
        <SectionTitle>Where everyone is today</SectionTitle>
        {team.map((m) => (
          <div key={m.email} style={{ padding: "0.7rem 0", borderTop: `1px solid ${T.paper}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <b style={{ color: T.ink, fontSize: 15 }}>
                {m.name}{" "}
                {m.todayCheckin && moodMeta(m.todayCheckin.mood) && (
                  <span title={m.todayCheckin.note || ""} style={{ fontWeight: 500, fontSize: 12.5, color: T.lavender }}>
                    {moodMeta(m.todayCheckin.mood)[1]} {moodMeta(m.todayCheckin.mood)[2]}
                  </span>
                )}{" "}
                {m.email === me.email && <span style={{ fontWeight: 400, color: T.inkSoft }}>(you)</span>}
              </b>
              <span style={{ fontSize: 13, color: m.todayMinutes ? T.pine : T.inkSoft, fontWeight: 700 }}>
                {m.todayMinutes ? fmtMins(m.todayMinutes) : "—"}
              </span>
            </div>
            {m.todayPriorities.length > 0 ? (
              <div style={{ fontSize: 13.5, color: T.inkSoft, marginTop: 3 }}>
                {m.todayPriorities.map((p) => (p.done ? "✓ " : "○ ") + p.text).join(" · ")}
              </div>
            ) : (
              <div style={{ fontSize: 13, color: T.mistDeep, marginTop: 3 }}>No priorities set yet</div>
            )}
          </div>
        ))}
      </Card>
    </React.Fragment>
  );
}

/* ── REPORTS & INVOICES ── */
function Report({ session, onPrint, flash }) {
  const [offset, setOffset] = useState(0);
  const [week, setWeek] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        setWeek(await api(`/report?offset=${offset}`));
      } catch (e) {
        flash(e.message);
      }
    })();
  }, [offset]);

  if (!week) return <Card><div style={{ color: T.inkSoft, fontSize: 14 }}>Loading the week…</div></Card>;

  const { keys, members } = week;
  const label = `${shortDate(keys[0])} – ${shortDate(keys[6])}`;
  const rows = members.map((m) => {
    const byClient = {};
    for (const l of m.logs) byClient[l.client] = (byClient[l.client] || 0) + l.minutes;
    return { m: m.name, total: m.logs.reduce((s, l) => s + l.minutes, 0), byClient, logs: m.logs };
  });
  const teamTotal = rows.reduce((s, r) => s + r.total, 0);
  const byDay = keys.map((k) =>
    rows.reduce((s, r) => s + r.logs.filter((l) => l.date === k).reduce((x, l) => x + l.minutes, 0), 0)
  );
  const maxDay = Math.max(...byDay, 1);
  const allClients = [...new Set(rows.flatMap((r) => Object.keys(r.byClient)))];

  const copySummary = async () => {
    let out = `VirtuSpace weekly summary · ${label}\nTeam total: ${fmtMins(teamTotal)}\n\n`;
    for (const r of rows) {
      if (!r.total) continue;
      out += `${r.m} — ${fmtMins(r.total)}\n`;
      for (const [c, mins] of Object.entries(r.byClient)) out += `  · ${c}: ${fmtMins(mins)}\n`;
    }
    try {
      await navigator.clipboard.writeText(out);
      flash("Summary copied — paste it anywhere");
    } catch {
      flash("Couldn't copy on this device");
    }
  };

  const navBtn = { border: `1px solid ${T.line}`, background: "#fff", borderRadius: 10, width: 36, height: 36, fontSize: 18, color: T.pine };

  return (
    <React.Fragment>
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <button onClick={() => setOffset(offset - 1)} style={navBtn}>‹</button>
          <div style={{ textAlign: "center" }}>
            <div style={{ ...serif, fontSize: 17, fontWeight: 600, color: T.ink }}>
              {offset === 0 ? "This week" : offset === -1 ? "Last week" : label}
            </div>
            <div style={{ fontSize: 12.5, color: T.inkSoft }}>{label}</div>
          </div>
          <button onClick={() => setOffset(Math.min(0, offset + 1))} style={{ ...navBtn, opacity: offset === 0 ? 0.3 : 1 }}>›</button>
        </div>

        <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 90, marginTop: 18 }}>
          {byDay.map((v, i) => (
            <div key={i} style={{ flex: 1, textAlign: "center" }}>
              <div style={{ fontSize: 10.5, color: T.inkSoft, marginBottom: 3 }}>{v ? fmtMins(v) : ""}</div>
              <div style={{ height: Math.max(4, (v / maxDay) * 58), background: i === ((new Date().getDay() + 6) % 7) && offset === 0 ? T.pine : T.mistDeep, borderRadius: 5 }} />
              <div style={{ fontSize: 11, color: T.inkSoft, marginTop: 4 }}>{["M", "T", "W", "T", "F", "S", "S"][i]}</div>
            </div>
          ))}
        </div>
        <div style={{ textAlign: "center", marginTop: 10, fontSize: 14 }}>
          Team total: <b style={{ color: T.pine }}>{fmtMins(teamTotal)}</b>
        </div>
        <div style={{ textAlign: "center", marginTop: 12 }}>
          <button
            onClick={() =>
              onPrint({
                filename: `virtuspace-weekly-report-${keys[0]}`,
                doc: <ReportDoc label={label} rows={rows} byDay={byDay} teamTotal={teamTotal} allClients={allClients} />,
              })
            }
            style={btnPrimary}
          >
            Save report as PDF
          </button>
        </div>
      </Card>

      <Card>
        <SectionTitle
          right={
            <button onClick={copySummary} style={{ background: T.mist, color: T.pine, border: "none", borderRadius: 999, padding: "0.3rem 0.9rem", fontSize: 12.5, fontWeight: 700 }}>
              Copy summary
            </button>
          }
        >
          By person & client
        </SectionTitle>
        {teamTotal === 0 && <div style={{ color: T.inkSoft, fontSize: 14 }}>No time logged for this week yet.</div>}
        {rows.filter((r) => r.total > 0).map((r) => (
          <div key={r.m} style={{ padding: "0.6rem 0", borderTop: `1px solid ${T.paper}` }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <b style={{ color: T.ink }}>{r.m}</b>
              <b style={{ color: T.pine, fontSize: 14 }}>{fmtMins(r.total)}</b>
            </div>
            {Object.entries(r.byClient).map(([c, mins]) => (
              <div key={c} style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, color: T.inkSoft, marginTop: 3 }}>
                <span>{c}</span>
                <span>{fmtMins(mins)}</span>
              </div>
            ))}
          </div>
        ))}
        {allClients.length > 1 && teamTotal > 0 && (
          <React.Fragment>
            <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: 1.6, textTransform: "uppercase", color: T.inkSoft, marginTop: 18 }}>
              Client totals
            </div>
            {allClients
              .map((c) => [c, rows.reduce((s, r) => s + (r.byClient[c] || 0), 0)])
              .sort((a, b) => b[1] - a[1])
              .map(([c, mins]) => (
                <div key={c} style={{ marginTop: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5 }}>
                    <span>{c}</span>
                    <b style={{ color: T.pineSoft }}>{fmtMins(mins)}</b>
                  </div>
                  <div style={{ height: 6, background: T.paper, borderRadius: 4, marginTop: 3 }}>
                    <div style={{ width: `${(mins / teamTotal) * 100}%`, height: "100%", background: T.pineSoft, borderRadius: 4 }} />
                  </div>
                </div>
              ))}
          </React.Fragment>
        )}
      </Card>

      <PrioritiesCard onPrint={onPrint} flash={flash} />

      <BudgetCard flash={flash} />

      <InvoiceCard onPrint={onPrint} flash={flash} />
    </React.Fragment>
  );
}

function PrioritiesCard({ onPrint, flash }) {
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState(null);
  useEffect(() => {
    api(`/report/priorities?offset=${offset}`).then(setData).catch((e) => flash(e.message));
  }, [offset]);

  if (!data) return null;
  const label = `${shortDate(data.keys[0])} – ${shortDate(data.keys[6])}`;
  const activeMembers = data.members.filter((m) => Object.keys(m.days).length > 0);
  const navBtn = { border: `1px solid ${T.line}`, background: "#fff", borderRadius: 10, width: 32, height: 32, fontSize: 16, color: T.pine };

  return (
    <Card>
      <SectionTitle
        right={
          <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <button onClick={() => setOffset(offset - 1)} style={navBtn}>‹</button>
            <span style={{ fontSize: 12.5, color: T.inkSoft }}>{offset === 0 ? "This week" : offset === -1 ? "Last week" : label}</span>
            <button onClick={() => setOffset(Math.min(0, offset + 1))} style={{ ...navBtn, opacity: offset === 0 ? 0.3 : 1 }}>›</button>
          </span>
        }
      >
        Priorities & check-ins
      </SectionTitle>
      {activeMembers.length === 0 ? (
        <div style={{ fontSize: 13.5, color: T.inkSoft }}>No priorities set this week yet.</div>
      ) : (
        activeMembers.map((m) => {
          const all = Object.values(m.days).flatMap((d) => d.priorities);
          const done = all.filter((p) => p.done).length;
          return (
            <div key={m.name} style={{ padding: "0.6rem 0", borderTop: `1px solid ${T.paper}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <b style={{ fontSize: 14.5 }}>{m.name}</b>
                <span style={{ fontSize: 12.5, color: T.inkSoft }}>
                  {done}/{all.length} priorities done
                </span>
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                {data.keys.map((k) => {
                  const day = m.days[k];
                  const mm = day?.checkin ? moodMeta(day.checkin.mood) : null;
                  return (
                    <span key={k} style={{ fontSize: 11.5, color: day ? T.ink : T.mistDeep, background: day ? T.paper : "transparent", border: `1px solid ${day ? T.line : "transparent"}`, borderRadius: 8, padding: "0.2rem 0.5rem" }}>
                      {shortDate(k)}{day ? ` · ${day.priorities.filter((p) => p.done).length}/${day.priorities.length}${mm ? " " + mm[1] : ""}` : ""}
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })
      )}
      {activeMembers.length > 0 && (
        <div style={{ textAlign: "center", marginTop: 14 }}>
          <button
            onClick={() =>
              onPrint({
                filename: `virtuspace-priorities-${data.keys[0]}`,
                doc: <PrioritiesDoc keys={data.keys} members={activeMembers} label={label} />,
              })
            }
            style={btnPrimary}
          >
            Save priorities report as PDF
          </button>
        </div>
      )}
    </Card>
  );
}

function PrioritiesDoc({ keys, members, label }) {
  return (
    <div style={{ color: T.ink, fontFamily: "'DM Sans', sans-serif" }}>
      <Letterhead />
      <div style={{ margin: "20px 0 4px", ...serif, fontSize: 21, fontWeight: 600, color: T.pine }}>
        Priorities & Check-in Report
      </div>
      <div style={{ fontSize: 13, color: T.inkSoft }}>Week of {label} · Generated {niceDate(new Date())}</div>
      {members.map((m) => {
        const all = Object.values(m.days).flatMap((d) => d.priorities);
        const done = all.filter((p) => p.done).length;
        return (
          <div key={m.name} style={{ marginTop: 22 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderBottom: `2px solid ${T.pine}`, paddingBottom: 4 }}>
              <b style={{ ...serif, fontSize: 15, color: T.pine }}>{m.name}</b>
              <span style={{ fontSize: 12, color: T.inkSoft }}>{done}/{all.length} completed</span>
            </div>
            {keys.filter((k) => m.days[k]).map((k) => {
              const day = m.days[k];
              const mm = day.checkin ? moodMeta(day.checkin.mood) : null;
              return (
                <div key={k} style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: T.ink }}>
                    {shortDate(k)}
                    {mm && <span style={{ fontWeight: 500, color: T.lavender }}> · Check-in: {mm[1]} {mm[2]}{day.checkin.note ? ` — ${day.checkin.note}` : ""}</span>}
                  </div>
                  {day.priorities.map((p, i) => (
                    <div key={i} style={{ fontSize: 12.5, color: p.done ? T.inkSoft : T.ink, padding: "2px 0 2px 12px" }}>
                      {p.done ? "✓" : "○"} {p.text}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        );
      })}
      <div style={{ marginTop: 34, paddingTop: 10, borderTop: `1px solid ${T.line}`, fontSize: 10.5, color: T.inkSoft, textAlign: "center", letterSpacing: 0.5 }}>
        {BRAND.name} · {BRAND.tagline} · {BRAND.site}
      </div>
    </div>
  );
}

function BudgetCard({ flash }) {
  const [b, setB] = useState(null);
  useEffect(() => {
    api("/budget-status").then(setB).catch((e) => flash(e.message));
  }, []);
  if (!b || !b.clients.length) return null;
  return (
    <Card>
      <SectionTitle right={<span style={{ fontSize: 12, color: T.inkSoft }}>{b.month}</span>}>
        Client budgets
      </SectionTitle>
      {b.clients.map((c) => {
        const used = c.minutes / 60;
        const pct = Math.min(100, (used / c.budgetHours) * 100);
        const over = used > c.budgetHours;
        return (
          <div key={c.name} style={{ marginTop: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5 }}>
              <span>{c.name}</span>
              <b style={{ color: over ? "#A33333" : T.pineSoft }}>
                {used.toFixed(1)} / {c.budgetHours} hrs{over ? " · over" : ""}
              </b>
            </div>
            <div style={{ height: 6, background: T.paper, borderRadius: 4, marginTop: 3 }}>
              <div style={{ width: `${pct}%`, height: "100%", background: over ? "#A33333" : T.pineSoft, borderRadius: 4 }} />
            </div>
          </div>
        );
      })}
    </Card>
  );
}

function InvoiceCard({ onPrint, flash }) {
  const [period, setPeriod] = useState("lastWeek");
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        setPreview(await api(`/invoice?period=${period}`));
      } catch (e) {
        flash(e.message);
      }
    })();
  }, [period]);

  return (
    <Card>
      <SectionTitle>My invoice</SectionTitle>
      <div style={{ fontSize: 13.5, color: T.inkSoft, marginBottom: 10 }}>
        Turn your <b>approved</b> hours into a branded VirtuSpace invoice, ready to save as PDF.
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <select value={period} onChange={(e) => setPeriod(e.target.value)} style={inputStyle}>
          <option value="thisWeek">This week</option>
          <option value="lastWeek">Last week</option>
          <option value="thisMonth">This month</option>
          <option value="lastMonth">Last month</option>
        </select>
        <span style={{ fontSize: 13, color: T.inkSoft }}>
          {preview
            ? `${preview.lines.length} approved · ${fmtMins(preview.totalMinutes)}${
                preview.pendingCount ? ` · ${preview.pendingCount} awaiting review` : ""
              }`
            : "…"}
        </span>
        <button
          disabled={!preview || preview.lines.length === 0}
          onClick={() =>
            onPrint({
              filename: `invoice-${preview.number.toLowerCase()}`,
              doc: <InvoiceDoc inv={preview} />,
            })
          }
          style={{
            ...btnPrimary,
            marginLeft: "auto",
            background: preview && preview.lines.length ? T.pine : T.mistDeep,
            cursor: preview && preview.lines.length ? "pointer" : "not-allowed",
          }}
        >
          Generate invoice
        </button>
      </div>
    </Card>
  );
}

/* ── ADMIN ── */
function Admin({ flash, refresh, onPrint }) {
  const [info, setInfo] = useState(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [clientRows, setClientRows] = useState([]);
  const [session, setSession] = useState(null);

  const load = async () => {
    try {
      const [t, s] = await Promise.all([api("/admin/team"), api("/me")]);
      setInfo(t);
      setSession(s);
      setClientRows(
        (s.config.clients || []).map((c) => ({
          name: c.name || c,
          budgetHours: c.budgetHours || 0,
          rate: c.rate || 0,
        }))
      );
    } catch (e) {
      flash(e.message);
    }
  };
  useEffect(() => { load(); }, []);

  if (!info) return <Card><div style={{ color: T.inkSoft, fontSize: 14 }}>Loading the admin area…</div></Card>;

  const isOwner = session?.me?.role === "owner";

  const inviteLink = (m) =>
    `${info.appUrl}/#setup=${encodeURIComponent(m.email)}:${m.invite}`;

  const addMember = async () => {
    if (!name.trim() || !email.trim()) return;
    try {
      const r = await api("/admin/member", { body: { name, email } });
      flash(
        r.emailed
          ? `Added — invite email sent to ${email.trim()}`
          : `Added — copy her invite link below (${r.emailNote || "email not configured"})`
      );
      setName("");
      setEmail("");
      await load();
      await refresh();
    } catch (e) {
      flash(e.message);
    }
  };

  const act = async (path, body, okMsg) => {
    try {
      const r = await api(path, { body });
      flash(r.emailed === false && r.emailNote ? `${okMsg} (email not sent: ${r.emailNote})` : okMsg);
      await load();
      await refresh();
    } catch (e) {
      flash(e.message);
    }
  };

  const copy = async (text, msg) => {
    try {
      await navigator.clipboard.writeText(text);
      flash(msg);
    } catch {
      flash("Couldn't copy on this device");
    }
  };

  const saveClients = () =>
    act(
      "/admin/clients",
      { clients: clientRows.filter((c) => c.name.trim()) },
      "Client list saved"
    );

  return (
    <React.Fragment>
      {!info.emailConfigured && (
        <Card style={{ borderLeft: `3px solid ${T.lavender}` }}>
          <div style={{ fontSize: 13.5, color: T.inkSoft }}>
            <b style={{ color: T.ink }}>Email isn't connected yet.</b> Reminders and invites will still appear in the
            app, but to send them by email, add a free Resend API key as the <code>RESEND_API_KEY</code> environment
            variable in Netlify. Automatic reminders run every morning at 8:00 AM once it's set.
          </div>
        </Card>
      )}

      <ReviewCard flash={flash} />

      <Card>
        <SectionTitle>Team</SectionTitle>
        {info.team.map((m) => (
          <div key={m.email} style={{ padding: "0.75rem 0", borderTop: `1px solid ${T.paper}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 6 }}>
              <div>
                <b style={{ fontSize: 15, color: T.ink }}>{m.name}</b>
                {m.role !== "va" && (
                  <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 1, color: T.pine, marginLeft: 8, textTransform: "uppercase" }}>{m.role}</span>
                )}
                <div style={{ fontSize: 12.5, color: T.inkSoft }}>{m.email}</div>
              </div>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: m.overdue ? "#A33" : m.active ? T.pine : T.lavender }}>
                {!m.active ? "Invited — awaiting setup" : m.overdue ? `Overdue · ${m.days} days` : m.lastLog ? `Last log ${shortDate(m.lastLog)}` : "No logs yet"}
              </span>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
              {!m.active && (
                <button onClick={() => copy(inviteLink(m), "Invite link copied")} style={{ ...btnQuiet, fontSize: 12.5, padding: "0.4rem 0.8rem" }}>
                  Copy invite link
                </button>
              )}
              {m.overdue && (
                <button
                  onClick={() => act("/admin/remind", { email: m.email }, `Reminder sent to ${firstName(m.name)}`)}
                  style={{ ...btnPrimary, fontSize: 12.5, padding: "0.4rem 0.8rem" }}
                >
                  Send reminder now
                </button>
              )}
              {isOwner && m.role !== "owner" && (
                <button
                  onClick={() =>
                    act(
                      "/admin/member/role",
                      { email: m.email, role: m.role === "admin" ? "va" : "admin" },
                      m.role === "admin" ? `${firstName(m.name)} is now a VA` : `${firstName(m.name)} is now an admin`
                    )
                  }
                  style={{ ...btnQuiet, fontSize: 12.5, padding: "0.4rem 0.8rem" }}
                >
                  {m.role === "admin" ? "Make VA" : "Make admin"}
                </button>
              )}
              {m.active && m.role !== "owner" && (
                <button
                  onClick={() => confirm(`Reset ${m.name}'s password? She'll get a new invite code.`) && act("/admin/member/reset", { email: m.email }, "Account reset — new invite created")}
                  style={{ background: "none", border: `1px solid ${T.line}`, borderRadius: 10, padding: "0.4rem 0.8rem", color: T.inkSoft, fontSize: 12.5 }}
                >
                  Reset password
                </button>
              )}
              {m.role !== "owner" && (
                <button
                  onClick={() => confirm(`Remove ${m.name} from the team? Her logs will be deleted.`) && act("/admin/member/delete", { email: m.email }, "Removed from the team")}
                  style={{ background: "none", border: "none", color: T.inkSoft, fontSize: 12.5, textDecoration: "underline" }}
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        ))}
        <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="New VA's full name" style={{ ...inputStyle, flex: 1, minWidth: 150 }} />
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Her email" type="email" style={{ ...inputStyle, flex: 1, minWidth: 150 }} />
          <button onClick={addMember} style={btnPrimary}>Add & invite</button>
        </div>
      </Card>

      <Card>
        <SectionTitle>Clients, budgets & billing</SectionTitle>
        <div style={{ fontSize: 13, color: T.inkSoft, marginBottom: 10, lineHeight: 1.6 }}>
          Budget = monthly hours target (shows progress bars on everyone's Reports tab).
          {isOwner ? <span> Billing rate = what <b>you</b> charge that client on statements and P&L, in TT$/hr — only you see it. Leave either at 0 to skip.</span> : " Billing rates are managed by the owner."}
        </div>
        <div style={{ display: "flex", gap: 8, fontSize: 10.5, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: T.inkSoft, padding: "0 2px" }}>
          <span style={{ flex: 1 }}>Client</span>
          <span style={{ width: 78 }}>Budget hrs</span>
          {isOwner && <span style={{ width: 78 }}>Bill TT$/hr</span>}
          <span style={{ width: 20 }}></span>
        </div>
        {clientRows.map((c, i) => (
          <div key={i} style={{ display: "flex", gap: 8, marginTop: 6, alignItems: "center" }}>
            <input
              value={c.name}
              onChange={(e) => setClientRows(clientRows.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
              style={{ ...inputStyle, flex: 1, padding: "0.45rem 0.7rem" }}
            />
            <input
              value={c.budgetHours || ""}
              onChange={(e) => setClientRows(clientRows.map((x, j) => (j === i ? { ...x, budgetHours: Number(e.target.value.replace(/[^0-9.]/g, "")) || 0 } : x)))}
              placeholder="0"
              inputMode="numeric"
              style={{ ...inputStyle, width: 78, padding: "0.45rem 0.6rem" }}
            />
            {isOwner && (
              <input
                value={c.rate || ""}
                onChange={(e) => setClientRows(clientRows.map((x, j) => (j === i ? { ...x, rate: Number(e.target.value.replace(/[^0-9.]/g, "")) || 0 } : x)))}
                placeholder="0"
                inputMode="numeric"
                style={{ ...inputStyle, width: 78, padding: "0.45rem 0.6rem" }}
              />
            )}
            <button
              onClick={() => setClientRows(clientRows.filter((_, j) => j !== i))}
              aria-label="Remove client"
              style={{ border: "none", background: "none", color: T.inkSoft, width: 20 }}
            >
              ×
            </button>
          </div>
        ))}
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12 }}>
          <button
            onClick={() => setClientRows([...clientRows, { name: "", budgetHours: 0, rate: 0 }])}
            style={{ background: "none", border: `1px solid ${T.line}`, borderRadius: 10, padding: "0.45rem 0.9rem", color: T.inkSoft, fontSize: 13 }}
          >
            + Add client
          </button>
          <button onClick={saveClients} style={btnPrimary}>Save clients</button>
        </div>
      </Card>

      {isOwner && <StatementsCard clients={clientRows} onPrint={onPrint} flash={flash} />}

      {isOwner && <PnLCard flash={flash} />}

      <Card>
        <SectionTitle>How reminders work</SectionTitle>
        <div style={{ fontSize: 13.5, color: T.inkSoft, lineHeight: 1.7 }}>
          Every morning at 8:00 AM, the hub checks each person's last time entry. Anyone past 2 days without logging
          gets a private notice on her Team tab and a reminder email with a link back to her account — automatically,
          at most once per day. You can also trigger one instantly with "Send reminder now" above.
        </div>
      </Card>
    </React.Fragment>
  );
}

/* ── review, statements ── */
function ReviewCard({ flash }) {
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState(null);

  const load = async (o = offset) => {
    try {
      setData(await api(`/admin/review?offset=${o}`));
    } catch (e) {
      flash(e.message);
    }
  };
  useEffect(() => { load(offset); }, [offset]);

  const setStatus = async (email, id, status) => {
    try {
      await api("/admin/review/set", { body: { email, id, status } });
      await load();
    } catch (e) {
      flash(e.message);
    }
  };
  const approveAll = async (email, name) => {
    try {
      await api("/admin/review/approve", { body: { email, from: data.keys[0], to: data.keys[6] } });
      flash(`${firstName(name)}'s week approved`);
      await load();
    } catch (e) {
      flash(e.message);
    }
  };

  const navBtn = { border: `1px solid ${T.line}`, background: "#fff", borderRadius: 10, width: 32, height: 32, fontSize: 16, color: T.pine };
  const smallBtn = { border: "none", borderRadius: 8, padding: "0.3rem 0.7rem", fontSize: 12, fontWeight: 700 };

  return (
    <Card>
      <SectionTitle
        right={
          data && (
            <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <button onClick={() => setOffset(offset - 1)} style={navBtn}>‹</button>
              <span style={{ fontSize: 12.5, color: T.inkSoft }}>
                {offset === 0 ? "This week" : offset === -1 ? "Last week" : `${shortDate(data.keys[0])} – ${shortDate(data.keys[6])}`}
              </span>
              <button onClick={() => setOffset(Math.min(0, offset + 1))} style={{ ...navBtn, opacity: offset === 0 ? 0.3 : 1 }}>›</button>
            </span>
          )
        }
      >
        Review time
      </SectionTitle>
      {!data ? (
        <div style={{ fontSize: 13.5, color: T.inkSoft }}>Loading…</div>
      ) : data.members.length === 0 ? (
        <div style={{ fontSize: 13.5, color: T.inkSoft }}>No time logged this week yet.</div>
      ) : (
        data.members.map((m) => {
          const pending = m.entries.filter((e) => e.status === "pending").length;
          return (
            <div key={m.email} style={{ padding: "0.7rem 0", borderTop: `1px solid ${T.paper}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 6 }}>
                <b style={{ fontSize: 14.5, color: T.ink }}>{m.name}</b>
                {pending > 0 && (
                  <button onClick={() => approveAll(m.email, m.name)} style={{ ...smallBtn, background: T.pine, color: "#fff" }}>
                    Approve all pending ({pending})
                  </button>
                )}
              </div>
              {m.entries.map((e) => (
                <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "0.4rem 0", flexWrap: "wrap" }}>
                  <span style={{ fontSize: 12, color: T.inkSoft, whiteSpace: "nowrap" }}>{shortDate(e.date)}</span>
                  <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase", color: T.inkSoft, whiteSpace: "nowrap" }}>{e.client}</span>
                  <span style={{ flex: 1, fontSize: 13.5, minWidth: 140 }}>{e.task}</span>
                  <b style={{ fontSize: 12.5, color: T.pine, whiteSpace: "nowrap" }}>{fmtMins(e.minutes)}</b>
                  {e.status === "approved" ? (
                    <span style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6, color: T.pine }}>Approved</span>
                  ) : (
                    <span style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => setStatus(m.email, e.id, "approved")} style={{ ...smallBtn, background: T.mist, color: T.pine }}>Approve</button>
                      <button
                        onClick={() => setStatus(m.email, e.id, e.status === "queried" ? "pending" : "queried")}
                        style={{ ...smallBtn, background: e.status === "queried" ? "#A33333" : "none", color: e.status === "queried" ? "#fff" : "#A33333", border: e.status === "queried" ? "none" : "1px solid #D8B5B5" }}
                      >
                        {e.status === "queried" ? "Queried" : "Query"}
                      </button>
                    </span>
                  )}
                </div>
              ))}
            </div>
          );
        })
      )}
      <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 10 }}>
        Only approved entries can be invoiced or appear on client statements. "Query" flags an entry for the VA to check with you.
      </div>
    </Card>
  );
}

function PnLCard({ flash }) {
  const [period, setPeriod] = useState("thisMonth");
  const [pnl, setPnl] = useState(null);
  useEffect(() => {
    api(`/admin/pnl?period=${period}`).then(setPnl).catch((e) => flash(e.message));
  }, [period]);

  return (
    <Card style={{ borderLeft: `3px solid ${T.pine}` }}>
      <SectionTitle
        right={
          <select value={period} onChange={(e) => setPeriod(e.target.value)} style={{ ...inputStyle, padding: "0.35rem 0.5rem", fontSize: 13 }}>
            <option value="thisWeek">This week</option>
            <option value="lastWeek">Last week</option>
            <option value="thisMonth">This month</option>
            <option value="lastMonth">Last month</option>
          </select>
        }
      >
        Profit & loss — owner only
      </SectionTitle>
      {!pnl ? (
        <div style={{ fontSize: 13.5, color: T.inkSoft }}>Loading…</div>
      ) : pnl.lines.length === 0 ? (
        <div style={{ fontSize: 13.5, color: T.inkSoft }}>No approved hours in this period yet — approve entries in Review time first.</div>
      ) : (
        <React.Fragment>
          <div style={{ display: "flex", gap: 8, fontSize: 10.5, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: T.inkSoft }}>
            <span style={{ flex: 1 }}>Client</span>
            <span style={{ width: 58, textAlign: "right" }}>Hrs</span>
            <span style={{ width: 88, textAlign: "right" }}>Billed</span>
            <span style={{ width: 88, textAlign: "right" }}>VA pay</span>
            <span style={{ width: 88, textAlign: "right" }}>Margin</span>
          </div>
          {pnl.lines.map((l) => (
            <div key={l.name} style={{ display: "flex", gap: 8, fontSize: 13, padding: "0.45rem 0", borderTop: `1px solid ${T.paper}`, alignItems: "baseline" }}>
              <span style={{ flex: 1 }}>
                {l.name}
                {!l.rateSet && <span style={{ fontSize: 11, color: "#A33333" }}> · no rate set</span>}
              </span>
              <span style={{ width: 58, textAlign: "right", color: T.inkSoft }}>{(l.minutes / 60).toFixed(1)}</span>
              <span style={{ width: 88, textAlign: "right" }}>{money(l.revenue)}</span>
              <span style={{ width: 88, textAlign: "right", color: T.inkSoft }}>{money(l.cost)}</span>
              <b style={{ width: 88, textAlign: "right", color: l.margin >= 0 ? T.pine : "#A33333" }}>{money(l.margin)}</b>
            </div>
          ))}
          <div style={{ display: "flex", gap: 8, fontSize: 13.5, padding: "0.55rem 0 0", borderTop: `2px solid ${T.pine}`, marginTop: 6, alignItems: "baseline" }}>
            <b style={{ flex: 1 }}>Total</b>
            <span style={{ width: 58 }}></span>
            <b style={{ width: 88, textAlign: "right" }}>{money(pnl.totalRevenue)}</b>
            <b style={{ width: 88, textAlign: "right", color: T.inkSoft }}>{money(pnl.totalCost)}</b>
            <b style={{ width: 88, textAlign: "right", color: pnl.totalMargin >= 0 ? T.pine : "#A33333" }}>{money(pnl.totalMargin)}</b>
          </div>
          <div style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 10 }}>
            Approved hours only. Billed = client billing rate × hours; VA pay = standard rate × hours. Visible to you alone — admins and VAs never see this.
          </div>
        </React.Fragment>
      )}
    </Card>
  );
}

function StatementsCard({ clients, onPrint, flash }) {
  const names = clients.map((c) => c.name).filter(Boolean);
  const [client, setClient] = useState(names[0] || "");
  const [period, setPeriod] = useState("thisMonth");
  useEffect(() => {
    if (!names.includes(client)) setClient(names[0] || "");
  }, [clients]);

  const generate = async () => {
    try {
      const st = await api(`/admin/statement?client=${encodeURIComponent(client)}&period=${period}`);
      if (!st.lines.length) {
        flash("No approved entries for that client in this period");
        return;
      }
      onPrint({
        filename: `statement-${client.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${st.from}`,
        doc: <StatementDoc st={st} />,
      });
    } catch (e) {
      flash(e.message);
    }
  };

  return (
    <Card>
      <SectionTitle>Client statements</SectionTitle>
      <div style={{ fontSize: 13, color: T.inkSoft, marginBottom: 10 }}>
        A branded statement of the team's approved hours for a client — priced at that client's billing rate if you've set one.
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <select value={client} onChange={(e) => setClient(e.target.value)} style={inputStyle}>
          {names.map((n) => <option key={n}>{n}</option>)}
        </select>
        <select value={period} onChange={(e) => setPeriod(e.target.value)} style={inputStyle}>
          <option value="thisWeek">This week</option>
          <option value="lastWeek">Last week</option>
          <option value="thisMonth">This month</option>
          <option value="lastMonth">Last month</option>
        </select>
        <button onClick={generate} disabled={!client} style={{ ...btnPrimary, marginLeft: "auto" }}>
          Generate statement
        </button>
      </div>
    </Card>
  );
}

function StatementDoc({ st }) {
  return (
    <div style={{ color: T.ink, fontFamily: "'DM Sans', sans-serif" }}>
      <Letterhead />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginTop: 22 }}>
        <div>
          <div style={{ ...serif, fontSize: 22, fontWeight: 600, color: T.pine }}>Statement of Services</div>
          <div style={{ fontSize: 12.5, color: T.inkSoft, marginTop: 6, lineHeight: 1.6 }}>
            Period: <b style={{ color: T.ink }}>{shortDate(st.from)} – {shortDate(st.to)}</b><br />
            Issued: <b style={{ color: T.ink }}>{niceDate(new Date())}</b>
          </div>
        </div>
        <div style={{ textAlign: "right", fontSize: 12.5, lineHeight: 1.6 }}>
          <div style={{ fontSize: 11, letterSpacing: 1, color: T.lavender, fontWeight: 700 }}>PREPARED FOR</div>
          <b style={{ color: T.pine, fontSize: 15 }}>{st.client}</b>
        </div>
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 24 }}>
        <thead>
          <tr>
            <th style={docTh}>Date</th>
            <th style={docTh}>Team member</th>
            <th style={docTh}>Work performed</th>
            <th style={{ ...docTh, textAlign: "right" }}>Hours</th>
            {st.rate > 0 && <th style={{ ...docTh, textAlign: "right" }}>Amount</th>}
          </tr>
        </thead>
        <tbody>
          {st.lines.map((l) => (
            <tr key={l.id}>
              <td style={{ ...docTd, whiteSpace: "nowrap" }}>{shortDate(l.date)}</td>
              <td style={docTd}>{l.member}</td>
              <td style={docTd}>{l.task}</td>
              <td style={{ ...docTd, textAlign: "right" }}>{l.hours.toFixed(2)}</td>
              {st.rate > 0 && <td style={{ ...docTd, textAlign: "right" }}>{money(l.amount)}</td>}
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
        <table style={{ borderCollapse: "collapse", minWidth: 240 }}>
          <tbody>
            <tr>
              <td style={{ ...docTd, borderBottom: "none", color: T.inkSoft }}>Total hours</td>
              <td style={{ ...docTd, borderBottom: "none", textAlign: "right", fontWeight: 700 }}>
                {(st.totalMinutes / 60).toFixed(2)}
              </td>
            </tr>
            {st.rate > 0 && (
              <tr>
                <td style={{ padding: "10px 8px", fontSize: 15, fontWeight: 700, color: T.pine, borderTop: `2px solid ${T.pine}` }}>Total due</td>
                <td style={{ padding: "10px 8px", fontSize: 17, fontWeight: 700, color: T.pine, textAlign: "right", borderTop: `2px solid ${T.pine}` }}>
                  {money(st.totalAmount)}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 30, fontSize: 12, color: T.inkSoft }}>
        All entries reviewed and approved by VirtuSpace before issue. Thank you for your continued partnership.
      </div>
      <div style={{ marginTop: 24, paddingTop: 10, borderTop: `1px solid ${T.line}`, fontSize: 10.5, color: T.inkSoft, textAlign: "center", letterSpacing: 0.5 }}>
        {BRAND.name} · {BRAND.tagline} · {BRAND.site}
      </div>
    </div>
  );
}

/* ── PRINT / DOCS ── */
function PrintOverlay({ children, onClose, filename, flash }) {
  const [busy, setBusy] = useState(false);
  const downloadPdf = async () => {
    setBusy(true);
    try {
      if (!window.html2pdf) {
        await new Promise((res, rej) => {
          const s = document.createElement("script");
          s.src = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
          s.onload = res;
          s.onerror = rej;
          document.head.appendChild(s);
        });
      }
      const el = document.querySelector(".print-doc-inner");
      await window
        .html2pdf()
        .set({
          margin: [28, 28, 32, 28],
          filename: `${filename || "virtuspace-document"}.pdf`,
          jsPDF: { unit: "pt", format: "a4" },
          html2canvas: { scale: 2, useCORS: true },
          pagebreak: { mode: ["avoid-all", "css"] },
        })
        .from(el)
        .save();
      flash("PDF downloaded");
    } catch {
      flash("Couldn't build the PDF here — use Save as PDF / Print instead");
    }
    setBusy(false);
  };
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(24,24,32,0.55)", zIndex: 100, overflowY: "auto", padding: "1rem" }}>
      <div style={{ maxWidth: 780, margin: "0 auto" }}>
        <div className="no-print" style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginBottom: 10, flexWrap: "wrap" }}>
          <button onClick={() => window.print()} style={btnPrimary}>Save as PDF / Print</button>
          <button onClick={downloadPdf} disabled={busy} style={{ background: "#fff", color: T.pine, border: "none", borderRadius: 10, padding: "0.55rem 1.1rem", fontWeight: 700, opacity: busy ? 0.6 : 1 }}>
            {busy ? "Building PDF…" : "Download PDF"}
          </button>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.15)", color: "#fff", border: "none", borderRadius: 10, padding: "0.55rem 1.1rem", fontWeight: 700 }}>
            Close
          </button>
        </div>
        <div className="print-area" style={{ background: "#fff", borderRadius: 12, padding: "2.2rem 2rem", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
          <div className="print-doc-inner">{children}</div>
        </div>
      </div>
    </div>
  );
}

function Letterhead() {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", borderBottom: `3px solid ${T.pine}`, paddingBottom: 14, marginBottom: 4 }}>
      <div>
        <div style={{ ...serif, fontSize: 26, fontWeight: 700, letterSpacing: 0.3, color: T.pine }}>{BRAND.name}</div>
        <div style={{ fontSize: 11, color: T.lavender, letterSpacing: 1.6, fontWeight: 700, marginTop: 3 }}>
          {BRAND.tagline.toUpperCase()}
        </div>
      </div>
      <div style={{ textAlign: "right", fontSize: 11.5, color: T.inkSoft, lineHeight: 1.55 }}>
        {BRAND.email}<br />{BRAND.phone}<br />{BRAND.site}
      </div>
    </div>
  );
}

const docTh = { textAlign: "left", fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: T.pine, borderBottom: `2px solid ${T.pine}`, padding: "6px 8px" };
const docTd = { padding: "7px 8px", borderBottom: `1px solid ${T.line}`, fontSize: 12.5, verticalAlign: "top" };

function ReportDoc({ label, rows, byDay, teamTotal, allClients }) {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return (
    <div style={{ color: T.ink, fontFamily: "'DM Sans', sans-serif" }}>
      <Letterhead />
      <div style={{ margin: "20px 0 4px", ...serif, fontSize: 21, fontWeight: 600, color: T.pine }}>Weekly Time Report</div>
      <div style={{ fontSize: 13, color: T.inkSoft }}>Week of {label} · Generated {niceDate(new Date())}</div>

      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 20 }}>
        <thead>
          <tr>
            {days.map((d) => <th key={d} style={{ ...docTh, textAlign: "center" }}>{d}</th>)}
            <th style={{ ...docTh, textAlign: "center" }}>Total</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            {byDay.map((v, i) => (
              <td key={i} style={{ ...docTd, textAlign: "center" }}>{v ? fmtMins(v) : "—"}</td>
            ))}
            <td style={{ ...docTd, textAlign: "center", fontWeight: 700, color: T.pine }}>{fmtMins(teamTotal)}</td>
          </tr>
        </tbody>
      </table>

      <div style={{ ...serif, fontSize: 16, fontWeight: 600, color: T.pine, marginTop: 26 }}>By team member</div>
      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8 }}>
        <thead>
          <tr>
            <th style={docTh}>Team member</th>
            <th style={docTh}>Client</th>
            <th style={{ ...docTh, textAlign: "right" }}>Hours</th>
          </tr>
        </thead>
        <tbody>
          {rows
            .filter((r) => r.total > 0)
            .flatMap((r) =>
              Object.entries(r.byClient).map(([c, mins], i) => (
                <tr key={r.m + c}>
                  <td style={{ ...docTd, fontWeight: i === 0 ? 700 : 400, color: i === 0 ? T.pine : "transparent" }}>{r.m}</td>
                  <td style={docTd}>{c}</td>
                  <td style={{ ...docTd, textAlign: "right" }}>{fmtMins(mins)}</td>
                </tr>
              ))
            )}
        </tbody>
      </table>

      <div style={{ ...serif, fontSize: 16, fontWeight: 600, color: T.pine, marginTop: 26 }}>Client totals</div>
      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8 }}>
        <tbody>
          {allClients
            .map((c) => [c, rows.reduce((s, r) => s + (r.byClient[c] || 0), 0)])
            .filter(([, m]) => m > 0)
            .sort((a, b) => b[1] - a[1])
            .map(([c, mins]) => (
              <tr key={c}>
                <td style={docTd}>{c}</td>
                <td style={{ ...docTd, textAlign: "right", fontWeight: 700, color: T.pine }}>{fmtMins(mins)}</td>
              </tr>
            ))}
          <tr>
            <td style={{ ...docTd, fontWeight: 700, borderBottom: "none" }}>Team total</td>
            <td style={{ ...docTd, textAlign: "right", fontWeight: 700, color: T.pine, borderBottom: "none" }}>{fmtMins(teamTotal)}</td>
          </tr>
        </tbody>
      </table>

      <div style={{ marginTop: 34, paddingTop: 10, borderTop: `1px solid ${T.line}`, fontSize: 10.5, color: T.inkSoft, textAlign: "center", letterSpacing: 0.5 }}>
        {BRAND.name} · {BRAND.tagline} · {BRAND.site}
      </div>
    </div>
  );
}

function InvoiceDoc({ inv }) {
  return (
    <div style={{ color: T.ink, fontFamily: "'DM Sans', sans-serif" }}>
      <Letterhead />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginTop: 22 }}>
        <div>
          <div style={{ ...serif, fontSize: 24, fontWeight: 600, color: T.pine, letterSpacing: 1 }}>INVOICE</div>
          <div style={{ fontSize: 12.5, color: T.inkSoft, marginTop: 6, lineHeight: 1.6 }}>
            Invoice no: <b style={{ color: T.ink }}>{inv.number}</b><br />
            Date issued: <b style={{ color: T.ink }}>{niceDate(new Date())}</b><br />
            Period: <b style={{ color: T.ink }}>{shortDate(inv.from)} – {shortDate(inv.to)}</b>
          </div>
        </div>
        <div style={{ textAlign: "right", fontSize: 12.5, lineHeight: 1.6 }}>
          <div style={{ fontSize: 11, letterSpacing: 1, color: T.lavender, fontWeight: 700 }}>FROM</div>
          <b style={{ color: T.pine, fontSize: 14 }}>{inv.name}</b><br />
          VirtuSpace Team
          <div style={{ fontSize: 11, letterSpacing: 1, color: T.lavender, fontWeight: 700, marginTop: 10 }}>BILL TO</div>
          <b style={{ color: T.pine, fontSize: 14 }}>VirtuSpace</b><br />
          {BRAND.email}
        </div>
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 24 }}>
        <thead>
          <tr>
            <th style={docTh}>Date</th>
            <th style={docTh}>Client</th>
            <th style={docTh}>Task</th>
            <th style={{ ...docTh, textAlign: "right" }}>Hours</th>
            <th style={{ ...docTh, textAlign: "right" }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {inv.lines.map((l) => (
            <tr key={l.id}>
              <td style={{ ...docTd, whiteSpace: "nowrap" }}>{shortDate(l.date)}</td>
              <td style={docTd}>{l.client}</td>
              <td style={docTd}>{l.task}</td>
              <td style={{ ...docTd, textAlign: "right" }}>{l.hours.toFixed(2)}</td>
              <td style={{ ...docTd, textAlign: "right" }}>{money(l.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
        <table style={{ borderCollapse: "collapse", minWidth: 240 }}>
          <tbody>
            <tr>
              <td style={{ ...docTd, borderBottom: "none", color: T.inkSoft }}>Total hours</td>
              <td style={{ ...docTd, borderBottom: "none", textAlign: "right", fontWeight: 700 }}>
                {(inv.totalMinutes / 60).toFixed(2)}
              </td>
            </tr>
            <tr>
              <td style={{ padding: "10px 8px", fontSize: 15, fontWeight: 700, color: T.pine, borderTop: `2px solid ${T.pine}` }}>Amount due</td>
              <td style={{ padding: "10px 8px", fontSize: 17, fontWeight: 700, color: T.pine, textAlign: "right", borderTop: `2px solid ${T.pine}` }}>
                {money(inv.totalAmount)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 30, fontSize: 12, color: T.inkSoft }}>
        Thank you for the work this period. Please allow standard processing time for payment.
      </div>
      <div style={{ marginTop: 24, paddingTop: 10, borderTop: `1px solid ${T.line}`, fontSize: 10.5, color: T.inkSoft, textAlign: "center", letterSpacing: 0.5 }}>
        {BRAND.name} · {BRAND.tagline} · {BRAND.site}
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
