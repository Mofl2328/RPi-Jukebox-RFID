import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import request from '../../utils/request';
import CardsForm from './form';
import {
  buildActionData,
  findActionByCommand,
} from './utils';

const CardsEdit = () => {
  const { t } = useTranslation();
  const { cardId } = useParams();
  const [actionData, setActionData] = useState({});
  const [playbackId, setPlaybackId] = useState('');

  useEffect(() => {
    const loadCardList = async () => {
      if (cardId) {
        const { result, error } = await request('cardsList');

        if (result && result[cardId]) {
          const {
            action: { args },
            from_alias: alias,
            playback_id,
          } = result[cardId];

          // Folder cards are always saved as play_card
          const command = alias === 'play_folder' ? 'play_card' : alias;
          // A play_card card with a playback_id is shown as "Play audiobook"
          const action = (command === 'play_card' && playback_id)
            ? 'play_audiobook'
            : findActionByCommand(command);
          const actionData = buildActionData(action, command, args);

          setActionData(actionData);
          setPlaybackId(playback_id || '');
        }

        if (error) {
          console.error(error);
        }
      }
    }

    loadCardList();
  }, [cardId]);

  return (
    <CardsForm
      title={t('cards.edit.edit-card')}
      cardId={cardId}
      actionData={actionData}
      setActionData={setActionData}
      playbackId={playbackId}
      setPlaybackId={setPlaybackId}
    />
  );
};

export default CardsEdit;
