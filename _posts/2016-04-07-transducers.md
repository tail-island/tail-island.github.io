---
layout:   post
title:    "Transducersって便利！"
category: Programming
tags:     [Clojure, JavaScript]
---

1年ぶりにClojureを触ってみたら、バージョンが「2つ」上がって1.8になっていました……。今、最新バージョンに追いつくために勉強中なのですけど、一つ前の1.7で追加されたTransducersが全くワカリマセン。

というわけで、Transducersを理解するために、Transducersと同じ機能を別の言語（JavaScript）で実装してみました。

## お題

プログラミング言語（`language`）と性別（`sex`）を属性に持つ開発者のデータ（`developers`）から、プログラミング言語別の開発力を求める関数（`developingPower`）を作成します。

```javascript
var developers = [
  {name: "SATO Kazuhiro",    language: "C++",     sex: "m"},
  {name: "HOSOGANE Machiko", language: "C++",     sex: "f"},
  {name: "NAGAI Yuko",       language: "Haskell", sex: "f"},
  {name: "OJIMA Ryoji",      language: "Clojure", sex: "m"}
];

function developingPower(language) {
  ...  // ここを作る。
}

console.log(developingPower("C++"));
```

`developingPower`は、プログラミング言語で開発者をフィルターして、女性は2で男性は1（[女性開発者の方が男性よりも貢献率が高いという傾向がGitHubのデータ解析から判明](http://gigazine.net/news/20160215-data-analysis-gender-bias/)）の開発力を持つものとして足し合わせることにしましょう。

## forとifでプログラミング

まずは、頭を空っぽにして何も考えずにプログラミングしてみました。

```javascript
function developingPower(language) {
  var acc = 0;
  
  for (var i = 0; i < developers.length; ++i) {
    if (developers[i].language == language) {
      acc += (developers[i].sex == "f" ? 2 : 1)
    }
  }

  return acc;
}
```

このコードには、処理が複雑になるとループの中が複雑になってしまうという問題があります。35歳以上はプログラマー定年とか炎上プロジェクトにアサインされているので対象外とかの処理を追加すると、コードが複雑になって保守性が落ちちゃう。これではダメですね。やり直しです。

## 集合操作のメソッドを活用してプログラミング

今時の（ECMA-262に準拠した）JavaScriptの`Array`には、集合操作のメソッドが多数あります。これらのメソッドを活用して、保守性を念頭におきながらプログラミングしてみました。

```javascript
function canDevelop(developer, language) {
  return developer.language == language;
}

function power(developer) {
  return developer.sex == "f" ? 2 : 1;
}

function plus(x, y) {
  return x + y;
}

function developingPower(language) {
  var canDevelopWith = function(developer) {
    return canDevelop(developer, language);
  };

  return developers.
    filter(canDevelopWith).
    map(power).
    reduce(plus, 0);
}
```

コードが長くなってしまいましたけど、ステップ単位に処理が分割されたので、とても簡単になりました。

ただ、残念なことに、このコードって遅いんですよ。Intel Core M 1.1GHzのPCで100万回実行してみたら、1秒程度かかってしまいました。ちなみに、`for`と`if`方式だと0.02秒ぐらいで100万回実行できちゃいます。うーん、約50倍かぁ……。集合操作のメソッドは保守性を向上させるので積極的に使いたいですけど、パフォーマンスが重要なところでは注意が必要ですね。

## Transducers！

集合操作のメソッドを使うと遅くなる理由の一つは、`filter`や`map`を実行するたびに集合が作られるためでしょう。集合の作成を防ぐには一番最初に書いた`for`と`if`を使ったコードのようにすればよいのですけど、でも、保守性が下がるのは絶対に嫌。

このわがままな願いを、Transducersは叶えてくれます！　Transducersは、集合を操作して新しい集合を作るのではなく、集合に対する操作だけを作成します……って言っても、何がなんだかワカラナイですよね（私は今回の作業をやるまで、カケラも理解できませんでした）。

順を追ってやりましょう。普通の`reduce`は、以下のコードで実現できます。

```javascript
function reduce(f, initialValue, xs) {
  var acc = initialValue;
  
  for (var i = 0; i < xs.length; ++i) {
    acc = f(acc, xs[i]);
  }
  
  return acc;
}
```

もし、上のコードの`acc = f(acc, xs[i]);`を以下のように修正できれば、`filter`を実現できるでしょう。

```javascript
if (xs[i].language == "C++") {
  acc = f(acc, xs[i]);
}
```

以下なら、`map`を実現できます。

```javascript
acc = f(acc, xs[i].sex == "f" ? 2 : 1);
```

でも、実行時にコードを変更するのは大変そうです。だから、関数がファースト・クラス・オブジェクトであるというJavaScriptの特徴を活用して、解決しましょう。

```javascript
// フィルター処理のための関数。
function filterF(rf) {          // Reduceの引数の関数を引数に取って、
  return function(acc, x) {     // Reduceの引数の関数と同じシグネチャーの関数を返します。
    if (x.language == "C++") {  // フィルター処理はココ。
      return rf(acc, x);        // Reduceの処理はココ。
    }
    return acc;                 // フィルターに引っかからなければ、Reduceの処理をしません。
  }
}

// マップ処理のための関数。
function mapF(rf) {
  return function(acc, x) {
    return rf(acc, x.sex == "f" ? 2 : 1);  // マップ処理はココ。マップ処理した結果でReduce処理をします。
  }
}

function reduce(xf, rf, initialValue, xs) {  // フィルターやマップの関数（xf）を引数に加えます。
  var acc = initialValue;
  var f = xf(rf);  // Reduce処理の関数をxfに渡して、フィルターやマップ処理も含むReduce処理の関数を取得します。

  for (var i = 0; i < xs.length; ++i) {
    acc = f(acc, xs[i]);
  }

  return acc;
}

// 関数合成。comp(f1, f2)(x) == f1(f2(x))です。
function comp(f1, f2) {
  return function(x) {
    return f1(f2(x));
  };
}

function developingPower(language) {
  // developersをfilterしてmapして、plusでreduceします。
  return reduce(comp(filterF,  // とりあえず、languageは無視させてください。
                     mapF),
                plus, 0,
                developers);
}
```

はい、これでループが1回だけになりました。コードも分かりやすい。実は、上のコードの、Reduceの引数の関数を引数に取ってReduceの引数の関数と同じシグネチャーの関数を返す関数が、Transducerなんです。上のコードのようにすれば集合は生成されませんから、パフォーマンスが向上します。時間を計測したら、100万回の呼び出しが0.3秒程度で完了しました。この程度のオーバーヘッドなら、使える範囲が大きく増えるでしょう。うん、Transducersって便利じゃん。

……でも、このコードには汎用性がありません。なので、汎用的な`filter`と`map`を作りましょう。

```javascript
function filter(f) {
  return function(rf) {
    return function(acc, x) {
      if (f(x)) {
        return rf(acc, x);
      }
      return acc;
    }
  };
}

function map(f) {
  return function(rf) {
    return function(acc, x) {
      return rf(acc, f(x));
    };
  };
}

function developingPower(language) {
  var canDevelopWith = function(developer) {
    return canDevelop(developer, language);
  };

  // canDevelopWithでfilterしてpowerでmapして、plusでreduceします。
  return reduce(comp(filter(canDevelopWith),
                     map(power)),
                plus, 0,
                developers);
}
```

はい、完璧！　実施した作業は簡単で、関数を返す関数から、関数を返す関数を返す関数に変えただけです。

Clojure1.7は、これまでに作成したような`filter`や`map`、`reduce`に加えて、大量のTransducers対応の集合操作関数を提供します（しかも、`reduce`以外の処理、集合を結果に返すような処理でも使えるようになっている）。だから、Clojureなら、余計なユーティリティー関数を書かなくても今回のお題を実現できます。

```clojure
(def developers
  [{:name "SATO Kazuhiro"    :language "C++"     :sex "m"}
   {:name "HOSOGANE Machiko" :language "C++"     :sex "f"}
   {:name "NAGAI Yuko"       :language "Haskell" :sex "f"}
   {:name "OJIMA Ryoji"      :language "Clojure" :sex "m"}])

(defn developing-power
  [language]
  (transduce (comp (filter #(= (:language %) language))
                   (map #(if (= (:sex %) "f") 2 1)))
             + 0
             developers))
```

やっぱりClojureは楽ですな。

あと、Transducersは、Clojure以外の様々な言語でもライブラリが開発されちゃうくらいに便利な機能です（もちろん、今回私が作ったコードよりはるかに優れた実装がなされています）。皆様がお使いの言語向けのライブラリもあると思いますので、お暇な時に探してみてください。
