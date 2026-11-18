import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Grid,
  Snackbar,
} from '@mui/material';

import request from '../../../utils/request';

// See pn532-reader-reset.md: hard-reset the PN532 RFID reader over GPIO 4.
// Normally the reader is reset and set up again while the jukebox keeps running; the answer then says so.
// Only if that fails, the backend falls back to a restart (the answer contains 'restart'): it answers first and
// restarts 1 s later. We then wait until the jukebox is gone (so we don't mistake the old process for the new
// one) and until it answers again.
const CHECK_EVERY_MS = 1000;
const DOWN_WITHIN_MS = 30000;
const GIVE_UP_MS = 120000;

export default function ResetReaderDialog() {
  const { t } = useTranslation();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [message, setMessage] = useState(null);
  const timers = useRef([]);

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  useEffect(() => clearTimers, []);

  const finish = (text) => {
    clearTimers();
    setResetting(false);
    setRestarting(false);
    setDialogOpen(false);
    setMessage(text);
  };

  const waitForJukebox = (startedAt) => {
    let wentDown = false;
    const check = async () => {
      const { error } = await request('playerstatus');
      const elapsed = Date.now() - startedAt;
      if (error) wentDown = true;
      else if (wentDown) return finish(t('settings.dialogs.reset-reader.done'));
      else if (elapsed > DOWN_WITHIN_MS) return finish(t('settings.dialogs.reset-reader.failed'));
      if (elapsed > GIVE_UP_MS) return finish(t('settings.dialogs.reset-reader.timeout'));
      timers.current.push(setTimeout(check, CHECK_EVERY_MS));
    };
    timers.current.push(setTimeout(check, CHECK_EVERY_MS));
  };

  const doReset = async () => {
    setResetting(true);
    const { result, error } = await request('resetRfidReader');
    if (error || !String(result).includes('successfully')) {
      return finish(`${t('settings.dialogs.reset-reader.failed')}${result ? `: ${result}` : ''}`);
    }
    if (!String(result).includes('restart')) {
      return finish(t('settings.dialogs.reset-reader.done-no-restart'));
    }
    setRestarting(true);
    waitForJukebox(Date.now());
  };

  return (
    <>
      <Button variant="outlined" onClick={() => setDialogOpen(true)}>
        {t('settings.dialogs.reset-reader.button-title')}
      </Button>
      <Dialog
        open={dialogOpen}
        onClose={() => !resetting && setDialogOpen(false)}
        aria-labelledby="reset-reader-dialog-title"
        aria-describedby="reset-reader-dialog-description"
      >
        <DialogTitle id="reset-reader-dialog-title">
          {!resetting && t('settings.dialogs.reset-reader.title')}
          {resetting && !restarting && t('settings.dialogs.reset-reader.resetting')}
          {restarting && t('settings.dialogs.reset-reader.restarting')}
        </DialogTitle>
        <DialogContent>
          {!resetting &&
            <DialogContentText id="reset-reader-dialog-description">
              {t('settings.dialogs.reset-reader.description-confirm')}
            </DialogContentText>
          }
          {resetting &&
            <Grid container spacing={2}>
              <Grid size={12} sx={{ display: 'flex', justifyContent: 'center' }}>
                <CircularProgress />
              </Grid>
            </Grid>
          }
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)} color="secondary" disabled={resetting}>
            {t('general.buttons.cancel')}
          </Button>
          <Button onClick={doReset} color="primary" autoFocus disabled={resetting}>
            {t('settings.dialogs.reset-reader.button-confirm')}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!message}
        autoHideDuration={5000}
        onClose={() => setMessage(null)}
        message={message}
      />
    </>
  );
}
