"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type User = { fullName: string; role: "WARGA" | "PENGURUS" };
export default function Portal() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  useEffect(() => { const stored = localStorage.getItem("rw_kita_user"); if (!stored) router.replace("/login"); else setUser(JSON.parse(stored)); }, [router]);
  function logout() { localStorage.removeItem("rw_kita_user"); localStorage.removeItem("rw_kita_token"); router.push("/login"); }
  if (!user) return null;
  return <main className="portal"><h1>Selamat datang, {user.fullName}!</h1><p>Akun {user.role === "WARGA" ? "Warga" : "Pengurus"} Anda berhasil terhubung ke portal RW KITA.</p><button className="primary-button" onClick={logout}>Keluar</button></main>;
}
