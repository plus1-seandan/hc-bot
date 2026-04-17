"use strict";

const { parse } = require("csv-parse/sync");

const SHEET_ID =
  process.env.HC_SHEET_ID ||
  "1x3AzPi0hxGUeamLDj3TnMxldP-h3zfULpKM2mW08ATM";

const TTL_MS = 60_000; // 60s cache per tab
const cache = new Map();

function sheetUrl(tab) {
  return `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(
    tab
  )}`;
}

async function fetchTab(tab) {
  const now = Date.now();
  const cached = cache.get(tab);
  if (cached && now - cached.ts < TTL_MS) return cached.rows;

  const res = await fetch(sheetUrl(tab), {
    headers: { "User-Agent": "hc-bot/1.0" },
  });
  if (!res.ok) {
    throw new Error(
      `Sheet fetch for tab "${tab}" failed: ${res.status} ${res.statusText}`
    );
  }
  const text = await res.text();
  const rows = parse(text, {
    relax_column_count: true,
    skip_empty_lines: false,
  });
  cache.set(tab, { ts: now, rows });
  return rows;
}

function clean(v) {
  return (v ?? "").toString().trim();
}

// ========== This month ==========

const WEEK_LABELS = [
  "Last week",
  "This week",
  "Next week",
  "Week after",
  "In 3 weeks",
  "In 4 weeks",
];

function parseHistoryDate(str) {
  // Format: MM/DD/YY or MM/DD/YYYY
  const s = clean(str);
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/.exec(s);
  if (!m) return null;
  let [, mm, dd, yy] = m;
  const month = parseInt(mm, 10);
  const day = parseInt(dd, 10);
  let year = parseInt(yy, 10);
  if (year < 100) year += 2000;
  const d = new Date(year, month - 1, day);
  if (
    d.getFullYear() !== year ||
    d.getMonth() !== month - 1 ||
    d.getDate() !== day
  ) {
    return null;
  }
  return d;
}

async function getHostingSchedule() {
  const history = await fetchTab("History");

  const entries = [];
  for (let i = 1; i < history.length; i++) {
    const row = history[i];
    const date = parseHistoryDate(row[1]);
    const host = clean(row[2]);
    const address = clean(row[3]);
    if (!date || !host) continue;
    entries.push({
      date,
      dateStr: clean(row[1]),
      host,
      address: address === "#N/A" ? null : address,
      parking: clean(row[7]),
    });
  }
  entries.sort((a, b) => a.date - b.date);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // "This week" = first entry whose date >= today.
  let thisIdx = entries.findIndex((e) => e.date >= today);
  if (thisIdx === -1) thisIdx = entries.length - 1;

  const offsets = [-1, 0, 1, 2, 3, 4];
  const schedule = [];
  for (let k = 0; k < WEEK_LABELS.length; k++) {
    const idx = thisIdx + offsets[k];
    if (idx < 0 || idx >= entries.length) {
      schedule.push({ label: WEEK_LABELS[k], date: null, host: null, address: null });
      continue;
    }
    const e = entries[idx];
    schedule.push({
      label: WEEK_LABELS[k],
      date: e.dateStr,
      host: e.host,
      address: e.address,
      parking: e.parking || undefined,
    });
  }
  return schedule;
}

async function getCurrentRsvps() {
  const rows = await fetchTab("This month");
  const isBool = (v) => v === "TRUE" || v === "FALSE";
  const rsvps = [];
  for (const row of rows) {
    const name = clean(row[0]);
    const a = clean(row[1]);
    const b = clean(row[2]);
    const c = clean(row[3]);
    if (!name) continue;
    if (isBool(a) && isBool(b) && isBool(c)) {
      rsvps.push({
        name,
        dinner: a === "TRUE",
        hcOnly: b === "TRUE",
        cantJoin: c === "TRUE",
        notes: clean(row[4]),
      });
    }
  }
  return rsvps;
}

// ========== DB ==========

