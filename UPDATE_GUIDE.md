# 更新ガイド — 医療AI製品スケジュール

卵子AI／精子AI／ICSI自動化 の WBS スケジュールを管理するためのガイドです。
**コードは触らず、`data/` 配下のデータファイルだけを編集すれば反映されます。**

---

## 1. ファイル構成

```
arcs/
├── index.html              全体ビュー（3製品一覧）
├── ranshi.html             卵子AI 詳細ビュー
├── seishi.html             精子AI 詳細ビュー
├── icsi.html               ICSI自動化 詳細ビュー
├── data/
│   ├── schedule.js         ★ 全体ビューのデータ＋イベント＋サマリ＋更新ログ
│   ├── ranshi-detail.js    卵子AI 詳細データ
│   ├── seishi-detail.js    精子AI 詳細データ
│   └── icsi-detail.js      ICSI自動化 詳細データ
├── assets/
│   ├── gantt.css           共通スタイル（編集不要）
│   └── gantt.js            共通描画ロジック（編集不要）
├── UPDATE_GUIDE.md         このファイル
└── README.md
```

| 編集したいもの | 編集するファイル |
|---|---|
| 全体ビューの製品スケジュール | `data/schedule.js` |
| マイルストーン（★イベント） | `data/schedule.js` の `events` |
| 上部サマリ（要判断・警戒・進捗・遅延） | `data/schedule.js` の `summaryData` |
| 更新ログ | `data/schedule.js` の `changelog` |
| 卵子AI 詳細 | `data/ranshi-detail.js` |
| 精子AI 詳細 | `data/seishi-detail.js` |
| ICSI自動化 詳細 | `data/icsi-detail.js` |

---

## 2. 月インデックスの考え方

すべての `start` / `end` は **月インデックス（0始まり）** です。

| index | 年月 | index | 年月 |
|---|---|---|---|
| 0 | 2026/04 | 12 | 2027/04 |
| 1 | 2026/05 | 13 | 2027/05 |
| 8 | 2026/12 | 19 | 2027/11 |
| 11 | 2027/03 | 23 | 2028/03 |

> 計算式：`index = (年 - 2026)×12 + (月 - 4)`（4月始まりの年度ベース）

---

## 3. テーマ（タスクグループ）の基本形

```js
{
  id: 'ranshi_dev_test',          // 一意ID（変更しない）
  name: '開発・テスト',            // テーマ名
  owner: '開発',                   // 担当
  status: 'progress',              // 信号（下表）
  period: '2026/05 〜 2026/09',    // 表示用の期間文字列
  phases: [
    {phase: 'navy', start: 1, end: 5, label: '開発・テスト',
     tasks: ['アルゴリズム実装', 'UI実装', '結合テスト']}
  ],
  next: '5月：開発着手'            // 「次の山場」太字表示
}
```

### status（ステータス信号）

| 値 | 意味 | 色 |
|---|---|---|
| `green` | 順調 | 緑 |
| `yellow` | 警戒 | 黄 |
| `red` | 遅延 | 赤（点滅） |
| `progress` | 進行中 | 青 |
| `gray` | 未着手・未確定 | グレー |

### phase（ガントバー）の色クラス

`navy`（主要・濃紺） / `sales`（営業） / `yakuji`（薬事） / `dev`（開発） /
`clinical`（臨床） / `pmda`（PMDA） / `qms`（品証） / `launch`（申請・リリース） / `data`（データ）

---

## 4. 遅延を記録する手順

遅延が発生したテーマには、以下を **追記** します。

### ステップ

1. `status` を `'red'` に変更
2. テーマに `delay` を追加
3. `period` の終了月を実態に合わせて更新
4. 遅れたフェーズに `delayed: true` を付与
5.（任意）当初計画を残すなら `baseline: true` のフェーズを別途追加
6.（任意）背景・対応方針を `risk` で記録
7. `summaryData.delays` に1行追加
8. `changelog` の先頭に1行追加

### 記入例（Before → After）

**Before**

```js
{
  id: 'seishi_clinical',
  name: '臨床性能評価試験（計画・実施・解析）',
  owner: '薬事／臨床',
  status: 'gray',
  period: '2026/10 〜 2027/10',
  phases: [{phase: 'navy', start: 6, end: 18, label: '臨床性能評価試験（計画・実施・解析）',
            tasks: ['試験計画', '症例組入', '解析']}],
  next: '10月：計画策定'
}
```

**After（2ヶ月遅延の例）**

