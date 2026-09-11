/**
 * Kuliner Bengkayang - Aplikasi Utama
 * Menangani state cart, render menu, kalkulasi harga, checkout WhatsApp, dan invoice.
 */

// State Management
const state = {
  menu: [],
  merchants: [],
  cart: [],
  activeCategory: "all",
  activeMerchant: "all",
  searchQuery: "",
  activeVoucher: null,
  storeConfig: null,
  selectedFoodDetail: null
};

// Inisialisasi Aplikasi
document.addEventListener("DOMContentLoaded", async () => {
  loadStoreConfigLocal();
  loadCart();
  loadMenuDataLocal();
  loadMerchantsDataLocal();
  initEventListeners();
  renderStoreInfo();
  renderCategoryTabs();
  renderMerchantFilterTabs();
  renderMerchants();
  renderMenu();
  updateCartUI();
  
  // Dengarkan siaran real-time update dari Admin (GunDB WebSockets + BroadcastChannel)
  if (typeof CloudSync !== "undefined") {
    CloudSync.on("MENU", (menu) => {
      if (Array.isArray(menu) && menu.length > 0) {
        state.menu = menu;
        localStorage.setItem("kb_custom_menu", JSON.stringify(menu));
        renderMenu();
        renderMerchants();
        console.log("[PintasFood Live] Menu makanan langsung diperbarui!");
      }
    });

    CloudSync.on("MERCHANTS", (merchants) => {
      if (Array.isArray(merchants) && merchants.length > 0) {
        state.merchants = merchants;
        localStorage.setItem("kb_merchants_list", JSON.stringify(merchants));
        renderMerchants();
        renderMerchantFilterTabs();
        renderMenu();
        console.log("[PintasFood Live] Daftar mitra kuliner diperbarui!");
      }
    });

    CloudSync.on("SETTINGS", (settings) => {
      if (settings && typeof settings === "object") {
        state.storeConfig = { ...state.storeConfig, ...settings };
        localStorage.setItem("kb_store_config", JSON.stringify(state.storeConfig));
        renderStoreInfo();
      }
    });
  }

  if (window.lucide) {
    window.lucide.createIcons();
  }

  // Sinkronisasi data live dari Cloud Database
  await syncDataFromCloud();

  // Background Auto-Sync setiap 4 detik agar update admin langsung tampil di HP pembeli
  setInterval(async () => {
    await syncDataFromCloud(false);
  }, 4000);
});

// Helper Normalisasi Kategori Menu
function normalizeCategory(cat) {
  if (!cat) return "makanan";
  const c = String(cat).toLowerCase().trim();
  if (
    c === "cemilan" ||
    c === "camilan" ||
    c === "snack" ||
    c === "kudapan" ||
    c === "makanan ringan" ||
    c === "makanan_ringan" ||
    c.includes("ringan") ||
    c.includes("cemil") ||
    c.includes("camil") ||
    c.includes("snack") ||
    c.includes("kudapan")
  ) {
    return "cemilan";
  }
  if (c === "minuman" || c.includes("minum") || c.includes("drink") || c.includes("jus") || c.includes("es ")) {
    return "minuman";
  }
  if (c === "paket" || c.includes("paket") || c.includes("combo") || c.includes("hemat")) {
    return "paket";
  }
  if (c === "makanan" || c.includes("makan") || c.includes("berat") || c.includes("lauk")) {
    return "makanan";
  }
  return c;
}

// Format Rupiah
function formatRupiah(number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(number);
}

// Format Angka Biasa
function formatNumber(number) {
  return new Intl.NumberFormat("id-ID").format(number);
}

// Simpan & Ambil Konfigurasi Toko
function loadStoreConfigLocal() {
  const savedConfig = localStorage.getItem("kb_store_config");
  if (savedConfig) {
    try {
      state.storeConfig = JSON.parse(savedConfig);
    } catch (e) {
      state.storeConfig = { ...DEFAULT_STORE_CONFIG };
    }
  } else {
    state.storeConfig = { ...DEFAULT_STORE_CONFIG };
  }
}

async function saveStoreConfig(newConfig) {
  state.storeConfig = { ...state.storeConfig, ...newConfig };
  localStorage.setItem("kb_store_config", JSON.stringify(state.storeConfig));
  renderStoreInfo();
  
  // Kirim update ke Cloud agar langsung tersinkron ke semua user
  if (typeof CloudSync !== "undefined") {
    await CloudSync.set(CloudSync.KEYS.SETTINGS, state.storeConfig);
  }
  showToast("Pengaturan toko berhasil diperbarui di semua perangkat!", "success");
}

// Simpan & Ambil Keranjang
function loadCart() {
  const savedCart = localStorage.getItem("kb_cart");
  if (savedCart) {
    try {
      state.cart = JSON.parse(savedCart);
    } catch (e) {
      state.cart = [];
    }
  }
}

function saveCart() {
  localStorage.setItem("kb_cart", JSON.stringify(state.cart));
  updateCartUI();
}

// Load Menu Lokal Cepat
function loadMenuDataLocal() {
  const savedMenu = localStorage.getItem("kb_custom_menu");
  if (savedMenu) {
    try {
      state.menu = JSON.parse(savedMenu);
    } catch (e) {
      state.menu = [...DEFAULT_MENU_ITEMS];
    }
  } else {
    state.menu = [...DEFAULT_MENU_ITEMS];
  }
}

// Load Mitra Kuliner Lokal Cepat
function loadMerchantsDataLocal() {
  const savedMerchants = localStorage.getItem("kb_merchants_list");
  if (savedMerchants) {
    try {
      const parsed = JSON.parse(savedMerchants);
      state.merchants = Array.isArray(parsed) && parsed.length > 0 ? parsed : (typeof DEFAULT_MERCHANTS !== "undefined" ? [...DEFAULT_MERCHANTS] : []);
    } catch (e) {
      state.merchants = typeof DEFAULT_MERCHANTS !== "undefined" ? [...DEFAULT_MERCHANTS] : [];
    }
  } else if (typeof DEFAULT_MERCHANTS !== "undefined") {
    state.merchants = [...DEFAULT_MERCHANTS];
  } else {
    state.merchants = [];
  }
}

// Sinkronisasi Live dari Cloud Database
async function syncDataFromCloud(showLog = true) {
  if (typeof CloudSync === "undefined") return;

  try {
    // 1. Sync Menu
    const cloudMenu = await CloudSync.get(CloudSync.KEYS.MENU, null);
    if (cloudMenu && Array.isArray(cloudMenu) && cloudMenu.length > 0) {
      const menuChanged = JSON.stringify(state.menu) !== JSON.stringify(cloudMenu);
      if (menuChanged) {
        state.menu = cloudMenu;
        localStorage.setItem("kb_custom_menu", JSON.stringify(cloudMenu));
        renderMenu();
        renderMerchants();
        if (showLog) console.log("[CloudSync] Menu makanan terbaru berhasil disinkronkan dari Cloud!");
      }
    }

    // 2. Sync Mitra Kuliner
    const cloudMerchants = await CloudSync.get(CloudSync.KEYS.MERCHANTS, null);
    if (cloudMerchants && Array.isArray(cloudMerchants) && cloudMerchants.length > 0) {
      const merchantsChanged = JSON.stringify(state.merchants) !== JSON.stringify(cloudMerchants);
      if (merchantsChanged) {
        state.merchants = cloudMerchants;
        localStorage.setItem("kb_merchants_list", JSON.stringify(cloudMerchants));
        renderMerchants();
        renderMerchantFilterTabs();
        renderMenu();
        if (showLog) console.log("[CloudSync] Daftar mitra kuliner berhasil disinkronkan dari Cloud!");
      }
    }

    // 3. Sync Store Config
    const cloudConfig = await CloudSync.get(CloudSync.KEYS.SETTINGS, null);
    if (cloudConfig && typeof cloudConfig === "object" && Object.keys(cloudConfig).length > 0) {
      const configChanged = JSON.stringify(state.storeConfig) !== JSON.stringify(cloudConfig);
      if (configChanged) {
        state.storeConfig = { ...state.storeConfig, ...cloudConfig };
        localStorage.setItem("kb_store_config", JSON.stringify(state.storeConfig));
        renderStoreInfo();
      }
    }
  } catch (err) {
    console.warn("[CloudSync] Background sync error:", err);
  }
}


