/**
 * Kuliner Bengkayang - Driver & Courier Portal Logic
 * Mendeteksi GPS kurir, menghitung jarak ke pemesan di sekitar, integrasi Google Maps navigasi, dan update status antar.
 */

// Default Koordinat Pusat Bengkayang (Kalimantan Barat) sebagai fallback
const BENGKAYANG_CENTER = {
  lat: 0.8208,
  lng: 109.6644
};

// Default Daftar Kurir Toko
const DEFAULT_COURIERS = [
  { id: "cr-01", name: "Budi Santoso", phone: "081234567891", vehicle: "Honda Beat • KB 4122 LK", active: true },
  { id: "cr-02", name: "Rian Pratama", phone: "081234567892", vehicle: "Yamaha NMAX • KB 5890 XX", active: true },
  { id: "cr-03", name: "Hendra Wijaya", phone: "081234567893", vehicle: "Honda Vario • KB 2311 AB", active: true }
];

// State Driver Portal
const driverState = {
  couriers: [],
  currentCourier: null,
  driverCoords: { lat: BENGKAYANG_CENTER.lat, lng: BENGKAYANG_CENTER.lng },
  orders: [],
  map: null,
  driverMarker: null,
  orderMarkers: []
};

// Format Rupiah
function formatRupiah(number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(number || 0);
}

// Inisialisasi Saat Load
document.addEventListener("DOMContentLoaded", async () => {
  loadCouriersData();
  loadOrdersData();
  initDriverMap();
  refreshDriverGPS();
  renderDriverHeader();
  renderNearbyOrders();

  // Sinkronisasi data live dari Cloud Database
  await syncDriverDataFromCloud();

  // Refresh otomatis data pesanan & kurir dari Cloud setiap 8 detik
  setInterval(async () => {
    await syncDriverDataFromCloud(false);
  }, 8000);

  if (window.lucide) window.lucide.createIcons();
});

// Sinkronisasi Live Data Kurir & Orders dari Cloud
async function syncDriverDataFromCloud(showLog = true) {
  if (typeof CloudSync === "undefined") return;

  try {
    // 1. Sync Orders dari Cloud
    const cloudOrders = await CloudSync.get(CloudSync.KEYS.ORDERS, null);
    if (cloudOrders && Array.isArray(cloudOrders)) {
      const isDiff = JSON.stringify(driverState.orders) !== JSON.stringify(cloudOrders);
      if (isDiff) {
        driverState.orders = cloudOrders;
        localStorage.setItem("kb_orders_history", JSON.stringify(cloudOrders));
        renderNearbyOrders();
        if (showLog) console.log("[CloudSync Driver] Pesanan baru berhasil disinkronkan dari Cloud!");
      }
    }

    // 2. Sync Couriers dari Cloud
    const cloudCouriers = await CloudSync.get(CloudSync.KEYS.COURIERS, null);
    if (cloudCouriers && Array.isArray(cloudCouriers) && cloudCouriers.length > 0) {
      driverState.couriers = cloudCouriers;
      localStorage.setItem("kb_couriers_list", JSON.stringify(cloudCouriers));
    }
  } catch (err) {
    console.warn("[CloudSync Driver] Sync error:", err);
  }
}


// Load Kurir Toko
function loadCouriersData() {
  try {
    const saved = localStorage.getItem("kb_couriers_list");
    if (saved) {
      driverState.couriers = JSON.parse(saved);
    } else {
      driverState.couriers = [...DEFAULT_COURIERS];
      localStorage.setItem("kb_couriers_list", JSON.stringify(driverState.couriers));
    }
  } catch (e) {
    driverState.couriers = [...DEFAULT_COURIERS];
  }

  // Pilih kurir aktif pertama
  const activeId = localStorage.getItem("kb_active_courier_id");
  if (activeId) {
    driverState.currentCourier = driverState.couriers.find(c => c.id === activeId) || driverState.couriers[0];
  } else {
    driverState.currentCourier = driverState.couriers[0] || null;
  }
}

// Load Pesanan
function loadOrdersData() {
  try {
    const orders = localStorage.getItem("kb_orders_history");
    driverState.orders = orders ? JSON.parse(orders) : [];
  } catch (e) {
    driverState.orders = [];
  }
}

