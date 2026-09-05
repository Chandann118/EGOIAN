(function () {
  const $ = id => document.getElementById(id);
  const state = {
    lastAction: "low_movement",
    animation: "smile",
    captureTimer: null,
    uploadQueue: [],
    isUploading: false,
    activeLottie: null,
    lottieInstances: {},
    lottieFailed: false
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

  // Preload and manage Lottie animations with CSS character fallback
  function initLottie() {
    if (!window.lottie) {
      console.warn("Lottie library not loaded, using CSS avatar fallback.");
      state.lottieFailed = true;
      return;
    }

    const container = $("lottie-container");
    if (!container) return;

    const animList = ["smile", "wave", "dance", "heart", "talk"];
    animList.forEach(name => {
      const animDiv = document.createElement("div");
      animDiv.id = `lottie-anim-${name}`;
      animDiv.className = "lottie-item";
      animDiv.style.display = name === "smile" ? "block" : "none";
      container.appendChild(animDiv);

      try {
        const instance = window.lottie.loadAnimation({
          container: animDiv,
          renderer: "svg",
          loop: true,
          autoplay: name === "smile",
          path: `./assets/${name}.json`
        });
        state.lottieInstances[name] = { div: animDiv, instance };
      } catch (err) {
        console.warn(`Could not load Lottie animation for ${name}:`, err);
        state.lottieFailed = true;
      }
    });
  }

  function switchLottie(animName) {
    if (state.lottieFailed || !window.lottie) return;
    const current = state.lottieInstances[animName];
    if (!current) return;

    // Switch visible Lottie item
    Object.keys(state.lottieInstances).forEach(k => {
      const item = state.lottieInstances[k];
      if (k === animName) {
        item.div.style.display = "block";
        item.instance.goToAndPlay(0, true);
      } else {
        item.div.style.display = "none";
        item.instance.stop();
      }
    });

    // Hide CSS avatar if Lottie is active
    const avatar = $("avatar");
    if (avatar) avatar.style.opacity = "0.08";
  }

  function setReaction(action) {
    if (action === state.lastAction && state.lastActionTime && Date.now() - state.lastActionTime < 1500) {
      return;
    }
    state.lastAction = action;
    state.lastActionTime = Date.now();
    state.animation = animationKeys[action] || "smile";

    // Update CSS avatar as fallback/base
    const avatar = $("avatar");
    if (avatar) {
      avatar.className = `avatar avatar-${state.animation}`;
    }

    // Switch Lottie
    switchLottie(state.animation);

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
      // Process next in queue
      if (state.uploadQueue.length > 0) {
        processUploadQueue();
      }
    }
  }

  function enqueuePhoto(blob, action, animation) {
    // Keep max 6 items in queue to prevent memory build-up if network is very slow
    if (state.uploadQueue.length >= 6) {
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
      // Ensure canvas matches video aspect
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
        // Fallback for older Safari
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

      // Initialize Lottie player
      initLottie();

      // Start MediaPipe detection
      const detector = new MirrorDetector(video, handleDetection);
      const camera = new Camera(video, {
        onFrame: async () => {
          try {
            await detector.process();
          } catch (_) {}
        },
        width: 1280,
        height: 720
      });
      camera.start();

      // Take photo every 2 seconds (2000 ms)
      capturePhoto(); // initial photo
      state.captureTimer = setInterval(capturePhoto, 2000);

      if (window.mirrorStore.isMock) {
        console.info("[Mirror of Us] Mock mode active: photos saved locally. Open gallery.html to view.");
      }
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
