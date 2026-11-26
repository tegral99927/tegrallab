const https = require("https");
const fs = require("fs");
const path = require("path");

function getJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: { "User-Agent": "ComboDeckLab/1.0", "Accept": "application/json" }
    }, (res) => {
      let body = "";
      res.on("data", d => body += d);
      res.on("end", () => {
        try {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(JSON.parse(body));
          } else {
            resolve(null);
          }
        } catch(e) {
          reject(e);
        }
      });
    }).on("error", reject);
  });
}

// Japanese card name map for these specific combo cards
const jaNames = {
  "Tolarian Academy": "トレイリアのアカデミー",
  "Mind Over Matter": "精神力",
  "Time Spiral": "時のらせん",
  "Windfall": "意外な授かり物",
  "Stroke of Genius": "天才のひらめき",
  "Lotus Petal": "水蓮の花びら",
  "Mana Vault": "魔力の櫃",
  "Mox Diamond": "モックス・ダイアモンド",
  "Voltaic Key": "通電式キー",
  "Turnabout": "転換",
  "Intuition": "直観",
  "Scroll Rack": "巻物棚",
  "Ancient Tomb": "古えの墳墓",
  "City of Brass": "真鍮の都",
  "Island": "島",
  "Lotus Field": "睡蓮の原野",
  "Thespian's Stage": "演劇の舞台",
  "Yavimaya Coast": "ヤヴィマヤの沿岸",
  "Botanical Sanctum": "植物の聖域",
  "Mana Confluence": "マナの合流点",
  "Boseiju, Who Endures": "耐え抜くもの、母聖樹",
  "Forest": "森",
  "Hidden Strings": "見えざる糸",
  "Pore Over the Pages": "ページへの没頭",
  "Sylvan Scrying": "森の占術",
  "Arboreal Grazer": "樹上の草食獣",
  "Emergent Ultimatum": "出現の根本原理",
  "Omniscience": "全知",
  "Dark Petition": "闇の誓願",
  "Mastermind's Acquisition": "首謀者の収得",
  "Peer into the Abyss": "深淵への覗き込み",
  "Approach of the Second Sun": "副陽の接近",
  "Lier, Disciple of the Drowned": "水深の信奉者、リーア",
  "Bala Ged Recovery // Bala Ged Sanctuary": "バーラ・ゲドの復活",
  "Vizier of Tumbling Sands": "砂時計の侍臣"
};

async function main() {
  const cachePath = path.join(__dirname, "cards", "scryfall_cache.json");
  const rawData = JSON.parse(fs.readFileSync(cachePath, "utf8"));
  let cards = rawData.data || [];

  // If Bala Ged Recovery not found, fetch it
  const hasBala = cards.some(c => c.name.includes("Bala Ged Recovery"));
  if (!hasBala) {
    console.log("Fetching Bala Ged Recovery...");
    const bala = await getJson("https://api.scryfall.com/cards/named?exact=Bala+Ged+Recovery");
    if (bala) cards.push(bala);
  }

  const metadata = {};
  for (const c of cards) {
    const fullName = c.name;
    const baseName = fullName.split(" // ")[0];
    const oracleId = c.oracle_id;
    const manaCost = c.mana_cost || (c.card_faces ? c.card_faces[0].mana_cost : "");
    const cmc = c.cmc !== undefined ? c.cmc : 0;
    const typeLine = c.type_line || (c.card_faces ? c.card_faces[0].type_line : "");
    const oracleText = c.oracle_text || (c.card_faces ? c.card_faces.map(f => f.name + ": " + f.oracle_text).join("\n---\n") : "");
    const colors = c.colors || (c.card_faces && c.card_faces[0].colors ? c.card_faces[0].colors : []);
    
    // Normal resolution image
    let imageUri = "";
    if (c.image_uris && c.image_uris.normal) {
      imageUri = c.image_uris.normal;
    } else if (c.card_faces && c.card_faces[0].image_uris && c.card_faces[0].image_uris.normal) {
      imageUri = c.card_faces[0].image_uris.normal;
    }

    const jaName = jaNames[fullName] || jaNames[baseName] || c.printed_name || fullName;

    const entry = {
      name: fullName,
      baseName,
      jaName,
      oracleId,
      manaCost,
      cmc,
      typeLine,
      oracleText,
      colors,
      imageUri,
      scryfallUri: c.scryfall_uri,
      legalities: c.legalities || {}
    };

    metadata[fullName] = entry;
    if (baseName !== fullName) {
      metadata[baseName] = entry;
    }
  }

  const outPath = path.join(__dirname, "cards", "card-metadata.json");
  fs.writeFileSync(outPath, JSON.stringify(metadata, null, 2), "utf8");
  console.log(`Saved metadata for ${Object.keys(metadata).length} keys to ${outPath}`);
}

main().catch(console.error);
