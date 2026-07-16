import type { Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import crypto from "node:crypto";

const usersStore = () => getStore({ name: "hub-users", consistency: "strong" });
const dataStore = () => getStore({ name: "hub-data", consistency: "strong" });
const sharedStore = () => getStore({ name: "hub-shared", consistency: "strong" });

const todayKey = () => {
  const d = new Date(Date.now() - 4 * 3600 * 1000); // Trinidad UTC-4
  return d.toISOString().slice(0, 10);
};
const rid = (n = 6) => crypto.randomBytes(n).toString("hex");

const appUrl = () =>
  (Netlify.env.get("APP_URL") || Netlify.env.get("URL") || "").replace(/\/$/, "");

function overdueInfo(d: any) {
  const logs = d?.logs || [];
  const ref = logs.length
    ? logs.reduce((a: string, l: any) => (l.date > a ? l.date : a), "0000-00-00")
    : d?.createdAt || todayKey();
  const [y, m, dd] = ref.split("-").map(Number);
  const [ty, tm, td] = todayKey().split("-").map(Number);
  const days = Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(y, m - 1, dd)) / 86400000);
  return { overdue: days > 2, last: logs.length ? ref : null, days };
}

async function sendEmail(to: string, subject: string, text: string) {
  const key = Netlify.env.get("RESEND_API_KEY");
  if (!key) return false;
  const from = Netlify.env.get("FROM_EMAIL") || "VirtuSpace Hub <onboarding@resend.dev>";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ from, to: [to], subject, text }),
  });
  return res.ok;
}

export default async (_req: Request) => {
  const { blobs } = await usersStore().list({ prefix: "user:" });
  const shared = sharedStore();
  const sent = (await shared.get("reminders-sent", { type: "json" })) || {};
  let announcements = (await shared.get("announcements", { type: "json" })) || [];
  const tk = todayKey();
  let changed = false;

  for (const b of blobs) {
    const user = await usersStore().get(b.key, { type: "json" });
    if (!user) continue;
    const d = await dataStore().get(`member:${user.email}`, { type: "json" });
    const info = overdueInfo(d);
    const stamp = `${user.email}:${tk}`;
    if (!info.overdue || sent[stamp]) continue;

    const sinceText = info.last
      ? `no time logged since ${info.last} (${info.days} days)`
      : `no time logged in ${info.days} days`;

    announcements = [
      {
        id: rid(),
        author: "VirtuSpace Hub",
        to: user.email,
        text: `Gentle reminder — ${sinceText}. Please update your hours on the Today tab.`,
        ts: Date.now(),
        acks: [],
      },
      ...announcements,
    ];

    const first = user.name.split(" ")[0];
    await sendEmail(
      user.email,
      "VirtuSpace Daily Hub — time log reminder",
      `Hi ${first},\n\nFriendly reminder from the VirtuSpace Daily Hub — we haven't seen any time logged from you ${
        info.last ? `since ${info.last} (${info.days} days)` : `in ${info.days} days`
      }.\n\nPlease click back into your account and update your hours:\n${appUrl()}\n\nThank you!\nVirtuSpace · Your Partner in Professional Success`
    );

    sent[stamp] = true;
    changed = true;
    console.log(`Reminder sent to ${user.email} (${sinceText})`);
  }

  if (changed) {
    await shared.setJSON("announcements", announcements);
    await shared.setJSON("reminders-sent", sent);
  }
};

export const config: Config = {
  // 12:00 UTC = 8:00 AM Trinidad time, every day
  schedule: "0 12 * * *",
};
