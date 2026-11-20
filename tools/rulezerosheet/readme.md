# Commander Rule Zero Sheet Maker (コマンダールールゼロシートメーカー)

> **「あなたのデッキを、1枚で伝える。」**  
> *"Introduce your Commander deck at a glance."*  
> **30秒で作成、ひと目で理解、すぐに共有。**

Magic: The Gathering（MTG）の統率者戦（EDH）における対戦前の「ルールゼロ（Rule 0）」コミュニケーションを円滑にするための、完全無料・登録不要・静的Webアプリケーションです。

---

## 1. アプリ概要

統率者、公式ブラケット（1〜5）、ゲームチェンジャー枚数、デッキの特徴、主な勝ち筋、事前に伝えたい希望対戦スタイルや避けたい展開をまとめ、16:9（1600×900px）の高解像度シート画像をブラウザ完結でリアルタイム生成します。

生成されたシートは、ワンクリックで画像クリップボードコピーまたはPNGダウンロードでき、Discord、SpellTable、リモート対戦、対面イベントですぐに共有できます。

---

## 2. 主要機能

- **簡単モード (Quick Mode)**:
  - 統率者、ブラケット、ゲームチェンジャー枚数、特徴チップを選ぶだけで約30秒でシートが完成。
- **詳細モード (Detailed Mode)**:
  - デッキ名、統率者のゲームプラン概要、主な勝ち筋、コンボと成立条件、想定決着ターン、プロキシ使用状況、自由記述メッセージまで網羅。
  - 簡単モードと詳細モードの切り替え時に共通データはすべて維持。
- **Scryfall API 連携**:
  - 日本語名・英語名の両方に対応したリアルタイムオートコンプリート検索。
  - 共闘（Partner）、背景選択（Choose a Background）、ドクターのコンパニオンなどの2枚統率者（パートナー）に対応。
  - 両面カード（Transform / MDFC）の画像自動解決。
  - API障害時や未登録カード用の手動名入力フォールバック。
  - デバウンス、AbortController、Scryfallレートリミット（50〜100ms間隔順守）、ブラウザ内キャッシュを完備。
- **コマンダーブラケット (Brackets 1〜5)**:
  - Wizards of the Coast および Commander Format Panel (CFP) の公式基準に準拠。
  - 1 (Exhibition), 2 (Core), 3 (Upgraded), 4 (Optimized), 5 (cEDH)
  - 選択ブラケットの上限を超えるGame Changersが含まれる場合の親切な警告通知（入力はブロックしません）。
- **ゲームチェンジャー管理 & デッキリスト自動解析**:
  - 手動数値入力に加え、デッキリストテキスト（Moxfield, MTGGoldfish, 直貼りテキスト等）を貼り付けてワンクリックでGame Changersカードを自動抽出・集計。
  - 手動設定（Manual）と自動解析（Deck Scanned）の出所ステータスを保持。
- **2種類のシートレイアウト**:
  - クイックシート (Compact) / 詳細シート (Detailed)
- **高品質画像出力 & 共有**:
  - 1600×900px (16:9) 高解像度PNG保存
  - クリップボードへの画像直接コピー（DiscordのチャットにそのままCtrl+Vで貼り付け可能）
  - Web Share API 連携
  - URLフラグメント（`#share=...`）によるサーバー不要のデッキ共有リンク
  - 印刷用レイアウト（print.css対応）
- **ローカル保存 & 複数デッキ管理**:
  - localStorage による自動保存・複数デッキ保存・複製・削除
  - JSONファイルとしてのエクスポート＆インポート（スキーマバージョン管理 & バリデーション付き）
- **UI & 国際化**:
  - 日本語（標準）/ 英語の即時切り替え
  - ダークテーマ / ライトテーマ（UIおよびシート背景それぞれ独立切替可能）
  - PC（左右2カラム分割）＆ スマートフォン（編集とプレビューをタブ切替、スクロール不要）完全レスポンシブ設計

---

## 3. 技術構成

- **フロントエンド言語**: HTML5, CSS3 (Classic CSS), Vanilla JavaScript (ES6+ Modules)
- **外部依存ライブラリ**: なし（Zero External npm Dependencies）
- **外部Web API**: Scryfall REST API (`https://api.scryfall.com`)
- **ブラウザ標準API**:
  - Canvas API (2D Context による 1600×900px シートレンダリング)
  - Clipboard API (`navigator.clipboard.write([ClipboardItem])`)
  - Web Share API (`navigator.share`)
  - Web Storage API (`localStorage`)
  - Fetch API & AbortController

---

## 4. ファイル構造

```text
tools/rulezerosheet/
├── index.html               # メインHTML（セマンティック構造、SEO、構造化データ）
├── css/
│   ├── style.css            # アプリケーション全体のクラシックスタイルシート
│   └── print.css            # 印刷用スタイルシート
├── js/
│   ├── app.js               # メインコントローラー（UIイベント・バインド）
│   ├── config.js            # 定数・ブラケット定義・API設定
│   ├── state.js             # リアクティブ状態管理ストア
│   ├── i18n.js              # 多言語切り替えマネージャー
│   ├── scryfall.js          # Scryfall API クライアント（検索・キャッシュ・バッチ）
│   ├── game-changers.js     # WotC/CFP Game Changers マスターデータベース
│   ├── deck-parser.js       # デッキリストテキストのパース・集計
│   ├── templates.js         # アーキタイプ別プリセットテンプレート
│   ├── sheet-renderer.js    # HTMLリアルタイムプレビュー & Canvas 2D 描画
│   ├── sheet-export.js      # PNG保存・クリップボードコピー・Web Share
│   ├── storage.js           # localStorage 複数デッキ保存 & JSONインポート/エクスポート
│   └── share.js             # URLフラグメント共有リンク生成 & 復元
├── lang/
│   ├── ja.js                # 日本語辞書
│   └── en.js                # 英語辞書
├── assets/
│   ├── favicon.svg          # ベクターファビコン
│   ├── favicon.ico          # マルチサイズICOファビコン
│   ├── apple-touch-icon.png # iOS/PWAアプリアイコン (512x512)
│   └── ogp.png              # SNS共有用OGP画像 (1200x630)
├── manifest.webmanifest     # PWA Web App Manifest
├── robots.txt               # クローラー制御
└── README.md                # 本ドキュメント
```

