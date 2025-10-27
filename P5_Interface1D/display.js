// This is used to aggregrate visual information from all objects before we display them. 
// First we populate display and then we show it to user.
// This is particularly helpful once you start outputting your game to an LED strip, of if you want to have two separate 'screens'


class Display {

  constructor(_displaySize, _pixelSize) {
    this.displaySize = _displaySize;   // 用于把 position(0..displaySize-1) 映射到色相
    this.pixelSize   = _pixelSize;

    this.initColor = color(0, 0, 0);
    this.displayBuffer = [];
    for (let i = 0; i < this.displaySize; i++) {
      this.displayBuffer[i] = this.initColor;
    }

    // 视觉参数
    this.wheelRadiusOuter = Math.max(80, Math.min(width, height) * 0.45);
    this.wheelRadiusInner = this.wheelRadiusOuter * 0.65; // 做一个环
    this.markerRadius     = this.wheelRadiusOuter + 18;   // 指针标记所在半径
    this.topWindowArcDeg  = 360 / Math.max(12, this.displaySize); // 顶端窗口宽度（可随难度细分）
    this.hudMargin        = 18;

    // 可选：REVEAL 动画帧推进（若控制器未来加入 reveal 动画停留，可用）
    this.revealAnimT = 0; // 0..1
  }

  // ===== 原接口：设置像素/全清 =====
  setPixel(_index, _color) { this.displayBuffer[_index] = _color; }

  setAllPixels(_color) {
    for (let i = 0; i < this.displaySize; i++) this.setPixel(i, _color);
  }

  clear() { for (let i = 0; i < this.displaySize; i++) this.displayBuffer[i] = this.initColor; }

  // ===== 工具：映射/颜色/绘制辅助 =====
  posToHue(pos) { return (pos % this.displaySize) * (360 / this.displaySize); } // 与 controller 一致

  hueToCol(h, s = 100, b = 100) {
    push();
    colorMode(HSB, 360, 100, 100);
    const c = color((h % 360 + 360) % 360, s, b);
    pop();
    return c;
  }

  easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

