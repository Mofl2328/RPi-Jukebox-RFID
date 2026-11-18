# PN532 reader reset and watchdog

A PN532 on I2C can hang and hold the clock line low. `py532lib` retries every transfer in an endless loop and swallows
the errors, so no card is read and nothing is logged. The `pn532_i2c_py532` reader can recover from this by resetting
the chip over its RSTPDN line, while the Jukebox keeps running.

## Wiring

Connect the RSTPDN pad of the PN532 module to **GPIO 4 (physical pin 7)**. RSTPDN is active low. The pin is never driven
high: it is pulled low for 0.4 s, then set back to an input with pull-up.

The LED of the module goes off while the line is held low. Use the LED to check the wiring, because the chip can still
answer its I2C address during the reset.

## Installation

Install the reset script and the service drop-in, which resets the reader before every Jukebox start:

```bash
cd ~/RPi-Jukebox-RFID
sudo install -m 755 resources/system/pn532-reset.sh /usr/local/bin/pn532-reset.sh
mkdir -p ~/.config/systemd/user/jukebox-daemon.service.d
cp resources/default-services/jukebox-daemon.service.d/pn532-reset.conf ~/.config/systemd/user/jukebox-daemon.service.d/
systemctl --user daemon-reload
```

The script uses `pinctrl`, which needs Raspberry Pi OS Bookworm or newer. To use another pin, change `PIN` in the script.

## How it works

- **Reset while running:** the driver gets its thread out of the `py532lib` retry loops, pulses RSTPDN and sets the chip
  up again in about 1 s. Meanwhile it keeps reporting the card that was on the reader, so the card removal action
  doesn't fire. Don't run `pn532-reset.sh` by hand while the Jukebox runs: the chip forgets its setup and the driver
  hangs.
- **Watchdog:** a working reader finishes several scans per second. If no scan has finished for 10 s, the driver resets
  the reader by itself. It retries after 30 s, and after 3 failed tries only every 10 minutes.
- **Web App:** **Settings → System Controls → Reset reader** runs the same reset. If the reader doesn't come back within
  6 s, the Jukebox service restarts.
- **RPC:** `host.reset_rfid_reader` runs the same reset:

  ```bash
  cd ~/RPi-Jukebox-RFID/src/jukebox
  ../../.venv/bin/python run_rpc_tool.py -c host.reset_rfid_reader
  ```

## Event log

`shared/logs/reader-watchdog.log` gets one line per event and is never rotated, so it shows how often the reader hangs.

| Event | Meaning |
|---|---|
| `START` / `READY` | Jukebox start. A `START` without `READY` means opening the reader hung. |
| `HANG` | The watchdog found a hang and resets the reader |
| `RETRY` | The reader still hangs, another reset |
| `GIVE-UP` | Still hung after 3 resets. Power-cycle the box. |
| `RECOVERED` | The reader works again, with how long it was hung |
| `MANUAL` | Reset requested from the Web App or over RPC |

## If the reset doesn't help

Power-cycle the box. A reboot is not enough, because the 3.3 V pin stays powered: shut down, unplug the power for about
10 s and plug it back in.
