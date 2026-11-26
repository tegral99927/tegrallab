// common.js - Card definition base template & helper

export function createCardDefinition({
  name,
  oracleId = null,
  entersTapped = false,
  doesNotUntapDuringUntapStep = false,
  hasHexproof = false,
  spellEffect = null,
  manaAbilities = [],
  activatedAbilities = [],
  etbTrigger = null,
  cyclingCost = null,
  cyclingTrigger = null,
  staticAbilities = [],
  implementationStatus = "complete"
}) {
  return {
    name,
    oracleId,
    entersTapped,
    doesNotUntapDuringUntapStep,
    hasHexproof,
    spellEffect,
    manaAbilities,
    activatedAbilities,
    etbTrigger,
    cyclingCost,
    cyclingTrigger,
    staticAbilities,
    implementationStatus
  };
}
