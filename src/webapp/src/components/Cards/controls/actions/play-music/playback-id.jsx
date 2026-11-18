import { useTranslation } from 'react-i18next';
import { v4 as uuidv4 } from 'uuid';

import {
  Button,
  Grid,
  TextField,
} from '@mui/material';

const PlaybackId = ({
  playbackId = '',
  setPlaybackId,
}) => {
  const { t } = useTranslation();

  return (
    <Grid container spacing={1} sx={{ alignItems: 'center', marginTop: '10px', marginBottom: '10px' }}>
      <Grid size={8}>
        <TextField
          fullWidth
          size="small"
          label={t('cards.controls.actions.play-music.playback-id.label')}
          helperText={t('cards.controls.actions.play-music.playback-id.helper')}
          value={playbackId}
          onChange={(event) => setPlaybackId(event.target.value)}
          slotProps={{ htmlInput: { maxLength: 64 } }}
        />
      </Grid>
      <Grid size={4} sx={{ alignSelf: 'flex-start', paddingTop: '4px' }}>
        <Button
          size="small"
          onClick={() => setPlaybackId(uuidv4().slice(0, 8))}
        >
          {t('cards.controls.actions.play-music.playback-id.generate')}
        </Button>
      </Grid>
    </Grid>
  );
};

export default PlaybackId;
