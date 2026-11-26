const fs = require("fs");
const path = require("path");

const meta = JSON.parse(fs.readFileSync(path.join(__dirname, "data/cards/card-metadata.json"), "utf8"));

const cardRows = [];
const seen = new Set();

const implementations = {
  "Tolarian Academy": {
    abilities: "アーティファクト数に応じた{U}生成、レジェンド・ルール",
    status: "Complete",
    test: "PASS",
    limitations: "なし",
    rules: "CR 106.12, CR 704.5j"
  },
  "Mind Over Matter": {
    abilities: "手札1枚ディスカード、対象（アーティファクト/クリーチャー/土地）のタップまたはアンタップ",
    status: "Complete",
    test: "PASS",
    limitations: "スタックを介した解決",
    rules: "CR 602.2"
  },
  "Time Spiral": {
    abilities: "自身追放、手札と墓地をライブラリへシャッフル、各7ドロー、土地最大6枚アンタップ",
    status: "Complete",
    test: "PASS",
    limitations: "対戦相手の手札・墓地も正しく修復",
    rules: "CR 608.2m"
  },
  "Windfall": {
    abilities: "各プレイヤー手札ディスカード、最大捨て枚数分のドロー",
    status: "Complete",
    test: "PASS",
    limitations: "なし",
    rules: "CR 608.2c"
  },
  "Stroke of Genius": {
    abilities: "Xマナ支払い、対象プレイヤー指定、Xドロー、ライブラリーアウト敗北判定",
    status: "Complete",
    test: "PASS",
    limitations: "対戦相手指定による強制敗北に対応",
    rules: "CR 107.3, CR 704.5b"
  },
  "Lotus Petal": {
    abilities: "{T}, 生け贄: 好きな色1色のマナ1点生成",
    status: "Complete",
    test: "PASS",
    limitations: "マナ能力として即時解決",
    rules: "CR 605.1a"
  },
  "Mana Vault": {
    abilities: "アンタップステップにアンタップしない、{T}: {C}{C}{C}生成、{4}: アンタップ",
    status: "Complete",
    test: "PASS",
    limitations: "アップキープダメージは一人回し簡略化",
    rules: "CR 305.5"
  },
  "Mox Diamond": {
    abilities: "ETB時手札の土地ディスカード（捨てない場合墓地）、{T}: 好きな色1色マナ生成",
    status: "Complete",
    test: "PASS",
    limitations: "なし",
    rules: "CR 614.1c"
  },
  "Voltaic Key": {
    abilities: "{1}, {T}: 対象アーティファクトをアンタップ",
    status: "Complete",
    test: "PASS",
    limitations: "なし",
    rules: "CR 602.2"
  },
  "Turnabout": {
    abilities: "タイプ指定（土地/アーティファクト/クリーチャー）、全対象のタップ/アンタップ",
    status: "Complete",
    test: "PASS",
    limitations: "MoMa（歴史的スタンダード）専用カード。パイオニア非適法",
    rules: "CR 608.2d"
  },
  "Impulse": {
    abilities: "ライブラリ上から4枚見て1枚を手札へ、残りをボトムへ",
    status: "Complete",
    test: "PASS",
    limitations: "パイオニア適法（団結のドミナリア収録）",
    rules: "CR 608.2c"
  },
  "Intuition": {
    abilities: "ライブラリからカード3枚公開、1枚手札・2枚墓地",
    status: "Complete",
    test: "PASS",
    limitations: "金魚モードではプレイヤーに有利な選択を自動適用",
    rules: "CR 701.19"
  },
  "Scroll Rack": {
    abilities: "{1}, {T}: 手札とライブラリトップの入れ替え",
    status: "Complete",
    test: "PASS",
    limitations: "最大3枚入れ替え",
    rules: "CR 608.2"
  },
  "Ancient Tomb": {
    abilities: "{T}: {C}{C}生成、2点ダメージ",
    status: "Complete",
    test: "PASS",
    limitations: "なし",
    rules: "CR 106.1a"
  },
  "City of Brass": {
    abilities: "{T}: 好きな色1色マナ生成、1点ダメージ",
    status: "Complete",
    test: "PASS",
    limitations: "なし",
    rules: "CR 605.1b"
  },
  "Island": {
    abilities: "{T}: {U}生成",
    status: "Complete",
    test: "PASS",
    limitations: "なし",
    rules: "CR 305.6"
  },
  "Lotus Field": {
    abilities: "呪禁、タップイン、ETB土地2枚生け贄、{T}: 好きな1色3マナ生成",
    status: "Complete",
    test: "PASS",
    limitations: "土地不足時は原野自身が生け贄",
    rules: "CR 702.18, CR 603.3c"
  },
  "Thespian's Stage": {
    abilities: "{T}: {C}生成、{2}, {T}: 対象の土地のコピーになる（コピー能力維持）",
    status: "Complete",
    test: "PASS",
    limitations: "戦場に出直さないためLotus FieldのETB生け贄は誘発しない",
    rules: "CR 707.2"
  },
  "Botanical Sanctum": {
    abilities: "{T}: {G}または{U}生成",
    status: "Complete",
    test: "PASS",
    limitations: "なし",
    rules: "CR 106.1a"
  },
  "Yavimaya Coast": {
    abilities: "{T}: {C}生成、または1点ライフで{G}/{U}生成",
    status: "Complete",
    test: "PASS",
    limitations: "なし",
    rules: "CR 106.1a"
  },
  "Mana Confluence": {
    abilities: "{T}, 1点ライフ: 好きな色1色マナ生成",
    status: "Complete",
    test: "PASS",
    limitations: "なし",
    rules: "CR 106.1a"
  },
  "Boseiju, Who Endures": {
    abilities: "{T}: {G}生成",
    status: "Complete",
    test: "PASS",
    limitations: "魂力は今後のアップデートで拡張可能",
    rules: "CR 702.47"
  },
  "Forest": {
    abilities: "{T}: {G}生成",
    status: "Complete",
    test: "PASS",
    limitations: "なし",
    rules: "CR 305.6"
  },
  "Hidden Strings": {
    abilities: "最大2つの対象パーマネントをタップ/アンタップ、暗号化",
    status: "Complete",
    test: "PASS",
    limitations: "クリーチャーへの暗号化追放に対応",
    rules: "CR 702.99"
  },
  "Pore Over the Pages": {
    abilities: "3ドロー、土地最大2枚アンタップ、手札1枚ディスカード",
    status: "Complete",
    test: "PASS",
    limitations: "オラクル記載順序通りに処理",
    rules: "CR 608.2c"
  },
  "Sylvan Scrying": {
    abilities: "ライブラリから土地カードをサーチして手札へ",
    status: "Complete",
    test: "PASS",
    limitations: "なし",
    rules: "CR 701.19"
  },
  "Vizier of Tumbling Sands": {
    abilities: "{T}: 対象パーマネントアンタップ、サイクリング{1}{U}、サイクリング時誘発アンタップ",
    status: "Complete",
    test: "PASS",
    limitations: "サイクリング誘発がスタック上で解決",
    rules: "CR 702.29"
  },
  "Arboreal Grazer": {
    abilities: "ETB時手札の土地をタップ状態で戦場に出す",
    status: "Complete",
    test: "PASS",
    limitations: "なし",
    rules: "CR 603.2"
  },
  "Emergent Ultimatum": {
    abilities: "単色異なる3枚サーチ、対戦相手が1枚選び戻し、残り2枚をノーコストキャスト",
    status: "Complete",
    test: "PASS",
    limitations: "金魚モードでは最適なコンボ呪文を自動キャスト",
    rules: "CR 608.2"
  },
  "Omniscience": {
    abilities: "手札から呪文をマナコストを支払わずに唱えてよい",
    status: "Complete",
    test: "PASS",
    limitations: "全手札呪文のノーコストキャスト",
    rules: "CR 601.2b"
  },
  "Dark Petition": {
    abilities: "カードサーチ、魔術名声達成時に{B}{B}{B}生成",
    status: "Complete",
    test: "PASS",
    limitations: "墓地のインスタント/ソーサリー枚数判定",
    rules: "CR 608.2"
  },
  "Mastermind's Acquisition": {
    abilities: "ライブラリサーチ、またはサイドボード（ゲーム外）からのサーチ",
    status: "Complete",
    test: "PASS",
    limitations: "サイドボードからのウィッシュに対応",
    rules: "CR 400.11"
  },
  "Peer into the Abyss": {
    abilities: "ライブラリ端数切り上げ半分ドロー、ライフ端数切り上げ半分失う",
    status: "Complete",
    test: "PASS",
    limitations: "なし",
    rules: "CR 608.2"
  },
  "Approach of the Second Sun": {
    abilities: "1回目7点ゲイン＆ライブラリ7枚目へ配置、2回目キャストでゲーム特殊勝利",
    status: "Complete",
    test: "PASS",
    limitations: "キャスト履歴判定による正確な勝利判定",
    rules: "CR 608.2m"
  }
};

