---
layout:   "post"
title:    "辛すぎるAndroidのApp開発を、Kotlinとコルーチンで楽にする"
category: "programming"
tags:     ["Kotlin", "Andtroid", "コルーチン"]
---

今年48歳になる年男な私ですが、2週間程前から、生まれて始めてのAndroidのApp開発をやっています。

で、その感想。Androidって、APIがダサすぎませんか？　ダサいAPIを使うと生産性が落ちてしまいますから、特にダサくて涙が出ちゃった実行時のパーミッション・リクエストを、Kotlinとコルーチンで素敵にラップしてみました。Kotlinとコルーチン、かなり良いですよ。

なお、本稿は、[Android Mのパーミッション制御をKotlinのasync/awaitで簡単にした](http://qiita.com/k-kagurazaka@github/items/b0d4b2042a5b1ebcbf79)を参考にしています。この人のコルーチンの解説、すげー分かりやすいです。

## Androidにおける、実行時のパーミッション・リクエスト

まずは、その実行時のパーミッション・リクエストがどれだけ面倒なのかを、[Androidの公式トレーニング文書](https://developer.android.com/training/permissions/requesting.html)を参考に作成したコードで確認してみます。いきなり長いコードでごめんなさい。言語はKotlinです。

```kotlin
import ...

class MyActivity: AppCompatActivity() {
    ...

    // カメラを使いたいなら……
    fun usingCamera() {
        // パーミッションをすでに持っているか確認します。
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
            // パーミッションを持っているなら、実際にカメラを使う処理のuseCameraを呼び出します。
            useCamera()
            return
        }

        // 過去にパーミッションのリクエストを蹴られていて、「今後表示しない」が選択されていない場合は……
        if (ActivityCompat.shouldShowRequestPermissionRationale(this, Manifest.permission.CAMERA)) {
            // パーミッションが必要な理由を訴えた上で、パーミッションをリクエストします。
            AlertDialog.Builder(this)
                    .setMessage("インスタで意識高い系をやるにはカメラが必要なの")
                    .setPositiveButton(android.R.string.ok, { dialog, which ->
                        // [OK]ボタンがタップされたら、パーミッションをリクエストします。
                        // 1234はonRequestPermissionsResultでリクエストを判別するための数値。なんでもいいみたい。
                        ActivityCompat.requestPermissions(this, arrayOf(Manifest.permission.CAMERA), 1234)
                    })
                    .show()
                    return
        }

        // パーミッションをリクエストします。
        ActivityCompat.requestPermissions(this, arrayOf(Manifest.permission.CAMERA), 1234)
    }

    // パーミッションをリクエストした結果は、onRequestPermissionResultで受け取らなければなりません……。
    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<String>, grantResults: IntArray) {
        // 自分のコード以外がrequestPermissionsしているかもしれないので、requestCodeをチェックします。
        if (requestCode != 1234) {
            super.onRequestPermissionsResult(requestCode, permissions, grantResults)
            return
        }

        // リクエスト結果をチェック。
        if (grantResults.any { it != PackageManager.PERMISSION_GRANTED }) {
            // リクエストを蹴られた場合はどうしましょ？　今回は、単純にActivityを終了させます。
            finish()
            return
        }

        // 実際の処理をここに書くわけには行かない（だって、ここに来るかはcheckSelfPermission次第だから）ので、useCameraに移譲します。
        useCamera()
    }

    // やっとここで実際の処理。これより前はAndroidがやれっていうから書かなければならないだけの処理……
    fun useCamera() {
        // カメラを使って実際にやりたい処理……。
    }
}
```

……分かりづれーよ、Android。`requestPermissions()`から`onRequestPermissionsResult()`に処理が流れるなんて、知識がなければ絶対に分かんねーじゃん。

## あるべき形を考える

パーミッションを貰えたかどうかだけが重要なわけですから、以下のようなコードが、あるべき姿でしょう。

```kotlin
fun useCamera() {
  if (!requestPermission(Manifest.permission.CAMERA, "インスタで意識高い系をやるにはカメラが必要なの")) {
    finish()
    return
  }

  // カメラを使って実際にやりたい処理。
}
```

面倒な処理は`requestPermission()`の中に閉じ込めてライブラリ化しちゃうわけ。で、このあるべき形、Kotlinのコルーチンを使うと、ほぼ可能なんですよ。

## ライブラリ化の課題

あるべき形にするのを阻んでいるのは、成功か失敗かが判明する場所が`usingCamera()`と`onRequestPermissionResult()`に分散していることです。で、従来の方式ではこんな場合にはコールバックを渡して、コールバックの中に`useCamera()`相当の処理を書くことになっていました。でもこの方式、いわゆるコールバック地獄になっちゃうんですよね。いくつものコールバックに処理が分断されてしまうので、処理の流れを追えなくなって生産性が落ちちゃう。

だから、今時のプログラミング言語ではコルーチンと呼ばれる処理を途中で止めたり再開できる機能を持っていて、コールバックの代わりに処理の再開を使用するようになっています。コルーチンを使えば、先程のあるべき姿のような上から下に流れる（ように見える）コードで、複雑な処理フローを実現することができるんですよ。

といっても、コルーチンというのは別に新しいものではなくて、実はC#やJavaScript（ECMAScript 2015）の`yield`でお馴染みのアレです。Lispでは何十年も前から当たり前に使われていますし、2012年の.NET Framework 4.5でC#に組み込まれた`async/await`なんてのもコルーチンの応用ですな。Kotlinは、2017年3月のバージョン1.1でコルーチンに対応したらしい。

さて、先程のパーミッションのリクエスト処理を思い返してみると、`useCamera()`と`finish()`の所で、ユーザー・コードに処理を引き継げればよいわけ。リターンする直前で止めておいたコルーチンに、成功か失敗かを渡して継続させればOKです。

## ライブラリ化

というわけで、ライブラリ化しました。以下がそのコード。

```kotlin
package ...

import android.app.Activity
import android.app.AlertDialog
import android.app.Fragment
import android.content.pm.PackageManager
import android.support.v13.app.FragmentCompat
import android.support.v4.app.ActivityCompat
import android.support.v4.content.ContextCompat
import kotlinx.coroutines.experimental.android.UI
import kotlinx.coroutines.experimental.launch
import kotlin.coroutines.experimental.Continuation
import kotlin.coroutines.experimental.suspendCoroutine

suspend fun requestPermission(activity: Activity, permission: String, rationale: String): Unit? {  // エルビス演算子を使いたいので、戻り値はBooleanじゃなくてUnit?で。
    if (ContextCompat.checkSelfPermission(activity, permission) == PackageManager.PERMISSION_GRANTED) {
        return Unit
    }

    if (ActivityCompat.shouldShowRequestPermissionRationale(activity, permission)) {
        suspendCoroutine<Unit?> { cont ->  // suspendCoroutineでコルーチンの実行を中断して……
            AlertDialog.Builder(activity)
                    .setMessage(rationale)
                    .setOnCancelListener { cont.resume(null) }  // ここか……
                    .setPositiveButton(android.R.string.ok, { _, _ -> cont.resume(Unit) })  // ここで、再開します。
                    .show()
        } ?: return null
    }

    // onRequestPermissionsResultが必要なので、Fragmentを継承したクラスを用意します。
    class RequestPermissionFragment : Fragment() {
        lateinit var cont: Continuation<Unit?>

        override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<String>, grantResults: IntArray) {
            // 処理を閉じ込めているので、requestCodeのチェックはたぶん不要だと思う。
            cont.resume(Unit.takeIf { grantResults.all { it == PackageManager.PERMISSION_GRANTED } })
        }
    }

    return RequestPermissionFragment().let { fragment ->  // Kotlinのスコープ関数は、スコープを小さくできるのでとても便利。
        try {
            activity.fragmentManager.beginTransaction().add(0, fragment).commit()  // Fragmentを追加します。

            suspendCoroutine<Unit?> { cont ->
                launch(UI) {  // Fragmentの追加が終わった後に実行させたい（launchしないとエラーになっちゃう）ので、launchします。
                    fragment.cont = cont

                    FragmentCompat.requestPermissions(fragment, arrayOf(permission), 0)  // パーミッションをリクエストします。

                    // onRequestPermissionsResultでresumeされるまで、コルーチンは中断されます。
                }
            }

        } finally {
            activity.fragmentManager.beginTransaction().remove(fragment).commit()  // Fragmentを削除します。
        }
    }
}
```

呼び出し側のコードは、以下の通り。

```kotlin
fun useCamera() = launch(UI) {
    // パーミッションをリクエスト。
    if (!requestPermission(Manifest.permission.CAMERA, "インスタで意識高い系をやるにはカメラが必要なの")) {
        // パーミッションを貰えなかった場合の処理。
        finish()
        return
    }

    // カメラを使って実際にやりたい処理。
}
```

`launch(UI)`の部分がちょっと見苦しいけど、それ以外は理想的なコードでしょ？　コルーチンは実に便利ですな。
