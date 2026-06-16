/**
 * 学習目標カタログ。プロフィールの「目標」設定で選ばせる候補一覧。
 *
 * カテゴリは 3 つ:
 *   - highschool : 高校受験で目指す人気高校
 *   - university : 大学受験で目指す人気大学 (国公立 / 私立 / 海外)
 *   - qualification : 資格 (IT・語学・公的)
 *
 * 検索は normalizeForGoalSearch() で大文字化・ひらがな統一・スペース
 * 除去を行ったキーに対して includes() で前方/部分一致する。
 * 「英検」「えいけん」「EIKEN」どれでも同じ項目にたどり着ける。
 */

export type GoalKind = "highschool" | "university" | "qualification";

export type GoalItem = {
  id: string;
  kind: GoalKind;
  name: string;
  /** 別名・かな・略称など、検索でヒットさせたいエイリアス。 */
  aliases?: string[];
};

const HIGH_SCHOOLS: GoalItem[] = [
  // 全国最難関
  { id: "hs-kaisei", kind: "highschool", name: "開成高校", aliases: ["かいせい"] },
  { id: "hs-nada", kind: "highschool", name: "灘高校", aliases: ["なだ"] },
  { id: "hs-azabu", kind: "highschool", name: "麻布高校", aliases: ["あざぶ"] },
  { id: "hs-oin", kind: "highschool", name: "桜蔭高校", aliases: ["おういん"] },
  { id: "hs-jg", kind: "highschool", name: "女子学院高校", aliases: ["じょしがくいん", "JG"] },
  { id: "hs-tsukukoma", kind: "highschool", name: "筑波大附属駒場高校", aliases: ["つくこま", "筑駒"] },
  { id: "hs-tsukufu", kind: "highschool", name: "筑波大附属高校", aliases: ["つくふ", "筑附"] },
  { id: "hs-ouin", kind: "highschool", name: "桜蔭学園", aliases: [] },
  { id: "hs-keio", kind: "highschool", name: "慶應義塾高校", aliases: ["けいおう"] },
  { id: "hs-waseda", kind: "highschool", name: "早稲田高校", aliases: ["わせだ"] },
  { id: "hs-wasejitsu", kind: "highschool", name: "早稲田実業学校高等部", aliases: ["わせじつ"] },
  { id: "hs-rikkyo-ikebukuro", kind: "highschool", name: "立教池袋高校", aliases: ["りっきょう"] },
  { id: "hs-aoyama", kind: "highschool", name: "青山学院高等部", aliases: ["あおがく"] },
  { id: "hs-chuo-sugi", kind: "highschool", name: "中央大学杉並高校", aliases: ["ちゅうすぎ"] },
  // 公立進学校
  { id: "hs-hibiya", kind: "highschool", name: "日比谷高校", aliases: ["ひびや"] },
  { id: "hs-nishi", kind: "highschool", name: "西高校 (東京)", aliases: ["にし"] },
  { id: "hs-kunitachi", kind: "highschool", name: "国立高校", aliases: ["くにたち"] },
  { id: "hs-tsuruoka", kind: "highschool", name: "戸山高校", aliases: ["とやま"] },
  { id: "hs-aoyama-pub", kind: "highschool", name: "青山高校 (都立)", aliases: ["あおやま"] },
  { id: "hs-yokohama-suiran", kind: "highschool", name: "横浜翠嵐高校", aliases: ["すいらん"] },
  { id: "hs-shonan", kind: "highschool", name: "湘南高校", aliases: ["しょうなん"] },
  { id: "hs-urawa", kind: "highschool", name: "県立浦和高校", aliases: ["うらわ"] },
  { id: "hs-omiya", kind: "highschool", name: "大宮高校", aliases: ["おおみや"] },
  { id: "hs-chiba", kind: "highschool", name: "県立千葉高校", aliases: ["ちば"] },
  { id: "hs-ichikawa", kind: "highschool", name: "市川高校", aliases: ["いちかわ"] },
  { id: "hs-shibuya-makuhari", kind: "highschool", name: "渋谷教育学園幕張高校", aliases: ["まくはり"] },
  { id: "hs-asano", kind: "highschool", name: "浅野高校", aliases: ["あさの"] },
  { id: "hs-saiko", kind: "highschool", name: "栄光学園高校", aliases: ["えいこう"] },
  { id: "hs-eiko", kind: "highschool", name: "聖光学院高校", aliases: ["せいこう"] },
  // 関西
  { id: "hs-osaka-hokuyo", kind: "highschool", name: "大阪桐蔭高校", aliases: ["とういん"] },
  { id: "hs-todaiji", kind: "highschool", name: "東大寺学園高校", aliases: ["とうだいじ"] },
  { id: "hs-nishidai", kind: "highschool", name: "西大和学園高校", aliases: ["にしやまと"] },
  { id: "hs-konkou", kind: "highschool", name: "金光学園高校", aliases: ["こんこう"] },
  { id: "hs-houtoku", kind: "highschool", name: "甲陽学院高校", aliases: ["こうよう"] },
  { id: "hs-rakunan", kind: "highschool", name: "洛南高校", aliases: ["らくなん"] },
  { id: "hs-rakusei", kind: "highschool", name: "洛星高校", aliases: ["らくせい"] },
  { id: "hs-osaka-hokuno", kind: "highschool", name: "大阪府立北野高校", aliases: ["きたの"] },
  { id: "hs-tenoji", kind: "highschool", name: "大阪府立天王寺高校", aliases: ["てんのうじ"] },
  // 名古屋
  { id: "hs-toukai", kind: "highschool", name: "東海高校", aliases: ["とうかい"] },
  { id: "hs-aichi-okazaki", kind: "highschool", name: "岡崎高校", aliases: ["おかざき"] },
  // 九州
  { id: "hs-kyushu-rakunou", kind: "highschool", name: "ラ・サール高校", aliases: ["らさーる"] },
  { id: "hs-kyoeisha", kind: "highschool", name: "久留米大学附設高校", aliases: ["ふせつ"] },
  { id: "hs-shuyukan", kind: "highschool", name: "修猷館高校", aliases: ["しゅうゆうかん"] },
  // 高専
  { id: "hs-kosen-akashi", kind: "highschool", name: "明石工業高等専門学校", aliases: ["こうせん"] },
];

