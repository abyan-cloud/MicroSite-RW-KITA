"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Dashboard } from "@/components/dashboard";
import { clearSession, readVerifiedSession, type SessionUser } from "@/lib/auth-session";

export default function Portal() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [sessionKey, setSessionKey] = useState("");
  const logout = useCallback(() => {
    clearSession();
    setUser(null);
    router.replace("/");
    router.refresh();
  }, [router]);
  useEffect(() => {
    function syncSession() {
      const session = readVerifiedSession();
      if (!session) {
        clearSession();
        setUser(null);
        router.replace("/login");
        return;
      }
      setUser((current) => current?.fullName === session.user.fullName && current.role === session.user.role ? current : session.user);
      setSessionKey(session.token.slice(-24));
    }
    function onVisibility() { if (document.visibilityState === "visible") syncSession(); }
    syncSession();
    window.addEventListener("pageshow", syncSession);
    window.addEventListener("storage", syncSession);
    document.addEventListener("visibilitychange", onVisibility);
    return () => { window.removeEventListener("pageshow", syncSession); window.removeEventListener("storage", syncSession); document.removeEventListener("visibilitychange", onVisibility); };
  }, [router]);
  return user ? <Dashboard key={`${user.role}:${sessionKey}`} user={user} logout={logout} /> : null;
}
