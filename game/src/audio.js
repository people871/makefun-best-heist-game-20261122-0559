// Synthesised sound only — WebAudio oscillators and filtered noise, no audio files,
// so the game loads with zero network requests and plays fully offline.
// The context is created on the first user gesture; every sound is a short envelope.
export function createAudio() {
  let context = null;
  let muted = false;
  let droneNodes = null;

  function ensure() {
    if (!context) {
      try {
        context = new (window.AudioContext || window.webkitAudioContext)();
      } catch {
        return null;
      }
    }
    if (context && context.state === 'suspended') context.resume();
    return context;
  }

  function tone(freq, duration, type, gain, slideTo) {
    const ac = ensure();
    if (!ac || muted) return;
    const osc = ac.createOscillator();
    const amp = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ac.currentTime);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, ac.currentTime + duration);
    amp.gain.setValueAtTime(gain, ac.currentTime);
    amp.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + duration);
    osc.connect(amp);
    amp.connect(ac.destination);
    osc.start();
    osc.stop(ac.currentTime + duration);
  }

  function noiseBurst(duration, gain, filterFreq) {
    const ac = ensure();
    if (!ac || muted) return;
    const length = Math.max(1, Math.floor(ac.sampleRate * duration));
    const buffer = ac.createBuffer(1, length, ac.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = ac.createBufferSource();
    source.buffer = buffer;
    const filter = ac.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const amp = ac.createGain();
    amp.gain.setValueAtTime(gain, ac.currentTime);
    amp.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + duration);
    source.connect(filter);
    filter.connect(amp);
    amp.connect(ac.destination);
    source.start();
  }

  return {
    unlock() {
      ensure();
    },
    get muted() {
      return muted;
    },
    toggleMute() {
      muted = !muted;
      if (muted) this.stopDrone();
      return muted;
    },
    pickup() {
      tone(880, 0.09, 'sine', 0.12, 1320);
    },
    coin() {
      tone(1568, 0.07, 'triangle', 0.1);
      tone(2093, 0.1, 'triangle', 0.08);
    },
    footstep() {
      noiseBurst(0.05, 0.05, 500);
    },
    alarm() {
      tone(660, 0.16, 'sawtooth', 0.1, 440);
      tone(440, 0.2, 'sawtooth', 0.1, 660);
    },
    cameraBeep() {
      tone(1200, 0.08, 'square', 0.05);
    },
    vault() {
      tone(523, 0.12, 'triangle', 0.12);
      tone(659, 0.12, 'triangle', 0.12);
      tone(784, 0.22, 'triangle', 0.14);
    },
    box() {
      noiseBurst(0.25, 0.1, 2400);
      tone(220, 0.2, 'square', 0.06, 110);
    },
    caught() {
      tone(220, 0.5, 'sawtooth', 0.14, 55);
    },
    win() {
      [523, 659, 784, 1047].forEach((freq, i) => {
        setTimeout(() => tone(freq, 0.18, 'triangle', 0.12), i * 110);
      });
    },
    startDrone() {
      const ac = ensure();
      if (!ac || muted || droneNodes) return;
      const osc = ac.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = 55;
      const amp = ac.createGain();
      amp.gain.value = 0.035;
      const lfo = ac.createOscillator();
      lfo.frequency.value = 0.1;
      const lfoGain = ac.createGain();
      lfoGain.gain.value = 0.015;
      lfo.connect(lfoGain);
      lfoGain.connect(amp.gain);
      osc.connect(amp);
      amp.connect(ac.destination);
      osc.start();
      lfo.start();
      droneNodes = { osc, lfo, amp };
    },
    stopDrone() {
      if (!droneNodes) return;
      try {
        droneNodes.osc.stop();
        droneNodes.lfo.stop();
      } catch {
        // Already stopped.
      }
      droneNodes = null;
    },
  };
}
