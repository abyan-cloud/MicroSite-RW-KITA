"use client";

import Link from "next/link";
import React, { FormEvent, useEffect, useMemo, useState } from "react";

type Role = "WARGA" | "PENGURUS";
type User = { id?: number; fullName: string; email?: string; phone?: string; role: Role };
type Profile = { fullName: string; phone: string; address: string; rtNumber: string; bio: string };
type Aspiration = { id: number; full_name?: string; title: string; category: string; description: string; status: string; admin_response?: string; created_at: string };
type Service = { id: number; full_name?: string; service_type: string; tracking_code: string; notes?: string; status: string; created_at: string };
type Resident = { id: number; full_name: string; nik: string; phone: string; address: string; rt_number: string; status: string; created_at: string };
type PortalData = { user: User; profile: Profile; aspirations: Aspiration[]; services: Service[]; residents: Resident[] };
type ApiResponse = { message: string; aspiration: Aspiration; service: Service; resident: Resident; profile: Profile };
type MenuKey = "dashboard" | "aspirations" | "services" | "residents" | "moderation" | "settings";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
const citizenMenus: { key: MenuKey; icon: string; label: string }[] = [
  { key: "dashboard", icon: "▦", label: "Dashboard" },
  { key: "aspirations", icon: "▢", label: "Aspirasi" },
  { key: "services", icon: "☑", label: "Status Layanan" },
  { key: "settings", icon: "⚙", label: "Pengaturan" },
];
const adminMenus: typeof citizenMenus = [
  ...citizenMenus.slice(0, 3),
  { key: "residents", icon: "♙", label: "Data Warga" },
  { key: "moderation", icon: "⚒", label: "Moderasi" },
  citizenMenus[3],
];

export function Dashboard({ user: initialUser, logout }: { user: User; logout: () => void }) {
  const [active, setActive] = useState<MenuKey>("dashboard");
  const [data, setData] = useState<PortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [search, setSearch] = useState("");
  const admin = (data?.user.role || initialUser.role) === "PENGURUS";
  const menus = admin ? adminMenus : citizenMenus;

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const token = localStorage.getItem("rw_kita_token");
        if (!token) return logout();
        const response = await fetch(`${API}/api/portal/bootstrap`, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal });
        const result = await response.json();
        if (response.status === 401 || response.status === 403) return logout();
        if (!response.ok) throw new Error(result.message || "Data portal gagal dimuat.");
        setData(result);
      } catch (cause) {
        if ((cause as Error).name !== "AbortError") setError((cause as Error).message || "Backend tidak dapat dihubungi.");
      } finally { setLoading(false); }
    }
    load();
    return () => controller.abort();
  }, [logout]);

  async function api(path: string, options: RequestInit = {}): Promise<ApiResponse> {
    const token = localStorage.getItem("rw_kita_token");
    const response = await fetch(`${API}${path}`, { ...options, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(options.headers || {}) } });
    const result = await response.json() as ApiResponse;
    if (response.status === 401 || response.status === 403) { logout(); throw new Error("Sesi berakhir. Silakan masuk kembali."); }
    if (!response.ok) throw new Error(result.message || "Permintaan gagal diproses.");
    return result;
  }

  function notify(message: string) { setToast(message); window.setTimeout(() => setToast(""), 2800); }
  function openMenu(key: MenuKey) { setActive(key); setError(""); }
  const currentUser = data?.user || initialUser;

  return <main className={`dash ${admin ? "admin-dash" : "citizen-dash"}`}>
    <aside className="sidebar">
      <Link href="/" className="dashboard-logo" aria-label="Kembali ke beranda"><h1>RW KITA</h1><p>Kolaboratif, Informatif,<br />Tertib Administrasi dan Literasi</p></Link>
      <nav aria-label="Menu dashboard">{menus.map((item) => <button key={item.key} className={active === item.key ? "nav-active" : ""} onClick={() => openMenu(item.key)}><span>{item.icon}</span>{item.label}</button>)}</nav>
      <Link href="/" className="dashboard-home-link">← Kembali ke Beranda</Link>
      <div className="profile"><i>{currentUser.fullName.slice(0, 1).toUpperCase()}</i><span><b>{currentUser.fullName}</b><small>{admin ? "Admin RW 08 - Jakarta Timur" : "Warga RW 08"}</small></span><button onClick={logout}>Keluar</button></div>
    </aside>
    <section className="dash-content">
      <header className="dash-header"><div>{!admin && active === "dashboard" && <small>Beranda Dashboard</small>}<h2>{!admin && active === "dashboard" ? `Halo, ${currentUser.fullName}` : titleFor(active)}</h2></div><div className="header-actions">{admin && <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="⌕  Cari data..." />}<button className="notification-button" aria-label="Notifikasi" onClick={() => notify("Tidak ada notifikasi baru")}>♧</button>{!admin && <time>▣ &nbsp; {new Intl.DateTimeFormat("id-ID", { dateStyle: "long" }).format(new Date())}</time>}</div></header>
      {loading && <div className="dashboard-state">Memuat data dashboard…</div>}
      {error && <div className="dashboard-state error-state"><b>Data belum dapat dimuat.</b><span>{error}</span><button onClick={() => location.reload()}>Coba Lagi</button></div>}
      {data && <DashboardPanel active={active} admin={admin} data={data} search={search} api={api} setData={setData} openMenu={openMenu} notify={notify} />}
    </section>
    {toast && <div className="toast">{toast}</div>}
  </main>;
}

