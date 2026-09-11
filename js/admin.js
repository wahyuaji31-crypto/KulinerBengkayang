/**
 * Kuliner Bengkayang - Admin Dashboard Logic
 * Mengelola otentikasi login, CRUD menu makanan, riwayat pesanan, dan pengaturan toko.
 */

// Default Admin Credentials jika belum diset
const DEFAULT_ADMIN = {
  username: "admin",
  password: "admin123"
};

// Admin State
const adminState = {
  isAuthenticated: false,
  activeTab: "dashboard",
  menu: [],
  orders: [],
  storeConfig: {},
  editingMenuId: null
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

// Inisialisasi Halaman Admin
document.addEventListener("DOMContentLoaded", async () => {
  initAdminAuth();
  loadAdminData();
  
  if (adminState.isAuthenticated) {
    showDashboardView();
  } else {
    showLoginView();
  }

  // Dengarkan siaran real-time update pesanan baru dari website pengunjung (0ms)
  if (typeof CloudSync !== "undefined" && CloudSync.onUpdate) {
    CloudSync.onUpdate((data) => {
      if (data.key === CloudSync.KEYS.ORDERS && Array.isArray(data.value)) {
        adminState.orders = data.value;
        localStorage.setItem("kb_orders_history", JSON.stringify(data.value));
        if (adminState.activeTab === "orders") renderAdminOrdersList();
        if (adminState.activeTab === "dashboard") renderDashboardStats();
      }
    });
  }

  if (window.lucide) {
    window.lucide.createIcons();
  }

  // Sinkronisasi data live dari Cloud Database
  await syncAdminDataFromCloud();

  // Background Auto-Sync data pesanan & menu setiap 4 detik
  setInterval(async () => {
    if (adminState.isAuthenticated) {
      await syncAdminDataFromCloud(false);
    }
  }, 4000);
});

// Otentikasi & Session
function initAdminAuth() {
  const sessionAuth = sessionStorage.getItem("kb_admin_auth") || localStorage.getItem("kb_admin_auth");
  if (sessionAuth === "true") {
    adminState.isAuthenticated = true;
  }
}

// Toggle Visibility Password
function togglePasswordVisibility() {
  const passInput = document.getElementById("loginPassword");
  const eyeIcon = document.getElementById("eyeIcon");
  if (!passInput) return;

  if (passInput.type === "password") {
    passInput.type = "text";
    eyeIcon?.setAttribute("data-lucide", "eye-off");
  } else {
    passInput.type = "password";
    eyeIcon?.setAttribute("data-lucide", "eye");
  }
  if (window.lucide) window.lucide.createIcons();
}

function handleLogin(e) {
  if (e && e.preventDefault) e.preventDefault();
  const userEl = document.getElementById("loginUsername");
  const passEl = document.getElementById("loginPassword");
  const rememberEl = document.getElementById("rememberMe");
  const errorEl = document.getElementById("loginError");
  const errorTextEl = document.getElementById("loginErrorText");

  const username = (userEl?.value || "").trim();
  const password = (passEl?.value || "").trim();

  if (!username || !password) {
    if (errorEl) errorEl.classList.remove("hidden");
    if (errorTextEl) errorTextEl.textContent = "Username dan password wajib diisi!";
    showToast("Harap masukkan username dan password!", "error");
    return;
  }

  // Ambil data admin dari storage atau default
  let savedAdmin = { ...DEFAULT_ADMIN };
  try {
    const raw = localStorage.getItem("kb_admin_credentials");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.username && parsed.password) {
        savedAdmin = parsed;
      }
    }
  } catch (err) {
    savedAdmin = { ...DEFAULT_ADMIN };
  }

  // Pengecekan Kredensial:
  // 1. Cocok dengan savedAdmin (case-insensitive username)
  // 2. ATAU cocok dengan master default (admin / admin123)
  const isCustomMatch = (username.toLowerCase() === savedAdmin.username.toLowerCase()) && (password === savedAdmin.password);
  const isMasterMatch = (username.toLowerCase() === DEFAULT_ADMIN.username.toLowerCase()) && (password === DEFAULT_ADMIN.password);

  if (isCustomMatch || isMasterMatch) {
    adminState.isAuthenticated = true;
    if (rememberEl && rememberEl.checked) {
      localStorage.setItem("kb_admin_auth", "true");
    } else {
      sessionStorage.setItem("kb_admin_auth", "true");
    }
    
    if (errorEl) errorEl.classList.add("hidden");
    showToast("Login berhasil! Selamat datang Admin.", "success");
    showDashboardView();
  } else {
    if (errorEl) errorEl.classList.remove("hidden");
    if (errorTextEl) errorTextEl.textContent = "Username atau password salah! Akses ditolak.";
    showToast("Gagal masuk. Username atau password salah!", "error");
  }
}

