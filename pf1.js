/**
 * The Pathfinder 1st edition game system for Foundry Virtual Tabletop
 * Author: Furyspark
 * Software License: GNU GPLv3
 */

// Import Modules
import { PF1 } from "./module/config.js";
import { registerSystemSettings, getSkipActionPrompt } from "./module/settings.js";
import { preloadHandlebarsTemplates } from "./module/handlebars/templates.js";
import { registerHandlebarsHelpers } from "./module/handlebars/helpers.js";
import { measureDistances } from "./module/canvas.js";
import { ActorPF } from "./module/actor/entity.js";
import { ActorSheetPFCharacter } from "./module/actor/sheets/character.js";
import { ActorSheetPFNPC } from "./module/actor/sheets/npc.js";
import { ActorSheetPFNPCLite } from "./module/actor/sheets/npc-lite.js";
import { ActorSheetPFNPCLoot } from "./module/actor/sheets/npc-loot.js";
import { ItemPF } from "./module/item/entity.js";
import { ItemSheetPF } from "./module/item/sheets/base.js";
import { CompendiumDirectoryPF } from "./module/sidebar/compendium.js";
import { PatchCore } from "./module/patch-core.js";
import { DicePF } from "./module/dice.js";
import { getItemOwner, sizeDie, normalDie, getActorFromId, isMinimumCoreVersion } from "./module/lib.js";
import { ChatMessagePF } from "./module/sidebar/chat-message.js";
import { TokenQuickActions } from "./module/token-quick-actions.js";
import { initializeSocket } from "./module/socket.js";
import { updateChanges } from "./module/actor/update-changes.js";
import { SemanticVersion } from "./module/semver.js";
import { runUnitTests } from "./module/unit-tests.js";
import * as chat from "./module/chat.js";
import * as migrations from "./module/migration.js";

// Add String.format
if (!String.prototype.format) {
  String.prototype.format = function(...args) {
    return this.replace(/{(\d+)}/g, function(match, number) { 
      return args[number] != null
        ? args[number]
        : match
      ;
    });
  };
}

/* -------------------------------------------- */
/*  Foundry VTT Initialization                  */
/* -------------------------------------------- */

Hooks.once("init", async function() {
  console.log(`PF1 | Initializing Pathfinder 1 System`);

  // Create a PF1 namespace within the game global
  game.pf1 = {
    ActorPF,
    DicePF,
    ItemPF,
    migrations,
    rollItemMacro,
    rollSkillMacro,
    rollDefenses,
    rollActorAttributeMacro,
    CompendiumDirectoryPF,
    rollPreProcess: {
      sizeRoll: sizeDie,
      roll: normalDie,
    },
    migrateWorld: migrations.migrateWorld,
    runUnitTests,
  };

  // Record Configuration Values
  CONFIG.PF1 = PF1;
  CONFIG.Actor.entityClass = ActorPF;
  CONFIG.Item.entityClass = ItemPF;
  CONFIG.ui.compendium = CompendiumDirectoryPF;
  CONFIG.ChatMessage.entityClass = ChatMessagePF;

  // Register System Settings
  registerSystemSettings();

  // Preload Handlebars Templates
  await preloadHandlebarsTemplates();
  registerHandlebarsHelpers();

  // Patch Core Functions
  PatchCore();

  // Register sheet application classes
  Actors.unregisterSheet("core", ActorSheet);
  Actors.registerSheet("PF1", ActorSheetPFCharacter, { types: ["character"], makeDefault: true });
  Actors.registerSheet("PF1", ActorSheetPFNPC, { types: ["npc"], makeDefault: true });
  Actors.registerSheet("PF1", ActorSheetPFNPCLite, { types: ["npc"], makeDefault: false });
  Actors.registerSheet("PF1", ActorSheetPFNPCLoot, { types: ["npc"], makeDefault: false });
  Items.unregisterSheet("core", ItemSheet);
  Items.registerSheet("PF1", ItemSheetPF, { types: ["class", "feat", "spell", "consumable", "equipment", "loot", "weapon", "buff", "attack", "race"], makeDefault: true });

  initializeSocket();
});


/* -------------------------------------------- */
/*  Foundry VTT Setup                           */
/* -------------------------------------------- */

/**
 * This function runs after game data has been requested and loaded from the servers, so entities exist
 */
