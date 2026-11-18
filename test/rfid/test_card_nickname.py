import importlib
import sys
from unittest.mock import Mock

import pytest

import jukebox.plugs as plugs


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


def test_register_card_stores_the_trimmed_nickname(cards):
    cards.register_card('123', 'pause', nickname=' Raven ', auto_save=False)

    assert cards.cfg_cards['123']['nickname'] == 'Raven'


@pytest.mark.parametrize('nickname', [None, '', '   '])
def test_register_card_stores_no_empty_nickname(cards, nickname):
    cards.register_card('123', 'pause', nickname=nickname, auto_save=False)

    assert 'nickname' not in cards.cfg_cards['123']


def test_saving_without_a_nickname_removes_it(cards):
    cards.register_card('123', 'pause', nickname='Raven', auto_save=False)

    cards.register_card('123', 'pause', overwrite=True, auto_save=False)

    assert 'nickname' not in cards.cfg_cards['123']


def test_list_cards_returns_the_nickname(cards, monkeypatch):
    monkeypatch.setattr(cards.plugs, 'get', lambda *ignored: None)
    cards.register_card('123', 'pause', nickname='Raven', auto_save=False)
    cards.register_card('456', 'pause', auto_save=False)

    card_list = cards.list_cards()

    assert card_list['123']['nickname'] == 'Raven'
    assert 'nickname' not in card_list['456']
