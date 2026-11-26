# Combo Deck Lab (コンボ・デッキ・ラボ)

Magic: The Gathering（MTG）のコンボデッキに特化した、一人回し・コンボ練習・研究用Webアプリケーションです。

遊戯王のドグマブレードシミュレーターのように、プレイヤー自身がカードを手動で操作し、マナや手札などのリソースを厳密に管理しながら、コンボ成立を目指すシミュレーターです。

未実装カードによる曖昧な挙動や不完全な代替処理を排除し、**本アプリケーションが公式にサポート・実装している厳選コンボデッキのみ**で、正確かつ安全に一人回しを行えます。

静的Webサイト（HTML5 + Vanilla JavaScript + クラシックCSS）としてホスティングでき、実行時のカード処理はすべて決定論的なJavaScriptコードによって行われます。

---

## 🌟 主な特徴

- **2大コンボデッキを初期完全収録**:
  - **MoMa** (1998年 トレイリアのアカデミー型 / USG期スタンダード・エクステンデッド)
  - **Lotus Field Combo** (パイオニアのロータスコンボ)
  - トップページおよびシミュレーター画面内のセレクターから即座にデッキを選択・切り替え可能
- **決定論的ゲームエンジン**:
  - シード付き疑似乱数生成器（Fisher–Yatesシャッフル）により、同一シード・同一操作での完全再現が可能
  - スタック（LIFO）、マナプール（WUBRGC）、手動/自動支払い、土地プレイ権、領域移動、状況起因処理（SBA）、レジェンドルール、ロンドン・マリガンを正確に再現
- **豊富な練習モード**:
  - **一人回しモード**: 通常の先攻/後攻一人回し、マリガン、コンボ成立ターンの記録
  - **シナリオ特訓モード**: マナ生成、コピー、リソース補充、フィニッシュなどの重要局面からの反復練習
  - **フリープラクティスモード**: 実装済みカードの手札/戦場追加、マナやライフの自由編集
- **Undo / Redo 機能**:
  - すべてのカード位置、マナプール、ライフ、スタック、乱数生成器の内部状態を含めて完全復元
- **統計・分析**:
  - 完了ゲーム数、勝率、最速勝利ターン、平均勝利ターン、ターン別コンボ成立分布グラフをLocalStorageに自動蓄積

---

## 📂 フォルダ構成

