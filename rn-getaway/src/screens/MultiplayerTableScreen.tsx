import React, { useEffect } from 'react';
import TableScreen from './table';
import { socketManager } from '../services/socket';

export default function MultiplayerTableScreen({ navigation }: any) {
  useEffect(() => {
    const socket = socketManager.getRawSocket();
    if (!socket) return;
    const onEnd = () => navigation.replace('Results');
    socket.on('match_end', onEnd);
    return () => { socket.off('match_end', onEnd); };
  }, [navigation]);

  return <TableScreen />;
}