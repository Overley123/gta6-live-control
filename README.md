
## Moderator codes — required after the November update

The home page remains public. When you press **Create New Scene**, the center-screen **CREATE MOD CODE** dialog asks you to choose a private moderator code (6–64 characters) and confirm it. The site generates a separate 12-character *scene code*. Users enter the scene code and then the private **MOD CODE** to unlock controls. The OBS overlay uses only the scene code and cannot gain write access.

### REQUIRED one-time Firebase setup (done by project owner, not by moderators)

1. Open **Firebase Console → Build → Authentication → Get started → Sign-in method**.
2. Enable the **Anonymous** sign-in provider, then Save. This is needed so Firebase can identify each moderator's authorized session without making visitors create an account.
3. Open **Firebase Console → Realtime Database → Rules**.
4. Replace the full live rules with the updated contents of [database.rules.json](./database.rules.json). **Publish** them. The new rules authorize writes only after a successful secret-code check. A file update on GitHub does *not* automatically update Firebase's live rules.
5. Refresh the live GitHub Pages site (Ctrl + Shift + R) and create a new scene.

**Important:** Never put the moderator code in the OBS URL, public messages, a JavaScript config file, or GitHub. Firebase stores a scene-specific SHA-256 digest at a non-readable database path and validates secret-code attempts in its Rules. This is code-based access, not a full account system; choose a strong unpredictable code, and consider Firebase App Check / throttling if you share the site widely.

**Existing scenes:** On first joining an older scene, the site will ask you to **CREATE MOD CODE** for that scene and secure it. Anyone who already knows that older scene's identifier could perform this first-time upgrade, so the original scene creator should do it promptly. Existing scene data and counters are preserved.

**Overlay resizing:** In **Scene Preview**, drag the cyan ↘ corner handle; use the +/− buttons next to the preview or the **STYLE → OVERLAY SIZE IN OBS** slider. Range: 25%–400%. The size is saved to Firebase and applied to the live 1920×1080 OBS overlay. You can drag the overlay to reposition it after making it bigger.


---
# LEONIDA / GTA VI Cloud Control Studio

Two web pages, hosted on GitHub Pages and backed by Firebase Realtime Database:

- `index.html` — no login screen. Click **Create Scene** to generate a random 12-character scene code, or **Join Scene** with that code. The Control Studio manages days, missions, deaths, timers, neon appearance and drag-and-drop position in a 1920×1080 preview. Anyone with a code can control that scene.
- `overlay.html?scene=XXXXXXXXXXXX` — a **transparent** 1920×1080 overlay for an OBS Browser Source. State is pushed to all clients in real time using Firebase. No machine needs to run as a server.

**IMPORTANT** — Publishing just these files to GitHub Pages is not sufficient. GitHub Pages is static and doesn't persist live scene changes. Set up Firebase once before using the live features.

## 1. Create a Firebase Realtime Database (one-time)

1. Open https://console.firebase.google.com/ and create a project.
2. Go to **Build → Realtime Database → Create Database**. Choose your database region.
3. Open the database **Rules** tab. Replace the rules with the complete contents of `database.rules.json`, then publish them.
4. Go to **Project settings → General → Your apps**, click the Web app icon (`</>`), register a web app and copy its Firebase web configuration.
5. Open `firebase-config.js` and paste the **public web configuration** fields (`apiKey`, `authDomain`, `databaseURL`, `projectId`, `appId`). If the copied Web app config does not include `databaseURL`, use the full URL shown at the top of your Realtime Database's **Data** tab. Do **not** place service-account JSON or admin secrets in your website.
6. Ensure you have enabled Realtime Database and that its Rules were published. Firebase's initial default rules commonly deny public reads/writes; the provided scene-key rules are required for this particular code-based sharing model.

### Important security detail

The random 12-character scene code is a **bearer access code**: anybody who possesses it can read/edit the corresponding scene. The overlay URL itself includes this code, so **keep the OBS Browser Source URL private**. The rules deny listing scenes and access to unknown database paths, and validate field types/ranges, but this is **not equivalent to authenticated accounts or role-based permissions**. Do not use this backend for confidential information. For stronger read-only OBS viewer links and separate admin access, implement an authenticated backend or cloud function.

The open-create feature permits anonymous, code-scoped scene creation; abuse from bots is possible, and Firebase quota/billing is your responsibility. The rules don't provide rate limiting. For public promotion at scale, add Firebase App Check / auth and a trusted backend.

## 2. Publish on GitHub Pages

1. Create a **public repository** named e.g. `gta6-live-control` under your GitHub account.
2. Upload **every file** in this folder into the root of the repository.
3. In repository **Settings → Pages**, select **Deploy from a branch** with your default branch and `/ (root)`.
4. Your Home/Control page will look like `https://USERNAME.github.io/gta6-live-control/`.
5. The OBS link generated by the app will look like `https://USERNAME.github.io/gta6-live-control/overlay.html?scene=SCENE_CODE`.

## 3. Use in OBS

1. Create the scene from the homepage. Click **Copy OBS link**.
2. In OBS: **Sources → + → Browser**. Paste the OBS link.
3. Set **Width: 1920** and **Height: 1080**.
4. Turn off the OBS option **Shutdown source when not visible** if you want it to keep its connection while hidden, though timers are derived from cloud timestamps and do not require a running browser.

## Troubleshooting

- `Cloud setup needed` = you haven't set the Firebase config; scenes cannot sync yet.
- `permission_denied` = confirm Firebase Realtime Database rules were published and the `databaseURL` points to the correct database.
- `Scene not found` = check the code (letters I/O and digits 0/1 are not used).
- Overlay is transparent but blank = check the exact OBS link and that your scene exists.
- The database and connection require internet; there is no Python, CMD, local file picker, or local HTTP server.

## Files

- `index.html`, `style.css`, `studio.js`: Home + Control Studio UI.
- `overlay.html`, `overlay.js`: transparent overlay.
- `hud.css`, `hud.js`: shared styling and overlay renderer.
- `cloud.js`: Realtime Database sync and server-based timers.
- `firebase-config.js`: one-time public Firebase config.
- `database.rules.json`: Realtime Database security rules.