// Bind fungsi ke window agar selalu dapat dipanggil dari inline HTML
window.handleLogin = handleLogin;
window.togglePasswordVisibility = togglePasswordVisibility;


function handleLogout() {
  if (confirm("Apakah Anda yakin ingin keluar dari halaman Admin?")) {
    adminState.isAuthenticated = false;
    sessionStorage.removeItem("kb_admin_auth");
    localStorage.removeItem("kb_admin_auth");
    showToast("Anda telah keluar.", "info");
    showLoginView();
  }
}

// Tampilan Switch
function showLoginView() {
  const loginSec = document.getElementById("loginSection");
  const dashSec = document.getElementById("dashboardSection");
  if (loginSec) {
    loginSec.classList.remove("hidden");
    loginSec.style.display = "flex";
  }
  if (dashSec) {
    dashSec.classList.add("hidden");
    dashSec.style.display = "none";
  }
  if (window.lucide) window.lucide.createIcons();
}

function showDashboardView() {
  const loginSec = document.getElementById("loginSection");
  const dashSec = document.getElementById("dashboardSection");
  if (loginSec) {
    loginSec.classList.add("hidden");
    loginSec.style.display = "none";
  }
  if (dashSec) {
    dashSec.classList.remove("hidden");
    dashSec.style.display = "flex";
  }
  try {
    loadAdminData();
    switchTab(adminState.activeTab || "dashboard");
  } catch (err) {
    console.error("Error saat membuka dashboard:", err);
  }
}

// Load Data Menu & Pesanan
function loadAdminData() {
  // Menu
  try {
    const customMenu = localStorage.getItem("kb_custom_menu");
    if (customMenu) {
      const parsed = JSON.parse(customMenu);
      adminState.menu = Array.isArray(parsed) ? parsed : (typeof DEFAULT_MENU_ITEMS !== "undefined" ? [...DEFAULT_MENU_ITEMS] : []);
    } else if (typeof DEFAULT_MENU_ITEMS !== "undefined") {
      adminState.menu = [...DEFAULT_MENU_ITEMS];
    } else {
      adminState.menu = [];
    }
  } catch (e) {
    adminState.menu = typeof DEFAULT_MENU_ITEMS !== "undefined" ? [...DEFAULT_MENU_ITEMS] : [];
  }

  // Orders
  try {
    const orders = localStorage.getItem("kb_orders_history");
    const parsed = orders ? JSON.parse(orders) : [];
    adminState.orders = Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    adminState.orders = [];
  }

  // Store Config
  try {
    const config = localStorage.getItem("kb_store_config");
    if (config) {
      adminState.storeConfig = JSON.parse(config);
    } else if (typeof DEFAULT_STORE_CONFIG !== "undefined") {
      adminState.storeConfig = { ...DEFAULT_STORE_CONFIG };
    } else {
      adminState.storeConfig = {};
    }
  } catch (e) {
    adminState.storeConfig = {};
  }

  // Couriers
  try {
    const couriers = localStorage.getItem("kb_couriers_list");
    if (couriers) {
      const parsed = JSON.parse(couriers);
      adminState.couriers = Array.isArray(parsed) ? parsed : [];
    } else {
      adminState.couriers = [
        { id: "cr-01", name: "Budi Santoso", phone: "081234567891", vehicle: "Honda Beat • KB 4122 LK", active: true },
        { id: "cr-02", name: "Rian Pratama", phone: "081234567892", vehicle: "Yamaha NMAX • KB 5890 XX", active: true },
        { id: "cr-03", name: "Hendra Wijaya", phone: "081234567893", vehicle: "Honda Vario • KB 2311 AB", active: true }
      ];
      localStorage.setItem("kb_couriers_list", JSON.stringify(adminState.couriers));
    }
  } catch (e) {
    adminState.couriers = [];
  }
}


