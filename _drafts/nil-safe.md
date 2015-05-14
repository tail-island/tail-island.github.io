---
layout:   post
title:    "NullPointerExceptionが出るのは、プログラマーの問題ではなくてプログラミング言語の問題だと思う"
category: Programming
tags:     [Clojure]
---

私は関数から`nil`を返すことが多いのですけれど、このような話をすると、Javaや.NET Frameworkの人から`NullPointerException`が発生して大変なのではないかと聞かれます。

ぜんぜん大変ではないですよ。だって、私が使っているClojureでは、限られた場合にしか`NullPointerException`は発生しませんからね。

---

では、少し遠回りになりますけど、まず、Clojureにおける真偽の話から。

Clojureの`if`は、`nil`と`false`なら偽、それ以外はなんであれすべて真とみなします。たとえば、`booleanValue`が`false`に設定された`java.lang.Boolean`も、`nil`でも`false`でもないので真となります。REPL上では"false"と表示されますけれど、真なんです。

```clojure
user> (def b (Boolean. false))
#'user/b
user> (if b :true :false)
:true  ; (Boolean. false)は真。
user> b
false  ; toStringした結果で、偽のfalseとは無関係。
```

次に、destructuringの話を。

Clojureでは、ベクター（`nth`できるならリストでも文字列でも何でもよい）とマップ（`ILookup`ならベクターでも文字列でも何でもよい）を、うまいことバラバラにしてくれるdestructuringという機能があります。

```clojure
user> (def xs [:a :b :c])
#'user/xs
user> (let [[a b] xs]  ; Vector binding destructuringの例。aを1番目の要素、bを2番目の要素に束縛する。
        b)             ; bを返す。
:b                     ; 2番目の要素の:bが返ってきた。
```

上の例では最初の3番目以降の要素は捨てちゃっているんですけれど、「残り全部」をdestructionすることもできます。

```clojure
user> (let [[a b & more] xs]  ; "& 変数名"で、残り全部を変数に束縛する。
        more)
(:c)
```

で、逆に、要素の数が足りない場合は、`nil`が束縛されるんです。`nil`は偽だけではなく、存在がないことや空集合も表現しているわけですね。ふう、やっと`nil`につながった。

```clojure
user> (let [[a b c d & more] xs]
        [d more])
[nil nil]
```

最後に、ループの話を。

関数型言語では、変数に値を再代入することはできません。なので、`for (int i = 0; i < 3; ++i)`のようなコードは書けません。手続き型言語のforは、変数iに0, 1, 2...と再代入を繰り返すコードですもんね。なのでどうするかというと、一般に再帰を使います。

```clojure
user> (defn foo
        [i n]
        (when (< i n)
          (println i)
          (recur (inc i) n)))  ; ここで再帰。Clojureでの末尾再帰は、recurを使います。
#'user/foo
user> (foo 0 3)
0
1
2
nil
```

コレクションの要素を順次処理する場合はどうしましょうか？　Javaで`for (int x : xs)`、C#で`for each (var x in xs)`のような場合です。この場合は、一般にdestructuringと再帰を使います。

```clojure
user> (defn bar
        [[x & xs]]  ; 引数もdestructuringできます。
        (when x
          (println x)
          (recur xs)))
#'user/bar
user> (bar [:a :b :c])
:a
:b
:c
nil
```

さて、この`bar`を`nil`を引数にして呼び出したら、どうなるでしょうか？

先ほどのdestructuringの説明の中で、存在がない場合や空集合では`nil`が束縛されると書きました。逆もまた真なりで、`nil`をdestrucuringする場合は空集合をdestructuringした場合と同じ扱いになり、上のコードの`x`は`nil`になります。で、最初のClojureの真偽値で述べたように`nil`は偽ですから`when`の条件は偽になって、なにもしないで処理が終わります。

以上から、Clojureでの集合操作に`nil`を渡しても、`NullPointerException`は発生しません。そして、ClojureはLISPの方言で、LISPはLISt Processorの略だったりするので、処理の多くは集合操作です。`NullPointerException`が発生するのは数値や文字列やJava連携の処理くらいで、その場合にだけ気をつければよいというわけ。ね、`nil`を使ってもあまり問題なさそうでしょ？

---

あ、でも、MacOSやiOSの開発言語のObjective-Cでの解決策はもっと素敵で、`nil`に対してどんなメッセージを投げても`nil`が返ってくるというものでした。`[nil doSomethingWith: x]`（Javaでの`null.doSomething(x)`と同じ意味）とか書いてもフツーに`nil`が返ってくるだけなので、なんだか安心でした……。Kotlinでは、`NullPointerException`が発生するようなコードはコンパイル・エラーになるみたい。エレガントな解法というのはいろいろあって、これらに比べるとClojureの`nil`対策はまだまだなのかもしれません。もっと他の言語も勉強しないとなりませんね。
