---
layout:   "post"
title:    "今更だけど、Dockerで開発環境を作ってみた"
category: "programming"
tags:     ["Docker"]
---

私は、コンピューターのセットアップが大好きです。だって、プログレス・バーがグングン伸びていって、ログがジャカジャカ表示されて、何もしないで待っているだけなのに「俺は仕事しているぜぇ」って感じることができますからね。

だから、世の中にはびこる仮想化技術には目もくれず、プロジェクトのたびにOSから環境を再セットアップしてきました。でもね、最近はね、Android開発に必要なAndroid Studioさんが「お前の64bitのUbuntuに32bitライブラリをセットアップしろ」と言ってきたり、画像解析に使おうと考えたOpenCVさんが「☓☓ライブラリがあればもっと速くなるからセットアップしようぜ」と言ってきたりして、必要最小限な完璧環境を作るというOSセットアップ職人である私に歯向かってきやがるんですよ。

というわけで、流行りのDockerで開発環境を作って、私のかわいいOSを汚さないようにしてみました。

# Dockerとは?

Dockerとは仮想的なハード・ディスクの中でプログラムを動かす技術である、と考えれば、だいたい合ってます。プログラムや共有ライブラリ（Linuxなら`*.so`、Windowsなら`*.DLL`）はハード・ディスクから読み込まれるわけで、ハード・ディスクをまるごと偽装しちゃえばほぼ別のコンピューターになるというわけ。これなら、仮想ハードウェアの上でOSの起動を待たなければならない一般的な仮想化より、速くて軽そうでしょ？　実際にDockerは、普通にプログラムを起動するのとほとんど変わらない速度で動作します。

もっともこのハード・ディスクを偽装するってのは別に難しくも新しくもない話で、UNIXに大昔から存在している`chroot`というコマンドでも実現できます。`chroot`は別に特別なコマンドではなくて、たとえばArch Linuxのインストールで、インストール先のファイル・システムを`chroot`してインストール後の環境を偽装する際に使われたりしています。

じゃあDockerを使わずに`chroot`を使えばよいのかというとそんなことはなくて、Dockerは、ディスクに加えてネットワークやコンピューター名、ユーザーやグループ等も偽装してくれて、`chroot`より高機能で便利です。あと、仮想的なハードディスクを作るための言語があったり、仮想的なハードディスクの階層化（あなたが作った仮想的なハードディスクに私がファイルを追加したときに、「あなたのハードディスク」と「私が追加したファイルだけが入った差分」という形で管理できる）ができたりします。

# Dockerでのイメージ（仮想ハードディスク）の作り方

Dockerを起動して、手動でファイルを作成したりソフトウェアをセットアップしたりして、その結果をイメージ（Dockerでは仮想ハードディスクをイメージと呼びます）として保存することも可能です。しかし、この方式だと、ソフトウェアのバージョンアップの時とかに同じ作業を何回も実施しなければなりません。その時に作業を間違えないようにするには、手順書を作らなければならなくなってあまりに面倒くさい。

だから、Dockerではイメージを作成するためのスクリプトを提供していて、このスクリプトをDockerfileというファイル（makeコマンドのMakefileからヒントを得た名前だと思う）に書いて、自動でイメージを生成できるようになっています。以下に、Dockerfileの具体例を挙げましょう。このDockerfileは、最新のNode.jsの実行環境を作ってくれます。

```
FROM ubuntu:16.04

RUN apt-get update && \
    apt-get install -y \
      nodejs \
      npm && \
    npm install -g n && \  # UbuntuのNode.jsはバージョンが古いので、Node.jsのパッケージのnをインストールして、
    n stable && \          # nに最新版をセットアップさせます。
    apt-get purge -y \     # 以降はnがセットアップした環境を使いますから、UbuntuのNode.jsパッケージは消しておきます。
      nodejs \
      npm && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*
```

これなら確実に同じイメージが作成されますな。手順書も不要ですし。実に素晴らしい！

