# Video Speeder - Tab Media Controller

A Manifest V3 Chrome extension for controlling HTML5 `<video>` and `<audio>` playback speed.

## Fixes in v1.0.1

- Removed the "Rate us" footer.
- Reset now always returns to `1x`.
- Added `tabs` and `scripting` permissions.
- Added an injection fallback so controls work on tabs that were already open before the extension was loaded.
- Preserves per-tab speed state and optional all-tabs speed state.

## Install locally

1. Unzip `video-speeder-extension-v2.zip`.
2. Open Chrome and go to `chrome://extensions`.
3. Enable **Developer mode**.
4. Click **Load unpacked**.
5. Select the unzipped `video-speeder-extension-v2` folder.

## Notes

Chrome blocks extensions on restricted pages such as `chrome://` pages and the Chrome Web Store. Some DRM/protected/custom players may reject speed changes.