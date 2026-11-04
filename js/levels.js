/* ---------------------------------------------------------------
 * Zombie Hunter: Survival — mission data
 *
 * These are the ORIGINAL six stages from the GameSnacks build
 * (https://gamesnacks.com/games/6ctmcm40nbff0), translated straight
 * from the extracted level tables (zh_orig_assets/extracted_levels):
 *
 *   - every wave, its enemy type, frequency, concurrent cap, total cap,
 *     start time and duration is the original value
 *   - the original tables use MILLISECONDS; this file uses seconds
 *     (the engine clocks in seconds), so 120000 -> 120
 *   - boss zones keep their exact rect size and boss list
 *   - rewards and the per-stage multiplier are the originals
 *   - timeToTreasure is the treasure-chest timer (15 s), NOT the win
 *     condition; a stage is won by surviving TIME_LEVEL_COMPLETED
 *
 * Do not 'rebalance' this file — it is the real content.
 * --------------------------------------------------------------- */
(function (global) {
  'use strict';
  var ZH = global.ZH = global.ZH || {};

  // 20-minute survival, copied from TIME_LEVEL_COMPLETED = 1,200,000 ms
  var TIME_LEVEL_COMPLETED = 1200;
  ZH.TIME_LEVEL_COMPLETED = TIME_LEVEL_COMPLETED;

  // chapter grouping is only used by the briefing header
  var CHAPTERS = [
    { id: 1, name: 'THE STREETS', stages: [0, 1] },
    { id: 2, name: 'THE FACTORY', stages: [2, 3] },
    { id: 3, name: 'THE HOSPITAL', stages: [4] },
    { id: 4, name: 'THE ROOFTOPS', stages: [5] }
  ];
  ZH.CHAPTERS = CHAPTERS;

  var STAGES = [
    {
      id: 0, name: "Stage 1", tile: "street", bg: "bg1", map: "map_lv1.png",
      multiplier: 1, timeToTreasure: 15,
      rewards: [1000,1500,2500],
      waves: [
        { enemy:"zombieA", freq:"LOW", max:20, startTime:0, duration:120 },
        { enemy:"zombieA", freq:"MID", max:50, startTime:120, duration:120 },
        { enemy:"zombieA", freq:"HI", max:100, startTime:240, duration:60 },
        { enemy:"zombieA", freq:"LOW", max:20, startTime:300, duration:240 },
        { enemy:"builder", freq:"HI", max:200, startTime:540, duration:60 },
        { bosses:[{"type":"boss_soldier"}], bossZone:{"type":"rect","width":1200,"height":1200}, startTime:600, duration:30 },
        { enemy:"zombieB", freq:"LOW", max:20, startTime:0, duration:120 },
        { enemy:"zombieB", freq:"MID", max:50, startTime:120, duration:120 },
        { enemy:"zombieB", freq:"HI", max:100, startTime:240, duration:60 },
        { enemy:"zombieB", freq:"LOW", max:20, startTime:300, duration:240 },
        { enemy:"reptile", freq:"HI", max:20, total:200, startTime:540, duration:60 },
        { enemy:"zombieC", freq:"LOW", max:20, startTime:0, duration:120 },
        { enemy:"zombieC", freq:"MID", max:50, startTime:120, duration:120 },
        { enemy:"zombieC", freq:"HI", max:100, startTime:240, duration:60 },
        { enemy:"zombieC", freq:"LOW", max:20, startTime:300, duration:120 },
        { enemy:"builder", freq:"HI", max:100, startTime:420, duration:120 },
        { enemy:"bat", freq:"MID", max:100, startTime:570, duration:30 },
        { enemy:"zombieD", freq:"LOW", max:20, startTime:0, duration:120 },
        { enemy:"zombieD", freq:"MID", max:50, startTime:120, duration:120 },
        { enemy:"zombieD", freq:"HI", max:100, startTime:240, duration:60 },
        { enemy:"zombieD", freq:"LOW", max:20, startTime:300, duration:120 },
        { enemy:"cop", freq:"LOW", max:10, total:50, startTime:450, duration:30 },
        { enemy:"miniboss_builder", freq:"LOW", max:1, total:1, startTime:480, duration:30 },
        { enemy:"bat", freq:"MID", max:50, startTime:510, duration:30 },
        { enemy:"bat", freq:"LOW", max:10, total:50, startTime:30, duration:30 },
        { enemy:"cop", freq:"LOW", max:5, total:30, startTime:60, duration:30 },
        { enemy:"reptile", freq:"LOW", max:5, total:50, startTime:90, duration:30 },
        { enemy:"cop", freq:"LOW", max:10, total:50, startTime:150, duration:30 },
        { enemy:"miniboss_reptile", freq:"LOW", max:1, total:1, startTime:180, duration:30 },
        { enemy:"bat", freq:"MID", max:50, startTime:270, duration:30 },
        { enemy:"builder", freq:"MID", max:50, startTime:300, duration:120 },
        { bosses:[{"type":"boss_tower"}], bossZone:{"type":"rect","width":1200,"height":1200}, startTime:300, duration:30 },
        { enemy:"cop", freq:"MID", max:10, total:100, startTime:360, duration:60 }
      ]
    },

    {
      id: 1, name: "Stage 2", tile: "street", bg: "bg2", map: "map_lv2.png",
      multiplier: 1.5, timeToTreasure: 15,
      rewards: [2000,3000,5000],
      waves: [
        { enemy:"zombieA", freq:"LOW", max:25, startTime:0, duration:60 },
        { enemy:"zombieA", freq:"MID", max:50, startTime:60, duration:180 },
        { enemy:"zombieA", freq:"HI", max:75, startTime:240, duration:60 },
        { enemy:"zombieA", freq:"LOW", max:25, startTime:300, duration:240 },
        { enemy:"builder", freq:"MID", max:50, startTime:540, duration:60 },
        { bosses:[{"type":"boss_dragon"}], bossZone:{"type":"rect","width":1024,"height":1024}, startTime:600, duration:30 },
        { enemy:"zombieB", freq:"LOW", max:25, startTime:0, duration:60 },
        { enemy:"zombieB", freq:"MID", max:50, startTime:60, duration:180 },
        { enemy:"zombieB", freq:"HI", max:75, startTime:240, duration:60 },
        { enemy:"zombieB", freq:"LOW", max:25, startTime:300, duration:240 },
        { enemy:"spider1", freq:"MID", max:50, startTime:540, duration:60 },
        { enemy:"zombieC", freq:"LOW", max:25, startTime:0, duration:60 },
        { enemy:"zombieC", freq:"MID", max:50, startTime:60, duration:180 },
        { enemy:"reptile", freq:"HI", max:75, startTime:240, duration:60 },
        { enemy:"spider1", freq:"MID", max:75, startTime:300, duration:60 },
        { enemy:"spider1", freq:"HI", max:150, startTime:360, duration:90 },
        { enemy:"spider2", freq:"HI", max:150, startTime:450, duration:150 },
        { enemy:"zombieD", freq:"LOW", max:25, startTime:0, duration:60 },
        { enemy:"zombieD", freq:"MID", max:50, startTime:60, duration:60 },
        { enemy:"builder", freq:"MID", max:25, startTime:120, duration:180 },
        { bosses:[{"type":"boss_reptile"}], bossZone:{"type":"rect","width":1024,"height":1024}, startTime:300, duration:30 },
        { enemy:"bat", freq:"HI", max:20, startTime:330, duration:30 },
        { enemy:"reptile", freq:"HI", max:50, startTime:390, duration:30 },
        { enemy:"miniboss_fighter", freq:"LOW", max:1, total:1, startTime:420, duration:30 },
        { enemy:"miniboss_spider", freq:"LOW", max:1, total:1, startTime:480, duration:30 },
        { enemy:"bat", freq:"MID", max:15, total:60, startTime:510, duration:30 },
        { enemy:"reptile", freq:"HI", max:50, startTime:540, duration:60 },
        { enemy:"manager", freq:"LOW", max:5, startTime:30, duration:150 },
        { enemy:"miniboss_builder", freq:"LOW", max:1, total:1, startTime:180, duration:30 },
        { enemy:"bat", freq:"HI", max:50, startTime:210, duration:60 },
        { enemy:"manager", freq:"LOW", max:5, total:30, startTime:270, duration:30 },
        { enemy:"bat", freq:"MID", max:50, startTime:570, duration:30 },
        { enemy:"reptile", freq:"LOW", max:10, total:50, startTime:90, duration:30 },
        { enemy:"cop", freq:"LOW", max:5, total:20, startTime:150, duration:30 },
        { enemy:"miniboss_reptile", freq:"LOW", max:1, total:1, startTime:240, duration:30 }
      ]
    },

    {
      id: 2, name: "Stage 3", tile: "factory", bg: "bg3", map: "map_lv3.png",
      multiplier: 2.25, timeToTreasure: 15,
      rewards: [3000,4500,7500],
      waves: [
        { enemy:"zombieA", freq:"LOW", max:25, startTime:0, duration:180 },
        { enemy:"zombieD", freq:"LOW", max:30, startTime:180, duration:120 },
        { enemy:"zombieA", freq:"LOW", max:50, startTime:300, duration:60 },
        { enemy:"zombieB", freq:"LOW", max:50, startTime:360, duration:60 },
        { enemy:"zombieC", freq:"LOW", max:50, startTime:420, duration:60 },
        { enemy:"zombieD", freq:"LOW", max:50, startTime:480, duration:60 },
        { enemy:"builder", freq:"LOW", max:100, startTime:540, duration:60 },
        { bosses:[{"type":"boss_mutant"}], bossZone:{"type":"rect","width":1000,"height":1000}, startTime:600, duration:30 },
        { enemy:"zombieB", freq:"LOW", max:25, startTime:0, duration:120 },
        { enemy:"zombieC", freq:"LOW", max:30, startTime:120, duration:180 },
        { enemy:"builder", freq:"LOW", max:60, startTime:300, duration:60 },
        { enemy:"builder", freq:"LOW", max:70, startTime:360, duration:60 },
        { enemy:"builder", freq:"LOW", max:80, startTime:420, duration:60 },
        { enemy:"builder", freq:"LOW", max:90, startTime:480, duration:60 },
        { enemy:"spider1", freq:"MID", max:50, startTime:540, duration:60 },
        { enemy:"toxic1", freq:"LOW", max:25, startTime:0, duration:90 },
        { enemy:"toxic1", freq:"MID", max:50, startTime:90, duration:120 },
        { enemy:"reptile", freq:"HI", max:100, startTime:210, duration:90 },
        { enemy:"manager", freq:"LOW", max:10, startTime:300, duration:60 },
        { enemy:"slime2", freq:"HI", max:50, startTime:360, duration:90 },
        { enemy:"spider2", freq:"HI", max:150, startTime:450, duration:150 },
        { enemy:"slime1", freq:"LOW", max:25, startTime:30, duration:90 },
        { enemy:"toxic2", freq:"MID", max:25, startTime:120, duration:120 },
        { enemy:"spider1", freq:"MID", max:50, startTime:240, duration:60 },
        { bosses:[{"type":"boss_spider"}], bossZone:{"type":"rect","width":1200,"height":1000}, startTime:300, duration:30 },
        { enemy:"cop", freq:"LOW", max:10, startTime:330, duration:30 },
        { enemy:"spider1", freq:"HI", max:150, startTime:390, duration:60 },
        { enemy:"miniboss_spider", freq:"LOW", max:2, total:2, startTime:480, duration:30 },
        { enemy:"toxic2", freq:"MID", max:50, startTime:510, duration:90 },
        { enemy:"reptile", freq:"MID", max:50, startTime:60, duration:30 },
        { enemy:"cop", freq:"LOW", max:5, total:20, startTime:90, duration:30 },
        { enemy:"miniboss_toxic1", freq:"LOW", max:2, total:2, startTime:180, duration:30 },
        { enemy:"miniboss_reptile", freq:"LOW", max:2, total:2, startTime:240, duration:30 },
        { enemy:"miniboss_fighter", freq:"LOW", max:2, total:2, startTime:420, duration:30 },
        { enemy:"manager", freq:"LOW", max:10, startTime:540, duration:60 },
        { enemy:"cop", freq:"LOW", max:10, startTime:570, duration:30 }
      ]
    },

    {
      id: 3, name: "Stage 4", tile: "factory", bg: "bg4", map: "map_lv4.png",
      multiplier: 3.5, timeToTreasure: 15,
      rewards: [4000,6000,10000],
      waves: [
        { enemy:"zombieA", freq:"LOW", max:30, startTime:0, duration:120 },
        { enemy:"zombieA", freq:"MID", max:50, startTime:120, duration:180 },
        { enemy:"zombieA", freq:"LOW", max:50, startTime:300, duration:60 },
        { enemy:"zombieB", freq:"LOW", max:50, startTime:360, duration:60 },
        { enemy:"zombieC", freq:"LOW", max:50, startTime:420, duration:60 },
        { enemy:"zombieD", freq:"LOW", max:50, startTime:480, duration:60 },
        { enemy:"reptile", freq:"HI", max:100, startTime:540, duration:60 },
        { bosses:[{"type":"boss_reptile"},{"type":"boss_dragon"}], bossZone:{"type":"rect","width":1950,"height":1950}, startTime:300, duration:30 },
        { enemy:"zombieB", freq:"LOW", max:30, startTime:0, duration:120 },
        { enemy:"zombieB", freq:"LOW", max:50, startTime:120, duration:180 },
        { enemy:"builder", freq:"LOW", max:100, startTime:300, duration:90 },
        { enemy:"spider1", freq:"HI", max:150, startTime:390, duration:60 },
        { enemy:"spider2", freq:"HI", max:150, startTime:450, duration:150 },
        { enemy:"zombieC", freq:"LOW", max:30, startTime:0, duration:120 },
        { enemy:"zombieC", freq:"LOW", max:50, startTime:120, duration:120 },
        { enemy:"reptile", freq:"HI", max:100, startTime:240, duration:60 },
        { enemy:"slime2", freq:"MID", max:50, startTime:300, duration:60 },
        { enemy:"slug", freq:"MID", max:50, startTime:360, duration:120 },
        { enemy:"slug", freq:"HI", max:75, startTime:480, duration:120 },
        { enemy:"zombieD", freq:"LOW", max:30, startTime:0, duration:120 },
        { enemy:"zombieD", freq:"LOW", max:50, startTime:120, duration:120 },
        { enemy:"spider1", freq:"MID", max:50, startTime:240, duration:60 },
        { enemy:"cop", freq:"LOW", max:15, startTime:330, duration:90 },
        { enemy:"miniboss_fighter", freq:"LOW", max:1, total:1, startTime:420, duration:30 },
        { enemy:"bat", freq:"HI", max:100, startTime:450, duration:30 },
        { enemy:"miniboss_toxic2", freq:"LOW", max:1, total:1, startTime:480, duration:30 },
        { enemy:"spider1", freq:"HI", max:50, startTime:510, duration:90 },
        { enemy:"slime1", freq:"LOW", max:30, startTime:0, duration:120 },
        { enemy:"slime2", freq:"MID", max:50, startTime:120, duration:120 },
        { enemy:"slime2", freq:"HI", max:75, startTime:240, duration:60 },
        { enemy:"miniboss_toxic1", freq:"LOW", max:1, total:1, startTime:420, duration:30 },
        { enemy:"miniboss_spider", freq:"LOW", max:1, total:1, startTime:480, duration:30 },
        { enemy:"bat", freq:"HI", max:100, startTime:570, duration:30 },
        { enemy:"bat", freq:"MID", max:50, startTime:30, duration:30 },
        { enemy:"reptile", freq:"HI", max:100, startTime:60, duration:30 },
        { enemy:"cop", freq:"LOW", max:10, startTime:90, duration:30 },
        { enemy:"toxic1", freq:"MID", max:30, startTime:150, duration:30 },
        { enemy:"miniboss_toxic1", freq:"LOW", max:1, total:1, startTime:180, duration:30 },
        { enemy:"toxic2", freq:"MID", max:30, startTime:210, duration:60 },
        { enemy:"bat", freq:"HI", max:100, startTime:270, duration:30 },
        { enemy:"miniboss_reptile", freq:"LOW", max:1, total:1, startTime:180, duration:30 },
        { enemy:"miniboss_toxic2", freq:"LOW", max:1, total:1, startTime:240, duration:30 },
        { bosses:[{"type":"boss_spider"},{"type":"boss_mutant"}], bossZone:{"type":"rect","width":1950,"height":1950}, startTime:600, duration:30 }
      ]
    },

    {
      id: 4, name: "Stage 5", tile: "hospital", bg: "bg5", map: "map_lv5.png",
      multiplier: 4.75, timeToTreasure: 15,
      rewards: [5000,7500,12500],
      waves: [
        { enemy:"zombieA", freq:"LOW", max:30, startTime:0, duration:120 },
        { enemy:"zombieA", freq:"MID", max:50, startTime:120, duration:180 },
        { enemy:"zombieA", freq:"LOW", max:50, startTime:300, duration:60 },
        { enemy:"zombieB", freq:"LOW", max:50, startTime:360, duration:60 },
        { enemy:"zombieC", freq:"LOW", max:50, startTime:420, duration:60 },
        { enemy:"zombieD", freq:"LOW", max:50, startTime:480, duration:60 },
        { enemy:"spider1", freq:"HI", max:200, startTime:540, duration:60 },
        { bosses:[{"type":"boss_tower"},{"type":"boss_soldier"}], bossZone:{"type":"rect","width":1600,"height":1600}, startTime:600, duration:30 },
        { enemy:"zombieB", freq:"LOW", max:30, startTime:0, duration:120 },
        { enemy:"zombieB", freq:"LOW", max:50, startTime:120, duration:180 },
        { enemy:"builder", freq:"LOW", max:100, startTime:300, duration:60 },
        { enemy:"builder", freq:"MID", max:150, startTime:360, duration:60 },
        { enemy:"spider1", freq:"HI", max:200, startTime:420, duration:60 },
        { enemy:"spider2", freq:"HI", max:200, startTime:480, duration:120 },
        { enemy:"zombieC", freq:"LOW", max:30, startTime:0, duration:120 },
        { enemy:"zombieC", freq:"LOW", max:50, startTime:120, duration:120 },
        { enemy:"reptile", freq:"HI", max:200, startTime:240, duration:60 },
        { enemy:"tower1", freq:"HI", max:20, startTime:300, duration:120 },
        { enemy:"tower1", freq:"LOW", max:10, startTime:420, duration:180 },
        { enemy:"zombieD", freq:"LOW", max:30, startTime:0, duration:120 },
        { enemy:"zombieD", freq:"LOW", max:50, startTime:120, duration:90 },
        { enemy:"spider1", freq:"MID", max:50, startTime:210, duration:90 },
        { enemy:"assault1", freq:"LOW", max:10, startTime:300, duration:90 },
        { enemy:"assault2", freq:"LOW", max:10, startTime:390, duration:120 },
        { enemy:"slug", freq:"HI", max:50, startTime:510, duration:90 },
        { enemy:"tower1", freq:"LOW", max:10, startTime:0, duration:120 },
        { enemy:"tower1", freq:"MID", max:15, startTime:120, duration:120 },
        { enemy:"miniboss_reptile", freq:"LOW", max:3, total:3, startTime:240, duration:30 },
        { enemy:"bat", freq:"HI", max:100, startTime:270, duration:30 },
        { bosses:[{"type":"boss_tower"},{"type":"boss_reptile"}], bossZone:{"type":"rect","width":1600,"height":1600}, startTime:300, duration:30 },
        { enemy:"bat", freq:"HI", max:75, startTime:330, duration:30 },
        { enemy:"miniboss_builder", freq:"LOW", max:1, total:1, startTime:360, duration:30 },
        { enemy:"miniboss_fighter", freq:"LOW", max:2, total:2, startTime:420, duration:30 },
        { enemy:"miniboss_spider", freq:"LOW", max:1, total:1, startTime:480, duration:30 },
        { enemy:"reptile", freq:"LOW", max:10, startTime:0, duration:120 },
        { enemy:"reptile", freq:"HI", max:150, startTime:120, duration:120 },
        { enemy:"miniboss_toxic1", freq:"LOW", max:2, total:2, startTime:480, duration:30 },
        { enemy:"bat", freq:"MID", max:75, startTime:30, duration:30 },
        { enemy:"cop", freq:"LOW", max:15, startTime:60, duration:30 },
        { enemy:"manager", freq:"LOW", max:15, startTime:90, duration:30 },
        { enemy:"miniboss_reptile", freq:"LOW", max:1, total:1, startTime:120, duration:30 },
        { enemy:"bat", freq:"MID", max:50, startTime:150, duration:30 },
        { enemy:"miniboss_reptile", freq:"LOW", max:2, total:2, startTime:180, duration:30 }
      ]
    },

    {
      id: 5, name: "Stage 6", tile: "rooftop", bg: "bg6", map: "map_lv6.png",
      multiplier: 7.61, timeToTreasure: 15,
      rewards: [6000,9000,15000],
      waves: [
        { enemy:"zombieA", freq:"LOW", max:20, startTime:0, duration:120 },
        { enemy:"zombieA", freq:"MID", max:40, startTime:120, duration:180 },
        { enemy:"zombieA", freq:"LOW", max:50, startTime:300, duration:60 },
        { enemy:"zombieB", freq:"LOW", max:50, startTime:360, duration:60 },
        { enemy:"zombieC", freq:"LOW", max:50, startTime:420, duration:60 },
        { enemy:"zombieD", freq:"LOW", max:50, startTime:480, duration:60 },
        { enemy:"spider1", freq:"HI", max:100, startTime:540, duration:60 },
        { bosses:[{"type":"boss_mutant"},{"type":"boss_soldier"}], bossZone:{"type":"rect","width":1024,"height":1600}, startTime:600, duration:30 },
        { enemy:"zombieB", freq:"LOW", max:20, startTime:0, duration:120 },
        { enemy:"zombieB", freq:"LOW", max:40, startTime:120, duration:180 },
        { enemy:"spider1", freq:"LOW", max:100, startTime:300, duration:60 },
        { enemy:"spider1", freq:"MID", max:150, startTime:360, duration:60 },
        { enemy:"spider1", freq:"HI", max:200, startTime:420, duration:60 },
        { enemy:"spider2", freq:"HI", max:300, startTime:480, duration:120 },
        { enemy:"zombieC", freq:"LOW", max:20, startTime:0, duration:120 },
        { enemy:"zombieC", freq:"LOW", max:40, startTime:120, duration:120 },
        { enemy:"toxic1", freq:"HI", max:200, startTime:240, duration:60 },
        { enemy:"tower1", freq:"HI", max:20, startTime:300, duration:120 },
        { enemy:"tower1", freq:"LOW", max:10, startTime:420, duration:180 },
        { enemy:"zombieD", freq:"LOW", max:20, startTime:0, duration:120 },
        { enemy:"zombieD", freq:"LOW", max:40, startTime:120, duration:90 },
        { enemy:"toxic2", freq:"MID", max:100, startTime:210, duration:90 },
        { enemy:"tower2", freq:"LOW", max:5, startTime:300, duration:120 },
        { enemy:"tower2", freq:"LOW", max:10, startTime:420, duration:180 },
        { enemy:"tower1", freq:"LOW", max:10, startTime:0, duration:120 },
        { enemy:"tower1", freq:"LOW", max:10, startTime:120, duration:120 },
        { enemy:"tower1", freq:"LOW", max:15, startTime:240, duration:60 },
        { enemy:"cop", freq:"LOW", max:10, startTime:300, duration:120 },
        { enemy:"miniboss_soldier", freq:"LOW", max:1, total:1, startTime:420, duration:30 },
        { enemy:"toxic2", freq:"HI", max:100, startTime:450, duration:30 },
        { enemy:"miniboss_tower", freq:"LOW", max:1, total:1, startTime:480, duration:30 },
        { enemy:"slug", freq:"HI", max:50, startTime:510, duration:90 },
        { enemy:"bat", freq:"LOW", max:15, startTime:0, duration:120 },
        { enemy:"tower2", freq:"LOW", max:5, startTime:120, duration:120 },
        { enemy:"tower2", freq:"LOW", max:10, startTime:240, duration:60 },
        { bosses:[{"type":"boss_spider"},{"type":"boss_dragon"}], bossZone:{"type":"rect","width":1024,"height":1600}, startTime:300, duration:30 },
        { enemy:"assault1", freq:"LOW", max:10, startTime:330, duration:30 },
        { enemy:"miniboss_spider", freq:"LOW", max:1, total:1, startTime:360, duration:30 },
        { enemy:"assault2", freq:"LOW", max:10, startTime:390, duration:30 },
        { enemy:"miniboss_spider", freq:"LOW", max:1, total:1, startTime:420, duration:30 },
        { enemy:"miniboss_spider", freq:"LOW", max:1, total:1, startTime:480, duration:30 },
        { enemy:"miniboss_spider", freq:"LOW", max:1, total:1, startTime:540, duration:30 },
        { enemy:"cop", freq:"LOW", max:10, startTime:30, duration:30 },
        { enemy:"assault1", freq:"LOW", max:5, total:5, startTime:60, duration:30 },
        { enemy:"assault2", freq:"LOW", max:5, total:5, startTime:90, duration:30 },
        { enemy:"assault1", freq:"LOW", max:5, total:5, startTime:120, duration:30 },
        { enemy:"assault2", freq:"LOW", max:5, total:5, startTime:150, duration:30 },
        { enemy:"miniboss_soldier", freq:"LOW", max:1, total:1, startTime:180, duration:30 },
        { enemy:"miniboss_toxic1", freq:"LOW", max:2, total:2, startTime:240, duration:30 },
        { enemy:"miniboss_toxic2", freq:"LOW", max:1, total:1, startTime:480, duration:30 },
        { enemy:"miniboss_fighter", freq:"LOW", max:1, total:1, startTime:120, duration:30 },
        { enemy:"miniboss_toxic1", freq:"LOW", max:1, total:1, startTime:180, duration:30 },
        { enemy:"miniboss_toxic2", freq:"LOW", max:1, total:1, startTime:240, duration:30 }
      ]
    }
  ];

  ZH.STAGES = STAGES;
  // name the build uses elsewhere for the campaign
  ZH.LEVELS = STAGES;

  ZH.levelById = function (id) {
    for (var i = 0; i < STAGES.length; i++) {
      if (STAGES[i].id === id) return STAGES[i];
    }
    return STAGES[0];
  };

  ZH.CAMPAIGN_COUNT = STAGES.length;

  // which chapter a stage belongs to (briefing header)
  ZH.chapterOf = function (stage) {
    for (var i = 0; i < CHAPTERS.length; i++) {
      if (CHAPTERS[i].stages.indexOf(stage.id) !== -1) return CHAPTERS[i];
    }
    return CHAPTERS[0];
  };

  // every enemy type a stage can spawn (briefing 'horde' line)
  ZH.stageRoster = function (stage) {
    var seen = {}, out = [];
    (stage.waves || []).forEach(function (w) {
      if (w.enemy && !seen[w.enemy]) { seen[w.enemy] = 1; out.push(w.enemy); }
      if (w.bosses) w.bosses.forEach(function (b) {
        if (b && b.type && !seen[b.type]) { seen[b.type] = 1; out.push(b.type); }
      });
    });
    return out;
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = ZH;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
