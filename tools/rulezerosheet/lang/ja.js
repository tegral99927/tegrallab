/**
 * lang/ja.js - 日本語辞書
 */

export default {
  // メタ・ヘッダー
  appName: "Commander Rule Zero Sheet Maker",
  appTitle: "統率者ルールゼロシートメーカー",
  tagline: "あなたのデッキを、1枚で伝える。",
  subTagline: "30秒で作成、ひと目で理解、すぐに共有。",
  
  // モード切替
  modeSimple: "簡単モード",
  modeDetailed: "詳細モード",
  modeSimpleDesc: "統率者・ブラケット・特徴を選んですぐ完成",
  modeDetailedDesc: "勝ち筋やコンボ、妨害、注意点まで詳細に記載",

  // ナビ & 操作
  saveDeck: "デッキ保存",
  loadDeck: "デッキ一覧",
  newDeck: "新規作成",
  duplicateDeck: "複製",
  deleteDeck: "削除",
  exportJson: "JSON書き出し",
  importJson: "JSON読み込み",
  shareUrl: "共有リンク",
  exportPng: "PNG画像で保存",
  copyImage: "画像をコピー",
  printSheet: "印刷",
  copiedSuccess: "画像をクリップボードにコピーしました！",
  copyFailed: "画像コピーに対応していません。PNG保存をご利用ください。",
  urlCopied: "共有リンクをクリップボードにコピーしました！",

  // フォーム項目
  sectionCommander: "1. コマンダー (Commander)",
  searchCommanderPlaceholder: "カード名を入力（日本語 / 英語）...",
  searching: "検索中...",
  searchNoResult: "見つかりませんでした。手動で入力することもできます。",
  searchHint: "例: アトラクサ / Atraxa / ユーリコ / Yuriko",
  addPartner: "+ もう1枚のコマンダーを追加 (共闘 / 背景 / コンパニオン)",
  removePartner: "2枚目のコマンダーを解除",
  commanderNameManual: "コマンダー名（手動入力）",
  commanderDescLabel: "コマンダーの概要 / デッキの狙い (最大3行程度)",
  commanderDescPlaceholder: "例: マナ加速からコマンダーを着地させ、盤面の増殖でリソース差を広げます。",
  
  sectionBracket: "2. コマンダーブラケット (Bracket)",
  bracketWarning: "注意: 選択したブラケットの上限（{limit}枚）を超えるゲームチェンジャー（{count}枚）が指定されています。",
  
  sectionGameChangers: "3. ゲームチェンジャー (Game Changers)",
  gcCountLabel: "枚数:",
  gcSourceManual: "手動設定",
  gcSourceAuto: "デッキリスト集計",
  gcSourceOverridden: "集計値を手動調整",
  gcHint: "WotC定義の特定ハイパワーカード（Fast Mana, 強力サーチ, 一撃必殺等）の合計枚数。",

  sectionDeckFeatures: "4. デッキの特徴",
  featuresHint: "該当する特徴を選択（複数可）。自由追加もできます。",
  addCustomFeature: "独自の特徴を追加...",
  addBtn: "追加",

  sectionPlayPreferences: "5. 対戦前に伝えたいこと / 希望スタイル",
  prefStyleLabel: "希望する対戦スタイル（柔らかい表現で表示されます）",
  avoidStyleLabel: "できれば避けたい展開・カード",
  customPrefPlaceholder: "その他、事前に相談したいこと...",

  // 詳細モード追加項目
  sectionDetailedInfo: "詳細設定",
  deckNameLabel: "デッキ名",
  deckNamePlaceholder: "例: ロータスコンボ風EDH",
  winConLabel: "主な勝ち筋 (Win Condition)",
  winConPlaceholder: "例: 無限マナからの大型X呪文、または戦闘ダメージによる圧殺",
  comboLabel: "使用するコンボ・成立条件",
  comboPlaceholder: "例: アシュノッドの供犠台 + 概念泥棒（決着ターン: 6〜7T目以降）",
  approxTurnLabel: "おおよその決着・展開ターン",
  approxTurnPlaceholder: "例: 6〜8ターン",
  interactionLabel: "妨害・コントロール要素",
  proxyLabel: "プロキシ（代用カード）の使用状況",
  proxyNone: "プロキシなし（すべて本物）",
  proxySome: "一部プロキシあり（テスト・高額カード）",
  proxyFull: "フルプロキシ",
  notesLabel: "自由記述メモ / 初対面へのメッセージ",
  notesPlaceholder: "例: 初心者卓大歓迎です！ 妨害は少なめなので気軽に遊べます。",

  // デッキリスト解析
  sectionDecklist: "デッキリスト自動解析",
  decklistPlaceholder: "ここにデッキリストを貼り付け (例: 1 Sol Ring\n1 Rhystic Study ...)",
  analyzeBtn: "リストを解析してGame Changersを集計",
  analyzing: "Scryfall照合中...",
  analyzeResult: "解析完了: 全{total}枚中、ゲームチェンジャー {gc}枚を検出しました。",

  // プリセット・テンプレート
  templateTitle: "テンプレートから入力補助",
  tplCombat: "戦闘中心 (Combat)",
  tplCombo: "コンボ中心 (Combo)",
  tplControl: "コントロール中心 (Control)",
  tplGraveyard: "墓地利用 (Graveyard)",
  tplCommanderCentric: "コマンダー中心 (Voltron / Commander)",
  templateApplied: "テンプレートを適用しました（内容は自由に編集できます）。",

  // シート表示
  sheetTypeQuick: "クイックシート (Compact)",
  sheetTypeDetailed: "詳細シート (Detailed)",
  previewTitle: "シート リアルタイムプレビュー",
  previewDesc: "※画像として保存・クリップボードコピーが可能です",
  sheetNotice: "Magic: The GatheringはWizards of the Coastの登録商標です。本ツールは非公式ファンコンテンツです。",

  // 特徴タグ候補
  featCombat: "戦闘ダメージ中心",
  featCombo: "コンボ中心",
  featInfinite: "無限コンボあり",
  featTwoCardCombo: "2枚コンボあり",
  featCommanderDep: "コマンダー依存度高め",
  featControl: "コントロール中心",
  featCounter: "打ち消し多め",
  featBoardWipe: "全体除去多め",
  featStax: "スタックス・ロック要素あり",
  featGraveyard: "墓地利用",
  featTokens: "トークン大量生成",
  featTutors: "サーチ多め",
  featExtraTurns: "追加ターンあり",
  featMLD: "大量土地破壊あり",
  featProxy: "プロキシ使用あり",

  // ドネーション
  donationTitle: "シート画像を作成しました！",
  donationText: "Commander Rule Zero Sheet Maker は完全無料で利用できます。もしこのツールが役に立ったら、BOOTHから任意のご支援をいただけると今後のアップデート・開発の励みになります！",
  donationBtn: "☕ BOOTHで開発を支援する",
  donationClose: "閉じる",
  donationNote: "※支援は任意です。支援しなくてもすべての機能を完全無料でご利用いただけます。",

  // 対戦希望タグ候補
  prefCasual: "ゆっくり遊びたい",
  prefFun: "勝敗より交流重視",
  prefSemiComp: "適度に競技的なゲームがしたい",
  prefComboOk: "コンボありでもOK",
  prefFastOk: "高速コンボも歓迎",
  prefLongGame: "長期戦歓迎",
  prefShortGame: "短時間の対戦希望",
  prefBeginner: "初心者歓迎",
  prefTuning: "デッキ調整中",

  // 避けたい展開タグ候補
  avoidMLD: "大量土地破壊は避けたい",
  avoidStax: "長時間のロックは避けたい",
  avoidExtraTurns: "頻繁な追加ターンは避けたい",
  avoidFastCombo: "極端な高速コンボは避けたい",
  avoidOneSided: "一方的な展開は避けたい",
  avoidSalt: "カジュアルに楽しみたい",

  // ガイド・FAQ
  faqTitle: "コマンダールールゼロと本ツールの使い方",
  faqQ1: "「ルールゼロ（Rule 0）」とは何ですか？",
  faqA1: "ゲームを始める前に、プレイヤー同士が自分のデッキの強さ、想定するゲームスピード、やりたいこと、避けたい展開をすり合わせる対話のことです。全員が楽しい時間を共有するために最も重要とされています。",
  faqQ2: "コマンダーブラケット（1〜5）とは？",
  faqA2: "Wizards of the CoastおよびCommander Format Panelが導入した公式のデッキ指標です。1(Exhibition/展示), 2(Core/標準), 3(Upgraded/強化), 4(Optimized/最適化), 5(cEDH/最高峰競技)の5段階に分かれ、ゲームチェンジャーの枚数や決着ターン数が目安となります。",
  faqQ3: "ゲームチェンジャー（Game Changers）とは何ですか？",
  faqA3: "ゲーム展開を一変させる強力なマナ加速、教示者、強力なエンジンなどのカードリストです。ブラケット1・2では0枚、ブラケット3では最大3枚までが推奨されています。",
  faqQ4: "作成したシートをDiscordで共有できますか？",
  faqA4: "はい！「画像をコピー」ボタンを押してDiscordのチャット欄にそのまま貼り付ける（Ctrl+V）か、「PNG画像で保存」から画像を送信できます。16:9比率でスマホやPCのDiscordで見やすく表示されます。",
  faqQ5: "アカウント登録やサーバー保存は必要ですか？",
  faqA5: "一切不要です。すべてのデータはお使いのブラウザ内（localStorage）に安全に保存され、外部サーバーにあなたの個人情報やデッキ内容が送信されることはありません。",

  // フッター・免責
  disclaimerText: "コマンダールールゼロシートメーカーはファンコンテンツ・ポリシーに沿った非公式のファンコンテンツです。ウィザーズ社の認可/許諾は得ていません。題材の一部に、ウィザーズ・オブ・ザ・コースト社の財産を含んでいます。©Wizards of the Coast LLC.",
  scryfallCredit: "カード情報および画像は Scryfall API を利用しています。"
};
