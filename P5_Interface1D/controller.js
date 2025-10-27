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

    // REVEAL timing (new)
    this.revealDurationMs = 2000; // how long to pause on REVEAL (ms)
    this.revealEndMs = null;

    // target per round
    this.targetHue = 0;

    // hardware trigger latch
    this._gearTriggerLatched = false;
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
    this.targetHue = random(0, 360);
    this.mixStartMs = millis();
    this.mixDurationMs = this.cfg.spinDurationMs;

    const t = this.cfg.guessTimeMsByRound[
      Math.min(this.round - 1, this.cfg.guessTimeMsByRound.length - 1)
    ];
    this.guessEndMs = millis() + t;

    // reset reveal timing
    this.revealEndMs = null;

    this.gameState = "MIX";
  }

  // remaining ms for GUESS (for HUD)
  timeLeft() {
    return Math.max(0, this.guessEndMs - millis());
  }

  // ---- scoring math ----
  hueCircularDistance(h1, h2) {
    const d = Math.abs(h1 - h2) % 360;
    return Math.min(d, 360 - d);
  }

  inverseScore(distDeg) {
    const sMax = this.cfg.S_MAX;
    return Math.round(Math.max(0, sMax * (1 - distDeg / 180)));
  }

  posToHue(pos) {
    return (pos % displaySize) * (360 / displaySize);
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
        display.clear();
        // show two players' markers (display.js will also render HUD/time)
        display.setPixel(playerOne.position, playerOne.playerColor);
        display.setPixel(playerTwo.position, playerTwo.playerColor);

        if (millis() >= this.guessEndMs) {
          this.gameState = "REVEAL";
          // set REVEAL hold window
          this.revealEndMs = millis() + this.revealDurationMs;

          // (Compute and apply scores now so HUD可立即显示累计分)
          const p1Hue = this.posToHue(playerOne.position);
          const p2Hue = this.posToHue(playerTwo.position);
          const d1 = this.hueCircularDistance(p1Hue, this.targetHue);
          const d2 = this.hueCircularDistance(p2Hue, this.targetHue);
          playerOne.score += this.inverseScore(d1);
          playerTwo.score += this.inverseScore(d2);
        }
        break;
      }

      case "REVEAL": {
        // display.js 会根据 controller.targetHue / 玩家位置绘制完整色轮与弧线
        // 我们只负责计时：停留到 revealEndMs 再进入 SCORE
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

          // reset for a new session
          this.gameState = "IDLE";
          this.round = 1;
          playerOne.score = 0;
          playerTwo.score = 0;
        } else {
          // next round: wait for next gear trigger
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


// ---------- Keyboard fallback ----------
function keyPressed() {
  if (controller.gameState === "GUESS") {
    if (key === 'A' || key === 'a') playerOne.move(-1);
    if (key === 'D' || key === 'd') playerOne.move(1);
    if (key === 'J' || key === 'j') playerTwo.move(-1);
    if (key === 'L' || key === 'l') playerTwo.move(1);
  }

  if (key === 'R' || key === 'r') {
    controller.latchGearTrigger(); // same as encoder "G"
  }
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

// 硬件提示（旋转编码器）
// 接线：
// CLK → D2
// DT  → D3
// VCC → 5V
// GND → GND