// Render Info Toko ke Header & Footer
function renderStoreInfo() {
  const cfg = state.storeConfig;
  const storeNameEls = document.querySelectorAll(".store-name-text");
  storeNameEls.forEach(el => el.textContent = cfg.storeName);
  
  const taglineEl = document.getElementById("storeTagline");
  if (taglineEl) taglineEl.textContent = cfg.tagline;

  const waLinkEls = document.querySelectorAll(".store-wa-link");
  waLinkEls.forEach(el => {
    el.href = `https://wa.me/${cfg.whatsappNumber.replace(/[^0-9]/g, "")}`;
    el.target = "_blank";
  });

  const addressEl = document.getElementById("storeAddressText");
  if (addressEl) addressEl.textContent = cfg.storeAddress;

  const hoursEl = document.getElementById("storeHoursText");
  if (hoursEl) hoursEl.textContent = cfg.openHours;
}

// Kategori Menu
const CATEGORIES = [
  { id: "all", name: "Semua Menu", icon: "utensils" },
  { id: "makanan", name: "Makanan Berat", icon: "soup" },
  { id: "cemilan", name: "Makanan Ringan / Cemilan", icon: "cookie" },
  { id: "minuman", name: "Minuman Segar", icon: "cup-soda" },
  { id: "paket", name: "Paket Hemat", icon: "sparkles" }
];

function renderCategoryTabs() {
  const container = document.getElementById("categoryTabs");
  if (!container) return;

  container.innerHTML = CATEGORIES.map(cat => {
    const isActive = state.activeCategory === cat.id;
    return `
      <button 
        type="button"
        onclick="setCategory('${cat.id}')"
        class="flex items-center gap-2 px-5 py-2.5 rounded-full font-medium text-sm transition-all whitespace-nowrap ${
          isActive 
            ? "bg-orange-600 text-white shadow-md shadow-orange-500/25 ring-2 ring-orange-600 ring-offset-2" 
            : "bg-white text-slate-700 hover:bg-orange-50 border border-slate-200"
        }">
        <i data-lucide="${cat.icon}" class="w-4 h-4"></i>
        <span>${cat.name}</span>
      </button>
    `;
  }).join("");

  if (window.lucide) window.lucide.createIcons();
}

function setCategory(catId) {
  state.activeCategory = catId;
  renderCategoryTabs();
  renderMenu();
}

// Render Filter Bar Toko / Mitra Kuliner
function renderMerchantFilterTabs() {
  const container = document.getElementById("merchantFilterTabs");
  if (!container) return;

  const activeMerchants = (state.merchants || []).filter(m => m.status !== "inactive");
  
  // Hitung menu per mitra
  const allCount = state.menu.length;

  let tabsHtml = `
    <button 
      type="button" 
      onclick="filterByMerchant('all')" 
      class="px-3.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 ${
        state.activeMerchant === "all"
          ? "bg-orange-600 text-white shadow-sm"
          : "bg-white text-slate-700 hover:bg-orange-50 border border-slate-200"
      }">
      <span>Semua Toko / Mitra</span>
      <span class="px-1.5 py-0.2 rounded-full text-[10px] ${state.activeMerchant === "all" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"}">${allCount}</span>
    </button>
  `;

  activeMerchants.forEach(m => {
    const isActive = state.activeMerchant === m.id;
    const mMenuCount = state.menu.filter(i => i.merchantId === m.id || i.merchantName === m.name).length;
    tabsHtml += `
      <button 
        type="button" 
        onclick="filterByMerchant('${m.id}')" 
        class="px-3.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 ${
          isActive
            ? "bg-orange-600 text-white shadow-sm"
            : "bg-white text-slate-700 hover:bg-orange-50 border border-slate-200"
        }">
        <i data-lucide="store" class="w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-orange-500'}"></i>
        <span>${escapeHtml(m.name)}</span>
        <span class="px-1.5 py-0.2 rounded-full text-[10px] ${isActive ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"}">${mMenuCount}</span>
      </button>
    `;
  });

  container.innerHTML = tabsHtml;
  if (window.lucide) window.lucide.createIcons();
}

function filterByMerchant(merchantId) {
  state.activeMerchant = merchantId;
  renderMerchantFilterTabs();
  renderMenu();
}

// Render Section Mitra Kuliner Pilihan
function renderMerchants() {
  const container = document.getElementById("merchantsGrid");
  if (!container) return;

  const activeMerchants = (state.merchants || []).filter(m => m.status !== "inactive");

  if (activeMerchants.length === 0) {
    container.innerHTML = `
      <div class="col-span-full py-12 text-center text-slate-400">
        Belum ada mitra kuliner yang terdaftar.
      </div>
    `;
    return;
  }

  container.innerHTML = activeMerchants.map(m => {
    const menuCount = state.menu.filter(i => i.merchantId === m.id || i.merchantName === m.name).length;
    const badgeColor = m.badgeColor || "bg-orange-500";

    return `
      <div class="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition flex flex-col justify-between group">
        <div>
          <!-- Thumbnail Toko Mitra -->
          <div class="relative h-40 overflow-hidden bg-slate-100">
            <img 
              src="${m.image || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=600&q=80'}" 
              alt="${escapeHtml(m.name)}" 
              loading="lazy"
              class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              onerror="this.src='https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=600&q=80'"
            />
            <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
            
            ${m.badge ? `
              <span class="absolute top-3 left-3 ${badgeColor} text-white text-[11px] font-bold px-2.5 py-0.5 rounded-full shadow-md">
                ${escapeHtml(m.badge)}
              </span>
            ` : ""}

            <div class="absolute bottom-3 left-3 right-3 flex items-center justify-between text-white">
              <span class="text-xs font-bold bg-black/40 backdrop-blur-md px-2 py-0.5 rounded-lg flex items-center gap-1">
                <i data-lucide="star" class="w-3.5 h-3.5 fill-amber-400 text-amber-400"></i>
                <span>${m.rating || '4.9'} (${m.reviewsCount || 50}+)</span>
              </span>
              <span class="text-xs font-semibold bg-orange-600/90 px-2 py-0.5 rounded-lg">
                ${menuCount} Menu Siap
              </span>
            </div>
          </div>

          <!-- Info Toko Mitra -->
          <div class="p-4 sm:p-5">
            <div class="text-[11px] font-bold text-orange-600 uppercase tracking-wider mb-1">${escapeHtml(m.category || 'Kuliner')}</div>
            <h3 class="font-extrabold text-slate-900 text-base sm:text-lg mb-1 group-hover:text-orange-600 transition line-clamp-1">
              ${escapeHtml(m.name)}
            </h3>
            <p class="text-xs text-slate-500 line-clamp-2 mb-3 leading-relaxed">
              ${escapeHtml(m.description || m.address || 'Mitra resmi kuliner PintasFood Bengkayang.')}
            </p>

            <div class="flex items-center gap-1.5 text-xs text-slate-400">
              <i data-lucide="map-pin" class="w-3.5 h-3.5 text-slate-400 flex-shrink-0"></i>
              <span class="truncate">${escapeHtml(m.address || 'Bengkayang, Kalbar')}</span>
            </div>
          </div>
        </div>

        <!-- Tombol Aksi Mitra -->
        <div class="p-4 sm:p-5 pt-0 border-t border-slate-50 flex items-center gap-2 mt-auto">
          <button 
            type="button" 
            onclick="viewMerchantMenu('${m.id}')" 
            class="flex-1 py-2.5 px-3 bg-orange-50 hover:bg-orange-600 text-orange-700 hover:text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 group-btn shadow-sm">
            <i data-lucide="utensils" class="w-3.5 h-3.5"></i>
            <span>Lihat Menu Toko</span>
          </button>
          
          ${m.phone ? `
            <a 
              href="https://wa.me/${m.phone.replace(/[^0-9]/g, "").replace(/^0/, "62")}" 
              target="_blank" 
              title="Hubungi WhatsApp Mitra"
              class="p-2.5 bg-slate-100 hover:bg-emerald-50 text-slate-600 hover:text-emerald-600 rounded-xl transition border border-slate-200 flex items-center justify-center">
              <i data-lucide="message-circle" class="w-4 h-4"></i>
            </a>
          ` : ""}
        </div>
      </div>
    `;
  }).join("");

  if (window.lucide) window.lucide.createIcons();
}

function viewMerchantMenu(merchantId) {
  state.activeMerchant = merchantId;
  state.activeCategory = "all";
  renderMerchantFilterTabs();
  renderCategoryTabs();
  renderMenu();

  const menuEl = document.getElementById("menu");
  if (menuEl) {
    menuEl.scrollIntoView({ behavior: "smooth" });
  }
}

