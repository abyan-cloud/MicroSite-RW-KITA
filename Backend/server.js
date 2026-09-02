import "dotenv/config";
import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import passport from "passport";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Strategy as FacebookStrategy } from "passport-facebook";
import { createUser, findOAuthUser, findUserByEmail, findUserByEmailOrNik, findUserById, initializeUserStore, userStoreStatus } from "./user-store.js";
import { createAspiration, createResident, createServiceRequest, getPortalData, saveProfile, updateAspiration } from "./portal-store.js";

const app = express();
const port = process.env.PORT || 5000;
const secret = process.env.JWT_SECRET || "ganti-secret-produksi-anda";
const frontendUrl = (process.env.FRONTEND_URL || "http://localhost:3000").replace(/\/$/, "");
const weakJwtSecret = !process.env.JWT_SECRET || /^(ganti|change|secret)/i.test(process.env.JWT_SECRET);
if (process.env.NODE_ENV === "production" && weakJwtSecret) throw new Error("JWT_SECRET wajib diisi dengan nilai acak yang kuat pada production.");
if (weakJwtSecret) console.warn("[Security] JWT_SECRET masih menggunakan nilai contoh. Ganti sebelum deployment.");
app.use(cors({ origin: frontendUrl }));
app.use(express.json());
app.use(passport.initialize());
const sign = (user, remember = false) => jwt.sign({ id: user.id, role: user.role, fullName: user.full_name }, secret, { expiresIn: remember ? "30d" : "12h" });
function authenticate(req, res, next) {
  const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ message: "Sesi login tidak ditemukan." });
  try { req.auth = jwt.verify(token, secret); return next(); }
  catch { return res.status(401).json({ message: "Sesi login sudah tidak valid. Silakan masuk kembali." }); }
}
function requireAdmin(req, res, next) {
  if (req.auth?.role !== "PENGURUS") return res.status(403).json({ message: "Fitur ini hanya dapat digunakan pengurus." });
  return next();
}
const socialRedirect = (token) => frontendUrl + "/oauth/callback?token=" + encodeURIComponent(token);
const backendUrl = (process.env.BACKEND_URL || "http://localhost:" + port).replace(/\/$/, "");
const googleCallbackUrl = backendUrl + "/api/auth/google/callback";
const facebookCallbackUrl = backendUrl + "/api/auth/facebook/callback";
const hasGoogleCredentials = Boolean(process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim());
const hasFacebookCredentials = Boolean(process.env.FACEBOOK_APP_ID?.trim() && process.env.FACEBOOK_APP_SECRET?.trim());
function logOAuthError(provider, stage, error) {
  console.error(`\n[${provider} OAuth] ${stage}`);
  console.error(error?.stack || error);
}
function unavailableOAuth(message, callbackUrl) {
  return (_req, res) => res.status(503).json({ message, callbackUrl });
}
function oauthFailureUrl(provider, code) {
  const params = new URLSearchParams({ error: code, provider });
  return `${frontendUrl}/login?${params.toString()}`;
}
function oauthCookieName(provider) {
  return `rw_kita_oauth_${provider}_state`;
}
function oauthCookieOptions(provider) {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: backendUrl.startsWith("https://"),
    path: `/api/auth/${provider}`,
  };
}
function beginOAuth(provider, strategy, scope, authorizationOptions = {}) {
  return (req, res, next) => {
    try {
      const state = randomBytes(32).toString("base64url");
      res.cookie(oauthCookieName(provider), state, { ...oauthCookieOptions(provider), maxAge: 10 * 60 * 1000 });
      console.log(`[${provider} OAuth] memulai otorisasi. callback:`, provider === "google" ? googleCallbackUrl : facebookCallbackUrl);
      return passport.authenticate(strategy, { scope, session: false, state, ...authorizationOptions })(req, res, next);
    } catch (error) {
      logOAuthError(provider, "gagal memulai otorisasi", error);
      return res.redirect(oauthFailureUrl(provider, "oauth_start_failed"));
    }
  };
}
function verifyOAuthState(provider) {
  return (req, res, next) => {
    const cookieName = oauthCookieName(provider);
    const cookieState = String(req.headers.cookie || "").split(";").map((item) => item.trim()).find((item) => item.startsWith(cookieName + "="))?.slice(cookieName.length + 1) || "";
    const returnedState = String(req.query?.state || "");
    res.clearCookie(cookieName, oauthCookieOptions(provider));
    const validLength = cookieState.length > 0 && cookieState.length === returnedState.length;
    const validState = validLength && timingSafeEqual(Buffer.from(cookieState), Buffer.from(returnedState));
    if (!validState) {
      console.error(`[${provider} OAuth] state tidak valid atau cookie sudah kedaluwarsa.`);
      return res.redirect(oauthFailureUrl(provider, "oauth_state_invalid"));
    }
    return next();
  };
}
async function getOrCreateOAuthUser(provider, profile) {
  const email = profile.emails?.[0]?.value?.toLowerCase() || provider + "-" + profile.id + "@rwkita.local";
  let user = await findOAuthUser(provider, profile.id, email);
  if (!user) {
    const fullName = profile.displayName || "Warga RW KITA";
    const passwordHash = await bcrypt.hash(provider + ":" + profile.id + ":" + Date.now(), 12);
    user = await createUser({ full_name: fullName, nik: "oauth-" + provider + "-" + profile.id, email, phone: "Belum diisi", role: "WARGA", password_hash: passwordHash, oauth_provider: provider, oauth_id: profile.id });
  }
  return user;
}
if (hasGoogleCredentials) {
  try {
    passport.use("google", new GoogleStrategy({ clientID: process.env.GOOGLE_CLIENT_ID.trim(), clientSecret: process.env.GOOGLE_CLIENT_SECRET.trim(), callbackURL: googleCallbackUrl }, (_accessToken, _refreshToken, profile, done) => {
      getOrCreateOAuthUser("google", profile).then((user) => done(null, user)).catch((error) => { logOAuthError("Google", "gagal membuat atau mengambil pengguna", error); done(error); });
    }));
    app.get("/api/auth/google", beginOAuth("google", "google", ["profile", "email"], { prompt: "select_account" }));
    app.get("/api/auth/google/callback", verifyOAuthState("google"), (req, res, next) => {
      passport.authenticate("google", { session: false }, (error, user, info) => {
        if (error) { logOAuthError("Google", "callback gagal", error); return res.redirect(oauthFailureUrl("google", "oauth_callback_failed")); }
        if (!user) {
          console.error("[Google OAuth] Google tidak mengembalikan user:", info);
          return res.redirect(oauthFailureUrl("google", "oauth_cancelled"));
        }
        try { return res.redirect(socialRedirect(sign(user))); }
        catch (signError) { logOAuthError("Google", "gagal membuat sesi", signError); return res.redirect(oauthFailureUrl("google", "oauth_session_failed")); }
      })(req, res, next);
    });
    console.log("[Google OAuth] strategy aktif. Callback URI:", googleCallbackUrl);
  } catch (error) {
    logOAuthError("Google", "strategy tidak dapat diinisialisasi", error);
    app.get("/api/auth/google", unavailableOAuth("Google OAuth gagal diinisialisasi. Periksa terminal backend.", googleCallbackUrl));
  }
} else {
  console.warn("[Google OAuth] GOOGLE_CLIENT_ID atau GOOGLE_CLIENT_SECRET kosong. OAuth dinonaktifkan.");
  app.get("/api/auth/google", unavailableOAuth("Google OAuth belum dikonfigurasi di Backend/.env.", googleCallbackUrl));
}
if (hasFacebookCredentials) {
  try {
    passport.use("facebook", new FacebookStrategy({ clientID: process.env.FACEBOOK_APP_ID.trim(), clientSecret: process.env.FACEBOOK_APP_SECRET.trim(), callbackURL: facebookCallbackUrl, profileFields: ["id", "displayName", "emails"], enableProof: true }, (_accessToken, _refreshToken, profile, done) => {
      getOrCreateOAuthUser("facebook", profile).then((user) => done(null, user)).catch((error) => { logOAuthError("Facebook", "gagal membuat atau mengambil pengguna", error); done(error); });
    }));
    app.get("/api/auth/facebook", beginOAuth("facebook", "facebook", ["email"]));
    app.get("/api/auth/facebook/callback", verifyOAuthState("facebook"), (req, res, next) => {
      passport.authenticate("facebook", { session: false }, (error, user, info) => {
        if (error) { logOAuthError("Facebook", "callback gagal", error); return res.redirect(oauthFailureUrl("facebook", "oauth_callback_failed")); }
        if (!user) {
          console.error("[Facebook OAuth] Facebook tidak mengembalikan user:", info);
          return res.redirect(oauthFailureUrl("facebook", "oauth_cancelled"));
        }
        try { return res.redirect(socialRedirect(sign(user))); }
        catch (signError) { logOAuthError("Facebook", "gagal membuat sesi", signError); return res.redirect(oauthFailureUrl("facebook", "oauth_session_failed")); }
      })(req, res, next);
    });
    console.log("[Facebook OAuth] strategy aktif. Callback URI:", facebookCallbackUrl);
  } catch (error) {
    logOAuthError("Facebook", "strategy tidak dapat diinisialisasi", error);
    app.get("/api/auth/facebook", unavailableOAuth("Facebook OAuth gagal diinisialisasi. Periksa terminal backend.", facebookCallbackUrl));
  }
} else {
  console.warn("[Facebook OAuth] FACEBOOK_APP_ID atau FACEBOOK_APP_SECRET kosong. OAuth dinonaktifkan.");
  app.get("/api/auth/facebook", unavailableOAuth("Facebook OAuth belum dikonfigurasi di Backend/.env.", facebookCallbackUrl));
}

