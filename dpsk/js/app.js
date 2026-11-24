/* =========================================================================
   三幕音景 · interface, transport and visuals
   ========================================================================= */
(function () {
  'use strict';

  const NS = window.Soundscape;
  if (!NS || !NS.movements) return;

  const MOVES = NS.movements;
  const ROMAN = ['I', 'II', 'III'];
  const $ = (s) => document.querySelector(s);
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const stageCount = $('#stageCount');
  const stageTabs = $('#stageTabs');
  const stageTag = $('#stageTag');
  const stageTitle = $('#stageTitle');
  const stageEn = $('#stageEn');
  const stageDesc = $('#stageDesc');
  const stageChips = $('#stageChips');
  const tracksEl = $('#tracks');
  const playBtn = $('#playBtn');
  const playIcon = $('#playIcon');
  const timeLabel = $('#timeLabel');
  const progressFill = $('#progressFill');
  const progressDot = $('#progressDot');
  const progressEl = document.querySelector('.progress');
  const volumeEl = $('#volume');
  const exportBtn = $('#exportBtn');
  const allBtn = $('#allBtn');
  const liveDot = $('#liveDot');
  const liveLabel = $('#liveLabel');
  const toastEl = $('#toast');
  const loadingEl = $('#loading');
  const loadingText = $('#loadingText');
  const loadingSub = $('#loadingSub');
  const announceEl = $('#announce');
  const aboutModal = $('#aboutModal');
  const closeAbout = $('#closeAbout');
  const aboutBtn = $('#aboutBtn');

  let audioCtx = null;
  let session = null;
  let current = 0;
  let status = 'idle'; // idle | playing | paused
  let playAll = false;
  let startedAt = 0;
  let ending = false;
  let playToken = 0;
  let autoTimer = null;
  let exporting = false;
  let volume = 1.0;
  let toastTimer = null;
  let lastFocus = null;

  try {
    const saved = window.localStorage.getItem('soundscape-volume');
    if (saved != null) volume = clamp(parseFloat(saved), 0, 1);
  } catch (e) { /* private mode */ }

  /* --------------------------------------------------------------- helpers */

  function fmt(sec) {
    sec = Math.max(0, Math.floor(sec || 0));
    return String(Math.floor(sec / 60)).padStart(2, '0') + ':' + String(sec % 60).padStart(2, '0');
  }

  function announce(text) {
    announceEl.textContent = text;
  }

  function toast(text) {
    toastEl.textContent = text;
    toastEl.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2800);
  }

  function showLoading(text, sub) {
    loadingText.textContent = text || '正在合成…';
    loadingSub.textContent = sub || '所有声音都在本地生成。';
    loadingEl.hidden = false;
    document.body.setAttribute('aria-busy', 'true');
  }

  function hideLoading() {
    loadingEl.hidden = true;
    document.body.removeAttribute('aria-busy');
  }

  function setLive(text, on) {
    liveLabel.textContent = text;
    liveDot.classList.toggle('on', !!on);
  }

  function setPlayAll(on) {
    playAll = !!on;
    allBtn.classList.toggle('on', playAll);
    allBtn.textContent = playAll ? '停止连播' : '连续播放';
    allBtn.setAttribute('aria-pressed', playAll ? 'true' : 'false');
  }

  function updatePlayIcon() {
    if (status === 'playing') {
      playIcon.innerHTML = '<rect x="5" y="3.5" width="3.4" height="13" rx="1" fill="currentColor"/><rect x="11.6" y="3.5" width="3.4" height="13" rx="1" fill="currentColor"/>';
      playBtn.setAttribute('aria-label', '暂停');
    } else {
      playIcon.innerHTML = '<path d="M6 3.5 16 10 6 16.5Z" fill="currentColor"/>';
      playBtn.setAttribute('aria-label', status === 'paused' ? '继续播放' : '播放');
    }
    document.body.classList.toggle('is-playing', status === 'playing');
    document.body.classList.toggle('is-paused', status === 'paused');
  }

  function updateCards() {
    document.querySelectorAll('.track').forEach((el, i) => {
      el.classList.toggle('active', i === current);
      const label = el.querySelector('.cta-text');
      if (label) {
        label.textContent = i === current
          ? (status === 'playing' ? '正在播放' : status === 'paused' ? '已暂停' : '点击播放')
          : '点击播放';
      }
    });
  }

  function setActive(index, opts) {
    current = clamp(index, 0, MOVES.length - 1);
    const m = MOVES[current];
    document.body.style.setProperty('--accent', m.color);
    document.body.style.setProperty('--accent-2', m.color2);

    stageCount.textContent = ROMAN[current] + ' / III';
    stageTag.textContent = m.tag;
    stageTitle.textContent = m.zh;
    stageEn.textContent = m.en;
    stageDesc.textContent = m.desc;
    stageTabs.querySelectorAll('button').forEach((b, i) => {
      b.classList.toggle('on', i === current);
      b.setAttribute('aria-selected', i === current ? 'true' : 'false');
    });
    stageChips.innerHTML =
      '<span>' + m.key + '</span>' +
      '<span>' + m.meter + '</span>' +
      '<span>' + m.bpm + ' BPM</span>' +
      '<span>' + fmt(m.duration) + '</span>';

    if (opts && opts.resetTime) {
      timeLabel.innerHTML = '00:00 <span>/ ' + fmt(m.duration) + '</span>';
      progressFill.style.width = '0%';
      progressDot.style.left = '0%';
      progressEl.setAttribute('aria-valuenow', '0');
    }
    updateCards();
    document.title = m.zh + ' · 三幕音景';
  }

  function updateTime(elapsed) {
    const m = MOVES[current];
    const shown = clamp(elapsed, 0, m.duration);
    const pct = m.duration > 0 ? (shown / m.duration) * 100 : 0;
    progressFill.style.width = pct.toFixed(2) + '%';
    progressDot.style.left = pct.toFixed(2) + '%';
    progressEl.setAttribute('aria-valuenow', String(Math.round(pct)));
    timeLabel.innerHTML = fmt(shown) + ' <span>/ ' + fmt(m.duration) + '</span>';
  }

  function resetProgress() {
    updateTime(0);
  }

  /* ----------------------------------------------------------------- audio */

  function ensureContext() {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) throw new Error('此浏览器不支持 Web Audio API');
      audioCtx = new AC({ latencyHint: 'interactive' });
    }
    return audioCtx;
  }

  async function resumeContext() {
    if (audioCtx && audioCtx.state === 'suspended') {
      try { await audioCtx.resume(); } catch (e) { /* gesture may be required */ }
    }
  }

  function clearSession(fade) {
    if (session) {
      session.stop(fade == null ? 0.12 : fade);
      session = null;
    }
  }

  function pendingPluckWork(m) {
    return NS.audio.collectPluckWork(m).filter((w) => {
      return !NS.audio.PLUCK_CACHE.has(w.style + ':' + w.freq.toFixed(2));
    });
  }

  async function prepareMovement(m) {
    const work = pendingPluckWork(m);
    if (!work.length) return;
    showLoading('正在调音…', '首次播放需要预先计算拨弦音色，请稍等。');
    await new Promise((r) => setTimeout(r, 40));
    let pct = 0;
    await NS.audio.warmUp(m, (p) => {
      pct = p;
      loadingSub.textContent = '拨弦音色 ' + Math.round(p * 100) + '%';
    });
    hideLoading();
  }

  async function startPlayback(index, opts) {
    opts = opts || {};
    const token = ++playToken;
    if (autoTimer) { clearTimeout(autoTimer); autoTimer = null; }
    if (!opts.keepAll) setPlayAll(false);

    try {
      ensureContext();
      await resumeContext();
      const m = MOVES[index];

      await prepareMovement(m);
      if (token !== playToken) return;

      clearSession(0.1);
      ending = false;
      const t0 = audioCtx.currentTime + 0.22;
      session = new NS.audio.Session(audioCtx, m, t0, audioCtx.destination, { volume: volume });
      session.startLive();

      startedAt = t0;
      status = 'playing';
      setActive(index, { resetTime: true });
      setLive('LIVE', true);
      updatePlayIcon();
      resetProgress();
      announce('正在播放：' + m.zh);
    } catch (err) {
      console.error(err);
      hideLoading();
      toast(err && err.message ? err.message : '无法开始播放');
      status = 'idle';
      updatePlayIcon();
    }
  }

  async function resumePlayback() {
    if (!audioCtx || !session || status !== 'paused') return;
    status = 'playing';
    updatePlayIcon();
    updateCards();
    setLive('LIVE', true);
    try { await audioCtx.resume(); } catch (e) { /* noop */ }
    announce('继续播放');
  }

  async function togglePlayback() {
    if (status === 'playing') {
      status = 'paused';
      updatePlayIcon();
      updateCards();
      setLive('PAUSED', false);
      try { await audioCtx.suspend(); } catch (e) { /* noop */ }
      announce('已暂停');
    } else if (status === 'paused') {
      await resumePlayback();
    } else {
      await startPlayback(current);
    }
  }

  function finishPlayback(opts) {
    opts = opts || {};
    playToken++;
    if (autoTimer) { clearTimeout(autoTimer); autoTimer = null; }
    clearSession(0.25);
    status = 'idle';
    ending = false;
    updatePlayIcon();
    updateCards();
    setLive('READY', false);
    updateTime(0);
    if (!opts.keepAllButton) setPlayAll(false);
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
  }

  function stopPlayback() {
    finishPlayback({});
    announce('已停止');
  }

  function handleTrackEnd() {
    if (ending) return;
    ending = true;
    const wasAll = playAll;
    if (wasAll && current < MOVES.length - 1) {
      const next = current + 1;
      setLive('NEXT', false);
      clearSession(0.45);
      status = 'idle';
      updatePlayIcon();
      updateCards();
      updateTime(MOVES[current].duration);
      autoTimer = setTimeout(() => {
        autoTimer = null;
        if (playAll) startPlayback(next, { keepAll: true });
      }, 950);
      announce('下一乐章');
    } else {
      finishPlayback({ keepAllButton: !wasAll });
      setPlayAll(false);
      if (wasAll) toast('三个乐章播放完毕');
      announce('播放结束');
    }
  }

  function updateTransport() {
    if (!audioCtx || status === 'idle') {
      if (status === 'idle' && !session) updateTime(0);
      return;
    }
    const m = MOVES[current];
    const elapsed = Math.max(0, audioCtx.currentTime - startedAt);
    updateTime(elapsed);
    if (status === 'playing' && elapsed >= m.duration - 0.18) {
      handleTrackEnd();
    }
  }

  function applyVolume() {
    if (session && audioCtx) {
      const m = MOVES[current];
      const now = audioCtx.currentTime;
      const g = session.master.gain;
      try {
        g.cancelScheduledValues(now);
        g.setTargetAtTime(m.level * volume, now, 0.06);
      } catch (e) { /* noop */ }
    }
  }

  async function exportWav() {
    if (exporting) return;
    exporting = true;
    const m = MOVES[current];
    const wasPlaying = status === 'playing';
    if (wasPlaying) await togglePlayback();
    showLoading('正在离线渲染…', '渲染约需 20–45 秒，请让页面保持在前台。');
    await new Promise((r) => setTimeout(r, 80));
    try {
      await NS.audio.warmUp(m);
      const result = await NS.audio.renderMovementToBuffer(m, { tail: 0.35 });
      const wav = NS.audio.audioBufferToWav(result.buffer);
      const blob = new Blob([wav], { type: 'audio/wav' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const slugs = ['morning-fields', 'lanterns-of-elfhame', 'neon-vector'];
      a.href = url;
      a.download = 'three-soundscapes-' + ROMAN[current] + '-' + slugs[current] + '.wav';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 12000);
      toast('WAV 已导出 · ' + m.zh);
    } catch (err) {
      console.error(err);
      toast('导出失败：' + (err.message || err));
    } finally {
      hideLoading();
      exporting = false;
      if (wasPlaying) await resumePlayback();
    }
  }

  /* ----------------------------------------------------------------- cards */

  function renderTracks() {
    const arrow = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2 6h8M6.5 2.5 10 6l-3.5 3.5" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    tracksEl.innerHTML = MOVES.map((m, i) => {
      return '<article class="track" data-index="' + i + '" tabindex="0" role="button" aria-label="播放 ' + m.zh + '" style="--c1:' + m.color + ';--c2:' + m.color2 + '">' +
        '<div class="track-top"><span class="track-no">' + ROMAN[i] + '</span><span class="track-dur">' + fmt(m.duration) + '</span></div>' +
        '<div class="track-tag">' + m.tag + '</div>' +
        '<h3>' + m.zh + '<span>' + m.en + '</span></h3>' +
        '<p>' + m.desc + '</p>' +
        '<div class="track-chips"><span>' + m.key + '</span><span>' + m.meter + '</span><span>' + m.bpm + ' BPM</span></div>' +
        '<div class="track-foot"><span class="track-cta"><span class="mini-eq"><i></i><i></i><i></i><i></i></span><span class="cta-text">点击播放</span></span><span class="track-go">' + arrow + '</span></div>' +
        '</article>';
    }).join('');
  }

  function activateCard(index) {
    if (index === current && (status === 'playing' || status === 'paused')) {
      togglePlayback();
    } else if (index === current && status === 'idle') {
      startPlayback(index);
    } else {
      startPlayback(index);
    }
  }

  function bind() {
    playBtn.addEventListener('click', () => togglePlayback());

    stageTabs.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      const idx = Number(btn.dataset.index);
      if (idx === current) {
        if (status === 'paused') togglePlayback();
        else if (status === 'idle') startPlayback(idx);
        return;
      }
      startPlayback(idx);
    });

    tracksEl.addEventListener('click', (e) => {
      const card = e.target.closest('.track');
      if (!card) return;
      activateCard(Number(card.dataset.index));
    });

    tracksEl.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const card = e.target.closest('.track');
      if (!card) return;
      e.preventDefault();
      activateCard(Number(card.dataset.index));
    });

    allBtn.addEventListener('click', async () => {
      if (playAll) {
        stopPlayback();
        toast('已停止连播');
        return;
      }
      setPlayAll(true);
      if (status === 'playing' || status === 'paused') {
        // continue from the current movement
        await startPlayback(current, { keepAll: true });
      } else {
        await startPlayback(0, { keepAll: true });
      }
    });

    volumeEl.addEventListener('input', () => {
      volume = clamp(Number(volumeEl.value) / 100, 0, 1);
      volumeEl.style.setProperty('--vol', (volume * 100).toFixed(0) + '%');
      try { window.localStorage.setItem('soundscape-volume', String(volume)); } catch (e) { /* noop */ }
      applyVolume();
    });

    exportBtn.addEventListener('click', exportWav);

    aboutBtn.addEventListener('click', openAbout);
    closeAbout.addEventListener('click', closeAboutModal);
    aboutModal.addEventListener('click', (e) => {
      if (e.target === aboutModal) closeAboutModal();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (!aboutModal.hidden) { closeAboutModal(); return; }
        if (status !== 'idle') stopPlayback();
        return;
      }
      const tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'BUTTON') return;
      if (e.code === 'Space') {
        e.preventDefault();
        togglePlayback();
      } else if (e.key === '1' || e.key === '2' || e.key === '3') {
        const idx = Number(e.key) - 1;
        startPlayback(idx);
      }
    });

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && session) session.pump();
    });

    window.addEventListener('beforeunload', () => {
      if (session) session.stop(0.05);
    });
  }

  /* --------------------------------------------------------------- dialogs */

  function openAbout() {
    lastFocus = document.activeElement;
    aboutModal.hidden = false;
    closeAbout.focus();
    document.body.style.overflow = 'hidden';
  }
  function closeAboutModal() {
    aboutModal.hidden = true;
    document.body.style.overflow = '';
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  /* -------------------------------------------------------------- visualiser */

  const canvas = document.getElementById('viz');
  const c2d = canvas.getContext('2d');
  let W = 0, H = 0, DPR = 1;
  let particles = [];
  let lastFrame = 0;
  let idleClock = 0;
  const E = { bass: 0, low: 0, mid: 0, high: 0, all: 0 };
  let freqBuf = null;
  let freqBufSize = 0;
  let starts = [];
  let skyline = [];

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.round(rect.width));
    const h = Math.max(1, Math.round(rect.height));
    const changed = W !== w || H !== h || canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr);
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    W = w; H = h; DPR = dpr;
    c2d.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (changed) makeParticles();
  }

  function makeParticles() {
    const rng = (seed) => {
      let a = seed >>> 0;
      return () => {
        a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    };

    const countryRng = rng(1234);
    particles[0] = Array.from({ length: 62 }, () => ({
      x: countryRng(), y: countryRng(), z: countryRng(),
      ph: countryRng() * Math.PI * 2
    }));

    const elfRng = rng(5678);
    particles[1] = Array.from({ length: 52 }, () => ({
      x: elfRng(), y: elfRng(), z: elfRng(),
      ph: elfRng() * Math.PI * 2, f: 0.5 + elfRng() * 1.5
    }));

    const sciRng = rng(9012);
    particles[2] = Array.from({ length: 48 }, () => ({
      x: sciRng(), y: sciRng(), z: sciRng(),
      ph: sciRng() * Math.PI * 2
    }));

    const grassRng = rng(3456);
    starts = Array.from({ length: 70 }, () => ({
      x: grassRng(), h: 0.35 + grassRng() * 0.65, lean: grassRng() * 2 - 1
    }));

    const cityRng = rng(24680);
    skyline = Array.from({ length: 64 }, () => 0.16 + cityRng() * 0.84);
  }

  function updateEnergy(dt) {
    const analyser = session && session.getAnalyser ? session.getAnalyser() : null;
    let tb = 0, tl = 0, tm = 0, th = 0;
    if (analyser) {
      if (!freqBuf || freqBufSize !== analyser.frequencyBinCount) {
        freqBuf = new Uint8Array(analyser.frequencyBinCount);
        freqBufSize = analyser.frequencyBinCount;
      }
      if (status === 'playing') analyser.getByteFrequencyData(freqBuf);
      const bins = freqBuf.length;
      const nyquist = (audioCtx ? audioCtx.sampleRate : 48000) / 2;
      const hz = nyquist / bins;
      const avg = (lo, hi) => {
        const a = Math.max(0, Math.floor(lo / hz));
        const b = Math.min(bins - 1, Math.floor(hi / hz));
        let s = 0, n = 0;
        for (let i = a; i <= b; i++) { s += freqBuf[i]; n++; }
        return n ? s / n / 255 : 0;
      };
      tb = avg(24, 100);
      tl = avg(100, 260);
      tm = avg(260, 1200);
      th = avg(1200, 6500);
    }
    const smooth = (a, b, k) => a + (b - a) * k;
    const k = status === 'playing' ? 0.18 : 0.05;
    E.bass = smooth(E.bass, tb, k);
    E.low = smooth(E.low, tl, k);
    E.mid = smooth(E.mid, tm, k);
    E.high = smooth(E.high, th, k);
    E.all = smooth(E.all, (tb + tl + tm + th) / 4, k);
    idleClock += dt;
  }

  function rgba(hex, a) {
    const h = hex.replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }

  function hill(yBase, amp, freq, phase, time, energy) {
    c2d.beginPath();
    c2d.moveTo(0, H);
    for (let x = 0; x <= W + 8; x += 10) {
      const y = yBase
        + Math.sin(x * freq + phase + time * 0.12) * amp
        + Math.sin(x * freq * 2.4 + phase * 1.7) * amp * 0.28
        - energy * Math.sin(x * 0.006 + phase) * 12;
      c2d.lineTo(x, y);
    }
    c2d.lineTo(W, H);
    c2d.closePath();
    c2d.fill();
  }

  function drawCountry(t) {
    const m = MOVES[0];
    const sky = c2d.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#1b2618');
    sky.addColorStop(0.5, '#151d12');
    sky.addColorStop(1, '#090c08');
    c2d.fillStyle = sky;
    c2d.fillRect(0, 0, W, H);

    // low sun
    const sx = W * 0.76, sy = H * 0.28, sr = Math.min(W, H) * 0.28;
    let g = c2d.createRadialGradient(sx, sy, 0, sx, sy, sr);
    g.addColorStop(0, rgba(m.color, 0.38 + E.high * 0.12));
    g.addColorStop(0.4, rgba(m.color, 0.13));
    g.addColorStop(1, rgba(m.color, 0));
    c2d.fillStyle = g;
    c2d.fillRect(0, 0, W, H);
    c2d.beginPath();
    c2d.arc(sx, sy, Math.min(W, H) * (0.085 + E.bass * 0.012), 0, Math.PI * 2);
    c2d.fillStyle = rgba(m.color, 0.72);
    c2d.fill();

    // drifting haze band
    g = c2d.createLinearGradient(0, H * 0.45, 0, H * 0.72);
    g.addColorStop(0, rgba(m.color, 0));
    g.addColorStop(0.55, rgba(m.color, 0.055 + E.mid * 0.03));
    g.addColorStop(1, rgba(m.color, 0));
    c2d.fillStyle = g;
    c2d.fillRect(0, H * 0.45, W, H * 0.27);

    // horizon warmth
    g = c2d.createLinearGradient(0, H * 0.5, 0, H * 0.7);
    g.addColorStop(0, rgba(m.color, 0));
    g.addColorStop(0.72, rgba(m.color, 0.06 + E.mid * 0.03));
    g.addColorStop(1, rgba(m.color, 0));
    c2d.fillStyle = g;
    c2d.fillRect(0, H * 0.5, W, H * 0.2);

    // three ridges
    c2d.fillStyle = 'rgba(79,94,52,' + (0.52 + E.low * 0.14) + ')';
    hill(H * 0.62, H * 0.035, 0.0048, 0.7, t, E.low);
    c2d.fillStyle = 'rgba(53,67,37,' + (0.78 + E.low * 0.1) + ')';
    hill(H * 0.72, H * 0.05, 0.0036, 2.1, t, E.low);
    c2d.fillStyle = 'rgba(28,37,21,0.96)';
    hill(H * 0.82, H * 0.03, 0.0062, 4.2, t, E.bass);

    // foreground grass
    c2d.strokeStyle = rgba(m.color, 0.16 + E.high * 0.12);
    c2d.lineWidth = 0.7;
    c2d.beginPath();
    for (let i = 0; i < starts.length; i++) {
      const s = starts[i];
      const x = s.x * W;
      const base = H * (0.86 + (s.x % 0.11));
      const hh = H * 0.12 * s.h;
      const sway = Math.sin(t * 0.9 + s.x * 19) * 5 * (0.4 + E.mid);
      c2d.moveTo(x, base);
      c2d.quadraticCurveTo(x + s.lean * 5, base - hh * 0.55, x + s.lean * 10 + sway, base - hh);
    }
    c2d.stroke();

    // pollen
    const ps = particles[0] || [];
    c2d.fillStyle = rgba(m.color, 0.7);
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i];
      const px = ((p.x + t * (0.003 + p.z * 0.006)) % 1.08 - 0.04) * W;
      const py = ((p.y - t * (0.002 + p.z * 0.004)) % 1.1 + 1.1) % 1.1 * H;
      const a = 0.14 + 0.3 * Math.abs(Math.sin(t * 0.8 + p.ph)) + E.high * 0.2;
      c2d.globalAlpha = a;
      c2d.beginPath();
      c2d.arc(px, py, 0.7 + p.z * 1.3, 0, Math.PI * 2);
      c2d.fill();
    }
    c2d.globalAlpha = 1;
  }

  function drawElf(t) {
    const m = MOVES[1];
    const base = c2d.createLinearGradient(0, 0, 0, H);
    base.addColorStop(0, '#0a1118');
    base.addColorStop(0.55, '#0a0e12');
    base.addColorStop(1, '#06080a');
    c2d.fillStyle = base;
    c2d.fillRect(0, 0, W, H);

    // aurora glow
    let g = c2d.createRadialGradient(W * 0.58, H * 0.26, 0, W * 0.58, H * 0.26, W * 0.62);
    g.addColorStop(0, rgba(m.color, 0.16 + E.mid * 0.1));
    g.addColorStop(0.45, rgba(m.color2, 0.075));
    g.addColorStop(1, 'rgba(0,0,0,0)');
    c2d.fillStyle = g;
    c2d.fillRect(0, 0, W, H);

    // slow aurora ribbons
    for (let k = 0; k < 3; k++) {
      const startX = W * (0.18 + k * 0.26) + Math.sin(t * 0.11 + k) * 30;
      const grad = c2d.createLinearGradient(startX, 0, startX + 120, H);
      grad.addColorStop(0, rgba(k % 2 ? m.color2 : m.color, 0));
      grad.addColorStop(0.45, rgba(k % 2 ? m.color2 : m.color, 0.055 + E.high * 0.03));
      grad.addColorStop(1, rgba(k % 2 ? m.color2 : m.color, 0));
      c2d.fillStyle = grad;
      c2d.beginPath();
      c2d.moveTo(startX - 70, 0);
      for (let y = 0; y <= H; y += 18) {
        c2d.lineTo(startX + Math.sin(y * 0.008 + t * 0.25 + k * 1.3) * 35 - 70, y);
      }
      c2d.lineTo(startX + 70, 0);
      c2d.closePath();
      c2d.fill();
    }

    // moon
    const mx = W * 0.73, my = H * 0.24, mr = Math.min(W, H) * 0.055;
    g = c2d.createRadialGradient(mx, my, 0, mx, my, mr * 3.2);
    g.addColorStop(0, rgba(m.color, 0.26));
    g.addColorStop(0.32, rgba(m.color, 0.1));
    g.addColorStop(1, rgba(m.color, 0));
    c2d.fillStyle = g;
    c2d.beginPath();
    c2d.arc(mx, my, mr * 3.2, 0, Math.PI * 2);
    c2d.fill();
    c2d.beginPath();
    c2d.arc(mx, my, mr, 0, Math.PI * 2);
    c2d.fillStyle = 'rgba(210,245,232,.55)';
    c2d.fill();

    // water ripples
    const cx = W * 0.5, cy = H * 0.79;
    c2d.save();
    c2d.translate(cx, cy);
    c2d.scale(1, 0.24);
    for (let k = 0; k < 6; k++) {
      const phase = (t * 0.07 + k / 6) % 1;
      const r = phase * W * 0.7;
      c2d.beginPath();
      c2d.arc(0, 0, r, 0, Math.PI * 2);
      c2d.strokeStyle = rgba(m.color, (1 - phase) * (0.16 + E.mid * 0.12));
      c2d.lineWidth = 1.1;
      c2d.stroke();
    }
    c2d.restore();

    // fireflies
    const ps = particles[1] || [];
    const pts = [];
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i];
      const px = (p.x + Math.sin(t * 0.13 * p.f + p.ph) * 0.035) * W;
      const py = (p.y + Math.cos(t * 0.1 * p.f + p.ph * 1.4) * 0.045) * H;
      const tw = 0.35 + 0.65 * Math.abs(Math.sin(t * 0.9 * p.f + p.ph));
      const rad = 1 + p.z * 2.2;
      pts.push([px, py]);
      c2d.globalAlpha = (0.16 + tw * 0.54) * (0.55 + E.high * 0.7);
      c2d.fillStyle = i % 5 === 0 ? rgba(m.color2, 0.9) : rgba(m.color, 0.9);
      c2d.beginPath();
      c2d.arc(px, py, rad, 0, Math.PI * 2);
      c2d.fill();
      c2d.globalAlpha = 0.1;
      c2d.beginPath();
      c2d.arc(px, py, rad * 4.5, 0, Math.PI * 2);
      c2d.fill();
    }
    c2d.globalAlpha = 1;

    // a few threads between nearby lights
    c2d.strokeStyle = rgba(m.color, 0.13);
    c2d.lineWidth = 0.6;
    let lines = 0;
    for (let i = 0; i < pts.length && lines < 22; i++) {
      for (let j = i + 1; j < pts.length && lines < 22; j++) {
        const dx = pts[i][0] - pts[j][0], dy = pts[i][1] - pts[j][1];
        if (dx * dx + dy * dy < 5000) {
          c2d.beginPath();
          c2d.moveTo(pts[i][0], pts[i][1]);
          c2d.lineTo(pts[j][0], pts[j][1]);
          c2d.stroke();
          lines++;
        }
      }
    }
  }

  function drawSciFi(t) {
    const m = MOVES[2];
    const base = c2d.createLinearGradient(0, 0, 0, H);
    base.addColorStop(0, '#05070c');
    base.addColorStop(0.58, '#080912');
    base.addColorStop(1, '#0a0710');
    c2d.fillStyle = base;
    c2d.fillRect(0, 0, W, H);

    const horizon = H * 0.66;
    const vx = W * 0.5, vy = H * 0.55;

    // horizon glow
    let g = c2d.createRadialGradient(vx, horizon, 0, vx, horizon, W * 0.55);
    g.addColorStop(0, rgba(m.color2, 0.18 + E.low * 0.08));
    g.addColorStop(0.4, rgba(m.color, 0.06));
    g.addColorStop(1, 'rgba(0,0,0,0)');
    c2d.fillStyle = g;
    c2d.fillRect(0, 0, W, H);

    // neon ring
    c2d.save();
    c2d.strokeStyle = rgba(m.color, 0.5);
    c2d.lineWidth = 1.2;
    c2d.beginPath();
    c2d.arc(vx, horizon, W * 0.07, Math.PI, Math.PI * 2);
    c2d.stroke();
    c2d.globalAlpha = 0.25;
    c2d.beginPath();
    c2d.arc(vx, horizon, W * 0.07 + 7 + E.bass * 16, Math.PI, Math.PI * 2);
    c2d.stroke();
    c2d.globalAlpha = 1;
    c2d.restore();

    // perspective grid
    c2d.save();
    c2d.strokeStyle = rgba(m.color, 0.14 + E.mid * 0.07);
    c2d.lineWidth = 0.7;
    for (let i = -14; i <= 14; i++) {
      c2d.beginPath();
      c2d.moveTo(vx + i * 7, vy);
      c2d.lineTo(vx + i * W * 0.16, H + 40);
      c2d.stroke();
    }
    const scroll = (t * 0.09) % 1;
    for (let k = 0; k < 18; k++) {
      const p = (k / 18 + scroll) % 1;
      const y = horizon + (H - horizon) * p * p * 1.05;
      c2d.globalAlpha = (0.07 + p * 0.16) * (0.7 + E.low * 0.7);
      c2d.beginPath();
      c2d.moveTo(0, y);
      c2d.lineTo(W, y);
      c2d.stroke();
    }
    c2d.globalAlpha = 1;
    c2d.restore();

    // skyline from spectrum (an invented city when idle)
    const analyser = session && session.getAnalyser ? session.getAnalyser() : null;
    const bars = 54;
    const step = analyser && freqBuf ? Math.max(1, Math.floor(freqBuf.length * 0.55 / bars)) : 1;
    for (let i = 0; i < bars; i++) {
      let v;
      if (analyser && freqBuf) {
        v = 0;
        for (let j = 0; j < step; j++) v += freqBuf[i * step + j];
        v /= step * 255;
      } else {
        const base = skyline[i % skyline.length];
        v = base * (0.55 + 0.45 * Math.abs(Math.sin(t * 0.35 + i * 0.9)));
      }
      const bh = 4 + v * H * 0.085 + E.mid * 3;
      const x = (i / bars) * W;
      const w = W / bars - 2;
      const grad = c2d.createLinearGradient(0, horizon - bh, 0, horizon);
      grad.addColorStop(0, rgba(i % 3 === 0 ? m.color2 : m.color, 0.5));
      grad.addColorStop(1, rgba(m.color, 0.02));
      c2d.fillStyle = grad;
      c2d.fillRect(x, horizon - bh, w, bh);
      c2d.fillStyle = rgba(i % 3 === 0 ? m.color2 : m.color, 0.7);
      c2d.fillRect(x, horizon - bh, w, 0.8);
    }

    // city reflection
    const refl = c2d.createLinearGradient(0, horizon, 0, horizon + H * 0.16);
    refl.addColorStop(0, rgba(m.color, 0.09 + E.low * 0.07));
    refl.addColorStop(1, rgba(m.color, 0));
    c2d.fillStyle = refl;
    c2d.fillRect(0, horizon, W, H * 0.16);

    // scanline
    const sy = H * (0.12 + ((t * 0.045) % 1) * 0.75);
    const sg = c2d.createLinearGradient(0, sy - 14, 0, sy + 14);
    sg.addColorStop(0, 'rgba(79,215,255,0)');
    sg.addColorStop(0.5, rgba(m.color, 0.09 + E.high * 0.05));
    sg.addColorStop(1, 'rgba(79,215,255,0)');
    c2d.fillStyle = sg;
    c2d.fillRect(0, sy - 14, W, 28);

    // data motes
    const ps = particles[2] || [];
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i];
      const px = p.x * W;
      const py = ((p.y - t * (0.008 + p.z * 0.016)) % 1 + 1) % 1 * H;
      c2d.globalAlpha = 0.1 + p.z * 0.4;
      c2d.fillStyle = i % 4 === 0 ? rgba(m.color2, 0.8) : rgba(m.color, 0.8);
      c2d.fillRect(px, py, 0.8 + p.z * 1.6, 0.8 + p.z * 1.6);
    }
    c2d.globalAlpha = 1;
  }

  function draw(ts) {
    if (!lastFrame) lastFrame = ts;
    const dt = Math.min(0.05, (ts - lastFrame) / 1000);
    lastFrame = ts;
    if (reduced) idleClock += dt / 3; else idleClock += dt;

    resizeCanvas();
    updateEnergy(dt);
    const t = idleClock;
    c2d.clearRect(0, 0, W, H);
    const id = MOVES[current] ? MOVES[current].id : 'country';
    if (id === 'elf') drawElf(t);
    else if (id === 'scifi') drawSciFi(t);
    else drawCountry(t);

    // vignette
    const v = c2d.createRadialGradient(W * 0.5, H * 0.4, Math.min(W, H) * 0.25, W * 0.5, H * 0.5, Math.max(W, H) * 0.72);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,0,0,.34)');
    c2d.fillStyle = v;
    c2d.fillRect(0, 0, W, H);

    requestAnimationFrame(draw);
  }

  /* ----------------------------------------------------------------- setup */

  function init() {
    renderTracks();
    setActive(0, { resetTime: true });
    setPlayAll(false);
    volumeEl.value = String(Math.round(volume * 100));
    volumeEl.style.setProperty('--vol', (volume * 100).toFixed(0) + '%');
    updatePlayIcon();
    bind();
    resizeCanvas();
    requestAnimationFrame(draw);
    setInterval(updateTransport, 200);
    announce('三幕音景已就绪');
    window.__ready = true;
  }

  window.__player = {
    play: startPlayback,
    stop: stopPlayback,
    toggle: togglePlayback,
    get status() { return status; },
    get current() { return current; },
    get session() { return session; },
    get elapsed() { return audioCtx ? audioCtx.currentTime - startedAt : 0; },
    select: function (i) { setActive(i, { resetTime: true }); }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
