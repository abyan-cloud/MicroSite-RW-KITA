"use client";
import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { Icon } from "./auth-shell";
import { storeSession } from "@/lib/auth-session";
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";
const REQUEST_TIMEOUT_MS = 12_000;

type AuthResponse = {
  message?: string;
  token?: string;
  user?: { fullName: string; role: "WARGA" | "PENGURUS" };
};

async function postAuth(path: string, body: Record<string, unknown>): Promise<AuthResponse> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(API_URL + path, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const rawBody = await response.text();
    let result: AuthResponse = {};

    if (rawBody) {
      try {
        result = JSON.parse(rawBody) as AuthResponse;
      } catch {
        throw new Error("Server mengirim respons yang tidak valid. Periksa terminal backend.");
      }
    }

    if (!response.ok) {
      throw new Error(result.message || `Permintaan gagal (HTTP ${response.status}).`);
    }
    return result;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Server terlalu lama merespons. Pastikan backend dan MySQL sudah aktif.");
    }
    if (error instanceof TypeError) {
      throw new Error("Backend tidak dapat dihubungi. Jalankan server backend di port 5000 dan pastikan MySQL aktif.");
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

function saveSession(result: AuthResponse) {
  if (!result.user || !result.token) throw new Error("Data sesi dari server tidak lengkap.");
  storeSession(result.user, result.token);
  window.location.replace("/portal");
}
const Field = ({ icon, children, action }: { icon: "mail" | "lock" | "user" | "phone" | "id"; children: React.ReactNode; action?: React.ReactNode }) => <div className="input-box"><Icon name={icon} />{children}{action}</div>;
const Divider = ({ children }: { children: string }) => <div className="divider"><span />{children}<span /></div>;
const SocialButtons = ({ onMessage }: { onMessage: (message: string) => void }) => {
  async function startOAuth(provider: "google" | "facebook") {
    onMessage("");
    try {
      const response = await fetch(API_URL + "/auth/providers", { headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error("Status OAuth tidak dapat diperiksa.");
      const providers = await response.json() as Record<string, boolean>;
      if (!providers[provider]) {
        onMessage(`Login ${provider === "google" ? "Google" : "Facebook"} belum aktif. Isi kredensial OAuth pada Backend/.env.`);
        return;
      }
      window.location.assign(API_URL + "/auth/" + provider);
    } catch {
      onMessage("Backend tidak dapat dihubungi untuk memulai OAuth.");
    }
  }
  return (
  <div className="social-buttons">
    <button type="button" onClick={() => startOAuth("google")}>
      <svg width="18" height="18" viewBox="0 0 24 24" style={{ marginRight: '8px', verticalAlign: 'middle' }}>
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
      </svg>
      Google
    </button>
    <button type="button" onClick={() => startOAuth("facebook")}>
      <b className="facebook">f</b>Facebook
    </button>
  </div>
  );
};
export function LoginForm() {
  const [role, setRole] = useState("WARGA"), [show, setShow] = useState(false), [message, setMessage] = useState(""), [loading, setLoading] = useState(false);
  const submitting = useRef(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const errorCode = params.get("error");
    if (!errorCode) return;
    const provider = params.get("provider") === "facebook" ? "Facebook" : "Google";
    const messages: Record<string, string> = {
      oauth_cancelled: `Login ${provider} dibatalkan atau izin akun tidak diberikan.`,
      oauth_state_invalid: `Sesi login ${provider} kedaluwarsa. Silakan coba lagi.`,
      oauth_start_failed: `Login ${provider} tidak dapat dimulai. Periksa konfigurasi backend.`,
      oauth_callback_failed: `Login ${provider} gagal diproses. Silakan coba lagi.`,
      oauth_session_failed: `Akun ${provider} berhasil diverifikasi, tetapi sesi portal gagal dibuat.`,
    };
    setMessage(messages[errorCode] || `Login ${provider} gagal. Silakan coba kembali.`);
    window.history.replaceState(null, "", window.location.pathname);
  }, []);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setLoading(true);
    setMessage("");
    const data = new FormData(e.currentTarget);
    try {
      const result = await postAuth("/auth/login", { email: data.get("email"), password: data.get("password"), remember: data.get("remember") === "on", role });
      saveSession(result);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Login gagal. Silakan coba kembali.");
    } finally {
      submitting.current = false;
      setLoading(false);
    }
  }
  return <><h2>Masuk ke Akun Anda</h2><p className="intro">Silakan lengkapi detail login untuk melanjutkan akses portal.</p><div className="auth-tabs"><button className="active">Masuk</button><Link href="/register">Daftar Baru</Link></div><form onSubmit={submit}><label>ALAMAT EMAIL</label><Field icon="mail"><input name="email" type="email" placeholder="nama@email.com" required /></Field><div className="label-row"><label>KATA SANDI</label><button type="button" className="text-link" onClick={() => alert("Silakan hubungi Admin RW untuk bantuan reset kata sandi.")}>Lupa Sandi?</button></div><Field icon="lock" action={<button className="password-toggle" type="button" onClick={() => setShow(!show)}><Icon name={show ? "eyeoff" : "eye"} /></button>}><input name="password" type={show ? "text" : "password"} placeholder="••••••••" required /></Field><label>SEBAGAI SIAPA?</label><div className="role-grid"><button type="button" onClick={() => setRole("WARGA")} className={role === "WARGA" ? "selected" : ""}><Icon name="user" /> Warga</button><button type="button" onClick={() => setRole("PENGURUS")} className={role === "PENGURUS" ? "selected" : ""}><Icon name="admin" /> Pengurus</button></div><label className="check-label"><input name="remember" type="checkbox" /><span>Ingat saya di perangkat ini</span></label>{message && <p className="form-message" role="alert" aria-live="polite">{message}</p>}<button className="primary-button" disabled={loading}>{loading ? "Memproses..." : "Masuk ke Portal"}</button></form><Divider>ATAU MASUK DENGAN</Divider><SocialButtons onMessage={setMessage} /><p className="bottom-note">Butuh bantuan akses? <a href="mailto:admin@rwkita.id">Hubungi Admin RW</a></p></>;
}
export function RegisterForm() {
  const [role, setRole] = useState("WARGA"), [show, setShow] = useState(false), [message, setMessage] = useState(""), [loading, setLoading] = useState(false);
  const submitting = useRef(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting.current) return;
    const data = new FormData(e.currentTarget);
    const password = String(data.get("password") || "");
    const confirmation = String(data.get("confirmation") || "");
    if (password !== confirmation) return setMessage("Konfirmasi kata sandi belum sama.");

    submitting.current = true;
    setLoading(true);
    setMessage("");
    try {
      const result = await postAuth("/auth/register", {
        fullName: String(data.get("fullName") || "").trim(),
        nik: String(data.get("nik") || "").trim(),
        email: String(data.get("email") || "").trim().toLowerCase(),
        phone: String(data.get("phone") || "").trim(),
        password,
        agreed: data.get("agreed") === "on",
        role,
        pengurusCode: String(data.get("pengurusCode") || ""),
      });
      saveSession(result);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Pendaftaran gagal. Silakan coba kembali.");
    } finally {
      submitting.current = false;
      setLoading(false);
    }
  }
  const password = (name: string, placeholder: string) => <Field icon="lock" action={<button className="password-toggle" type="button" onClick={() => setShow(!show)}><Icon name={show ? "eyeoff" : "eye"} /></button>}><input name={name} type={show ? "text" : "password"} placeholder={placeholder} minLength={8} required /></Field>;
  return <><h2>Buat Akun Baru</h2><p className="intro">Lengkapi data diri Anda untuk bergabung.</p><form onSubmit={submit} className="register-form"><label>Pilih Peran</label><div className="role-grid"><button type="button" onClick={() => setRole("WARGA")} className={role === "WARGA" ? "selected" : ""}>Warga</button><button type="button" onClick={() => setRole("PENGURUS")} className={role === "PENGURUS" ? "selected" : ""}>Pengurus</button></div>{role === "PENGURUS" && <><label>Kode Pendaftaran Pengurus</label><Field icon="lock"><input name="pengurusCode" type="password" autoComplete="off" placeholder="Kode dari admin RW" required /></Field></>}<label>Nama Lengkap</label><Field icon="user"><input name="fullName" placeholder="Masukkan nama lengkap sesuai KTP" required /></Field><label>Nomor Induk Kependudukan (NIK)</label><Field icon="id"><input name="nik" inputMode="numeric" pattern="[0-9]{16}" maxLength={16} placeholder="16 digit NIK" required /></Field><div className="two-fields"><div><label>Alamat Email</label><Field icon="mail"><input name="email" type="email" placeholder="contoh@email.com" required /></Field></div><div><label>Nomor WhatsApp</label><Field icon="phone"><input name="phone" type="tel" placeholder="08xxxxxxxxxx" required /></Field></div></div><label>Kata Sandi</label>{password("password", "Minimal 8 karakter")}<label>Konfirmasi Kata Sandi</label>{password("confirmation", "Ulangi kata sandi")}<label className="check-label agreement"><input name="agreed" type="checkbox" required /><span>Saya menyetujui <Link href="/produk-hukum">Syarat &amp; Ketentuan</Link> serta <Link href="/produk-hukum">Kebijakan Privasi</Link> yang berlaku.</span></label>{message && <p className="form-message" role="alert" aria-live="polite">{message}</p>}<button className="primary-button" disabled={loading}>{loading ? "Memproses..." : "Daftar Sekarang  →"}</button></form><Divider>atau daftar dengan</Divider><SocialButtons onMessage={setMessage} /><p className="bottom-note">Sudah punya akun? <Link href="/login">Masuk di sini</Link></p></>;
}