app.get("/api/auth/providers", (_req, res) => res.json({ google: hasGoogleCredentials, facebook: hasFacebookCredentials, callbackUrls: { google: googleCallbackUrl, facebook: facebookCallbackUrl } }));

app.get("/api/health", (_req, res) => {
  const status = userStoreStatus();
  return res.status(status.connected ? 200 : 503).json({ api: "ok", database: status.connected ? "connected" : "disconnected", mode: status.mode, mysql: status.mysql });
});

app.post("/api/auth/register", async (req, res, next) => {
  try {
    const fullName = String(req.body?.fullName || "").trim();
    const nik = String(req.body?.nik || "").trim();
    const email = String(req.body?.email || "").trim().toLowerCase();
    const phone = String(req.body?.phone || "").trim();
    const password = String(req.body?.password || "");
    const agreed = req.body?.agreed === true;
    const role = req.body?.role === "PENGURUS" ? "PENGURUS" : "WARGA";
    const pengurusCode = String(req.body?.pengurusCode || "");

    if (!fullName || !nik || !email || !phone || !password || !agreed) return res.status(400).json({ message: "Lengkapi semua data dan setujui syarat." });
    if (fullName.length < 3 || fullName.length > 150) return res.status(400).json({ message: "Nama lengkap harus terdiri dari 3 sampai 150 karakter." });
    if (!/^\d{16}$/.test(nik)) return res.status(400).json({ message: "NIK harus terdiri dari 16 digit." });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ message: "Format alamat email belum valid." });
    if (!/^(?:\+62|62|0)8\d{7,12}$/.test(phone.replace(/[\s-]/g, ""))) return res.status(400).json({ message: "Nomor WhatsApp belum valid." });
    if (password.length < 8 || password.length > 72) return res.status(400).json({ message: "Kata sandi harus terdiri dari 8 sampai 72 karakter." });
    if (role === "PENGURUS") {
      const configuredCode = process.env.PENGURUS_REGISTRATION_CODE?.trim();
      if (!configuredCode) return res.status(503).json({ message: "Pendaftaran Pengurus belum dikonfigurasi oleh admin." });
      if (pengurusCode !== configuredCode) return res.status(403).json({ message: "Kode pendaftaran Pengurus tidak sesuai." });
    }

    if (await findUserByEmailOrNik(email, nik)) return res.status(409).json({ message: "Email atau NIK sudah terdaftar." });
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await createUser({ full_name: fullName, nik, email, phone, role, password_hash: passwordHash });
    return res.status(201).json({ message: "Pendaftaran berhasil.", token: sign(user), user: { fullName: user.full_name, role: user.role } });
  } catch (error) {
    console.error("\n[REGISTER ERROR]");
    console.error(error?.stack || error);
    if (error?.code === "ER_DUP_ENTRY") return res.status(409).json({ message: "Email atau NIK sudah terdaftar." });
    if (["ECONNREFUSED", "ETIMEDOUT", "PROTOCOL_CONNECTION_LOST", "ER_ACCESS_DENIED_ERROR", "ER_BAD_DB_ERROR"].includes(error?.code)) {
      return res.status(503).json({ message: "Database MySQL belum dapat dihubungi. Aktifkan MySQL dan periksa konfigurasi Backend/.env." });
    }
    return next(error);
  }
});
app.post("/api/auth/login", async (req, res, next) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");
    const role = req.body?.role === "PENGURUS" ? "PENGURUS" : "WARGA";
    if (!email || !password) return res.status(400).json({ message: "Masukkan email dan kata sandi." });
    const user = await findUserByEmail(email);
    if (!user || user.role !== role || !(await bcrypt.compare(password, user.password_hash))) return res.status(401).json({ message: "Email, kata sandi, atau peran tidak sesuai." });
    return res.json({ message: "Berhasil masuk.", token: sign(user, req.body?.remember === true), user: { fullName: user.full_name, role: user.role } });
  } catch (error) {
    return next(error);
  }
});

