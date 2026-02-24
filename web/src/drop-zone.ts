import { css, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { renderApp } from './view';

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
    const resp = await fetch(`${import.meta.env.BASE_URL}iryouhi.wasm`);
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
    return renderApp(
      {
        description: 'マイナポータルの医療費CSVを、国税庁フォームへ貼り付け可能なCSVに変換',
        selectedFileName: this.selectedFile?.name ?? null,
        selectedFileSizeKb: this.selectedFile ? `${(this.selectedFile.size / 1024).toFixed(1)} KB` : null,
        status: this.status,
        isDragging: this.isDragging,
        isConverting: this.isConverting,
        downloadUrl: this.downloadUrl,
        convertedCount: this.convertedCount,
      },
      {
        onInputChange: this.onInputChange,
        onDragOver: this.onDragOver,
        onDragLeave: this.onDragLeave,
        onDrop: this.onDrop,
        onClearFile: () => this.clearFile(),
        onConvert: () => {
          void this.convert();
        },
      },
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'drop-zone': DropZone;
  }
}
