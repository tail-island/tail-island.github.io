---
layout:   post
title:    "C#で「エラトステネスの篩」で「2.6秒で百万個」の素数を計算できる「無限シーケンス」を作ってみた"
category: Programming
tags:     [C#]
---

調べものをしていたらたまたま見つけた[The Genuine Sieve of Eratosthenes](https://www.cs.hmc.edu/~oneill/papers/Sieve-JFP.pdf)の、Epilogueに載っていた素数を求めるコードがすげぇ格好良い！

~~~ haskell
primes = 2:([3..] `minus` composites)
  where
    composites = union [multiples p | p <− primes]

multiples n = map (n*) [n..]

(x:xs) `minus` (y:ys) | x <  y = x:(xs `minus` (y:ys))
                      | x == y = xs `minus` ys
                      | x >  y = (x:xs) `minus` ys

union = foldr merge []
  where
    merge (x:xs) ys = x:merge' xs ys
    merge' (x:xs) (y:ys) | x <  y = x:merge' xs (y:ys)
                         | x == y = x:merge' xs ys
                         | x >  y = y:merge' (x:xs) ys
~~~

このHaskellのコードでの素数の定義は、「2と、3以降のすべての整数から素数の倍数をまとめたものを引いたもの」です。これは、[エラトステネスの篩](https://ja.wikipedia.org/wiki/%E3%82%A8%E3%83%A9%E3%83%88%E3%82%B9%E3%83%86%E3%83%8D%E3%82%B9%E3%81%AE%E7%AF%A9)の篩の上に残るものを、素数から倍数に替えたものになります。

## チャレンジ

さて、このようなエレガントなコードを書けるのはHaskellが遅延評価だから（それでも、2は計算なしで素数として扱えるようにしたり、mergeを2段階に分けたりと、遅延評価が止まらないための工夫をしています）なのですけれど、シーケンスだけなら遅延評価が可能な言語は他にもあります。というわけで、利用者が多いC#で同じことをやってみました。

~~~ csharp
using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;

public class Primes : IEnumerable<int>
{
  // Haskellのfoldrに相当する機能はないので、minusに相当する処理の中でunion（のmerge部分）する形にしました。
  private static IEnumerable<int> Sieve(IEnumerable<int> ns, IEnumerable<int> ms)
  {
    for (;;)
    {
      // 数値のシーケンスと倍数のシーケンスで追いかけっこをさせます。
      var n = ns.First();
      var m = ms.First();
      ns = n <= m ? ns.Skip(1) : ns;
      ms = m <= n ? ms.Skip(1) : ms;

      // 数値の方が小さい（倍数にその数値が存在しなかった）なら、素数です。
      if (n < m) {
        ms = MergeMultiples(ms, Multiples(n));  // foldrがないので、ここで数値の倍数をマージします。

        yield return n;
      }
    }
  }

  // 数値の倍数を取得するメソッド。
  private static IEnumerable<int> Multiples(int number)
  {
    return Numbers(2).Select(x => number * x);  // Haskell版とほぼ同じ。
  }

  // 倍数をマージします。
  private static IEnumerable<int> MergeMultiples(IEnumerable<int> ns, IEnumerable<int> ms)
  {
    for (;;)
    {
      // 倍数同士で、追いかけっこをさせます。
      var n = ns.First();
      var m = ms.First();
      ns = n <= m ? ns.Skip(1) : ns;
      ms = m <= n ? ms.Skip(1) : ms;

      // 小さい方を返す。
      yield return n <= m ? n : m;
    }
  }

  // 数値のシーケンスを作成します。
  private static IEnumerable<int> Numbers(int start, int step = 1)
  {
    for (var i = start; ; i += step)
    {
      yield return i;
    }
  }

  public IEnumerator<int> GetEnumerator()
  {
    return Sieve(Numbers(2), Multiples(2)).GetEnumerator();
  }

  IEnumerator IEnumerable.GetEnumerator()
  {
    return GetEnumerator();
  }
}
~~~

でも、このコードを動かしてみたら、最初の10個の素数を計算するだけで30秒くらいかかってしまいました……。失敗です。

## 再チャレンジ

気を取り直して[The Genuine Sieve of Eratosthenes](https://www.cs.hmc.edu/~oneill/papers/Sieve-JFP.pdf)のEpilogueより前の本論を読んでみたら、より実行効率が良いアルゴリズムについて論じていました（こちらが本論なわけですけど）。これを参考に、エラトステネスの篩っぽさを残してコードを書いてみました。

~~~ csharp
using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;

public class Primes : IEnumerable<int>
{
  // 9->6、15->10のように、倍数をキー、その倍数の元になった素数の2倍（理由は後述）を値にして管理します。
  // これで、複数のシーケンスを持たなくて済みます。
  private Dictionary<int, int> multiples;

  public Primes()
  {
    this.multiples = new Dictionary<int, int>();
  }

  public IEnumerator<int> GetEnumerator()
  {
    return
      Enumerable.
      Range(2, 1).  // 2は、特別扱いとします。
      Concat(
        Numbers(3, 2).  // 3から2単位で進むすべての整数（3, 5, 7...）に対して、素数かどうかを調べます。
        Where(
          number =>
          {
            var notPrime = multiples.ContainsKey(number);  // 倍数に含まれる数値は、素数ではありません。
            var factor = notPrime ? multiples[number] : number * 2;
            // 3 + 3 = 6は2の倍数。2の倍数は特別扱いで考慮不要なのだから、3 + 3 * 2にして、倍数が必ず奇数になるようにします。

            // 不要になった倍数を削除。
            if (notPrime)
            {
              multiples.Remove(number);
            }

            // 新たな倍数を追加。
            multiples.Add(
              Numbers(number + factor, factor).Where(multiple => !multiples.ContainsKey(multiple)).First(),
              factor);
            // 複雑なコードになっているのは、倍数は重複することがあるためです。
            // たとえば、9 + 3 * 2は15だけど、15は5 + 5 * 2で登録済み。なので、もう一つ進んだ15 + 3 * 2の21で登録します。

            return !notPrime;
          }
        )
      ).
      GetEnumerator();
  }

  private static IEnumerable<int> Numbers(int start, int step = 1)
  {
    for (var i = start; ; i += step)
    {
      yield return i;
    }
  }

  IEnumerator IEnumerable.GetEnumerator()
  {
    return GetEnumerator();
  }
}
~~~

動かしてみたら、2.6秒で1,000,000個の素数を計算できました（ちなみに、百万個目の素数は15,485,863でした。PCのCPUはCore i5 3380Mです）。簡単な処理で素数が必要な場合に、使えるんじゃないかな？　無限シーケンスなので、使い勝手は良いと思いますよ。