app.get("/api/portal/bootstrap", authenticate, async (req, res, next) => {
  try {
    const data = await getPortalData(req.auth);
    if (!data) return res.status(404).json({ message: "Akun tidak ditemukan." });
    return res.json(data);
  } catch (error) { return next(error); }
});

app.put("/api/portal/profile", authenticate, async (req, res, next) => {
  try {
    const fullName = String(req.body?.fullName || "").trim();
    const phone = String(req.body?.phone || "").trim();
    const address = String(req.body?.address || "").trim();
    const rtNumber = String(req.body?.rtNumber || "").trim();
    const bio = String(req.body?.bio || "").trim();
    if (fullName.length < 3 || !/^(?:\+62|62|0)8\d{7,12}$/.test(phone.replace(/[\s-]/g, ""))) return res.status(400).json({ message: "Nama atau nomor WhatsApp belum valid." });
    if (rtNumber && !/^\d{1,2}$/.test(rtNumber)) return res.status(400).json({ message: "Nomor RT harus berupa 1-2 digit." });
    const profile = await saveProfile(req.auth.id, { fullName, phone, address, rtNumber: rtNumber.padStart(2, "0"), bio });
    return res.json({ message: "Profil berhasil disimpan.", profile });
  } catch (error) { return next(error); }
});

