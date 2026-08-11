# RW KITA

Proyek dipisahkan menjadi dua aplikasi:

- Frontend: Next.js, TypeScript, dan Tailwind untuk UI login/register.
- Backend: Express dan SQLite untuk API autentikasi serta database pengguna.

## Jalankan backend

1. Masuk ke folder Backend.
2. Salin .env.example menjadi .env bila belum ada.
3. Jalankan npm install.
4. Jalankan npm run dev.

Server API berjalan di http://localhost:5000 dan akan membuat rw-kita.db secara otomatis.

## Jalankan frontend

1. Masuk ke folder Frontend.
2. Salin .env.local.example menjadi .env.local.
3. Jalankan npm install.
4. Jalankan npm run dev.

Buka http://localhost:3000. Pendaftaran menyimpan password dalam bentuk hash bcrypt di database SQLite; setelah berhasil daftar, pengguna langsung masuk ke portal.
