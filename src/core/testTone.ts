const BEEPS = [
  { at: 1, dur: 0.15, freq: 880 },
  { at: 3, dur: 0.15, freq: 660 },
  { at: 6, dur: 0.15, freq: 990 },
];

export function testToneWav(sampleRate = 44_100, seconds = 10): Uint8Array {
  const count = sampleRate * seconds;
  const data = new Int16Array(count);
  for (let i = 0; i < count; i++) {
    const time = i / sampleRate;
    let sample = 0;
    for (const beep of BEEPS) {
      const delta = time - beep.at;
      if (delta < 0 || delta >= beep.dur) continue;
      const env = Math.sin((Math.PI * delta) / beep.dur);
      sample += Math.sin(2 * Math.PI * beep.freq * delta) * env * 0.6;
    }
    data[i] = Math.max(-1, Math.min(1, sample)) * 32_767;
  }

  const header = new ArrayBuffer(44);
  const view = new DataView(header);
  const write = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  };
  write(0, "RIFF");
  view.setUint32(4, 36 + data.byteLength, true);
  write(8, "WAVE");
  write(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, "data");
  view.setUint32(40, data.byteLength, true);

  const out = new Uint8Array(44 + data.byteLength);
  out.set(new Uint8Array(header), 0);
  out.set(new Uint8Array(data.buffer), 44);
  return out;
}

export function wavSample(wav: Uint8Array, sampleRate: number, atSec: number): number {
  const index = Math.round(atSec * sampleRate);
  const offset = 44 + index * 2;
  return new DataView(wav.buffer, wav.byteOffset, wav.byteLength).getInt16(offset, true);
}
