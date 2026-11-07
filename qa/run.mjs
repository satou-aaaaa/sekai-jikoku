// 世界の時刻の検査。町の時刻の決まり（3年分の毎時でブラウザの Intl と同じ）・問題の作り方（全部の町×3つの難しさ×たくさんの日付）・
// 今日の5問と上級の組み方（3年分）・地図（町の印と名前が地図の中・重ならない・昼と夜）・通しで遊ぶ・まちがい・ヒント・続きから・上級・練習・
// とことん・町の手帳・実績・カレンダー・あとから・古いタブ・スマホ幅・PWA・引き継ぎコード・見やすさを確かめる。
// 使い方: node qa/run.mjs   失敗があれば終了コード 1。結果は qa-report/report.md。
import { chromium } from "playwright";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { checkTransfer } from "./transfer-check.mjs";
import { checkSwStall } from "./sw-check.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const results = [];
const check = (name, ok, detail = "") => results.push({ name, ok: !!ok, detail: String(detail).slice(0, 400) });
const req = createRequire(import.meta.url);
const G = req(path.join(root, "game.js"));
globalThis.window = globalThis; req(path.join(root, "map.js"));
const WM = globalThis.WMAP;

// ブラウザの Intl（IANA tz データベース）で、ある時刻の町の UTC との差（分）
const FMT = {};
function intlOff(tz, ms) {
  const f = FMT[tz] || (FMT[tz] = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }));
  const p = {}; for (const x of f.formatToParts(new Date(ms))) p[x.type] = x.value;
  return Math.round((Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute) - ms) / 6e4);
}
const idOf = (t) => t.split("|")[0].split(":")[1];

