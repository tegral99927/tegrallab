const https = require("https");
const fs = require("fs");
const path = require("path");

const cardNames = [
  "Tolarian Academy",
  "Mind Over Matter",
  "Time Spiral",
  "Windfall",
  "Stroke of Genius",
  "Lotus Petal",
  "Mana Vault",
  "Mox Diamond",
  "Voltaic Key",
  "Turnabout",
  "Intuition",
  "Scroll Rack",
  "Ancient Tomb",
  "City of Brass",
  "Island",
  "Lotus Field",
  "Thespian's Stage",
  "Yavimaya Coast",
  "Botanical Sanctum",
  "Mana Confluence",
  "Boseiju, Who Endures",
  "Forest",
  "Hidden Strings",
  "Pore Over the Pages",
  "Sylvan Scrying",
  "Vizier of Tumbling Sands",
  "Arboreal Grazer",
  "Emergent Ultimatum",
  "Omniscience",
  "Dark Petition",
  "Mastermind's Acquisition",
  "Peer into the Abyss",
  "Approach of the Second Sun",
  "Lier, Disciple of the Drowned",
  "Bala Ged Recovery // Bala Ged Sanctuary"
];

const postData = JSON.stringify({
  identifiers: cardNames.map(name => ({ name }))
});

const req = https.request("https://api.scryfall.com/cards/collection", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "User-Agent": "ComboDeckLab/1.0",
    "Accept": "application/json"
  }
}, (res) => {
  let body = "";
  res.on("data", chunk => body += chunk);
  res.on("end", () => {
    try {
      const data = JSON.parse(body);
      const outPath = path.join(__dirname, "cards", "scryfall_cache.json");
      fs.writeFileSync(outPath, JSON.stringify(data, null, 2), "utf8");
      console.log("Success! Found:", data.data ? data.data.length : 0);
      if (data.not_found && data.not_found.length > 0) {
        console.log("Not found:", data.not_found);
      }
    } catch(e) {
      console.error("Parse error:", e);
    }
  });
});

req.on("error", (e) => {
  console.error("Network error:", e.message);
});

req.write(postData);
req.end();
