"use strict";

const PLAY_ICON = '<svg class="play-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 9 6-9 6Z" /></svg>';
const PAUSE_ICON = '<svg class="pause-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 6v12M16 6v12" /></svg>';
const midiToHz = (midi) => 440 * 2 ** ((midi - 69) / 12);

function addNote(events, beat, midi, length, instrument, velocity = 0.8, pan = 0) {
  events.push({ beat, midi, length, instrument, velocity, pan });
}

function addMelody(events, instrument, notes, velocity = 0.8) {
  for (const [beat, midi, length, pan = 0] of notes) {
    addNote(events, beat, midi, length, instrument, velocity, pan);
  }
}

function buildPastoral() {
  const events = [];
  const chords = [
    [36, [60, 64, 67]], [43, [59, 62, 67]], [45, [60, 64, 69]], [41, [60, 65, 69]],
    [36, [60, 64, 67]], [41, [60, 65, 69]], [43, [59, 62, 67]], [36, [60, 64, 67]],
  ];
  const melody = [
    [0, 64, .5], [.5, 67, .5], [1, 69, 1], [2, 67, .5], [2.5, 64, .5], [3, 62, 1],
    [4, 62, .5], [4.5, 67, .5], [5, 71, 1], [6, 69, .5], [6.5, 67, .5], [7, 62, 1],
    [8, 64, .5], [8.5, 69, .5], [9, 72, 1], [10, 71, .5], [10.5, 69, .5], [11, 64, 1],
    [12, 65, .5], [12.5, 69, .5], [13, 72, 1], [14, 69, .5], [14.5, 65, .5], [15, 64, 1],
    [16, 67, 1], [17, 76, .5], [17.5, 74, .5], [18, 72, 1], [19, 67, 1],
    [20, 69, 1], [21, 72, .5], [21.5, 74, .5], [22, 76, 1], [23, 72, 1],
    [24, 74, .5], [24.5, 71, .5], [25, 67, 1], [26, 69, .5], [26.5, 71, .5], [27, 74, 1],
    [28, 72, 1], [29, 67, .5], [29.5, 64, .5], [30, 62, .5], [30.5, 64, .5], [31, 60, 1],
  ];
  addMelody(events, "guitar", melody, .8);

  chords.forEach(([root, chord], bar) => {
    const start = bar * 4;
    addNote(events, start, root, .9, "uprightBass", .75);
    addNote(events, start + 2, root + 7, .8, "uprightBass", .62);
    for (const offset of [.55, 1.55, 2.55, 3.55]) {
      chord.forEach((midi, i) => addNote(events, start + offset + i * .025, midi, .7, "guitar", .22, (i - 1) * .2));
    }
    addNote(events, start, 36, .1, "softKick", .45);
    addNote(events, start + 2, 36, .1, "softKick", .32);
    addNote(events, start + 1, 0, .25, "brush", .32, -.2);
    addNote(events, start + 3, 0, .25, "brush", .36, .2);
    for (let i = 0; i < 8; i++) addNote(events, start + i * .5, 0, .08, "shaker", i % 2 ? .12 : .2, .35);
  });
  return events;
}

function buildElven() {
  const events = [];
  const chords = [
    [38, [50, 57, 62, 65]], [43, [55, 59, 62, 67]], [45, [57, 60, 64, 69]], [38, [50, 57, 62, 65]],
    [41, [53, 57, 60, 65]], [36, [48, 55, 60, 64]], [43, [55, 59, 62, 67]], [38, [50, 57, 62, 65]],
  ];
  const melody = [
    [0, 74, .75], [1, 77, .5], [1.5, 81, 1.25], [3, 79, .8],
    [4, 79, .75], [5, 83, .5], [5.5, 86, 1.25], [7, 83, .8],
    [8, 81, 1], [9, 79, .5], [9.5, 76, .5], [10, 74, 1.75],
    [12, 77, 1], [13, 81, .5], [13.5, 84, .5], [14, 81, .8], [15, 79, .8],
    [16, 77, .5], [16.5, 81, .5], [17, 84, 1.5], [19, 88, .8],
    [20, 86, 1], [21, 84, .5], [21.5, 79, .5], [22, 76, 1.75],
    [24, 79, .5], [24.5, 83, .5], [25, 86, 1], [26, 88, .5], [26.5, 86, .5], [27, 83, .8],
    [28, 81, .5], [28.5, 77, .5], [29, 74, 1], [30, 73, .5], [30.5, 76, .5], [31, 74, 1],
  ];
  addMelody(events, "bell", melody, .72);

  chords.forEach(([root, chord], bar) => {
    const start = bar * 4;
    addNote(events, start, root, 3.8, "drone", .45, -.15);
    chord.slice(1).forEach((midi, i) => addNote(events, start, midi, 3.8, "pad", .25, (i - 1) * .4));
    const arp = [1, 2, 3, 2, 1, 3, 2, 3];
    arp.forEach((chordIndex, i) => {
      addNote(events, start + i * .5, chord[chordIndex] + 12, .7, "harp", .3, i % 2 ? .35 : -.35);
    });
    const sparkle = chord[3] + 24;
    addNote(events, start + 3.5, sparkle, .65, "bell", .13, bar % 2 ? -.65 : .65);
  });
  return events;
}

