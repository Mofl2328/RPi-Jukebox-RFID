#!/bin/sh
# Hard-reset the PN532 RFID reader: pull its RSTPDN line low, then let it go.
# Installed as /usr/local/bin/pn532-reset.sh (copy: resources/system/pn532-reset.sh).
# See documentation/builders/pn532-reader-reset.md.
#
# Wiring: PN532 RSTPDN -> GPIO 4 (physical pin 7). RSTPDN is active low and pulled high on the module.
# The pin is never driven high: "released" means input with pull-up, so a wiring mistake can't short anything.
# Runs before every jukebox start (ExecStartPre in the jukebox-daemon drop-in).
# pinctrl works as user pi (group gpio), no sudo needed.
PIN=4
pinctrl set "$PIN" op dl   # reset: chip powers down, its LED goes off
sleep 0.4
pinctrl set "$PIN" ip pu   # release: chip boots again
sleep 0.2                  # give it time to start before the reader opens the bus
