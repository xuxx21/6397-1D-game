class Animation {

  constructor(pixels = 30, numberOfFrames = 30) {
    // ===== Legacy fields (兼容旧接口) =====
    this.numberOfFrames = numberOfFrames; // how many frames the legacy animation has
    this.pixels = pixels;                 // how wide the legacy animation is
    this.animation = new Array(this.numberOfFrames);
    this.currentFrameCount = -1;          // tracks legacy frame
    this.generateLegacyExplosion();       // 默认仍可用的“爆炸”1D动画

    // ===== New unified animation system =====
    this.mode = "NONE";   // NONE | MIX | REVEAL | WINNER
    this.t0 = 0;          // start time
    this.td = 0;          // duration
    this.payload = {};    // data for each mode

    // MIX specific (visual rotation)
    this.mixStartAngle = 0;
    this.mixEndAngle = 0;

    // WINNER specific
    this.winnerColor = color(0, 0, 0);
  }

  // ======================================================================
  // Legacy 1D explosion frames (kept for compatibility with old pipeline)
  // ======================================================================
  generateLegacyExplosion() {
    // Build up the array
    for (let i = 0; i < this.numberOfFrames; i++) {
      this.animation[i] = new Array(this.pixels);
      for (let j = 0; j < this.pixels; j++) {
        this.animation[i][j] = color(0, 0, 0);
      }
    }

    // Yellow wave moving outwards from center (like original)
    let center = parseInt(this.pixels / 2);
    for (let i = 0; i < this.numberOfFrames; i++) {
      let k = i; // 1 pixel per frame
      let r = color(255, 255, 0);
      if (center + k < this.pixels) this.animation[i][center + k] = r;
      if (center - k >= 0)          this.animation[i][center - k] = r;
    }
  }

  // Return current legacy frame index (and advance)
  currentFrame() {
    this.currentFrameCount = this.currentFrameCount + 1;
    if (this.currentFrameCount >= this.numberOfFrames) {
      this.currentFrameCount = 0;
    }
    return this.currentFrameCount;
  }

  // Returns one pixel at a time for legacy frames
  grabPixel(_index) {
    return this.animation[this.currentFrameCount][_index];
  }

  // ======================================================================
  // Helpers (easing, clamp, wrap)
  // ======================================================================
  _clamp01(x) { return max(0, min(1, x)); }
  _easeOutCubic(t) { return 1 - pow(1 - t, 3); }
  _easeInOutQuad(t) { return t < 0.5 ? 2 * t * t : 1 - pow(-2 * t + 2, 2) / 2; }
  _now() { return millis(); }

  // ======================================================================
  // MIX: fixed-time spin with easing (no physics)
  // ======================================================================
  startMix(targetHueDeg = 0, durationMs = 1500, startAngleDeg = null) {
    this.mode = "MIX";
    this.t0 = this._now();
    this.td = durationMs;

    // 允许外部指定起点；否则随机
    this.mixStartAngle = (startAngleDeg == null) ? random(0, 360) : startAngleDeg;
    // 终点与目标色对齐，使顶端窗口色与 targetHue 一致
    this.mixEndAngle = ((targetHueDeg % 360) + 360) % 360;
  }

  mixProgress() {
    if (this.mode !== "MIX") return 0;
    const t = this._clamp01((this._now() - this.t0) / max(1, this.td));
    return this._easeOutCubic(t); // ease-out
  }

  mixRotationDeg() {
    // 用于 display：根据 progress 在 start/end 之间插值
    const e = this.mixProgress();
    const delta = (this.mixEndAngle - this.mixStartAngle + 360) % 360;
    return (this.mixStartAngle + e * delta) % 360;
  }

  isMixDone() {
    return this.mode === "MIX" && (this._now() - this.t0 >= this.td);
  }

  // ======================================================================
  // REVEAL: hold with progress (for radial wipe & distance-arc growth)
  // ======================================================================
  /**
   * payload = {
   *   targetHue: number,
   *   p1Hue: number,
   *   p2Hue: number
   * }
   */
  startReveal(payload = {}, durationMs = 2000) {
    this.mode = "REVEAL";
    this.t0 = this._now();
    this.td = durationMs;
    this.payload = Object.assign({}, payload);
  }

  revealProgress() {
    if (this.mode !== "REVEAL") return 0;
    const t = this._clamp01((this._now() - this.t0) / max(1, this.td));
    return this._easeInOutQuad(t); // 平滑增长 0→1
  }

  isRevealDone() {
    return this.mode === "REVEAL" && (this._now() - this.t0 >= this.td);
  }

  // ======================================================================
  // WINNER: color flash / wash helper (optional)
  // ======================================================================
  startWinnerFlash(winnerColor = color(255, 255, 255), durationMs = 1200) {
    this.mode = "WINNER";
    this.t0 = this._now();
    this.td = durationMs;
    this.winnerColor = winnerColor;
  }

  winnerFlashAlpha() {
    if (this.mode !== "WINNER") return 0;
    // 0→1→0 的呼吸闪烁
    const t = this._clamp01((this._now() - this.t0) / max(1, this.td));
    // 用正弦做一个自然的脉动：0..1..0
    return sin(t * PI);
  }

  isWinnerFlashDone() {
    return this.mode === "WINNER" && (this._now() - this.t0 >= this.td);
  }

  // ======================================================================
  // Convenience to stop any mode
  // ======================================================================
  stop() {
    this.mode = "NONE";
    this.t0 = 0;
    this.td = 0;
    this.payload = {};
  }
}