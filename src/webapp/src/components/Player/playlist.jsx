import { useContext, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  Box,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Typography,
} from '@mui/material';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';

import PlayerContext from '../../context/player/context';
import request from '../../utils/request';
import { toHHMMSS } from '../../utils/utils';

const fileName = (file = '') => file.split('/').pop().replace(/\.[^.]+$/, '');

const Playlist = () => {
  const { t } = useTranslation();
  const { state: { playerstatus } } = useContext(PlayerContext);
  // MPD increases 'playlist' every time the playlist changes: only reload then
  const { playlist: playlistVersion, song: currentPos } = playerstatus || {};

  const [tracks, setTracks] = useState([]);
  const currentRef = useRef(null);

  useEffect(() => {
    const loadPlaylist = async () => {
      const { result, error } = await request('playlistinfo');
      if (Array.isArray(result)) setTracks(result);
      if (error) console.error(error);
    };

    if (playlistVersion !== undefined) loadPlaylist();
  }, [playlistVersion]);

  // Keep the current track visible inside the list
  useEffect(() => {
    currentRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [currentPos, tracks]);

  const playTrack = async (pos) => {
    const { error } = await request('play_track', { pos: parseInt(pos, 10) });
    if (error) console.error(error);
  };

  if (tracks.length < 2) return null;

  return (
    <Box sx={{ marginTop: '20px', width: '100%' }}>
      <Typography variant="subtitle2" color="textSecondary">
        {t('player.playlist.title', { count: tracks.length })}
      </Typography>
      <List dense sx={{ maxHeight: '40vh', overflowY: 'auto' }}>
        {tracks.map((track) => {
          const isCurrent = track.pos === currentPos;
          const title = track.title || fileName(track.file);

          return (
            <ListItem
              key={track.id}
              ref={isCurrent ? currentRef : undefined}
              disablePadding
              secondaryAction={
                <Typography variant="body2" color="textSecondary">
                  {track.time ? toHHMMSS(parseInt(track.time, 10)) : ''}
                </Typography>
              }
            >
              <ListItemButton
                selected={isCurrent}
                onClick={() => playTrack(track.pos)}
                aria-label={t('player.playlist.play-track', { title })}
                sx={{ borderRadius: '4px' }}
              >
                <Box sx={{ width: '32px', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                  {isCurrent
                    ? <VolumeUpIcon fontSize="small" color="primary" />
                    : <Typography variant="body2" color="textSecondary">{parseInt(track.pos, 10) + 1}</Typography>
                  }
                </Box>
                <ListItemText
                  primary={title}
                  secondary={track.artist}
                  slotProps={{
                    primary: { noWrap: true, color: isCurrent ? 'primary' : undefined },
                    secondary: { noWrap: true },
                  }}
                  sx={{ paddingRight: '48px' }}
                />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>
    </Box>
  );
};

export default Playlist;