ただね、Dockerfileって、あまり機能がなくて基本的にシェルに丸投げなんですよ……。上の例で言うと、`RUN`のところはすべてシェルに丸投げです。まぁ、シェル・スクリプトを知っていればすぐに使えるということでもあるわけですけど、落とし穴が多いですから、「[Dockerfileを書くベスト・プラクティス](docs.docker.jp/engine/userguide/eng-image/dockerfile_best-practice.html)」を斜め読みしておいたほうがよいでしょう。

# Dockerで開発環境を作る際に遭遇した課題

で、今回はDockerで開発環境を作ったのですけれど、その際には、以下の3点が課題となりました。

* Dockerのコンテナから、GUIを使う
* Dockerのコンテナから、KVMを使う
* Dockerのコンテナから、OpenGLを使う

すべてをCUI（ターミナル）でやるという男前な方法も考えたのですけど、Dockerやろうとした理由の一つであるAndroid Studioは、GUIじゃないと動かないもんね。なのでGUIは必須となります。

あと、Android開発で使用するAndoidのエミュレーターは、Linuxカーネルの仮想化技術であるKVMを使用します。コンテナ型の仮想化であるDockerの上で、従来の仮想化技術であるKVMを使用しなければならないわけで、とても面倒くさそうです。

さらに、Androidのエミュレーターは、画面の描画にOpenGLを使いやがるんですよ。OpenGLはグラフィック・ドライバの機能ですから、Dockerのコンテナの内側にグラフィック・ドライバ相当の環境を用意しなければならないわけで、もうAndroid開発は辞めようかと思うくらいに面倒……。

以下に、この3つの課題の解決方法を述べていきます。

# Dockerのコンテナから、GUIを使う

幸いなことに、私が使用しているLinuxはX Window Systemというクライアント・サーバー型のGUIシステムを使用しています。Xクライアント（ごく普通のGUIプログラム）がXサーバー（Ubuntu16.04の場合はX.Orgファウンデーションが提供するソフトウェア）に描画を依頼したり、イベントを受け取ったりしながら動くシステムですな。というわけで、Dockerのコンテナの中から、外側にあるX Window Systemと通信できればOKというわけ。

で、X Window Systemとの通信手段はいろいろあるんですけど（sshを使ってネットワーク越しなんてものあります。遅いけど）、今回はUNIXドメイン・ソケットがよさそうです。X Window Systemと通信するためのUNIXドメイン・ソケットは`/tmp/.X11-unix/`ディレクトリの下にファイルとして存在していますから、`/tmp/.X11-unix`ディレクトリをDockerコンテナと共有すれば大丈夫そう。Dockerにはコンテナ外のディレクトリやファイルをマウントする機能がありますから、これを使いましょう。

以上、方針が定まりましたので、Dockerfileを作成します。以下のDockerfileの中でユーザーを作成しているのは、X Window Systemはセキュリティ上の理由でroot（WindowsでのAdministrator）ユーザーからの実行を認めていないためです。

```
FROM ubuntu:16.04

RUN apt-get update && \
    apt-cache search x11 && \
    apt-get install -y x11-apps && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN groupadd --gid 1000 developer && \
    useradd  --uid 1000 --gid 1000 --groups sudo --create-home --shell /bin/bash developer && \
    echo 'developer:P@ssw0rd' | chpasswd

USER developer
WORKDIR /home/developer

CMD xeyes
```

Dockerfileを元に`docker build`してイメージを作成し、`docker run`してコンテナを実行します。`docker run`のオプションの`--rm`は、起動したプログラムが終了したらコンテナを削除するようにとの指示で、`-e DISPLAY=${DISPLAY}`は環境変数を通じて使用するX Window Systemのサーバーの指定で、`-v /tmp/.X11-unix:/tmp/.X11-unix`はファイル（X Windows SystemのUNIXドメイン・ソケット）の共有です。

```bash
$ sudo docker build -t try-gui .
$ sudo docker run --rm -e DISPLAY=${DISPLAY} -v /tmp/.X11-unix:/tmp/.X11-unix try-gui
```

はい、目玉が表示されました。これでDockerでGUIはオッケー。

![xeyes](/images/2017-07-11/xeyes.png)

