#include <Keyboard.h>

#define P1_CLK   2   // 红方 S1 (CLK)
#define P1_DT    3   // 红方 S2 (DT)
#define P1_CW    'd' // 红方顺时针 → d
#define P1_CCW   'a' // 红方逆时针 → a

#define P2_CLK   4   // 蓝方 S1 (CLK)
#define P2_DT    5   // 蓝方 S2 (DT)
#define P2_CW    'l' // 蓝方顺时针 → l
#define P2_CCW   'j' // 蓝方逆时针 → j

// 关键改动：降频 25 → 45
const unsigned long STEP_INTERVAL = 45;  // 两次触发之间最小间隔（ms）


struct Encoder {
  uint8_t clk, dt;
  char cw_key, ccw_key;
  int last_clk;
  unsigned long last_step;
};

Encoder red  = {P1_CLK, P1_DT, P1_CW, P1_CCW, LOW, 0};
Encoder blue = {P2_CLK, P2_DT, P2_CW, P2_CCW, LOW, 0};

void setup() {
  pinMode(red.clk,  INPUT);
  pinMode(red.dt,   INPUT);
  pinMode(blue.clk, INPUT);
  pinMode(blue.dt,  INPUT);

  red.last_clk  = digitalRead(red.clk);
  blue.last_clk = digitalRead(blue.clk);

  Keyboard.begin();
}

// ✅ 改这里：加一点保持时间
static inline void tap(char k) {
  if (k == 0) return;
  Keyboard.press(k);
  delay(35);              // 30~40 都可以试
  Keyboard.release(k);
}

// 处理单个编码器
void handleEncoder(Encoder &e) {
  int clk_now = digitalRead(e.clk);

  if (clk_now == HIGH && e.last_clk == LOW) {  // 上升沿
    unsigned long now = millis();
    if (now - e.last_step >= STEP_INTERVAL) {  // 防抖 + 限速
      if (digitalRead(e.dt) != clk_now) {
        tap(e.cw_key);   // 顺时针
      } else {
        tap(e.ccw_key);  // 逆时针
      }
      e.last_step = now;
    }
  }
  e.last_clk = clk_now;
}

void loop() {
  handleEncoder(red);
  handleEncoder(blue);
  // 无 delay，极速响应！
}