```text
combodecklab/
├── index.html                  # トップページ（デッキ選択・シナリオ選択）
├── simulator.html              # シミュレーター画面（デッキ切替ドロップダウン付き）
├── css/
│   ├── base.css                # リセット、タイポグラフィ、マナシンボル
│   ├── layout.css              # 全体グリッドレイアウト
│   ├── components.css          # カードDOM、モーダル、ポップオーバー
│   ├── simulator.css           # 戦場、スタック、マナプール、ログ
│   └── responsive.css         # レスポンシブ対応
├── js/
│   ├── main.js                 # トップページ制御
│   ├── simulator.js            # シミュレーター制御
│   ├── api/
│   │   ├── scryfall.js         # Scryfall API連携 & ローカルフォールバック
│   │   └── cache.js            # メモリ & LocalStorageキャッシュ
│   ├── engine/
│   │   ├── game.js             # Gameメインコントローラーファサード
│   │   ├── state.js            # GameStateスナップショット & シリアライズ
│   │   ├── player.js           # プレイヤーステータス
│   │   ├── opponent.js         # 金魚対戦相手シミュレータ
│   │   ├── zones.js            # 8領域管理 & カードインスタンス生成
│   │   ├── mana.js             # WUBRGCマナプール & コスト支払い
│   │   ├── costs.js            # マナ・タップ・ディスカード・生け贄コスト
│   │   ├── actions.js          # プレイヤーアクション実行
│   │   ├── stack.js            # MTGスタック (LIFO)
│   │   ├── targeting.js        # 対象適正判定
│   │   ├── abilities.js        # 起動型・誘発型・常在型能力定義
│   │   ├── effects.js          # 共通効果実行プリミティブ
│   │   ├── turn.js             # ターン進行・ステップ管理
│   │   ├── rules.js            # ロンドンマリガン・SBA・レジェンドルール
│   │   ├── random.js           # シード付きPRNG (Mulberry32)
│   │   └── history.js          # Undo / Redo スタック
│   ├── cards/
│   │   ├── registry.js         # カードレジストリ
│   │   ├── common.js           # カード定義ビルダー
│   │   ├── lands/              # 土地カード
│   │   ├── artifacts/          # アーティファクト
│   │   ├── creatures/          # クリーチャー
│   │   ├── enchantments/       # エンチャント
│   │   ├── instants/           # インスタント
│   │   └── sorceries/          # ソーサリー
│   ├── decks/
│   │   ├── registry.js         # 実装済みデッキレジストリ
│   │   ├── moma.js             # MoMaデッキ定義 & シナリオ
│   │   └── lotus.js            # Lotus Fieldデッキ定義 & シナリオ
│   ├── ui/
│   │   ├── board.js            # 戦場レンダリング
│   │   ├── hand.js             # 手札レンダリング & アクションメニュー
│   │   ├── card.js             # カード要素生成 & タップ回転
│   │   ├── modal.js            # 各種モーダルダイアログ
│   │   ├── controls.js         # マナプール & ターンコントロール
│   │   ├── logger.js           # ゲームログ & テキスト保存
│   │   └── statistics.js       # 練習統計可視化
│   └── utils/
│       ├── storage.js          # LocalStorage管理
│       └── helpers.js          # クローン・HTMLエスケープ等のユーティリティ
├── data/
│   ├── decks/
│   │   ├── moma.json           # MoMaデッキデータ
│   │   └── lotus.json          # Lotusデッキデータ
│   └── cards/
│       └── card-metadata.json  # Scryfallから取得・整形したカードメタデータ
├── tests/
│   ├── index.html              # ブラウザ用自動テストランナー
│   ├── run_tests.mjs           # CLI用テストランナー (Node.js)
│   ├── engine/engine.test.js   # 共通エンジンテスト
│   ├── cards/cards.test.js     # 個別カードテスト
│   └── scenarios/integration.test.js # 統合コンボテスト
├── readme.md                   # 本ドキュメント
├── supported-cards.md          # 実装カード一覧・Oracle ID・裁定
└── known-limitations.md        # 既知の制限・対戦相手の簡略化仕様
```

---

## 🚀 ローカルでの起動方法

本プロジェクトはビルドツールやNode.jsサーバーを必須とせず、静的Webサーバーがあればどこでも動作します。

```bash
# Python 3 を使用する場合
cd games/combodecklab
python -m http.server 8000

# ブラウザで開く
http://localhost:8000/
```

---

## 🧪 テストの実行方法

### ブラウザで実行
ブラウザで `http://localhost:8000/tests/index.html` にアクセスすると、全自動テスト（共通エンジン、個別カード、統合コンボ）が実行されます。

### コマンドライン（CLI）で実行
```bash
node games/combodecklab/tests/run_tests.mjs
```

すべてのテスト項目（64項目）がパスすることを確認済みです。

---

## ➕ 新規デッキの追加手順

将来新しいコンボデッキを追加する場合は、以下の安全な手順で行えます。

1. `data/decks/<deck-id>.json` にデッキ構成を定義。
2. 未実装カードがある場合、ScryfallからOracle IDとテキストを確認し、`js/cards/<category>/` に正確な処理を実装。
3. `js/cards/registry.js` にカード定義を追加。
4. `js/decks/<deck-id>.js` にコンボ解説・シナリオデータを定義。
5. `js/decks/registry.js` でインポートして `this.register(NewDeck)` すると、トップ画面およびシミュレーターのデッキセレクターに自動反映されます。
6. `tests/cards/cards.test.js` および統合テストを追加して検証。
