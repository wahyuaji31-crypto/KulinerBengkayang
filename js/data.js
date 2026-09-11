// Data Mitra Kuliner Resmi PintasFood Bengkayang
const DEFAULT_MERCHANTS = [
  {
    id: "mitra-01",
    name: "Dapur Nusantara Sebalo",
    category: "Makanan Tradisional & Nusantara",
    owner: "Ibu Sri Wahyuni",
    phone: "081234567801",
    address: "Jl. Sanggau Ledo No. 12, Bengkayang",
    rating: 4.9,
    reviewsCount: 184,
    image: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=600&q=80",
    badge: "Mitra Utama",
    badgeColor: "bg-orange-500",
    description: "Spesialis masakan nusantara, bubur pedas khas Kalbar, ayam bakar rempah, dan lauk pauk siap saji lezat.",
    status: "active",
    joinedAt: "2026-01-10"
  },
  {
    id: "mitra-02",
    name: "Kedai Mie Tiaw & Kwetiau Pak Amat",
    category: "Aneka Mie, Kwetiau & Olahan Sapi",
    owner: "Pak Amat",
    phone: "081234567802",
    address: "Jl. Jerendeng AR No. 45, Bengkayang",
    rating: 4.9,
    reviewsCount: 235,
    image: "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=600&q=80",
    badge: "Top Seller",
    badgeColor: "bg-rose-500",
    description: "Pakar olahan kwetiau goreng daging sapi, kwetiau siram seafood, dan mie lezat bumbu turun-temurun.",
    status: "active",
    joinedAt: "2026-01-15"
  },
  {
    id: "mitra-03",
    name: "Dapur Kudapan & Choi Pan Kak Lina",
    category: "Cemilan Khas & Kudapan Tradisional",
    owner: "Kak Lina",
    phone: "081234567803",
    address: "Jl. Basuki Rahmat No. 08, Bengkayang",
    rating: 4.9,
    reviewsCount: 274,
    image: "https://images.unsplash.com/photo-1496116218417-1a781b1c416c?auto=format&fit=crop&w=600&q=80",
    badge: "Favorit Warga",
    badgeColor: "bg-emerald-600",
    description: "Kudapan gurih segar, Choi Pan kukus bengkoang kucai, Pengkang bakar, dan roti srikaya pandan lembut.",
    status: "active",
    joinedAt: "2026-02-01"
  },
  {
    id: "mitra-04",
    name: "Kedai Kopi & Minuman Segar Bumi Sebalo",
    category: "Minuman Segar & Kopi Robusta",
    owner: "Bang Dimas",
    phone: "081234567804",
    address: "Kawasan Pasar Kota Bengkayang",
    rating: 4.9,
    reviewsCount: 343,
    image: "https://images.unsplash.com/photo-1517701604599-bb29b565090c?auto=format&fit=crop&w=600&q=80",
    badge: "Minuman Hits",
    badgeColor: "bg-amber-600",
    description: "Kopi susu gula aren pekat, es jeruk segar perasan murni Sambas, dan es lidah buaya selasih penyegar dahaga.",
    status: "active",
    joinedAt: "2026-02-05"
  }
];

