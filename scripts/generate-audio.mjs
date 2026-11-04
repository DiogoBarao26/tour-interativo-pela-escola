import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'demo', 'audio');
mkdirSync(root, { recursive: true });
const rate = 22050;

const files = {
  'music-home.wav': melody([262, 330, 392, 330, 294, 330, 392, 494], 0.42, 0.16),
  'music-quiz.wav': melody([330, 392, 440, 392, 349, 330, 294, 330], 0.36, 0.14),
  'music-puzzle.wav': melody([196, 247, 294, 247, 220, 196, 247, 294], 0.4, 0.13),
  'music-words.wav': melody([392, 494, 440, 392, 349, 392, 440, 523], 0.28, 0.15),
  'music-victory.wav': melody([392, 494, 587, 784, 659, 587, 523, 784], 0.24, 0.2),
  'music-encourage.wav': melody([262, 311, 349, 392, 349, 311, 294, 262], 0.4, 0.14),
  'sfx-correct.wav': melody([523, 659, 784], 0.12, 0.22),
  'sfx-wrong.wav': melody([196, 155], 0.16, 0.2, 'square'),
  'sfx-move.wav': melody([680], 0.05, 0.16),
  'sfx-puzzle-done.wav': melody([392, 523, 659, 784], 0.12, 0.2),
  'sfx-word-ok.wav': melody([740, 880], 0.08, 0.18),
  'sfx-word-bad.wav': melody([180, 140], 0.1, 0.16, 'square'),
  'sfx-finish.wav': melody([349, 440, 523], 0.14, 0.16),
  'sfx-celebrate.wav': melody([523, 659, 784, 1046], 0.12, 0.22),
};

for (const [name, samples] of Object.entries(files)) {
  writeFileSync(resolve(root, name), wav(samples, rate));
}

function melody(notes, duration, volume, type = 'sine') {
  return notes.flatMap((frequency) => tone(frequency, duration, volume, type));
}

function tone(frequency, duration, volume, type) {
  const count = Math.floor(rate * duration);
  const samples = new Array(count);
  for (let index = 0; index < count; index += 1) {
    const time = index / rate;
    const attack = Math.min(1, index / (rate * 0.02));
    const release = Math.min(1, (count - index) / (rate * 0.04));
    const cycle = (time * frequency) % 1;
    const wave = type === 'square' ? (cycle < 0.5 ? 1 : -1) : Math.sin(2 * Math.PI * frequency * time);
    samples[index] = wave * attack * release * volume;
  }
  return samples;
}

function wav(samples, sampleRate) {
  const buffer = Buffer.alloc(44 + samples.length * 2);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + samples.length * 2, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(samples.length * 2, 40);
  samples.forEach((sample, index) => {
    const clamped = Math.max(-1, Math.min(1, sample));
    buffer.writeInt16LE(Math.round(clamped * 32767), 44 + index * 2);
  });
  return buffer;
}
