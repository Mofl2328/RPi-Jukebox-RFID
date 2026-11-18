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
  const [nickname, setNickname] = useState('');

  useEffect(() => {
    setState(state => (omit(['rfid.card_id'], state)));
  }, [setState]);

  useEffect(() => {
    setCardId(swipedCardId || registerCard?.cardId);
  }, [registerCard, swipedCardId])

  // Keep the nickname when a known card is registered again
  useEffect(() => {
    const loadNickname = async () => {
      if (!cardId) return;
      const { result } = await request('cardsList');
      const existingNickname = result?.[cardId]?.nickname;
      if (existingNickname) setNickname(current => current || existingNickname);
    };

    loadNickname();
  }, [cardId]);

  return (
    <CardsForm
      title={t('cards.register.register-card')}
      cardId={cardId}
      actionData={actionData}
      setActionData={setActionData}
      nickname={nickname}
      setNickname={setNickname}
    />
  );
};

export default CardsRegister;
