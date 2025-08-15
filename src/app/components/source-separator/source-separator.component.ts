import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AudioSeparationService, SeparationTarget } from '../../services/audio-separation.service';
import { WavEncoder } from '../../util/wav-encoder';

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

  sampleClips: { name: string; url: string }[] = [
    { name: 'CC0 Demo Clip', url: 'assets/samples/cc0_demo_clip.mp3' }
  ];

  constructor(private svc: AudioSeparationService) {}

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
      const separated = await this.svc.removeStem(this.originalBuffer, target, (p)=>this.progress.set(p));
      const wavBlob = WavEncoder.encodeWav(separated);
      const url = URL.createObjectURL(wavBlob);
      this.processedUrl.set(url);
    } catch (e: any) {
      this.error.set(e.message || 'Processing failed');
    } finally {
      this.isProcessing.set(false);
    }
  }

  download() {
    const url = this.processedUrl();
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    const stem = this.svc.lastTargetRemoved || 'output';
    a.download = `${stem}-removed.wav`;
    a.click();
  }
}
