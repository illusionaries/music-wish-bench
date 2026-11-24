"use strict";

const synthesize = (() => {
  const sampleRate = 44100;
  const floor = 0.0001;

  const voices = {
    guitar: {
      harmonics: [1, 0.72, 0.39, 0.29, 0.21, 0.12, 0.08],
      level: 0.118, attack: 0.012, decay: 0.51, sustain: 0.17, release: 0.24,
      cutoff: 3250, damp: 0.35, pan: -0.31, send: 0.18,
    },
    countryLead: {
      harmonics: [1, 0.56, 0.28, 0.14, 0.09, 0.07],
      level: 0.25, attack: 0.014, decay: 0.64, sustain: 0.26, release: 0.29,
      cutoff: 3600, damp: 0.37, pan: 0.10, send: 0.24,
    },
    countryBass: {
      harmonics: [1, 0.35, 0.15, 0.09],
      level: 0.20, attack: 0.018, decay: 0.56, sustain: 0.25, release: 0.21,
      cutoff: 1300, damp: 0.39, pan: 0.02, send: 0.06,
    },
    woodwind: {
      harmonics: [1, 0.18, 0.25, 0.08, 0.06],
      level: 0.084, attack: 0.11, decay: 0.32, sustain: 0.66, release: 0.25,
      cutoff: 2250, pan: 0.37, send: 0.33, vibrato: 11, breath: 0.16,
    },
    harp: {
      harmonics: [1, 0.47, 0.22, 0.03, 0.12],
      level: 0.17, attack: 0.012, decay: 0.65, sustain: 0.13, release: 0.34,
      cutoff: 5400, damp: 0.25, pan: -0.31, send: 0.46,
    },
    faeFlute: {
      harmonics: [1, 0.10, 0.064, 0.04, 0.045],
      level: 0.155, attack: 0.11, decay: 0.47, sustain: 0.72, release: 0.29,
      cutoff: 4700, pan: 0.10, send: 0.54, vibrato: 13, breath: 0.48,
    },
    choir: {
      harmonics: [1, 0.22, 0.32, 0.09, 0.13, 0.06, 0.085],
      level: 0.068, attack: 0.42, decay: 0.66, sustain: 0.72, release: 0.69,
      cutoff: 1580, pan: 0.14, send: 0.73, detune: 8,
    },
    bell: {
      harmonics: [1, 0.05, 0.29, 0.025, 0.105],
      level: 0.09, attack: 0.009, decay: 0.54, sustain: 0.10, release: 0.58,
      cutoff: 7000, pan: 0.45, send: 0.75, chime: true,
    },
    orbitLead: {
      harmonics: [1, 0.35, 0.35, 0.12, 0.19, 0.04, 0.09, 0.06],
      level: 0.17, attack: 0.026, decay: 0.26, sustain: 0.62, release: 0.22,
      cutoff: 3100, damp: 0.60, pan: 0.14, send: 0.46, detune: 5, vibrato: 7,
    },
    arpeggio: {
      harmonics: [1, 0.41, 0.23, 0.27, 0.12, 0.10],
      level: 0.13, attack: 0.01, decay: 0.13, sustain: 0.29, release: 0.17,
      cutoff: 4500, damp: 0.53, pan: -0.33, send: 0.54,
    },
    orbitPad: {
      harmonics: [1, 0.41, 0.29, 0.25, 0.19, 0.12, 0.1, 0.07],
      level: 0.061, attack: 0.25, decay: 0.90, sustain: 0.62, release: 0.57,
      cutoff: 1550, damp: 0.72, pan: 0.29, send: 0.48, detune: 11,
    },
    sub: {
      harmonics: [1, 0.73, 0.31, 0.21, 0.1, 0.05],
      level: 0.245, attack: 0.015, decay: 0.21, sustain: 0.61, release: 0.105,
      cutoff: 960, damp: 0.27, pan: 0, send: 0.015,
    },
  };

  const percussion = {
    shaker: { high: 2900, low: 8100, level: 0.12, pan: 0.36, send: 0.17 },
    hat: { high: 6300, low: 11100, level: 0.19, pan: -0.28, send: 0.18 },
    snare: { high: 740, low: 6100, level: 0.30, pan: 0.18, send: 0.27 },
    kick: { pan: 0, send: 0.025 },
  };

  const frequency = pitch => 440 * 2 ** ((pitch - 69) / 12);

  function noiseGenerator(seed) {
    return () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 2147483648 - 1;
    };
  }

  function makeRoom(context, size) {
    const impulse = context.createBuffer(2, Math.round(sampleRate * 1.55), sampleRate);
    const noise = noiseGenerator(53);
    for (let channel = 0; channel < impulse.numberOfChannels; channel++) {
      const data = impulse.getChannelData(channel);
      const predelay = Math.round(sampleRate * (0.022 + channel * 0.008));
      let smoothed = 0;
      for (let i = predelay; i < data.length; i++) {
        smoothed = 0.37 * smoothed + 0.63 * noise();
        data[i] = smoothed * Math.exp(-8.8 * (i - predelay) / data.length);
      }
      data[predelay] += 0.7;
    }

    const room = context.createConvolver();
    room.buffer = impulse;
    const wet = context.createGain();
    wet.gain.value = size;
    room.connect(wet);
    return { room, wet };
  }

  function makeBus(context, voice, destination, room) {
    const pan = context.createStereoPanner();
    pan.pan.value = voice.pan;
    const send = context.createGain();
    send.gain.value = voice.send;
    pan.connect(destination);
    pan.connect(send).connect(room);
    return pan;
  }

  function scheduleTone(context, voice, wave, noise, destination, note) {
    const { pitch, time, length, velocity } = note;
    const end = time + length;
    const stop = end + voice.release;
    const hz = frequency(pitch);
    const volume = voice.level * velocity;
    const attack = Math.min(voice.attack, length * 0.55);
    const decay = Math.min(voice.decay, length - attack);
    const sustain = volume * voice.sustain ** (decay / voice.decay);

    const envelope = context.createGain();
    envelope.gain.setValueAtTime(floor, time);
    envelope.gain.linearRampToValueAtTime(volume, time + attack);
    envelope.gain.exponentialRampToValueAtTime(sustain, time + attack + decay);
    envelope.gain.setValueAtTime(sustain, end);
    envelope.gain.exponentialRampToValueAtTime(floor, stop);
    envelope.connect(destination);

    const filter = context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(voice.cutoff, time);
    if (voice.damp) {
      filter.frequency.exponentialRampToValueAtTime(voice.cutoff * voice.damp, end);
    }
    filter.connect(envelope);

    let modulation;
    if (voice.vibrato) {
      const lfo = context.createOscillator();
      lfo.frequency.value = 5.1;
      modulation = context.createGain();
      modulation.gain.setValueAtTime(0, time);
      modulation.gain.linearRampToValueAtTime(voice.vibrato, time + Math.min(length * 0.65, 0.31));
      lfo.connect(modulation);
      lfo.start(time);
      lfo.stop(stop);
    }

    const detunes = voice.detune ? [-voice.detune, voice.detune] : [0];
    for (const cents of detunes) {
      const oscillator = context.createOscillator();
      oscillator.setPeriodicWave(wave);
      oscillator.frequency.value = hz;
      oscillator.detune.value = cents;
      if (modulation) modulation.connect(oscillator.detune);
      const blend = context.createGain();
      blend.gain.value = 1 / detunes.length;
      oscillator.connect(blend).connect(filter);
      oscillator.start(time);
      oscillator.stop(stop);
    }

    if (voice.breath) {
      const air = context.createBufferSource();
      air.buffer = noise;
      air.loop = true;
      const band = context.createBiquadFilter();
      band.type = "bandpass";
      band.frequency.value = 2050;
      band.Q.value = 0.9;
      const blend = context.createGain();
      blend.gain.value = voice.breath;
      air.connect(band).connect(blend).connect(envelope);
      air.start(time, (time * 0.291) % noise.duration);
      air.stop(stop);
    }

    if (voice.chime) {
      const overtone = context.createOscillator();
      overtone.frequency.value = hz * 2.76;
      const ring = context.createGain();
      ring.gain.setValueAtTime(0.21, time);
      ring.gain.exponentialRampToValueAtTime(floor, stop);
      overtone.connect(ring).connect(envelope);
      overtone.start(time);
      overtone.stop(stop);
    }
  }

  function drumBody(context, destination, time, length, level, high, low) {
    const oscillator = context.createOscillator();
    oscillator.frequency.setValueAtTime(high, time);
    oscillator.frequency.exponentialRampToValueAtTime(low, time + length * 0.38);
    const gain = context.createGain();
    gain.gain.setValueAtTime(floor, time);
    gain.gain.linearRampToValueAtTime(level, time + 0.004);
    gain.gain.exponentialRampToValueAtTime(floor, time + length);
    oscillator.connect(gain).connect(destination);
    oscillator.start(time);
    oscillator.stop(time + length);
  }

  function schedulePercussion(context, voice, noise, destination, note) {
    const { time, length, velocity } = note;
    if (note.voice === "kick") {
      drumBody(context, destination, time, length + 0.11, 0.53 * velocity, 148, 48);
      return;
    }

    if (note.voice === "snare") {
      drumBody(context, destination, time, 0.14, 0.13 * velocity, 229, 165);
    }

    const noiseSource = context.createBufferSource();
    noiseSource.buffer = noise;
    noiseSource.loop = true;
    const highpass = context.createBiquadFilter();
    highpass.type = "highpass";
    highpass.frequency.value = voice.high;
    const lowpass = context.createBiquadFilter();
    lowpass.type = "lowpass";
    lowpass.frequency.value = voice.low;
    const gain = context.createGain();
    gain.gain.setValueAtTime(floor, time);
    gain.gain.linearRampToValueAtTime(voice.level * velocity, time + 0.006);
    gain.gain.exponentialRampToValueAtTime(floor, time + length + 0.055);
    noiseSource.connect(highpass).connect(lowpass).connect(gain).connect(destination);
    noiseSource.start(time, (time * 0.371) % noise.duration);
    noiseSource.stop(time + length + 0.055);
  }

  return async function render(score) {
    const OfflineContext = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    const context = new OfflineContext(2, Math.ceil(score.duration * sampleRate), sampleRate);
    const compressor = context.createDynamicsCompressor();
    compressor.threshold.value = -12;
    compressor.knee.value = 14;
    compressor.ratio.value = 2.5;
    compressor.attack.value = 0.004;
    compressor.release.value = 0.15;
    const fade = context.createGain();
    fade.gain.setValueAtTime(1, score.duration - 0.32);
    fade.gain.linearRampToValueAtTime(0, score.duration);
    compressor.connect(fade).connect(context.destination);

    const { room, wet } = makeRoom(context, score.room);
    wet.connect(compressor);
    const noise = context.createBuffer(1, sampleRate, sampleRate);
    const noiseSamples = noise.getChannelData(0);
    const random = noiseGenerator(71);
    for (let i = 0; i < noiseSamples.length; i++) noiseSamples[i] = random();

    const buses = new Map();
    const waves = new Map();

    for (const note of score.events) {
      const melodicVoice = voices[note.voice];
      const voice = melodicVoice || percussion[note.voice];
      if (!buses.has(note.voice)) {
        buses.set(note.voice, makeBus(context, voice, compressor, room));
        if (melodicVoice) {
          const real = new Float32Array(voice.harmonics.length + 1);
          const imag = Float32Array.of(0, ...voice.harmonics);
          waves.set(note.voice, context.createPeriodicWave(real, imag));
        }
      }

      const bus = buses.get(note.voice);
      if (melodicVoice) {
        scheduleTone(context, voice, waves.get(note.voice), noise, bus, note);
      } else {
        schedulePercussion(context, voice, noise, bus, note);
      }
    }

    return context.startRendering();
  };
})();
