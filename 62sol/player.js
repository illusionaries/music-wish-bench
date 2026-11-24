"use strict";

(() => {
  const element = id => document.getElementById(id);
  const canvas = element("score");
  const playhead = element("playhead");
  const play = element("play");
  const seek = element("seek");
  const repeat = element("repeat");
  const volume = element("volume");
  const status = element("status");
  const player = document.querySelector(".player");
  const barLabels = document.querySelectorAll(".bar-labels span");

  let selection = 0;
  let position = 0;
  let scrubPosition = null;
  let startedAt = 0;
  let state = "paused";
  let generation = 0;
  let audio;
  let output;
  let source;
  let frame;
  const cache = new Map();
  const current = () => scores[selection];
  const clockText = seconds => {
    const whole = Math.floor(seconds);
    return Math.floor(whole / 60) + ":" + String(whole % 60).padStart(2, "0");
  };

  const trackButtons = scores.map((score, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "track";
    button.style.setProperty("--card-accent", score.palette[0]);

    const swatch = document.createElement("span");
    swatch.className = "track-swatch";
    swatch.setAttribute("aria-hidden", "true");
    const name = document.createElement("span");
    const title = document.createElement("span");
    title.className = "track-title";
    title.textContent = score.title;
    const style = document.createElement("span");
    style.className = "track-style";
    style.textContent = score.style;
    const duration = document.createElement("span");
    duration.className = "track-length";
    duration.textContent = clockText(score.duration);

    name.append(title, style);
    button.append(swatch, name, duration);
    button.addEventListener("click", () => {
      if (selection !== index) {
        select(index);
        start();
      } else {
        toggle();
      }
    });

    element("tracks").append(button);
    return button;
  });

  function drawScore() {
    const score = current();
    const { width, height } = canvas.getBoundingClientRect();
    if (!width || !height) return;

    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    const pen = canvas.getContext("2d");
    pen.scale(ratio, ratio);

    const toX = time => width * time / score.duration;
    pen.fillStyle = "#222821";
    for (let i = 1; i < 8; i++) pen.fillRect(0, height * i / 8, width, 1);
    for (let bar = 0; bar <= 16; bar++) {
      const x = toX(score.barDuration * bar);
      pen.fillStyle = bar % 4 === 0 ? "#465044" : "#30382e";
      pen.fillRect(x, 0, 1, height);
      if (bar < 16 && bar % 4 === 0) barLabels[bar / 4].style.left = (x / width * 100) + "%";
    }

    const notes = score.events.filter(note => score.voices.includes(note.voice));
    const pitches = notes.map(note => note.pitch);
    const low = Math.min(...pitches) - 2;
    const high = Math.max(...pitches) + 2;
    const rows = Math.max(2.5, Math.min(4, height / (high - low)));

    // Draw accompaniment first so the melody stays visible where pitches overlap.
    for (const voice of [...score.voices].reverse()) {
      const layer = score.voices.indexOf(voice);
      pen.fillStyle = score.palette[layer];
      pen.globalAlpha = [0.98, 0.62, 0.77][layer];

      for (const note of notes) {
        if (note.voice !== voice) continue;
        const y = (high - note.pitch) / (high - low) * height;
        pen.fillRect(toX(note.time), y, Math.max(2, toX(note.length) - 1), rows);
      }
    }
  }

  function setStatus(message = "") {
    status.textContent = message;
    status.hidden = !message;
  }

  function setState(next) {
    state = next;
    play.dataset.state = next;
    const label = next === "playing" ? "暂停" : next === "loading" ? "取消合成" : "播放";
    play.setAttribute("aria-label", label);
    play.title = label;
    trackButtons.forEach((button, index) => {
      if (index === selection) button.dataset.state = next;
      else delete button.dataset.state;
    });
  }

  function elapsed() {
    if (state !== "playing") return position;
    return Math.min(current().duration, position + audio.currentTime - startedAt);
  }

  function showTime() {
    const time = scrubPosition ?? elapsed();
    element("elapsed").textContent = clockText(time);
    seek.value = time;
    seek.setAttribute("aria-valuetext", clockText(time) + " / " + clockText(current().duration));
    playhead.style.left = (time / current().duration) * 100 + "%";
  }

  function tick() {
    showTime();
    if (state === "playing") frame = requestAnimationFrame(tick);
  }

  function disconnect() {
    cancelAnimationFrame(frame);
    if (!source) return;
    source.onended = null;
    source.stop();
    source.disconnect();
    source = null;
  }

  function pause() {
    position = elapsed();
    scrubPosition = null;
    generation++;
    disconnect();
    setState("paused");
    setStatus();
    showTime();
  }

  function render(index) {
    if (!cache.has(index)) {
      cache.set(index, synthesize(scores[index]).catch(error => {
        cache.delete(index);
        throw error;
      }));
    }
    return cache.get(index);
  }

  async function start() {
    const index = selection;
    const ticket = ++generation;
    if (position >= current().duration - 0.015) position = 0;

    try {
      if (!audio) {
        const Audio = window.AudioContext || window.webkitAudioContext;
        if (!Audio || !(window.OfflineAudioContext || window.webkitOfflineAudioContext)) {
          setStatus("此浏览器不支持 Web Audio API。");
          return;
        }
        audio = new Audio();
        output = audio.createGain();
        output.gain.value = Number(volume.value);
        output.connect(audio.destination);
      }

      const resume = audio.resume();
      setState("loading");
      if (!cache.has(index)) setStatus("正在合成音频…");
      const [, buffer] = await Promise.all([resume, render(index)]);
      if (ticket !== generation) return;

      const voice = audio.createBufferSource();
      voice.buffer = buffer;
      voice.connect(output);
      voice.onended = () => {
        if (source !== voice) return;
        voice.disconnect();
        source = null;
        cancelAnimationFrame(frame);
        position = current().duration;
        setState("paused");
        if (repeat.getAttribute("aria-pressed") === "true") start();
        else showTime();
      };
      startedAt = audio.currentTime;
      voice.start(startedAt, position);
      source = voice;
      setState("playing");
      setStatus();
      tick();
    } catch (error) {
      if (ticket !== generation) return;
      setState("paused");
      setStatus("播放失败，请再试一次。");
      console.error(error);
    }
  }

  function toggle() {
    if (state === "paused") start();
    else pause();
  }

  function select(index) {
    pause();
    selection = index;
    position = 0;
    scrubPosition = null;
    const score = current();
    player.style.setProperty("--accent", score.palette[0]);
    element("piece-title").textContent = score.title;
    element("piece-style").textContent = score.style;
    element("piece-meta").textContent = [score.tempo, score.key, score.meter].join(" · ");
    element("piece-instruments").textContent = score.instruments;
    element("duration").textContent = clockText(score.duration);
    seek.max = score.duration;
    trackButtons.forEach((button, i) => {
      if (i === index) button.setAttribute("aria-current", "true");
      else button.removeAttribute("aria-current");
    });
    setState("paused");
    drawScore();
    showTime();
  }

  function skip(direction) {
    const keepPlaying = state !== "paused";
    select((selection + direction + scores.length) % scores.length);
    if (keepPlaying) start();
  }

  play.addEventListener("click", toggle);
  element("previous").addEventListener("click", () => skip(-1));
  element("next").addEventListener("click", () => skip(1));
  repeat.addEventListener("click", () => {
    repeat.setAttribute("aria-pressed", repeat.getAttribute("aria-pressed") !== "true");
  });
  volume.addEventListener("input", () => {
    if (output) output.gain.setTargetAtTime(Number(volume.value), audio.currentTime, 0.018);
  });
  seek.addEventListener("input", () => {
    scrubPosition = Number(seek.value);
    showTime();
  });
  seek.addEventListener("pointercancel", () => {
    scrubPosition = null;
    showTime();
  });
  seek.addEventListener("change", () => {
    const target = Number(seek.value);
    const keepPlaying = state !== "paused";
    pause();
    position = target;
    scrubPosition = null;
    showTime();
    if (keepPlaying && position < current().duration - 0.015) start();
  });
  window.addEventListener("resize", drawScore);

  select(0);
})();
