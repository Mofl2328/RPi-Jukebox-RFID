from contextlib import nullcontext
from types import SimpleNamespace
from unittest.mock import Mock

from components.player.backends.mpd import PlayerMPD
from components.player.coordinator import PlayerCoordinator


def test_backend_plays_the_position_as_integer():
    backend = PlayerMPD.__new__(PlayerMPD)
    backend.mpd_lock = nullcontext()
    backend.mpd_client = SimpleNamespace(play=Mock())

    backend.play_track('3')

    backend.mpd_client.play.assert_called_once_with(3)


def test_coordinator_forwards_to_the_active_backend():
    backend = SimpleNamespace(play_track=Mock(), stop=Mock(), exit=Mock())
    coordinator = PlayerCoordinator()
    coordinator.register_backend('mpd', backend)

    coordinator.play_track(2)

    backend.play_track.assert_called_once_with(2)
