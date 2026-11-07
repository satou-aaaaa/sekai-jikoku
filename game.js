// 世界の時刻：町のデータ・時差の決まり・問題の作り方（ブラウザと qa/run.mjs の両方で使う）
// 問題は「ある町が○時のとき、別の町は何時？」。答えは時計を進める・もどす形で入れる。
// 時差は IANA tz データベースの決まり（UTC との差・サマータイムの始まりと終わり）をここに書き写したもの。
// QA が、ブラウザの Intl（同じ tz データベースを使う）と3年分の毎時で同じになるかを確かめる。
// 今日の5問・上級は日本時間の日付の種から作り、だれでも同じ。Math.random はここでは使わない（練習・とことんの種は index.html）。
// CITIES の並び・ここの作り方を変えると過去の日の問題も変わる。町は最後に足すだけにし、変えた PR に一言書く。
(function (root) {
  "use strict";
  // サマータイムの決まり（IANA tz データベースの Rule と同じ。2026年の時点）
  //  EU：3月の最後の日曜 1:00 UTC 〜 10月の最後の日曜 1:00 UTC（EU 指令 2000/84/EC）
  //  US：3月の第2日曜 2:00（その町の時刻）〜 11月の第1日曜 2:00（アメリカ 2005年エネルギー政策法。カナダのトロントも同じ。バンクーバーなどは2026年にやめたので出さない）
  //  AU：10月の第1日曜 2:00（標準時）〜 4月の第1日曜 3:00（夏時間）。オーストラリアの南東の州
  //  NZ：9月の最後の日曜 2:00（標準時）〜 4月の第1日曜 3:00（夏時間）
  const RULES = {
    EU: { name: "3月の最後の日曜から10月の最後の日曜まで", north: true },
    US: { name: "3月の第2日曜から11月の第1日曜まで", north: true },
    AU: { name: "10月の第1日曜から4月の第1日曜まで", north: false },
    NZ: { name: "9月の最後の日曜から4月の第1日曜まで", north: false },
  };
  const AREAS = ["アジア", "オセアニア・太平洋", "ヨーロッパ", "アフリカ", "北アメリカ", "南アメリカ"];
  // [id, 町, 国・地域, 地域の番号, 緯度, 経度, IANA の名前, 標準時の UTC との差（分）, サマータイム, ひとこと]
  const RAW = [
    ["tyo", "東京", "日本", 0, 35.68, 139.69, "Asia/Tokyo", 540, null, "日本標準時は東経135度の子午線の時刻で、UTC より9時間進んでいる。サマータイムはしていない。"],
    ["seoul", "ソウル", "韓国", 0, 37.57, 126.98, "Asia/Seoul", 540, null, ""],
    ["beijing", "ペキン（北京）", "中国", 0, 39.9, 116.4, "Asia/Shanghai", 480, null, "中国は東西に広いが、国じゅうで1つの時刻を使う。"],
    ["shanghai", "シャンハイ（上海）", "中国", 0, 31.23, 121.47, "Asia/Shanghai", 480, null, ""],
    ["taipei", "タイペイ（台北）", "台湾", 0, 25.03, 121.57, "Asia/Taipei", 480, null, ""],
    ["hongkong", "ホンコン（香港）", "中国", 0, 22.32, 114.17, "Asia/Hong_Kong", 480, null, ""],
    ["manila", "マニラ", "フィリピン", 0, 14.6, 120.98, "Asia/Manila", 480, null, ""],
    ["hcm", "ホーチミン", "ベトナム", 0, 10.82, 106.63, "Asia/Ho_Chi_Minh", 420, null, ""],
    ["bangkok", "バンコク", "タイ", 0, 13.76, 100.5, "Asia/Bangkok", 420, null, ""],
    ["singapore", "シンガポール", "シンガポール", 0, 1.35, 103.82, "Asia/Singapore", 480, null, "経度から考えると UTC+7 に近いが、UTC+8 を使っている。"],
    ["kl", "クアラルンプール", "マレーシア", 0, 3.14, 101.69, "Asia/Kuala_Lumpur", 480, null, ""],
    ["jakarta", "ジャカルタ", "インドネシア", 0, -6.21, 106.85, "Asia/Jakarta", 420, null, "インドネシアは国の中に時刻が3つある。"],
    ["delhi", "ニューデリー", "インド", 0, 28.61, 77.21, "Asia/Kolkata", 330, null, "インドは30分きざみの UTC+5:30。国じゅうで1つの時刻。"],
    ["kathmandu", "カトマンズ", "ネパール", 0, 27.72, 85.32, "Asia/Kathmandu", 345, null, "ネパールは15分きざみの UTC+5:45。"],
    ["dhaka", "ダッカ", "バングラデシュ", 0, 23.81, 90.41, "Asia/Dhaka", 360, null, ""],
    ["dubai", "ドバイ", "アラブ首長国連邦", 0, 25.2, 55.27, "Asia/Dubai", 240, null, ""],
    ["tehran", "テヘラン", "イラン", 0, 35.69, 51.39, "Asia/Tehran", 210, null, "イランは30分きざみの UTC+3:30。2022年からサマータイムをやめた。"],
    ["riyadh", "リヤド", "サウジアラビア", 0, 24.71, 46.68, "Asia/Riyadh", 180, null, ""],
    ["istanbul", "イスタンブール", "トルコ", 0, 41.01, 28.98, "Europe/Istanbul", 180, null, "トルコは2016年から1年じゅう UTC+3。"],
    ["sydney", "シドニー", "オーストラリア", 1, -33.87, 151.21, "Australia/Sydney", 600, "AU", "南半球なので、サマータイムは日本の秋から春。"],
    ["adelaide", "アデレード", "オーストラリア", 1, -34.93, 138.6, "Australia/Adelaide", 570, "AU", "オーストラリアは国の中に時刻がいくつもあり、30分きざみの所もある。"],
    ["darwin", "ダーウィン", "オーストラリア", 1, -12.46, 130.84, "Australia/Darwin", 570, null, "アデレードと同じ UTC+9:30 だが、サマータイムはしない。"],
    ["perth", "パース", "オーストラリア", 1, -31.95, 115.86, "Australia/Perth", 480, null, ""],
    ["auckland", "オークランド", "ニュージーランド", 1, -36.85, 174.76, "Pacific/Auckland", 720, "NZ", ""],
    ["guam", "グアム", "アメリカ領", 1, 13.47, 144.75, "Pacific/Guam", 600, null, ""],
    ["honolulu", "ホノルル", "アメリカ（ハワイ）", 1, 21.31, -157.86, "Pacific/Honolulu", -600, null, "ハワイはサマータイムをしない。"],
    ["apia", "アピア", "サモア", 1, -13.83, -171.76, "Pacific/Apia", 780, null, "2011年12月に日付変更線の向こう側へ移り、12月30日がとばされた。いまは UTC+13。"],
    ["kiritimati", "キリティマティ島", "キリバス", 1, 1.87, -157.4, "Pacific/Kiritimati", 840, null, "UTC+14。世界でいちばん早く新しい日になる所の1つ。"],
    ["london", "ロンドン", "イギリス", 2, 51.51, -0.13, "Europe/London", 0, "EU", "経度0度の線（本初子午線）が通るグリニッジがある。"],
    ["lisbon", "リスボン", "ポルトガル", 2, 38.72, -9.14, "Europe/Lisbon", 0, "EU", ""],
    ["reykjavik", "レイキャビク", "アイスランド", 2, 64.15, -21.94, "Atlantic/Reykjavik", 0, null, "アイスランドはサマータイムをしない。"],
    ["paris", "パリ", "フランス", 2, 48.86, 2.35, "Europe/Paris", 60, "EU", ""],
    ["madrid", "マドリード", "スペイン", 2, 40.42, -3.7, "Europe/Madrid", 60, "EU", "経度はロンドンより西だが、時刻はパリと同じ。"],
    ["berlin", "ベルリン", "ドイツ", 2, 52.52, 13.4, "Europe/Berlin", 60, "EU", ""],
    ["rome", "ローマ", "イタリア", 2, 41.9, 12.5, "Europe/Rome", 60, "EU", ""],
    ["athens", "アテネ", "ギリシャ", 2, 37.98, 23.73, "Europe/Athens", 120, "EU", ""],
    ["helsinki", "ヘルシンキ", "フィンランド", 2, 60.17, 24.94, "Europe/Helsinki", 120, "EU", ""],
    ["moscow", "モスクワ", "ロシア", 2, 55.76, 37.62, "Europe/Moscow", 180, null, "ロシアは国の中に時刻が11ある。サマータイムはしていない。"],
    ["nairobi", "ナイロビ", "ケニア", 3, -1.29, 36.82, "Africa/Nairobi", 180, null, ""],
    ["lagos", "ラゴス", "ナイジェリア", 3, 6.52, 3.38, "Africa/Lagos", 60, null, ""],
    ["accra", "アクラ", "ガーナ", 3, 5.6, -0.19, "Africa/Accra", 0, null, ""],
    ["joburg", "ヨハネスブルク", "南アフリカ", 3, -26.2, 28.05, "Africa/Johannesburg", 120, null, ""],
    ["newyork", "ニューヨーク", "アメリカ", 4, 40.71, -74.01, "America/New_York", -300, "US", ""],
    ["toronto", "トロント", "カナダ", 4, 43.65, -79.38, "America/Toronto", -300, "US", ""],
    ["chicago", "シカゴ", "アメリカ", 4, 41.88, -87.63, "America/Chicago", -360, "US", "アメリカは本土だけで時刻が4つある。"],
    ["denver", "デンバー", "アメリカ", 4, 39.74, -104.99, "America/Denver", -420, "US", ""],
    ["phoenix", "フェニックス", "アメリカ", 4, 33.45, -112.07, "America/Phoenix", -420, null, "アリゾナ州のほとんどはサマータイムをしない。"],
    ["la", "ロサンゼルス", "アメリカ", 4, 34.05, -118.24, "America/Los_Angeles", -480, "US", ""],
    ["seattle", "シアトル", "アメリカ", 4, 47.61, -122.33, "America/Los_Angeles", -480, "US", ""],
    ["anchorage", "アンカレジ", "アメリカ（アラスカ）", 4, 61.22, -149.9, "America/Anchorage", -540, "US", ""],
    ["stjohns", "セントジョンズ", "カナダ", 4, 47.56, -52.71, "America/St_Johns", -210, "US", "ニューファンドランド島は30分きざみの UTC−3:30。"],
    ["mexico", "メキシコシティ", "メキシコ", 4, 19.43, -99.13, "America/Mexico_City", -360, null, "メキシコの多くの地域は2022年にサマータイムをやめた。"],
    ["bogota", "ボゴタ", "コロンビア", 5, 4.71, -74.07, "America/Bogota", -300, null, ""],
    ["lima", "リマ", "ペルー", 5, -12.05, -77.04, "America/Lima", -300, null, ""],
    ["caracas", "カラカス", "ベネズエラ", 5, 10.48, -66.9, "America/Caracas", -240, null, ""],
    ["saopaulo", "サンパウロ", "ブラジル", 5, -23.55, -46.63, "America/Sao_Paulo", -180, null, "ブラジルは2019年からサマータイムをしていない。"],
    ["buenosaires", "ブエノスアイレス", "アルゼンチン", 5, -34.6, -58.38, "America/Argentina/Buenos_Aires", -180, null, "経度から考えると UTC−4 に近いが、UTC−3 を使っている。"],
  ];
  const C = RAW.map((a) => ({ id: a[0], name: a[1], country: a[2], area: a[3], lat: a[4], lon: a[5], tz: a[6], std: a[7], dst: a[8], note: a[9] }));
  const BY = {};
  for (const c of C) BY[c.id] = c;
  const IDS = C.map((c) => c.id).filter((id) => id !== "tyo");
  const whole = (c) => c.std % 60 === 0;
  // 経度で考えた時刻と、使っている時刻のずれが1時間以内（地図の帯を数えれば近づける町）
  const honest = (c) => whole(c) && Math.abs(c.lon / 15 - c.std / 60) <= 1;

  // --- 日付と時刻の計算（すべて UTC のミリ秒で考える）---
  const DAY = 864e5;
  const dayMs = (k) => Date.parse(k + "T00:00:00Z");
  const keyOf = (ms) => new Date(ms).toISOString().slice(0, 10);
  // y年 m月（1〜12）の n 番目の日曜（n=-1 は最後の日曜）の 0:00 UTC
  function sunday(y, m, n) {
    if (n > 0) { const d1 = new Date(Date.UTC(y, m - 1, 1)); const first = 1 + ((7 - d1.getUTCDay()) % 7); return Date.UTC(y, m - 1, first + 7 * (n - 1)); }
    const last = new Date(Date.UTC(y, m, 0)); return Date.UTC(y, m - 1, last.getUTCDate() - last.getUTCDay());
  }
  const H = 36e5, MIN = 6e4;
  // その年の夏時間の始まり・終わり（UTC のミリ秒）
  function span(rule, std, y) {
    const s = std * MIN;
    if (rule === "EU") return [sunday(y, 3, -1) + 1 * H, sunday(y, 10, -1) + 1 * H];
    if (rule === "US") return [sunday(y, 3, 2) + 2 * H - s, sunday(y, 11, 1) + 2 * H - s - H];
    if (rule === "AU") return [sunday(y, 10, 1) + 2 * H - s, sunday(y, 4, 1) + 3 * H - s - H];
    if (rule === "NZ") return [sunday(y, 9, -1) + 2 * H - s, sunday(y, 4, 1) + 3 * H - s - H];
    return null;
  }
  function dstOn(c, ms) {
    if (!c.dst) return false;
    const y = new Date(ms).getUTCFullYear(), sp = span(c.dst, c.std, y);
    return RULES[c.dst].north ? ms >= sp[0] && ms < sp[1] : ms >= sp[0] || ms < sp[1];
  }
  const offAt = (c, ms) => c.std + (dstOn(c, ms) ? 60 : 0); // その時の UTC との差（分）
  // 町の「日付 k の m 分」を UTC のミリ秒に（夏時間の切りかわりの近くは問題に使わない）
  function utcOf(c, k, m) { let u = dayMs(k) + m * MIN - c.std * MIN; u = dayMs(k) + m * MIN - offAt(c, u) * MIN; return u; }
  // UTC のミリ秒を町の日付と分に
  function localOf(c, ms) { const t = ms + offAt(c, ms) * MIN; return { k: keyOf(t), m: Math.round((t % DAY + DAY) % DAY / MIN) }; }
  const calm = (c, ms) => offAt(c, ms - 4 * H) === offAt(c, ms + 4 * H); // 前後4時間で切りかわりが無い

  // --- 表し方 ---
  const WEEK = "日月火水木金土";
  const dateStr = (k) => { const d = new Date(dayMs(k)); return `${d.getUTCMonth() + 1}月${d.getUTCDate()}日（${WEEK[d.getUTCDay()]}）`; };
  const clockStr = (m) => { m = ((m % 1440) + 1440) % 1440; const h = Math.floor(m / 60), mi = m % 60; return `${h < 12 ? "午前" : "午後"}${h % 12 === 0 && h >= 12 ? 12 : h % 12}:${String(mi).padStart(2, "0")}`; };
  const clock24 = (m) => { m = ((m % 1440) + 1440) % 1440; return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`; };
  const offStr = (min) => { const s = min < 0 ? "−" : "+", a = Math.abs(min), h = Math.floor(a / 60), mi = a % 60; return `UTC${s}${h}${mi ? ":" + String(mi).padStart(2, "0") : ""}`; };
  const hoursStr = (min) => { const a = Math.abs(min), h = Math.floor(a / 60), mi = a % 60; return h && mi ? `${h}時間${mi}分` : h ? `${h}時間` : `${mi}分`; };
  const placeStr = (c) => (c.country && c.country !== c.name ? `${c.name}（${c.country}）` : c.name);

  function seedOf(str) { let h = 2166136261; for (const ch of str) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function shuffled(arr, R) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  const LV = ["やさしい", "ふつう", "むずかしい"];
  // 難しさごとに出せる町。やさしい：時刻が1時間きざみで、地図の帯を数えれば近づけ、サマータイムの無い町。ふつう：1時間きざみの町。むずかしい：全部
  const POOL = [IDS.filter((id) => honest(BY[id]) && !BY[id].dst), IDS.filter((id) => whole(BY[id])), IDS.slice()];

  // 問題：tag は「難しさ:町|種と日付」。日付（YYYY-MM-DD）は種の中にある。種が同じなら同じ問題
  function make(tag) {
    const [head, salt = ""] = tag.split("|"), [lvS, id] = head.split(":"), lv = +lvS, city = BY[id];
    const dm = salt.match(/(\d{4}-\d\d-\d\d)/);
    if (!city || id === "tyo" || !(lv >= 0 && lv <= 2) || !dm || !Number.isFinite(dayMs(dm[1]))) throw new Error("知らない問題: " + tag);
    const k = dm[1], R = rng(seedOf(tag)), tyo = BY.tyo;
    let from = tyo, to = city, kind = 0;
    if (lv === 2) {
      // むずかしい：東京から30分・15分きざみの町へ／その町から東京へ／ほかの町から
      kind = !whole(city) ? [0, 1, 2][Math.floor(R() * 3)] : [1, 2, 2][Math.floor(R() * 3)];
      if (kind === 1) { from = city; to = tyo; }
      if (kind === 2) { const others = IDS.filter((o) => o !== id && BY[o].area !== city.area); from = BY[others[Math.floor(R() * others.length)]]; }
    }
    // 時刻を選ぶ：切りかわりの近くは使わない。やさしいは同じ日・夏時間でない時、ふつうは半分くらい日付がかわる時
    const wantCross = lv === 1 ? R() < 0.55 : lv === 2 ? R() < 0.5 : false;
    const step = lv === 2 ? 30 : 60;
    const slots = [];
    for (let m = 0; m < 1440; m += step) slots.push(m);
    const order = shuffled(slots, R);
    let best = null;
    for (const m of order) {
      if (lv === 0 && (m < 6 * 60 || m > 22 * 60)) continue;
      const u = utcOf(from, k, m);
      if (!calm(from, u) || !calm(to, u)) continue;
      const loc = localOf(to, u), cross = loc.k !== k;
      if (lv === 0 && (cross || dstOn(to, u) || dstOn(from, u))) continue;
      const cand = { m, u, loc, cross };
      if (!best) best = cand;
      if (cross === wantCross) { best = cand; break; }
    }
    if (!best) throw new Error("時刻を選べない: " + tag);
    const days = Math.round((dayMs(best.loc.k) - dayMs(k)) / DAY);
    return {
      tag, lv, ans: id, kind, from: from.id, to: to.id, k, m: best.m, u: best.u,
      want: days * 1440 + best.loc.m, // 答え：出す町の日付の 0:00 から何分あとか
      days, offFrom: offAt(from, best.u), offTo: offAt(to, best.u), dstFrom: dstOn(from, best.u), dstTo: dstOn(to, best.u),
      fine: lv === 2, // 15分きざみのボタンを出す
    };
  }

  // 今日の5問（やさしい2・ふつう2・むずかしい1）。町は難しさごとの並びを1周するまで重ねない。上級（むずかしい3）は今日の5問と重ねない
  const EPOCH = "2026-11-07";
  const dayIdx = (k) => Math.max(0, Math.round((dayMs(k) - dayMs(EPOCH)) / DAY));
  // 今日の5問・上級で使う町：やさしいは POOL[0]、ふつうはやさしいに出ない町（サマータイムのある町など）、むずかしいは全部
  const DPOOL = [POOL[0], POOL[1].filter((id) => !POOL[0].includes(id)), POOL[2]];
  const CYC = {};
  function cycle(name, lv, c) {
    const key = name + lv + ":" + c; if (CYC[key]) return CYC[key];
    let a = shuffled(DPOOL[lv], rng(seedOf(name + ":" + lv + ":" + c)));
    // 前の周の後ろ半分は、次の周の後ろ半分へ回す（周のつなぎ目で同じ町がすぐ戻らない）
    if (c > 0) { const prev = cycle(name, lv, c - 1), tail = new Set(prev.slice(-Math.floor(prev.length / 2))); a = [...a.filter((id) => !tail.has(id)), ...a.filter((id) => tail.has(id))]; }
    return (CYC[key] = a);
  }
  const nth = (name, lv, idx) => cycle(name, lv, Math.floor(idx / DPOOL[lv].length))[idx % DPOOL[lv].length];
  const LVS = [0, 0, 1, 1, 2];
  const PER = [2, 2, 1]; // 1日に使う数
  function pickDay(name, lvs, k, avoid = []) {
    const i = dayIdx(k), used = avoid.slice(), out = [], cnt = [0, 0, 0];
    for (const lv of lvs) {
      const per = name === "hard" ? 3 : PER[lv], n = DPOOL[lv].length, base = i * per + cnt[lv];
      // その日に同じ町がもう出ていたら、並びの半分先・4分の1先…の町に替える（次の日の町を先に使わない）
      const offs = [0, Math.floor(n / 2), Math.floor(n / 4), Math.floor((3 * n) / 4)];
      for (let j = 1; j < n; j++) offs.push(Math.floor(n / 2) + j);
      const id = offs.map((o) => nth(name, lv, base + o)).find((x) => !used.includes(x));
      if (!id) throw new Error("町を選べない");
      used.push(id); out.push([lv, id]); cnt[lv]++;
    }
    return out;
  }
  const dailyTags = (k) => pickDay("day", LVS, k).map(([lv, id]) => `${lv}:${id}|d${k}`);
  const hardTags = (k) => pickDay("hard", [2, 2, 2], k, pickDay("day", LVS, k).map((o) => o[1])).map(([lv, id]) => `${lv}:${id}|h${k}`);

  // 正解のあとに出す説明（やさしい日本語。一文を短く）
  function facts(P) {
    const a = BY[P.from], b = BY[P.to], out = [];
    const line = (c, off, on) => {
      let t = `${c.name}は ${offStr(off)}。`;
      if (c.dst) t += on ? `いまはサマータイム（ふだんは ${offStr(c.std)}）。` : `サマータイムは${RULES[c.dst].name}。`;
      return t;
    };
    out.push(line(a, P.offFrom, P.dstFrom));
    out.push(line(b, P.offTo, P.dstTo));
    const d = P.offTo - P.offFrom;
    out.push(d === 0 ? "時差はありません。" : `${b.name}は${a.name}より${hoursStr(d)}${d > 0 ? "進んでいる" : "おくれている"}。`);
    if (P.days) out.push(P.days > 0 ? "時差の分だけ時計を進めると、日付が次の日になる。" : "時差の分だけ時計をもどすと、日付が前の日になる。");
    const c = BY[P.ans];
    if (c.note) out.push(c.note);
    return out;
  }
  const API = { C, BY, IDS, AREAS, RULES, LV, POOL, DPOOL, whole, honest, sunday, span, dstOn, offAt, utcOf, localOf, dateStr, clockStr, clock24, offStr, hoursStr, placeStr, seedOf, rng, shuffled, make, dailyTags, hardTags, dayIdx, EPOCH, facts, dayMs, keyOf };
  if (typeof module === "object" && module.exports) module.exports = API;
  root.JIKOKU = API;
})(typeof window !== "undefined" ? window : globalThis);
