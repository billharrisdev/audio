// Minimal WAV encoder for Float32 -> 16-bit PCM WAV
export class WavEncoder {
  static encodeWav(buffer: AudioBuffer): Blob {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const length = buffer.length;

    const samples = new Float32Array(length * numChannels);
    for (let ch = 0; ch < numChannels; ch++) {
      const channelData = buffer.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        samples[i * numChannels + ch] = channelData[i];
      }
    }

    const bytesPerSample = 2; // 16-bit
    const blockAlign = numChannels * bytesPerSample;
    const bufferLength = 44 + samples.length * bytesPerSample;
    const arrayBuffer = new ArrayBuffer(bufferLength);
    const view = new DataView(arrayBuffer);

    function writeString(offset: number, str: string) {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
    }

    let offset = 0;
    writeString(offset, 'RIFF'); offset += 4;
    view.setUint32(offset, 36 + samples.length * bytesPerSample, true); offset += 4;
    writeString(offset, 'WAVE'); offset += 4;
    writeString(offset, 'fmt '); offset += 4;
    view.setUint32(offset, 16, true); offset += 4; // subchunk1 size
    view.setUint16(offset, 1, true); offset += 2; // PCM
    view.setUint16(offset, numChannels, true); offset += 2;
    view.setUint32(offset, sampleRate, true); offset += 4;
    view.setUint32(offset, sampleRate * blockAlign, true); offset += 4;
    view.setUint16(offset, blockAlign, true); offset += 2;
    view.setUint16(offset, bytesPerSample * 8, true); offset += 2;
    writeString(offset, 'data'); offset += 4;
    view.setUint32(offset, samples.length * bytesPerSample, true); offset += 4;

    // Write samples
    let idx = 0;
    for (let i = 0; i < samples.length; i++, idx += 2) {
      let s = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(offset + idx, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }

    return new Blob([arrayBuffer], { type: 'audio/wav' });
  }
}
