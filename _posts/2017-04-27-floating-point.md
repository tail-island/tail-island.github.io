---
layout:   "post"
title:    "浮動小数点の誤差にご用心！"
category: "programming"
tags:     "Python"
---

ゲームを作っていたら（←SIerで働いているとは思えない書き出し）、浮動小数点の誤差でひどい目にあいました……。同じ穴にハマる方がいらっしゃるかもしれないので、注意喚起を。

そのゲームはキャラクターが重なってはならない仕様だったので、[移動する2つの球の衝突判定](http://marupeke296.com/COL_3D_No9_GetSphereColliTimeAndPos.html)が必要でした。移動する2つの球の衝突判定は2次方程式を解く形になっていたので、以下のような関数を作成しました。

```python
def solve_quadratic_equation(a, b, c):
    d = b ** 2 - 4 * a * c

    if d >= 0:
        return ((-b + math.sqrt(d)) / (2 * a),
                (-b - math.sqrt(d)) / (2 * a))

    return ()
```

昔学校で習ってその後完全に忘れた、「まいなすびーぷらすまいまするーとびーにじょうまいなすよんえーしーわるにえー」って奴ですな。で、この関数を使って衝突判定してみたところ、なんだか時々おかしな動作をします。具体的には、キャラクターが少しだけ食い込んじゃう時がある（キャラクターが重なった状態でもう一度衝突判定すると、キャラクターが離れる瞬間を衝突と間違えて堂々巡りするというバグになっちゃう）。

これは多分浮動小数点の誤差でしょうとあたりをつけてインターネットを検索してみたら、どうやら、2次方程式の解の公式をそのままプログラミングするのは素人らしい。30年以上プログラムを組んでいるのに、いまだ素人でしたよ、私は……。

なんでも、同じ値の浮動小数点の引き算は精度が落ちるので、`-b +/- math.sqrt(d)`の部分がダメなんだって。`math.sqrt()`の結果は正の数なので、`b`がどんな値であっても必ず引き算が発生しちゃうというわけ。ではどうするかというと、2次方程式の解の係数の関係を使うんだそうです。2次方程式は2乗しているので解が2つあるわけで、それを`α`と`β`とした場合、`α + β == -b / a`と`α * β == c / a`という関係が成り立つんだって。だから、引き算がない方を使ってとりあえず解を一つ見つけて、解の係数の関係を使ってもう一つの解を求めればよい。コードにすると、こんな感じ。

```python
def solve_quadratic_equation(a, b, c):
    d = b ** 2 - 4 * a * c

    if d >= 0:
        if b >= 0:
            x = (-b - math.sqrt(d)) / (2 * a)
        else:
            x = (-b + math.sqrt(d)) / (2 * a)

        return (x, c / a / x) if x != 0 else (x, x)

    return ()
```

さて、このコードの効果は？　誤差がどのくらい減るのか、可視化してみましょう。`-b + math.sqrt(b ** 2 - 4 * a * c)`が問題なのだから、`b`の絶対値が大きくて`a`と`c`が小さい場合に誤差がでるはず。だからbの値は大きくしたい。あと、正解を簡単に計算できるようにもしておきたい。というわけで、`a`と`c`を1に固定して、`x ** 2 - (10 ** n + 10 ** -n) * x + 1`の場合でやりましょう。この場合の正解は`10 ** n`と`10 ** -n`になるはず。あとは誤差を計算してグラフを描くだけ。というわけで、可視化のコードは以下の通り。

```python
import math
import matplotlib.pyplot as plot
import numpy as np

from matplotlib import cm
from mpl_toolkits.mplot3d import Axes3D


def solve_quadratic_equation_1(a, b, c):
    d = b ** 2 - 4 * a * c

    if d >= 0:
        return ((-b + math.sqrt(d)) / (2 * a),
                (-b - math.sqrt(d)) / (2 * a))

    return ()


def solve_quadratic_equation_2(a, b, c):
    d = b ** 2 - 4 * a * c

    if d >= 0:
        if b >= 0:
            x = (-b - math.sqrt(d)) / (2 * a)
        else:
            x = (-b + math.sqrt(d)) / (2 * a)

        return (x, c / a / x) if x != 0 else (x, x)

    return ()
 

def visualize(f):
    def error(n):
        a,  b  = sorted((10 ** n, 10 ** -n))
        a_, b_ = sorted(f(1, -(10 ** n + 10 ** -n), 1))

        return (n, max(math.fabs(a - a_), math.fabs(b - b_)))

    def errors():
        return tuple(map(error, np.linspace(0, 10, 100)))

    x, y = zip(*errors())
    
    plot.plot(x, y)
    plot.show()


if __name__ == '__main__':
    visualize(solve_quadratic_equation_1)
    visualize(solve_quadratic_equation_2)
```

可視化結果は、こんな感じ。

![誤差多い](/images/2017-04-27/quadratic_equation_1.png)
![誤差少ない？](/images/2017-04-27/quadratic_equation_2.png)

……確かに誤差が出るケースは少なくなったけど、大きな誤差がでる場合の、誤差の量そのものは変わらないじゃん！　というわけで、このコードでもやっぱり誤差は出ちゃいます。だから、今回は、誤差の許容量であるEPSを変えて対応しました。今回私がハマった穴というのは、浮動小数点と二次方程式じゃなくて、可視化してみないと効果はわからないという部分です。皆様気をつけて！　やっぱり、可視化は大事ですよ。

そもそも、どうして私は浮動小数点の誤差を押さえ込めると考えちゃったんだろ？

```python
if float(2 ** 53) == float(2 ** 53) + 1:
    print('xとx+1は等しい')
```

だって、上のコードを実行すると「xとx+1は等しい」と表示されちゃうくらい、浮動小数点は不完全なのに……。