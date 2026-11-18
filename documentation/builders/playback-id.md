# Persistent playback position per card (`playback_id`)

A card with a `playback_id` remembers where it stopped, even when other cards were played in between or the box was
switched off. This is useful for audiobooks.

## Usage

### In the Web App

Cards → register or edit a card → Jukebox action:

| Action | Saved as | Playback ID |
|---|---|---|
| **Play music** | folders: `play_card`; albums: `play_album`; songs: `play_single` | none |
| **Play audiobook** | folders: `play_card` with `playback_id` | shown and filled in automatically |

For an audiobook, press **Select music** and pick a folder. A random 8-character ID is filled in. You can type your
own or press **New ID**. Two cards with the same ID share one position.

- A card that has a `playback_id` opens as "Play audiobook". Other folder cards open as "Play music".
- Choosing a new folder for an audiobook card keeps its ID. The old position doesn't match the new folder, so the
  book starts from the beginning.
- Switching a card from "Play audiobook" to "Play music" and saving removes its ID.
- Picking a single song or an album while in "Play audiobook" saves it as "Play music". Only folders can resume.
- Old `play_folder` cards turn into `play_card` when saved.

### In `cards.yaml`

Add `playback_id` to a `play_card` entry in `shared/settings/cards.yaml`:

```yaml
'1234567890':
  alias: play_card
  args:
  - Audiobooks/The little dragon
  playback_id: dragon-1
```

- The ID is any text. Two cards on the same folder with different IDs keep separate positions.
- It only works with `alias: play_card`. With other aliases it is ignored and a warning is logged.

## Behavior

| What happens | Result |
|---|---|
| Place the card for the first time | Starts the folder from the beginning |
| Remove the card with `card_removal_action: pause` | Pauses and saves the position |
| Place the same card again | Runs the second swipe action |
| Play other cards, then place the card again | Loads the folder and jumps to the saved track and time |
| Switch the box off and on, then place the card | Resumes at the saved position |
| The book had finished (last track, within 3 s of its end) | Starts from the beginning |
| The saved file is gone or was renamed | Starts from the beginning. Reordered files are found by name. |
| Card without `playback_id` | Unchanged behavior |

## Where positions are stored

Positions are stored in `shared/settings/playback_positions.json`, one entry per ID. The file is written on every
play, pause or stop change and every 30 s while playing, so a power cut loses at most about 30 s.

To reset a card's position, stop the Jukebox, delete its entry from the file, then start the Jukebox again. Don't edit
the file while the Jukebox runs: it keeps the positions in memory and overwrites the file.

## Known limits

When a card resumes, the first fraction of a second of the first track may be heard before the jump.
