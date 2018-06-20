---
layout:   "post"
title:    "今年49歳になるおっさんが頑張って作ったモンテカルロ木探索"
category: "programming"
tags:     ["Python"]
---

[前回](http://tail-island.github.io/programming/2018/06/15/min-max-alpha-beta.html)はミニ・マックス法とアルファ・ベータ法をやったのですけど、マルバツのような簡単なゲームならともかく、一般のゲームでは最後まで読みきれないので、評価関数を作らなければなりません。でも、今年49歳になるおっさんの私は脳が弱っているので、ゲームに勝てるスゴイ評価関数を作るのは無理……。というわけで、評価関数が不要と評判のモンテカルロ木探索をやります。

## モンテカルロ法

モンテカルロ法と聞くと大層な話に聞こえるかもしれませんけど、要はただのランダムです。ランダムな値を使用して何度もシミュレーションして、それで解を導くというだけの話。たとえば円周率の値を知りたいなら数学が得意な友人に聞くのが正攻法なのでしょうけど、私のような人間の友人がいない引きこもりは不可能です。だから、無機物の友人であるコンピューターにランダムで点を打たせて、その点が円の内側か外側かを調べて、そこから円周率を計算します。このチカラワザなやり方が、モンテカルロ法なんです。

~~~ python
from random import random


def main():
    c = 10000000
    n = 0

    for _ in range(c):
        # ランダムな点を作ります。
        x = random() * 2 - 1
        y = random() * 2 - 1

        # 円の内側かどうかを判定します。
        if x ** 2 + y ** 2 < 1:
            n += 1

    print(4 * n / c)
~~~

このプログラムを実行したところ、3.1410432が出力されました。友人がいる人は、この値が正しいか確認してみてください。たぶん、小数点以下第三位くらいまでは正しいんじゃないかな。

## 原始モンテカルロ探索

というわけでこの名前がかっこいいモンテカルロ法の、実際はただランダムを使ってシミュレーションするだけのマルバツAIを作成してみましょう。ランダムな手でゲームを最後までシミュレーションするのを繰り返して、最も勝ちが多かった手を選ぶことにします。

~~~ python
# プレイアウト。
def playout(state):
    if state.lose:
        return -1

    if state.draw:
        return  0

    return -playout(state.next(random_next_action(state)))


# 集合の最大値のインデックスを返します。
def argmax(collection, key=None):
    return collection.index(max(collection, key=key) if key else max(collection))


# 原始モンテカルロ探索。
def monte_carlo_search_next_action(state):
    values = [0] * len(state.legal_actions)

    for i, action in enumerate(state.legal_actions):
        for _ in range(10):
            values[i] += -playout(state.next(action))

    return state.legal_actions[argmax(values)]
~~~

ゲームを最後までやりきることを、業界用語ではプレイアウトというそうです。なので、`playout`という名前の関数を作りました。前回作成した`random_next_action`を使用して、勝負がつくまでゲームをやりきります。

`argmax`は、集合の中の最大値のインデックスを返す関数です。たとえば`argmax((1, 3, 2))`なら「1」が返ってきます。この関数は、最も勝率が高かったのは何番目のアクションなのかを調べるために使用します。

で、`monte_carlo_search_next_action`が、モンテカルロ法を活用した原始モンテカルロ探索と呼ばれるアルゴリズムです。今回はアクションごとに10回プレイアウトして（`-playout()`になっているのは、`state.next()`を引数にしているので、敵のスコアが返ってくるから）、プレイアウトで得たスコアの合計が最も大きなアクションを選んでいるだけ。

で、面白いことに、こんなヘッポコなコードでも、それなりの性能が出ちゃうんですよ。メイン・ルーチンを以下に変えて試してみます。

~~~ python
def main():
    def first_player_point(ended_state):
        if ended_state.lose:
            return 1 if (popcount(ended_state.pieces) + popcount(ended_state.enemy_pieces)) % 2 == 1 else 0

        return 0.5

    def test_algorithm(next_actions):
        total_point = 0

        for _ in range(100):
            state = State()

            for next_action in cat(repeat(next_actions)):
                if state.end:
                    break;

                state = state.next(next_action(state))

            total_point += first_player_point(state)

        return total_point / 100


    print(test_algorithm((monte_carlo_search_next_action, random_next_action)))
    print(test_algorithm((monte_carlo_search_next_action, nega_alpha_next_action)))
~~~

原始モンカルロ探索とランダム、原始モンテカルロ探索とアルファ・ベータ法を対戦させて、勝率を表示させるわけですな。

~~~ python
$ python tictactoe.py
0.985
0.365
~~~

ほら、ランダムに圧勝で、アルファ・ベータ法に善戦しているでしょ？

## モンテカルロ「木」探索

でもね、原始モンテカルロ探索に「原始」なんて枕詞がついているのは、これは古臭いやり方だからなんですよ。当然より良いアルゴリズムがあるわけで、それがモンテカルロ「木」探索です。

### 平均して良い手が良い手とは限らない

前回のミニ・マックス法でやりましたけど、敵は、敵が有利になる手、私が不利になる手を選びます。10回プレイアウトして9回は勝つけど1回は負ける手があって、もしその1回が必敗の手の場合、敵はその手を選んできます。つまり、残り9回の勝ちに価値はないわけで、でも、原始モンテカルロ探索だと9/10という高い確率で勝つその悪手を選んでしまいます。

だから、ミニ・マックス法の時みたいに交互に互いが有利な手を選んでいって、それでも勝つ手を選ぶことにしましょう。プレイアウトで勝率を決める、自分に有利な手を選んでその先を読む、プレイアウトで勝率を決める、今度は相手に有利な手を選んでその先を読む……、みたいな感じです。

ただ、合法手は多数あって、その多数の合法手の一つ一つに次の多数の合法手があるので、あっという間に手に負えない数になってしまいます。だから、すべての合法手に一定回数のプレイアウトを実施するような方式は使えません。良い手は深く、悪いては浅く読むための工夫が必要なのです。

### マルチ・アーム・バンディット問題

この工夫を実現するために、モンテカルロつながりで、カジノのスロット・マシンで考えてみましょう。

「目の前に3台のスロット・マシンがあります。スロット・マシンには、それぞれ異なる勝率が設定されています。でも、その勝率は外からは見えません。さて、それぞれにどれだけのお金を突っ込みますか？」

スロット・マシンの横のガチャコンする棒をアームと呼ぶので、マルチ・アーム・バンディット問題と呼ばれている問題です（ごめんなさい。なんでbandit（山賊）なのかは知りません）。

勝率を調べるためにそれぞれのスロット・マシンで100回ずつモンテカルロ法する……ってのはダメ。無限にお金があるならこれでもよいですけど、そもそも無限にお金があるならカジノには来ません。勝率が低いスロット・マシンに投入するお金は、できるだけ減らしたい。

心に決めた一台に所持金のすべてをつぎ込む。他のスロット・マシンでは勝負しないのだから勝率は分からないわけで、だから私が選んだこの1台より他のスロット・マシンの勝率が高い証拠はない……ってのもダメ。もっと可能性を探らないとね。心情的には分かるけど。

「勝率を探るためにまんべんなく打つ」のと「勝率が高そうなスロット・マシンにつぎ込む」のを、バランス良くやらなければならないんです。これはカジノでだけ通用する話ではなくて、例えばWebアプリケーションのA/Bテストの効率を向上させる場合等にも使える話です。リクエストの半分をページA、残り半分をページBに振り分けて、反応が良かった方のページを選ぶというA/Bテストは、勝率を調べるためにそれぞれのスロット・マシンで100回ずつモンテカルロするってのと同じ程度にダメなやり方なんです。ちなみに、自分が最高だと思うWebページを作ってA/Bテストすらしないってのが、一台に所持金のすべてを突っ込むダメダメな方式です。

では、どうやってバランスを取ればよいのでしょうか？　幸いなことに、偉い人が答を出してくれていました。その答の一つが、UCB1と呼ばれるアルゴリズムです。

~~~ python
UCB1 = (w / n) + (2 * log(t) / n) ** (1 / 2)

# wはこのスロット・マシンの試行回数
# nはこのスロット・マシンの成功回数
# tは総試行回数
~~~

なぜ平方根を使わずに1/2乗するのかは私には分かりませんでしたが、`(2 * log(t) / n) ** (1 / 2)`の部分は、試行回数が少ない場合になんとなく大きな値になるような気はします。この値に勝率である`(w / n)`を合計した結果が高いスロット・マシンを選んでいけば、なんとなくだけどバランスが取れそうです（私はUCB1の証明をカケラも理解していません）。マルバツのアクションごとに`w`と`n`を用意してあげて、その中からUCB1が最大のものを選んで探索していけば、なんとかなりそう。

そうそう、先程の式は勝ちが1で負けが0の場合用で、勝ちが1で負けが-1になる場合は`UCB1 = (w / n) + 2 * (2 * log(t) / n) ** (1 / 2)`になります。ちなみに追加された`2 *`の`2`は、`1 - (-1)`の結果。報酬の最大値と最小値の差を掛ければよいらしい。A/Bテストの効率化に使うときは、たとえば課金金額の最大と最小の差を使えばよいのかなぁと。

### モンテカルロ木探索

バランスを取る方法がわかりましたから、プログラミングに入りましょう。UCB1が最大になる次のアクションを選んで、プレイアウトする。これを繰り返していくわけですけど、次のアクションをプレイアウトするだけではその先を読めませんから、一定の回数でプレイアウトをやめて、次の次のアクションを選択してプレイアウトするモードに移行します。ただ、モードが変わってもやることは同じ。UCB1が最大になる次の次のアクションを選んで、プレイアウトするだけ。だから、再帰で表現できます。あと、状態の管理が楽になるように、クラスにまとめると良さそう。以上をふまえて作成したのが、以下の`node`クラスです。

~~~ python
class node:
    def __init__(self, state):
        self.state       = state
        self.w           = 0     # 価値
        self.n           = 0     # 試行回数
        self.child_nodes = None  # 子ノード

    def evaluate(self):
        if self.state.end:
            value = -1 if self.state.lose else 0

            self.w += value
            self.n += 1

            return value

        if not self.child_nodes:
            value = playout(self.state)

            self.w += value
            self.n += 1

            if self.n == 10:
                self.expand

            return value
        else:
            value = -self.next_child_node().evaluate()

            self.w += value
            self.n += 1

            return value

    def expand(self):
        self.child_nodes = tuple(node(self.state.next(action)) for action in self.state.legal_actions)

    def next_child_node(self):
        def ucb1_values():
            t = sum(map(attrgetter('n'), self.child_nodes))

            return tuple(-child_node.w / child_node.n + 2 * (2 * log(t) / child_node.n) ** 0.5 for child_node in self.child_nodes)

        for child_node in self.child_nodes:
            if child_node.n == 0:
                return child_node

        ucb1_values = ucb1_values()

        return self.child_nodes[argmax(ucb1_values)]
~~~

`evaluate()`メソッドが呼ばれると、評価を実施します。`if self.state.end`の中はゲームが終了している場合の処理です。`self.w`に負けなら-1、引き分けなら0を足して、`self.n`をインクリメントします。で、ミニ・マックス方やアルファ・ベータ法のときと同じように、`value`をリターンします。

`if not self.child_nodes`の中は、プレイアウトして勝率を設定するモードの処理です。コンストラクタで`self.child_nodes = None`していますから、最初はこのモードになります。処理は単純で、まずはプレイアウトの結果でゲーム終了の場合と同様に`self.w`と`self.n`の値を更新します。で、いつまでもこのモードのままだと先を読むことができませんから、`if self.n == 10`で、10回プレイアウトしたら子ノードを展開して別モードに移行しています。

`else`の中がその別モードで、次の手を評価するモードです。`self.next_child_node()`でUCB1が最大の子ノードを選んで、再帰呼び出しします。次の手なので`evaluate()`の結果の符号を反転させるところだけは注意して、あとはやっぱりこれまでと同じ処理。

`next_child_node()`メソッドが、上で説明したUCB1が最大の子ノードを選ぶ処理です。一度も評価されていない子ノードの`n`の値は0で、それだとゼロ除算例外になってしまいますので、`for child_node in self.child_nodes`の中で、とりあえずすべての子ノードの0が1以上になるようにまんべんなく呼び出しています（すべてのスロット・マシンを最低1回は試すのと同じ）。`child_node.w`は敵にとっての価値なので、符号を反転するところだけは気をつけてください。

で、プレイアウトで子ノードの`w`や`n`の値が変わってくると、バランス良く、しかし、勝率が高い子ノードほど数多く評価されていくことになります。数多く評価された子ノードは`if self.n == 10`の条件を満たしてさらに子ノードを展開して……となっていきますので、結果として、良さそうな手は深く、そうでない手は浅く読むことになるというわけ。そうそう、先を読んだ結果も`w`や`n`にフィードバックされますから、一見良さそうだけど実は相手に有利な手の場合はだんだん評価されなくなります。

あとは、この`node`クラスを使って手を選択する処理を書けば終わり。

~~~ python
def monte_carlo_tree_search_next_action(state):
    root_node = node(state)
    root_node.expand()

    for _ in range(100):
        root_node.evaluate()

    return state.legal_actions[argmax(root_node.child_nodes, key=attrgetter('n'))]
~~~

今の局面の`w`に意味はありませんから（今の局面が悪くても、前の手をやり直せるわけではない）、いきなり`root_node.expand()`してモードを切り替えた上で、100回`evaluate()`しています。で、最も`n`（試行回数）が多い手を返す。

どうして最後の最後で`w`（価値）じゃなくて`n`（試行回数）を使用するのかというと、試行回数が少ない場合の`w`は不正確な可能性があるためです。UCB1を使って良さげな手を多数評価したのだから、`n`は良さを表現する指標として使用できるでしょう。

### 試してみある

メイン・ルーチンの`monte_carlo_search_next_action`を`monte_carlo_tree_search_next_action`に変更して試してみます。

~~~
$ python tictactoe.py
1.0
0.46
~~~

はい、原始モンテカルロ探索よりも成績が良くなりました。対アルファ・ベータ法の勝率は最大でも0.5ですから、結構良さそうですね。

## せっかく読んだ手が無駄になっているような……

今回の実装では、`monte_carlo_tree_search_next_action()`が終了すると探索結果をすべて捨てていますので、一つ前の手を読んだときと次の手を読むときで、同じノードを複数回評価するかもしれません。これはもったいないのでキャッシュしようぜ……って考えるのは自然なのですけど、そうすると、前の呼び出しで評価済みのノードと今回の呼び出して追加されたノードの`n`の値がごっちゃになっちゃう。`n`を親ノードで管理すれば大丈夫な気もしますけど、コードがわかりづらくなりそうです。あと、合流（異なる経路で同じ局面に達する場合）も、マルバツならば多分大丈夫だけど他のゲームでは問題になるような気がします。

## あともう少しで最強になれそうだけど、どうにかならないの？

プレイアウトの質を高めれば、更に強くなります。今回のプレイアウトは完全にランダムですけど、たとえばリーチがかかったら阻止するとかの実際に即した形で打つように変更するわけ。これでかなり強くなるはず。あと、評価回数を増やしても強くなります。ただ、マルバツだと終局まで読み切るノードが出てきちゃうので、ほぼミニ・マックス法になっちゃうような気がしますけど……。

それ以外の方法としては、モンテカルロ木探索に深層学習を組み合わせた、Googleのアルファ碁があります。実はすでに実装済みなので、次回はこれで。

---

最後に、ちょっと試してみたいという場合用に、コード全体を載せておきます。pip3 install funcyして、python3 xxx.pyしてみてください。

~~~ python
from funcy    import *
from math     import inf, log
from operator import *
from random   import randint


def popcount(x):
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
        return popcount(self.pieces) + popcount(self.enemy_pieces) == 9

    @property
    def end(self):
        return self.lose or self.draw

    @property
    def legal_actions(self):
        return tuple(i for i in range(9) if not self.pieces & 0b100000000 >> i and not self.enemy_pieces & 0b100000000 >> i)

    def next(self, action):
        return State(self.enemy_pieces, self.pieces | 0b100000000 >> action)

    def __str__(self):
        ox = ('o', 'x') if popcount(self.pieces) == popcount(self.enemy_pieces) else ('x', 'o')
        return '\n'.join(''.join((ox[0] if self.pieces & 0b100000000 >> i * 3 + j else None) or (ox[1] if self.enemy_pieces & 0b100000000 >> i * 3 + j else None) or '-' for j in range(3)) for i in range(3))


# ランダムで次の手を返します。
def random_next_action(state):
    return state.legal_actions[randint(0, len(state.legal_actions) - 1)]


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


# プレイアウト。
def playout(state):
    if state.lose:
        return -1

    if state.draw:
        return  0

    return -playout(state.next(random_next_action(state)))


def argmax(collection, key=None):
    return collection.index(max(collection, key=key) if key else max(collection))


# モンテカルロ探索。
def monte_carlo_search_next_action(state):
    values = [0] * len(state.legal_actions)

    for i, action in enumerate(state.legal_actions):
        for _ in range(10):
            values[i] += -playout(state.next(action))

    return state.legal_actions[argmax(values)]


# モンテカルロ「木」探索。
def monte_carlo_tree_search_next_action(state):
    class node:
        def __init__(self, state):
            self.state       = state
            self.w           = 0     # 価値
            self.n           = 0     # 試行回数
            self.child_nodes = None  # 子ノード

        def evaluate(self):
            if self.state.end:
                value = -1 if self.state.lose else 0

                self.w += value
                self.n += 1

                return value

            if not self.child_nodes:
                value = playout(self.state)

                self.w += value
                self.n += 1

                if self.n == 10:
                    self.expand

                return value
            else:
                value = -self.next_child_node().evaluate()

                self.w += value
                self.n += 1

                return value

        def expand(self):
            self.child_nodes = tuple(node(self.state.next(action)) for action in self.state.legal_actions)

        def next_child_node(self):
            def ucb1_values():
                t = sum(map(attrgetter('n'), self.child_nodes))

                return tuple(-child_node.w / child_node.n + 2 * (2 * log(t) / child_node.n) ** 0.5 for child_node in self.child_nodes)

            for child_node in self.child_nodes:
                if child_node.n == 0:
                    return child_node

            ucb1_values = ucb1_values()

            return self.child_nodes[argmax(ucb1_values)]

    root_node = node(state)
    root_node.expand()

    for _ in range(100):
        root_node.evaluate()

    return state.legal_actions[argmax(root_node.child_nodes, key=attrgetter('n'))]


def main():
    def first_player_point(ended_state):
        if ended_state.lose:
            return 1 if (popcount(ended_state.pieces) + popcount(ended_state.enemy_pieces)) % 2 == 1 else 0

        return 0.5

    def test_algorithm(next_actions):
        total_point = 0

        for _ in range(100):
            state = State()

            for next_action in cat(repeat(next_actions)):
                if state.end:
                    break;

                state = state.next(next_action(state))

            total_point += first_player_point(state)

        return total_point / 100


    print(test_algorithm((monte_carlo_tree_search_next_action, random_next_action)))
    print(test_algorithm((monte_carlo_tree_search_next_action, nega_alpha_next_action)))


if __name__ == '__main__':
    main()
~~~