const UNIVERSITIES: GoalItem[] = [
  // 旧帝大
  { id: "u-todai", kind: "university", name: "東京大学", aliases: ["とうだい", "tokyo university"] },
  { id: "u-kyodai", kind: "university", name: "京都大学", aliases: ["きょうだい", "kyoto university"] },
  { id: "u-tohoku", kind: "university", name: "東北大学", aliases: ["とうほく"] },
  { id: "u-nagoya", kind: "university", name: "名古屋大学", aliases: ["なごや", "めいだい"] },
  { id: "u-osaka", kind: "university", name: "大阪大学", aliases: ["はんだい"] },
  { id: "u-kyushu", kind: "university", name: "九州大学", aliases: ["きゅうだい"] },
  { id: "u-hokkaido", kind: "university", name: "北海道大学", aliases: ["ほくだい"] },
  // 国公立難関
  { id: "u-tit", kind: "university", name: "東京工業大学", aliases: ["とうこうだい"] },
  { id: "u-hitotsubashi", kind: "university", name: "一橋大学", aliases: ["ひとつばし"] },
  { id: "u-tsukuba", kind: "university", name: "筑波大学", aliases: ["つくば"] },
  { id: "u-kobe", kind: "university", name: "神戸大学", aliases: ["こうべ"] },
  { id: "u-yokohama-kokuritsu", kind: "university", name: "横浜国立大学", aliases: ["よここく"] },
  { id: "u-ochanomizu", kind: "university", name: "お茶の水女子大学", aliases: ["おちゃのみず"] },
  { id: "u-tokyo-iko", kind: "university", name: "東京医科歯科大学", aliases: ["いか", "しか"] },
  { id: "u-tokyo-gaikoku", kind: "university", name: "東京外国語大学", aliases: ["がいだい"] },
  { id: "u-tokyo-geijutsu", kind: "university", name: "東京藝術大学", aliases: ["げいだい"] },
  // 公立
  { id: "u-shutoken", kind: "university", name: "東京都立大学", aliases: ["とりつ"] },
  { id: "u-osaka-shi", kind: "university", name: "大阪公立大学", aliases: ["こうりつ"] },
  // 早慶
  { id: "u-keio", kind: "university", name: "慶應義塾大学", aliases: ["けいおう", "keio"] },
  { id: "u-waseda", kind: "university", name: "早稲田大学", aliases: ["わせだ", "waseda"] },
  // 上理
  { id: "u-sophia", kind: "university", name: "上智大学", aliases: ["じょうち", "sophia"] },
  { id: "u-tus", kind: "university", name: "東京理科大学", aliases: ["りかだい"] },
  { id: "u-icu", kind: "university", name: "国際基督教大学 (ICU)", aliases: ["icu"] },
  // MARCH
  { id: "u-meiji", kind: "university", name: "明治大学", aliases: ["めいじ"] },
  { id: "u-aoyama", kind: "university", name: "青山学院大学", aliases: ["あおがく"] },
  { id: "u-rikkyo", kind: "university", name: "立教大学", aliases: ["りっきょう"] },
  { id: "u-chuo", kind: "university", name: "中央大学", aliases: ["ちゅうおう"] },
  { id: "u-hosei", kind: "university", name: "法政大学", aliases: ["ほうせい"] },
  { id: "u-gakushuin", kind: "university", name: "学習院大学", aliases: ["がくしゅういん"] },
  // 関関同立
  { id: "u-kanseigakuin", kind: "university", name: "関西学院大学", aliases: ["かんがく"] },
  { id: "u-kansai", kind: "university", name: "関西大学", aliases: ["かんだい"] },
  { id: "u-doshisha", kind: "university", name: "同志社大学", aliases: ["どうしゃ"] },
  { id: "u-ritsumeikan", kind: "university", name: "立命館大学", aliases: ["りつめいかん"] },
  // 日東駒専
  { id: "u-nihon", kind: "university", name: "日本大学", aliases: ["にちだい"] },
  { id: "u-toyo", kind: "university", name: "東洋大学", aliases: ["とうよう"] },
  { id: "u-komazawa", kind: "university", name: "駒澤大学", aliases: ["こまざわ"] },
  { id: "u-senshu", kind: "university", name: "専修大学", aliases: ["せんしゅう"] },
  // 産近甲龍
  { id: "u-kindai", kind: "university", name: "近畿大学", aliases: ["きんだい"] },
  { id: "u-konan", kind: "university", name: "甲南大学", aliases: ["こうなん"] },
  { id: "u-ryukoku", kind: "university", name: "龍谷大学", aliases: ["りゅうこく"] },
  { id: "u-kyoto-sangyo", kind: "university", name: "京都産業大学", aliases: ["きょうさん"] },
  // 医学部・専門
  { id: "u-juntendo", kind: "university", name: "順天堂大学", aliases: ["じゅんてんどう"] },
  { id: "u-jikei", kind: "university", name: "東京慈恵会医科大学", aliases: ["じけい"] },
  { id: "u-jichi", kind: "university", name: "自治医科大学", aliases: ["じち"] },
  // 海外
  { id: "u-harvard", kind: "university", name: "Harvard University", aliases: ["ハーバード"] },
  { id: "u-mit", kind: "university", name: "MIT", aliases: ["マサチューセッツ"] },
  { id: "u-stanford", kind: "university", name: "Stanford University", aliases: ["スタンフォード"] },
  { id: "u-oxford", kind: "university", name: "University of Oxford", aliases: ["オックスフォード"] },
  { id: "u-cambridge", kind: "university", name: "University of Cambridge", aliases: ["ケンブリッジ"] },
  { id: "u-eth", kind: "university", name: "ETH Zürich", aliases: ["チューリッヒ"] },
  { id: "u-nus", kind: "university", name: "National University of Singapore", aliases: ["シンガポール"] },
];