Hooks.once("setup", function() {

  // Localize CONFIG objects once up-front
  const toLocalize = [
    "abilities", "abilitiesShort", "alignments", "currencies", "distanceUnits", "itemActionTypes", "senses", "skills", "targetTypes",
    "timePeriods", "savingThrows", "ac", "acValueLabels", "featTypes", "conditions", "lootTypes", "flyManeuverabilities", "abilityTypes",
    "spellPreparationModes", "weaponTypes", "weaponProperties", "spellComponents", "spellSchools", "spellLevels", "conditionTypes",
    "favouredClassBonuses", "armorProficiencies", "weaponProficiencies", "actorSizes", "abilityActivationTypes", "abilityActivationTypesPlurals",
    "limitedUsePeriods", "equipmentTypes", "equipmentSlots", "consumableTypes", "attackTypes", "buffTypes", "buffTargets", "contextNoteTargets",
    "healingTypes", "divineFocus", "classSavingThrows", "classBAB", "classTypes", "measureTemplateTypes", "creatureTypes", "measureUnits", "measureUnitsShort",
    "languages", "damageTypes", "weaponHoldTypes",
  ];

  const doLocalize = function(obj) {
    return Object.entries(obj).reduce((obj, e) => {
      if (typeof e[1] === "string") obj[e[0]] = game.i18n.localize(e[1]);
      else if (typeof e[1] === "object") obj[e[0]] = doLocalize(e[1]);
      return obj;
    }, {});
  };
  for ( let o of toLocalize ) {
    CONFIG.PF1[o] = doLocalize(CONFIG.PF1[o]);
  }
});

/* -------------------------------------------- */

/**
 * Once the entire VTT framework is initialized, check to see if we should perform a data migration
 */
Hooks.once("ready", async function() {
  const NEEDS_MIGRATION_VERSION = "0.74.8";
  let PREVIOUS_MIGRATION_VERSION = game.settings.get("pf1", "systemMigrationVersion");
  if (typeof PREVIOUS_MIGRATION_VERSION === "number") {
    PREVIOUS_MIGRATION_VERSION = PREVIOUS_MIGRATION_VERSION.toString() + ".0";
  }
  else if (typeof PREVIOUS_MIGRATION_VERSION === "string" && PREVIOUS_MIGRATION_VERSION.match(/^([0-9]+)\.([0-9]+)$/)) {
    PREVIOUS_MIGRATION_VERSION = `${PREVIOUS_MIGRATION_VERSION}.0`;
  }
  let needMigration = SemanticVersion.fromString(NEEDS_MIGRATION_VERSION).isHigherThan(SemanticVersion.fromString(PREVIOUS_MIGRATION_VERSION));
  if (needMigration && game.user.isGM) {
    await migrations.migrateWorld();
  }

  game.actors.entities.forEach(obj => { updateChanges.call(obj, { sourceOnly: true }); });
  
  Hooks.on('renderTokenHUD', (app, html, data) => { TokenQuickActions.addTop3Attacks(app, html, data) });
});

/* -------------------------------------------- */
/*  Canvas Initialization                       */
/* -------------------------------------------- */

Hooks.on("canvasInit", function() {

  // Extend Diagonal Measurement
  canvas.grid.diagonalRule = game.settings.get("pf1", "diagonalMovement");
  SquareGrid.prototype.measureDistances = measureDistances;
});


/* -------------------------------------------- */
/*  Other Hooks                                 */
/* -------------------------------------------- */

Hooks.on("renderChatMessage", (app, html, data) => {
  // Hide roll info
  chat.hideRollInfo(app, html, data);

  // Hide GM sensitive info
  chat.hideGMSensitiveInfo(app, html, data);

  // Optionally collapse the content
  if (game.settings.get("pf1", "autoCollapseItemCards")) html.find(".card-content").hide();

  // Optionally hide chat buttons
  if (game.settings.get("pf1", "hideChatButtons")) html.find(".card-buttons").hide();

  // Apply accessibility settings to chat message
  chat.applyAccessibilitySettings(app, html, data, game.settings.get("pf1", "accessibilityConfig"));

  // Alter chat card title color
  chat.addChatCardTitleGradient(app, html, data);

  // Handle chat tooltips
  html.find(".tooltip").on("mousemove", ev => handleChatTooltips(ev));
});

Hooks.on("renderChatLog", (_, html) => ItemPF.chatListeners(html));
Hooks.on("renderChatLog", (_, html) => ActorPF.chatListeners(html));

