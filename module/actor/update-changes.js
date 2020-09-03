import { linkData } from "../lib.js";
import { ActorPF } from "./entity.js";
import { ItemPF } from "../item/entity.js";

export const updateChanges = async function({data=null}={}) {
  let updateData = {};
  let srcData1 = mergeObject(this.data, expandObject(data || {}), { inplace: false });
  srcData1.items = this.items.reduce((cur, i) => {
    const otherItem = srcData1.items.filter(o => o._id === i._id)[0];
    if (otherItem) cur.push(mergeObject(i.data, otherItem, { inplace: false }));
    else cur.push(i.data);
    return cur;
  }, []);
  const changeObjects = srcData1.items.filter(obj => { return obj.data.changes != null; }).filter(obj => {
    if (obj.type === "buff") return obj.data.active;
    if (obj.type === "equipment" || obj.type === "weapon") return obj.data.equipped;
    return true;
  });

  // Track previous values
  const prevValues = {
    mhp: this.data.data.attributes.hp.max,
    wounds: getProperty(this.data, "data.attributes.wounds.max") || 0,
    vigor: getProperty(this.data, "data.attributes.vigor.max") || 0,
  };

  // Gather change types
  const changeData = {};
  const changeDataTemplate = {
    positive: {
      value: 0,
      sources: []
    },
    negative: {
      value: 0,
      sources: []
    },
    set: {
      value: 0,
      source: null,
    },
  };
  for (let [key, buffTarget] of Object.entries(CONFIG.PF1.buffTargets)) {
    if (typeof buffTarget === "object") {
      // Add specific skills as targets
      if (key === "skill") {
        for (let [s, skl] of Object.entries(this.data.data.skills)) {
          if (skl == null) continue;
          if (!skl.subSkills) {
            changeData[`skill.${s}`] = {};
            Object.keys(CONFIG.PF1.bonusModifiers).forEach(b => {
              changeData[`skill.${s}`][b] = duplicate(changeDataTemplate);
            });
          }
          else {
            for (let s2 of Object.keys(skl.subSkills)) {
              changeData[`skill.${s}.subSkills.${s2}`] = {};
              Object.keys(CONFIG.PF1.bonusModifiers).forEach(b => {
                changeData[`skill.${s}.subSkills.${s2}`][b] = duplicate(changeDataTemplate);
              });
            }
          }
        }
      }
      // Add static targets
      else {
        for (let subKey of Object.keys(buffTarget)) {
          if (subKey.startsWith("_")) continue;
          changeData[subKey] = {};
          Object.keys(CONFIG.PF1.bonusModifiers).forEach(b => {
            changeData[subKey][b] = duplicate(changeDataTemplate);
          });
        }
      }
    }
  };

  // Create an array of changes
  let allChanges = [];
  changeObjects.forEach(item => {
    item.data.changes.forEach(change => {
      allChanges.push({
        raw: change,
        source: {
          value: 0,
          type: item.type,
          subtype: this.constructor._getChangeItemSubtype(item),
          name: item.name,
          item: item,
          operator: change.operator,
        }
      });
    });
  });

  // Initialize data
  let flags = {},
    sourceInfo = {};
  _resetData.call(this, updateData, srcData1, flags, sourceInfo);
  _addDefaultChanges.call(this, srcData1, allChanges, flags, sourceInfo);

  // Check flags
  for (let obj of changeObjects) {
    if (!obj.data.changeFlags) continue;
    for (let [flagKey, flagValue] of Object.entries(obj.data.changeFlags)) {
      if (flagValue === true) {
        flags[flagKey] = true;

        let targets = [];
        let value = "";

        switch (flagKey) {
          case "loseDexToAC":
            sourceInfo["data.attributes.ac.normal.total"] = sourceInfo["data.attributes.ac.normal.total"] || { positive: [], negative: [] };
            sourceInfo["data.attributes.ac.touch.total"] = sourceInfo["data.attributes.ac.touch.total"] || { positive: [], negative: [] };
            sourceInfo["data.attributes.cmd.total"] = sourceInfo["data.attributes.cmd.total"] || { positive: [], negative: [] };
            targets = [
              sourceInfo["data.attributes.ac.normal.total"].negative,
              sourceInfo["data.attributes.ac.touch.total"].negative,
              sourceInfo["data.attributes.cmd.total"].negative
            ];
            value = "Lose Dex to AC";
            break;
          case "noDex":
            sourceInfo["data.abilities.dex.total"] = sourceInfo["data.abilities.dex.total"] || { positive: [], negative: [] };
            targets = [sourceInfo["data.abilities.dex.total"].negative];
            value = "0 Dex";
            break;
          case "noStr":
            sourceInfo["data.abilities.str.total"] = sourceInfo["data.abilities.str.total"] || { positive: [], negative: [] };
            targets = [sourceInfo["data.abilities.str.total"].negative];
            value = "0 Str";
            break;
          case "oneInt":
            sourceInfo["data.abilities.int.total"] = sourceInfo["data.abilities.int.total"] || { positive: [], negative: [] };
            targets = [sourceInfo["data.abilities.int.total"].negative];
            value = "1 Int";
            break;
          case "oneWis":
            sourceInfo["data.abilities.wis.total"] = sourceInfo["data.abilities.wis.total"] || { positive: [], negative: [] };
            targets = [sourceInfo["data.abilities.wis.total"].negative];
            value = "1 Wis";
            break;
          case "oneCha":
            sourceInfo["data.abilities.cha.total"] = sourceInfo["data.abilities.cha.total"] || { positive: [], negative: [] };
            targets = [sourceInfo["data.abilities.cha.total"].negative];
            value = "1 Cha";
            break;
        }

        for (let t of Object.values(targets)) {
          t.push({ type: obj.type, subtype: this.constructor._getChangeItemSubtype(obj), value: value });
        }
      }
    }
  }
  for (let flagKey of Object.keys(flags)) {
    if (!flags[flagKey]) continue;

    switch (flagKey) {
      case "noDex":
        linkData(srcData1, updateData, "data.abilities.dex.total", 0);
        linkData(srcData1, updateData, "data.abilities.dex.mod", -5);
        linkData(srcData1, updateData, "data.abilities.dex.base", 0);
        linkData(srcData1, updateData, "data.abilities.dex.baseMod", -5);
        break;
      case "noStr":
        linkData(srcData1, updateData, "data.abilities.str.total", 0);
        linkData(srcData1, updateData, "data.abilities.str.mod", -5);
        linkData(srcData1, updateData, "data.abilities.str.base", 0);
        linkData(srcData1, updateData, "data.abilities.str.baseMod", -5);
        break;
      case "oneInt":
        linkData(srcData1, updateData, "data.abilities.int.total", 1);
        linkData(srcData1, updateData, "data.abilities.int.mod", -5);
        linkData(srcData1, updateData, "data.abilities.int.base", 1);
        linkData(srcData1, updateData, "data.abilities.int.baseMod", -5);
        break;
      case "oneWis":
        linkData(srcData1, updateData, "data.abilities.wis.total", 1);
        linkData(srcData1, updateData, "data.abilities.wis.mod", -5);
        linkData(srcData1, updateData, "data.abilities.wis.base", 1);
        linkData(srcData1, updateData, "data.abilities.wis.baseMod", -5);
        break;
      case "oneCha":
        linkData(srcData1, updateData, "data.abilities.cha.total", 1);
        linkData(srcData1, updateData, "data.abilities.cha.mod", -5);
        linkData(srcData1, updateData, "data.abilities.cha.base", 1);
        linkData(srcData1, updateData, "data.abilities.cha.baseMod", -5);
        break;
    }
  }

  // Sort changes
  allChanges = allChanges.sort(_sortChanges.bind(this));

  // Parse changes
  let temp = [];
  const origData = mergeObject(this.data, data != null ? expandObject(data) : {}, { inplace: false });
  updateData = flattenObject({ data: mergeObject(origData.data, expandObject(updateData).data, { inplace: false }) });
  _addDynamicData.call(this, { updateData: updateData, data: srcData1, forceModUpdate: true, flags: flags });

  // Parse change formulas
  allChanges.forEach((change, a) => {
    const formula = change.raw.formula || "";
    if (formula === "") return;
    const changeTarget = change.raw.subTarget;
    if (changeData[changeTarget] == null) return;
    const rollData = this.getRollData(srcData1.data);

    rollData.item = {};
    if (change.source.item != null) {
      rollData.item = change.source.item.data;
    }

    const roll = new Roll(formula, rollData);

    try {
      change.raw.value = roll.roll().total;
      change.source.value = change.raw.value;
    }
    catch (e) {
      if (!change.source.item) console.log(change, this.name);
      ui.notifications.error(game.i18n.localize("PF1.ErrorItemFormula").format(change.source.item.name, this.name));
    }
    _parseChange.call(this, change, changeData[changeTarget], flags);

    temp.push(changeData[changeTarget]);

    // Set change
    if (change.raw.operator === "set") {
      _applySetChanges(updateData, srcData1, [change]);
      // Set source info
      let flats = getChangeFlat(change.raw.subTarget, change.raw.modifier, srcData1.data);
      if (!(flats instanceof Array)) flats = [flats];
      flats.forEach(f => {
        sourceInfo[f] = sourceInfo[f] || { positive: [], negative: [] };
        sourceInfo[f].positive.push(change.source);
      });
    }
    // Add change
    else if (["add", "+"].includes(change.raw.operator) || !change.raw.operator) {
      if (allChanges.length <= a+1 || allChanges[a+1].raw.subTarget !== changeTarget) {
        const newData = _applyChanges.call(this, changeTarget, temp, srcData1);
        _addDynamicData.call(this, { updateData: updateData, data: srcData1, changes: newData, flags: flags });
        temp = [];
      }
    }
  });

  // Update encumbrance
  this._computeEncumbrance(updateData, srcData1);
  switch (srcData1.data.attributes.encumbrance.level) {
    case 0:
      linkData(srcData1, updateData, "data.attributes.acp.encumbrance", 0);
      break;
    case 1:
      linkData(srcData1, updateData, "data.attributes.acp.encumbrance", 3);
      linkData(srcData1, updateData, "data.attributes.maxDexBonus", Math.min(updateData["data.attributes.maxDexBonus"] || Number.POSITIVE_INFINITY, 3));
      break;
    case 2:
      linkData(srcData1, updateData, "data.attributes.acp.encumbrance", 6);
      linkData(srcData1, updateData, "data.attributes.maxDexBonus", Math.min(updateData["data.attributes.maxDexBonus"] || Number.POSITIVE_INFINITY, 1));
      break;
  }
  linkData(srcData1, updateData, "data.attributes.acp.total", Math.max(updateData["data.attributes.acp.gear"], updateData["data.attributes.acp.encumbrance"]));

  // Update skills and AC and CMD from Dexterity
  {
    _updateSkills.call(this, updateData, srcData1);
    const dex = srcData1.data.abilities.dex.mod;
    const maxDex = srcData1.data.attributes.maxDexBonus;
    const ac = {
      normal: srcData1.data.attributes.ac.normal.total,
      touch: srcData1.data.attributes.ac.touch.total,
      ff: srcData1.data.attributes.ac.flatFooted.total,
    };
    const cmd = {
      normal: srcData1.data.attributes.cmd.total,
      ff: srcData1.data.attributes.cmd.flatFootedTotal,
    };
    linkData(srcData1, updateData, "data.attributes.ac.normal.total", ac.normal + (maxDex != null ? Math.min(maxDex, dex) : dex));
    linkData(srcData1, updateData, "data.attributes.ac.touch.total", ac.touch + (maxDex != null ? Math.min(maxDex, dex) : dex));
    linkData(srcData1, updateData, "data.attributes.ac.flatFooted.total", ac.ff + Math.min(0, dex));
    linkData(srcData1, updateData, "data.attributes.cmd.total", cmd.normal + (maxDex != null ? Math.min(maxDex, dex) : dex));
    linkData(srcData1, updateData, "data.attributes.cmd.flatFootedTotal", cmd.ff + Math.min(0, dex));
  }

  // Reduce final speed under certain circumstances
  let armorItems = srcData1.items.filter(o => o.type === "equipment");
  if ((updateData["data.attributes.encumbrance.level"] >= 1 && !flags.noEncumbrance) ||
  (armorItems.filter(o => getProperty(o.data, "equipmentSubtype") === "mediumArmor" && o.data.equipped).length && !flags.mediumArmorFullSpeed) ||
  (armorItems.filter(o => getProperty(o.data, "equipmentSubtype") === "heavyArmor" && o.data.equipped).length && !flags.heavyArmorFullSpeed)) {
    for (let speedKey of Object.keys(srcData1.data.attributes.speed)) {
      let value = updateData[`data.attributes.speed.${speedKey}.total`];
      linkData(srcData1, updateData, `data.attributes.speed.${speedKey}.total`, ActorPF.getReducedMovementSpeed(value));
    }
  }
  // Reset spell slots and spell points
  for (let spellbookKey of Object.keys(getProperty(srcData1, "data.attributes.spells.spellbooks"))) {
    const spellbook = getProperty(srcData1, `data.attributes.spells.spellbooks.${spellbookKey}`);
    const spellbookAbilityKey = spellbook.ability;
    const spellbookAbilityMod = getProperty(srcData1, `data.abilities.${spellbookAbilityKey}.mod`);

    // Set CL
    {
      const formula = getProperty(spellbook, "cl.formula") || "0";
      const rollData = this.getRollData(srcData1.data);
      let total = 0;
      total += new Roll(formula, rollData).roll().total;
      if (this.data.type === "npc") {
        total += (getProperty(spellbook, "cl.base") || 0);
      }
      if (spellbook.class === "_hd") {
        total += (getProperty(srcData1, "data.attributes.hd.total"));
      }
      else if (spellbook.class && rollData.classes[spellbook.class]) {
        total += rollData.classes[spellbook.class].level;
      }
      linkData(srcData1, updateData, `data.attributes.spells.spellbooks.${spellbookKey}.cl.total`, total);
    }

    // Spell slots
    for (let a = 0; a < 10; a++) {
      let base = parseInt(getProperty(srcData1, `data.attributes.spells.spellbooks.${spellbookKey}.spells.spell${a}.base`));
      if (Number.isNaN(base)) {
        linkData(srcData1, updateData, `data.attributes.spells.spellbooks.${spellbookKey}.spells.spell${a}.base`, null);
        linkData(srcData1, updateData, `data.attributes.spells.spellbooks.${spellbookKey}.spells.spell${a}.max`, 0);
      }
      else {
        const value = (typeof spellbookAbilityMod === "number") ? (base + ActorPF.getSpellSlotIncrease(spellbookAbilityMod, a)) : base;
        if (getProperty(srcData1, `data.attributes.spells.spellbooks.${spellbookKey}.autoSpellLevels`)) {
          linkData(srcData1, updateData, `data.attributes.spells.spellbooks.${spellbookKey}.spells.spell${a}.max`, value);
        }
        else {
          linkData(srcData1, updateData, `data.attributes.spells.spellbooks.${spellbookKey}.spells.spell${a}.max`, base);
        }
      }
    }

    // Spell points
    {
      const formula = getProperty(srcData1, `data.attributes.spells.spellbooks.${spellbookKey}.spellPoints.maxFormula`) || "0";
      const rollData = this.getRollData(srcData1.data);
      rollData.cl = getProperty(srcData1, `data.attributes.spells.spellbooks.${spellbookKey}.cl.total`);
      rollData.ablMod = spellbookAbilityMod;
      const roll = new Roll(formula, rollData).roll();
      linkData(srcData1, updateData, `data.attributes.spells.spellbooks.${spellbookKey}.spellPoints.max`, roll.total);
    }
  }

  // Add current hit points
  if (updateData["data.attributes.hp.max"]) {
    const hpDiff = updateData["data.attributes.hp.max"] - prevValues.mhp;
    if (hpDiff !== 0) {
      linkData(srcData1, updateData, "data.attributes.hp.value", Math.min(updateData["data.attributes.hp.max"], srcData1.data.attributes.hp.value + hpDiff));
    }
  }
  if (updateData["data.attributes.wounds.max"]) {
    const wDiff = updateData["data.attributes.wounds.max"] - prevValues.wounds;
    if (wDiff !== 0) {
      linkData(srcData1, updateData, "data.attributes.wounds.value", Math.min(updateData["data.attributes.wounds.max"], srcData1.data.attributes.wounds.value + wDiff));
    }
  }
  if (updateData["data.attributes.vigor.max"]) {
    const vDiff = updateData["data.attributes.vigor.max"] - prevValues.vigor;
    if (vDiff !== 0) {
      linkData(srcData1, updateData, "data.attributes.vigor.value", Math.min(updateData["data.attributes.vigor.max"], srcData1.data.attributes.vigor.value + vDiff));
    }
  }


  // Refresh source info
  for (let [bt, change] of Object.entries(changeData)) {
    for (let [ct, values] of Object.entries(change)) {
      let customBuffTargets = getChangeFlat.call(this, bt, ct, srcData1.data);
      if (!(customBuffTargets instanceof Array)) customBuffTargets = [customBuffTargets];

      // Replace certain targets
      // Replace ability penalties
      customBuffTargets = customBuffTargets.filter(t => { return t != null; }).map(t => {
        return t.replace(/^data\.abilities\.([a-zA-Z0-9]+)\.penalty$/, "data.abilities.$1.total");
      });

      // Add sources
      for (let ebt of Object.values(customBuffTargets)) {
        sourceInfo[ebt] = sourceInfo[ebt] || { positive: [], negative: [] };
        if (values.positive.value > 0) sourceInfo[ebt].positive.push(...values.positive.sources);
        if (values.negative.value < 0) sourceInfo[ebt].negative.push(...values.negative.sources);
      }
    }
  }

  this._setSourceDetails(mergeObject(this.data, srcData1, { inplace: false }), sourceInfo, flags);

  const diffData = diffObject(this.data, srcData1);

  // Apply changes
  if (this.collection != null && Object.keys(diffData).length > 0) {
    let newData = {};
    if (data != null) newData = flattenObject(mergeObject(data, flattenObject(diffData), { inplace: false }));
    return { data: newData, diff: diffData };
  }
  return { data: {}, diff: {} };
};

