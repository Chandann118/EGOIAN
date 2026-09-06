/* EGOIAN Real-time Face Reaction & Emotion % Detector
   Uses MediaPipe FaceMesh (468 3D landmarks) with static normalized geometry.
   Calculates exact percentage scores (0% to 100%) for:
   - angry (Scowl / Eyebrow Furrow / Narrow Gaze)
   - smile (Happy Smile / Cheek Lift)
   - rude (Sassy / Asymmetric Smirk)
   - surprise (Shocked / Jaw Drop / Raised Brows)
   - wink (Single Eye Wink)
*/

class FaceReactionDetector {
  constructor(video, onUpdate) {
    this.video = video;
    this.onUpdate = onUpdate;
    this.faceMesh = null;
    this.isReady = false;
    this.isProcessing = false;

    this.init();
  }

  async init() {
    try {
      if (typeof FaceMesh === "undefined") {
        console.error("[Detector] FaceMesh library is not loaded on window");
        return;
      }

      this.faceMesh = new FaceMesh({
        locateFile: file => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
      });

      this.faceMesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
      });

      this.faceMesh.onResults(results => this.processFaceResults(results));
      this.isReady = true;
      console.log("[Detector] FaceMesh initialized and ready for streaming");
    } catch (err) {
      console.error("[Detector] Init error:", err);
    }
  }

  async process() {
    if (!this.isReady || !this.faceMesh || this.isProcessing) return;
    if (!this.video || this.video.readyState < 2 || this.video.paused) return;

    this.isProcessing = true;
    try {
      await this.faceMesh.send({ image: this.video });
    } catch (e) {
      // transient frame drop
    } finally {
      this.isProcessing = false;
    }
  }

  clamp(val, min = 0, max = 1) {
    return Math.max(min, Math.min(max, val));
  }

  processFaceResults(results) {
    const landmarks = results.multiFaceLandmarks ? results.multiFaceLandmarks[0] : null;

    if (!landmarks || landmarks.length < 468) {
      this.onUpdate({
        hasFace: false,
        dominantEmotion: "none",
        dominantPercent: 0,
        scores: { angry: 0, smile: 0, rude: 0, surprise: 0, wink: 0 }
      });
      return;
    }

    // Reference invariant distance: distance between outer eye corners (33 and 263)
    const eyeL = landmarks[33];
    const eyeR = landmarks[263];
    const eyeDist = Math.hypot(eyeL.x - eyeR.x, eyeL.y - eyeR.y);
    if (eyeDist < 0.03) return;

    // Head tilt normalization
    const eyeTilt = (eyeL.y - eyeR.y) / eyeDist;

    // Key Landmark Coordinates
    const lipL = landmarks[61];        // Left mouth corner
    const lipR = landmarks[291];       // Right mouth corner
    const upperLipTop = landmarks[0];  // Upper lip top
    const innerLipTop = landmarks[13]; // Inner top lip
    const innerLipBottom = landmarks[14]; // Inner bottom lip

    const browInnerL = landmarks[107]; // Left inner brow
    const browInnerR = landmarks[336]; // Right inner brow
    const browMidL = landmarks[105];   // Left brow arch
    const browMidR = landmarks[334];   // Right brow arch

    const eyeTopL = landmarks[159];
    const eyeBottomL = landmarks[145];
    const eyeTopR = landmarks[386];
    const eyeBottomR = landmarks[374];

    // Normalized measurements
    const mouthWidth = Math.hypot(lipL.x - lipR.x, lipL.y - lipR.y) / eyeDist;
    const mouthOpen = Math.hypot(innerLipTop.x - innerLipBottom.x, innerLipTop.y - innerLipBottom.y) / eyeDist;
    const browDist = Math.hypot(browInnerL.x - browInnerR.x, browInnerL.y - browInnerR.y) / eyeDist;

    // Brow heights above eye level
    const browHeightL = (eyeTopL.y - browInnerL.y) / eyeDist;
    const browHeightR = (eyeTopR.y - browInnerR.y) / eyeDist;
    const avgBrowHeight = (browHeightL + browHeightR) / 2;

    // Mouth corners elevation relative to upper lip center
    const cornerAvgY = (lipL.y + lipR.y) / 2;
    const cornerLift = (upperLipTop.y - cornerAvgY) / eyeDist;

    // Eye Aspect Ratios (EAR)
    const earL = Math.hypot(eyeTopL.x - eyeBottomL.x, eyeTopL.y - eyeBottomL.y) /
                 Math.max(0.01, Math.hypot(eyeL.x - landmarks[133].x, eyeL.y - landmarks[133].y));
    const earR = Math.hypot(eyeTopR.x - eyeBottomR.x, eyeTopR.y - eyeBottomR.y) /
                 Math.max(0.01, Math.hypot(landmarks[362].x - eyeR.x, landmarks[362].y - eyeR.y));

    // ==========================================
    // PRECISE & CALIBRATED EMOTION FORMULAS (0 to 100%)
    // ==========================================

    // 1. HAPPY / SMILE PERCENTAGE
    // Neutral mouthWidth is ~0.82. Smile stretches from 0.88 to 1.15+.
    const smileWidthPart = this.clamp((mouthWidth - 0.84) / 0.20);
    const smileLiftPart = this.clamp((cornerLift + 0.01) / 0.05);
    let smileVal = smileWidthPart * 0.65 + smileLiftPart * 0.35;
    if (mouthWidth > 1.05) smileVal = Math.max(smileVal, 0.85);

    // 2. ANGRY PERCENTAGE
    // In neutral face, browDist is ~0.35 - 0.39.
    // In angry scowl, brows furrow together: browDist drops below 0.30 down to 0.20!
    // In angry scowl, inner brows drop closer to eyes: avgBrowHeight drops below 0.17!
    const browPinch = this.clamp((0.34 - browDist) / 0.11);
    const browDown = this.clamp((0.20 - avgBrowHeight) / 0.07);
    let angryVal = browPinch * 0.65 + browDown * 0.35;
    // Suppress angry if smiling or laughing
    if (smileVal > 0.3) angryVal = Math.max(0, angryVal - (smileVal - 0.3) * 1.8);

    // 3. RUDE / SASSY SMIRK PERCENTAGE
    // One corner pulled higher than the other relative to eye tilt
    const mouthTilt = (lipL.y - lipR.y) / eyeDist;
    const asymmetry = Math.abs(mouthTilt - eyeTilt);
    let rudeVal = this.clamp((asymmetry - 0.035) / 0.08);
    const browAsymmetry = Math.abs(browHeightL - browHeightR);
    if (browAsymmetry > 0.025) rudeVal = this.clamp(rudeVal + 0.20);
    if (mouthOpen > 0.16) rudeVal *= 0.5;

    // 4. SURPRISE / SHOCK PERCENTAGE
    // Dropped jaw: mouthOpen > 0.08
    const jawDrop = this.clamp((mouthOpen - 0.06) / 0.16);
    const browRaise = this.clamp((avgBrowHeight - 0.20) / 0.08);
    let surpriseVal = jawDrop * 0.70 + browRaise * 0.30;

    // 5. WINK PERCENTAGE
    const earDiff = Math.abs(earL - earR);
    let winkVal = 0;
    if (earDiff > 0.07 && (earL < 0.18 || earR < 0.18) && (earL > 0.20 || earR > 0.20)) {
      winkVal = this.clamp((earDiff - 0.06) / 0.12);
    }

    // Convert to round percentages (0 to 100)
    const scores = {
      angry: Math.round(this.clamp(angryVal) * 100),
      smile: Math.round(this.clamp(smileVal) * 100),
      rude: Math.round(this.clamp(rudeVal) * 100),
      surprise: Math.round(this.clamp(surpriseVal) * 100),
      wink: Math.round(this.clamp(winkVal) * 100)
    };

    // Dominant Emotion Selection
    let maxEmotion = "neutral";
    let maxPct = 0;
    for (const [emotion, pct] of Object.entries(scores)) {
      if (pct > maxPct && pct >= 35) {
        maxPct = pct;
        maxEmotion = emotion;
      }
    }

    if (maxPct < 35) {
      maxEmotion = "neutral";
      maxPct = Math.max(20, 100 - (scores.angry + scores.smile + scores.rude + scores.surprise + scores.wink));
    }

    this.onUpdate({
      hasFace: true,
      dominantEmotion: maxEmotion,
      dominantPercent: maxPct,
      scores,
      landmarks
    });
  }
}

window.FaceReactionDetector = FaceReactionDetector;
window.MirrorDetector = FaceReactionDetector;
