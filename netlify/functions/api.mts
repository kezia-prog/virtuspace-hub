import type { Config, Context } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import crypto from "node:crypto";

/* ── stores ── */
const usersStore = () => getStore({ name: "hub-users", consistency: "strong" });
const dataStore = () => getStore({ name: "hub-data", consistency: "strong" });
const sharedStore = () => getStore({ name: "hub-shared", consistency: "strong" });

/* ── seed roster ── */
const SEED_MEMBERS = [
  { name: "Khadijah White", email: "khadijah@virtuspacett.com", role: "va" },
  { name: "Abigayle Shade", email: "abigayle@virtuspacett.com", role: "va" },
  { name: "Sadie Mohammed", email: "sadiemoh76@gmail.com", role: "va" },
  { name: "Candice Greenidge", email: "seamless.solutions868@gmail.com", role: "va" },
  { name: "Kezia Figaro", email: "kezia@virtuspacett.com", role: "owner" },
];
const SEED_CLIENTS = [
  { name: "Media InSite", budgetHours: 25, rate: 50 },
  { name: "CSpot", budgetHours: 20, rate: 60 },
  { name: "Neudis", budgetHours: 18, rate: 50 },
  { name: "Paul Nazareth", budgetHours: 45, rate: 50 },
  { name: "Vincent Valere", budgetHours: 40, rate: 60 },
  { name: "Jill Nykoliation", budgetHours: 20, rate: 60 },
  { name: "Covenant Group", budgetHours: 0, rate: 0 },
  { name: "VirtuSpace Internal", budgetHours: 0, rate: 0 },
];

/* ── helpers ── */
const todayKey = () => {
  // Trinidad is UTC-4 year-round
  const d = new Date(Date.now() - 4 * 3600 * 1000);
  return d.toISOString().slice(0, 10);
};
const rid = (n = 12) => crypto.randomBytes(n).toString("hex");
const inviteCode = () => crypto.randomBytes(4).toString("hex").toUpperCase();
const norm = (e: string) => (e || "").trim().toLowerCase();

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

const hashPw = (pw: string, salt: string) =>
  crypto.scryptSync(pw, salt, 64).toString("hex");

async function getSecret(): Promise<string> {
  const s = sharedStore();
  let sec = await s.get("session-secret");
  if (!sec) {
    sec = crypto.randomBytes(32).toString("hex");
    await s.set("session-secret", sec);
  }
  return sec as string;
}

async function makeToken(email: string): Promise<string> {
  const secret = await getSecret();
  const payload = Buffer.from(
    JSON.stringify({ e: email, x: Date.now() + 30 * 86400 * 1000 })
  ).toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

async function readAuth(req: Request) {
  const h = req.headers.get("authorization") || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : "";
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const secret = await getSecret();
  const expect = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  if (
    sig.length !== expect.length ||
    !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expect))
  )
    return null;
  try {
    const { e, x } = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (Date.now() > x) return null;
    const user = await usersStore().get(`user:${e}`, { type: "json" });
    return user || null;
  } catch {
    return null;
  }
}

const emptyData = () => ({ logs: [], priorities: {}, checkins: {}, createdAt: todayKey() });

async function getData(email: string) {
  const d = await dataStore().get(`member:${email}`, { type: "json" });
  return d || emptyData();
}

function overdueInfo(d: any) {
  const logs = d?.logs || [];
  const ref = logs.length
    ? logs.reduce((a: string, l: any) => (l.date > a ? l.date : a), "0000-00-00")
    : d?.createdAt || todayKey();
  const [y, m, dd] = ref.split("-").map(Number);
  const refUtc = Date.UTC(y, m - 1, dd);
  const [ty, tm, td] = todayKey().split("-").map(Number);
  const days = Math.round((Date.UTC(ty, tm - 1, td) - refUtc) / 86400000);
  return { overdue: days > 2, last: logs.length ? ref : null, days };
}

async function listUsers() {
  const { blobs } = await usersStore().list({ prefix: "user:" });
  const out: any[] = [];
  for (const b of blobs) {
    const u = await usersStore().get(b.key, { type: "json" });
    if (u) out.push(u);
  }
  return out;
}

async function ensureSeed() {
  const s = usersStore();
  const seeded = await s.get("seeded-v1");
  if (seeded) return;
  for (const m of SEED_MEMBERS) {
    const email = norm(m.email);
    const existing = await s.get(`user:${email}`, { type: "json" });
    if (!existing) {
      await s.setJSON(`user:${email}`, {
        name: m.name,
        email,
        role: m.role,
        invite: inviteCode(),
        passHash: null,
        salt: null,
        createdAt: todayKey(),
      });
      await dataStore().setJSON(`member:${email}`, emptyData());
    }
  }
  const cfg = await sharedStore().get("config", { type: "json" });
  if (!cfg) await sharedStore().setJSON("config", { clients: SEED_CLIENTS });
  await s.set("seeded-v1", "1");
}

