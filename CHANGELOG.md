# Changelog

## 0.41

### Bug Fixes

- Actor inventories didn't show an equipment's label under certain circumstances
- An error in physical item updates
- A niche error with item attacks
- Actors weren't being slowed down by armor anymore

### Changelog

- @Grenadier added an advanced health configuration screen (many thanks!)
- A lot of feats were updated (thanks, @Og and @Krise !)
- Added 3 creatures to the bestiary

## 0.4

### Changelog

- @Xam changed up some hardcoded strings (many thanks!)
- Add an actor inventory column for GMs to set an item's identified state
- Refactored weapons' and equipments' categories, adding subcategories to them as well
  - The items compendium has been updated to reflect these changes
  - The migration will do a decent job at updating the (sub)types of these items, but sometimes it's not possible to get appropriate data from previous entries (most notably with shield subtypes)
- Added a sample macro for toggling buffs
- Add an option to automatically deduct charges from items
- Changed styling of character sheet tabs somewhat
- Add an option to adjust the base DC formula of spells, on a per-spellbook basis
- Spells dropped on an actor's sheet now start out belonging to the currently open spellbook
- Hovering over certain attributes on character sheets now shows a tooltip, where previously the intent was completely hidden (such as with alignment, deity, temp hp, etc.)

## 0.361

### Bug Fixes

- Automated HP calculation was not being done properly past level 2
- Identified weapon names were being forgotten

## 0.36

### Bug Fixes

- Blind rolls were not hidden

### Changelog

- Slightly improve styling of actor sheets with limited visibility
- Add initial support for unidentified items
  - Only GMs can toggle an item's identified state
  - Players will see an alternate name, description and price, and some info is completely missing for unidentified items
  - Actions of unidentified items are unusable by players
