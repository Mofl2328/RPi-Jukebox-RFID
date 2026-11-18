import logging
import os
import subprocess
import threading
import time

from py532lib.mifare import Mifare
from py532lib.mifare import (MIFARE_WAIT_FOR_ENTRY, MIFARE_SAFE_RETRIES)  # noqa: F401

from components.rfid import ReaderBaseClass
import jukebox.cfghandler


from .description import DESCRIPTION


cfg = jukebox.cfghandler.get_handler('rfid')

# See pn532-reader-reset.md: reset the PN532 over its RSTPDN line (GPIO 4) while the jukebox keeps running.
# After a hardware reset the chip has forgotten its setup (SAMconfigure, retries), and py532lib waits forever for
# an answer to the command that was in flight. So the reader is aborted, reset and set up again.
PN532_RESET_SCRIPT = '/usr/local/bin/pn532-reset.sh'
# While the reset runs, keep reporting the card that was on the reader, so the card removal action (pause)
# doesn't fire and the card doesn't trigger its action again. Only if it was seen this recently before the reset:
HOLD_CARD_IF_SEEN_WITHIN_S = 1.0
# Stop holding the card if the reset takes longer than this (chip doesn't answer)
HOLD_CARD_AT_MOST_S = 5.0
# Watchdog: a working reader finishes a scan several times a second, card or not. If no scan has finished for this
# long, the reader hangs (py532lib retries forever without logging) and the watchdog resets it.
WATCHDOG_TIMEOUT_S = 10.0
WATCHDOG_CHECK_EVERY_S = 2.0
# If the reader still hangs after a watchdog reset, wait this long before the next one ...
WATCHDOG_RETRY_AFTER_S = 30.0
# ... and after this many resets in a row that didn't help, only try every WATCHDOG_GIVE_UP_RETRY_S
WATCHDOG_MAX_TRIES = 3
WATCHDOG_GIVE_UP_RETRY_S = 600.0
# Hangs, resets and jukebox starts go to their own file as well. app.log is rotated on every start (only 3 kept),
# this file is only appended to, so it shows how often the reader hangs over weeks.
# <repo>/src/jukebox/components/rfid/hardware/pn532_i2c_py532/this.py -> <repo>/shared/logs/reader-watchdog.log
_REPO_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), *(['..'] * 6)))
WATCHDOG_LOG_FILE = os.path.join(_REPO_DIR, 'shared', 'logs', 'reader-watchdog.log')

# All open readers of this type, for request_reset()
_readers = []
_log_lock = threading.Lock()


def _event_log(event: str, text: str = ''):
    """Append one line to WATCHDOG_LOG_FILE: date, time, event, text. Never fails."""
    line = f"{time.strftime('%Y-%m-%d %H:%M:%S')}  {event:<9}  {text}".rstrip() + '\n'
    try:
        with _log_lock, open(WATCHDOG_LOG_FILE, 'a') as f:
            f.write(line)
    except Exception as ex:
        logging.getLogger('jb.rfid.532').warning(f"Can't write {WATCHDOG_LOG_FILE}: {ex}")


class _ResetRequested(BaseException):
    """Raised inside py532lib's endless I2C retry loops to get out of them

    A BaseException, because those loops swallow every Exception."""


class _AbortableMifare(Mifare):
    """Mifare whose I2C access raises _ResetRequested while the abort event is set

    py532lib uses self.PN532 (the I2C master) in every pass of its retry loops, so this is checked often."""

    def __init__(self, abort: threading.Event):
        self._abort = abort
        self._master = None
        super().__init__()

    @property
    def PN532(self):
        if self._abort.is_set():
            raise _ResetRequested()
        return self._master

    @PN532.setter
    def PN532(self, master):
        self._master = master

    @PN532.deleter
    def PN532(self):
        self._master = None

    def close(self):
        """Close the I2C master without the abort check"""
        if self._master is not None:
            try:
                self._master.close()
            except Exception:
                pass
            self._master = None


def request_reset(timeout: float = 6.0) -> bool:
    """Hard-reset all PN532 readers and set them up again, without restarting the jukebox

    Called from another thread (RPC). Returns True if every reader was reset and answers again within timeout."""
    if not _readers:
        _event_log('MANUAL', 'reset requested (web UI / RPC), but no reader is open')
        return False
    started = time.monotonic()
    done = [reader.request_reset() for reader in list(_readers)]
    deadline = started + timeout
    ok = all(d.wait(max(0.0, deadline - time.monotonic())) for d in done)
    _event_log('MANUAL', f"reset requested (web UI / RPC): "
                         f"{f'reader OK after {time.monotonic() - started:.1f} s' if ok else 'reader did not come back'}")
    return ok


def query_customization() -> dict:
    print("There are no customization parameters necessary!")
    return {'log_all_cards': False}


