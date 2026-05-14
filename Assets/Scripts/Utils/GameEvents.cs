using System;
using System.Collections.Generic;

public static class GameEvents
{
    public static event Action<GameState> GameStateChanged;
    public static event Action<Player> TurnStarted;
    public static event Action<Player, Card> CardPlayed;
    public static event Action<Player> PileCollected;
    public static event Action<Player> PlayerFinished;
    public static event Action<IReadOnlyList<Player>> RankingsChanged;

    public static void RaiseGameStateChanged(GameState state) => GameStateChanged?.Invoke(state);
    public static void RaiseTurnStarted(Player player) => TurnStarted?.Invoke(player);
    public static void RaiseCardPlayed(Player player, Card card) => CardPlayed?.Invoke(player, card);
    public static void RaisePileCollected(Player player) => PileCollected?.Invoke(player);
    public static void RaisePlayerFinished(Player player) => PlayerFinished?.Invoke(player);
    public static void RaiseRankingsChanged(IReadOnlyList<Player> players) => RankingsChanged?.Invoke(players);
}
