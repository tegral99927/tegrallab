// moma.js - MoMa (Academy 1998) Deck definition

export const MomaDeck = {
  id: "moma",
  name: "MoMa (Academy 1998)",
  nameJa: "MoMa（トレイリアのアカデミー型 1998）",
  format: "Standard / Extended (1998)",
  year: 1998,
  source: "1998年 USG期 エリック・ラウアー開発 / プロツアー・シカゴ98 等のMoMaリスト",
  description: "1998年『ウルザズ・サーガ』発売直後に環境を席巻した史上最凶のコンボデッキ。《トレイリアのアカデミー》と軽量アーティファクトで大量マナを生み出し、《精神力》で土地を連続アンタップ。《時のらせん》や《意外な授かり物》でリソースを回復しながら、最後は相手を《天才のひらめき》で強制ドローさせてライブラリーアウトさせます。",
  keyCards: [
    "Tolarian Academy",
    "Mind Over Matter",
    "Time Spiral",
    "Stroke of Genius"
  ],
  rulesNotice: "※本シミュレーターは「歴史的デッキを現行ルールで一人回しするモード」です。1998年当時のパリ・マリガン、マナ・バーン、当時のカードテキスト等を完全再現したものではなく、現行オラクル・現行総合ルールに準拠して動作します。",
  comboGuide: [
    "1. 《Lotus Petal》《Mana Vault》《Mox Diamond》などの軽量アーティファクトを展開する。",
    "2. 《Tolarian Academy》を戦場に出し、アーティファクトの数だけ大量の青マナを生み出す。",
    "3. 《Mind Over Matter》を戦場に出し、手札を1枚捨てるたびに《Tolarian Academy》をアンタップしてマナを増幅する。",
    "4. 《Time Spiral》や《Windfall》で手札を7枚以上に補充し、再びアカデミーをアンタップして青マナを数十〜数百点まで伸ばす。",
    "5. 相手を対象に《Stroke of Genius》を X=60 以上で唱え、強制ドローによるライブラリーアウトで勝利！"
  ],
  scenarios: [
    {
      id: "moma_academy_burst",
      title: "Tolarian Academy によるマナ生成",
      goal: "戦場のアーティファクトを活用し、1ターンに青マナ {U} を5点以上生成せよ。",
      hint: "アーティファクトを先に出してからアカデミーをタップすると得られるマナが増えます。",
      initialState: {
        battlefield: [
          { name: "Tolarian Academy", tapped: false },
          { name: "Lotus Petal", tapped: false },
          { name: "Mana Vault", tapped: false },
          { name: "Voltaic Key", tapped: false }
        ],
        hand: [
          { name: "Lotus Petal" },
          { name: "Island" }
        ],
        mana: { U: 0, C: 0 }
      }
    },
    {
      id: "moma_mind_loop",
      title: "Mind Over Matter によるマナの増幅",
      goal: "《精神力》と《トレイリアのアカデミー》のコンボで、マナプールに青マナ {U} を15点以上溜めよ。",
      hint: "アカデミーをタップしてマナを出した後、《精神力》で手札を捨ててアカデミーをアンタップします。",
      initialState: {
        battlefield: [
          { name: "Tolarian Academy", tapped: false },
          { name: "Mind Over Matter", tapped: false },
          { name: "Mana Vault", tapped: false },
          { name: "Voltaic Key", tapped: false }
        ],
        hand: [
          { name: "Island" },
          { name: "Island" },
          { name: "Turnabout" },
          { name: "Windfall" }
        ],
        mana: { U: 2, C: 0 }
      }
    },
    {
      id: "moma_spiral_refuel",
      title: "Time Spiral によるリソース補充",
      goal: "《時のらせん》を唱えて手札と墓地を修復し、土地をアンタップしてコンボを継続せよ。",
      hint: "時のらせん解決後、土地が最大6枚アンタップされます。",
      initialState: {
        battlefield: [
          { name: "Tolarian Academy", tapped: true },
          { name: "Island", tapped: true },
          { name: "Island", tapped: true },
          { name: "Ancient Tomb", tapped: true },
          { name: "Mana Vault", tapped: false },
          { name: "Voltaic Key", tapped: false }
        ],
        hand: [
          { name: "Time Spiral" }
        ],
        mana: { U: 2, C: 4 }
      }
    },
    {
      id: "moma_stroke_finish",
      title: "Stroke of Genius によるフィニッシュ",
      goal: "対戦相手を対象に《天才のひらめき》を X=60 で唱え、ライブラリーアウトで勝利せよ。",
      hint: "天才のひらめきを唱える際、対象に対戦相手を選択し、Xに必要なマナを支払います。",
      initialState: {
        battlefield: [
          { name: "Tolarian Academy", tapped: false },
          { name: "Mind Over Matter", tapped: false }
        ],
        hand: [
          { name: "Stroke of Genius" },
          { name: "Island" },
          { name: "Island" }
        ],
        mana: { U: 65, C: 0 }
      }
    }
  ],
  mainboard: [
    { name: "Tolarian Academy", count: 4 },
    { name: "Ancient Tomb", count: 3 },
    { name: "Island", count: 10 },
    { name: "Lotus Petal", count: 4 },
    { name: "Mana Vault", count: 4 },
    { name: "Mox Diamond", count: 4 },
    { name: "Voltaic Key", count: 4 },
    { name: "Mind Over Matter", count: 4 },
    { name: "Time Spiral", count: 4 },
    { name: "Windfall", count: 4 },
    { name: "Stroke of Genius", count: 4 },
    { name: "Turnabout", count: 4 },
    { name: "Intuition", count: 4 },
    { name: "Scroll Rack", count: 3 }
  ],
  sideboard: [
    { name: "Stroke of Genius", count: 1 },
    { name: "Turnabout", count: 1 },
    { name: "Island", count: 4 },
    { name: "Mana Vault", count: 1 }
  ]
};
