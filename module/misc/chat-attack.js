export class ChatAttack {
  constructor(item, {label="", rollData={}}={}) {
    this._baseRollData = rollData;
    this.setItem(item);
    this.label = label;

    this.attack = {
      flavor: "",
      tooltip: "",
      total: 0,
      isCrit: false,
      isFumble: false,
    };
    this.critConfirm = {
      flavor: "",
      tooltip: "",
      total: 0,
      isCrit: false,
      isFumble: false,
    };
    this.hasAttack = false;
    this.hasCritConfirm = false;

    this.damage = {
      flavor: "",
      tooltip: "",
      total: 0,
    };
    this.critDamage = {
      flavor: "",
      tooltip: "",
      total: 0,
    };
    this.hasDamage = false;

    this.cards = [];
    this.effectNotes = "";
  }

  get critRange() {
    return getProperty(this.item, "data.data.ability.critRange") || 20;
  }

  /**
   * Sets the attack's item reference.
   * @param {ItemPF} item - The item to reference.
   */
  setItem(item) {
    if (item == null) {
      this.rollData = {};
      this.item = null;
      return;
    }

    this.item = item;
    this.rollData = item.actor != null ? item.actor.getRollData() : {};
    this.rollData.item = duplicate(this.item.data.data);
    this.rollData = mergeObject(this.rollData, this._baseRollData);
  }

  async addAttack({bonus=null, extraParts=[], primaryAttack=true, critical=false}={}) {
    if (!this.item) return;

    this.hasAttack = true;
    let data = this.attack;
    if (critical === true) data = this.critConfirm;

    // Roll attack
    let roll = this.item.rollAttack({data: this.rollData, bonus: bonus, extraParts: extraParts, primaryAttack: primaryAttack });
    let d20 = roll.parts[0];
    let critType = 0;
    if ((d20.total >= this.critRange && !critical) || (d20.total === 20 && critical)) critType = 1;
    else if (d20.total === 1) critType = 2;

    // Add tooltip
    let tooltip   = $(await roll.getTooltip()).prepend(`<div class="dice-formula">${roll.formula}</div>`)[0].outerHTML;
    data.flavor   = critical ? game.i18n.localize("PF1.CriticalConfirmation") : this.label;
    data.tooltip  = tooltip;
    data.total    = roll.total;
    data.isCrit   = critType === 1;
    data.isFumble = critType === 2;

    // Add crit confirm
    if (!critical && d20.total >= this.critRange) {
      this.hasCritConfirm = true;
      await this.addAttack({bonus: bonus, extraParts: extraParts, primaryAttack: primaryAttack, critical: true});
    }
  }

  async addDamage({extraParts=[], primaryAttack=true, critical=false}={}) {
    if (!this.item) return;

    this.hasDamage = true;
    let data = this.damage;
    if (critical === true) data = this.critDamage;
    
    const rolls = this.item.rollDamage({data: this.rollData, extraParts: extraParts, primaryAttack: primaryAttack, critical: critical});
    // Add tooltip
    let tooltips = "";
    let totalDamage = 0;
    for (let roll of rolls) {
      let tooltip = $(await roll.roll.getTooltip()).prepend(`<div class="dice-formula">${roll.roll.formula}</div>`)[0].outerHTML;
      // Alter tooltip
      let tooltipHtml = $(tooltip);
      totalDamage += roll.roll.total;
      let totalText = roll.roll.total.toString();
      if (roll.damageType.length) totalText += ` (${roll.damageType})`;
      tooltipHtml.find(".part-total").text(totalText);
      tooltip = tooltipHtml[0].outerHTML;
      
      tooltips += tooltip;
    }
    // Add normal data
    let flavor;
    if (!critical) flavor = this.item.isHealing ? game.i18n.localize("PF1.Healing")         : game.i18n.localize("PF1.Damage");
    else           flavor = this.item.isHealing ? game.i18n.localize("PF1.HealingCritical") : game.i18n.localize("PF1.DamageCritical");
    const damageTypes = this.item.data.data.damage.parts.reduce((cur, o) => {
      if (o[1] !== "" && cur.indexOf(o[1]) === -1) cur.push(o[1]);
      return cur;
    }, []);

    // Add card
    if (critical) {
      if (this.item.isHealing) this.cards.push({ label: game.i18n.localize("PF1.ApplyCriticalHealing"), value: -totalDamage, action: "applyDamage", });
      else                     this.cards.push({ label: game.i18n.localize("PF1.ApplyCriticalDamage") , value:  totalDamage, action: "applyDamage", });
    }
    else {
      if (this.item.isHealing) this.cards.push({ label: game.i18n.localize("PF1.ApplyHealing"), value: -totalDamage, action: "applyDamage", });
      else                     this.cards.push({ label: game.i18n.localize("PF1.ApplyDamage") , value:  totalDamage, action: "applyDamage", });
    }

    data.flavor = damageTypes.length > 0 ? `${flavor} (${damageTypes.join(", ")})` : flavor;
    data.tooltip = tooltips;
    data.total = rolls.reduce((cur, roll) => {
      return cur + roll.roll.total;
    }, 0);
  }

  async addEffect({primaryAttack=true}={}) {
    if (!this.item) return;

    this.effectNotes = this.item.rollEffect({ primaryAttack: primaryAttack });
  }
}