// Render Info Driver di Header
function renderDriverHeader() {
  const nameEl = document.getElementById("driverDisplayName");
  const vehicleEl = document.getElementById("driverVehicleText");

  if (driverState.currentCourier) {
    if (nameEl) nameEl.textContent = driverState.currentCourier.name;
    if (vehicleEl) vehicleEl.textContent = `${driverState.currentCourier.vehicle} • ${driverState.currentCourier.phone}`;
  }
}

// Inisialisasi Peta Leaflet
function initDriverMap() {
  const mapContainer = document.getElementById("driverMap");
  if (!mapContainer || typeof L === "undefined") return;

  driverState.map = L.map("driverMap", {
    zoomControl: true,
    attributionControl: false
  }).setView([driverState.driverCoords.lat, driverState.driverCoords.lng], 14);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19
  }).addTo(driverState.map);

  // Custom Driver Icon
  const driverIcon = L.divIcon({
    className: "custom-driver-icon",
    html: `<div class="w-8 h-8 rounded-full bg-orange-600 border-2 border-white shadow-xl flex items-center justify-center text-white text-xs font-bold animate-bounce">🛵</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16]
  });

  driverState.driverMarker = L.marker([driverState.driverCoords.lat, driverState.driverCoords.lng], {
    icon: driverIcon
  }).addTo(driverState.map).bindPopup("<b>Posisi Kurir (Anda)</b><br>Siap mengantar makanan");
}

// Deteksi GPS Kurir
function refreshDriverGPS() {
  const locationText = document.getElementById("driverLocationText");

  if (!navigator.geolocation) {
    if (locationText) locationText.textContent = `GPS tidak didukung. Menggunakan titik pusat kota: (${driverState.driverCoords.lat}, ${driverState.driverCoords.lng})`;
    return;
  }

  if (locationText) locationText.textContent = "Mengambil titik koordinat GPS kurir...";

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      driverState.driverCoords = { lat, lng };

      if (locationText) {
        locationText.textContent = `📍 GPS Terkunci: ${lat.toFixed(5)}, ${lng.toFixed(5)} (Akurasi ±${Math.round(pos.coords.accuracy)}m)`;
      }

      if (driverState.map && driverState.driverMarker) {
        driverState.driverMarker.setLatLng([lat, lng]);
        driverState.map.setView([lat, lng], 14);
      }

      renderNearbyOrders();
      showToast("Lokasi GPS Kurir diperbarui!", "success");
    },
    (err) => {
      console.warn("Driver GPS Error:", err);
      if (locationText) {
        locationText.textContent = `📍 Titik Standar: ${driverState.driverCoords.lat}, ${driverState.driverCoords.lng} (Izin GPS belum diberikan)`;
      }
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
}

// Rumus Haversine: Menghitung Jarak (KM) Antar 2 Titik Koordinat GPS
function calculateDistanceKM(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius bumi dalam KM
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Render Daftar Pesanan di Sekitar Kurir
function renderNearbyOrders() {
  const container = document.getElementById("nearbyOrdersList");
  const countBadge = document.getElementById("mapOrdersCountText");
  if (!container) return;

  // Bersihkan marker lama dari peta
  if (driverState.map && driverState.orderMarkers.length > 0) {
    driverState.orderMarkers.forEach(m => driverState.map.removeLayer(m));
    driverState.orderMarkers = [];
  }

  // Filter hanya pesanan yang berstatus delivery dan belum dibatalkan
  const deliveryOrders = driverState.orders.filter(o => 
    o.orderType?.toLowerCase().includes("delivery") && o.status !== "Dibatalkan"
  );

  if (countBadge) {
    countBadge.textContent = `${deliveryOrders.length} Titik Pengantaran Aktif`;
  }

  if (deliveryOrders.length === 0) {
    container.innerHTML = `
      <div class="p-8 text-center bg-slate-800/60 rounded-2xl border border-slate-700 text-slate-400">
        <div class="w-14 h-14 mx-auto mb-3 bg-slate-800 rounded-2xl flex items-center justify-center text-slate-500">
          <i data-lucide="inbox" class="w-7 h-7"></i>
        </div>
        <h4 class="text-sm font-bold text-slate-200">Belum Ada Pesanan Delivery</h4>
        <p class="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
          Ketika pelanggan memesan dengan metode 'Delivery' dari website toko, pesanan akan langsung muncul di radar ini secara otomatis.
        </p>
      </div>
    `;
    if (window.lucide) window.lucide.createIcons();
    return;
  }

  // Proses kalkulasi jarak untuk tiap pesanan
  const ordersWithDistance = deliveryOrders.map(order => {
    let distanceKm = null;
    let targetCoords = null;

    if (order.coords && order.coords.lat && order.coords.lng) {
      targetCoords = order.coords;
      distanceKm = calculateDistanceKM(
        driverState.driverCoords.lat, driverState.driverCoords.lng,
        order.coords.lat, order.coords.lng
      );
    } else {
      // Jika pelanggan tidak mengaktifkan GPS, gunakan estimasi offset acak dari toko
      distanceKm = 1.2 + (Math.random() * 2.5);
      targetCoords = {
        lat: driverState.driverCoords.lat + 0.008,
        lng: driverState.driverCoords.lng + 0.006
      };
    }

    return {
      ...order,
      distanceKm: distanceKm,
      targetCoords: targetCoords
    };
  });

  // Urutkan dari jarak terdekat
  ordersWithDistance.sort((a, b) => a.distanceKm - b.distanceKm);

  // Render Marker di Peta
  if (driverState.map) {
    ordersWithDistance.forEach(order => {
      const orderIcon = L.divIcon({
        className: "custom-order-icon",
        html: `<div class="w-7 h-7 rounded-full bg-emerald-600 border-2 border-white shadow-lg flex items-center justify-center text-white text-[10px] font-bold">🏠</div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14]
      });

      const marker = L.marker([order.targetCoords.lat, order.targetCoords.lng], { icon: orderIcon })
        .addTo(driverState.map)
        .bindPopup(`
          <div class="text-xs text-slate-800 p-1">
            <strong class="text-orange-600">Pesanan #${escapeHtml(order.invoiceId)}</strong><br>
            <b>Pemesan:</b> ${escapeHtml(order.customerName)}<br>
            <b>Jarak:</b> ±${order.distanceKm.toFixed(1)} km<br>
            <a href="https://www.google.com/maps/dir/?api=1&destination=${order.targetCoords.lat},${order.targetCoords.lng}" target="_blank" class="inline-block mt-1 font-bold text-blue-600 hover:underline">🧭 Rute Google Maps</a>
          </div>
        `);

      driverState.orderMarkers.push(marker);
    });
  }

  // Render Kartu Pesanan
  container.innerHTML = ordersWithDistance.map((order, idx) => {
    const isTaken = order.status === "Sedang Diantar";
    const isDone = order.status === "Selesai";

    // URL Google Maps Navigasi Langsung
    const mapsNavUrl = order.coords 
      ? `https://www.google.com/maps/dir/?api=1&destination=${order.coords.lat},${order.coords.lng}`
      : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(order.deliveryAddress + " Bengkayang")}`;

    // Link WhatsApp Chat Kurir ke Pemesan
    const cleanPhone = order.customerPhone.replace(/[^0-9]/g, "").replace(/^0/, "62");
    const waText = encodeURIComponent(`Halo kak *${order.customerName}*, saya *${driverState.currentCourier?.name || "Kurir"}* dari Kuliner Bengkayang sedang mengantarkan pesanan Anda (#${order.invoiceId}). Mohon ditunggu ya kak! 🙏🛵`);
    const waChatUrl = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${waText}`;

    return `
      <div class="bg-slate-800 rounded-2xl border border-slate-700 p-5 shadow-lg space-y-4 hover:border-orange-500/50 transition">
        <!-- Header Kartu: Invoice, Jarak, Status -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-700">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-orange-600/20 border border-orange-500/30 text-orange-400 flex items-center justify-center font-bold text-xs">
              #${escapeHtml(order.invoiceId.slice(-4))}
            </div>
            <div>
              <div class="flex items-center gap-2">
                <h3 class="font-extrabold text-sm sm:text-base text-white">#${escapeHtml(order.invoiceId)}</h3>
                <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                  isDone ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 
                  isTaken ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 
                  'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                }">
                  ${escapeHtml(order.status)}
                </span>
              </div>
              <p class="text-xs text-slate-400">${order.orderDate}</p>
            </div>
          </div>

          <div class="flex items-center gap-2 self-end sm:self-auto bg-slate-900/80 px-3 py-1.5 rounded-xl border border-slate-700">
            <i data-lucide="navigation" class="w-4 h-4 text-orange-400"></i>
            <span class="text-xs font-bold text-orange-300">± ${order.distanceKm.toFixed(1)} km</span>
            <span class="text-[10px] text-slate-400">(~${Math.max(5, Math.round(order.distanceKm * 3.5))} mnt)</span>
          </div>
        </div>

        <!-- Data Pemesan & Alamat -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-300">
          <div class="space-y-1">
            <div class="flex items-center gap-2">
              <i data-lucide="user" class="w-3.5 h-3.5 text-slate-400"></i>
              <span><strong>${escapeHtml(order.customerName)}</strong></span>
            </div>
            <div class="flex items-center gap-2">
              <i data-lucide="phone" class="w-3.5 h-3.5 text-slate-400"></i>
              <span class="font-mono">${escapeHtml(order.customerPhone)}</span>
            </div>
          </div>

          <div class="space-y-1">
            <div class="flex items-start gap-2">
              <i data-lucide="map-pin" class="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5"></i>
              <span class="line-clamp-2">${escapeHtml(order.deliveryAddress)}</span>
            </div>
            ${order.deliveryNote && order.deliveryNote !== "-" ? `
              <div class="text-[11px] text-orange-400 italic">
                Catatan: "${escapeHtml(order.deliveryNote)}"
              </div>
            ` : ""}
          </div>
        </div>

        <!-- Item & Pembayaran -->
        <div class="p-3 bg-slate-900/60 rounded-xl border border-slate-700/60 text-xs space-y-1.5">
          <div class="font-bold text-slate-400 text-[11px] uppercase">Rincian Menu:</div>
          ${order.items?.map(it => `
            <div class="flex justify-between text-slate-300 text-xs">
              <span><strong>${it.quantity}x</strong> ${escapeHtml(it.name)}</span>
              <span>${formatRupiah(it.unitPrice * it.quantity)}</span>
            </div>
          `).join("")}
          
          <div class="flex justify-between items-center pt-2 border-t border-slate-700 text-xs font-bold">
            <span class="text-slate-400">Pembayaran (${escapeHtml(order.paymentMethod)})</span>
            <span class="text-orange-400 text-sm font-extrabold">${formatRupiah(order.grandTotal)}</span>
          </div>
        </div>

        <!-- Action Buttons (Google Maps Rute, WhatsApp Chat, Ambil Order) -->
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2">
          <!-- Tombol Navigasi Google Maps -->
          <a 
            href="${mapsNavUrl}" 
            target="_blank" 
            class="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md transition">
            <i data-lucide="map" class="w-4 h-4"></i>
            <span>Buka Google Maps</span>
          </a>

          <!-- Tombol WhatsApp Pelanggan -->
          <a 
            href="${waChatUrl}" 
            target="_blank" 
            class="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md transition">
            <i data-lucide="message-circle" class="w-4 h-4"></i>
            <span>Chat Pemesan</span>
          </a>

          <!-- Tombol Status Antar -->
          ${!isTaken && !isDone ? `
            <button 
              onclick="updateOrderCourierStatus('${order.invoiceId}', 'Sedang Diantar')"
              class="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold shadow-md transition">
              <i data-lucide="bike" class="w-4 h-4"></i>
              <span>Ambil & Antar</span>
            </button>
          ` : (isTaken ? `
            <button 
              onclick="updateOrderCourierStatus('${order.invoiceId}', 'Selesai')"
              class="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-md transition">
              <i data-lucide="check-circle" class="w-4 h-4"></i>
              <span>Pesanan Selesai</span>
            </button>
          ` : `
            <button disabled class="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-slate-700 text-slate-400 text-xs font-bold cursor-not-allowed">
              <i data-lucide="check-check" class="w-4 h-4"></i>
              <span>Sudah Terantar</span>
            </button>
          `)}
        </div>
      </div>
    `;
  }).join("");

  if (window.lucide) window.lucide.createIcons();
}

// Update Status Pesanan oleh Kurir
async function updateOrderCourierStatus(invoiceId, newStatus) {
  const idx = driverState.orders.findIndex(o => o.invoiceId === invoiceId);
  if (idx > -1) {
    driverState.orders[idx].status = newStatus;
    driverState.orders[idx].assignedCourier = driverState.currentCourier ? driverState.currentCourier.name : "Kurir Toko";
    localStorage.setItem("kb_orders_history", JSON.stringify(driverState.orders));
    
    // Sinkronkan ke Cloud agar admin dan pembeli langsung melihat update status secara live
    if (typeof CloudSync !== "undefined") {
      await CloudSync.set(CloudSync.KEYS.ORDERS, driverState.orders);
    }
    
    renderNearbyOrders();
    showToast(`Status pesanan #${invoiceId} diubah menjadi "${newStatus}"`, "success");
  }
}


