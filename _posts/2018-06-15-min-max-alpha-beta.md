---
layout:   "post"
title:    "今年49歳になるおっさんでも分かるミニ・マックス法とアルファ・ベータ法"
category: "programming"
tags:     ["Python"]
---

二人零和有限確定完全情報ゲームAIのアルゴリズムといえばとりあえずコレという、ミニ・マックス法とアルファ・ベータ法の説明です。お題はマルバツ、言語はPython3です。

## マルバツのルールを実装する

前準備として、マルバツのルールを実装しましょう。いきなりコードでごめんなさい。

~~~ python
from funcy  import *


def _popcount(x):
    return bin(x).count('1')  # Pythonだと、コレが手軽で速いらしい。


# ゲームの状態。
class State:
    def __init__(self, pieces=0, enemy_pieces=0):
        self.pieces       = pieces
        self.enemy_pieces = enemy_pieces

    @property
    def lose(self):
        return any(lambda mask: self.enemy_pieces & mask == mask, (0b111000000, 0b000111000, 0b000000111, 0b100100100, 0b010010010, 0b001001001, 0b100010001, 0b001010100))

    @property
    def draw(self):
        return _popcount(self.pieces) + _popcount(self.enemy_pieces) == 9

    @property
    def end(self):
        return self.lose or self.draw

    @property
    def legal_actions(self):
        return tuple(i for i in range(9) if not self.pieces & 0b100000000 >> i and not self.enemy_pieces & 0b100000000 >> i)

    def next(self, action):
        return State(self.enemy_pieces, self.pieces | 0b100000000 >> action)

    def __str__(self):
        ox = ('o', 'x') if _popcount(self.pieces) == _popcount(self.enemy_pieces) else ('x', 'o')
        return '\n'.join(''.join((ox[0] if self.pieces & 0b100000000 >> i * 3 + j else None) or (ox[1] if self.enemy_pieces & 0b100000000 >> i * 3 + j else None) or '-' for j in range(3)) for i in range(3))
~~~

盤面はビット・フィールドで表現しています。`0b100000000`だと左上にマルやバツが書き込まれた状態、`0b000010000`なら真ん中です。`pieces`が自分のビット・フィールドで`enemy_pieces`が敵のビット・フィールド。次の盤面を求める`next`で、`pieces`と`enemy_pieces`を入れ替えます。`lose`は負けかどうか、`draw`は引き分けかどうか、`end`はゲーム終了かどうか、`legal_actions`は合法手の一覧を返します。あと、`from funcy import *`の「funcy」は、私が愛用しているPython用の関数型プログラミングのライブラリです。とても役立つライブラリなので、`pip install funcy`してみてください。

でね、このコードはミニ・マックス法ともアルファ・ベータ法とも関係はありませんので、お前はマルバツのルールはこんな感じに実装したのねー程度で見ていただければオッケーです。ビット・フィールドの表現をちょっと頑張ったので見て欲しかっただけという……。

## とりあえず、ランダムで手を選んでゲームをさせる

ともあれ、ルールができたので、ゲームをさせてみましょう。

まずは、ランダムで手を選択するマルバツAIです。合法手の一覧を実装済みですから、必要なコードはこれだけ。

~~~ python
from random import randint

def random_next_action(state):
    return state.legal_actions[randint(0, len(state.legal_actions) - 1)]
~~~

このAI同士でゲームをさせてみましょう。コードはこんな感じ。

~~~ python
def main():
    state = State()

    white True:
        if state.end:
            break;

        state = state.next(random_next_action(state))

        print(state)
        print()


if __name__ == '__main__':
    main()
~~~

動かしてみると、たしかにランダムに手を打って勝ったり負けたりしています。馬鹿と阿呆がゲームしている感じ。

~~~
$ python tictactoe.py
o--
---
---

o--
x--
---

o--
x--
-o-

o--
x-x
-o-

o-o
x-x
-o-

o-o
x-x
-ox

o-o
x-x
oox

o-o
xxx
oox
~~~

## ミニ・マックス法

馬鹿と阿呆のゲームでは面白くないので、ミニ・マックス法を駆使して絶対に負けないマルバツAIを作りましょう。

### 先を読む

一般にゲームでは、私がここに打ったら、相手がここに打って、そうなると次に私はここに打って……という感じに先を読んでいきます。ただし、私が打てる手は複数あり、敵が打てる手も複数あって、だからほんの少し読むだけで莫大な数の盤面が出てきてしまいます。人間にはこの多数の盤面を列挙するのは辛いですけど、コンピューターなら余裕（時間はかかりますけど）。というわけで、すべての状態を表示するコードを作成してみました。

~~~
def foo(state):
    print(state)
    print()

    for action in state.legal_actions:
        foo(state.next(action))
~~~