// Data Menu Kuliner Bengkayang & Nusantara (Terhubung dengan Mitra Penyedia)
const DEFAULT_MENU_ITEMS = [
  {
    id: "kb-01",
    merchantId: "mitra-02",
    merchantName: "Kedai Mie Tiaw & Kwetiau Pak Amat",
    name: "Mie Tiaw Goreng Spesial Daging Sapi",
    category: "makanan",
    price: 28000,
    originalPrice: 32000,
    rating: 4.9,
    reviewsCount: 142,
    image: "https://images.unsplash.com/photo-1585032226651-759b368d7246?auto=format&fit=crop&w=800&q=80",
    badge: "Terlaris",
    badgeColor: "bg-rose-500",
    description: "Kwetiau beras khas yang digoreng dengan bumbu rempah otentik, daging sapi empuk, tauge segar, telur, dan daun kucai.",
    options: {
      spicyLevels: ["Tidak Pedas", "Pedas Sedang", "Pedas Gurih", "Super Pedas (Level 5)"],
      toppings: [
        { name: "Telur Ceplok", price: 4000 },
        { name: "Ekstra Daging Sapi", price: 8000 },
        { name: "Kerupuk Kulit", price: 3000 }
      ]
    }
  },
  {
    id: "kb-02",
    merchantId: "mitra-01",
    merchantName: "Dapur Nusantara Sebalo",
    name: "Bubur Pedas Khas Kalbar Komplit",
    category: "makanan",
    price: 22000,
    originalPrice: 25000,
    rating: 4.8,
    reviewsCount: 98,
    image: "https://images.unsplash.com/photo-1547928576-a4a33237cbc3?auto=format&fit=crop&w=800&q=80",
    badge: "Khas Daerah",
    badgeColor: "bg-amber-600",
    description: "Bubur gurih dari beras sangrai rempah dengan aneka daun kesum, kangkung, pakis, jagung manis, taburan kacang goreng, dan teri renyah.",
    options: {
      spicyLevels: ["Level Sedang", "Level Pedas"],
      toppings: [
        { name: "Ekstra Ikan Teri & Kacang", price: 3000 },
        { name: "Telur Asin", price: 5000 }
      ]
    }
  },
  {
    id: "kb-03",
    merchantId: "mitra-03",
    merchantName: "Dapur Kudapan & Choi Pan Kak Lina",
    name: "Choi Pan / Chai Kwe Kukus (Porsi 5 Pcs)",
    category: "cemilan",
    price: 20000,
    originalPrice: null,
    rating: 4.9,
    reviewsCount: 210,
    image: "https://images.unsplash.com/photo-1496116218417-1a781b1c416c?auto=format&fit=crop&w=800&q=80",
    badge: "Wajib Coba",
    badgeColor: "bg-emerald-600",
    description: "Kudapan kulit lembut kenyal dengan isian bengkuang ebi gurih, kucai wangi, dan taburan minyak bawang putih renyah + saus cocolan pedas asam manis.",
    options: {
      variants: ["Isi Bengkoang Ebi", "Isi Kucai", "Campur (3 Bengkuang, 2 Kucai)"],
      toppings: [
        { name: "Ekstra Sambal Choi Pan", price: 2000 },
        { name: "Ekstra Bawang Putih Goreng", price: 3000 }
      ]
    }
  },
  {
    id: "kb-04",
    merchantId: "mitra-01",
    merchantName: "Dapur Nusantara Sebalo",
    name: "Ayam Bakar Madu Lengkuas + Nasi",
    category: "makanan",
    price: 32000,
    originalPrice: 35000,
    rating: 4.9,
    reviewsCount: 175,
    image: "https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?auto=format&fit=crop&w=800&q=80",
    badge: "Favorit",
    badgeColor: "bg-orange-500",
    description: "Ayam ungkep bumbu rempah lengkuas dibakar harum dengan olesan madu karamel gurih, disajikan dengan nasi hangat, lalapan, dan sambal terasi khas.",
    options: {
      spicyLevels: ["Sambal Terasi Sedang", "Sambal Ijo Pedas", "Sambal Bawang Pedas Nampol"],
      toppings: [
        { name: "Tahu & Tempe Goreng", price: 4000 },
        { name: "Nasi Tambah", price: 5000 },
        { name: "Ekstra Sambal", price: 3000 }
      ]
    }
  },
  {
    id: "kb-05",
    merchantId: "mitra-03",
    merchantName: "Dapur Kudapan & Choi Pan Kak Lina",
    name: "Pengkang Bakar Daun Pisang (3 Pcs)",
    category: "cemilan",
    price: 18000,
    originalPrice: null,
    rating: 4.7,
    reviewsCount: 64,
    image: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80",
    badge: "Khas Tradisional",
    badgeColor: "bg-amber-700",
    description: "Ketan pulen gurih berisi ebi yang dibungkus daun pisang segitiga dan dijepit bambu lalu dibakar harum. Disajikan bersama sambal kepah khas.",
    options: {
      toppings: [
        { name: "Ekstra Sambal Kepah", price: 4000 }
      ]
    }
  },
  {
    id: "kb-06",
    merchantId: "mitra-03",
    merchantName: "Dapur Kudapan & Choi Pan Kak Lina",
    name: "Roti Panggang Srikaya Pandan Asli",
    category: "cemilan",
    price: 15000,
    originalPrice: 18000,
    rating: 4.8,
    reviewsCount: 112,
    image: "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=800&q=80",
    badge: "Manis Legit",
    badgeColor: "bg-teal-600",
    description: "Roti bantal lembut dipanggang hangat dengan olesan selai srikaya telur pandan buatan rumahan dan lelehan mentega gurih.",
    options: {
      variants: ["Roti Panggang", "Roti Kukus Lembut"],
      toppings: [
        { name: "Ekstra Keju Parut", price: 3000 },
        { name: "Ekstra Selai Srikaya", price: 3000 }
      ]
    }
  },
  {
    id: "kb-07",
    merchantId: "mitra-04",
    merchantName: "Kedai Kopi & Minuman Segar Bumi Sebalo",
    name: "Es Jeruk Murni Sambas Segar",
    category: "minuman",
    price: 10000,
    originalPrice: 12000,
    rating: 4.9,
    reviewsCount: 189,
    image: "https://images.unsplash.com/photo-1613478223719-2ab802602423?auto=format&fit=crop&w=800&q=80",
    badge: "Segar Banget",
    badgeColor: "bg-yellow-500",
    description: "Perasan murni jeruk Pontianak/Sambas yang manis asam alami dengan es batu kristal dan sedikit gula murni. Sangat menyegarkan dahaga.",
    options: {
      sugarLevels: ["Manis Normal", "Sedikit Gula (Less Sugar)", "Tanpa Gula Tambahan"],
      iceLevels: ["Es Normal", "Sedikit Es", "Hangat"]
    }
  },
  {
    id: "kb-08",
    merchantId: "mitra-04",
    merchantName: "Kedai Kopi & Minuman Segar Bumi Sebalo",
    name: "Es Lidah Buaya Selasih Lemon",
    category: "minuman",
    price: 12000,
    originalPrice: null,
    rating: 4.8,
    reviewsCount: 88,
    image: "https://images.unsplash.com/photo-1556881286-fc6915169721?auto=format&fit=crop&w=800&q=80",
    badge: "Khas Kalbar",
    badgeColor: "bg-lime-600",
    description: "Potongan daging lidah buaya kenyal segar dipadu biji selasih, perasan lemon segar, dan sirup melon dingin wangi.",
    options: {
      sugarLevels: ["Manis Pas", "Less Sugar"]
    }
  },
  {
    id: "kb-09",
    merchantId: "mitra-04",
    merchantName: "Kedai Kopi & Minuman Segar Bumi Sebalo",
    name: "Kopi Susu Gula Aren Bengkayang",
    category: "minuman",
    price: 14000,
    originalPrice: 16000,
    rating: 4.9,
    reviewsCount: 154,
    image: "https://images.unsplash.com/photo-1517701604599-bb29b565090c?auto=format&fit=crop&w=800&q=80",
    badge: "Kopi Mantap",
    badgeColor: "bg-amber-900",
    description: "Espresso robusta lokal pekat diseduh dengan susu kental creamy dan manis legit gula aren murni.",
    options: {
      variants: ["Dingin (Iced)", "Panas (Hot)"],
      sugarLevels: ["Normal", "Less Sweet", "No Sweetener"]
    }
  },
  {
    id: "kb-10",
    merchantId: "mitra-01",
    merchantName: "Dapur Nusantara Sebalo",
    name: "Paket Kenyang Berdua (2 Nasi Ayam + 2 Es Jeruk)",
    category: "paket",
    price: 65000,
    originalPrice: 78000,
    rating: 5.0,
    reviewsCount: 76,
    image: "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80",
    badge: "Hemat 17%",
    badgeColor: "bg-indigo-600",
    description: "Paket super hemat berisi 2 Porsi Ayam Bakar Madu Lengkuas + Nasi Lengkap, 2 Gelas Es Jeruk Sambas Segar, dan 1 Porsi Tempe Mendoan renyah.",
    options: {
      spicyLevels: ["Pedas Sedang", "Super Pedas"]
    }
  },
  {
    id: "kb-11",
    merchantId: "mitra-03",
    merchantName: "Dapur Kudapan & Choi Pan Kak Lina",
    name: "Paket Nobar Khas (Choi Pan + Pengkang + 2 Es Teh)",
    category: "paket",
    price: 45000,
    originalPrice: 52000,
    rating: 4.9,
    reviewsCount: 61,
    image: "https://images.unsplash.com/photo-1563245372-f21724e3856d?auto=format&fit=crop&w=800&q=80",
    badge: "Hemat 15%",
    badgeColor: "bg-indigo-600",
    description: "Kombinasi kudapan khas: 1 Porsi Choi Pan (5 pcs), 1 Porsi Pengkang Bakar (3 pcs), dan 2 Gelas Es Teh Manis Segar.",
    options: {
      variants: ["Choi Pan Bengkoang", "Choi Pan Campur"]
    }
  },
  {
    id: "kb-12",
    merchantId: "mitra-02",
    merchantName: "Kedai Mie Tiaw & Kwetiau Pak Amat",
    name: "Kwetiau Siram Seafood Telur Puyuh",
    category: "makanan",
    price: 34000,
    originalPrice: 38000,
    rating: 4.9,
    reviewsCount: 93,
    image: "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=800&q=80",
    badge: "Kuah Kental",
    badgeColor: "bg-blue-600",
    description: "Kwetiau goreng gurih disiram kuah kental telur berbumbu sedap dengan topping udang segar, bakso ikan, cumi, dan telur puyuh.",
    options: {
      spicyLevels: ["Original Gurih", "Pedas Cabe Rawit Potong"],
      toppings: [
        { name: "Ekstra Udang & Bakso Ikan", price: 8000 },
        { name: "Ekstra Telur Puyuh (3 pcs)", price: 4000 }
      ]
    }
  }
];