// Sinkronisasi Live Data Admin dari Cloud Database
async function syncAdminDataFromCloud(showLog = true) {
  if (typeof CloudSync === "undefined") return;

  try {
    // 1. Sync Menu dari Cloud
    const cloudMenu = await CloudSync.get(CloudSync.KEYS.MENU, null);
    if (cloudMenu && Array.isArray(cloudMenu) && cloudMenu.length > 0) {
      const isDiff = JSON.stringify(adminState.menu) !== JSON.stringify(cloudMenu);
      if (isDiff) {
        adminState.menu = cloudMenu;
        localStorage.setItem("kb_custom_menu", JSON.stringify(cloudMenu));
        if (adminState.activeTab === "menu") renderAdminMenuList();
        if (adminState.activeTab === "dashboard") renderDashboardStats();
      }
    }

    // 2. Sync Pesanan dari Cloud
    const cloudOrders = await CloudSync.get(CloudSync.KEYS.ORDERS, null);
    if (cloudOrders && Array.isArray(cloudOrders)) {
      const isOrdersDiff = JSON.stringify(adminState.orders) !== JSON.stringify(cloudOrders);
      if (isOrdersDiff) {
        adminState.orders = cloudOrders;
        localStorage.setItem("kb_orders_history", JSON.stringify(cloudOrders));
        if (adminState.activeTab === "orders") renderAdminOrdersList();
        if (adminState.activeTab === "dashboard") renderDashboardStats();
      }
    }

    // 3. Sync Couriers dari Cloud
    const cloudCouriers = await CloudSync.get(CloudSync.KEYS.COURIERS, null);
    if (cloudCouriers && Array.isArray(cloudCouriers) && cloudCouriers.length > 0) {
      const isCouriersDiff = JSON.stringify(adminState.couriers) !== JSON.stringify(cloudCouriers);
      if (isCouriersDiff) {
        adminState.couriers = cloudCouriers;
        localStorage.setItem("kb_couriers_list", JSON.stringify(cloudCouriers));
        if (adminState.activeTab === "couriers") renderAdminCouriersList();
      }
    }

    // 4. Sync Settings dari Cloud
    const cloudSettings = await CloudSync.get(CloudSync.KEYS.SETTINGS, null);
    if (cloudSettings && typeof cloudSettings === "object") {
      adminState.storeConfig = { ...adminState.storeConfig, ...cloudSettings };
      localStorage.setItem("kb_store_config", JSON.stringify(adminState.storeConfig));
      if (adminState.activeTab === "settings") loadStoreSettingsToForm();
    }
  } catch (err) {
    console.warn("[CloudSync Admin] Background sync error:", err);
  }
}


// Navigasi Tab Dashboard
function switchTab(tabId) {
  adminState.activeTab = tabId;
  const tabs = ["dashboard", "menu", "orders", "couriers", "settings", "security"];
  
  tabs.forEach(t => {
    const contentEl = document.getElementById(`tab-content-${t}`);
    const navBtn = document.getElementById(`tab-btn-${t}`);
    
    if (contentEl) {
      if (t === tabId) {
        contentEl.classList.remove("hidden");
      } else {
        contentEl.classList.add("hidden");
      }
    }

    if (navBtn) {
      if (t === tabId) {
        navBtn.classList.add("bg-orange-600", "text-white", "shadow-md");
        navBtn.classList.remove("text-slate-600", "hover:bg-slate-100");
      } else {
        navBtn.classList.remove("bg-orange-600", "text-white", "shadow-md");
        navBtn.classList.add("text-slate-600", "hover:bg-slate-100");
      }
    }
  });

  // Render tab data
  if (tabId === "dashboard") renderDashboardStats();
  if (tabId === "menu") renderAdminMenuList();
  if (tabId === "orders") renderAdminOrdersList();
  if (tabId === "couriers") renderAdminCouriersList();
  if (tabId === "settings") loadStoreSettingsToForm();
  if (tabId === "security") loadSecurityForm();

  if (window.lucide) window.lucide.createIcons();
}


