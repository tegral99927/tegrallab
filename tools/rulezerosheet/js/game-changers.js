/**
 * game-changers.js - WotC/CFP公式 Game Changers リストと判定ロジック
 */

export const GAME_CHANGERS_DATABASE = [
  // Fast Mana / Acceleration
  { en: "Ancient Tomb", ja: "古えの墳墓", category: "mana" },
  { en: "Chrome Mox", ja: "金属モックス", category: "mana" },
  { en: "Mox Diamond", ja: "モックス・ダイアモンド", category: "mana" },
  { en: "Mox Opal", ja: "オパールのモックス", category: "mana" },
  { en: "Mana Vault", ja: "魔力の櫃", category: "mana" },
  { en: "Grim Monolith", ja: "厳かなモノリス", category: "mana" },
  { en: "Lion's Eye Diamond", ja: "ライオンの瞳のダイアモンド", category: "mana" },
  { en: "Gaea's Cradle", ja: "ガイアの揺籃の地", category: "mana" },
  { en: "Serra's Sanctum", ja: "セラの聖域", category: "mana" },

  // Tutors
  { en: "Demonic Tutor", ja: "悪魔の教示者", category: "tutor" },
  { en: "Vampiric Tutor", ja: "吸血の教示者", category: "tutor" },
  { en: "Imperial Seal", ja: "帝国の皇印", category: "tutor" },
  { en: "Mystical Tutor", ja: "神秘の教示者", category: "tutor" },
  { en: "Worldly Tutor", ja: "俗世の教示者", category: "tutor" },
  { en: "Enlightened Tutor", ja: "悟りの教示者", category: "tutor" },
  { en: "Gamble", ja: "ギャンブル", category: "tutor" },
  { en: "Survival of the Fittest", ja: "適者生存", category: "tutor" },
  { en: "Intuition", ja: "直観", category: "tutor" },

  // Heavy Advantage / Engine
  { en: "The One Ring", ja: "一つの指輪", category: "engine" },
  { en: "Rhystic Study", ja: "リスティックの研究", category: "engine" },
  { en: "Smothering Tithe", ja: "息詰まる徴税", category: "engine" },
  { en: "Mystic Remora", ja: "神秘的負荷", category: "engine" },
  { en: "Necropotence", ja: "ネクロポーテンス", category: "engine" },
  { en: "Bolas's Citadel", ja: "ボーラスの城塞", category: "engine" },
  { en: "Sylvan Library", ja: "森の知恵", category: "engine" },
  { en: "Ad Nauseam", ja: "むかつき", category: "engine" },
  { en: "Wheel of Fortune", ja: "車輪の幸運", category: "engine" },
  { en: "Timetwister", ja: "Time Twister", category: "engine" },
  { en: "Esper Sentinel", ja: "エスパーの歩哨", category: "engine" },
  { en: "Orcish Bowmasters", ja: "オークの弓使い", category: "engine" },

  // Combos & Game Enders
  { en: "Thassa's Oracle", ja: "タッサの神託者", category: "wincon" },
  { en: "Underworld Breach", ja: "死の国からの脱出", category: "wincon" },
  { en: "Food Chain", ja: "食物連鎖", category: "wincon" },

  // Premium Free / Efficient Spells & Disruptions
  { en: "Force of Will", ja: "意志の力", category: "interaction" },
  { en: "Force of Negation", ja: "否定の力", category: "interaction" },
  { en: "Fierce Guardianship", ja: "激情の後見", category: "interaction" },
  { en: "Deflecting Swat", ja: "偏向はたき", category: "interaction" },
  { en: "Mana Drain", ja: "マナ吸収", category: "interaction" },
  { en: "Cyclonic Rift", ja: "サイクロンの裂け目", category: "interaction" },
  { en: "Drannith Magistrate", ja: "ドラニスの判事", category: "stax" },
  { en: "Opposition Agent", ja: "敵対工作員", category: "stax" },
  { en: "Dauthi Voidwalker", ja: "ダウスィーの虚空歩き", category: "stax" },

  // Historically Notable Game Changers
  { en: "Mana Crypt", ja: "魔力の墓所", category: "mana" },
  { en: "Jeweled Lotus", ja: "宝石の睡蓮", category: "mana" },
  { en: "Dockside Extortionist", ja: "波止場の恐喝者", category: "mana" },
  { en: "Kinnan, Bonder Prodigy", ja: "眷者の神童、キナン", category: "commander" },
  { en: "Winota, Joiner of Forces", ja: "武力同盟の工作員、ウィノータ", category: "commander" },
  { en: "Grand Arbiter Augustin IV", ja: "大判事オーガスティン四世", category: "commander" },
  { en: "Tergrid, God of Fright // Tergrid's Lantern", ja: "恐怖の神、ターグリッド", category: "commander" },
  { en: "Urza, Lord High Artificer", ja: "最高工匠卿、ウルザ", category: "commander" }
];

/**
 * カード名を正規化（小文字化、記号・スペース統一）
 */
export function normalizeCardName(name) {
  if (!name) return "";
  return name
    .toLowerCase()
    .replace(/[//'’".,\-–—_!?:()[\]]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// 高速検索用のSetを作成
const gcNormalizedSet = new Map();
GAME_CHANGERS_DATABASE.forEach(gc => {
  const normEn = normalizeCardName(gc.en);
  const normJa = normalizeCardName(gc.ja);
  if (normEn) gcNormalizedSet.set(normEn, gc);
  if (normJa) gcNormalizedSet.set(normJa, gc);

  // 分割カード・両面カードの片面でもマッチするように
  if (gc.en.includes("//")) {
    const parts = gc.en.split("//").map(s => s.trim());
    parts.forEach(p => gcNormalizedSet.set(normalizeCardName(p), gc));
  }
});

/**
 * 与えられたカード名がGame Changerか判定
 * @param {string} cardName
 * @returns {object|null}
 */
export function findGameChanger(cardName) {
  if (!cardName) return null;
  const norm = normalizeCardName(cardName);
  return gcNormalizedSet.get(norm) || null;
}

/**
 * リスト内の全カード名からGame Changersを抽出
 * @param {string[]} cardNames
 * @returns {{ count: number, cards: object[] }}
 */
export function detectGameChangers(cardNames) {
  const found = new Map();
  cardNames.forEach(rawName => {
    const gc = findGameChanger(rawName);
    if (gc && !found.has(gc.en)) {
      found.set(gc.en, gc);
    }
  });

  return {
    count: found.size,
    cards: Array.from(found.values())
  };
}