const _applyChanges = function(buffTarget, changeData, rollData) {
  let consolidatedChanges = {};
  let changes = {};
  for (let change of changeData) {
    if (!change) continue;
    for (let b of Object.keys(change)) {
      changes[b] = { positive: 0, negative: 0 };
    }
    for (let [changeType, data] of Object.entries(change)) {
      // Add positive value
      if (data.positive.value !== 0) {
        changes[changeType].positive += data.positive.value;
      }
      // Add negative value
      if (data.negative.value !== 0) {
          changes[changeType].negative += data.negative.value;
      }
    }
  }

  for (let [changeTarget, value] of Object.entries(changes)) {
    if (value.positive !== 0 || value.negative !== 0) {
      let flatTargets = getChangeFlat.call(this, buffTarget, changeTarget, rollData.data);
      if (flatTargets == null) continue;

      if (!(flatTargets instanceof Array)) flatTargets = [flatTargets];
      for (let target of flatTargets) {
        consolidatedChanges[target] = (consolidatedChanges[target] || 0) + value.positive + value.negative;

         // Apply final rounding of health, if required.
        if (["data.attributes.hp.max", "data.attributes.wounds.max", "data.attributes.vigor.max"].includes(target)) {
          const healthConfig = game.settings.get("pf1", "healthConfig")
          const continuous = {discrete: false, continuous: true}[healthConfig.continuity]
          if (continuous) {
            const round = {up: Math.ceil, nearest: Math.round, down: Math.floor}[healthConfig.rounding]
            consolidatedChanges[target] = round(consolidatedChanges[target])
          }
        }
      }
    }
  }
  return consolidatedChanges;
};