ちなみに、xeyesにはGUIから終了させる手段がありません……。が、実はDockerは環境を偽装して普通にプロセスを動かしているだけですから、外側から`ps`で見えますし、普通に`kill`で終了できるのでご安心を。

```bash
$ ps -afe | grep xeyes
ryo       8727  8710  0 11:35 ?        00:00:00 /bin/sh -c xeyes
ryo       8776  8727  0 11:35 ?        00:00:00 xeyes
ryo       8802 22749  0 11:35 pts/19   00:00:00 grep --color=auto xeyes
$ kill -9 8776
```

Dockerのユーザーは名前を偽装しているだけで、コンテナの外側ではuidが同じ外側のユーザー（上の例ではryo）になっています。この程度の偽装でよいのですから、そりゃ、Dockerは軽いわけですな。

# Dockerのコンテナから、KVMを使う

KVMをセットアップするのは、Dockerの外側、ホストOSの側です。Dockerのことは忘れて、まずは普通にKVMをセットアップしました。

Dockerfileの中では、KVMを使えるようにするために、ユーザーをkvmグループに追加しておきます（Dockerの外側ではkvmグループでなくてもACLで触れるけど、コンテナの内側ではACLが使えないみたい）。その上で今回は、AndroidのSDK Toolsをダウンロードして、`emulator -accel-check`で本当にKVMを使えるか確認することにしました。

```
FROM try-gui

USER root
WORKDIR /home/root

RUN apt-get update && \
    apt-get install -y \
      unzip \
      wget && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN groupadd --gid 130 kvm && \
    gpasswd --add developer kvm

USER developer
WORKDIR /home/developer

RUN wget -O sdk-tools.zip https://dl.google.com/android/repository/sdk-tools-linux-3859397.zip && \
    unzip sdk-tools.zip && \
    rm sdk-tools.zip

CMD /home/developer/tools/emulator -accel-check
```

はい完成。Dockerを動かして確認しましょう。`docker run`で指定している`--privileged`は、コンテナの外側のすべてのデバイス（`/dev/*`）へのアクセス可能にするオプションです。KVMを使用するには`/dev/kvm`にアクセスできなければなりませんし、Android開発ではUSB等の他のデバイスも使いますから、`--privileged`で全てのアクセスを許すようにしてみました。

```bash
$ sudo docker build -t try-kvm .
$ sudo docker run --privileged --rm -e DISPLAY=${DISPLAY} -v /tmp/.X11-unix:/tmp/.X11-unix try-kvm
accel:
0
KVM (version 12) is installed and usable.
accel
```

ターミナルに'KVM (version 12) is installed and usable'と表示されましたから、これでKVMはオッケー。

# Dockerのコンテナから、OpenGLを使う

残るはOpenGLです。DockerとOpenGLでGoogle検索してみたら、`/dev/dri/*`にアクセスできればOpenGLできる（だから`--privileged`をつけて実現した）という話と、NVIDIAのドライバーを入れたらOpenGLできたという話の2つが見つかりました。

で、いろいろ試してみたのですけど、どうやら「`/dev/dri/*`へのアクセス」と「コンテナの外側と同じグラフィック・ドライバ」の両方が必要になるみたい。Intel CPUのグラフィックの場合はX関連を入れた時に一緒に入るみたいで問題なかったけど、NVIDIAの場合は自動では入らないから入れないとダメという話みたいですね。

ここで問題になるのは、私はNVIDIA環境のデスクトップPCとIntel環境のラップトップPCの両方を持っているということ。だからといって、NVIDIAのドライバをセットアップするDockerfileと、セットアップしないDockerfileを2つ作るなんてのは、地球が砕け散っても嫌。

