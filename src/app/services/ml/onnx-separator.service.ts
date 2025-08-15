import { Injectable, signal } from '@angular/core';
import { SeparationProgress } from '../../models/onnx-types';
import { getModel } from './model-registry';
import { WorkerResponse, WorkerRequest } from '../../models/worker-messages';

interface StemOutput { name: string; audio: Float32Array[]; }

@Injectable({ providedIn: 'root' })
export class OnnxSeparatorService {
  private worker: Worker | null = null;
  currentModel = signal<ReturnType<typeof getModel> | null>(null);
  progress = signal<SeparationProgress | null>(null);

  private initWorker() {
    if (this.worker) return;
    this.worker = new Worker(new URL('../../workers/onnx-separator.worker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = (ev: MessageEvent<WorkerResponse>) => {
      const data = ev.data;
      switch (data.kind) {
        case 'progress':
          this.progress.set(data);
          break;
        case 'ready':
          this.progress.set({ stage: 'done', message: 'Model loaded' });
          break;
        case 'result':
          // handled in separate() via Promise resolver
          break;
        case 'error':
          this.progress.set({ stage: 'error', message: data.error });
          break;
      }
    };
  }

  async loadModel(id: string) {
    const info = getModel(id);
    if (!info) throw new Error('Model not found');
    this.currentModel.set(info);
    this.initWorker();
    const req: WorkerRequest = { type: 'loadModel', model: info };
    this.worker!.postMessage(req);
  }

  async separate(buffer: AudioBuffer, opts?: { onProgress?: (p: SeparationProgress)=>void }): Promise<StemOutput[]> {
    const model = this.currentModel();
    if (!model) throw new Error('Model not loaded');
    this.initWorker();

    // Resample if needed
    let work = buffer;
    if (buffer.sampleRate !== model.sampleRate) {
      const offline = new OfflineAudioContext(buffer.numberOfChannels, Math.floor(buffer.duration * model.sampleRate), model.sampleRate);
      const src = offline.createBufferSource();
      src.buffer = buffer; src.connect(offline.destination); src.start();
      work = await offline.startRendering();
    }

    // For now send entire buffer; later chunking can be added.
    const L = work.getChannelData(0);
    const R = work.numberOfChannels > 1 ? work.getChannelData(1) : work.getChannelData(0);

    const channels = [new Float32Array(L), new Float32Array(R)];

    const result = await new Promise<StemOutput[]>((resolve, reject) => {
      if (!this.worker) return reject(new Error('Worker missing'));
      const handler = (ev: MessageEvent<WorkerResponse>) => {
        if (ev.data.kind === 'progress') {
          this.progress.set(ev.data);
          opts?.onProgress?.(ev.data);
        } else if (ev.data.kind === 'result') {
          this.worker!.removeEventListener('message', handler as any);
            const outputs: StemOutput[] = ev.data.stems.map(s => ({ name: s.name, audio: s.channels }));
          resolve(outputs);
        } else if (ev.data.kind === 'error') {
          this.worker!.removeEventListener('message', handler as any);
          reject(new Error(ev.data.error));
        }
      };
      this.worker.addEventListener('message', handler as any);
      const req: WorkerRequest = { type: 'separate', channels, sampleRate: work.sampleRate };
      this.worker!.postMessage(req, channels.map(c => c.buffer));
    });
    return result;
  }
}
