/* =========================================================================
   三幕音景 · scores
   A tiny score-builder, then three hand-written movements.
   ========================================================================= */
(function () {
  'use strict';

  const NS = (window.Soundscape = window.Soundscape || {});
  const parseNote = NS.audio.parseNote;

  class Builder {
    constructor(cfg) {
      this.bpm = cfg.bpm;
      this.beatsPerBar = cfg.beatsPerBar;
      this.bars = cfg.bars;
      this.tail = cfg.tail == null ? 3 : cfg.tail;
      this.spb = 60 / this.bpm;
      this.events = [];
      this.automation = [];
    }

    time(bar, beat) {
      return ((bar - 1) * this.beatsPerBar + (beat || 0)) * this.spb;
    }

    add(inst, bar, beat, midi, durBeats, vel, extra) {
      const ev = {
        t: this.time(bar, beat),
        inst,
        midi,
        dur: Math.max(0.01, durBeats * this.spb),
        vel: vel == null ? 0.7 : vel
      };
      if (extra) Object.assign(ev, extra);
      this.events.push(ev);
      return ev;
    }

    at(inst, t, midi, dur, vel, extra) {
      const ev = { t, inst, midi, dur, vel: vel == null ? 0.7 : vel };
      if (extra) Object.assign(ev, extra);
      this.events.push(ev);
      return ev;
    }

    chord(inst, bar, beat, midis, durBeats, vel, extra) {
      const self = this;
      midis.forEach(function (m, i) {
        const e = extra ? Object.assign({}, extra) : {};
        e.pan = (extra && extra.pan ? extra.pan : 0) + (i - (midis.length - 1) / 2) * (extra && extra.spread ? extra.spread : 0.12);
        self.add(inst, bar, beat, m, durBeats, vel, e);
      });
    }

    melody(inst, startBar, lines, opts) {
      opts = opts || {};
      const unit = opts.unit == null ? 0.5 : opts.unit;
      const baseVel = opts.vel == null ? 0.7 : opts.vel;
      const transpose = opts.transpose || 0;
      const seed = opts.seed || 3;

      for (let li = 0; li < lines.length; li++) {
        const bar = startBar + li;
        const tokens = lines[li].trim().split(/\s+/);
        let pos = opts.startBeat || 0;
        let idx = 0;
        for (let ti = 0; ti < tokens.length; ti++) {
          const tok = tokens[ti];
          if (!tok || tok === '|') continue;
          const parts = tok.split(':');
          if (!parts[0] || parts[0] === 'r') {
            pos += parseFloat(parts[1] || '1') * unit;
            continue;
          }
          const midi = parseNote(parts[0]);
          if (midi == null) { console.warn('bad note', parts[0]); continue; }
          const len = parseFloat(parts[1] || '1') * unit;
          const jitter = Math.sin((bar * 13 + idx * 7 + seed) * 12.9898) * (opts.jitter || 0.035);
          const extra = {
            pan: (opts.pan || 0) + (opts.spread || 0) * Math.sin((idx + bar) * 1.7),
            detune: (opts.detune || 0) + Math.sin((bar * 31 + idx * 17) * 0.7) * 2.2
          };
          if (opts.opts) extra.opts = opts.opts;
          this.add(inst, bar, pos, midi + transpose, len * (opts.legato == null ? 0.98 : opts.legato), baseVel + jitter, extra);
          pos += len;
          idx++;
        }
      }
    }

    fxRiser(bar, beat, bars, vel) {
      const dur = bars * this.beatsPerBar * this.spb;
      this.at('riser', this.time(bar, beat), 0, dur, vel == null ? 0.55 : vel, {});
    }

    fxImpact(bar, beat, vel) {
      this.at('impact', this.time(bar, beat), 0, 2, vel == null ? 0.8 : vel, {});
    }

    duck(bar, beat, channel, depth, release) {
      this.events.push({
        t: this.time(bar, beat),
        inst: 'duck',
        channel,
        depth: depth == null ? 0.5 : depth,
        release: release || 0.12
      });
    }

    get duration() {
      return this.bars * this.beatsPerBar * this.spb + this.tail;
    }
  }

  /* ======================================================================
     I. 晨露与麦浪 / Morning Fields
     D major · 6/8 · 112 BPM
     ====================================================================== */

  function buildCountry() {
    const b = new Builder({ bpm: 112, beatsPerBar: 3, bars: 28, tail: 3.4 });

    const prog = [
      'D', 'G', 'Bm', 'A',
      'D', 'G', 'Bm', 'A', 'D', 'G', 'A', 'D',
      'Bm', 'G', 'D', 'A', 'G', 'D', 'A', 'D',
      'D', 'G', 'Bm', 'A', 'D', 'G', 'A', 'D'
    ];

    const CH = {
      D: { gtr: [50, 57, 62, 66], pad: [50, 57, 62, 66], bass: 38, cello: [50, 57] },
      G: { gtr: [43, 50, 55, 59], pad: [43, 50, 55, 59], bass: 43, cello: [43, 50] },
      Bm: { gtr: [47, 54, 59, 62], pad: [47, 54, 59, 62], bass: 35, cello: [47, 54] },
      A: { gtr: [45, 52, 57, 61], pad: [45, 52, 57, 61], bass: 45, cello: [45, 52] }
    };

    const melodyA = [
      'A4:3 F#4:1 A4:2',
      'B4:3 A4:1 F#4:2',
      'D5:4 B4:1 A4:1',
      'A4:6',
      'A4:2 B4:1 D5:1 E5:2',
      'D5:2 B4:1 A4:3',
      'F#4:2 A4:1 B4:1 A4:2',
      'F#4:4 r:2'
    ];
    const melodyB = [
      'B4:2 D5:2 F#5:2',
      'E5:3 D5:1 B4:2',
      'D5:2 E5:1 F#5:3',
      'E5:6',
      'B4:2 D5:1 E5:1 F#5:2',
      'A5:3 F#5:1 E5:2',
      'D5:2 B4:1 A4:1 B4:2',
      'A4:6'
    ];
    const melodyC = [
      'A4:2 D5:1 E5:1 F#5:2',
      'E5:3 D5:1 B4:2',
      'D5:2 F#5:1 E5:1 D5:2',
      'B4:6',
      'A4:2 B4:1 D5:1 E5:2',
      'F#5:3 E5:1 D5:2',
      'B4:2 A4:1 F#4:1 A4:2',
      'D5:6'
    ];

    for (let bar = 1; bar <= 28; bar++) {
      const ch = CH[prog[bar - 1]];
      const section = bar <= 4 ? 0 : bar <= 12 ? 1 : bar <= 20 ? 2 : 3;
      const dyn = [0.8, 0.78, 0.94, 0.8][section];

      // warm string bed
      ch.pad.forEach(function (m, i) {
        b.add('pad', bar, 0, m, 3.02, dyn * 0.54, {
          pan: (i - 1.5) * 0.16,
          detune: (i - 1) * 1.3
        });
      });

      // fingerpicked guitar
      const pattern = section === 2 ? [0, 2, 3, 2, 1, 3] : [0, 2, 1, 3, 2, 1];
      const accents = [1.0, 0.5, 0.66, 0.82, 0.52, 0.62];
      for (let k = 0; k < 6; k++) {
        if (bar === 28 && k > 3) break;
        const idx = pattern[k];
        b.add('guitar', bar, k * 0.5, ch.gtr[idx], 1.05, dyn * 0.74 * accents[k], {
          pan: (k % 2 === 0 ? -0.28 : 0.25) + (idx - 1.5) * 0.04,
          opts: { style: 'guitar', ring: section === 2 ? 2.1 : 1.7, gain: 0.5 }
        });
      }

      // upright bass
      if (bar >= 3) {
        const hits = bar === 28 ? [0] : (bar % 4 === 0 ? [0, 1.5, 2.5] : [0, 1.5]);
        hits.forEach(function (beat, hi) {
          b.add('upright', bar, beat, ch.bass, bar === 28 ? 2.8 : 0.8, dyn * (hi === 0 ? 0.8 : 0.58), {
            pan: -0.06
          });
        });
      }

      // shaker / tambourine / soft stomp
      if (bar >= 5 && bar <= 27) {
        for (let k = 0; k < 6; k++) {
          b.add('shaker', bar, k * 0.5, 0, 0.1, dyn * (k === 0 || k === 3 ? 0.34 : 0.22), {
            pan: k % 2 === 0 ? -0.42 : 0.38
          });
        }
      }
      if (bar >= 13 && bar <= 20) {
        b.add('tamb', bar, 0, 0, 0.15, dyn * 0.35, { pan: 0.4 });
        b.add('tamb', bar, 1.5, 0, 0.15, dyn * 0.28, { pan: 0.4 });
      }
      if (bar >= 13 && bar <= 27) {
        b.add('kick', bar, 0, 0, 0.2, dyn * 0.26, { pan: 0 });
        b.add('kick', bar, 1.5, 0, 0.2, dyn * 0.2, { pan: 0 });
      }

      // low cello in the middle section
      if (bar >= 13 && bar <= 20) {
        ch.cello.forEach(function (m, i) {
          b.add('strings', bar, 0, m, 3.0, dyn * (i === 0 ? 0.35 : 0.24), {
            pan: -0.25 + i * 0.2
          });
        });
      }

      // a little lift at the very end
      if (bar === 28) {
        ch.gtr.forEach(function (m, i) {
          b.add('guitar', bar, 0, m, 3.0, 0.55 - i * 0.03, {
            pan: (i - 1.5) * 0.2,
            opts: { style: 'guitar', ring: 3.3, gain: 0.55 }
          });
        });
      }
    }

    b.melody('flute', 5, melodyA, { vel: 0.72, pan: -0.12, spread: 0.09, jitter: 0.04, opts: { vibrato: 0.15 } });
    b.melody('flute', 13, melodyB, { vel: 0.8, pan: -0.1, spread: 0.1, jitter: 0.045, opts: { vibrato: 0.25 } });
    b.melody('flute', 21, melodyC, { vel: 0.74, pan: -0.12, spread: 0.1, jitter: 0.04, opts: { vibrato: 0.2 } });

    // soft guitar shadow an octave below, last phrase
    b.melody('guitar', 21, melodyC.slice(0, 4), {
      vel: 0.27, pan: 0.3, transpose: -12, jitter: 0.03,
      opts: { style: 'guitar', ring: 1.2, gain: 0.45 }
    });

    // birds at the edges of the day
    const birds = [
      [1, 0.3, 0.35, 0.3, -0.55], [1, 2.1, 0.26, 0.5, 0.6], [2, 1.25, 0.3, 0.55, -0.2],
      [3, 0.55, 0.24, 0.6, 0.45], [27, 1.1, 0.27, 0.7, -0.5], [28, 0.15, 0.3, 0.9, 0.5]
    ];
    birds.forEach(function (x) {
      b.add('bird', x[0], x[1], 0, 0.55, x[2], { pan: x[4], seed: Math.floor(x[2] * 1000 + x[0] * 31) });
    });

    return {
      id: 'country',
      index: 1,
      zh: '晨露与麦浪',
      en: 'Morning Fields',
      tag: '悠闲 · 乡村',
      key: 'D 大调',
      meter: '6/8',
      bpm: 112,
      duration: b.duration,
      desc: '木吉他的分解和弦像晨光里的麦芒，长笛在田埂上慢慢走。远处有鸟，脚边有风。',
      detail: '木吉他 · 长笛 · 低音提琴 · 弦乐 · 沙锤 · 鸟鸣',
      color: '#d9a441',
      color2: '#6f8f5a',
      level: 0.72,
      air: { freq: 3800, gain: 3.0 },
      events: b.events,
      automation: b.automation,
      channels: {
        guitar: { gain: 0.9, reverb: 0.22, delay: 0.05 },
        bass: { gain: 0.78, reverb: 0.05, delay: 0.02 },
        pad: { gain: 0.52, reverb: 0.45, delay: 0.03 },
        strings: { gain: 0.5, reverb: 0.4, delay: 0.04 },
        flute: { gain: 0.72, reverb: 0.32, delay: 0.12 },
        shaker: { gain: 0.4, reverb: 0.16, delay: 0.02 },
        tamb: { gain: 0.3, reverb: 0.2, delay: 0.04 },
        kick: { gain: 0.34, reverb: 0.08, delay: 0 },
        birds: { gain: 0.28, reverb: 0.5, delay: 0.1 }
      },
      fx: {
        reverb: { seconds: 2.6, decay: 2.8, damp: 0.52, preDelay: 0.014, return: 0.85 },
        delay: { time: 0.134, feedback: 0.18, tone: 3000, return: 0.35 }
      }
    };
  }

  /* ======================================================================
     II. 萤火秘境 / Lanterns of Elfhame
     E minor · 4/4 · 84 BPM
     ====================================================================== */

  function buildElf() {
    const b = new Builder({ bpm: 84, beatsPerBar: 4, bars: 24, tail: 4.2 });

    const prog = [
      'Em', 'Cmaj7', 'G', 'Dsus2',
      'Em', 'Cmaj7', 'G', 'D', 'Am7', 'Em', 'Cmaj7', 'Dsus2',
      'Cmaj7', 'G/B', 'Am7', 'Em', 'C', 'D', 'Bm7', 'Em',
      'Cmaj7', 'D', 'Em', 'Em'
    ];

    const HARP = {
      Em: [40, 47, 52, 55, 59, 64],
      Cmaj7: [36, 43, 48, 52, 55, 59],
      G: [43, 50, 55, 59, 62, 67],
      Dsus2: [38, 45, 50, 57, 62, 64],
      D: [38, 45, 50, 57, 62, 66],
      Am7: [45, 52, 57, 60, 64, 67],
      C: [36, 43, 48, 52, 55, 60],
      'G/B': [47, 50, 55, 59, 62, 67],
      Bm7: [35, 42, 47, 54, 57, 62]
    };

    const CHOIR = {
      Em: [64, 67, 71, 74],
      Cmaj7: [60, 64, 67, 71],
      G: [62, 67, 71, 74],
      Dsus2: [50, 57, 62, 64],
      D: [62, 66, 69, 74],
      Am7: [57, 64, 67, 72],
      C: [60, 64, 67, 72],
      'G/B': [59, 62, 67, 71],
      Bm7: [59, 62, 66, 71]
    };

    const melody = [
      'B5:4 G5:2 E5:2',
      'F#5:3 E5:1 D5:4',
      'E5:2 G5:1 B5:1 D6:4',
      'B5:6 r:2',
      'C6:3 B5:1 A5:2 G5:2',
      'A5:4 F#5:2 D5:2',
      'E5:2 G5:1 A5:1 B5:4',
      'E5:8',
      'G5:3 B5:1 D6:2 B5:2',
      'A5:2 G5:1 F#5:1 E5:4',
      'C6:3 B5:1 A5:2 E5:2',
      'B5:8',
      'E6:3 D6:1 B5:2 G5:2',
      'A5:2 B5:1 D6:1 E6:4',
      'D6:2 B5:1 A5:1 F#5:4',
      'E5:8',
      'B5:4 G5:2 E5:2',
      'F#5:4 D5:4',
      'E5:8',
      'E5:8'
    ];

    // deep drone
    b.add('pad', 1, 0, 40, 22 * 4, 0.3, { pan: -0.1, opts: { drone: true } });
    b.add('pad', 1, 0, 47, 22 * 4, 0.18, { pan: 0.12, opts: { drone: true } });
    b.add('wind', 1, 0, 0, 24 * 4 * b.spb, 0.22, { pan: 0 });

    for (let bar = 1; bar <= 24; bar++) {
      const chName = prog[bar - 1];
      const set = HARP[chName];
      const section = bar <= 4 ? 0 : bar <= 12 ? 1 : bar <= 20 ? 2 : 3;
      const dyn = [0.55, 0.73, 0.92, 0.62][section];
      const pattern = [0, 2, 1, 3, 2, 4, 3, 5];
      const spread = [0.34, 0.25, 0.3, 0.4][section];

      const notesPerBar = section === 0 || section === 3 ? 4 : 8;
      for (let k = 0; k < notesPerBar; k++) {
        const pk = section === 0 || section === 3 ? k * 2 : k;
        const idx = pattern[pk];
        const midi = set[idx] + (section === 2 && k === 7 ? 12 : 0);
        b.add('harp', bar, k * (section === 0 || section === 3 ? 1 : 0.5), midi, 0.6, dyn * (k === 0 ? 0.5 : 0.34), {
          pan: (k % 2 === 0 ? -1 : 1) * spread,
          detune: (k % 3 - 1) * 2.4,
          opts: { style: 'harp', ring: 2.1, gain: 0.44 }
        });
      }

      // upper octave shimmer in the middle section
      if (section === 2) {
        [3, 7, 11, 15].forEach(function (k, i) {
          b.add('harp', bar, k * 0.25, set[3 + (i % 3)] + 12, 0.3, dyn * 0.14, {
            pan: i % 2 === 0 ? 0.6 : -0.6,
            opts: { style: 'harp', ring: 1.2, gain: 0.34 }
          });
        });
      }

      // choir
      if (bar >= 3) {
        const voicing = CHOIR[chName];
        const cv = bar <= 4 ? 0.28 : section === 3 ? 0.4 : 0.5;
        voicing.forEach(function (m, i) {
          if (section === 3 && i > 2) return;
          b.add('choir', bar, 0, m, 4.0, cv * dyn, {
            pan: (i - 1.5) * 0.2,
            opts: { vowel: bar >= 17 ? 'ooh' : 'ah' }
          });
        });
      }

      // heartbeat of the forest
      if (bar === 5 || bar === 9 || bar === 13 || bar === 17 || bar === 21) {
        b.add('drum', bar, 0, 0, 1.2, 0.44, { pan: 0 });
      }
    }

    b.melody('bell', 5, melody, {
      vel: 0.48, pan: 0.12, spread: 0.22, jitter: 0.04,
      opts: { decay: 1.65, ratio: 4, index: 1.25 }
    });

    // breathy shadow of the tune in the high section
    b.melody('flute', 17, melody.slice(12, 16), {
      vel: 0.23, pan: -0.34, transpose: -12, jitter: 0.02, opts: { vibrato: 0.35 }
    });

    // distant fireflies
    const shimmers = [
      [2, 6.0, 88, 0.55], [4, 4.5, 95, -0.5], [7, 3.0, 88, 0.35], [10, 5.4, 100, -0.3],
      [14, 2.4, 95, 0.6], [18, 5.2, 88, -0.55], [22, 3.2, 100, 0.4]
    ];
    shimmers.forEach(function (s, i) {
      b.add('shimmer', s[0], s[1], s[2], 2.2, 0.2, {
        pan: s[3],
        opts: { decay: 2.6, ratio: 3.01, index: 0.8 }
      });
    });

    return {
      id: 'elf',
      index: 2,
      zh: '萤火秘境',
      en: 'Lanterns of Elfhame',
      tag: '精灵 · 异世界',
      key: 'E 小调',
      meter: '4/4',
      bpm: 84,
      duration: b.duration,
      desc: '竖琴在空气里结出光点，合唱像很远的地方传来的风。时间在这里不是直线，是一圈一圈的涟漪。',
      detail: '竖琴 · 钢片琴 · 人声合唱 · 弦乐持续音 · 低音鼓 · 风',
      color: '#78d6c0',
      color2: '#9b7bd4',
      level: 1.19,
      air: { freq: 5000, gain: 1.8 },
      events: b.events,
      automation: b.automation,
      channels: {
        harp: { gain: 0.82, reverb: 0.42, delay: 0.22 },
        choir: { gain: 0.62, reverb: 0.6, delay: 0.08 },
        pad: { gain: 0.58, reverb: 0.55, delay: 0.03 },
        bell: { gain: 0.6, reverb: 0.48, delay: 0.32 },
        shimmer: { gain: 0.36, reverb: 0.75, delay: 0.5 },
        flute: { gain: 0.55, reverb: 0.55, delay: 0.25 },
        drum: { gain: 0.45, reverb: 0.35, delay: 0.05 },
        wind: { gain: 0.3, reverb: 0.3, delay: 0 }
      },
      fx: {
        reverb: { seconds: 5.2, decay: 2.2, damp: 0.38, preDelay: 0.028, return: 0.95 },
        delay: { time: 0.357, feedback: 0.3, tone: 3800, return: 0.5 }
      }
    };
  }

  /* ======================================================================
     III. 霓虹矢量 / Neon Vector
     A minor · 4/4 · 124 BPM
     ====================================================================== */

  function buildSciFi() {
    const b = new Builder({ bpm: 124, beatsPerBar: 4, bars: 30, tail: 2.6 });

    const prog = [
      'Am', 'F', 'C', 'G', 'Am', 'F', 'Dm', 'E',
      'Am', 'F', 'C', 'G', 'Am', 'F', 'Dm', 'E',
      'F', 'C', 'G', 'Am',
      'Am', 'F', 'C', 'G', 'Am', 'F', 'Dm', 'E', 'Am', 'Am'
    ];

    const CH = {
      Am: { root: 33, pad: [57, 60, 64, 69], arp: [45, 52, 57, 60, 64, 69] },
      F: { root: 29, pad: [53, 57, 60, 65], arp: [41, 48, 53, 57, 60, 65] },
      C: { root: 36, pad: [55, 60, 64, 67], arp: [48, 52, 55, 60, 64, 67] },
      G: { root: 31, pad: [55, 59, 62, 67], arp: [43, 50, 55, 59, 62, 67] },
      Dm: { root: 38, pad: [53, 57, 62, 65], arp: [38, 45, 50, 53, 57, 62] },
      E: { root: 40, pad: [56, 59, 64, 68], arp: [40, 47, 52, 56, 59, 64] }
    };

    const leadA = [
      'A4:2 C5:1 E5:1 A5:2 G5:1 E5:1',
      'F5:3 E5:1 C5:4',
      'G5:2 E5:1 C5:1 E5:2 G5:2',
      'B4:4 D5:2 E5:2',
      'A5:2 E5:1 C5:1 A4:2 C5:1 E5:1',
      'F5:2 A5:2 C6:4',
      'B5:2 G#5:1 E5:1 D5:4',
      'E5:6 r:2'
    ];
    const leadB = [
      'E5:3 A5:1 C6:2 B5:2',
      'A5:2 F5:1 E5:1 C5:4',
      'G5:2 E5:1 G5:1 B5:2 D6:2',
      'B5:6 r:2',
      'C6:2 B5:1 A5:1 E5:4',
      'F5:2 A5:1 C6:1 D6:2 C6:2',
      'B5:2 G#5:1 D5:1 E5:4',
      'A5:8'
    ];
    const breakMel = [
      'A4:4 C5:2 E5:2',
      'G5:4 E5:4',
      'D5:4 F5:2 A5:2',
      'A4:8'
    ];

    const arpPat = [0, 2, 1, 3, 2, 4, 3, 5, 0, 2, 1, 3, 4, 3, 2, 1];
    const arpVel = [0.9, 0.45, 0.6, 0.5, 0.72, 0.46, 0.62, 0.5, 0.86, 0.48, 0.58, 0.52, 0.7, 0.48, 0.55, 0.42];

    for (let bar = 1; bar <= 30; bar++) {
      const ch = CH[prog[bar - 1]];
      const full = bar >= 9 && bar <= 16 || bar >= 21 && bar <= 28;
      const build = bar >= 5 && bar <= 8;
      const intro = bar <= 4;
      const brk = bar >= 17 && bar <= 20;

      // pad
      if (bar !== 30) {
        ch.pad.forEach(function (m, i) {
          b.add('pad', bar, 0, m, 4.0, (intro ? 0.32 : brk ? 0.38 : 0.42) + i * 0.015, {
            pan: (i - 1.5) * 0.2,
            detune: (i - 1.5) * 2
          });
        });
      } else {
        ch.pad.forEach(function (m, i) {
          b.add('pad', bar, 0, m, 5.0, 0.44, { pan: (i - 1.5) * 0.2 });
        });
      }

      // 16th arpeggio
      if (bar <= 28) {
        for (let k = 0; k < 16; k++) {
          if (intro && bar <= 2 && k % 2 === 1) continue;
          const midi = ch.arp[arpPat[k]];
          b.add('arp', bar, k * 0.25, midi, 0.18, arpVel[k] * (intro ? 0.7 : 1), {
            pan: k % 2 === 0 ? -0.34 : 0.34,
            detune: (k % 3 - 1) * 1.5
          });
        }
      }

      // bass
      if ((build || full) && bar <= 28) {
        const pattern = [0, 0, 12, 0, 7, 0, 12, 7];
        const accents = [1.0, 0.55, 0.78, 0.6, 0.74, 0.52, 0.8, 0.62];
        for (let k = 0; k < 8; k++) {
          b.add('synthbass', bar, k * 0.5, ch.root + pattern[k], 0.22, accents[k] * (build ? 0.72 : 0.9), {
            pan: 0
          });
        }
      }

      // drums
      if (build || full) {
        for (let beat = 0; beat < 4; beat++) {
          b.add('kick', bar, beat, 0, 0.2, beat === 0 ? 0.94 : 0.82, { pan: 0 });
          b.duck(bar, beat, 'pad', 0.4, 0.11);
          b.duck(bar, beat, 'arp', 0.72, 0.1);
          if (full) b.duck(bar, beat, 'bass', 0.7, 0.1);
        }
        b.add('clap', bar, 1, 0, 0.2, 0.62, { pan: -0.05 });
        b.add('clap', bar, 3, 0, 0.2, 0.58, { pan: 0.05 });
        for (let k = 0; k < 4; k++) {
          b.add('hat', bar, k + 0.5, 0, 0.1, 0.34, { pan: 0.25 });
        }
        if (bar % 2 === 0) {
          b.add('hat', bar, 3.75, 0, 0.2, 0.26, { pan: -0.3, opts: { open: true } });
        }
      }

      if (full) {
        for (let k = 0; k < 8; k++) {
          b.add('shaker', bar, k * 0.5 + 0.25, 0, 0.08, 0.12, { pan: k % 2 ? 0.42 : -0.42 });
        }
      }

      // fill into the next section
      if (bar === 8 || bar === 20 || bar === 28) {
        for (let k = 0; k < 8; k++) {
          const beat = 2 + k * 0.25;
          b.add('snare', bar, beat, 0, 0.08, 0.16 + k * 0.045, { pan: (k % 2 ? 0.2 : -0.2) });
        }
      }
    }

    // lead lines
    b.melody('lead', 9, leadA, { vel: 0.62, pan: -0.08, spread: 0.1, jitter: 0.03 });
    b.melody('lead', 21, leadB, { vel: 0.66, pan: -0.08, spread: 0.1, jitter: 0.03 });
    b.melody('lead', 29, ['A5:8'], { vel: 0.5, pan: 0, opts: {} });

    // glassy counter melody in the break
    b.melody('bell', 17, breakMel, {
      vel: 0.4, pan: 0.35, spread: 0.2, jitter: 0.03,
      opts: { decay: 1.35, ratio: 2.01, index: 0.9 }
    });

    // high sparks in the final drop
    const sparks = [
      [21, 0.5, 100], [21, 2.5, 107], [23, 1.5, 100], [23, 3.5, 104],
      [25, 0.5, 103], [25, 2.5, 107], [27, 1.25, 100], [27, 3.25, 104]
    ];
    sparks.forEach(function (s, i) {
      b.add('bell', s[0], s[1], s[2], 0.4, 0.17, {
        pan: i % 2 ? 0.55 : -0.55,
        opts: { decay: 0.6, ratio: 3.5, index: 0.5 }
      });
    });

    // FX
    b.fxRiser(4, 0, 1, 0.45);
    b.fxRiser(8, 0, 1, 0.62);
    b.fxRiser(20, 0, 1, 0.55);
    b.fxRiser(28, 0, 1, 0.5);
    b.fxImpact(9, 0, 0.82);
    b.fxImpact(17, 0, 0.52);
    b.fxImpact(21, 0, 0.8);
    b.fxImpact(29, 0, 0.9);
    b.at('glitch', b.time(8, 3.4), 0, 0.6, 0.55, { seed: 23 });
    b.at('glitch', b.time(20, 3.4), 0, 0.6, 0.5, { seed: 41 });
    b.at('glitch', b.time(28, 2.0), 0, 1.0, 0.6, { seed: 57 });

    const t = (bar) => b.time(bar);
    b.automation.push({
      kind: 'filter', channel: 'arp',
      points: [
        [0, 220],
        [t(5), 760],
        [t(8), 2400],
        [t(9), 4200],
        [t(16), 2600],
        [t(17), 1200],
        [t(20), 1800],
        [t(21), 5200],
        [t(28), 3400],
        [t(29), 1200],
        [t(30), 420]
      ]
    });

    return {
      id: 'scifi',
      index: 3,
      zh: '霓虹矢量',
      en: 'Neon Vector',
      tag: '现代 · 科幻',
      key: 'A 小调',
      meter: '4/4',
      bpm: 124,
      duration: b.duration,
      desc: '低频脉冲推着城市向前，滤波像雨刷一样扫过霓虹。远处有一个信号，一直在等你回应。',
      detail: '模拟合成器 · FM 主音 · 电子鼓组 · 滤波扫频 · 上升音效',
      color: '#4fd7ff',
      color2: '#ff4fa3',
      level: 1.0,
      air: { freq: 7000, gain: 0.6 },
      events: b.events,
      automation: b.automation,
      channels: {
        arp: { gain: 0.62, reverb: 0.14, delay: 0.24, filter: { freq: 220, q: 1.1 } },
        pad: { gain: 0.58, reverb: 0.32, delay: 0.05 },
        bass: { gain: 0.82, reverb: 0.03, delay: 0 },
        lead: { gain: 0.58, reverb: 0.24, delay: 0.32 },
        bell: { gain: 0.5, reverb: 0.38, delay: 0.35 },
        kick: { gain: 0.72, reverb: 0.05, delay: 0 },
        snare: { gain: 0.52, reverb: 0.14, delay: 0.02 },
        hats: { gain: 0.3, reverb: 0.1, delay: 0.01 },
        shaker: { gain: 0.18, reverb: 0.1, delay: 0.01 },
        fx: { gain: 0.5, reverb: 0.35, delay: 0.1 }
      },
      fx: {
        reverb: { seconds: 3.0, decay: 2.5, damp: 0.3, preDelay: 0.02, return: 0.9 },
        delay: { time: 0.242, feedback: 0.34, tone: 4200, return: 0.45 }
      }
    };
  }

  const movements = [buildCountry(), buildElf(), buildSciFi()];

  NS.movements = movements;

  // initialise the app once both scripts have loaded
  if (typeof NS.init === 'function') NS.init();
})();