async function getMemberInfo(query) {
  const rows = await fetchTab("DB");
  const q = (query || "").toLowerCase().trim();
  if (!q) return [];
  const matches = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const name = clean(row[1]);
    if (!name) continue;
    if (name.toLowerCase().includes(q)) {
      matches.push({
        name,
        phone: clean(row[2]),
        address: clean(row[3]),
        email: clean(row[4]),
        parking: clean(row[5]),
        hcRole: clean(row[6]),
        lhMinistry: clean(row[7]),
        birthday: clean(row[8]),
        favoriteCake: clean(row[9]),
        shapeGifts: [row[10], row[11], row[12]]
          .map(clean)
          .filter(Boolean)
          .join(", "),
        loveLanguage: clean(row[13]),
        bloodType: clean(row[20]),
        dietary: clean(row[21]),
      });
    }
  }
  return matches;
}

function parseBirthday(str) {
  const s = clean(str);
  if (!s) return null;
  const parts = s.split("/").map((p) => p.trim());
  if (parts.length < 2) return null;
  const month = parseInt(parts[0], 10);
  const day = parseInt(parts[1], 10);
  if (!month || !day || month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }
  return { month, day };
}

async function listBirthdays({ days, month } = {}) {
  const rows = await fetchTab("DB");
  const entries = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const name = clean(row[1]);
    const bday = parseBirthday(row[8]);
    if (!name || !bday) continue;
    entries.push({ name, month: bday.month, day: bday.day });
  }

  if (month) {
    return entries
      .filter((e) => e.month === month)
      .sort((a, b) => a.day - b.day)
      .map((e) => ({ name: e.name, date: `${e.month}/${e.day}` }));
  }

  if (days) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const y = today.getFullYear();
    const cutoff = new Date(today);
    cutoff.setDate(today.getDate() + days);
    return entries
      .map((e) => {
        let d = new Date(y, e.month - 1, e.day);
        if (d < today) d = new Date(y + 1, e.month - 1, e.day);
        return { ...e, nextOccurrence: d };
      })
      .filter((e) => e.nextOccurrence <= cutoff)
      .sort((a, b) => a.nextOccurrence - b.nextOccurrence)
      .map((e) => ({
        name: e.name,
        date: `${e.month}/${e.day}`,
        daysAway: Math.round(
          (e.nextOccurrence - today) / (1000 * 60 * 60 * 24)
        ),
      }));
  }

  return entries
    .sort((a, b) => a.month - b.month || a.day - b.day)
    .map((e) => ({ name: e.name, date: `${e.month}/${e.day}` }));
}

// ========== PR ==========
// Column layout: A=Name, B=redundant name, C=latest PR, D,E,F... older weeks.

async function getPrayerRequests({ name } = {}) {
  const rows = await fetchTab("PR");
  const results = [];
  const q = (name || "").toLowerCase().trim();
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const person = clean(row[0]);
    const latest = clean(row[2]);
    if (!person || !latest) continue;
    if (q && !person.toLowerCase().includes(q)) continue;
    results.push({ name: person, latest });
  }
  return results;
}

// ========== History ==========

async function getHostingHistory({ date, host, limit = 10 } = {}) {
  const rows = await fetchTab("History");
  const results = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const d = clean(row[1]);
    const h = clean(row[2]);
    const a = clean(row[3]);
    if (!d || !h) continue;
    if (date && !d.includes(date)) continue;
    if (host && !h.toLowerCase().includes(host.toLowerCase())) continue;
    results.push({ date: d, host: h, address: a });
  }
  return results.slice(-Math.max(1, limit));
}

function invalidateCache(tab) {
  if (tab) cache.delete(tab);
  else cache.clear();
}

module.exports = {
  SHEET_ID,
  getHostingSchedule,
  getCurrentRsvps,
  getMemberInfo,
  listBirthdays,
  getPrayerRequests,
  getHostingHistory,
  invalidateCache,
  _fetchTab: fetchTab,
};
