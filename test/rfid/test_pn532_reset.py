import importlib
import sys
import threading
import time
from types import ModuleType
from unittest.mock import Mock

import pytest


DRIVER = 'components.rfid.hardware.pn532_i2c_py532.pn532_i2c_py532'


class FakeMifare:
    def __init__(self):
        self.PN532 = Mock()

    def SAMconfigure(self):
        pass

    def set_max_retries(self, retries):
        pass


@pytest.fixture
def driver(monkeypatch, tmp_path):
    package = ModuleType('py532lib')
    mifare = ModuleType('py532lib.mifare')
    mifare.Mifare = FakeMifare
    mifare.MIFARE_WAIT_FOR_ENTRY = 0xFF
    mifare.MIFARE_SAFE_RETRIES = 5
    monkeypatch.setitem(sys.modules, 'py532lib', package)
    monkeypatch.setitem(sys.modules, 'py532lib.mifare', mifare)

    sys.modules.pop(DRIVER, None)
    module = importlib.import_module(DRIVER)
    monkeypatch.setattr(module, 'WATCHDOG_LOG_FILE', str(tmp_path / 'reader-watchdog.log'))
    yield module
    sys.modules.pop(DRIVER, None)


def _reader(module, **attributes):
    reader = module.ReaderClass.__new__(module.ReaderClass)
    reader._logger = Mock()
    reader._keep_running = True
    reader._abort = threading.Event()
    reader._reset_done = threading.Event()
    reader._reset_thread = None
    reader._reset_started = 0.0
    reader._hold_uid = ''
    reader._last_uid = ''
    reader._last_uid_time = 0.0
    reader._last_scan_time = time.monotonic()
    for name, value in attributes.items():
        setattr(reader, name, value)
    return reader


def _log(module):
    with open(module.WATCHDOG_LOG_FILE) as log_file:
        return log_file.read()


def test_i2c_access_raises_while_a_reset_is_requested(driver):
    abort = threading.Event()
    device = driver._AbortableMifare(abort)
    assert device.PN532 is not None

    abort.set()

    with pytest.raises(driver._ResetRequested):
        device.PN532


def test_reset_request_escapes_except_exception_retry_loops(driver):
    assert not issubclass(driver._ResetRequested, Exception)


def test_reset_without_an_open_reader_fails(driver):
    assert driver.request_reset() is False
    assert 'MANUAL' in _log(driver)


def test_event_log_never_raises(driver, monkeypatch, tmp_path):
    monkeypatch.setattr(driver, 'WATCHDOG_LOG_FILE', str(tmp_path / 'missing' / 'reader-watchdog.log'))

    driver._event_log('HANG', 'cannot be written')


def test_recent_card_is_held_while_the_reader_resets(driver, monkeypatch):
    finish_reset = threading.Event()
    monkeypatch.setattr(driver.ReaderClass, '_reset', lambda self: finish_reset.wait(5))
    device = Mock()
    device.scan_field.side_effect = driver._ResetRequested()
    reader = _reader(driver, device=device, _last_uid='1234', _last_uid_time=time.monotonic())

    try:
        assert reader.read_card() == '1234'
        assert reader.read_card() == '1234'
        device.scan_field.assert_called_once()
    finally:
        finish_reset.set()
        reader._reset_thread.join(5)


def test_old_card_is_not_held(driver, monkeypatch):
    finish_reset = threading.Event()
    monkeypatch.setattr(driver.ReaderClass, '_reset', lambda self: finish_reset.wait(5))
    device = Mock()
    device.scan_field.side_effect = driver._ResetRequested()
    reader = _reader(driver, device=device, _last_uid='1234', _last_uid_time=time.monotonic() - 60)

    try:
        assert reader.read_card() == ''
    finally:
        finish_reset.set()
        reader._reset_thread.join(5)


def test_watchdog_resets_a_hung_reader(driver, monkeypatch):
    monkeypatch.setattr(driver, 'WATCHDOG_CHECK_EVERY_S', 0)
    reader = _reader(driver, _last_scan_time=time.monotonic() - 60)

    def stop_after_reset():
        reader._keep_running = False

    reader.request_reset = Mock(side_effect=stop_after_reset)

    reader._watchdog()

    reader.request_reset.assert_called_once_with()
    assert 'HANG' in _log(driver)


def test_watchdog_leaves_a_working_reader_alone(driver, monkeypatch):
    reader = _reader(driver)
    reader.request_reset = Mock()

    def stop_after_first_check(ignored_seconds):
        reader._keep_running = False

    monkeypatch.setattr(driver.time, 'sleep', stop_after_first_check)

    reader._watchdog()

    reader.request_reset.assert_not_called()