async function ensureOwner() {
  const s = usersStore();
  if (await s.get("seeded-v2")) return;
  const kez = await s.get("user:kezia@virtuspacett.com", { type: "json" });
  if (kez && kez.role !== "owner") {
    kez.role = "owner";
    await s.setJSON("user:kezia@virtuspacett.com", kez);
  }
  await s.set("seeded-v2", "1");
}

async function getConfig() {
  const raw =
    (await sharedStore().get("config", { type: "json" })) || { clients: SEED_CLIENTS };
  const clients = (raw.clients || []).map((c: any) =>
    typeof c === "string"
      ? { name: c, budgetHours: 0, rate: 0 }
      : {
          name: String(c.name || ""),
          budgetHours: Number(c.budgetHours) || 0,
          rate: Number(c.rate) || 0,
        }
  );
  return { ...raw, clients };
}

const entryStatus = (l: any) => l.status || "pending";

async function getAnnouncements(): Promise<any[]> {
  return (await sharedStore().get("announcements", { type: "json" })) || [];
}

const appUrl = () =>
  (Netlify.env.get("APP_URL") || Netlify.env.get("URL") || "").replace(/\/$/, "");

/* ── email (Resend) ── */
async function sendEmail(
  to: string,
  subject: string,
  text: string,
  opts: { html?: string; replyTo?: string; cc?: string[]; fromName?: string } = {}
) {
  const key = Netlify.env.get("RESEND_API_KEY");
  if (!key) return { sent: false, reason: "RESEND_API_KEY is not set" };
  const rawFrom = Netlify.env.get("FROM_EMAIL") || "VirtuSpace Hub <onboarding@resend.dev>";
  const addrMatch = rawFrom.match(/<([^>]+)>/);
  const fromAddr = addrMatch ? addrMatch[1] : rawFrom;
  const from = opts.fromName ? `${opts.fromName} <${fromAddr}>` : rawFrom;
  const payload: any = { from, to: [to], subject, text };
  if (opts.html) payload.html = opts.html;
  if (opts.replyTo) payload.reply_to = opts.replyTo;
  if (opts.cc && opts.cc.length) payload.cc = opts.cc;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.text();
    return { sent: false, reason: `Email service error: ${err.slice(0, 200)}` };
  }
  return { sent: true };
}

const escHtml = (x: string) =>
  String(x).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function reminderEmailText(user: any, info: any) {
  const first = user.name.split(" ")[0];
  const since = info.last
    ? `since ${info.last} (${info.days} days)`
    : `in ${info.days} days`;
  return `Hi ${first},

Friendly reminder from the VirtuSpace Daily Hub — we haven't seen any time logged from you ${since}.

Please click back into your account and update your hours:
${appUrl() || "(hub link)"}

Thank you!
VirtuSpace · Your Partner in Professional Success`;
}

function inviteEmailText(user: any) {
  const first = user.name.split(" ")[0];
  return `Hi ${first},

Welcome to the VirtuSpace Daily Hub — your space for daily priorities, time logging, team updates and invoices.

Set up your account here:
${appUrl()}/#setup=${encodeURIComponent(user.email)}:${user.invite}

Or open ${appUrl() || "the hub"} , choose "Set up my account", and enter:
Email: ${user.email}
Invite code: ${user.invite}

See you inside!
VirtuSpace · Your Partner in Professional Success`;
}

export async function postReminderNotice(user: any, info: any) {
  const ann = await getAnnouncements();
  const text = info.last
    ? `Gentle reminder — no time logged since ${info.last} (${info.days} days). Please update your hours on the Today tab.`
    : `Gentle reminder — no time logged in ${info.days} days. Please update your hours on the Today tab.`;
  const next = [
    {
      id: rid(6),
      author: "VirtuSpace Hub",
      to: user.email,
      text,
      ts: Date.now(),
      acks: [],
    },
    ...ann,
  ];
  await sharedStore().setJSON("announcements", next);
}

/* ── weekly helpers ── */
function weekKeys(offset: number) {
  const now = new Date(Date.now() - 4 * 3600 * 1000);
  const day = (now.getUTCDay() + 6) % 7;
  const mon = new Date(now);
  mon.setUTCDate(now.getUTCDate() - day + offset * 7);
  const keys: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(mon);
    d.setUTCDate(mon.getUTCDate() + i);
    keys.push(d.toISOString().slice(0, 10));
  }
  return keys;
}

function periodRange(kind: string) {
  const now = new Date(Date.now() - 4 * 3600 * 1000);
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const dk = (d: Date) => d.toISOString().slice(0, 10);
  if (kind === "thisWeek" || kind === "lastWeek") {
    const keys = weekKeys(kind === "thisWeek" ? 0 : -1);
    return { from: keys[0], to: keys[6] };
  }
  if (kind === "thisMonth")
    return { from: dk(new Date(Date.UTC(y, m, 1))), to: dk(new Date(Date.UTC(y, m + 1, 0))) };
  return { from: dk(new Date(Date.UTC(y, m - 1, 1))), to: dk(new Date(Date.UTC(y, m, 0))) };
}