function DashboardPanel({ active, admin, data, search, api, setData, openMenu, notify }: {
  active: MenuKey; admin: boolean; data: PortalData; search: string;
  api: (path: string, options?: RequestInit) => Promise<ApiResponse>;
  setData: React.Dispatch<React.SetStateAction<PortalData | null>>;
  openMenu: (key: MenuKey) => void; notify: (message: string) => void;
}) {
  if (active === "aspirations") return <Aspirations data={data} api={api} setData={setData} notify={notify} />;
  if (active === "services") return <Services data={data} api={api} setData={setData} notify={notify} />;
  if (active === "residents" && admin) return <Residents data={data} search={search} api={api} setData={setData} notify={notify} />;
  if (active === "moderation" && admin) return <Moderation data={data} search={search} api={api} setData={setData} notify={notify} />;
  if (active === "settings") return <Settings data={data} api={api} setData={setData} notify={notify} />;
  return <Overview admin={admin} data={data} search={search} openMenu={openMenu} notify={notify} />;
}

function Overview({ admin, data, search, openMenu, notify }: { admin: boolean; data: PortalData; search: string; openMenu: (key: MenuKey) => void; notify: (message: string) => void }) {
  return admin ? <AdminOverview data={data} search={search} openMenu={openMenu} notify={notify} /> : <CitizenOverview data={data} openMenu={openMenu} />;
}

