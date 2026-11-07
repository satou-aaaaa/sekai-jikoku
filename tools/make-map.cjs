// 世界の陸地の形を map.js にする。使い方：node tools/make-map.cjs <ne_110m_land.geojson>
// 元のデータは Natural Earth 1:110m Land（パブリックドメイン。https://www.naturalearthdata.com/）。データそのものはリポジトリに入れない
"use strict";
const fs = require("fs");
const path = require("path");
const { W, H, xy } = require("./proj.cjs");
const src = process.argv[2];
if (!src) { console.error("使い方：node tools/make-map.cjs <ne_110m_land.geojson>"); process.exit(1); }
const geo = JSON.parse(fs.readFileSync(src, "utf8"));
const r1 = (v) => Math.round(v * 10) / 10;
let d = "", rings = 0;
for (const f of geo.features) {
  if (f.bbox && f.bbox[3] < -60) continue; // 南極は出さない
  const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
  for (const poly of polys) for (const ring of poly) {
    // 端（西経30度）をまたぐ形は x をつなげて書き、はみ出した分を左右に写す
    let px = null; const pts = [];
    for (const [lon, lat] of ring) { let [x, y] = xy(lat, lon); if (px !== null) { while (x - px > W / 2) x -= W; while (px - x > W / 2) x += W; } px = x; pts.push([x, Math.min(H + 4, y)]); }
    if (pts.length < 4) continue;
    const xs = pts.map((p) => p[0]), lo = Math.min(...xs), hi = Math.max(...xs);
    if ((hi - lo) * (Math.max(...pts.map((p) => p[1])) - Math.min(...pts.map((p) => p[1]))) < 1.5) continue; // 小さすぎる島は省く
    const shifts = [0]; if (lo < 0) shifts.push(W); if (hi > W) shifts.push(-W);
    for (const s of shifts) { d += "M" + pts.map((p) => r1(p[0] + s) + " " + r1(p[1])).join("L") + "Z"; rings++; }
  }
}
const out = `// 世界の陸地（tools/make-map.cjs が Natural Earth 1:110m Land から作る。手で直さない）\nwindow.WMAP = ${JSON.stringify({ W, H, d })};\n`;
fs.writeFileSync(path.join(__dirname, "..", "map.js"), out);
console.log("map.js", rings, "rings", out.length, "bytes");