// Render Menu
function renderMenu() {
  const menuContainer = document.getElementById("menuGrid");
  const countBadge = document.getElementById("menuCountBadge");
  if (!menuContainer) return;

  let filtered = state.menu.filter(item => {
    const itemNorm = normalizeCategory(item.category);
    const matchesCat = state.activeCategory === "all" || itemNorm === state.activeCategory || item.category === state.activeCategory;
    const matchesQuery = item.name.toLowerCase().includes(state.searchQuery.toLowerCase()) ||
                         item.description.toLowerCase().includes(state.searchQuery.toLowerCase());
    
    // Filter Mitra
    let matchesMerchant = true;
    if (state.activeMerchant !== "all") {
      matchesMerchant = (item.merchantId === state.activeMerchant) || (item.merchantName && item.merchantName.toLowerCase() === state.activeMerchant.toLowerCase());
    }

    return matchesCat && matchesQuery && matchesMerchant;
  });

  if (countBadge) {
    countBadge.textContent = `${filtered.length} menu tersedia`;
  }

  if (filtered.length === 0) {
    menuContainer.innerHTML = `
      <div class="col-span-full py-16 text-center bg-white rounded-2xl border border-dashed border-slate-300">
        <div class="w-16 h-16 mx-auto mb-4 bg-orange-100 rounded-full flex items-center justify-center text-orange-600">
          <i data-lucide="search-x" class="w-8 h-8"></i>
        </div>
        <h3 class="text-lg font-bold text-slate-800 mb-1">Menu Tidak Ditemukan</h3>
        <p class="text-sm text-slate-500 max-w-md mx-auto">
          Tidak ada menu yang sesuai dengan filter atau kata kunci pencarian Anda.
        </p>
        <button onclick="resetSearch()" class="mt-4 px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-semibold hover:bg-orange-700 transition">
          Reset Filter & Pencarian
        </button>
      </div>
    `;
    if (window.lucide) window.lucide.createIcons();
    return;
  }

  menuContainer.innerHTML = filtered.map(item => {
    const originalPriceHtml = item.originalPrice 
      ? `<span class="text-xs text-slate-400 line-through font-normal">${formatRupiah(item.originalPrice)}</span>` 
      : "";

    return `
      <div class="food-card bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm flex flex-col justify-between group">
        <div>
          <!-- Gambar Makanan -->
          <div class="relative w-full h-48 sm:h-52 overflow-hidden bg-slate-100 cursor-pointer" onclick="openFoodDetailModal('${item.id}')">
            <img 
              src="${item.image}" 
              alt="${escapeHtml(item.name)}" 
              loading="lazy"
              class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              onerror="this.src='https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80'"
            />
            <div class="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
            
            ${item.badge ? `
              <span class="absolute top-3 left-3 ${item.badgeColor || 'bg-orange-500'} text-white text-[11px] font-bold px-2.5 py-1 rounded-full shadow-md">
                ${item.badge}
              </span>
            ` : ""}

            <div class="absolute bottom-3 right-3 bg-white/95 backdrop-blur-sm px-2 py-0.5 rounded-lg text-xs font-semibold text-slate-800 shadow-sm flex items-center gap-1">
              <i data-lucide="star" class="w-3.5 h-3.5 fill-amber-400 text-amber-400"></i>
              <span>${item.rating || '4.9'}</span>
              <span class="text-slate-400 font-normal">(${item.reviewsCount || 50}+)</span>
            </div>
          </div>

          <!-- Konten Info -->
          <div class="p-4 sm:p-5">
            <!-- Badge Mitra Penyedia Makanan -->
            <div class="flex items-center gap-1.5 text-xs text-slate-500 mb-2">
              <i data-lucide="store" class="w-3.5 h-3.5 text-orange-500 flex-shrink-0"></i>
              <span class="font-medium text-slate-700 truncate">${escapeHtml(item.merchantName || 'PintasFood Kitchen')}</span>
            </div>

            <h3 
              onclick="openFoodDetailModal('${item.id}')"
              class="font-bold text-slate-800 text-base sm:text-lg mb-1.5 line-clamp-1 hover:text-orange-600 cursor-pointer transition">
              ${escapeHtml(item.name)}
            </h3>
            <p class="text-slate-500 text-xs sm:text-sm line-clamp-2 mb-4 leading-relaxed">
              ${escapeHtml(item.description)}
            </p>
          </div>
        </div>

        <!-- Bagian Bawah: Harga & Tombol Tambah -->
        <div class="p-4 sm:p-5 pt-0 border-t border-slate-50 flex items-center justify-between gap-2 mt-auto">
          <div>
            <div class="text-[11px] text-slate-400 font-medium">Harga</div>
            <div class="flex items-baseline gap-1.5">
              <span class="text-base sm:text-lg font-extrabold text-orange-600">
                ${formatRupiah(item.price)}
              </span>
              ${originalPriceHtml}
            </div>
          </div>

          <div class="flex items-center gap-1.5">
            <button 
              type="button" 
              onclick="openFoodDetailModal('${item.id}')"
              title="Lihat Opsi & Kustomisasi"
              class="p-2.5 text-slate-500 hover:text-orange-600 hover:bg-orange-50 rounded-xl transition border border-slate-200">
              <i data-lucide="sliders-horizontal" class="w-4 h-4"></i>
            </button>
            <button 
              type="button" 
              onclick="quickAddToCart('${item.id}')"
              class="flex items-center gap-1.5 px-3.5 py-2.5 bg-orange-600 hover:bg-orange-700 active:scale-95 text-white rounded-xl text-xs sm:text-sm font-semibold transition shadow-md shadow-orange-500/20">
              <i data-lucide="plus" class="w-4 h-4"></i>
              <span>Pesan</span>
            </button>
          </div>
        </div>
      </div>
    `;
  }).join("");

  if (window.lucide) window.lucide.createIcons();
}

function resetSearch() {
  state.searchQuery = "";
  state.activeCategory = "all";
  state.activeMerchant = "all";
  const searchInput = document.getElementById("searchInput");
  if (searchInput) searchInput.value = "";
  renderCategoryTabs();
  renderMerchantFilterTabs();
  renderMenu();
}

// Modal Pendaftaran Gabung Mitra PintasFood
function openJoinMitraModal() {
  const modal = document.getElementById("joinMitraModal");
  if (modal) {
    modal.classList.remove("hidden");
    modal.classList.add("flex");
    document.body.classList.add("overflow-hidden");
  }
}

function closeJoinMitraModal() {
  const modal = document.getElementById("joinMitraModal");
  if (modal) {
    modal.classList.add("hidden");
    modal.classList.remove("flex");
    document.body.classList.remove("overflow-hidden");
  }
}

function handleJoinMitraSubmit(e) {
  if (e && e.preventDefault) e.preventDefault();

  const name = (document.getElementById("joinMitraName")?.value || "").trim();
  const owner = (document.getElementById("joinMitraOwner")?.value || "").trim();
  const phone = (document.getElementById("joinMitraPhone")?.value || "").trim();
  const category = document.getElementById("joinMitraCategory")?.value || "";
  const address = (document.getElementById("joinMitraAddress")?.value || "").trim();
  const menuList = (document.getElementById("joinMitraMenu")?.value || "").trim();

  if (!name || !owner || !phone) {
    showToast("Harap lengkapi formulir pendaftaran mitra!", "error");
    return;
  }

  const targetWa = (state.storeConfig?.whatsappNumber || "6281234567890").replace(/[^0-9]/g, "");
  
  const textMsg = `Halo Pengelola PintasFood Bengkayang, saya ingin mendaftar menjadi Mitra Kuliner resmi:%0A%0A` +
    `🏪 *Nama Usaha/Resto:* ${encodeURIComponent(name)}%0A` +
    `👤 *Nama Pemilik:* ${encodeURIComponent(owner)}%0A` +
    `📱 *No. WhatsApp:* ${encodeURIComponent(phone)}%0A` +
    `📂 *Kategori Kuliner:* ${encodeURIComponent(category)}%0A` +
    `📍 *Alamat Dapur/Toko:* ${encodeURIComponent(address)}%0A` +
    `🍲 *Menu yang Siap Dipajang:*%0A${encodeURIComponent(menuList)}%0A%0A` +
    `Mohon informasi aktivasi dan penayangan menu makanan kami di website PintasFood. Terima kasih!`;

  closeJoinMitraModal();
  showToast("Membuka WhatsApp untuk mengirim pendaftaran mitra...", "success");

  setTimeout(() => {
    window.open(`https://wa.me/${targetWa}?text=${textMsg}`, "_blank");
  }, 500);
}

// Quick Add to Cart (Default Option)
function quickAddToCart(foodId) {
  const item = state.menu.find(i => i.id === foodId);
  if (!item) return;

  // Jika item memiliki opsi wajib (seperti spicyLevels / variants), buka modal opsi agar lebih jelas
  if (item.options && (item.options.spicyLevels || item.options.variants)) {
    openFoodDetailModal(foodId);
    return;
  }

  addToCartDirect({
    foodId: item.id,
    name: item.name,
    price: item.price,
    image: item.image,
    quantity: 1,
    selectedVariant: null,
    selectedSpicy: null,
    selectedSugar: null,
    selectedToppings: [],
    note: ""
  });
}

