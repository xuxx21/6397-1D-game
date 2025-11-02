#include <Keyboard.h>

// ====================== 配置区 ======================
#define P1_CLK   2
#define P1_DT    3
#define P1_CW    'd'
#define P1_CCW   'a'

#define P2_CLK   4
#define P2_DT    5
#define P2_CW    'l'   // 蓝方顺时针 → l
#define P2_CCW   'j'   // 蓝方逆时针 → j

const unsigned long STEP_INTERVAL = 25;
// ===================================================

struct Encoder {
  uint8_t clk, dt;
  char cw_key, ccw_key;
  int last_clk;
  unsigned long last_step;
};

Encoder red  = {P1_CLK, P1_DT, P1_CW,  P1_CCW,  LOW, 0};
Encoder blue = {P2_CLK, P2_DT, P2_CW,  P2_CCW,  LOW, 0};

void setup() {
  pinMode(red.clk,  INPUT);
  pinMode(red.dt,   INPUT);
  pinMode(blue.clk, INPUT);
  pinMode(blue.dt,  INPUT);

  red.last_clk  = digitalRead(red.clk);
  blue.last_clk = digitalRead(blue.clk);

  Keyboard.begin();
}

static inline void tap(char k) {
  Keyboard.press(k);
  Keyboard.release(k);
}

void handleEncoder(Encoder &e) {
  int clk_now = digitalRead(e.clk);
  if (clk_now == HIGH && e.last_clk == LOW) {
    unsigned long now = millis();
    if (now - e.last_step >= STEP_INTERVAL) {
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
}
