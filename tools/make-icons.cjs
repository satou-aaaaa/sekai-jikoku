// アプリのアイコン（icon-192.png・icon-512.png と、切り抜かれても欠けない icon-maskable-512.png）を作る。空色の地に、時計と地球の経線。
// maskable は中央の円（直径の80%）の中に全部が入るよう、絵を0.78倍に縮める（https://web.dev/articles/maskable-icon）
// 使い方: node tools/make-icons.cjs（qa/ の playwright を使う）
const path = require("path");
const { chromium } = require(path.join(__dirname, "..", "qa", "node_modules", "playwright"));
(async () => {
  const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  for (const [s, name, k] of [[192, "icon-192.png", 1], [512, "icon-512.png", 1], [512, "icon-maskable-512.png", 0.78]]) {
    const p = await b.newPage({ viewport: { width: s, height: s } });
    await p.setContent(`<body style="margin:0"><svg width="${s}" height="${s}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <rect width="100" height="100" fill="#d3e3ef"/><g transform="translate(50 50) scale(${k}) translate(-50 -50)">
      <circle cx="50" cy="50" r="38" fill="#fdfcf8" stroke="#17233a" stroke-width="4"/>
      <path d="M50 12 A38 38 0 0 1 50 88 Z" fill="#0e1c3d" fill-opacity=".2"/>
      <g fill="none" stroke="#7b8aa3" stroke-width="1.4"><ellipse cx="50" cy="50" rx="19" ry="38"/><line x1="50" y1="12" x2="50" y2="88"/><line x1="12" y1="50" x2="88" y2="50"/></g>
      <g stroke="#17233a" stroke-width="5" stroke-linecap="round"><line x1="50" y1="50" x2="50" y2="27"/><line x1="50" y1="50" x2="66" y2="58"/></g>
      <circle cx="50" cy="50" r="4.5" fill="#b2461b"/></g></svg></body>`);
    await p.screenshot({ path: path.join(__dirname, "..", name), clip: { x: 0, y: 0, width: s, height: s } });
  }
  await b.close();
})();
