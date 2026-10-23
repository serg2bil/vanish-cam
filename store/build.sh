#!/bin/sh
# Builds the zip for the Chrome Web Store: the extension folder without your local sounds.
cd "$(dirname "$0")/.." && rm -f store/vanish-cam-store.zip && tar -a -c -f store/vanish-cam-store.zip --exclude=sounds -C vanish-cam $(ls vanish-cam)