// Tambah ke Cart dengan Customization
function addToCartDirect(cartItem) {
  // Hitung total harga per unit item termasuk topping
  const toppingsPrice = cartItem.selectedToppings.reduce((sum, top) => sum + top.price, 0);
  const unitPrice = cartItem.price + toppingsPrice;

  // Buat key unik berdasarkan konfigurasi varian
  const configKey = [
    cartItem.foodId,
    cartItem.selectedVariant || "",
    cartItem.selectedSpicy || "",
    cartItem.selectedSugar || "",
    cartItem.selectedToppings.map(t => t.name).sort().join(","),
    cartItem.note || ""
  ].join("::");

  const existingIndex = state.cart.findIndex(i => i.configKey === configKey);

  if (existingIndex > -1) {
    state.cart[existingIndex].quantity += cartItem.quantity;
  } else {
    state.cart.push({
      ...cartItem,
      configKey: configKey,
      unitPrice: unitPrice,
      totalPrice: unitPrice * cartItem.quantity
    });
  }

  saveCart();
  showToast(`"${cartItem.name}" berhasil masuk keranjang!`, "success");
  animateCartButton();
}

// Modal Detail Makanan & Kustomisasi
function openFoodDetailModal(foodId) {
  const item = state.menu.find(i => i.id === foodId);
  if (!item) return;

  state.selectedFoodDetail = {
    ...item,
    currentQty: 1,
    chosenVariant: item.options?.variants ? item.options.variants[0] : null,
    chosenSpicy: item.options?.spicyLevels ? item.options.spicyLevels[0] : null,
    chosenSugar: item.options?.sugarLevels ? item.options.sugarLevels[0] : null,
    chosenToppings: [],
    customNote: ""
  };

  renderFoodDetailModal();
  const modal = document.getElementById("foodDetailModal");
  if (modal) {
    modal.classList.remove("hidden");
    modal.classList.add("flex");
    document.body.classList.add("overflow-hidden");
  }
}

function closeFoodDetailModal() {
  const modal = document.getElementById("foodDetailModal");
  if (modal) {
    modal.classList.add("hidden");
    modal.classList.remove("flex");
    document.body.classList.remove("overflow-hidden");
  }
  state.selectedFoodDetail = null;
}

function renderFoodDetailModal() {
  const detail = state.selectedFoodDetail;
  if (!detail) return;

  const modalContainer = document.getElementById("foodDetailContent");
  if (!modalContainer) return;

  const toppingsPrice = detail.chosenToppings.reduce((sum, t) => sum + t.price, 0);
  const totalItemPrice = (detail.price + toppingsPrice) * detail.currentQty;

  let optionsHtml = "";

  // Pilihan Varian
  if (detail.options && detail.options.variants) {
    optionsHtml += `
      <div class="mb-4">
        <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Pilih Varian / Isian:</label>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
          ${detail.options.variants.map(v => {
            const isChecked = detail.chosenVariant === v;
            return `
              <label class="flex items-center p-3 rounded-xl border cursor-pointer transition ${
                isChecked ? "border-orange-500 bg-orange-50 text-orange-800 font-semibold" : "border-slate-200 hover:bg-slate-50"
              }">
                <input type="radio" name="food_variant" value="${escapeHtml(v)}" ${isChecked ? "checked" : ""} onchange="updateDetailVariant('${escapeHtml(v)}')" class="text-orange-600 focus:ring-orange-500 mr-2.5">
                <span class="text-sm">${escapeHtml(v)}</span>
              </label>
            `;
          }).join("")}
        </div>
      </div>
    `;
  }

  // Pilihan Level Pedas
  if (detail.options && detail.options.spicyLevels) {
    optionsHtml += `
      <div class="mb-4">
        <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Tingkat Pedas / Sambal:</label>
        <div class="grid grid-cols-2 gap-2">
          ${detail.options.spicyLevels.map(lvl => {
            const isChecked = detail.chosenSpicy === lvl;
            return `
              <label class="flex items-center p-2.5 rounded-xl border cursor-pointer transition ${
                isChecked ? "border-orange-500 bg-orange-50 text-orange-800 font-semibold" : "border-slate-200 hover:bg-slate-50"
              }">
                <input type="radio" name="food_spicy" value="${escapeHtml(lvl)}" ${isChecked ? "checked" : ""} onchange="updateDetailSpicy('${escapeHtml(lvl)}')" class="text-orange-600 focus:ring-orange-500 mr-2">
                <span class="text-xs sm:text-sm">${escapeHtml(lvl)}</span>
              </label>
            `;
          }).join("")}
        </div>
      </div>
    `;
  }

  // Pilihan Tingkat Gula / Es
  if (detail.options && detail.options.sugarLevels) {
    optionsHtml += `
      <div class="mb-4">
        <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Tingkat Manis / Penyajian:</label>
        <div class="grid grid-cols-2 gap-2">
          ${detail.options.sugarLevels.map(sug => {
            const isChecked = detail.chosenSugar === sug;
            return `
              <label class="flex items-center p-2.5 rounded-xl border cursor-pointer transition ${
                isChecked ? "border-orange-500 bg-orange-50 text-orange-800 font-semibold" : "border-slate-200 hover:bg-slate-50"
              }">
                <input type="radio" name="food_sugar" value="${escapeHtml(sug)}" ${isChecked ? "checked" : ""} onchange="updateDetailSugar('${escapeHtml(sug)}')" class="text-orange-600 focus:ring-orange-500 mr-2">
                <span class="text-xs sm:text-sm">${escapeHtml(sug)}</span>
              </label>
            `;
          }).join("")}
        </div>
      </div>
    `;
  }

  // Pilihan Ekstra Topping
  if (detail.options && detail.options.toppings && detail.options.toppings.length > 0) {
    optionsHtml += `
      <div class="mb-4">
        <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Ekstra Topping & Tambahan:</label>
        <div class="space-y-2">
          ${detail.options.toppings.map((top, idx) => {
            const isChecked = detail.chosenToppings.some(t => t.name === top.name);
            return `
              <label class="flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition ${
                isChecked ? "border-orange-500 bg-orange-50 text-slate-800 font-semibold" : "border-slate-200 hover:bg-slate-50 text-slate-700"
              }">
                <div class="flex items-center">
                  <input type="checkbox" onchange="toggleDetailTopping(${idx})" ${isChecked ? "checked" : ""} class="rounded text-orange-600 focus:ring-orange-500 mr-3">
                  <span class="text-sm">${escapeHtml(top.name)}</span>
                </div>
                <span class="text-xs font-bold text-orange-600">+${formatRupiah(top.price)}</span>
              </label>
            `;
          }).join("")}
        </div>
      </div>
    `;
  }

  modalContainer.innerHTML = `
    <!-- Modal Header & Foto -->
    <div class="relative w-full h-56 sm:h-64 overflow-hidden rounded-t-2xl bg-slate-100">
      <img src="${detail.image}" alt="${escapeHtml(detail.name)}" class="w-full h-full object-cover">
      <button onclick="closeFoodDetailModal()" class="absolute top-4 right-4 w-9 h-9 bg-black/60 hover:bg-black text-white rounded-full flex items-center justify-center transition shadow-lg">
        <i data-lucide="x" class="w-5 h-5"></i>
      </button>
      ${detail.badge ? `
        <span class="absolute bottom-4 left-4 ${detail.badgeColor || 'bg-orange-500'} text-white text-xs font-bold px-3 py-1 rounded-full shadow-md">
          ${detail.badge}
        </span>
      ` : ""}
    </div>

    <!-- Modal Body -->
    <div class="p-5 sm:p-6 overflow-y-auto max-h-[calc(85vh-16rem)]">
      <div class="flex items-start justify-between gap-4 mb-2">
        <h2 class="text-xl sm:text-2xl font-bold text-slate-800">${escapeHtml(detail.name)}</h2>
        <div class="text-right">
          <div class="text-xl font-extrabold text-orange-600">${formatRupiah(detail.price)}</div>
        </div>
      </div>

      <!-- Info Mitra Penyedia -->
      <div class="flex items-center gap-2 text-xs font-medium text-slate-600 mb-3 pb-3 border-b border-slate-100">
        <div class="p-1 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center">
          <i data-lucide="store" class="w-3.5 h-3.5"></i>
        </div>
        <span>Disediakan oleh: <strong class="text-slate-900 font-bold">${escapeHtml(detail.merchantName || 'PintasFood Kitchen')}</strong></span>
      </div>

      <p class="text-sm text-slate-600 leading-relaxed mb-6">${escapeHtml(detail.description)}</p>

      ${optionsHtml}

      <!-- Catatan Khusus -->
      <div class="mb-4">
        <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Catatan Khusus (Opsional):</label>
        <input 
          type="text" 
          id="detailCustomNote" 
          value="${escapeHtml(detail.customNote || '')}"
          oninput="state.selectedFoodDetail.customNote = this.value"
          placeholder="Contoh: Kuah dipisah, jangan pakai bawang goreng, dll"
          class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
        />
      </div>
    </div>

    <!-- Modal Footer: Quantity & Button -->
    <div class="p-4 sm:p-6 bg-slate-50 border-t border-slate-100 rounded-b-2xl flex items-center justify-between gap-3">
      <div class="flex items-center border border-slate-200 rounded-xl bg-white p-1">
        <button onclick="changeDetailQty(-1)" class="w-8 h-8 rounded-lg flex items-center justify-center text-slate-600 hover:bg-orange-100 hover:text-orange-600 transition">
          <i data-lucide="minus" class="w-4 h-4"></i>
        </button>
        <span class="w-10 text-center font-bold text-slate-800 text-sm">${detail.currentQty}</span>
        <button onclick="changeDetailQty(1)" class="w-8 h-8 rounded-lg flex items-center justify-center text-slate-600 hover:bg-orange-100 hover:text-orange-600 transition">
          <i data-lucide="plus" class="w-4 h-4"></i>
        </button>
      </div>

      <button 
        onclick="confirmAddFromModal()"
        class="flex-1 flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-700 text-white py-3 px-4 rounded-xl font-bold text-sm sm:text-base shadow-lg shadow-orange-500/30 transition">
        <i data-lucide="shopping-bag" class="w-5 h-5"></i>
        <span>Tambah (${formatRupiah(totalItemPrice)})</span>
      </button>
    </div>
  `;

  if (window.lucide) window.lucide.createIcons();
}

