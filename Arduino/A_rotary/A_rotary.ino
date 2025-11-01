#include <Keyboard.h>
#include <RotaryEncoder.h>

// -------- 接线（可按需要改成你实际用的引脚） --------
// 编码器1（红方）
const int ENC1_A = 2;   // S1
const int ENC1_B = 3;   // S2
const int ENC1_K = 4;   // Key（可选，不用可注释）

// 编码器2（蓝方）
const int ENC2_A = 7;   // S1
const int ENC2_B = 8;   // S2
const int ENC2_K = 9;   // Key（可选）

// 注意：若用 Pro Micro/Leonardo，以上均是数字口；
// 若想用 A0/A1/A2/A3 也可以（它们同样能作数字口）。

// RotaryEncoder 库实例（建议 FOUR3 模式，物理卡位更稳）
RotaryEncoder enc1(ENC1_A, ENC1_B, RotaryEncoder::LatchMode::FOUR3);
RotaryEncoder enc2(ENC2_A, ENC2_B, RotaryEncoder::LatchMode::FOUR3);

// 限速（防止一次转动触发过快）
const unsigned long STEP_MIN_INTERVAL_MS = 20;

long pos1 = 0, pos2 = 0;
unsigned long t1 = 0, t2 = 0;

// ---------- 小工具：点按一次键 ----------
static inline void tap(char k){
  Keyboard.press(k);
  delay(2);
  Keyboard.release(k);
}

void setup() {
  Keyboard.begin();
  pinMode(ENC1_A, INPUT_PULLUP);
  pinMode(ENC1_B, INPUT_PULLUP);
  pinMode(ENC2_A, INPUT_PULLUP);
  pinMode(ENC2_B, INPUT_PULLUP);
#ifdef ENC1_K
  pinMode(ENC1_K, INPUT_PULLUP);
#endif
#ifdef ENC2_K
  pinMode(ENC2_K, INPUT_PULLUP);
#endif
  // 如果你还需要和 p5.js 通讯（例如开始/停止），开串口：
  Serial.begin(9600);
}

void handleEncoder(RotaryEncoder &enc, long &lastPos,
                   unsigned long &lastTs, char negKey, char posKey) {
  enc.tick();                        // 必须高频调用
  long newPos = enc.getPosition();
  long delta  = newPos - lastPos;    // 可能是 ±1、±2（快速旋转）

  if (delta != 0 && (millis() - lastTs) >= STEP_MIN_INTERVAL_MS) {
    // 每一步都发一次按键
    int steps = abs(delta);
    for (int i = 0; i < steps; i++) {
      if (delta > 0) tap(posKey);    // 顺时针
      else           tap(negKey);    // 逆时针
    }
    lastPos = newPos;
    lastTs  = millis();
  }
}

void loop() {
  // 红方：A / D
  handleEncoder(enc1, pos1, t1, 'a', 'd');
  // 蓝方：J / L
  handleEncoder(enc2, pos2, t2, 'j', 'l');

  // 可选：按下编码器按钮作为“触发/开始”
#ifdef ENC1_K
  static bool k1prev = HIGH;
  bool k1 = digitalRead(ENC1_K);
  if (k1 == LOW && k1prev == HIGH) { Serial.println("G1"); }   // 或 tap('g');
  k1prev = k1;
#endif
#ifdef ENC2_K
  static bool k2prev = HIGH;
  bool k2 = digitalRead(ENC2_K);
  if (k2 == LOW && k2prev == HIGH) { Serial.println("G2"); }
  k2prev = k2;
#endif

  delay(1);
}