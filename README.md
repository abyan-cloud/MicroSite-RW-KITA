# RW KITA

Frontend berada di folder Frontend dan backend API berada di folder Backend.

## Persiapan MySQL

MySQL tetap menjadi database utama. Jika **MySQL Server** belum tersedia pada port `3306`, backend otomatis memakai penyimpanan lokal persisten `Backend/data/users.json` agar register dan login tetap dapat digunakan untuk pengembangan. File tersebut diabaikan oleh Git dan kata sandi tetap disimpan sebagai hash bcrypt.

Saat MySQL Server tersedia, backend akan membuat database `rw_kita` dan tabel `users` dari `Backend/schema.sql` secara otomatis.

### Import manual lewat MySQL Workbench

File siap import berada di `Backend/mysql-import.sql`. File ini membuat database `rw_kita` beserta tabel:

- `users` dan `user_profiles` untuk akun serta pengaturan profil;
- `aspirations` untuk aspirasi warga dan moderasi pengurus;
- `service_requests` untuk pengajuan dan pelacakan layanan;
- `residents` untuk data kependudukan;
- `announcements` dan `documents` untuk berita serta arsip.

Cara import:

1. Aktifkan **MySQL Server** (bukan hanya membuka MySQL Workbench).
2. Di Workbench pilih **File > Open SQL Script** lalu buka `Backend/mysql-import.sql`.
3. Klik ikon petir **Execute All**.
4. Ubah `DB_USER` dan `DB_PASSWORD` pada `Backend/.env` sesuai akun MySQL Anda.
5. Restart backend dengan `npm run dev`, lalu buka `http://localhost:5000/api/health`.

Jika berhasil, respons health menampilkan `"mode":"mysql"` dan `"mysql":true`. Data fallback lokal tidak dipindahkan otomatis ke MySQL; setelah MySQL aktif, buat akun kembali melalui halaman Register.

Sesuaikan konfigurasi `Backend/.env`:

```env
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=password-root-mysql
DB_NAME=rw_kita
DB_FALLBACK=local
JWT_SECRET=ganti-dengan-rangkaian-acak-yang-panjang
PENGURUS_REGISTRATION_CODE=ganti-dengan-kode-rahasia-pengurus
```

## Menjalankan aplikasi

Jalankan backend dari folder `Backend`:

```powershell
npm install
npm run dev
```

Backend proyek ini menggunakan `server.js`. Jangan menjalankan `npx nodemon src/app.js` karena file tersebut tidak ada dalam struktur proyek.
Gunakan `npm run dev:watch` hanya jika membutuhkan restart otomatis ketika file backend diubah.

Jalankan frontend dari folder `Frontend` pada terminal lain:

```powershell
npm install
npm run dev
```

Cek koneksi backend dan database melalui `http://localhost:5000/api/health`. Nilai `database` harus `connected`. Properti `mode` akan berisi `mysql` atau `local` sesuai penyimpanan yang sedang aktif.

## Login Google dan Facebook

OAuth sudah terhubung ke database pengguna. Akun Google/Facebook yang masuk pertama kali otomatis dibuat sebagai **Warga**. Client secret hanya boleh disimpan di `Backend/.env` atau environment hosting dan tidak boleh dipush ke GitHub.

### Google

1. Buat OAuth Client dengan tipe **Web application** di Google Cloud Console.
2. Atur OAuth consent screen dan tambahkan akun penguji selama aplikasi masih berstatus Testing.
3. Tambahkan Authorized redirect URI lokal berikut secara persis:
   `http://localhost:5000/api/auth/google/callback`
4. Isi `GOOGLE_CLIENT_ID` dan `GOOGLE_CLIENT_SECRET` di `Backend/.env`.

### Facebook

1. Buat aplikasi di Meta for Developers dan aktifkan produk **Facebook Login**.
2. Tambahkan Valid OAuth Redirect URI lokal berikut secara persis:
   `http://localhost:5000/api/auth/facebook/callback`
3. Isi `FACEBOOK_APP_ID` dan `FACEBOOK_APP_SECRET` di `Backend/.env`.
4. Selama aplikasi Meta masih mode Development, gunakan akun Administrator, Developer, atau Tester aplikasi.

Untuk production, ubah `FRONTEND_URL` dan `BACKEND_URL` ke domain HTTPS yang sebenarnya, lalu daftarkan kedua callback production yang ditampilkan backend. Restart backend dan periksa `http://localhost:5000/api/auth/providers`; nilai `google` dan `facebook` harus `true`.

Sebelum deployment, ganti `JWT_SECRET` dengan nilai acak yang kuat. Untuk mencegah warga membuat akun admin, isi `PENGURUS_REGISTRATION_CODE` dan bagikan kode tersebut hanya kepada pengurus resmi. Akun Warga tidak membutuhkan kode ini.

Akun OAuth baru dibuat sebagai Warga. Pengurus dibuat melalui pendaftaran biasa agar akses pengurus terkendali.