// ==================== 1. TAB DASHBOARD STATS ====================
function renderDashboardStats() {
  const totalMenuEl = document.getElementById("statTotalMenu");
  const totalOrdersEl = document.getElementById("statTotalOrders");
  const totalRevenueEl = document.getElementById("statTotalRevenue");
  const latestOrdersContainer = document.getElementById("dashboardLatestOrders");

  if (totalMenuEl) totalMenuEl.textContent = adminState.menu.length;
  if (totalOrdersEl) totalOrdersEl.textContent = adminState.orders.length;

  const totalRevenue = adminState.orders.reduce((sum, o) => sum + (o.grandTotal || 0), 0);
  if (totalRevenueEl) totalRevenueEl.textContent = formatRupiah(totalRevenue);

  // 5 Pesanan Terakhir
  if (latestOrdersContainer) {
    const recent = adminState.orders.slice(0, 5);
    if (recent.length === 0) {
      latestOrdersContainer.innerHTML = `
        <div class="py-8 text-center text-slate-400 text-sm">
          Belum ada pesanan masuk. Pesanan pelanggan dari website akan otomatis tercatat di sini.
        </div>
      `;
    } else {
      latestOrdersContainer.innerHTML = recent.map(o => `
        <div class="flex items-center justify-between p-3.5 bg-white rounded-xl border border-slate-100 hover:border-orange-200 transition">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center font-bold text-xs">
              #${o.invoiceId?.slice(-4) || 'KB'}
            </div>
            <div>
              <div class="font-bold text-slate-800 text-sm">${escapeHtml(o.customerName)} (${escapeHtml(o.customerPhone)})</div>
              <div class="text-xs text-slate-400">${o.orderDate} • ${o.items?.length || 0} Menu</div>
            </div>
          </div>
          <div class="text-right">
            <div class="font-extrabold text-orange-600 text-sm">${formatRupiah(o.grandTotal)}</div>
            <span class="inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
              o.status === "Selesai" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
            }">${o.status || 'Menunggu'}</span>
          </div>
        </div>
      `).join("");
    }
  }
}