function AdminOverview({ data, search, openMenu, notify }: { data: PortalData; search: string; openMenu: (key: MenuKey) => void; notify: (message: string) => void }) {
  const waiting = data.aspirations.filter((item) => item.status === "MENUNGGU").length;
  const completed = data.services.filter((item) => item.status === "SELESAI").length;
  const residents = data.residents.filter((resident) => `${resident.full_name} ${resident.nik} ${resident.address} ${resident.rt_number}`.toLowerCase().includes(search.toLowerCase())).slice(0, 3);
  return <div className="dashboard-grid admin-overview">
    <section className="stat-row">
      <Stat label="TOTAL WARGA" value={data.residents.length.toLocaleString("id-ID")} note="↗ Data warga terdaftar" icon="♟" />
      <Stat label="ASPIRASI BARU" value={String(waiting).padStart(2, "0")} note="BUTUH TINDAKAN" icon="▰" alert />
      <Stat label="LAYANAN SELESAI" value={String(completed).padStart(2, "0")} note={`${data.services.length} total layanan`} icon="✓" />
      <button className="queue" onClick={() => openMenu("moderation")}>ANTREAN MODERASI<strong>{String(waiting).padStart(2, "0")}</strong><span>Periksa sekarang →</span></button>
    </section>
    <section className="data-card admin-resident-card">
      <div className="card-title"><div><h3>Data Warga Terbaru</h3><p>Kelola informasi kependudukan RW 08</p></div><div><button className="blue-btn" onClick={() => openMenu("residents")}>＋ Tambah Warga</button><button onClick={() => openMenu("residents")}>☷ Filter</button></div></div>
      <div className="resident-table"><div className="resident-head"><span>NAMA LENGKAP</span><span>BLOK/NO</span><span>STATUS</span><span>TERDAFTAR</span><span>AKSI</span></div>{residents.map((resident) => <div className="resident-row" key={resident.id}><span className="resident-name"><i>{initials(resident.full_name)}</i><b>{resident.full_name}<small>Warga RW 08</small></b></span><span>{resident.address || `RT ${resident.rt_number}`}</span><Status value={resident.status} /><span>{date(resident.created_at)}</span><button onClick={() => openMenu("residents")} aria-label={`Kelola ${resident.full_name}`}>✎</button></div>)}</div>
      <div className="table-footer"><span>Menampilkan {residents.length} dari {data.residents.length} warga</span><button onClick={() => openMenu("residents")}>Lihat Semua →</button></div>
    </section>
    <aside className="admin-side-stack">
      <section className="data-card dashboard-news"><h3>BERITA & PENGUMUMAN</h3><Link href="/informasi/kerja-bakti-massal"><i className="news-thumb garden" /><span><b>Jadwal Kerja Bakti</b><small>Publikasi: Kemarin, 14:00</small></span></Link><Link href="/produk-hukum"><i className="news-thumb rules" /><span><b>Update Peraturan RW</b><small>Publikasi: 2 hari lalu</small></span></Link><Link className="outline-dashboard-button" href="/informasi">▣ &nbsp; Buka Daftar Informasi</Link></section>
      <section className="data-card verification-card"><div><h3>VERIFIKASI DOKUMEN</h3><Status value={`${data.services.filter((item) => item.status === "MENUNGGU").length} PENDING`} /></div>{data.services[0] ? <article><b>{data.services[0].service_type}</b><small>{data.services[0].full_name || "Warga RW KITA"} · {date(data.services[0].created_at)}</small><button onClick={() => openMenu("services")}>Periksa →</button></article> : <p>Belum ada dokumen menunggu.</p>}</section>
    </aside>
    <section className="dashboard-map-card">
      <iframe title="Peta Kantor Wali Kota Jakarta Timur" loading="lazy" src="https://www.google.com/maps?q=Kantor+Wali+Kota+Administrasi+Jakarta+Timur&output=embed" />
      <div className="map-dashboard-overlay"><h3>Peta Digital Warga</h3><p>Titik tengah sementara: Kantor Wali Kota Jakarta Timur.</p><a href="https://www.google.com/maps/search/?api=1&query=Kantor+Wali+Kota+Administrasi+Jakarta+Timur" target="_blank" rel="noreferrer">Lihat Peta Interaktif</a></div>
    </section>
    <section className="analytics-card"><span>✦</span><h3>Optimalkan Layanan</h3><p>Kelola dan kategorikan aspirasi warga untuk membantu tindak lanjut kebijakan tingkat RW.</p><button onClick={() => { notify("Membuka analisis aspirasi warga"); openMenu("moderation"); }}>✦ &nbsp; Buka Analisis Aspirasi</button></section>
    <DashboardFooter />
  </div>;
}

