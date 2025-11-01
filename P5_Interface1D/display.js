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
    this.markerRadius     = this.wheelRadiusOuter + 18;   // 未使用但保留
    this.topWindowArcDeg  = 360 / Math.max(12, this.displaySize); // 顶端窗口宽度（可随难度细分）
    this.hudMargin        = 18;

    // 可选：REVEAL 动画帧推进
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

  hueToCol(h, s = 100, b = 100, a = 255) {
    push();
    colorMode(HSB, 360, 100, 100, 255);
    const c = color((h % 360 + 360) % 360, s, b, a);
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
      const col = this.hueToCol(hue, saturation, brightness, alpha);
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
    noStroke();
    this.drawRingSegment(0, 0, this.wheelRadiusOuter, this.wheelRadiusInner, a0, a1, col);

    // 细边
    noFill();
    stroke(255, 180);
    strokeWeight(1);
    arc(0, 0, this.wheelRadiusOuter * 2, this.wheelRadiusOuter * 2, a0, a1);
    arc(0, 0, this.wheelRadiusInner * 2, this.wheelRadiusInner * 2, a0, a1);
    pop();
  }

  // === 计算 hue 所在分格的扇形角度（以 12 点为 0°）===
  hueToSegmentAngles(hueDeg, segments) {
    const segAngle = TWO_PI / segments;
    const idx = floor(((hueDeg % 360) + 360) % 360 / (360 / segments));
    const a0 = -HALF_PI + idx * segAngle;
    const a1 = a0 + segAngle;
    return { a0, a1, idx };
  }

  // === 玩家“实心选中框”扇形（与分格对齐）===
  drawPlayerSector(cx, cy, hueDeg, segments, fillCol, outlineCol = null) {
    const { a0, a1 } = this.hueToSegmentAngles(hueDeg, segments);
    // 实心
    this.drawRingSegment(cx, cy, this.wheelRadiusOuter, this.wheelRadiusInner, a0, a1, fillCol);
    // 轮廓（可选）
    if (outlineCol) {
      noFill();
      stroke(outlineCol);
      strokeWeight(2);
      arc(cx, cy, this.wheelRadiusOuter * 2, this.wheelRadiusOuter * 2, a0, a1);
      arc(cx, cy, this.wheelRadiusInner * 2, this.wheelRadiusInner * 2, a0, a1);
    }
  }

  // === 目标扇形（REVEAL 阶段高亮）===
  drawTargetSector(cx, cy, hueDeg, segments) {
    const { a0, a1 } = this.hueToSegmentAngles(hueDeg, segments);
    const c = this.hueToCol(hueDeg, 100, 100, 220);
    this.drawRingSegment(cx, cy, this.wheelRadiusOuter, this.wheelRadiusInner, a0, a1, c);
    noFill();
    stroke(255);
    strokeWeight(2);
    arc(cx, cy, this.wheelRadiusOuter * 2, this.wheelRadiusOuter * 2, a0, a1);
    arc(cx, cy, this.wheelRadiusInner * 2, this.wheelRadiusInner * 2, a0, a1);
  }

  // === HUD：仅显示回合与倒计时 ===
  drawHUD(round, timeLeftMs = null) {
    push();
    noStroke();
    fill(255);
    textSize(14);
    textAlign(LEFT, TOP);
    const tl = timeLeftMs != null ? `  |  ${ (timeLeftMs/1000).toFixed(1) }s` : "";
    text(`Round ${round}${tl}`, this.hudMargin, this.hudMargin);
    pop();
  }

  // ===== 主渲染入口：根据 controller.gameState 绘制 =====
  show() {
    background(0);

    const cx = width / 2;
    const cy = height / 2;

    // 获取当前分段数
    const cfg = controller && controller.cfg ? controller.cfg : null;
    const roundIdx = Math.max(0, Math.min((controller?.round || 1) - 1, (cfg?.segmentsByRound?.length || 1) - 1));
    const segments = cfg ? cfg.segmentsByRound[roundIdx] : this.displaySize;

    switch (controller?.gameState) {
      case "IDLE": {
        // 淡色盘（低饱和/亮度） + 提示
        this.drawWheelFull(cx, cy, segments, 0, 60, 30, 60);
        this.drawHUD(controller.round, null);

        push();
        fill(255);
        textAlign(CENTER, CENTER);
        textSize(16);
        text("Twist the gear (or press R) to start", cx, height - this.hudMargin * 2);
        pop();
        break;
      }

      case "MIX": {
        // 旋转动画，只有顶端窗口可见（根据 rotationDeg 着色）
        const t = constrain((millis() - controller.mixStartMs) / controller.mixDurationMs, 0, 1);
        const e = this.easeOutCubic(t);

        const a0 = 0;
        const a1 = (controller.targetHue || 0);
        const rotationDeg = lerp(a0, a1, e);

        // 灰轮廓 + 顶端窗口
        push();
        noFill();
        stroke(80);
        strokeWeight(12);
        ellipse(cx, cy, this.wheelRadiusOuter * 2, this.wheelRadiusOuter * 2);
        strokeWeight(12);
        stroke(40);
        ellipse(cx, cy, this.wheelRadiusInner * 2, this.wheelRadiusInner * 2);
        pop();

        this.drawTopWindow(cx, cy, rotationDeg, this.topWindowArcDeg);
        this.drawHUD(controller.round, null);
        break;
      }

      case "GUESS": {
        // 隐藏完整色盘，仅保留灰色外/内圈 + 顶端窗口（固定显示）
        push();
        noFill();
        stroke(120);
        strokeWeight(12);
        ellipse(cx, cy, this.wheelRadiusOuter * 2, this.wheelRadiusOuter * 2);
        strokeWeight(12);
        stroke(40);
        ellipse(cx, cy, this.wheelRadiusInner * 2, this.wheelRadiusInner * 2);
        pop();

        // 顶端窗口始终在 12 点（颜色对应目标 hue）
        const topDeg = controller.targetHue || 0;
        this.drawTopWindow(cx, cy, topDeg, this.topWindowArcDeg);

        // 玩家“扇形选中框”（与分格对齐）
        const p1Hue = this.posToHue(playerOne.position);
        const p2Hue = this.posToHue(playerTwo.position);

        // 半透明填充 + 细白边，红/蓝分别取自身色调
        this.drawPlayerSector(cx, cy, p1Hue, segments, color(255, 0, 0, 160), color(255));
        this.drawPlayerSector(cx, cy, p2Hue, segments, color(0, 120, 255, 160), color(255));

        // 倒计时（GUESS 阶段）
        const msLeft = controller.timeLeft ? controller.timeLeft() : null;
        this.drawHUD(controller.round, msLeft);
        break;
      }

      case "REVEAL": {
        // 完整色轮 + 目标扇形 + 玩家扇形
        this.drawWheelFull(cx, cy, segments, 0, 100, 100, 255);

        const p1Hue = this.posToHue(playerOne.position);
        const p2Hue = this.posToHue(playerTwo.position);
        const targetHue = controller.targetHue || 0;

        // 高亮目标与玩家位置
        this.drawTargetSector(cx, cy, targetHue, segments);
        this.drawPlayerSector(cx, cy, p1Hue, segments, color(255, 0, 0, 180));
        this.drawPlayerSector(cx, cy, p2Hue, segments, color(0, 120, 255, 180));

        this.drawHUD(controller.round, null);
        break;
      }

      case "SCORE": {
        // 兼容原有 buffer 的整屏铺色 + HUD
        for (let i = 0; i < this.displaySize; i++) {
          fill(this.displayBuffer[i]);
          rect(i * this.pixelSize, 0, this.pixelSize, this.pixelSize);
        }

        // 半透明遮罩
        push();
        fill(0, 180);
        noStroke();
        rect(0, 0, width, height);
        pop();

        this.drawHUD(controller.round, null);

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