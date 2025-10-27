// This is where your state machines and game logic lives

class Controller {

  constructor() {
    this.gameState = "IDLE";
    this.round = 1;

    this.cfg = gameConfig;

    this.mixStartMs = 0;
    this.mixDurationMs = this.cfg.spinDurationMs;
    this.guessEndMs = 0;

    this.targetHue = 0;

    this._gearTriggerLatched = false;
  }

  latchGearTrigger() {
    this._gearTriggerLatched = true;
  }

  gearTriggeredOnce() {
    if (this._gearTriggerLatched) {
      this._gearTriggerLatched = false;
      return true;
    }
    return false;
  }

  startMix() {
    this.targetHue = random(0, 360);
    this.mixStartMs = millis();
    this.mixDurationMs = this.cfg.spinDurationMs;

    const t = this.cfg.guessTimeMsByRound[Math.min(this.round-1, this.cfg.guessTimeMsByRound.length-1)];
    this.guessEndMs = millis() + t;

    this.gameState = "MIX";
  }

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
        display.setPixel(playerOne.position, playerOne.playerColor);
        display.setPixel(playerTwo.position, playerTwo.playerColor);

        if (millis() >= this.guessEndMs) {
          this.gameState = "REVEAL";
        }
        break;
      }

      case "REVEAL": {
        const p1Hue = this.posToHue(playerOne.position);
        const p2Hue = this.posToHue(playerTwo.position);

        const d1 = this.hueCircularDistance(p1Hue, this.targetHue);
        const d2 = this.hueCircularDistance(p2Hue, this.targetHue);

        playerOne.score += this.inverseScore(d1);
        playerTwo.score += this.inverseScore(d2);

        this.gameState = "SCORE";
        break;
      }

      case "SCORE": {
        if (this.round >= this.cfg.maxRounds) {
          score.winner = (playerOne.score >= playerTwo.score) ? playerOne.playerColor : playerTwo.playerColor;
          display.setAllPixels(score.winner);

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


// ---------- Keyboard fallback ----------
function keyPressed() {
  if (controller.gameState === "GUESS") {
    if (key === 'A' || key === 'a') playerOne.move(-1);
    if (key === 'D' || key === 'd') playerOne.move(1);
    if (key === 'J' || key === 'j') playerTwo.move(-1);
    if (key === 'L' || key === 'l') playerTwo.move(1);
  }

  if (key === 'R' || key === 'r') {
    controller.latchGearTrigger();
  }
}


// ---------- Serial input hook ----------
function onSerialData(data) {
  let msg = data.trim();

  if (msg === "G") {
    controller.latchGearTrigger(); // 开始旋转
  }

  if (msg === "STOP") {
    controller.releaseGearTrigger(); // 旋转停止（可选）
  }
}

//硬件提示（旋转编码器）
//接线：
//CLK → D2
//DT → D3
//VCC → 5V
//GND → GND