app.post("/api/portal/aspirations", authenticate, async (req, res, next) => {
  try {
    const user = await findUserById(req.auth.id);
    const title = String(req.body?.title || "").trim();
    const category = ["LINGKUNGAN","KEAMANAN","INFRASTRUKTUR","SOSIAL","LAINNYA"].includes(req.body?.category) ? req.body.category : "LAINNYA";
    const description = String(req.body?.description || "").trim();
    if (!user || title.length < 5 || description.length < 10) return res.status(400).json({ message: "Judul minimal 5 karakter dan isi aspirasi minimal 10 karakter." });
    const aspiration = await createAspiration(user, { title, category, description });
    return res.status(201).json({ message: "Aspirasi berhasil dikirim.", aspiration });
  } catch (error) { return next(error); }
});

app.patch("/api/portal/aspirations/:id", authenticate, requireAdmin, async (req, res, next) => {
  try {
    const status = ["MENUNGGU","DIPROSES","SELESAI","DITOLAK"].includes(req.body?.status) ? req.body.status : "DIPROSES";
    const aspiration = await updateAspiration(req.params.id, { status, adminResponse: String(req.body?.adminResponse || "").trim() });
    if (!aspiration) return res.status(404).json({ message: "Aspirasi tidak ditemukan." });
    return res.json({ message: "Status aspirasi diperbarui.", aspiration });
  } catch (error) { return next(error); }
});

