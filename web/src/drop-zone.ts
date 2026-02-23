import { css, html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';

@customElement('drop-zone')
export class DropZone extends LitElement {
  static styles = css`
    :host {
      display: block;
    }
    .card {
      box-shadow: 0 20px 40px rgba(15, 23, 42, 0.08);
    }
    .drop {
      border: 2px dashed #94a3b8;
      transition: all 0.2s ease;
    }
    .drop.drag {
      border-color: #0ea5e9;
      background: rgba(14, 165, 233, 0.08);
    }
  `;

  @state() private selectedFile: File | null = null;
  @state() private status = 'CSVファイルを選択してください。';
  @state() private isDragging = false;
  @state() private isConverting = false;
  @state() private downloadUrl: string | null = null;
  @state() private convertedCount = 0;

  private wasm: WebAssembly.Exports | null = null;

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    this.initWasm().catch((err) => {
      console.error(err);
      this.status = 'WASMの読み込みに失敗しました。';
    });
  }

  private async initWasm() {
    const resp = await fetch('/iryouhi.wasm');
    const bytes = await resp.arrayBuffer();
    const { instance } = await WebAssembly.instantiate(bytes, {});
    this.wasm = instance.exports;
  }

  private async handleFile(file: File) {
    this.selectedFile = file;
    this.status = '変換ボタンを押してください。';
    this.downloadUrl = null;
    this.convertedCount = 0;
  }

  private onInputChange = (e: Event) => {
    const input = e.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      void this.handleFile(input.files[0]);
    }
  };

  private onDragOver = (e: DragEvent) => {
    e.preventDefault();
    this.isDragging = true;
  };

  private onDragLeave = (e: DragEvent) => {
    e.preventDefault();
    this.isDragging = false;
  };

  private onDrop = (e: DragEvent) => {
    e.preventDefault();
    this.isDragging = false;
    if (e.dataTransfer?.files?.length) {
      const file = e.dataTransfer.files[0];
      if (file.name.endsWith('.csv')) {
        void this.handleFile(file);
      }
    }
  };

  private async convert() {
    if (!this.selectedFile || !this.wasm) return;

    this.isConverting = true;
    this.status = '変換中...';

    const buffer = await this.selectedFile.arrayBuffer();
    const inputBytes = new Uint8Array(buffer);

    const wasm = this.wasm as any;
    const inPtr = wasm.alloc(inputBytes.length);
    const mem = new Uint8Array(wasm.memory.buffer, inPtr, inputBytes.length);
    mem.set(inputBytes);

    const outPtr = wasm.convert(inPtr, inputBytes.length);
    const outLen = wasm.last_output_len();
    const outMem = new Uint8Array(wasm.memory.buffer, outPtr, outLen);
    const outputText = new TextDecoder('utf-8').decode(outMem);

    wasm.dealloc(inPtr, inputBytes.length);
    wasm.dealloc(outPtr, outLen);

    if (outputText.startsWith('ERROR:')) {
      this.status = outputText;
      this.isConverting = false;
      return;
    }

    const blob = new Blob([outputText], { type: 'text/csv' });
    this.downloadUrl = URL.createObjectURL(blob);
    this.convertedCount = outputText.trim().split(/\r?\n/).filter(Boolean).length;
    this.status = '変換完了';
    this.isConverting = false;
  }

  private clearFile() {
    this.selectedFile = null;
    this.downloadUrl = null;
    this.convertedCount = 0;
    this.status = 'CSVファイルを選択してください。';
  }

  render() {
    return html`
      <div class="min-h-screen bg-slate-200">
          <header class="border-b border-slate-200 bg-white">
          <div class="mx-auto flex max-w-4xl items-center gap-3 px-6 py-5">
            <div class="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-slate-50 text-slate-500">
              <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                <path d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" stroke-linecap="round" stroke-linejoin="round" />
                <path d="M14 3v5h5" stroke-linecap="round" stroke-linejoin="round" />
                <path d="M9 13h6M9 17h6" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </div>
            <div>
              <h1 class="text-xl font-semibold tracking-tight">医療費CSV変換ツール</h1>
              <p class="text-sm text-slate-500">
                マイナポータルの医療費CSVを、国税庁フォームへ貼り付け可能なCSVに変換
              </p>
            </div>
          </div>
        </header>

        <main class="mx-auto max-w-4xl px-6 py-8">
          <section>
            <h2 class="mb-3 text-base font-semibold">1. ファイル選択</h2>
            ${this.selectedFile
              ? html`
                  <div class="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3">
                    <div>
                      <p class="text-sm font-semibold">${this.selectedFile.name}</p>
                      <p class="text-xs text-slate-500">${(this.selectedFile.size / 1024).toFixed(1)} KB</p>
                    </div>
                    <button class="text-xs text-slate-500 underline" @click=${this.clearFile}>解除</button>
                  </div>
                `
              : html`
                  <div
                    class=${`drop rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center ${this.isDragging ? 'drag' : ''}`}
                    @dragover=${this.onDragOver}
                    @dragleave=${this.onDragLeave}
                    @drop=${this.onDrop}
                  >
                    <div class="mx-auto mb-4 grid h-10 w-10 place-items-center rounded-full border border-slate-200 bg-white text-slate-400">
                      <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                        <path d="M12 16V7" stroke-linecap="round" stroke-linejoin="round" />
                        <path d="M8 11l4-4 4 4" stroke-linecap="round" stroke-linejoin="round" />
                        <path d="M4 19h16" stroke-linecap="round" stroke-linejoin="round" />
                      </svg>
                    </div>
                    <p class="text-sm font-medium text-slate-600">CSVファイルをドラッグ&ドロップ</p>
                    <label class="mt-4 inline-flex items-center justify-center rounded-lg bg-indigo-500 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-600">
                      ファイルを選択
                      <input class="hidden" type="file" accept=".csv" @change=${this.onInputChange} />
                    </label>
                  </div>
                `}
          </section>

          <section class="mt-6">
            <h2 class="mb-3 text-base font-semibold">2. 変換実行</h2>
            <div class="rounded-2xl border border-slate-200 bg-white px-6 py-6 shadow-sm">
              <button
                class="w-full rounded-lg bg-indigo-500 px-4 py-3 text-sm font-semibold text-white disabled:opacity-40"
                ?disabled=${!this.selectedFile || this.isConverting}
                @click=${this.convert}
              >
                ${this.isConverting ? '変換中...' : '変換する'}
              </button>
              <p class="mt-3 text-xs text-slate-500">${this.status}</p>
            </div>
          </section>

          <section class="mt-6">
            <h2 class="mb-3 text-base font-semibold">3. ダウンロード</h2>
            <div class="rounded-2xl border border-slate-200 bg-white px-6 py-6 shadow-sm">
              ${this.downloadUrl
                ? html`
                    <a
                      class="flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold text-white shadow-sm ring-1 ring-emerald-500 hover:bg-emerald-600"
                      style="background-color:#10b981;color:#ffffff;"
                      href=${this.downloadUrl}
                      download="iryouhi_converted.csv"
                    >
                      <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                        <path d="M12 3v12" stroke-linecap="round" stroke-linejoin="round" />
                        <path d="M8 11l4 4 4-4" stroke-linecap="round" stroke-linejoin="round" />
                        <path d="M4 20h16" stroke-linecap="round" stroke-linejoin="round" />
                      </svg>
                      CSVをダウンロード
                    </a>
                  `
                : html`
                    <div class="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-100 px-4 py-3 text-sm font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-300">
                      <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                        <path d="M12 3v12" stroke-linecap="round" stroke-linejoin="round" />
                        <path d="M8 11l4 4 4-4" stroke-linecap="round" stroke-linejoin="round" />
                        <path d="M4 20h16" stroke-linecap="round" stroke-linejoin="round" />
                      </svg>
                      CSVをダウンロード
                    </div>
                  `}
              ${this.downloadUrl
                ? html`<p class="mt-2 text-xs text-slate-500">${this.convertedCount} 行を変換しました</p>`
                : null}
            </div>
          </section>

          <div class="mt-6 rounded-xl bg-slate-100 px-4 py-3 text-xs text-slate-500">
            <p>※ 支払年月日は MM/01/YYYY フォーマットで出力されます</p>
            <p>※ ファイルはサーバーにはアップロードされません</p>
          </div>
        </main>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'drop-zone': DropZone;
  }
}
