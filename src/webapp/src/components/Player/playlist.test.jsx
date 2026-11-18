import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, test, vi } from 'vitest';

import PlayerContext from '../../context/player/context';
import request from '../../utils/request';
import Playlist from './playlist';

vi.mock('../../utils/request', () => ({
  default: vi.fn(),
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, options) => (options?.title ? `Play ${options.title}` : key),
  }),
}));

const tracks = [
  { id: '1', pos: '0', title: 'First', file: 'book/01.mp3', time: '60' },
  { id: '2', pos: '1', file: 'book/02 Second.mp3', time: '90' },
];

const renderPlaylist = (playlist) => {
  request.mockResolvedValue({ result: playlist });

  return render(
    <PlayerContext.Provider value={{ state: { playerstatus: { playlist: '4', song: '1' } } }}>
      <Playlist />
    </PlayerContext.Provider>,
  );
};

beforeEach(() => {
  request.mockReset();
  Element.prototype.scrollIntoView = vi.fn();
});

test('lists the tracks and falls back to the file name', async () => {
  renderPlaylist(tracks);

  expect(await screen.findByRole('button', { name: 'Play First' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Play 02 Second' })).toBeInTheDocument();
  expect(request).toHaveBeenCalledWith('playlistinfo');
});

test('tapping a track plays its playlist position', async () => {
  const user = userEvent.setup();
  renderPlaylist(tracks);

  await user.click(await screen.findByRole('button', { name: 'Play First' }));

  expect(request).toHaveBeenCalledWith('play_track', { pos: 0 });
});

test('stays hidden for a single track', async () => {
  const { container } = renderPlaylist([tracks[0]]);

  await waitFor(() => expect(request).toHaveBeenCalledWith('playlistinfo'));
  expect(container).toBeEmptyDOMElement();
});
