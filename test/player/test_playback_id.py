from contextlib import nullcontext
from types import SimpleNamespace
from unittest.mock import Mock

import pytest

from components.player.backends.mpd import PlayerMPD
from components.player.coordinator import PlayerCoordinator
from components.player.playcontentcallback import PlayCardState, PlayContentCallbacks


FOLDER = 'Books/Dragon'
FILES = [f'{FOLDER}/01.mp3', f'{FOLDER}/02.mp3', f'{FOLDER}/03.mp3']


def backend_with_playlist(files=None):
    backend = PlayerMPD.__new__(PlayerMPD)
    playlist = [{'file': file} for file in (FILES if files is None else files)]
    backend.mpd_lock = nullcontext()
    backend.mpd_client = SimpleNamespace(playlistinfo=Mock(return_value=playlist), seek=Mock())
    backend.mpd_retry_with_mutex = lambda command, *args: command(*args)
    backend.mpd_status = {}
    backend.playback_positions = SimpleNamespace(save_to_json=Mock())
    return backend


def saved_position(**overrides):
    return {
        'folder': FOLDER,
        'song': '1',
        'file': FILES[1],
        'elapsed': '42.5',
        'duration': '100.0',
        **overrides,
    }


def test_resumes_at_the_saved_track_and_time():
    backend = backend_with_playlist()

    backend._resume_playback_id('dragon', FOLDER, saved_position())

    backend.mpd_client.seek.assert_called_once_with(1, 42.5)


def test_finds_a_moved_track_by_file_name():
    backend = backend_with_playlist([FILES[1], FILES[0], FILES[2]])

    backend._resume_playback_id('dragon', FOLDER, saved_position())

    backend.mpd_client.seek.assert_called_once_with(0, 42.5)


@pytest.mark.parametrize('saved', [
    {},
    saved_position(folder='Books/Other'),
    saved_position(song='9', file=f'{FOLDER}/gone.mp3'),
    saved_position(song='2', file=FILES[2], elapsed='98.0'),
])
def test_starts_from_the_beginning_without_a_usable_position(saved):
    backend = backend_with_playlist()

    backend._resume_playback_id('dragon', FOLDER, saved)

    backend.mpd_client.seek.assert_not_called()


def test_second_swipe_needs_the_same_playback_id():
    backend = backend_with_playlist()
    backend.second_swipe_action = Mock()
    backend.music_player_status = {'player_status': {'last_played_folder': FOLDER}}
    backend.active_playback_id = 'dragon'

    assert backend.is_second_swipe(FOLDER, 'dragon') is True
    assert backend.is_second_swipe(FOLDER, 'other-child') is False
    assert backend.is_second_swipe(FOLDER) is True


def test_status_poll_records_the_active_position():
    backend = backend_with_playlist()
    backend.playback_positions = MockPositions()
    backend.active_playback_id = 'dragon'
    backend.active_playback_folder = FOLDER
    backend.mpd_status = {'state': 'play', 'file': FILES[2], 'song': '2', 'elapsed': '7.0', 'duration': '50.0'}

    backend._update_playback_position(poll_started=1.0)

    assert backend.playback_positions['dragon']['file'] == FILES[2]
    assert backend.playback_positions['dragon']['elapsed'] == '7.0'
    assert backend.playback_positions.saved == 1


def test_status_poll_ignores_other_folders_and_older_status():
    backend = backend_with_playlist()
    backend.playback_positions = MockPositions()
    backend.active_playback_id = 'dragon'
    backend.active_playback_folder = FOLDER
    backend.mpd_status = {'state': 'play', 'file': 'Music/other.mp3', 'song': '0'}

    backend._update_playback_position(poll_started=1.0)
    assert 'dragon' not in backend.playback_positions

    backend.mpd_status['file'] = FILES[0]
    backend._playback_active_since = 5.0
    backend._update_playback_position(poll_started=1.0)
    assert 'dragon' not in backend.playback_positions


def test_playing_other_content_stops_tracking():
    backend = backend_with_playlist()
    backend.playback_positions = MockPositions()
    backend.active_playback_id = 'dragon'
    backend.active_playback_folder = FOLDER
    backend.mpd_client.clear = Mock()
    backend.mpd_client.addid = Mock()
    backend.mpd_client.play = Mock()

    backend.play_single('Music/song.mp3')

    assert backend.active_playback_id is None
    assert backend.playback_positions.saved == 1


class MockPositions(dict):
    saved = 0

    def save_to_json(self):
        self.saved += 1


def coordinator_with(is_second_swipe):
    backend = SimpleNamespace(
        is_second_swipe=Mock(return_value=is_second_swipe),
        play_second_swipe=Mock(),
        play_folder=Mock(),
        play_folder_with_playback_id=Mock(),
    )
    callbacks = Mock(spec=PlayContentCallbacks)
    coordinator = PlayerCoordinator(callbacks)
    coordinator.register_backend('mpd', backend)
    return coordinator, backend, callbacks


def test_first_swipe_resumes_the_playback_id():
    coordinator, backend, callbacks = coordinator_with(False)

    coordinator.play_card(FOLDER, True, playback_id=42)

    backend.is_second_swipe.assert_called_once_with(FOLDER, '42')
    backend.play_folder_with_playback_id.assert_called_once_with(FOLDER, True, '42')
    backend.play_folder.assert_not_called()
    callbacks.run_callbacks.assert_called_once_with(FOLDER, PlayCardState.firstSwipe)


def test_second_swipe_with_a_playback_id_runs_the_swipe_action():
    coordinator, backend, callbacks = coordinator_with(True)

    coordinator.play_card(FOLDER, playback_id='dragon')

    backend.play_second_swipe.assert_called_once_with()
    backend.play_folder_with_playback_id.assert_not_called()
    callbacks.run_callbacks.assert_called_once_with(FOLDER, PlayCardState.secondSwipe)


def test_cards_without_a_playback_id_are_unchanged():
    coordinator, backend, ignored_callbacks = coordinator_with(False)

    coordinator.play_card(FOLDER, True)

    backend.is_second_swipe.assert_called_once_with(FOLDER)
    backend.play_folder.assert_called_once_with(FOLDER, True)
    backend.play_folder_with_playback_id.assert_not_called()
