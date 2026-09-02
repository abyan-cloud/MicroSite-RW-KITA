import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { query } from "./db.js";
import { findUserById, updateUserContact, userStoreStatus } from "./user-store.js";

const portalFile = path.join(path.dirname(fileURLToPath(import.meta.url)), "data", "portal.json");
const initialResidents = [
  { id: 1, full_name: "Bambang Susilo", nik: "3175090101010001", phone: "081211110001", address: "Blok A2 No. 14", rt_number: "01", status: "AKTIF", created_at: "2024-01-12T00:00:00.000Z" },
  { id: 2, full_name: "Ratna Permata", nik: "3175090101010002", phone: "081211110002", address: "Blok C5 No. 09", rt_number: "02", status: "AKTIF", created_at: "2024-01-15T00:00:00.000Z" },
  { id: 3, full_name: "Dedi Kusnadi", nik: "3175090101010003", phone: "081211110003", address: "Blok B1 No. 02", rt_number: "03", status: "MENUNGGU", created_at: "2024-01-20T00:00:00.000Z" },
];
let localData;
let writeQueue = Promise.resolve();

async function ensureLocalData() {
  if (localData) return localData;
  await fs.mkdir(path.dirname(portalFile), { recursive: true });
  try {
    localData = JSON.parse(await fs.readFile(portalFile, "utf8"));
  } catch {
    localData = { profiles: {}, aspirations: [], services: [], residents: initialResidents };
    await persist();
  }
  return localData;
}

async function persist() {
  const content = JSON.stringify(localData, null, 2) + "\n";
  writeQueue = writeQueue.then(() => fs.writeFile(portalFile, content, "utf8"));
  await writeQueue;
}

function usesMySql() {
  return userStoreStatus().mode === "mysql";
}

export async function getPortalData(authUser) {
  const user = await findUserById(authUser.id);
  if (!user) return null;
  if (usesMySql()) {
    const profiles = await query("SELECT address, rt_number, bio FROM user_profiles WHERE user_id = ? LIMIT 1", [user.id]);
    const aspirations = user.role === "PENGURUS"
      ? await query("SELECT a.*, u.full_name FROM aspirations a JOIN users u ON u.id = a.user_id ORDER BY a.created_at DESC")
      : await query("SELECT a.*, u.full_name FROM aspirations a JOIN users u ON u.id = a.user_id WHERE a.user_id = ? ORDER BY a.created_at DESC", [user.id]);
    const services = user.role === "PENGURUS"
      ? await query("SELECT s.*, u.full_name FROM service_requests s JOIN users u ON u.id = s.user_id ORDER BY s.created_at DESC")
      : await query("SELECT s.*, u.full_name FROM service_requests s JOIN users u ON u.id = s.user_id WHERE s.user_id = ? ORDER BY s.created_at DESC", [user.id]);
    const residents = user.role === "PENGURUS" ? await query("SELECT * FROM residents ORDER BY created_at DESC") : [];
    return { user: publicUser(user), profile: { fullName: user.full_name, phone: user.phone, address: profiles[0]?.address || "", rtNumber: profiles[0]?.rt_number || "", bio: profiles[0]?.bio || "" }, aspirations, services, residents };
  }

  const data = await ensureLocalData();
  const profile = data.profiles[user.id] || {};
  const aspirations = user.role === "PENGURUS" ? data.aspirations : data.aspirations.filter((item) => Number(item.user_id) === Number(user.id));
  const services = user.role === "PENGURUS" ? data.services : data.services.filter((item) => Number(item.user_id) === Number(user.id));
  return { user: publicUser(user), profile: { fullName: user.full_name, phone: user.phone, address: profile.address || "", rtNumber: profile.rtNumber || "", bio: profile.bio || "" }, aspirations: [...aspirations].reverse(), services: [...services].reverse(), residents: user.role === "PENGURUS" ? [...data.residents].reverse() : [] };
}

