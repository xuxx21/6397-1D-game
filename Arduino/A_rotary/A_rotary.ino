#include <Keyboard.h>

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
bool btn_last   = HIGH;          // 上一次读取的电平（内部上拉 → 默认 HIGH）
unsigned long btn_press_time = 0; // 按下瞬间的时间戳（用于防抖）

/* ────────────────────── 按键函数（带保持时间） ────────────────────── */
static inline void tap(char k) {
  if (k == 0) return;
  Keyboard.press(k);
  delay(35);               // 30~40ms 都可以，模拟真实按键
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

  // 只有在电平变化时才进入防抖逻辑
  if (reading != btn_last) {
    btn_press_time = millis();   // 记录变化时刻RRRRjRaaaddddaaalljjjjlRRRRRRRRRRaaaadddddaaaa
  }

  // 防抖时间已过，且当前是 LOW（按下）
  if (reading == LOW && btn_last == HIGH && btn_press_time > DEBOUNCE_MS) {
    tap(BTN_KEY);                // 发送 R
  }

  btn_last = reading;            // 更新上一次状态
}

/* ────────────────────── setup ────────────────────── */
void setup() {
  /* 编码器引脚 */
  pinMode(red.clk,  INPUT);
  pinMode(red.dt,   INPUT);
  pinMode(blue.clk, INPUT);
  pinMode(blue.dt,  INPUT);

  red.last_clk  = digitalRead(red.clk);
  blue.last_clk = digitalRead(blue.clk);

  /* 按钮引脚（内部上拉） */
  pinMode(BTN_PIN, INPUT_PULLUP);

  Keyboard.begin();
}

/* ────────────────────── loop ────────────────────── */
void loop() {
  handleEncoder(red);
  handleEncoder(blue);
  handleButton();          // ← 新增的按钮检测
  // 保持 loop 高速运行，响应更灵敏
}