// Konfigurasi Default Toko & Platform
const DEFAULT_STORE_CONFIG = {
  storeName: "PintasFood Bengkayang",
  tagline: "Pusat Kuliner & Mitra Usaha Makanan Bengkayang - Cepat, Lezat & Diantar Langsung",
  whatsappNumber: "6281234567890", // Ganti dengan nomor WA Pengelola PintasFood
  storeAddress: "Jl. Sanggau Ledo No. 45, Bengkayang, Kalimantan Barat",
  openHours: "09:00 - 22:00 WIB",
  deliveryFee: 10000,
  minFreeDelivery: 100000,
  qrisImageUrl: "https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=00020101021126580014ID.LINKAJA.WWW011893600014000000000002081234567851450014ID.DOKU.WWW0215000000000000000520458125802ID5918KULINER BENGKAYANG6010BENGKAYANG61057921162230119KULINERBENGKAYANG016304D1B8",
  bankAccounts: [
    { bank: "BCA", number: "8935 1234 5678", holder: "PintasFood Bengkayang" },
    { bank: "BRI", number: "0012 0102 3456 531", holder: "PintasFood Bengkayang" },
    { bank: "Mandiri", number: "1440 0192 8374 1", holder: "PintasFood Bengkayang" }
  ],
  vouchers: {
    "DISKON10": { type: "percent", value: 10, minSpend: 30000, desc: "Diskon 10% minimal belanja Rp 30.000" },
    "GRATISONGKIR": { type: "shipping", value: 10000, minSpend: 50000, desc: "Potongan ongkir Rp 10.000 min belanja Rp 50.000" },
    "HEMAT5K": { type: "fixed", value: 5000, minSpend: 25000, desc: "Potongan Rp 5.000 min belanja Rp 25.000" }
  }
};
