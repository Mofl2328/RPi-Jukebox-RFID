import { useContext, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import Slider from '@mui/material/Slider';
import VolumeDownIcon from '@mui/icons-material/VolumeDown';
import VolumeMuteIcon from '@mui/icons-material/VolumeMute';
import VolumeOffIcon from '@mui/icons-material/VolumeOff';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import { useTheme } from '@mui/material/styles';

import PubSubContext from '../../context/pubsub/context';
import request from '../../utils/request';

const Volume = () => {
  const theme = useTheme();
  const { t } = useTranslation();
  const { state } = useContext(PubSubContext);
  const { 'volume.level': { volume, mute } = {} } = state;

  const [isChangingVolume, setIsChangingVolume] = useState(false);
  const [_volume, setVolume] = useState(0);
  const [volumeMute, setVolumeMute] = useState(false);
  const [maxVolume, setMaxVolume] = useState(100);
  const [volumeStep] = useState(1);
  const changeEndTimeout = useRef(null);

  // The bar spans 0 to the maximum, so a low maximum still uses its full width.
  // A maximum of 0 is allowed, but a slider needs a range greater than 0.
  const sliderMax = Math.max(maxVolume, 1);

  const toggleVolumeMute = () => {
    setVolumeMute(!volumeMute);
    request('toggleMuteVolume', { mute: !volumeMute });
  };

  const updateVolume = (event, newVolume) => {
    const committedVolume = Math.min(newVolume, maxVolume);
    setVolume(committedVolume);
    request('setVolume', { volume: committedVolume });
    // Delay the next command to avoid jumping slide control
    clearTimeout(changeEndTimeout.current);
    changeEndTimeout.current = setTimeout(() => setIsChangingVolume(false), 500);
  }

  const handleVolumeChange = (event, newVolume) => {
    clearTimeout(changeEndTimeout.current);
    setIsChangingVolume(true);
    setVolume(Math.min(newVolume, maxVolume));
  }

  useEffect(() => () => clearTimeout(changeEndTimeout.current), []);

  useEffect(() => {
    // Only trigger API when not dragging volume bar
    if (volume !== undefined && mute !== undefined && !isChangingVolume) {
      setVolume(volume);
      setVolumeMute(!!mute);
    }
  }, [isChangingVolume, volume, mute]);

  useEffect(() => {
    const fetchVolume = async () =>  {
      const { result } = await request('getVolume');
      setVolume(result);
    }

    const fetchMaxVolume = async () =>  {
      const { result } = await request('getMaxVolume');
      setMaxVolume(result);
    }

    fetchVolume();
    fetchMaxVolume();
  }, []);

  const labelIcon = () => (
    volumeMute
      ? t('player.volume.unmute')
      : t('player.volume.mute')
  );

  return (
    <Grid
      container
      sx={{ alignItems: 'center', width: '100%' }}
    >
      <Grid sx={{ marginRight: theme.spacing(1) }}>
        <IconButton
          aria-label={labelIcon()}
          onClick={toggleVolumeMute}
          title={labelIcon()}
        >
          {volumeMute && <VolumeOffIcon />}
          {!volumeMute && _volume === 0 && <VolumeMuteIcon />}
          {!volumeMute && _volume > 0 && _volume < 50 && <VolumeDownIcon />}
          {!volumeMute && _volume >= 50 && <VolumeUpIcon />}
        </IconButton>
      </Grid>
      <Grid size="grow" sx={{ marginTop: theme.spacing(1) }}>
        <Slider
          aria-labelledby={t('player.volume.slider')}
          onChange={handleVolumeChange}
          onChangeCommitted={updateVolume}
          disabled={!!volumeMute}
          marks={sliderMax <= 20}
          max={sliderMax}
          step={volumeStep}
          value={_volume}
          valueLabelDisplay="auto"
        />
      </Grid>
    </Grid>
  );
}

export default Volume;