const _resetData = function(updateData, data, flags, sourceInfo) {
  const data1 = data.data;
  if (flags == null) flags = {};
  const items = data.items;
  const classes = items.filter(obj => { return obj.type === "class"; });
  const useFractionalBaseBonuses = game.settings.get("pf1", "useFractionalBaseBonuses") === true;

  // Reset HD
  linkData(data, updateData, "data.attributes.hd.total", data1.details.level.value);

  // Reset CR
  if (this.data.type === "npc") {
    linkData(data, updateData, "data.details.cr.total", this.getCR(data1));
  }

  // Reset abilities
  for (let [a, abl] of Object.entries(data1.abilities)) {
    linkData(data, updateData, `data.abilities.${a}.penalty`, 0);
    if (a === "str" && flags.noStr === true) continue;
    if (a === "dex" && flags.noDex === true) continue;
    if (a === "int" && flags.oneInt === true) continue;
    if (a === "wis" && flags.oneWis === true) continue;
    if (a === "cha" && flags.oneCha === true) continue;
    linkData(data, updateData, `data.abilities.${a}.checkMod`, 0);
    linkData(data, updateData, `data.abilities.${a}.total`, abl.value - Math.abs(abl.drain));
    linkData(data, updateData, `data.abilities.${a}.mod`, Math.floor((updateData[`data.abilities.${a}.total`] - 10) / 2));
    linkData(data, updateData, `data.abilities.${a}.base`, abl.value - Math.abs(abl.drain));
    linkData(data, updateData, `data.abilities.${a}.baseMod`, Math.floor((updateData[`data.abilities.${a}.base`] - 10) / 2));
  }

  // Reset maximum hit points
  linkData(data, updateData, "data.attributes.hp.max", getProperty(data, "data.attributes.hp.base") || 0);
  linkData(data, updateData, "data.attributes.wounds.max", getProperty(data, "data.attributes.wounds.base") || 0);
  linkData(data, updateData, "data.attributes.vigor.max", getProperty(data, "data.attributes.vigor.base") || 0);

  // Reset AC
  for (let type of Object.keys(data1.attributes.ac)) {
    linkData(data, updateData, `data.attributes.ac.${type}.total`, 10);
  }

  // Reset attack and damage bonuses
  linkData(data, updateData, "data.attributes.attack.general", 0);
  linkData(data, updateData, "data.attributes.attack.melee", 0);
  linkData(data, updateData, "data.attributes.attack.ranged", 0);
  linkData(data, updateData, "data.attributes.damage.general", 0);
  linkData(data, updateData, "data.attributes.damage.weapon", 0);
  linkData(data, updateData, "data.attributes.damage.spell", 0);

  // Reset saving throws
  for (let a of Object.keys(data1.attributes.savingThrows)) {
    {
      const k = `data.attributes.savingThrows.${a}.total`;
      if (useFractionalBaseBonuses) {
        let highStart = false;
        linkData(data, updateData, k,
          Math.floor(classes.reduce((cur, obj) => {
            const saveScale = getProperty(obj, `data.savingThrows.${a}.value`) || "";
            if (saveScale === "high"){
              const acc = highStart ? 0 : 2;
              highStart = true;
              return cur + obj.data.level / 2 + acc;
            }
            if (saveScale === "low") return cur + obj.data.level / 3;
            return cur;
          }, 0))
        );

        const v = updateData[k];
        if (v !== 0) {
          sourceInfo[k] = sourceInfo[k] || { positive: [], negative: [] };
          sourceInfo[k].positive.push({ name: game.i18n.localize("PF1.Base"), value: updateData[k] });
        }
      }
      else {
        linkData(data, updateData, k,
          classes.reduce((cur, obj) => {
            const classType = getProperty(obj.data, "classType") || "base";
            let formula = CONFIG.PF1.classSavingThrowFormulas[classType][obj.data.savingThrows[a].value];
            if (formula == null) formula = "0";
            const v = Math.floor(new Roll(formula, {level: obj.data.level}).roll().total);

            if (v !== 0) {
              sourceInfo[k] = sourceInfo[k] || { positive: [], negative: [] };
              sourceInfo[k].positive.push({ name: getProperty(obj, "name"), value: v });
            }

            return cur + v;
          }, 0)
        );
      }
    }
  }

  // Reset ACP and Max Dex bonus
  linkData(data, updateData, "data.attributes.acp.gear", 0);
  linkData(data, updateData, "data.attributes.maxDexBonus", null);
  items.filter(obj => { return obj.type === "equipment" && obj.data.equipped; }).forEach(obj => {
    let itemACP = Math.abs(obj.data.armor.acp);
    if (obj.data.masterwork === true && (["armor", "shield"].includes(obj.data.equipmentType))) {
      itemACP = Math.max(0, itemACP - 1);
    }
    
    linkData(data, updateData, "data.attributes.acp.gear", updateData["data.attributes.acp.gear"] + itemACP);
    if(obj.data.armor.dex != null) {
      if (updateData["data.attributes.maxDexBonus"] == null) linkData(data, updateData, "data.attributes.maxDexBonus", Math.abs(obj.data.armor.dex));
      else {
        linkData(data, updateData, "data.attributes.maxDexBonus", Math.min(updateData["data.attributes.maxDexBonus"], Math.abs(obj.data.armor.dex)));
      }
    }
  });

  // Reset specific skill bonuses
  for (let sklKey of getChangeFlat.call(this, "skills", "", this.data.data)) {
    if (hasProperty(data, sklKey)) linkData(data, updateData, sklKey, 0);
  }

  // Reset BAB, CMB and CMD
  {
    const k = "data.attributes.bab.total";
    if (useFractionalBaseBonuses) {
      linkData(data, updateData, k, Math.floor(classes.reduce((cur, obj) => {
        const babScale = getProperty(obj, "data.bab") || "";
        if (babScale === "high") return cur + obj.data.level;
        if (babScale === "med") return cur + obj.data.level * 0.75;
        if (babScale === "low") return cur + obj.data.level * 0.5;
        return cur;
      }, 0)));

      const v = updateData[k];
      if (v !== 0) {
        sourceInfo[k] = sourceInfo[k] || { positive: [], negative: [] };
        sourceInfo[k].positive.push({ name: game.i18n.localize("PF1.Base"), value: v });
      }
    }
    else {
      linkData(data, updateData, k, classes.reduce((cur, obj) => {
        const formula = CONFIG.PF1.classBABFormulas[obj.data.bab] != null ? CONFIG.PF1.classBABFormulas[obj.data.bab] : "0";
        const v = new Roll(formula, {level: obj.data.level}).roll().total;

        if (v !== 0) {
          sourceInfo[k] = sourceInfo[k] || { positive: [], negative: [] };
          sourceInfo[k].positive.push({ name: getProperty(obj, "name"), value: v });
        }

        return cur + v;
      }, 0));
    }
  }
  linkData(data, updateData, "data.attributes.cmb.total", 0);
  linkData(data, updateData, "data.attributes.cmd.total", 10);
  linkData(data, updateData, "data.attributes.cmd.flatFootedTotal", 10);

  // Reset initiative
  linkData(data, updateData, "data.attributes.init.total", getProperty(data, "data.attributes.init.value") || 0);

  // Reset class skills
  for (let [k, s] of Object.entries(getProperty(data, "data.skills"))) {
    if (!s) continue;
    const isClassSkill = classes.reduce((cur, o) => {
      if ((getProperty(o, "data.classSkills") || {})[k] === true) return true;
      return cur;
    }, false);
    linkData(data, updateData, `data.skills.${k}.cs`, isClassSkill);
    for (let k2 of Object.keys(getProperty(s, "subSkills") || {})) {
      linkData(data, updateData, `data.skills.${k}.subSkills.${k2}.cs`, isClassSkill);
    }
  }
};