// Modal Switch Driver
function openSwitchDriverModal() {
  const modal = document.getElementById("switchDriverModal");
  const listEl = document.getElementById("driverProfilesList");
  if (!modal || !listEl) return;

  listEl.innerHTML = driverState.couriers.map(c => {
    const isCurrent = driverState.currentCourier?.id === c.id;
    return `
      <div class="flex items-center justify-between p-3 rounded-xl border transition ${
        isCurrent ? 'bg-orange-500/20 border-orange-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-600'
      }">
        <div>
          <div class="font-bold text-xs">${escapeHtml(c.name)}</div>
          <div class="text-[11px] text-slate-400">${escapeHtml(c.vehicle)} • ${escapeHtml(c.phone)}</div>
        </div>
        ${isCurrent ? `
          <span class="text-xs font-bold text-orange-400 flex items-center gap-1">
            <i data-lucide="check" class="w-3.5 h-3.5"></i> Aktif
          </span>
        ` : `
          <button onclick="selectActiveCourier('${c.id}')" class="px-3 py-1 bg-slate-700 hover:bg-orange-600 text-white text-xs font-bold rounded-lg transition">
            Pilih
          </button>
        `}
      </div>
    `;
  }).join("");

  modal.classList.remove("hidden");
  modal.classList.add("flex");
  if (window.lucide) window.lucide.createIcons();
}

