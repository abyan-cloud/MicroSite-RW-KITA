"use client";
import { createContext, useContext, useEffect, useMemo, useState } from "react";

type Language = "id" | "en";
type LanguageContextValue = { language: Language; setLanguage: (language: Language) => void; text: (id: string, en: string) => string };
const LanguageContext = createContext<LanguageContextValue | null>(null);
const translations: Record<string, string> = {
  "Satu Pintu Informasi & Layanan Digital": "One Gateway for Digital Information & Services",
  "Mewujudkan RW yang Kolaboratif, Informatif, Tertib Administrasi dan Literasi untuk kesejahteraan seluruh warga.": "Building a collaborative, informative, well-administered and literate neighborhood for every resident.",
  "Tentang Kami & Profil": "About Us & Profile", "Layanan Warga": "Resident Services",
  "Jumlah RT": "Neighborhood Units", "Total Warga": "Total Residents", "UMKM Warga": "Resident Businesses", "Program Kerja": "Work Programs",
  "VISI & MISI": "VISION & MISSION", "Membangun Ekosistem Digital Lingkungan yang Terintegrasi": "Building an Integrated Digital Neighborhood Ecosystem",
  "Transparansi Keuangan": "Financial Transparency", "Digitalisasi Administrasi": "Digital Administration",
  "Berita & Pengumuman RW": "RW News & Announcements", "Update terbaru seputar kegiatan dan informasi lingkungan.": "Latest neighborhood activities and information.",
  "Lihat Semua →": "View All →", "Potensi & UMKM Warga": "Resident Potential & Small Businesses",
  "Dukung produk lokal dari tetangga kita sendiri. Kualitas terbaik, harga terjangkau.": "Support quality local products from our own neighbors.",
  "Hubungi via WA": "Contact via WhatsApp", "Profil RW KITA": "RW KITA Profile",
  "Mengenal lebih dekat tata kelola, visi, dan sejarah lingkungan kita yang mandiri dan berdaya.": "Discover our governance, vision, and the history of our independent, empowered neighborhood.",
  "Visi Kami": "Our Vision", "Misi Strategis": "Strategic Missions", "Struktur Organisasi": "Organization Structure",
  "Periode Jabatan 2023 - 2028": "Term of Office 2023 - 2028", "Ketua RW": "RW Chairperson", "Sekretaris": "Secretary", "Bendahara": "Treasurer",
  "Sejarah RW KITA": "History of RW KITA", "Dasar Hukum Operasional": "Legal Basis of Operations", "Unduh Dokumen": "Download Documents",
  "Berita & Informasi": "News & Information", "Kabar terbaru, pengumuman, dan agenda kegiatan RW KITA.": "Latest news, announcements, and RW KITA activity schedules.",
  "Informasi resmi RW KITA untuk seluruh warga.": "Official RW KITA information for all residents.", "Baca selengkapnya →": "Read more →",
  "Temukan produk dan layanan unggulan dari warga RW KITA.": "Discover excellent products and services from RW KITA residents.",
  "Produk dan layanan unggulan warga RW KITA.": "Excellent products and services from RW KITA residents.",
  "Arsip Digital & Produk Hukum": "Digital Archives & Legal Products", "Akses dokumen resmi, peraturan, dan arsip lingkungan secara transparan.": "Transparently access official documents, regulations, and neighborhood archives.",
  "Semua Dokumen": "All Documents", "Produk Hukum": "Legal Products", "Administrasi": "Administration", "Laporan & Keuangan": "Reports & Finance", "Panduan Warga": "Resident Guides",
  "Unduh": "Download", "Kontak & Layanan Darurat": "Contacts & Emergency Services",
  "Informasi kontak penting untuk kebutuhan warga dan situasi darurat.": "Important contacts for resident needs and emergency situations.",
  "LAYANAN DARURAT": "EMERGENCY SERVICE", "Butuh Bantuan Mendesak?": "Need Urgent Help?",
  "Hubungi melalui WhatsApp": "Contact via WhatsApp", "Kantor Sekretariat": "Secretariat Office", "Keamanan Lingkungan": "Neighborhood Security",
  "Kesehatan & Posyandu": "Health & Community Care", "LOKASI SEKRETARIAT": "SECRETARIAT LOCATION", "Peta RW KITA": "RW KITA Map",
  "Buka Petunjuk Arah →": "Open Directions →", "Masuk ke Akun Anda": "Sign In to Your Account",
  "Silakan lengkapi detail login untuk melanjutkan akses portal.": "Enter your login details to continue to the portal.",
  "Masuk": "Sign In", "Daftar Baru": "Register", "ALAMAT EMAIL": "EMAIL ADDRESS", "KATA SANDI": "PASSWORD",
  "Lupa Sandi?": "Forgot Password?", "SEBAGAI SIAPA?": "SIGN IN AS", "Warga": "Resident", "Pengurus": "Administrator",
  "Ingat saya di perangkat ini": "Remember me on this device", "Masuk ke Portal": "Enter Portal", "ATAU MASUK DENGAN": "OR SIGN IN WITH",
  "Buat Akun Baru": "Create a New Account", "Lengkapi data diri Anda untuk bergabung.": "Complete your personal details to join.",
  "Daftar Sekarang  →": "Register Now  →", "Sudah punya akun?": "Already have an account?", "Masuk di sini": "Sign in here"
};

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>("id");
  useEffect(() => {
    const saved = localStorage.getItem("rw_kita_language");
    if (saved === "id" || saved === "en") setLanguageState(saved);
  }, []);
  useEffect(() => {
    const reverse = Object.fromEntries(Object.entries(translations).map(([id, en]) => [en, id]));
    const applyTranslation = (root: Node) => {
      if (root.nodeType === Node.TEXT_NODE) {
        const raw = root.nodeValue || "";
        const value = raw.trim();
        const translated = language === "en" ? translations[value] : reverse[value];
        if (translated) root.nodeValue = raw.replace(value, translated);
        return;
      }
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let node: Node | null;
      while ((node = walker.nextNode())) {
        const raw = node.nodeValue || "";
        const value = raw.trim();
        const translated = language === "en" ? translations[value] : reverse[value];
        if (translated) node.nodeValue = raw.replace(value, translated);
      }
      document.querySelectorAll<HTMLInputElement>("input[placeholder]").forEach(input => {
        const value = input.placeholder;
        if (language === "en" && value === "Cari data...") input.placeholder = "Search data...";
        if (language === "id" && value === "Search data...") input.placeholder = "Cari data...";
      });
    };
    applyTranslation(document.body);
    const observer = new MutationObserver(mutations => mutations.forEach(mutation => mutation.addedNodes.forEach(node => applyTranslation(node))));
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [language]);
  function setLanguage(next: Language) {
    setLanguageState(next);
    localStorage.setItem("rw_kita_language", next);
    document.documentElement.lang = next;
  }
  const value = useMemo(() => ({ language, setLanguage, text: (id: string, en: string) => language === "id" ? id : en }), [language]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage harus digunakan di dalam LanguageProvider");
  return context;
}