const _addDynamicData = function({updateData={}, data={}, changes={}, flags={}, forceModUpdate=false}={}) {
  const prevMods = { total: {}, base: {} };
  const modDiffs = { total: {}, base: {} };

  // Reset ability modifiers
  const abilities = Object.keys(getProperty(data, "data.abilities") || {});
  for (let a of abilities) {
    prevMods.total[a] = forceModUpdate ? 0 : updateData[`data.abilities.${a}.mod`];
    prevMods.base[a] = forceModUpdate ? 0 : updateData[`data.abilities.${a}.baseMod`];
    if (a === "str" && flags.noStr ||
      a === "dex" && flags.noDex ||
      a === "int" && flags.oneInt ||
      a === "wis" && flags.oneWis ||
      a === "cha" && flags.oneCha) {
      modDiffs.total[a] = forceModUpdate ? -5 : 0;
      modDiffs.base[a] = forceModUpdate ? -5 : 0;
      if (changes[`data.abilities.${a}.total`]) changes[`data.abilities.${a}.total`] = null; // Remove used mods to prevent doubling
      if (changes[`data.abilities.${a}.base`]) changes[`data.abilities.${a}.base`] = null;
      continue;
    }
    const ablPenalty = Math.abs(updateData[`data.abilities.${a}.penalty`] || 0) + (updateData[`data.abilities.${a}.userPenalty`] || 0);

    // Update total ability score
    linkData(data, updateData,
      `data.abilities.${a}.total`,
      updateData[`data.abilities.${a}.total`] + (changes[`data.abilities.${a}.total`] || 0));
    if (changes[`data.abilities.${a}.total`]) changes[`data.abilities.${a}.total`] = null; // Remove used mods to prevent doubling
    linkData(data, updateData,
      `data.abilities.${a}.mod`,
      Math.floor((updateData[`data.abilities.${a}.total`] - 10) / 2));
    linkData(data, updateData,
      `data.abilities.${a}.mod`,
      Math.max(-5, updateData[`data.abilities.${a}.mod`] - Math.floor(updateData[`data.abilities.${a}.damage`] / 2) - Math.floor(ablPenalty / 2)));
    modDiffs.total[a] = updateData[`data.abilities.${a}.mod`] - prevMods.total[a];

    // Update base ability score
    linkData(data, updateData,
      `data.abilities.${a}.base`,
      updateData[`data.abilities.${a}.base`] + (changes[`data.abilities.${a}.base`] || 0));
    if (changes[`data.abilities.${a}.base`]) changes[`data.abilities.${a}.base`] = null; // Remove used mods to prevent doubling
    linkData(data, updateData,
      `data.abilities.${a}.baseMod`,
      Math.floor((updateData[`data.abilities.${a}.base`] - 10) / 2));
    linkData(data, updateData,
      `data.abilities.${a}.baseMod`,
      Math.max(-5, updateData[`data.abilities.${a}.baseMod`] - Math.floor(updateData[`data.abilities.${a}.damage`] / 2) - Math.floor(ablPenalty / 2)));
    modDiffs.base[a] = updateData[`data.abilities.${a}.baseMod`] - prevMods.base[a];
  }

  // Apply changes
  for (let [changeTarget, value] of Object.entries(changes)) {
    linkData(data, updateData, changeTarget, (updateData[changeTarget] || 0) + value);
  }
};

const _updateSkills = function(updateData, data) {
  const data1 = data.data;
  let energyDrainPenalty = Math.abs(data1.attributes.energyDrain);
  for (let [sklKey, skl] of Object.entries(data1.skills)) {
    if (skl == null) continue;

    let acpPenalty = (skl.acp ? data1.attributes.acp.total : 0);
    let ablMod = data1.abilities[skl.ability].mod;
    let specificSkillBonus = skl.changeBonus || 0;

    // Parse main skills
    let sklValue = skl.rank + (skl.cs && skl.rank > 0 ? 3 : 0) + ablMod + specificSkillBonus - acpPenalty - energyDrainPenalty;
    linkData(data, updateData, `data.skills.${sklKey}.mod`, sklValue);
    // Parse sub-skills
    for (let [subSklKey, subSkl] of Object.entries(skl.subSkills || {})) {
      if (subSkl == null) continue;
      if (getProperty(data1, `skills.${sklKey}.subSkills.${subSklKey}`) == null) continue;

      acpPenalty = (subSkl.acp ? data1.attributes.acp.total : 0);
      ablMod = data1.abilities[subSkl.ability].mod;
      specificSkillBonus = subSkl.changeBonus || 0;
      sklValue = subSkl.rank + (subSkl.cs && subSkl.rank > 0 ? 3 : 0) + ablMod + specificSkillBonus - acpPenalty - energyDrainPenalty;
      linkData(data, updateData, `data.skills.${sklKey}.subSkills.${subSklKey}.mod`, sklValue);
    }
  }
};

