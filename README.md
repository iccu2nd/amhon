# GitHub Importer V3 — Struktur Ringkas

Dashboard untuk import ZIP, update repository, melihat daftar repository, dan menghapus repository GitHub. Siap deploy ke Vercel.

## Struktur folder

```text
github-importer/
├── api/
│   ├── import.js
│   └── repos.js
├── lib/
│   └── github.js
├── public/
│   ├── index.html
│   ├── style.css
│   └── app.js
├── .env.example
├── .gitignore
├── package.json
└── vercel.json
```

Hanya 3 folder utama: `api`, `lib`, dan `public`.

## Deploy
1. Upload isi folder ini ke repository GitHub baru.
2. Import repository ke https://vercel.com/new.
3. Tambahkan Environment Variables:
   - `GITHUB_TOKEN`: token GitHub baru.
   - `GITHUB_USERNAME`: username GitHub.
   - `ADMIN_PASSWORD`: password dashboard minimal 8 karakter.
4. Deploy.

## Token GitHub
Jangan taruh token di source code. Jika token pernah dibagikan, revoke token itu dan buat yang baru. Gunakan token dengan izin yang diperlukan untuk mengelola repository dan contents. Untuk membuat repository baru, token harus memiliki izin administrasi yang sesuai.

## Mode upload
- **Gabungkan / Update**: file dengan path yang sama diperbarui; file lama lain tetap ada.
- **Ganti Semua**: root tree commit terbaru dibuat hanya dari isi ZIP. File lama yang tidak ada di ZIP tidak muncul lagi pada versi terbaru. Riwayat commit lama tetap ada.

## Batasan
- ZIP maksimal 4 MB.
- Maksimal 250 file.
- Total hasil ekstrak maksimal 30 MB.
- Upload memakai GitHub Git Trees API, sehingga project besar atau jumlah file sangat banyak mungkin melewati batas waktu serverless/API.
- Untuk repository yang sudah ada, pilihan Public/Private tidak mengubah visibilitas repository.
- Isi ZIP ditempatkan sesuai struktur path di dalam ZIP.