function buildFuture() {
  const events = [];
  const chords = [
    [40, [52, 55, 59, 64]], [36, [48, 52, 55, 60]], [43, [55, 59, 62, 67]], [38, [50, 54, 57, 62]],
    [40, [52, 55, 59, 64]], [36, [48, 52, 55, 60]], [43, [55, 59, 62, 67]], [38, [50, 54, 57, 62]],
  ];
  const melody = [
    [0, 64, .5], [.5, 67, .5], [1, 71, 1], [2, 74, .5], [2.5, 71, .5], [3, 67, .8],
    [4, 64, 1], [5, 67, .5], [5.5, 72, .5], [6, 71, 1.75],
    [8, 67, .5], [8.5, 71, .5], [9, 74, 1], [10, 76, .5], [10.5, 74, .5], [11, 71, .8],
    [12, 69, 1], [13, 74, .5], [13.5, 78, .5], [14, 76, .8], [15, 74, .8],
    [16, 79, .5], [16.5, 76, .5], [17, 74, 1], [18, 71, .5], [18.5, 67, .5], [19, 64, .8],
    [20, 72, 1], [21, 76, .5], [21.5, 79, .5], [22, 76, 1], [23, 72, .8],
    [24, 74, .5], [24.5, 79, .5], [25, 83, 1], [26, 79, .5], [26.5, 76, .5], [27, 74, .8],
    [28, 78, .5], [28.5, 74, .5], [29, 71, 1], [30, 69, .5], [30.5, 71, .5], [31, 64, .8],
  ];
  addMelody(events, "lead", melody, .48);

  chords.forEach(([root, chord], bar) => {
    const start = bar * 4;
    chord.slice(0, 3).forEach((midi, i) => addNote(events, start, midi, 3.8, "futurePad", .18, (i - 1) * .55));
    for (let i = 0; i < 16; i++) {
      const beat = start + i * .25;
      const arpIndex = [0, 1, 2, 3, 2, 1, 3, 1][i % 8];
      addNote(events, beat, chord[arpIndex] + 12, .2, "arp", i % 4 === 0 ? .38 : .25, i % 2 ? .28 : -.28);
      if (i % 2 === 0) addNote(events, beat, root, .38, "futureBass", .62);
      addNote(events, beat, 0, .045, i % 4 === 2 ? "openHat" : "hat", i % 2 ? .12 : .2, .3);
    }
    for (const offset of [0, 1, 2, 3]) addNote(events, start + offset, 0, .18, "kick", .72);
    addNote(events, start + 1, 0, .2, "snare", .45, -.08);
    addNote(events, start + 3, 0, .2, "snare", .5, .08);
  });
  return events;
}

const TRACKS = [
  {
    title: "麦田慢行", english: "PASTORAL", key: "C 大调", bpm: 82, bars: 8,
    color: "#d69a6e", build: buildPastoral,
  },
  {
    title: "月林来信", english: "ELVEN", key: "D 多利亚", bpm: 96, bars: 8,
    color: "#9bc8b5", build: buildElven,
  },
  {
    title: "霓虹轨道", english: "SCI-FI", key: "E 小调", bpm: 118, bars: 8,
    color: "#aab5ff", build: buildFuture,
  },
].map((track, index) => ({
  ...track,
  index,
  events: track.build().sort((a, b) => a.beat - b.beat),
  beats: track.bars * 4,
  duration: track.bars * 4 * 60 / track.bpm,
}));

