/* app.js – UI logic. Reads/writes through Store and re-renders on changes,
   including changes made by other tabs (via the "storage" event). */
(() => {
  const $ = (id) => document.getElementById(id);
  let session = null; // { code, name }
  let knownIds = new Set();
  let heartbeatTimer = null;

  const money = (n) => n.toFixed(2);
  const cleanCode = (s) => s.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");

  function show(view) {
    $("join-view").classList.toggle("d-none", view !== "join");
    $("room-view").classList.toggle("d-none", view !== "room");
  }

  function showError(el, msg) {
    el.textContent = msg;
    el.classList.toggle("d-none", !msg);
  }

  /* ---------- JOIN ---------- */
  $("gen-code").addEventListener("click", () => {
    $("room-code").value = Store.generateCode();
  });

  $("join-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const name = $("user-name").value.trim();
    const code = cleanCode($("room-code").value);
    if (!name) return showError($("join-error"), "Please enter your name.");
    if (code.length < 4) return showError($("join-error"), "Room code must be 4–6 letters/numbers.");
    showError($("join-error"), "");

    const existing = Store.getRoom(code);
    if (existing && existing.members[name] && Store.isOnline(existing.members[name])) {
      return showError($("join-error"), `"${name}" is already online in this room. Pick a different name.`);
    }
    Store.join(code, name);
    enterRoom({ code, name });
  });

  function enterRoom(s) {
    session = s;
    knownIds = new Set();
    $("room-label").textContent = s.code;
    $("me-label").textContent = s.name;
    show("room");
    render(true);
    clearInterval(heartbeatTimer);
    heartbeatTimer = setInterval(() => {
      Store.heartbeat(session.code, session.name);
      renderMembers(Store.getRoom(session.code));
    }, 5000);
  }

  $("leave-btn").addEventListener("click", () => {
    Store.leave(session.code, session.name);
    clearInterval(heartbeatTimer);
    session = null;
    show("join");
  });

  $("copy-code").addEventListener("click", async () => {
    const btn = $("copy-code");
    try {
      await navigator.clipboard.writeText(session.code);
      btn.textContent = "Copied!";
    } catch (err) {
      btn.textContent = session.code;
    }
    setTimeout(() => (btn.textContent = "Copy code"), 1500);
  });

  /* ---------- ADD / REMOVE ---------- */
  $("add-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const name = $("item-name").value.trim();
    const price = parseFloat($("item-price").value);
    const qty = parseInt($("item-qty").value, 10);
    const err = $("add-error");
    if (!name) return showError(err, "Enter an item name.");
    if (!(price > 0)) return showError(err, "Price must be greater than 0.");
    if (!(qty >= 1)) return showError(err, "Quantity must be at least 1.");
    showError(err, "");
    Store.addItem(session.code, session.name, { name, price, qty });
    $("add-form").reset();
    $("item-qty").value = 1;
    $("item-name").focus();
    render();
  });

  $("cart-body").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-id]");
    if (!btn) return;
    Store.removeItem(session.code, session.name, btn.dataset.id);
    render();
  });

  $("threshold").addEventListener("change", () => {
    const v = parseFloat($("threshold").value);
    if (v >= 1) Store.setThreshold(session.code, session.name, v);
    render(true);
  });

  /* ---------- RENDER ---------- */
  function el(tag, props = {}, ...children) {
    const node = document.createElement(tag);
    Object.entries(props).forEach(([k, v]) => {
      if (k === "class") node.className = v;
      else if (k === "dataset") Object.assign(node.dataset, v);
      else node.setAttribute(k, v);
    });
    children.forEach((c) => node.append(c));
    return node;
  }

  function render(forceThreshold = false) {
    if (!session) return;
    const room = Store.getRoom(session.code);
    if (!room) { // room was removed
      show("join");
      return;
    }
    renderCart(room);
    renderProgress(room, forceThreshold);
    renderMembers(room);
    renderSplit(room);
    renderLog(room);
  }

  function total(room) {
    return room.items.reduce((s, i) => s + i.price * i.qty, 0);
  }

  function renderCart(room) {
    const body = $("cart-body");
    body.replaceChildren();
    room.items.forEach((i) => {
      const tr = el("tr");
      if (knownIds.size && !knownIds.has(i.id)) tr.className = "new-row";
      tr.append(
        el("td", {}, i.name),
        el("td", {}, i.by),
        el("td", { class: "text-end" }, String(i.qty)),
        el("td", { class: "text-end" }, money(i.price * i.qty)),
        el("td", { class: "text-end" },
          el("button", { class: "btn btn-sm btn-outline-danger", dataset: { id: i.id }, "aria-label": "Remove " + i.name }, "✕"))
      );
      body.append(tr);
    });
    knownIds = new Set(room.items.map((i) => i.id));
    if (!knownIds.size) knownIds = new Set(["_"]); // so later additions animate
    $("grand-total").textContent = money(total(room));
    $("empty-msg").classList.toggle("d-none", room.items.length > 0);
  }

  function renderProgress(room, forceThreshold) {
    const t = $("threshold");
    if (forceThreshold || document.activeElement !== t) t.value = room.threshold;
    const sum = total(room);
    const pct = Math.min(100, (sum / room.threshold) * 100);
    const bar = $("progress-bar");
    bar.style.width = pct + "%";
    bar.textContent = Math.round(pct) + "%";
    bar.className = "progress-bar " + (sum >= room.threshold ? "bg-success" : "bg-warning text-dark");
    $("progress-text").textContent = sum >= room.threshold
      ? `🎉 Free delivery unlocked! (${money(sum)} / ${money(room.threshold)})`
      : `Add ${money(room.threshold - sum)} more to get free delivery (${money(sum)} / ${money(room.threshold)}).`;
  }

  function renderMembers(room) {
    if (!room) return;
    const ul = $("members");
    ul.replaceChildren();
    Object.entries(room.members).forEach(([name, ts]) => {
      const online = Store.isOnline(ts);
      ul.append(el("li", {},
        el("span", { class: "dot" + (online ? " online" : "") }),
        name + (name === session.name ? " (you)" : "")));
    });
  }

  function splitTotals(room) {
    const map = {};
    room.items.forEach((i) => { map[i.by] = (map[i.by] || 0) + i.price * i.qty; });
    return map;
  }

  function renderSplit(room) {
    const ul = $("split");
    ul.replaceChildren();
    const map = splitTotals(room);
    const names = Object.keys(map);
    if (!names.length) {
      ul.append(el("li", { class: "list-group-item px-0 text-muted" }, "Nothing to split yet."));
      return;
    }
    names.forEach((n) => ul.append(
      el("li", { class: "list-group-item px-0 d-flex justify-content-between" }, el("span", {}, n), el("strong", {}, money(map[n])))
    ));
  }

  function renderLog(room) {
    const ul = $("log");
    ul.replaceChildren();
    if (!room.log.length) ul.append(el("li", { class: "text-muted" }, "No activity yet."));
    room.log.forEach((l) => {
      const time = new Date(l.t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      ul.append(el("li", {}, el("span", { class: "time" }, time + " "), el("strong", {}, l.user), " " + l.text));
    });
  }

  /* ---------- PRINT RECEIPT ---------- */
  function buildReceipt(room) {
    const r = $("receipt");
    r.replaceChildren();
    const now = new Date();
    r.append(
      el("h1", {}, "CartShare – Group Receipt"),
      el("div", { class: "meta" }, `Room: ${room.code} · Printed: ${now.toLocaleString()} · By: ${session.name}`)
    );

    const tbl = el("table");
    tbl.append(el("thead", {}, el("tr", {},
      el("th", {}, "#"), el("th", {}, "Item"), el("th", {}, "Added by"),
      el("th", { class: "num" }, "Price"), el("th", { class: "num" }, "Qty"), el("th", { class: "num" }, "Total"))));
    const tb = el("tbody");
    room.items.forEach((i, idx) => tb.append(el("tr", {},
      el("td", {}, String(idx + 1)), el("td", {}, i.name), el("td", {}, i.by),
      el("td", { class: "num" }, money(i.price)), el("td", { class: "num" }, String(i.qty)),
      el("td", { class: "num" }, money(i.price * i.qty)))));
    tb.append(el("tr", { class: "total-row" },
      el("td", { colspan: "5", class: "num" }, "Grand total"), el("td", { class: "num" }, money(total(room)))));
    tbl.append(tb);
    r.append(tbl);

    r.append(el("h2", { style: "font-size:16px" }, "Split by person"));
    const st = el("table");
    st.append(el("thead", {}, el("tr", {}, el("th", {}, "Person"), el("th", { class: "num" }, "Owes"))));
    const sb = el("tbody");
    Object.entries(splitTotals(room)).forEach(([n, v]) =>
      sb.append(el("tr", {}, el("td", {}, n), el("td", { class: "num" }, money(v)))));
    st.append(sb);
    r.append(st);

    r.append(el("h2", { style: "font-size:16px" }, "Activity log (audit trail)"));
    const ul = el("ul", { style: "font-size:12px" });
    [...room.log].reverse().forEach((l) =>
      ul.append(el("li", {}, `${new Date(l.t).toLocaleString()} – ${l.user} ${l.text}`)));
    r.append(ul);
  }

  $("print-btn").addEventListener("click", () => {
    const room = Store.getRoom(session.code);
    if (!room || !room.items.length) {
      alert("Add at least one item before printing.");
      return;
    }
    buildReceipt(room);
    window.print();
  });

  /* ---------- CROSS-TAB SYNC ---------- */
  window.addEventListener("storage", (e) => {
    if (session && e.key === Store.ROOM_PREFIX + session.code) render();
  });

  window.addEventListener("beforeunload", () => {
    // keep the session so a refresh restores it; presence expires on its own
  });

  /* ---------- RESTORE ON LOAD ---------- */
  const saved = Store.getSession();
  if (saved && Store.roomExists(saved.code)) {
    Store.heartbeat(saved.code, saved.name);
    enterRoom(saved);
  } else {
    show("join");
  }
})();
