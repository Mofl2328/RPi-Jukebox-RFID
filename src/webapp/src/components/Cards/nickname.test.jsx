import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, test, vi } from 'vitest';

import request from '../../utils/request';
import ActionsControls from './controls/actions-controls';
import CardsList from './list';

vi.mock('../../utils/request', () => ({
  default: vi.fn().mockResolvedValue({ result: null }),
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: key => key }),
}));

const card = extra => ({
  action: { args: ['Books/Dragon'] },
  from_alias: 'play_folder',
  ...extra,
});

const renderList = cardsList => render(
  <MemoryRouter>
    <CardsList cardsList={cardsList} />
  </MemoryRouter>,
);

beforeEach(() => {
  request.mockClear();
});

test('the card list shows the nickname with the card ID below it', () => {
  renderList({ 123: card({ nickname: 'Raven' }) });

  expect(screen.getByText('Raven')).toBeInTheDocument();
  expect(screen.getByText('123 · play_folder, Books/Dragon')).toBeInTheDocument();
});

test('cards without a nickname keep showing their ID', () => {
  renderList({ 123: card() });

  expect(screen.getByText('123')).toBeInTheDocument();
  expect(screen.getByText('play_folder, Books/Dragon')).toBeInTheDocument();
});

test.each([
  [' Raven ', { nickname: 'Raven' }],
  ['   ', {}],
])('saving the nickname %j', async (nickname, expected) => {
  const user = userEvent.setup();
  render(
    <MemoryRouter>
      <ActionsControls
        actionData={{ action: 'audio', command: { name: 'play', args: {} } }}
        cardId="123"
        nickname={nickname}
      />
    </MemoryRouter>,
  );

  await user.click(screen.getByRole('button', { name: 'general.buttons.save' }));

  await waitFor(() => expect(request).toHaveBeenCalled());
  const kwargs = request.mock.calls[0][1];
  expect(kwargs.nickname).toBe(expected.nickname);
});
