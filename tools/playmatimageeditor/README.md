# PlaymatImageEditor (プレイマット印刷画像エディター)

pixivFACTORY、プリントオン、オレンジ工房.com をはじめとするオンデマンド印刷サービスに対応した、トレーディングカードゲーム（TCG）向けプレイマット入稿画像作成・編集・書き出しWebアプリケーションです。

高度な画像編集ソフトをお持ちでない方でも、ブラウザ上で直感的に画像の配置、文字入れ、ペイント、TCGゾーン枠線の配置、印刷仕上がりラインの確認を行い、入稿に適した高解像度（350DPI）の画像データを出力できます。

---

## 🌟 特徴・主要機能

- **完全ローカルブラウザ完結・安心のセキュリティ**
  - 画像データや制作データを外部サーバーに一切送信しません。完全にお使いの端末内で処理されます。
- **印刷サービス別 厳密ガイドライン**
  - **塗り足し枠（外枠）**、**仕上がり線（カットライン）**、**セーフエリア（安全印刷領域）** をリアルタイム表示。
  - ガイド線や選択枠は出力画像には含まれません。
- **公式確認済み・未確認ステータスの明示**
  - オレンジ工房.com（仕上がり600×350mm、原稿630×380mm、350dpi）
  - プリントオン（仕上がり600×350mm、350dpi、専用テンプレート必須を明記）
  - pixivFACTORY（通常サイズ・ハーフサイズ目安、手動入力・カスタム対応）
- **高解像度（350DPI）書き出し & メタデータ自動注入**
  - 表示用キャンバスと高解像度出力キャンバスを分離し、作業中も軽量動作。
  - PNGの `pHYs` チャンクおよび JPEGの `JFIF` 解像度マーカーに 350DPI 等の正確なメタデータをバイナリ注入。
- **画像配置・編集 & 実効DPI自動計算**
  - PNG/JPEG/WebP対応、ドラッグ＆ドロップ、クリップボード貼り付け (Ctrl+V)。
  - 画像の拡大率に応じた印刷時の実効解像度（DPI）を常時判定し、過度な拡大による粗さを警告。
- **文字入れ & ベクター描画**
  - 日本語フォント対応、縁取り（ふちどり）、影、文字揃え。
- **TCG用カード枠線ツール**
  - スタンダードサイズ（63×88mm）、スモール/ミニサイズ（59×86mm）のカード配置枠をワンクリック生成。
- **編集データの保存 & 自動復元**
  - 独自形式 `.playmat.json` での完全保存・再読み込み。
  - IndexedDBを活用したブラウザ内自動バックアップと再起動時の復元機能。
- **プレイマット立体プレビュー**
  - 角丸ラバーマット風のプレビューシミュレーションと、セーフエリア外の文字はみ出し検査。

---

## 🛠️ 使用技術

- **HTML5** / **Classic CSS** (CSS Variables, Flexbox, CSS Grid)
- **Vanilla JavaScript (ES6+ Modules)**
  - HTML5 Canvas API (2D Context)
  - File API / Blob API / URL API
  - IndexedDB API
  - Pointer Events API
- **依存ライブラリ**: なし（Zero External Dependencies）

---

## 📁 ファイル構成

```text
tools/playmatimageeditor/
├── index.html              # メインHTML (SEO/OGP/構造化データ/UI)
├── css/
│   └── style.css           # スタイルシート (ダーク/ライトテーマ対応)
├── js/
│   ├── app.js              # エントリーポイント、キーボードショートカット、D&D
│   ├── editor.js           # 描画エンジン、ビューポート、Undo/Redo、ガイド線
│   ├── export.js           # 高解像度レンダリング、DPIメタデータ注入、Blob出力
│   ├── layers.js           # レイヤーモデル (Image/Paint/Text/Shape/Background)
│   ├── presets.js          # 印刷サービス別プリセット定義、mm/px変換、実効DPI計算
│   ├── storage.js          # IndexedDB自動保存、.playmat.jsonエクスポート/インポート
│   ├── tools.js            # ツール群 (選択/変形、ペン、消しゴム、文字、図形、TCG枠)
│   └── ui.js               # UI連携、プロパティバインディング、モーダル、プレビュー
├── assets/
│   ├── favicon.svg         # ベクターファビコン
│   ├── favicon-32.png      # 32x32 PNGアイコン
│   ├── apple-touch-icon.png# 180x180 アプリアイコン
│   └── ogp.png             # 1200x630 OGP画像
├── README.md               # 本ドキュメント
└── LICENSE                 # MIT License
```

