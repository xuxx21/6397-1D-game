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

  // 连续色轮（最原始那种，没有黑线和空白）
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
    // 细一点的白描边
    stroke(255, 140);
    strokeWeight(0.6);
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

  // —— GUESS 阶段：全局坐标玩家扇形 ——  
  drawPlayerSectorByPos(cx, cy, pos, segments, fillCol, outlineCol = null) {
    const { a0, a1 } = this.posToSegmentAngles(pos, segments);
    this.drawRingSegment(cx, cy, this.wheelRadiusOuter, this.wheelRadiusInner, a0, a1, fillCol);
    if (outlineCol) {
      noFill();
      stroke(outlineCol);
      strokeWeight(1.2);
      arc(cx, cy, this.wheelRadiusOuter * 2, this.wheelRadiusOuter * 2, a0, a1);
      arc(cx, cy, this.wheelRadiusInner * 2, this.wheelRadiusInner * 2, a0, a1);
    }
  }

  // —— REVEAL 阶段：局部坐标玩家扇形 ——  
  drawPlayerSectorByPosLocal(pos, segments, fillCol, outlineCol = null) {
    const { a0, a1 } = this.posToSegmentAngles(pos, segments);
    this.drawRingSegment(0, 0, this.wheelRadiusOuter, this.wheelRadiusInner, a0, a1, fillCol);
    if (outlineCol) {
      noFill();
      stroke(outlineCol);
      strokeWeight(1.4);
      arc(0, 0, this.wheelRadiusOuter * 2, this.wheelRadiusOuter * 2, a0, a1);
      arc(0, 0, this.wheelRadiusInner * 2, this.wheelRadiusInner * 2, a0, a1);
    }
  }

  // 目标扇形（局部坐标，REVEAL 用）
  drawTargetSectorLocal(targetAngleDeg, segments, strokeCol) {
    const step = 360 / segments;
    const idx  = floor(((targetAngleDeg % 360) + 360) % 360 / step);
    const segAngle = TWO_PI / segments;
    const a0 = -HALF_PI + idx * segAngle;
    const a1 = a0 + segAngle;

    noFill();
    stroke(strokeCol);
    strokeWeight(2); // 细一点
    arc(0, 0, this.wheelRadiusOuter * 2 + 4, this.wheelRadiusOuter * 2 + 4, a0, a1);
    arc(0, 0, this.wheelRadiusInner * 2 - 4, this.wheelRadiusInner * 2 - 4, a0, a1);
  }

  // GUESS 阶段多块提示扇形
  drawGuessHintWindows(cx, cy, segments, centerHueDeg, windowCount) {
    if (windowCount <= 1) {
      const windowArcDeg = 360 / segments;
      this.drawTopWindow(cx, cy, centerHueDeg, windowArcDeg);
      return;
    }

    const stepHue = 360 / segments;
    const segAngle = TWO_PI / segments;
    const windowArcDeg = 360 / segments;

    // 顶部那一格
    this.drawTopWindow(cx, cy, centerHueDeg, windowArcDeg);

    // 其他提示扇形
    for (let k = 1; k < windowCount; k++) {
      const idx = floor(k * segments / windowCount) % segments;
      if (idx === 0) continue;

      const a0 = -HALF_PI + idx * segAngle;
      const a1 = a0 + segAngle;

      const hue = (centerHueDeg + idx * stepHue) % 360;
      const col = this.hueToCol(hue, 80, 80, 190);

      this.drawRingSegment(cx, cy, this.wheelRadiusOuter, this.wheelRadiusInner, a0, a1, col);

      noFill();
      stroke(255, 140);
      strokeWeight(0.6);
      arc(cx, cy, this.wheelRadiusOuter * 2, this.wheelRadiusOuter * 2, a0, a1);
      arc(cx, cy, this.wheelRadiusInner * 2, this.wheelRadiusInner * 2, a0, a1);
    }
  }

  // HUD / 回合加分都不画字
  drawHUD(round, p1Score, p2Score, timeLeftMs = null) {}
  drawRoundGains(p1Gain, p2Gain) {}

  // 角度差（备用）
  angleDiffDeg(aDeg, bDeg) {
    let d = ((aDeg - bDeg) % 360 + 540) % 360 - 180;
    return Math.abs(d);
  }

  // ===== main render =====
  show() {
    // 背景白色
    background(255);

    const cx = width / 2, cy = height / 2;
    const cfg = controller && controller.cfg ? controller.cfg : null;
    const roundIdx = Math.max(
      0,
      Math.min((controller?.round || 1) - 1, (cfg?.segmentsByRound?.length || 1) - 1)
    );
    const segments = cfg ? cfg.segmentsByRound[roundIdx] : this.displaySize;
    const windowArcDeg = 360 / segments;

    switch (controller?.gameState) {

      case "IDLE":
        this.drawWheelFull(cx, cy, segments, 0, 100, 100, 220);
        break;

      case "MIX": {
        const t = constrain(
          (millis() - controller.mixStartMs) / controller.mixDurationMs,
          0, 1
        );
        const e = this.easeOutCubic(t);
        const rotationDeg = lerp(0, (controller.targetHue || 0), e);

        // 细版双环轮廓
        push();
        noFill();
        stroke(120);
        strokeWeight(4);
        ellipse(cx, cy, this.wheelRadiusOuter * 2);
        stroke(80);
        strokeWeight(4);
        ellipse(cx, cy, this.wheelRadiusInner * 2);
        pop();

        this.drawTopWindow(cx, cy, rotationDeg, windowArcDeg);
        break;
      }

      case "GUESS": {
        // 灰色轮廓（细）
        push();
        noFill();
        stroke(200);
        strokeWeight(4);
        ellipse(cx, cy, this.wheelRadiusOuter * 2);
        stroke(170);
        strokeWeight(4);
        ellipse(cx, cy, this.wheelRadiusInner * 2);
        pop();

        const targetHue = controller.targetHue || 0;

        let hintCount = null;
        if (cfg && Array.isArray(cfg.hintWindowsByRound)) {
          const arr = cfg.hintWindowsByRound;
          hintCount = arr[Math.min(roundIdx, arr.length - 1)];
        }
        if (hintCount == null || isNaN(hintCount)) {
          if (segments <= 8) {
            hintCount = 2;
          } else {
            hintCount = floor(segments / 4);
            hintCount = constrain(hintCount, 3, 10);
            hintCount = min(hintCount, segments);
          }
        }
        hintCount = max(1, hintCount);

        this.drawGuessHintWindows(cx, cy, segments, targetHue, hintCount);

        this.drawPlayerSectorByPos(
          cx, cy, playerOne.position, segments,
          color(255, 0, 0, 210), color(255)
        );
        this.drawPlayerSectorByPos(
          cx, cy, playerTwo.position, segments,
          color(0, 160, 255, 210), color(255)
        );
        break;
      }

      case "REVEAL": {
        // ✅ 新增：判断获胜方
        const g1 = controller?.lastP1Gain;
        const g2 = controller?.lastP2Gain;
        
        let winnerCol;
        if (typeof g1 === "number" && typeof g2 === "number" && g1 !== g2) {
          if (g1 > g2) {
            winnerCol = color(255, 60, 60);  // 红赢
          } else {
            winnerCol = color(60, 160, 255); // 蓝赢
          }
        } else {
          winnerCol = color(180); // 平局灰
        }

        // ✅ 整个色轮显示获胜方颜色
        push();
        translate(cx, cy);
        const segAngle = TWO_PI / segments;
        for (let i = 0; i < segments; i++) {
          const a0 = -HALF_PI + i * segAngle;
          const a1 = a0 + segAngle;
          this.drawRingSegment(
            0, 0,
            this.wheelRadiusOuter,
            this.wheelRadiusInner,
            a0, a1,
            winnerCol
          );
        }
        pop();

        break;
      }

      case "SCORE": {
        // 🔴 红 / 🔵 蓝：谁这一轮 gain 大，谁离自己目标色更近
        const g1 = controller?.lastP1Gain;
        const g2 = controller?.lastP2Gain;

        let winnerCol;

        if (typeof g1 === "number" && typeof g2 === "number" && g1 !== g2) {
          if (g1 > g2) {
            winnerCol = color(255, 60, 60);  // 红赢
          } else {
            winnerCol = color(60, 160, 255); // 蓝赢
          }
        } else {
          // gain 一样 / 没有，就平局灰
          winnerCol = color(180);
        }

        // 整圈变成赢家颜色
        push();
        translate(cx, cy);
        const segAngle = TWO_PI / segments;
        for (let i = 0; i < segments; i++) {
          const a0 = -HALF_PI + i * segAngle;
          const a1 = a0 + segAngle;
          this.drawRingSegment(
            0, 0,
            this.wheelRadiusOuter,
            this.wheelRadiusInner,
            a0, a1,
            winnerCol
          );
        }
        pop();

        break;
      }
    }
  }
}
