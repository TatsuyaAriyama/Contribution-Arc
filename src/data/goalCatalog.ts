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

  // 拡充: 全国の代表的進学校 (要望対応)
  // ── 北海道・東北
  { id: "hs-sapporo-minami", kind: "highschool", name: "札幌南高校", aliases: ["さっぽろみなみ"] },
  { id: "hs-sapporo-kita", kind: "highschool", name: "札幌北高校", aliases: ["さっぽろきた"] },
  { id: "hs-asahikawa-higashi", kind: "highschool", name: "旭川東高校", aliases: ["あさひかわひがし"] },
  { id: "hs-sendai-niban", kind: "highschool", name: "仙台第二高校", aliases: ["せんだいにこう"] },
  { id: "hs-sendai-ichi", kind: "highschool", name: "仙台第一高校", aliases: ["せんだいいちこう"] },
  { id: "hs-morioka-ichi", kind: "highschool", name: "盛岡第一高校", aliases: ["もりおかいちこう"] },
  { id: "hs-akita", kind: "highschool", name: "秋田高校", aliases: ["あきた"] },
  { id: "hs-yamagata-higashi", kind: "highschool", name: "山形東高校", aliases: ["やまがたひがし"] },
  { id: "hs-aoba", kind: "highschool", name: "青葉学園高校", aliases: ["あおば"] },
  { id: "hs-fukushima", kind: "highschool", name: "福島高校", aliases: ["ふくしま"] },
  { id: "hs-asakawa", kind: "highschool", name: "安積高校", aliases: ["あさか"] },
  // ── 関東 (拡充)
  { id: "hs-mito-ichi", kind: "highschool", name: "水戸第一高校", aliases: ["みといちこう"] },
  { id: "hs-tochigi", kind: "highschool", name: "栃木高校", aliases: ["とちぎ"] },
  { id: "hs-utsunomiya", kind: "highschool", name: "宇都宮高校", aliases: ["うつのみや"] },
  { id: "hs-maebashi", kind: "highschool", name: "前橋高校", aliases: ["まえばし"] },
  { id: "hs-takasaki", kind: "highschool", name: "高崎高校", aliases: ["たかさき"] },
  { id: "hs-kawagoe", kind: "highschool", name: "川越高校", aliases: ["かわごえ"] },
  { id: "hs-saitama-ichijo", kind: "highschool", name: "県立浦和第一女子高校", aliases: ["うらわいちじょ"] },
  { id: "hs-funabashi", kind: "highschool", name: "県立船橋高校", aliases: ["ふなばし"] },
  { id: "hs-toho-univ", kind: "highschool", name: "東邦大学付属東邦高校", aliases: ["とうほう"] },
  { id: "hs-narita-kokusai", kind: "highschool", name: "成田国際高校", aliases: ["なりた"] },
  // ── 東京 (拡充)
  { id: "hs-shibuya-shibuya", kind: "highschool", name: "渋谷教育学園渋谷高校", aliases: ["しぶしぶ"] },
  { id: "hs-haruna-jissen", kind: "highschool", name: "豊島岡女子学園高校", aliases: ["としまがおか"] },
  { id: "hs-musashi", kind: "highschool", name: "武蔵高校", aliases: ["むさし"] },
  { id: "hs-komaba-tokyo", kind: "highschool", name: "駒場東邦高校", aliases: ["こまばとうほう"] },
  { id: "hs-honjo-tokyo", kind: "highschool", name: "本郷高校", aliases: ["ほんごう"] },
  { id: "hs-housai", kind: "highschool", name: "海城高校", aliases: ["かいじょう"] },
  { id: "hs-attached-tokyo-gakugei", kind: "highschool", name: "東京学芸大学附属高校", aliases: ["がくげい"] },
  { id: "hs-toyama-tokyo", kind: "highschool", name: "都立戸山高校", aliases: ["とやま"] },
  { id: "hs-tachikawa", kind: "highschool", name: "都立立川高校", aliases: ["たちかわ"] },
  { id: "hs-tokyo-mita", kind: "highschool", name: "都立三田高校", aliases: ["みた"] },
  { id: "hs-tokyo-koishikawa", kind: "highschool", name: "都立小石川中等教育学校", aliases: ["こいしかわ"] },
  { id: "hs-toho-tokyo", kind: "highschool", name: "桐朋高校", aliases: ["とうほう"] },
  { id: "hs-rikkyo-niiza", kind: "highschool", name: "立教新座高校", aliases: ["にいざ"] },
  { id: "hs-meiji-meiji", kind: "highschool", name: "明治大学付属明治高校", aliases: ["めいだいめいじ"] },
  { id: "hs-tamamuro-meiji", kind: "highschool", name: "明治大学付属中野高校", aliases: ["めいなか"] },
  { id: "hs-shoko-nakano", kind: "highschool", name: "中央大学附属高校", aliases: ["ちゅうふ"] },
  { id: "hs-keio-shiki", kind: "highschool", name: "慶應義塾志木高校", aliases: ["しき"] },
  { id: "hs-keio-shonan-fujisawa", kind: "highschool", name: "慶應義塾湘南藤沢高等部", aliases: ["SFC"] },
  // ── 神奈川 / 千葉 / 埼玉
  { id: "hs-yokohama-keita", kind: "highschool", name: "横浜サイエンスフロンティア高校", aliases: ["YSFH"] },
  { id: "hs-kawasaki-kahaku", kind: "highschool", name: "県立横浜サイエンスフロンティア高校", aliases: [] },
  { id: "hs-zushi-kaisei", kind: "highschool", name: "逗子開成高校", aliases: ["ずしかいせい"] },
  { id: "hs-yokohama-hayama", kind: "highschool", name: "県立柏陽高校", aliases: ["はくよう"] },
  { id: "hs-funabashi-yamashina", kind: "highschool", name: "東邦大学付属東邦中・高校", aliases: ["とうほう"] },
  { id: "hs-saitama-omiya-2", kind: "highschool", name: "県立大宮高校 (理数科)", aliases: ["おおみやりすう"] },
  // ── 中部
  { id: "hs-fukui-kanzaki", kind: "highschool", name: "藤島高校", aliases: ["ふじしま"] },
  { id: "hs-nagano-matsumoto", kind: "highschool", name: "松本深志高校", aliases: ["ふかし"] },
  { id: "hs-niigata", kind: "highschool", name: "新潟高校", aliases: ["にいがた"] },
  { id: "hs-toyama-chubu", kind: "highschool", name: "富山中部高校", aliases: ["とやまちゅうぶ"] },
  { id: "hs-kanazawa-izumigaoka", kind: "highschool", name: "金沢泉丘高校", aliases: ["かなざわいずみがおか"] },
  { id: "hs-shizuoka", kind: "highschool", name: "県立静岡高校", aliases: ["しずおか"] },
  { id: "hs-numazu-higashi", kind: "highschool", name: "沼津東高校", aliases: ["ぬまづひがし"] },
  { id: "hs-okazaki-aichi", kind: "highschool", name: "岡崎高校 (愛知)", aliases: ["おかざきあいち"] },
  { id: "hs-asahigaoka-aichi", kind: "highschool", name: "旭丘高校 (愛知)", aliases: ["あさひがおか"] },
  { id: "hs-meijo-fuzoku", kind: "highschool", name: "名城大学附属高校", aliases: ["めいじょう"] },
  { id: "hs-nanzan", kind: "highschool", name: "南山高校", aliases: ["なんざん"] },
  { id: "hs-toukai-meijo", kind: "highschool", name: "海陽中等教育学校", aliases: ["かいよう"] },
  { id: "hs-gifu", kind: "highschool", name: "県立岐阜高校", aliases: ["ぎふ"] },
  // ── 近畿 (拡充)
  { id: "hs-otemon-osaka", kind: "highschool", name: "大手前高校", aliases: ["おおてまえ"] },
  { id: "hs-osaka-suita-fukuoka", kind: "highschool", name: "府立茨木高校", aliases: ["いばらき"] },
  { id: "hs-toyonaka", kind: "highschool", name: "府立豊中高校", aliases: ["とよなか"] },
  { id: "hs-takatsuki-meiji", kind: "highschool", name: "高槻高校", aliases: ["たかつき"] },
  { id: "hs-kwansei-gakuin-jhs", kind: "highschool", name: "関西学院高等部", aliases: ["かんがく"] },
  { id: "hs-kobe", kind: "highschool", name: "県立神戸高校", aliases: ["こうべ"] },
  { id: "hs-himeji-nishi", kind: "highschool", name: "県立姫路西高校", aliases: ["ひめじにし"] },
  { id: "hs-osaka-tezuka", kind: "highschool", name: "帝塚山高校", aliases: ["てづかやま"] },
  { id: "hs-osaka-koyo", kind: "highschool", name: "甲陽学院中・高校", aliases: ["こうよう"] },
  { id: "hs-osaka-kobe-jogakuin", kind: "highschool", name: "神戸女学院高等部", aliases: ["こうべじょがくいん"] },
  { id: "hs-kyoto-saiin", kind: "highschool", name: "府立堀川高校", aliases: ["ほりかわ"] },
  { id: "hs-kyoto-nishikyo", kind: "highschool", name: "府立西京高校", aliases: ["にしきょう"] },
  { id: "hs-doshisha-jhs", kind: "highschool", name: "同志社高校", aliases: ["どうしゃ"] },
  { id: "hs-ritsumeikan-kyoto", kind: "highschool", name: "立命館高校", aliases: ["りつめいかん"] },
  { id: "hs-nara-koka", kind: "highschool", name: "県立奈良高校", aliases: ["なら"] },
  { id: "hs-wakayama-chiben", kind: "highschool", name: "智辯学園和歌山高校", aliases: ["ちべんわかやま"] },
  // ── 中国 / 四国
  { id: "hs-okayama-asahi", kind: "highschool", name: "県立岡山朝日高校", aliases: ["おかやまあさひ"] },
  { id: "hs-okayama-souzan", kind: "highschool", name: "県立岡山操山高校", aliases: ["そうざん"] },
  { id: "hs-hiroshima-univ-fukuyama", kind: "highschool", name: "広島大学附属福山高校", aliases: ["ひろふく"] },
  { id: "hs-shudo", kind: "highschool", name: "修道高校", aliases: ["しゅうどう"] },
  { id: "hs-aiko", kind: "highschool", name: "AICJ高校", aliases: ["AICJ"] },
  { id: "hs-yamaguchi-shimonoseki", kind: "highschool", name: "下関西高校", aliases: ["しものせきにし"] },
  { id: "hs-tokushima-jonan", kind: "highschool", name: "県立城南高校", aliases: ["じょうなん"] },
  { id: "hs-matsuyama-higashi", kind: "highschool", name: "松山東高校", aliases: ["まつやまひがし"] },
  { id: "hs-kochi-tosa", kind: "highschool", name: "土佐高校", aliases: ["とさ"] },
  { id: "hs-kagawa-takamatsu", kind: "highschool", name: "高松高校", aliases: ["たかまつ"] },
  // ── 九州 / 沖縄
  { id: "hs-fukuoka-ohori", kind: "highschool", name: "福岡大学附属大濠高校", aliases: ["おおほり"] },
  { id: "hs-saga-nishi", kind: "highschool", name: "県立佐賀西高校", aliases: ["さがにし"] },
  { id: "hs-nagasaki-nishi", kind: "highschool", name: "長崎西高校", aliases: ["ながさきにし"] },
  { id: "hs-kumamoto", kind: "highschool", name: "県立熊本高校", aliases: ["くまもと"] },
  { id: "hs-oita-maizuru", kind: "highschool", name: "県立大分舞鶴高校", aliases: ["まいづる"] },
  { id: "hs-miyazaki-nishi", kind: "highschool", name: "宮崎西高校", aliases: ["みやざきにし"] },
  { id: "hs-kagoshima-tsuruoka", kind: "highschool", name: "鶴丸高校", aliases: ["つるまる"] },
  { id: "hs-kagoshima-chuoh", kind: "highschool", name: "県立鹿児島中央高校", aliases: ["かごちゅう"] },
  { id: "hs-okinawa-shogaku", kind: "highschool", name: "県立開邦高校", aliases: ["かいほう"] },
  { id: "hs-okinawa-naha-kokusai", kind: "highschool", name: "県立那覇国際高校", aliases: ["なはこくさい"] },
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

  // 拡充 (要望対応): 地方国公立 / 私立 / 医科系 / 海外
  // ── 地方国立 (北海道・東北)
  { id: "u-otaru-shoka", kind: "university", name: "小樽商科大学", aliases: ["おたしょう"] },
  { id: "u-hokkaido-edu", kind: "university", name: "北海道教育大学", aliases: [] },
  { id: "u-hirosaki", kind: "university", name: "弘前大学", aliases: ["ひろさき"] },
  { id: "u-iwate", kind: "university", name: "岩手大学", aliases: ["いわて"] },
  { id: "u-akita-univ", kind: "university", name: "秋田大学", aliases: ["あきた"] },
  { id: "u-yamagata", kind: "university", name: "山形大学", aliases: ["やまがた"] },
  { id: "u-fukushima", kind: "university", name: "福島大学", aliases: ["ふくしま"] },
  { id: "u-miyagi-kyoiku", kind: "university", name: "宮城教育大学", aliases: [] },
  // ── 関東 (地方国公立 / 主要私立)
  { id: "u-ibaraki", kind: "university", name: "茨城大学", aliases: ["いばらき"] },
  { id: "u-utsunomiya", kind: "university", name: "宇都宮大学", aliases: ["うつのみや"] },
  { id: "u-gunma", kind: "university", name: "群馬大学", aliases: ["ぐんま"] },
  { id: "u-saitama-univ", kind: "university", name: "埼玉大学", aliases: ["さいだい"] },
  { id: "u-chiba", kind: "university", name: "千葉大学", aliases: ["ちば"] },
  { id: "u-yokohama-shiritsu", kind: "university", name: "横浜市立大学", aliases: ["よこいち"] },
  { id: "u-kanagawa", kind: "university", name: "神奈川大学", aliases: ["かながわ"] },
  // ── 中部・近畿 国公立
  { id: "u-shinshu", kind: "university", name: "信州大学", aliases: ["しんしゅう"] },
  { id: "u-niigata", kind: "university", name: "新潟大学", aliases: ["にいがた"] },
  { id: "u-toyama", kind: "university", name: "富山大学", aliases: ["とやま"] },
  { id: "u-kanazawa", kind: "university", name: "金沢大学", aliases: ["かなざわ", "きんだい(国)"] },
  { id: "u-fukui-univ", kind: "university", name: "福井大学", aliases: ["ふくい"] },
  { id: "u-yamanashi", kind: "university", name: "山梨大学", aliases: ["やまなし"] },
  { id: "u-shizuoka-univ", kind: "university", name: "静岡大学", aliases: ["しずおか"] },
  { id: "u-mie", kind: "university", name: "三重大学", aliases: ["みえ"] },
  { id: "u-shiga", kind: "university", name: "滋賀大学", aliases: ["しが"] },
  { id: "u-nara-univ", kind: "university", name: "奈良女子大学", aliases: ["なら"] },
  { id: "u-wakayama-univ", kind: "university", name: "和歌山大学", aliases: ["わかやま"] },
  { id: "u-kyoto-edu", kind: "university", name: "京都教育大学", aliases: [] },
  { id: "u-osaka-edu", kind: "university", name: "大阪教育大学", aliases: [] },
  { id: "u-hyogo-univ", kind: "university", name: "兵庫県立大学", aliases: ["ひょうご"] },
  // ── 中国 / 四国 国公立
  { id: "u-okayama", kind: "university", name: "岡山大学", aliases: ["おかだい"] },
  { id: "u-hiroshima", kind: "university", name: "広島大学", aliases: ["ひろだい"] },
  { id: "u-yamaguchi-univ", kind: "university", name: "山口大学", aliases: ["やまぐち"] },
  { id: "u-tottori", kind: "university", name: "鳥取大学", aliases: ["とっとり"] },
  { id: "u-shimane", kind: "university", name: "島根大学", aliases: ["しまね"] },
  { id: "u-tokushima", kind: "university", name: "徳島大学", aliases: ["とくしま"] },
  { id: "u-kagawa", kind: "university", name: "香川大学", aliases: ["かがわ"] },
  { id: "u-ehime", kind: "university", name: "愛媛大学", aliases: ["えひめ"] },
  { id: "u-kochi", kind: "university", name: "高知大学", aliases: ["こうち"] },
  // ── 九州 / 沖縄 国公立
  { id: "u-saga", kind: "university", name: "佐賀大学", aliases: ["さが"] },
  { id: "u-nagasaki", kind: "university", name: "長崎大学", aliases: ["ながさき"] },
  { id: "u-kumamoto", kind: "university", name: "熊本大学", aliases: ["くまもと"] },
  { id: "u-oita", kind: "university", name: "大分大学", aliases: ["おおいた"] },
  { id: "u-miyazaki", kind: "university", name: "宮崎大学", aliases: ["みやざき"] },
  { id: "u-kagoshima", kind: "university", name: "鹿児島大学", aliases: ["かごしま"] },
  { id: "u-ryukyu", kind: "university", name: "琉球大学", aliases: ["りゅうきゅう"] },
  // ── 私立 (関東主要)
  { id: "u-aoyama-shogei", kind: "university", name: "成蹊大学", aliases: ["せいけい"] },
  { id: "u-seijo", kind: "university", name: "成城大学", aliases: ["せいじょう"] },
  { id: "u-meijigakuin", kind: "university", name: "明治学院大学", aliases: ["めいがく"] },
  { id: "u-dokkyo", kind: "university", name: "獨協大学", aliases: ["どっきょう"] },
  { id: "u-kokugakuin", kind: "university", name: "國學院大學", aliases: ["こくがくいん"] },
  { id: "u-musashi", kind: "university", name: "武蔵大学", aliases: ["むさし"] },
  { id: "u-tamagawa", kind: "university", name: "玉川大学", aliases: ["たまがわ"] },
  { id: "u-toyo-eiwa", kind: "university", name: "東洋英和女学院大学", aliases: ["とうようえいわ"] },
  { id: "u-tsudajuku", kind: "university", name: "津田塾大学", aliases: ["つだじゅく"] },
  { id: "u-tokyo-joshi", kind: "university", name: "東京女子大学", aliases: ["とんじょ"] },
  { id: "u-nihon-joshi", kind: "university", name: "日本女子大学", aliases: ["にちじょ"] },
  { id: "u-shinjuku-keiyo", kind: "university", name: "聖心女子大学", aliases: ["せいしん"] },
  { id: "u-keio-sfc", kind: "university", name: "慶應義塾大学 SFC", aliases: ["SFC", "湘南藤沢"] },
  // ── 私立 (理工系)
  { id: "u-shibaura-it", kind: "university", name: "芝浦工業大学", aliases: ["しばうら"] },
  { id: "u-tdu", kind: "university", name: "東京電機大学", aliases: ["でんき"] },
  { id: "u-kogakuin", kind: "university", name: "工学院大学", aliases: ["こうがくいん"] },
  { id: "u-tcu", kind: "university", name: "東京都市大学", aliases: ["とし"] },
  { id: "u-tokyo-noko", kind: "university", name: "東京農工大学", aliases: ["のうこう"] },
  // ── 関西主要私立 (追加)
  { id: "u-kobegakuin", kind: "university", name: "神戸学院大学", aliases: ["こうべがくいん"] },
  { id: "u-momoyama-gakuin", kind: "university", name: "桃山学院大学", aliases: ["ももやま"] },
  { id: "u-otemon-gakuin", kind: "university", name: "追手門学院大学", aliases: ["おうてもん"] },
  { id: "u-osaka-shoin", kind: "university", name: "大阪樟蔭女子大学", aliases: ["しょういん"] },
  { id: "u-osaka-keizai", kind: "university", name: "大阪経済大学", aliases: ["だいけい"] },
  { id: "u-osaka-kogyo", kind: "university", name: "大阪工業大学", aliases: ["おおこう"] },
  // ── 私立医科 / 歯科 / 薬科
  { id: "u-iwate-ika", kind: "university", name: "岩手医科大学", aliases: ["いわていか"] },
  { id: "u-toho-ika", kind: "university", name: "東邦大学医学部", aliases: ["とうほういか"] },
  { id: "u-nippon-ika", kind: "university", name: "日本医科大学", aliases: ["にちい"] },
  { id: "u-kitasato", kind: "university", name: "北里大学", aliases: ["きたさと"] },
  { id: "u-showa", kind: "university", name: "昭和大学", aliases: ["しょうわ"] },
  { id: "u-toho-university", kind: "university", name: "東邦大学", aliases: ["とうほう"] },
  { id: "u-tokyo-ika", kind: "university", name: "東京医科大学", aliases: ["とういか"] },
  { id: "u-kawasaki-ika", kind: "university", name: "川崎医科大学", aliases: ["かわさきいか"] },
  // ── 美術 / 音楽 / 体育
  { id: "u-tama-bijutsu", kind: "university", name: "多摩美術大学", aliases: ["たまび"] },
  { id: "u-musashino-bijutsu", kind: "university", name: "武蔵野美術大学", aliases: ["むさび"] },
  { id: "u-joshibi", kind: "university", name: "女子美術大学", aliases: ["じょしび"] },
  { id: "u-kanazawa-bi", kind: "university", name: "金沢美術工芸大学", aliases: ["きんびこう"] },
  { id: "u-kyoto-seika", kind: "university", name: "京都精華大学", aliases: ["せいか"] },
  { id: "u-kyoto-bijutsu", kind: "university", name: "京都市立芸術大学", aliases: ["きょうげい"] },
  { id: "u-toho-ongaku", kind: "university", name: "桐朋学園大学 (音楽)", aliases: ["とうほう"] },
  { id: "u-musashino-ongaku", kind: "university", name: "武蔵野音楽大学", aliases: ["むさおん"] },
  { id: "u-nittai", kind: "university", name: "日本体育大学", aliases: ["にったい"] },
  // ── 海外 (拡充)
  { id: "u-berkeley", kind: "university", name: "UC Berkeley", aliases: ["バークレー"] },
  { id: "u-ucla", kind: "university", name: "UCLA", aliases: ["ロサンゼルス"] },
  { id: "u-columbia", kind: "university", name: "Columbia University", aliases: ["コロンビア"] },
  { id: "u-princeton", kind: "university", name: "Princeton University", aliases: ["プリンストン"] },
  { id: "u-yale", kind: "university", name: "Yale University", aliases: ["イェール"] },
  { id: "u-cornell", kind: "university", name: "Cornell University", aliases: ["コーネル"] },
  { id: "u-upenn", kind: "university", name: "University of Pennsylvania", aliases: ["ペンシルベニア"] },
  { id: "u-chicago", kind: "university", name: "University of Chicago", aliases: ["シカゴ"] },
  { id: "u-cmu", kind: "university", name: "Carnegie Mellon University", aliases: ["カーネギーメロン"] },
  { id: "u-georgia-tech", kind: "university", name: "Georgia Tech", aliases: ["ジョージア工科"] },
  { id: "u-imperial", kind: "university", name: "Imperial College London", aliases: ["インペリアル"] },
  { id: "u-ucl", kind: "university", name: "University College London", aliases: ["UCL"] },
  { id: "u-kings-college", kind: "university", name: "King's College London", aliases: ["キングスカレッジ"] },
  { id: "u-lse", kind: "university", name: "London School of Economics", aliases: ["LSE"] },
  { id: "u-edinburgh", kind: "university", name: "University of Edinburgh", aliases: ["エディンバラ"] },
  { id: "u-toronto", kind: "university", name: "University of Toronto", aliases: ["トロント"] },
  { id: "u-mcgill", kind: "university", name: "McGill University", aliases: ["マギル"] },
  { id: "u-ubc", kind: "university", name: "University of British Columbia", aliases: ["UBC"] },
  { id: "u-sydney", kind: "university", name: "University of Sydney", aliases: ["シドニー"] },
  { id: "u-melbourne", kind: "university", name: "University of Melbourne", aliases: ["メルボルン"] },
  { id: "u-anu", kind: "university", name: "Australian National University", aliases: ["ANU"] },
  { id: "u-ntu-singapore", kind: "university", name: "Nanyang Technological University", aliases: ["NTU"] },
  { id: "u-hkust", kind: "university", name: "Hong Kong University of Science and Technology", aliases: ["HKUST"] },
  { id: "u-hku", kind: "university", name: "University of Hong Kong", aliases: ["HKU"] },
  { id: "u-snu", kind: "university", name: "Seoul National University", aliases: ["ソウル大"] },
  { id: "u-tsinghua", kind: "university", name: "清華大学", aliases: ["せいか"] },
  { id: "u-peking", kind: "university", name: "北京大学", aliases: ["ぺきん"] },
  { id: "u-tum", kind: "university", name: "TU Munich", aliases: ["ミュンヘン工科"] },
  { id: "u-epfl", kind: "university", name: "EPFL", aliases: ["ローザンヌ"] },
  { id: "u-delft", kind: "university", name: "Delft University of Technology", aliases: ["デルフト"] },
  { id: "u-kaist", kind: "university", name: "KAIST", aliases: ["カイスト"] },
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