function updateDetailVariant(variant) {
  if (!state.selectedFoodDetail) return;
  state.selectedFoodDetail.chosenVariant = variant;
  renderFoodDetailModal();
}

function updateDetailSpicy(spicy) {
  if (!state.selectedFoodDetail) return;
  state.selectedFoodDetail.chosenSpicy = spicy;
  renderFoodDetailModal();
}

function updateDetailSugar(sugar) {
  if (!state.selectedFoodDetail) return;
  state.selectedFoodDetail.chosenSugar = sugar;
  renderFoodDetailModal();
}

function toggleDetailTopping(index) {
  if (!state.selectedFoodDetail || !state.selectedFoodDetail.options.toppings) return;
  const targetTopping = state.selectedFoodDetail.options.toppings[index];
  const exists = state.selectedFoodDetail.chosenToppings.findIndex(t => t.name === targetTopping.name);
  if (exists > -1) {
    state.selectedFoodDetail.chosenToppings.splice(exists, 1);
  } else {
    state.selectedFoodDetail.chosenToppings.push(targetTopping);
  }
  renderFoodDetailModal();
}

function changeDetailQty(delta) {
  if (!state.selectedFoodDetail) return;
  const newQty = state.selectedFoodDetail.currentQty + delta;
  if (newQty >= 1) {
    state.selectedFoodDetail.currentQty = newQty;
    renderFoodDetailModal();
  }
}

function confirmAddFromModal() {
  const d = state.selectedFoodDetail;
  if (!d) return;

  addToCartDirect({
    foodId: d.id,
    name: d.name,
    price: d.price,
    image: d.image,
    quantity: d.currentQty,
    selectedVariant: d.chosenVariant,
    selectedSpicy: d.chosenSpicy,
    selectedSugar: d.chosenSugar,
    selectedToppings: [...d.chosenToppings],
    note: d.customNote || ""
  });

  closeFoodDetailModal();
}

// Update Keranjang UI & Hitung Total
function updateCartUI() {
  const cartDrawerItems = document.getElementById("cartDrawerItems");
  const cartCountBadges = document.querySelectorAll(".cart-count-badge");
  const cartSubtotalEls = document.querySelectorAll(".cart-subtotal-text");
  const cartDiscountEls = document.querySelectorAll(".cart-discount-text");
  const cartShippingEls = document.querySelectorAll(".cart-shipping-text");
  const cartTotalEls = document.querySelectorAll(".cart-total-text");
  const floatingCartBar = document.getElementById("floatingCartBar");

  const totalItemsCount = state.cart.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = state.cart.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);

  // Update Badges
  cartCountBadges.forEach(badge => {
    badge.textContent = totalItemsCount;
    if (totalItemsCount > 0) {
      badge.classList.remove("hidden");
    } else {
      badge.classList.add("hidden");
    }
  });

  // Tampilkan/Sembunyikan Floating Bar jika ada item
  if (floatingCartBar) {
    if (totalItemsCount > 0) {
      floatingCartBar.classList.remove("translate-y-28", "opacity-0", "pointer-events-none");
    } else {
      floatingCartBar.classList.add("translate-y-28", "opacity-0", "pointer-events-none");
    }
  }

  // Hitung Diskon Voucher
  let discountAmount = 0;
  if (state.activeVoucher && subtotal >= state.activeVoucher.minSpend) {
    if (state.activeVoucher.type === "percent") {
      discountAmount = Math.round((subtotal * state.activeVoucher.value) / 100);
    } else if (state.activeVoucher.type === "fixed") {
      discountAmount = state.activeVoucher.value;
    } else if (state.activeVoucher.type === "shipping") {
      discountAmount = state.activeVoucher.value;
    }
  }

  // Ambil tipe order terpilih dari form checkout jika ada
  const orderTypeInput = document.querySelector('input[name="orderType"]:checked');
  const orderType = orderTypeInput ? orderTypeInput.value : "delivery";

  let shippingFee = 0;
  if (orderType === "delivery") {
    shippingFee = subtotal >= state.storeConfig.minFreeDelivery ? 0 : state.storeConfig.deliveryFee;
  }

  const grandTotal = Math.max(0, subtotal - discountAmount + shippingFee);

  // Update Harga di UI
  cartSubtotalEls.forEach(el => el.textContent = formatRupiah(subtotal));
  cartDiscountEls.forEach(el => el.textContent = `- ${formatRupiah(discountAmount)}`);
  cartShippingEls.forEach(el => el.textContent = shippingFee === 0 ? "GRATIS" : formatRupiah(shippingFee));
  cartTotalEls.forEach(el => el.textContent = formatRupiah(grandTotal));

  // Render Daftar Item di Drawer Cart
  if (cartDrawerItems) {
    if (state.cart.length === 0) {
      cartDrawerItems.innerHTML = `
        <div class="text-center py-16 px-4">
          <div class="w-20 h-20 mx-auto mb-4 bg-orange-100 rounded-full flex items-center justify-center text-orange-500">
            <i data-lucide="shopping-cart" class="w-10 h-10"></i>
          </div>
          <h4 class="font-bold text-slate-800 text-lg mb-1">Keranjang Masih Kosong</h4>
          <p class="text-sm text-slate-500 max-w-xs mx-auto mb-6">Pilih menu favorit Anda dan klik tombol 'Pesan' untuk mulai berbelanja.</p>
          <button onclick="toggleCartDrawer(false)" class="px-5 py-2.5 bg-orange-600 text-white rounded-xl text-sm font-semibold hover:bg-orange-700 transition">
            Mulai Lihat Menu
          </button>
        </div>
      `;
    } else {
      cartDrawerItems.innerHTML = state.cart.map((item, idx) => {
        const optionDetails = [];
        if (item.selectedVariant) optionDetails.push(item.selectedVariant);
        if (item.selectedSpicy) optionDetails.push(item.selectedSpicy);
        if (item.selectedSugar) optionDetails.push(item.selectedSugar);
        if (item.selectedToppings && item.selectedToppings.length > 0) {
          optionDetails.push(item.selectedToppings.map(t => t.name).join(", "));
        }
        if (item.note) optionDetails.push(`Catatan: "${item.note}"`);

        return `
          <div class="p-4 bg-white rounded-xl border border-slate-100 shadow-sm flex items-start gap-3 hover:border-orange-200 transition">
            <img src="${item.image}" alt="${escapeHtml(item.name)}" class="w-16 h-16 rounded-lg object-cover flex-shrink-0 bg-slate-100">
            
            <div class="flex-1 min-w-0">
              <div class="flex items-start justify-between gap-2">
                <h5 class="font-bold text-slate-800 text-sm line-clamp-1">${escapeHtml(item.name)}</h5>
                <button onclick="removeCartItem(${idx})" class="text-slate-400 hover:text-rose-500 transition p-1">
                  <i data-lucide="trash-2" class="w-4 h-4"></i>
                </button>
              </div>

              ${optionDetails.length > 0 ? `
                <p class="text-[11px] text-slate-500 line-clamp-2 mt-0.5">${escapeHtml(optionDetails.join(" • "))}</p>
              ` : ""}

              <div class="flex items-center justify-between mt-3">
                <span class="font-bold text-sm text-orange-600">${formatRupiah(item.unitPrice * item.quantity)}</span>
                
                <div class="flex items-center border border-slate-200 rounded-lg bg-slate-50 p-0.5">
                  <button onclick="updateCartQuantity(${idx}, -1)" class="w-6 h-6 rounded flex items-center justify-center text-slate-600 hover:bg-white hover:text-orange-600 transition">
                    <i data-lucide="minus" class="w-3.5 h-3.5"></i>
                  </button>
                  <span class="w-7 text-center font-bold text-xs text-slate-800">${item.quantity}</span>
                  <button onclick="updateCartQuantity(${idx}, 1)" class="w-6 h-6 rounded flex items-center justify-center text-slate-600 hover:bg-white hover:text-orange-600 transition">
                    <i data-lucide="plus" class="w-3.5 h-3.5"></i>
                  </button>
                </div>
              </div>
            </div>
          </div>
        `;
      }).join("");
    }
  }

  // Render Checkout Summary Items jika modal checkout aktif
  renderCheckoutSummary();

  if (window.lucide) window.lucide.createIcons();
}