const _addDefaultChanges = function(data, changes, flags, sourceInfo) {
  // Class hit points
  const classes = data.items.filter(o => o.type === "class" && !["racial"].includes(getProperty(o.data, "classType"))).sort((a, b) => {
    return a.sort - b.sort;
  });
  const racialHD = data.items.filter(o => o.type === "class" && getProperty(o.data, "classType") === "racial").sort((a, b) => {
    return a.sort - b.sort;
  });

  const healthConfig = game.settings.get("pf1", "healthConfig");
  const cls_options  = this.data.type === "character" ? healthConfig.hitdice.PC : healthConfig.hitdice.NPC;
  const race_options = healthConfig.hitdice.Racial;
  const round = {up: Math.ceil, nearest: Math.round, down: Math.floor}[healthConfig.rounding];
  const continuous = {discrete: false, continuous: true}[healthConfig.continuity];

  const push_health = (value, source) => {
    changes.push({
      raw: mergeObject(ItemPF.defaultChange, { formula: value.toString(), target: "misc", subTarget: "mhp", modifier: "untypedPerm" }, {inplace: false}),
      source: {name: source.name, subtype: source.name.toString()}
    });
    changes.push({
      raw: mergeObject(ItemPF.defaultChange, { formula: value.toString(), target: "misc", subTarget: "vigor", modifier: "untypedPerm" }, {inplace: false}),
      source: {name: source.name, subtype: source.name.toString()}
    });
  };
  const manual_health = (health_source) => {
    let health = health_source.data.hp + (health_source.data.classType === "base") * health_source.data.fc.hp.value;
    if (!continuous) health = round(health);
    push_health(health, health_source);
  };
  const auto_health = (health_source, options, maximized=0) => {
    if (health_source.data.hd === 0) return;
    
    let die_health = 1 + (health_source.data.hd-1) * options.rate;
    if (!continuous) die_health = round(die_health);

    const maxed_health = Math.min(health_source.data.level, maximized) * health_source.data.hd;
    const level_health = Math.max(0, health_source.data.level - maximized) * die_health;
    const favor_health = (health_source.data.classType === "base") * health_source.data.fc.hp.value;
    let   health = maxed_health + level_health + favor_health;

    push_health(health, health_source);
  };
  const compute_health = (health_sources, options) => {
    // Compute and push health, tracking the remaining maximized levels.
    if (options.auto) {
      let maximized = options.maximized;
      for (const hd of health_sources) {
        auto_health(hd, options, maximized);
        maximized = Math.max(0, maximized - hd.data.level);
      }
    } else health_sources.forEach(race => manual_health(race));
  };

  compute_health(racialHD, race_options);
  compute_health(classes, cls_options);

  // Add Constitution to HP
  let hpAbility = getProperty(data, "data.attributes.hpAbility");
  if (hpAbility == null) hpAbility = "con";
  if (hpAbility !== "") {
    changes.push({
      raw: mergeObject(ItemPF.defaultChange, { formula: `@abilities.${hpAbility}.mod * @attributes.hd.total`, target: "misc", subTarget: "mhp", modifier: "base" }, {inplace: false}),
      source: {name: "Constitution"}
    });
    changes.push({
      raw: mergeObject(ItemPF.defaultChange, { formula: `2 * (@abilities.${hpAbility}.total + @abilities.${hpAbility}.drain)`, target: "misc", subTarget: "wounds", modifier: "base" }, {inplace: false}),
      source: {name: "Constitution"}
    });
  }

  // Add movement speed(s)
  for (let [k, s] of Object.entries(data.data.attributes.speed)) {
    let base = s.base;
    if (!base) base = 0;
    changes.push({
      raw: mergeObject(ItemPF.defaultChange, { formula: base.toString(), target: "speed", subTarget: `${k}Speed`, modifier: "base", operator: "set", priority: 1000 }, {inplace: false}),
      source: {name: "Base"},
    });
  }

  // Add variables to CMD and CMD
  {
    // BAB to CMB
    changes.push({
      raw: mergeObject(ItemPF.defaultChange, { formula: "@attributes.bab.total", target: "misc", subTarget: "cmb", modifier: "untypedPerm" }, {inplace: false}),
      source: {name: game.i18n.localize("PF1.BAB")},
    });
    // Ability to CMB
    const abl = getProperty(data, "data.attributes.cmbAbility");
    if (abl) {
      changes.push({
        raw: mergeObject(ItemPF.defaultChange, { formula: `@abilities.${abl}.mod`, target: "misc", subTarget: "cmb", modifier: "untypedPerm" }, {inplace: false}),
        source: {name: CONFIG.PF1.abilities[abl]},
      });
    }
    // Energy Drain to CMB
    changes.push({
      raw: mergeObject(ItemPF.defaultChange, { formula: "-@attributes.energyDrain", target: "misc", subTarget: "cmb", modifier: "untypedPerm" }, {inplace: false}),
      source: {name: game.i18n.localize("PF1.CondTypeEnergyDrain")},
    });

    // BAB to CMD
    changes.push({
      raw: mergeObject(ItemPF.defaultChange, { formula: "@attributes.bab.total", target: "misc", subTarget: "cmd", modifier: "untypedPerm" }, {inplace: false}),
      source: {name: game.i18n.localize("PF1.BAB")},
    });
    // Strength to CMD
    changes.push({
      raw: mergeObject(ItemPF.defaultChange, { formula: "@abilities.str.mod", target: "misc", subTarget: "cmd", modifier: "untypedPerm" }, {inplace: false}),
      source: {name: CONFIG.PF1.abilities["str"]},
    });
    // Energy Drain to CMD
    changes.push({
      raw: mergeObject(ItemPF.defaultChange, { formula: "-@attributes.energyDrain", target: "misc", subTarget: "cmd", modifier: "untyped" }, {inplace: false}),
      source: {name: game.i18n.localize("PF1.CondTypeEnergyDrain")},
    });
  }
  
  // Add Dexterity Modifier to Initiative
  {
    changes.push({
      raw: mergeObject(ItemPF.defaultChange, { formula: "@abilities.dex.mod", target: "misc", subTarget: "init", modifier: "untypedPerm", priority: -100 }, {inplace: false}),
      source: {name: CONFIG.PF1.abilities["dex"]},
    });
  }

  // Add Ability modifiers and Energy Drain to saving throws
  {
    let abl;
    // Ability Mod to Fortitude
    abl = getProperty(data, "data.attributes.savingThrows.fort.ability");
    changes.push({
      raw: mergeObject(ItemPF.defaultChange, { formula: `@abilities.${abl}.mod`, target: "savingThrows", subTarget: "fort", modifier: "untypedPerm" }, {inplace: false}),
      source: {name: CONFIG.PF1.abilities[abl]},
    });
    // Ability Mod to Reflex
    abl = getProperty(data, "data.attributes.savingThrows.ref.ability");
    changes.push({
      raw: mergeObject(ItemPF.defaultChange, { formula: `@abilities.${abl}.mod`, target: "savingThrows", subTarget: "ref", modifier: "untypedPerm" }, {inplace: false}),
      source: {name: CONFIG.PF1.abilities[abl]},
    });
    // Ability Mod to Will
    abl = getProperty(data, "data.attributes.savingThrows.will.ability");
    changes.push({
      raw: mergeObject(ItemPF.defaultChange, { formula: `@abilities.${abl}.mod`, target: "savingThrows", subTarget: "will", modifier: "untypedPerm" }, {inplace: false}),
      source: {name: CONFIG.PF1.abilities[abl]},
    });
    // Energy Drain
    changes.push({
      raw: mergeObject(ItemPF.defaultChange, { formula: "-@attributes.energyDrain", target: "savingThrows", subTarget: "allSavingThrows", modifier: "penalty" }, {inplace: false}),
      source: {name: game.i18n.localize("PF1.CondTypeEnergyDrain")},
    });
  }
  // Natural armor
  {
    changes.push({
      raw: mergeObject(ItemPF.defaultChange, { formula: "@attributes.naturalAC", target: "ac", subTarget: "nac", modifier: "base" }, {inplace: false}),
      source: {
        name: game.i18n.localize("PF1.BuffTarACNatural"),
      }
    });
  }
  // Add armor bonuses from equipment
  data.items.filter(obj => { return obj.type === "equipment" && obj.data.equipped; }).forEach(item => {
    let armorTarget = "aac";
    if (item.data.equipmentType === "shield") armorTarget = "sac";
    // Push base armor
    if (item.data.armor.value) {
      changes.push({
        raw: mergeObject(ItemPF.defaultChange, { formula: item.data.armor.value.toString(), target: "ac", subTarget: armorTarget, modifier: "base" }, {inplace: false}),
        source: {
          type: item.type,
          name: item.name
        }
      });
    }
    // Push enhancement bonus to armor
    if (item.data.armor.enh) {
      changes.push({
        raw: mergeObject(ItemPF.defaultChange, { formula: item.data.armor.enh.toString(), target: "ac", subTarget: armorTarget, modifier: "enh" }, {inplace: false}),
        source: {
          type: item.type,
          name: item.name
        }
      });
    }
  });

  // Add fly bonuses or penalties based on maneuverability
  const flyKey = getProperty(data, "data.attributes.speed.fly.maneuverability");
  let flyValue = 0;
  if (flyKey != null) flyValue = CONFIG.PF1.flyManeuverabilityValues[flyKey];
  if (flyValue !== 0) {
    changes.push({
      raw: mergeObject(ItemPF.defaultChange, { formula: flyValue.toString(), target: "skill", subTarget: "skill.fly", modifier: "untypedPerm" }, {inplace: false}),
      source: {
        name: game.i18n.localize("PF1.FlyManeuverability"),
      },
    });
  }
  // Add swim and climb skill bonuses based on having speeds for them
  {
    const climbSpeed = getProperty(data, "data.attributes.speed.climb.total") || 0;
    const swimSpeed = getProperty(data, "data.attributes.speed.swim.total") || 0;
    if (climbSpeed > 0) {
      changes.push({
        raw: mergeObject(ItemPF.defaultChange, { formula: "8", target: "skill", subTarget: "skill.clm", modifier: "racial" }, {inplace: false}),
        source: {
          name: game.i18n.localize("PF1.SpeedClimb"),
        },
      });
    }
    if (swimSpeed > 0) {
      changes.push({
        raw: mergeObject(ItemPF.defaultChange, { formula: "8", target: "skill", subTarget: "skill.swm", modifier: "racial" }, {inplace: false}),
        source: {
          name: game.i18n.localize("PF1.SpeedSwim"),
        },
      });
    }
  }

  // Add size bonuses to various attributes
  const sizeKey = data.data.traits.size;
  if (sizeKey !== "med") {
    // AC
    changes.push({
      raw: mergeObject(ItemPF.defaultChange, { formula: CONFIG.PF1.sizeMods[sizeKey].toString(), target: "ac", subTarget: "ac", modifier: "size" }, {inplace: false}),
      source: {
        type: "size"
      }
    });
    // Stealth skill
    changes.push({
      raw: mergeObject(ItemPF.defaultChange, { formula: CONFIG.PF1.sizeStealthMods[sizeKey].toString(), target: "skill", subTarget: "skill.ste", modifier: "size" }, {inplace: false}),
      source: {
        type: "size"
      }
    });
    // Fly skill
    changes.push({
      raw: mergeObject(ItemPF.defaultChange, { formula: CONFIG.PF1.sizeFlyMods[sizeKey].toString(), target: "skill", subTarget: "skill.fly", modifier: "size" }, {inplace: false}),
      source: {
        type: "size"
      }
    });
    // CMB
    changes.push({
      raw: mergeObject(ItemPF.defaultChange, { formula: CONFIG.PF1.sizeSpecialMods[sizeKey].toString(), target: "misc", subTarget: "cmb", modifier: "size" }, {inplace: false}),
      source: {
        type: "size"
      }
    });
    // CMD
    changes.push({
      raw: mergeObject(ItemPF.defaultChange, { formula: CONFIG.PF1.sizeSpecialMods[sizeKey].toString(), target: "misc", subTarget: "cmd", modifier: "size" }, {inplace: false}),
      source: {
        type: "size"
      }
    });
  }

  // Add conditions
  for (let [con, v] of Object.entries(data.data.attributes.conditions || {})) {
    if (!v) continue;

    switch (con) {
      case "blind":
        changes.push({
          raw: mergeObject(ItemPF.defaultChange, { formula: "-2", target: "ac", subTarget: "ac", modifier: "penalty" }, {inplace: false}),
          source: { name: game.i18n.localize("PF1.CondBlind") }
        });
        flags["loseDexToAC"] = true;
        sourceInfo["data.attributes.ac.normal.total"] = sourceInfo["data.attributes.ac.normal.total"] || { positive: [], negative: [] };
        sourceInfo["data.attributes.ac.touch.total"] = sourceInfo["data.attributes.ac.touch.total"] || { positive: [], negative: [] };
        sourceInfo["data.attributes.cmd.total"] = sourceInfo["data.attributes.cmd.total"] || { positive: [], negative: [] };
        sourceInfo["data.attributes.cmd.flatFootedTotal"] = sourceInfo["data.attributes.cmd.flatFootedTotal"] || { positive: [], negative: [] };
        sourceInfo["data.attributes.ac.normal.total"].negative.push({ name: game.i18n.localize("PF1.CondBlind"), value: game.i18n.localize("PF1.ChangeFlagLoseDexToAC") });
        sourceInfo["data.attributes.ac.touch.total"].negative.push({ name: game.i18n.localize("PF1.CondBlind"), value: game.i18n.localize("PF1.ChangeFlagLoseDexToAC") });
        sourceInfo["data.attributes.cmd.total"].negative.push({ name: game.i18n.localize("PF1.CondBlind"), value: game.i18n.localize("PF1.ChangeFlagLoseDexToAC") });
        sourceInfo["data.attributes.cmd.flatFootedTotal"].negative.push({ name: game.i18n.localize("PF1.CondBlind"), value: game.i18n.localize("PF1.ChangeFlagLoseDexToAC") });
        break;
      case "dazzled":
        changes.push({
          raw: mergeObject(ItemPF.defaultChange, { formula: "-1", target: "attack", subTarget: "attack", modifier: "penalty" }, {inplace: false}),
          source: { name: game.i18n.localize("PF1.CondDazzled") }
        });
        break;
      case "deaf":
        changes.push({
          raw: mergeObject(ItemPF.defaultChange, { formula: "-4", target: "misc", subTarget: "init", modifier: "penalty" }, {inplace: false}),
          source: { name: game.i18n.localize("PF1.CondDeaf") }
        });
        break;
      case "entangled":
        changes.push({
          raw: mergeObject(ItemPF.defaultChange, { formula: "-4", target: "ability", subTarget: "dex", modifier: "penalty" }, {inplace: false}),
          source: { name: game.i18n.localize("PF1.CondEntangled") }
        });
        changes.push({
          raw: mergeObject(ItemPF.defaultChange, { formula: "-2", target: "attack", subTarget: "attack", modifier: "penalty" }, {inplace: false}),
          source: { name: game.i18n.localize("PF1.CondEntangled") }
        });
        break;
      case "grappled":
        changes.push({
          raw: mergeObject(ItemPF.defaultChange, { formula: "-4", target: "ability", subTarget: "dex", modifier: "penalty" }, {inplace: false}),
          source: { name: game.i18n.localize("PF1.CondGrappled") }
        });
        changes.push({
          raw: mergeObject(ItemPF.defaultChange, { formula: "-2", target: "attack", subTarget: "attack", modifier: "penalty" }, {inplace: false}),
          source: { name: game.i18n.localize("PF1.CondGrappled") }
        });
        changes.push({
          raw: mergeObject(ItemPF.defaultChange, { formula: "-2", target: "misc", subTarget: "cmb", modifier: "penalty" }, {inplace: false}),
          source: { name: game.i18n.localize("PF1.CondGrappled") }
        });
        break;
      case "helpless":
        flags["noDex"] = true;
        sourceInfo["data.abilities.dex.total"] = sourceInfo["data.abilities.dex.total"] || { positive: [], negative: [] };
        sourceInfo["data.abilities.dex.total"].negative.push({ name: game.i18n.localize("PF1.CondHelpless"), value: game.i18n.localize("PF1.ChangeFlagNoDex") });
        break;
      case "paralyzed":
        flags["noDex"] = true;
        flags["noStr"] = true;
        sourceInfo["data.abilities.dex.total"] = sourceInfo["data.abilities.dex.total"] || { positive: [], negative: [] };
        sourceInfo["data.abilities.dex.total"].negative.push({ name: game.i18n.localize("PF1.CondParalyzed"), value: game.i18n.localize("PF1.ChangeFlagNoDex") });
        sourceInfo["data.abilities.str.total"] = sourceInfo["data.abilities.str.total"] || { positive: [], negative: [] };
        sourceInfo["data.abilities.str.total"].negative.push({ name: game.i18n.localize("PF1.CondParalyzed"), value: game.i18n.localize("PF1.ChangeFlagNoStr") });
        break;
      case "pinned":
        flags["loseDexToAC"] = true;
        sourceInfo["data.attributes.ac.normal.total"] = sourceInfo["data.attributes.ac.normal.total"] || { positive: [], negative: [] };
        sourceInfo["data.attributes.ac.touch.total"] = sourceInfo["data.attributes.ac.touch.total"] || { positive: [], negative: [] };
        sourceInfo["data.attributes.cmd.total"] = sourceInfo["data.attributes.cmd.total"] || { positive: [], negative: [] };
        sourceInfo["data.attributes.ac.normal.total"].negative.push({ name: game.i18n.localize("PF1.CondPinned"), value: game.i18n.localize("PF1.ChangeFlagLoseDexToAC") });
        sourceInfo["data.attributes.ac.touch.total"].negative.push({ name: game.i18n.localize("PF1.CondPinned"), value: game.i18n.localize("PF1.ChangeFlagLoseDexToAC") });
        sourceInfo["data.attributes.cmd.total"].negative.push({ name: game.i18n.localize("PF1.CondPinned"), value: game.i18n.localize("PF1.ChangeFlagLoseDexToAC") });
        break;
      case "fear":
        changes.push({
          raw: mergeObject(ItemPF.defaultChange, { formula: "-2", target: "attack", subTarget: "attack", modifier: "penalty" }, {inplace: false}),
          source: { name: game.i18n.localize("PF1.CondFear") }
        });
        changes.push({
          raw: mergeObject(ItemPF.defaultChange, { formula: "-2", target: "savingThrows", subTarget: "allSavingThrows", modifier: "penalty" }, {inplace: false}),
          source: { name: game.i18n.localize("PF1.CondFear") }
        });
        changes.push({
          raw: mergeObject(ItemPF.defaultChange, { formula: "-2", target: "skills", subTarget: "skills", modifier: "penalty" }, {inplace: false}),
          source: { name: game.i18n.localize("PF1.CondFear") }
        });
        changes.push({
          raw: mergeObject(ItemPF.defaultChange, { formula: "-2", target: "abilityChecks", subTarget: "allChecks", modifier: "penalty" }, {inplace: false}),
          source: { name: game.i18n.localize("PF1.CondFear") }
        });
        break;
      case "sickened":
        changes.push({
          raw: mergeObject(ItemPF.defaultChange, { formula: "-2", target: "attack", subTarget: "attack", modifier: "penalty" }, {inplace: false}),
          source: { name: game.i18n.localize("PF1.CondSickened") }
        });
        changes.push({
          raw: mergeObject(ItemPF.defaultChange, { formula: "-2", target: "damage", subTarget: "wdamage", modifier: "penalty" }, {inplace: false}),
          source: { name: game.i18n.localize("PF1.CondSickened") }
        });
        changes.push({
          raw: mergeObject(ItemPF.defaultChange, { formula: "-2", target: "savingThrows", subTarget: "allSavingThrows", modifier: "penalty" }, {inplace: false}),
          source: { name: game.i18n.localize("PF1.CondSickened") }
        });
        changes.push({
          raw: mergeObject(ItemPF.defaultChange, { formula: "-2", target: "skills", subTarget: "skills", modifier: "penalty" }, {inplace: false}),
          source: { name: game.i18n.localize("PF1.CondSickened") }
        });
        changes.push({
          raw: mergeObject(ItemPF.defaultChange, { formula: "-2", target: "abilityChecks", subTarget: "allChecks", modifier: "penalty" }, {inplace: false}),
          source: { name: game.i18n.localize("PF1.CondSickened") }
        });
        break;
      case "stunned":
        changes.push({
          raw: mergeObject(ItemPF.defaultChange, { formula: "-2", target: "ac", subTarget: "ac", modifier: "penalty" }, {inplace: false}),
          source: { name: game.i18n.localize("PF1.CondStunned") }
        });
        flags["loseDexToAC"] = true;
        sourceInfo["data.attributes.ac.normal.total"] = sourceInfo["data.attributes.ac.normal.total"] || { positive: [], negative: [] };
        sourceInfo["data.attributes.ac.touch.total"] = sourceInfo["data.attributes.ac.touch.total"] || { positive: [], negative: [] };
        sourceInfo["data.attributes.cmd.total"] = sourceInfo["data.attributes.cmd.total"] || { positive: [], negative: [] };
        sourceInfo["data.attributes.ac.normal.total"].negative.push({ name: "Stunned", value: "Lose Dex to AC" });
        sourceInfo["data.attributes.ac.touch.total"].negative.push({ name: "Stunned", value: "Lose Dex to AC" });
        sourceInfo["data.attributes.cmd.total"].negative.push({ name: "Stunned", value: "Lose Dex to AC" });
        break;
    }
  }

  // Handle fatigue and exhaustion so that they don't stack
  if (data.data.attributes.conditions.exhausted) {
    changes.push({
      raw: mergeObject(ItemPF.defaultChange, { formula: "-6", target: "ability", subTarget: "str", modifier: "penalty" }, {inplace: false}),
      source: { name: game.i18n.localize("PF1.CondExhausted") }
    });
    changes.push({
      raw: mergeObject(ItemPF.defaultChange, { formula: "-6", target: "ability", subTarget: "dex", modifier: "penalty" }, {inplace: false}),
      source: { name: game.i18n.localize("PF1.CondExhausted") }
    });
  }
  else if (data.data.attributes.conditions.fatigued) {
    changes.push({
      raw: mergeObject(ItemPF.defaultChange, { formula: "-2", target: "ability", subTarget: "str", modifier: "penalty" }, {inplace: false}),
      source: { name: game.i18n.localize("PF1.CondFatigued") }
    });
    changes.push({
      raw: mergeObject(ItemPF.defaultChange, { formula: "-2", target: "ability", subTarget: "dex", modifier: "penalty" }, {inplace: false}),
      source: { name: game.i18n.localize("PF1.CondFatigued") }
    });
  }

  // Apply level drain to hit points
  if (!Number.isNaN(data.data.attributes.energyDrain) && data.data.attributes.energyDrain > 0) {
    changes.push({
      raw: mergeObject(ItemPF.defaultChange, { formula: "-(@attributes.energyDrain * 5)", target: "misc", subTarget: "mhp", modifier: "untyped", priority: -750 }, {inplace: false}),
      source: { name: game.i18n.localize("PF1.CondTypeEnergyDrain") }
    });
    changes.push({
      raw: mergeObject(ItemPF.defaultChange, { formula: "-(@attributes.energyDrain * 5)", target: "misc", subTarget: "vigor", modifier: "untyped", priority: -750 }, {inplace: false}),
      source: { name: game.i18n.localize("PF1.CondTypeEnergyDrain") }
    });
  }
};