// ==================== 2. TAB MENU CRUD ====================
function renderAdminMenuList() {
  const container = document.getElementById("adminMenuList");
  if (!container) return;

  if (adminState.menu.length === 0) {
    container.innerHTML = `
      <div class="py-12 text-center text-slate-400">
        Belum ada menu kuliner. Klik tombol <strong>+ Tambah Menu Baru</strong> di atas untuk menambahkan.
      </div>
    `;
    return;
  }

  container.innerHTML = adminState.menu.map((item, idx) => `
    <div class="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:border-orange-300 transition">
      <div class="flex items-center gap-3.5 min-w-0">
        <img 
          src="${item.image}" 
          alt="${escapeHtml(item.name)}" 
          class="w-16 h-16 rounded-xl object-cover bg-slate-100 flex-shrink-0"
          onerror="this.src='https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80'"
        />
        <div class="min-w-0">
          <div class="flex items-center gap-2">
            <h4 class="font-bold text-slate-800 text-sm sm:text-base line-clamp-1">${escapeHtml(item.name)}</h4>
            ${item.badge ? `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold text-white ${item.badgeColor || 'bg-orange-500'}">${item.badge}</span>` : ""}
          </div>
          <div class="text-xs text-slate-500 mt-0.5 line-clamp-1">${escapeHtml(item.description)}</div>
          <div class="flex items-center gap-2 mt-1">
            <span class="font-extrabold text-orange-600 text-sm">${formatRupiah(item.price)}</span>
            ${item.originalPrice ? `<span class="text-xs text-slate-400 line-through">${formatRupiah(item.originalPrice)}</span>` : ""}
            <span class="text-slate-300">•</span>
            <span class="text-xs text-slate-500 capitalize">${item.category}</span>
          </div>
        </div>
      </div>

      <div class="flex items-center gap-2 self-end sm:self-auto">
        <button 
          onclick="openMenuModal('${item.id}')"
          class="px-3 py-1.5 bg-slate-100 hover:bg-orange-50 text-slate-700 hover:text-orange-600 rounded-xl text-xs font-bold flex items-center gap-1.5 transition">
          <i data-lucide="edit-2" class="w-3.5 h-3.5"></i>
          <span>Edit</span>
        </button>
        <button 
          onclick="deleteMenuItem('${item.id}')"
          class="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl text-xs font-bold flex items-center gap-1.5 transition">
          <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
          <span>Hapus</span>
        </button>
      </div>
    </div>
  `).join("");

  if (window.lucide) window.lucide.createIcons();
}

function openMenuModal(menuId = null) {
  adminState.editingMenuId = menuId;
  const modal = document.getElementById("adminMenuModal");
  const titleEl = document.getElementById("adminMenuModalTitle");

  if (menuId) {
    const item = adminState.menu.find(m => m.id === menuId);
    if (!item) return;

    if (titleEl) titleEl.textContent = "Edit Menu Makanan";
    document.getElementById("formMenuName").value = item.name;
    document.getElementById("formMenuCategory").value = item.category;
    document.getElementById("formMenuPrice").value = item.price;
    document.getElementById("formMenuOriginalPrice").value = item.originalPrice || "";
    document.getElementById("formMenuImage").value = item.image;
    document.getElementById("formMenuBadge").value = item.badge || "";
    document.getElementById("formMenuBadgeColor").value = item.badgeColor || "bg-orange-500";
    document.getElementById("formMenuDescription").value = item.description;
  } else {
    if (titleEl) titleEl.textContent = "Tambah Menu Baru";
    document.getElementById("formMenuName").value = "";
    document.getElementById("formMenuCategory").value = "makanan";
    document.getElementById("formMenuPrice").value = "";
    document.getElementById("formMenuOriginalPrice").value = "";
    document.getElementById("formMenuImage").value = "";
    document.getElementById("formMenuBadge").value = "";
    document.getElementById("formMenuBadgeColor").value = "bg-orange-500";
    document.getElementById("formMenuDescription").value = "";
  }

  modal?.classList.remove("hidden");
  modal?.classList.add("flex");
  document.body.classList.add("overflow-hidden");
}

function closeMenuModal() {
  const modal = document.getElementById("adminMenuModal");
  modal?.classList.add("hidden");
  modal?.classList.remove("flex");
  document.body.classList.remove("overflow-hidden");
  adminState.editingMenuId = null;
}

async function saveMenuItemFromForm(e) {
  e.preventDefault();
  const name = document.getElementById("formMenuName").value.trim();
  const category = document.getElementById("formMenuCategory").value;
  const price = parseInt(document.getElementById("formMenuPrice").value);
  const originalPriceRaw = document.getElementById("formMenuOriginalPrice").value;
  const originalPrice = originalPriceRaw ? parseInt(originalPriceRaw) : null;
  const image = document.getElementById("formMenuImage").value.trim() || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80";
  const badge = document.getElementById("formMenuBadge").value.trim();
  const badgeColor = document.getElementById("formMenuBadgeColor").value;
  const description = document.getElementById("formMenuDescription").value.trim();

  if (!name || isNaN(price)) {
    showToast("Nama menu dan harga wajib diisi dengan benar!", "error");
    return;
  }

  if (adminState.editingMenuId) {
    const idx = adminState.menu.findIndex(m => m.id === adminState.editingMenuId);
    if (idx > -1) {
      adminState.menu[idx] = {
        ...adminState.menu[idx],
        name,
        category,
        price,
        originalPrice,
        image,
        badge,
        badgeColor,
        description
      };
      showToast("Menu berhasil diperbarui & disinkronkan ke Cloud!", "success");
    }
  } else {
    const newId = "kb-" + Date.now().toString().slice(-4);
    adminState.menu.unshift({
      id: newId,
      name,
      category,
      price,
      originalPrice,
      rating: 5.0,
      reviewsCount: 1,
      image,
      badge,
      badgeColor,
      description,
      options: {}
    });
    showToast("Menu baru berhasil ditambahkan & disinkronkan ke Cloud!", "success");
  }

  closeMenuModal();
  renderAdminMenuList();
  await saveCustomMenu();
}

async function deleteMenuItem(menuId) {
  const item = adminState.menu.find(m => m.id === menuId);
  if (!item) return;

  if (confirm(`Apakah Anda yakin ingin menghapus menu "${item.name}"?`)) {
    adminState.menu = adminState.menu.filter(m => m.id !== menuId);
    renderAdminMenuList();
    showToast(`Menu "${item.name}" telah dihapus`, "info");
    await saveCustomMenu();
  }
}

function resetMenuToDefault() {
  if (confirm("Apakah Anda ingin mereset seluruh daftar menu kembali ke menu bawaan?")) {
    localStorage.removeItem("kb_custom_menu");
    if (typeof DEFAULT_MENU_ITEMS !== "undefined") {
      adminState.menu = [...DEFAULT_MENU_ITEMS];
      saveCustomMenu();
    }
    renderAdminMenuList();
    showToast("Menu berhasil direset ke pengaturan bawaan di semua perangkat", "success");
  }
}

async function saveCustomMenu() {
  localStorage.setItem("kb_custom_menu", JSON.stringify(adminState.menu));
  
  // Kirim perubahan menu ke Cloud agar langsung tampil di semua HP pembeli
  if (typeof CloudSync !== "undefined") {
    await CloudSync.set(CloudSync.KEYS.MENU, adminState.menu);
  }
}

// ==================== 3. TAB RIWAYAT PESANAN ====================
function renderAdminOrdersList() {
  const container = document.getElementById("adminOrdersList");
  if (!container) return;

  if (adminState.orders.length === 0) {
    container.innerHTML = `
      <div class="py-12 text-center text-slate-400">
        Belum ada riwayat pesanan masuk.
      </div>
    `;
    return;
  }

  container.innerHTML = adminState.orders.map((o, idx) => `
    <div class="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-3">
      <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
        <div>
          <div class="flex items-center gap-2">
            <span class="font-extrabold text-slate-900 text-sm sm:text-base">#${escapeHtml(o.invoiceId)}</span>
            <span class="text-xs text-slate-400">• ${o.orderDate}</span>
          </div>
          <div class="text-xs text-slate-600 mt-0.5">
            <strong>${escapeHtml(o.customerName)}</strong> (${escapeHtml(o.customerPhone)}) • <span class="text-orange-600 font-semibold">${escapeHtml(o.orderType)}</span>
          </div>
        </div>

        <div class="flex items-center gap-2 self-end sm:self-auto">
          <select 
            onchange="updateOrderStatus(${idx}, this.value)"
            class="text-xs font-bold rounded-lg border border-slate-200 px-2.5 py-1.5 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-orange-500">
            <option value="Menunggu Konfirmasi" ${o.status === "Menunggu Konfirmasi" ? "selected" : ""}>Menunggu Konfirmasi</option>
            <option value="Sedang Dimasak" ${o.status === "Sedang Dimasak" ? "selected" : ""}>Sedang Dimasak</option>
            <option value="Sedang Diantar" ${o.status === "Sedang Diantar" ? "selected" : ""}>Sedang Diantar</option>
            <option value="Selesai" ${o.status === "Selesai" ? "selected" : ""}>Selesai</option>
            <option value="Dibatalkan" ${o.status === "Dibatalkan" ? "selected" : ""}>Dibatalkan</option>
          </select>

          <button 
            onclick="deleteOrderHistory(${idx})" 
            title="Hapus Pesanan"
            class="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition">
            <i data-lucide="trash-2" class="w-4 h-4"></i>
          </button>
        </div>
      </div>

      <!-- Item Pesanan -->
      <div class="text-xs space-y-1 text-slate-700 bg-slate-50 p-3 rounded-xl">
        ${o.items?.map(it => `
          <div class="flex justify-between">
            <span><strong>${it.quantity}x</strong> ${escapeHtml(it.name)}</span>
            <span class="font-semibold text-slate-600">${formatRupiah(it.unitPrice * it.quantity)}</span>
          </div>
        `).join("")}
      </div>

      ${o.deliveryAddress !== "-" ? `
        <div class="text-xs text-slate-600">
          <span class="text-slate-400">Alamat:</span> ${escapeHtml(o.deliveryAddress)}
        </div>
      ` : ""}

      <div class="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
        <span class="text-slate-500">Pembayaran: <strong>${escapeHtml(o.paymentMethod)}</strong></span>
        <span class="font-extrabold text-sm text-orange-600">Total: ${formatRupiah(o.grandTotal)}</span>
      </div>
    </div>
  `).join("");

  if (window.lucide) window.lucide.createIcons();
}

async function updateOrderStatus(orderIndex, newStatus) {
  if (adminState.orders[orderIndex]) {
    adminState.orders[orderIndex].status = newStatus;
    localStorage.setItem("kb_orders_history", JSON.stringify(adminState.orders));
    if (typeof CloudSync !== "undefined") {
      await CloudSync.set(CloudSync.KEYS.ORDERS, adminState.orders);
    }
    showToast(`Status pesanan #${adminState.orders[orderIndex].invoiceId} diubah menjadi "${newStatus}"`, "success");
  }
}