class AudioEngine {
  constructor(onStateChange, onEnded) {
    this.context = null;
    this.activeSources = new Set();
    this.trackIndex = 0;
    this.state = "stopped";
    this.positionBeat = 0;
    this.startContextTime = 0;
    this.nextEvent = 0;
    this.scheduler = null;
    this.loop = false;
    this.onStateChange = onStateChange;
    this.onEnded = onEnded;
  }

  async initialize() {
    if (!this.context) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) throw new Error("当前浏览器不支持 Web Audio API");
      this.context = new AudioContextClass();
      const ctx = this.context;
      this.dry = ctx.createGain();
      this.master = ctx.createGain();
      this.analyser = ctx.createAnalyser();
      this.compressor = ctx.createDynamicsCompressor();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = .82;
      this.compressor.threshold.value = -16;
      this.compressor.knee.value = 18;
      this.compressor.ratio.value = 5;
      this.compressor.attack.value = .005;
      this.compressor.release.value = .2;
      this.master.gain.value = .72;
      this.dry.connect(this.master);
      this.master.connect(this.analyser);
      this.analyser.connect(this.compressor);
      this.compressor.connect(ctx.destination);

      this.reverb = ctx.createConvolver();
      this.reverb.buffer = this.createImpulse(2.8, 3.4);
      this.reverbGain = ctx.createGain();
      this.reverbGain.gain.value = .45;
      this.reverb.connect(this.reverbGain).connect(this.master);
      this.delay = ctx.createDelay(1);
      this.delay.delayTime.value = .31;
      this.delayFeedback = ctx.createGain();
      this.delayFeedback.gain.value = .28;
      this.delayGain = ctx.createGain();
      this.delayGain.gain.value = .3;
      this.delay.connect(this.delayFeedback).connect(this.delay);
      this.delay.connect(this.delayGain).connect(this.master);
      this.noiseBuffer = this.createNoise(2);
    }
    if (this.context.state === "suspended") await this.context.resume();
  }

  createNoise(seconds) {
    const buffer = this.context.createBuffer(1, this.context.sampleRate * seconds, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  createImpulse(seconds, decay) {
    const length = this.context.sampleRate * seconds;
    const impulse = this.context.createBuffer(2, length, this.context.sampleRate);
    for (let channel = 0; channel < 2; channel++) {
      const data = impulse.getChannelData(channel);
      for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** decay;
    }
    return impulse;
  }

  async play(index = this.trackIndex) {
    await this.initialize();
    if (this.state === "paused" && index === this.trackIndex) {
      this.beginAt(this.positionBeat);
      return;
    }
    this.haltSources();
    this.trackIndex = index;
    this.positionBeat = 0;
    this.beginAt(0);
  }

  beginAt(beat) {
    clearInterval(this.scheduler);
    const track = TRACKS[this.trackIndex];
    this.positionBeat = Math.max(0, Math.min(beat, track.beats - .001));
    this.startContextTime = this.context.currentTime + .06 - this.positionBeat * 60 / track.bpm;
    this.nextEvent = track.events.findIndex((event) => event.beat >= this.positionBeat - .001);
    if (this.nextEvent < 0) this.nextEvent = track.events.length;
    this.state = "playing";
    this.schedule();
    this.scheduler = setInterval(() => this.schedule(), 25);
    this.onStateChange(this.state, this.trackIndex);
  }

  pause() {
    if (this.state !== "playing") return;
    this.positionBeat = this.getPositionBeat();
    this.state = "paused";
    clearInterval(this.scheduler);
    this.haltSources();
    this.onStateChange(this.state, this.trackIndex);
  }

  stop() {
    clearInterval(this.scheduler);
    this.haltSources();
    this.state = "stopped";
    this.positionBeat = 0;
    this.onStateChange(this.state, this.trackIndex);
  }

  seek(fraction) {
    const beat = TRACKS[this.trackIndex].beats * fraction;
    if (this.state === "playing") {
      this.haltSources();
      this.beginAt(beat);
    } else {
      this.positionBeat = beat;
    }
  }

  haltSources() {
    for (const source of this.activeSources) {
      try { source.stop(); } catch (_) { /* Source may already have ended. */ }
    }
    this.activeSources.clear();
  }

  getPositionBeat() {
    if (this.state !== "playing") return this.positionBeat;
    return Math.max(0, (this.context.currentTime - this.startContextTime) * TRACKS[this.trackIndex].bpm / 60);
  }

  schedule() {
    if (this.state !== "playing") return;
    const track = TRACKS[this.trackIndex];
    const secondsPerBeat = 60 / track.bpm;
    const horizon = this.context.currentTime + .14;
    let position = this.getPositionBeat();
    if (position >= track.beats) {
      if (this.loop) {
        this.haltSources();
        this.beginAt(0);
      } else {
        clearInterval(this.scheduler);
        this.state = "stopped";
        this.positionBeat = 0;
        this.onStateChange(this.state, this.trackIndex);
        this.onEnded(this.trackIndex);
      }
      return;
    }
    while (this.nextEvent < track.events.length) {
      const event = track.events[this.nextEvent];
      const time = this.startContextTime + event.beat * secondsPerBeat;
      if (time >= horizon) break;
      if (time >= this.context.currentTime - .025) this.playEvent(event, time, secondsPerBeat);
      this.nextEvent++;
    }
  }

  register(source) {
    this.activeSources.add(source);
    source.addEventListener("ended", () => this.activeSources.delete(source), { once: true });
    return source;
  }

  connectVoice(output, pan = 0, reverb = 0, delay = 0) {
    const panner = this.context.createStereoPanner();
    panner.pan.value = pan;
    output.connect(panner);
    panner.connect(this.dry);
    if (reverb) {
      const send = this.context.createGain();
      send.gain.value = reverb;
      panner.connect(send).connect(this.reverb);
    }
    if (delay) {
      const send = this.context.createGain();
      send.gain.value = delay;
      panner.connect(send).connect(this.delay);
    }
  }

  envelope(gain, time, duration, peak, attack = .005, release = .08) {
    const end = time + Math.max(duration, attack + .01);
    gain.gain.setValueAtTime(.0001, time);
    gain.gain.exponentialRampToValueAtTime(Math.max(.0001, peak), time + attack);
    gain.gain.setValueAtTime(Math.max(.0001, peak), Math.max(time + attack, end - release));
    gain.gain.exponentialRampToValueAtTime(.0001, end);
    return end;
  }

  oscillator(type, frequency, time, stopTime, detune = 0) {
    const oscillator = this.register(this.context.createOscillator());
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, time);
    oscillator.detune.value = detune;
    oscillator.start(time);
    oscillator.stop(stopTime + .05);
    return oscillator;
  }

  noise(time, stopTime) {
    const source = this.register(this.context.createBufferSource());
    source.buffer = this.noiseBuffer;
    source.start(time);
    source.stop(stopTime + .02);
    return source;
  }

  playEvent(event, time, secondsPerBeat) {
    const duration = Math.max(.04, event.length * secondsPerBeat);
    const method = this[event.instrument];
    if (method) method.call(this, time, duration, event.midi, event.velocity, event.pan);
  }

  guitar(time, duration, midi, velocity, pan) {
    const ctx = this.context;
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(4200, time);
    filter.frequency.exponentialRampToValueAtTime(750, time + Math.min(duration, .65));
    const end = this.envelope(gain, time, duration + .32, velocity * .23, .004, .3);
    filter.connect(gain);
    this.oscillator("triangle", midiToHz(midi), time, end).connect(filter);
    const fundamental = this.oscillator("sine", midiToHz(midi), time, end);
    const fundamentalGain = ctx.createGain();
    fundamentalGain.gain.value = .45;
    fundamental.connect(fundamentalGain).connect(filter);
    this.connectVoice(gain, pan, .12);
    const pick = this.noise(time, time + .025);
    const pickGain = ctx.createGain();
    this.envelope(pickGain, time, .025, velocity * .035, .001, .02);
    pick.connect(pickGain);
    this.connectVoice(pickGain, pan);
  }

  uprightBass(time, duration, midi, velocity, pan) {
    const ctx = this.context;
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 480;
    const end = this.envelope(gain, time, duration + .12, velocity * .25, .012, .12);
    this.oscillator("triangle", midiToHz(midi), time, end).connect(filter);
    this.oscillator("sine", midiToHz(midi), time, end).connect(filter);
    filter.connect(gain);
    this.connectVoice(gain, pan, .05);
  }

  harp(time, duration, midi, velocity, pan) {
    const ctx = this.context;
    const gain = ctx.createGain();
    const end = this.envelope(gain, time, duration + .5, velocity * .22, .003, .48);
    this.oscillator("triangle", midiToHz(midi), time, end).connect(gain);
    const harmonic = ctx.createGain();
    harmonic.gain.value = .25;
    this.oscillator("sine", midiToHz(midi) * 2, time, end).connect(harmonic).connect(gain);
    this.connectVoice(gain, pan, .65, .12);
  }

  bell(time, duration, midi, velocity, pan) {
    const ctx = this.context;
    const frequency = midiToHz(midi);
    const gain = ctx.createGain();
    const end = this.envelope(gain, time, duration + 1.25, velocity * .19, .004, 1.2);
    const carrier = this.oscillator("sine", frequency, time, end);
    const modulator = this.oscillator("sine", frequency * 2.01, time, end);
    const modulation = ctx.createGain();
    modulation.gain.setValueAtTime(frequency * 1.8, time);
    modulation.gain.exponentialRampToValueAtTime(1, time + .75);
    modulator.connect(modulation).connect(carrier.frequency);
    carrier.connect(gain);
    this.connectVoice(gain, pan, .85, .38);
  }

  pad(time, duration, midi, velocity, pan) {
    const ctx = this.context;
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 1200;
    const end = this.envelope(gain, time, duration + .7, velocity * .12, .6, .65);
    for (const detune of [-6, 6]) this.oscillator("sine", midiToHz(midi), time, end, detune).connect(filter);
    filter.connect(gain);
    this.connectVoice(gain, pan, .8);
  }

  drone(time, duration, midi, velocity, pan) {
    const gain = this.context.createGain();
    const end = this.envelope(gain, time, duration + .4, velocity * .13, .35, .4);
    this.oscillator("sine", midiToHz(midi), time, end).connect(gain);
    this.oscillator("triangle", midiToHz(midi), time, end, 4).connect(gain);
    this.connectVoice(gain, pan, .55);
  }

  lead(time, duration, midi, velocity, pan) {
    const ctx = this.context;
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.Q.value = 4;
    filter.frequency.setValueAtTime(2800, time);
    filter.frequency.exponentialRampToValueAtTime(800, time + duration + .15);
    const end = this.envelope(gain, time, duration + .12, velocity * .14, .012, .11);
    this.oscillator("sawtooth", midiToHz(midi), time, end, -4).connect(filter);
    this.oscillator("square", midiToHz(midi), time, end, 4).connect(filter);
    filter.connect(gain);
    this.connectVoice(gain, pan, .15, .32);
  }

  arp(time, duration, midi, velocity, pan) {
    const ctx = this.context;
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 2300;
    filter.Q.value = 3;
    const end = this.envelope(gain, time, duration + .04, velocity * .12, .004, .035);
    this.oscillator("square", midiToHz(midi), time, end).connect(filter);
    filter.connect(gain);
    this.connectVoice(gain, pan, .1, .26);
  }

  futureBass(time, duration, midi, velocity, pan) {
    const ctx = this.context;
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.Q.value = 5;
    filter.frequency.setValueAtTime(720, time);
    filter.frequency.exponentialRampToValueAtTime(180, time + duration);
    const end = this.envelope(gain, time, duration + .03, velocity * .2, .008, .04);
    this.oscillator("sawtooth", midiToHz(midi), time, end).connect(filter);
    this.oscillator("sine", midiToHz(midi), time, end).connect(filter);
    filter.connect(gain);
    this.connectVoice(gain, pan);
  }

  futurePad(time, duration, midi, velocity, pan) {
    const ctx = this.context;
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 900;
    const end = this.envelope(gain, time, duration + .2, velocity * .09, .25, .25);
    this.oscillator("sawtooth", midiToHz(midi), time, end, -8).connect(filter);
    this.oscillator("sawtooth", midiToHz(midi), time, end, 8).connect(filter);
    filter.connect(gain);
    this.connectVoice(gain, pan, .35, .1);
  }

  kick(time, _duration, _midi, velocity) {
    const gain = this.context.createGain();
    const oscillator = this.register(this.context.createOscillator());
    oscillator.frequency.setValueAtTime(145, time);
    oscillator.frequency.exponentialRampToValueAtTime(44, time + .12);
    this.envelope(gain, time, .2, velocity * .65, .002, .16);
    oscillator.connect(gain);
    oscillator.start(time);
    oscillator.stop(time + .25);
    this.connectVoice(gain);
  }

  softKick(time, _duration, _midi, velocity) {
    const gain = this.context.createGain();
    const oscillator = this.register(this.context.createOscillator());
    oscillator.frequency.setValueAtTime(100, time);
    oscillator.frequency.exponentialRampToValueAtTime(48, time + .09);
    this.envelope(gain, time, .15, velocity * .35, .003, .12);
    oscillator.connect(gain);
    oscillator.start(time);
    oscillator.stop(time + .18);
    this.connectVoice(gain);
  }

  filteredNoise(time, duration, velocity, pan, type, frequency, gainScale = .25) {
    const ctx = this.context;
    const source = this.noise(time, time + duration + .03);
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = frequency;
    const gain = ctx.createGain();
    this.envelope(gain, time, duration, velocity * gainScale, .002, duration * .8);
    source.connect(filter).connect(gain);
    this.connectVoice(gain, pan, .08);
  }

  brush(time, duration, velocity, pan) { this.filteredNoise(time, duration, velocity, pan, "bandpass", 1700, .18); }
  shaker(time, duration, velocity, pan) { this.filteredNoise(time, duration, velocity, pan, "highpass", 5200, .15); }
  hat(time, duration, velocity, pan) { this.filteredNoise(time, duration, velocity, pan, "highpass", 7000, .2); }
  openHat(time, _duration, velocity, pan) { this.filteredNoise(time, .16, velocity, pan, "highpass", 6500, .18); }
  snare(time, _duration, velocity, pan) {
    this.filteredNoise(time, .18, velocity, pan, "bandpass", 1800, .4);
    const gain = this.context.createGain();
    this.envelope(gain, time, .1, velocity * .12, .002, .08);
    this.oscillator("triangle", 180, time, time + .12).connect(gain);
    this.connectVoice(gain, pan);
  }
}

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const cards = $$(".track-card");
const seekInput = $("#seek");
const volumeInput = $("#volume");
const mainPlay = $("#main-play");
const loopButton = $("#loop");
const canvas = $("#visualizer");
const canvasContext = canvas.getContext("2d");
let seeking = false;
let lastDisplayedSecond = -1;

