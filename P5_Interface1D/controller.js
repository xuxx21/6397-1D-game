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
    this.revealDurationMs = 10000; // how long to pause on REVEAL (ms)
    this.revealEndMs = null;
    // target per round (hue in degrees 0..360)
    this.targetHue = 0;
    // 这一轮色轮的“配色偏移角度”（用来控制 REVEAL 阶段色轮的整体颜色排列）
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
    // optional: currently no-op
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
    this.wheelHueOffset = this.targetHue;
    this.mixStartMs = millis();
    this.mixDurationMs = this.cfg.spinDurationMs;
    const t = this.cfg.guessTimeMsByRound[
      Math.min(this.round - 1, this.cfg.guessTimeMsByRound.length - 1)
    ];
    this.guessEndMs = millis() + t;
    this.revealEndMs = null;
    this.lastP1Gain = 0;
    this.lastP2Gain = 0;

    if (typeof collisionAnimation?.startMix === "function") {
      collisionAnimation.startMix(this.targetHue, this.mixDurationMs);
    }
    this.gameState = "MIX";
  }

  timeLeft() {
    return Math.max(0, this.guessEndMs - millis());
  }

  // ---- scoring math ----
  playerPosToHue(player) {
    const size = player.displaySize || display.displaySize || 360;
    return (player.position % size) * (360 / size);
  }

  hueCircularDistance(h1, h2) {
    const d = Math.abs(h1 - h2) % 360;
    return Math.min(d, 360 - d);
  }

  inverseScore(distDeg) {
    const sMax = this.cfg.S_MAX;
    return Math.round(Math.max(0, sMax * (1 - distDeg / 180)));
  }

  // ---- 连续移动：用 sketch.js 的 p1Left 等变量驱动！----
  updatePlayersFromKeyboardContinuous() {
    if (this.gameState !== "GUESS") return;
    const speedDeg = this.keyboardSpeedDegPerSec;
    const stepPerDeg = display.displaySize / 360;
    const dt = deltaTime / 1000.0;
    let deltaDegP1 = 0;
    let deltaDegP2 = 0;

    if (p1Left)  deltaDegP1 -= speedDeg * dt;
    if (p1Right) deltaDegP1 += speedDeg * dt;
    if (p2Left)  deltaDegP2 -= speedDeg * dt;
    if (p2Right) deltaDegP2 += speedDeg * dt;

    if (playerOne) {
      playerOne.position = (playerOne.position + deltaDegP1 * stepPerDeg + display.displaySize) % display.displaySize;
    }
    if (playerTwo) {
      playerTwo.position = (playerTwo.position + deltaDegP2 * stepPerDeg + display.displaySize) % display.displaySize;
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
        this.updatePlayersFromKeyboardContinuous();
        display.clear();
        if (millis() >= this.guessEndMs) {
          this.gameState = "REVEAL";
          this.revealEndMs = millis() + this.revealDurationMs;

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
        if (this.round >= this.cfg.maxRounds) {
          score.winner = (playerOne.score >= playerTwo.score)
            ? playerOne.playerColor
            : playerTwo.playerColor;
          display.setAllPixels(score.winner);
          if (typeof collisionAnimation?.startWinnerFlash === "function") {
            collisionAnimation.startWinnerFlash(score.winner, 1000);
          }
          this.gameState = "IDLE";
          this.round = 1;
          playerOne.score = 0;
          playerTwo.score = 0;
        } else {
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

// ---------- Serial input hook ----------
function onSerialData(data) {
  let msg = data.trim();
  if (msg === "G") {
    controller.latchGearTrigger();
  }
  if (msg === "STOP") {
    controller.releaseGearTrigger();
  }
}
