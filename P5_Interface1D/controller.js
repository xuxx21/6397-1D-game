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
  hueCircularDistance(h1, h2) {
    const d = Math.abs(h1 - h2) % 360;
    return Math.min(d, 360 - d);
  }

  inverseScore(distDeg) {
    const sMax = this.cfg.S_MAX;
    return Math.round(Math.max(0, sMax * (1 - distDeg / 180)));
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
        // display.js 会在 GUESS 阶段绘制灰轮廓 + 玩家指针 + 倒计时 HUD
        display.clear();

        if (millis() >= this.guessEndMs) {
          this.gameState = "REVEAL";
          // set REVEAL hold window
          this.revealEndMs = millis() + this.revealDurationMs;

          // compute & apply scores now so HUD can show totals during REVEAL
          const p1Hue = playerOne.getHue();
          const p2Hue = playerTwo.getHue();
          const d1 = this.hueCircularDistance(p1Hue, this.targetHue);
          const d2 = this.hueCircularDistance(p2Hue, this.targetHue);
          playerOne.score += this.inverseScore(d1);
          playerTwo.score += this.inverseScore(d2);

          // optional animation hook
          if (typeof collisionAnimation?.startReveal === "function") {
            collisionAnimation.startReveal(
              { targetHue: this.targetHue, p1Hue, p2Hue },
              this.revealDurationMs
            );
          }
        }
        break;
      }

      case "REVEAL": {
        // display.js 会根据 controller.targetHue / 玩家 hue 绘制完整色轮与弧线 + 环形倒计时
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

          // optional winner flash
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
    // 每次移动 1°（需要更灵敏就改成 2 或 3）
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

  // 也可以扩展：解析 "P1:+1" / "P2:-1" 来直接移动玩家指针
  // if (msg.startsWith("P1:")) { playerOne.move(parseInt(msg.split(":")[1] || "0", 10) || 0); }
  // if (msg.startsWith("P2:")) { playerTwo.move(parseInt(msg.split(":")[1] || "0", 10) || 0); }
}

// 硬件提示（旋转编码器）
// 接线：
// CLK → D2
// DT  → D3
// VCC → 5V
// GND → GND