function publicUser(user) {
  return { id: user.id, fullName: user.full_name, email: user.email, phone: user.phone, role: user.role };
}

export async function saveProfile(userId, input) {
  const user = await updateUserContact(userId, { full_name: input.fullName, phone: input.phone });
  if (!user) return null;
  if (usesMySql()) {
    await query("INSERT INTO user_profiles (user_id, address, rt_number, bio) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE address = VALUES(address), rt_number = VALUES(rt_number), bio = VALUES(bio)", [userId, input.address, input.rtNumber, input.bio]);
  } else {
    const data = await ensureLocalData();
    data.profiles[userId] = { address: input.address, rtNumber: input.rtNumber, bio: input.bio };
    await persist();
  }
  return { fullName: user.full_name, phone: user.phone, address: input.address, rtNumber: input.rtNumber, bio: input.bio };
}

export async function createAspiration(user, input) {
  if (usesMySql()) {
    const info = await query("INSERT INTO aspirations (user_id, title, category, description) VALUES (?, ?, ?, ?)", [user.id, input.title, input.category, input.description]);
    return (await query("SELECT a.*, u.full_name FROM aspirations a JOIN users u ON u.id = a.user_id WHERE a.id = ?", [info.insertId]))[0];
  }
  const data = await ensureLocalData();
  const item = { id: nextId(data.aspirations), user_id: user.id, full_name: user.full_name, title: input.title, category: input.category, description: input.description, status: "MENUNGGU", admin_response: "", created_at: new Date().toISOString() };
  data.aspirations.push(item);
  await persist();
  return item;
}

export async function updateAspiration(id, input) {
  if (usesMySql()) {
    await query("UPDATE aspirations SET status = ?, admin_response = ? WHERE id = ?", [input.status, input.adminResponse, id]);
    return (await query("SELECT * FROM aspirations WHERE id = ?", [id]))[0] || null;
  }
  const data = await ensureLocalData();
  const item = data.aspirations.find((entry) => Number(entry.id) === Number(id));
  if (!item) return null;
  item.status = input.status;
  item.admin_response = input.adminResponse;
  item.updated_at = new Date().toISOString();
  await persist();
  return item;
}

export async function createServiceRequest(user, input) {
  const trackingCode = "SR-" + new Date().getFullYear() + "-" + String(Date.now()).slice(-6);
  if (usesMySql()) {
    const info = await query("INSERT INTO service_requests (user_id, service_type, tracking_code, notes) VALUES (?, ?, ?, ?)", [user.id, input.serviceType, trackingCode, input.notes]);
    return (await query("SELECT * FROM service_requests WHERE id = ?", [info.insertId]))[0];
  }
  const data = await ensureLocalData();
  const item = { id: nextId(data.services), user_id: user.id, full_name: user.full_name, service_type: input.serviceType, tracking_code: trackingCode, notes: input.notes, status: "MENUNGGU", created_at: new Date().toISOString() };
  data.services.push(item);
  await persist();
  return item;
}

export async function createResident(input) {
  if (usesMySql()) {
    const info = await query("INSERT INTO residents (full_name, nik, phone, address, rt_number, status) VALUES (?, ?, ?, ?, ?, ?)", [input.fullName, input.nik, input.phone, input.address, input.rtNumber, "AKTIF"]);
    return (await query("SELECT * FROM residents WHERE id = ?", [info.insertId]))[0];
  }
  const data = await ensureLocalData();
  if (data.residents.some((resident) => resident.nik === input.nik)) { const error = new Error("NIK warga sudah terdaftar."); error.code = "ER_DUP_ENTRY"; throw error; }
  const item = { id: nextId(data.residents), full_name: input.fullName, nik: input.nik, phone: input.phone, address: input.address, rt_number: input.rtNumber, status: "AKTIF", created_at: new Date().toISOString() };
  data.residents.push(item);
  await persist();
  return item;
}

function nextId(items) {
  return items.reduce((highest, item) => Math.max(highest, Number(item.id) || 0), 0) + 1;
}