function updateCartQuantity(index, delta) {
  if (state.cart[index]) {
    const newQty = state.cart[index].quantity + delta;
    if (newQty <= 0) {
      state.cart.splice(index, 1);
    } else {
      state.cart[index].quantity = newQty;
      state.cart[index].totalPrice = state.cart[index].unitPrice * newQty;
    }
    saveCart();
  }
}

function removeCartItem(index) {
  if (state.cart[index]) {
    state.cart.splice(index, 1);
    saveCart();
    showToast("Item dihapus dari keranjang", "info");
  }
}

function clearCart() {
  if (confirm("Apakah Anda yakin ingin mengosongkan keranjang belanja?")) {
    state.cart = [];
    state.activeVoucher = null;
    saveCart();
    showToast("Keranjang berhasil dikosongkan", "info");
  }
}

// Drawer Toggle
function toggleCartDrawer(isOpen) {
  const drawer = document.getElementById("cartDrawer");
  const backdrop = document.getElementById("cartBackdrop");
  if (!drawer || !backdrop) return;

  if (isOpen) {
    drawer.classList.remove("translate-x-full");
    backdrop.classList.remove("opacity-0", "pointer-events-none");
    document.body.classList.add("overflow-hidden");
  } else {
    drawer.classList.add("translate-x-full");
    backdrop.classList.add("opacity-0", "pointer-events-none");
    document.body.classList.remove("overflow-hidden");
  }
}

// Voucher Promo Logic
function applyVoucher() {
  const voucherInput = document.getElementById("voucherCodeInput");
  if (!voucherInput) return;
  const code = voucherInput.value.trim().toUpperCase();

  if (!code) {
    showToast("Masukkan kode voucher terlebih dahulu", "error");
    return;
  }

  const voucher = state.storeConfig.vouchers[code];
  if (!voucher) {
    showToast("Kode voucher tidak valid atau telah kedaluwarsa", "error");
    return;
  }

  const subtotal = state.cart.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
  if (subtotal < voucher.minSpend) {
    showToast(`Minimal belanja ${formatRupiah(voucher.minSpend)} untuk menggunakan kode ini`, "error");
    return;
  }

  state.activeVoucher = { code, ...voucher };
  updateCartUI();
  showToast(`Voucher ${code} berhasil dipasang!`, "success");
}

function removeVoucher() {
  state.activeVoucher = null;
  const voucherInput = document.getElementById("voucherCodeInput");
  if (voucherInput) voucherInput.value = "";
  updateCartUI();
  showToast("Voucher dilepas", "info");
}

// Modal Checkout Terpadu
function openCheckoutModal() {
  if (state.cart.length === 0) {
    showToast("Keranjang belanja Anda masih kosong!", "error");
    return;
  }
  toggleCartDrawer(false);

  const modal = document.getElementById("checkoutModal");
  if (modal) {
    modal.classList.remove("hidden");
    modal.classList.add("flex");
    document.body.classList.add("overflow-hidden");
    renderCheckoutSummary();
  }
}

function closeCheckoutModal() {
  const modal = document.getElementById("checkoutModal");
  if (modal) {
    modal.classList.add("hidden");
    modal.classList.remove("flex");
    document.body.classList.remove("overflow-hidden");
  }
}

function renderCheckoutSummary() {
  const summaryContainer = document.getElementById("checkoutOrderList");
  if (!summaryContainer) return;

  summaryContainer.innerHTML = state.cart.map(item => {
    const opts = [];
    if (item.selectedVariant) opts.push(item.selectedVariant);
    if (item.selectedSpicy) opts.push(item.selectedSpicy);
    if (item.selectedSugar) opts.push(item.selectedSugar);
    if (item.selectedToppings && item.selectedToppings.length > 0) {
      opts.push(item.selectedToppings.map(t => t.name).join(", "));
    }

    return `
      <div class="flex items-center justify-between text-xs py-1.5 border-b border-slate-100 last:border-0">
        <div class="min-w-0 pr-2">
          <div class="font-bold text-slate-800">${item.quantity}x ${escapeHtml(item.name)}</div>
          ${opts.length > 0 ? `<div class="text-[10px] text-slate-500">${escapeHtml(opts.join(" | "))}</div>` : ""}
          ${item.note ? `<div class="text-[10px] text-orange-600 italic">"${escapeHtml(item.note)}"</div>` : ""}
        </div>
        <span class="font-bold text-slate-700 whitespace-nowrap">${formatRupiah(item.unitPrice * item.quantity)}</span>
      </div>
    `;
  }).join("");
}

