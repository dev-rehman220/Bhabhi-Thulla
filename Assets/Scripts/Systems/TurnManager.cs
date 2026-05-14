using System.Collections.Generic;
using System.Linq;
using UnityEngine;

public class TurnManager : MonoBehaviour
{
    public static TurnManager Instance { get; private set; }

    [SerializeField] private List<Player> players = new List<Player>();
    [SerializeField] private int currentIndex;

    public IReadOnlyList<Player> Players => players;
    public int CurrentIndex => currentIndex;
    public Player CurrentPlayer => players.Count == 0 ? null : players[Mathf.Clamp(currentIndex, 0, players.Count - 1)];

    private void Awake()
    {
        if (Instance != null && Instance != this)
        {
            Destroy(gameObject);
            return;
        }

        Instance = this;
    }

    public void Configure(IEnumerable<Player> orderedPlayers, int startIndex)
    {
        players = orderedPlayers != null ? orderedPlayers.ToList() : new List<Player>();
        currentIndex = players.Count == 0 ? 0 : Mathf.Clamp(startIndex, 0, players.Count - 1);
    }

    public void SetCurrentIndex(int index)
    {
        if (players.Count == 0)
        {
            currentIndex = 0;
            return;
        }

        currentIndex = ((index % players.Count) + players.Count) % players.Count;
    }

    public Player Advance()
    {
        if (players.Count == 0)
        {
            return null;
        }

        int safety = 0;
        do
        {
            currentIndex = (currentIndex + 1) % players.Count;
            safety++;
        }
        while (safety <= players.Count && players[currentIndex].IsFinished);

        return CurrentPlayer;
    }

    public Player GetLastActivePlayer()
    {
        return players.FirstOrDefault(p => !p.IsFinished);
    }

    public int GetActivePlayerCount()
    {
        return players.Count(p => !p.IsFinished);
    }
}
