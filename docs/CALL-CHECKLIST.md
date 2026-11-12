# Before a real call with the AI voice (Masculine / Feminine)

The AI voice runs on this laptop's graphics card (RTX 2050, 4 GB). The card is shared with
Chrome and the call itself, so most problems come from it being too hot or too full.

## 2 minutes before the call
1. **Charger plugged in.** On battery the graphics card slows down and the voice glitches.
2. **Windows power mode: Best performance** (Settings → System → Power).
3. **Laptop on a hard surface, vents free.** The card runs at ~85°C; hotter = slower.
4. **Earphones in.** Speakers let the mic hear the converted voice and confuse the pitch.
5. **Close what uses the graphics card:** Docker Desktop, extra Chrome tabs, the Sanay 3D
   website tab, games, video editors.
6. **Open Sanay, pick the voice, wait for "Live".** The first start can take up to a minute.
   Say a few sentences in the Mic test with earphones on.
7. **In the call app:** microphone = **CABLE Output (VB-Audio Virtual Cable)**.
   In Meet, turn **off** background blur and visual effects (they use the graphics card).

## During the call: what Sanay does by itself
| If this happens | Sanay does | You hear |
|---|---|---|
| The card is briefly slow | Rides it out with a small cushion | Nothing, or a soft dip |
| The voice server crashes or runs out of memory | Restarts it (~30-50 s) | The basic voice meanwhile, never silence |
| The voice server gets stuck | Detects it after 10 s and restarts it | The basic voice meanwhile |

## If you want your own voice back right now
Click the **orb** (or the floating pill): the call instantly hears your normal, untouched mic.

## The one thing Sanay can't cover
If the Sanay app itself is closed, the call's mic (CABLE Output) goes silent. Keep the app
open; if it ever closes, switch the call's microphone back to your real mic.
