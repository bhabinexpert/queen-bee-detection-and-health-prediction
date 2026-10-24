/**
 * Encode raw Float32 audio samples into a RIFF/WAVE file (PCM 16-bit).
 * Handed directly to the API as a normal <File>, no server conversion needed.
 */
export function buildWavFile(floatSamples, sampleRate, channels = 1) {
  const sampleCount = floatSamples.length;
  const dataSize = sampleCount * 2;
  const byteLength = 44 + dataSize;
  const buffer = new ArrayBuffer(byteLength);
  const view = new DataView(buffer);

  const writeText = (offset, text) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  };

  writeText(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeText(8, "WAVE");
  writeText(12, "fmt ");
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // audio format: PCM
  view.setUint16(22, channels, true); // number of channels
  view.setUint32(24, sampleRate, true); // samples per second
  view.setUint32(28, sampleRate * channels * 2, true); // byte rate
  view.setUint16(32, channels * 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeText(36, "data");
  view.setUint32(40, dataSize, true);

  for (let i = 0; i < sampleCount; i++) {
    const s = Math.max(-1, Math.min(1, floatSamples[i]));
    view.setInt16(44 + i * 2, s < 0 ? Math.round(s * 0x8000) : Math.round(s * 0x7fff), true);
  }

  return new File([buffer], `live-recording-${Date.now()}.wav`, { type: "audio/wav" });
}