// ---- 1. 町のデータ・時差の決まり（ブラウザを使わない）----
{
  check(`町は${G.C.length}（東京と、出す町${G.IDS.length}）。id・名前は重ならない`, G.C.length >= 50 && new Set(G.C.map((c) => c.id)).size === G.C.length && new Set(G.C.map((c) => c.name)).size === G.C.length && G.BY.tyo && !G.IDS.includes("tyo"));
  const bad = G.C.filter((c) => !c.name || !c.country || !(c.area >= 0 && c.area < G.AREAS.length) || !(c.lat > -50 && c.lat < 70) || !(c.lon >= -180 && c.lon <= 180) || !/^[A-Z][A-Za-z_]+\/[A-Za-z_/]+$/.test(c.tz) || c.std % 15 !== 0 || (c.dst && !G.RULES[c.dst]));
  check("どの町にも名前・国・地域・緯度経度・IANA の名前・UTC との差（15分きざみ）がある", bad.length === 0, bad.map((c) => c.id).join(","));
  // 3年分の毎時で、ゲームの計算とブラウザの Intl が同じか（夏時間の始まり・終わりの時刻まで）
  const miss = []; let n = 0;
  for (const c of G.C) for (let ms = Date.UTC(2026, 0, 1); ms < Date.UTC(2029, 0, 1); ms += 36e5) { n++; const a = G.offAt(c, ms), b = intlOff(c.tz, ms); if (a !== b) miss.push(`${c.id} ${new Date(ms).toISOString()} ${a}/${b}`); }
  check(`時差の決まり：${G.C.length}の町×2026〜2028年の毎時（${n}回）で、ゲームの計算がブラウザ（IANA tz）と同じ`, miss.length === 0, miss.slice(0, 5).join(" / "));
  const fixed = ["Asia/Kolkata", "Asia/Kathmandu", "Asia/Tehran", "Australia/Adelaide", "America/St_Johns", "Pacific/Kiritimati"].every((tz) => G.C.some((c) => c.tz === tz));
  check("30分・15分きざみの町（インド・ネパール・イラン・アデレード・セントジョンズ）と UTC+14（キリティマティ）がある", fixed && G.BY.kathmandu.std === 345 && G.BY.kiritimati.std === 840 && G.BY.tehran.dst === null);
  check("日本はサマータイムをしない・UTC+9", G.BY.tyo.std === 540 && !G.BY.tyo.dst);
  check("いまの時刻は分を切り捨てる（日本時間 23:59:30 は 23:59 で、0:00 にしない）", G.localOf(G.BY.tyo, Date.parse("2026-11-07T14:59:30Z")).m === 1439 && G.localOf(G.BY.tyo, Date.parse("2026-11-07T14:59:30Z")).k === "2026-11-07");
  // 2026年の切りかわりの日（EU 指令・NIST・IANA tz 2026f）
  const sw = (c, iso, before, after) => G.offAt(G.BY[c], Date.parse(iso) - 1) === before && G.offAt(G.BY[c], Date.parse(iso)) === after;
  check("2026年の夏時間：ロンドン 3/29 1:00 UTC〜10/25・ニューヨーク 3/8 2:00〜11/1・シドニー 10/4・オークランド 9/27 に切りかわる", sw("london", "2026-03-29T01:00:00Z", 0, 60) && sw("london", "2026-10-25T01:00:00Z", 60, 0) && sw("newyork", "2026-03-08T07:00:00Z", -300, -240) && sw("newyork", "2026-11-01T06:00:00Z", -240, -300) && sw("sydney", "2026-10-03T16:00:00Z", 600, 660) && sw("auckland", "2026-09-26T14:00:00Z", 720, 780));
  const long = G.C.filter((c) => [...c.note].length > 60);
  check("町のひとことは60字以内", long.length === 0, long.map((c) => c.id).join(","));
  check("地図：陸の形がある（南極は出さない）", WM && WM.W === 720 && WM.H === 272 && /^M[\d.\s\-LZM]+Z$/.test(WM.d) && WM.d.length > 20000);
}
{
  // 問題：全部の町×3つの難しさ×日付40（1年のいろいろな日）。答えはブラウザの Intl で確かめる
  const bad = [], fmt = (tz, ms) => { const o = intlOff(tz, ms), t = ms + o * 6e4; return [new Date(t).toISOString().slice(0, 10), Math.round((t % 864e5) / 6e4)]; };
  let n = 0, cross = [0, 0, 0], dst1 = 0, odd2 = 0, kinds = [0, 0, 0], far = 0;
  const t0 = Date.now();
  for (const lv of [0, 1, 2]) for (const id of G.POOL[lv]) for (let j = 0; j < 40; j++) {
    const k = G.keyOf(G.dayMs("2026-11-07") + j * 9 * 864e5), tag = `${lv}:${id}|q${k}.${j}`; let P;
    try { P = G.make(tag); } catch (e) { bad.push(tag + " " + e.message); continue; }
    n++; const A = G.BY[P.from], B = G.BY[P.to], why = [];
    const [ka, ma] = fmt(A.tz, P.u), [kb, mb] = fmt(B.tz, P.u);
    if (ka !== P.k || ma !== P.m) why.push("出す町の時刻");
    const ans = Math.round((G.dayMs(kb) - G.dayMs(P.k)) / 864e5) * 1440 + mb;
    if (ans !== P.want) why.push(`答え ${ans}/${P.want}`);
    if (P.ans !== id || (P.from !== id && P.to !== id) || P.from === P.to) why.push("町");
    if (lv < 2 && P.from !== "tyo") why.push("やさしい・ふつうは東京から");
    if (lv === 0 && (kb !== P.k || P.dstTo || P.dstFrom || !G.honest(B) || P.m < 360 || P.m > 1320)) why.push("やさしいは同じ日・夏時間なし・朝6時〜夜10時");
    if (P.m % (lv === 2 ? 30 : 60) !== 0) why.push("出す時刻のきざみ");
    for (const c of [A, B]) if (G.offAt(c, P.u - 4 * 36e5) !== G.offAt(c, P.u + 4 * 36e5)) why.push("切りかわりの近く");
    if (Math.abs(P.want - P.m) > 26 * 60) why.push("時差が大きすぎる");
    if (JSON.stringify(G.make(tag)) !== JSON.stringify(P)) why.push("同じ種で同じにならない");
    if (why.length) bad.push(tag + " " + why.join("・"));
    if (kb !== P.k) cross[lv]++; if (lv === 1 && (P.dstTo || P.dstFrom)) dst1++; if (lv === 2 && !G.whole(G.BY[id])) odd2++; if (lv === 2) kinds[P.kind]++;
    if (Math.abs(P.want - P.m) >= 12 * 60) far++;
  }
  check(`問題（${n}問）：出す町の時刻と答えがブラウザ（IANA tz）と同じ・やさしいは同じ日で夏時間なし・切りかわりの近くは使わない・同じ種で同じ問題`, bad.length === 0, bad.slice(0, 5).join(" / "));
  check("問題を作るのは速い（全部で8秒以内）", Date.now() - t0 < 8000, `${Date.now() - t0}ms`);
  const c1 = cross[1] / (G.POOL[1].length * 40), c2 = cross[2] / (G.POOL[2].length * 40);
  check("ふつう・むずかしいは日付がかわる問題が3〜7割・ふつうにサマータイム中の問題も出る・むずかしいは町→東京・町→町も出る", c1 > 0.3 && c1 < 0.7 && c2 > 0.3 && c2 < 0.7 && dst1 > 50 && kinds.every((x) => x > 50), `ふつう${Math.round(c1 * 100)}%・むずかしい${Math.round(c2 * 100)}%・夏時間${dst1}・種類${kinds}`);
}
{
  // 今日の5問・上級の組み方（3年分）
  const bad = [], used = new Set(); let gap = Infinity; const last = {};
  for (let i = 0; i < 365 * 3; i++) {
    const d = new Date(Date.parse(G.EPOCH) + i * 864e5).toISOString().slice(0, 10), dl = G.dailyTags(d), hl = G.hardTags(d);
    const di = dl.map(idOf), hi = hl.map(idOf);
    if (dl.length !== 5 || new Set(di).size !== 5 || dl.map((t) => t[0]).join() !== "0,0,1,1,2") bad.push(d + " 今日");
    if (hl.length !== 3 || new Set(hi).size !== 3 || hl.some((t) => t[0] !== "2") || hi.some((x) => di.includes(x))) bad.push(d + " 上級");
    if (JSON.stringify(dl) !== JSON.stringify(G.dailyTags(d))) bad.push(d + " 同じにならない");
    for (const t of [...dl, ...hl]) { const P = G.make(t); if (P.k !== d) bad.push(t + " 日付"); }
    dl.forEach((t, j) => { const x = idOf(t), key = t[0] + x; if (last[key] != null) gap = Math.min(gap, i - last[key]); last[key] = i; used.add(x); });
  }
  check("今日の5問（やさしい2・ふつう2・むずかしい1、同じ町は出さない・その日の日付）と上級（むずかしい3・今日の5問と別）を3年分作れる", bad.length === 0, bad.slice(0, 5).join(","));
  {
    // 難しさごとに、並びの1周のうちに同じ町を2回出さない（重なりをよけた町は次の日へ回す。前は半分先の町を先に使い、その町の番でもう一度出ていた）
    const worst = [];
    for (const [nm, f] of [["今日", G.dailyTags], ["上級", G.hardTags]]) for (const lv of [0, 1, 2]) {
      const seq = []; for (let i = 0; i < 365 * 3; i++) for (const t of f(new Date(Date.parse(G.EPOCH) + i * 864e5).toISOString().slice(0, 10))) if (+t[0] === lv) seq.push(idOf(t));
      if (!seq.length) continue; const n = G.DPOOL[lv].length, last = {}; let gap = Infinity;
      seq.forEach((x, j) => { if (last[x] != null) gap = Math.min(gap, j - last[x]); last[x] = j; });
      // 周のつなぎ目では前の周の後ろ半分を後ろへ回すので、同じ町の間はおよそ半周以上（よけて次の日へ回した分だけ少し縮む）
      if (gap < Math.floor(n / 2) - 3) worst.push(`${nm}${lv}:${gap}/${n}`);
    }
    check("今日の5問・上級は、難しさごとに町を1周するまで同じ町を出さない（同じ町の間は半周以上・3年分）", worst.length === 0, worst.join(","));
  }
  check("3年のうちに全部の町が出る・同じ難しさで同じ町がすぐ戻らない（4日以上あく）", used.size === G.IDS.length && gap >= 4, `${used.size}の町・いちばん短い間 ${gap}日`);
}
{
  const long = [];
  for (const id of G.IDS) for (const lv of [0, 1, 2]) { if (!G.POOL[lv].includes(id)) continue; const P = G.make(`${lv}:${id}|f2027-01-15`); for (const f of G.facts(P)) if ([...f].length > 60) long.push(id + ":" + f); }
  check("正解のあとの説明は1行60字以内（やさしい日本語。一文を短く）", long.length === 0, long.slice(0, 3).join(" / "));
}