async function deleteOrderHistory(orderIndex) {
  if (confirm("Apakah Anda yakin ingin menghapus data riwayat pesanan ini?")) {
    adminState.orders.splice(orderIndex, 1);
    localStorage.setItem("kb_orders_history", JSON.stringify(adminState.orders));
    if (typeof CloudSync !== "undefined") {
      await CloudSync.set(CloudSync.KEYS.ORDERS, adminState.orders);
    }
    renderAdminOrdersList();
    showToast("Pesanan berhasil dihapus", "info");
  }
}

async function clearAllOrders() {
  if (confirm("Peringatan: Apakah Anda yakin ingin mengosongkan SEMUA riwayat pesanan?")) {
    adminState.orders = [];
    localStorage.removeItem("kb_orders_history");
    if (typeof CloudSync !== "undefined") {
      await CloudSync.set(CloudSync.KEYS.ORDERS, []);
    }
    renderAdminOrdersList();
    showToast("Seluruh riwayat pesanan telah dibersihkan", "info");
  }
}

// ==================== TAB MANAJEMEN KURIR ====================
function renderAdminCouriersList() {
  const container = document.getElementById("adminCouriersList");
  if (!container) return;

  if (adminState.couriers.length === 0) {
    container.innerHTML = `
      <div class="col-span-full py-12 text-center text-slate-400 bg-white rounded-2xl border border-dashed border-slate-200">
        Belum ada pekerja kurir yang terdaftar. Klik <strong>+ Tambah Kurir Baru</strong> untuk mendaftarkan kurir pengantar.
      </div>
    `;
    return;
  }

  container.innerHTML = adminState.couriers.map((c, idx) => `
    <div class="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-3 flex flex-col justify-between">
      <div>
        <div class="flex items-start justify-between gap-2">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center font-bold text-sm">
              <i data-lucide="bike" class="w-5 h-5"></i>
            </div>
            <div>
              <h4 class="font-bold text-slate-900 text-sm sm:text-base">${escapeHtml(c.name)}</h4>
              <p class="text-xs text-slate-400 font-mono">${escapeHtml(c.phone)}</p>
            </div>
          </div>

          <button onclick="toggleCourierActive(${idx})" class="px-2.5 py-1 rounded-full text-[10px] font-bold ${
            c.active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
          }">
            ${c.active ? '● Aktif' : '○ Offline'}
          </button>
        </div>

        <div class="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-600 space-y-1">
          <div class="flex items-center gap-1.5">
            <i data-lucide="car" class="w-3.5 h-3.5 text-slate-400"></i>
            <span>${escapeHtml(c.vehicle || "Sepeda Motor")}</span>
          </div>
        </div>
      </div>

      <div class="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
        <a 
          href="https://api.whatsapp.com/send?phone=${c.phone.replace(/[^0-9]/g, "").replace(/^0/, "62")}" 
          target="_blank"
          class="flex-1 py-1.5 px-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition">
          <i data-lucide="message-circle" class="w-3.5 h-3.5"></i>
          <span>WA Kurir</span>
        </a>
        <button 
          onclick="deleteCourier(${idx})" 
          class="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition">
          <i data-lucide="trash-2" class="w-4 h-4"></i>
        </button>
      </div>
    </div>
  `).join("");

  if (window.lucide) window.lucide.createIcons();
}

