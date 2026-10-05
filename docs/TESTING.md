# 提出ガード 検証記録

検証日：2026-10-05。ソースは本配布物に同梱。

## 結果

- Node.js v22.16.0の `node:test`：39件成功、0件失敗。
- ChromiumのDOM操作テスト：20件成功、0件失敗。
- 320 / 375 / 768 / 1440px：計4条件で横はみ出しなし、JavaScript実行エラーなし。
- 入力されたHTML風の文字列がHTMLとして実行されないことを確認。

## テスト方法と限界

ブラウザ側はPlaywrightから `about:blank` にDOM・ローカルのCSS・JavaScriptを配置して検査しています。ハーネスはブラウザのネットワーク制限を変更せず、アプリのソースも変更しません。ただしこの方法は、通常のURLナビゲーション・静的配信・CSPの読み込み経路を検証するものではありません。

Web Storageは明示的なメモリー上の代替実装を使い、保存状態を次のページに渡して復元を検査しています。実ブラウザの保存上限や再起動後の保存は未検証です。保存容量不足・別タブ変更はイベントや例外を模擬して検査しています。

書き出しはBlobの内容を検査し、JSON・Markdownの内容とPNGのシグネチャを確認しています。ブラウザの実ダウンロードUI、OSのファイル保存、クリップボードの許可ダイアログは未検証です。

画面幅の検証はChromiumのビューポート変更です。実機iPhone/Safari/WebKit・Android・全ブラウザの互換性検証ではありません。表示差や未発見の不具合はあり得ます。

## DOMテストを再実行

PlaywrightのPythonパッケージとChromiumが利用できる開発環境で、次を実行します。これらはアプリの利用には必要ありません。ブラウザ実行ファイルを指定する場合は環境変数 `QUIET_CHROMIUM` を使います。

```sh
python tests/browser_test.py
```

結果は `tests/integration-results.json` に生成されます。外部サービスのAPIには接続しません。

## 確認した操作

- PASS: empty state is not falsely passed
- PASS: sample failures are exposed
- PASS: rule export omits manuscript and file name
- PASS: editing file name invalidates manual verification
- PASS: fixing conditions changes result to pass
- PASS: selection activates range count
- PASS: editing clears stale selection
- PASS: Unicode family is one grapheme
- PASS: report omits full draft
- PASS: rule import preserves draft
- PASS: rule import actually replaces rules
- PASS: invalid import preserves state
- PASS: opt-in persistence serializes current draft
- PASS: new instance restores from saved storage fixture
- PASS: other-tab change stops autosave
- PASS: quota failure disables autosave with notice
- PASS: TXT import normalizes line endings
- PASS: nontext file only supplies filename
- PASS: user phrases render as text, not HTML
- PASS: no JavaScript errors
