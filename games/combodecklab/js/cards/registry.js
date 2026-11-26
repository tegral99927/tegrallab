// registry.js - Card definitions registry

import { TolarianAcademy, AncientTomb, Island, CityOfBrass } from "./lands/moma-lands.js";
import { LotusField, ThespiansStage, BotanicalSanctum, YavimayaCoast, ManaConfluence, BoseijuWhoEndures, Forest } from "./lands/lotus-lands.js";
import { LotusPetal, ManaVault, MoxDiamond, VoltaicKey, ScrollRack } from "./artifacts/moma-artifacts.js";
import { MindOverMatter } from "./enchantments/moma-enchantments.js";
import { Omniscience } from "./enchantments/lotus-enchantments.js";
import { VizierOfTumblingSands, ArborealGrazer } from "./creatures/lotus-creatures.js";
import { StrokeOfGenius, Turnabout, Intuition } from "./instants/moma-instants.js";
import { Impulse } from "./instants/lotus-instants.js";
import { TimeSpiral, Windfall } from "./sorceries/moma-sorceries.js";
import { HiddenStrings, PoreOverThePages, SylvanScrying, ApproachOfTheSecondSun, EmergentUltimatum, PeerIntoTheAbyss, DarkPetition, MastermindsAcquisition } from "./sorceries/lotus-sorceries.js";

const cardDefinitions = [
  // MoMa
  TolarianAcademy,
  AncientTomb,
  Island,
  CityOfBrass,
  LotusPetal,
  ManaVault,
  MoxDiamond,
  VoltaicKey,
  ScrollRack,
  MindOverMatter,
  StrokeOfGenius,
  Turnabout,
  Intuition,
  TimeSpiral,
  Windfall,

  // Lotus Field Combo
  LotusField,
  ThespiansStage,
  BotanicalSanctum,
  YavimayaCoast,
  ManaConfluence,
  BoseijuWhoEndures,
  Forest,
  Omniscience,
  VizierOfTumblingSands,
  ArborealGrazer,
  Impulse,
  HiddenStrings,
  PoreOverThePages,
  SylvanScrying,
  ApproachOfTheSecondSun,
  EmergentUltimatum,
  PeerIntoTheAbyss,
  DarkPetition,
  MastermindsAcquisition
];

export class CardRegistry {
  constructor() {
    this.map = new Map();
    for (const def of cardDefinitions) {
      if (def && def.name) {
        this.register(def.name, def);
      }
    }
  }

  register(name, cardDef) {
    const key = name.trim().toLowerCase();
    this.map.set(key, cardDef);
  }

  get(name) {
    if (!name) return null;
    const clean = name.trim().toLowerCase();
    if (this.map.has(clean)) {
      return this.map.get(clean);
    }
    // Try base name if split card
    const baseName = name.split(" // ")[0].trim().toLowerCase();
    if (this.map.has(baseName)) {
      return this.map.get(baseName);
    }
    // Return minimal placeholder if unsupported
    return {
      name,
      implementationStatus: "unsupported",
      manaAbilities: [],
      activatedAbilities: []
    };
  }

  has(name) {
    if (!name) return false;
    const clean = name.trim().toLowerCase();
    return this.map.has(clean);
  }

  getAll() {
    return Array.from(this.map.values());
  }
}

export const cardRegistry = new CardRegistry();
