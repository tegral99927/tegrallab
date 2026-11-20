/**
 * config.js - アプリ全体の設定定数
 */

export const APP_CONFIG = {
  appName: "Commander Rule Zero Sheet Maker",
  appTitleJa: "統率者ルールゼロシートメーカー",
  appTitleEn: "Commander Rule Zero Sheet Maker",
  appVersion: "1.0.0",
  schemaVersion: 1,
  baseUrl: "https://tegrallab.com/tools/rulezerosheet/",
  storageKey: "rulezerosheet_decks_v1",
  activeDeckKey: "rulezerosheet_active_deck_v1",
  themeKey: "rulezerosheet_theme",
  langKey: "rulezerosheet_lang",
  sheetWidth: 1600,
  sheetHeight: 900,

  // Scryfall API 設定
  scryfall: {
    baseUrl: "https://api.scryfall.com",
    autocompleteDelay: 250, // ms
    requestTimeout: 8000,   // ms
    cacheExpiration: 1000 * 60 * 60 * 24 // 24 hours
  },

  // ブラケット定義 (WotC公式)
  brackets: [
    {
      id: 1,
      nameEn: "Exhibition",
      nameJa: "エキシビション",
      descriptionJa: "テーマや演出・ストーリー重視。極めてカジュアルな構築。勝利よりもゲーム体験が目的。",
      descriptionEn: "Theme, art, or narrative driven. Ultra casual. Winning is secondary to experiencing the game.",
      maxGameChangers: 0,
      expectedTurn: "9+ turns",
      badgeColor: "#10b981", // Emerald
      badgeBg: "rgba(16, 185, 129, 0.15)",
      borderColor: "#059669"
    },
    {
      id: 2,
      nameEn: "Core",
      nameJa: "コア",
      descriptionJa: "標準的な構築済みデッキやプレコン改築。コンボ即死や過度な妨害を避け、盤面のやり取りを楽しむ。",
      descriptionEn: "Standard homebrews and precons. Focused on board combat; avoids early infinite combos and heavy lockouts.",
      maxGameChangers: 0,
      expectedTurn: "8+ turns",
      badgeColor: "#3b82f6", // Blue
      badgeBg: "rgba(59, 130, 246, 0.15)",
      borderColor: "#2563eb"
    },
    {
      id: 3,
      nameEn: "Upgraded",
      nameJa: "アップグレード",
      descriptionJa: "シナジーを強化したカジュアル上級。妨害や後半の無限コンボはOKだが、高速2枚即死は自粛。",
      descriptionEn: "Upgraded casual synergy. Efficient interaction & late combos allowed, but hyper-consistent early kills are avoided.",
      maxGameChangers: 3,
      expectedTurn: "6-8 turns",
      badgeColor: "#8b5cf6", // Purple
      badgeBg: "rgba(139, 92, 246, 0.15)",
      borderColor: "#7c3aed"
    },
    {
      id: 4,
      nameEn: "Optimized",
      nameJa: "最適化",
      descriptionJa: "強力なカードと高速マナを惜しみなく投入した高出力デッキ。勝つための最適化が施されている。",
      descriptionEn: "Highly tuned, lethal casual. Uses fast mana and powerful tutors for quick, resilient game plans.",
      maxGameChangers: 99,
      expectedTurn: "4-6 turns",
      badgeColor: "#f59e0b", // Amber
      badgeBg: "rgba(245, 158, 11, 0.15)",
      borderColor: "#d97706"
    },
    {
      id: 5,
      nameEn: "cEDH",
      nameJa: "競技統率者",
      descriptionJa: "最高峰の競技環境。最速ターンでの勝利とそれを巡る超高密度の妨害合戦を前提とする。",
      descriptionEn: "Competitive Commander. Tournament level. The objective is to win or lock as quickly and efficiently as possible.",
      maxGameChangers: 99,
      expectedTurn: "2-4 turns",
      badgeColor: "#ef4444", // Red
      badgeBg: "rgba(239, 68, 68, 0.15)",
      borderColor: "#dc2626"
    }
  ]
};
