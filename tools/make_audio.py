#!/usr/bin/env python3
"""Generate audio/<name>.m4a for every word and phrase in words.json.

Uses the macOS `say` and `afconvert` commands. Existing files are skipped,
so after editing words.json just run it again; pass --force to redo them all.

    python3 tools/make_audio.py [--voice "Serena (Premium)"] [--force] [--prune]

Without --voice it picks the best British voice installed: Premium, then
Enhanced, then plain Daniel. Better voices are a free download in System
Settings > Accessibility > Spoken Content > System Voice > Manage Voices.
"""
import argparse
import json
import re
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "audio"


def sentence_clip(text):
    """File name for a spoken sentence; game.js builds the same name."""
    return "s-" + re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def best_voice():
    listing = subprocess.run(["say", "-v", "?"], capture_output=True, text=True, check=True).stdout
    british = [line.split(" en_GB")[0].strip() for line in listing.splitlines() if " en_GB" in line]
    for quality in ("(Premium)", "(Enhanced)"):
        for name in british:
            if quality in name:
                return name
    return "Daniel"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--voice", default=best_voice())
    ap.add_argument("--rate", default="160", help="words per minute")
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--prune", action="store_true", help="delete clips that words.json no longer uses")
    args = ap.parse_args()

    print("voice:", args.voice)
    data = json.loads((ROOT / "words.json").read_text())
    clips = dict(data["phrases"])
    for level in data["levels"]:
        for group in level["words"]:
            for word in group:
                clips[word.lower()] = word

    # conversations: both sides of every exchange as whole sentences, plus each word so it can be tapped
    for level in data["levels"]:
        for line in level["alien"]["lines"]:
            for sentence in (line["pip"], line["say"]):
                clips[sentence_clip(sentence)] = sentence
                for word in sentence.split():
                    word = re.sub(r"[^A-Za-z']", "", word)
                    if len(word) == 1:
                        word = word.lower()  # a lone capital is read out as "capital A"
                    clips.setdefault(re.sub(r"[^a-z]", "", word.lower()), word)

    OUT.mkdir(exist_ok=True)
    made = 0
    with tempfile.TemporaryDirectory() as tmp:
        aiff = Path(tmp) / "clip.aiff"
        for name, text in sorted(clips.items()):
            target = OUT / f"{name}.m4a"
            if target.exists() and not args.force:
                continue
            subprocess.run(["say", "-v", args.voice, "-r", args.rate, "-o", str(aiff), text], check=True)
            subprocess.run(["afconvert", str(aiff), "-o", str(target), "-f", "m4af", "-d", "aac", "-b", "64000"], check=True)
            made += 1

    stale = sorted(p.name for p in OUT.glob("*.m4a") if p.stem not in clips)
    print(f"{made} generated, {len(clips) - made} already present")
    if stale and args.prune:
        for name in stale:
            (OUT / name).unlink()
        print(len(stale), "unused clips deleted")
    elif stale:
        print("no longer used (run with --prune to delete):", ", ".join(stale))


if __name__ == "__main__":
    main()