export const isPermanentModifier = function(modifier) {
  return ["untypedPerm", "racial", "base", "inherent", "trait"].includes(modifier);
};

export const getChangeFlat = function(changeTarget, changeType, curData) {
  if (curData == null) curData = this.data.data;
  let result = [];

  switch(changeTarget) {
    case "mhp":
      return "data.attributes.hp.max";
    case "wounds":
      return "data.attributes.wounds.max";
    case "vigor":
      return "data.attributes.vigor.max";
    case "str":
    case "dex":
    case "con":
    case "int":
    case "wis":
    case "cha":
      if (changeType === "penalty") return `data.abilities.${changeTarget}.penalty`;
      if (isPermanentModifier(changeType)) return [`data.abilities.${changeTarget}.total`, `data.abilities.${changeTarget}.base`];
      return `data.abilities.${changeTarget}.total`;
    case "ac":
      if (changeType === "dodge") return ["data.attributes.ac.normal.total", "data.attributes.ac.touch.total", "data.attributes.cmd.total"];
      else if (changeType === "deflection") {
        return ["data.attributes.ac.normal.total", "data.attributes.ac.touch.total",
        "data.attributes.ac.flatFooted.total", "data.attributes.cmd.total", "data.attributes.cmd.flatFootedTotal"];
      }
      return ["data.attributes.ac.normal.total", "data.attributes.ac.touch.total", "data.attributes.ac.flatFooted.total"];
    case "aac":
    case "sac":
    case "nac":
      return ["data.attributes.ac.normal.total", "data.attributes.ac.flatFooted.total"];
    case "attack":
      return "data.attributes.attack.general";
    case "mattack":
      return "data.attributes.attack.melee";
    case "rattack":
      return "data.attributes.attack.ranged";
    case "damage":
      return "data.attributes.damage.general";
    case "wdamage":
      return "data.attributes.damage.weapon";
    case "sdamage":
      return "data.attributes.damage.spell";
    case "allSavingThrows":
      return ["data.attributes.savingThrows.fort.total", "data.attributes.savingThrows.ref.total", "data.attributes.savingThrows.will.total"];
    case "fort":
      return "data.attributes.savingThrows.fort.total";
    case "ref":
      return "data.attributes.savingThrows.ref.total";
    case "will":
      return "data.attributes.savingThrows.will.total";
    case "skills":
      for (let [a, skl] of Object.entries(curData.skills)) {
        if (skl == null) continue;
        result.push(`data.skills.${a}.changeBonus`);

        if (skl.subSkills != null) {
          for (let b of Object.keys(skl.subSkills)) {
            result.push(`data.skills.${a}.subSkills.${b}.changeBonus`);
          }
        }
      }
      return result;
    case "strSkills":
      for (let [a, skl] of Object.entries(curData.skills)) {
        if (skl == null) continue;
        if (skl.ability === "str") result.push(`data.skills.${a}.changeBonus`);

        if (skl.subSkills != null) {
          for (let [b, subSkl] of Object.entries(skl.subSkills)) {
            if (subSkl != null && subSkl.ability === "str") result.push(`data.skills.${a}.subSkills.${b}.changeBonus`);
          }
        }
      }
      return result;
    case "dexSkills":
      for (let [a, skl] of Object.entries(curData.skills)) {
        if (skl == null) continue;
        if (skl.ability === "dex") result.push(`data.skills.${a}.changeBonus`);

        if (skl.subSkills != null) {
          for (let [b, subSkl] of Object.entries(skl.subSkills)) {
            if (subSkl != null && subSkl.ability === "dex") result.push(`data.skills.${a}.subSkills.${b}.changeBonus`);
          }
        }
      }
      return result;
    case "conSkills":
      for (let [a, skl] of Object.entries(curData.skills)) {
        if (skl == null) continue;
        if (skl.ability === "con") result.push(`data.skills.${a}.changeBonus`);

        if (skl.subSkills != null) {
          for (let [b, subSkl] of Object.entries(skl.subSkills)) {
            if (subSkl != null && subSkl.ability === "con") result.push(`data.skills.${a}.subSkills.${b}.changeBonus`);
          }
        }
      }
      return result;
    case "intSkills":
      for (let [a, skl] of Object.entries(curData.skills)) {
        if (skl == null) continue;
        if (skl.ability === "int") result.push(`data.skills.${a}.changeBonus`);

        if (skl.subSkills != null) {
          for (let [b, subSkl] of Object.entries(skl.subSkills)) {
            if (subSkl != null && subSkl.ability === "int") result.push(`data.skills.${a}.subSkills.${b}.changeBonus`);
          }
        }
      }
      return result;
    case "wisSkills":
      for (let [a, skl] of Object.entries(curData.skills)) {
        if (skl == null) continue;
        if (skl.ability === "wis") result.push(`data.skills.${a}.changeBonus`);

        if (skl.subSkills != null) {
          for (let [b, subSkl] of Object.entries(skl.subSkills)) {
            if (subSkl != null && subSkl.ability === "wis") result.push(`data.skills.${a}.subSkills.${b}.changeBonus`);
          }
        }
      }
      return result;
    case "chaSkills":
      for (let [a, skl] of Object.entries(curData.skills)) {
        if (skl == null) continue;
        if (skl.ability === "cha") result.push(`data.skills.${a}.changeBonus`);

        if (skl.subSkills != null) {
          for (let [b, subSkl] of Object.entries(skl.subSkills)) {
            if (subSkl != null && subSkl.ability === "cha") result.push(`data.skills.${a}.subSkills.${b}.changeBonus`);
          }
        }
      }
      return result;
    case "allChecks":
      return ["data.abilities.str.checkMod", "data.abilities.dex.checkMod", "data.abilities.con.checkMod",
        "data.abilities.int.checkMod", "data.abilities.wis.checkMod", "data.abilities.cha.checkMod"];
    case "strChecks":
      return "data.abilities.str.checkMod";
    case "dexChecks":
      return "data.abilities.dex.checkMod";
    case "conChecks":
      return "data.abilities.con.checkMod";
    case "intChecks":
      return "data.abilities.int.checkMod";
    case "wisChecks":
      return "data.abilities.wis.checkMod";
    case "chaChecks":
      return "data.abilities.cha.checkMod";
    case "allSpeeds":
      for (let speedKey of Object.keys(curData.attributes.speed)) {
        if (getProperty(curData, `attributes.speed.${speedKey}.base`)) result.push(`data.attributes.speed.${speedKey}.total`);
      }
      return result;
    case "landSpeed":
      return "data.attributes.speed.land.total";
    case "climbSpeed":
      return "data.attributes.speed.climb.total";
    case "swimSpeed":
      return "data.attributes.speed.swim.total";
    case "burrowSpeed":
      return "data.attributes.speed.burrow.total";
    case "flySpeed":
      return "data.attributes.speed.fly.total";
    case "cmb":
      return "data.attributes.cmb.total";
    case "cmd":
      return ["data.attributes.cmd.total", "data.attributes.cmd.flatFootedTotal"];
    case "init":
      return "data.attributes.init.total";
  }

  if (changeTarget.match(/^skill\.([a-zA-Z0-9]+)$/)) {
    const sklKey = RegExp.$1;
    if (curData.skills[sklKey] != null) {
      return `data.skills.${sklKey}.changeBonus`;
    }
  }
  else if (changeTarget.match(/^skill\.([a-zA-Z0-9]+)\.subSkills\.([a-zA-Z0-9]+)$/)) {
    const sklKey = RegExp.$1;
    const subSklKey = RegExp.$2;
    if (curData.skills[sklKey] != null && curData.skills[sklKey].subSkills[subSklKey] != null) {
      return `data.skills.${sklKey}.subSkills.${subSklKey}.changeBonus`;
    }
  }

  return null;
};

