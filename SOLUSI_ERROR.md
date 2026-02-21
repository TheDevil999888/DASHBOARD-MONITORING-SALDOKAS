# SOLUSI "SYNC ERROR" (AKSES DITOLAK)

Penyebab paling umum "Sync Error" adalah Database masih terkunci (Locked). Anda harus membukanya agar bisa diakses.

## CARA MEMPERBAIKI (Wajib Dilakukan):

1. Buka kembali [Firebase Console](https://console.firebase.google.com/).
2. Pilih Project Anda ("bank-dashboard...").
3. Di menu kiri, klik **Build** -> **Realtime Database**.
   *(Pastikan Anda memilih Realtime Database, BUKAN Firestore).*
4. Klik tab **Rules** (di bagian atas, sebelah Data).
5. Ganti kode di dalamnya menjadi seperti ini (Copy-Paste):

```json
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```

6. Klik tombol **Publish**.

---

## JIKA MASIH ERROR:
Pastikan Anda telah membuat **Realtime Database**, bukan Firestore Database.
1. Cek di menu kiri, klik "Realtime Database".
2. Jika diminta "Create Database", buatlah dulu.
3. Setelah dibuat, pastikan linknya muncul di tab "Data" (misal: `https://bank-dashboard-81930...firebaseio.com/`).

Setelah Rules diubah menjadi `true`, coba Refresh Dashboard di PC Anda. Status harusnya berubah menjadi "LIVE SERVER".
