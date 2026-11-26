// lotus.js - Lotus Field Combo (Pioneer) Deck definition

export const LotusDeck = {
  id: "lotus",
  name: "Lotus Field Combo (Pioneer)",
  nameJa: "ロータス・フィールド・コンボ（パイオニア）",
  format: "Pioneer",
  year: 2023,
  source: "パイオニア競技シーン標準構成（Raul Dares等）",
  description: "《睡蓮の原野》を設置し、《演劇の舞台》でコピーして3マナ出る土地を量産。《見えざる糸》や《ページへの没頭》、サイクリングした《砂時計の侍臣》で土地をアンタップして爆発的にマナを伸ばします。《出現の根本原理》から《全知》《深淵への覗き込み》を唱え、最終的に《副陽の接近》を2回唱えて特殊勝利を狙います。",
  keyCards: [
    "Lotus Field",
    "Thespian's Stage",
    "Hidden Strings",
    "Emergent Ultimatum",
    "Approach of the Second Sun"
  ],
  rulesNotice: "※《演劇の舞台》が《睡蓮の原野》をコピーしても戦場に出直すわけではないため、土地2つの生け贄能力は誘発しません。安心して原野を増やせます。",
  comboGuide: [
    "1. 3ターン目までに《Lotus Field》を設置する（土地2枚を生け贄に捧げる）。",
    "2. 《Thespian's Stage》を出し、2マナ支払ってタップし《Lotus Field》のコピーにする（生け贄は誘発しない）。",
    "3. コピーした原野からマナを出し、《Hidden Strings》や《Pore Over the Pages》で原野2つをアンタップしてマナを倍増させる。",
    "4. 溜まったマナから《Emergent Ultimatum》を唱え、ライブラリーから《Omniscience》《Peer into the Abyss》《Dark Petition》を選ぶ。",
    "5. 《Omniscience》（全知）または《Peer into the Abyss》（大量ドロー）が通り、フリーキャスト状態から《Approach of the Second Sun》（副陽の接近）を2回唱えて特殊勝利！"
  ],
  scenarios: [
    {
      id: "lotus_field_setup",
      title: "Lotus Field の設置と生け贄",
      goal: "《睡蓮の原野》を設置し、土地2つを生け贄に捧げつつ3マナを生成せよ。",
      hint: "睡蓮の原野はタップ状態で出るため、アンタップ手段や次のターン以降の爆発力を意識しましょう。",
      initialState: {
        battlefield: [
          { name: "Botanical Sanctum", tapped: false },
          { name: "Yavimaya Coast", tapped: false }
        ],
        hand: [
          { name: "Lotus Field" },
          { name: "Sylvan Scrying" }
        ],
        mana: { U: 0, G: 0 }
      }
    },
    {
      id: "lotus_stage_copy",
      title: "Thespian's Stage によるコピー",
      goal: "《演劇の舞台》の能力を起動し、《睡蓮の原野》のコピーにして3マナを生み出せ。",
      hint: "演劇の舞台のコピー能力には2マナ必要です。Lotus Fieldからマナを出して支払えます。",
      initialState: {
        battlefield: [
          { name: "Lotus Field", tapped: false },
          { name: "Thespian's Stage", tapped: false }
        ],
        hand: [
          { name: "Hidden Strings" }
        ],
        mana: { U: 0, C: 0 }
      }
    },
    {
      id: "lotus_strings_mana",
      title: "Hidden Strings によるマナの増幅",
      goal: "2つの《睡蓮の原野》をタップして6マナ出し、《見えざる糸》で2つともアンタップして合計10マナ以上生成せよ。",
      hint: "見えざる糸の対象に原野2つを指定してアンタップします。",
      initialState: {
        battlefield: [
          { name: "Lotus Field", tapped: false },
          { name: "Lotus Field", tapped: false }
        ],
        hand: [
          { name: "Hidden Strings" },
          { name: "Pore Over the Pages" }
        ],
        mana: { U: 0 }
      }
    },
    {
      id: "lotus_pore_refuel",
      title: "Pore Over the Pages によるリソース補充",
      goal: "《ページへの没頭》を唱えて3枚引き、土地2枚をアンタップしてコンボを繋げよ。",
      hint: "5マナ払って唱えても、3マナ出る土地を2つアンタップできれば実質マナが増加（+1マナ）します。",
      initialState: {
        battlefield: [
          { name: "Lotus Field", tapped: true },
          { name: "Lotus Field", tapped: true }
        ],
        hand: [
          { name: "Pore Over the Pages" }
        ],
        mana: { U: 3, C: 2 }
      }
    },
    {
      id: "lotus_ultimatum_win",
      title: "最終的な勝利手段へのアクセス",
      goal: "《出現の根本原理》または《副陽の接近》を唱えてゲームに勝利せよ。",
      hint: "全知が戦場に出れば、手札の呪文はすべてノーコストで唱えられます。",
      initialState: {
        battlefield: [
          { name: "Lotus Field", tapped: false },
          { name: "Lotus Field", tapped: false },
          { name: "Lotus Field", tapped: false },
          { name: "Omniscience", tapped: false }
        ],
        hand: [
          { name: "Approach of the Second Sun" },
          { name: "Mastermind's Acquisition" },
          { name: "Pore Over the Pages" }
        ],
        mana: { W: 0, U: 0, B: 0, G: 0 }
      }
    }
  ],
  mainboard: [
    { name: "Lotus Field", count: 4 },
    { name: "Thespian's Stage", count: 4 },
    { name: "Yavimaya Coast", count: 4 },
    { name: "Botanical Sanctum", count: 4 },
    { name: "Mana Confluence", count: 2 },
    { name: "Boseiju, Who Endures", count: 1 },
    { name: "Forest", count: 1 },
    { name: "Island", count: 1 },
    { name: "Arboreal Grazer", count: 4 },
    { name: "Vizier of Tumbling Sands", count: 4 },
    { name: "Hidden Strings", count: 4 },
    { name: "Pore Over the Pages", count: 4 },
    { name: "Sylvan Scrying", count: 4 },
    { name: "Emergent Ultimatum", count: 4 },
    { name: "Omniscience", count: 1 },
    { name: "Dark Petition", count: 1 },
    { name: "Mastermind's Acquisition", count: 1 },
    { name: "Peer into the Abyss", count: 1 },
    { name: "Approach of the Second Sun", count: 1 },
    { name: "Impulse", count: 4 }
  ],
  sideboard: [
    { name: "Approach of the Second Sun", count: 1 },
    { name: "Peer into the Abyss", count: 1 },
    { name: "Omniscience", count: 1 },
    { name: "Dark Petition", count: 1 },
    { name: "Mastermind's Acquisition", count: 1 }
  ]
};
