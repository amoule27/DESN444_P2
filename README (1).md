# Un cortado à Rosemont: French VR prototype (Phase 1)

A WebXR scene for Meta Quest 3: arrive on a Rosemont street in Montréal, enter a café, and order a cortado from the barista.

## Publish on GitHub Pages
1. Create a new **public** repository (for example `french-vr-cafe`).
2. Upload everything in this folder (`index.html`, `main.js`, `cafe3d.js`, `dialogue.js`, and later the `audio/` and `assets/` folders). Keep the same structure.
3. **Settings → Pages → Build and deployment**: Source = *Deploy from a branch*, Branch = `main`, Folder = `/ (root)`. Save.
4. After about a minute your site is live at `https://YOUR-USERNAME.github.io/french-vr-cafe/`.
5. On the Quest 3, open that link in the **Meta Quest Browser** and tap **Enter VR**.

You can also open the same link on a laptop: drag to look around, click the panels.

## Controls
- **Controllers:** point the ray at a panel and pull the trigger.
- **Hand tracking:** point with your hand and pinch (thumb and index finger).
- Speaker icon = hear that reply. Large row = choose that reply. **Skip. Not sure.** = show a good reply and move on.
- **Voice replies:** tap the mic, say one of the replies in French, and the game matches what it heard to the options (small accent or wording slips are tolerated). The panel shows what it heard. Point-and-trigger always still works.
- **Top right:** pause button and accessibility settings (English translations, larger panels, slower speech, seated mode, reduce motion). Settings are remembered on that headset.
- **Paying:** after "Débit ou crédit?" you step up to the counter and your card appears in your right hand. Touch it to the terminal and hold for a moment. You can also point at the terminal and pull the trigger (or pinch), or press **Skip**.

## Adding native-speaker audio
Place `.mp3` files in an `audio/` folder using these names (turn numbers start at 1; option numbers follow the order in `dialogue.js`):

| File | Plays |
|---|---|
| `audio/t1_barista.mp3` | Barista line, turn 1 |
| `audio/t1_opt1.mp3` | Reply option 1, turn 1 |
| `audio/pardon.mp3` | "Pardon? Je n'ai pas compris." |
| `audio/pay.mp3` | "Parfait! Vous pouvez taper votre carte ici, s'il vous plaît." |
| `audio/pay_ok.mp3` | "Parfait, c'est approuvé. Merci!" |

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

## Phase 2 additions
- **Realistic café** (`cafe3d.js`): everything is generated in code. Your `assets/rosemont-360.jpg` also shows through the café windows.
- **Jump straight to a scene** while testing by adding this to the end of the link: `?start=cafe`, `?start=pay` (payment step), `?start=street`, `?start=dash` or `?start=desk`.
- **Optional realistic barista:** add a licensed character model as `assets/barista.glb` (front facing +Z, any scale). It replaces the built-in figure. Check the model's licence before putting it in a public repository. The mouth will not move on a custom model.
- **Payment line** lives in `dialogue.js` (the `pay` entry on the "Débit ou crédit?" turn). Please have a Québécois speaker confirm the wording ("taper votre carte").

## Voice replies: notes
- Uses the browser's built-in French (Canada) speech recognition, so it needs a browser that offers it, an internet connection and microphone permission. Test on the Quest first; if it is unavailable the panel says so and point-and-trigger is the fallback.
- Matching threshold is set in `main.js` (`heardIt`, currently 0.6). Raise it to be stricter, lower it to be more forgiving.

## Phase 2b: interface updates
- **Reply panel:** the microphone is grey and disabled until a reply is selected. Tap a reply (the speaker icons play each option), then tap the mic and say it. The game checks what you said against the reply you selected. If voice is not available the panel says so and tapping a reply chooses it directly. The Skip button has a soft iridescent fill with grey text.
- **Dashboard carousels:** arrow buttons under the language and location carousels (left and right arrow keys on a keyboard also scroll them).
- **Popular French-speaking locations:** shown after you pick French. Choose one from the carousel, **View All**, or by clicking it on the globe. A marker fades in on the globe. Only Montréal continues to a module.
- **Globe:** drag to spin it, click a location dot to choose it.
- **Location photos:** put `loc_nice.jpg`, `loc_geneva.jpg`, `loc_montreal.jpg`, `loc_paris.jpg` (and optionally `loc_quebec.jpg`, `loc_brussels.jpg`, `loc_dakar.jpg`) in the `assets/` folder. Locations without a photo show a coloured tile.