const QUALIFICATIONS: GoalItem[] = [
  // 語学
  { id: "q-toeic", kind: "qualification", name: "TOEIC", aliases: ["とーいっく"] },
  { id: "q-toefl", kind: "qualification", name: "TOEFL", aliases: ["とーふる"] },
  { id: "q-ielts", kind: "qualification", name: "IELTS", aliases: ["あいえるつ"] },
  { id: "q-eiken-1", kind: "qualification", name: "英検 1 級", aliases: ["えいけん"] },
  { id: "q-eiken-pre1", kind: "qualification", name: "英検 準 1 級", aliases: ["えいけん"] },
  { id: "q-eiken-2", kind: "qualification", name: "英検 2 級", aliases: ["えいけん"] },
  { id: "q-jlpt-n1", kind: "qualification", name: "日本語能力試験 N1", aliases: ["JLPT", "にほんご"] },
  { id: "q-hsk-6", kind: "qualification", name: "HSK 6 級", aliases: ["中国語"] },
  { id: "q-toeic-speaking", kind: "qualification", name: "TOEIC Speaking & Writing", aliases: [] },
  // IT
  { id: "q-ip", kind: "qualification", name: "ITパスポート", aliases: ["IP", "アイパス"] },
  { id: "q-fe", kind: "qualification", name: "基本情報技術者", aliases: ["基本情報", "FE"] },
  { id: "q-ap", kind: "qualification", name: "応用情報技術者", aliases: ["応用情報", "AP"] },
  { id: "q-sg", kind: "qualification", name: "情報セキュリティマネジメント", aliases: ["SG"] },
  { id: "q-sc", kind: "qualification", name: "情報処理安全確保支援士", aliases: ["SC"] },
  { id: "q-db", kind: "qualification", name: "データベーススペシャリスト", aliases: ["DB"] },
  { id: "q-nw", kind: "qualification", name: "ネットワークスペシャリスト", aliases: ["NW"] },
  { id: "q-pm", kind: "qualification", name: "プロジェクトマネージャ試験", aliases: ["PM"] },
  { id: "q-sa", kind: "qualification", name: "システムアーキテクト試験", aliases: ["SA"] },
  // クラウド
  { id: "q-aws-ccp", kind: "qualification", name: "AWS Certified Cloud Practitioner", aliases: ["AWS"] },
  { id: "q-aws-saa", kind: "qualification", name: "AWS Certified Solutions Architect – Associate", aliases: ["SAA", "AWS"] },
  { id: "q-aws-sap", kind: "qualification", name: "AWS Certified Solutions Architect – Professional", aliases: ["SAP", "AWS"] },
  { id: "q-gcp-ace", kind: "qualification", name: "Google Cloud Associate Cloud Engineer", aliases: ["GCP"] },
  { id: "q-gcp-pca", kind: "qualification", name: "Google Cloud Professional Cloud Architect", aliases: ["GCP"] },
  { id: "q-azure-fundamentals", kind: "qualification", name: "Microsoft Certified: Azure Fundamentals", aliases: ["AZ-900"] },
  { id: "q-azure-administrator", kind: "qualification", name: "Microsoft Certified: Azure Administrator", aliases: ["AZ-104"] },
  // セキュリティ
  { id: "q-cissp", kind: "qualification", name: "CISSP", aliases: ["セキュリティ"] },
  { id: "q-cisa", kind: "qualification", name: "CISA", aliases: ["監査"] },
  { id: "q-ceh", kind: "qualification", name: "CEH", aliases: ["ハッキング"] },
  // 公的・士業
  { id: "q-takken", kind: "qualification", name: "宅地建物取引士 (宅建)", aliases: ["たっけん"] },
  { id: "q-gyousei", kind: "qualification", name: "行政書士", aliases: ["ぎょうせいしょし"] },
  { id: "q-shihou", kind: "qualification", name: "司法書士", aliases: ["しほうしょし"] },
  { id: "q-shaho", kind: "qualification", name: "社会保険労務士 (社労士)", aliases: ["しゃろうし"] },
  { id: "q-zeirishi", kind: "qualification", name: "税理士", aliases: ["ぜいりし"] },
  { id: "q-koukinin", kind: "qualification", name: "公認会計士", aliases: ["かいけいし", "CPA"] },
  { id: "q-bengoshi", kind: "qualification", name: "司法試験 (予備試験)", aliases: ["弁護士"] },
  { id: "q-kanrishi", kind: "qualification", name: "中小企業診断士", aliases: ["しんだんし"] },
  { id: "q-fp1", kind: "qualification", name: "FP 1 級", aliases: ["ファイナンシャルプランナー"] },
  { id: "q-fp2", kind: "qualification", name: "FP 2 級", aliases: [] },
  { id: "q-fp3", kind: "qualification", name: "FP 3 級", aliases: [] },
  // 簿記・会計
  { id: "q-boki-1", kind: "qualification", name: "日商簿記 1 級", aliases: ["ぼき"] },
  { id: "q-boki-2", kind: "qualification", name: "日商簿記 2 級", aliases: ["ぼき"] },
  { id: "q-boki-3", kind: "qualification", name: "日商簿記 3 級", aliases: ["ぼき"] },
  { id: "q-usCPA", kind: "qualification", name: "USCPA", aliases: ["米国公認会計士"] },
  // 医療・福祉
  { id: "q-kango", kind: "qualification", name: "看護師国家試験", aliases: ["かんごし"] },
  { id: "q-yakuzaishi", kind: "qualification", name: "薬剤師国家試験", aliases: ["やくざいし"] },
  { id: "q-rigaku", kind: "qualification", name: "理学療法士国家試験", aliases: ["PT"] },
  { id: "q-sagyo", kind: "qualification", name: "作業療法士国家試験", aliases: ["OT"] },
  { id: "q-kaigo", kind: "qualification", name: "介護福祉士", aliases: ["かいご"] },
  { id: "q-shakaifukushi", kind: "qualification", name: "社会福祉士", aliases: ["しゃふく"] },
  // 教員・公務員
  { id: "q-kyouin", kind: "qualification", name: "教員採用試験", aliases: ["きょういん"] },
  { id: "q-koumuin-kokka", kind: "qualification", name: "国家公務員総合職", aliases: ["こうむいん"] },
  { id: "q-koumuin-ippan", kind: "qualification", name: "国家公務員一般職", aliases: ["こうむいん"] },
  { id: "q-koumuin-chiho", kind: "qualification", name: "地方公務員 (上級)", aliases: ["こうむいん"] },
  // データ・統計
  { id: "q-toukei-2", kind: "qualification", name: "統計検定 2 級", aliases: [] },
  { id: "q-toukei-1", kind: "qualification", name: "統計検定 1 級", aliases: [] },
  // 不動産
  { id: "q-kanteishi", kind: "qualification", name: "不動産鑑定士", aliases: ["かんていし"] },
];

