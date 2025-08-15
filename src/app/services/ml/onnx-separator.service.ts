import { Injectable, signal } from '@angular/core';
import type { InferenceSession, Tensor } from 'onnxruntime-web';
import * as ort from 'onnxruntime-web';
import { SeparationModelInfo, SeparationProgress } from '../../models/onnx-types';
import { getModel } from './model-registry';

interface StemOutput { name: string; audio: Float32Array[]; }

@Injectable({ providedIn: 'root' })
export class OnnxSeparatorService {
  session: InferenceSession | null = null;
  currentModel = signal<SeparationModelInfo | null>(null);
  progress = signal<SeparationProgress | null>(null);

  async loadModel(id: string) {
    const info = getModel(id);
    if (!info) throw new Error('Model not found');
    this.currentModel.set(info);
    this.progress.set({ stage: 'downloading', message: 'Fetching model...' });

    // onnxruntime-web handles fetching inside createInferenceSession if given URL
    this.progress.set({ stage: 'initializing', message: 'Creating session...' });
    this.session = await ort.InferenceSession.create(info.url, {
      executionProviders: ['wasm'],
      graphOptimizationLevel: 'all'
    });
  }

  private ensureSession() {
    if (!this.session || !this.currentModel()) throw new Error('Model not loaded');
  }

  async separate(buffer: AudioBuffer, opts?: { onProgress?: (p: SeparationProgress)=>void }): Promise<StemOutput[]> {
    this.ensureSession();
    const model = this.currentModel()!;
    const session = this.session!;

    if (model.requiresStereo && buffer.numberOfChannels < 2) {
      throw new Error('Model requires stereo audio');
    }

    // Resample if needed (simple offline context resample)
    let workBuffer = buffer;
    if (buffer.sampleRate !== model.sampleRate) {
      const offline = new OfflineAudioContext(buffer.numberOfChannels, Math.floor(buffer.duration * model.sampleRate), model.sampleRate);
      const src = offline.createBufferSource();
      src.buffer = buffer;
      src.connect(offline.destination);
      src.start();
      workBuffer = await offline.startRendering();
    }

    const totalLength = workBuffer.length;
    const chunkSize = model.chunkSize;
    const chunkCount = Math.ceil(totalLength / chunkSize);

    const stems: Record<string, Float32Array[]> = {};
    model.stems.forEach(stem => stems[stem] = []);

    for (let ci = 0; ci < chunkCount; ci++) {
      const start = ci * chunkSize;
      const end = Math.min(start + chunkSize, totalLength);
      const sliceLen = end - start;

      // Prepare input tensor shape: [batch, channels, samples]
      const channels = 2; // Using first two channels
      const inputData = new Float32Array(channels * sliceLen);
      for (let ch = 0; ch < channels; ch++) {
        const srcChan = workBuffer.getChannelData(ch);
        for (let i = 0; i < sliceLen; i++) {
          inputData[ch * sliceLen + i] = srcChan[start + i];
        }
      }
      const inputTensor = new ort.Tensor('float32', inputData, [1, channels, sliceLen]);

      this.progress.set({ stage: 'chunk', chunkIndex: ci, chunkCount, message: `Processing chunk ${ci+1}/${chunkCount}` });
      opts?.onProgress?.(this.progress()!);

      // Run inference (placeholder – actual output names depend on model)
      // Assume outputs: stem_0, stem_1, ... matching model.stems order
      const feeds: Record<string, Tensor> = { 'input': inputTensor };
      let results;
      try {
        results = await session.run(feeds);
      } catch (e:any) {
        throw new Error('Inference failed: ' + e.message);
      }

      model.stems.forEach((stem, idx) => {
        const key = `stem_${idx}`;
        const out = results[key] as Tensor;
        if (!out) return; // Skip missing
        const data = out.data as Float32Array;
        // Expect shape [1, channels, sliceLen]
        const samplesPerChannel = data.length / channels;
        for (let ch = 0; ch < channels; ch++) {
          const chanSlice = data.subarray(ch * samplesPerChannel, (ch+1)*samplesPerChannel);
          stems[stem][ch] = stems[stem][ch] ? concatFloat32(stems[stem][ch], chanSlice) : new Float32Array(chanSlice);
        }
      });
    }

    // Convert collected stem channel arrays to final output arrays
    const outputs: StemOutput[] = model.stems.map(stem => {
      const chanArrays = stems[stem];
      // Ensure both channels present
      const channelData: Float32Array[] = [];
      for (let ch=0; ch<2; ch++) {
        channelData.push(chanArrays[ch] || new Float32Array(0));
      }
      return { name: stem, audio: channelData };
    });

    this.progress.set({ stage: 'done', message: 'Separation complete' });
    opts?.onProgress?.(this.progress()!);
    return outputs;
  }
}

function concatFloat32(a: Float32Array, b: Float32Array): Float32Array {
  const out = new Float32Array(a.length + b.length);
  out.set(a, 0); out.set(b, a.length);
  return out;
}