function openCourierModal() {
  const modal = document.getElementById("adminCourierModal");
  document.getElementById("formCourierName").value = "";
  document.getElementById("formCourierPhone").value = "";
  document.getElementById("formCourierVehicle").value = "";

  modal?.classList.remove("hidden");
  modal?.classList.add("flex");
  document.body.classList.add("overflow-hidden");
}

function closeCourierModal() {
  const modal = document.getElementById("adminCourierModal");
  modal?.classList.add("hidden");
  modal?.classList.remove("flex");
  document.body.classList.remove("overflow-hidden");
}

async function saveCourierFromForm(e) {
  e.preventDefault();
  const name = document.getElementById("formCourierName").value.trim();
  const phone = document.getElementById("formCourierPhone").value.trim();
  const vehicle = document.getElementById("formCourierVehicle").value.trim();

  if (!name || !phone) {
    showToast("Nama dan nomor WhatsApp kurir wajib diisi!", "error");
    return;
  }

  const newCourier = {
    id: "cr-" + Date.now().toString().slice(-4),
    name,
    phone,
    vehicle: vehicle || "Sepeda Motor",
    active: true
  };

  adminState.couriers.push(newCourier);
  localStorage.setItem("kb_couriers_list", JSON.stringify(adminState.couriers));
  if (typeof CloudSync !== "undefined") {
    await CloudSync.set(CloudSync.KEYS.COURIERS, adminState.couriers);
  }
  renderAdminCouriersList();
  closeCourierModal();
  showToast(`Kurir "${name}" berhasil didaftarkan di semua perangkat!`, "success");
}

async function toggleCourierActive(index) {
  if (adminState.couriers[index]) {
    adminState.couriers[index].active = !adminState.couriers[index].active;
    localStorage.setItem("kb_couriers_list", JSON.stringify(adminState.couriers));
    if (typeof CloudSync !== "undefined") {
      await CloudSync.set(CloudSync.KEYS.COURIERS, adminState.couriers);
    }
    renderAdminCouriersList();
    showToast(`Status kurir diperbarui`, "info");
  }
}

async function deleteCourier(index) {
  const c = adminState.couriers[index];
  if (!c) return;

  if (confirm(`Apakah Anda yakin ingin menghapus kurir "${c.name}"?`)) {
    adminState.couriers.splice(index, 1);
    localStorage.setItem("kb_couriers_list", JSON.stringify(adminState.couriers));
    if (typeof CloudSync !== "undefined") {
      await CloudSync.set(CloudSync.KEYS.COURIERS, adminState.couriers);
    }
    renderAdminCouriersList();
    showToast(`Kurir "${c.name}" telah dihapus`, "info");
  }
}