// ---- 2. ファイルの中身 ----
const html = readFileSync(path.join(root, "index.html"), "utf8"), game = readFileSync(path.join(root, "game.js"), "utf8");
const ext = [...html.matchAll(/(?:src|href)="(https?:[^"]+)"/g)].map((m) => m[1]).filter((u) => !/^https:\/\/fonts\.googleapis\.com(\/|$)|^https:\/\/ko-fi\.com\/satouaaaaa$|^https:\/\/(www\.iana\.org|www\.nict\.go\.jp|eco\.mtk\.nao\.ac\.jp|eur-lex\.europa\.eu|www\.nist\.gov|www\.naturalearthdata\.com)\//.test(u));
check("外から読むのは文字（Google Fonts）だけ。スクリプト・広告・解析を入れない（出典のリンクは押したときに開くだけ）", ext.length === 0 && ![...html.matchAll(/<script[^>]+src="([^"]+)"/g)].some((m) => /^https?:/.test(m[1])), ext.join(","));
check("ホームの「いまの東京」は開いている間も描き直す（日付が変わったらホームごと）", /setInterval\(\(\) => \{ const el = app\.querySelector\("\.now"\)[^\n]*todayKey\(\) !== homeK\) return home\(\)/.test(html));
check("CSP で通信先を自分だけにしている", /connect-src 'self'/.test(html) && !/connect-src[^;"]*https/.test(html));
check("Math.random は練習・とことんの並び・日付と回の名札だけ（今日の5問・上級は日付の乱数。game.js には無い）", (html.match(/Math\.random/g) || []).length === 3 && !/Math\.random/.test(game.replace(/^\s*\/\/.*$/gm, "")));
check("乱数は sort の比較の中で引かない（ブラウザで引く回数が変わる）", !/\.sort\(\s*\([^)]*\)\s*=>[^\n;]*\b(R|rng|rand|Math\.random)\s*\(/.test(html + game));
check("一行の式の途中にコメント // を足さない（行の残りが消える。rosen-hitofude 2026-11-04）", !/;\s*\/\/[^\n]*;\s*\w/.test(game.split("\n").filter((l) => !l.trim().startsWith("//")).join("\n")));
check("ゲームの答えは自分の表で決める（Intl の tz の版に頼らない。2026年にカナダの一部などが夏時間をやめ、古いブラウザは古い答えを出す）", !/Intl\.DateTimeFormat|toLocaleTimeString|timeZone/.test(game + html.replace(/<!-- a11y:begin[\s\S]*?a11y:end -->/, "")));
check("画面にお笑いの言葉を入れない（本物っぽく）", !/お笑い|ギャグ|ツッコミ|なんでやねん|（うそ）/.test(html));
check("チケット・回数制限・🔒で開くモードを入れない", !/🎫|🔒|チケット|あと\d+回|すると開く/.test(html));
check("このゲームについて：IANA tz・NICT・国立天文台・EU 指令・NIST・Natural Earth の出典と、旅行では公式の情報を見ること", ["IANA", "NICT", "国立天文台", "2000/84/EC", "NIST", "Natural Earth", "公式の情報"].every((w) => html.includes(w)));
check("引き継ぎ：transfer.js をゲームの script より前に、このゲームの記録のキーだけで読む", /<script src="transfer\.js" data-game="sekai-jikoku" data-keys="jikoku-v1"><\/script>\s*<\/head>/.test(html) && html.indexOf('src="transfer.js"') < html.indexOf('src="game.js"') && /data-hk/.test(html) && existsSync(path.join(root, "transfer.js")));
{ const og = (k) => (html.match(new RegExp(`<meta (?:property|name)="${k}" content="([^"]+)"`)) || [])[1] || "";
  const png = readFileSync(path.join(root, "og.png"));
  check("SNS で貼ると絵と題が出る（OGP・1200×630・絶対URL）", og("og:title") && og("og:description") && og("og:image") === "https://satou-aaaaa.github.io/sekai-jikoku/og.png" && og("twitter:card") === "summary_large_image" && png.readUInt32BE(16) === 1200 && png.readUInt32BE(20) === 630); }
{ const fy = readFileSync(path.join(root, ".github/ISSUE_TEMPLATE/feedback.yml"), "utf8");
  check("感想フォームの name が3字以上（2字だとフォームが出ない。shared-workflows incidents/2026-11-05-feedback-form-not-shown.md）", [...((fy.match(/^name:\s*(.+)$/m) || [])[1] || "").trim()].length >= 3);
  check("感想フォームは名前・メールを聞かない", /id: fun/.test(fy) && !/id: (name|email|mail)/.test(fy) && /labels: \["感想"\]/.test(fy)); }
check("README の URL のすぐ後ろに全角の字を続けない（Link check が URL の一部と読む）", !/https?:\/\/[\x21-\x7e]*[^\x00-\x7f]/.test(readFileSync(path.join(root, "README.md"), "utf8").replace(/\]\(https?:\/\/[^)\s]+\)/g, "").replace(/<https?:\/\/[^>\s]+>/g, "")));
{ const sw = readFileSync(path.join(root, "sw.js"), "utf8"), mf = JSON.parse(readFileSync(path.join(root, "manifest.webmanifest"), "utf8"));
  const shell = JSON.parse(sw.match(/SHELL = (\[[^\]]+\])/)[1]);
  check("PWA：sw.js は画面のファイルを全部保存し（引き継ぎの transfer.js も）、外へ何も送らない", ["./index.html", "./map.js", "./game.js", "./transfer.js", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png", "./icon-maskable-512.png"].every((f) => shell.includes(f) && existsSync(path.join(root, f))) && !/https?:\/\//.test(sw.replace(/^\/\/.*$/gm, "")));
  check("PWA：入れるときはブラウザの保存を通さず取り直す（cache: \"reload\"。古い版が残らない）", /new Request\(u, \{ cache: "reload" \}\)/.test(sw));
  check("PWA：manifest にアイコン2つと名前がある", mf.name === "世界の時刻" && mf.icons.length >= 2 && mf.start_url === "./");
  check("PWA：maskable は字が切れないよう専用の絵（icon-maskable-512.png、中を縮めた絵）を使う", mf.icons.filter((i) => /maskable/.test(i.purpose || "")).every((i) => i.src === "icon-maskable-512.png") && existsSync(path.join(root, "icon-maskable-512.png")));
  const st = await checkSwStall(sw);
  check("PWA：通信が途中で止まっても、4秒ほどで保存した画面に切りかえる（ふつうの通信はネットの返事のまま。shared-workflows template/qa/sw-check.mjs）", st.ok, `${st.stalled}/${st.normal}`); }

// ---- 3. ブラウザで遊ぶ ----
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".png": "image/png", ".webmanifest": "application/manifest+json" };
const server = createServer((rq, res) => {
  const p = decodeURIComponent(new URL(rq.url, "http://x").pathname), f = path.join(root, p === "/" ? "index.html" : p);
  if ((f !== root && !f.startsWith(root + path.sep)) || !existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[path.extname(f)] || "application/octet-stream" }); res.end(readFileSync(f));
}).listen(0);
const url = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const errors = [];
// 「今日」をずらして遊ぶ（第1回の日から日がたっていなくても、あとから・カレンダーを確かめる）。QA_SHIFT_DAYS で変えられる
const SHIFT = +(process.env.QA_SHIFT_DAYS || 10);
const TODAY = new Date(Date.now() + SHIFT * 864e5 + 9 * 3600e3).toISOString().slice(0, 10);
// 検査の間に日本時間の0時をまたがないよう、ブラウザの時刻は TODAY の正午（日本時間）から進める
const NOON = Date.parse(TODAY + "T03:00:00Z");
const dayBefore = (n) => new Date(Date.parse(TODAY) - n * 864e5).toISOString().slice(0, 10);
async function newPage(w = 390, ctx) {
  const c = ctx || await browser.newContext({ viewport: { width: w, height: 800 } });
  if (!ctx) await shift(c);
  await c.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  const p = await c.newPage();
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("console", (m) => { if (m.type() === "error" && !/ERR_FAILED|net::/.test(m.text())) errors.push(m.text()); });
  await p.goto(url); await p.waitForTimeout(200);
  return p;
}
const T0 = Date.now();
const shift = (c) => c.addInitScript((ms) => { const n = Date.now; Date.now = () => n() + ms; }, NOON - T0);
const closeHow = async (p) => { if (await p.locator("#howto[open]").count()) await p.click("#howto-ok"); };
const mem = (p) => p.evaluate(() => JSON.parse(localStorage.getItem("jikoku-v1") || "{}"));
// 時計のボタンで target（分）まで合わせる
async function dial(p, target) {
  for (let t = 0; t < 80; t++) {
    const [v, fine] = await p.evaluate(() => [__sj.cur().v, !!__sj.cur().P.fine]);
    const d = target - v; if (d === 0) return;
    const st = [300, 60, ...(fine ? [15] : [])].find((x) => Math.abs(d) >= x) || 60;
    await p.click(`.steps button[data-d="${d > 0 ? st : -st}"]`);
  }
  throw new Error("時計を合わせられない");
}
const want = (p) => p.evaluate(() => __sj.cur().P.want);
async function solve(p, { wrong = 0 } = {}) {
  const w = await want(p);
  for (let i = 0; i < wrong; i++) { await dial(p, w + 60 * (i + 1)); await p.click("#ok"); }
  await dial(p, w); await p.click("#ok");
  await p.waitForSelector(".verdict");
}

try {
  const p = await newPage();
  check("はじめて開くと遊び方が出る", await p.locator("#howto[open]").count() === 1);
  await p.keyboard.press("Escape"); await p.waitForTimeout(100);
  await p.reload(); await p.waitForTimeout(200);
  check("遊び方を Esc で閉じたあと、開き直しても遊び方が出ない（shared-workflows #186）", await p.locator("#howto[open]").count() === 0 && (await mem(p)).tut === true);
  {
    // Esc のその場（cancel）で残す：Esc の直後に読み直しても出ない（10回）。「わかった」も押したその場で残る
    let miss = 0, okNow = 0;
    for (let t = 0; t < 10; t++) {
      const q = await newPage();
      if (t % 2 === 0) { await q.keyboard.press("Escape"); } else { await q.click("#howto-ok"); }
      const tut = await q.evaluate(() => (JSON.parse(localStorage.getItem("jikoku-v1") || "{}")).tut === true);
      if (tut) okNow++; else miss++;
      await q.context().close();
    }
    check("遊び方は Esc・「わかった」のその場で「見た」が残る（10回すぐ読み直す）", miss === 0, `${okNow}/10`);
  }
  check("ホームに世界地図と、今日の5問・とことん・上級・練習・町の手帳のボタン", await p.locator(".hero svg .land").count() === 1 && (await Promise.all(["#go-d", "#go-e", "#go-h", "#go-p", "#go-dex", "#go-cal", "#go-ach"].map(async (q) => (await p.locator(q).count()) === 1 && (await p.locator(q).isVisible()) && (await p.locator(q).isEnabled())))).every(Boolean) && (await p.textContent("#go-d")).includes("今日の5問"));
  {
    await p.setViewportSize({ width: 390, height: 2400 }); // 縦長の画面（PC の縦置きなど）でも見る
    const b = await p.evaluate(() => [...document.querySelectorAll("#app > *")].map((e) => [e.className, Math.round(e.getBoundingClientRect().height)]));
    check("ホームの題は自分の高さだけ（縦に伸びて大きなすき間を作らない）", b[0][0] === "title" && b[0][1] < 90, JSON.stringify(b[0]));
    await p.setViewportSize({ width: 390, height: 800 });
  }

  // 地図：町の印と名前が地図の中・名前どうしが重ならない。昼と夜のかげ
  {
    const r = await p.evaluate(() => {
      const G = __sj.G, out = { bad: [], n: 0 };
      const d = document.createElement("div"); d.style.width = "358px"; document.body.appendChild(d);
      for (let i = 0; i < 400; i++) {
        const lv = i % 3, pool = G.POOL[lv], id = pool[(i * 7) % pool.length], P = G.make(`${lv}:${id}|q${G.keyOf(G.dayMs("2026-11-07") + i * 864e5)}`), A = G.BY[P.from], B = G.BY[P.to];
        d.innerHTML = __sj.worldSvg(P.u, [{ c: A, cls: "pa", label: `${A.name} ${G.clock24(P.m)}` }, { c: B, cls: "pb", label: `${B.name} 12:45` }], "地図");
        const svg = d.querySelector("svg"), lbs = [...svg.querySelectorAll("text.lb")].map((t) => t.getBBox());
        if (svg.querySelectorAll(".pa").length !== 1 || svg.querySelectorAll(".pb").length !== 1) out.bad.push(P.tag + " 印");
        for (const b of lbs) if (b.x < 0 || b.x + b.width > 720 || b.y < 0 || b.y + b.height > 272) out.bad.push(P.tag + " 名前が地図の外");
        if (lbs.length === 2) { const [a, c] = lbs; if (a.x < c.x + c.width && c.x < a.x + a.width && a.y + a.height * 0.2 < c.y + c.height * 0.8 && c.y + c.height * 0.2 < a.y + a.height * 0.8) out.bad.push(P.tag + " 名前が重なる"); }
        out.n++;
      }
      // 昼と夜：日本の昼（UTC 3時）は東京が明るく、夜（UTC 15時）は東京にかげ
      const at = (iso, c) => { d.innerHTML = __sj.worldSvg(Date.parse(iso), [], "x"); const n = d.querySelector(".night"), [x, y] = [((((c.lon + 30) % 360) + 360) % 360) * 2, (78 - c.lat) * 2]; const pt = d.querySelector("svg").createSVGPoint(); pt.x = x; pt.y = y; return n.isPointInFill(pt); };
      out.night = [at("2026-06-21T03:00:00Z", G.BY.tyo), at("2026-06-21T15:00:00Z", G.BY.tyo), at("2026-12-21T03:00:00Z", G.BY.london), at("2026-12-21T12:00:00Z", G.BY.london), at("2026-12-21T00:00:00Z", G.BY.reykjavik)];
      d.remove();
      return out;
    });
    check(`地図（${r.n}問）：●と◆が1つずつ・町の名前は地図の中で重ならない`, r.bad.length === 0, r.bad.slice(0, 5).join(" / "));
    check("昼と夜のかげ：東京は UTC 3時に昼・15時に夜、ロンドンは冬の UTC 3時に夜・12時に昼", JSON.stringify(r.night) === "[false,true,true,false,true]", JSON.stringify(r.night));
  }

  // 今日の5問：1問目はまちがえる、2問目はヒント2回、ほかはそのまま
  await p.click("#go-d");
  const tags = await p.evaluate(() => __sj.load().runs.d.list);
  check("今日の5問は日付から決まる（game.js の dailyTags と同じ）", JSON.stringify(tags) === JSON.stringify(G.dailyTags(TODAY)));
  {
    const P0 = await p.evaluate(() => __sj.cur().P), A = G.BY[P0.from], B = G.BY[P0.to];
    check("問題の画面：●出す町と日付・時刻、◆答える町、地図、時計、−5・−1・+1・+5時間のボタン（大きい）", (await p.textContent(".qcard")).includes(A.name) && (await p.textContent(".qcard")).includes(B.name) && (await p.textContent(".qcard .clk")).includes(G.clockStr(P0.m)) && await p.locator("#map svg .pa").count() === 1 && await p.locator("#map svg .pb").count() === 1 && await p.locator(".steps button").count() === 4 && (await p.$$eval(".steps button", (b) => b.map((x) => x.getBoundingClientRect().height))).every((h) => h >= 52));
    check("時計ははじめ出す町と同じ時刻で、ボタンで進む・日付もかわる", (await p.textContent("#val")).includes(G.clockStr(P0.m)) && await (async () => { for (let i = 0; i < 5; i++) await p.click('.steps button[data-d="300"]'); const t = await p.textContent("#val"); for (let i = 0; i < 5; i++) await p.click('.steps button[data-d="-300"]'); const v = P0.m + 1500; return t.includes(G.clockStr(v % 1440)) && t.includes(G.dateStr(G.keyOf(G.dayMs(P0.k) + Math.floor(v / 1440) * 864e5))); })());
    const say = await p.$$eval("[data-a11y-say]", (e) => e.map((x) => x.getAttribute("aria-label") || x.textContent).join(" "));
    check("「読む」で問題の文（町・日付・時刻）を読む・地図の名前は ●◆ の町を言う", say.includes(A.name) && say.includes(B.name) && say.includes(G.dateStr(P0.k)) && (await p.getAttribute("#map svg", "aria-label")).includes(B.name));
    check("答える前の地図には答えの時刻を出さない", (await p.textContent("#map")).includes(`${B.name} ？`));
  }
  {
    const w = await want(p);
    await dial(p, w + 60); await p.click("#ok");
    check("まちがえると ✕ と「もっともどす」の知らせ（role=status）・時計はそのまま", (await p.textContent("#msg")).includes("✕") && (await p.textContent("#msg")).includes("もどします") && await p.getAttribute("#msg", "role") === "status" && await p.evaluate(() => __sj.cur().v) === w + 60);
    await p.click("#ok");
    check("同じ答えをもう一度押しても、まちがいを二度数えない", (await p.textContent("#msg")).includes("もう試しました") && await p.evaluate(() => __sj.cur().wrong.length) === 1);
    await dial(p, w + 1440); await p.click("#ok");
    check("時刻は合っていて日付だけちがうときは、そう知らせる", (await p.textContent("#msg")).includes("日付"));
    await dial(p, w - 60); await p.click("#ok");
    check("おそすぎる答えには「もっと進める」", (await p.textContent("#msg")).includes("進めます"));
  }
  await p.reload(); await p.waitForTimeout(150); await p.click("#go-d");
  check("途中で閉じても続きから（同じ問題・まちがえた数のまま）", await p.evaluate(() => __sj.cur().i === 0 && __sj.cur().wrong.length === 3));
  await solve(p);
  {
    const P0 = await p.evaluate(() => __sj.cur().P);
    check("正解は ✓・答えの日付と時刻・説明（UTC との差）・★1（まちがい3回）・地図に答えの時刻", (await p.textContent(".verdict .hd")).includes("✓ 正解") && (await p.textContent(".verdict .mn")).includes(G.clockStr(((P0.want % 1440) + 1440) % 1440)) && (await p.textContent(".verdict")).includes("UTC") && (await p.getAttribute(".verdict .stars", "aria-label")) === "星1つ" && (await p.textContent("#map")).includes(G.clock24(((P0.want % 1440) + 1440) % 1440)));
  }
  check("正解したらヒント・ボタン・決めるは隠れる（押せない）", await p.locator("#hint").isHidden() && await p.locator("#ok").isHidden() && await p.locator(".steps button:disabled").count() === 4);
  check("正解の知らせは前からある #msg（role=status）で読ませる・次の操作も言う", (await p.getAttribute("#msg", "role")) === "status" && /✓ 正解！.*(次の問題へ|結果を見る)/.test(await p.textContent("#msg")) && (await p.getAttribute(".verdict", "role")) === null);
  check("「読む」の対象に、問題文・時計の値・知らせ・ヒント・正解を入れる", (await p.evaluate(() => ["#val", "#msg", "#hintbox", ".verdict .hd", ".verdict .mn", ".qcard"].every((q) => document.querySelector(q)?.hasAttribute("data-a11y-say")))));
  await p.click("#next");
  await p.click("#hint");
  {
    const P1 = await p.evaluate(() => __sj.cur().P);
    check("ヒント1は2つの町の UTC との差", (await p.textContent("#hintbox")).includes(G.offStr(P1.offFrom)) && (await p.textContent("#hintbox")).includes(G.offStr(P1.offTo)));
    await p.click("#hint");
    check("ヒント2は時差（何時間進んでいるか・おくれているか）・ヒントは2回まで", /進んでいます|おくれています|時差がありません/.test(await p.textContent("#hintbox")) && await p.locator("#hint:disabled").count() === 1);
  }
  await solve(p);
  check("ヒント2回は★1", (await p.getAttribute(".verdict .stars", "aria-label")) === "星1つ");
  await p.click("#next");
  for (let i = 2; i < 5; i++) { await solve(p); await p.click("#next"); }
  await p.waitForTimeout(150);
  const s1 = await mem(p);
  check("5問で結果：今日の記録に1問ごとのまちがい＋ヒント（3・2・0・0・0）", JSON.stringify(s1.days[TODAY]?.m) === "[3,2,0,0,0]");
  const share = await p.textContent(".share");
  const names = G.dailyTags(TODAY).flatMap((t) => { const P = G.make(t); return [G.BY[P.from].name, G.BY[P.to].name]; });
  check("シェアの文に町の名前・時刻（答え）を出さない（印だけ）", /第\d+回/.test(share) && /🟢/.test(share) && names.every((n) => !share.includes(n)) && !/\d:\d\d/.test(share), share);
  check("まちがいのある日は Ko-fi の一言を出さない", await p.locator(".kofi").count() === 0);
  check("結果に「あと少しの実績」と、続けて遊ぶ・上級のボタン・問題ごとの答え", await p.locator("#achnext").count() === 1 && await p.locator("#go-e").count() === 1 && await p.locator("#go-h").count() === 1 && await p.locator(".rlist > div").count() === 5);
  check("町の手帳に当てた町が載る", Object.keys(s1.dex).length === 5);
  await p.click("#back");
  check("今日を終えたら、ホームは「今日の結果を見る」・地図に集めた町の点", (await p.textContent("#go-d")).includes("結果") && await p.locator(".hero svg .pf").count() === 5);
  // 上級：ヒントなし・3問・15分きざみのボタン
  await p.click("#go-h");
  check("上級はヒントのボタンが無い・3問・15分きざみのボタンもある", await p.locator("#hint").count() === 0 && (await p.evaluate(() => __sj.load().runs.h.list.length)) === 3 && await p.locator("#fine button").count() === 2);
  for (let i = 0; i < 3; i++) { await solve(p); await p.click("#next"); }
  await p.waitForTimeout(150);
  check("上級の記録は hdays に入る", (await mem(p)).hdays[TODAY]?.m.length === 3);
  // 練習：記録を増やさない
  await p.click("#back"); await p.click("#go-p"); await p.click('[data-t="1"]');
  const before = await mem(p);
  const plist = await p.evaluate(() => __sj.load().runs.p.list);
  check("練習の日付は今日から1年のうち（サマータイムの時期も出る）", plist.every((t) => { const k = G.make(t).k; return k >= TODAY && G.dayMs(k) < G.dayMs(TODAY) + 366 * 864e5; }));
  for (let i = 0; i < 5; i++) { await solve(p); await p.click("#next"); }
  await p.waitForTimeout(150);
  const after = await mem(p);
  const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);
  check("練習は今日の記録を増やさない（町の手帳の数はふえる）・まだ当てていない町が先に出る", JSON.stringify(after.days) === JSON.stringify(before.days) && sum(after.dex) === sum(before.dex) + 5 && Object.keys(after.dex).length === Object.keys(before.dex).length + 5);
  // 町の手帳から地域を選んで練習
  await p.click("#back"); await p.click("#go-dex");
  check("町の手帳は6つの地域ごと・まだの町は点線の枠と「まだ」", await p.locator(".area").count() === 6 && await p.locator(".mlist .no").count() === G.IDS.length - Object.keys(after.dex).length && (await p.textContent(".mlist .no span")).includes("まだ"));
  await p.click('[data-a="2"]'); await p.click('[data-t="1"]');
  check("地域の練習はその地域の町だけ", (await p.evaluate(() => __sj.load().runs.p.list)).every((t) => G.BY[idOf(t)].area === 2));
  // とことん：まちがえても終わらない・「ここで降りる」で終わる
  await p.click("#back"); await p.click("#go-e");
  const el = await p.evaluate(() => __sj.load().runs.e.list);
  check("とことんは、やさしい5（別の町）→ふつう10（別の町）→むずかしいで全部の町を1回ずつ", el.length === 15 + G.POOL[2].length && new Set(el.slice(0, 15).map(idOf)).size === 15 && new Set(el.slice(15).map(idOf)).size === G.POOL[2].length && el.slice(0, 5).every((t) => t[0] === "0") && el.slice(5, 15).every((t) => t[0] === "1") && el.slice(15).every((t) => t[0] === "2"));
  {
    const more = await p.evaluate(() => { const l = __sj.endlessList(__sj.load(), "paris", true); return [l.length, l[0], l.every((t) => t[0] === "2")]; });
    check("とことんの続きはむずかしいだけ・つなぎ目で同じ町を続けない", more[0] === G.POOL[2].length && more[2] && idOf(more[1]) !== "paris", JSON.stringify(more));
    const rep = await p.evaluate(() => { let bad = 0; for (let n = 0; n < 500; n++) { const l = __sj.endlessList(__sj.load(), n % 2 ? "paris" : null); for (let i = 1; i < l.length; i++) { const id = (t) => t.split("|")[0].split(":")[1]; if (id(l[i]) === id(l[i - 1])) bad++; } } return bad; });
    check("とことんは難しさの切りかわり（ふつう→むずかしい）でも同じ町を続けない（500回）", rep === 0, String(rep));
  }
  await solve(p); await p.click("#next");
  await solve(p, { wrong: 3 }); await p.click("#next");
  check("とことんはまちがえても終わらない（いのちの数は無い）", await p.locator("#ok").isVisible() && await p.evaluate(() => __sj.load().runs.e.res.length) === 2);
  await solve(p); await p.click("#next");
  await p.reload(); await p.waitForTimeout(150);
  check("とことんは開き直すと続きから", (await p.textContent("#go-e")).includes("続きから"));
  await p.click("#go-e");
  {
    // 別のタブで今の回を終えて新しい回を始めていたら、古い画面の「ここで降りる」はその回を消さない
    const real = await p.evaluate(() => { const s = JSON.parse(localStorage.getItem("jikoku-v1")); const id = s.runs.e.id; s.runs.e.id = "other"; localStorage.setItem("jikoku-v1", JSON.stringify(s)); return id; });
    await p.click("#quit"); await p.waitForTimeout(150);
    check("古い画面の「ここで降りる」は、別のタブで始めた回を終わらせない", (await mem(p)).runs.e?.id === "other" && !(await mem(p)).ebest);
    await p.evaluate((id) => { const s = JSON.parse(localStorage.getItem("jikoku-v1")); s.runs.e.id = id; localStorage.setItem("jikoku-v1", JSON.stringify(s)); }, real);
    await p.reload(); await p.waitForTimeout(150); await p.click("#go-e");
  }
  await p.click("#quit"); await p.waitForTimeout(150);
  check("「ここで降りる」で終わり、自己ベスト（3問）とまちがい・ヒントの数が出る", (await mem(p)).ebest === 3 && (await p.textContent("#eres")).includes("3問") && (await p.textContent("#ebest")).includes("3回"));
  {
    // 引き継ぎコードなどで数の所に文字が入っても、画面に HTML として出さない
    const q = await newPage(); await closeHow(q);
    await q.evaluate(() => { const s = JSON.parse(localStorage.getItem("jikoku-v1")) || { v: 1 }; s.ebest = '<img id="xss" src=x>'; s.elast = "<b>"; s.dex = { paris: '"><b id="xss2">', bad: 3 }; s.runs = { e: { mode: "e", id: "x", date: "2026-11-08", list: ["0:london|e2026-11-08.a.0"], res: [], miss: '"><i id="xss3">' }, h: { list: "bad", res: [] }, p: { mode: "p", id: "y", date: "2026-11-08", list: ["0:nowhere|p2026-11-08"], res: [] }, d: { mode: "d", id: "z", date: "x", list: ["0:london|d2026-11-08"], res: [] }, a1: { mode: "a", id: "a1", date: "2026-11-08", list: ["0:london|d2026-11-08"], res: [null] }, x: { mode: "x", id: "x1", date: "2026-11-08", list: ["0:london|d2026-11-08"], res: [{ m: 0 }] }, h2: { mode: "d", id: "h2", date: "2026-11-08", list: ["0:london|d2026-11-08"], res: [] }, t: { mode: "p", id: "t1", date: "2026-11-08", list: ["0:tyo|p2026-11-08"], res: [] }, nd: { mode: "p", id: "t2", date: "2026-11-08", list: ["0:london|pnodate"], res: [] }, "a:2026-11-08": { mode: "a", id: "a3", date: "2026-11-08", list: ["0:london|d2026-11-08", "1:paris|d2026-11-08", "0:rome|d2026-11-08", "1:seoul|d2026-11-08", "2:taipei|d2026-11-08"], res: [{ m: 0 }], cur: { i: 1, tag: "1:paris|d2026-11-08", wrong: "x", hints: 0 } }, "a:2026-11-09": { mode: "a", id: "a4", date: "2026-11-09", list: ["0:london|d2026-11-09"], res: [] } }; s.days = { "2026-11-08": { m: "x" }, bad: { m: [0] }, "2026-02-30": { m: [0] }, "2026-11-09": { m: [] }, "2026-11-10": { m: [0, 0, 0] } }; s.hdays = { "2026-11-09": { m: [0, 1, 0] }, "2026-11-10": { m: [0, 0, 0, 0, 0] } }; localStorage.setItem("jikoku-v1", JSON.stringify(s)); });
    await q.reload(); await q.waitForTimeout(250);
    const st = await q.evaluate(() => __sj.load());
    check("記録の形を直す：数の所の文字は0に・知らない町・東京・日付の無い問題・形のちがう途中経過・問題の数と合わない日ごとの記録・途中経過は捨てる", st.ebest === 0 && st.dex.paris === 0 && !("bad" in st.dex) && !("elast" in st) && ["h", "p", "d", "a1", "x", "h2", "a:2026-11-09"].every((k) => !(k in st.runs)) && !("t" in st.runs) && !("nd" in st.runs) && st.runs["a:2026-11-08"] && st.runs["a:2026-11-08"].cur === null && Object.keys(st.days).length === 0 && JSON.stringify(Object.keys(st.hdays)) === '["2026-11-09"]');
    await q.click("#go-e").catch(() => {}); await q.waitForTimeout(150); await q.click("#quit").catch(() => {}); await q.waitForTimeout(150);
    check("記録の文字を HTML として出さない", await q.locator("#xss, #xss2, #xss3").count() === 0);
    await q.evaluate(() => { const s = JSON.parse(localStorage.getItem("jikoku-v1")); s.ebest = { toString: 0 }; s.dex = { paris: { valueOf: 1 } }; s.runs = {}; localStorage.setItem("jikoku-v1", JSON.stringify(s)); });
    const errs = []; q.on("pageerror", (e) => errs.push(e.message)); await q.reload(); await q.waitForTimeout(250);
    check("数の所に {\"toString\":0} のような物が入っても止まらず、ホームが出る", errs.length === 0 && await q.locator("#go-d").isVisible() && (await q.evaluate(() => __sj.load().ebest)) === 0, errs.join(","));
    await q.context().close();
  }
  {
    // 練習で20の町目を当て、結果を見ずに戻って練習をやり直しても、次の結果で「20の町」を知らせる
    const q = await newPage(); await closeHow(q);
    await q.evaluate((ids) => { const s = JSON.parse(localStorage.getItem("jikoku-v1")) || { v: 1 }; s.dex = {}; for (const id of ids) s.dex[id] = 1; s.ach = {}; localStorage.setItem("jikoku-v1", JSON.stringify(s)); }, G.IDS.slice(0, 20));
    await q.reload(); await q.waitForTimeout(150); await closeHow(q);
    await q.click("#go-p"); await q.click('[data-t="0"]');
    for (let i = 0; i < 5; i++) { await solve(q); await q.click("#next"); }
    await q.waitForTimeout(150);
    check("前の回で取って知らせていない実績も、次の結果で知らせる（知らせたら二度は出さない）", (await q.textContent("#achnew").catch(() => "")).includes("20の町") && (await mem(q)).ach.f20 === 1);
    await q.click("#back").catch(() => {}); await q.click("#go-p"); await q.click('[data-t="0"]');
    for (let i = 0; i < 5; i++) { await solve(q); await q.click("#next"); }
    await q.waitForTimeout(150);
    check("知らせ終えた実績は次の結果に出さない", !(await q.textContent("#achnew").catch(() => "")).includes("20の町"));
    await q.context().close();
  }
  // 実績・このゲームについて
  await p.click("#back"); await p.click("#go-ach");
  check("実績は14個で、腕前・集める・続けるの3つの組", await p.locator(".ach").count() === 14 && await p.locator(".agrp").count() === 3 && await p.locator(".ach.got").count() >= 2);
  check("達成した実績は ✓ の文字も付く（色だけで分けない）", (await p.textContent(".ach.got b")).startsWith("✓"));
  await p.click("#back"); await p.click("#f-about");
  check("このゲームについて：データの出典のリンク", (await p.textContent("#about")).includes("IANA") && await p.locator("#about a").count() >= 5);
  await p.context().close();

  // まちがいなしの日は Ko-fi を1回だけ
  {
    const q = await newPage(); await closeHow(q); await q.click("#go-d");
    for (let i = 0; i < 5; i++) { await solve(q); await q.click("#next"); }
    await q.waitForTimeout(150);
    check("全部まちがいなしで初めて終えたときだけ Ko-fi の一言", await q.locator(".kofi").count() === 1 && (await q.textContent(".big")).includes("まちがいなし"));
    await q.click("#back"); await q.click("#go-d");
    check("結果をもう一度見ても Ko-fi は出さない", await q.locator(".kofi").count() === 0);
    await q.context().close();
  }

  // カレンダー・あとから：過去の日の記録を置いて見る
  {
    const q = await newPage();
    await q.evaluate(([d2, d3]) => { localStorage.setItem("jikoku-v1", JSON.stringify({ v: 1, tut: true, days: { [d2]: { m: [0, 0, 0, 0, 0] }, [d3]: { m: [1, 0, 0, 2, 0] } }, hdays: {}, adays: {}, dex: {}, runs: {}, kofi: {}, ach: {}, ebest: 0 })); }, [dayBefore(2), dayBefore(3)]);
    await q.reload(); await q.waitForTimeout(150);
    check("ホームの「続けて」は、きのうを休んだら — （休んだ日を責めない）", (await q.textContent(".stats")).includes("—"));
    await q.click("#go-cal");
    const lateList = await q.evaluate(() => __sj.lateDays(__sj.load()));
    const exp = [1, 4, 5, 6, 7].map(dayBefore).filter((d) => d >= G.EPOCH);
    check("カレンダー：取りこぼした過去7日（第1回から）を押せる", JSON.stringify(lateList) === JSON.stringify(exp) && lateList.length > 0, lateList.join(","));
    if (lateList.length) {
      const d = lateList[0];
      if (!(await q.locator(`.cal .miss[data-k="${d}"]`).count())) await q.click("#prev");
      await q.click(`.cal .miss[data-k="${d}"]`);
      check("あとから：その日の今日の5問と同じ問題（その日の日付と時刻）", JSON.stringify(await q.evaluate((d) => __sj.load().runs["a:" + d].list, d)) === JSON.stringify(G.dailyTags(d)));
      for (let i = 0; i < 5; i++) { await solve(q); await q.click("#next"); }
      await q.waitForTimeout(150);
      const s = await mem(q);
      check("あとからは adays に入り、今日の記録・続けた日・シェア・Ko-fi には数えない", s.adays[d] && !s.days[d] && (await q.locator(".share").count()) === 0 && (await q.locator(".kofi").count()) === 0);
      await q.click("#go-cal");
      check("カレンダーに ↺ で残る", await q.locator(`.cal .c.late[data-k="${d}"]`).count() === 1);
    }
    await q.context().close();
  }

  // 古いタブ：同じ問題を2つのタブで開き、片方で答えたら、もう片方は二重に入れない
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 800 } }); await shift(ctx);
    const a = await newPage(390, ctx); await closeHow(a); await a.click("#go-d");
    const b = await ctx.newPage(); b.on("pageerror", (e) => errors.push(e.message)); await b.goto(url); await b.waitForTimeout(150); await b.click("#go-d");
    await solve(a);
    await dial(b, await want(b)); await b.click("#ok");
    await b.waitForTimeout(200);
    const s = await mem(a);
    check("古いタブで同じ問題に答えても二重に数えない", s.runs.d.res.length === 1 && Object.values(s.dex).reduce((x, y) => x + y) === 1);
    await a.click("#next"); await b.goto(url); await b.waitForTimeout(150); await b.click("#go-d");
    await a.click("#hint"); await a.click("#hint");
    await b.click("#hint");
    check("別のタブで使ったヒントの数を減らさない", (await mem(a)).runs.d.cur.hints === 2);
    // 別のタブでヒントを使ったあと、こちらのタブですぐ正解しても、そのヒントを数える
    await dial(b, await want(b)); await b.click("#ok"); await b.waitForTimeout(150);
    check("別のタブで使ったヒントは、こちらで正解しても★に数える", (await mem(a)).runs.d.res[1]?.m === 2 && (await b.getAttribute(".verdict .stars", "aria-label")) === "星1つ");
    await ctx.close();
  }

  // スマホ幅でもはみ出さない・押す所は44px以上
  {
    const bad = [], small = [];
    for (const w of [320, 390]) {
      const q = await newPage(w); await closeHow(q);
      for (const go of [null, "#go-d", "wrong", "solve", "#go-cal", "#go-dex", "#go-ach", "#go-e", "#go-p", "#go-h"]) {
        if (go === "solve") await solve(q);
        else if (go === "wrong") { await dial(q, (await want(q)) + 60); await q.click("#ok"); await q.click("#hint"); }
        else if (go) { await q.goto(url); await q.waitForTimeout(100); await q.click(go); }
        await q.waitForTimeout(100);
        const ov = await q.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        if (ov > 0) bad.push(`${w}px ${go || "ホーム"} ${ov}px`);
        small.push(...(await q.$$eval("button:not([disabled]), a[href]", (bs) => bs.filter((b) => b.checkVisibility() && !b.closest(".cal")).filter((b) => b.getBoundingClientRect().height < 44).map((b) => (b.id || b.className || b.textContent).slice(0, 20)))).map((x) => `${w}/${go}:${x}`));
      }
      await q.context().close();
    }
    check("幅320pxでも横にはみ出さない", bad.length === 0, bad.join(" / "));
    check("押せる所は高さ44px以上", small.length === 0, [...new Set(small)].slice(0, 8).join(","));
  }
  // 見やすさの設定を全部入れても、ページの一番下まで動ける
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 700 } }); await shift(ctx);
    await ctx.addInitScript(() => localStorage.setItem("a11y-v1", JSON.stringify({ read: true, cvd: true, calm: true, say: true, ruby: true })));
    const q = await newPage(390, ctx); await closeHow(q);
    const r = await q.evaluate(() => { window.scrollTo(0, 1e5); const f = document.querySelector("footer").getBoundingClientRect(); return [scrollY, Math.round(f.bottom), innerHeight, getComputedStyle(document.documentElement).position]; });
    check("見やすさの設定を全部入れても、いちばん下まで動ける（html が固定されない）", r[0] > 0 && r[1] <= r[2] && r[3] === "static", r.join(","));
    await q.click("#go-d");
    check("色の見分けを助ける設定では、日付変更線の点線と夜のかげを濃くする（町は ●◆ の形でも分ける）", await q.evaluate(() => getComputedStyle(document.querySelector("#map .dl")).strokeDasharray.startsWith("2") && +getComputedStyle(document.querySelector("#map .night")).fillOpacity > 0.3));
    await ctx.close();
  }
  // キーボードだけで遊べる（Tab と Enter）
  {
    const q = await newPage(); await closeHow(q);
    await q.focus("#go-d"); await q.keyboard.press("Enter"); await q.waitForTimeout(100);
    const [w, v0] = await q.evaluate(() => [__sj.cur().P.want, __sj.cur().v]);
    const step = w > v0 ? 60 : -60, n = Math.abs(w - v0) / 60;
    let t = 0; for (; t < 30 && (await q.evaluate(() => document.activeElement && document.activeElement.dataset.d)) !== String(step); t++) await q.keyboard.press("Tab");
    for (let i = 0; i < n; i++) await q.keyboard.press("Enter");
    for (t = 0; t < 30 && (await q.evaluate(() => document.activeElement && document.activeElement.id)) !== "ok"; t++) await q.keyboard.press("Tab");
    await q.keyboard.press("Enter"); await q.waitForTimeout(100);
    check("キーボードだけ（Tab と Enter）で時計を合わせて答えられる", await q.locator(".verdict").count() === 1);
    await q.context().close();
  }
} catch (e) { check("ブラウザでの検査が最後まで動く", false, e.stack.split("\n").slice(0, 3).join(" ")); }