/* ── handler ── */
export default async (req: Request, _context: Context) => {
  await ensureSeed();
  await ensureOwner();
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/api/, "") || "/";
  const method = req.method;
  const body = method === "POST" ? await req.json().catch(() => ({})) : {};

  /* ---- public routes ---- */
  if (method === "POST" && path === "/login") {
    const email = norm(body.email);
    const user = await usersStore().get(`user:${email}`, { type: "json" });
    if (!user || !user.passHash)
      return json({ error: "No account found — set up your account first." }, 401);
    const hash = hashPw(String(body.password || ""), user.salt);
    if (hash !== user.passHash) return json({ error: "Incorrect email or password." }, 401);
    return json({ token: await makeToken(email), name: user.name, role: user.role });
  }

  if (method === "POST" && path === "/setup") {
    const email = norm(body.email);
    const user = await usersStore().get(`user:${email}`, { type: "json" });
    if (!user) return json({ error: "This email isn't on the team roster. Ask Kezia to add you." }, 404);
    if (user.passHash) return json({ error: "Account already set up — just log in." }, 400);
    const allUsers = await listUsers();
    const anyActive = allUsers.some((u: any) => u.passHash);
    if (anyActive && String(body.invite || "").trim().toUpperCase() !== user.invite)
      return json({ error: "Invite code doesn't match." }, 401);
    const pw = String(body.password || "");
    if (pw.length < 8) return json({ error: "Password must be at least 8 characters." }, 400);
    user.salt = rid(16);
    user.passHash = hashPw(pw, user.salt);
    user.invite = null;
    await usersStore().setJSON(`user:${email}`, user);
    return json({ token: await makeToken(email), name: user.name, role: user.role });
  }

  /* ---- authenticated ---- */
  const me = await readAuth(req);
  if (!me) return json({ error: "Not signed in" }, 401);
  const isOwner = me.role === "owner";
  const isAdmin = isOwner || me.role === "admin";

  if (method === "GET" && path === "/me") {
    const users = await listUsers();
    const config = await getConfig();
    const ann = await getAnnouncements();
    const tk = todayKey();
    const team: any[] = [];
    for (const u of users) {
      const d = await getData(u.email);
      const info = overdueInfo(d);
      team.push({
        name: u.name,
        email: u.email,
        role: u.role,
        todayMinutes: d.logs
          .filter((l: any) => l.date === tk)
          .reduce((s: number, l: any) => s + l.minutes, 0),
        todayPriorities: d.priorities[tk] || [],
        todayCheckin: (d.checkins || {})[tk] || "",
        lastLog: info.last,
        overdueDays: info.overdue ? info.days : 0,
      });
    }
    const myData = await getData(me.email);
    const visible = ann.filter((a) => !a.to || a.to === me.email || isAdmin);
    const safeConfig = {
      ...config,
      clients: config.clients.map((c: any) =>
        isOwner ? c : { name: c.name, budgetHours: c.budgetHours, rate: 0 }
      ),
    };
    return json({
      me: { name: me.name, email: me.email, role: me.role },
      config: safeConfig,
      data: myData,
      team,
      announcements: visible,
      today: tk,
    });
  }

  if (method === "POST" && path === "/log") {
    const d = await getData(me.email);
    const reqDate = String(body.date || "");
    const validDate = /^\d{4}-\d{2}-\d{2}$/.test(reqDate) && reqDate <= todayKey() ? reqDate : todayKey();
    const entry = {
      id: rid(6),
      date: validDate,
      client: String(body.client || "").slice(0, 80),
      task: String(body.task || "").slice(0, 200),
      minutes: Math.max(1, Math.round(Number(body.minutes) || 0)),
      status: "pending",
    };
    if (!entry.client || !entry.task) return json({ error: "Client and task required" }, 400);
    d.logs.push(entry);
    await dataStore().setJSON(`member:${me.email}`, d);
    return json({ ok: true, entry });
  }

  if (method === "POST" && path === "/log/delete") {
    const d = await getData(me.email);
    d.logs = d.logs.filter((l: any) => l.id !== body.id);
    await dataStore().setJSON(`member:${me.email}`, d);
    return json({ ok: true });
  }

  if (method === "POST" && path === "/priorities") {
    const d = await getData(me.email);
    let date = String(body.date || todayKey());
    const weekAgo = new Date(Date.now() - 7 * 86400 * 1000).toISOString().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > todayKey() || date < weekAgo) date = todayKey();
    d.priorities[date] = (body.list || []).slice(0, 3).map((p: any) => ({
      id: p.id || rid(4),
      text: String(p.text || "").slice(0, 200),
      done: !!p.done,
    }));
    await dataStore().setJSON(`member:${me.email}`, d);
    return json({ ok: true });
  }

  if (method === "POST" && path === "/checkin") {
    const d = await getData(me.email);
    if (!d.checkins) d.checkins = {};
    const date = /^\d{4}-\d{2}-\d{2}$/.test(String(body.date || "")) ? body.date : todayKey();
    d.checkins[date] = String(body.text || "").slice(0, 600);
    await dataStore().setJSON(`member:${me.email}`, d);
    return json({ ok: true });
  }

  if (method === "GET" && path === "/report/priorities") {
    const offset = Number(url.searchParams.get("offset") || 0);
    const keys = weekKeys(Math.min(0, offset));
    const users = await listUsers();
    const members: any[] = [];
    for (const u of users) {
      const d = await getData(u.email);
      const days = keys.map((k) => ({
        date: k,
        priorities: (d.priorities[k] || []).map((p: any) => ({ text: p.text, done: !!p.done })),
        checkin: (d.checkins || {})[k] || "",
      }));
      const total = days.reduce((s, day) => s + day.priorities.length, 0);
      const done = days.reduce((s, day) => s + day.priorities.filter((p) => p.done).length, 0);
      if (total > 0 || days.some((day) => day.checkin)) members.push({ name: u.name, days, total, done });
    }
    return json({ keys, members });
  }

  if (method === "POST" && path === "/checkin") {
    const MOODS = ["great", "good", "okay", "stretched", "struggling"];
    const mood = String(body.mood || "");
    if (!MOODS.includes(mood)) return json({ error: "Pick a mood" }, 400);
    const d = await getData(me.email);
    d.checkins = d.checkins || {};
    const prevMood = d.checkins[todayKey()]?.mood;
    const note = String(body.note || "").slice(0, 200);
    d.checkins[todayKey()] = { mood, note, ts: Date.now() };
    await dataStore().setJSON(`member:${me.email}`, d);

    // wellbeing alert to owners on Stretched / Struggling — once per person per day per mood, guaranteed
    const ALERT: Record<string, string> = { stretched: "Stretched", struggling: "Struggling" };
    const alertKey = `${me.email}:${todayKey()}:${mood}`;
    const sentAlerts = ((await sharedStore().get("wellbeing-alerts", { type: "json" })) || {}) as Record<string, boolean>;
    if (ALERT[mood] && !sentAlerts[alertKey]) {
      sentAlerts[alertKey] = true;
      await sharedStore().setJSON("wellbeing-alerts", sentAlerts);
      const owners = (await listUsers()).filter((u: any) => u.role === "owner" && u.email !== me.email);
      if (owners.length) {
        const ann = await getAnnouncements();
        const first = me.name.split(" ")[0];
        const noticeText = `${me.name} checked in feeling ${ALERT[mood]} today${note ? ` — “${note}”` : ""}. Might be a good moment to reach out.`;
        const next = [
          ...owners.map((o: any) => ({
            id: rid(6),
            author: "VirtuSpace Hub",
            to: o.email,
            text: noticeText,
            ts: Date.now(),
            acks: [],
          })),
          ...ann,
        ];
        await sharedStore().setJSON("announcements", next);
        for (const o of owners) {
          await sendEmail(
            o.email,
            `Check-in: ${first} is feeling ${ALERT[mood]} today`,
            `Hi ${o.name.split(" ")[0]},\n\n${me.name} just checked in on the VirtuSpace Daily Hub feeling ${ALERT[mood]}${note ? `:\n\n“${note}”` : "."}\n\nA quick message from you might make her day easier.\n${appUrl()}\n\nVirtuSpace Daily Hub`
          );
        }
      }
    }
    return json({ ok: true });
  }

  if (method === "GET" && path === "/report/priorities") {
    const offset = Number(url.searchParams.get("offset") || 0);
    const keys = weekKeys(Math.min(0, offset));
    const users = await listUsers();
    const members: any[] = [];
    for (const u of users) {
      const d = await getData(u.email);
      const days: any = {};
      for (const k of keys) {
        const pris = d.priorities[k] || [];
        const ci = (d.checkins || {})[k];
        if (pris.length || ci) days[k] = { priorities: pris, checkin: ci ? { mood: ci.mood, note: ci.note || "" } : null };
      }
      members.push({ name: u.name, days });
    }
    return json({ keys, members });
  }

  if (method === "POST" && path === "/announce") {
    const ann = await getAnnouncements();
    const next = [
      {
        id: rid(6),
        author: me.name,
        text: String(body.text || "").slice(0, 600),
        ts: Date.now(),
        acks: [],
      },
      ...ann,
    ];
    await sharedStore().setJSON("announcements", next);
    return json({ ok: true });
  }

  if (method === "POST" && path === "/announce/ack") {
    const ann = await getAnnouncements();
    const next = ann.map((a) =>
      a.id === body.id && !a.acks.includes(me.name) ? { ...a, acks: [...a.acks, me.name] } : a
    );
    await sharedStore().setJSON("announcements", next);
    return json({ ok: true });
  }

  if (method === "POST" && path === "/announce/delete") {
    const ann = await getAnnouncements();
    const target = ann.find((a) => a.id === body.id);
    if (!target) return json({ ok: true });
    if (target.author !== me.name && !isAdmin) return json({ error: "Not allowed" }, 403);
    await sharedStore().setJSON(
      "announcements",
      ann.filter((a) => a.id !== body.id)
    );
    return json({ ok: true });
  }

  if (method === "GET" && path === "/report") {
    const offset = Number(url.searchParams.get("offset") || 0);
    const keys = weekKeys(Math.min(0, offset));
    const users = await listUsers();
    const members: any[] = [];
    for (const u of users) {
      const d = await getData(u.email);
      members.push({
        name: u.name,
        logs: d.logs.filter((l: any) => l.date >= keys[0] && l.date <= keys[6]),
      });
    }
    return json({ keys, members });
  }

  if (method === "GET" && path === "/invoice") {
    const rate = Number(Netlify.env.get("HOURLY_RATE") || 30);
    const { from, to } = periodRange(url.searchParams.get("period") || "lastWeek");
    const d = await getData(me.email);
    const inPeriod = d.logs.filter((l: any) => l.date >= from && l.date <= to);
    const lines = inPeriod
      .filter((l: any) => entryStatus(l) === "approved")
      .sort((a: any, b: any) => (a.date < b.date ? -1 : 1))
      .map((l: any) => ({
        ...l,
        hours: +(l.minutes / 60).toFixed(2),
        amount: +((l.minutes / 60) * rate).toFixed(2),
      }));
    const pendingCount = inPeriod.filter((l: any) => entryStatus(l) !== "approved").length;
    const totalMinutes = lines.reduce((s: number, l: any) => s + l.minutes, 0);
    const totalAmount = +((totalMinutes / 60) * rate).toFixed(2);
    const initials = me.name
      .split(" ")
      .map((p: string) => p[0])
      .join("")
      .toUpperCase();
    return json({
      lines,
      pendingCount,
      totalMinutes,
      totalAmount,
      currency: "TT$",
      from,
      to,
      number: `VS-${initials}-${todayKey().replace(/-/g, "")}`,
      name: me.name,
      email: me.email,
    });
  }

  if (method === "POST" && path === "/invoice/send") {
    const rate = Number(Netlify.env.get("HOURLY_RATE") || 30);
    const { from, to } = periodRange(String(body.period || "lastWeek"));
    const d = await getData(me.email);
    const lines = d.logs
      .filter((l: any) => l.date >= from && l.date <= to && entryStatus(l) === "approved")
      .sort((a: any, b: any) => (a.date < b.date ? -1 : 1));
    if (!lines.length) return json({ error: "No approved entries in that period yet" }, 400);
    const totalMinutes = lines.reduce((s: number, l: any) => s + l.minutes, 0);
    const totalAmount = ((totalMinutes / 60) * rate).toFixed(2);
    const initials = me.name.split(" ").map((p: string) => p[0]).join("").toUpperCase();
    const number = `VS-${initials}-${todayKey().replace(/-/g, "")}`;
    const owners = (await listUsers()).filter((u: any) => u.role === "owner");
    const toEmail = Netlify.env.get("INVOICE_EMAIL") || owners[0]?.email || "hello@virtuspacett.com";
    const first = me.name.split(" ")[0];

    const rowsHtml = lines
      .map(
        (l: any) =>
          `<tr><td style="padding:6px 8px;border-bottom:1px solid #E1E0D6;font-size:13px">${l.date}</td><td style="padding:6px 8px;border-bottom:1px solid #E1E0D6;font-size:13px">${escHtml(l.client)}</td><td style="padding:6px 8px;border-bottom:1px solid #E1E0D6;font-size:13px">${escHtml(l.task)}</td><td align="right" style="padding:6px 8px;border-bottom:1px solid #E1E0D6;font-size:13px">${(l.minutes / 60).toFixed(2)}</td><td align="right" style="padding:6px 8px;border-bottom:1px solid #E1E0D6;font-size:13px">TT$${((l.minutes / 60) * rate).toFixed(2)}</td></tr>`
      )
      .join("");
    const html = `<div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;color:#33343A"><h2 style="color:#1F0D9E;margin-bottom:2px">Invoice ${number}</h2><p style="margin-top:0;color:#6A6B75">From <b>${escHtml(me.name)}</b> (${me.email}) · Period ${from} – ${to} · Bill to: VirtuSpace</p><table style="width:100%;border-collapse:collapse"><thead><tr><th align="left" style="padding:6px 8px;border-bottom:2px solid #1F0D9E;font-size:12px">DATE</th><th align="left" style="padding:6px 8px;border-bottom:2px solid #1F0D9E;font-size:12px">CLIENT</th><th align="left" style="padding:6px 8px;border-bottom:2px solid #1F0D9E;font-size:12px">TASK</th><th align="right" style="padding:6px 8px;border-bottom:2px solid #1F0D9E;font-size:12px">HOURS</th><th align="right" style="padding:6px 8px;border-bottom:2px solid #1F0D9E;font-size:12px">AMOUNT</th></tr></thead><tbody>${rowsHtml}</tbody></table><p style="text-align:right;font-size:16px;margin-top:14px">Total hours: <b>${(totalMinutes / 60).toFixed(2)}</b> &nbsp;·&nbsp; Amount due: <b style="color:#1F0D9E">TT$${totalAmount}</b></p><p style="color:#6A6B75;font-size:12px">Reply to this email to reach ${escHtml(first)} directly. Sent via the VirtuSpace Daily Hub.</p></div>`;

    const mail = await sendEmail(
      toEmail,
      `Invoice ${number} — ${me.name} — ${from} to ${to}`,
      `Invoice ${number} from ${me.name} (${me.email})\nPeriod: ${from} – ${to}\nTotal hours: ${(totalMinutes / 60).toFixed(2)}\nAmount due: TT$${totalAmount}\n\nOpen the hub for the full breakdown: ${appUrl()}`,
      { html, replyTo: me.email, cc: [me.email], fromName: `${me.name} via VirtuSpace Hub` }
    );

    // store the invoice so the owner can open the PDF from the hub
    const received = ((await sharedStore().get("invoices", { type: "json" })) || []) as any[];
    received.unshift({
      id: rid(6),
      number,
      name: me.name,
      email: me.email,
      from,
      to,
      totalMinutes,
      totalAmount: Number(totalAmount),
      ts: Date.now(),
      lines: lines.map((l: any) => ({
        id: l.id,
        date: l.date,
        client: l.client,
        task: l.task,
        minutes: l.minutes,
        hours: +(l.minutes / 60).toFixed(2),
        amount: +((l.minutes / 60) * rate).toFixed(2),
      })),
    });
    await sharedStore().setJSON("invoices", received.slice(0, 100));

    // notify owners in-app
    const ann = await getAnnouncements();
    const next = [
      ...owners
        .filter((o: any) => o.email !== me.email)
        .map((o: any) => ({
          id: rid(6),
          author: "VirtuSpace Hub",
          to: o.email,
          text: `${me.name} submitted invoice ${number} for ${from} – ${to} — TT$${totalAmount} (${(totalMinutes / 60).toFixed(2)} hrs).`,
          ts: Date.now(),
          acks: [],
        })),
      ...ann,
    ];
    await sharedStore().setJSON("announcements", next);

    return json({ ok: true, emailed: mail.sent, emailNote: mail.reason, number });
  }

  if (method === "GET" && path === "/budget-status") {
    const config = await getConfig();
    const budgeted = config.clients.filter((c: any) => c.budgetHours > 0);
    if (!budgeted.length) return json({ month: "", clients: [] });
    const tk = todayKey();
    const monthPrefix = tk.slice(0, 7); // YYYY-MM
    const users = await listUsers();
    const totals: Record<string, number> = {};
    for (const u of users) {
      const d = await getData(u.email);
      for (const l of d.logs) {
        if (l.date.slice(0, 7) === monthPrefix) totals[l.client] = (totals[l.client] || 0) + l.minutes;
      }
    }
    const [y, m] = monthPrefix.split("-").map(Number);
    const monthName = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-TT", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });
    return json({
      month: monthName,
      clients: budgeted.map((c: any) => ({
        name: c.name,
        budgetHours: c.budgetHours,
        minutes: totals[c.name] || 0,
      })),
    });
  }

  /* ---- admin ---- */
  if (!isAdmin && path.startsWith("/admin")) return json({ error: "Admin only" }, 403);

  if (method === "GET" && path === "/admin/team") {
    const users = await listUsers();
    const out: any[] = [];
    for (const u of users) {
      const d = await getData(u.email);
      const info = overdueInfo(d);
      out.push({
        name: u.name,
        email: u.email,
        role: u.role,
        active: !!u.passHash,
        invite: u.passHash ? null : u.invite,
        lastLog: info.last,
        days: info.days,
        overdue: info.overdue,
      });
    }
    return json({ team: out, appUrl: appUrl(), emailConfigured: !!Netlify.env.get("RESEND_API_KEY") });
  }

  if (method === "POST" && path === "/admin/member") {
    const email = norm(body.email);
    const name = String(body.name || "").trim();
    if (!email || !name) return json({ error: "Name and email required" }, 400);
    const existing = await usersStore().get(`user:${email}`, { type: "json" });
    if (existing) return json({ error: "That email is already on the team" }, 400);
    const user = {
      name,
      email,
      role: "va",
      invite: inviteCode(),
      passHash: null,
      salt: null,
      createdAt: todayKey(),
    };
    await usersStore().setJSON(`user:${email}`, user);
    await dataStore().setJSON(`member:${email}`, emptyData());
    const mail = await sendEmail(
      email,
      "Welcome to the VirtuSpace Daily Hub — set up your account",
      inviteEmailText(user)
    );
    return json({ ok: true, invite: user.invite, emailed: mail.sent, emailNote: mail.reason });
  }

  if (method === "POST" && path === "/admin/member/reset") {
    const email = norm(body.email);
    const user = await usersStore().get(`user:${email}`, { type: "json" });
    if (!user) return json({ error: "Not found" }, 404);
    user.passHash = null;
    user.salt = null;
    user.invite = inviteCode();
    await usersStore().setJSON(`user:${email}`, user);
    const mail = await sendEmail(
      email,
      "VirtuSpace Daily Hub — reset your account",
      inviteEmailText(user)
    );
    return json({ ok: true, invite: user.invite, emailed: mail.sent, emailNote: mail.reason });
  }

  if (method === "POST" && path === "/admin/member/delete") {
    const email = norm(body.email);
    if (email === me.email) return json({ error: "You can't remove yourself" }, 400);
    await usersStore().delete(`user:${email}`);
    await dataStore().delete(`member:${email}`);
    return json({ ok: true });
  }

  if (method === "POST" && path === "/admin/remind") {
    const email = norm(body.email);
    const user = await usersStore().get(`user:${email}`, { type: "json" });
    if (!user) return json({ error: "Not found" }, 404);
    const info = overdueInfo(await getData(email));
    await postReminderNotice(user, info);
    const mail = await sendEmail(
      email,
      "VirtuSpace Daily Hub — time log reminder",
      reminderEmailText(user, info)
    );
    return json({ ok: true, emailed: mail.sent, emailNote: mail.reason });
  }

  if (method === "GET" && path === "/admin/review") {
    const offset = Number(url.searchParams.get("offset") || 0);
    const keys = weekKeys(Math.min(0, offset));
    const users = await listUsers();
    const members: any[] = [];
    for (const u of users) {
      const d = await getData(u.email);
      const entries = d.logs
        .filter((l: any) => l.date >= keys[0] && l.date <= keys[6])
        .map((l: any) => ({ ...l, status: entryStatus(l) }))
        .sort((a: any, b: any) => (a.date < b.date ? -1 : 1));
      if (entries.length) members.push({ name: u.name, email: u.email, entries });
    }
    return json({ keys, members });
  }

  if (method === "POST" && path === "/admin/review/set") {
    const email = norm(body.email);
    const d = await getData(email);
    d.logs = d.logs.map((l: any) =>
      l.id === body.id
        ? { ...l, status: ["approved", "queried", "pending"].includes(body.status) ? body.status : "pending" }
        : l
    );
    await dataStore().setJSON(`member:${email}`, d);
    return json({ ok: true });
  }

  if (method === "POST" && path === "/admin/review/approve") {
    const email = norm(body.email);
    const d = await getData(email);
    d.logs = d.logs.map((l: any) =>
      l.date >= body.from && l.date <= body.to && entryStatus(l) === "pending"
        ? { ...l, status: "approved" }
        : l
    );
    await dataStore().setJSON(`member:${email}`, d);
    return json({ ok: true });
  }

  if (method === "POST" && path === "/admin/member/role") {
    if (!isOwner) return json({ error: "Only the owner can change roles" }, 403);
    const email = norm(body.email);
    const user = await usersStore().get(`user:${email}`, { type: "json" });
    if (!user) return json({ error: "Not found" }, 404);
    if (user.role === "owner") return json({ error: "The owner's role can't be changed" }, 400);
    const role = body.role === "admin" ? "admin" : "va";
    user.role = role;
    await usersStore().setJSON(`user:${email}`, user);
    return json({ ok: true, role });
  }

  if (method === "GET" && path === "/admin/invoices") {
    if (!isOwner) return json({ error: "Owner only" }, 403);
    const invoices = (await sharedStore().get("invoices", { type: "json" })) || [];
    return json({ invoices });
  }

  if (method === "GET" && path === "/admin/pnl") {
    if (!isOwner) return json({ error: "Owner only" }, 403);
    const payRate = Number(Netlify.env.get("HOURLY_RATE") || 30);
    const { from, to } = periodRange(url.searchParams.get("period") || "thisMonth");
    const config = await getConfig();
    const users = await listUsers();
    const byClient: Record<string, number> = {};
    for (const u of users) {
      const d = await getData(u.email);
      for (const l of d.logs) {
        if (l.date >= from && l.date <= to && entryStatus(l) === "approved")
          byClient[l.client] = (byClient[l.client] || 0) + l.minutes;
      }
    }
    const lines = Object.entries(byClient)
      .map(([name, minutes]) => {
        const meta = config.clients.find((c: any) => c.name === name);
        const hours = minutes / 60;
        const rate = meta?.rate || 0;
        const revenue = +(hours * rate).toFixed(2);
        const cost = +(hours * payRate).toFixed(2);
        return { name, minutes, revenue, cost, margin: +(revenue - cost).toFixed(2), rateSet: rate > 0 };
      })
      .sort((a, b) => b.margin - a.margin);
    const tot = (k: string) => +lines.reduce((s: number, l: any) => s + l[k], 0).toFixed(2);
    return json({ from, to, lines, totalRevenue: tot("revenue"), totalCost: tot("cost"), totalMargin: tot("margin") });
  }

  if (method === "GET" && path === "/admin/statement") {
    if (!isOwner) return json({ error: "Owner only" }, 403);
    if (!isOwner) return json({ error: "Owner only" }, 403);
    const clientName = url.searchParams.get("client") || "";
    const { from, to } = periodRange(url.searchParams.get("period") || "lastMonth");
    const config = await getConfig();
    const clientMeta = config.clients.find((c: any) => c.name === clientName) || { rate: 0 };
    const users = await listUsers();
    const lines: any[] = [];
    for (const u of users) {
      const d = await getData(u.email);
      for (const l of d.logs) {
        if (l.client === clientName && l.date >= from && l.date <= to && entryStatus(l) === "approved") {
          lines.push({
            id: l.id,
            date: l.date,
            member: u.name,
            task: l.task,
            minutes: l.minutes,
            hours: +(l.minutes / 60).toFixed(2),
            amount: clientMeta.rate ? +((l.minutes / 60) * clientMeta.rate).toFixed(2) : null,
          });
        }
      }
    }
    lines.sort((a, b) => (a.date < b.date ? -1 : 1));
    const totalMinutes = lines.reduce((s, l) => s + l.minutes, 0);
    return json({
      client: clientName,
      from,
      to,
      rate: clientMeta.rate || 0,
      lines,
      totalMinutes,
      totalAmount: clientMeta.rate ? +((totalMinutes / 60) * clientMeta.rate).toFixed(2) : null,
    });
  }

  if (method === "POST" && path === "/admin/member/role") {
    if (!isOwner) return json({ error: "Owner only" }, 403);
    const email = norm(body.email);
    const user = await usersStore().get(`user:${email}`, { type: "json" });
    if (!user) return json({ error: "Not found" }, 404);
    if (user.role === "owner") return json({ error: "The owner role can't be changed" }, 400);
    user.role = body.role === "admin" ? "admin" : "va";
    await usersStore().setJSON(`user:${email}`, user);
    return json({ ok: true });
  }

  if (method === "GET" && path === "/owner/pnl") {
    if (!isOwner) return json({ error: "Owner only" }, 403);
    const payRate = Number(Netlify.env.get("HOURLY_RATE") || 30);
    const { from, to } = periodRange(url.searchParams.get("period") || "thisMonth");
    const config = await getConfig();
    const users = await listUsers();
    const perClient: Record<string, number> = {};
    for (const u of users) {
      const d = await getData(u.email);
      for (const l of d.logs) {
        if (l.date >= from && l.date <= to && entryStatus(l) === "approved") {
          perClient[l.client] = (perClient[l.client] || 0) + l.minutes;
        }
      }
    }
    const rows = Object.entries(perClient)
      .map(([name, minutes]) => {
        const meta = config.clients.find((c: any) => c.name === name) || { rate: 0 };
        const hours = minutes / 60;
        const revenue = +(hours * (meta.rate || 0)).toFixed(2);
        const cost = +(hours * payRate).toFixed(2);
        return { name, minutes, hours: +hours.toFixed(2), rate: meta.rate || 0, revenue, cost, profit: +(revenue - cost).toFixed(2) };
      })
      .sort((a, b) => b.revenue - a.revenue);
    const totals = rows.reduce(
      (t, r) => ({ minutes: t.minutes + r.minutes, revenue: +(t.revenue + r.revenue).toFixed(2), cost: +(t.cost + r.cost).toFixed(2) }),
      { minutes: 0, revenue: 0, cost: 0 }
    );
    return json({ from, to, payRate, rows, totals: { ...totals, profit: +(totals.revenue - totals.cost).toFixed(2) } });
  }

  if (method === "POST" && path === "/admin/clients") {
    const config = await getConfig();
    const previous = config.clients;
    config.clients = (body.clients || [])
      .map((c: any) => {
        const name = String(c.name || c || "").trim().slice(0, 80);
        const prev = previous.find((p: any) => p.name === name);
        return {
          name,
          budgetHours: Math.max(0, Number(c.budgetHours) || 0),
          rate: isOwner ? Math.max(0, Number(c.rate) || 0) : prev?.rate || 0,
        };
      })
      .filter((c: any) => c.name)
      .slice(0, 100);
    await sharedStore().setJSON("config", config);
    return json({ ok: true, config });
  }

  return json({ error: "Not found" }, 404);
};

export const config: Config = {
  path: "/api/*",
};
