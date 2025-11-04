class Display {

  constructor(_displaySize, _pixelSize) {
    this.displaySize = _displaySize;
    this.pixelSize   = _pixelSize;

    this.initColor = color(0, 0, 0);
    this.displayBuffer = [];
    for (let i = 0; i < this.displaySize; i++) {
      this.displayBuffer[i] = this.initColor;
    }

    this.wheelRadiusOuter = Math.max(80, Math.min(width, height) * 0.45);
    this.wheelRadiusInner = this.wheelRadiusOuter * 0.65;
    this.hudMargin        = 18;
    this.revealAnimT = 0;
  }

  // ===== buffer API =====
  setPixel(_index, _color) { this.displayBuffer[_index] = _color; }

  setAllPixels(_color) {
    for (let i = 0; i < this.displaySize; i++) this.setPixel(i, _color);
  }

  clear() {
    for (let i = 0; i < this.displaySize; i++) this.displayBuffer[i] = this.initColor;
  }

  // ===== util =====
  posToHue(pos) { return (pos % this.displaySize) * (360 / this.displaySize); }

  hueToCol(h, s = 100, b = 100, a = 255) {
    push();
    colorMode(HSB, 360, 100, 100, 255);
    const c = color((h % 360 + 360) % 360, s, b, a);
    pop();
    return c;
  }

  easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

  drawRingSegment(cx, cy, rOuter, rInner, ang0, ang1, col) {
    const steps = 18;
    noStroke();
    fill(col);
    beginShape();
    for (let i = 0; i <= steps; i++) {
      const a = lerp(ang0, ang1, i / steps);
      vertex(cx + cos(a) * rOuter, cy + sin(a) * rOuter);
    }
    for (let i = steps; i >= 0; i--) {
      const a = lerp(ang0, ang1, i / steps);
      vertex(cx + cos(a) * rInner, cy + sin(a) * rInner);
    }
    endShape(CLOSE);
  }

  // 画完整色轮：hueOffsetDeg 控制“12 点方向那一格”的颜色
  drawWheelFull(cx, cy, segments, hueOffsetDeg = 0, saturation = 100, brightness = 100, alpha = 255) {
    push();
    translate(cx, cy);
    for (let i = 0; i < segments; i++) {
      const a0 = -HALF_PI + i * TWO_PI / segments;
      const a1 = -HALF_PI + (i + 1) * TWO_PI / segments;
      const hue = (hueOffsetDeg + i * (360 / segments)) % 360;
      const col = this.hueToCol(hue, saturation, brightness, alpha);
      this.drawRingSegment(0, 0, this.wheelRadiusOuter, this.wheelRadiusInner, a0, a1, col);
    }
    pop();
  }

  // 顶部窗口：宽度根据当前 segments
  drawTopWindow(cx, cy, windowHueDeg, windowArcDeg) {
    const halfArc = radians(windowArcDeg / 2);
    const a0 = -HALF_PI - halfArc;
    const a1 = -HALF_PI + halfArc;

    const col = this.hueToCol(windowHueDeg);
    push();
    translate(cx, cy);
    this.drawRingSegment(0, 0, this.wheelRadiusOuter, this.wheelRadiusInner, a0, a1, col);
    noFill();
    stroke(255, 200);
    strokeWeight(1.5);
    arc(0, 0, this.wheelRadiusOuter * 2, this.wheelRadiusOuter * 2, a0, a1);
    arc(0, 0, this.wheelRadiusInner * 2, this.wheelRadiusInner * 2, a0, a1);
    pop();
  }

  // === 按 position 对齐到当前 segments（保证和色盘格子一样宽）===
  posToSegmentAngles(pos, segments) {
    const u = (pos % this.displaySize) / this.displaySize;
    const idx = floor(constrain(u, 0, 0.999999) * segments);
    const segAngle = TWO_PI / segments;
    const a0 = -HALF_PI + idx * segAngle;
    const a1 = a0 + segAngle;
    return { a0, a1, idx };
  }

  drawPlayerSectorByPosLocal(pos, segments, fillCol, outlineCol = null) {
    const { a0, a1 } = this.posToSegmentAngles(pos, segments);
    this.drawRingSegment(0, 0, this.wheelRadiusOuter, this.wheelRadiusInner, a0, a1, fillCol);
    if (outlineCol) {
      noFill();
      stroke(outlineCol);
      strokeWeight(2.5);
      arc(0, 0, this.wheelRadiusOuter * 2, this.wheelRadiusOuter * 2, a0, a1);
      arc(0, 0, this.wheelRadiusInner * 2, this.wheelRadiusInner * 2, a0, a1);
    }
  }

  // 目标扇形（局部坐标，REVEAL 用）——只画白框
  drawTargetSectorLocal(targetHue, segments) {
    const step = 360 / segments;
    const idx  = floor(((targetHue % 360) + 360) % 360 / step);
    const segAngle = TWO_PI / segments;
    const a0 = -HALF_PI + idx * segAngle;
    const a1 = a0 + segAngle;

    noFill();
    stroke(255);
    strokeWeight(4);
    arc(0, 0, this.wheelRadiusOuter * 2 + 6, this.wheelRadiusOuter * 2 + 6, a0, a1);
    arc(0, 0, this.wheelRadiusInner * 2 - 6, this.wheelRadiusInner * 2 - 6, a0, a1);
  }

  // HUD：总分 + 回合 + （可选）倒计时
  drawHUD(round, p1Score, p2Score, timeLeftMs = null) {
    push();
    noStroke();
    fill(255);
    textSize(14);
    textAlign(LEFT, TOP);
    const tl = timeLeftMs != null ? ` | ${(timeLeftMs/1000).toFixed(1)}s` : "";
    text(`Round ${round} | R: ${p1Score}  B: ${p2Score}${tl}`, this.hudMargin, this.hudMargin);
    pop();
  }

  // 本回合增加的分数（REVEAL 阶段）——改成 R / B
  drawRoundGains(p1Gain, p2Gain) {
    if ((!p1Gain || p1Gain === 0) && (!p2Gain || p2Gain === 0)) return;
    const cx = width / 2;
    const cy = height / 2;
    push();
    fill(255);
    textAlign(CENTER, CENTER);
    textSize(18);
    text(`R +${p1Gain}    B +${p2Gain}`, cx, cy);
    pop();
  }

  // 差距线（局部坐标）
  drawDifferenceLineLocal(playerPos, targetHue, segments, strokeCol) {
    const step = 360 / segments;
    const idxT = floor(((targetHue % 360) + 360) % 360 / step);
    const segAngle = TWO_PI / segments;

    const { a0: aP0, a1: aP1 } = this.posToSegmentAngles(playerPos, segments);
    const midP = (aP0 + aP1) * 0.5;
    const aT0 = -HALF_PI + idxT * segAngle;
    const aT1 = aT0 + segAngle;
    const midT = (aT0 + aT1) * 0.5;

    const r = this.wheelRadiusOuter + 22;
    const xP = cos(midP) * r, yP = sin(midP) * r;
    const xT = cos(midT) * r, yT = sin(midT) * r;

    push();
    stroke(strokeCol);
    strokeWeight(3);
    line(xP, yP, xT, yT);
    noStroke();
    fill(strokeCol);
    circle(xP, yP, 8);
    circle(xT, yT, 8);
    pop();
  }

  // ===== main render =====
  show() {
    background(0);

    const cx = width / 2, cy = height / 2;
    const cfg = controller && controller.cfg ? controller.cfg : null;
    const roundIdx = Math.max(0, Math.min((controller?.round || 1) - 1,
                      (cfg?.segmentsByRound?.length || 1) - 1));
    const segments = cfg ? cfg.segmentsByRound[roundIdx] : this.displaySize;
    const p1Score = playerOne?.score || 0;
    const p2Score = playerTwo?.score || 0;
    const windowArcDeg = 360 / segments;

    switch (controller?.gameState) {
      case "IDLE":
        this.drawWheelFull(cx, cy, segments, 0, 100, 100, 220);
        this.drawHUD(controller.round, p1Score, p2Score);
        push(); fill(255); textAlign(CENTER, CENTER); textSize(16);
        text("Twist the gear (or press R) to start", cx, height - this.hudMargin * 2); pop();
        break;

      case "MIX": {
        const t = constrain((millis() - controller.mixStartMs) / controller.mixDurationMs, 0, 1);
        const e = this.easeOutCubic(t);
        const rotationDeg = lerp(0, (controller.targetHue || 0), e);
        push(); noFill(); stroke(80); strokeWeight(12);
        ellipse(cx, cy, this.wheelRadiusOuter * 2); stroke(40); strokeWeight(12);
        ellipse(cx, cy, this.wheelRadiusInner * 2); pop();
        this.drawTopWindow(cx, cy, rotationDeg, windowArcDeg);
        this.drawHUD(controller.round, p1Score, p2Score);
        break;
      }

      case "GUESS": {
        push(); noFill(); stroke(120); strokeWeight(12);
        ellipse(cx, cy, this.wheelRadiusOuter * 2); stroke(40); strokeWeight(12);
        ellipse(cx, cy, this.wheelRadiusInner * 2); pop();
        const targetHue = controller.targetHue || 0;
        this.drawTopWindow(cx, cy, targetHue, windowArcDeg);
        this.drawPlayerSectorByPosLocal(playerOne.position, segments,
          color(255, 0, 0, 210), color(255));
        this.drawPlayerSectorByPosLocal(playerTwo.position, segments,
          color(0, 160, 255, 210), color(255));
        const msLeft = controller.timeLeft ? controller.timeLeft() : null;
        this.drawHUD(controller.round, p1Score, p2Score, msLeft);
        break;
      }

      case "REVEAL": {
        const targetHue = controller.targetHue || 0;
        push(); translate(cx, cy);
        this.drawWheelFull(0, 0, segments, targetHue, 80, 80, 160);
        this.drawTargetSectorLocal(targetHue, segments);
        this.drawPlayerSectorByPosLocal(playerOne.position, segments,
          color(255, 60, 60, 230), color(255));
        this.drawPlayerSectorByPosLocal(playerTwo.position, segments,
          color(60, 160, 255, 230), color(255));
        this.drawDifferenceLineLocal(playerOne.position, targetHue, segments, color(255,120,120));
        this.drawDifferenceLineLocal(playerTwo.position, targetHue, segments, color(120,180,255));
        pop();
        this.drawHUD(controller.round, p1Score, p2Score);
        this.drawRoundGains(controller?.lastP1Gain||0, controller?.lastP2Gain||0);
        break;
      }

      case "SCORE":
        for (let i = 0; i < this.displaySize; i++) {
          fill(this.displayBuffer[i]); rect(i*this.pixelSize,0,this.pixelSize,this.pixelSize);
        }
        push(); fill(0,180); noStroke(); rect(0,0,width,height); pop();
        this.drawHUD(controller.round, p1Score, p2Score);
        push(); fill(255); textAlign(CENTER,CENTER); textSize(18);
        text("Winner color fills the screen. Twist gear (or press R) to restart.", cx, cy); pop();
        break;
    }
  }
}