/* /////////////////////////////////////

  DESIGN 6397: Design for Physical Interaction
  October 27, 2025
  Xiaoxi Xu

*/ /////////////////////////////////////


// ====== Game Canvas / Display ======
let displaySize = 30;   // number of columns (1D "pixels")
let pixelSize   = 30;   // visual size of each pixel

// ====== Core Objects ======
let playerOne;          // Red player
let playerTwo;          // Blue player
let target;             // Random target hue (per round)

let display;            // Aggregates frame before showing
let controller;         // State machine & game logic
let collisionAnimation; // Reveal / feedback animations (placeholder)
let score;              // Score & winner tracking

// ====== Game Config (for the new color-wheel guessing game) ======
let gameConfig = {
  maxRounds: 6,
  // wheel difficulty: more segments each round
  segmentsByRound: [12, 16, 24, 32, 48, 72],
  // guessing time per round (ms)
  guessTimeMsByRound: [6000, 5500, 5000, 4500, 4000, 3500],
  // scoring
  S_MAX: 100,          // max points for exact match
  // MIX / SPIN (triggered by physical gear or 'R' key) uses a fixed-time animation
  spinDurationMs: 1500 // time-based animation, no physics
};

function setup() {
  createCanvas(displaySize * pixelSize, pixelSize); // 1D interface

  // Initialize display
  display = new Display(displaySize, pixelSize);

  // Initialize players (use RED & BLUE as per new spec)
  // position is an index on the 1D ring (0..displaySize-1)
  playerOne = new Player(color(255, 0, 0),   parseInt(random(0, displaySize)), displaySize);
  playerTwo = new Player(color(0, 0, 255),   parseInt(random(0, displaySize)), displaySize);

  // Target starts as YELLOW (visual only); its hue/position will be randomized per round
  target    = new Player(color(255, 255, 0), parseInt(random(0, displaySize)), displaySize);

  // Animations container (reveal, wipes, etc.)
  collisionAnimation = new Animation();

  // Controller (state machine lives here; will consume `gameConfig`)
  controller = new Controller();
  controller.gameConfig = gameConfig; // expose config to controller

  // Score tracking (winner color used for screen wash)
  score = { max: gameConfig.maxRounds, winner: color(0, 0, 0) };

  // Optional: consistent frame rate for smoother UI
  // frameRate(60);
}

function draw() {
  // Clear background
  background(0);

  // Update state machine (IDLE → MIX → GUESS → REVEAL → SCORE → NEXT_ROUND)
  controller.update();

  // Render current frame (Display is the only place that writes to screen)
  display.show();
}