Hooks.on("preUpdateOwnedItem", (actor, itemData, changedData, options, userId) => {
  if (userId !== game.user._id) return;
  if (!(actor instanceof Actor)) return;

  const item = actor.getOwnedItem(changedData._id);
  if (!item) return;

  // On level change
  if (item.type === "class" && getProperty(changedData, "data.level") != null) {
      const curLevel = item.data.data.level;
      const newLevel = getProperty(changedData, "data.level")
      item._onLevelChange(curLevel, newLevel);
  }
});
Hooks.on("updateOwnedItem", async (actor, itemData, changedData, options, userId) => {
  if (userId !== game.user._id) return;
  if (!(actor instanceof Actor)) return;

  const item = actor.getOwnedItem(changedData._id);
  if (item == null) return;

  // Update token buff effect images
  const isLinkedToken = getProperty(actor.data, "token.actorLink");
  if (isLinkedToken) {
    let promises = [];
    const isActive = item.data.data.active || changedData["data.active"];

    if (item.data.type === "buff" && isActive && changedData["img"]) {
      const tokens = actor.getActiveTokens();
      for (const token of tokens) {
        const fx = token.data.effects || [];
        if (fx.indexOf(item.data.img) !== -1) fx.splice(fx.indexOf(item.data.img), 1);
        if (fx.indexOf(changedData["img"]) === -1) fx.push(changedData["img"]);
        promises.push(token.update({effects: fx}, {diff: false}));
      }
    }

    await Promise.all(promises);
  }

  // Merge changed data into item data immediately, to avoid update lag
  item.data = mergeObject(item.data, changedData);

  // Refresh actor
  actor.refresh();

  // Update item resources
  actor.updateItemResources(item);
});
Hooks.on("updateToken", (scene, sceneId, data, options, userId) => {
  if (userId !== game.user._id) return;

  const actor = game.actors.tokens[data._id];
  if (actor != null && hasProperty(data, "actorData.items")) {
    if (!actor.hasPerm(game.user, "OWNER")) return;
    actor.refresh();

    // Update items
    for (let i of actor.items) {
      if (!i.hasPerm(game.user, "OWNER")) continue;
      actor.updateItemResources(i);
    }
  }
});

// Create race on actor
Hooks.on("preCreateOwnedItem", (actor, item, options, userId) => {
  if (userId !== game.user._id) return;
  if (!(actor instanceof Actor)) return;
  if (actor.race == null) return;

  if (item.type === "race") {
    actor.race.update(item);
    return false;
  }
});

Hooks.on("createOwnedItem", async (actor, itemData, options, userId) => {
  if (userId !== game.user._id) return;
  if (!(actor instanceof Actor)) return;

  const item = actor.items.find(o => o._id === itemData._id);
  if (!item) return;

  // Create class
  if (item.type === "class") {
    item._onLevelChange(0, item.data.data.level);
  }

  // Refresh item
  await item.update({});
  // Refresh actor
  await actor.update({});
});

Hooks.on("preDeleteOwnedItem", (actor, itemData, options, userId) => {
  if (userId !== game.user._id) return;
  if (!(actor instanceof Actor)) return;

  const item = actor.items.find(o => o._id === itemData._id);
  if (!item) return;

  // Effectively lose all levels
  if (item.type === "class") {
    item._onLevelChange(item.data.data.level, -1);
  }
});

Hooks.on("deleteOwnedItem", async (actor, itemData, options, userId) => {
  if (userId !== game.user._id) return;
  if (!(actor instanceof Actor)) return;

  // Remove token effects for deleted buff
  const isLinkedToken = getProperty(actor.data, "token.actorLink");
  if (isLinkedToken) {
    let promises = [];
    if (itemData.type === "buff" && itemData.data.active) {
      const tokens = actor.getActiveTokens();
      for (const token of tokens) {
        promises.push(token.toggleEffect(itemData.img));
      }
    }
    await Promise.all(promises);
  }

  // Refresh actor
  actor.refresh();
});

/* -------------------------------------------- */
/*  Hotbar Macros                               */
/* -------------------------------------------- */

// Create macro from item
Hooks.on("hotbarDrop", (bar, data, slot) => {
  if ( data.type !== "Item" ) return true;
  createItemMacro(data.data, slot);
  return false;
});

// Create macro from skill
Hooks.on("hotbarDrop", (bar, data, slot) => {
  if (data.type !== "skill") return true;
  createSkillMacro(data.skill, data.actor, slot);
  return false;
});

