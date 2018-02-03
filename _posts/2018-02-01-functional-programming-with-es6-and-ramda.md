---
layout:   "post"
title:    "JavaScript(ES6)とRamdaで関数型プログラミング"
category: "programming"
tags:     ["JavaScript", "ES6", "Ramda", "関数型プログラミング"]
---

さっき「関数型プログラミング」でGoogle検索したら最初に表示された[「関数型プログラミングはまず考え方から理解しよう」](https://qiita.com/stkdev/items/5c021d4e5d54d56b927c)というページ、本文はもちろん、活発な議論がなされたコメント部分も、とても面白かったです。

ただ、コメント中のHaskellの美しいコードは、無限リストが使えるからこその書き方なんですよね……。このやり方は、JavaScriptだとちょっと辛い。コメント中でHaskellと同様のやり方をJavaScriptで書いてくださっている方も、繰り返す数を指定することで対処しています。

うんやっぱりHaskellはすげーなぁというのは当然なんだけど、JavaScriptを気に入っている私としては、実はJavaScriptもそれなりにすごいんだよということを示しておきたい。だから、JavaScript（EcmaScript 6）に関数型プログラミング向けライブラリのRamdaをインポートして、同じお題でプログラミングしてみました。

## 元ページのお題

詳しくは[元ページ](https://qiita.com/stkdev/items/5c021d4e5d54d56b927c)を見ていただくとして、簡単に書くとこんな感じ。

* 唐揚げ弁当がいくつかあります。唐揚げを何個か、つまみ食いしたいです。
* バレづらいように、最も唐揚げの数が多い弁当からつまみ食いしましょう。

## とりあえず、関数型で書いてみた

＃後で述べますけど、このコードはかなりヘッポコです……。後で修正しますから、ここで見捨てないで。<br>

というわけで、とりあえず関数型プログラミングした結果は以下の通り。

~~~ javascript
// ES6なのでrequireじゃなくてimport。
import R from 'ramda';

// 元ネタから、データ構造をちょっと変更。
const lunchBoxes = [{'唐揚げ': {count: 10}, '玉子焼き': {count: 1}},
                    {'唐揚げ': {count:  8}},
                    {'唐揚げ': {count:  6}}];

// つまみ食い。
function eatWithFinger(foodName, lunchBoxes) {
  // foodNameの数量が最大の弁当のインデックスを取得します。
  const canEatIndex = R.apply(R.reduce(R.maxBy(([lunchBox, i]) => lunchBox[foodName].count)),
                              R.juxt([R.head, R.tail])(R.addIndex(R.map)(R.constructor(Array), lunchBoxes)))[1];

  // canEatIndexの弁当のfoodNameの数量を1減らした、新しいリストを返します。
  return R.assocPath([canEatIndex, foodName, 'count'], lunchBoxes[canEatIndex][foodName].count - 1, lunchBoxes);
}

export default function main() {
  // 唐揚げを5回つまみ食い。
  const eatKaraageWithFingerFiveTimes = R.apply(R.pipe)(R.repeat(R.curry(eatWithFinger)('唐揚げ'), 5));

  console.log(eatKaraageWithFingerFiveTimes(lunchBoxes));
}

// [10, 8, 6] → [9, 8, 6] → [8, 8, 6] → [7, 8, 6] → [7, 7, 6] → [6, 7, 6]となるので、
// 各弁当の唐揚げの数は、6個、7個、6個になります。
~~~

以下、Ramdaの使い方の解説です。Ramdaをご存知の方は飛ばしてください。

`R.apply`は、`f(a, b, c)`という関数を`[a, b, c]`という引数で呼び出せるように変換する関数です。で、Ramdaが提供する関数はすべてカリー化されていて、だから`R.apply(f)`とやると`[a, b, c]`を引数にとる関数が返ってきます（`R.apply(f(a))`なら、`[b, c]`が引数になる）。で、上のコードで`R.reduce`を`R.apply`しているのは、`R.reduce`の引数は`R.reduce(f, initialValue, xs)`となっていて、初期値（`initialValue`）を必ず指定しなければならないためです（JavaScriptの`Array`の`reduce`では、初期値を指定しない場合は自動で`Array`の最初の要素が初期値になるのに……）。

で`R.maxBy`は、`R.maxBy(pred, x, y)`とすると`pred(x)`と`pred(y)`を比較して、大きな方（`x`か`y`）を返す関数です。これも当然カリー化されているので、`R.maxBy(pred)`すると引数を2個とる関数が返されて、それは`R.reduce`の第一引数の関数にちょうどよいというわけ。なので、上のコードでは`R.reduce(R.maxBy())`して最大の要素を求めています。

`R.juxt`は、複数の関数に同じ引数を渡すための処理です。`R.juxt([foo, bar])(x)`とすると`[foo(x), bar(x)]`が返ってきます。`R.head`は最初の要素、`R.tail`は二番目から最後までのリストを返すので、これでやっと`R.reduce`の引数が揃います。

で、その`R.juxt`した関数に渡しているのは、`R.addIndex(R.map)(R.constructor(Array))`した`lunchBoxes`です。`R.addIndex`はインデックス対応バージョンの関数を返しますので、これで`[[lunchBox[0], 0], [lunchBox[1], 1] ...]`が手に入るというわけ。あ、`R.constructor`は、扱いが面倒なコンストラクタを関数化する関数です。あと、`[lunchBox, index]`のうち、`canEatIndex`として表現したいのは`index`の方なので、最後に`[1]`を追加しています。

あとは、`R.assocPath`で、lunchBoxesを修正した新しいlunchBoxesを返すだけ。この関数を`R.curry`でカリー化して、`R.repeat`で5個並べて、`R.pipe`で順に呼び出すようにしています（`R.pipe(a, b, c)(x)`とすると`c(b(a(x)))`になります。`a`して`b`して`c`するのを順序どおりに表現できるので、私はこの関数が大好きです）。

これで、繰り返し回数をつまみ食いする関数から分離できました（`R.repeat`の引数に移動しただけという気もしますが……）。元ページみたいにつまみ食いした途中のlunchBoxesを取得したい場合は、`R.tap`するとか（デバッグのときに便利です）、`R.pipe`じゃなくて`R.reduce`するとかで大丈夫かと。

以上、Ramdaの解説終わり。ふう、これで関数型プログラミングのコードができあがりました。

## 念のため、手続き型で書いてみた

でも、関数型プログラミングのコードだけあっても、良いか悪いか判断できませんよね？　異なる手法でプログラミングしたコードと比較しないと。というわけで、手続き型で同じ処理を書いてみました。

~~~ javascript
const lunchBoxes = [{'唐揚げ': {count: 10}, '玉子焼き': {count: 1}},
                    {'唐揚げ': {count:  8}},
                    {'唐揚げ': {count:  6}}];

function eatWithFinger(foodName) {
  let canEatIndex = 0;
  for (let i = 1; i < lunchBoxes.length; ++i) {
    canEatIndex = lunchBoxes[i][foodName].count > lunchBoxes[canEatIndex][foodName].count ? i : canEatIndex;
  }

  lunchBoxes[canEatIndex][foodName].count--;
}

export default function main() {
  for (let i = 0; i < 5; ++i) {
    eatWithFinger('唐揚げ');
  }

  console.log(lunchBoxes);
}
~~~

……あれ？　さっきの関数型より、この手続き型の方が簡単で分かりやすい？

## もう一度、関数型で書いてみた

……冷静になれ、私。

最初のコードをよく見てみると、Ramdaが*x*だから*y*しているという部分があって、その結果としてコードが複雑になっています。たとえば`R.reduce`の引数に初期値が必要とかね。でもこれはRamda的にはしょうがなくて、Ramdaはカリー化を前提にしているので引数の数によるオーバーローディングができないんですよ。だから、`R.reduce`では必ず初期値を指定するしかない。

でもね、私が今書いているのはJavaScriptで、JavaScriptでは引数の数によるオーバーローディングは当たり前の技術で、`Array`の`reduce`は初期値の省略が可能になっています。だから、サクっと`reduce`の別バージョンを作っちゃいました（Ramdaの公式サイトのサンプルでも、その場で関数をじゃかじゃか追加しているしね）。内容が単純なので、ラムダ式で書きます。

~~~ javascript
const reduce = (pred, xs) => R.apply(R.reduce(pred), R.juxt([R.head, R.tail])(xs));
~~~

あとあれだ、最大の要素を探すときに`R.maxBy`と`R.reduce`を組み合わせるのも面倒くさかった。なので、別バージョンを。

~~~ javascript
const maxBy = (pred, xs) => reduce(R.maxBy(pred), xs);
// カリー化を活用してconst maxBy = reduce(R.maxBy(pred))の方が短いけど、引数が消えるとわかりづらくなりそうだったので……。
~~~

インデックス化もね。

~~~ javascript
const indexed = (xs) => R.addIndex(R.map)(R.constructor(Array), xs);
~~~

あれ、今作った`maxBy`と`indexed`を組み合わせると、最大の要素のインデックスを取得する関数も作れちゃう？

~~~ javascript
const maxIndexBy = (pred, xs) => maxBy(R.apply(pred), indexed(xs))[1];
// JavaScriptは引数の数が足りない場合は単純に無視するので、R.apply(pred)するだけで大丈夫。
~~~

ついでに、`assocPath`の値ではなくて関数を取るバージョンを、`adjustPath`として定義しちゃいましょう。

~~~ javascript
const adjustPath = (path, func, xs) => R.assocPath(path, func(R.path(path, xs)), xs);
~~~

関数型プログラミングは関数という小さな単位が基本要素なので、組み合わせの際に小回りが利いて実に便利ですな。サクサク新しい関数を作れちゃう。今回作成した関数群は唐揚げ弁当問題に特化していない、汎用的なものなので再利用できそうですしね。

というわけで、これらの関数群を`utility.mjs`としてまとめた上で、もう一度関数型プログラミングしてみましょう。

~~~ javascript
import R                        from 'ramda';
import {adjustPath, maxIndexBy} from './utility';

const lunchBoxes = [{'唐揚げ': {count: 10}, '玉子焼き': {count: 1}},
                    {'唐揚げ': {count:  8}},
                    {'唐揚げ': {count:  6}}];

const canEatIndex = (foodName, lunchBoxes) => maxIndexBy(R.path([foodName, 'count']), lunchBoxes);
const eatWithFinger = (foodName, lunchBoxes) => adjustPath([canEatIndex(foodName, lunchBoxes), foodName, 'count'],
                                                           R.dec,
                                                           lunchBoxes);

export default function main() {
  const eatKaraageWithFingerFiveTimes = R.apply(R.pipe)(R.repeat(R.curry(eatWithFinger)('唐揚げ'), 5));

  console.log(eatKaraageWithFingerFiveTimes(lunchBoxes));
}
~~~

おお、ちょー短い。`canEatIndex`は数量が最も大きい食材のインデックスを返すこと、`eatWithFinger`はその食材の数量をデクリメントすることが、コードからすぐに分かります（`adjustPath`という関数が何するのかは、`R.adjust`から推測できるはず……ということにしてください）。

で、上のコードで注目して頂きたい点が、もう一つあります。

今回書き直した際に`canEatIndex`を別の関数に分割したわけですけど、手続き型の場合は、このように関数を分割するのはかなり勇気がいります。だって、別にした関数の中で`lunchBoxes`を変更していないことを確認するには、その関数の中身を確認しなければならないわけですからね。今回みたいに単純なプログラムならいいですけど、でも、大きなプログラムだったり、複数人で開発していたりしたら？　関数型プログラミングは副作用を嫌いますから、関数型プログラミングしていればそんな心配は不要となります（ちなみに`eatWithFinger`にも副作用はありません。新しいリストを返しますから）。うん、私は関数型プログラミングな人で良かったなぁと。

## 参考

[関数型プログラミングはまず考え方から理解しよう](https://qiita.com/stkdev/items/5c021d4e5d54d56b927c) ←元ネタ。

[唐揚げつまんでみた](https://qiita.com/ttatsf/items/66680350eeb64956c207) ←Haskellやっぱりすげー。Haskell的な書き方をJavaScriptでもやっていてすげー。

[PHPでも唐揚げつまんでみた](https://qiita.com/nunulk/items/a73e26b9f6c181440309#_reference-4d44de7b0009f411f9aa) ←PHPでHaskellライクにやってます。すげー。

[Ramda](http://ramdajs.com/) ←とても便利。おすすめです。

[functional-programming-with-es6-and-ramda](https://github.com/tail-island/functional-programming-with-es6-and-ramda/) ←本稿で作成したコードです。
