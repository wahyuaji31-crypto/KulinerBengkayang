# Website Kuliner Bengkayang & Nusantara

Website pemesanan kuliner online modern, cepat, dan responsif yang dilengkapi dengan katalog foto makanan beresolusi tinggi, harga, sistem keranjang belanja interaktif, kalkulasi diskon voucher otomatis, serta fitur checkout langsung ke **WhatsApp Penjual** dan cetak **Struk / Invoice Digital** beserta **QRIS Instant**.

---

## 🚀 Fitur Unggulan

1. **Katalog Menu Lengkap & Foto Menggugah Selera**:
   - Menampilkan aneka hidangan khas (Mie Tiaw Sapi, Bubur Pedas Kalbar, Choi Pan Bengkuang/Kucai, Ayam Bakar Madu, Pengkang Bakar Sambal Kepah, Roti Srikaya, Es Jeruk Sambas, Es Lidah Buaya, Kopi Aren, dll).
   - Filter Kategori cepat: *Semua Menu*, *Makanan Berat*, *Cemilan & Kudapan*, *Minuman Segar*, dan *Paket Hemat*.
   - Fitur *Live Search* pencarian menu instan.
2. **Kustomisasi Pesanan (Modal Detail)**:
   - Pilihan varian rasa / isian.
   - Pilihan level kepedasan / sambal.
   - Pilihan ekstra topping (Telur ceplok, Ekstra daging, Telur puyuh, dll).
   - Catatan khusus per hidangan (misal: "kuah dipisah", "less sugar").
3. **Keranjang Belanja Pintar (Cart Drawer)**:
   - Tambah/kurang jumlah porsi secara dinamis.
   - Fitur Kupon Diskon Voucher (`DISKON10`, `GRATISONGKIR`, `HEMAT5K`).
   - Kalkulasi otomatis Subtotal, Diskon, Ongkos Kirim, dan Grand Total.
4. **Checkout Terpadu (WhatsApp & Invoice Digital)**:
   - Pilihan metode pengantaran: **Delivery (Antar ke Alamat)**, **Dine In (Makan di Tempat)**, dan **Take Away (Bungkus)**.
   - Pilihan metode pembayaran: **QRIS Instant**, **Transfer Bank (BCA / BRI / Mandiri)**, dan **COD / Bayar di Tempat**.
   - **Checkout WhatsApp**: Mengirimkan format teks pesanan yang sangat rapi dan lengkap langsung ke nomor WhatsApp penjual.
   - **Struk Digital / Invoice**: Dilengkapi fitur cetak (*print receipt*) dan scan QRIS interaktif.
5. **Panel Pengaturan Penjual (Admin Quick Setting)**:
   - Tombol roda gigi ⚙️ di pojok kanan atas untuk mengganti nomor WhatsApp penerima pesanan, nama toko, alamat, dan ongkir default tanpa perlu mengubah kode. Data tersimpan di browser (`localStorage`).

---

## 💻 Cara Menjalankan Website

1. **Buka Langsung di Browser**:
   - Cukup klik dua kali (double click) file `index.html` pada folder `KulinerBengkayang`. Website langsung berjalan seketika di Google Chrome, Microsoft Edge, Firefox, atau Safari.

2. **Atau Menggunakan Local Web Server**:
   Jika Anda memiliki Python, Node.js, atau ekstensi VS Code Live Server:
   ```bash
   # Menggunakan Python
   python -m http.server 8000
   ```
   Lalu buka browser di `http://localhost:8000`.

---

## 📁 Struktur File

```
KulinerBengkayang/
├── index.html          # Halaman utama aplikasi & modal checkout
├── README.md           # Panduan penggunaan
├── css/
│   └── custom.css      # Styling khusus, animasi, font, & print struk
└── js/
    ├── data.js         # Data katalog menu, foto makanan, harga, dan konfigurasi toko
    └── app.js          # Logika keranjang belanja, kalkulator pesanan, modal, & integrasi WA
```
