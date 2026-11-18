import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, test, vi } from 'vitest';

import request from '../../../utils/request';
import { buildActionData } from '../utils';
import ActionsControls from './actions-controls';
import SelectPlayMusic from './actions/play-music';

vi.mock('../../../utils/request', () => ({
  default: vi.fn().mockResolvedValue({ result: null }),
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: key => key }),
}));

const folderAction = action => buildActionData(action, 'play_card', { folder: 'Books/Dragon' });

const saveCard = async (actionData, playbackId) => {
  const user = userEvent.setup();
  render(
    <MemoryRouter>
      <ActionsControls actionData={actionData} cardId="123" playbackId={playbackId} />
    </MemoryRouter>,
  );

  await user.click(screen.getByRole('button', { name: 'general.buttons.save' }));
  await waitFor(() => expect(request).toHaveBeenCalled());
  return request.mock.calls[0][1];
};

beforeEach(() => {
  request.mockClear();
});

test('audiobook cards are saved with their playback ID', async () => {
  const kwargs = await saveCard(folderAction('play_audiobook'), ' dragon-1 ');

  expect(kwargs).toMatchObject({ cmd_alias: 'play_card', playback_id: 'dragon-1' });
});

test('music cards are saved without a playback ID', async () => {
  const kwargs = await saveCard(folderAction('play_music'), 'dragon-1');

  expect(kwargs).not.toHaveProperty('playback_id');
});

test('an audiobook folder gets a generated playback ID', async () => {
  const setPlaybackId = vi.fn();
  render(
    <MemoryRouter>
      <SelectPlayMusic
        actionData={folderAction('play_audiobook')}
        cardId="123"
        playbackId=""
        setPlaybackId={setPlaybackId}
      />
    </MemoryRouter>,
  );

  await waitFor(() => expect(setPlaybackId).toHaveBeenCalledWith(expect.stringMatching(/^[0-9a-f-]{8}$/)));
});

test('music cards do not show the playback ID field', () => {
  render(
    <MemoryRouter>
      <SelectPlayMusic
        actionData={folderAction('play_music')}
        cardId="123"
        playbackId=""
        setPlaybackId={vi.fn()}
      />
    </MemoryRouter>,
  );

  expect(screen.queryByLabelText('cards.controls.actions.play-music.playback-id.label')).not.toBeInTheDocument();
});
