// 地図の座標：緯度・経度 → 画面の x・y（北が上。正距円筒図法で、東経150度が真ん中＝太平洋が真ん中）。index.html の xy と同じ式
"use strict";
const W = 720, TOP = 78, BOTTOM = -58, H = (TOP - BOTTOM) * 2, WEST = -30; // 左の端は西経30度
const xy = (lat, lon) => [((((lon - WEST) % 360) + 360) % 360) * 2, (TOP - lat) * 2];
module.exports = { W, H, TOP, BOTTOM, WEST, xy };
