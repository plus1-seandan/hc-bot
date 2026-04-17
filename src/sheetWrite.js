"use strict";

const fs = require("node:fs");
const { google } = require("googleapis");
const sheet = require("./sheet");

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];
const TAB = "This month";

let _sheetsClient = null;

function loadCredentials() {
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    try {
      return JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
    } catch (err) {
      throw new Error(
        "GOOGLE_SERVICE_ACCOUNT_JSON is set but not valid JSON: " + err.message
      );
    }
  }
  const path =
    process.env.GOOGLE_SERVICE_ACCOUNT_FILE ||
    `${process.cwd()}/gcp-key.json`;
  if (!fs.existsSync(path)) {
    throw new Error(
      `No Google service account credentials found. Set GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_SERVICE_ACCOUNT_FILE, or place the key at ${path}`
    );
  }
  return JSON.parse(fs.readFileSync(path, "utf8"));
}

function getSheetsClient() {
  if (_sheetsClient) return _sheetsClient;
  const credentials = loadCredentials();
  const auth = new google.auth.GoogleAuth({ credentials, scopes: SCOPES });
  _sheetsClient = google.sheets({ version: "v4", auth });
  return _sheetsClient;
}

function normalize(s) {
  return (s || "").toLowerCase().replace(/\s+/g, " ").trim();
}

// Find the row (1-indexed, sheet-style) in the RSVP section whose col A
// matches `name`. Only considers rows where cols B/C/D already hold TRUE/FALSE
// (that's how we distinguish RSVP rows from hosting-schedule rows).
async function findRsvpRow(nameQuery) {
  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheet.SHEET_ID,
    range: `${TAB}!A1:E200`,
  });
  const rows = res.data.values || [];
  const q = normalize(nameQuery);

  const candidates = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] || [];
    const a = (row[0] || "").trim();
    const b = (row[1] || "").trim();
    const c = (row[2] || "").trim();
    const d = (row[3] || "").trim();
    const isBool = (v) => v === "TRUE" || v === "FALSE";
    if (!a || !isBool(b) || !isBool(c) || !isBool(d)) continue;
    const n = normalize(a);
    if (n === q) {
      return { sheetRow: i + 1, name: a, exact: true };
    }
    if (n.includes(q) || q.includes(n)) {
      candidates.push({ sheetRow: i + 1, name: a });
    }
  }
  if (candidates.length === 1) return { ...candidates[0], exact: false };
  if (candidates.length > 1) {
    const err = new Error(
      `Multiple RSVP rows match "${nameQuery}": ${candidates
        .map((c) => c.name)
        .join(", ")}. Please be more specific.`
    );
    err.candidates = candidates.map((c) => c.name);
    throw err;
  }
  const err = new Error(
    `No RSVP row found for "${nameQuery}". The RSVP list on the "This month" tab doesn't have that person.`
  );
  err.notFound = true;
  throw err;
}

function statusToBooleans(status) {
  switch (status) {
    case "dinner":
      return [true, false, false];
    case "hc_only":
      return [false, true, false];
    case "cant_join":
      return [false, false, true];
    case "clear":
      return [false, false, false];
    default:
      throw new Error(
        `Unknown status "${status}". Expected dinner | hc_only | cant_join | clear.`
      );
  }
}

async function markAttending({ name, status, notes }) {
  const [dinner, hcOnly, cantJoin] = statusToBooleans(status);
  const match = await findRsvpRow(name);
  const sheets = getSheetsClient();

  const values = [[dinner, hcOnly, cantJoin]];
  await sheets.spreadsheets.values.update({
    spreadsheetId: sheet.SHEET_ID,
    range: `${TAB}!B${match.sheetRow}:D${match.sheetRow}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values },
  });

  if (typeof notes === "string") {
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheet.SHEET_ID,
      range: `${TAB}!E${match.sheetRow}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [[notes]] },
    });
  }

  sheet.invalidateCache(TAB);

  return {
    ok: true,
    name: match.name,
    status,
    matchedExactly: match.exact,
    notesUpdated: typeof notes === "string",
  };
}

module.exports = {
  markAttending,
  findRsvpRow,
  _getSheetsClient: getSheetsClient,
};