app.post("/api/portal/services", authenticate, async (req, res, next) => {
  try {
    const user = await findUserById(req.auth.id);
    const serviceType = String(req.body?.serviceType || "").trim();
    const notes = String(req.body?.notes || "").trim();
    if (!user || serviceType.length < 3) return res.status(400).json({ message: "Pilih jenis layanan." });
    const service = await createServiceRequest(user, { serviceType, notes });
    return res.status(201).json({ message: "Permohonan layanan berhasil dibuat.", service });
  } catch (error) { return next(error); }
});

app.post("/api/portal/residents", authenticate, requireAdmin, async (req, res, next) => {
  try {
    const fullName = String(req.body?.fullName || "").trim();
    const nik = String(req.body?.nik || "").trim();
    const phone = String(req.body?.phone || "").trim();
    const address = String(req.body?.address || "").trim();
    const rtNumber = String(req.body?.rtNumber || "").trim().padStart(2, "0");
    if (fullName.length < 3 || !/^\d{16}$/.test(nik) || !/^\d{2}$/.test(rtNumber)) return res.status(400).json({ message: "Nama, NIK 16 digit, dan nomor RT wajib valid." });
    const resident = await createResident({ fullName, nik, phone, address, rtNumber });
    return res.status(201).json({ message: "Data warga berhasil ditambahkan.", resident });
  } catch (error) {
    if (error?.code === "ER_DUP_ENTRY") return res.status(409).json({ message: "NIK warga sudah terdaftar." });
    return next(error);
  }
});
app.use("/api", (_req, res) => res.status(404).json({ message: "Endpoint API tidak ditemukan." }));
app.use((error, _req, res, _next) => {
  console.error("\n[API ERROR]");
  console.error(error?.stack || error);
  if (error instanceof SyntaxError && "body" in error) return res.status(400).json({ message: "Format JSON pada request tidak valid." });
  res.status(500).json({ message: "Terjadi kesalahan pada server. Lihat terminal backend untuk detail error." });
});
const server = app.listen(port);
server.on("listening", () => console.log("RW KITA API berjalan di http://localhost:" + port));
server.on("error", (error) => {
  if (error?.code === "EADDRINUSE") {
    console.error(`[Backend] Port ${port} sedang dipakai proses lain. Hentikan terminal backend lama, lalu jalankan npm run dev kembali.`);
  } else {
    console.error("[Backend] Server gagal dijalankan.");
    console.error(error?.stack || error);
  }
  process.exitCode = 1;
});
initializeUserStore().catch((error) => {
  if (error?.code === "ECONNREFUSED") {
    console.error(`[MySQL] Server tidak aktif di ${process.env.DB_HOST || "127.0.0.1"}:${process.env.DB_PORT || 3306}. Aktifkan MySQL Server terlebih dahulu.`);
  } else if (error?.code === "ER_ACCESS_DENIED_ERROR") {
    console.error("[MySQL] Username atau password ditolak. Periksa DB_USER dan DB_PASSWORD di Backend/.env.");
  } else if (error?.code === "ER_BAD_DB_ERROR") {
    console.error("[MySQL] Database tidak dapat dibuka. Periksa DB_NAME dan hak akses pengguna MySQL.");
  } else {
    console.error("[MySQL] Gagal menginisialisasi database.");
    console.error(error?.stack || error);
  }
  console.error("[MySQL] API tetap aktif dan akan mencoba lagi saat register/login dilakukan.");
});
