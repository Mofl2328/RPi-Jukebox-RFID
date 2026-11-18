import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';

import PubSubContext from '../../context/pubsub/context';
import request from '../../utils/request';
import Volume from './volume';

vi.mock('../../utils/request', () => ({
  default: vi.fn(),
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: key => key }),
}));

const renderVolume = (maxVolume) => {
  request.mockImplementation(async (command) => ({
    result: { getVolume: 10, getMaxVolume: maxVolume }[command],
  }));

  render(
    <PubSubContext.Provider value={{ state: {} }}>
      <Volume />
    </PubSubContext.Provider>,
  );
};

beforeEach(() => {
  request.mockReset();
});

test('the bar spans 0 to the maximum volume', async () => {
  renderVolume(30);

  await waitFor(() => {
    expect(screen.getByRole('slider')).toHaveAttribute('max', '30');
  });
});

test('a maximum volume of 0 keeps a usable slider range', async () => {
  renderVolume(0);

  await waitFor(() => {
    expect(screen.getByRole('slider')).toHaveAttribute('max', '1');
  });
});

test('committing the slider sends the selected volume', async () => {
  renderVolume(30);
  await waitFor(() => {
    expect(screen.getByRole('slider')).toHaveAttribute('max', '30');
  });

  fireEvent.change(screen.getByRole('slider'), { target: { value: '25' } });

  await waitFor(() => {
    expect(request).toHaveBeenCalledWith('setVolume', { volume: 25 });
  });
});
