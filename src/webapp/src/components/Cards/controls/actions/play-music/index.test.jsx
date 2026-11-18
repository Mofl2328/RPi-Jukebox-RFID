import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, test, vi } from 'vitest';

import { buildActionData } from '../../../utils';
import SelectPlayMusic from './index';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: key => key }),
}));

const renderSelection = actionData => render(
  <MemoryRouter>
    <SelectPlayMusic actionData={actionData} cardId="123" />
  </MemoryRouter>,
);

test('the button shares a row with the selected music', () => {
  renderSelection(buildActionData('play_music', 'play_folder', { folder: 'Books/Dragon' }));

  const button = screen.getByRole('button', { name: 'cards.controls.actions.play-music.button-label' });

  expect(button.parentElement.parentElement).toHaveTextContent('Books/Dragon');
});

test('the button is available before music is selected', () => {
  renderSelection(buildActionData('play_music'));

  expect(screen.getByRole('button', { name: 'cards.controls.actions.play-music.button-label' })).toBeInTheDocument();
});
