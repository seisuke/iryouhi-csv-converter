# Iryouhi CSV Converter

マイナポータルの医療費CSVを、国税庁「医療費集計フォーム v3.1」に貼り付け可能なCSVへ変換するブラウザアプリです。変換はブラウザ内のみで完結し、サーバーにアップロードしません。

## Requirements
- Zig `0.15.2`
- Python 3（ローカルHTTPサーバー用）

## Build
```
zig build -Doptimize=ReleaseSmall
```

生成物は `dist/` に配置されます。

## Local Serve
```
zig build serve
```

ブラウザで `http://localhost:8080` を開いてください。

## Deploy
GitHub Actions で `gh-pages` ブランチにデプロイされます。

## WASM Notes
- `alloc/dealloc/convert/last_output_len` の4関数をエクスポートしています。
- ターゲットは `wasm32-freestanding` を想定しています。
