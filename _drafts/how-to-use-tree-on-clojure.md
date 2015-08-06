---
layout:   post
title:    "Clojureでツリーを処理する方法"
category: Programming
tags:     [Programming, Clojure]
---

なぜClojureを使うのかと問われれば、そこにマクロがあるからだと応えます。なのに実はマクロをほとんど使っていない私……。これではイカンということで、偉大な名著の[On Lisp](http://www.asahi-net.or.jp/~kc7k-nd/onlispjhtml/)でマクロを勉強してみました。したらまぁ、これが難しい難しい。

難しい理由の一番は、もちろん私の能力不足です。しかし、On Lispが使用しているCommon Lispはツリーの操作が得意、Clojureはシーケンスの操作が得意という、得意分野が異なっている点もあると思うんですよ。

例を挙げます。On Clojureの[18章 構造化代入](http://www.asahi-net.or.jp/~kc7k-nd/onlispjhtml/destructuring.html)の中の引数の中からマッチングで使われる変数（var?が真を返すもの）を探すコードです。

```common lisp
(defun vars-in (expr &optional (atom? #'atom))
  (if (funcall atom? expr)
      (if (var? expr) (list expr))
      (union (vars-in (car expr) atom?)
             (vars-in (cdr expr) atom?))))

(defun var? (x)
  (and (symbolp x) (eq (char (symbol-name x) 0) #\?)))
```

比較して、私が作成したClojureのコード。

Clojureはシーケンスを中心にしているので、Lispなのにツリーを使いづらい。
On Clojureを勉強している時に、destructuringのコードで学んだツリーの処理方法を述べる。