で、こんな感じに先を読めるとして、で、どの手を選べば良いのでしょうか？

### 私が勝つ盤面へと進む手を、相手は選ばない。相手は、私が負ける盤面に進む手を選ぶ

まず思いつくのは、先読みして私が勝つ状態を1つ見つけたら、そのルートに入る手を選択するという方法です。でも、この方法はうまく行きません。

考えてみましょう。私がマルだとして、以下の勝ち盤面を見つけたとします。

~~~
ooo
xx-
---
~~~

この一つ前の状態が以下だとしましょう。

~~~
oo-
xx-
---
~~~

そのもう一つ前の状態は以下のような感じ。

~~~
oo-
x--
---
~~~

ここでマルの勝利を目指して真ん中にバツを打ってくれる相手はいませんよね？　右上にバツを打って、マルの勝利を邪魔するはずです。つまり、私は私が勝つ盤面へと進む手を選びますけど、相手は私が「負ける」盤面へと進む手を選ぶのです。

### 勝敗を数値で表現する

私が勝つとか負けるとかだと少しふわふわしていますから、コードで扱いやすい数値で表現することにしましょう。こんな感じ。

~~~ python
if state.lose:  # 負けちゃったら、
   return -1    # 評価はマイナスですよね。

if state.draw:  # 引き分けになったら、
   return  0    # 負けよりはマシなゼロ。
~~~

上のコードに勝ちがないのは、私が負ける盤面は相手にとっての勝ちだからです。負けである-1を勝ちである1に変換するには、`-`（マイナス）をつけてあげればオッケー（`-0`は`0`なので引き分けは影響を受けません）。以下のような感じでしょうか？

~~~ python
def foo(state):
    if state.lose:
        return -1

    if state.draw:
        return  0

    for action in state.legal_actions:
        score = -foo(state.next(action))  #  このscoreが大きいのが、良い盤面

        ...
~~~

負けでも引き分けでもなければ再帰呼び出しして、`-`をつけて自分のスコアにしちゃうわけです。

~~~
ooo
xx-
---
~~~

は負けなので-1になって、だからその前の

~~~
oo-
xx-
---
~~~

で右上にマルを打った場合のスコアは`-(-1)`で「1」になるというわけ。このやり方はスコアの符号を入れ替えながら何回でも続けることができて、だから、最初の一手を打つ場合にも同じ考え方でいけます。

というわけで、自分も相手も最善を尽くす場合の、盤面のスコアを出す関数は、以下になります。

~~~ python
from math import inf


def foo(state):
    if state.lose:
        return -1

    if state.draw:
        return  0

    best_score = -inf

    for action in state.legal_actions:
        score = -foo(state.next(action))

        if score > best_score:
            bext_score = score

    return best_score
~~~

### ミニ・マックス法

で、実は先程のコードはミニ・マックス法（正確にはネガ・マックス法）そのものなんです。相手はスコアが最小のものを、自分はスコアが最大の盤面を選ぶのがミニ・マックス法。今回は符号を反転しているので毎回最大のスコアを選べば良くて、この方式はネガ・マックス法と呼ばれています。だから、名前を変えましょう。あと、我々が欲しいのはどの手を選択すればよいかで、盤面のスコアではありませんから、手を選択する関数も追加しました。

~~~ python
from math import inf


# ミニ・マックス法（正確にはネガ・マックス法）
def nega_max(state):
    if state.lose:
        return -1

    if state.draw:
        return  0

    best_score = -inf

    for action in state.legal_actions:
        score = -nega_max(state.next(action))

        if score > best_score:
            best_score = score

    return best_score


# 次の手を返します（nega_maxはスコアを返すので、手を返すようにするためにほぼ同じ関数が必要になっちゃいました）。
def nega_max_next_action(state):
    best_score = -inf

    for action in state.legal_actions:
        score = -nega_max(state.next(action))

        if score > best_score:
            best_action = action
            best_score  = score

    return best_action
~~~

試してみましょう。メイン・ルーチンを以下に変えます。

~~~ python
def main():
    state = State()

    for next_action in cat(repeat((random_next_action, nega_max_next_action))):
        if state.end:
            break;

        state = state.next(next_action(state))

        print(state)
        print()
~~~

`cat(repeat((random_next_action, nega_max_next_action)))`で`(random_next_action,  nega_max_next_action, random_next_action, nega_max_next_action...)`と無限に続く集合作成して、順に使用しています。

~~~
$ python tictactoe.py
---
--o
---

--x
--o
---

--x
--o
-o-

x-x
--o
-o-

x-x
-oo
-o-

xxx
-oo
-o-
~~~

後手の`nega_max_next_action`が勝ちました。たまに引き分けはありますけど、絶対に負けはしません。これでミッション・コンプリート？

## アルファ・ベータ法

