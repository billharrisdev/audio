import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AudioSeparationService, SeparationTarget } from '../../services/audio-separation.service';
import { WavEncoder } from '../../util/wav-encoder';
import { OnnxSeparatorService } from '../../services/ml/onnx-separator.service';
import { MODEL_REGISTRY } from '../../services/ml/model-registry';

@Component({
  selector: 'app-source-separator',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './source-separator.component.html',
  styleUrls: ['./source-separator.component.css']
})
export class SourceSeparatorComponent {
  fileName = signal<string | null>(null);
  isProcessing = signal(false);
  progress = signal(0);
  error = signal<string | null>(null);
  processedUrl = signal<string | null>(null);
  originalBuffer: AudioBuffer | null = null;

  // ML separation state
  useML = signal(false);
  models = MODEL_REGISTRY;
  selectedModel = signal<string>(MODEL_REGISTRY[0]?.id || '');
  mlLoading = computed(() => this.useML() && this.onnx.progress()?.stage !== 'done' && this.isProcessing());

  // Sample clips defined statically. If you add/remove samples in `src/assets/samples`,
  // update this list (or replace with a runtime fetch of a manifest JSON if desired).
  // The repo ships with placeholder file names – run `npm run fetch:samples` (after you
  // review the script + licenses) to download Creative Commons samples.
  sampleClips: { name: string; url: string }[] = [
    { name: 'Darkest Child (Kevin MacLeod, CC BY 3.0)', url: 'assets/samples/indie_rock_excerpt.mp3' },
    { name: 'In a Heartbeat (Kevin MacLeod, CC BY 3.0)', url: 'assets/samples/female_vocal_guitar_excerpt.mp3' },
    { name: 'For Originz (Kevin MacLeod, CC BY 3.0)', url: 'assets/samples/for_originz.mp3' }
  ];

  constructor(private svc: AudioSeparationService, private onnx: OnnxSeparatorService) {}

  async handleFile(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.fileName.set(file.name);
    this.error.set(null);
    this.processedUrl.set(null);
    try {
      this.originalBuffer = await this.svc.decodeFile(file);
    } catch (e: any) {
      this.error.set('Decode failed: ' + e.message);
    }
  }

  async loadSample(sample: {name: string; url: string}) {
    this.fileName.set(sample.name);
    this.error.set(null);
    this.processedUrl.set(null);
    try {
      this.originalBuffer = await this.svc.fetchAndDecode(sample.url);
    } catch (e: any) {
      this.error.set('Sample load failed: ' + e.message);
    }
  }

  async process(target: SeparationTarget) {
    if (!this.originalBuffer) {
      this.error.set('Please load a file first.');
      return;
    }
    this.isProcessing.set(true);
    this.progress.set(0);
    this.error.set(null);
    this.processedUrl.set(null);
    try {
      if (this.useML()) {
        // Ensure model loaded
        if (!this.onnx.currentModel() || this.onnx.currentModel()!.id !== this.selectedModel()) {
          await this.onnx.loadModel(this.selectedModel());
        }
        const outputs = await this.onnx.separate(this.originalBuffer, { onProgress: p => {
          if (p.chunkIndex != null && p.chunkCount) {
            this.progress.set((p.chunkIndex + 1) / p.chunkCount);
          }
        }});
        // Combine stems except the removed one
        const mix = this.combineStemsExcluding(outputs, target, this.originalBuffer.sampleRate);
        const wavBlob = WavEncoder.encodeWav(mix);
        const url = URL.createObjectURL(wavBlob);
        this.processedUrl.set(url);
      } else {
        const separated = await this.svc.removeStem(this.originalBuffer, target, (p)=>this.progress.set(p));
        const wavBlob = WavEncoder.encodeWav(separated);
        const url = URL.createObjectURL(wavBlob);
        this.processedUrl.set(url);
      }
    } catch (e: any) {
      this.error.set(e.message || 'Processing failed');
    } finally {
      this.isProcessing.set(false);
    }
  }

  combineStemsExcluding(outputs: { name: string; audio: Float32Array[] }[], exclude: string, sampleRate: number): AudioBuffer {
    const included = outputs.filter(o => o.name !== exclude);
    if (!included.length) throw new Error('No stems to mix');
    const length = Math.max(...included.map(o => o.audio[0].length));
    const ctx = new OfflineAudioContext(2, length, sampleRate);
    const mixBuffer = ctx.createBuffer(2, length, sampleRate);
    included.forEach(stem => {
      for (let ch=0; ch<2; ch++) {
        const data = mixBuffer.getChannelData(ch);
        const stemData = stem.audio[ch];
        for (let i=0; i<stemData.length; i++) {
          data[i] += stemData[i];
        }
      }
    });
    // Simple normalization
    for (let ch=0; ch<2; ch++) {
      const data = mixBuffer.getChannelData(ch);
      let peak = 0; for (let i=0;i<data.length;i++) peak = Math.max(peak, Math.abs(data[i]));
      if (peak > 1) { for (let i=0;i<data.length;i++) data[i] /= peak; }
    }
    return mixBuffer;
  }

  download() {
    const url = this.processedUrl();
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = `output.wav`;
    a.click();
  }
}
