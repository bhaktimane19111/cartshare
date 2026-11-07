/* store.js – data layer. Room data lives in localStorage (shared by all tabs),
   the "who am I" session lives in sessionStorage (separate per tab, so each
   tab can act as a different user). */
const Store = (() => {
  const ROOM_PREFIX = "cartshare:room:";
  const SESSION_KEY = "cartshare:session";
  const ONLINE_MS = 12000;
  const MAX_LOG = 100;

  const key = (code) => ROOM_PREFIX + code;

  function safeParse(raw) {
    try { return JSON.parse(raw); } catch (e) { return null; }
  }

  function getRoom(code) {
    return safeParse(localStorage.getItem(key(code)));
  }

  function saveRoom(room) {
    localStorage.setItem(key(room.code), JSON.stringify(room));
  }

  function roomExists(code) {
    return getRoom(code) !== null;
  }

  function newRoom(code) {
    return { code, threshold: 75, items: [], log: [], members: {} };
  }

  function addLog(room, user, text) {
    room.log.unshift({ t: Date.now(), user, text });
    if (room.log.length > MAX_LOG) room.log.length = MAX_LOG;
  }

  function generateCode() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code;
    do {
      code = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
    } while (roomExists(code));
    return code;
  }

  /* ---- session (per tab) ---- */
  function getSession() { return safeParse(sessionStorage.getItem(SESSION_KEY)); }
  function setSession(s) { sessionStorage.setItem(SESSION_KEY, JSON.stringify(s)); }
  function clearSession() { sessionStorage.removeItem(SESSION_KEY); }

  /* ---- room actions ---- */
  function join(code, name) {
    let room = getRoom(code);
    const created = !room;
    if (created) room = newRoom(code);
    room.members[name] = Date.now();
    addLog(room, name, created ? "created the room" : "joined the room");
    saveRoom(room);
    setSession({ code, name });
    return room;
  }

  function leave(code, name) {
    const room = getRoom(code);
    if (room) {
      delete room.members[name];
      addLog(room, name, "left the room");
      saveRoom(room);
    }
    clearSession();
  }

  function heartbeat(code, name) {
    const room = getRoom(code);
    if (!room) return;
    room.members[name] = Date.now();
    saveRoom(room);
  }

  function addItem(code, name, item) {
    const room = getRoom(code);
    if (!room) return null;
    room.items.push({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name: item.name,
      price: item.price,
      qty: item.qty,
      by: name,
    });
    addLog(room, name, `added ${item.qty} × ${item.name} (${item.price.toFixed(2)} each)`);
    saveRoom(room);
    return room;
  }

  function removeItem(code, name, id) {
    const room = getRoom(code);
    if (!room) return null;
    const idx = room.items.findIndex((i) => i.id === id);
    if (idx === -1) return room;
    const [gone] = room.items.splice(idx, 1);
    addLog(room, name, `removed ${gone.name} (added by ${gone.by})`);
    saveRoom(room);
    return room;
  }

  function setThreshold(code, name, value) {
    const room = getRoom(code);
    if (!room) return null;
    if (room.threshold !== value) {
      room.threshold = value;
      addLog(room, name, `set free delivery minimum to ${value}`);
      saveRoom(room);
    }
    return room;
  }

  function isOnline(ts) { return Date.now() - ts < ONLINE_MS; }

  return {
    ROOM_PREFIX, getRoom, roomExists, generateCode, getSession,
    join, leave, heartbeat, addItem, removeItem, setThreshold, isOnline,
  };
})();
