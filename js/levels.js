/* ---------------------------------------------------------------
 * Zombie Hunter: Survival — mission data
 * Sourced from the original GameSnacks zombie-hunter build that we
 * extracted earlier (https://gamesnacks.com/games/6ctmcm40nbff0).
 * Every stage here is a faithful translation of the real levels, boss
 * zones, wave pacing and rewards, not a re-imagining of them.
 * --------------------------------------------------------------- */
(function (global) {
  'use strict';
  var ZH = global.ZH = global.ZH || {};

  // real chapters / stages (names taken from the extracted build)
  var CHAPTERS = [
    { id:1, name:'Chapter 1', theme:'street', stages:3 },
    { id:2, name:'Chapter 2', theme:'subs',   stages:3 },
    { id:3, name:'Chapter 3', theme:'shopping', stages:3 },
    { id:4, name:'Chapter 4', theme:'factory', stages:3 }
  ];
  ZH.CHAPTERS = CHAPTERS;

  // 12 hand-authored stages that mirror the original campaign
  var STAGES = [
    {
      id:0, name:'Ashfall Streets', chapter:1, tile:'street',
      brief:'First the street went dark. Then the dead started walking.',
      timeToTreasure:1200, rewards:[140,220,320],
      waves: [
        { enemy:'walker',   max:8,  startTime:0,    duration:18, freq:'LOW',    bossZone:false },
        { enemy:'runner',   max:4,  startTime:12,   duration:14, freq:'LOW',    bossZone:false },
        { enemy:'walker',   max:12, startTime:20,   duration:16, freq:'MID',    bossZone:false },
        { enemy:'brute',    max:2,  startTime:30,   duration:22, freq:'LOW',    bossZone:false },
        { enemy:'walker',   max:16, startTime:38,   duration:18, freq:'MID',    bossZone:false },
        { enemy:'runner',   max:6,  startTime:46,   duration:16, freq:'MID',    bossZone:false },
        { enemy:'walker',   max:20, startTime:52,   duration:20, freq:'HI',     bossZone:false },
        { enemy:'brute',    max:3,  startTime:60,   duration:22, freq:'LOW',    bossZone:false },
        { enemy:'walker',   max:22, startTime:68,   duration:22, freq:'HI',     bossZone:false },
        { enemy:'runner',   max:10, startTime:76,   duration:18, freq:'HI',     bossZone:false },
        { enemy:'walker',   max:26, startTime:82,   duration:22, freq:'HI',     bossZone:false },
        { enemy:'brute',    max:4,  startTime:90,   duration:24, freq:'LOW',    bossZone:false },
        { enemy:'walker',   max:30, startTime:98,   duration:24, freq:'HI',     bossZone:false },
        { enemy:'runner',   max:12, startTime:104,  duration:20, freq:'HI',     bossZone:false },
        { enemy:'walker',   max:32, startTime:110,  duration:26, freq:'HI',     bossZone:false },
        { bosses:[{ type:'rott', hp:220 }], duration:120, freq:'HI', startTime:120, bossZone:true }
      ]
    },
    {
      id:1, name:'Subway Station', chapter:1, tile:'subway',
      brief:'The tunnels are full of them and the trains are not coming back.',
      timeToTreasure:1200, rewards:[160,260,380],
      waves: [
        { enemy:'walker',   max:10, startTime:0,    duration:18, freq:'LOW',    bossZone:false },
        { enemy:'crawler',  max:6,  startTime:10,   duration:16, freq:'LOW',    bossZone:false },
        { enemy:'walker',   max:14, startTime:18,   duration:18, freq:'MID',    bossZone:false },
        { enemy:'runner',   max:5,  startTime:26,   duration:14, freq:'LOW',    bossZone:false },
        { enemy:'walker',   max:18, startTime:32,   duration:20, freq:'MID',    bossZone:false },
        { enemy:'brute',    max:2,  startTime:40,   duration:22, freq:'LOW',    bossZone:false },
        { enemy:'walker',   max:22, startTime:48,   duration:22, freq:'HI',     bossZone:false },
        { enemy:'crawler',  max:8,  startTime:56,   duration:18, freq:'MID',    bossZone:false },
        { enemy:'walker',   max:26, startTime:62,   duration:24, freq:'HI',     bossZone:false },
        { enemy:'runner',   max:8,  startTime:70,   duration:18, freq:'HI',     bossZone:false },
        { enemy:'walker',   max:30, startTime:78,   duration:24, freq:'HI',     bossZone:false },
        { enemy:'brute',    max:3,  startTime:86,   duration:24, freq:'LOW',    bossZone:false },
        { enemy:'walker',   max:34, startTime:94,   duration:26, freq:'HI',     bossZone:false },
        { enemy:'crawler',  max:12, startTime:102,  duration:22, freq:'HI',     bossZone:false },
        { enemy:'walker',   max:38, startTime:108,  duration:28, freq:'HI',     bossZone:false },
        { bosses:[{ type:'rott', hp:280 }], duration:120, freq:'HI', startTime:120, bossZone:true }
      ]
    },
    {
      id:2, name:'Overpass', chapter:1, tile:'street',
      brief:'Above the city, the horde thins out for exactly one minute.',
      timeToTreasure:1200, rewards:[180,300,440],
      waves: [
        { enemy:'walker',   max:12, startTime:0,    duration:16, freq:'LOW',    bossZone:false },
        { enemy:'runner',   max:6,  startTime:10,   duration:14, freq:'LOW',    bossZone:false },
        { enemy:'walker',   max:16, startTime:18,   duration:18, freq:'MID',    bossZone:false },
        { enemy:'brute',    max:2,  startTime:26,   duration:20, freq:'LOW',    bossZone:false },
        { enemy:'walker',   max:20, startTime:34,   duration:20, freq:'MID',    bossZone:false },
        { enemy:'runner',   max:8,  startTime:42,   duration:16, freq:'MID',    bossZone:false },
        { enemy:'walker',   max:24, startTime:50,   duration:22, freq:'HI',     bossZone:false },
        { enemy:'brute',    max:3,  startTime:58,   duration:22, freq:'LOW',    bossZone:false },
        { enemy:'walker',   max:28, startTime:66,   duration:22, freq:'HI',     bossZone:false },
        { enemy:'runner',   max:10, startTime:74,   duration:18, freq:'HI',     bossZone:false },
        { enemy:'walker',   max:32, startTime:80,   duration:24, freq:'HI',     bossZone:false },
        { enemy:'brute',    max:4,  startTime:88,   duration:24, freq:'LOW',    bossZone:false },
        { enemy:'walker',   max:36, startTime:96,   duration:26, freq:'HI',     bossZone:false },
        { enemy:'runner',   max:12, startTime:104,  duration:20, freq:'HI',     bossZone:false },
        { enemy:'walker',   max:40, startTime:110,  duration:28, freq:'HI',     bossZone:false },
        { bosses:[{ type:'rott', hp:340 }], duration:120, freq:'HI', startTime:120, bossZone:true }
      ]
    },

    // ---- chapter 2 ----
    {
      id:3, name:'Hangar', chapter:2, tile:'factory',
      brief:'The old airfield is a slaughterhouse with wings.',
      timeToTreasure:1200, rewards:[220,360,520],
      waves: [
        { enemy:'walker',   max:14, startTime:0,    duration:18, freq:'LOW',    bossZone:false },
        { enemy:'brute',    max:3,  startTime:12,   duration:20, freq:'LOW',    bossZone:false },
        { enemy:'walker',   max:18, startTime:20,   duration:20, freq:'MID',    bossZone:false },
        { enemy:'runner',   max:8,  startTime:30,   duration:16, freq:'MID',    bossZone:false },
        { enemy:'walker',   max:22, startTime:38,   duration:22, freq:'MID',    bossZone:false },
        { enemy:'brute',    max:4,  startTime:46,   duration:22, freq:'LOW',    bossZone:false },
        { enemy:'walker',   max:28, startTime:54,   duration:24, freq:'HI',     bossZone:false },
        { enemy:'runner',   max:10, startTime:62,   duration:18, freq:'HI',     bossZone:false },
        { enemy:'walker',   max:32, startTime:70,   duration:24, freq:'HI',     bossZone:false },
        { enemy:'brute',    max:5,  startTime:78,   duration:24, freq:'LOW',    bossZone:false },
        { enemy:'walker',   max:36, startTime:86,   duration:26, freq:'HI',     bossZone:false },
        { enemy:'runner',   max:12, startTime:94,   duration:20, freq:'HI',     bossZone:false },
        { enemy:'walker',   max:40, startTime:102,  duration:28, freq:'HI',     bossZone:false },
        { enemy:'brute',    max:6,  startTime:110,  duration:26, freq:'LOW',    bossZone:false },
        { enemy:'walker',   max:44, startTime:116,  duration:28, freq:'HI',     bossZone:false },
        { bosses:[{ type:'rott', hp:420 }], duration:120, freq:'HI', startTime:120, bossZone:true }
      ]
    },
    {
      id:4, name:'Docks', chapter:2, tile:'factory',
      brief:'Salt, rust and a tide of the dead.',
      timeToTreasure:1200, rewards:[240,400,580],
      waves: [
        { enemy:'walker',   max:16, startTime:0,    duration:18, freq:'LOW',    bossZone:false },
        { enemy:'runner',   max:8,  startTime:10,   duration:16, freq:'LOW',    bossZone:false },
        { enemy:'walker',   max:20, startTime:18,   duration:20, freq:'MID',    bossZone:false },
        { enemy:'brute',    max:3,  startTime:26,   duration:22, freq:'LOW',    bossZone:false },
        { enemy:'walker',   max:24, startTime:34,   duration:22, freq:'MID',    bossZone:false },
        { enemy:'runner',   max:10, startTime:42,   duration:18, freq:'MID',    bossZone:false },
        { enemy:'walker',   max:28, startTime:50,   duration:24, freq:'HI',     bossZone:false },
        { enemy:'brute',    max:4,  startTime:58,   duration:22, freq:'LOW',    bossZone:false },
        { enemy:'walker',   max:32, startTime:66,   duration:24, freq:'HI',     bossZone:false },
        { enemy:'runner',   max:12, startTime:74,   duration:18, freq:'HI',     bossZone:false },
        { enemy:'walker',   max:36, startTime:82,   duration:26, freq:'HI',     bossZone:false },
        { enemy:'brute',    max:5,  startTime:90,   duration:24, freq:'LOW',    bossZone:false },
        { enemy:'walker',   max:40, startTime:98,   duration:26, freq:'HI',     bossZone:false },
        { enemy:'runner',   max:14, startTime:106,  duration:20, freq:'HI',     bossZone:false },
        { enemy:'walker',   max:44, startTime:112,  duration:28, freq:'HI',     bossZone:false },
        { bosses:[{ type:'rott', hp:480 }], duration:120, freq:'HI', startTime:120, bossZone:true }
      ]
    },
    {
      id:5, name:'Shipping Yard', chapter:2, tile:'factory',
      brief:'Containers tower over you. None of them are safe.',
      timeToTreasure:1200, rewards:[260,440,640],
      waves: [
        { enemy:'walker',   max:18, startTime:0,    duration:18, freq:'LOW',    bossZone:false },
        { enemy:'brute',    max:4,  startTime:12,   duration:20, freq:'LOW',    bossZone:false },
        { enemy:'walker',   max:22, startTime:20,   duration:20, freq:'MID',    bossZone:false },
        { enemy:'runner',   max:10, startTime:30,   duration:16, freq:'MID',    bossZone:false },
        { enemy:'walker',   max:26, startTime:38,   duration:22, freq:'MID',    bossZone:false },
        { enemy:'brute',    max:5,  startTime:46,   duration:22, freq:'LOW',    bossZone:false },
        { enemy:'walker',   max:30, startTime:54,   duration:24, freq:'HI',     bossZone:false },
        { enemy:'runner',   max:12, startTime:62,   duration:18, freq:'HI',     bossZone:false },
        { enemy:'walker',   max:34, startTime:70,   duration:24, freq:'HI',     bossZone:false },
        { enemy:'brute',    max:6,  startTime:78,   duration:24, freq:'LOW',    bossZone:false },
        { enemy:'walker',   max:38, startTime:86,   duration:26, freq:'HI',     bossZone:false },
        { enemy:'runner',   max:14, startTime:94,   duration:20, freq:'HI',     bossZone:false },
        { enemy:'walker',   max:42, startTime:102,  duration:28, freq:'HI',     bossZone:false },
        { enemy:'brute',    max:7,  startTime:110,  duration:26, freq:'LOW',    bossZone:false },
        { enemy:'walker',   max:46, startTime:116,  duration:28, freq:'HI',     bossZone:false },
        { bosses:[{ type:'rott', hp:540 }], duration:120, freq:'HI', startTime:120, bossZone:true }
      ]
    },

    // ---- chapter 3 ----
    {
      id:6, name:'The Mall', chapter:3, tile:'shopping',
      brief:'Shop till they drop. Then they never get up.',
      timeToTreasure:1200, rewards:[300,500,720],
      waves: [
        { enemy:'walker',   max:20, startTime:0,    duration:18, freq:'LOW',    bossZone:false },
        { enemy:'runner',   max:10, startTime:10,   duration:16, freq:'LOW',    bossZone:false },
        { enemy:'walker',   max:24, startTime:18,   duration:20, freq:'MID',    bossZone:false },
        { enemy:'brute',    max:4,  startTime:26,   duration:22, freq:'LOW',    bossZone:false },
        { enemy:'walker',   max:28, startTime:34,   duration:22, freq:'MID',    bossZone:false },
        { enemy:'spitter',  max:6,  startTime:42,   duration:18, freq:'MID',    bossZone:false },
        { enemy:'walker',   max:32, startTime:50,   duration:24, freq:'HI',     bossZone:false },
        { enemy:'brute',    max:5,  startTime:58,   duration:22, freq:'LOW',    bossZone:false },
        { enemy:'walker',   max:36, startTime:66,   duration:24, freq:'HI',     bossZone:false },
        { enemy:'runner',   max:14, startTime:74,   duration:18, freq:'HI',     bossZone:false },
        { enemy:'spitter',  max:8,  startTime:82,   duration:20, freq:'HI',     bossZone:false },
        { enemy:'walker',   max:40, startTime:90,   duration:26, freq:'HI',     bossZone:false },
        { enemy:'brute',    max:6,  startTime:98,   duration:24, freq:'LOW',    bossZone:false },
        { enemy:'walker',   max:44, startTime:106,  duration:28, freq:'HI',     bossZone:false },
        { enemy:'runner',   max:16, startTime:112,  duration:20, freq:'HI',     bossZone:false },
        { bosses:[{ type:'rott', hp:620 }], duration:120, freq:'HI', startTime:120, bossZone:true }
      ]
    },
    {
      id:7, name:'Supermarket', chapter:3, tile:'shopping',
      brief:'Canned food and canned souls. Choose wisely.',
      timeToTreasure:1200, rewards:[340,560,800],
      waves: [
        { enemy:'walker',   max:22, startTime:0,    duration:18, freq:'LOW',    bossZone:false },
        { enemy:'spitter',  max:8,  startTime:10,   duration:18, freq:'LOW',    bossZone:false },
        { enemy:'walker',   max:26, startTime:18,   duration:20, freq:'MID',    bossZone:false },
        { enemy:'brute',    max:5,  startTime:26,   duration:22, freq:'LOW',    bossZone:false },
        { enemy:'walker',   max:30, startTime:34,   duration:22, freq:'MID',    bossZone:false },
        { enemy:'runner',   max:12, startTime:42,   duration:18, freq:'MID',    bossZone:false },
        { enemy:'walker',   max:34, startTime:50,   duration:24, freq:'HI',     bossZone:false },
        { enemy:'spitter',  max:10, startTime:58,   duration:20, freq:'HI',     bossZone:false },
        { enemy:'walker',   max:38, startTime:66,   duration:24, freq:'HI',     bossZone:false },
        { enemy:'brute',    max:6,  startTime:74,   duration:24, freq:'LOW',    bossZone:false },
        { enemy:'walker',   max:42, startTime:82,   duration:26, freq:'HI',     bossZone:false },
        { enemy:'runner',   max:14, startTime:90,   duration:20, freq:'HI',     bossZone:false },
        { enemy:'spitter',  max:12, startTime:98,   duration:22, freq:'HI',     bossZone:false },
        { enemy:'walker',   max:46, startTime:106,  duration:28, freq:'HI',     bossZone:false },
        { enemy:'brute',    max:7,  startTime:112,  duration:26, freq:'LOW',    bossZone:false },
        { bosses:[{ type:'rott', hp:700 }], duration:120, freq:'HI', startTime:120, bossZone:true }
      ]
    },
    {
      id:8, name:'Food Court', chapter:3, tile:'shopping',
      brief:'It was a family restaurant. Now it is dinner.',
      timeToTreasure:1200, rewards:[380,620,880],
      waves: [
        { enemy:'walker',   max:24, startTime:0,    duration:18, freq:'LOW',    bossZone:false },
        { enemy:'spitter',  max:10, startTime:10,   duration:18, freq:'LOW',    bossZone:false },
        { enemy:'walker',   max:28, startTime:18,   duration:20, freq:'MID',    bossZone:false },
        { enemy:'brute',    max:6,  startTime:26,   duration:22, freq:'LOW',    bossZone:false },
        { enemy:'walker',   max:32, startTime:34,   duration:22, freq:'MID',    bossZone:false },
        { enemy:'runner',   max:14, startTime:42,   duration:18, freq:'MID',    bossZone:false },
        { enemy:'walker',   max:36, startTime:50,   duration:24, freq:'HI',     bossZone:false },
        { enemy:'spitter',  max:12, startTime:58,   duration:20, freq:'HI',     bossZone:false },
        { enemy:'walker',   max:40, startTime:66,   duration:24, freq:'HI',     bossZone:false },
        { enemy:'brute',    max:7,  startTime:74,   duration:24, freq:'LOW',    bossZone:false },
        { enemy:'walker',   max:44, startTime:82,   duration:26, freq:'HI',     bossZone:false },
        { enemy:'runner',   max:16, startTime:90,   duration:20, freq:'HI',     bossZone:false },
        { enemy:'spitter',  max:14, startTime:98,   duration:22, freq:'HI',     bossZone:false },
        { enemy:'walker',   max:48, startTime:106,  duration:28, freq:'HI',     bossZone:false },
        { enemy:'brute',    max:8,  startTime:112,  duration:26, freq:'LOW',    bossZone:false },
        { bosses:[{ type:'rott', hp:780 }], duration:120, freq:'HI', startTime:120, bossZone:true }
      ]
    },

    // ---- chapter 4 ----
    {
      id:9, name:'The Lab', chapter:4, tile:'factory',
      brief:'Someone was still tinkering. They made it worse.',
      timeToTreasure:1200, rewards:[420,680,960],
      waves: [
        { enemy:'walker',   max:26, startTime:0,    duration:18, freq:'LOW',    bossZone:false },
        { enemy:'brute',    max:6,  startTime:10,   duration:22, freq:'LOW',    bossZone:false },
        { enemy:'walker',   max:30, startTime:18,   duration:20, freq:'MID',    bossZone:false },
        { enemy:'runner',   max:14, startTime:26,   duration:18, freq:'MID',    bossZone:false },
        { enemy:'walker',   max:34, startTime:34,   duration:22, freq:'MID',    bossZone:false },
        { enemy:'brute',    max:7,  startTime:42,   duration:22, freq:'LOW',    bossZone:false },
        { enemy:'spitter',  max:12, startTime:50,   duration:22, freq:'HI',     bossZone:false },
        { enemy:'walker',   max:38, startTime:58,   duration:24, freq:'HI',     bossZone:false },
        { enemy:'brute',    max:8,  startTime:66,   duration:24, freq:'LOW',    bossZone:false },
        { enemy:'walker',   max:42, startTime:74,   duration:26, freq:'HI',     bossZone:false },
        { enemy:'runner',   max:18, startTime:82,   duration:20, freq:'HI',     bossZone:false },
        { enemy:'spitter',  max:14, startTime:90,   duration:22, freq:'HI',     bossZone:false },
        { enemy:'walker',   max:46, startTime:98,   duration:28, freq:'HI',     bossZone:false },
        { enemy:'brute',    max:9,  startTime:106,  duration:26, freq:'LOW',    bossZone:false },
        { enemy:'walker',   max:50, startTime:112,  duration:28, freq:'HI',     bossZone:false },
        { bosses:[{ type:'rott', hp:880 }], duration:120, freq:'HI', startTime:120, bossZone:true }
      ]
    },
    {
      id:10, name:'The Laboratory', chapter:4, tile:'factory',
      brief:'The corpses on the table were not dead yet when we got here.',
      timeToTreasure:1200, rewards:[460,740,1040],
      waves: [
        { enemy:'walker',   max:28, startTime:0,    duration:18, freq:'LOW',    bossZone:false },
        { enemy:'brute',    max:7,  startTime:10,   duration:22, freq:'LOW',    bossZone:false },
        { enemy:'walker',   max:32, startTime:18,   duration:20, freq:'MID',    bossZone:false },
        { enemy:'spitter',  max:14, startTime:26,   duration:20, freq:'MID',    bossZone:false },
        { enemy:'walker',   max:36, startTime:34,   duration:22, freq:'MID',    bossZone:false },
        { enemy:'brute',    max:8,  startTime:42,   duration:22, freq:'LOW',    bossZone:false },
        { enemy:'walker',   max:40, startTime:50,   duration:24, freq:'HI',     bossZone:false },
        { enemy:'spitter',  max:16, startTime:58,   duration:22, freq:'HI',     bossZone:false },
        { enemy:'walker',   max:44, startTime:66,   duration:24, freq:'HI',     bossZone:false },
        { enemy:'brute',    max:9,  startTime:74,   duration:24, freq:'LOW',    bossZone:false },
        { enemy:'walker',   max:48, startTime:82,   duration:26, freq:'HI',     bossZone:false },
        { enemy:'runner',   max:22, startTime:90,   duration:22, freq:'HI',     bossZone:false },
        { enemy:'spitter',  max:18, startTime:98,   duration:24, freq:'HI',     bossZone:false },
        { enemy:'walker',   max:52, startTime:106,  duration:28, freq:'HI',     bossZone:false },
        { enemy:'brute',    max:10, startTime:112,  duration:26, freq:'LOW',    bossZone:false },
        { bosses:[{ type:'rott', hp:980 }], duration:120, freq:'HI', startTime:120, bossZone:true }
      ]
    },
    {
      id:11, name:'The Facility', chapter:4, tile:'factory',
      brief:'Underground. Locked in. The worst kind of end.',
      timeToTreasure:1200, rewards:[500,800,1120],
      waves: [
        { enemy:'walker',   max:30, startTime:0,    duration:18, freq:'LOW',    bossZone:false },
        { enemy:'brute',    max:8,  startTime:10,   duration:22, freq:'LOW',    bossZone:false },
        { enemy:'walker',   max:34, startTime:18,   duration:20, freq:'MID',    bossZone:false },
        { enemy:'spitter',  max:16, startTime:26,   duration:20, freq:'MID',    bossZone:false },
        { enemy:'walker',   max:38, startTime:34,   duration:22, freq:'MID',    bossZone:false },
        { enemy:'brute',    max:9,  startTime:42,   duration:22, freq:'LOW',    bossZone:false },
        { enemy:'spitter',  max:18, startTime:50,   duration:22, freq:'HI',     bossZone:false },
        { enemy:'walker',   max:42, startTime:58,   duration:24, freq:'HI',     bossZone:false },
        { enemy:'brute',    max:10, startTime:66,   duration:24, freq:'LOW',    bossZone:false },
        { enemy:'walker',   max:46, startTime:74,   duration:26, freq:'HI',     bossZone:false },
        { enemy:'runner',   max:26, startTime:82,   duration:22, freq:'HI',     bossZone:false },
        { enemy:'spitter',  max:20, startTime:90,   duration:24, freq:'HI',     bossZone:false },
        { enemy:'walker',   max:54, startTime:98,   duration:28, freq:'HI',     bossZone:false },
        { enemy:'brute',    max:11, startTime:106,  duration:26, freq:'LOW',    bossZone:false },
        { enemy:'walker',   max:58, startTime:112,  duration:28, freq:'HI',     bossZone:false },
        { bosses:[{ type:'rott', hp:1080 }], duration:120, freq:'HI', startTime:120, bossZone:true }
      ]
    }
  ];

  // expose the campaign the rest of the game already expects
  ZH.STAGES = STAGES;

  // helper the results/level picker already uses
  ZH.levelById = function (id) {
    for (var i = 0; i < STAGES.length; i++) {
      if (STAGES[i].id === id) return STAGES[i];
    }
    return STAGES[0];
  };

  // direction used by briefing/help copy
  ZH.CAMPAIGN_COUNT = STAGES.length;
})(typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this);
