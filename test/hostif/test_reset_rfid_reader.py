import importlib
import sys
from types import SimpleNamespace
from unittest.mock import Mock

import pytest

import jukebox.plugs as plugin


def _passthrough_decorator(obj=None, **ignored_kwargs):
    if obj is None:
        return lambda decorated: decorated
    return obj


@pytest.fixture
def hostif_linux(monkeypatch):
    for decorator in ('register', 'initialize', 'finalize', 'atexit'):
        monkeypatch.setattr(plugin, decorator, _passthrough_decorator)
    monkeypatch.setattr(plugin, 'loaded_as', lambda ignored_name: 'host')
    importlib.import_module('jukebox.publishing')

    sys.modules.pop('components.hostif.linux', None)
    module = importlib.import_module('components.hostif.linux')
    yield module
    sys.modules.pop('components.hostif.linux', None)


def _use_driver(monkeypatch, module, reset_works):
    driver = SimpleNamespace(request_reset=Mock(return_value=reset_works))
    monkeypatch.setitem(sys.modules, module.PN532_DRIVER_MODULE, driver)
    return driver


def test_driver_reset_keeps_the_jukebox_running(hostif_linux, monkeypatch):
    driver = _use_driver(monkeypatch, hostif_linux, True)
    run = Mock()
    monkeypatch.setattr(hostif_linux.subprocess, 'run', run)

    answer = hostif_linux.reset_rfid_reader()

    assert 'successfully' in answer
    assert 'kept running' in answer
    assert 'restart' not in answer
    driver.request_reset.assert_called_once_with(timeout=6.0)
    run.assert_not_called()


def test_failed_driver_reset_restarts_the_service(hostif_linux, monkeypatch):
    _use_driver(monkeypatch, hostif_linux, False)
    monkeypatch.setattr(hostif_linux, '_runs_in_jukebox_service', lambda: True)
    monkeypatch.setattr(hostif_linux.os, 'access', lambda path, mode: True)
    run = Mock(return_value=SimpleNamespace(returncode=0))
    monkeypatch.setattr(hostif_linux.subprocess, 'run', run)

    answer = hostif_linux.reset_rfid_reader()

    assert 'successfully' in answer
    assert 'restart' in answer
    assert 'systemctl --user restart jukebox-daemon.service' in run.call_args.args[0]


def test_no_restart_outside_the_service(hostif_linux, monkeypatch):
    _use_driver(monkeypatch, hostif_linux, False)
    monkeypatch.setattr(hostif_linux, '_runs_in_jukebox_service', lambda: False)
    run = Mock()
    monkeypatch.setattr(hostif_linux.subprocess, 'run', run)

    answer = hostif_linux.reset_rfid_reader()

    assert 'not running as a service' in answer
    run.assert_not_called()


def test_missing_reset_script_is_reported(hostif_linux, monkeypatch):
    _use_driver(monkeypatch, hostif_linux, False)
    monkeypatch.setattr(hostif_linux, '_runs_in_jukebox_service', lambda: True)
    monkeypatch.setattr(hostif_linux.os, 'access', lambda path, mode: False)

    assert 'not found' in hostif_linux.reset_rfid_reader()


@pytest.mark.parametrize(('main_pid', 'expected'), [('own', True), ('parent', True), ('0', False), ('', False)])
def test_service_check_accepts_the_wrapper_process(hostif_linux, monkeypatch, main_pid, expected):
    monkeypatch.setattr(hostif_linux.os, 'getpid', lambda: 100)
    monkeypatch.setattr(hostif_linux.os, 'getppid', lambda: 99)
    output = {'own': '100', 'parent': '99'}.get(main_pid, main_pid)
    monkeypatch.setattr(
        hostif_linux.subprocess,
        'run',
        Mock(return_value=SimpleNamespace(stdout=output.encode())),
    )

    assert hostif_linux._runs_in_jukebox_service() is expected
