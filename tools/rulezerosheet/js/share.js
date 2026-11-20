/**
 * share.js - URLフラグメント (#data=...) による登録不要の共有URL生成 & 復元
 */

/**
 * デッキ情報から共有URLのフラグメントを生成
 * @param {object} deck
 * @returns {string} 完全なURL
 */
export function generateShareUrl(deck) {
  // 共有に必要な項目を軽量化キーで格納
  const payload = {
    v: 1,
    dn: deck.deckName || "",
    b: deck.bracket || 2,
    gc: deck.gameChangerCount || 0,
    cd: (deck.commanders || []).map(c => ({
      n: c.name || "",
      pn: c.printedName || "",
      u: c.imageUrl || ""
    })),
    dsc: deck.commanderDescription || "",
    f: deck.deckFeatures || [],
    w: deck.winConditions || "",
    cmb: deck.comboDescription || "",
    pp: deck.playPreferences || [],
    ap: deck.avoidPreferences || [],
    not: deck.additionalNotes || "",
    st: deck.sheetType || "quick"
  };

  try {
    const jsonStr = JSON.stringify(payload);
    // UTF-8対応のBase64エンコード
    const encoded = btoa(encodeURIComponent(jsonStr).replace(/%([0-9A-F]{2})/g, (match, p1) => {
      return String.fromCharCode("0x" + p1);
    }));

    const url = new URL(window.location.href);
    url.hash = `share=${encoded}`;
    return url.toString();
  } catch (err) {
    console.error("Failed to generate share URL:", err);
    return window.location.href;
  }
}

/**
 * 現在のURLハッシュから共有データを復元
 * @returns {object|null}
 */
export function parseShareUrl() {
  const hash = window.location.hash;
  if (!hash || !hash.includes("share=")) return null;

  try {
    const match = hash.match(/share=([A-Za-z0-9+/=_-]+)/);
    if (!match) return null;

    const base64Str = match[1];
    const decodedJson = decodeURIComponent(Array.prototype.map.call(atob(base64Str), c => {
      return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(""));

    const p = JSON.parse(decodedJson);
    if (!p) return null;

    return {
      schemaVersion: 1,
      deckId: "shared_" + Date.now().toString(36),
      deckName: p.dn || "Shared Deck",
      bracket: p.b || 2,
      gameChangerCount: p.gc || 0,
      gameChangerCountSource: "manual",
      commanders: (p.cd || []).map(c => ({
        id: "",
        name: c.n || "",
        printedName: c.pn || c.n || "",
        imageUrl: c.u || "",
        manaCost: "",
        typeLine: "",
        colorIdentity: []
      })),
      commanderDescription: p.dsc || "",
      deckFeatures: Array.isArray(p.f) ? p.f : [],
      winConditions: p.w || "",
      comboDescription: p.cmb || "",
      interactionFeatures: [],
      playPreferences: Array.isArray(p.pp) ? p.pp : [],
      avoidPreferences: Array.isArray(p.ap) ? p.ap : [],
      proxyStatus: "none",
      additionalNotes: p.not || "",
      sheetType: p.st === "detailed" ? "detailed" : "quick",
      sheetTheme: "dark",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  } catch (err) {
    console.warn("Failed to parse shared deck from URL:", err);
    return null;
  }
}
