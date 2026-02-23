const input = document.getElementById('csvInput');
const btn = document.getElementById('convertBtn');
const status = document.getElementById('status');
const download = document.getElementById('downloadLink');

let wasm;
let wasmReady = false;

async function init() {
  if (location.protocol === 'file:') {
    status.textContent = 'file:// では動作しません。`zig build serve` で起動してください。';
    btn.disabled = true;
    return;
  }

  const resp = await fetch('iryouhi.wasm');
  const bytes = await resp.arrayBuffer();
  const { instance } = await WebAssembly.instantiate(bytes, {});
  wasm = instance.exports;
  wasmReady = true;
  updateButtonState();
}

function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

function decodeUtf8(bytes) {
  return new TextDecoder('utf-8').decode(bytes);
}

function encodeUtf8(text) {
  return new TextEncoder().encode(text);
}

async function convert() {
  if (!wasm) {
    status.textContent = 'WASMの初期化中です。少し待ってください。';
    return;
  }

  const file = input.files?.[0];
  if (!file) {
    status.textContent = 'CSVファイルを選択してください。';
    return;
  }

  status.textContent = '変換中...';
  download.hidden = true;

  const buffer = await readFile(file);
  const inputBytes = new Uint8Array(buffer);

  const inPtr = wasm.alloc(inputBytes.length);
  const mem = new Uint8Array(wasm.memory.buffer, inPtr, inputBytes.length);
  mem.set(inputBytes);

  const outPtr = wasm.convert(inPtr, inputBytes.length);
  const outLen = wasm.last_output_len();
  const outMem = new Uint8Array(wasm.memory.buffer, outPtr, outLen);
  const outputText = decodeUtf8(outMem);

  wasm.dealloc(inPtr, inputBytes.length);
  wasm.dealloc(outPtr, outLen);

  if (outputText.startsWith('ERROR:')) {
    status.textContent = outputText;
    return;
  }

  const blob = new Blob([outputText], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  download.href = url;
  download.hidden = false;
  status.textContent = `変換完了: ${countLines(outputText)} 件`;
}

function countLines(text) {
  if (!text) return 0;
  return text.trim().split(/\r?\n/).filter(Boolean).length;
}

function updateButtonState() {
  const hasFile = !!input.files?.length;
  if (location.protocol === 'file:') {
    btn.disabled = true;
    status.textContent = 'file:// では動作しません。`zig build serve` で起動してください。';
    return;
  }
  btn.disabled = !hasFile || !wasmReady;
  if (!wasmReady) {
    status.textContent = 'WASMの初期化中です。少し待ってください。';
    return;
  }
  status.textContent = hasFile ? '変換ボタンを押してください。' : 'ファイルを選択してください。';
}

input.addEventListener('change', updateButtonState);
input.addEventListener('input', updateButtonState);

updateButtonState();

btn.addEventListener('click', () => {
  convert().catch((err) => {
    console.error(err);
    status.textContent = 'エラーが発生しました。';
  });
});

init().catch((err) => {
  console.error(err);
  status.textContent = 'WASMの読み込みに失敗しました。';
});