---

## 🚀 起動方法

外部サーバーやビルドツールは不要です。静的ファイルを配信するWebサーバー（ローカルまたはホスティング）で開いてください。

### ローカル起動例

```bash
# Pythonの簡易サーバーを使う場合
python -m http.server 8000
# ブラウザで http://localhost:8000/tools/playmatimageeditor/ を開く
```

また、VSCodeの「Live Server」拡張機能等でも即座に動作します。

---

## 🌐 GitHub Pages 公開方法

1. リポジトリをGitHubにプッシュします。
2. GitHubリポジトリの **Settings** > **Pages** を開きます。
3. **Branch** を `main` (または `master`)、フォルダを `/ (root)` に設定して **Save** します。
4. 数分後に `https://<username>.github.io/<repo-name>/tools/playmatimageeditor/` で公開されます。

---

## ☕ BOOTHリンクの設定方法

完成画像の保存後に表示されるドネーションカード（支援案内）のリンク先URLは、[`js/app.js`](file:///tools/playmatimageeditor/js/app.js) の冒頭で簡単に変更できます。

```javascript
// js/app.js
const APP_CONFIG = {
  boothUrl: 'https://your-shop.booth.pm/', // ← ここにご自身のBOOTHショップURLを設定
  maxDonationShowPerSession: 2             // 同一セッション内の最大表示回数
};
```

※ `boothUrl` を空文字 `''` に設定すると、ドネーションボタンは非表示になり、無効なリンクが表示されることはありません。

---

## 📐 印刷プリセットの追加方法

新しい印刷サービスや特殊サイズのプリセットを追加するには、[`js/presets.js`](file:///tools/playmatimageeditor/js/presets.js) の `DEFAULT_PRESETS` 配列にオブジェクトを追加します。

```javascript
{
  id: 'myservice_playmat',
  serviceName: '印刷サービス名',
  presetName: 'ラージプレイマット (700×400mm)',
  status: ServiceStatus.VERIFIED, // 'verified' | 'verified_template' | 'unverified'
  finishWidthMm: 700,
  finishHeightMm: 400,
  bleedMm: 5,                     // 塗り足し (片側mm)
  docWidthMm: 710,                // 原稿幅mm (仕上がり + 塗り足し×2)
  docHeightMm: 410,               // 原稿高さmm
  recommendedDpi: 350,            // 推奨DPI
  pixelWidth: 9783,               // mmToPx(docWidthMm, recommendedDpi)
  pixelHeight: 5650,
  safeAreaMm: 8,                  // セーフエリア (仕上がり線からの内側mm)
  format: 'PNG / PSD',
  colorNotice: 'RGB入稿。',
  notes: '仕上がりサイズ700×400mmの特注マット用。',
  referenceUrl: 'https://example.com/spec'
}
```

また、アプリ内の新規作成モーダルや設定から、ユーザー自身がカスタムサイズ（mm/px/DPI）を登録・JSON入出力することも可能です。

---

## ⚠️ 印刷入稿・技術的制限に関する注意事項

1. **各印刷サービスの非公式エディター**
   - 本ツールは各オンデマンド印刷サービスの非公式ツールです。入稿前には必ず各印刷所の最新の公式マニュアル・入稿規定をご確認ください。
2. **プリントオンの入稿について**
   - プリントオンは必ず公式サイトで配布されている専用テンプレートPSDを使用してください。本ツールの寸法計算だけで完全対応しているとは表示しておりません。本ツールで書き出した画像を専用テンプレートに配置してご入稿ください。
3. **カラーモード (RGB / CMYK)**
   - ブラウザのCanvas APIはRGB色空間で動作します。CMYKへの直接変換や印刷機プロファイルによる色校正（ソフトプルーフ）には対応していません。CMYK指定の印刷所へ入稿される場合は、画像ソフト（Photoshop、CLIP STUDIO等）で適切にCMYK変換を行ってください。
4. **ブラウザのCanvas最大解像度**
   - 主要ブラウザ（Chrome, Firefox, Safari, Edge）ではCanvasの最大寸法（通常16,384px〜32,767px）やメモリ上限が設定されています。超巨大なピクセル数（数万px以上）を指定した場合は、ブラウザがクラッシュしないよう事前に安全チェックと警告が行われます。

---

## 📜 ライセンス

MIT License
Copyright (c) 2026 Tegral Lab