const _blacklistChangeData = function(data, changeTarget) {
  let result = duplicate(data);

  switch (changeTarget) {
    case "mhp":
      result.attributes.hp = null;
      result.skills = null;
      break;
    case "wounds":
      result.attributes.wounds = null;
      result.skills = null;
      break;
    case "vigor":
      result.attributes.vigor = null;
      result.skills = null;
      break;
    case "str":
      result.abilities.str = null;
      result.skills = null;
      result.attributes.savingThrows = null;
    case "con":
      result.abilities.con = null;
      result.attributes.hp = null;
      result.attributes.wounds = null;
      result.skills = null;
      result.attributes.savingThrows = null;
      break;
    case "dex":
      result.abilities.dex = null;
      result.attributes.ac = null;
      result.skills = null;
      result.attributes.savingThrows = null;
      break;
    case "int":
      result.abilities.int = null;
      result.skills = null;
      result.attributes.savingThrows = null;
      break;
    case "wis":
      result.abilities.wis = null;
      result.skills = null;
      result.attributes.savingThrows = null;
      break;
    case "cha":
      result.abilities.cha = null;
      result.skills = null;
      result.attributes.savingThrows = null;
      break;
    case "ac":
    case "aac":
    case "sac":
    case "nac":
      result.attributes.ac = null;
      break;
    case "attack":
    case "mattack":
    case "rattack":
      result.attributes.attack = null;
      break;
    case "damage":
    case "wdamage":
    case "sdamage":
      result.attributes.damage = null;
      break;
    case "allSavingThrows":
    case "fort":
    case "ref":
    case "will":
      result.attributes.savingThrows = null;
      break;
    case "skills":
    case "strSkills":
    case "dexSkills":
    case "conSkills":
    case "intSkills":
    case "wisSkills":
    case "chaSkills":
      result.skills = null;
      break;
    case "cmb":
      result.attributes.cmb = null;
      break;
    case "cmd":
      result.attributes.cmd = null;
      break;
    case "init":
      result.attributes.init = null;
      break;
  }

  if (changeTarget.match(/^data\.skills/)) {
    result.skills = null;
  }

  return result;
};

