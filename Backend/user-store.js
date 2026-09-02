import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { databaseReady, initializeDatabase, query } from "./db.js";

const dataDirectory = path.join(path.dirname(fileURLToPath(import.meta.url)), "data");
const dataFile = path.join(dataDirectory, "users.json");
const allowLocalFallback = process.env.DB_FALLBACK !== "disabled";
let mode = "starting";
let localUsers = [];
let localWriteQueue = Promise.resolve();

async function initializeLocalStore() {
  await fs.mkdir(dataDirectory, { recursive: true });
  try {
    const content = await fs.readFile(dataFile, "utf8");
    const parsed = JSON.parse(content);
    localUsers = Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if (error?.code !== "ENOENT") console.warn("[Database lokal] File lama tidak dapat dibaca dan akan dibuat ulang.");
    localUsers = [];
    await fs.writeFile(dataFile, "[]\n", "utf8");
  }
  mode = "local";
  console.warn("[Database] MySQL belum tersedia. Menggunakan database lokal persisten Backend/data/users.json.");
  return mode;
}

export async function initializeUserStore() {
  if (mode === "mysql" || mode === "local") return mode;
  try {
    await initializeDatabase();
    mode = "mysql";
    return mode;
  } catch (error) {
    if (!allowLocalFallback) throw error;
    return initializeLocalStore();
  }
}

async function ensureStore() {
  if (mode === "starting") await initializeUserStore();
}

function normalizeUser(input) {
  return {
    id: input.id,
    full_name: input.full_name,
    nik: input.nik,
    email: input.email,
    phone: input.phone,
    role: input.role,
    password_hash: input.password_hash,
    oauth_provider: input.oauth_provider || null,
    oauth_id: input.oauth_id || null,
    created_at: input.created_at || new Date().toISOString(),
  };
}

async function persistLocalUsers() {
  const snapshot = JSON.stringify(localUsers, null, 2) + "\n";
  localWriteQueue = localWriteQueue.then(() => fs.writeFile(dataFile, snapshot, "utf8"));
  await localWriteQueue;
}

export async function findUserByEmail(email) {
  await ensureStore();
  if (mode === "mysql") return (await query("SELECT * FROM users WHERE email = ? LIMIT 1", [email]))[0] || null;
  return localUsers.find((user) => user.email === email) || null;
}

export async function findUserByEmailOrNik(email, nik) {
  await ensureStore();
  if (mode === "mysql") return (await query("SELECT * FROM users WHERE email = ? OR nik = ? LIMIT 1", [email, nik]))[0] || null;
  return localUsers.find((user) => user.email === email || user.nik === nik) || null;
}

export async function findUserById(id) {
  await ensureStore();
  if (mode === "mysql") return (await query("SELECT * FROM users WHERE id = ? LIMIT 1", [id]))[0] || null;
  return localUsers.find((user) => Number(user.id) === Number(id)) || null;
}

export async function findOAuthUser(provider, oauthId, email) {
  await ensureStore();
  if (mode === "mysql") return (await query("SELECT * FROM users WHERE email = ? OR (oauth_provider = ? AND oauth_id = ?) LIMIT 1", [email, provider, oauthId]))[0] || null;
  return localUsers.find((user) => user.email === email || (user.oauth_provider === provider && user.oauth_id === oauthId)) || null;
}

export async function createUser(input) {
  await ensureStore();
  if (mode === "mysql") {
    const info = await query("INSERT INTO users (full_name, nik, email, phone, role, password_hash, oauth_provider, oauth_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", [input.full_name, input.nik, input.email, input.phone, input.role, input.password_hash, input.oauth_provider || null, input.oauth_id || null]);
    return findUserById(info.insertId);
  }

  if (localUsers.some((user) => user.email === input.email || user.nik === input.nik)) {
    const duplicate = new Error("Email atau NIK sudah terdaftar.");
    duplicate.code = "ER_DUP_ENTRY";
    throw duplicate;
  }
  const nextId = localUsers.reduce((highest, user) => Math.max(highest, Number(user.id) || 0), 0) + 1;
  const user = normalizeUser({ ...input, id: nextId });
  localUsers.push(user);
  await persistLocalUsers();
  return user;
}

export async function updateUserContact(id, input) {
  await ensureStore();
  if (mode === "mysql") {
    await query("UPDATE users SET full_name = ?, phone = ? WHERE id = ?", [input.full_name, input.phone, id]);
    return findUserById(id);
  }
  const user = localUsers.find((item) => Number(item.id) === Number(id));
  if (!user) return null;
  user.full_name = input.full_name;
  user.phone = input.phone;
  await persistLocalUsers();
  return user;
}

export function userStoreStatus() {
  return { connected: mode === "mysql" || mode === "local", mode, mysql: databaseReady() };
}
