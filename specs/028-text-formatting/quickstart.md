# Quickstart: driving the formatting buttons

How to see this feature work, and how to see it fail honestly. Every step here
is something a reviewer can run.

## The happy path, in a browser

```powershell
npm run dev
```

1. Make a page, or open the example.
2. Add a **Text** section, or open one that exists.
3. Type `Pay a deposit before I start` in the Text field.
4. Select the word `deposit`.
5. Press **B**.

Expected: the field reads `Pay a **deposit** before I start`, the word is still
selected, and **the cursor has not left the field**. Press **B** again and the
markers come off.

6. With nothing selected, press *I*. A short placeholder appears between the
   markers and is selected, so typing replaces it.
7. Select three lines and press the list button. Each becomes a bullet. Press
   again and they stop being bullets.
8. Select a word and press the link button. The word becomes the visible text
   and the cursor waits where the address goes.
9. Open the **Copy** tab. The compiled page carries `**deposit**`.
10. Open **Preview**. The word is bold there, because the preview renders the
    compiled output rather than the block model.

## The fallback, which is the part worth checking

1. In a Text section, highlight a word and strike another one out.
2. With the host set to **rentry** or **text.is**: both marks appear in Preview,
   and the Copy tab carries `==word==` and `~~word~~`.
3. Switch the host to **Portable (works anywhere)**.

Expected: both words are now plain in Preview, the markers are gone from the
Copy tab entirely rather than shown literally, and **a message names the section
and says which mark that host will not show**.

That third step is Principle VII and Jakob's decision 2 in one screen. If the
markers are visible as `==word==` on the Copy tab, the fallback is not working.

4. Switch back. The message goes and the marks return.

## Proving it on the hosts, without publishing

The capability values came from each host's own renderer. The method is in
[`docs/research/2026-09-11-marks-verification.md`](../../docs/research/2026-09-11-marks-verification.md)
and can be repeated: GET the home page, read `csrfmiddlewaretoken` from the
hidden input, POST `content` to `/markdownx/markdownify/`.

Two traps, both already paid for: read the token from the HTML and not the
cookies, because there is a Laravel front end over a Django application; and
never number your probe lines, or Python-Markdown reads every one as an ordered
list item.

## Proving the escaper closes the hole

In a Text section, type these two lines with a single newline between them:

```
My shop
===
```

Expected on the Copy tab: `===` is still there, carrying backslashes. Expected
on rentry and text.is: a line of text and a row of equals signs.

**Before this feature that produced an `<h1>` and the equals signs vanished.**
One equals sign was enough. Check the single character form too:

```
My shop
=
```

And check that ordinary arithmetic is untouched. `Bundle = 3 items` must reach
the Copy tab with no backslash in it at all.

## The gates

```powershell
npm run verify
```

Run it whole and unpiped from PowerShell. Never through `Select-Object -First N`,
which ends the pipeline early and reports a green gate as exit 255.

**The accessibility count must go up.** The buttons are controls, and a gate
whose number does not move has not seen them. That is SC-028-7 and it exists
because this project has now caught four gates that were green about surfaces
they never measured.

To prove the a11y gate is really watching, take the accessible name off one
button and run `npm run a11y`. It must name that button.

To prove the escaper rule is really load bearing, remove it and run the inline
tests. They must fail, and they must fail naming the case rather than a count.

## On the handset

The one thing jsdom cannot answer: whether the buttons are reachable with the
software keyboard up. 027 measured that the panel survives the keyboard at
`max-height: 92vh`; this is a different row in a different place and needs its
own look.

```powershell
adb -s ZY2262PFGQ shell dumpsys power | Select-String mWakefulness
```

Check that immediately before every screenshot. A capture under about 20 kB is a
sleeping screen, not a broken app, and that reading once cost a rebuild, a
reinstall and a service worker investigation.