いいえ。まだミッションは完了してません。というのも、`nega_max_next_action`に先手をやらせると、初手を打つまでにやたらと長い時間がかかるってしまうんですよ。アルファ・ベータ法を駆使して読む範囲を減らして、高速なマルバツAIを作りましょう。

### 枝狩りとは？

まぁ、すべてののありえる局面を読んでいたら時間がかかるのは当然で、だから読む範囲を減らせば良いわけです。次の手、その次の手、さらにその次の手と読んでいくと選択肢が木構造になっていって、ある選択肢を読まないことは木の枝を捨てることに相当するので、「枝狩り」と呼びます。

マルバツですぐに思いつく枝狩りの対象は、盤面を反転させたり回転させたりしたケースです。初手が左上の場合を読んだら、右上とか右下とか左下の場合はその回転なのだから読む必要はないですよね？　マルバツをやっている途中で盤面を90度変えたら結果が変わったなんて話は聞かないですもんね。ただ、ごめんなさい。この枝狩りは今回は作成していません。もしこれをやってミニ・マックス法でも十分な速度が出ちゃったら、アルファ・ベータ法をやる理由がなくなっちゃいますから。

というわけで、今回は作成したのは、スコアの範囲に着目した枝狩りであるアルファ・ベータ法です。

### もし勝つ手があるなら、負ける手は選ばない。相手も同様だけど、相手の勝ちは私の負けなので、相手が選ぶ相手の勝ちは選ばれない

先程のコードの`nega_max_next_action`で、1つ目の`action`のスコアが「0」（引き分け）と出た場合を考えてください。2つ目以降の`action`で選ばれる可能性があるのは、スコアが0を超える場合、スコアが「1」（勝ち）の場合だけですよね？　もし2つめの`action`のスコアが「-1」（負け）なら、それを選ぶのは馬鹿げています。「0」なら、わざわざ手を変える必要はありませんし。

これを相手（`-nega_max(state.next(action))`で呼ばれた先）の立場で考えてみると、もし「1」（勝ち）や「0」（引き分け）のアクションがあっても、それは選んでもらえないことになります（思い出してください。相手の勝ちは自分の負けなので、「1」は「-1」になります）。

そして、相手（`-nega_max(state.next(action))`で呼ばれた先）もやっぱり最大のスコアを選びたいわけなので、もし１つ目のアクションが「0」（引き分け）なら、「-1」（負け）は選びません。「1」（勝ち）なら選ぶかもしれませんけど、「0」でも「1」でも、呼び出し元に選んでもらえない無駄な値という意味では同じです。

つまり、`-best_score`以上の値が出たら、その先を読んでも無駄なんです（`-best_score`以上の値が出た読みそのものも無駄なのですけど、これをやらないと無駄かどうかがわからないのでしょうがない）。というわけで、こんな感じでどうでしょうか？

~~~ python
def foo(state, limit):
    if state.lose:
        return -1

    if state.draw:
        return  0

    best_score = -inf

    for action in state.legal_actions:
        score = -foo(state.next(action), -best_score)

        if score > best_score:
            best_score = score

        if best_score >= limit:
            return best_score  # どうせ選ばれないんだから、このスコアは無効という意味でinfとかを返しても構いません。

    return best_score
~~~

試してみると、おお、すげー速い。

### 敵の敵は味方、じゃなくて自分

でも、さらに効率化できるんですよ。`-foo()`の先で呼びだされる`-foo()`は自分自身（敵の敵は自分）ですよね？　もしそこで`best_score`以下のスコアが出ても、`if score > best_score`で無視されちゃうわけです。だから、2つ先の呼び出しの`best_score`を`-inf`ではなく今の`best_score`から始めても大丈夫なわけ。で、`best_score`の初期値が大きければ、その先の呼び出しで枝狩りできる範囲が広がる効果も期待できちゃう。

というわけで、変数を2つ用意しましょう。`alpha`と`beta`です。コードは以下の通り。

~~~ python
from math import inf


# アルファ・ベータ法（正確にはネガ・アルファ法）
def nega_alpha(state, alpha, beta):
    if state.lose:
        return -1

    if state.draw:
        return  0

    for action in state.legal_actions:
        score = -nega_alpha(state.next(action), -beta, -alpha)

        if score > alpha:
            alpha = score

        if alpha >= beta:
            return alpha

    return alpha


# 次の手を返します（nega_alphaはスコアを返すので、手を返すようにするためにほぼ同じ関数が必要になっちゃいました）。
def nega_alpha_next_action(state):
    alpha = -inf

    for action in state.legal_actions:
        score = -nega_alpha(state.next(action), -inf, -alpha)
        if score > alpha:
            best_action = action
            alpha       = score

    return best_action
~~~

`best_score`が`alpha`になっただけです。これでアルファ・ベータ法（正確にはネガ・アルファ法）は完成。試してみましょう。

