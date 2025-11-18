#include <Keyboard.h>
#include <Adafruit_NeoPixel.h>

/* ────────────────────── 编码器引脚 ────────────────────── */
#define P1_CLK   2   // 红方 S1 (CLK)
#define P1_DT    3   // 红方 S2 (DT)
#define P1_CW    'd' // 红方顺时针 → d
#define P1_CCW   'a' // 红方逆时针 → a

#define P2_CLK   4   // 蓝方 S1 (CLK)
#define P2_DT    5   // 蓝方 S2 (DT)
#define P2_CW    'l' // 蓝方顺时针 → l
#define P2_CCW   'j' // 蓝方逆时针 → j

/* ────────────────────── 按钮引脚 ────────────────────── */
#define BTN_PIN   9          // 按钮接在这里
#define BTN_KEY   'R'        // 按下时发送的键（大写 R）

/* ────────────────────── 其它参数 ────────────────────── */
const unsigned long STEP_INTERVAL = 45;   // 编码器防抖间隔（ms）
const unsigned long DEBOUNCE_MS   = 20;   // 按钮防抖时间（ms）

/* ────────────────────── 编码器结构体 ────────────────────── */
struct Encoder {
  uint8_t clk, dt;
  char cw_key, ccw_key;
  int last_clk;
  unsigned long last_step;
};

Encoder red  = {P1_CLK, P1_DT, P1_CW, P1_CCW, LOW, 0};
Encoder blue = {P2_CLK, P2_DT, P2_CW, P2_CCW, LOW, 0};

/* ────────────────────── 按钮状态变量 ────────────────────── */
bool btn_last   = HIGH;           // 上一次读取的电平（内部上拉 → 默认 HIGH）
unsigned long btn_change_time = 0; // 电平变化时间戳（用于防抖）

/* ────────────────────── 灯带配置 ────────────────────── */
#define LED_PIN    6         // WS2812E DIN 接在 D6
#define LED_COUNT  60        // ⚠️ 改成你的灯珠数量

Adafruit_NeoPixel strip(LED_COUNT, LED_PIN, NEO_GRB + NEO_KHZ800);

enum LedMode { LED_OFF, LED_RAINBOW, LED_FLASH_RED, LED_FLASH_BLUE };
LedMode ledMode = LED_OFF;
unsigned long ledLastUpdate = 0;
uint16_t rainbowOffset = 0;
bool flashOn = false;

// 串口行缓冲
String serialLine = "";

/* ────────────────────── 按键函数（带保持时间） ────────────────────── */
static inline void tap(char k) {
  if (k == 0) return;
  Keyboard.press(k);
  delay(35);               // 模拟真实按键
  Keyboard.release(k);
}

/* ────────────────────── 编码器处理 ────────────────────── */
void handleEncoder(Encoder &e) {
  int clk_now = digitalRead(e.clk);

  if (clk_now == HIGH && e.last_clk == LOW) {               // 上升沿
    unsigned long now = millis();
    if (now - e.last_step >= STEP_INTERVAL) {              // 防抖 + 限速
      if (digitalRead(e.dt) != clk_now) tap(e.cw_key);     // 顺时针
      else                              tap(e.ccw_key);    // 逆时针
      e.last_step = now;
    }
  }
  e.last_clk = clk_now;
}

/* ────────────────────── 按钮处理（防抖） ────────────────────── */
void handleButton() {
  bool reading = digitalRead(BTN_PIN);

  if (reading != btn_last) {
    // 电平变化，记录时间
    btn_change_time = millis();
  }

  // 电平从 HIGH 变 LOW，且经过了防抖时间 → 认为是“按下”
  if (reading == LOW && btn_last == HIGH &&
      (millis() - btn_change_time) > DEBOUNCE_MS) {
    tap(BTN_KEY);                // 发送 R（大写）
  }

  btn_last = reading;            // 更新上一次状态
}