だから、[nvidia-docker](https://github.com/NVIDIA/nvidia-docker)というNVIDIA公式のツールを使用しました。`nvidia-docker`経由でDockerを起動すれば、NVIDIAのデバイスやドライバーを追加してくれるというスグレモノ。これならDockerfileは1つで済みます。ただし、PCにあわせてコマンドを変えるというのは、加齢で衰えた私の脳には負荷が大きすぎるので、Docker Composeというツールも使用しました。Docker Composeは、Dockerのbuildやrunを自動化するツールです（名前が'compose'となっているのはアプリケーションとデータベース等の複数のコンテナを協調的に管理できるためで、本来はこの機能が主なのですけど、今回は使わないので省略で）。

まずは、OpenGLのことは何も考えずに`Dockerfile`を書きます。`mesa-utils`の中に含まれる`glxgears`で、OpenGLの動作確認をすることにしました。

```
FROM try-kvm

USER root
WORKDIR /home/root

RUN apt-get update && \
    apt-get install -y \
      mesa-utils && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

USER developer
WORKDIR /home/developer
```

本当は、Dockerfileに`LABEL com.nvidia.volumes.needed="nvidia_driver"`と書いてNVIDIAのドライバが必要だということを知らせるようにすべき（ラベルが設定されていない場合、nvidia-dockerはドライバを読み込んでくれません）で、`PATH`や`LD_LIBRARY_PATH`のような環境変数にNVIDIAのドライバを含めてあげるべきなのですけど、今回はやりません。ドライバの読み込みもデバイスのマウントも環境変数の設定も、Docker Composeで実施するためです。

さて、nvidia-dockerがインストール済で、一度実行した後なら、`docker volume ls`すると以下のように表示されるはずです（381.22の部分はみなさまがセットアップしたドライバのバージョンになります）。

```bash
$ docker volume ls
DRIVER              VOLUME NAME
nvidia-docker       nvidia_driver_381.22
```

このボリュームをコンテナにマウントしてあげれば良いわけ。あと、環境変数の設定も。というわけで、Docker Composeの定義ファイルである`docker-compose.yml`は、以下のようになります。

```
version: '3'

services:
  app:
    build: .
    privileged: true
    command: glxgears
    environment:
      - DISPLAY=${DISPLAY}
      - PATH=/usr/local/nvidia/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
      - LD_LIBRARY_PATH=/usr/local/nvidia/lib64
    volumes:
      - /tmp/.X11-unix:/tmp/.X11-unix
      - nvidia_driver_381.22:/usr/local/nvidia

volumes:
  nvidia_driver_381.22:
    external: true
```

Docker Composeでビルドしたり実行したりする方法は以下の通り。

```bash
$ docker-compose build
$ docker-compose up
```

これで、NVIDIA環境で、OpenGLを使う`glxgears`が表示されました。

![glxgears](/images/2017-07-11/glxgears.png)

Intel環境の場合は、以下のような`docker-compose.yml`にすれば大丈夫。

```
version: '3'

services:
  app:
    build: .
    privileged: true
    command: glxgears
    environment:
      - DISPLAY=${DISPLAY}
    volumes:
      - /tmp/.X11-unix:/tmp/.X11-unix
```

結果として`docker-compose.yml`が複数存在してしまうことになりますけど、ソースコード管理システム上では`docker-compose-nvidia.yml`と`docker-compose-intel.yml`の2つを作成して、実際の環境上では`ln -s docker-compose-nvidia.yml docker-compose.yml`か`ln -s docker-compoe-intel.yml docker-compose.yml`することで対応すればオッケー。

# それはそれとして、Android Studioは……

よっしゃこれでAndroid開発できる……はずだったのですけど、Android StudioってGUIで初期設定しなければならないので、Dockerfileだけではセットアップできないんですよね。なので、長い時間をかけて手動でセットアップして、`docker commit`しましたよ。なんだよ、Docker使う意味無いじゃん……。コマンド・ラインからセットアップできないソフトウェアは禁止っていう法律ができないかなぁ。

# というわけで

私が使用しているプログラミング言語はClojureとNode.jsとPythonなので、それぞれのプログラミング用の[Dockerfileとdocker-compose](http://github.com/tail-island/docker-container)を作成しました。MatLabとCaffe関連以外のすべての機能をコンパイルするOpenCVとコンパイル・オプション関連の警告が出ないTensorFlowを組み込んだ[python-cuda](http://github.com/tail-island/docker-container/tree/master/python-cuda)は、とても大変で面白かったです。もしよろしければ、皆様がDockerするときの参考にしてみてください。
