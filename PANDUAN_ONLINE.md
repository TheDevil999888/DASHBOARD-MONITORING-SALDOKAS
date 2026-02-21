# PANDUAN SETUP DATA ONLINE (FIREBASE)

Agar dashboard bisa update otomatis di semua PC, ikuti langkah ini:

## 1. Buat Database Gratis di Google
1. Buka [Firebase Console](https://console.firebase.google.com/).
2. Klik **"Add project"** (Beri nama bebas, misal "Bank Dashboard").
3. Matikan "Google Analytics" (tidak perlu), lalu klik **Create Project**.
4. Setelah jadi, klik menu **"Build"** -> **"Realtime Database"** di menu kiri.
5. Klik **"Create Database"**.
   - Lokasi: Pilih (Singapore/US bebas).
   - Security Rules: Pilih **"Start in Test Mode"** (PENTING: supaya bisa baca/tulis langsung).
   - Klik **Enable**.

## 2. Ambil Kunci Rahasia
1. Klik icon **Gear (Pengaturan)** di samping "Project Overview" (kiri atas) -> **Project settings**.
2. Scroll ke paling bawah bagian "Your apps".
3. Klik icon **`</>` (Web)**.
4. Beri nama app (misal "Dashboard"), klik **Register app**.
5. Anda akan melihat kode `const firebaseConfig = { ... }`.

## 3. Pasang di Dashboard
1. Buka file `firebase-config.js` di folder dashboard Anda.
2. Ganti tulisan `apiKey: "GANTI_DENGAN_API_KEY_ANDA",` dan seterusnya dengan kode yang Anda copy dari langkah 2.
3. Save file.

## Cara Kerja
- **PC UTAMA (MASTER)**: PC yang memiliki file `data.json` (hasil ekstensi/edit manual). Saat dashboard dibuka di sini, ia akan membaca `data.json` dan **OTOMATIS MENGIRIM (BROADCAST)** datanya ke Server Google.
- **PC LAIN (CLIENT)**: PC lain cukup buka dashboard (tanpa perlu `data.json`). Mereka akan **OTOMATIS MENERIMA** data dari Server Google secara Live.

**Selesai!** Sekarang semua PC akan sinkron.
