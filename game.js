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
    ["seoul", "ソウル", "韓国", 0, 37.57, 126.98, "Asia/Seoul", 540, null, "東京より西にあるが、日本と同じ UTC+9。サマータイムはしていない。"],
    ["beijing", "ペキン（北京）", "中国", 0, 39.9, 116.4, "Asia/Shanghai", 480, null, "中国は東西に広いが、国じゅうで1つの時刻を使う。"],
    ["shanghai", "シャンハイ（上海）", "中国", 0, 31.23, 121.47, "Asia/Shanghai", 480, null, "ペキンから1000km以上はなれているが、同じ時刻。"],
    ["taipei", "タイペイ（台北）", "台湾", 0, 25.03, 121.57, "Asia/Taipei", 480, null, "台湾は UTC+8。サマータイムはしていない。"],
    ["hongkong", "ホンコン（香港）", "中国", 0, 22.32, 114.17, "Asia/Hong_Kong", 480, null, "UTC+8。中国の本土と同じ時刻。"],
    ["manila", "マニラ", "フィリピン", 0, 14.6, 120.98, "Asia/Manila", 480, null, "フィリピンは国じゅうで UTC+8。サマータイムはしていない。"],
    ["hcm", "ホーチミン", "ベトナム", 0, 10.82, 106.63, "Asia/Ho_Chi_Minh", 420, null, "ベトナムは国じゅうで UTC+7。"],
    ["bangkok", "バンコク", "タイ", 0, 13.76, 100.5, "Asia/Bangkok", 420, null, "タイは UTC+7。サマータイムはしていない。"],
    ["singapore", "シンガポール", "シンガポール", 0, 1.35, 103.82, "Asia/Singapore", 480, null, "経度から考えると UTC+7 に近いが、UTC+8 を使っている。"],
    ["kl", "クアラルンプール", "マレーシア", 0, 3.14, 101.69, "Asia/Kuala_Lumpur", 480, null, "となりのシンガポールと同じ UTC+8。"],
    ["jakarta", "ジャカルタ", "インドネシア", 0, -6.21, 106.85, "Asia/Jakarta", 420, null, "インドネシアは国の中に時刻が3つある。"],
    ["delhi", "ニューデリー", "インド", 0, 28.61, 77.21, "Asia/Kolkata", 330, null, "インドは30分きざみの UTC+5:30。国じゅうで1つの時刻。"],
    ["kathmandu", "カトマンズ", "ネパール", 0, 27.72, 85.32, "Asia/Kathmandu", 345, null, "ネパールは15分きざみの UTC+5:45。"],
    ["dhaka", "ダッカ", "バングラデシュ", 0, 23.81, 90.41, "Asia/Dhaka", 360, null, "バングラデシュは UTC+6。サマータイムはしていない。"],
    ["dubai", "ドバイ", "アラブ首長国連邦", 0, 25.2, 55.27, "Asia/Dubai", 240, null, "アラブ首長国連邦は UTC+4。サマータイムはしていない。"],
    ["tehran", "テヘラン", "イラン", 0, 35.69, 51.39, "Asia/Tehran", 210, null, "イランは30分きざみの UTC+3:30。2022年からサマータイムをやめた。"],
    ["riyadh", "リヤド", "サウジアラビア", 0, 24.71, 46.68, "Asia/Riyadh", 180, null, "サウジアラビアは国じゅうで UTC+3。"],
    ["istanbul", "イスタンブール", "トルコ", 0, 41.01, 28.98, "Europe/Istanbul", 180, null, "トルコは2016年から1年じゅう UTC+3。"],
    ["sydney", "シドニー", "オーストラリア", 1, -33.87, 151.21, "Australia/Sydney", 600, "AU", "南半球なので、サマータイムは日本の秋から春。"],
    ["adelaide", "アデレード", "オーストラリア", 1, -34.93, 138.6, "Australia/Adelaide", 570, "AU", "オーストラリアは国の中に時刻がいくつもあり、30分きざみの所もある。"],
    ["darwin", "ダーウィン", "オーストラリア", 1, -12.46, 130.84, "Australia/Darwin", 570, null, "アデレードと同じ UTC+9:30 だが、サマータイムはしない。"],
    ["perth", "パース", "オーストラリア", 1, -31.95, 115.86, "Australia/Perth", 480, null, "シドニーより2時間おくれている（シドニーの夏時間の間は3時間）。"],
    ["auckland", "オークランド", "ニュージーランド", 1, -36.85, 174.76, "Pacific/Auckland", 720, "NZ", "9月の終わりから4月の初めまでサマータイムで UTC+13。"],
    ["guam", "グアム", "アメリカ領", 1, 13.47, 144.75, "Pacific/Guam", 600, null, "日本より1時間進んでいる。サマータイムはしていない。"],
    ["honolulu", "ホノルル", "アメリカ（ハワイ）", 1, 21.31, -157.86, "Pacific/Honolulu", -600, null, "ハワイはサマータイムをしない。"],
    ["apia", "アピア", "サモア", 1, -13.83, -171.76, "Pacific/Apia", 780, null, "2011年12月に日付変更線の向こう側へ移り、12月30日がとばされた。いまは UTC+13。"],
    ["kiritimati", "キリティマティ島", "キリバス", 1, 1.87, -157.4, "Pacific/Kiritimati", 840, null, "UTC+14。世界でいちばん早く新しい日になる所の1つ。"],
    ["london", "ロンドン", "イギリス", 2, 51.51, -0.13, "Europe/London", 0, "EU", "経度0度の線（本初子午線）が通るグリニッジがある。"],
    ["lisbon", "リスボン", "ポルトガル", 2, 38.72, -9.14, "Europe/Lisbon", 0, "EU", "ポルトガルはスペインのとなりだが、ロンドンと同じ時刻。"],
    ["reykjavik", "レイキャビク", "アイスランド", 2, 64.15, -21.94, "Atlantic/Reykjavik", 0, null, "アイスランドはサマータイムをしない。"],
    ["paris", "パリ", "フランス", 2, 48.86, 2.35, "Europe/Paris", 60, "EU", "中央ヨーロッパ時間の UTC+1。夏は UTC+2。"],
    ["madrid", "マドリード", "スペイン", 2, 40.42, -3.7, "Europe/Madrid", 60, "EU", "経度はロンドンより西だが、時刻はパリと同じ。"],
    ["berlin", "ベルリン", "ドイツ", 2, 52.52, 13.4, "Europe/Berlin", 60, "EU", "中央ヨーロッパ時間。ヨーロッパの多くの国が同じ時刻を使う。"],
    ["rome", "ローマ", "イタリア", 2, 41.9, 12.5, "Europe/Rome", 60, "EU", "パリ・ベルリンと同じ中央ヨーロッパ時間。"],
    ["athens", "アテネ", "ギリシャ", 2, 37.98, 23.73, "Europe/Athens", 120, "EU", "東ヨーロッパ時間の UTC+2。パリより1時間進んでいる。"],
    ["helsinki", "ヘルシンキ", "フィンランド", 2, 60.17, 24.94, "Europe/Helsinki", 120, "EU", "フィンランドは UTC+2。となりのスウェーデンより1時間進んでいる。"],
    ["moscow", "モスクワ", "ロシア", 2, 55.76, 37.62, "Europe/Moscow", 180, null, "ロシアは国の中に時刻が11ある。サマータイムはしていない。"],
    ["nairobi", "ナイロビ", "ケニア", 3, -1.29, 36.82, "Africa/Nairobi", 180, null, "赤道の近くにある。ケニアは UTC+3。"],
    ["lagos", "ラゴス", "ナイジェリア", 3, 6.52, 3.38, "Africa/Lagos", 60, null, "ナイジェリアは UTC+1。サマータイムはしていない。"],
    ["accra", "アクラ", "ガーナ", 3, 5.6, -0.19, "Africa/Accra", 0, null, "ガーナは1年じゅう UTC+0。経度0度の線の近くにある。"],
    ["joburg", "ヨハネスブルク", "南アフリカ", 3, -26.2, 28.05, "Africa/Johannesburg", 120, null, "南アフリカは国じゅうで UTC+2。サマータイムはしていない。"],
    ["newyork", "ニューヨーク", "アメリカ", 4, 40.71, -74.01, "America/New_York", -300, "US", "アメリカ東部時間。夏はサマータイムで UTC−4。"],
    ["toronto", "トロント", "カナダ", 4, 43.65, -79.38, "America/Toronto", -300, "US", "ニューヨークと同じ東部時間。"],
    ["chicago", "シカゴ", "アメリカ", 4, 41.88, -87.63, "America/Chicago", -360, "US", "アメリカは本土だけで時刻が4つある。"],
    ["denver", "デンバー", "アメリカ", 4, 39.74, -104.99, "America/Denver", -420, "US", "アメリカ山岳部時間の UTC−7。"],
    ["phoenix", "フェニックス", "アメリカ", 4, 33.45, -112.07, "America/Phoenix", -420, null, "アリゾナ州のほとんどはサマータイムをしない。"],
    ["la", "ロサンゼルス", "アメリカ", 4, 34.05, -118.24, "America/Los_Angeles", -480, "US", "アメリカ太平洋時間の UTC−8。東京との時差は17時間（夏は16時間）。"],
    ["seattle", "シアトル", "アメリカ", 4, 47.61, -122.33, "America/Los_Angeles", -480, "US", "ロサンゼルスと同じ太平洋時間。"],
    ["anchorage", "アンカレジ", "アメリカ（アラスカ）", 4, 61.22, -149.9, "America/Anchorage", -540, "US", "アラスカは UTC−9。ふだんはハワイより1時間進んでいる。"],
    ["stjohns", "セントジョンズ", "カナダ", 4, 47.56, -52.71, "America/St_Johns", -210, "US", "ニューファンドランド島は30分きざみの UTC−3:30。"],
    ["mexico", "メキシコシティ", "メキシコ", 4, 19.43, -99.13, "America/Mexico_City", -360, null, "メキシコの多くの地域は2022年にサマータイムをやめた。"],
    ["bogota", "ボゴタ", "コロンビア", 5, 4.71, -74.07, "America/Bogota", -300, null, "コロンビアは UTC−5。サマータイムはしていない。"],
    ["lima", "リマ", "ペルー", 5, -12.05, -77.04, "America/Lima", -300, null, "ペルーは UTC−5。サマータイムはしていない。"],
    ["caracas", "カラカス", "ベネズエラ", 5, 10.48, -66.9, "America/Caracas", -240, null, "ベネズエラは2016年から UTC−4。"],
    ["saopaulo", "サンパウロ", "ブラジル", 5, -23.55, -46.63, "America/Sao_Paulo", -180, null, "ブラジルは2019年からサマータイムをしていない。"],
    ["buenosaires", "ブエノスアイレス", "アルゼンチン", 5, -34.6, -58.38, "America/Argentina/Buenos_Aires", -180, null, "経度から考えると UTC−4 に近いが、UTC−3 を使っている。"],
    // 2026-11-07 足した町（最後に足すだけ。UTC との差・サマータイムは IANA tz データベースから。QA が3年分の毎時で Intl と比べる）
    ["mumbai", "ムンバイ", "インド", 0, 19.08, 72.88, "Asia/Kolkata", 330, null, "ニューデリーと同じ UTC+5:30。"],
    ["colombo", "コロンボ", "スリランカ", 0, 6.93, 79.86, "Asia/Colombo", 330, null, "スリランカもインドと同じ UTC+5:30。"],
    ["karachi", "カラチ", "パキスタン", 0, 24.86, 67.0, "Asia/Karachi", 300, null, "パキスタンは UTC+5。インドより30分おくれている。"],
    ["tashkent", "タシケント", "ウズベキスタン", 0, 41.3, 69.24, "Asia/Tashkent", 300, null, "ウズベキスタンは UTC+5。サマータイムはしていない。"],
    ["ulaanbaatar", "ウランバートル", "モンゴル", 0, 47.89, 106.91, "Asia/Ulaanbaatar", 480, null, "モンゴルの首都。UTC+8 でサマータイムはしていない。"],
    ["yangon", "ヤンゴン", "ミャンマー", 0, 16.87, 96.2, "Asia/Yangon", 390, null, "ミャンマーは30分きざみの UTC+6:30。"],
    ["doha", "ドーハ", "カタール", 0, 25.29, 51.53, "Asia/Qatar", 180, null, "カタールは UTC+3。サマータイムはしていない。"],
    ["vladivostok", "ウラジオストク", "ロシア", 0, 43.12, 131.89, "Asia/Vladivostok", 600, null, "東京より西にあるが、東京より1時間進んでいる。"],
    ["brisbane", "ブリスベン", "オーストラリア", 1, -27.47, 153.03, "Australia/Brisbane", 600, null, "シドニーと同じ UTC+10 だが、この州はサマータイムをしない。"],
    ["melbourne", "メルボルン", "オーストラリア", 1, -37.81, 144.96, "Australia/Melbourne", 600, "AU", "シドニーと同じ時刻。サマータイムは10月から4月。"],
    ["wellington", "ウェリントン", "ニュージーランド", 1, -41.29, 174.78, "Pacific/Auckland", 720, "NZ", "ニュージーランドの首都。オークランドと同じ時刻。"],
    ["noumea", "ヌメア", "ニューカレドニア（フランス領）", 1, -22.27, 166.45, "Pacific/Noumea", 660, null, "UTC+11。サマータイムはしていない。"],
    ["portmoresby", "ポートモレスビー", "パプアニューギニア", 1, -9.44, 147.18, "Pacific/Port_Moresby", 600, null, "パプアニューギニアの首都は UTC+10。"],
    ["amsterdam", "アムステルダム", "オランダ", 2, 52.37, 4.9, "Europe/Amsterdam", 60, "EU", "経度はロンドンに近いが、パリと同じ時刻。"],
    ["vienna", "ウィーン", "オーストリア", 2, 48.21, 16.37, "Europe/Vienna", 60, "EU", "中央ヨーロッパ時間の UTC+1。夏は UTC+2。"],
    ["prague", "プラハ", "チェコ", 2, 50.08, 14.44, "Europe/Prague", 60, "EU", "ベルリンと同じ中央ヨーロッパ時間。"],
    ["warsaw", "ワルシャワ", "ポーランド", 2, 52.23, 21.01, "Europe/Warsaw", 60, "EU", "中央ヨーロッパ時間。東の国ざかいまで同じ時刻。"],
    ["stockholm", "ストックホルム", "スウェーデン", 2, 59.33, 18.07, "Europe/Stockholm", 60, "EU", "となりのフィンランドより1時間おくれている。"],
    ["dublin", "ダブリン", "アイルランド", 2, 53.35, -6.26, "Europe/Dublin", 0, "EU", "アイルランドはロンドンと同じ時刻。"],
    ["zurich", "チューリッヒ", "スイス", 2, 47.38, 8.54, "Europe/Zurich", 60, "EU", "スイスも EU の国と同じ日にサマータイムが切りかわる。"],
    ["addis", "アディスアベバ", "エチオピア", 3, 9.03, 38.74, "Africa/Addis_Ababa", 180, null, "エチオピアは UTC+3。サマータイムはしていない。"],
    ["dakar", "ダカール", "セネガル", 3, 14.72, -17.47, "Africa/Dakar", 0, null, "西経17度にあるが、UTC+0 を使っている。"],
    ["kinshasa", "キンシャサ", "コンゴ民主共和国", 3, -4.44, 15.27, "Africa/Kinshasa", 60, null, "コンゴ民主共和国は国の中に時刻が2つある。"],
    ["capetown", "ケープタウン", "南アフリカ", 3, -33.92, 18.42, "Africa/Johannesburg", 120, null, "ヨハネスブルクと同じ UTC+2。"],
    ["algiers", "アルジェ", "アルジェリア", 3, 36.75, 3.06, "Africa/Algiers", 60, null, "アルジェリアは UTC+1。サマータイムはしていない。"],
    ["sf", "サンフランシスコ", "アメリカ", 4, 37.77, -122.42, "America/Los_Angeles", -480, "US", "ロサンゼルスと同じ太平洋時間。"],
    ["boston", "ボストン", "アメリカ", 4, 42.36, -71.06, "America/New_York", -300, "US", "ニューヨークと同じ東部時間。"],
    ["dallas", "ダラス", "アメリカ", 4, 32.78, -96.8, "America/Chicago", -360, "US", "シカゴと同じ中部時間。"],
    ["panama", "パナマシティ", "パナマ", 4, 8.98, -79.52, "America/Panama", -300, null, "パナマは1年じゅう UTC−5。サマータイムはしていない。"],
    ["guatemala", "グアテマラシティ", "グアテマラ", 4, 14.63, -90.51, "America/Guatemala", -360, null, "グアテマラは UTC−6。サマータイムはしていない。"],
    ["rio", "リオデジャネイロ", "ブラジル", 5, -22.91, -43.17, "America/Sao_Paulo", -180, null, "サンパウロと同じ UTC−3。"],
    ["montevideo", "モンテビデオ", "ウルグアイ", 5, -34.9, -56.16, "America/Montevideo", -180, null, "ウルグアイは2015年からサマータイムをしていない。"],
    ["quito", "キト", "エクアドル", 5, -0.18, -78.47, "America/Guayaquil", -300, null, "赤道のすぐ近くにある。エクアドルの本土は UTC−5。"],
    ["lapaz", "ラパス", "ボリビア", 5, -16.5, -68.15, "America/La_Paz", -240, null, "ボリビアは UTC−4。サマータイムはしていない。"],
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
  function localOf(c, ms) { const t = ms + offAt(c, ms) * MIN; return { k: keyOf(t), m: Math.floor((t % DAY + DAY) % DAY / MIN) }; }
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
  // 第1回から1日ずつ順に選ぶ（並びの次の町がその日にもう出ていたら、その町は次の日へ回す）。並びのどの町も一度ずつ使うので、1周のうちに同じ町が2回出ない
  const SIM = {};
  function simDay(name, lvs, i, avoidOf) {
    const S = SIM[name] || (SIM[name] = { days: [], ptr: [0, 0, 0], wait: [[], [], []] });
    while (S.days.length <= i) {
      const d = S.days.length, used = avoidOf ? avoidOf(d).slice() : [], out = [];
      for (const lv of lvs) {
        const w = S.wait[lv], wi = w.findIndex((x) => !used.includes(x));
        let id = wi >= 0 ? w.splice(wi, 1)[0] : null;
        for (let g = 0; id == null; g++) { if (g > 4 * DPOOL[lv].length) throw new Error("町を選べない"); const x = nth(name, lv, S.ptr[lv]++); if (used.includes(x)) w.push(x); else id = x; }
        used.push(id); out.push([lv, id]);
      }
      S.days.push(out);
    }
    return S.days[i];
  }
  const dayPick = (i) => simDay("day", LVS, i);
  const hardPick = (i) => simDay("hard", [2, 2, 2], i, (d) => dayPick(d).map((o) => o[1]));
  const dailyTags = (k) => dayPick(dayIdx(k)).map(([lv, id]) => `${lv}:${id}|d${k}`);
  const hardTags = (k) => hardPick(dayIdx(k)).map(([lv, id]) => `${lv}:${id}|h${k}`);

  // 正解のあとに出す説明（やさしい日本語。一文を短く）
  // 経度の手がかり：地球は1時間に15度まわるので、経度÷15 が「経度で考えた時刻」の UTC との差
  const lonFact = (c) => { const h = Math.round(c.lon / 15) || 0; return `${c.name}は${c.lon >= 0 ? "東経" : "西経"}${Math.round(Math.abs(c.lon))}度。15度で1時間なので、経度で考えると UTC${h < 0 ? "−" : "+"}${Math.abs(h)} ぐらい。`; };
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
    out.push(lonFact(c));
    if (c.note) out.push(c.note);
    return out;
  }
  const API = { lonFact, C, BY, IDS, AREAS, RULES, LV, POOL, DPOOL, whole, honest, sunday, span, dstOn, offAt, utcOf, localOf, dateStr, clockStr, clock24, offStr, hoursStr, placeStr, seedOf, rng, shuffled, make, dailyTags, hardTags, dayIdx, EPOCH, facts, dayMs, keyOf };
  if (typeof module === "object" && module.exports) module.exports = API;
  root.JIKOKU = API;
})(typeof window !== "undefined" ? window : globalThis);
