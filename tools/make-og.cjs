// SNS で貼られたときの絵（og.png 1200×630）を作る。今日の問題（答え）は入れず、世界地図と昼夜のかげ、時計の見本だけ。
// 使い方: node tools/make-og.cjs（qa/ の playwright を使う）
const path = require("path");
const { chromium } = require(path.join(__dirname, "..", "qa", "node_modules", "playwright"));
globalThis.window = globalThis;
require(path.join(__dirname, "..", "map.js"));
const WM = globalThis.WMAP;
(async () => {
  const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const p = await b.newPage({ viewport: { width: 1200, height: 630 } });
  // 夜のかげ：12月のある時刻（index.html の nightPath と同じ考え方。dec=−23度、太陽は東経90度の真上＝東京の午後3時ごろ）
  const dec = -23, slon = 90, t = Math.tan((dec * Math.PI) / 180), pts = [];
  for (let i = 0; i <= 360; i += 3) { const h = ((-30 + i - slon) * Math.PI) / 180, lat = (Math.atan(-Math.cos(h) / t) * 180) / Math.PI; pts.push(`${i * 2} ${((78 - lat) * 2).toFixed(1)}`); }
  const night = `M0 -20L${pts.join("L")}L720 -20Z`;
  await p.setContent(`<body style="margin:0;font-family:'Noto Sans CJK JP','IPAPGothic',sans-serif">
  <div style="position:relative;width:1200px;height:630px;background:#eef1f5;color:#17233a;overflow:hidden">
    <svg style="position:absolute;left:0;top:250px" width="1200" height="453" viewBox="0 0 720 272"><rect width="720" height="272" fill="#d3e3ef"/>
      <path d="${WM.d}" fill="#f6f1e3" stroke="#7b8aa3" stroke-width=".8"/><path d="${night}" fill="#0e1c3d" fill-opacity=".26"/>
      <line x1="420" y1="0" x2="420" y2="272" stroke="#7f2f0f" stroke-width="1.6" stroke-dasharray="5 4"/>
      <circle cx="${(139.69 + 30) * 2}" cy="${(78 - 35.68) * 2}" r="8" fill="#1d5c8f" stroke="#fff" stroke-width="3"/>
      <path d="M${(360 - 0.13 - 330) * 2} ${(78 - 51.5) * 2 - 10}l10 10l-10 10l-10 -10z" fill="#b2461b" stroke="#fff" stroke-width="3"/></svg>
    <div style="position:absolute;left:70px;top:46px">
      <div style="font-size:30px;color:#46506a;letter-spacing:.06em">時差を考えて当てる1日5問</div>
      <div style="font-size:108px;font-weight:900;letter-spacing:.1em;line-height:1.15">世界の<span style="color:#b2461b">時刻</span></div>
    </div>
    <div style="position:absolute;right:70px;top:60px;background:#fdfcf8;border:3px solid #17233a;border-radius:20px;padding:18px 26px;font-size:34px;font-weight:900;line-height:1.5;text-align:center">東京が 午後3:00 のとき<br><span style="color:#b2461b">◆ ロンドンは何時？</span></div>
  </div></body>`);
  await p.screenshot({ path: path.join(__dirname, "..", "og.png") });
  await b.close();
})();
