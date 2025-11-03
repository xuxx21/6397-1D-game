// This is where your state machines and game logic lives
class Controller {
  constructor() {
    this.gameState = "IDLE";
    this.round = 1;
    // global config injected from sketch.js
    this.cfg = gameConfig;
    // MIX (spin) timing
    this.mixStartMs = 0;
    this.mixDurationMs = this.cfg.spinDurationMs;
    // GUESS timing
    this.guessEndMs = 0;
    // REVEAL timing
    this.revealDurationMs = 2000; // how long to pause on REVEAL (ms)
    this.revealEndMs = null;
    // target per round (hue in degrees 0..360)
    this.targetHue = 0;
    // 这一轮色轮的“配色偏移角度”（用来控制 REVEAL 阶段色轮的整体颜色排列）
    // 目标：REVEAL 时，色轮 12 点方向那一块颜色 = 顶端窗口显示的颜色（targetHue）
    this.wheelHueOffset = 0;
    // hardware trigger latch
    this._gearTriggerLatched = false;
    // keyboard move speed (deg/sec) —— 手感不够快就把这个数调大
    this.keyboardSpeedDegPerSec = this.cfg.keyboardSpeedDegPerSec || 220;
    // 记录每一回合新加的分数，用于在 REVEAL 阶段中间显示
    this.lastP1Gain = 0;
    this.lastP2Gain = 0;
  }
  // ---- hardware / keyboard triggers ----
  latchGearTrigger() {
    this._gearTriggerLatched = true;
  }
  releaseGearTrigger() {
    // optional: currently no-op; keep for future "STOP" handling if needed
  }
  gearTriggeredOnce() {
    if (this._gearTriggerLatched) {
      this._gearTriggerLatched = false;
      return true;
    }
    return false;
  }
  // ---- round helpers ----
  startMix() {
    // 随机选一个目标色（0..360）
    this.targetHue = random(0, 360);
    // 这一轮的色轮配色偏移 = 目标色
    // => REVEAL 阶段画色轮时，用这个 offset，让 12 点方向那一块 = targetHue
    this.wheelHueOffset = this.targetHue;
    this.mixStartMs = millis();
    this.mixDurationMs = this.cfg.spinDurationMs;
    const t = this.cfg.guessTimeMsByRound[
      Math.min(this.round - 1, this.cfg.guessTimeMsByRound.length - 1)
    ];
    this.guessEndMs = millis() + t;
    // reset reveal timing & round gains
    this.revealEndMs = null;
    this.lastP1Gain = 0;
    this.lastP2Gain = 0;
    // optional animation hook
    if (typeof collisionAnimation?.startMix === "function") {
      collisionAnimation.startMix(this.targetHue, this.mixDurationMs);
    }
    this.gameState = "MIX";
  }
  // remaining ms for GUESS (for HUD)
  timeLeft() {
    return Math.max(0, this.guessEndMs - millis());
  }
  // ---- scoring math ----
  // player.position -> hue（0..360）
  playerPosToHue(player) {
    const size = player.displaySize || display.displaySize || 360;
    return (player.position % size) * (360 / size);
  }
  hueCircularDistance(h1, h2) {
    const d = Math.abs(h1 - h2) % 360;
    return Math.min(d, 360 - d);
  }
  // 由角度差映射到分数：dist=0 => S_MAX; dist=180 => 0
  inverseScore(distDeg) {
    const sMax = this.cfg.S_MAX;
    return Math.round(Math.max(0, sMax * (1 - distDeg / 180)));
  }
  // ---- 连续键盘移动（已修复卡顿！事件驱动，不查 keyIsDown）----
  updatePlayersFromKeyboardContinuous() {
    if (this.gameState !== "GUESS") return;
    const speedDeg = this.keyboardSpeedDegPerSec;
    const stepPerDeg = display.displaySize / 360;
    const dt = deltaTime / 1000.0;
    let deltaDegP1 = 0;
    let deltaDegP2 = 0;

    // 用状态变量（p1Left 等）驱动，不再每帧查 keyIsDown！
    if (p1Left)  deltaDegP1 -= speedDeg * dt;
    if (p1Right) deltaDegP1 += speedDeg * dt;
    if (p2Left)  deltaDegP2 -= speedDeg * dt;
    if (p2Right) deltaDegP2 += speedDeg * dt;

    if (playerOne) {
      playerOne.position =
        (playerOne.position + deltaDegP1 * stepPerDeg + display.displaySize) %
        display.displaySize;
    }
    if (playerTwo) {
      playerTwo.position =
        (playerTwo.position + deltaDegP2 * stepPerDeg + display.displaySize) %
        display.displaySize;
    }
  }
  // ---- main update ----
  update() {
    switch (this.gameState) {
      case "IDLE": {
        display.clear();
        if (this.gearTriggeredOnce()) {
          this.startMix();
        }
        break;
      }
      case "MIX": {
        display.clear();
        if (millis() - this.mixStartMs >= this.mixDurationMs) {
          this.gameState = "GUESS";
        }
        break;
      }
      case "GUESS": {
        // 每一帧根据键盘连续更新玩家位置
        this.updatePlayersFromKeyboardContinuous();
        display.clear();
        if (millis() >= this.guessEndMs) {
          this.gameState = "REVEAL";
          // set REVEAL hold window
          this.revealEndMs = millis() + this.revealDurationMs;
          // ===== 这里真正进行记分 =====
          const p1Hue = this.playerPosToHue(playerOne);
          const p2Hue = this.playerPosToHue(playerTwo);
          const d1 = this.hueCircularDistance(p1Hue, this.targetHue);
          const d2 = this.hueCircularDistance(p2Hue, this.targetHue);
          const gain1 = this.inverseScore(d1);
          const gain2 = this.inverseScore(d2);
          this.lastP1Gain = gain1;
          this.lastP2Gain = gain2;
          playerOne.score += gain1;
          playerTwo.score += gain2;
          // optional animation hook
          if (typeof collisionAnimation?.startReveal === "function") {
            collisionAnimation.startReveal(
              { targetHue: this.targetHue, p1Hue, p2Hue, gain1, gain2 },
              this.revealDurationMs
            );
          }
        }
        break;
      }
      case "REVEAL": {
        if (this.revealEndMs != null && millis() >= this.revealEndMs) {
          this.gameState = "SCORE";
        }
        break;
      }
      case "SCORE": {
        // game end?
        if (this.round >= this.cfg.maxRounds) {
          score.winner = (playerOne.score >= playerTwo.score)
            ? playerOne.playerColor
            : playerTwo.playerColor;
          // fill screen with winner color using buffer API
          display.setAllPixels(score.winner);
          if (typeof collisionAnimation?.startWinnerFlash === "function") {
            collisionAnimation.startWinnerFlash(score.winner, 1000);
          }
          // reset for a new session
          this.gameState = "IDLE";
          this.round = 1;
          if (typeof playerOne.resetAll === "function") playerOne.resetAll();
          else { playerOne.score = 0; }
          if (typeof playerTwo.resetAll === "function") playerTwo.resetAll();
          else { playerTwo.score = 0; }
        } else {
          // next round
          this.round++;
          this.gameState = "IDLE";
        }
        break;
      }
      default:
        break;
    }
  }
}

// ===================================
// 全局键盘状态变量（Lisa 专属防卡顿神器！）
let p1Left = false, p1Right = false;
let p2Left = false, p2Right = false;

// ===================================
// 事件驱动键盘处理（不再轮询，丝滑！）
function keyPressed() {
  if (key === 'a' || key === 'A') p1Left = true;
  if (key === 'd' || key === 'D') p1Right = true;
  if (key === 'j' || key === 'J') p2Left = true;
  if (key === 'l' || key === 'L') p2Right = true;
  if (key === 'r' || key === 'R') controller.latchGearTrigger();
}

function keyReleased() {
  if (key === 'a' || key === 'A') p1Left = false;
  if (key === 'd' || key === 'D') p1Right = false;
  if (key === 'j' || key === 'J') p2Left = false;
  if (key === 'l' || key === 'L') p2Right = false;
}

// ---------- Serial input hook ----------
function onSerialData(data) {
  let msg = data.trim();
  if (msg === "G") {
    controller.latchGearTrigger(); // start spin trigger
  }
  if (msg === "STOP") {
    controller.releaseGearTrigger(); // optional; currently no-op
  }
}