  drawRingSegment(cx, cy, rOuter, rInner, ang0, ang1, col) {
    // 用三角扇近似画环段
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

  drawWheelFull(cx, cy, segments, rotationDeg = 0, saturation = 100, brightness = 100, alpha = 255) {
    push();
    translate(cx, cy);
    rotate(radians(rotationDeg));
    for (let i = 0; i < segments; i++) {
      const a0 = -HALF_PI + i * TWO_PI / segments;
      const a1 = -HALF_PI + (i + 1) * TWO_PI / segments;
      const hue = (i * 360 / segments + 360) % 360;
      const col = this.hueToCol(hue, saturation, brightness);
      col.setAlpha(alpha);
      this.drawRingSegment(0, 0, this.wheelRadiusOuter, this.wheelRadiusInner, a0, a1, col);
    }
    pop();
  }

  drawTopWindow(cx, cy, rotationDeg, windowArcDeg) {
    // 顶端窗口：在 12 点方向显示一个小扇形，颜色取自当前旋转（隐藏完整色盘）
    const halfArc = radians(windowArcDeg / 2);
    const a0 = -HALF_PI - halfArc;
    const a1 = -HALF_PI + halfArc;

    // 当前“顶端窗口”的色相 = (rotationDeg 映射到 0..360)
    const topHue = ((rotationDeg % 360) + 360) % 360;
    const col = this.hueToCol(topHue);

    push();
    translate(cx, cy);
    // 窗口不随整体旋转（始终固定在 12 点）
    noStroke();
    this.drawRingSegment(0, 0, this.wheelRadiusOuter, this.wheelRadiusInner, a0, a1, col);

    // 细节：在窗口上加一个细边
    noFill();
    stroke(255, 180);
    strokeWeight(1);
    arc(0, 0, this.wheelRadiusOuter * 2, this.wheelRadiusOuter * 2, a0, a1);
    arc(0, 0, this.wheelRadiusInner * 2, this.wheelRadiusInner * 2, a0, a1);
    pop();
  }

  drawMarkerAtHue(cx, cy, hueDeg, col, label = "") {
    // 把色相映射到角度：以 12 点为 0°
    const a = -HALF_PI + radians(hueDeg);
    const x = cx + cos(a) * this.markerRadius;
    const y = cy + sin(a) * this.markerRadius;

    // 标记形状
    push();
    noStroke();
    fill(col);
    // 红玩家：三角；蓝玩家：圆（与之前叙述一致）
    if (label === "P1") {
      push();
      translate(x, y);
      rotate(a + HALF_PI);
      triangle(-6, 10, 6, 10, 0, -8);
      pop();
    } else if (label === "P2") {
      circle(x, y, 12);
    } else {
      rectMode(CENTER);
      rect(x, y, 10, 10, 2);
    }
    // 标签
    fill(255);
    textSize(12);
    textAlign(CENTER, BOTTOM);
    text(label, x, y - 14);
    pop();
  }

  drawHUD(round, p1Score, p2Score, timeLeftMs = null) {
    push();
    noStroke();
    fill(255);
    textSize(14);
    textAlign(LEFT, TOP);
    const tl = timeLeftMs != null ? ` | Time: ${(timeLeftMs/1000).toFixed(1)}s` : "";
    text(`Round ${round} | P1: ${p1Score}  P2: ${p2Score}${tl}`, this.hudMargin, this.hudMargin);
    pop();
  }

  drawRevealOverlay(cx, cy, targetHue, p1Hue, p2Hue) {
    // 目标 & 两名玩家到目标的弧线
    const drawArcTo = (fromHue, toHue, col) => {
      const a0 = -HALF_PI + radians(fromHue);
      const a1 = -HALF_PI + radians(toHue);
      const dir = this.shortestArcDirection(a0, a1);
      noFill();
      stroke(col);
      strokeWeight(2);
      const steps = 60;
      beginShape();
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const a = a0 + dir * t * this.shortestArcAngle(a0, a1);
        const r = lerp(this.wheelRadiusOuter + 4, this.wheelRadiusOuter + 24, t);
        vertex(cx + cos(a) * r, cy + sin(a) * r);
      }
      endShape();
    };

    // 目标标记
    const targetCol = this.hueToCol(targetHue);
    this.drawMarkerAtHue(cx, cy, targetHue, targetCol, "Target");

    // 玩家标记 + 弧线
    this.drawMarkerAtHue(cx, cy, p1Hue, color(255, 0, 0), "P1");
    this.drawMarkerAtHue(cx, cy, p2Hue, color(0, 120, 255), "P2");

    stroke(255, 80);
    drawArcTo(p1Hue, targetHue, color(255, 80, 80));
    drawArcTo(p2Hue, targetHue, color(80, 160, 255));
  }

  shortestArcAngle(a0, a1) {
    // 返回 a0->a1 的最短弧长（弧度，正）
    let d = (a1 - a0) % (TWO_PI);
    if (d < 0) d += TWO_PI;
    return d <= PI ? d : TWO_PI - d;
  }

  shortestArcDirection(a0, a1) {
    // 返回方向：+1 顺时针，-1 逆时针（从 a0 到 a1 的较短方向）
    let d = (a1 - a0) % (TWO_PI);
    if (d < 0) d += TWO_PI;
    return d <= PI ? +1 : -1;
  }

