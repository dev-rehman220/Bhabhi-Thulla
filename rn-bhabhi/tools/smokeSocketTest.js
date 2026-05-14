const io = require('socket.io-client');

const SERVER = process.env.SERVER_URL || 'http://localhost:3001';
console.log('Smoke test connecting to', SERVER);

function makeClient(id) {
  const s = io(SERVER, { transports: ['websocket'] });
  s._id = id;
  s.on('connect', () => console.log(id, 'connected', s.id));
  s.on('disconnect', () => console.log(id, 'disconnected'));
  s.on('room_updated', (p) => console.log(id, 'room_updated', JSON.stringify(p)));
  s.on('join_success', (p) => console.log(id, 'join_success', Object.keys(p)));
  s.on('found_room', (p) => console.log(id, 'found_room', p));
  s.on('match_started', (p) => console.log(id, 'match_started', p.matchState?.matchId));
  s.on('hand_dealt', (p) => console.log(id, 'hand_dealt handCount', (p.hand||[]).length, 'matchId', p.matchState?.matchId));
  s.on('hand_updated', (p) => console.log(id, 'hand_updated', p.hand?.length));
  s.on('card_played', (p) => console.log(id, 'card_played', JSON.stringify(p)));
  s.on('turn_timeout', (p) => console.log(id, 'turn_timeout', p));
  s.on('emoji_received', (p) => console.log(id, 'emoji', p));
  s.on('match_end', (p) => console.log(id, 'match_end', p));
  s.on('error', (p) => console.log(id, 'error', p));
  return s;
}

async function sleep(ms){return new Promise(r=>setTimeout(r,ms));}

(async function run(){
  const a = makeClient('A');
  const b = makeClient('B');

  await sleep(400);

  a.emit('join_room', { roomId: 'smoke-test-room', playerId: 'playerA' });
  await sleep(200);
  b.emit('join_room', { roomId: 'smoke-test-room', playerId: 'playerB' });

  // wait for hands then have playerA play first card
  a.once('hand_dealt', (payload) => {
    console.log('A received hand_dealt, playing first card in 600ms');
    const hand = payload.hand || [];
    const matchId = payload.matchState?.matchId;
    if (hand.length && matchId) {
      setTimeout(() => {
        console.log('A -> play_card', hand[0].id);
        a.emit('play_card', { matchId, playerId: 'playerA', cardId: hand[0].id, timestamp: Date.now() });
      }, 600);
    }
  });

  // also log when B gets hand
  b.once('hand_dealt', (payload) => {
    console.log('B received hand_dealt, hand size', (payload.hand||[]).length);
  });

  // finish after a few seconds
  setTimeout(() => {
    console.log('Smoke test cleaning up');
    a.disconnect();
    b.disconnect();
    process.exit(0);
  }, 6000);
})();