```js
{
  id: 'seishi_clinical',
  name: '臨床性能評価試験（計画・実施・解析）',
  owner: '薬事／臨床',
  status: 'red',
  period: '2026/12 〜 2027/12',
  phases: [
    {phase: 'navy', start: 6,  end: 18, label: '当初計画', baseline: true},
    {phase: 'navy', start: 8,  end: 20, label: '臨床性能評価試験（計画・実施・解析）',
     delayed: true, tasks: ['試験計画', '症例組入', '解析'],
     memo: '症例組入れ遅延により2ヶ月後ろ倒し'}
  ],
  next: '12月：計画策定（遅延中）',
  delay: { months: 2, reason: '実施医療機関のIRB承認が想定より遅延。症例組入れ開始が後ろ倒し。', date: '2026-11-20' },
  risk: { level: 'high', text: '薬事申請（2028/02予定）への玉突き遅延リスク。代替施設の追加を検討中。', date: '2026-11-20' }
}
```

ステータス列に「⏰ 2ヶ月遅延」と赤コメント、ガント上に **当初計画（破線ゴースト）** と
**遅延バー（赤枠＋⏰）** が並んで表示されます。

---

## 5. リスクコメントを記録する手順

遅延していなくても、リスクだけ記録できます。テーマに `risk` を追加：

```js
risk: {
  level: 'high',        // 'high' | 'medium' | 'low'
  text: 'リソース集中により他テーマへの影響が懸念される。外部支援要否を6月までに判断。',
  date: '2026-05-15'    // 記録日
}
```

- テーマ名の横に **リスクバッジ**（⚠ リスク高 / △ リスク中 / ℹ リスク低）
- ステータス列に **色付きリスクコメント** が表示されます

`level` の目安：

| level | 目安 |
|---|---|
| `high` | スケジュール／申請に直接影響。要エスカレーション |
| `medium` | 注視が必要。対応策の準備が望ましい |
| `low` | 認識共有レベル。現時点で対応は不要 |

---

## 6. サマリ・更新ログの更新

### summaryData（`data/schedule.js` 末尾付近）

```js
const summaryData = {
  actions:  [ '直近の要判断…' ],
  warnings: [ '警戒テーマ…' ],
  dones:    [ '進捗トピック…' ],
  delays:   [ '<strong>精子AI（臨床）</strong>：症例組入れ2ヶ月遅延（2026-11）。申請への影響精査中' ]
};
```

> `delays` が空配列 `[]` のときは遅延サマリカードは自動で非表示になります。
> `<strong>…</strong>` などのHTMLタグがそのまま使えます。

### changelog（最新を**先頭**に追記）

```js
const changelog = [
  { date: '2026-11-20', tag: 'delay',  text: '精子AI 臨床性能評価試験を2ヶ月後ろ倒し（IRB承認遅延）' },
  { date: '2026-05-10', tag: 'update', text: '初版スケジュール公開' }
];
```

`tag` は `delay`（遅延）/ `risk`（リスク）/ `update`（更新）/ `done`（完了）。

---

## 7. 製品ごとの詳細ビューを細分化する

`ranshi-detail.js` / `icsi-detail.js` は初期状態では全体ビューと同じ内容です。
細分化する場合は、`categories: scheduleData.xxx.categories` の行を消し、
`seishi-detail.js` のように `categories: [ ... ]` を直接展開してください。

精子AI（`seishi-detail.js`）は既に
**営業・事業 / 臨床開発 / 薬事品証 / 開発** の4カテゴリで細分化済みなので、
これを雛形にできます。

---

## 8. 動作確認・公開

### ローカル確認

```bash
cd arcs
python3 -m http.server 8000
# ブラウザで http://localhost:8000/ を開く
```

> `file://` で直接開くと `data/*.js` の読み込みがブロックされる場合があります。
> 必ずHTTPサーバ経由で確認してください。

### GitHub Pages で公開する場合

リポジトリの Settings → Pages → Source を `main` / `(root)` に設定すると、
`https://<ユーザ名>.github.io/arcs/` で全体ビューが公開されます。

---

## 9. よくある編集チェックリスト

- [ ] `start` / `end` の月インデックスは正しいか（0=2026/04）
- [ ] カンマ・波括弧の対応は崩れていないか
- [ ] `id` は重複していないか（変更しない）
- [ ] 遅延時：`status:'red'` ＋ `delay` ＋ `delayed:true` をセットで入れたか
- [ ] `summaryData.delays` と `changelog` も更新したか
- [ ] HTTPサーバ経由で表示確認したか