// 引き継ぎコード（shared-workflows template/qa/transfer-check.mjs）
try {
  const sample = { "jikoku-v1": JSON.stringify({ v: 1, tut: true, days: { "2026-11-07": { m: [0, 1, 0, 0, 2] } }, hdays: {}, adays: {}, dex: { paris: 1, delhi: 1 }, runs: {}, kofi: {}, ach: {}, ebest: 7, t: 1 }) };
  await checkTransfer({ browser, url, game: "sekai-jikoku", sample, check, open: async (pg) => { if (await pg.locator("#howto[open]").count()) await pg.click("#howto-ok"); } });
} catch (e) { check("引き継ぎの検査が最後まで動く", false, e.message.split("\n")[0]); }
await browser.close();
server.close();
check("画面のエラーが無い", errors.length === 0, errors.slice(0, 3).join(" | "));

{ // 見やすさ・読みやすさ・偏り（shared-workflows template/qa/a11y.mjs の写し）
  const { spawnSync } = await import("node:child_process");
  const a = spawnSync(process.execPath, [path.join(root, "qa", "a11y.mjs")], { encoding: "utf8", env: process.env });
  check("見やすさ・読みやすさの検査（qa/a11y.mjs。中身は qa-report/a11y.md）", a.status === 0, (a.stdout.match(/^- ❌.*$/gm) || []).join(" / ") || (a.status ? a.stderr.slice(-300) : ""));
}

const ng = results.filter((r) => !r.ok);
const md = `# 世界の時刻 QA\n\n${results.map((r) => `- ${r.ok ? "✅" : "❌"} ${r.name}${r.detail ? `（${r.detail}）` : ""}`).join("\n")}\n\n${ng.length ? `❌ ${ng.length}件` : `✅ ${results.length}項目すべて通過`}\n`;
mkdirSync(path.join(root, "qa-report"), { recursive: true });
writeFileSync(path.join(root, "qa-report/report.md"), md);
console.log(md);
process.exit(ng.length ? 1 : 0);
