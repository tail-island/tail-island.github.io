---
layout:   post
title:    "ifが式で関数がファースト・クラス・オブジェクトな幸せを噛みしめる"
category: Programming
tags:     [Clojure]
---

条件が多段になる場合のコードって、書くのが難しいと思うんですよ。

成人式を例にして考えてみます。群馬県の成人式はバンジー・ジャンプで栃木県の成人式はライオンと格闘、それ以外の都道府県では普段通りの平穏無事な日々を送るとしましょう。とりあえず言語はJavaでいってみます。

~~~ java
if (person.getAge() == 20) {
  switch (person.getBirthplace()) {
  case "群馬県":
    doBungeeJumping();
    break;

  case "栃木県":
    fightWithLions();
    break;

  default:
    peacefulDays();  // 重複している！
  }
} else {
  peacefulDays();    // 重複している！
}
~~~

`peacefulDays()`が重複していますので、このコードは悪いコードです。今の程度なら問題はなさそうですけれど、たとえば成人式以外のイベントも対応しようとすると日付チェックが追加されるので条件式が3段になるわけです。そうなると、たぶんどこかで`peacefulDays()`を書くのを忘れて、とても見つけづらいバグが発生してしまう。嫌だなぁ……。

でも、Clojureなら、こんな場合も大丈夫です。だって、「`if`が式」で「関数がファースト・クラス・オブジェクト」なのですから。

Clojureの`if`は、値を返す式です。Javaの三項演算子と同じ。そして、Clojureの関数はファースト・クラス・オブジェクトなので、値として扱える。だから、以下のようなコードを書けます。

~~~ clojure
((or (if (= (:age human) 20)
       (cond
         (= (:birthplace human) "群馬県") do-bungee-jumping
         (= (:birthplace human) "栃木県") fight-with-lions))
     peaceful-days)))
~~~

`if`の部分が何をしているのかというと、20歳で群馬県出身なら`do-bungee-jumping`という「関数」を、同様に20歳で栃木現出身なら`fight-with-lions`という「関数」を返しています。で、`if`や`cond`は条件が一致しない場合は`nil`を返すようになっていて、Clojureでは`nil`は偽だから、その場合の`or`の部分の結果はpeaceful-daysという「関数」になります。

で、一番外側の `()`で関数が呼び出されるので、peaceful-daysが1つしかなくても、Javaの場合と同じ動作になるわけです。

ほら、`if`が式で関数がファースト・クラス・オブジェクトな幸せを噛みしめたくなってきたでしょ？

P.S.

もしこのシステムを将来に渡って保守しなければならないなら、幸せを噛みしめる前に以下のようなコードにしたほうが良いかも。

~~~ clojure
(defn born-in?
  [place person]
  (= (:birthplace person) place))

(defn age-is?
  [age person]
  (= (:age person) age))

(def gummar?
  (partial born-in? "群馬県"))

(def tochigian?
  (partial born-in? "栃木県"))

(def initiation?
  (partial age-is? 20))

(def preds-and-actions
  [[(every-pred gummar? initiation?)    do-bungee-jumping]
   [(every-pred tochigian? initiation?) fight-with-lions]
   [(constantly true)                   peaceful-days]])

(defn suitable-action-for
  [person]
  (some (fn [[pred action]]
          (and (pred person) action))
        preds-and-actions))

((suitable-action-for person))
~~~

あと、Javaの場合も、Java 8で追加されたラムダ式を使うなら、綺麗に書けるかもしれません。

＃文法が面倒くさくて、途中で挫折しちゃいました……。
