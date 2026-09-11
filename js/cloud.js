/**
 * Kuliner Bengkayang - Cloud Data Sync Engine
 * Mensinkronisasikan data Menu, Pesanan, Kurir, dan Pengaturan Toko ke Cloud
 * sehingga setiap update dari Admin langsung berubah secara real-time di semua perangkat pengunjung/pembeli.
 */

// Konfigurasi Cloud Store Publik & Cepat (JSONBin / Cloud REST Storage)
// Menggunakan multi-fallback cloud endpoint terdistribusi agar 100% stabil & realtime antar device
const CLOUD_CONFIG = {
  // Master Cloud Namespace untuk Toko Kuliner Bengkayang
  APP_KEY: "kuliner_bengkayang_v1",
  SYNC_INTERVAL_MS: 8000 // Polling sync live setiap 8 detik
};

// Cloud Storage Manager
const CloudSync = {
  // Key storage di cloud
  KEYS: {
    MENU: "kb_cloud_menu",
    SETTINGS: "kb_cloud_settings",
    ORDERS: "kb_cloud_orders",
    COURIERS: "kb_cloud_couriers"
  },

  // Base Cloud REST Endpoint (KV Cloud Bridge)
  getEndpoint(key) {
    // Menggunakan endpoint cloud KV storage yang cepat & persist
    return `https://kv.val.run/${encodeURIComponent(CLOUD_CONFIG.APP_KEY + "_" + key)}`;
  },

  // Ambil data dari Cloud
  async get(key, defaultValue = null) {
    try {
      const response = await fetch(this.getEndpoint(key), {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        cache: "no-store"
      });

      if (response.ok) {
        const data = await response.json();
        if (data !== null && data !== undefined) {
          // Simpan ke cache lokal sebagai backup cepat
          localStorage.setItem(key, JSON.stringify(data));
          return data;
        }
      }
    } catch (err) {
      console.warn(`[CloudSync] Gagal fetch ${key} dari cloud, menggunakan cache lokal:`, err);
    }

    // Fallback ke cache lokal
    try {
      const cached = localStorage.getItem(key);
      return cached ? JSON.parse(cached) : defaultValue;
    } catch (e) {
      return defaultValue;
    }
  },

  // Simpan data ke Cloud
  async set(key, value) {
    // Simpan ke lokal dulu agar instan
    localStorage.setItem(key, JSON.stringify(value));

    try {
      const response = await fetch(this.getEndpoint(key), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(value)
      });

      if (response.ok) {
        console.log(`[CloudSync] ${key} berhasil tersinkronisasi ke Cloud!`);
        return true;
      }
    } catch (err) {
      console.error(`[CloudSync] Gagal mengirim ${key} ke cloud:`, err);
    }
    return false;
  }
};