// ==================== 4. TAB PENGATURAN TOKO ====================
function loadStoreSettingsToForm() {
  const cfg = adminState.storeConfig;
  document.getElementById("setStoreName").value = cfg.storeName || "";
  document.getElementById("setStoreTagline").value = cfg.tagline || "";
  document.getElementById("setStoreWa").value = cfg.whatsappNumber || "";
  document.getElementById("setStoreAddress").value = cfg.storeAddress || "";
  document.getElementById("setStoreHours").value = cfg.openHours || "";
  document.getElementById("setStoreDeliveryFee").value = cfg.deliveryFee || 10000;
  document.getElementById("setStoreMinFree").value = cfg.minFreeDelivery || 100000;
  document.getElementById("setStoreQris").value = cfg.qrisImageUrl || "";
}

async function saveStoreSettingsFromForm(e) {
  e.preventDefault();
  const storeName = document.getElementById("setStoreName").value.trim();
  const tagline = document.getElementById("setStoreTagline").value.trim();
  const whatsappNumber = document.getElementById("setStoreWa").value.trim();
  const storeAddress = document.getElementById("setStoreAddress").value.trim();
  const openHours = document.getElementById("setStoreHours").value.trim();
  const deliveryFee = parseInt(document.getElementById("setStoreDeliveryFee").value || "10000");
  const minFreeDelivery = parseInt(document.getElementById("setStoreMinFree").value || "100000");
  const qrisImageUrl = document.getElementById("setStoreQris").value.trim();

  if (!whatsappNumber) {
    showToast("Nomor WhatsApp toko wajib diisi!", "error");
    return;
  }

  adminState.storeConfig = {
    ...adminState.storeConfig,
    storeName,
    tagline,
    whatsappNumber,
    storeAddress,
    openHours,
    deliveryFee,
    minFreeDelivery,
    qrisImageUrl
  };

  localStorage.setItem("kb_store_config", JSON.stringify(adminState.storeConfig));
  if (typeof CloudSync !== "undefined") {
    await CloudSync.set(CloudSync.KEYS.SETTINGS, adminState.storeConfig);
  }
  showToast("Pengaturan toko berhasil disimpan ke Cloud di semua perangkat!", "success");
}


// ==================== 5. TAB KEAMANAN ADMIN ====================
function loadSecurityForm() {
  let savedAdmin = DEFAULT_ADMIN;
  try {
    const raw = localStorage.getItem("kb_admin_credentials");
    if (raw) savedAdmin = JSON.parse(raw);
  } catch (err) {}

  document.getElementById("secCurrentUsername").value = savedAdmin.username;
  document.getElementById("secNewUsername").value = savedAdmin.username;
  document.getElementById("secOldPassword").value = "";
  document.getElementById("secNewPassword").value = "";
}

function saveSecurityCredentials(e) {
  e.preventDefault();
  const oldPass = document.getElementById("secOldPassword").value.trim();
  const newUsername = document.getElementById("secNewUsername").value.trim();
  const newPass = document.getElementById("secNewPassword").value.trim();

  let savedAdmin = DEFAULT_ADMIN;
  try {
    const raw = localStorage.getItem("kb_admin_credentials");
    if (raw) savedAdmin = JSON.parse(raw);
  } catch (err) {}

  if (oldPass !== savedAdmin.password) {
    showToast("Password lama salah!", "error");
    return;
  }

  if (!newUsername || !newPass) {
    showToast("Username dan Password baru tidak boleh kosong!", "error");
    return;
  }

  const newAdminData = {
    username: newUsername,
    password: newPass
  };

  localStorage.setItem("kb_admin_credentials", JSON.stringify(newAdminData));
  showToast("Username dan Password Admin berhasil diubah!", "success");
  loadSecurityForm();
}

// Toast Notifikasi
function showToast(message, type = "info") {
  const container = document.getElementById("adminToastContainer");
  if (!container) return;

  const toast = document.createElement("div");
  const bgClasses = type === "success" 
    ? "bg-emerald-600 text-white" 
    : type === "error" 
      ? "bg-rose-600 text-white" 
      : "bg-slate-800 text-white";

  toast.className = `flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-xl text-xs sm:text-sm font-medium transition-all transform duration-300 opacity-0 translate-y-3 ${bgClasses}`;
  
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
