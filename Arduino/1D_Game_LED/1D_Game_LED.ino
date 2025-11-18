#include <Keyboard.h>
#include <Adafruit_NeoPixel.h>

// ============ 旋钮 & 按键配置（根据你的硬件改） ============
// 红方编码器
#define P1_CLK   2   // 红方 S1 (CLK)
#define P1_DT    3   // 红方 S2 (DT)
#define P1_CW    'd' // 红方顺时针 → d
#define P1_CCW   'a' // 红方逆时针 → a

// 蓝方编码器
#define P2_CLK   4   // 蓝方 S1
#define P2_DT    5   // 蓝方 S2 (DT)
#define P2_CW    'l' // 蓝方顺时针 → l
#define P2_CCW   'j' // 蓝方逆时针 → j

// 开始按钮（按下发 'r'）
#define START_BTN_PIN 7

// 降频防抖：每 STEP_INTERVAL 毫秒最多触发一次旋钮“步进”
const unsigned long STEP_INTERVAL = 45;

// ============ WS2812E 灯带配置 ============
#define LED_PIN    6
#define LED_COUNT  30   // ⚠️ 改成你的灯珠数量

Adafruit_NeoPixel strip(LED_COUNT, LED_PIN, NEO_GRB + NEO_KHZ800);

// 灯带模式
enum LedMode { LED_OFF, LED_RAINBOW, LED_FLASH_RED, LED_FLASH_BLUE };
LedMode ledMode = LED_OFF;
unsigned long ledLastUpdate = 0;
uint16_t rainbowOffset = 0;
bool flashOn = false;

// 串口读取缓冲
String serialLine = "";

// ============ 旋钮结构体 ============
struct Encoder {
  uint8_t pinCLK;
  uint8_t pinDT;
  char keyCW;
  char keyCCW;
  int lastState;
  unsigned long lastStepTime;
};

Encoder enc1, enc2;

// ============ 函数声明 ============
void initEncoder(Encoder &enc, uint8_t clk, uint8_t dt, char cw, char ccw);
void updateEncoder(Encoder &enc);
void handleSerialCommand(const String &cmd);
void updateLEDs();
void rainbowStep();
void setLedMode(LedMode mode);

// ============ setup ============
void setup() {
  // 键盘 & 串口
  Keyboard.begin();
  Serial.begin(9600);

  // 旋钮初始化
  initEncoder(enc1, P1_CLK, P1_DT, P1_CW, P1_CCW);
  initEncoder(enc2, P2_CLK, P2_DT, P2_CW, P2_CCW);

  // 开始按钮
  pinMode(START_BTN_PIN, INPUT_PULLUP);

  // 灯带初始化
  strip.begin();
  strip.show(); // 全部关灯
  setLedMode(LED_OFF);
}

// ============ loop ============
void loop() {
  // 1) 处理旋钮 → 键盘输入
  updateEncoder(enc1);
  updateEncoder(enc2);

  // 2) 处理开始按钮 → 键盘 'r'
  static int lastBtnState = HIGH;
  int btnState = digitalRead(START_BTN_PIN);
  if (lastBtnState == HIGH && btnState == LOW) {
    // 按下瞬间触发 'r'
    Keyboard.press('r');
    delay(5);
    Keyboard.release('r');
  }
  lastBtnState = btnState;

  // 3) 处理串口指令，用于 LED 控制
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

  // 4) 更新 LED 动画
  updateLEDs();
}

// ============ 旋钮相关函数 ============
void initEncoder(Encoder &enc, uint8_t clk, uint8_t dt, char cw, char ccw) {
  enc.pinCLK = clk;
  enc.pinDT = dt;
  enc.keyCW = cw;
  enc.keyCCW = ccw;
  pinMode(enc.pinCLK, INPUT_PULLUP);
  pinMode(enc.pinDT, INPUT_PULLUP);
  enc.lastState = digitalRead(enc.pinCLK);
  enc.lastStepTime = 0;
}

void updateEncoder(Encoder &enc) {
  int state = digitalRead(enc.pinCLK);
  unsigned long now = millis();

  if (state != enc.lastState && state == LOW) {
    // 只在一个沿触发，且间隔超过 STEP_INTERVAL 才认一次
    if (now - enc.lastStepTime > STEP_INTERVAL) {
      enc.lastStepTime = now;
      int dtState = digitalRead(enc.pinDT);

      // 简单方向判断：DT 与 CLK 的相位关系
      if (dtState != state) {
        // 顺时针
        Keyboard.press(enc.keyCW);
        delay(3);
        Keyboard.release(enc.keyCW);
      } else {
        // 逆时针
        Keyboard.press(enc.keyCCW);
        delay(3);
        Keyboard.release(enc.keyCCW);
      }
    }
  }
  enc.lastState = state;
}

// ============ 串口命令处理 ============
void handleSerialCommand(const String &cmdRaw) {
  String cmd = cmdRaw;
  cmd.trim();

  if (cmd == "LED:RAINBOW") {
    setLedMode(LED_RAINBOW);
  } else if (cmd == "LED:OFF") {
    setLedMode(LED_OFF);
  } else if (cmd == "LED:RED") {
    setLedMode(LED_FLASH_RED);
  } else if (cmd == "LED:BLUE") {
    setLedMode(LED_FLASH_BLUE);
  }
}

// ============ LED 模式切换 ============
void setLedMode(LedMode mode) {
  ledMode = mode;
  ledLastUpdate = millis();
  flashOn = false;

  if (mode == LED_OFF) {
    strip.clear();
    strip.show();
  }
}

// ============ LED 更新 ============
void updateLEDs() {
  unsigned long now = millis();

  switch (ledMode) {
    case LED_OFF:
      // nothing
      break;

    case LED_RAINBOW:
      if (now - ledLastUpdate > 30) { // 彩虹流动速度
        ledLastUpdate = now;
        rainbowStep();
      }
      break;

    case LED_FLASH_RED:
      if (now - ledLastUpdate > 250) {
        ledLastUpdate = now;
        flashOn = !flashOn;
        uint32_t c = flashOn ? strip.Color(255, 0, 0) : 0;
        strip.fill(c, 0, LED_COUNT);
        strip.show();
      }
      break;

    case LED_FLASH_BLUE:
      if (now - ledLastUpdate > 250) {
        ledLastUpdate = now;
        flashOn = !flashOn;
        uint32_t c = flashOn ? strip.Color(0, 0, 255) : 0;
        strip.fill(c, 0, LED_COUNT);
        strip.show();
      }
      break;
  }
}

// 彩虹顺时针跑动
void rainbowStep() {
  for (int i = 0; i < LED_COUNT; i++) {
    int hue = (i * 256 / LED_COUNT + rainbowOffset) & 255;
    strip.setPixelColor(i, strip.gamma32(strip.ColorHSV(hue * 256)));
  }
  strip.show();
  rainbowOffset++;
}
