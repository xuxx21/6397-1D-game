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

    // keyboard move speed (deg/sec)
    this.keyboardSpeedDegPerSec = this.cfg.keyboardSpeedDegPerSec || 220;

    // 记录每一回合新加的分数，用于在 REVEAL 阶段显示
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
    this.targetHue = random(0, 360);
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

  inverseScore(distDeg) {
    const sMax = this.cfg.S_MAX;
    return Math.round(Math.max(0, sMax * (1 - distDeg / 180)));
  }

  // ---- 连续键盘移动（解决延时/卡顿的关键） ----
  updatePlayersFromKeyboardContinuous() {
    if (this.gameState !== "GUESS") return;

    const speedDeg = this.keyboardSpeedDegPerSec;
    const stepPerDeg = display.displaySize / 360;
    const dt = deltaTime / 1000.0;

    let deltaDegP1 = 0;
    let deltaDegP2 = 0;

    // P1: A / D
    if (keyIsDown(65)) deltaDegP1 -= speedDeg * dt; // 'A'
    if (keyIsDown(68)) deltaDegP1 += speedDeg * dt; // 'D'

    // P2: J / L
    if (keyIsDown(74)) deltaDegP2 -= speedDeg * dt; // 'J'
    if (keyIsDown(76)) deltaDegP2 += speedDeg * dt; // 'L'

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


// ---------- Keyboard fallback ----------
function keyPressed() {
  // 现在只用键盘 R 来触发回合；玩家移动在 update() 里连续更新
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

  // 可以在这里解析 P1/P2 的硬件消息
  // if (msg.startsWith("P1:")) { playerOne.move(parseInt(msg.split(":")[1] || "0", 10) || 0); }
  // if (msg.startsWith("P2:")) { playerTwo.move(parseInt(msg.split(":")[1] || "0", 10) || 0); }
}