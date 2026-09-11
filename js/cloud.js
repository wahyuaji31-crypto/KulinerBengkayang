/**
 * PintasFood Bengkayang - Real-Time Cloud Data Sync Engine
 * Hybrid Multi-Tier Cloud Sync:
 * 1. Vercel Serverless API (/api/sync) backed by GitHub Gist Cloud Database (100% persistent, high-speed, cross-device mobile support)
 * 2. Direct Public Gist Raw Read Fallback (for static preview or offline)
 * 3. BroadcastChannel (0ms instant cross-tab sync)
 * 4. GunDB WebSockets (decentralized live sync)
 * 5. LocalStorage Cache (instant offline load)
 */

const CLOUD_CONFIG = {
  API_ENDPOINT: "/api/sync",
  GIST_RAW_URL: "https://gist.githubusercontent.com/wahyuaji31-crypto/4ed449e96ee2d8eefb6126f4ba0ede3b/raw/pintasfood_data.json",
  POLL_INTERVAL_MS: 3500
};

// GunDB Instance (Optional Layer)
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

// BroadcastChannel untuk update instan antar tab (0ms)
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
  lastKnownUpdatedAt: 0,
  isPolling: false,

  // Daftarkan callback saat ada update data real-time
  on(key, callback) {
    if (!this.listeners[key]) this.listeners[key] = [];
    this.listeners[key].push(callback);
  },

  emit(key, value) {
    if (this.listeners[key]) {
      this.listeners[key].forEach(cb => {
        try { cb(value); } catch (err) { console.error("[CloudSync Callback Error]", err); }
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

    // 2. Dengarkan siaran GunDB WebSockets
    if (gunNode) {
      gunNode.get("menu").on((raw) => {
        if (raw && typeof raw === "string") {
          try {
            const menu = JSON.parse(raw);
            if (Array.isArray(menu) && menu.length > 0) {
              localStorage.setItem("kb_custom_menu", JSON.stringify(menu));
              this.emit("MENU", menu);
            }
          } catch (e) {}
        }
      });

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

    // 3. Mulai Polling Cloud Data Real-Time
    this.startAutoSync();

    // 4. Trigger sync ketika user kembali membuka tab browser di HP
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        this.fetchAllFromCloud(true);
      }
    });
  },

  // Helper untuk mendapatkan key storage lokal
  getLocalKey(key) {
    if (key === "MENU") return "kb_custom_menu";
    if (key === "SETTINGS") return "kb_store_config";
    if (key === "ORDERS") return "kb_orders_history";
    if (key === "COURIERS") return "kb_couriers_list";
    return "kb_" + key.toLowerCase();
  },

  // Ambil data (dari Cache Lokal, lalu background update dari Cloud)
  async get(key, defaultValue = null) {
    const localKey = this.getLocalKey(key);
    let result = defaultValue;

    // Baca dari cache lokal dulu agar instant UI render (0ms)
    try {
      const cached = localStorage.getItem(localKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed !== null && parsed !== undefined) result = parsed;
      }
    } catch (e) {}

    // Coba ambil dari cloud secara asynchronous
    try {
      const remote = await this.fetchKeyFromCloud(key);
      if (remote !== null && remote !== undefined) {
        localStorage.setItem(localKey, JSON.stringify(remote));
        return remote;
      }
    } catch (e) {}

    return result;
  },

  // Simpan data (Lokal + Broadcast + Cloud API Vercel)
  async set(key, value) {
    const localKey = this.getLocalKey(key);

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

    // 4. Kirim ke GunDB WebSockets
    if (gunNode) {
      try {
        const strVal = JSON.stringify(value);
        if (key === "MENU") gunNode.get("menu").put(strVal);
        else if (key === "SETTINGS") gunNode.get("settings").put(strVal);
        else if (key === "ORDERS") gunNode.get("orders").put(strVal);
        else if (key === "COURIERS") gunNode.get("couriers").put(strVal);
      } catch (err) {}
    }

    // 5. Kirim ke Vercel Serverless API (/api/sync)
    try {
      const cloudSuccess = await this.pushToCloud(key, value);
      if (cloudSuccess) {
        console.log(`[CloudSync] ✓ ${key} tersimpan permanen di Cloud!`);
        return true;
      }
    } catch (err) {
      console.warn(`[CloudSync] Gagal push ${key} ke cloud:`, err);
    }

    return true;
  },

  // Push ke Cloud API
  async pushToCloud(key, data) {
    const payload = { key, data, updatedAt: Date.now() };

    try {
      const res = await fetch(`${CLOUD_CONFIG.API_ENDPOINT}?t=${Date.now()}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const resData = await res.json();
        if (resData.updatedAt) this.lastKnownUpdatedAt = resData.updatedAt;
        return true;
      }
    } catch (e) {
      console.warn("[CloudSync Push Error]:", e);
    }

    return false;
  },

  // Fetch satu key dari Cloud
  async fetchKeyFromCloud(key) {
    const k = key.toLowerCase();
    // 1. Coba /api/sync?key=...
    try {
      const res = await fetch(`${CLOUD_CONFIG.API_ENDPOINT}?key=${k}&t=${Date.now()}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data !== undefined && json.data !== null) {
          if (json.updatedAt) this.lastKnownUpdatedAt = json.updatedAt;
          return json.data;
        }
      }
    } catch (e) {}

    // 2. Direct Public Gist Raw Fallback
    try {
      const gistRes = await fetch(`${CLOUD_CONFIG.GIST_RAW_URL}?t=${Date.now()}`);
      if (gistRes.ok) {
        const parsed = await gistRes.json();
        if (parsed.updatedAt) this.lastKnownUpdatedAt = parsed.updatedAt;
        return parsed[k] !== undefined ? parsed[k] : null;
      }
    } catch (e) {}

    return null;
  },

  // Fetch seluruh data dari Cloud dan perbarui LocalStorage + emit events
  async fetchAllFromCloud(force = false) {
    let cloudData = null;

    // 1. Coba /api/sync
    try {
      const res = await fetch(`${CLOUD_CONFIG.API_ENDPOINT}?t=${Date.now()}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          cloudData = json.data;
        }
      }
    } catch (e) {}

    // 2. Coba Direct Public Gist Raw jika API tidak tersedia
    if (!cloudData) {
      try {
        const gistRes = await fetch(`${CLOUD_CONFIG.GIST_RAW_URL}?t=${Date.now()}`);
        if (gistRes.ok) {
          cloudData = await gistRes.json();
        }
      } catch (e) {}
    }

    if (!cloudData) return false;

    const cloudUpdatedAt = cloudData.updatedAt || 0;
    if (!force && cloudUpdatedAt > 0 && cloudUpdatedAt <= this.lastKnownUpdatedAt) {
      // Data belum berubah di cloud
      return false;
    }

    this.lastKnownUpdatedAt = cloudUpdatedAt;

    // 1. Sync Menu
    if (Array.isArray(cloudData.menu) && cloudData.menu.length > 0) {
      const currentMenu = localStorage.getItem("kb_custom_menu");
      if (JSON.stringify(cloudData.menu) !== currentMenu) {
        localStorage.setItem("kb_custom_menu", JSON.stringify(cloudData.menu));
        this.emit("MENU", cloudData.menu);
      }
    }

    // 2. Sync Store Config / Settings
    if (cloudData.settings && typeof cloudData.settings === "object" && Object.keys(cloudData.settings).length > 0) {
      const currentConfig = localStorage.getItem("kb_store_config");
      if (JSON.stringify(cloudData.settings) !== currentConfig) {
        localStorage.setItem("kb_store_config", JSON.stringify(cloudData.settings));
        this.emit("SETTINGS", cloudData.settings);
      }
    }

    // 3. Sync Orders
    if (Array.isArray(cloudData.orders)) {
      const currentOrders = localStorage.getItem("kb_orders_history");
      if (JSON.stringify(cloudData.orders) !== currentOrders) {
        localStorage.setItem("kb_orders_history", JSON.stringify(cloudData.orders));
        this.emit("ORDERS", cloudData.orders);
      }
    }

    // 4. Sync Couriers
    if (Array.isArray(cloudData.couriers) && cloudData.couriers.length > 0) {
      const currentCouriers = localStorage.getItem("kb_couriers_list");
      if (JSON.stringify(cloudData.couriers) !== currentCouriers) {
        localStorage.setItem("kb_couriers_list", JSON.stringify(cloudData.couriers));
        this.emit("COURIERS", cloudData.couriers);
      }
    }

    return true;
  },

  // Auto Polling Background Engine
  startAutoSync() {
    if (this.isPolling) return;
    this.isPolling = true;

    // Initial immediate sync
    this.fetchAllFromCloud(true);

    // Periodic interval
    setInterval(() => {
      this.fetchAllFromCloud(false);
    }, CLOUD_CONFIG.POLL_INTERVAL_MS);
  }
};

// Inisialisasi CloudSync
CloudSync.init();
