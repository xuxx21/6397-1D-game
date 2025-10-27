#include <Keyboard.h> // 用于摇杆 → 键盘
// 注意：旋转触发不走 Keyboard，而是走 Serial

const int joyX = A0;   // Joystick X-axis pin
const int joyY = A1;   // Joystick Y-axis pin
const int joyBtn = 2;  // Joystick button pin (可当旋转触发按钮/替代旋转编码器)

const int threshold = 300;  // Deadzone threshold around center (可调)
int centerX = 512;          
int centerY = 512;          

bool keyA = false;
bool keyD = false;
bool keyJ = false;
bool keyL = false;
bool btnPressed = false;

void setup() {
  pinMode(joyBtn, INPUT_PULLUP);  
  Keyboard.begin();
  Serial.begin(9600);   // 串口输出给 p5.js
}

void loop() {
  int xValue = analogRead(joyX);
  int yValue = analogRead(joyY);
  int buttonState = digitalRead(joyBtn);

  // ----- LEFT / RIGHT -----
  if (xValue < centerX - threshold) {
    if (!keyA) {
      Keyboard.press('a');
      keyA = true;
    }
  } else {
    if (keyA) {
      Keyboard.release('a');
      keyA = false;
    }
  }

  if (xValue > centerX + threshold) {
    if (!keyD) {
      Keyboard.press('d');
      keyD = true;
    }
  } else {
    if (keyD) {
      Keyboard.release('d');
      keyD = false;
    }
  }

  // ----- UP / DOWN -----
  if (yValue < centerY - threshold) {
    if (!keyJ) {
      Keyboard.press('j');
      keyJ = true;
    }
  } else {
    if (keyJ) {
      Keyboard.release('j');
      keyJ = false;
    }
  }

  if (yValue > centerY + threshold) {
    if (!keyL) {
      Keyboard.press('l');
      keyL = true;
    }
  } else {
    if (keyL) {
      Keyboard.release('l');
      keyL = false;
    }
  }

  // ----- BUTTON / ROTARY ENCODER TRIGGER -----
  if (buttonState == LOW && !btnPressed) {
    Serial.println("G");   // 串口发信号 → onSerialData() 捕捉
    btnPressed = true;
  } else if (buttonState == HIGH) {
    btnPressed = false;
  }

  delay(50);  // debounce
}


