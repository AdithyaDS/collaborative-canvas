class DrawingState {
  constructor() {
    this.operations = [];
    this.historyPointer = this.operations.length;
  }

  getOps() {
    return this.operations.slice();
  }

  pushOperation(op) {
    if (!op.id) op.id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    op.active = true;
    this.operations.push(op);
    this.historyPointer = this.operations.length;
  }

  undo() {
    for (let i = this.operations.length - 1; i >= 0; i--) {
      if (this.operations[i].active) {
        this.operations[i].active = false;
        this.historyPointer = i;
        return this.operations[i];
      }
    }
    return null;
  }

  redo() {
    for (let i = this.historyPointer; i < this.operations.length; i++) {
      if (!this.operations[i].active) {
        this.operations[i].active = true;
        this.historyPointer = i + 1;
        return this.operations[i];
      }
    }
    return null;
  }
}

module.exports = DrawingState;
