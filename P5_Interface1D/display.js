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

  // 画完整色轮：hueOffsetDeg 控制"12 点方向那一格"的颜色
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

  // —— 全局坐标版（带 cx,cy，用于 GUESS 阶段）——
  drawPlayerSectorByPos(cx, cy, pos, segments, fillCol, outlineCol = null) {
    const { a0, a1 } = this.posToSegmentAngles(pos, segments);
    this.drawRingSegment(cx, cy, this.wheelRadiusOuter, this.wheelRadiusInner, a0, a1, fillCol);
    if (outlineCol) {
      noFill();
      stroke(outlineCol);
      strokeWeight(2);
      arc(cx, cy, this.wheelRadiusOuter * 2, this.wheelRadiusOuter * 2, a0, a1);
      arc(cx, cy, this.wheelRadiusInner * 2, this.wheelRadiusInner * 2, a0, a1);
    }
  }

  // —— 局部坐标版（REVEAL 里，在 push+translate 内用）——
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

  // 目标扇形（局部坐标，REVEAL 用）——参数为 angleDeg，并带颜色
  drawTargetSectorLocal(targetAngleDeg, segments, strokeCol) {
    const step = 360 / segments;
    const idx  = floor(((targetAngleDeg % 360) + 360) % 360 / step);
    const segAngle = TWO_PI / segments;
    const a0 = -HALF_PI + idx * segAngle;
    const a1 = a0 + segAngle;

    noFill();
    stroke(strokeCol);
    strokeWeight(4);
    arc(0, 0, this.wheelRadiusOuter * 2 + 6, this.wheelRadiusOuter * 2 + 6, a0, a1);
    arc(0, 0, this.wheelRadiusInner * 2 - 6, this.wheelRadiusInner * 2 - 6, a0, a1);
  }

  // ====== GUESS 阶段用：多块"提示扇形" ======
  // centerHueDeg: 顶部那一格的色相（= controller.targetHue）
  // windowCount: 想露出多少块（包含顶部那一格）
  drawGuessHintWindows(cx, cy, segments, centerHueDeg, windowCount) {
    if (windowCount <= 1) {
      // 只有顶部窗口，交给 drawTopWindow 处理
      const windowArcDeg = 360 / segments;
      this.drawTopWindow(cx, cy, centerHueDeg, windowArcDeg);
      return;
    }

    const stepHue = 360 / segments;
    const segAngle = TWO_PI / segments;
    const windowArcDeg = 360 / segments;

    // 顶部那一格（索引 0）：用原来的高亮样式
    this.drawTopWindow(cx, cy, centerHueDeg, windowArcDeg);

    // 其余 windowCount-1 个，均匀分布在一圈
    for (let k = 1; k < windowCount; k++) {
      const idx = floor(k * segments / windowCount) % segments;
      if (idx === 0) continue; // 避免和顶部重复

      const a0 = -HALF_PI + idx * segAngle;
      const a1 = a0 + segAngle;

      // 这块扇形的色相：在顶部颜色基础上偏移 idx 个格
      const hue = (centerHueDeg + idx * stepHue) % 360;
      const col = this.hueToCol(hue, 80, 80, 190); // 稍微淡一点

      // 扇形本体
      this.drawRingSegment(cx, cy, this.wheelRadiusOuter, this.wheelRadiusInner, a0, a1, col);

      // 细的白边（比顶部窗口弱一些）
      noFill();
      stroke(255, 150);
      strokeWeight(1);
      arc(cx, cy, this.wheelRadiusOuter * 2, this.wheelRadiusOuter * 2, a0, a1);
      arc(cx, cy, this.wheelRadiusInner * 2, this.wheelRadiusInner * 2, a0, a1);
    }
  }

  // HUD：总分 + 回合 + （可选）倒计时 —— 现在显示在圆环中心
  drawHUD(round, p1Score, p2Score, timeLeftMs = null) {
    const cx = width / 2;
    const cy = height / 2;
    
    push();
    textAlign(CENTER, CENTER);
    fill(255);
    
    // 回合数显示在最上方
    textSize(16);
    text(`Round ${round}`, cx, cy - 30);
    
    // 分数显示在中间
    textSize(20);
    text(`R: ${p1Score}  B: ${p2Score}`, cx, cy);
    
    // 倒计时显示在下方（如果有的话）
    if (timeLeftMs != null) {
      textSize(18);
      text(`${(timeLeftMs/1000).toFixed(1)}s`, cx, cy + 30);
    }
    
    pop();
  }

  // 本回合增加的分数（REVEAL 阶段）——R / B
  drawRoundGains(p1Gain, p2Gain) {
    if ((!p1Gain || p1Gain === 0) && (!p2Gain || p2Gain === 0)) return;
    const cx = width / 2;
    const cy = height / 2;
    push();
    fill(255);
    textAlign(CENTER, CENTER);
    textSize(18);
    text(`R +${p1Gain}    B +${p2Gain}`, cx, cy + 60);
    pop();
  }

  // 差距线（局部坐标）：从玩家位置连到某个目标 angleDeg
  drawDifferenceLineLocal(playerPos, targetAngleDeg, segments, strokeCol) {
    const step = 360 / segments;
    const idxT = floor(((targetAngleDeg % 360) + 360) % 360 / step);
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
        push(); 
        fill(255); 
        textAlign(CENTER, CENTER); 
        textSize(16);
        text("Twist the gear (or press R) to start", cx, height - this.hudMargin * 2); 
        pop();
        break;

      case "MIX": {
        const t = constrain((millis() - controller.mixStartMs) / controller.mixDurationMs, 0, 1);
        const e = this.easeOutCubic(t);
        const rotationDeg = lerp(0, (controller.targetHue || 0), e);

        // 灰色双环 + 顶部色块
        push(); 
        noFill(); 
        stroke(80); 
        strokeWeight(12);
        ellipse(cx, cy, this.wheelRadiusOuter * 2); 
        stroke(40); 
        strokeWeight(12);
        ellipse(cx, cy, this.wheelRadiusInner * 2); 
        pop();

        this.drawTopWindow(cx, cy, rotationDeg, windowArcDeg);
        this.drawHUD(controller.round, p1Score, p2Score);
        break;
      }

      case "GUESS": {
        // 灰色轮廓
        push(); 
        noFill(); 
        stroke(120); 
        strokeWeight(12);
        ellipse(cx, cy, this.wheelRadiusOuter * 2); 
        stroke(40); 
        strokeWeight(12);
        ellipse(cx, cy, this.wheelRadiusInner * 2); 
        pop();

        const targetHue = controller.targetHue || 0;

        // ===== 多个提示扇形（难度规则） =====
        let hintCount = null;

        // 1）若 config 显式配置了每回合提示数量，则优先使用
        if (cfg && Array.isArray(cfg.hintWindowsByRound)) {
          const arr = cfg.hintWindowsByRound;
          hintCount = arr[Math.min(roundIdx, arr.length - 1)];
        }

        // 2）否则使用默认规则：分格少 → 2 个；分格多 → 随 segments 递增
        if (hintCount == null || isNaN(hintCount)) {
          if (segments <= 8) {
            // 分格少：只露 2 个，避免一上来太简单
            hintCount = 2;
          } else {
            // 分格多：大概每 4 格露 1 个，限制在 3~10 之间
            hintCount = floor(segments / 4);
            hintCount = constrain(hintCount, 3, 10);
            // 不超过 segments 本身
            hintCount = min(hintCount, segments);
          }
        }

        // 兜底：至少 1 个
        hintCount = max(1, hintCount);

        this.drawGuessHintWindows(cx, cy, segments, targetHue, hintCount);

        // 玩家选中框：红 / 蓝
        this.drawPlayerSectorByPos(cx, cy, playerOne.position, segments,
          color(255, 0, 0, 210), color(255));
        this.drawPlayerSectorByPos(cx, cy, playerTwo.position, segments,
          color(0, 160, 255, 210), color(255));

        const msLeft = controller.timeLeft ? controller.timeLeft() : null;
        this.drawHUD(controller.round, p1Score, p2Score, msLeft);
        break;
      }

      case "REVEAL": {
        const wheelOffset = controller.targetHue || 0;
        const redAngle  = controller.redTargetAngleDeg  ?? 0;
        const blueAngle = controller.blueTargetAngleDeg ?? 0;

        push();
        translate(cx, cy);

        // 展开"旋转后"的整圈色轮（半透明，衬托玩家块）
        this.drawWheelFull(0, 0, segments, wheelOffset, 80, 80, 160);

        // 两个目标位置：红/蓝各一个框
        this.drawTargetSectorLocal(redAngle,  segments, color(255, 160, 160));
        this.drawTargetSectorLocal(blueAngle, segments, color(160, 190, 255));

        // 玩家实际选择位置
        this.drawPlayerSectorByPosLocal(playerOne.position, segments,
          color(255, 60, 60, 230), color(255));
        this.drawPlayerSectorByPosLocal(playerTwo.position, segments,
          color(60, 160, 255, 230), color(255));

        // 误差线：R 连到红目标，B 连到蓝目标
        this.drawDifferenceLineLocal(playerOne.position, redAngle,  segments, color(255, 140, 140));
        this.drawDifferenceLineLocal(playerTwo.position, blueAngle, segments, color(140, 190, 255));

        pop();

        this.drawHUD(controller.round, p1Score, p2Score);
        this.drawRoundGains(controller?.lastP1Gain || 0, controller?.lastP2Gain || 0);
        break;
      }

      case "SCORE":
        for (let i = 0; i < this.displaySize; i++) {
          fill(this.displayBuffer[i]);
          rect(i * this.pixelSize, 0, this.pixelSize, this.pixelSize);
        }
        push(); 
        fill(0,180); 
        noStroke(); 
        rect(0,0,width,height); 
        pop();
        this.drawHUD(controller.round, p1Score, p2Score);
        push(); 
        fill(255); 
        textAlign(CENTER,CENTER); 
        textSize(18);
        text("Winner color fills the screen. Twist gear (or press R) to restart.", cx, cy + 80); 
        pop();
        break;
    }
  }
}