// Deteksi Geolocation GPS Pemesan
function detectCustomerLocation() {
  const btn = document.getElementById("btnDetectGps");
  const badge = document.getElementById("customerGpsBadge");
  const latInput = document.getElementById("customerLat");
  const lngInput = document.getElementById("customerLng");
  const addressText = document.getElementById("deliveryAddress");

  if (!navigator.geolocation) {
    showToast("Fitur GPS tidak didukung di browser ini", "error");
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<i data-lucide="loader-2" class="w-3.5 h-3.5 animate-spin"></i><span>Mencari titik GPS...</span>`;
    if (window.lucide) window.lucide.createIcons();
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;

      if (latInput) latInput.value = lat;
      if (lngInput) lngInput.value = lng;
      if (badge) badge.classList.remove("hidden");

      if (addressText && !addressText.value.trim()) {
        addressText.value = `[Lokasi GPS Terdeteksi: ${lat.toFixed(5)}, ${lng.toFixed(5)}] - (Silakan tambahkan nomor rumah / patokan)`;
      }

      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `<i data-lucide="check" class="w-3.5 h-3.5 text-emerald-600"></i><span class="text-emerald-700">GPS Terkunci</span>`;
        if (window.lucide) window.lucide.createIcons();
      }

      showToast("Titik lokasi pengiriman berhasil dideteksi!", "success");
    },
    (err) => {
      console.warn("GPS Error:", err);
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `<i data-lucide="crosshair" class="w-3.5 h-3.5"></i><span>Gunakan Lokasi GPS Saya</span>`;
        if (window.lucide) window.lucide.createIcons();
      }
      showToast("Gagal mengambil titik GPS. Pastikan izin lokasi aktif.", "error");
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
}

function clearCustomerGps() {
  const latInput = document.getElementById("customerLat");
  const lngInput = document.getElementById("customerLng");
  const badge = document.getElementById("customerGpsBadge");
  const btn = document.getElementById("btnDetectGps");

  if (latInput) latInput.value = "";
  if (lngInput) lngInput.value = "";
  if (badge) badge.classList.add("hidden");
  if (btn) {
    btn.innerHTML = `<i data-lucide="crosshair" class="w-3.5 h-3.5"></i><span>Gunakan Lokasi GPS Saya</span>`;
    if (window.lucide) window.lucide.createIcons();
  }
}


// Handler Ganti Tipe Order (Delivery / Dine-in / Take Away)
function onOrderTypeChanged() {
  const type = document.querySelector('input[name="orderType"]:checked')?.value || "delivery";
  const addressContainer = document.getElementById("deliveryAddressSection");
  const dineInContainer = document.getElementById("dineInTableSection");

  if (addressContainer && dineInContainer) {
    if (type === "delivery") {
      addressContainer.classList.remove("hidden");
      dineInContainer.classList.add("hidden");
    } else if (type === "dine-in") {
      addressContainer.classList.add("hidden");
      dineInContainer.classList.remove("hidden");
    } else {
      addressContainer.classList.add("hidden");
      dineInContainer.classList.add("hidden");
    }
  }

  updateCartUI();
}

// Handler Proses Checkout Final
function processCheckout(actionType) {
  const customerName = document.getElementById("customerName")?.value.trim();
  const customerPhone = document.getElementById("customerPhone")?.value.trim();
  const orderType = document.querySelector('input[name="orderType"]:checked')?.value || "delivery";
  const tableNumber = document.getElementById("tableNumber")?.value.trim();
  const deliveryAddress = document.getElementById("deliveryAddress")?.value.trim();
  const deliveryNote = document.getElementById("deliveryNote")?.value.trim();
  const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked')?.value || "QRIS";
  const latVal = parseFloat(document.getElementById("customerLat")?.value);
  const lngVal = parseFloat(document.getElementById("customerLng")?.value);

  // Validasi
  if (!customerName) {
    showToast("Silakan isi nama pemesan terlebih dahulu", "error");
    document.getElementById("customerName")?.focus();
    return;
  }
  if (!customerPhone || customerPhone.length < 8) {
    showToast("Silakan isi nomor WhatsApp pemesan yang aktif", "error");
    document.getElementById("customerPhone")?.focus();
    return;
  }
  if (orderType === "delivery" && !deliveryAddress) {
    showToast("Silakan masukkan alamat lengkap pengantaran makanan", "error");
    document.getElementById("deliveryAddress")?.focus();
    return;
  }
  if (orderType === "dine-in" && !tableNumber) {
    showToast("Silakan masukkan nomor meja Anda", "error");
    document.getElementById("tableNumber")?.focus();
    return;
  }

  // Hitung ulang harga
  const subtotal = state.cart.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
  let discountAmount = 0;
  if (state.activeVoucher && subtotal >= state.activeVoucher.minSpend) {
    if (state.activeVoucher.type === "percent") {
      discountAmount = Math.round((subtotal * state.activeVoucher.value) / 100);
    } else if (state.activeVoucher.type === "fixed" || state.activeVoucher.type === "shipping") {
      discountAmount = state.activeVoucher.value;
    }
  }
  let shippingFee = 0;
  if (orderType === "delivery") {
    shippingFee = subtotal >= state.storeConfig.minFreeDelivery ? 0 : state.storeConfig.deliveryFee;
  }
  const grandTotal = Math.max(0, subtotal - discountAmount + shippingFee);

  // Buat Data Invoice Pesanan
  const invoiceId = "KB-" + Date.now().toString().slice(-6);
  const orderData = {
    invoiceId,
    orderDate: new Date().toLocaleString("id-ID", { dateStyle: "full", timeStyle: "short" }),
    customerName,
    customerPhone,
    orderType: orderType === "delivery" ? "Delivery (Antar ke Alamat)" : (orderType === "dine-in" ? `Makan di Tempat (Meja #${tableNumber})` : "Take Away (Bungkus Bawa Pulang)"),
    deliveryAddress: orderType === "delivery" ? deliveryAddress : "-",
    deliveryNote: deliveryNote || "-",
    coords: (!isNaN(latVal) && !isNaN(lngVal)) ? { lat: latVal, lng: lngVal } : null,
    paymentMethod,
    items: [...state.cart],
    subtotal,
    discountAmount,
    voucherCode: state.activeVoucher?.code || null,
    shippingFee,
    grandTotal,
    status: "Menunggu Konfirmasi",
    assignedCourier: null
  };

  // Simpan ke riwayat pesanan toko (untuk dashboard admin & kurir lintas device)
  try {
    const existingOrders = JSON.parse(localStorage.getItem("kb_orders_history") || "[]");
    existingOrders.unshift(orderData);
    localStorage.setItem("kb_orders_history", JSON.stringify(existingOrders));

    // Sinkronkan ke Cloud agar admin dan kurir di perangkat lain langsung menerima notifikasi
    if (typeof CloudSync !== "undefined") {
      CloudSync.set(CloudSync.KEYS.ORDERS, existingOrders);
    }
  } catch (e) {
    console.error("Gagal mencatat riwayat pesanan:", e);
  }


  if (actionType === "whatsapp") {
    sendOrderViaWhatsApp(orderData);
    openReceiptModal(orderData);
    closeCheckoutModal();
  } else if (actionType === "receipt") {
    openReceiptModal(orderData);
    closeCheckoutModal();
  }
}


// Buat Format Pesan WhatsApp & Redirect
function sendOrderViaWhatsApp(order) {
  let message = `*Halo ${state.storeConfig.storeName}*, saya ingin memesan makanan:\n\n`;
  message += `📋 *INVOICE:* #${order.invoiceId}\n`;
  message += `📅 *WAKTU:* ${order.orderDate}\n`;
  message += `👤 *NAMA:* ${order.customerName}\n`;
  message += `📱 *NO. WA:* ${order.customerPhone}\n`;
  message += `🛵 *METODE:* ${order.orderType}\n`;

  if (order.deliveryAddress !== "-") {
    message += `📍 *ALAMAT:* ${order.deliveryAddress}\n`;
  }
  if (order.coords) {
    message += `🗺️ *TITIK GOOGLE MAPS:* https://www.google.com/maps?q=${order.coords.lat},${order.coords.lng}\n`;
  }
  if (order.deliveryNote !== "-") {
    message += `📝 *CATATAN PENGIRIMAN:* ${order.deliveryNote}\n`;
  }
  message += `💳 *PEMBAYARAN:* ${order.paymentMethod}\n\n`;


  message += `*--- DAFTAR PESANAN ---*\n`;
  order.items.forEach((item, i) => {
    message += `${i + 1}. *${item.name}* (x${item.quantity}) = ${formatRupiah(item.unitPrice * item.quantity)}\n`;
    
    const details = [];
    if (item.selectedVariant) details.push(`Varian: ${item.selectedVariant}`);
    if (item.selectedSpicy) details.push(`Pedas: ${item.selectedSpicy}`);
    if (item.selectedSugar) details.push(`Manis: ${item.selectedSugar}`);
    if (item.selectedToppings && item.selectedToppings.length > 0) {
      details.push(`Topping: ${item.selectedToppings.map(t => t.name).join(", ")}`);
    }
    if (item.note) details.push(`Catatan: ${item.note}`);

    if (details.length > 0) {
      message += `   _${details.join(" | ")}_\n`;
    }
  });

  message += `\n*--- RINCIAN PEMBAYARAN ---*\n`;
  message += `Subtotal: ${formatRupiah(order.subtotal)}\n`;
  if (order.discountAmount > 0) {
    message += `Diskon (${order.voucherCode}): -${formatRupiah(order.discountAmount)}\n`;
  }
  if (order.shippingFee > 0) {
    message += `Ongkos Kirim: ${formatRupiah(order.shippingFee)}\n`;
  } else if (order.deliveryAddress !== "-") {
    message += `Ongkos Kirim: GRATIS\n`;
  }
  message += `*TOTAL BAYAR: ${formatRupiah(order.grandTotal)}*\n\n`;
  message += `Mohon konfirmasi pesanan saya. Terima kasih! 🙏`;

  const cleanPhone = state.storeConfig.whatsappNumber.replace(/[^0-9]/g, "");
  const waUrl = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(message)}`;
  
  window.open(waUrl, "_blank");
}

// Modal Struk / Invoice Digital
function openReceiptModal(order) {
  const modal = document.getElementById("receiptModal");
  const content = document.getElementById("receiptContent");
  if (!modal || !content) return;

  let paymentDetailsHtml = "";
  if (order.paymentMethod === "QRIS") {
    paymentDetailsHtml = `
      <div class="bg-orange-50 border border-orange-200 rounded-xl p-4 text-center my-4">
        <p class="text-xs font-bold text-orange-800 uppercase tracking-wide mb-2">Scan QRIS untuk Pembayaran Cepat</p>
        <div class="w-44 h-44 mx-auto bg-white p-2 rounded-xl shadow-sm border border-slate-200 flex items-center justify-center">
          <img src="${state.storeConfig.qrisImageUrl}" alt="QRIS Kuliner Bengkayang" class="w-full h-full object-contain">
        </div>
        <p class="text-[11px] text-slate-500 mt-2">Mendukung GoPay, OVO, Dana, ShopeePay, BCA, Mandiri & Semua Mobile Banking</p>
      </div>
    `;
  } else if (order.paymentMethod === "Transfer Bank") {
    paymentDetailsHtml = `
      <div class="bg-slate-50 border border-slate-200 rounded-xl p-4 my-4">
        <p class="text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">Transfer ke Rekening Resmi Toko:</p>
        <div class="space-y-2 text-xs">
          ${state.storeConfig.bankAccounts.map(b => `
            <div class="flex items-center justify-between p-2 bg-white rounded-lg border border-slate-200">
              <div>
                <span class="font-bold text-slate-800">${b.bank}</span>: <span class="font-mono text-orange-600 font-semibold">${b.number}</span>
                <div class="text-[10px] text-slate-400">a.n ${b.holder}</div>
              </div>
              <button onclick="copyToClipboard('${b.number}')" class="px-2 py-1 bg-slate-100 hover:bg-orange-100 text-slate-600 hover:text-orange-600 rounded text-[11px] font-semibold transition">Salin</button>
            </div>
          `).join("")}
        </div>
      </div>
    `;
  }

  content.innerHTML = `
    <div class="text-center pb-4 border-b border-dashed border-slate-200">
      <img src="assets/logo.jpg" alt="PintasFood" class="h-14 w-auto object-contain mx-auto mb-2 rounded-xl" />
      <h3 class="font-bold text-slate-800 text-lg sm:text-xl">${state.storeConfig.storeName}</h3>
      <p class="text-xs text-slate-500">${state.storeConfig.storeAddress}</p>
      <div class="mt-2 inline-block px-3 py-1 bg-emerald-100 text-emerald-800 font-bold text-xs rounded-full">
        Pesanan Diterima (#${order.invoiceId})
      </div>
    </div>

    <!-- Data Pelanggan -->
    <div class="py-3 text-xs border-b border-slate-100 grid grid-cols-2 gap-2 text-slate-600">
      <div><span class="text-slate-400">Pemesan:</span> <strong>${escapeHtml(order.customerName)}</strong></div>
      <div><span class="text-slate-400">WhatsApp:</span> <strong>${escapeHtml(order.customerPhone)}</strong></div>
      <div><span class="text-slate-400">Waktu:</span> ${order.orderDate}</div>
      <div><span class="text-slate-400">Metode:</span> <strong>${escapeHtml(order.orderType)}</strong></div>
      ${order.deliveryAddress !== "-" ? `
        <div class="col-span-2"><span class="text-slate-400">Alamat:</span> ${escapeHtml(order.deliveryAddress)}</div>
      ` : ""}
    </div>

    <!-- List Item -->
    <div class="py-3 border-b border-dashed border-slate-200 space-y-2">
      ${order.items.map(item => `
        <div class="flex items-start justify-between text-xs">
          <div>
            <span class="font-bold text-slate-800">${item.quantity}x</span> ${escapeHtml(item.name)}
            ${item.note ? `<div class="text-[10px] text-slate-400 italic">"${escapeHtml(item.note)}"</div>` : ""}
          </div>
          <span class="font-semibold text-slate-700">${formatRupiah(item.unitPrice * item.quantity)}</span>
        </div>
      `).join("")}
    </div>

    <!-- Kalkulasi -->
    <div class="py-3 text-xs space-y-1.5 border-b border-slate-200">
      <div class="flex justify-between text-slate-500">
        <span>Subtotal</span>
        <span>${formatRupiah(order.subtotal)}</span>
      </div>
      ${order.discountAmount > 0 ? `
        <div class="flex justify-between text-emerald-600">
          <span>Diskon (${order.voucherCode})</span>
          <span>-${formatRupiah(order.discountAmount)}</span>
        </div>
      ` : ""}
      <div class="flex justify-between text-slate-500">
        <span>Ongkos Kirim</span>
        <span>${order.shippingFee === 0 ? "GRATIS" : formatRupiah(order.shippingFee)}</span>
      </div>
      <div class="flex justify-between font-extrabold text-slate-800 text-sm pt-1 border-t border-slate-100">
        <span>Total Pembayaran</span>
        <span class="text-orange-600">${formatRupiah(order.grandTotal)}</span>
      </div>
    </div>

    ${paymentDetailsHtml}

    <div class="text-center text-xs text-slate-500 pt-3">
      <p class="font-semibold">Terima Kasih Telah Berbelanja!</p>
      <p class="text-[11px] text-slate-400">Simpan struk ini sebagai bukti pemesanan.</p>
    </div>
  `;

  modal.classList.remove("hidden");
  modal.classList.add("flex");
  document.body.classList.add("overflow-hidden");

  if (window.lucide) window.lucide.createIcons();
}

function closeReceiptModal() {
  const modal = document.getElementById("receiptModal");
  if (modal) {
    modal.classList.add("hidden");
    modal.classList.remove("flex");
    document.body.classList.remove("overflow-hidden");
  }
}

// Modal Pengaturan Toko (Quick Setting Nomor WA Penjual)
function openStoreSettingsModal() {
  const modal = document.getElementById("storeSettingsModal");
  if (!modal) return;

  const cfg = state.storeConfig;
  document.getElementById("cfgStoreName").value = cfg.storeName;
  document.getElementById("cfgStoreWa").value = cfg.whatsappNumber;
  document.getElementById("cfgStoreAddress").value = cfg.storeAddress;
  document.getElementById("cfgStoreDeliveryFee").value = cfg.deliveryFee;
  document.getElementById("cfgStoreMinFree").value = cfg.minFreeDelivery;

  modal.classList.remove("hidden");
  modal.classList.add("flex");
  document.body.classList.add("overflow-hidden");
}

function closeStoreSettingsModal() {
  const modal = document.getElementById("storeSettingsModal");
  if (modal) {
    modal.classList.add("hidden");
    modal.classList.remove("flex");
    document.body.classList.remove("overflow-hidden");
  }
}

function saveStoreSettingsFromModal() {
  const newName = document.getElementById("cfgStoreName")?.value.trim();
  const newWa = document.getElementById("cfgStoreWa")?.value.trim();
  const newAddress = document.getElementById("cfgStoreAddress")?.value.trim();
  const newDeliveryFee = parseInt(document.getElementById("cfgStoreDeliveryFee")?.value || "10000");
  const newMinFree = parseInt(document.getElementById("cfgStoreMinFree")?.value || "100000");

  if (!newWa) {
    showToast("Nomor WhatsApp wajib diisi", "error");
    return;
  }

  saveStoreConfig({
    storeName: newName || DEFAULT_STORE_CONFIG.storeName,
    whatsappNumber: newWa,
    storeAddress: newAddress || DEFAULT_STORE_CONFIG.storeAddress,
    deliveryFee: isNaN(newDeliveryFee) ? 10000 : newDeliveryFee,
    minFreeDelivery: isNaN(newMinFree) ? 100000 : newMinFree
  });

  closeStoreSettingsModal();
}

// Utility: Toast Notification
function showToast(message, type = "info") {
  const container = document.getElementById("toastContainer");
  if (!container) return;

  const toast = document.createElement("div");
  const bgClasses = type === "success" 
    ? "bg-emerald-600 text-white" 
    : type === "error" 
      ? "bg-rose-600 text-white" 
      : "bg-slate-800 text-white";

  toast.className = `flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-xl text-sm font-medium transition-all transform duration-300 opacity-0 translate-y-3 ${bgClasses}`;
  
  let iconName = type === "success" ? "check-circle" : (type === "error" ? "alert-circle" : "info");
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

// Animasi Tombol Cart
function animateCartButton() {
  const btns = document.querySelectorAll(".cart-trigger-btn");
  btns.forEach(btn => {
    btn.classList.add("cart-bump");
    setTimeout(() => btn.classList.remove("cart-bump"), 400);
  });
}

// Salin ke Clipboard
function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    showToast("Nomor rekening berhasil disalin!", "success");
  }).catch(() => {
    showToast("Gagal menyalin", "error");
  });
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

// Event Listeners Global
function initEventListeners() {
  const searchInput = document.getElementById("searchInput");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      state.searchQuery = e.target.value;
      renderMenu();
    });
  }

  // Tutup modal jika klik luar
  window.addEventListener("click", (e) => {
    if (e.target.id === "foodDetailModal") closeFoodDetailModal();
    if (e.target.id === "checkoutModal") closeCheckoutModal();
    if (e.target.id === "receiptModal") closeReceiptModal();
    if (e.target.id === "storeSettingsModal") closeStoreSettingsModal();
  });
}
