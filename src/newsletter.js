"use strict";

const sheet = require("./sheet");
const sheetWrite = require("./sheetWrite");

const TAB = "Newsletter";
const HEADER_ROW = [
  ["Timestamp", "Submitted by (Discord)", "Display name", "Content"],
];

async function ensureTab() {
  const sheets = sheetWrite._getSheetsClient();
  const meta = await sheets.spreadsheets.get({
    spreadsheetId: sheet.SHEET_ID,
  });
  const exists = (meta.data.sheets || []).some(
    (s) => s.properties?.title === TAB
  );
  if (exists) return;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: sheet.SHEET_ID,
    requestBody: {
      requests: [{ addSheet: { properties: { title: TAB } } }],
    },
  });
  await sheets.spreadsheets.values.update({
    spreadsheetId: sheet.SHEET_ID,
    range: `${TAB}!A1:D1`,
    valueInputOption: "RAW",
    requestBody: { values: HEADER_ROW },
  });
  sheet.invalidateCache(TAB);
}

async function saveNewsletter({
  content,
  submittedBy,
  submittedByDisplayName,
} = {}) {
  const text = (content || "").toString().trim();
  if (!text) {
    return { ok: false, error: "Newsletter content is empty." };
  }
  await ensureTab();
  const sheets = sheetWrite._getSheetsClient();
  const timestamp = new Date().toISOString();

  // "Latest only" semantics: overwrite row 2 on each save.
  await sheets.spreadsheets.values.update({
    spreadsheetId: sheet.SHEET_ID,
    range: `${TAB}!A2:D2`,
    valueInputOption: "RAW",
    requestBody: {
      values: [
        [
          timestamp,
          submittedBy || "",
          submittedByDisplayName || "",
          text,
        ],
      ],
    },
  });
  sheet.invalidateCache(TAB);

  return {
    ok: true,
    timestamp,
    submittedBy: submittedBy || null,
    charCount: text.length,
    preview: text.slice(0, 160) + (text.length > 160 ? "..." : ""),
  };
}

async function getLatestNewsletter() {
  let rows;
  try {
    rows = await sheet._fetchTab(TAB);
  } catch (err) {
    return { exists: false, message: "No newsletter has been saved yet." };
  }
  if (!rows || rows.length < 2) {
    return { exists: false, message: "No newsletter has been saved yet." };
  }
  const [timestamp, submittedBy, displayName, content] = rows[1] || [];
  if (!content || !content.toString().trim()) {
    return { exists: false, message: "No newsletter has been saved yet." };
  }
  return {
    exists: true,
    timestamp: (timestamp || "").toString().trim(),
    submittedBy: (submittedBy || "").toString().trim(),
    displayName: (displayName || "").toString().trim(),
    content: content.toString(),
  };
}

module.exports = { ensureTab, saveNewsletter, getLatestNewsletter };