function closeSwitchDriverModal() {
  const modal = document.getElementById("switchDriverModal");
  modal?.classList.add("hidden");
  modal?.classList.remove("flex");
}

function selectActiveCourier(courierId) {
  const target = driverState.couriers.find(c => c.id === courierId);
  if (target) {
    driverState.currentCourier = target;
    localStorage.setItem("kb_active_courier_id", courierId);
    renderDriverHeader();
    closeSwitchDriverModal();
    showToast(`Profil kurir berganti ke: ${target.name}`, "success");
  }
}

function addNewCourier(e) {
  e.preventDefault();
  const name = document.getElementById("newCourierName").value.trim();
  const phone = document.getElementById("newCourierWa").value.trim();
  const vehicle = document.getElementById("newCourierVehicle").value.trim();

  if (!name || !phone) return;

  const newCourier = {
    id: "cr-" + Date.now().toString().slice(-4),
    name,
    phone,
    vehicle: vehicle || "Sepeda Motor",
    active: true
  };

  driverState.couriers.push(newCourier);
  localStorage.setItem("kb_couriers_list", JSON.stringify(driverState.couriers));
  driverState.currentCourier = newCourier;
  localStorage.setItem("kb_active_courier_id", newCourier.id);

  renderDriverHeader();
  closeSwitchDriverModal();
  showToast(`Kurir "${name}" berhasil ditambahkan dan diaktifkan!`, "success");
}

// Toast Notification
function showToast(message, type = "info") {
  const container = document.getElementById("driverToastContainer");
  if (!container) return;

  const toast = document.createElement("div");
  const bgClasses = type === "success" 
    ? "bg-emerald-600 text-white" 
    : type === "error" 
      ? "bg-rose-600 text-white" 
      : "bg-slate-800 text-white";

  toast.className = `flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-2xl text-xs font-semibold transition-all transform duration-300 opacity-0 translate-y-3 ${bgClasses} border border-white/10`;
  
  const iconName = type === "success" ? "check-circle" : (type === "error" ? "alert-circle" : "info");
  toast.innerHTML = `
    <i data-lucide="${iconName}" class="w-4 h-4 flex-shrink-0"></i>
    <span>${escapeHtml(message)}</span>
  `;

  container.appendChild(toast);
  if (window.lucide) window.lucide.createIcons();

  requestAnimationFrame(() => {
    toast.classList.remove("opacity-0", "translate-y-3");
    toast.classList.add("opacity-100", "translate-y-0");
  });

  setTimeout(() => {
    toast.classList.add("opacity-0", "translate-y-2");
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}

// Escape HTML
function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
