# Un cortado à Rosemont: French VR prototype (Phase 1)

A WebXR scene for Meta Quest 3: arrive on a Rosemont street in Montréal, enter a café, and order a cortado from the barista.

## Publish on GitHub Pages
1. Create a new **public** repository (for example `french-vr-cafe`).
2. Upload everything in this folder (`index.html`, `main.js`, `dialogue.js`, and later the `audio/` and `assets/` folders). Keep the same structure.
3. **Settings → Pages → Build and deployment**: Source = *Deploy from a branch*, Branch = `main`, Folder = `/ (root)`. Save.
4. After about a minute your site is live at `https://YOUR-USERNAME.github.io/french-vr-cafe/`.
5. On the Quest 3, open that link in the **Meta Quest Browser** and tap **Enter VR**.

You can also open the same link on a laptop: drag to look around, click the panels.

## Controls
- **Controllers:** point the ray at a panel and pull the trigger.
- **Hand tracking:** point with your hand and pinch (thumb and index finger).
- Speaker icon = hear that reply. Large row = choose that reply. **Skip. Not sure.** = show a good reply and move on.
- The mic button is a placeholder until Phase 2.

## Adding native-speaker audio
Place `.mp3` files in an `audio/` folder using these names (turn numbers start at 1; option numbers follow the order in `dialogue.js`):

| File | Plays |
|---|---|
| `audio/t1_barista.mp3` | Barista line, turn 1 |
| `audio/t1_opt1.mp3` | Reply option 1, turn 1 |
| `audio/pardon.mp3` | "Pardon? Je n'ai pas compris." |

Any missing file falls back to the browser's French voice. That voice is a placeholder and may not exist on the Quest, in which case you will see the text only.

## Using a real Rosemont photo
Save an equirectangular (2:1) 360° image as `assets/rosemont-360.jpg`. It replaces the stylized street automatically. Use a photo you have the right to use, and keep it under about 4096×2048 for comfortable loading.

## Editing the conversation
All dialogue lives in `dialogue.js`. Change the French, the English hints, or which replies count as correct (`ok: true`).

## Phase 1 test checklist (on the headset)
- [ ] Panels are readable and comfortable at arm's length
- [ ] The ray lands where you point (controllers and hands)
- [ ] Barista speech: recorded audio, browser voice, or text only?
- [ ] Frame rate feels smooth; the scene fades without discomfort
- [ ] Anything confusing about the flow
