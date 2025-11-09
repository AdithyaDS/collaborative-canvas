// client/canvas.js
// Robust CollaborativeCanvas class (full, includes setTool)

class CollaborativeCanvas {
  constructor(canvasEl, socketWrapper) {
    this.canvas = canvasEl;
    this.ctx = canvasEl.getContext('2d');
    this.socket = socketWrapper || (window.WS || window.socket || {});
    this.isDrawing = false;
    this.currentPath = [];
    this.currentMeta = { tool: 'brush', color: '#000', width: 4, userId: null };
    this.cursors = new Map();
    this.operations = [];

    // ensure canvas accepts pointer/touch events
    this.canvas.style.touchAction = 'none';
    this.canvas.style.userSelect = 'none';
    this.canvas.style.webkitUserSelect = 'none';

    this._setupResize();
    this._registerSocketHandlers();
  }

  // set drawing tool, color, width
  setTool(tool, color, width) {
    this.currentMeta.tool = tool;
    this.currentMeta.color = color;
    this.currentMeta.width = width;
  }

  _setupResize() {
    const resize = () => {
      const rect = this.canvas.getBoundingClientRect();
      const cssW = Math.max(100, Math.floor(rect.width || this.canvas.clientWidth || 800));
      const cssH = Math.max(100, Math.floor(rect.height || this.canvas.clientHeight || 600));
      const ratio = window.devicePixelRatio || 1;

      // Set backing store size
      this.canvas.width = Math.floor(cssW * ratio);
      this.canvas.height = Math.floor(cssH * ratio);

      // Ensure CSS size matches
      this.canvas.style.width = cssW + 'px';
      this.canvas.style.height = cssH + 'px';

      // Map drawing coordinates to CSS pixels
      this.ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      this.ctx.lineCap = 'round';
      this.ctx.lineJoin = 'round';

      this.redrawAll();
    };

    window.addEventListener('resize', resize);
    window.addEventListener('orientationchange', resize);
    setTimeout(resize, 0);
  }

  pointerDown(pt, meta) {
    this.isDrawing = true;
    // meta overrides currentMeta for the stroke
    this.currentPath = [pt];
    this.currentMeta = Object.assign({}, this.currentMeta, meta);
  }

  pointerMove(pt) {
    if (!this.isDrawing) {
      // broadcast cursor only
      try { this.socket.emit && this.socket.emit('pointer', pt); } catch(e){/*ignore*/ }
      return;
    }
    this.currentPath.push(pt);
    const last = this.currentPath[this.currentPath.length - 2];
    if (last) this._drawSegment(last, pt, this.currentMeta, false);
  }

  pointerUp() {
    if (!this.isDrawing) return;
    this.isDrawing = false;
    const op = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2,9)}`,
      type: this.currentMeta.tool === 'eraser' ? 'erase' : 'stroke',
      path: this.currentPath.slice(),
      color: this.currentMeta.color,
      width: this.currentMeta.width,
      userId: this.currentMeta.userId,
      ts: Date.now(),
      active: true
    };
    this.operations.push(op);
    try { this.socket.emit && this.socket.emit('operation', op); } catch(e){/*ignore*/ }
    this.currentPath = [];
  }

  _drawSegment(p1, p2, meta) {
    if (!p1 || !p2) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.lineWidth = meta.width;
    if (meta.tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = meta.color;
    }
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
    ctx.restore();
  }

  redrawAll() {
    const ratio = window.devicePixelRatio || 1;
    const w = this.canvas.width / ratio;
    const h = this.canvas.height / ratio;
    this.ctx.clearRect(0, 0, w, h);

    for (const op of this.operations) {
      if (!op.active) continue;
      this._drawPath(op);
    }

    for (const [id, cur] of this.cursors) {
      this._drawCursor(cur);
    }
  }

  _drawPath(op) {
    if (!op.path || op.path.length < 2) return;
    const meta = { tool: op.type === 'erase' ? 'eraser' : 'brush', color: op.color, width: op.width };
    for (let i = 1; i < op.path.length; i++) this._drawSegment(op.path[i-1], op.path[i], meta);
  }

  _drawCursor(cur) {
    if (!cur) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cur.x, cur.y, 6, 0, Math.PI * 2);
    ctx.fillStyle = cur.color || 'red';
    ctx.fill();
    ctx.restore();
  }

  _registerSocketHandlers() {
    const on = (ev, cb) => {
      try {
        if (this.socket && this.socket.on) return this.socket.on(ev, cb);
        if (window.WS && window.WS.on) return window.WS.on(ev, cb);
        if (window.socket && window.socket.on) return window.socket.on(ev, cb);
      } catch(e) { /* ignore */ }
    };

    on('init-state', (state) => {
      this.operations = state.operations || [];
      this.redrawAll();
    });

    on('remote-operation', (op) => {
      this.operations.push(op);
      if (op.active) this._drawPath(op);
      else this.redrawAll();
    });

    on('pointer', (payload) => {
      if (!payload || !payload.userId) return;
      this.cursors.set(payload.userId, payload);
      if (payload._timeout) clearTimeout(payload._timeout);
      payload._timeout = setTimeout(()=>{ this.cursors.delete(payload.userId); this.redrawAll(); }, 1500);
      this.redrawAll();
    });

    on('users', (users) => {
      const ev = new CustomEvent('users:update', { detail: users });
      window.dispatchEvent(ev);
    });

    on('undo-redo', (payload) => {
      if (!payload || !payload.opId) return;
      const idx = this.operations.findIndex(o => o.id === payload.opId);
      if (idx >= 0) {
        this.operations[idx].active = payload.active;
        this.redrawAll();
      } else {
        try { this.socket.emit && this.socket.emit('request-state'); } catch(e){/*ignore*/ }
      }
    });
  }
}

// export to global so main.js can access it
window.CollaborativeCanvas = CollaborativeCanvas;