function CitizenOverview({ data, openMenu }: { data: PortalData; openMenu: (key: MenuKey) => void }) {
  const latest = data.services[0];
  return <div className="dashboard-grid citizen-overview">
    <section className="citizen-aspiration-card"><div><h3>Satu Kantong Aspirasi</h3><p>Sampaikan keluhan, saran, atau ide pembangunan lingkungan Anda langsung ke pengurus RW secara digital dan transparan.</p><button onClick={() => openMenu("aspirations")}>☷ &nbsp; Kirim Aspirasi Baru</button></div><span>⚑</span></section>
    <section className="citizen-status-card"><h3>☑ &nbsp; STATUS LAYANAN</h3>{latest ? <><div className="citizen-service-title"><b>{latest.service_type}<small>ID: #{latest.tracking_code}</small></b><Status value={latest.status} /></div><div className="progress"><i style={{ width: latest.status === "SELESAI" ? "100%" : latest.status === "DIPROSES" ? "65%" : "28%" }} /></div><em>Terakhir diperbarui: {date(latest.created_at)}</em></> : <p>Belum ada layanan aktif.</p>}<button onClick={() => openMenu("services")}>Lihat Detail Lacak →</button></section>
    <section className="citizen-warta"><div className="section-heading"><h3>Warta Warga</h3><Link href="/informasi">Lihat Semua</Link></div><Link href="/informasi/kerja-bakti-massal" className="citizen-news-main"><div className="citizen-news-photo"><span>PEMBANGUNAN</span></div><h4>Kerja Bakti: Revitalisasi Taman Blok A</h4><p>Mari bergabung bersama tetangga untuk mempercantik area hijau kita...</p><small>◷ 20 Menit Lalu</small></Link><Link href="/informasi/pembaruan-jadwal-ronda" className="citizen-news-small"><i /><span><small>KEAMANAN</small><b>Pembaruan Jadwal Ronda Malam</b><p>Jadwal periode terbaru sudah dirilis.</p></span></Link></section>
    <section className="data-card citizen-history"><div className="history-heading"><h3>Riwayat<br />Layanan Mandiri</h3><button onClick={() => openMenu("services")}>⌕ &nbsp; Cari layanan...</button><button onClick={() => openMenu("services")}>☷ Filter</button></div><div className="service-history-table"><div className="service-history-head"><span>JENIS LAYANAN</span><span>TANGGAL PENGAJUAN</span><span>ID TRACKING</span><span>STATUS</span><span>AKSI</span></div>{data.services.slice(0, 4).map((service) => <div className="service-history-row" key={service.id}><b>{service.service_type}</b><span>{date(service.created_at)}</span><a href="#" onClick={(event) => { event.preventDefault(); openMenu("services"); }}>#{service.tracking_code}</a><Status value={service.status} /><button onClick={() => openMenu("services")}>Detail</button></div>)}</div><div className="table-footer"><span>Menampilkan {Math.min(4, data.services.length)} dari {data.services.length} pengajuan</span><button onClick={() => openMenu("services")}>Lihat Semua →</button></div></section>
    <DashboardFooter citizen />
  </div>;
}

function DashboardFooter({ citizen = false }: { citizen?: boolean }) { return <footer className={`dashboard-footer ${citizen ? "citizen-footer" : ""}`}><div><b>RW KITA</b>{citizen && <p>Platform tata kelola lingkungan digital yang transparan, akuntabel, dan mengutamakan pelayanan warga.</p>}</div><nav><Link href="/kontak">Hubungi Kami</Link><Link href="/profil-rw">Kebijakan Privasi</Link><Link href="/produk-hukum">Syarat & Ketentuan</Link><Link href="/">Peta Situs</Link></nav><small>© 2026 RW KITA. Digital Town Hall Platform.</small></footer>; }

function Aspirations({ data, api, setData, notify }: DataActions) {
  const [saving, setSaving] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); const formElement = event.currentTarget; const form = new FormData(formElement);
    try { const result = await api("/api/portal/aspirations", { method: "POST", body: JSON.stringify({ title: form.get("title"), category: form.get("category"), description: form.get("description") }) }); setData((current) => current && ({ ...current, aspirations: [result.aspiration, ...current.aspirations] })); formElement.reset(); notify(result.message); }
    catch (cause) { notify((cause as Error).message); } finally { setSaving(false); }
  }
  return <div className="portal-panel"><section className="data-card portal-form"><h3>Kirim Aspirasi Baru</h3><p>Keluhan, ide, dan saran akan langsung masuk ke antrean pengurus.</p><form onSubmit={submit}><label>Judul<input name="title" minLength={5} required placeholder="Contoh: Lampu jalan Blok A mati" /></label><label>Kategori<select name="category"><option>LINGKUNGAN</option><option>KEAMANAN</option><option>INFRASTRUKTUR</option><option>SOSIAL</option><option>LAINNYA</option></select></label><label>Isi Aspirasi<textarea name="description" minLength={10} required placeholder="Jelaskan lokasi dan kebutuhan secara lengkap" /></label><button className="blue-btn" disabled={saving}>{saving ? "Mengirim…" : "Kirim Aspirasi"}</button></form></section><List title="Riwayat Aspirasi" empty="Belum ada aspirasi.">{data.aspirations.map((item) => <div className="portal-row" key={item.id}><div><b>{item.title}</b><small>{item.full_name && `${item.full_name} · `}{item.category} · {date(item.created_at)}</small><p>{item.description}</p>{item.admin_response && <em>Tanggapan: {item.admin_response}</em>}</div><Status value={item.status} /></div>)}</List></div>;
}

function Services({ data, api, setData, notify }: DataActions) {
  const [saving, setSaving] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); const formElement = event.currentTarget; const form = new FormData(formElement);
    try { const result = await api("/api/portal/services", { method: "POST", body: JSON.stringify({ serviceType: form.get("serviceType"), notes: form.get("notes") }) }); setData((current) => current && ({ ...current, services: [result.service, ...current.services] })); formElement.reset(); notify(result.message); }
    catch (cause) { notify((cause as Error).message); } finally { setSaving(false); }
  }
  return <div className="portal-panel"><section className="data-card portal-form"><h3>Buat Permohonan Layanan</h3><p>Nomor pelacakan dibuat otomatis setelah permohonan dikirim.</p><form onSubmit={submit}><label>Jenis Layanan<select name="serviceType"><option>Surat Pengantar KTP</option><option>Surat Domisili</option><option>Surat Pengantar Nikah</option><option>Izin Keramaian</option><option>Domisili Usaha</option></select></label><label>Catatan<textarea name="notes" placeholder="Tambahkan keperluan atau keterangan" /></label><button className="blue-btn" disabled={saving}>{saving ? "Menyimpan…" : "Ajukan Layanan"}</button></form></section><List title="Status dan Riwayat Layanan" empty="Belum ada permohonan layanan.">{data.services.map((item) => <div className="portal-row" key={item.id}><div><b>{item.service_type}</b><small>{item.full_name && `${item.full_name} · `}{item.tracking_code} · {date(item.created_at)}</small><p>{item.notes || "Tidak ada catatan."}</p></div><Status value={item.status} /></div>)}</List></div>;
}

