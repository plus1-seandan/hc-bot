"use strict";

const fs = require("fs");
const path = require("path");

const DEFAULT_PATH = path.join(__dirname, "..", "data", "discord-sheet-names.json");

function mapPath() {
  return process.env.DISCORD_SHEET_MAP_PATH || DEFAULT_PATH;
}

function loadRaw() {
  const p = mapPath();
  if (!fs.existsSync(p)) return {};
  try {
    const data = JSON.parse(fs.readFileSync(p, "utf8"));
    return data && typeof data === "object" ? data : {};
  } catch {
    return {};
  }
}

function saveRaw(obj) {
  const p = mapPath();
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(obj, null, 2), "utf8");
}

function getSheetName(discordUserId) {
  if (!discordUserId) return null;
  const entry = loadRaw()[String(discordUserId)];
  const name = entry?.sheetName;
  if (typeof name !== "string") return null;
  const t = name.trim();
  return t ? t : null;
}

function setSheetName(discordUserId, sheetName) {
  if (!discordUserId) {
    return { ok: false, error: "Missing Discord user id" };
  }
  const t = String(sheetName || "").trim();
  if (!t) {
    return { ok: false, error: "sheet_name is required" };
  }
  const all = loadRaw();
  all[String(discordUserId)] = { sheetName: t };
  saveRaw(all);
  return { ok: true, sheetName: t };
}

module.exports = { getSheetName, setSheetName, mapPath };
