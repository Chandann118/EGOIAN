/* Lightweight action classifier. MediaPipe does the landmark work; this module owns interpretation. */
class MirrorDetector {
  constructor(video, onAction) {
    this.video = video; this.onAction = onAction; this.last = null; this.lastMotion = 0;
    this.previous = null; this.hands = new Hands({ locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}` });
    this.pose = new Pose({ locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${f}` });
    this.hands.setOptions({ maxNumHands: 2, modelComplexity: 0, minDetectionConfidence: .6, minTrackingConfidence: .55 });
    this.pose.setOptions({ modelComplexity: 0, smoothLandmarks: true, minDetectionConfidence: .55, minTrackingConfidence: .55 });
    this.hands.onResults(r => { this.handResults = r; this.classify(); });
    this.pose.onResults(r => { this.poseResults = r; this.classify(); });
  }
  async process() { await this.hands.send({ image: this.video }); await this.pose.send({ image: this.video }); }
  classify() {
    const hands = this.handResults?.multiHandLandmarks || [];
    const pose = this.poseResults?.poseLandmarks;
    const now = performance.now();
    let action = "low_movement", motion = 0;
    if (pose && this.previous) motion = Math.abs(pose[11].x - this.previous[11].x) + Math.abs(pose[11].y - this.previous[11].y) + Math.abs(pose[12].x - this.previous[12].x) + Math.abs(pose[12].y - this.previous[12].y);
    if (!pose || !pose[0]) {
      if (!this.noPersonSince) this.noPersonSince = now;
      if (now - this.noPersonSince > 2500) action = "crying";
    } else {
      this.noPersonSince = null;
      this.previous = pose;
    }
    if (hands.length === 2) {
      const a = hands[0][8], b = hands[1][8], wrists = [hands[0][0], hands[1][0]];
      if (Math.hypot(a.x - b.x, a.y - b.y) < .16 && Math.abs(wrists[0].x - wrists[1].x) < .35) action = "heart_shape";
      else action = "wave";
    } else if (hands.length === 1) action = "wave";
    if (motion > .11) action = motion > .24 ? "dance" : action === "low_movement" ? "dance" : action;
    if (pose && pose[0] && Math.abs(pose[0].y - pose[11].y) > .25 && action === "low_movement") action = "talking";
    const significant = motion > .045 || hands.length > 0;
    if (significant) this.lastMotion = now;
    if (action !== this.last || now - (this.lastChanged || 0) > 750) {
      this.last = action; this.lastChanged = now; this.onAction({ action, significant, motion, lastMotion: this.lastMotion });
    }
  }
}
window.MirrorDetector = MirrorDetector;
