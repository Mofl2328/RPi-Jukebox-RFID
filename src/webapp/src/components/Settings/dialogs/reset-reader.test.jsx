import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, test, vi } from 'vitest';

import request from '../../../utils/request';
import ResetReaderDialog from './reset-reader';

vi.mock('../../../utils/request', () => ({
  default: vi.fn(),
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: key => key }),
}));

const confirmReset = async () => {
  const user = userEvent.setup();
  render(<ResetReaderDialog />);

  await user.click(screen.getByRole('button', { name: 'settings.dialogs.reset-reader.button-title' }));
  await user.click(screen.getByRole('button', { name: 'settings.dialogs.reset-reader.button-confirm' }));
};

beforeEach(() => {
  request.mockReset();
});

test('reports a reset that kept the Jukebox running', async () => {
  request.mockResolvedValue({ result: 'RFID reader reset successfully, jukebox kept running' });

  await confirmReset();

  expect(request).toHaveBeenCalledWith('resetRfidReader');
  expect(await screen.findByText('settings.dialogs.reset-reader.done-no-restart')).toBeInTheDocument();
});

test('shows why a reset failed', async () => {
  request.mockResolvedValue({ result: 'I am not running as a service! Doing nothing' });

  await confirmReset();

  expect(await screen.findByText(
    'settings.dialogs.reset-reader.failed: I am not running as a service! Doing nothing',
  )).toBeInTheDocument();
});
