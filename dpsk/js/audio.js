/* =========================================================================
   三幕音景 · Web Audio synthesis engine
   Pure Web Audio API. No samples, no libraries, no network.
   ========================================================================= */
(function () {
  'use strict';

  const NS = (window.Soundscape = window.Soundscape || {});
  const TAU = Math.PI * 2;
  const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

  /* ---------------------------------------------------------------- utils */

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hashString(s) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  const NOTE_OFFSET = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  function parseNote(name) {
    const m = /^([A-Ga-g])([#b]?)(-?\d)$/.exec(name.trim());
    if (!m) return null;
    let n = NOTE_OFFSET[m[1].toUpperCase()] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
    return (parseInt(m[3], 10) + 1) * 12 + n;
  }

  function gainNode(ctx, v) {
    const g = ctx.createGain();
    g.gain.value = v == null ? 1 : v;
    return g;
  }

  function stereoPanner(ctx, pan) {
    const p = ctx.createStereoPanner();
    p.pan.value = clamp(pan || 0, -1, 1);
    return p;
  }

  function biquad(ctx, type, freq, q, gain) {
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    if (q != null) f.Q.value = q;
    if (gain != null) f.gain.value = gain;
    return f;
  }

  /* --------------------------------------------------------- pluck buffers */
  /* Physically-informed additive pluck: inharmonic partials, per-partial
     decay, pick transient and body resonances. Rendered once, then played
     back as AudioBuffers (cheap, exact pitch, no Web Audio feedback delay). */

  const PLUCK_STYLES = {
    guitar: {
      sr: 22050, dur: 2.4, rolloff: 1.36, maxH: 30, bright: 0.56,
      decay: 1.25, hdecay: 0.30, inharm: 0.00010, pick: 0.20,
      body: 0.20, bodyFreqs: [96, 188, 330]
    },
    harp: {
      sr: 22050, dur: 3.1, rolloff: 1.0, maxH: 36, bright: 0.8,
      decay: 0.78, hdecay: 0.20, inharm: 0.00004, pick: 0.035,
      body: 0.10, bodyFreqs: [196, 430]
    },
    muted: {
      sr: 22050, dur: 1.1, rolloff: 1.7, maxH: 12, bright: 0.25,
      decay: 2.7, hdecay: 0.5, inharm: 0.00005, pick: 0.24,
      body: 0.10, bodyFreqs: [140, 310]
    }
  };

  const PLUCK_CACHE = new Map();

  function renderPluck(freq, styleName) {
    const cfg = PLUCK_STYLES[styleName] || PLUCK_STYLES.guitar;
    const sr = cfg.sr;
    const N = Math.max(8, Math.floor(sr * cfg.dur));
    const data = new Float32Array(N);
    const rng = mulberry32(hashString(styleName + ':' + freq.toFixed(2)));
    const maxH = Math.min(cfg.maxH, Math.max(1, Math.floor((sr * 0.46) / freq)));

    for (let h = 1; h <= maxH; h++) {
      const tilt = Math.pow(h, -cfg.rolloff);
      const sparkle = 1 + cfg.bright * 0.22 * Math.cos(h * 1.9 + 0.4);
      const amp = tilt * sparkle;
      const decay = cfg.decay * (1 + (h - 1) * cfg.hdecay);
      const fh = freq * h * Math.sqrt(1 + cfg.inharm * h * h);
      const w = (TAU * fh) / sr;
      const cw = Math.cos(w), sw = Math.sin(w);
      const envStep = Math.exp(-decay / sr);
      const phase = rng() * TAU;
      let s = Math.sin(phase), c = Math.cos(phase);
      let env = 1;
      const attackSamples = Math.max(2, Math.floor(sr * 0.0035));
      for (let n = 0; n < N; n++) {
        const atk = n < attackSamples ? n / attackSamples : 1;
        data[n] += amp * env * atk * s;
        const ns = s * cw + c * sw;
        c = c * cw - s * sw;
        s = ns;
        env *= envStep;
      }
    }

    // pick / nail transient
    const pickN = Math.floor(sr * 0.022);
    for (let n = 0; n < pickN; n++) {
      const t = n / sr;
      data[n] += (rng() * 2 - 1) * Math.exp(-t * 340) * cfg.pick;
    }

    // body resonances
    for (let i = 0; i < cfg.bodyFreqs.length; i++) {
      const bf = cfg.bodyFreqs[i];
      const ba = cfg.body / (i + 1);
      const phase = rng() * TAU;
      const w = (TAU * bf) / sr;
      for (let n = 0; n < N; n++) {
        const t = n / sr;
        data[n] += Math.sin(w * n + phase) * ba * Math.exp(-t * (5 + i * 2));
      }
    }

    // DC block + normalize + tiny tail fade
    let mean = 0;
    for (let n = 0; n < N; n++) mean += data[n];
    mean /= N;
    let peak = 0;
    for (let n = 0; n < N; n++) {
      data[n] -= mean;
      const a = Math.abs(data[n]);
      if (a > peak) peak = a;
    }
    const norm = 0.86 / (peak || 1);
    const fade = Math.min(N, Math.floor(sr * 0.03));
    for (let n = 0; n < N; n++) {
      data[n] *= norm;
      if (n > N - fade) data[n] *= (N - n) / fade;
    }

    const buf = new AudioBuffer({ length: N, sampleRate: sr, numberOfChannels: 1 });
    buf.copyToChannel(data, 0);
    return buf;
  }

  function getPluckBuffer(freq, style) {
    const key = style + ':' + freq.toFixed(2);
    let b = PLUCK_CACHE.get(key);
    if (!b) {
      b = renderPluck(freq, style);
      PLUCK_CACHE.set(key, b);
    }
    return b;
  }

  /* ------------------------------------------------------------- noise / IR */

  const NOISE = new WeakMap();

  function getNoise(ctx) {
    let b = NOISE.get(ctx);
    if (!b) {
      const N = Math.floor(ctx.sampleRate * 2.2);
      b = ctx.createBuffer(1, N, ctx.sampleRate);
      const d = b.getChannelData(0);
      const rng = mulberry32(0xC0FFEE);
      for (let i = 0; i < N; i++) d[i] = rng() * 2 - 1;
      NOISE.set(ctx, b);
    }
    return b;
  }

  function noiseSource(session, t, dur, loop) {
    const ctx = session.ctx;
    const src = ctx.createBufferSource();
    src.buffer = getNoise(ctx);
    src.loop = !!loop;
    const offset = (hashString('n' + t.toFixed(3)) % 1000) / 1000 * 1.5;
    src.start(t, offset);
    src.stop(t + Math.max(0.02, dur));
    return src;
  }

  const IR_CACHE = new WeakMap();

  function makeIR(ctx, cfg) {
    let map = IR_CACHE.get(ctx);
    if (!map) { map = new Map(); IR_CACHE.set(ctx, map); }
    const key = JSON.stringify(cfg);
    if (map.has(key)) return map.get(key);

    const sr = ctx.sampleRate;
    const seconds = cfg.seconds || 3;
    const N = Math.floor(sr * seconds);
    const buf = ctx.createBuffer(2, N, sr);
    const rng = mulberry32(0xBEEF01 + Math.floor(seconds * 10));
    const damp = cfg.damp == null ? 0.45 : cfg.damp;
    const decay = cfg.decay == null ? 2.8 : cfg.decay;

    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let lp = 0;
      const pre = Math.floor(sr * (cfg.preDelay || 0.012));
      for (let i = 0; i < N; i++) {
        if (i < pre) { d[i] = 0; continue; }
        const t = (i - pre) / sr;
        const env = Math.pow(Math.max(0, 1 - t / seconds), decay);
        const n = (rng() * 2 - 1) * env;
        lp += (n - lp) * damp;
        d[i] = lp;
      }
      // sparse early reflections for a sense of place
      const reflections = cfg.early || [[0.013, 0.5], [0.027, -0.38], [0.041, 0.27], [0.063, 0.18]];
      for (let k = 0; k < reflections.length; k++) {
        const at = Math.floor((reflections[k][0] + ch * 0.0027) * sr);
        if (at < N) d[at] += reflections[k][1] * 0.5;
      }
    }
    map.set(key, buf);
    return buf;
  }

  /* --------------------------------------------------------------- Session */

  class Session {
    constructor(ctx, movement, t0, destination, opts) {
      opts = opts || {};
      this.ctx = ctx;
      this.movement = movement;
      this.t0 = t0;
      this.destination = destination;
      this.offline = !!opts.offline;
      this.lookahead = opts.lookahead || 1.6;
      this.events = movement.events.slice().sort((a, b) => a.t - b.t);
      this.cursor = 0;
      this.timer = null;
      this.stopped = false;
      this.channels = new Map();

      const level = (movement.level == null ? 0.86 : movement.level) * (opts.volume == null ? 1 : opts.volume);
      this.level = level;

      const now = ctx.currentTime;
      this.master = gainNode(ctx, 0);
      this.master.gain.setValueAtTime(0.0001, now);
      this.master.gain.linearRampToValueAtTime(level, t0 + 0.45);

      this.comp = ctx.createDynamicsCompressor();
      this.comp.threshold.value = -20;
      this.comp.knee.value = 12;
      this.comp.ratio.value = 3;
      this.comp.attack.value = 0.008;
      this.comp.release.value = 0.26;

      this.limiter = ctx.createDynamicsCompressor();
      this.limiter.threshold.value = -3.5;
      this.limiter.knee.value = 0;
      this.limiter.ratio.value = 18;
      this.limiter.attack.value = 0.0012;
      this.limiter.release.value = 0.09;

      this.hp = biquad(ctx, 'highpass', 30, 0.7);
      const airCfg = movement.air || { freq: 6500, gain: 1.2 };
      this.air = biquad(ctx, 'highshelf', airCfg.freq, 0.6);
      this.air.gain.value = airCfg.gain;
      this.master.connect(this.hp);
      this.hp.connect(this.air);
      this.air.connect(this.comp);
      this.comp.connect(this.limiter);

      if (this.offline) {
        this.limiter.connect(destination);
      } else {
        this.analyser = ctx.createAnalyser();
        this.analyser.fftSize = 2048;
        this.analyser.smoothingTimeConstant = 0.82;
        this.limiter.connect(this.analyser);
        this.analyser.connect(destination);
        this.freqData = new Uint8Array(this.analyser.frequencyBinCount);
        this.timeData = new Uint8Array(this.analyser.fftSize);
      }

      // dry sum
      this.sum = gainNode(ctx, 1);
      this.sum.connect(this.master);
      this.dry = gainNode(ctx, 1);
      this.dry.connect(this.sum);

      // reverb
      const rv = movement.fx && movement.fx.reverb ? movement.fx.reverb : { seconds: 2.6, decay: 2.8, damp: 0.45 };
      this.reverb = ctx.createConvolver();
      this.reverb.buffer = makeIR(ctx, rv);
      this.reverb.normalize = true;
      this.reverbSend = gainNode(ctx, 1);
      this.reverbReturn = gainNode(ctx, rv.return == null ? 0.9 : rv.return);
      this.reverbSend.connect(this.reverb);
      this.reverb.connect(this.reverbReturn);
      this.reverbReturn.connect(this.sum);

      // ping-pong delay
      const dl = movement.fx && movement.fx.delay ? movement.fx.delay : { time: 0.22, feedback: 0.28, tone: 3200, return: 0.45 };
      this.delayCfg = dl;
      this.delaySend = gainNode(ctx, 1);
      this.delayReturn = gainNode(ctx, dl.return == null ? 0.5 : dl.return);
      const dL = ctx.createDelay(2.0);
      const dR = ctx.createDelay(2.0);
      dL.delayTime.value = dl.time;
      dR.delayTime.value = dl.time;
      const fbL = gainNode(ctx, dl.feedback);
      const fbR = gainNode(ctx, dl.feedback);
      const toneL = biquad(ctx, 'lowpass', dl.tone || 3200, 0.6);
      const toneR = biquad(ctx, 'lowpass', (dl.tone || 3200) * 0.9, 0.6);
      const panL = stereoPanner(ctx, -0.72);
      const panR = stereoPanner(ctx, 0.72);

      this.delaySend.connect(dL);
      dL.connect(toneL);
      toneL.connect(fbL);
      fbL.connect(dR);
      dR.connect(toneR);
      toneR.connect(fbR);
      fbR.connect(dL);
      dL.connect(panL);
      dR.connect(panR);
      panL.connect(this.delayReturn);
      panR.connect(this.delayReturn);
      this.delayReturn.connect(this.sum);
    }

    getChannel(name) {
      if (this.channels.has(name)) return this.channels.get(name);
      const def = (this.movement.channels && this.movement.channels[name]) || {};
      const ctx = this.ctx;
      const input = gainNode(ctx, def.gain == null ? 1 : def.gain);
      const trim = gainNode(ctx, 1);
      let filter = null;
      let node = input;
      if (def.filter) {
        filter = biquad(ctx, 'lowpass', def.filter.freq || 1800, def.filter.q || 0.8);
        input.connect(filter);
        node = filter;
      }
      node.connect(trim);
      trim.connect(this.dry);
      if (def.reverb) {
        const s = gainNode(ctx, def.reverb);
        trim.connect(s); s.connect(this.reverbSend);
      }
      if (def.delay) {
        const s = gainNode(ctx, def.delay);
        trim.connect(s); s.connect(this.delaySend);
      }
      const ch = { input, trim, filter, def };
      this.channels.set(name, ch);
      return ch;
    }

    scheduleAutomation() {
      const ctx = this.ctx;
      const autos = this.movement.automation || [];
      for (let i = 0; i < autos.length; i++) {
        const a = autos[i];
        if (a.kind !== 'filter') continue;
        const ch = this.getChannel(a.channel);
        if (!ch.filter) continue;
        const p = ch.filter.frequency;
        const t0 = this.t0;
        p.cancelScheduledValues(ctx.currentTime);
        let started = false;
        for (let k = 0; k < a.points.length; k++) {
          const pt = a.points[k];
          const at = t0 + pt[0];
          const v = clamp(pt[1], 24, 18000);
          if (!started) {
            p.setValueAtTime(v, at);
            started = true;
          } else {
            p.exponentialRampToValueAtTime(v, at);
          }
        }
      }
    }

    scheduleEvent(ev) {
      const t = this.t0 + ev.t;
      const fn = INSTRUMENTS[ev.inst];
      if (fn) {
        try { fn(this, ev, t); } catch (err) { console.warn('note failed', ev, err); }
      } else if (ev.inst === 'duck') {
        const ch = this.getChannel(ev.channel);
        const p = ch.trim.gain;
        p.setValueAtTime(1, t);
        p.linearRampToValueAtTime(ev.depth == null ? 0.45 : ev.depth, t + 0.008);
        p.setTargetAtTime(1, t + 0.05, ev.release || 0.12);
      }
    }

    scheduleUntil(absTime) {
      while (this.cursor < this.events.length) {
        const ev = this.events[this.cursor];
        if (this.t0 + ev.t > absTime) break;
        this.scheduleEvent(ev);
        this.cursor++;
      }
    }

    scheduleAll() {
      this.scheduleAutomation();
      while (this.cursor < this.events.length) {
        this.scheduleEvent(this.events[this.cursor]);
        this.cursor++;
      }
    }

    startLive() {
      this.scheduleAutomation();
      this.pump();
      this.timer = setInterval(() => this.pump(), 140);
    }

    pump() {
      if (this.stopped) return;
      this.scheduleUntil(this.ctx.currentTime + this.lookahead);
    }

    getAnalyser() { return this.analyser || null; }

    stop(fade) {
      if (this.stopped) return;
      this.stopped = true;
      if (this.timer) { clearInterval(this.timer); this.timer = null; }
      const now = this.ctx.currentTime;
      const g = this.master.gain;
      try { g.cancelScheduledValues(now); } catch (e) { /* noop */ }
      g.setValueAtTime(Math.max(0.0001, g.value), now);
      g.linearRampToValueAtTime(0.0001, now + (fade == null ? 0.12 : fade));
      const self = this;
      setTimeout(function () {
        try { self.master.disconnect(); } catch (e) { /* noop */ }
      }, (fade == null ? 0.12 : fade) * 1000 + 220);
    }
  }

  /* ------------------------------------------------------------ instruments */

  function outChain(session, channel, pan, gain) {
    const ctx = session.ctx;
    const g = gainNode(ctx, gain == null ? 1 : gain);
    const p = stereoPanner(ctx, pan || 0);
    g.connect(p);
    p.connect(session.getChannel(channel).input);
    return g;
  }

  function pluck(session, ev, t) {
    const ctx = session.ctx;
    const freq = mtof(ev.midi);
    const style = (ev.opts && ev.opts.style) || (ev.inst === 'harp' ? 'harp' : 'guitar');
    const buf = getPluckBuffer(freq, style);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.detune.value = ev.detune || 0;
    const g = outChain(session, ev.inst, ev.pan, (ev.vel == null ? 0.7 : ev.vel) * (ev.opts && ev.opts.gain ? ev.opts.gain : 0.4));
    const lp = biquad(ctx, 'lowpass', style === 'harp' ? clamp(freq * 13 + 3500, 4000, 16000) : clamp(freq * 14 + 3000, 3200, 14000), 0.35);
    src.connect(lp); lp.connect(g);

    const rate = Math.pow(2, (src.detune.value || 0) / 1200);
    const ring = (ev.opts && ev.opts.ring) || (style === 'harp' ? 2.6 : 1.9);
    const gate = Math.max(0.08, ev.dur || 0.3);
    const stopAt = t + Math.min(buf.duration / rate, gate + ring);
    src.start(t);
    src.stop(stopAt);
    const fade = Math.min(0.16, stopAt - t);
    g.gain.setValueAtTime(g.gain.value, t);
    g.gain.setValueAtTime(g.gain.value, Math.max(t + 0.001, stopAt - fade));
    g.gain.linearRampToValueAtTime(0.0001, stopAt);
  }

  function flute(session, ev, t) {
    const ctx = session.ctx;
    const freq = mtof(ev.midi);
    const dur = Math.max(0.1, ev.dur || 0.5);
    const vel = ev.vel == null ? 0.7 : ev.vel;
    const out = outChain(session, 'flute', ev.pan, 1);

    const mix = gainNode(ctx, 1);
    const lp = biquad(ctx, 'lowpass', 3600 + vel * 1600, 0.55);
    mix.connect(lp); lp.connect(out);

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const og = gainNode(ctx, 0.34);
    osc.connect(og); og.connect(mix);

    const osc2 = ctx.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.value = freq * 2;
    osc2.detune.value = 4;
    const og2 = gainNode(ctx, 0.06);
    osc2.connect(og2); og2.connect(mix);

    const osc3 = ctx.createOscillator();
    osc3.type = 'sine';
    osc3.frequency.value = freq * 3;
    const og3 = gainNode(ctx, 0.018);
    osc3.connect(og3); og3.connect(mix);

    // breath
    const nz = noiseSource(session, t, Math.min(0.5, dur + 0.1));
    const bp = biquad(ctx, 'bandpass', 2600, 0.65);
    const ng = gainNode(ctx, 0);
    nz.connect(bp); bp.connect(ng); ng.connect(out);
    ng.gain.setValueAtTime(0, t);
    ng.gain.linearRampToValueAtTime(0.075 * vel, t + 0.03);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);

    // vibrato blooms after the attack
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 4.7 + (ev.opts && ev.opts.vibrato || 0);
    const lg = gainNode(ctx, 0);
    lfo.connect(lg); lg.connect(osc.detune); lg.connect(osc2.detune);
    lg.gain.setValueAtTime(0, t);
    lg.gain.linearRampToValueAtTime(freq * 0.0045, t + 0.28);
    lg.gain.setValueAtTime(freq * 0.0045, t + dur);
    lg.gain.linearRampToValueAtTime(0, t + dur + 0.2);

    const peak = 0.34 * vel;
    out.gain.setValueAtTime(0, t);
    out.gain.linearRampToValueAtTime(peak, t + 0.075);
    out.gain.linearRampToValueAtTime(peak * 0.82, t + 0.2);
    out.gain.setValueAtTime(peak * 0.82, t + Math.max(0.2, dur));
    out.gain.linearRampToValueAtTime(0, t + dur + 0.2);

    osc.start(t); osc2.start(t); osc3.start(t); lfo.start(t);
    const end = t + dur + 0.28;
    osc.stop(end); osc2.stop(end); osc3.stop(end); lfo.stop(end);
  }

  function strings(session, ev, t) {
    const ctx = session.ctx;
    const freq = mtof(ev.midi);
    const dur = Math.max(0.2, ev.dur || 1);
    const vel = ev.vel == null ? 0.6 : ev.vel;
    const isPad = ev.inst === 'pad' || ev.inst === 'choirpad';
    const country = session.movement.id === 'country';
    const channel = ev.inst === 'strings' ? 'strings' : 'pad';
    const out = outChain(session, channel, ev.pan, 1);

    const filter = biquad(ctx, 'lowpass', country ? 3200 : isPad ? 1350 : 2300, 0.5);
    const mix = gainNode(ctx, 2.2);
    filter.connect(out);

    const detunes = country ? (isPad ? [-4, 4] : [-4, 3]) : isPad ? [-7, 0, 7] : [-5, 4];
    for (let i = 0; i < detunes.length; i++) {
      const o = ctx.createOscillator();
      o.type = country ? (i % 2 === 0 ? 'triangle' : 'sine') : (i === detunes.length - 1 && !isPad ? 'triangle' : 'sawtooth');
      o.frequency.value = freq;
      o.detune.value = detunes[i];
      const g = gainNode(ctx, country ? 0.085 : 0.055);
      o.connect(g); g.connect(mix);
      o.start(t);
      o.stop(t + dur + (isPad ? 2.4 : 1.3));
    }
    // warm sub-octave sine
    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.value = freq / 2;
    const sg = gainNode(ctx, isPad ? 0.05 : 0.035);
    sub.connect(sg); sg.connect(out);
    sub.start(t); sub.stop(t + dur + (isPad ? 2.4 : 1.3));

    // gentle filter movement
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.11 + (ev.midi % 5) * 0.013;
    const lg = gainNode(ctx, isPad ? 180 : 90);
    lfo.connect(lg); lg.connect(filter.frequency);
    lfo.start(t); lfo.stop(t + dur + 2.5);

    const attack = country ? (isPad ? 0.62 : 0.34) : isPad ? 0.85 : 0.3;
    const release = country ? (isPad ? 1.35 : 0.8) : isPad ? 1.9 : 0.9;
    const peak = 0.62 * vel;
    out.gain.setValueAtTime(0, t);
    out.gain.linearRampToValueAtTime(peak, t + attack);
    out.gain.linearRampToValueAtTime(peak * 0.86, t + attack + 0.5);
    out.gain.setValueAtTime(peak * 0.86, t + Math.max(attack + 0.55, dur));
    out.gain.linearRampToValueAtTime(0, t + dur + release);
  }

  function choir(session, ev, t) {
    const ctx = session.ctx;
    const freq = mtof(ev.midi);
    const dur = Math.max(0.5, ev.dur || 2);
    const vel = ev.vel == null ? 0.5 : ev.vel;
    const vowel = (ev.opts && ev.opts.vowel) || 'ah';
    const formants = vowel === 'ooh' ? [360, 820, 2450] : [720, 1180, 2700];
    const forms = vowel === 'ooh' ? [0.9, 0.5, 0.18] : [0.8, 0.55, 0.22];

    const out = outChain(session, 'choir', ev.pan, 1);
    const env = gainNode(ctx, 0);
    env.connect(out);

    const mix = gainNode(ctx, 0.55);
    const oscA = ctx.createOscillator(); oscA.type = 'sawtooth'; oscA.frequency.value = freq; oscA.detune.value = -6;
    const oscB = ctx.createOscillator(); oscB.type = 'sawtooth'; oscB.frequency.value = freq; oscB.detune.value = 7;
    const gA = gainNode(ctx, 0.5), gB = gainNode(ctx, 0.42);
    oscA.connect(gA); gA.connect(mix);
    oscB.connect(gB); gB.connect(mix);

    for (let i = 0; i < 3; i++) {
      const bp = biquad(ctx, 'bandpass', formants[i], 5.5 + i * 2.2);
      const g = gainNode(ctx, forms[i]);
      mix.connect(bp); bp.connect(g); g.connect(env);
    }
    const body = biquad(ctx, 'lowpass', 900, 0.4);
    const bg = gainNode(ctx, 0.22);
    mix.connect(body); body.connect(bg); bg.connect(env);

    const lfo = ctx.createOscillator();
    lfo.frequency.value = 4.4 + (ev.midi % 4) * 0.17;
    const lg = gainNode(ctx, 0);
    lfo.connect(lg); lg.connect(oscA.detune); lg.connect(oscB.detune);
    lg.gain.setValueAtTime(0, t);
    lg.gain.linearRampToValueAtTime(3.8, t + Math.min(1.4, dur * 0.6));

    const peak = 0.7 * vel;
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(peak, t + 1.1);
    env.gain.linearRampToValueAtTime(peak * 0.9, t + 1.8);
    env.gain.setValueAtTime(peak * 0.9, t + Math.max(1.9, dur));
    env.gain.linearRampToValueAtTime(0, t + dur + 2.1);

    const end = t + dur + 2.2;
    oscA.start(t); oscB.start(t); lfo.start(t);
    oscA.stop(end); oscB.stop(end); lfo.stop(end);
  }

  function upright(session, ev, t) {
    const ctx = session.ctx;
    const freq = mtof(ev.midi);
    const vel = ev.vel == null ? 0.7 : ev.vel;
    const dur = Math.max(0.12, ev.dur || 0.4);
    const out = outChain(session, 'bass', ev.pan, 1);
    const lp = biquad(ctx, 'lowpass', 620, 0.7);
    lp.connect(out);

    const o1 = ctx.createOscillator(); o1.type = 'triangle'; o1.frequency.value = freq;
    const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = freq;
    const g1 = gainNode(ctx, 0.5), g2 = gainNode(ctx, 0.34);
    o1.connect(g1); g1.connect(lp);
    o2.connect(g2); g2.connect(lp);

    // pluck thump
    const nz = noiseSource(session, t, 0.09);
    const nlp = biquad(ctx, 'lowpass', 420, 0.7);
    const ng = gainNode(ctx, 0.12 * vel);
    nz.connect(nlp); nlp.connect(ng); ng.connect(out);

    const peak = 0.52 * vel;
    out.gain.setValueAtTime(0, t);
    out.gain.linearRampToValueAtTime(peak, t + 0.012);
    out.gain.linearRampToValueAtTime(peak * 0.45, t + 0.16);
    out.gain.linearRampToValueAtTime(peak * 0.2, t + 0.4);
    out.gain.setValueAtTime(peak * 0.18, t + Math.max(0.42, dur));
    out.gain.linearRampToValueAtTime(0, t + dur + 0.24);

    const end = t + dur + 0.3;
    o1.start(t); o2.start(t); o1.stop(end); o2.stop(end);
  }

  function synthbass(session, ev, t) {
    const ctx = session.ctx;
    const freq = mtof(ev.midi);
    const vel = ev.vel == null ? 0.75 : ev.vel;
    const dur = Math.max(0.08, ev.dur || 0.2);
    const out = outChain(session, 'bass', ev.pan, 1);

    const lp = biquad(ctx, 'lowpass', 160, 7.5);
    lp.connect(out);
    lp.frequency.setValueAtTime(1200 + vel * 900, t);
    lp.frequency.exponentialRampToValueAtTime(165, t + 0.16);

    const saw = ctx.createOscillator(); saw.type = 'sawtooth'; saw.frequency.value = freq;
    const sg = gainNode(ctx, 0.32);
    saw.connect(sg); sg.connect(lp);
    const sub = ctx.createOscillator(); sub.type = 'sine'; sub.frequency.value = freq;
    const subg = gainNode(ctx, 0.5);
    sub.connect(subg); subg.connect(out);

    const peak = 0.5 * vel;
    out.gain.setValueAtTime(0, t);
    out.gain.linearRampToValueAtTime(peak, t + 0.006);
    out.gain.linearRampToValueAtTime(peak * 0.72, t + 0.08);
    out.gain.setValueAtTime(peak * 0.66, t + Math.max(0.09, dur));
    out.gain.linearRampToValueAtTime(0, t + dur + 0.09);

    const end = t + dur + 0.12;
    saw.start(t); sub.start(t); saw.stop(end); sub.stop(end);
  }

  function bell(session, ev, t) {
    const ctx = session.ctx;
    const freq = mtof(ev.midi);
    const vel = ev.vel == null ? 0.5 : ev.vel;
    const decay = (ev.opts && ev.opts.decay) || 1.5;
    const ratio = (ev.opts && ev.opts.ratio) || 4;
    const out = outChain(session, ev.inst === 'shimmer' ? 'shimmer' : 'bell', ev.pan, 1);

    const car = ctx.createOscillator(); car.type = 'sine'; car.frequency.value = freq;
    const mod = ctx.createOscillator(); mod.type = 'sine'; mod.frequency.value = freq * ratio;
    const modGain = gainNode(ctx, freq * ((ev.opts && ev.opts.index) || 1.6));
    mod.connect(modGain); modGain.connect(car.frequency);
    car.connect(out);

    const partial = ctx.createOscillator(); partial.type = 'sine'; partial.frequency.value = freq * 2.76;
    const pg = gainNode(ctx, 0.08 * vel);
    partial.connect(pg); pg.connect(out);

    const peak = 0.25 * vel;
    out.gain.setValueAtTime(0, t);
    out.gain.linearRampToValueAtTime(peak, t + 0.004);
    out.gain.exponentialRampToValueAtTime(0.0001, t + decay);

    modGain.gain.setValueAtTime(freq * ((ev.opts && ev.opts.index) || 1.6), t);
    modGain.gain.exponentialRampToValueAtTime(freq * 0.025, t + decay * 0.55);
    pg.gain.setValueAtTime(0.08 * vel, t);
    pg.gain.exponentialRampToValueAtTime(0.0001, t + decay * 0.35);

    const end = t + decay + 0.06;
    car.start(t); mod.start(t); partial.start(t);
    car.stop(end); mod.stop(end); partial.stop(end);
  }

  function lead(session, ev, t) {
    const ctx = session.ctx;
    const freq = mtof(ev.midi);
    const vel = ev.vel == null ? 0.7 : ev.vel;
    const dur = Math.max(0.1, ev.dur || 0.4);
    const out = outChain(session, 'lead', ev.pan, 1);
    const lp = biquad(ctx, 'lowpass', 2300, 4.2);
    lp.connect(out);
    lp.frequency.setValueAtTime(clamp(900 + vel * 2800, 900, 7000), t);
    lp.frequency.exponentialRampToValueAtTime(850, t + 0.3);

    const o1 = ctx.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = freq; o1.detune.value = -6;
    const o2 = ctx.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = freq; o2.detune.value = 7;
    const o3 = ctx.createOscillator(); o3.type = 'square'; o3.frequency.value = freq * 0.5;
    const g1 = gainNode(ctx, 0.16), g2 = gainNode(ctx, 0.12), g3 = gainNode(ctx, 0.05);
    o1.connect(g1); g1.connect(lp);
    o2.connect(g2); g2.connect(lp);
    o3.connect(g3); g3.connect(lp);

    // little pitch scoop
    [o1, o2].forEach(function (o) {
      o.detune.setValueAtTime(28, t);
      o.detune.linearRampToValueAtTime(0, t + 0.045);
    });

    const lfo = ctx.createOscillator(); lfo.frequency.value = 5.4;
    const lg = gainNode(ctx, 0);
    lfo.connect(lg); lg.connect(o1.detune); lg.connect(o2.detune);
    lg.gain.setValueAtTime(0, t);
    lg.gain.linearRampToValueAtTime(7, t + 0.22);

    const peak = 0.24 * vel;
    out.gain.setValueAtTime(0, t);
    out.gain.linearRampToValueAtTime(peak, t + 0.012);
    out.gain.linearRampToValueAtTime(peak * 0.85, t + 0.12);
    out.gain.setValueAtTime(peak * 0.8, t + Math.max(0.14, dur));
    out.gain.linearRampToValueAtTime(0, t + dur + 0.13);

    const end = t + dur + 0.2;
    o1.start(t); o2.start(t); o3.start(t); lfo.start(t);
    o1.stop(end); o2.stop(end); o3.stop(end); lfo.stop(end);
  }

  function arp(session, ev, t) {
    const ctx = session.ctx;
    const freq = mtof(ev.midi);
    const vel = ev.vel == null ? 0.5 : ev.vel;
    const dur = Math.max(0.06, ev.dur || 0.12);
    const out = outChain(session, 'arp', ev.pan, 1);
    const lp = biquad(ctx, 'lowpass', 2600, 6.5);
    lp.connect(out);
    lp.frequency.setValueAtTime(clamp(2200 + vel * 4200, 800, 9000), t);
    lp.frequency.exponentialRampToValueAtTime(620, t + 0.12);

    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = freq;
    const o2 = ctx.createOscillator(); o2.type = 'square'; o2.frequency.value = freq * 2; o2.detune.value = 3;
    const g1 = gainNode(ctx, 0.15), g2 = gainNode(ctx, 0.03);
    o.connect(g1); g1.connect(lp);
    o2.connect(g2); g2.connect(lp);

    const peak = 0.3 * vel;
    out.gain.setValueAtTime(0, t);
    out.gain.linearRampToValueAtTime(peak, t + 0.003);
    out.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.05);

    const end = t + dur + 0.07;
    o.start(t); o2.start(t); o.stop(end); o2.stop(end);
  }

  function kick(session, ev, t) {
    const ctx = session.ctx;
    const vel = ev.vel == null ? 0.9 : ev.vel;
    const out = outChain(session, 'kick', 0, 1);
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(152, t);
    o.frequency.exponentialRampToValueAtTime(46, t + 0.085);
    const g = gainNode(ctx, 0);
    o.connect(g); g.connect(out);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vel * 0.85, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + (ev.opts && ev.opts.len ? ev.opts.len : 0.38));
    o.start(t); o.stop(t + 0.5);

    const nz = noiseSource(session, t, 0.028);
    const hp = biquad(ctx, 'highpass', 1800, 0.7);
    const ng = gainNode(ctx, 0.12 * vel);
    nz.connect(hp); hp.connect(ng); ng.connect(out);
  }

  function snare(session, ev, t) {
    const ctx = session.ctx;
    const vel = ev.vel == null ? 0.6 : ev.vel;
    const out = outChain(session, 'snare', ev.pan || 0, 1);
    const nz = noiseSource(session, t, 0.24);
    const bp = biquad(ctx, 'bandpass', 1850, 0.65);
    const ng = gainNode(ctx, 0);
    nz.connect(bp); bp.connect(ng); ng.connect(out);
    ng.gain.setValueAtTime(0, t);
    ng.gain.linearRampToValueAtTime(vel * 0.5, t + 0.002);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);

    const body = ctx.createOscillator(); body.type = 'triangle'; body.frequency.value = 186;
    const bg = gainNode(ctx, 0);
    body.connect(bg); bg.connect(out);
    bg.gain.setValueAtTime(0, t);
    bg.gain.linearRampToValueAtTime(vel * 0.18, t + 0.003);
    bg.gain.exponentialRampToValueAtTime(0.0001, t + 0.11);
    body.start(t); body.stop(t + 0.15);
  }

  function clap(session, ev, t) {
    const ctx = session.ctx;
    const vel = ev.vel == null ? 0.55 : ev.vel;
    const out = outChain(session, 'snare', ev.pan || 0, 1);
    for (let i = 0; i < 3; i++) {
      const at = t + i * 0.0105;
      const nz = noiseSource(session, at, 0.035);
      const bp = biquad(ctx, 'bandpass', 1150 + i * 140, 1.1);
      const g = gainNode(ctx, 0);
      nz.connect(bp); bp.connect(g); g.connect(out);
      g.gain.setValueAtTime(0, at);
      g.gain.linearRampToValueAtTime(vel * 0.28, at + 0.001);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.028);
    }
    const tail = noiseSource(session, t + 0.03, 0.2);
    const bp2 = biquad(ctx, 'bandpass', 1250, 1.4);
    const g2 = gainNode(ctx, 0);
    tail.connect(bp2); bp2.connect(g2); g2.connect(out);
    g2.gain.setValueAtTime(0, t + 0.03);
    g2.gain.linearRampToValueAtTime(vel * 0.13, t + 0.036);
    g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
  }

  function hat(session, ev, t) {
    const ctx = session.ctx;
    const vel = ev.vel == null ? 0.35 : ev.vel;
    const open = !!(ev.opts && ev.opts.open);
    const out = outChain(session, 'hats', ev.pan || 0, 1);
    const nz = noiseSource(session, t, open ? 0.32 : 0.075);
    const hp = biquad(ctx, 'highpass', open ? 6200 : 7600, 0.7);
    const g = gainNode(ctx, 0);
    nz.connect(hp); hp.connect(g); g.connect(out);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vel * 0.24, t + 0.0015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + (open ? 0.28 : 0.052));
  }

  function shaker(session, ev, t) {
    const ctx = session.ctx;
    const vel = ev.vel == null ? 0.3 : ev.vel;
    const out = outChain(session, 'shaker', ev.pan || 0, 1);
    const nz = noiseSource(session, t, 0.13);
    const bp = biquad(ctx, 'bandpass', 5200, 0.9);
    const g = gainNode(ctx, 0);
    nz.connect(bp); bp.connect(g); g.connect(out);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vel * 0.2, t + 0.014);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.105);
  }

  function tamb(session, ev, t) {
    const ctx = session.ctx;
    const vel = ev.vel == null ? 0.3 : ev.vel;
    const out = outChain(session, 'tamb', ev.pan || 0, 1);
    const nz = noiseSource(session, t, 0.2);
    const hp = biquad(ctx, 'highpass', 5200, 0.6);
    const g = gainNode(ctx, 0);
    nz.connect(hp); hp.connect(g); g.connect(out);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vel * 0.16, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
  }

  function drum(session, ev, t) {
    const ctx = session.ctx;
    const vel = ev.vel == null ? 0.5 : ev.vel;
    const out = outChain(session, 'drum', ev.pan || 0, 1);
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(112, t);
    o.frequency.exponentialRampToValueAtTime(52, t + 0.22);
    const g = gainNode(ctx, 0);
    o.connect(g); g.connect(out);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vel * 0.55, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
    o.start(t); o.stop(t + 0.6);

    const nz = noiseSource(session, t, 0.12);
    const lp = biquad(ctx, 'lowpass', 900, 0.7);
    const ng = gainNode(ctx, 0.1 * vel);
    nz.connect(lp); lp.connect(ng); ng.connect(out);
  }

  function bird(session, ev, t) {
    const ctx = session.ctx;
    const vel = ev.vel == null ? 0.25 : ev.vel;
    const rng = mulberry32(ev.seed || 7);
    const chirps = 3 + Math.floor(rng() * 3);
    const out = outChain(session, 'birds', ev.pan || 0, 1);
    const base = (ev.opts && ev.opts.base) || 2600 + rng() * 900;

    for (let i = 0; i < chirps; i++) {
      const at = t + i * (0.07 + rng() * 0.06);
      const o = ctx.createOscillator(); o.type = 'sine';
      const f0 = base * (0.92 + rng() * 0.2);
      o.frequency.setValueAtTime(f0, at);
      o.frequency.exponentialRampToValueAtTime(f0 * (1.18 + rng() * 0.25), at + 0.028);
      o.frequency.exponentialRampToValueAtTime(f0 * 0.95, at + 0.062);
      const g = gainNode(ctx, 0);
      const p = stereoPanner(ctx, (rng() * 2 - 1) * 0.8);
      o.connect(g); g.connect(p); p.connect(out);
      g.gain.setValueAtTime(0, at);
      g.gain.linearRampToValueAtTime(vel * 0.18, at + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.07);
      o.start(at); o.stop(at + 0.1);
    }
  }

  function wind(session, ev, t) {
    const ctx = session.ctx;
    const dur = Math.max(1, ev.dur || 8);
    const vel = ev.vel == null ? 0.3 : ev.vel;
    const out = outChain(session, 'wind', ev.pan || 0, 1);
    const nz = noiseSource(session, t, dur, true);
    const lp = biquad(ctx, 'lowpass', 430, 0.8);
    const g = gainNode(ctx, 0);
    nz.connect(lp); lp.connect(g); g.connect(out);

    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.075;
    const lg = gainNode(ctx, 180);
    lfo.connect(lg); lg.connect(lp.frequency);
    lfo.start(t); lfo.stop(t + dur + 0.2);

    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vel * 0.32, t + Math.min(4, dur * 0.3));
    g.gain.setValueAtTime(vel * 0.32, t + dur * 0.72);
    g.gain.linearRampToValueAtTime(0, t + dur);
  }

  function riser(session, ev, t) {
    const ctx = session.ctx;
    const dur = Math.max(0.5, ev.dur || 4);
    const vel = ev.vel == null ? 0.6 : ev.vel;
    const out = outChain(session, 'fx', 0, 1);
    const nz = noiseSource(session, t, dur + 0.1, true);
    const bp = biquad(ctx, 'bandpass', 280, 1.6);
    const g = gainNode(ctx, 0);
    nz.connect(bp); bp.connect(g); g.connect(out);
    bp.frequency.setValueAtTime(280, t);
    bp.frequency.exponentialRampToValueAtTime(7800, t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vel * 0.32, t + dur * 0.92);
    g.gain.linearRampToValueAtTime(0, t + dur + 0.04);

    const p = stereoPanner(ctx, -0.7);
    out.disconnect();
    out.connect(p); p.connect(session.getChannel('fx').input);
    p.pan.setValueAtTime(-0.75, t);
    p.pan.linearRampToValueAtTime(0.75, t + dur);
  }

  function impact(session, ev, t) {
    const ctx = session.ctx;
    const vel = ev.vel == null ? 0.8 : ev.vel;
    const out = outChain(session, 'fx', 0, 1);
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(76, t);
    o.frequency.exponentialRampToValueAtTime(29, t + 1.2);
    const g = gainNode(ctx, 0);
    o.connect(g); g.connect(out);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vel * 0.55, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
    o.start(t); o.stop(t + 1.7);

    const nz = noiseSource(session, t, 0.45);
    const lp = biquad(ctx, 'lowpass', 700, 0.8);
    const ng = gainNode(ctx, 0);
    nz.connect(lp); lp.connect(ng); ng.connect(out);
    ng.gain.setValueAtTime(0, t);
    ng.gain.linearRampToValueAtTime(vel * 0.22, t + 0.004);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
  }

  function glitch(session, ev, t) {
    const ctx = session.ctx;
    const rng = mulberry32(ev.seed || 11);
    const out = outChain(session, 'fx', 0, 1);
    const n = 4 + Math.floor(rng() * 5);
    for (let i = 0; i < n; i++) {
      const at = t + rng() * (ev.dur || 0.5);
      const dur = 0.018 + rng() * 0.05;
      const nz = noiseSource(session, at, dur);
      const bp = biquad(ctx, 'bandpass', 1400 + rng() * 6000, 2 + rng() * 5);
      const g = gainNode(ctx, 0);
      const p = stereoPanner(ctx, (rng() * 2 - 1) * 0.9);
      nz.connect(bp); bp.connect(g); g.connect(p); p.connect(out);
      g.gain.setValueAtTime(0, at);
      g.gain.linearRampToValueAtTime(0.05 + rng() * 0.07, at + 0.002);
      g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    }
  }

  const INSTRUMENTS = {
    guitar: pluck,
    harp: pluck,
    pluck: pluck,
    flute: flute,
    strings: strings,
    pad: strings,
    choir: choir,
    upright: upright,
    synthbass: synthbass,
    bell: bell,
    lead: lead,
    arp: arp,
    kick: kick,
    snare: snare,
    clap: clap,
    hat: hat,
    shaker: shaker,
    tamb: tamb,
    drum: drum,
    bird: bird,
    wind: wind,
    riser: riser,
    impact: impact,
    glitch: glitch
  };

  /* -------------------------------------------------------------- rendering */

  function audioBufferToWav(buffer) {
    const numCh = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const numFrames = buffer.length;
    const bytesPerSample = 2;
    const blockAlign = numCh * bytesPerSample;
    const dataSize = numFrames * blockAlign;
    const arr = new ArrayBuffer(44 + dataSize);
    const view = new DataView(arr);
    let p = 0;
    const writeStr = (s) => { for (let i = 0; i < s.length; i++) view.setUint8(p++, s.charCodeAt(i)); };
    const writeU32 = (v) => { view.setUint32(p, v, true); p += 4; };
    const writeU16 = (v) => { view.setUint16(p, v, true); p += 2; };

    writeStr('RIFF'); writeU32(36 + dataSize); writeStr('WAVE');
    writeStr('fmt '); writeU32(16); writeU16(1); writeU16(numCh);
    writeU32(sampleRate); writeU32(sampleRate * blockAlign);
    writeU16(blockAlign); writeU16(16);
    writeStr('data'); writeU32(dataSize);

    const chans = [];
    for (let c = 0; c < numCh; c++) chans.push(buffer.getChannelData(c));
    for (let i = 0; i < numFrames; i++) {
      for (let c = 0; c < numCh; c++) {
        let s = chans[c][i];
        s = clamp(s, -1, 1);
        view.setInt16(p, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
        p += 2;
      }
    }
    return arr;
  }

  async function renderMovementToBuffer(movement, opts) {
    opts = opts || {};
    const sr = opts.sampleRate || 44100;
    const tail = opts.tail == null ? 3.2 : opts.tail;
    const t0 = 0.18;
    const Offline = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!Offline) throw new Error('当前浏览器不支持 OfflineAudioContext');
    const seconds = t0 + movement.duration + tail;
    const ctx = new Offline(2, Math.ceil(seconds * sr), sr);
    const session = new Session(ctx, movement, t0, ctx.destination, { offline: true });
    session.scheduleAll();
    const buffer = await ctx.startRendering();
    return { buffer, session, seconds };
  }

  function collectPluckWork(movement) {
    const seen = new Set();
    const work = [];
    for (let i = 0; i < movement.events.length; i++) {
      const ev = movement.events[i];
      if (ev.inst !== 'guitar' && ev.inst !== 'harp' && ev.inst !== 'pluck') continue;
      const style = (ev.opts && ev.opts.style) || (ev.inst === 'harp' ? 'harp' : 'guitar');
      const key = style + ':' + mtof(ev.midi).toFixed(2);
      if (seen.has(key)) continue;
      seen.add(key);
      work.push({ freq: mtof(ev.midi), style });
    }
    return work;
  }

  async function warmUp(movement, onProgress) {
    const work = collectPluckWork(movement);
    let done = 0;
    for (let i = 0; i < work.length; i++) {
      const w = work[i];
      const key = w.style + ':' + w.freq.toFixed(2);
      if (!PLUCK_CACHE.has(key)) getPluckBuffer(w.freq, w.style);
      done++;
      if (onProgress) onProgress(done / work.length);
      if (i % 5 === 4) await new Promise((r) => setTimeout(r, 0));
    }
  }

  NS.audio = {
    Session,
    mtof,
    parseNote,
    getPluckBuffer,
    renderMovementToBuffer,
    audioBufferToWav,
    warmUp,
    collectPluckWork,
    PLUCK_CACHE
  };
})();