export const GOAL_CATALOG: GoalItem[] = [
  ...HIGH_SCHOOLS,
  ...UNIVERSITIES,
  ...QUALIFICATIONS,
];

/** 検索用の正規化: NFKC + 大文字化 + ひらがな化 + 連続スペース除去。 */
function normalizeForGoalSearch(text: string): string {
  // ひらがな ↔ カタカナを揃える (ひらがな寄せ)
  const kanaToHira = text.replace(/[ァ-ヶ]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0x60),
  );
  return kanaToHira
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s　]+/g, "");
}

/** 「東大」「とうだい」「Todai」「Tokyo University」どれでも当たるよう、
 *  name + aliases をすべて正規化してキーに含める。 */
function makeSearchKey(item: GoalItem): string {
  return [item.name, ...(item.aliases ?? [])].map(normalizeForGoalSearch).join("|");
}

const SEARCH_KEY_CACHE = new WeakMap<GoalItem, string>();

export function searchGoals(query: string, kind?: GoalKind): GoalItem[] {
  const q = normalizeForGoalSearch(query.trim());
  const pool = kind ? GOAL_CATALOG.filter((g) => g.kind === kind) : GOAL_CATALOG;
  if (!q) return pool;
  return pool.filter((item) => {
    let key = SEARCH_KEY_CACHE.get(item);
    if (!key) {
      key = makeSearchKey(item);
      SEARCH_KEY_CACHE.set(item, key);
    }
    return key.includes(q);
  });
}

export function findGoalById(id: string): GoalItem | undefined {
  return GOAL_CATALOG.find((g) => g.id === id);
}

export const GOAL_KIND_LABEL: Record<GoalKind, string> = {
  highschool: "高校受験",
  university: "大学受験",
  qualification: "資格",
};
