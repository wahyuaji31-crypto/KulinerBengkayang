/**
 * Kuliner Bengkayang - Cloud Data Sync Engine
 * Mensinkronisasikan data Menu, Pesanan, Kurir, dan Pengaturan Toko ke Cloud secara real-time
 * Setiap update dari Admin langsung berubah di semua perangkat pengunjung/pembeli.
 */

const CLOUD_CONFIG = {
  ENDPOINT: "https://api.restful-api.dev/objects",
  REGISTRY_ID: "ff808181a067127101a090b1c1f77862",
  SETTINGS_ID: "ff808181a067127101a090b1c26f7863",
  ORDERS_ID: "ff808181a067127101a090b1c2cf7864",
  COURIERS_ID: "ff808181a067127101a090b1c3517865",
  SYNC_INTERVAL_MS: 4000 // Polling live cloud setiap 4 detik
};

// BroadcastChannel untuk update instan di browser/tab lain (0ms latency)
let syncBroadcastChannel = null;
try {
  if (typeof BroadcastChannel !== "undefined") {
    syncBroadcastChannel = new BroadcastChannel("kb_live_sync_channel");
  }
} catch (e) {
  console.warn("BroadcastChannel not supported", e);
}

const CloudSync = {
  KEYS: {
    MENU: "MENU",
    SETTINGS: "SETTINGS",
    ORDERS: "ORDERS",
    COURIERS: "COURIERS"
  },

  // Broadcast channel listener helper
  onUpdate(callback) {
    if (syncBroadcastChannel) {
      syncBroadcastChannel.onmessage = (event) => {
        if (event && event.data && typeof callback === "function") {
          callback(event.data);
        }
      };
    }
  },

  // Ambil data dari Cloud
  async get(key, defaultValue = null) {
    const localKey = "kb_cloud_" + key.toLowerCase();

    try {
      if (key === "MENU") {
        // 1. Ambil Registry Menu
        const regRes = await fetch(`${CLOUD_CONFIG.ENDPOINT}/${CLOUD_CONFIG.REGISTRY_ID}`, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          cache: "no-store"
        });

        if (regRes.ok) {
          const regData = await regRes.json();
          const idsStr = regData?.data?.ids;
          if (idsStr) {
            const idsList = idsStr.split(",").filter(Boolean);
            if (idsList.length > 0) {
              const queryParams = idsList.map(id => "id=" + encodeURIComponent(id)).join("&");
              const itemsRes = await fetch(`${CLOUD_CONFIG.ENDPOINT}?${queryParams}`, {
                method: "GET",
                headers: { "Content-Type": "application/json" },
                cache: "no-store"
              });

              if (itemsRes.ok) {
                const itemsJson = await itemsRes.json();
                if (Array.isArray(itemsJson) && itemsJson.length > 0) {
                  const menu = itemsJson.map(obj => {
                    const d = obj.data || {};
                    return {
                      _cloudObjId: obj.id,
                      id: d.id || ("kb-" + obj.id.slice(-4)),
                      name: d.name || "Menu",
                      category: d.category || "makanan",
                      price: Number(d.price) || 0,
                      originalPrice: d.originalPrice ? Number(d.originalPrice) : null,
                      rating: d.rating || 5.0,
                      reviewsCount: d.reviewsCount || 10,
                      image: d.image || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80",
                      badge: d.badge || "",
                      badgeColor: d.badgeColor || "",
                      description: d.description || "",
                      options: d.options || {}
                    };
                  });

                  localStorage.setItem("kb_custom_menu", JSON.stringify(menu));
                  localStorage.setItem(localKey, JSON.stringify(menu));
                  return menu;
                }
              }
            }
          }
        }
      } else if (key === "SETTINGS") {
        const res = await fetch(`${CLOUD_CONFIG.ENDPOINT}/${CLOUD_CONFIG.SETTINGS_ID}`, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          cache: "no-store"
        });
        if (res.ok) {
          const data = await res.json();
          if (data?.data && Object.keys(data.data).length > 0) {
            return data.data;
          }
        }
      } else if (key === "ORDERS") {
        const res = await fetch(`${CLOUD_CONFIG.ENDPOINT}/${CLOUD_CONFIG.ORDERS_ID}`, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          cache: "no-store"
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data?.data?.orders)) {
            return data.data.orders;
          }
        }
      }
    } catch (err) {
      console.warn(`[CloudSync] Gagal fetch ${key} dari cloud:`, err);
    }

    // Fallback ke cache lokal
    try {
      const cached = localStorage.getItem(localKey) || localStorage.getItem("kb_custom_menu");
      return cached ? JSON.parse(cached) : defaultValue;
    } catch (e) {
      return defaultValue;
    }
  },

  // Simpan data ke Cloud
  async set(key, value) {
    const localKey = "kb_cloud_" + key.toLowerCase();

    // 1. Simpan ke local cache segera
    localStorage.setItem(localKey, JSON.stringify(value));
    if (key === "MENU") {
      localStorage.setItem("kb_custom_menu", JSON.stringify(value));
    }

    // 2. Broadcast ke tab lokal lain segera (0ms latency)
    try {
      if (syncBroadcastChannel) {
        syncBroadcastChannel.postMessage({ key, value, timestamp: Date.now() });
      }
    } catch (e) {}

    // 3. Kirim update ke Cloud API
    try {
      if (key === "MENU" && Array.isArray(value)) {
        const createdIds = [];
        for (const item of value) {
          const itemPayload = {
            name: "KB_MENU_" + item.id,
            data: {
              id: item.id,
              name: item.name,
              category: item.category,
              price: item.price,
              originalPrice: item.originalPrice || 0,
              rating: item.rating || 5,
              reviewsCount: item.reviewsCount || 10,
              image: item.image,
              badge: item.badge || "",
              badgeColor: item.badgeColor || "",
              description: (item.description || "").slice(0, 150),
              options: item.options || {}
            }
          };

          if (item._cloudObjId) {
            // Update existing object
            const putRes = await fetch(`${CLOUD_CONFIG.ENDPOINT}/${item._cloudObjId}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(itemPayload)
            });
            if (putRes.ok) {
              createdIds.push(item._cloudObjId);
              continue;
            }
          }

          // Create new object
          const postRes = await fetch(CLOUD_CONFIG.ENDPOINT, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(itemPayload)
          });
          if (postRes.ok) {
            const resObj = await postRes.json();
            if (resObj.id) {
              item._cloudObjId = resObj.id;
              createdIds.push(resObj.id);
            }
          }
        }

        // Update Menu Registry
        if (createdIds.length > 0) {
          await fetch(`${CLOUD_CONFIG.ENDPOINT}/${CLOUD_CONFIG.REGISTRY_ID}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: "KB_MASTER_MENU_REGISTRY",
              data: {
                count: createdIds.length,
                ids: createdIds.join(","),
                updatedAt: Date.now()
              }
            })
          });
        }
        return true;
      } else if (key === "SETTINGS") {
        await fetch(`${CLOUD_CONFIG.ENDPOINT}/${CLOUD_CONFIG.SETTINGS_ID}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: "KB_MASTER_SETTINGS_V2",
            data: {
              ...value,
              updatedAt: Date.now()
            }
          })
        });
        return true;
      } else if (key === "ORDERS") {
        await fetch(`${CLOUD_CONFIG.ENDPOINT}/${CLOUD_CONFIG.ORDERS_ID}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: "KB_MASTER_ORDERS_V2",
            data: {
              orders: (value || []).slice(0, 30),
              updatedAt: Date.now()
            }
          })
        });
        return true;
      }
    } catch (err) {
      console.error(`[CloudSync] Error saving ${key} to cloud:`, err);
    }
    return false;
  }
};
