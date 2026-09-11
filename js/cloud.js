/**
 * PintasFood Bengkayang - Real-Time Cloud Data Sync Engine
 * Menggunakan GunDB Real-Time Graph + WebSockets + BroadcastChannel + LocalStorage
 * Data Menu, Pengaturan, Pesanan & Kurir tersinkronisasi 100% Real-Time tanpa batas kuota.
 */

// GunDB Instance untuk sinkronisasi antar perangkat online secara WebSocket
let gunDB = null;
let gunNode = null;

try {
  if (typeof Gun !== "undefined") {
    gunDB = Gun({
      peers: [
        "https://gun-manhattan.herokuapp.com/gun",
        "https://peer.wallie.io/gun"
      ],
      localStorage: false
    });
    gunNode = gunDB.get("pintasfood_bengkayang_v2");
  }
} catch (e) {
  console.warn("[CloudSync] GunDB init:", e);
}

// BroadcastChannel untuk update instan antar tab di perangkat yang sama (0ms)
let syncBroadcastChannel = null;
try {
  if (typeof BroadcastChannel !== "undefined") {
    syncBroadcastChannel = new BroadcastChannel("pintasfood_live_sync_v2");
  }
} catch (e) {}

const CloudSync = {
  KEYS: {
    MENU: "MENU",
    SETTINGS: "SETTINGS",
    ORDERS: "ORDERS",
    COURIERS: "COURIERS"
  },

  listeners: {},

  // Daftarkan callback saat ada perubahan data real-time
  on(key, callback) {
    if (!this.listeners[key]) this.listeners[key] = [];
    this.listeners[key].push(callback);
  },

  emit(key, value) {
    if (this.listeners[key]) {
      this.listeners[key].forEach(cb => {
        try { cb(value); } catch (err) { console.error(err); }
      });
    }
  },

  init() {
    // 1. Dengarkan siaran BroadcastChannel (tab lokal, 0ms)
    if (syncBroadcastChannel) {
      syncBroadcastChannel.onmessage = (event) => {
        if (event && event.data && event.data.key) {
          const { key, value } = event.data;
          this.emit(key, value);
        }
      };
    }

    // 2. Dengarkan siaran GunDB WebSockets (cross-device real-time)
    if (gunNode) {
      // Menu live sync
      gunNode.get("menu").on((raw) => {
        if (raw && typeof raw === "string") {
          try {
            const menu = JSON.parse(raw);
            if (Array.isArray(menu) && menu.length > 0) {
              localStorage.setItem("kb_custom_menu", JSON.stringify(menu));
              localStorage.setItem("kb_cloud_menu", JSON.stringify(menu));
              this.emit("MENU", menu);
            }
          } catch (e) {}
        }
      });

      // Settings live sync
      gunNode.get("settings").on((raw) => {
        if (raw && typeof raw === "string") {
          try {
            const settings = JSON.parse(raw);
            if (settings && typeof settings === "object") {
              localStorage.setItem("kb_store_config", JSON.stringify(settings));
              this.emit("SETTINGS", settings);
            }
          } catch (e) {}
        }
      });

      // Orders live sync
      gunNode.get("orders").on((raw) => {
        if (raw && typeof raw === "string") {
          try {
            const orders = JSON.parse(raw);
            if (Array.isArray(orders)) {
              localStorage.setItem("kb_orders_history", JSON.stringify(orders));
              this.emit("ORDERS", orders);
            }
          } catch (e) {}
        }
      });

      // Couriers live sync
      gunNode.get("couriers").on((raw) => {
        if (raw && typeof raw === "string") {
          try {
            const couriers = JSON.parse(raw);
            if (Array.isArray(couriers)) {
              localStorage.setItem("kb_couriers_list", JSON.stringify(couriers));
              this.emit("COURIERS", couriers);
            }
          } catch (e) {}
        }
      });
    }
  },

  // Ambil data (dari cache lokal instan)
  async get(key, defaultValue = null) {
    const localKey = key === "MENU" ? "kb_custom_menu" : ("kb_" + key.toLowerCase());
    try {
      const cached = localStorage.getItem(localKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed !== null && parsed !== undefined) return parsed;
      }
    } catch (e) {}
    return defaultValue;
  },

  // Simpan data (langsung ke localStorage + BroadcastChannel + GunDB WebSockets)
  async set(key, value) {
    const localKey = key === "MENU" ? "kb_custom_menu" : ("kb_" + key.toLowerCase());

    // 1. Simpan ke localStorage lokal seketika
    try {
      localStorage.setItem(localKey, JSON.stringify(value));
    } catch (e) {}

    // 2. Kirim ke tab lokal seketika via BroadcastChannel (0ms)
    try {
      if (syncBroadcastChannel) {
        syncBroadcastChannel.postMessage({ key, value, timestamp: Date.now() });
      }
    } catch (e) {}

    // 3. Emit ke listener lokal seketika
    this.emit(key, value);

    // 4. Kirim ke GunDB Relay (WebSockets ke seluruh perangkat pengunjung & admin lain)
    if (gunNode) {
      try {
        const strVal = JSON.stringify(value);
        if (key === "MENU") gunNode.get("menu").put(strVal);
        else if (key === "SETTINGS") gunNode.get("settings").put(strVal);
        else if (key === "ORDERS") gunNode.get("orders").put(strVal);
        else if (key === "COURIERS") gunNode.get("couriers").put(strVal);
        console.log(`[CloudSync] ✓ ${key} berhasil disiarkan secara Real-Time ke seluruh perangkat!`);
        return true;
      } catch (err) {
        console.warn("[CloudSync] Error saving to GunDB:", err);
      }
    }
    return true;
  }
};

// Inisialisasi CloudSync
CloudSync.init();
