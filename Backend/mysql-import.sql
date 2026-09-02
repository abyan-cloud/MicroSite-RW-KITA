CREATE DATABASE IF NOT EXISTS rw_kita
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE rw_kita;

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  full_name VARCHAR(150) NOT NULL,
  nik VARCHAR(40) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(30) NOT NULL,
  role ENUM('WARGA', 'PENGURUS') NOT NULL DEFAULT 'WARGA',
  password_hash VARCHAR(255) NOT NULL,
  oauth_provider VARCHAR(30) NULL,
  oauth_id VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY users_nik_unique (nik),
  UNIQUE KEY users_email_unique (email),
  UNIQUE KEY users_oauth_unique (oauth_provider, oauth_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_profiles (
  user_id BIGINT UNSIGNED NOT NULL,
  address VARCHAR(255) NULL,
  rt_number VARCHAR(3) NULL,
  bio VARCHAR(500) NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  CONSTRAINT profiles_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS aspirations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(160) NOT NULL,
  category ENUM('LINGKUNGAN','KEAMANAN','INFRASTRUKTUR','SOSIAL','LAINNYA') NOT NULL DEFAULT 'LAINNYA',
  description TEXT NOT NULL,
  status ENUM('MENUNGGU','DIPROSES','SELESAI','DITOLAK') NOT NULL DEFAULT 'MENUNGGU',
  admin_response TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY aspirations_user_idx (user_id),
  CONSTRAINT aspirations_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS service_requests (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  service_type VARCHAR(120) NOT NULL,
  tracking_code VARCHAR(40) NOT NULL,
  status ENUM('MENUNGGU','DIPROSES','SELESAI','DITOLAK') NOT NULL DEFAULT 'MENUNGGU',
  notes VARCHAR(500) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY service_tracking_unique (tracking_code),
  KEY services_user_idx (user_id),
  CONSTRAINT services_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS residents (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  full_name VARCHAR(150) NOT NULL,
  nik VARCHAR(40) NOT NULL,
  phone VARCHAR(30) NULL,
  address VARCHAR(255) NULL,
  rt_number VARCHAR(3) NULL,
  status ENUM('AKTIF','PINDAH','MENUNGGU') NOT NULL DEFAULT 'AKTIF',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY residents_nik_unique (nik)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS announcements (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  title VARCHAR(180) NOT NULL,
  category VARCHAR(50) NOT NULL,
  summary VARCHAR(500) NOT NULL,
  content TEXT NOT NULL,
  published BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS documents (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  title VARCHAR(180) NOT NULL,
  category VARCHAR(80) NOT NULL,
  file_path VARCHAR(255) NOT NULL,
  published BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO residents (full_name, nik, phone, address, rt_number, status) VALUES
('Bambang Susilo', '3175090101010001', '081211110001', 'Blok A2 No. 14', '01', 'AKTIF'),
('Ratna Permata', '3175090101010002', '081211110002', 'Blok C5 No. 09', '02', 'AKTIF'),
('Dedi Kusnadi', '3175090101010003', '081211110003', 'Blok B1 No. 02', '03', 'MENUNGGU');

INSERT INTO announcements (title, category, summary, content)
SELECT 'Kerja Bakti Massal Persiapan Musim Penghujan', 'KEGIATAN', 'Gotong royong membersihkan lingkungan.', 'Kegiatan dilaksanakan bersama seluruh RT.'
WHERE NOT EXISTS (SELECT 1 FROM announcements WHERE title = 'Kerja Bakti Massal Persiapan Musim Penghujan');

INSERT INTO documents (title, category, file_path)
SELECT 'AD/ART RW KITA Tahun 2023', 'Produk Hukum', '/documents/ad-art-rw-kita.txt'
WHERE NOT EXISTS (SELECT 1 FROM documents WHERE title = 'AD/ART RW KITA Tahun 2023');
