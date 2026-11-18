import { useContext, useEffect, useState } from 'react';
import { omit } from 'ramda';
import { useTranslation } from 'react-i18next';

import PubSubContext from '../../context/pubsub/context';
import request from '../../utils/request';
import CardsForm from './form';
import { useLocation } from 'react-router-dom';

const CardsRegister = () => {
  const { t } = useTranslation();
  const {
    state: { 'rfid.card_id': swipedCardId },
    setState
  } = useContext(PubSubContext);
  const { state: locationState } = useLocation();
  const { registerCard } = locationState || {};

  const [cardId, setCardId] = useState(undefined);
  const [actionData, setActionData] = useState(registerCard?.actionData || {});
  const [playbackId, setPlaybackId] = useState('');

  useEffect(() => {
    setState(state => (omit(['rfid.card_id'], state)));
  }, [setState]);

  useEffect(() => {
    setCardId(swipedCardId || registerCard?.cardId);
  }, [registerCard, swipedCardId])

  // Keep the playback_id when a known card is registered again, e.g. with a new folder
  useEffect(() => {
    const loadPlaybackId = async () => {
      if (!cardId) return;
      const { result } = await request('cardsList');
      const existing = result?.[cardId]?.playback_id;
      // The existing ID wins over a generated one, so the saved position isn't lost
      if (existing) setPlaybackId(existing);
    };

    loadPlaybackId();
  }, [cardId]);

  return (
    <CardsForm
      title={t('cards.register.register-card')}
      cardId={cardId}
      actionData={actionData}
      setActionData={setActionData}
      playbackId={playbackId}
      setPlaybackId={setPlaybackId}
    />
  );
};

export default CardsRegister;