const getSortChangePriority = function() {
  const skillTargets = this._skillTargets;
  return { targets: [
    "ability", "misc", "ac", "attack", "damage", "savingThrows", "skills", "skill"
  ], types: [
      "str", "dex", "con", "int", "wis", "cha",
      "skills", "strSkills", "dexSkills", "conSkills", "intSkills", "wisSkills", "chaSkills", ...skillTargets,
      "allChecks", "strChecks", "dexChecks", "conChecks", "intChecks", "wisChecks", "chaChecks",
      "allSpeeds", "landSpeed", "climbSpeed", "swimSpeed", "burrowSpeed", "flySpeed",
      "ac", "aac", "sac", "nac",
      "attack", "mattack", "rattack",
      "damage", "wdamage", "sdamage",
      "allSavingThrows", "fort", "ref", "will",
      "cmb", "cmd", "init", "mhp", "wounds", "vigor"
  ], modifiers: [
    "untyped", "untypedPerm", "base", "enh", "dodge", "inherent", "deflection",
    "morale", "luck", "sacred", "insight", "resist", "profane",
    "trait", "racial", "size", "competence", "circumstance",
    "alchemical", "penalty"
  ]};
};

const _sortChanges = function(a, b) {
  const priority = getSortChangePriority.call(this);
  const targetA = priority.targets.indexOf(a.raw.target);
  const targetB = priority.targets.indexOf(b.raw.target);
  const typeA = priority.types.indexOf(a.raw.subTarget);
  const typeB = priority.types.indexOf(b.raw.subTarget);
  const modA = priority.modifiers.indexOf(a.raw.modifier);
  const modB = priority.modifiers.indexOf(b.raw.modifier);
  let prioA = (typeof a.raw.priority === "string") ? parseInt(a.raw.priority) : a.raw.priority;
  let prioB = (typeof b.raw.priority === "string") ? parseInt(b.raw.priority) : b.raw.priority;
  prioA = (prioA || 0) + 1000;
  prioB = (prioB || 0) + 1000;

  return targetA - targetB || typeA - typeB || prioB - prioA || modA - modB;
}

const _parseChange = function(change, changeData, flags) {
  if (flags == null) flags = {};
  const changeType = change.raw.modifier;
  const changeValue = change.raw.value;
  const changeOperator = change.raw.operator;

  if (!changeData[changeType]) return;
  if (changeValue === 0) return;
  if (flags.loseDexToAC && changeType === "dodge") return;

  change.source.value = changeValue;

  const prevValue = { positive: changeData[changeType].positive.value, negative: changeData[changeType].negative.value };

  // 'Add' operator
  if (["add", "+"].includes(changeOperator) || !changeOperator) {
    // Add value
    if (changeValue > 0) {
      if (["untyped", "untypedPerm", "dodge", "penalty"].includes(changeType)) changeData[changeType].positive.value += changeValue;
      else {
        changeData[changeType].positive.value = Math.max(changeData[changeType].positive.value, changeValue);
      }
    }
    else {
      if (["untyped", "untypedPerm", "dodge", "penalty"].includes(changeType)) changeData[changeType].negative.value += changeValue;
      else changeData[changeType].negative.value = Math.min(changeData[changeType].negative.value, changeValue);
    }

    // Add positive source
    if (changeValue > 0) {
      if (["untyped", "untypedPerm", "dodge", "penalty"].includes(changeType)) {
        changeData[changeType].positive.sources.push(change.source);
      }
      else if (prevValue.positive < changeValue) {
        changeData[changeType].positive.sources = [change.source];
      }
    }
    // Add negative source
    else {
      if (["untyped", "untypedPerm", "dodge", "penalty"].includes(changeType)) {
        changeData[changeType].negative.sources.push(change.source);
      }
      else if (prevValue.negative > changeValue) {
        changeData[changeType].negative.sources = [change.source];
      }
    }
  }
}

const _applySetChanges = function(updateData, data, changes) {
  const newAttributes = {};

  for (let change of changes) {
    const c = change.raw;
    let changeFlats = getChangeFlat.call(this, c.subTarget, c.modifier, data.data);
    if (!(changeFlats instanceof Array)) changeFlats = [changeFlats];
    for (let f of changeFlats) {
      newAttributes[f] = newAttributes[f] || {};
      newAttributes[f][c.modifier] = c.value;
    }
  }
  
  for (const [attrKey, attrValues] of Object.entries(newAttributes)) {
    let totalValue = 0;
    for (let v of Object.values(attrValues)) {
      totalValue += v;
    }
    linkData(data, updateData, attrKey, totalValue);
  }
};
