import { useTranslation } from 'react-i18next';

import {
  Avatar,
  Card,
  CardContent,
  CardHeader,
  Grid,
  TextField,
  Typography
} from '@mui/material';
import BookmarkIcon from '@mui/icons-material/Bookmark';

import Header from '../Header';
import ActionsControls from './controls/actions-controls';
import ControlsSelector from './controls/controls-selector';

const InfoNoCardSwiped = () => {
  const { t } = useTranslation();

  return (
    <Typography>
      {`⚠️ ${t('cards.form.no-card-swiped')}`}
    </Typography>
  );
};

const CardsForm = ({
  title,
  cardId,
  actionData,
  setActionData,
  nickname = '',
  setNickname,
}) => {
  const { t } = useTranslation();

  return (
    <>
      <Header title={title} backLink="/cards" />
      <Grid container size={12}>
        <Grid size={12}>
          <Card elevation={0}>
            <CardHeader
              avatar={
                <Avatar aria-label={t('cards.form.no-card-swiped')}>
                  <BookmarkIcon />
                </Avatar>
              }
              title={
                cardId
                  ? (nickname.trim() || cardId)
                  : t('cards.form.no-card-id')
              }
              subheader={cardId && nickname.trim() ? cardId : undefined}
            />
            <CardContent>
              {cardId &&
                <>
                  {setNickname &&
                    <TextField
                      fullWidth
                      size="small"
                      label={t('cards.form.nickname.label')}
                      helperText={t('cards.form.nickname.helper')}
                      value={nickname}
                      onChange={(event) => setNickname(event.target.value)}
                      slotProps={{ htmlInput: { maxLength: 64 } }}
                      sx={{ marginBottom: '24px' }}
                    />
                  }
                  <Grid container sx={{ alignItems: 'center' }}>
                    <ControlsSelector
                      actionData={actionData}
                      setActionData={setActionData}
                      cardId={cardId}
                    />
                  </Grid>
                  <ActionsControls
                    actionData={actionData}
                    cardId={cardId}
                    nickname={nickname}
                  />
                </>
              }
              {!cardId && <InfoNoCardSwiped />}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </>
  );
};



export default CardsForm;
