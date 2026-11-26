// abilities.js - Ability definitions and handlers

export const ABILITY_TYPES = {
  MANA: "mana",
  ACTIVATED: "activated",
  TRIGGERED: "triggered",
  STATIC: "static"
};

export class ActivatedAbility {
  constructor({
    name,
    cost, // e.g. { tap: true, mana: "{1}", discardCount: 1, sacrificeSelf: false }
    effect, // function(game, sourceCard, targets, options)
    targets = null, // target requirement definition
    isManaAbility = false,
    description = ""
  }) {
    this.name = name;
    this.cost = cost || {};
    this.effect = effect;
    this.targets = targets;
    this.isManaAbility = isManaAbility;
    this.description = description;
  }
}

export class TriggeredAbility {
  constructor({
    event, // "ETB", "CYCLE", "UNTAP", "SPELL_CAST", "UPKEEP"
    effect,
    description = ""
  }) {
    this.event = event;
    this.effect = effect;
    this.description = description;
  }
}