function Residents({ data, search, api, setData, notify }: DataActions & { search: string }) {
  const filtered = useMemo(() => data.residents.filter((item) => `${item.full_name} ${item.nik} ${item.address}`.toLowerCase().includes(search.toLowerCase())), [data.residents, search]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const formElement = event.currentTarget; const form = new FormData(formElement);
    try { const result = await api("/api/portal/residents", { method: "POST", body: JSON.stringify(Object.fromEntries(form)) }); setData((current) => current && ({ ...current, residents: [result.resident, ...current.residents] })); formElement.reset(); notify(result.message); } catch (cause) { notify((cause as Error).message); }
  }
  return <div className="portal-panel"><section className="data-card portal-form"><h3>Tambah Data Warga</h3><form onSubmit={submit} className="form-grid"><label>Nama Lengkap<input name="fullName" minLength={3} required /></label><label>NIK<input name="nik" inputMode="numeric" pattern="\d{16}" maxLength={16} required /></label><label>WhatsApp<input name="phone" /></label><label>Nomor RT<input name="rtNumber" inputMode="numeric" maxLength={2} required /></label><label className="wide">Alamat<input name="address" /></label><button className="blue-btn">Simpan Data Warga</button></form></section><List title={`Data Warga (${filtered.length})`} empty="Data warga tidak ditemukan.">{filtered.map((item) => <div className="portal-row" key={item.id}><div><b>{item.full_name}</b><small>NIK {item.nik} · RT {item.rt_number}</small><p>{item.address || "Alamat belum dicatat"} · {item.phone || "Tanpa nomor telepon"}</p></div><Status value={item.status} /></div>)}</List></div>;
}