~~~ python
def main():
    state = State()

    for next_action in cat(repeat((nega_alpha_next_action, nega_max_next_action))):
        if state.end:
            break;

        state = state.next(next_action(state))

        print(state)
        print()
~~~

実行結果は以下の通り。

~~~
$ python tictactoe.py
o--
---
---

o--
-x-
---

oo-
-x-
---

oox
-x-
---

oox
-x-
o--

oox
xx-
o--

oox
xxo
o--

oox
xxo
ox-

oox
xxo
oxo
~~~

絶対に負けないAI同士が対戦して、結果は引き分けになっています。初手も速いですし、はい、これで完成です。

## 最後まで読めない複雑なゲームはどうするの？

でも、世の中にはマルバツよりも複雑なゲームがあって、複雑なゲームでは最後まで読み切ることはできません。ではどうするかというと、一定の深さまでしか読まないことにして、その深さの盤面のスコアを勝敗とは別の要因で決めるんです。例えばオセロならいい場所に自分のコマがあるかどうかで、将棋ならばどのようなコマを持っているかとか自分のコマと相手の玉の位置関係とかで。このように盤面を評価してスコアを無理やり出す関数を評価関数と呼ぶのですけど、強い評価関数を作るのは難しくて今年49歳になるおっさんでは説明できませんでした。ごめんなさい……。

---

最後に、ちょっと試してみたいという場合用に、コード全体を載せておきます。`pip3 install funcy`して、`python3 xxx.py`してみてください。

~~~ python
from funcy  import *
from math   import inf
from random import randint


def _popcount(x):
    return bin(x).count('1')  # Pythonだと、コレが手軽で速いらしい。


# ゲームの状態。
class State:
    def __init__(self, pieces=0, enemy_pieces=0):
        self.pieces       = pieces
        self.enemy_pieces = enemy_pieces

    @property
    def lose(self):
        return any(lambda mask: self.enemy_pieces & mask == mask, (0b111000000, 0b000111000, 0b000000111, 0b100100100, 0b010010010, 0b001001001, 0b100010001, 0b001010100))

    @property
    def draw(self):
        return _popcount(self.pieces) + _popcount(self.enemy_pieces) == 9

    @property
    def end(self):
        return self.lose or self.draw

    @property
    def legal_actions(self):
        return tuple(i for i in range(9) if not self.pieces & 0b100000000 >> i and not self.enemy_pieces & 0b100000000 >> i)

    def next(self, action):
        return State(self.enemy_pieces, self.pieces | 0b100000000 >> action)

    def __str__(self):
        ox = ('o', 'x') if _popcount(self.pieces) == _popcount(self.enemy_pieces) else ('x', 'o')
        return '\n'.join(''.join((ox[0] if self.pieces & 0b100000000 >> i * 3 + j else None) or (ox[1] if self.enemy_pieces & 0b100000000 >> i * 3 + j else None) or '-' for j in range(3)) for i in range(3))


# ランダムで次の手を返します。
def random_next_action(state):
    return state.legal_actions[randint(0, len(state.legal_actions) - 1)]


# ミニ・マックス法（正確にはネガ・マックス法）
def nega_max(state):
    if state.lose:
        return -1

    if state.draw:
        return  0

    best_score = -inf

    for action in state.legal_actions:
        score = -nega_max(state.next(action))

        if score > best_score:
            best_score = score

    return best_score


# 次の手を返します（nega_maxはスコアを返すので、手を返すようにするためにほぼ同じ関数が必要になっちゃいました）。
def nega_max_next_action(state):
    best_score = -inf

    for action in state.legal_actions:
        score = -nega_max(state.next(action))

        if score > best_score:
            best_action = action
            best_score  = score

    return best_action


# アルファ・ベータ法（正確にはネガ・アルファ法）
def nega_alpha(state, alpha, beta):
    if state.lose:
        return -1

    if state.draw:
        return  0

    for action in state.legal_actions:
        score = -nega_alpha(state.next(action), -beta, -alpha)

        if score > alpha:
            alpha = score

        if alpha >= beta:
            return alpha

    return alpha


# 次の手を返します（nega_alphaはスコアを返すので、手を返すようにするためにほぼ同じ関数が必要になっちゃいました）。
def nega_alpha_next_action(state):
    alpha = -inf

    for action in state.legal_actions:
        score = -nega_alpha(state.next(action), -inf, -alpha)

        if score > alpha:
            best_action = action
            alpha       = score

    return best_action


def main():
    state = State()

    for next_action in cat(repeat((nega_alpha_next_action, nega_max_next_action))):  # random_next_action, nega_max_next_action, nega_alpha_next_actionの中から適当に選んでください
        if state.end:
            break;

        state = state.next(next_action(state))

        print(state)
        print()


if __name__ == '__main__':
    main()
~~~
