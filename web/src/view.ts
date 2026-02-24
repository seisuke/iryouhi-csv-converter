import { html, type TemplateResult } from 'lit';

export type AppViewModel = {
  description: string;
  selectedFileName: string | null;
  selectedFileSizeKb: string | null;
  status: string;
  isDragging: boolean;
  isConverting: boolean;
  downloadUrl: string | null;
  convertedCount: number;
};

export type AppActions = {
  onInputChange?: (e: Event) => void;
  onDragOver?: (e: DragEvent) => void;
  onDragLeave?: (e: DragEvent) => void;
  onDrop?: (e: DragEvent) => void;
  onClearFile?: () => void;
  onConvert?: () => void;
};

export function renderApp(view: AppViewModel, actions: AppActions = {}): TemplateResult {
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
            <p class="text-sm text-slate-500">${view.description}</p>
          </div>
        </div>
      </header>

      <main class="mx-auto max-w-4xl px-6 py-8">
        <section>
          <h2 class="mb-3 text-base font-semibold">1. ファイル選択</h2>
          ${view.selectedFileName
            ? html`
                <div class="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3">
                  <div>
                    <p class="text-sm font-semibold">${view.selectedFileName}</p>
                    <p class="text-xs text-slate-500">${view.selectedFileSizeKb}</p>
                  </div>
                  ${actions.onClearFile
                    ? html`<button class="text-xs text-slate-500 underline" @click=${actions.onClearFile}>解除</button>`
                    : html`<span class="text-xs text-slate-500">解除</span>`}
                </div>
              `
            : html`
                <div
                  class=${`drop rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center ${view.isDragging ? 'drag' : ''}`}
                  @dragover=${actions.onDragOver ?? (() => {})}
                  @dragleave=${actions.onDragLeave ?? (() => {})}
                  @drop=${actions.onDrop ?? (() => {})}
                >
                  <div class="mx-auto mb-4 grid h-10 w-10 place-items-center rounded-full border border-slate-200 bg-white text-slate-400">
                    <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                      <path d="M12 16V7" stroke-linecap="round" stroke-linejoin="round" />
                      <path d="M8 11l4-4 4 4" stroke-linecap="round" stroke-linejoin="round" />
                      <path d="M4 19h16" stroke-linecap="round" stroke-linejoin="round" />
                    </svg>
                  </div>
                  <p class="text-sm font-medium text-slate-600">CSVファイルをドラッグ&ドロップ</p>
                  ${actions.onInputChange
                    ? html`
                        <label class="mt-4 inline-flex items-center justify-center rounded-lg bg-indigo-700 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-800">
                          ファイルを選択
                          <input class="hidden" type="file" accept=".csv" @change=${actions.onInputChange} />
                        </label>
                      `
                    : html`
                        <div class="mt-4 inline-flex items-center justify-center rounded-lg bg-indigo-700 px-4 py-2 text-xs font-semibold text-white shadow-sm">
                          ファイルを選択
                        </div>
                      `}
                </div>
              `}
        </section>

        <section class="mt-6">
          <h2 class="mb-3 text-base font-semibold">2. 変換実行</h2>
          <div class="rounded-2xl border border-slate-200 bg-white px-6 py-6 shadow-sm">
            ${actions.onConvert
              ? html`
                  <button
                    class=${`w-full cursor-default rounded-lg px-4 py-3 text-sm font-semibold ${
                      !view.selectedFileName || view.isConverting
                        ? 'btn-disabled'
                        : 'btn-primary'
                    }`}
                    ?disabled=${!view.selectedFileName || view.isConverting}
                    @click=${actions.onConvert}
                  >
                    ${view.isConverting ? '変換中...' : '変換する'}
                  </button>
                `
              : html`
                  <div class="btn-disabled w-full rounded-lg px-4 py-3 text-center text-sm font-semibold">
                    変換する
                  </div>
                `}
            <p class="mt-3 text-xs text-slate-500">${view.status}</p>
          </div>
        </section>

        <section class="mt-6">
          <h2 class="mb-3 text-base font-semibold">3. ダウンロード</h2>
          <div class="rounded-2xl border border-slate-200 bg-white px-6 py-6 shadow-sm">
            ${view.downloadUrl
              ? html`
                  <a
                    class="btn-download-active flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold shadow-sm"
                    href=${view.downloadUrl}
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
                  <div
                    class="btn-download-disabled flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold"
                  >
                    <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                      <path d="M12 3v12" stroke-linecap="round" stroke-linejoin="round" />
                      <path d="M8 11l4 4 4-4" stroke-linecap="round" stroke-linejoin="round" />
                      <path d="M4 20h16" stroke-linecap="round" stroke-linejoin="round" />
                    </svg>
                    CSVをダウンロード
                  </div>
                `}
            ${view.downloadUrl ? html`<p class="mt-2 text-xs text-slate-500">${view.convertedCount} 行を変換しました</p>` : null}
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
