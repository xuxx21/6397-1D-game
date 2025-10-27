/*

This is a simple example that allows you to connect 4 buttons and a rotary encoder to your Arduino.
The Arduino acts as a keyboard by outputting button presses.

You will need this table to figure the code for the characters you are trying to output.
http://www.asciitable.com/

*/

#include <Keyboard.h>      // Arduino acts as a keyboard
#include <RotaryEncoder.h> // Rotary encoder library

// Rotary encoder pins
RotaryEncoder encoder(A0, A1);

// button pins
#define BTN_A 2
#define BTN_D 3
#define BTN_J 4
#define BTN_L 5

bool keyA = false;
bool keyD = false;
bool keyJ = false;
bool keyL = false;

unsigned long lastRotateTime = 0; 
bool rotationActive = false;

void setup() {
  Serial.begin(9600);   // 用于和 p5.js 通信
  Keyboard.begin();

  pinMode(BTN_A, INPUT_PULLUP);
  pinMode(BTN_D, INPUT_PULLUP);
  pinMode(BTN_J, INPUT_PULLUP);
  pinMode(BTN_L, INPUT_PULLUP);
}

void loop() {
  // ---- Rotary encoder ----
  static int pos = 0;
  encoder.tick();
  int newPos = encoder.getPosition();

  if (pos != newPos) {
    // 检测到旋转 → 发信号 G
    Serial.println("G");
    lastRotateTime = millis();
    rotationActive = true;

    pos = newPos;
  }

  // 如果想检测“旋转结束几秒内无输入”
  if (rotationActive && (millis() - lastRotateTime > 2000)) {
    Serial.println("STOP");   // 可选：发一个 STOP 信号
    rotationActive = false;
  }

  // ---- Buttons as Keyboard ----
  if (digitalRead(BTN_A) == HIGH && !keyA) {
    keyA = true;
    Keyboard.write('a');
  }
  if (digitalRead(BTN_A) == LOW) keyA = false;

  if (digitalRead(BTN_D) == HIGH && !keyD) {
    keyD = true;
    Keyboard.write('d');
  }
  if (digitalRead(BTN_D) == LOW) keyD = false;

  if (digitalRead(BTN_J) == HIGH && !keyJ) {
    keyJ = true;
    Keyboard.write('j');
  }
  if (digitalRead(BTN_J) == LOW) keyJ = false;

  if (digitalRead(BTN_L) == HIGH && !keyL) {
    keyL = true;
    Keyboard.write('l');
  }
  if (digitalRead(BTN_L) == LOW) keyL = false;
}
