"use client";
import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { storeSession } from "@/lib/auth-session";

function parseToken(token: string) {
  try {
    const segment = token.split(".")[1]?.replace(/-/g, "+").replace(/_/g, "/");
    if (!segment) return null;
    const payload = JSON.parse(atob(segment.padEnd(Math.ceil(segment.length / 4) * 4, "=")));
    if (!payload?.fullName || !["WARGA", "PENGURUS"].includes(payload.role)) return null;
    if (payload.exp && payload.exp * 1000 <= Date.now()) return null;
    return payload;
  } catch { return null; }
}
function OAuthCallbackContent() {
  const params = useSearchParams();
  const router = useRouter();
  useEffect(() => {
    const token = params.get("token");
    const user = token && parseToken(token);
    if (!token || !user) return router.replace("/login?error=oauth");
    storeSession({ fullName: user.fullName, role: user.role }, token);
    router.replace("/portal");
  }, [params, router]);
  return <main className="oauth-loading">Menyiapkan akun Anda...</main>;
}

export default function OAuthCallback() {
  return <Suspense fallback={<main className="oauth-loading">Menyiapkan akun Anda...</main>}><OAuthCallbackContent /></Suspense>;
}
