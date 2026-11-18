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
  const [nickname, setNickname] = useState('');

  useEffect(() => {
    const loadCardList = async () => {
      if (cardId) {
        const { result, error } = await request('cardsList');

        if (result && result[cardId]) {
          const {
            action: { args },
            from_alias: command,
            nickname: savedNickname,
          } = result[cardId];

          const action = findActionByCommand(command);
          const actionData = buildActionData(action, command, args);

          setActionData(actionData);
          setNickname(savedNickname || '');
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
      nickname={nickname}
      setNickname={setNickname}
    />
  );
};

export default CardsEdit;
