const io = require('socket.io-client');

const SERVER = process.env.SERVER_URL || 'http://localhost:3001';
console.log('Smoke flow test connecting to', SERVER);

function makeClient(label) {
  const s = io(SERVER, { transports: ['websocket'] });
  s.label = label;
  s.on('connect', () => console.log(label, 'connected', s.id));
  s.on('disconnect', () => console.log(label, 'disconnected'));
  s.on('room_updated', (p) => console.log(label, 'room_updated', p.room?.id ?? p.room));
  s.on('join_success', (p) => console.log(label, 'join_success', p.room?.id ?? Object.keys(p)));
  s.on('found_room', (p) => console.log(label, 'found_room', p));
  s.on('match_started', (p) => console.log(label, 'match_started', p.matchState?.matchId));
  s.on('hand_dealt', (p) => console.log(label, 'hand_dealt handCount', (p.hand||[]).length, 'matchId', p.matchState?.matchId));
  s.on('hand_updated', (p) => console.log(label, 'hand_updated', p.hand?.length));
  s.on('card_played', (p) => console.log(label, 'card_played', JSON.stringify(p)));
  s.on('turn_timeout', (p) => console.log(label, 'turn_timeout', p));
  s.on('emoji_received', (p) => console.log(label, 'emoji', p));
  s.on('match_end', (p) => console.log(label, 'match_end', p));
  s.on('error', (p) => console.log(label, 'error', p));
  return s;
}

async function sleep(ms){return new Promise(r=>setTimeout(r,ms));}

(async function run(){
  const A = makeClient('A');
  await sleep(300);

  // A creates room by joining with a new playerId
  A.emit('join_room', { roomId: 'create', playerId: 'playerA' });

  // wait for join_success to capture the room id
  A.once('join_success', async (payload) => {
    const roomId = payload.room?.id;
    console.log('A created room:', roomId);

    // create client B and join A's room
    const B = makeClient('B');
    await sleep(200);
    B.emit('join_room', { roomId, playerId: 'playerB' });

    // once both have hands, have A start the match (host) if needed
    // server start_match must be called by host; in our flow A is host
    await sleep(400);
    console.log('A starting match');
    A.emit('start_match', { roomId });

    // when hand_dealt to A, play first card
    A.once('hand_dealt', (p) => {
      const hand = p.hand || [];
      const matchId = p.matchState?.matchId;
      console.log('A received hand, cards:', hand.length, 'matchId:', matchId);
      if (hand.length && matchId) {
        setTimeout(() => {
          console.log('A -> play_card', hand[0].id);
          A.emit('play_card', { matchId, playerId: 'playerA', cardId: hand[0].id, timestamp: Date.now() });
        }, 500);
      }
    });

    // cleanup after short wait
    setTimeout(() => {
      console.log('Smoke flow cleanup');
      A.disconnect();
      try { B.disconnect(); } catch(e){}
      process.exit(0);
    }, 6000);
  });

  // safety timeout
  setTimeout(()=>{
    console.log('Timeout reached, exiting');
    process.exit(1);
  }, 15000);
})();
