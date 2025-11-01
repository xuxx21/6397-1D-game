#include <Keyboard.h>

// 编码器1（红方）
const int A1_PIN = 2;   // S1
const int B1_PIN = 3;   // S2
const int K1_PIN = 4;   // Key（可选）

// 编码器2（蓝方）
const int A2_PIN = 7;   // S1
const int B2_PIN = 8;   // S2
const int K2_PIN = 9;   // Key（可选）

// 防抖/限速
const unsigned long STEP_MIN_INTERVAL = 20;

uint8_t last1 = 0, last2 = 0;
unsigned long t1 = 0, t2 = 0;

void setup() {
  pinMode(A1_PIN, INPUT_PULLUP); pinMode(B1_PIN, INPUT_PULLUP); pinMode(K1_PIN, INPUT_PULLUP);
  pinMode(A2_PIN, INPUT_PULLUP); pinMode(B2_PIN, INPUT_PULLUP); pinMode(K2_PIN, INPUT_PULLUP);
  Keyboard.begin();

  last1 = (digitalRead(A1_PIN) << 1) | digitalRead(B1_PIN);
  last2 = (digitalRead(A2_PIN) << 1) | digitalRead(B2_PIN);
}

void tap(char k){ Keyboard.press(k); delay(2); Keyboard.release(k); }

// 简单四态表：00→01→11→10→00 顺时针；反之逆时针
int stepFrom(uint8_t last, uint8_t now){
  if(last==now) return 0;
  if((last==0 && now==1) || (last==1 && now==3) || (last==3 && now==2) || (last==2 && now==0)) return +1; // CW
  if((last==0 && now==2) || (last==2 && now==3) || (last==3 && now==1) || (last==1 && now==0)) return -1; // CCW
  return 0; // 跳变/抖动忽略
}

void loop() {
  uint8_t now1 = (digitalRead(A1_PIN) << 1) | digitalRead(B1_PIN);
  int s1 = stepFrom(last1, now1);
  if(s1!=0 && (millis()-t1)>=STEP_MIN_INTERVAL){
    if(s1>0) tap('d'); else tap('a'); // 红方 D 右 / A 左
    t1 = millis();
  }
  last1 = now1;

  uint8_t now2 = (digitalRead(A2_PIN) << 1) | digitalRead(B2_PIN);
  int s2 = stepFrom(last2, now2);
  if(s2!=0 && (millis()-t2)>=STEP_MIN_INTERVAL){
    if(s2>0) tap('l'); else tap('j'); // 蓝方 L 右 / J 左
    t2 = millis();
  }
  last2 = now2;

  // 如果需要 Key 当作“确认/开始”，可在这里读 K1_PIN/K2_PIN 做串口或键盘触发
  // if(digitalRead(K1_PIN)==LOW) tap('g');  // 示例

  delay(1);
}