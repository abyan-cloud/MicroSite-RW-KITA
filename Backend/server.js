import "dotenv/config";
import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import db from "./db.js";

const app = express();
const port = process.env.PORT || 5000;
const secret = process.env.JWT_SECRET || "ganti-secret-produksi-anda";
app.use(cors({ origin: process.env.FRONTEND_URL || "http://localhost:3000" }));
app.use(express.json());
const sign = (user) => jwt.sign({ id: user.id, role: user.role, fullName: user.full_name }, secret, { expiresIn: "7d" });

app.post("/api/auth/register", async (req, res) => {
  const { fullName, nik, email, phone, role, password, agreed } = req.body;
  if (!fullName || !nik || !email || !phone || !password || !agreed) return res.status(400).json({ message: "Lengkapi semua data dan setujui syarat." });
  if (!/^\d{16}$/.test(nik)) return res.status(400).json({ message: "NIK harus terdiri dari 16 digit." });
  if (password.length < 8) return res.status(400).json({ message: "Kata sandi minimal 8 karakter." });
  const normalizedEmail = email.toLowerCase();
  if (db.prepare("SELECT id FROM users WHERE email = ? OR nik = ?").get(normalizedEmail, nik)) return res.status(409).json({ message: "Email atau NIK sudah terdaftar." });
  const passwordHash = await bcrypt.hash(password, 12);
  const info = db.prepare("INSERT INTO users (full_name, nik, email, phone, role, password_hash) VALUES (?, ?, ?, ?, ?, ?)").run(fullName, nik, normalizedEmail, phone, role === "PENGURUS" ? "PENGURUS" : "WARGA", passwordHash);
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(info.lastInsertRowid);
  res.status(201).json({ message: "Pendaftaran berhasil.", token: sign(user), user: { fullName: user.full_name, role: user.role } });
});
app.post("/api/auth/login", async (req, res) => {
  const { email, password, role } = req.body;
  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(String(email).toLowerCase());
  if (!user || user.role !== role || !(await bcrypt.compare(password || "", user.password_hash))) return res.status(401).json({ message: "Email, kata sandi, atau peran tidak sesuai." });
  res.json({ message: "Berhasil masuk.", token: sign(user), user: { fullName: user.full_name, role: user.role } });
});
app.listen(port, () => console.log("RW KITA API berjalan di http://localhost:" + port));