- Add separate carried column for actors' inventories, and a quick way to mark an item as carried/not carried.
- Add an alternate style for item names without a quantity in actors' inventories (a line through the name)
- @Grenadier added the Wounds and Vigor optional rules system (many thanks!)
- @Grenadier changed automatic hit point calculation to be slightly higher (acknowledge the fact that there's no 0 on a dice) (many thanks!)

## 0.35

### Bug Fixes

- Using spells with multiple attacks showed the spell description multiple times
- John Shetler fixed a giant oversight in the Fractional Base Bonuses optional rule system (many thanks!)

### Changelog

- Add color and texture override options to measure templates on items
- Added a dedicated field for darkvision in token configurations
  - Unlike bright vision, darkvision radius ignores the scene's darkness level, making it seem fully lit for darkvision owners (up to their darkvision radius)
  - Updated creatures in the bestiary to use darkvision instead of bright vision
- @Dorgendubal and @rectulo improved the French translation (many thanks!)

## 0.34

### Bug Fixes

- Armor Check Penalty stacked incorrectly
- Fog of War was not being loaded
- Items from hidden compendiums were visible to players in the compendium browsers
- Dexterity penalties didn't apply to flat-footed CMD
- Having multiple spell level checkboxes ticked in the compendium browser used to be an AND comparison, when it should have been an OR comparison

### Changelog

- Imported most (if not all) spells into a compendium
  - The old spells compendium is replaced
  - The spells all have a generic icon, and a lot of them don't have a damage formula or template yet when they could make use of one

## 0.33

### Changelog

- Add level requirement data fields for spells
  - Updated the spells compendium to reflect these changes
- Add compendium browsers
  - Currently only for spells, items and a bestiary, but more to come
- Creatures with a climb or swim speed now gain a +8 Racial bonus to the Climb and Swim skills, respectively, as per the core rules
- Merged the Armor, Weapons and Magic Items compendium into a single compendium
- Added a bunch of entries to the following compendiums: bestiary, spells and items

## 0.32

### Bug Fixes

- Sample macros' accidental reliance on Furnace

### Changelog

- Add Fractional Base Bonuses optional ruleset as a world setting
- Add another type of class, Racial HD, which represents a creature's racial hit die
  - Added a compendium for racial hit die
  - What little exists in the bestiary compendium has been updated to reflect this
- Classes can now have changes, similar to buffs, feats, weapons and equipment
- Added a list of all skills to classes with checkboxes to make them class skills
  - A skill is now a class skill if it's checked as a class skill on at least one of the actor's classes
  - Updated all classes in the classes compendium to reflect these changes
- Add option for items with actions (like spells and attacks) to have an associated measure template
  - When using the attack or spell, you get an option on whether you want to automatically insert the template
- Add option to ignore arcane spell failure, on a per-spellbook basis

## 0.311

### Bug Fixes

- Character sheet glitch with incorrect class type set

## 0.31

### Bug Fixes

- Freeze on adding/removing items to/from unlinked tokens

### Changelog

- Improved existing sample macros
- Added a journal compendium for conditions
- Shows a warning on character sheets without a class, indicating that some attributes require one
- Add option for natural attacks on whether it's a primary or secondary attack, and apply penalties as appropriate

## 0.302

### Bug Fixes

- Error with actor sheets in certain circumstances, causing them to not update

## 0.301

### Changelog

- Increased the compatible core version so that it works with FoundryVTT 0.5.5

## 0.3

### Bug Fixes

- Rectangle and ray measurements using too strict snapping

### Changelog

- Allow rolling initiative without combat
- Add another type of NPC sheet, which only shows inventory (useful for party loot tracking, for example)
- Automate scaling of BAB and Saving Throws with class levels (NOTE: you'll have to re-enter that info on your existing classes, one time only)
- Add a german translation (thanks, arwec!)
- Add a french translation (thanks, rectulo!)

## 0.26

### Bug Fixes

- Only base strength was used for calculating carrying capacity.
- Item changes with wrong formulas crashing/locking the actor's updates
- Delay with encumbrance penalties rolling in
- Low-light Vision always on under certain circumstances for players with multiple owned tokens

### Changelog

- Add power attack option to attack rolls, and show their dialog by default (shift-click or right-click to circumvent dialog)
- Add world setting to change low-light vision behaviour for players

## 0.25

### Bug Fixes

- Error with looking up fly maneuverability

### Changelog

- Turned most of the hardcoded UI text into translatable strings
- Generate spell descriptions automatically (will require some re-editing of spells)
- Updated spells compendium to reflect spell changes

## 0.24

### Bug Fixes

- Actor permissions not updating without a page refresh

### Changelog

- Add more movement types, and automate movement speedt totals based on encumbrance and armor
- Automation of spell slot count (you'll have to re-enter your casters' spell slot count for this update)
- Add lite version of the NPC sheet, which is meant to be used alongside an NPC stat block, and only shows the bare minimum
- Added a bunch of feats to their compendium, thanks to Amakiir (some icons still missing, for now)

## 0.23.2 (Shameful Emergency Update 2)

### Bug Fixes

- Certain actor data not updating

## 0.23.1 (Emergency Update)

### Bug Fixes

- Certain elements (textareas) on item sheets not updating
- Saving throw butons on efense chat cards for unlinked tokens not working
- Certain actor data not updating

## 0.23

### Bug Fixes

- Carrying capacity for creatures small than medium with low strength
- Glitch with token with deleted actor
- Duplicate effect notes on multi attacks
- Missing attack notes on attacks
- Glitch with buff/change flags
- Unlinked tokens not updating with item changes
- Features as item resources sometimes not working
- Level Drain not subtracting hit points

### Changelog

- Add world options to automatically calculate class hit points
- Add or update items in the following compendiums:
  - Classes (added NPC classes)
  - Weapons (fixed description for Shortbows)
  - Spells (unticked SR flag and removed saving throw)
- Add the following compendiums:
  - Bestiary
  - Sample Macros
  - Roll Tables
- Show more info on defense chat logs, including buttons to roll saving throws
- A slight performance increase in actor and owned item sheets
- Remove sound effect from showing defenses

## 0.22

### Bug Fixes

- Defenses not showing with auto collapsing chat cards enabled
- Certain properties not working on inline rolls in chat logs (like @item.level on a buff)
- Item macros with duplicate names (you need to re-add item macros for this to work correctly)
- Restrict access on certain actor functions (so players can't roll an NPC's skill checks in a macro, for example)

### Changelog

- Add or update some items to the following compendiums:
  - Magic Items
  - Common Buffs
- Add macro'able function to show an actor's defenses as a chatlog (game.pf1.rollDefenses()) (see [documentation](https://furyspark.gitlab.io/foundryvtt-pathfinder1-doc/advanced/macros/))

## 0.21

### Bug Fixes

- Inability to delete custom skills and subskills
- Bug with quadruped actors
- Scrolling issue on skill pages
- Unformatted inline rolls in item chat logs

### Changelog

- Add a button to show static defenses

## 0.2002

### Changelog

- Add weapon range
- Automatically fill out more slots when creating an attack: attack ability,
damage ability, damage ability multiplier, action type and action range
- Speed up actor sheets slightly
- Add ability to change loot item subtypes
- Fix measurement tools (cone and circle) to be more Pathfinder rule-friendly
- Support inline rolls for item roll messages
- Add compendiums for armor, weapons and magic items
