Place the production notification sound here as `notification-soft.mp3` or `notification-soft.wav`.

The renderer currently looks for `/sounds/notification-soft.mp3` first and falls back to a generated soft chime when the file is not present. When a final sound asset is ready, copy it to `public/sounds/notification-soft.mp3` for the web build and keep the source master in this folder.
