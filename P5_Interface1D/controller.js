// This is where your state machines and game logic lives
// ===================================================
// Controller.js — game logic + LED serial integration
// For: 1D Color-Wheel Guessing Game
// Author: Xiaoxi Xu 
// ===================================================

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
    this.revealDurationMs = 3000; // how long to pause on REVEAL (ms)
    this.revealEndMs = null;
    this.revealLedOffSent = false; // 🆕 REVEAL 阶段结束时是否已经关过灯

    // 色相配置
    this.targetHue = 0;
    this.wheelHueOffset = 0;
    this.redBaseHue  = this.cfg.redBaseHue  ?? 0;
    this.blueBaseHue = this.cfg.blueBaseHue ?? 240;
    this.redTargetAngleDeg  = 0;
    this.blueTargetAngleDeg = 0;

    // trigger latch
    this._gearTriggerLatched = false;

    // speed
    this.keyboardSpeedDegPerSec = this.cfg.keyboardSpeedDegPerSec || 220;

    // scores
    this.lastP1Gain = 0;
    this.lastP2Gain = 0;
  }

  // ---- hardware / keyboard triggers ----
  latchGearTrigger() {
    this._gearTriggerLatched = true;
  }

  releaseGearTrigger() {
    // optional
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
    // 随机“旋转后顶部颜色”
    this.targetHue = random(0, 360);
    this.wheelHueOffset = this.targetHue;

    this.redTargetAngleDeg  = (this.redBaseHue  - this.targetHue + 360) % 360;
    this.blueTargetAngleDeg = (this.blueBaseHue - this.targetHue + 360) % 360;

    this.mixStartMs = millis();
    this.mixDurationMs = this.cfg.spinDurationMs;

    const t = this.cfg.guessTimeMsByRound[
      Math.min(this.round - 1, this.cfg.guessTimeMsByRound.length - 1)
    ];
    this.guessEndMs = millis() + t;

    this.revealEndMs = null;
    this.revealLedOffSent = false; // 🆕 新一轮开始，重置关灯标记
    this.lastP1Gain = 0;
    this.lastP2Gain = 0;

    if (typeof collisionAnimation?.startMix === "function") {
      collisionAnimation.startMix(this.targetHue, this.mixDurationMs);
    }

    // === MIX 启动前先关一次灯，保证状态干净 ===
    serialWrite("LED:OFF");
    // 然后转盘开始旋转：灯带彩虹跑动
    serialWrite("LED:RAINBOW");

    this.gameState = "MIX";
  }

  timeLeft() {
    return Math.max(0, this.guessEndMs - millis());
  }

  // ---- scoring math ----
  playerPosToAngleDeg(player) {
    const size = player.displaySize || display.displaySize || 360;
    return (player.position % size) * (360 / size);
  }

  hueCircularDistance(a1, a2) {
    const d = Math.abs(a1 - a2) % 360;
    return Math.min(d, 360 - d);
  }

  inverseScore(distDeg) {
    const sMax = this.cfg.S_MAX;
    return Math.round(Math.max(0, sMax * (1 - distDeg / 180)));
  }

  // ---- player movement ----
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
      // ---------------------------
      case "IDLE": {
        display.clear();
        if (this.gearTriggeredOnce()) {
          this.startMix();
        }
        break;
      }

      // ---------------------------
      case "MIX": {
        display.clear();
        if (millis() - this.mixStartMs >= this.mixDurationMs) {
          this.gameState = "GUESS";

          // === MIX→GUESS：关灯（从彩虹切到纯游戏）===
          serialWrite("LED:OFF");
        }
        break;
      }

      // ---------------------------
      case "GUESS": {
        this.updatePlayersFromKeyboardContinuous();
        display.clear();

        if (millis() >= this.guessEndMs) {
          this.gameState = "REVEAL";
          this.revealEndMs = millis() + this.revealDurationMs;
          this.revealLedOffSent = false; // 🆕 每次进入 REVEAL 重置

          const p1Angle = this.playerPosToAngleDeg(playerOne);
          const p2Angle = this.playerPosToAngleDeg(playerTwo);

          const d1 = this.hueCircularDistance(p1Angle, this.redTargetAngleDeg);
          const d2 = this.hueCircularDistance(p2Angle, this.blueTargetAngleDeg);

          const gain1 = this.inverseScore(d1);
          const gain2 = this.inverseScore(d2);

          this.lastP1Gain = gain1;
          this.lastP2Gain = gain2;

          playerOne.score += gain1;
          playerTwo.score += gain2;

          if (typeof collisionAnimation?.startReveal === "function") {
            collisionAnimation.startReveal(
              {
                wheelOffsetHue: this.targetHue,
                redTargetAngle: this.redTargetAngleDeg,
                blueTargetAngle: this.blueTargetAngleDeg,
                p1Angle,
                p2Angle,
                gain1,
                gain2
              },
              this.revealDurationMs
            );
          }

          // === GUESS→REVEAL：赢家闪灯 ===
          if (gain1 > gain2)      serialWrite("LED:RED");
          else if (gain2 > gain1) serialWrite("LED:BLUE");
          else                    serialWrite("LED:OFF");
        }
        break;
      }

      // ---------------------------
      case "REVEAL": {
        // 在 REVEAL 时间内仅由 Arduino 去负责闪烁
        if (this.revealEndMs != null && millis() >= this.revealEndMs) {
          // === REVEAL 结束：只关一次灯 ===
          if (!this.revealLedOffSent) {
            serialWrite("LED:OFF");
            this.revealLedOffSent = true;
          }
          this.gameState = "SCORE";
        }
        break;
      }

      // ---------------------------
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

      // ---------------------------
      default:
        break;
    }
  }
}

// ---------- Serial input hook ----------
function onSerialData(data) {
  let msg = data.trim();
  if (msg === "G") controller.latchGearTrigger();
  if (msg === "STOP") controller.releaseGearTrigger();
}

// ---------- Serial output helper ----------
function serialWrite(msg) {
  try {
    if (window.serial && typeof window.serial.write === "function") {
      window.serial.write(msg + "\n");
    } else if (typeof serial !== "undefined" && serial?.write) {
      serial.write(msg + "\n");
    } else {
      console.log("[SERIAL OUT]", msg);
    }
  } catch (e) {
    console.warn("Serial write failed:", e);
  }
}
