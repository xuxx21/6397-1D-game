# 6397-1Dgame
Cici &amp; Lisa &amp; Lexie 

# 1D Interface

A 1D Interface is a graphical user interface made from a single row of pixels and where it's NOT possible to display symbolic content (e.g. text, icons, etc).

Its simplicity provides a great platform for learning some of the fundamental ideas behind interface design.

# Instructions

1. Download and install Visual Studio Code and install the [Live Server](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer) extension
2. Install Chrome
3. Download this game.
4. Run it by dragging/dropping the entire folder in Visual Studio Code and clicking on the 'Go Live' button at the bottom right of the screen.
5. Instructions for playing the game:
   - Keyboard keys **A** and **D** move Red Player left and right.
   - Keys **J** and **L** move Blue Player.
   - First player to catch the Yellow Target 3 times wins.
   - Winning color takes over the screen.
   - Press **R** for re-starting the game.


# Concepts

### Feedback

Every action gets an immediate reaction. Turning the physical gear (or pressing R on the keyboard) triggers the color wheel to spin on screen. Each player’s pointer movement is also reflected immediately. When time’s up, the wheel reveals and scores flash next to each pointer so players see why they gained/lost points.

### Spatial Mapping

The play space is a continuous color circle (Hue 0–360). Positions wrap: moving past 360° returns to 0°. 
Each physical pointer is color-coded and shaped to match its on-screen marker (e.g., red triangle ↔ red player; blue square ↔ blue player) to avoid confusion.

### Relationships

Forms and colors stay consistent: the red physical pointer → red on-screen marker; blue pointer → blue marker. When a player wins the round, a subtle screen wash in their color confirms it.

### States

IDLE → SPIN → GUESS → REVEAL → SCORE → NEXT_ROUND (or GAME_OVER).


# Interface Architecture

1.Interface structure (state machine, events, timing).
2.Game structure (rounds, target color, scoring, difficulty).
3.Hardware particularities (keyboard fallback， dual-pointer joystick).

## Logic
All main parts are objects:

**Player**
Data: id, name, huePosition (0–360), score.
Methods: move(step), setTo(hue), resetRound().

**Target**
Data: hue (random each round),segments (difficulty), visibleTopHue.
Methods: randomize(), reveal(),spinAndSetTopHue(), maskExceptTop().

**Controller**
Owns the state machine, timers, and difficulty ramp.
Data: gameState, round, maxRounds, guessTimeMs, segments.
Methods: update(), nextState(), scoreRound(), triggerSpin() (gear turn or R key), pollJoystick(), handleKey().

**Display**
Renders wheel, masked view, two player markers, timers, and reveal/score animations.
displayBuffer is the only thing that writes to screen.

**Scoring (inverse proportional on circular hue)**
Circular distance:
dist = min( abs(h1 - h2), 360 - abs(h1 - h2) )

Inverse score:
score = round( max(0, S_max * (1 - dist / 180)) )

S_max = max points (e.g., 100). Exact match (dist=0) gives full points.

**Difficulty Progression**
Across rounds increase:
segments (finer wheel granularity).
guessTimeMs decreases.

## Input

**Keyboard fallback**
Keyboard input is under controller.js

```javascript
function keyPressed() {
  if (key == "A" || key == "a") playerOne.move(-1);
  if (key == "D" || key == "d") playerOne.move(1);

  if (key == "J" || key == "j") playerTwo.move(-1);
  if (key == "L" || key == "l") playerTwo.move(1);

  if (key == "R" || key == "r") controller.triggerSpin();
}
```

**Physical gear**
One signal: triggerSpin() when gear is turned.
No velocity/physics, just a boolean event.

**Physical pointer**
Poll two analog channels (one per physical pointer), map to hue deltas:
Δhue = k * analogDelta (wrap 0–360).
Debounce / dead-zone small jitter.

HardwareAdapter emits the same move(step) calls used by keyboard.

## Output

Visual output is handled by display.js

Frames are created, manipulated and stored in the array:

```javascript
this.displayBuffer = [];
```

Only show() draws::

