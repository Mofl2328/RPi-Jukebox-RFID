import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { v4 as uuidv4 } from 'uuid';

import {
  createSearchParams,
  useNavigate,
} from 'react-router-dom';

import {
  Button,
  Grid,
  Typography,
} from '@mui/material';

import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';

import { getActionAndCommand, getArgsValues } from '../../../utils';

import SelectedAlbum from './selected-album';
import SelectedFolder from './selected-folder';
import SelectedSingle from './selected-single';
import PlaybackId from './playback-id';

const SelectPlayMusic = ({
  actionData,
  cardId,
  playbackId,
  setPlaybackId,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const { action, command } = getActionAndCommand(actionData);
  const values = getArgsValues(actionData);
  const isAudiobook = action === 'play_audiobook';

  // An audiobook card needs an ID: generate one when a folder is chosen and the field is still empty
  useEffect(() => {
    if (isAudiobook && command === 'play_card' && setPlaybackId && !playbackId) {
      setPlaybackId(uuidv4().slice(0, 8));
    }
  }, [isAudiobook, command, playbackId, setPlaybackId]);

  const selectMusic = () => {
    const searchParams = createSearchParams({
      isSelecting: true,
      cardId,
      cardAction: action,
    });

    navigate({
      pathname: '/library',
      search: `?${searchParams}`,
   });
  };

  return (
    <Grid container>
      {command &&
        <Grid size={12}>
          <Typography>
            {t(`cards.controls.actions.play-music.commands.${command}`)}
          </Typography>
        </Grid>
      }
      <Grid size={12}>
        {command === 'play_album' && <SelectedAlbum values={values} />}
        {(command === 'play_card' || command === 'play_folder') && <SelectedFolder values={values} />}
        {command === 'play_single' && <SelectedSingle values={values} />}
      </Grid>

      <Grid size={12} sx={{ display: 'flex', justifyContent: 'center' }}>
        <Button
          variant="outlined"
          onClick={selectMusic}
          endIcon={<KeyboardArrowRightIcon />}
        >
          {t('cards.controls.actions.play-music.button-label')}
        </Button>
      </Grid>

      {isAudiobook && command === 'play_card' && setPlaybackId &&
        <Grid size={12}>
          <PlaybackId playbackId={playbackId} setPlaybackId={setPlaybackId} />
        </Grid>
      }
    </Grid>
  );
};

export default SelectPlayMusic;
