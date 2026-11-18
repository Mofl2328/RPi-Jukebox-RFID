import importlib
import logging
import sys
from unittest.mock import Mock

import pytest

import jukebox.plugs as plugs
from components.rfid.cardutils import decode_card_command


def _passthrough_decorator(obj=None, **ignored_kwargs):
    if obj is None:
        return lambda decorated: decorated
    return obj


@pytest.fixture
def cards(monkeypatch):
    for decorator in ('register', 'initialize', 'finalize', 'atexit'):
        monkeypatch.setattr(plugs, decorator, _passthrough_decorator)
    sys.modules.pop('components.rfid.cards', None)
    module = importlib.import_module('components.rfid.cards')
    monkeypatch.setattr(plugs, 'loaded_as', lambda ignored_name: 'cards')
    monkeypatch.setattr(module.publishing, 'get_publisher', Mock)
    module.cfg_cards.config_dict({})
    yield module
    module.cfg_cards.config_dict({})
    sys.modules.pop('components.rfid.cards', None)


def test_decode_passes_the_playback_id_to_play_card():
    action = decode_card_command({'alias': 'play_card', 'args': ['Books/Dragon'], 'playback_id': 42})

    assert action['kwargs'] == {'playback_id': '42'}


def test_decode_ignores_the_playback_id_for_other_commands():
    logger = Mock(spec=logging.Logger)

    action = decode_card_command({'alias': 'pause', 'playback_id': 'dragon'}, logger)

    assert 'playback_id' not in (action.get('kwargs') or {})
    logger.warning.assert_called_once()


def test_register_card_stores_the_playback_id(cards):
    cards.register_card('123', 'play_card', args=['Books/Dragon'], playback_id=' dragon ', auto_save=False)

    assert cards.cfg_cards['123']['playback_id'] == 'dragon'


@pytest.mark.parametrize(('alias', 'playback_id'), [('play_card', '  '), ('pause', 'dragon')])
def test_register_card_skips_unusable_playback_ids(cards, alias, playback_id):
    cards.register_card('123', alias, playback_id=playback_id, auto_save=False)

    assert 'playback_id' not in cards.cfg_cards['123']