```javascript
show() {
  for (let i = 0; i < this.displaySize; i++) {
    fill(this.displayBuffer[i]);
    rect(i * this.pixelSize, 0, this.pixelSize, this.pixelSize);
  }
}

```

**UI overlays**

Top mask showing only the “12 o’clock” segment (during SPIN).
Two colored markers (during GUESS).
Reveal sweep + numeric distances (during REVEAL/SCORE).
Round/score HUD.

## State Machine

The state machine for the 1D Interface looks like this:

```
 IDLE ── gear/keyboard trigger ─▶ SPIN ── auto ─▶ GUESS ── timer ─▶ REVEAL ─▶ SCORE ─▶ NEXT_ROUND
   ▲                                                                                   │
   └────────────────────────────────────────────── game over (rounds reached) ◀────────┘

```
· IDLE: Show title/instructions.
· SPIN: Triggered by gear turn or R; wheel “spins” visually and lands on a random top hue.
· GUESS: Players move their markers (keyboard/joystick). Countdown shown.
· REVEAL: Wheel unmasks; show target & guesses; animate distances.
· SCORE: Apply circular distance scoring; update totals.
· NEXT_ROUND: Increase difficulty, loop back or end.

It uses a switch statement to separate and transition between each individual state. The switch statement is called at every single frame by the main 

**Frame loop** 
```javascript
function draw() {
  background(0);
  controller.update(); // runs state machine
  display.show();      // reflect current state
}
```

**Example controller switch (key parts changed)**
```javascript
switch (this.gameState) {
  case "IDLE":
    display.renderIdle();
    if (hardwareAdapter.spinTriggered()) this.startMix();
    break;

  case "MIX":
    colorWheel.updateSpin();     // time-based, no physics
    colorWheel.maskExceptTop();
    if (!colorWheel.spinning) this.gameState = "GUESS";
    break;

  case "GUESS":
    hardwareAdapter.pollPointers();
    display.renderGuessUI(this.timeLeft());
    if (this.timeLeft() <= 0) this.gameState = "REVEAL";
    break;

  case "REVEAL":
    display.playReveal(target.hue, playerOne.huePosition, playerTwo.huePosition);
    if (display.revealDone()) this.gameState = "SCORE";
    break;

  case "SCORE":
    this.scoreRound();
    display.renderScorePopup();
    this.gameState = this.hasMoreRounds() ? "NEXT_ROUND" : "IDLE";
    break;

  case "NEXT_ROUND":
    this.bumpDifficulty();
    this.prepareNextRound();
    this.gameState = "MIX";
    break;
}

```
**Helper: startMix**
```javascript
startMix() {
  target.randomize();                        // 1) pick hidden target hue
  colorWheel.startSpin(1500);                // 2) fixed-time spin (e.g., 1.5s)
  this.startGuessTimer(this.guessTimeMs);    // 3) prep next state's timer
  this.gameState = "MIX";
}
```

**Helper: ColorWheel timed spin**
```javascript
startSpin(durationMs) {
  this.spinning = true;
  this.spinStartTime = millis();
  this.spinDurationMs = durationMs;
  this.startAngle = random(0, 360);
  this.endAngle   = random(0, 360); // final resting angle is randomized
}

updateSpin() {
  if (!this.spinning) return;
  const t = constrain((millis() - this.spinStartTime) / this.spinDurationMs, 0, 1);
  // ease-out for nicer feel
  const e = 1 - pow(1 - t, 3);
  this.angle = (this.startAngle + e * ((this.endAngle - this.startAngle + 360) % 360)) % 360;
  if (t >= 1) this.spinning = false;
}
```

## Animations

**Reveal animation**
· Radial wipe reveals the whole wheel.
· Distance arcs grow from each player’s marker to the hidden target hue.
· Quick color wash toward the leading player, then settle to HUD.

# What we should do next...

1. Read Daniel's code and Try to make some modifications, for example:
   * Change the color of a player
   * Make the display longer
   * Add more players or more targets
   * Add a new state to the game
     
   p5js tutorial [Coding Train](https://www.youtube.com/playlist?list=PLRqwX-V7Uu6Zy51Q-x9tMWIv9cueOFTFA)

2. Try creating our own game and behaviors...
