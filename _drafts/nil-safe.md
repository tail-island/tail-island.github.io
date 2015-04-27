---
layout:   post
title:    "NullPointerExceptionが出るのは、プログラマーの問題ではなくてプログラミング言語の問題だと思う"
category: Programming
tags:     [Clojure]
---

私は関数からnilを返すことが多いのですけれど、このような話をすると、Javaや.NET Frameworkの人からNullPointerExceptionが発生して大変なのではないかと聞かれます。

ぜんぜん大変ではないですよ。だって、Clojureでは、ごく限られた場合にしかNullPointerExceptionは発生しませんからね。

---

では、少し遠回りになりますけど、まず、Clojureにおける真偽の話から。

Clojureの`if`は、`nil`と`false`なら偽、それ以外はすべて真とみなします。たとえば、`booleanValue`が`false`に設定された`java.lang.Boolean`も、`nil`でも`false`でもないので真となります。REPL上で"false"と表示されますけれど、真なんです。

```clojure
user> (def b (Boolean. false))
#'user/b
user> (if b :true :false)
:true  ; (Boolean. false)は真。
user> b
false  ; toStringした結果で、偽のfalseとは無関係。
```

次に、destructuringの話を。

Clojureでは、ベクター（'nth'できるならリストでも文字列でも何でもよい）とマップ（`ILookup`ならベクターでも文字列でも何でもよい）を、うまいことバラバラにしてくれるdestructuringという機能があります。

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

```
user> (let [[a b c d & more] xs]
        [d more])
[nil nil]
```

最後に、ループの話を。

関数型言語では、変数に値を再代入することはできません。なので、`for (int i = 0; i < 10; ++i)`のようなコードは書けません。変数iに0, 1, 2...と再代入を繰り返すコードですもんね。なのでどうするかというと、一般に再帰を使います。

```
(defn foo
   [i]
   (if (< i 10)
     (do (println i)
         (recur (inc i)))))  ; ここで再帰。recurを使っていますから、パフォーマンス上の問題はありません。
```

コレクションの要素を順次処理する場合はどうしましょうか？　Javaで`for (int x : xs)`、C#で`for each (var x in xs)`のような場合です。この場合は、destructuringと再帰を使います。

```
(defn foo
  [& xs]  ; 引数もdestructuringできます。
  (if xs
    (do (println (first xs))
        (recur (next xs)))))
```

さて、`nil`を引数にしてこの`foo`を呼び出したら、どうなるでしょうか？

`if`は`nil`でも`false`でもない場合に