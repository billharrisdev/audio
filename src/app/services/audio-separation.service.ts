import { Injectable } from '@angular/core';

export type SeparationTarget = 'vocals' | 'drums' | 'bass' | 'guitar';

@Injectable({ providedIn: 'root' })
export class AudioSeparationService {
  private ctx = new AudioContext();
  lastTargetRemoved: SeparationTarget | null = null;

  async decodeFile(file: File): Promise<AudioBuffer> {
    const arrayBuf = await file.arrayBuffer();
    return await this.ctx.decodeAudioData(arrayBuf.slice(0));
  }

  async fetchAndDecode(url: string): Promise<AudioBuffer> {
    const res = await fetch(url);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const arr = await res.arrayBuffer();
    return await this.ctx.decodeAudioData(arr.slice(0));
  }

  async removeStem(buffer: AudioBuffer, target: SeparationTarget, onProgress?: (p:number)=>void): Promise<AudioBuffer> {
    this.lastTargetRemoved = target;
    const sampleRate = buffer.sampleRate;
    const offline = new OfflineAudioContext(buffer.numberOfChannels, buffer.length, sampleRate);

    // Copy original into buffer source
    const source = offline.createBufferSource();
    const clone = offline.createBuffer(buffer.numberOfChannels, buffer.length, sampleRate);
    for (let ch=0; ch<buffer.numberOfChannels; ch++) {
      clone.copyToChannel(buffer.getChannelData(ch), ch);
    }
    source.buffer = clone;

    // Stem specific processing graph
    let node: AudioNode = source;

    switch (target) {
      case 'vocals': {
        // Center channel cancellation approximation: (L - R)
        if (buffer.numberOfChannels >= 2) {
          const splitter = offline.createChannelSplitter(2);
          const inverter = offline.createGain(); inverter.gain.value = -1;
          const merger = offline.createChannelMerger(2);
          source.connect(splitter);
          splitter.connect(merger, 0, 0); // L
          splitter.connect(inverter, 1);
          inverter.connect(merger, 0, 1); // -R
          node = merger;
          // After merging L + (-R), apply some EQ to smooth artifacts
          const hp = offline.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 120;
          const lp = offline.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 12000;
          node.connect(hp); hp.connect(lp); node = lp;
        }
        break;
      }
      case 'bass': {
        // Remove low end using a high-pass filter
        const hp = offline.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 180; hp.Q.value = 0.7;
        node.connect(hp); node = hp;
        break;
      }
      case 'guitar': {
        // Notch out mid bands where guitars often sit
        const b1 = offline.createBiquadFilter(); b1.type = 'notch'; b1.frequency.value = 800; b1.Q.value = 4;
        const b2 = offline.createBiquadFilter(); b2.type = 'notch'; b2.frequency.value = 1500; b2.Q.value = 4;
        const b3 = offline.createBiquadFilter(); b3.type = 'notch'; b3.frequency.value = 3000; b3.Q.value = 6;
        node.connect(b1); b1.connect(b2); b2.connect(b3); node = b3;
        break;
      }
      case 'drums': {
        // Crude transient damping via lowpass + mild dynamics (manual)
        const lp = offline.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 6000; lp.Q.value = 0.5;
        const hp = offline.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 120; hp.Q.value = 0.7;
        node.connect(lp); lp.connect(hp); node = hp;
        break;
      }
    }

    // Blend: For demonstration we just output processed path. Real separation would subtract from original.
    const gain = offline.createGain(); gain.gain.value = 1.0;
    node.connect(gain);
    gain.connect(offline.destination);

    source.start();

    const total = buffer.length;
    // Provide fake progress updates (OfflineAudioContext doesn't give granular progress)
    if (onProgress) {
      for (let i=0;i<5;i++) {
        await new Promise(r=>setTimeout(r, 80));
        onProgress(Math.min(0.95, (i+1)/6));
      }
    }

    const rendered = await offline.startRendering();
    onProgress?.(1);
    return rendered;
  }
}
