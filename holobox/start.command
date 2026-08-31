#!/bin/bash
# HoloBox launcher — double-click this file (macOS) or run it in a terminal.
# Starts the server and opens the display + controller in your browser.
cd "$(dirname "$0")" || exit 1
echo "Starting HoloBox…"
# Open the display (put this window on the screen under the pyramid) and the
# controller (drive it from here or from your phone using the LAN URL printed).
( sleep 1; open "http://localhost:8011/display.html" 2>/dev/null;
  open "http://localhost:8011/controller.html" 2>/dev/null ) &
node server.js
