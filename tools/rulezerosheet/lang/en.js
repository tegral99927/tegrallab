/**
 * lang/en.js - English dictionary
 */

export default {
  // Meta & Header
  appName: "Commander Rule Zero Sheet Maker",
  appTitle: "Commander Rule Zero Sheet Maker",
  tagline: "Introduce your Commander deck at a glance.",
  subTagline: "Made in 30 seconds, understood in a blink, shared instantly.",

  // Modes
  modeSimple: "Quick Mode",
  modeDetailed: "Detailed Mode",
  modeSimpleDesc: "Pick your Commander, Bracket & features in 30 seconds",
  modeDetailedDesc: "Describe wincons, combos, interaction & table talk in depth",

  // Nav & Actions
  saveDeck: "Save Deck",
  loadDeck: "My Decks",
  newDeck: "New Deck",
  duplicateDeck: "Duplicate",
  deleteDeck: "Delete",
  exportJson: "Export JSON",
  importJson: "Import JSON",
  shareUrl: "Share Link",
  exportPng: "Download PNG",
  copyImage: "Copy Image",
  printSheet: "Print Sheet",
  copiedSuccess: "Image copied to clipboard!",
  copyFailed: "Image copying not supported. Please use Download PNG.",
  urlCopied: "Shareable link copied to clipboard!",

  // Form Fields
  sectionCommander: "1. Commander",
  searchCommanderPlaceholder: "Search card name (English / Japanese)...",
  searching: "Searching Scryfall...",
  searchNoResult: "No matching card found. You can enter manually.",
  searchHint: "e.g., Atraxa / Yuriko / The Ur-Dragon",
  addPartner: "+ Add Second Commander (Partner / Background / Companion)",
  removePartner: "Remove 2nd Commander",
  commanderNameManual: "Commander Name (Manual)",
  commanderDescLabel: "Commander Summary / Gameplan (approx. 3 lines)",
  commanderDescPlaceholder: "e.g., Ramp into Commander quickly, abuse proliferate triggers to overwhelm opponents with value.",

  sectionBracket: "2. Commander Bracket",
  bracketWarning: "Notice: Selected Bracket allows up to {limit} Game Changers, but {count} are included.",

  sectionGameChangers: "3. Game Changers",
  gcCountLabel: "Count:",
  gcSourceManual: "Manual",
  gcSourceAuto: "Decklist Scan",
  gcSourceOverridden: "Manually adjusted",
  gcHint: "Total number of WotC-designated Game Changer cards (fast mana, efficient tutors, wincons).",

  sectionDeckFeatures: "4. Deck Features & Archetype",
  featuresHint: "Select applicable features or type your own custom tag.",
  addCustomFeature: "Add custom feature...",
  addBtn: "Add",

  sectionPlayPreferences: "5. Pre-Game Expectations / Rule 0 Wishes",
  prefStyleLabel: "Desired Play Style (phrased politely & neutrally)",
  avoidStyleLabel: "Things you prefer to avoid",
  customPrefPlaceholder: "Other points to discuss before shuffling up...",

  // Detailed Mode Fields
  sectionDetailedInfo: "Detailed Info",
  deckNameLabel: "Deck Name",
  deckNamePlaceholder: "e.g., Lotus Bloom Storm EDH",
  winConLabel: "Primary Win Condition(s)",
  winConPlaceholder: "e.g., Infinite mana into massive X-spells, or combat damage over time",
  comboLabel: "Combos & Assembly Condition",
  comboPlaceholder: "e.g., Ashnod's Altar + Nim Deathmantle (Turn 7+)",
  approxTurnLabel: "Estimated Decisive Turn",
  approxTurnPlaceholder: "e.g., Turn 6–8",
  interactionLabel: "Interaction & Control Elements",
  proxyLabel: "Proxy Usage",
  proxyNone: "No Proxies (100% Genuine)",
  proxySome: "Some Proxies (High-value / Testing)",
  proxyFull: "Full Proxy Deck",
  notesLabel: "Free Notes / Message to Pod",
  notesPlaceholder: "e.g., Beginners welcome! Running light interaction so games should be friendly.",

  // Decklist Parser
  sectionDecklist: "Auto-Scan Decklist",
  decklistPlaceholder: "Paste your MTG decklist here (e.g., 1 Sol Ring\n1 Rhystic Study ...)",
  analyzeBtn: "Scan List for Game Changers",
  analyzing: "Scanning Scryfall...",
  analyzeResult: "Scanned {total} cards: Found {gc} Game Changers.",

  // Templates
  templateTitle: "Presets & Templates",
  tplCombat: "Combat Focused",
  tplCombo: "Combo Focused",
  tplControl: "Control Focused",
  tplGraveyard: "Graveyard Value",
  tplCommanderCentric: "Commander-Centric / Voltron",
  templateApplied: "Preset applied! You can freely edit any field.",

  // Sheet Preview
  sheetTypeQuick: "Compact Quick Sheet",
  sheetTypeDetailed: "Detailed Sheet",
  previewTitle: "Live Sheet Preview",
  previewDesc: "*Ready to export as PNG or copy directly to clipboard",
  sheetNotice: "Magic: The Gathering is a trademark of Wizards of the Coast. This tool is unofficial Fan Content.",

  // Features Tag Options
  featCombat: "Combat Damage Focused",
  featCombo: "Combo Centric",
  featInfinite: "Infinite Combos Included",
  featTwoCardCombo: "2-Card Combos Present",
  featCommanderDep: "Commander Dependent",
  featControl: "Heavy Control",
  featCounter: "Counterspell Rich",
  featBoardWipe: "Frequent Board Wipes",
  featStax: "Stax / Lock Elements",
  featGraveyard: "Graveyard Synergy",
  featTokens: "Mass Token Generation",
  featTutors: "Tutor Heavy",
  featExtraTurns: "Extra Turns Included",
  featMLD: "Mass Land Destruction",
  featProxy: "Proxies Used",

  // Play Preferences Tag Options
  prefCasual: "Chill & Relaxed Game",
  prefFun: "Social Fun over Winning",
  prefSemiComp: "Focused & Competitive Spirit",
  prefComboOk: "Combos Welcomed",
  prefFastOk: "Fast Combos OK",
  prefLongGame: "Happy with Long Grinds",
  prefShortGame: "Quick Match Preferred",
  prefBeginner: "Beginners Welcome",
  prefTuning: "Deck in Testing / Tuning",

  // Avoid Preferences Tag Options
  avoidMLD: "Prefer No Mass Land Denial",
  avoidStax: "Prefer to Avoid Heavy Stax Locks",
  avoidExtraTurns: "Prefer Minimal Extra Turns",
  avoidFastCombo: "Prefer No Early Combos (T1-4)",
  avoidOneSided: "Prefer No Non-Games",
  avoidSalt: "Looking for Friendly Vibes",

  // Donation Modal
  donationTitle: "Sheet Image Created!",
  donationText: "Commander Rule Zero Sheet Maker is 100% free. If you find this tool helpful, any voluntary support on BOOTH helps keep future updates and hosting alive!",
  donationBtn: "☕ Support on BOOTH",
  donationClose: "Close",
  donationNote: "*Support is completely optional. All features remain 100% free to use.",

  // FAQ
  faqTitle: "About Commander Rule 0 & This Tool",
  faqQ1: "What is 'Rule 0' in Commander?",
  faqA1: "Rule 0 is the pre-game discussion where players align on power levels, expectations, and desired experiences before shuffling up. It ensures that everyone at the table has an engaging and fair game.",
  faqQ2: "What are Commander Brackets (1 to 5)?",
  faqA2: "Commander Brackets are official power level tiers introduced by Wizards of the Coast and the Commander Format Panel: 1 (Exhibition), 2 (Core), 3 (Upgraded), 4 (Optimized), and 5 (cEDH), designed to remove guesswork from pre-game power evaluations.",
  faqQ3: "What is a 'Game Changer'?",
  faqA3: "A curated list of high-impact staples (fast mana, efficient tutors, wincons) that dramatically swing games. Brackets 1 and 2 permit 0 Game Changers, while Bracket 3 allows up to 3.",
  faqQ4: "Can I share this on Discord or SpellTable?",
  faqA4: "Yes! Click 'Copy Image' to paste directly into Discord chat, or save the 16:9 PNG image. It is crisp, high-contrast, and easily readable on both mobile and desktop screens.",
  faqQ5: "Is registration or account creation required?",
  faqA5: "No! All data is stored purely in your browser's localStorage. No login, no backend server, and zero tracking of your personal deck info.",

  // Disclaimer
  disclaimerText: "Commander Rule Zero Sheet Maker is unofficial Fan Content permitted under the Wizards of the Coast Fan Content Policy. Portions of the materials used are property of Wizards of the Coast. ©Wizards of the Coast LLC.",
  scryfallCredit: "Card data and imagery powered by the Scryfall API."
};
