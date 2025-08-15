/// <reference lib="webworker" />
import { WorkerRequest, WorkerResponse } from '../models/worker-messages';
import { SeparationModelInfo } from '../models/onnx-types';

let ort: typeof import('onnxruntime-web') | null = null;
let session: import('onnxruntime-web').InferenceSession | null = null;
let currentModel: SeparationModelInfo | null = null;

self.onmessage = async (ev: MessageEvent<WorkerRequest>) => {
  const msg = ev.data;
  try {
    if (msg.type === 'loadModel') {
      await loadModel(msg.model);
      post(<WorkerResponse>{ kind: 'ready', modelId: msg.model.id });
    } else if (msg.type === 'separate') {
      const stems = await separate(msg.channels, msg.sampleRate);
      post(<WorkerResponse>{ kind: 'result', stems });
    }
  } catch (e: any) {
    post(<WorkerResponse>{ kind: 'error', error: e.message || String(e) });
  }
};

function post(data: WorkerResponse) { (self as any).postMessage(data, data.kind === 'result' ? transferList(data) : undefined); }

function transferList(resp: WorkerResponse): Transferable[] | undefined {
  if (resp.kind !== 'result') return undefined;
  const t: Transferable[] = [];
  resp.stems.forEach(s => s.channels.forEach(ch => t.push(ch.buffer)));
  return t;
}

async function loadModel(model: SeparationModelInfo) {
  if (!ort) {
    post(<WorkerResponse>{ kind: 'progress', stage: 'downloading', message: 'Loading runtime' });
    ort = await import('onnxruntime-web');
  }
  post(<WorkerResponse>{ kind: 'progress', stage: 'initializing', message: 'Creating session' });
  session = await ort!.InferenceSession.create(model.url, { executionProviders: ['wasm'] });
  currentModel = model;
}

async function separate(channels: Float32Array[], sampleRate: number) {
  if (!session || !currentModel || !ort) throw new Error('Model not loaded');
  // TODO: Real model preprocessing (STFT, normalization). Placeholder pass-through.
  const len = channels[0].length;
  const slice = new Float32Array(2 * len);
  for (let ch=0; ch<2; ch++) slice.set(channels[ch], ch*len);
  const input = new ort.Tensor('float32', slice, [1, 2, len]);
  const feeds: Record<string, import('onnxruntime-web').Tensor> = { 'input': input };
  await session.run(feeds); // discard outputs for placeholder
  return [{ name: 'mix', channels: channels.map(c => c.slice()) }];
}

export {}; // keep file a module