// Create macro to roll miscellaneous attribute from an actor
Hooks.on("hotbarDrop", (bar, data, slot) => {
  if (!["defenses", "cmb", "concentration", "cl", "bab"].includes(data.type)) return true;
  createMiscActorMacro(data.type, data.actor, slot, data.altType);
  return false;
});

// Render TokenConfig
Hooks.on("renderTokenConfig", async (app, html) => {
  let newHTML = await renderTemplate("systems/pf1/templates/internal/token-config_vision.html", {
    object: duplicate(app.object.data),
  });
  html.find('.tab[data-tab="vision"] > *:nth-child(2)').after(newHTML);
});

/**
 * Create a Macro from an Item drop.
 * Get an existing item macro if one exists, otherwise create a new one.
 * @param {Object} item     The item data
 * @param {number} slot     The hotbar slot to use
 * @returns {Promise}
 */
async function createItemMacro(item, slot) {
  const actor = getItemOwner(item);
  const command = `game.pf1.rollItemMacro("${item.name}", {\n` +
  `  itemId: "${item._id}",\n` +
  `  itemType: "${item.type}",\n` +
  (actor != null ? `  actorId: "${actor._id}",\n` : "") +
  `});`;
  let macro = game.macros.entities.find(m => (m.name === item.name) && (m.command === command));
  if ( !macro ) {
    macro = await Macro.create({
      name: item.name,
      type: "script",
      img: item.img,
      command: command,
      flags: {"pf1.itemMacro": true}
    }, {displaySheet: false});
  }
  game.user.assignHotbarMacro(macro, slot);
}

async function createSkillMacro(skillId, actorId, slot) {
  const actor = getActorFromId(actorId);
  if (!actor) return;
  
  const skillInfo = actor.getSkillInfo(skillId);
  const command = `game.pf1.rollSkillMacro("${actorId}", "${skillId}");`;
  const name = game.i18n.localize("PF1.RollSkillMacroName").format(actor.name, skillInfo.name);
  let macro = game.macros.entities.find(m => (m.name === name) && (m.command === command));
  if (!macro) {
    macro = await Macro.create({
      name: name,
      type: "script",
      img: "systems/pf1/icons/items/inventory/dice.jpg",
      command: command,
      flags: {"pf1.skillMacro": true},
    }, {displaySheet: false});
  }

  game.user.assignHotbarMacro(macro, slot);
}

async function createMiscActorMacro(type, actorId, slot, altType=null) {
  const actor = getActorFromId(actorId);
  if (!actor) return;

  let altTypeLabel = "";
  switch (altType) {
    case "primary":
      altTypeLabel = "Primary";
      break;
    case "secondary":
      altTypeLabel = "Secondary";
      break;
    case "tertiary":
      altTypeLabel = "Tertiary";
      break;
    case "spelllike":
      altTypeLabel = "Spell-like";
      break;
  }

  const command = altType
    ? `game.pf1.rollActorAttributeMacro("${actorId}", "${type}", "${altType}");`
    : `game.pf1.rollActorAttributeMacro("${actorId}", "${type}");`;
  let name, img;
  switch (type) {
    case "defenses":
      name = game.i18n.localize("PF1.RollDefensesMacroName").format(actor.name);
      img = "systems/pf1/icons/items/armor/shield-light-metal.png";
      break;
    case "cmb":
      name = game.i18n.localize("PF1.RollCMBMacroName").format(actor.name);
      img = "systems/pf1/icons/feats/improved-grapple.jpg";
      break;
    case "cl":
      name = game.i18n.localize("PF1.RollCLMacroName").format(actor.name, altTypeLabel);
      img = "systems/pf1/icons/spells/wind-grasp-eerie-3.jpg";
      break;
    case "concentration":
      name = game.i18n.localize("PF1.RollConcentrationMacroName").format(actor.name, altTypeLabel);
      img = "systems/pf1/icons/skills/light_01.jpg";
      break;
    case "bab":
      name = game.i18n.localize("PF1.RollBABMacroName").format(actor.name);
      img = "systems/pf1/icons/skills/yellow_08.jpg";
      break;
  }

  if (!name) return;

  let macro = game.macros.entities.find(o => (o.name === name) && (o.command === command));
  if (!macro) {
    macro = await Macro.create({
      name: name,
      type: "script",
      img: img,
      command: command,
      flags: {"pf1.miscMacro": true},
    }, {displaySheet: false});
  }

  game.user.assignHotbarMacro(macro, slot);
}