  // ===== 主渲染入口：根据 controller.gameState 绘制 =====
  show() {
    // 背景
    background(0);

    const cx = width / 2;
    const cy = height / 2;

    // 安全获取当前段数
    const cfg = controller && controller.cfg ? controller.cfg : null;
    const roundIdx = Math.max(0, Math.min((controller?.round || 1) - 1, (cfg?.segmentsByRound?.length || 1) - 1));
    const segments = cfg ? cfg.segmentsByRound[roundIdx] : this.displaySize;

    // 统一 HUD 分数
    const p1Score = playerOne?.score || 0;
    const p2Score = playerTwo?.score || 0;

    switch (controller?.gameState) {
      case "IDLE": {
        // 背景淡色盘（淡淡可见） + 文本提示
        this.drawWheelFull(cx, cy, segments, 0, 60, 30, 60);
        this.drawHUD(controller.round, p1Score, p2Score, null);

        push();
        fill(255);
        textAlign(CENTER, CENTER);
        textSize(16);
        text("Twist the gear (or press R) to start", cx, height - this.hudMargin * 2);
        pop();
        break;
      }

      case "MIX": {
        // 旋转动画：由 controller.mixStartMs / mixDurationMs 推进
        const t = constrain((millis() - controller.mixStartMs) / controller.mixDurationMs, 0, 1);
        const e = this.easeOutCubic(t);

        // 设定一个从随机角度 A0 → A1 的路径（只作为视觉旋转；实际目标色已在 controller 里随机）
        // 为了稳定，这里用 targetHue 作为 A1（使顶端窗口色与 targetHue 有一致性）
        const a0 = 0;
        const a1 = (controller.targetHue || 0);
        const rotationDeg = lerp(a0, a1, e);

        // 只显示顶端窗口（其余隐藏）
        // 先画一个淡淡的轮廓（可选）
        this.drawWheelFull(cx, cy, segments, rotationDeg, 60, 12, 35);
        // 顶端窗口（真正可见的仅此）
        this.drawTopWindow(cx, cy, rotationDeg, this.topWindowArcDeg);

        this.drawHUD(controller.round, p1Score, p2Score, null);
        break;
      }

      case "GUESS": {
        // 显示灰色轮廓（不显示真实颜色），只让玩家靠感觉/记忆定位
        push();
        noFill();
        stroke(120);
        strokeWeight(12);
        ellipse(cx, cy, this.wheelRadiusOuter * 2, this.wheelRadiusOuter * 2);
        strokeWeight(12);
        stroke(40);
        ellipse(cx, cy, this.wheelRadiusInner * 2, this.wheelRadiusInner * 2);
        pop();

        // 画两名玩家的指针（基于 position→色相）
        const p1Hue = this.posToHue(playerOne.position);
        const p2Hue = this.posToHue(playerTwo.position);
        this.drawMarkerAtHue(cx, cy, p1Hue, color(255, 0, 0), "P1");
        this.drawMarkerAtHue(cx, cy, p2Hue, color(0, 120, 255), "P2");

        // 倒计时 HUD
        const msLeft = controller.timeLeft ? controller.timeLeft() : null;
        this.drawHUD(controller.round, p1Score, p2Score, msLeft);
        break;
      }

      case "REVEAL": {
        // 完整色轮 + 目标 & 两位玩家 + 弧线距离
        const rotationDeg = 0; // 揭示时固定
        this.drawWheelFull(cx, cy, segments, rotationDeg, 100, 100, 255);

        const p1Hue = this.posToHue(playerOne.position);
        const p2Hue = this.posToHue(playerTwo.position);
        const targetHue = controller.targetHue || 0;

        this.drawRevealOverlay(cx, cy, targetHue, p1Hue, p2Hue);
        this.drawHUD(controller.round, p1Score, p2Score, null);
        break;
      }

      case "SCORE": {
        // 与原有 setAllPixels 兼容：如果之前 controller 已经把 buffer 设为赢家色，这里依旧会显示
        // 另外在底部显示 Winner 提示
        // 用 buffer 方式画：保持 show() 的原写入语义
        // ——下方将 buffer 画为水平条（兼容），同时再覆盖一个简单的 winner 文本
        // （如果你想只显示整屏铺色，也可以在 sketch 里只调用 setAllPixels）
        // 先把 buffer 条画出来：
        for (let i = 0; i < this.displaySize; i++) {
          fill(this.displayBuffer[i]);
          rect(i * this.pixelSize, 0, this.pixelSize, this.pixelSize);
        }

        // 再覆盖一层半透明背景 + HUD
        push();
        fill(0, 180);
        noStroke();
        rect(0, 0, width, height);
        pop();

        this.drawHUD(controller.round, p1Score, p2Score, null);

        push();
        fill(255);
        textAlign(CENTER, CENTER);
        textSize(18);
        text("Winner color fills the screen. Twist gear (or press R) to restart.", cx, cy);
        pop();
        break;
      }

      default: {
        // 兜底：渲染水平条（兼容旧逻辑）
        for (let i = 0; i < this.displaySize; i++) {
          fill(this.displayBuffer[i]);
          rect(i * this.pixelSize, 0, this.pixelSize, this.pixelSize);
        }
        break;
      }
    }
  }
}