class ReaderClass(ReaderBaseClass):
    def __init__(self, reader_cfg_key):
        self._logger = logging.getLogger(f'jb.rfid.532({reader_cfg_key})')
        super().__init__(reader_cfg_key=reader_cfg_key, description=DESCRIPTION, logger=self._logger)

        self.log_all_cards = cfg.setndefault('rfid', 'readers', reader_cfg_key, 'config', 'log_all_cards', value=False)

        self._keep_running = True
        self._abort = threading.Event()
        self._reset_done = threading.Event()
        self._reset_thread = None
        self._reset_started = 0.0
        self._hold_uid = ''
        self._last_uid = ''
        self._last_uid_time = 0.0
        # Logged first: if opening the reader hangs, the file shows a START without READY
        _event_log('START', 'jukebox started, opening the reader')
        self.device = self._open_device()
        _event_log('READY', 'reader set up, watchdog running')
        self._last_scan_time = time.monotonic()
        _readers.append(self)
        self._watchdog_thread = threading.Thread(target=self._watchdog, daemon=True,
                                                 name=f"{threading.current_thread().name}Watchdog")
        self._watchdog_thread.start()

    def _watchdog(self):
        """Reset the reader when no scan has finished for WATCHDOG_TIMEOUT_S"""
        tries = 0
        last_try = 0.0
        hang_start = 0.0
        while self._keep_running:
            time.sleep(WATCHDOG_CHECK_EVERY_S)
            now = time.monotonic()
            stalled = now - self._last_scan_time
            if stalled < WATCHDOG_TIMEOUT_S:
                if tries:
                    self._logger.info(f"Watchdog: reader works again after {tries} reset(s)")
                    _event_log('RECOVERED', f"after {tries} reset(s); reader was hung for about "
                                            f"{self._last_scan_time - hang_start:.0f} s")
                tries = 0
                continue
            if not tries:
                hang_start = self._last_scan_time
            wait = WATCHDOG_RETRY_AFTER_S if tries < WATCHDOG_MAX_TRIES else WATCHDOG_GIVE_UP_RETRY_S
            if tries and now - last_try < wait:
                continue
            if not self._keep_running:
                return
            tries += 1
            last_try = now
            if tries > WATCHDOG_MAX_TRIES:
                self._logger.error(f"Watchdog: reader still hangs after {tries - 1} resets. Power-cycle the box "
                                   f"(see pn532-reader-reset.md). Trying again every {WATCHDOG_GIVE_UP_RETRY_S:.0f} s")
                _event_log('GIVE-UP', f"still hung after {tries - 1} resets ({stalled:.0f} s), power-cycle the box; "
                                      f"try {tries}")
            else:
                self._logger.warning(f"Watchdog: no reader scan finished for {stalled:.0f} s, "
                                     f"resetting the reader (try {tries})")
                _event_log('HANG' if tries == 1 else 'RETRY',
                           f"no reader scan finished for {stalled:.0f} s, resetting (try {tries})")
            self.request_reset()

    def _open_device(self):
        device = _AbortableMifare(self._abort)
        device.SAMconfigure()
        # This would block scan_field() indefinitely
        # self.device.set_max_retries(MIFARE_WAIT_FOR_ENTRY)
        # This comes back every 5 tries, allowing a clean exit of this thread
        # And actually reduces CPU load by 0.3 %-points on a PI 3
        device.set_max_retries(MIFARE_SAFE_RETRIES)
        return device

    def request_reset(self) -> threading.Event:
        """Ask the reader thread to reset the chip. Returns an event that is set when the reader works again."""
        self._reset_done.clear()
        self._abort.set()
        return self._reset_done

    def _reset(self):
        """Reset the chip and set it up again. Runs in its own thread, so the reader thread can keep the card."""
        while self._keep_running:
            self._abort.clear()
            self.device.close()
            try:
                subprocess.run([PN532_RESET_SCRIPT], check=True, timeout=10,
                               stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
                device = self._open_device()
            except _ResetRequested:
                # Another reset was requested while this one was still setting up the chip: start over
                continue
            except Exception as ex:
                self._logger.error(f"Reader reset failed: {ex}")
                return
            self.device = device
            self._logger.info("Reader reset over RSTPDN and set up again")
            self._reset_done.set()
            return

    def cleanup(self):
        if self in _readers:
            _readers.remove(self)
        self.device.close()
        del self.device

    def stop(self):
        self._keep_running = False
        # Gets the reader thread out of py532lib's retry loops, so the jukebox stops quickly even if the bus hangs
        self._abort.set()

    def _card_during_reset(self) -> str:
        """The card to report while the reset runs"""
        time.sleep(0.05)
        if time.monotonic() - self._reset_started < HOLD_CARD_AT_MOST_S:
            return self._hold_uid
        return ''

    def _start_reset(self) -> str:
        """Start the reset thread and return the card to keep reporting meanwhile"""
        self._hold_uid = self._last_uid if time.monotonic() - self._last_uid_time < HOLD_CARD_IF_SEEN_WITHIN_S else ''
        self._logger.info(f"Resetting the reader{' (holding card ' + self._hold_uid + ')' if self._hold_uid else ''}")
        self._reset_started = time.monotonic()
        self._reset_thread = threading.Thread(target=self._reset, name=f"{threading.current_thread().name}Reset",
                                              daemon=True)
        self._reset_thread.start()
        return self._hold_uid

    def read_card(self) -> str:
        if self._reset_thread is not None:
            if self._reset_thread.is_alive():
                return self._card_during_reset()
            self._reset_thread = None
        if not self._keep_running:
            return ''
        try:
            # scan_field returns a byte array -> convert to true integer
            # if no card is present comes back with False
            byte_uid = self.device.scan_field()
            self._last_scan_time = time.monotonic()
        except _ResetRequested:
            return self._start_reset() if self._keep_running else ''
        if byte_uid is False:
            return ''
        if not self._keep_running:
            return ''
        try:
            card_uid = str(int(byte_uid.hex(), base=16))
        except ValueError:
            self._logger.debug(f"Error while reading card. Raw card ID = {byte_uid}")
            return ''

        self._last_uid = card_uid
        self._last_uid_time = time.monotonic()

        if self.log_all_cards is True:
            self._logger.debug(f"Card detected with ID = {card_uid}")

        return card_uid