---

## 5. 起動方法 & 静的ホスティング配置

### ローカルでの起動

本ツールは完全静的Webサイト（HTML/CSS/JS）ですが、ES Modulesを使用しているため、ローカルで確認する際はHTTPサーバー経由で開くことを推奨します。

```bash
# Pythonの場合
python -m http.server 8000

# Node.js (npx) の場合
npx serve .
```

ブラウザで `http://localhost:8000/tools/rulezerosheet/` にアクセスします。

### TegralLabサブディレクトリ運用方法

すべての内部アセット参照は相対パス（`css/style.css`, `js/app.js`, `assets/...`）で設計されているため、任意のサブディレクトリ（例: `/tools/rulezerosheet/`）にフォルダごとアップロードするだけでそのまま動作します。

ルートパスが必要なメタタグ（OGP画像URLやCanonical URL）は `js/config.js` の `APP_CONFIG.baseUrl` で一括管理されています。

---

## 6. 仕様の更新・メンテナンス方法

### ブラケット仕様の更新

Wizards of the Coast または Commander Format Panel によるブラケット仕様（許容Game Changers数や想定ターン数など）が変更された場合、`js/config.js` の `brackets` 配列を更新してください。

```javascript
// js/config.js
brackets: [
  {
    id: 3,
    nameEn: "Upgraded",
    nameJa: "アップグレード",
    maxGameChangers: 3, // ここを変更
    expectedTurn: "6-8 turns",
    ...
  }
]
```

### ゲームチェンジャーリストの更新

Game Changers に新規カードが追加・削除された場合は、`js/game-changers.js` の `GAME_CHANGERS_DATABASE` 配列にカード名（英語・日本語）を追記または削除してください。

```javascript
// js/game-changers.js
export const GAME_CHANGERS_DATABASE = [
  { en: "Card Name", ja: "カード名", category: "mana" },
  ...
];
```

正規化検索により、スペースや記号の違い、大文字小文字は自動で吸収されます。

---

## 7. 保存データの形式 (JSON Schema v1)

```json
{
  "schemaVersion": 1,
  "deckId": "deck_lx8y9z",
  "deckName": "ロータスコンボ風EDH",
  "commanders": [
    {
      "id": "scryfall-uuid",
      "name": "Atraxa, Praetors' Voice",
      "printedName": "法務官の声、アトラクサ",
      "imageUrl": "https://cards.scryfall.io/...",
      "manaCost": "{G}{W}{U}{B}",
      "typeLine": "Legendary Creature — Phyrexian Angel Horror",
      "colorIdentity": ["G", "W", "U", "B"]
    }
  ],
  "bracket": 3,
  "gameChangerCount": 2,
  "gameChangerCountSource": "manual",
  "gameChangerCards": ["Rhystic Study", "Demonic Tutor"],
  "commanderDescription": "マナ加速から統率者を着地させ、盤面の増殖でリソース差を広げます。",
  "deckFeatures": ["戦闘ダメージ中心", "コンボ中心", "サーチ多め"],
  "winConditions": "無限マナからの大型X呪文でフィニッシュ",
  "comboDescription": "アシュノッドの供犠台 + 概念泥棒",
  "playPreferences": ["ゆっくり遊びたい", "適度に競技的なゲームがしたい"],
  "avoidPreferences": ["大量土地破壊は避けたい", "長時間のロックは避けたい"],
  "proxyStatus": "some",
  "approxWinTurn": "6-8 turns",
  "additionalNotes": "初心者卓歓迎です！",
  "sheetType": "quick",
  "sheetTheme": "dark",
  "createdAt": "2026-11-20T17:30:00.000Z",
  "updatedAt": "2026-11-20T17:35:00.000Z"
}
```

---

## 8. ブラウザ対応 & CORS

- **推奨ブラウザ**: Google Chrome, Mozilla Firefox, Apple Safari, Microsoft Edge（最新版）
- **クリップボード画像コピー**:
  - `navigator.clipboard.write([new ClipboardItem(...)])` に対応したブラウザおよびセキュアコンテキスト（HTTPS / localhost）で動作します。
  - 非対応ブラウザや権限拒否時は「PNG画像で保存」へスムーズにフォールバックします。
- **CORS（画像読み込み）**:
  - Scryfallの画像サーバーは `Access-Control-Allow-Origin: *` を返却するため、Canvasへの描画が可能です。
  - 万一オフライン時やネットワーク制限等でカード画像の読み込みがブロックされた場合でも、代替プレースホルダー枠を描画し、シート全体のPNG出力がエラーで中断しない設計になっています。

---

## 9. 権利・免責表記

- 本ツールはファンコンテンツ・ポリシーに沿った非公式のファンコンテンツです。ウィザーズ社の認可/許諾は得ていません。題材の一部に、ウィザーズ・オブ・ザ・コースト社の財産を含んでいます。©Wizards of the Coast LLC.
- カード情報および画像は Scryfall API を利用しています。