function Moderation({ data, search, api, setData, notify }: DataActions & { search: string }) {
  const filtered = data.aspirations.filter((item) => `${item.title} ${item.full_name || ""}`.toLowerCase().includes(search.toLowerCase()));
  async function change(id: number, status: string) {
    try { const result = await api(`/api/portal/aspirations/${id}`, { method: "PATCH", body: JSON.stringify({ status, adminResponse: status === "SELESAI" ? "Aspirasi telah ditindaklanjuti oleh pengurus RW." : "" }) }); setData((current) => current && ({ ...current, aspirations: current.aspirations.map((item) => item.id === id ? { ...item, ...result.aspiration } : item) })); notify(result.message); } catch (cause) { notify((cause as Error).message); }
  }
  return <div className="portal-panel single"><List title="Moderasi Aspirasi Warga" empty="Tidak ada aspirasi untuk dimoderasi.">{filtered.map((item) => <div className="portal-row" key={item.id}><div><b>{item.title}</b><small>{item.full_name} · {item.category} · {date(item.created_at)}</small><p>{item.description}</p></div><div className="row-actions"><Status value={item.status} /><select aria-label={`Status ${item.title}`} value={item.status} onChange={(event) => change(item.id, event.target.value)}><option>MENUNGGU</option><option>DIPROSES</option><option>SELESAI</option><option>DITOLAK</option></select></div></div>)}</List></div>;
}

function Settings({ data, api, setData, notify }: DataActions) {
  const [profile, setProfile] = useState(data.profile);
  const [saving, setSaving] = useState(false);
  async function submit(event: FormEvent) { event.preventDefault(); setSaving(true); try { const result = await api("/api/portal/profile", { method: "PUT", body: JSON.stringify(profile) }); setData((current) => current && ({ ...current, profile: result.profile, user: { ...current.user, fullName: result.profile.fullName, phone: result.profile.phone } })); localStorage.setItem("rw_kita_user", JSON.stringify({ fullName: result.profile.fullName, role: data.user.role })); notify(result.message); } catch (cause) { notify((cause as Error).message); } finally { setSaving(false); } }
  const field = (key: keyof Profile) => ({ value: profile[key], onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setProfile({ ...profile, [key]: event.target.value }) });
  return <div className="portal-panel single"><section className="data-card portal-form settings-card"><div className="settings-heading"><i>{profile.fullName.slice(0, 1).toUpperCase()}</i><div><h3>Pengaturan Profil</h3><p>Perubahan tersimpan di database dan digunakan di seluruh portal.</p></div></div><form onSubmit={submit} className="form-grid"><label>Nama Lengkap<input {...field("fullName")} minLength={3} required /></label><label>Email<input value={data.user.email || ""} disabled /></label><label>Nomor WhatsApp<input {...field("phone")} required /></label><label>Nomor RT<input {...field("rtNumber")} maxLength={2} /></label><label className="wide">Alamat<input {...field("address")} /></label><label className="wide">Tentang Saya<textarea {...field("bio")} /></label><button className="blue-btn" disabled={saving}>{saving ? "Menyimpan…" : "Simpan Perubahan"}</button></form></section></div>;
}

type DataActions = { data: PortalData; api: (path: string, options?: RequestInit) => Promise<ApiResponse>; setData: React.Dispatch<React.SetStateAction<PortalData | null>>; notify: (message: string) => void };
function List({ title, empty, children }: { title: string; empty: string; children: React.ReactNode }) { const items = React.Children.count(children); return <section className="data-card portal-list"><div className="card-title"><h3>{title}</h3></div>{items ? children : <div className="empty-state">{empty}</div>}</section>; }
function Stat({ label, value, note, icon, alert = false }: { label: string; value: string; note: string; icon?: string; alert?: boolean }) { return <div className="stat-card"><i>{icon}</i><b>{label}</b><strong>{value}</strong><small className={alert ? "alert-note" : ""}>{note}</small></div>; }
function Status({ value }: { value: string }) { const kind = value === "SELESAI" || value === "AKTIF" ? "green" : value === "DITOLAK" || value.includes("PENDING") ? "red" : value === "MENUNGGU" ? "yellow" : ""; return <span className={`status ${kind}`}>{value}</span>; }
function date(value: string) { return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(new Date(value)); }
function initials(value: string) { return value.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase(); }
function titleFor(key: MenuKey) { return ({ dashboard: "Ringkasan Dashboard", aspirations: "Aspirasi", services: "Status Layanan", residents: "Data Warga", moderation: "Moderasi Aspirasi", settings: "Pengaturan Profil" })[key]; }