/**
 * Create a Macro from an Item drop.
 * Get an existing item macro if one exists, otherwise create a new one.
 * @param {string} itemName
 * @param {object} [options={}]
 * @return {Promise}
 */
function rollItemMacro(itemName, {itemId, itemType, actorId}={}) {
  let actor = getActorFromId(actorId);
  if (actor && !actor.hasPerm(game.user, "OWNER")) return ui.notifications.warn(game.i18n.localize("PF1.ErrorNoActorPermission"));
  const item = actor ? actor.items.find(i => {
    if (itemId != null && i._id !== itemId) return false;
    if (itemType != null && i.type !== itemType) return false;
    return i.name === itemName;
  }) : null;
  if (!item) return ui.notifications.warn(`Your controlled Actor does not have an item named ${itemName}`);

  // Trigger the item roll
  if (!game.keyboard.isDown("Control")) {
    return item.use({skipDialog: getSkipActionPrompt()});
  }
  return item.roll();
}

function rollSkillMacro(actorId, skillId) {
  const actor = getActorFromId(actorId);
  if (!actor) return ui.notifications.error(game.i18n.localize("PF1.ErrorActorNotFound").format(actorId));

  return actor.rollSkill(skillId, {skipDialog: getSkipActionPrompt()});
}

/**
 * Show an actor's defenses.
 */
function rollDefenses({actorName=null, actorId=null}={}) {
  const actor = ActorPF.getActiveActor({actorName: actorName, actorId: actorId});
  if (!actor) return ui.notifications.warn("No applicable actor found");

  return actor.rollDefenses();
};

function rollActorAttributeMacro(actorId, type, altType=null) {
  const actor = getActorFromId(actorId);
  if (!actor) return ui.notifications.error("PF1.ErrorActorNotFound").format(actorId);

  switch (type) {
    case "defenses":
      actor.rollDefenses();
      break;
    case "cmb":
      actor.rollCMB();
      break;
    case "cl":
      actor.rollCL(altType);
      break;
    case "concentration":
      actor.rollConcentration(altType);
      break;
    case "bab":
      actor.rollBAB();
      break;
  }
};

// Create Handlebars helpers

/**
 * Render a MCE editor container with an optional toggle button
 */
Handlebars.registerHelper('roll-editor', function(options) {
  // Find item and/or actor
  const _id = (getProperty(options, "data.root.entity") || getProperty(options, "data.root.actor") || {})._id;
  let actor = null, item = null;
  const actors = [...Array.from(game.actors.entities), ...Array.from(game.actors.tokens)];
  const items = [...Array.from(game.items.entities)];
  if (_id != null) {
    // Find actor or item on actor
    for (let a of actors) {
      if (a._id === _id) {
        actor = a;
      }
      else {
        if (item == null) item = a.items.find(o => o._id === _id);
      }
    }
    // Find item
    if (item == null) {
      for (let i of items) {
        if (i._id === _id) item = i;
      }
    }
  }
  const rollData = item != null ? item.getRollData() : (actor != null ? actor.getRollData() : {});
  // Create editor
  let target = options.hash['target'],
      content = options.hash['content'] || "",
      button = Boolean(options.hash['button']),
      owner = Boolean(options.hash['owner']),
      editable = Boolean(options.hash['editable']);
  if ( !target ) throw new Error("You must define the name of a target field.");

  // Enrich the content
  content = TextEditor.enrichHTML(content, {secrets: owner, entities: true, rollData: rollData});

  // Construct the HTML
  let editor = $(`<div class="editor"><div class="editor-content" data-edit="${target}">${content}</div></div>`);

  // Append edit button
  if ( button && editable ) editor.append($('<a class="editor-edit"><i class="fas fa-edit"></i></a>'));
  return new Handlebars.SafeString(editor[0].outerHTML);
});

// Handle chat tooltips
const handleChatTooltips = function(event) {
  const elem = $(event.currentTarget);
  const rect = event.currentTarget.getBoundingClientRect();
  // const x = event.pageX;
  // const y = event.pageY;
  const x = rect.x;
  const y = rect.y;
  const w = rect.width;
  elem.find(".tooltipcontent").css("left", `${x}px`).css("top", `${y}px`).css("width", `${w}px`);
};



// Export objects for being a library

export { ActorPF, ItemPF, ActorSheetPFCharacter, ActorSheetPFNPC, ActorSheetPFNPCLite, ActorSheetPFNPCLoot };
export { DicePF, ChatMessagePF, measureDistances };