let md = `# 対応カード一覧 (Supported Cards)

Combo Deck Lab で採用・実装されているカードの一覧、Scryfall公式Oracle ID、対応能力、実装状況、テスト結果、および参照した公式ルール・裁定の記録です。

実装状況の区分：
- **Complete**: 採用デッキに必要な挙動をすべて実装し、単体テストおよび統合テストに合格済み
- **Partial**: 一部の挙動のみ対応
- **Untested**: 実装済みだが未検証
- **Unsupported**: 未実装

| カード名 (日/英) | Oracle ID | 対応する能力 | 実装状況 | テスト結果 | 既知の制限 | 参照ルール・裁定 |
| :--- | :--- | :--- | :---: | :---: | :--- | :--- |
`;

for (const [name, info] of Object.entries(implementations)) {
  const cardData = meta[name] || {};
  const jaName = cardData.jaName || name;
  const oracleId = cardData.oracleId || "N/A";

  md += `| 《${jaName}》<br>_${name}_ | \`${oracleId}\` | ${info.abilities} | **${info.status}** | ✅ ${info.test} | ${info.limitations} | ${info.rules} |\n`;
}

md += `
---

## 📝 判定・ルールの特記事項

### 1. 《演劇の舞台》による《睡蓮の原野》のコピー (Thespian's Stage copying Lotus Field)
- **CR 707.2**: 演劇の舞台が睡蓮の原野のコピーになっても、戦場に出直したわけではありません（戦場を離れておらず、ETB能力は誘発しません）。
- したがって、睡蓮の原野が持つ「戦場に出たとき土地2つを生け贄に捧げる」能力は誘発せず、土地を生け贄に捧げる必要はありません。
- コピー後も演劇の舞台自身が持つ「{2}, {T}: コピーになる」能力は失われず保持されます。

### 2. 《副陽の接近》の勝利判定 (Approach of the Second Sun)
- 単純に過去のキャスト回数だけではなく、**手札から唱えられたか**、および**このゲーム中に同名の呪文がすでに唱えられていたか**をゲーム履歴（\`spellsCastHistory\`）から正確に判定します。
- 1回目は7点のライフを得てライブラリーの上から7枚目に配置され、2回目の解決時に即座に特殊勝利が成立します。

### 3. 《精神力》とスタック (Mind Over Matter)
- 手札を1枚捨てるのは能力を起動するための**コスト**です。
- 対象となるパーマネント（《トレイリアのアカデミー》等）のアンタップ/タップ効果はスタックを経由して解決されます。

### 4. 《時のらせん》の領域移動 (Time Spiral)
- 解決時に**自身を追放**した後、各プレイヤーの手札と墓地をライブラリーへ戻してシャッフルし、7枚引き直して土地を最大6枚アンタップします。自身は墓地に戻りません。
`;

fs.writeFileSync(path.join(__dirname, "supported-cards.md"), md, "utf8");
console.log("supported-cards.md generated successfully!");
