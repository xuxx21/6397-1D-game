/* /////////////////////////////////////
  DESIGN 6397: Design for Physical Interaction
  October 27, 2025
  Xiaoxi Xu & Lisa (Queen of Smooth!)
*/ /////////////////////////////////////
let port;
let writer;

async function connectSerial() {
  if (!("serial" in navigator)) {
    alert("当前浏览器不支持 WebSerial（建议用 Chrome/Edge 2020 之后的版本）");
    return;
  }

  try {
    // 1. 弹出“选择端口”窗口
    const selectedPort = await navigator.serial.requestPort();
    // 如果用户点“取消”，上面这行会抛错，直接被下面 catch 接住

    // 2. 打开串口
    await selectedPort.open({ baudRate: 9600 });

    // 3. 记录全局 port / writer
    port = selectedPort;
    writer = port.writable.getWriter();

    console.log("✅ Serial connected!");
  } catch (err) {
    // 用户点了“取消” → NotFoundError
    if (err.name === "NotFoundError") {
      console.log("ℹ️ 串口连接已取消（没有选择端口）。");
    } else {
      console.error("❌ 串口连接失败：", err);
      alert("串口连接失败，可以查看控制台错误信息。");
    }
  }
}

// 用于从网页向 Arduino 发送消息
async function serialWrite(msg) {
  if (!writer) {
    console.warn("❌ Serial not connected yet");
    return;
  }
  const data = new TextEncoder().encode(msg + "\n");
  await writer.write(data);
  console.log("➡️ Sent:", msg);
}


// ====== Game Canvas / Display ======
let displaySize = 30; // number of columns (1D "pixels")
let pixelSize = 30; // visual size of each pixel（仅作内部比例使用，不再决定画布高度）
// ====== Core Objects ======
let playerOne; // Red player
let playerTwo; // Blue player
let target; // Random target hue (per round)
let display; // Aggregates frame before showing
let controller; // State machine & game logic
let collisionAnimation; // Reveal / feedback animations (placeholder)
let score; // Score & winner tracking
// ====== Game Config (for the new color-wheel guessing game) ======
let gameConfig = {
  maxRounds: 6,
  // wheel difficulty: more segments each round
  segmentsByRound: [12, 16, 24, 32, 48, 72],
  // guessing time per round (ms)
  guessTimeMsByRound: [10000, 9500, 9000, 8500, 8000, 7500],
  // scoring
  S_MAX: 100, // max points for exact match
  // MIX / SPIN (triggered by physical gear or 'R' key) uses a fixed-time animation
  spinDurationMs: 1500 // time-based animation, no physics
};


let p1Left = false, p1Right = false;
let p2Left = false, p2Right = false;

function keyPressed() {
  if (key === 'a' || key === 'A') p1Left = true;
  if (key === 'd' || key === 'D') p1Right = true;
  if (key === 'j' || key === 'J') p2Left = true;
  if (key === 'l' || key === 'L') p2Right = true;
  if (key === 'r' || key === 'R') {
    if (controller) controller.latchGearTrigger();
  }
}

function keyReleased() {
  if (key === 'a' || key === 'A') p1Left = false;
  if (key === 'd' || key === 'D') p1Right = false;
  if (key === 'j' || key === 'J') p2Left = false;
  if (key === 'l' || key === 'L') p2Right = false;
}

function setup() {
  // ✅ 改为整窗画布（不再用 1D 条带的高度）
  createCanvas(windowWidth, windowHeight);
  pixelDensity(1);
  // Initialize display
  display = new Display(displaySize, pixelSize);
  // Initialize players (use RED & BLUE as per new spec)
  // position is an index on the 1D ring (0..displaySize-1)
  playerOne = new Player(color(255, 0, 0), parseInt(random(0, displaySize)), displaySize);
  playerTwo = new Player(color(0, 0, 255), parseInt(random(0, displaySize)), displaySize);
  // Target starts as YELLOW (visual only); its hue/position will be randomized per round
  target = new Player(color(255, 255, 0), parseInt(random(0, displaySize)), displaySize);
  // Animations container (reveal, wipes, etc.)
  collisionAnimation = new Animation();
  // Controller (state machine lives here; will consume `gameConfig`)
  controller = new Controller();
  // ✅ Display.show() 里读取的是 controller.cfg，所以这里对齐字段名
  controller.cfg = gameConfig;
  // Score tracking (winner color used for screen wash)
  score = { max: gameConfig.maxRounds, winner: color(0, 0, 0) };
}

function draw() {
  // 不再在这里清屏；Display.show() 内部已调用 background(0)
  controller.update();
  display.show();
}

// ✅ 窗口大小变化时，自适应画布与显示参数
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  // 让显示半径随画布更新（Display 里用到）
  if (display) {
    display.wheelRadiusOuter = Math.max(80, Math.min(width, height) * 0.45);
    display.wheelRadiusInner = display.wheelRadiusOuter * 0.65;
    display.markerRadius = display.wheelRadiusOuter + 18;
  }
}
