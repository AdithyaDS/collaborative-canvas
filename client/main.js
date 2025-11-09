// main.js - wires DOM, canvas and websocket
(function(){
  // ensure WS is available
  const socketWrapper = window.WS || WS;

  // Connect now (socketWrapper.connect is safe)
  socketWrapper.connect && socketWrapper.connect();

  // Simple user identity (defined before any use)
  const userId = sessionStorage.getItem('cc:user') || ('u-' + Math.random().toString(36).slice(2,8));
  sessionStorage.setItem('cc:user', userId);

  // expose userId for debugging
  window._cc_userId = userId;

  // join when socket connects (or immediately if already connected)
  if (window.socket && window.socket.connected) {
    window.socket.emit('join', { userId, name: 'User-'+userId.slice(-4), color: null });
  } else if (socketWrapper && socketWrapper.on) {
    // socket wrapper may provide `on` — use it to listen for connect
    socketWrapper.on('connect', function() {
      window.socket && window.socket.emit('join', { userId, name: 'User-'+userId.slice(-4), color: null });
    });
  } else {
    // fallback: listen for global socket object events if created later
    (function waitForSocket(){
      if (window.socket && window.socket.connected) {
        window.socket.emit('join', { userId, name: 'User-'+userId.slice(-4), color: null });
      } else {
        setTimeout(waitForSocket, 200);
      }
    })();
  }

  const canvasEl = document.getElementById('canvas');

  // safety: if canvas not found, log and stop
  if (!canvasEl) {
    console.error('Canvas element not found: ensure id="canvas" exists in index.html');
    return;
  }

  // ensure canvas accepts pointer events
  canvasEl.style.touchAction = 'none';
  canvasEl.style.userSelect = 'none';

  // create app instance (CollaborativeCanvas should be loaded from canvas.js)
  const canvasApp = new CollaborativeCanvas(canvasEl, window.WS || window);

  // UI elements
  const toolEl = document.getElementById('tool');
  const colorEl = document.getElementById('color');
  const widthEl = document.getElementById('width');
  const usersList = document.getElementById('users');
  const undoBtn = document.getElementById('undo');
  const redoBtn = document.getElementById('redo');

  function getMeta() {
    return { tool: toolEl.value, color: colorEl.value, width: Number(widthEl.value), userId };
  }

  canvasApp.setTool(toolEl.value, colorEl.value, Number(widthEl.value));

  toolEl.addEventListener('change', ()=> canvasApp.setTool(toolEl.value, colorEl.value, Number(widthEl.value)));
  colorEl.addEventListener('change', ()=> canvasApp.setTool(toolEl.value, colorEl.value, Number(widthEl.value)));
  widthEl.addEventListener('input', ()=> canvasApp.setTool(toolEl.value, colorEl.value, Number(widthEl.value)));

  // pointer handling
  const getPt = (ev) => {
    const r = canvasEl.getBoundingClientRect();
    const x = (ev.clientX ?? ev.touches?.[0]?.clientX) - r.left;
    const y = (ev.clientY ?? ev.touches?.[0]?.clientY) - r.top;
    return { x, y };
  };

  canvasEl.addEventListener('pointerdown', (ev)=>{
    canvasEl.setPointerCapture && canvasEl.setPointerCapture(ev.pointerId);
    const pt = getPt(ev);
    // debug: console.log('pointerdown', pt);
    canvasApp.pointerDown(pt, Object.assign(getMeta()));
  });
  canvasEl.addEventListener('pointermove', (ev)=>{
    const pt = getPt(ev);
    canvasApp.pointerMove(pt);
  });
  canvasEl.addEventListener('pointerup', (ev)=>{
    canvasEl.releasePointerCapture && canvasEl.releasePointerCapture(ev.pointerId);
    // debug: console.log('pointerup');
    canvasApp.pointerUp();
  });
  canvasEl.addEventListener('pointercancel', ()=> canvasApp.pointerUp());

  // Undo/Redo
  undoBtn.addEventListener('click', ()=> (window.WS || window.socket || {}).emit && (window.WS || window.socket).emit('undo', { userId }));
  redoBtn.addEventListener('click', ()=> (window.WS || window.socket || {}).emit && (window.WS || window.socket).emit('redo', { userId }));

  // update users list
  window.addEventListener('users:update', (e)=>{
    const users = e.detail || [];
    usersList.innerHTML = '';
    for (const u of users) {
      const li = document.createElement('li');
      li.textContent = `${u.name} ${u.userId===userId? '(you)':''}`;
      li.style.background = u.color ?? 'transparent';
      usersList.appendChild(li);
    }
  });

  // request initial state when connected
  function requestStateWhenReady(){
    if ((window.WS && window.WS.emit) || (window.socket && window.socket.connected)) {
      (window.WS || window.socket).emit && (window.WS || window.socket).emit('request-state');
    } else {
      setTimeout(requestStateWhenReady, 200);
    }
  }
  requestStateWhenReady();

})();
