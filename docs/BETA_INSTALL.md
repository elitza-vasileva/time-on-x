# Install the Time on X beta

Until Time on X is available in the Chrome Web Store, it must be loaded as an unpacked development extension.

1. Download `time-on-x-extension-v1.6.0.zip` from the link supplied by the publisher.
2. Extract the ZIP to a permanent folder. Do not select the ZIP itself.
3. Open `chrome://extensions` in desktop Chrome.
4. Turn on **Developer mode** in the top-right corner.
5. Click **Load unpacked**.
6. Select the extracted folder that directly contains `manifest.json`.
7. Pin **Time on X** from Chrome's Extensions menu.
8. Open or refresh `x.com`, then interact with the page and check the Time on X popup.

## Beta updates

Keep the extracted folder in the same location. For a new beta version, replace the files inside that same folder, open `chrome://extensions`, and click **Reload** on Time on X. Moving the folder or loading a second copy can create a different development extension identity and separate local history.

Unpacked extensions do not update automatically. Install only a ZIP received through the publisher's official link and do not use this flow for an untrusted extension.

Chrome's official documentation describes unpacked extensions as a development/testing mechanism. Normal one-click installation and automatic updates for public Windows and macOS users require the Chrome Web Store.
