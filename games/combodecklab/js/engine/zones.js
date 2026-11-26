// zones.js - Zone definitions and card movement logic

import { generateInstanceId, deepClone } from "../utils/helpers.js";

export const ZONES = {
  LIBRARY: "library",
  HAND: "hand",
  BATTLEFIELD: "battlefield",
  GRAVEYARD: "graveyard",
  EXILE: "exile",
  STACK: "stack",
  SIDEBOARD: "sideboard",
  OUTSIDE: "outside"
};

export class CardInstance {
  constructor(cardDef, metadata = {}, owner = "player") {
    this.instanceId = generateInstanceId(metadata.name ? metadata.name.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8) : "card");
    this.oracleId = cardDef.oracleId || metadata.oracleId || null;
    this.name = cardDef.name || metadata.name || "Unknown";
    this.cardDef = cardDef;
    this.metadata = metadata;
    this.owner = owner;
    this.controller = owner;
    this.zone = ZONES.LIBRARY;

    // Battlefield state
    this.tapped = false;
    this.summoningSickness = true;
    this.counters = {};
    this.temporaryEffects = [];
    this.copiedFrom = null; // When copied (e.g. Thespian's Stage)
    this.cipherSpells = []; // Ciphered spells on this creature
  }

  // Create a new card instance when moving zones (CR 400.7: Object that moves from one zone to another becomes a new object)
  movedTo(newZone) {
    const fresh = new CardInstance(this.cardDef, this.metadata, this.owner);
    fresh.controller = this.controller;
    fresh.zone = newZone;
    fresh.tapped = false;
    fresh.summoningSickness = true;
    fresh.counters = {};
    fresh.temporaryEffects = [];
    fresh.copiedFrom = null;
    fresh.cipherSpells = [];
    return fresh;
  }
}

export class ZoneManager {
  constructor() {
    this.zones = {
      [ZONES.LIBRARY]: [],
      [ZONES.HAND]: [],
      [ZONES.BATTLEFIELD]: [],
      [ZONES.GRAVEYARD]: [],
      [ZONES.EXILE]: [],
      [ZONES.STACK]: [],
      [ZONES.SIDEBOARD]: [],
      [ZONES.OUTSIDE]: []
    };
  }

  get(zoneName) {
    return this.zones[zoneName] || [];
  }

  add(card, zoneName, position = "top") {
    const list = this.get(zoneName);
    card.zone = zoneName;
    if (position === "bottom") {
      list.unshift(card);
    } else {
      list.push(card);
    }
  }

  remove(instanceId) {
    for (const zone of Object.values(this.zones)) {
      const idx = zone.findIndex(c => c.instanceId === instanceId);
      if (idx !== -1) {
        return zone.splice(idx, 1)[0];
      }
    }
    return null;
  }

  find(instanceId) {
    for (const zone of Object.values(this.zones)) {
      const card = zone.find(c => c.instanceId === instanceId);
      if (card) return card;
    }
    return null;
  }

  move(instanceId, toZone, position = "top", preserveState = false) {
    const card = this.remove(instanceId);
    if (!card) return null;

    if (preserveState) {
      card.zone = toZone;
      this.add(card, toZone, position);
      return card;
    }

    // Standard MTG zone transition: card becomes new object
    const newCard = card.movedTo(toZone);
    this.add(newCard, toZone, position);
    return newCard;
  }
}
