import { CR, naturalSort } from "../lib.js";

export class CompendiumBrowser extends Application {
  constructor(...args) {
    super(...args);

    this.items = [];

    this.filters = [];

    this.activeFilters = {};

    this._data = {
      loaded: false,
      data: {},
      promise: null,
      progress: null,
    };

    /**
     * The bottom scroll treshold (in pixels) at which the browser should start lazy loading some more items.
     * @type {Number}
     * @property
     */
    this.lazyLoadTreshold = 80;
    /**
     * The maximum number of items initially visible in regards to lazy loading.
     * @type {Number}
     * @property
     */
    this.lazyStart = 80;
    /**
     * The current amount of items visible in regards to lazy loading.
     * @type {Number}
     * @property
     */
    this.lazyIndex = 0;
    /**
     * The amount of new items to lazy load when triggered.
     * @type {Number}
     * @property
     */
    this.lazyAdd = 20;
  }

  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      template: "systems/pf1/templates/apps/compendium-browser.html",
      classes: ["pf1", "app"],
      width: 720,
      height: window.innerHeight - 60,
      top: 30,
      left: 40,
    });
  }

  _initLazyLoad() {
    const rootElem = this.element.find(".directory-list");
    const elems = rootElem.find('.directory-item');
    this.lazyIndex = Math.min(this.lazyStart, elems.length);
    elems.slice(this.lazyIndex).hide();

    // Create function for lazy loading
    const lazyLoad = () => {
      let newItems = 0;
      const initialIndex = this.lazyIndex;
      for (let a = 0; a < elems.length && this.lazyIndex < initialIndex + this.lazyAdd; a++) {
        const elem = elems[a];
        if (elem.style.display !== "none") continue;
        const item = this._data.data.collection[elem.dataset.entryId].item;

        if (this._passesFilters(item)) {
          $(elem).fadeIn(500);
          newItems++;
          this.lazyIndex++;
        }
      }
    };

    // Create callback for lazy loading
    $(rootElem).on("scroll", () => {
      const top = rootElem.scrollTop() + rootElem.height();
      const bottom = rootElem[0].scrollHeight - this.lazyLoadTreshold;
      if (top >= bottom) {
        lazyLoad();
      }
    });
  }

  loadData() {
    return new Promise(resolve => {
      let promise = this._data.promise;
      if (promise == null) {
        promise = this._gatherData();
        this._data.promise = promise;
      }

      promise.then(() => {
        this._data.loaded = true;
        this._data.promise = null;
        resolve(this._data.data);
      });
    });
  }

  async _gatherData() {
    await this._fetchMetadata();

    this._data.data = {
      filters: this.filters,
      collection: this.items.reduce((cur, o) => {
        cur[o.item._id] = o;
        return cur;
      }, {}),
      labels: {
        itemCount: game.i18n.localize("PF1.TotalItems").format(this.items.length),
        filteredItemCount: game.i18n.localize("PF1.FilteredItems").format(this.items.length),
      },
    };
  }

  get typeName() {
    switch (this.type) {
      case "spells":
        return game.i18n.localize("PF1.Spells");
      case "items":
        return game.i18n.localize("PF1.Items");
      case "feats":
        return game.i18n.localize("PF1.Features");
      case "bestiary":
        return game.i18n.localize("PF1.Creatures");
      case "classes":
        return game.i18n.localize("PF1.Classes");
      case "races":
        return game.i18n.localize("PF1.Races");
    }
    return this.type;
  }

  get type() {
    return this.options.type;
  }

  get title() {
    return [this.typeName, "Browser"].join(" ");
  }

  get entityType() {
    return this.options.entityType;
  }

  _onProgress(progress) {
    progress.loaded++;
    progress.pct = Math.round(progress.loaded * 10 / progress.total) * 10;
    SceneNavigation._onLoadProgress(progress.message, progress.pct);
  }

  async loadCompendium(p) {
    const progress = this._data.progress;

    if (p.private && !game.user.isGM) {
      this._onProgress(progress);
      return;
    }

    // const items = await p.getContent();
    let items = (await SocketInterface.dispatch("modifyCompendium", {
      type: p.collection,
      action: "get",
      data: {},
      options: { returnType: "content" },
    })).result;

    if(p.translated) {
      items = items.map(item => p.translate(item));
    }

    for (let i of items) {
      if (!this._filterItems(i)) continue;
      this.items.push(this._mapEntry(p, i));
    }
    this._onProgress(progress);
  }

  async _fetchMetadata() {
    this.items = [];

    // Initialize progress bar
    let packs = [];
    const progress = { pct: 0, message: game.i18n.localize("PF1.LoadingCompendiumBrowser"), loaded: -1, total: 0 };
    for (let p of game.packs.values()) {
      if (p.entity === this.entityType) {
        progress.total++;
        packs.push(p);
      }
    }
    this._data.progress = progress;
    this._onProgress(progress);

    // Load compendiums
    let promises = [];
    for (let p of packs) {
      promises.push(this.loadCompendium(p));
    }
    await Promise.all(promises);

    // Sort items
    this.items = naturalSort(this.items, "name");

    // Return if no appropriate items were found
    if (this.items.length === 0) {
      return;
    }

    // Gather filter data
    switch (this.type) {
      case "spells":
        this._fetchSpellFilters();
        break;
      case "items":
        this._fetchItemFilters();
        break;
      case "bestiary":
        this._fetchBestiaryFilters();
        break;
      case "feats":
        this._fetchFeatFilters();
        break;
      case "classes":
        this._fetchClassFilters();
        break;
      case "races":
        this._fetchRaceFilters();
        break;
    }

    this.activeFilters = this.filters.reduce((cur, f) => {
      cur[f.path] = [];
      return cur;
    }, {});
  }

  _filterItems(item) {
    if (this.type === "spells" && item.type !== "spell") return false;
    if (this.type === "items" && !["weapon", "equipment", "loot", "consumable"].includes(item.type)) return false;
    if (this.type === "feats" && item.type !== "feat") return false;
    if (this.type === "classes" && item.type !== "class") return false;
    if (this.type === "races" && item.type !== "race") return false;
    return true;
  }

  /* ------------------------------------- */
  /*  Mapping Functions                    */
  /* ------------------------------------- */
  _mapFeats(result, item) {

    this.extraFilters = this.extraFilters || {
      "tags": {},
      "associations": {
        "class": {},
      },
    };

    result.item.tags = (item.data.tags || []).reduce((cur, o) => {
      this.extraFilters.tags[o[0]] = true;
      cur.push(o[0]);
      return cur;
    }, []);

    result.item.assocations = {
      "class": (item.data.featType === "classFeat" ? (getProperty(item.data, "associations.classes") || []) : []).reduce((cur, o) => {
        this.extraFilters.associations.class[o[0]] = true;
        cur.push(o[0]);
        return cur;
      }, []),
    };
  }

  _mapBestiary(result, item) {

    this.extraFilters = this.extraFilters || {
      "data.details.cr.total": {},
      "subTypes": {},
    };
    result.item.creatureType = "";
    result.item.subTypes = [];

    // Add CR filters
    if (item.type === "npc") {
      const cr = getProperty(item, "data.details.cr.total");
      if (cr && !this.extraFilters["data.details.cr.total"][cr]) this.extraFilters["data.details.cr.total"][cr] = true;
    }
    // Get creature (sub)type
    const race = item.items.filter(o => o.type === "race")[0];
    if (race != null) {
      result.item.creatureType = race.data.creatureType;
      result.item.subTypes = race.data.subTypes.map(o => {
        this.extraFilters.subTypes[o[0]] = true;
        return o[0];
      });
    }
  }

  _mapItems(result, item) {
    this.extraFilters = this.extraFilters || {};

    result.item.weaponProps = Object.entries(getProperty(item.data, "data.properties") || []).reduce((cur, o) => {
      if (o[1]) cur.push(o[0]);
      return cur;
    }, []);
  }

  _mapSpells(result, item) {
    
    this.extraFilters = this.extraFilters || {
      "learnedAt.class": [],
      "learnedAt.domain": [],
      "learnedAt.subDomain": [],
      "learnedAt.elementalSchool": [],
      "learnedAt.bloodline": [],
      "data.subschool": [],
      "spellTypes": [],
    };

    result.item.allSpellLevels = [];

    // Add class/domain/etc filters
    result.item.learnedAt = {
      "class": (getProperty(item, "data.learnedAt.class") || []).reduce((cur, o) => {
        this.extraFilters["learnedAt.class"][o[0]] = true;
        if (!result.item.allSpellLevels.includes(o[1])) result.item.allSpellLevels.push(o[1]);
        cur.push(o[0]);
        return cur;
      }, []),
      "domain": (getProperty(item, "data.learnedAt.domain") || []).reduce((cur, o) => {
        this.extraFilters["learnedAt.domain"][o[0]] = true;
        if (!result.item.allSpellLevels.includes(o[1])) result.item.allSpellLevels.push(o[1]);
        cur.push(o[0]);
        return cur;
      }, []),
      "subDomain": (getProperty(item, "data.learnedAt.subDomain") || []).reduce((cur, o) => {
        this.extraFilters["learnedAt.subDomain"][o[0]] = true;
        if (!result.item.allSpellLevels.includes(o[1])) result.item.allSpellLevels.push(o[1]);
        cur.push(o[0]);
        return cur;
      }, []),
      "elementalSchool": (getProperty(item, "data.learnedAt.elementalSchool") || []).reduce((cur, o) => {
        this.extraFilters["learnedAt.elementalSchool"][o[0]] = true;
        if (!result.item.allSpellLevels.includes(o[1])) result.item.allSpellLevels.push(o[1]);
        cur.push(o[0]);
        return cur;
      }, []),
      "bloodline": (getProperty(item, "data.learnedAt.bloodline") || []).reduce((cur, o) => {
        this.extraFilters["learnedAt.bloodline"][o[0]] = true;
        if (!result.item.allSpellLevels.includes(o[1])) result.item.allSpellLevels.push(o[1]);
        cur.push(o[0]);
        return cur;
      }, []),
      "spellLevel": {
        "class": (getProperty(item, "data.learnedAt.class") || []).reduce((cur, o) => {
          cur[o[0]] = o[1];
          return cur;
        }, {}),
        "domain": (getProperty(item, "data.learnedAt.domain") || []).reduce((cur, o) => {
          cur[o[0]] = o[1];
          return cur;
        }, {}),
        "subDomain": (getProperty(item, "data.learnedAt.subDomain") || []).reduce((cur, o) => {
          cur[o[0]] = o[1];
          return cur;
        }, {}),
        // "elementalSchool": (getProperty(item, "data.learnedAt.elementalSchool") || []).reduce((cur, o) => {
        //   cur[o[0]] = o[1];
        //   return cur;
        // }, {}),
        "bloodline": (getProperty(item, "data.learnedAt.bloodline") || []).reduce((cur, o) => {
          cur[o[0]] = o[1];
          return cur;
        }, {}),
      },
    };

    // Add subschools
    {
      const subschool = item.data.subschool;
      if (subschool) this.extraFilters["data.subschool"][subschool] = true;
    }
    // Add spell types
    {
      const spellTypes = item.data.types ? item.data.types.split(CONFIG.PF1.re.traitSeparator) : [];
      result.item.spellTypes = spellTypes;
      for (let st of spellTypes) {
        this.extraFilters["spellTypes"][st] = true;
      }
    }
  }

  _mapClasses(result, item) {

    this.extraFilters = this.extraFilters || {
      "data.hd": {},
      "data.skillsPerLevel": {},
    };

    // Add HD
    {
      const hd = item.data.hd;
      if (hd) this.extraFilters["data.hd"][hd] = true;
    }
    // Add skills per level
    {
      const s = item.data.skillsPerLevel;
      if (s) this.extraFilters["data.skillsPerLevel"][s] = true;
    }
  }

  _mapRaces(result, item) {

    this.extraFilters = this.extraFilters || {
      "subTypes": {},
    };
    result.item.subTypes = [];

    // Get subtypes
    result.item.subTypes = item.data.subTypes.map(o => {
      this.extraFilters.subTypes[o[0]] = true;
      return o[0];
    });
  }

  _mapEntry(pack, item) {

    const result = {
      collection: pack.collection,
      item: {
        _id: item._id,
        name: item.name,
        type: item.type,
        img: item.img,
        data: item.data,
      },
    };

    switch (this.type) {
      case "feats":
        this._mapFeats(result, item);
        break;
      case "bestiary":
        this._mapBestiary(result, item);
        break;
      case "items":
        this._mapItems(result, item);
        break;
      case "spells":
        this._mapSpells(result, item);
        break;
      case "classes":
        this._mapClasses(result, item);
        break;
      case "races":
        this._mapRaces(result, item);
        break;
    }

    return result;
  }

  async getData() {
    if (!this._data.loaded) await this.loadData();

    return this._data.data;
  }

  async refresh() {
    await this.loadData();
    this.render(false);
  }

  _fetchSpellFilters() {
    this.filters = [
      {
        path: "data.school",
        label: game.i18n.localize("PF1.SpellSchool"),
        items: naturalSort(Object.entries(CONFIG.PF1.spellSchools).reduce((cur, o) => {
          cur.push({ key: o[0], name: o[1] });
          return cur;
        }, []), "name"),
      },
      {
        path: "data.subschool",
        label: game.i18n.localize("PF1.SubSchool"),
        items: naturalSort(Object.keys(this.extraFilters["data.subschool"]).reduce((cur, o) => {
          cur.push({ key: o, name: o });
          return cur;
        }, []), "name"),
      },
      {
        path: "spellTypes",
        label: game.i18n.localize("PF1.TypePlural"),
        items: naturalSort(Object.keys(this.extraFilters["spellTypes"]).reduce((cur, o) => {
          cur.push({ key: o, name: o });
          return cur;
        }, []), "name"),
      },
      {
        path: "learnedAt.class",
        label: game.i18n.localize("PF1.ClassPlural"),
        items: naturalSort(Object.keys(this.extraFilters["learnedAt.class"]).reduce((cur, o) => {
          cur.push({ key: o, name: o });
          return cur;
        }, []), "name"),
      },
      {
        path: "learnedAt.domain",
        label: game.i18n.localize("PF1.Domain"),
        items: naturalSort(Object.keys(this.extraFilters["learnedAt.domain"]).reduce((cur, o) => {
          cur.push({ key: o, name: o });
          return cur;
        }, []), "name"),
      },
      {
        path: "learnedAt.subDomain",
        label: game.i18n.localize("PF1.SubDomain"),
        items: naturalSort(Object.keys(this.extraFilters["learnedAt.subDomain"]).reduce((cur, o) => {
          cur.push({ key: o, name: o });
          return cur;
        }, []), "name"),
      },
      // {
      //   path: "learnedAt.elementalSchool",
      //   label: game.i18n.localize("PF1.ElementalSchool"),
      //   items: this.extraFilters["learnedAt.elementalSchool"].reduce((cur, o) => {
      //     cur.push({ key: o, name: o });
      //     return cur;
      //   }, []),
      // },
      {
        path: "learnedAt.bloodline",
        label: game.i18n.localize("PF1.Bloodline"),
        items: naturalSort(Object.keys(this.extraFilters["learnedAt.bloodline"]).reduce((cur, o) => {
          cur.push({ key: o, name: o });
          return cur;
        }, []), "name"),
      },
      {
        path: "_spellLevel",
        label: game.i18n.localize("PF1.SpellLevel"),
        items: Object.entries(CONFIG.PF1.spellLevels).reduce((cur, o) => {
          cur.push({ key: o[0], name: o[1] });
          return cur;
        }, []),
      },
    ];
  }

  _fetchItemFilters() {
    this.filters = [
      {
        path: "type",
        label: game.i18n.localize("PF1.Type"),
        items: [
          { key: "weapon", name: game.i18n.localize("PF1.ItemTypeWeapon") },
          { key: "equipment", name: game.i18n.localize("PF1.ItemTypeEquipment") },
          { key: "consumable", name: game.i18n.localize("PF1.ItemTypeConsumable") },
          { key: "loot", name: game.i18n.localize("PF1.Misc") },
        ],
      },
      {
        path: "data.weaponType",
        label: game.i18n.localize("PF1.WeaponType"),
        items: Object.entries(CONFIG.PF1.weaponTypes).reduce((cur, o) => {
          cur.push({ key: o[0], name: o[1]._label });
          return cur;
        }, []),
      },
      {
        path: "data.weaponSubtype",
        label: game.i18n.localize("PF1.WeaponSubtype"),
        items: Object.values(CONFIG.PF1.weaponTypes).reduce((cur, o) => {
          cur = cur.concat((Object.entries(o).filter(i => !i[0].startsWith("_")).reduce((arr, i) => {
            if (!cur.filter(a => a.key === i[0]).length) {
              arr.push({ key: i[0], name: i[1] });
            }
            return arr;
          }, [])));
          return cur;
        }, []),
      },
      {
        path: "weaponProps",
        label: game.i18n.localize("PF1.WeaponProperties"),
        items: Object.entries(CONFIG.PF1.weaponProperties).reduce((cur, o) => {
          cur.push({ key: o[0], name: o[1] });
          return cur;
        }, []),
      },
      {
        path: "data.equipmentType",
        label: game.i18n.localize("PF1.EquipmentType"),
        items: Object.entries(CONFIG.PF1.equipmentTypes).reduce((cur, o) => {
          cur.push({ key: o[0], name: o[1]._label });
          return cur;
        }, []),
      },
      {
        path: "data.equipmentSubtype",
        label: game.i18n.localize("PF1.EquipmentSubtype"),
        items: Object.values(CONFIG.PF1.equipmentTypes).reduce((cur, o) => {
          cur = cur.concat((Object.entries(o).filter(i => !i[0].startsWith("_")).reduce((arr, i) => {
            if (!cur.filter(a => a.key === i[0]).length) {
              arr.push({ key: i[0], name: i[1] });
            }
            return arr;
          }, [])));
          return cur;
        }, []),
      },
      {
        path: "data.slot",
        label: game.i18n.localize("PF1.Slot"),
        items: Object.values(CONFIG.PF1.equipmentSlots).reduce((cur, o) => {
          cur = cur.concat((Object.entries(o).filter(i => !i[0].startsWith("_")).reduce((arr, i) => {
            if (!cur.filter(a => a.key === i[0]).length) {
              arr.push({ key: i[0], name: i[1] });
            }
            return arr;
          }, [])));
          return cur;
        }, []),
      },
      {
        path: "data.consumableType",
        label: game.i18n.localize("PF1.ConsumableType"),
        items: Object.entries(CONFIG.PF1.consumableTypes).reduce((cur, o) => {
          cur.push({ key: o[0], name: o[1] });
          return cur;
        }, []),
      },
      {
        path: "data.subType",
        label: game.i18n.localize("PF1.Misc"),
        items: Object.entries(CONFIG.PF1.lootTypes).reduce((cur, o) => {
          cur.push({ key: o[0], name: o[1] });
          return cur;
        }, []),
      },
    ];
  }

  _fetchBestiaryFilters() {
    this.filters = [
      {
        path: "data.details.cr.total",
        label: "CR",
        items: naturalSort(Object.keys(this.extraFilters["data.details.cr.total"]).reduce((cur, o) => {
          cur.push({ key: o, name: CR.fromNumber(o) });
          return cur;
        }, []), "name"),
      },
      {
        path: "creatureType",
        label: game.i18n.localize("PF1.CreatureType"),
        items: naturalSort(Object.entries(CONFIG.PF1.creatureTypes).reduce((cur, o) => {
          cur.push({ key: o[0], name: o[1] });
          return cur;
        }, []), "name"),
      },
      {
        path: "subTypes",
        label: game.i18n.localize("PF1.RaceSubtypePlural"),
        items: naturalSort(Object.keys(this.extraFilters["subTypes"]).reduce((cur, o) => {
          cur.push({ key: o, name: o });
          return cur;
        }, []), "name"),
      },
    ];
  }

  _fetchFeatFilters() {
    this.filters = [
      {
        path: "data.featType",
        label: game.i18n.localize("PF1.Type"),
        items: Object.entries(CONFIG.PF1.featTypes).reduce((cur, o) => {
          cur.push({ key: o[0], name: o[1] });
          return cur;
        }, []),
      },
      {
        path: "tags",
        label: game.i18n.localize("PF1.Tags"),
        items: naturalSort(Object.keys(this.extraFilters.tags).reduce((cur, o) => {
          cur.push({ key: o, name: o });
          return cur;
        }, []), "name"),
      },
      {
        path: "assocations.class",
        label: game.i18n.localize("PF1.ClassPlural"),
        items: naturalSort(Object.keys(this.extraFilters.associations["class"]).reduce((cur, o) => {
          cur.push({ key: o, name: o });
          return cur;
        }, []), "name"),
      },
    ];
  }

  _fetchClassFilters() {
    this.filters = [
      {
        path: "data.classType",
        label: game.i18n.localize("PF1.ClassType"),
        items: Object.entries(CONFIG.PF1.classTypes).reduce((cur, o) => {
          cur.push({ key: o[0], name: o[1] });
          return cur;
        }, []),
      },
      {
        path: "data.hd",
        label: game.i18n.localize("PF1.HitDie"),
        items: Object.keys(this.extraFilters["data.hd"]).reduce((cur, o) => {
          cur.push({ key: o.toString(), name: o.toString() });
          return cur;
        }, []),
      },
      {
        path: "data.bab",
        label: game.i18n.localize("PF1.BAB"),
        items: Object.entries(CONFIG.PF1.classBAB).reduce((cur, o) => {
          cur.push({ key: o[0], name: o[1] });
          return cur;
        }, []),
      },
      {
        path: "data.skillsPerLevel",
        label: game.i18n.localize("PF1.SkillsPerLevel"),
        items: Object.keys(this.extraFilters["data.skillsPerLevel"]).reduce((cur, o) => {
          cur.push({ key: o.toString(), name: o.toString() });
          return cur;
        }, []),
      },
      {
        path: "data.savingThrows.fort.value",
        label: game.i18n.localize("PF1.SavingThrowFort"),
        items: Object.entries(CONFIG.PF1.classSavingThrows).reduce((cur, o) => {
          cur.push({ key: o[0], name: o[1] });
          return cur;
        }, []),
      },
      {
        path: "data.savingThrows.ref.value",
        label: game.i18n.localize("PF1.SavingThrowRef"),
        items: Object.entries(CONFIG.PF1.classSavingThrows).reduce((cur, o) => {
          cur.push({ key: o[0], name: o[1] });
          return cur;
        }, []),
      },
      {
        path: "data.savingThrows.will.value",
        label: game.i18n.localize("PF1.SavingThrowWill"),
        items: Object.entries(CONFIG.PF1.classSavingThrows).reduce((cur, o) => {
          cur.push({ key: o[0], name: o[1] });
          return cur;
        }, []),
      },
    ];
  }

  _fetchRaceFilters() {
    this.filters = [
      {
        path: "data.creatureType",
        label: game.i18n.localize("PF1.CreatureType"),
        items: naturalSort(Object.entries(CONFIG.PF1.creatureTypes).reduce((cur, o) => {
          cur.push({ key: o[0], name: o[1] });
          return cur;
        }, []), "name"),
      },
      {
        path: "subTypes",
        label: game.i18n.localize("PF1.RaceSubtypePlural"),
        items: naturalSort(Object.keys(this.extraFilters["subTypes"]).reduce((cur, o) => {
          cur.push({ key: o, name: o });
          return cur;
        }, []), "name"),
      },
    ];
  }

  async _render(...args) {
    // benchmarkFunction(async function(...args) {
    //   await Application.prototype._render.call(this, ...args);
    await super._render(...args);

    this.filterQuery = /.*/;
    this.element.find(".filter-content").css("display", "none");
    // }.bind(this), ...args);
  }

  activateListeners(html) {
    super.activateListeners(html);

    // Open sheets
    html.find('.entry-name').click(ev => {
      let li = ev.currentTarget.parentElement;
      this._onEntry(li.getAttribute("data-collection"), li.getAttribute("data-entry-id"));
    });

    // Make compendium items draggable
    html.find('.directory-item').each((i, li) => {
      li.setAttribute("draggable", true);
      li.addEventListener('dragstart', this._onDragStart, false);
    });

    html.find('input[name="search"]').keyup(this._onFilterResults.bind(this));

    html.find('.filter input[type="checkbox"]').change(this._onActivateBooleanFilter.bind(this));

    html.find('.filter h3').click(this._toggleFilterVisibility.bind(this));

    html.find("button.refresh").click(this.refresh.bind(this));
    
    // Lazy load
    this._initLazyLoad();
  }

  /**
   * Handle opening a single compendium entry by invoking the configured entity class and its sheet
   * @private
   */
  async _onEntry(collectionKey, entryId) {
    const pack = game.packs.find(o => o.collection === collectionKey);
    const entity = await pack.getEntity(entryId);
    entity.sheet.render(true);
  }

  /**
   * Handle a new drag event from the compendium, create a placeholder token for dropping the item
   * @private
   */
  _onDragStart(event) {
    const li = this,
          packName = li.getAttribute("data-collection"),
          pack = game.packs.find(p => p.collection === packName);

    // Get the pack
    if (!pack) {
      event.preventDefault();
      return false;
    }

    // Set the transfer data
    event.dataTransfer.setData("text/plain", JSON.stringify({
      type: pack.entity,
      pack: pack.collection,
      id: li.getAttribute("data-entry-id")
    }));
  }

  _toggleFilterVisibility(event) {
    event.preventDefault();
    const title = event.currentTarget;
    const content = $(title).siblings(".filter-content")[0];

    if (content.style.display === "none") content.style.display = "block";
    else content.style.display = "none";
  }

  _onFilterResults(event) {
    event.preventDefault();
    let input = event.currentTarget;

    // Define filtering function
    let filter = query => {
      this.filterQuery = query;
      this._filterResults();
    };

    // Filter if we are done entering keys
    let query = new RegExp(RegExp.escape(input.value), "i");
    if (this._filterTimeout) {
      clearTimeout(this._filterTimeout);
      this._filterTimeout = null;
    }
    this._filterTimeout = setTimeout(() => filter(query), 100);
  }

  _onActivateBooleanFilter(event) {
    event.preventDefault();
    let input = event.currentTarget;
    const path = input.closest(".filter").dataset.path;
    const key = input.name;
    const value = input.checked;

    if (value) {
      let index = this.activeFilters[path].indexOf(key);
      if (index < 0) this.activeFilters[path].push(key);
    }
    else {
      let index = this.activeFilters[path].indexOf(key);
      if (index >= 0) this.activeFilters[path].splice(index, 1);
    }

    this._filterResults();
  }

  _filterResults() {
    this.lazyIndex = 0;
    // Hide items that don't match the filters, and show items that DO match the filters
    let itemCount = 0;
    this.element.find("li.directory-item").each((a, li) => {
      const id = li.dataset.entryId;
      const item = this._data.data.collection[id].item;
      if (this._passesFilters(item)) {
        // Show item
        if (this.lazyIndex < this.lazyStart) {
          $(li).show();
          this.lazyIndex++;
        }
        // Set item count
        itemCount++;
      }
      else $(li).hide();
    });
    this.element.find('span[data-type="filterItemCount"]').text(game.i18n.localize("PF1.FilteredItems").format(itemCount));

    // Scroll up a bit to prevent a lot of 'lazy' loading at once
    const rootElem = this.element[0].querySelector(".directory-list");
    rootElem.scrollTop = Math.max(0, rootElem.scrollTop - this.lazyLoadTreshold);
  }

  _passesFilters(item) {
    if (!this.filterQuery.test(item.name)) return false;

    for (let [path, filter] of Object.entries(this.activeFilters)) {
      if (filter.length === 0) continue;

      // Handle special cases
      // Handle Spell Level
      {
        let result = null;
        if (this.type === "spells" && path === "_spellLevel") {
          result = false;
          let hasActiveFilter = false;
          const spellLevels = this.activeFilters[path];
          const checks = [
            { path: "learnedAt.class", type: "class" },
            { path: "learnedAt.domain", type: "domain" },
            { path: "learnedAt.subDomain", type: "subDomain" },
            { path: "learnedAt.elementalSchool", type: "elementalSchool" },
            { path: "learnedAt.bloodline", type: "bloodline" },
          ];
          for (let c of checks) {
            const f = this.activeFilters[c.path];
            if (!f || !f.length) continue;
            hasActiveFilter = true;
            for (let fi of f) {
              const p = getProperty(item, `learnedAt.spellLevel.${c.type}`);
              for (let sl of spellLevels) {
                if (p[fi] === parseInt(sl)) result = true;
              }
            }
          }
          if (!hasActiveFilter) {
            for (let sl of spellLevels) {
              if (item.allSpellLevels.includes(parseInt(sl))) result = true;
            }
          }
        }
        if (result === false) return false;
        else if (result === true) continue;
      }

      // Handle the rest
      const prop = getProperty(item, path);
      if (prop == null) return false;
      if (typeof prop === "number") {
        filter = filter.map(o => parseFloat(o)).filter(o => !isNaN(o));
      }
      if (prop instanceof Array) {
        if (!filter.every(o => prop.includes(o))) return false;
        continue;
      }
      if (!filter.includes(prop)) return false;
    }

    return true;
  }
}
