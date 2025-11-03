class Player {

  constructor(_color, _position, _displaySize) {
    this.playerColor = _color;
    this.position = _position;
    this.score = 0;
    this.displaySize = _displaySize;

    this.speed = 200; // degrees per second（控制移动速度，可调大一点更快）
  }

  // 每帧更新位置（连续移动）
  updateFromKeyboard(leftKey, rightKey) {
    const stepPerDeg = this.displaySize / 360;
    let deltaDeg = 0;

    // 每帧按键检测
    if (keyIsDown(leftKey))  deltaDeg -= this.speed * (deltaTime / 1000);
    if (keyIsDown(rightKey)) deltaDeg += this.speed * (deltaTime / 1000);

    // 累加
    this.position = (this.position + deltaDeg * stepPerDeg + this.displaySize) % this.displaySize;
  }

  // 如果仍要支持老的单步 move()（例如硬件按一下）
  move(_direction) {
    this.position += _direction;
    if (this.position < 0) this.position = this.displaySize - 1;
    if (this.position >= this.displaySize) this.position = 0;
  }
}