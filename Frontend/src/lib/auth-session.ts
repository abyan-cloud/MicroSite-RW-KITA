export type SessionUser = {
  fullName: string;
  role: "WARGA" | "PENGURUS";
};

export type VerifiedSession = {
  user: SessionUser;
  token: string;
};

export const SESSION_EVENT = "rw-kita-session-changed";

type TokenPayload = {
  fullName?: string;
  role?: string;
  exp?: number;
};

function decodePayload(token: string): TokenPayload | null {
  try {
    const segment = token.split(".")[1]?.replace(/-/g, "+").replace(/_/g, "/");
    if (!segment) return null;
    return JSON.parse(atob(segment.padEnd(Math.ceil(segment.length / 4) * 4, "="))) as TokenPayload;
  } catch {
    return null;
  }
}

function readCachedUser(): SessionUser | null {
  try {
    const cached = JSON.parse(localStorage.getItem("rw_kita_user") || "null") as Partial<SessionUser> | null;
    if (!cached?.fullName || (cached.role !== "WARGA" && cached.role !== "PENGURUS")) return null;
    return cached as SessionUser;
  } catch {
    return null;
  }
}

export function readVerifiedSession(): VerifiedSession | null {
  if (typeof window === "undefined") return null;
  const token = localStorage.getItem("rw_kita_token");
  if (!token) return null;

  const payload = decodePayload(token);
  if (!payload || (payload.role !== "WARGA" && payload.role !== "PENGURUS")) return null;
  if (payload.exp && payload.exp * 1000 <= Date.now()) return null;

  const cached = readCachedUser();
  const user: SessionUser = {
    fullName: cached?.role === payload.role ? cached.fullName : payload.fullName || "Pengguna RW KITA",
    role: payload.role,
  };
  localStorage.setItem("rw_kita_user", JSON.stringify(user));
  return { user, token };
}

export function storeSession(user: SessionUser, token: string) {
  localStorage.setItem("rw_kita_user", JSON.stringify(user));
  localStorage.setItem("rw_kita_token", token);
  window.dispatchEvent(new Event(SESSION_EVENT));
}

export function clearSession() {
  localStorage.removeItem("rw_kita_user");
  localStorage.removeItem("rw_kita_token");
  window.dispatchEvent(new Event(SESSION_EVENT));
}
