# Idea Patch

A fast, friendly idea scratchpad built with plain HTML, CSS, and JavaScript.

Open `index.html` in a modern browser. Ideas and doodles are saved automatically in that browser using `localStorage`. Voice input uses the browser's Web Speech API when available. When hosted on a web server, the app shell is cached for offline use after the first visit.

## Features

- Fast idea capture with Ctrl/Cmd + Enter
- Optional speech-to-text
- Groups, colors, and tags
- Freeform draggable sticky-note wall with saved positions
- Search and group filters
- Edit, move, and delete actions
- Doodle pad that saves drawings as ideas
- Responsive mobile layout
- No account and no server required
- One-time guided tour, remembered in `localStorage`
- Downloadable JSON backup and restore

## Microphone permission

Microphone access is controlled by the browser and cannot safely be stored by JavaScript. The app asks only after the user presses **Speak** and checks for a blocked permission first. To let the browser remember an approval, host the app on HTTPS or run it on localhost; browsers may ask again when the page is opened directly with a `file://` URL.

Google/Facebook account backup is intentionally not simulated: secure account linking requires OAuth credentials and a backend. The included backup file can be stored in Google Drive, emailed, or copied anywhere the user chooses.
