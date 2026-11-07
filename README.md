# CartShare – Shared Shopping Rooms

A collaborative shopping cart for dorms, office teams and travel groups. Create or join a room with a code, add items together, track free-delivery progress, see who did what, and print an audit-ready receipt.

Built with plain HTML, CSS, JavaScript and Bootstrap 5 (no build step, no backend).

## How to run locally

1. Download or clone this repository.
2. Open `index.html` in a browser (or run `npx serve .` / VS Code Live Server).
3. To test multiple users: open the page in **two or more tabs** of the same browser, use different names, and enter the **same room code**.

## Features

- **Rooms**: generate a 6-character code or join an existing one.
- **Shared cart**: add/remove items (name, price, quantity); every tab in the room updates instantly.
- **Free delivery progress bar** with an editable minimum amount.
- **People in room** with online/offline indicator.
- **Split by person**: total of what each person added.
- **Activity log**: timestamped record of joins, leaves, adds, removals and threshold changes.
- **Printable receipt**: items, grand total, split and full audit log (CSS `@media print`).
- **Responsive**: Bootstrap grid + Flexbox, works on phones and desktops.
- Input validation and safe DOM rendering (no `innerHTML` with user text).

## How it works

- `localStorage` stores each room (`cartshare:room:CODE`) so data survives refreshes.
- `sessionStorage` stores "who am I" per tab, so each tab can be a different user.
- The browser `storage` event tells other tabs when the room changed, so they re-render.
- A 5-second heartbeat marks members online/offline.

## Folder structure

```
cartshare/
├── index.html
├── README.md
├── css/style.css
├── js/store.js    (data layer)
├── js/app.js      (UI logic)
└── assets/logo.svg
```

## Deployment

Push to GitHub, then enable **GitHub Pages** (Settings → Pages → main branch / root), or import the repo in Vercel / Netlify (no build command, output directory `.`).

## Limitations

Sync works across tabs/windows of the **same browser** (localStorage is per browser). Syncing across different devices would need a backend such as Firebase.