/* ────────────────────── 灯带：模式切换 ────────────────────── */
void setLedMode(LedMode mode) {
  ledMode = mode;
  ledLastUpdate = millis();
  flashOn = false;

  if (mode == LED_OFF) {
    strip.clear();
    strip.show();
  }
}

/* ────────────────────── 灯带：彩虹跑动一步 ────────────────────── */
void rainbowStep() {
  for (int i = 0; i < LED_COUNT; i++) {
    int hue = (i * 256 / LED_COUNT + rainbowOffset) & 255;
    strip.setPixelColor(i, strip.gamma32(strip.ColorHSV(hue * 256)));
  }
  strip.show();
  rainbowOffset++;
}

/* ────────────────────── 灯带：每帧更新 ────────────────────── */
void updateLEDs() {
  unsigned long now = millis();

  switch (ledMode) {
    case LED_OFF:
      break;

    case LED_RAINBOW:
      if (now - ledLastUpdate > 30) {      // 彩虹移动速度
        ledLastUpdate = now;
        rainbowStep();
      }
      break;

    case LED_FLASH_RED:
      if (now - ledLastUpdate > 250) {
        ledLastUpdate = now;
        flashOn = !flashOn;
        strip.fill(flashOn ? strip.Color(255, 0, 0) : 0, 0, LED_COUNT);
        strip.show();
      }
      break;

    case LED_FLASH_BLUE:
      if (now - ledLastUpdate > 250) {
        ledLastUpdate = now;
        flashOn = !flashOn;
        strip.fill(flashOn ? strip.Color(0, 0, 255) : 0, 0, LED_COUNT);
        strip.show();
      }
      break;
  }
}

/* ────────────────────── 串口命令解析 ────────────────────── */
// 兼容两套命令：
// 1) 游戏用："LED:RAINBOW", "LED:OFF", "LED:RED", "LED:BLUE"
// 2) 简化测试："RED", "BLUE", "OFF"
void handleSerialCommand(const String &raw) {
  String cmd = raw;
  cmd.trim();

  if (cmd == "LED:RAINBOW" || cmd == "RAINBOW") {
    setLedMode(LED_RAINBOW);
  } else if (cmd == "LED:OFF" || cmd == "OFF") {
    setLedMode(LED_OFF);
  } else if (cmd == "LED:RED" || cmd == "RED") {
    setLedMode(LED_FLASH_RED);
  } else if (cmd == "LED:BLUE" || cmd == "BLUE") {
    setLedMode(LED_FLASH_BLUE);
  }
}

/* ────────────────────── setup ────────────────────── */
void setup() {
  Serial.begin(9600);

  /* 编码器引脚（你已经验证过的写法） */
  pinMode(red.clk,  INPUT);
  pinMode(red.dt,   INPUT);
  pinMode(blue.clk, INPUT);
  pinMode(blue.dt,  INPUT);

  red.last_clk  = digitalRead(red.clk);
  blue.last_clk = digitalRead(blue.clk);

  /* 按钮引脚（内部上拉） */
  pinMode(BTN_PIN, INPUT_PULLUP);

  /* 键盘功能 */
  Keyboard.begin();

  /* 灯带初始化 */
  strip.begin();
  strip.show();
  setLedMode(LED_OFF);
}

/* ────────────────────── loop ────────────────────── */
void loop() {
  // 1. 编码器 → 键盘输入
  handleEncoder(red);
  handleEncoder(blue);

  // 2. 按钮 → 键盘 R
  handleButton();

  // 3. 串口命令 → 灯带
  while (Serial.available() > 0) {
    char c = (char)Serial.read();
    if (c == '\n' || c == '\r') {
      if (serialLine.length() > 0) {
        handleSerialCommand(serialLine);
        serialLine = "";
      }
    } else {
      serialLine += c;
    }
  }

  // 4. 更新灯效
  updateLEDs();
}
