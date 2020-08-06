import { HealthConfig } from "./config/health.js";
import { ExperienceConfig } from "./config/experience.js";

export const registerSystemSettings = function() {
  /**
   * Track the system version upon which point a migration was last applied
   */
  game.settings.register("pf1", "systemMigrationVersion", {
    name: "System Migration Version",
    scope: "world",
    config: false,
    type: String,
    default: "0.0.0"
  });

  // Health configuration
  game.settings.registerMenu("pf1",
    "healthConfig", {
      name: "SETTINGS.pf1HealthConfigName",
      label: "SETTINGS.pf1HealthConfigLabel",
      hint: "SETTINGS.pf1HealthConfigHint",
      icon: "fas fa-heartbeat",
      type: HealthConfig,
      restricted: true
    }
  );
  game.settings.register("pf1", "healthConfig", {
    name: "SETTINGS.pf1HealthConfigName",
    scope: "world",
    default: HealthConfig.defaultSettings,
    type: Object,
    config: false,
    onChange: () => {
      game.actors.entities.forEach(o => { o.update({}); });
      Object.values(game.actors.tokens).forEach(o => { o.update({}); });
    }
  });

  // Experience configuration
  game.settings.registerMenu("pf1",
    "experienceConfig", {
      name: "PF1.ExperienceConfigName",
      label: "PF1.ExperienceConfigLabel",
      hint: "PF1.ExperienceConfigHint",
      icon: "fas fa-book",
      type: ExperienceConfig,
      restricted: true,
    }
  );
  game.settings.register("pf1", "experienceConfig", {
    name: "PF1.ExperienceConfigName",
    scope: "world",
    default: ExperienceConfig.defaultSettings,
    type: Object,
    config: false,
    onChange: () => {
      game.actors.entities.forEach(o => { o.update({}); });
      Object.values(game.actors.tokens).forEach(o => { o.update({}); });
    }
  });

  /**
   * Register diagonal movement rule setting
   */
  game.settings.register("pf1", "diagonalMovement", {
    name: "SETTINGS.pf1DiagN",
    hint: "SETTINGS.pf1DiagL",
    scope: "world",
    config: true,
    default: "5105",
    type: String,
    choices: {
      "555": "SETTINGS.pf1DiagPHB",
      "5105": "SETTINGS.pf1DiagDMG"
    },
    onChange: rule => canvas.grid.diagonalRule = rule
  });

  /**
   * Experience rate
   * @deprecated
   */
  game.settings.register("pf1", "experienceRate", {
    name: "SETTINGS.pf1ExpRateN",
    hint: "SETTINGS.pf1ExpRateL",
    scope: "world",
    config: false,
    default: "",
    type: String,
    onChange: () => {
      [...game.actors.entities, ...Object.values(game.actors.tokens)].filter(o => {
        return o.data.type === "character";
      }).forEach(o => {
        o.update({});
        if (o.sheet != null && o.sheet._state > 0) o.sheet.render();
      });
    },
  });
  
  /**
   * System of Units
   */
  game.settings.register("pf1", "units", {
    name: "SETTINGS.pf1UnitsN",
    hint: "SETTINGS.pf1UnitsL",
    scope: "world",
    config: true,
    default: "imperial",
    type: String,
    choices: {
      "imperial": "Imperial (feet, lbs)",
      "metric": "Metric (meters, kg)"
    },
    onChange: () => {
      [...game.actors.entities, ...Object.values(game.actors.tokens)].filter(o => {
        return o.data.type === "character";
      }).forEach(o => {
        o.update({});
        if (o.sheet != null && o.sheet._state > 0) o.sheet.render();
      });
    },
  });

  /**
   * Option to allow the background skills optional ruleset.
   */
  game.settings.register("pf1", "allowBackgroundSkills", {
    name: "SETTINGS.pf1BackgroundSkillsN",
    hint: "SETTINGS.pf1BackgroundSkillsH",
    scope: "world",
    config: true,
    default: false,
    type: Boolean,
    onChange: () => {
      game.actors.entities.forEach(o => { if (o.sheet && o.sheet.rendered) o.sheet.render(true); });
      Object.values(game.actors.tokens).forEach(o => { if (o.sheet && o.sheet.rendered) o.sheet.render(true); });
    },
  });

  /**
   * Option to use the Fractional Base Bonuses optional ruleset.
   */
  game.settings.register("pf1", "useFractionalBaseBonuses", {
    name: "SETTINGS.pf1FractionalBaseBonusesN",
    hint: "SETTINGS.pf1FractionalBaseBonusesH",
    scope: "world",
    config: true,
    default: false,
    type: Boolean,
    onChange: () => {
      game.actors.entities.forEach(o => { o.update({}); });
      Object.values(game.actors.tokens).forEach(o => { o.update({}); });
    },
  });

  /**
   * Option to automatically collapse Item Card descriptions
   */
  game.settings.register("pf1", "autoCollapseItemCards", {
    name: "SETTINGS.pf1AutoCollapseCardN",
    hint: "SETTINGS.pf1AutoCollapseCardL",
    scope: "client",
    config: true,
    default: false,
    type: Boolean,
    onChange: () => {
      ui.chat.render();
    }
  });

  /**
   * Option to change measure style
   */
  game.settings.register("pf1", "measureStyle", {
    name: "SETTINGS.pf1MeasureStyleN",
    hint: "SETTINGS.pf1MeasureStyleL",
    scope: "world",
    config: true,
    default: true,
    type: Boolean,
  });

  /**
   * Low-light Vision Mode
   */
  game.settings.register("pf1", "lowLightVisionMode", {
    name: "SETTINGS.pf1LowLightVisionModeN",
    hint: "SETTINGS.pf1LowLightVisionModeH",
    scope: "world",
    config: true,
    default: false,
    type: Boolean,
  });

  /**
   * Set coin weight
   */
  game.settings.register("pf1", "coinWeight", {
    name: "SETTINGS.pf1CoinWeightN",
    hint: "SETTINGS.pf1CoinWeightH",
    scope: "world",
    config: true,
    default: 50,
    type: Number,
    onChange: () => {
      game.actors.entities.forEach(o => { o.update({}); });
      Object.values(game.actors.tokens).forEach(o => { o.update({}); });
    },
  });

  /**
   * Skip action dialog prompts
   */
  game.settings.register("pf1", "skipActionDialogs", {
    name: "SETTINGS.pf1SkipActionDialogsN",
    hint: "SETTINGS.pf1SkipActionDialogsH",
    scope: "client",
    config: true,
    default: false,
    type: Boolean,
  });
};

export const getSkipActionPrompt = function() {
  return (game.settings.get("pf1", "skipActionDialogs") && !game.keyboard.isDown("Shift")) ||
  (!game.settings.get("pf1", "skipActionDialogs") && game.keyboard.isDown("Shift"));
};