function formatTime(seconds) {
  const value = Math.max(0, Math.floor(seconds));
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, "0")}`;
}

function updateState(state, trackIndex) {
  const track = TRACKS[trackIndex];
  document.documentElement.style.setProperty("--accent", track.color);
  $("#current-kicker").textContent = `${String(trackIndex + 1).padStart(2, "0")} / ${track.english}`;
  $("#current-title").textContent = track.title;
  $("#current-key").textContent = `${track.key} · ${track.bpm} BPM`;
  $("#duration").textContent = formatTime(track.duration);
  $("#play-state").textContent = { playing: "正在演奏", paused: "已暂停", stopped: "准备就绪" }[state];
  mainPlay.innerHTML = state === "playing" ? PAUSE_ICON : PLAY_ICON;
  mainPlay.setAttribute("aria-label", state === "playing" ? "暂停" : "播放");
  cards.forEach((card, index) => {
    const active = index === trackIndex;
    const playing = active && state === "playing";
    card.classList.toggle("is-active", active);
    card.classList.toggle("is-playing", playing);
    const button = card.querySelector(".track-play");
    button.querySelector(".track-play-icon").innerHTML = playing ? PAUSE_ICON : PLAY_ICON;
    button.querySelector(".track-play-label").textContent = playing ? "暂停演奏" : active && state === "paused" ? "继续演奏" : "播放此曲";
    button.setAttribute("aria-label", `${playing ? "暂停" : "播放"}${TRACKS[index].title}`);
  });
  if (state === "stopped") {
    seekInput.value = 0;
    $("#elapsed").textContent = "0:00";
    lastDisplayedSecond = -1;
  }
}

const engine = new AudioEngine(updateState, () => {});

async function playTrack(index) {
  try {
    await engine.play(index);
  } catch (error) {
    $("#play-state").textContent = error.message;
  }
}

mainPlay.addEventListener("click", () => {
  if (engine.state === "playing") engine.pause();
  else playTrack(engine.trackIndex);
});
$("#stop").addEventListener("click", () => engine.stop());
loopButton.addEventListener("click", () => {
  engine.loop = !engine.loop;
  loopButton.setAttribute("aria-pressed", String(engine.loop));
});
cards.forEach((card, index) => {
  card.querySelector(".track-play").addEventListener("click", () => {
    if (engine.trackIndex === index && engine.state === "playing") engine.pause();
    else playTrack(index);
  });
});

seekInput.addEventListener("input", () => {
  seeking = true;
  const seconds = Number(seekInput.value) / 1000 * TRACKS[engine.trackIndex].duration;
  $("#elapsed").textContent = formatTime(seconds);
});
seekInput.addEventListener("change", () => {
  engine.seek(Number(seekInput.value) / 1000);
  seeking = false;
});
volumeInput.addEventListener("input", async () => {
  await engine.initialize();
  engine.master.gain.setTargetAtTime(Number(volumeInput.value) / 100, engine.context.currentTime, .02);
});

document.addEventListener("keydown", (event) => {
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLButtonElement) return;
  if (event.code === "Space") {
    event.preventDefault();
    if (engine.state === "playing") engine.pause();
    else playTrack(engine.trackIndex);
  }
  if (["Digit1", "Digit2", "Digit3"].includes(event.code)) playTrack(Number(event.code.slice(-1)) - 1);
});

for (const [index, card] of cards.entries()) {
  const wave = card.querySelector(".mini-wave");
  const events = TRACKS[index].events;
  for (let i = 0; i < 56; i++) {
    const from = i / 56 * TRACKS[index].beats;
    const to = (i + 1) / 56 * TRACKS[index].beats;
    const density = events.filter((event) => event.beat >= from && event.beat < to).length;
    const height = 12 + Math.min(25, density * 3.2) + (Math.sin(i * 2.17) + 1) * 3;
    const bar = document.createElement("span");
    bar.style.setProperty("--h", `${height}px`);
    bar.style.setProperty("--delay", `${-(i % 9) * .11}s`);
    wave.append(bar);
  }
}

function resizeCanvas() {
  const bounds = canvas.getBoundingClientRect();
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(bounds.width * ratio);
  canvas.height = Math.round(bounds.height * ratio);
  canvasContext.setTransform(ratio, 0, 0, ratio, 0, 0);
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

function drawVisualizer() {
  requestAnimationFrame(drawVisualizer);
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  canvasContext.clearRect(0, 0, width, height);
  const track = TRACKS[engine.trackIndex];
  const bars = 64;
  const gap = 3;
  const barWidth = (width - gap * (bars - 1)) / bars;
  let data;
  if (engine.analyser && engine.state === "playing") {
    data = new Uint8Array(engine.analyser.frequencyBinCount);
    engine.analyser.getByteFrequencyData(data);
  }
  canvasContext.fillStyle = track.color;
  for (let i = 0; i < bars; i++) {
    const sourceIndex = Math.floor(i / bars * 82);
    const level = data ? data[sourceIndex] / 255 : .035 + .018 * Math.sin(i * .55);
    const barHeight = Math.max(1.5, level * height * .82);
    const x = i * (barWidth + gap);
    canvasContext.globalAlpha = data ? .35 + level * .65 : .22;
    canvasContext.fillRect(x, height / 2 - barHeight / 2, barWidth, barHeight);
  }
  canvasContext.globalAlpha = 1;

  if (!seeking && engine.context) {
    const secondsPerBeat = 60 / track.bpm;
    const beat = Math.min(engine.getPositionBeat(), track.beats);
    const seconds = beat * secondsPerBeat;
    seekInput.value = Math.round(beat / track.beats * 1000);
    if (Math.floor(seconds) !== lastDisplayedSecond) {
      $("#elapsed").textContent = formatTime(seconds);
      lastDisplayedSecond = Math.floor(seconds);
    }
  }
}
updateState("stopped", 0);
drawVisualizer();
