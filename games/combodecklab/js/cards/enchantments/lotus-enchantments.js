// lotus-enchantments.js - Omniscience for Lotus Field Combo

import { createCardDefinition } from "../common.js";

// Omniscience
// You may cast spells from your hand without paying their mana costs.
export const Omniscience = createCardDefinition({
  name: "Omniscience",
  staticAbilities: [
    {
      name: "全知の常在型能力",
      description: "あなたは手札から呪文を、そのマナ・コストを支払うことなく唱えてもよい。"
    }
  ]
});
