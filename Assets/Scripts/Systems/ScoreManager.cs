using System.Collections.Generic;
using System.Linq;
using UnityEngine;

public class ScoreManager : MonoBehaviour
{
    public static ScoreManager Instance { get; private set; }

    [System.Serializable]
    public class ScoreEntry
    {
        public Player player;
        public int rank;
        public int points;
    }

    [SerializeField] private List<ScoreEntry> entries = new List<ScoreEntry>();

    public IReadOnlyList<ScoreEntry> Entries => entries;

    private void Awake()
    {
        if (Instance != null && Instance != this)
        {
            Destroy(gameObject);
            return;
        }

        Instance = this;
    }

    public void ResetRound(IEnumerable<Player> players)
    {
        entries.Clear();

        if (players == null)
        {
            return;
        }

        foreach (Player player in players)
        {
            if (player == null)
            {
                continue;
            }

            entries.Add(new ScoreEntry
            {
                player = player,
                rank = 0,
                points = 0
            });
        }
    }

    public int RegisterFinish(Player player)
    {
        if (player == null)
        {
            return 0;
        }

        ScoreEntry entry = entries.FirstOrDefault(item => item.player == player);
        if (entry == null)
        {
            entry = new ScoreEntry { player = player };
            entries.Add(entry);
        }

        if (entry.rank > 0)
        {
            return entry.rank;
        }

        int nextRank = entries.Count(item => item.rank > 0) + 1;
        int remainingPlayers = Mathf.Max(1, entries.Count - nextRank + 1);
        int points = Mathf.Max(10, remainingPlayers * 10);

        entry.rank = nextRank;
        entry.points = points;
        player.MarkFinished(nextRank, points);
        return nextRank;
    }

    public string BuildRankingText()
    {
        List<ScoreEntry> ordered = entries
            .Where(entry => entry.rank > 0)
            .OrderBy(entry => entry.rank)
            .ToList();

        if (ordered.Count == 0)
        {
            return "No results yet";
        }

        System.Text.StringBuilder builder = new System.Text.StringBuilder();
        for (int i = 0; i < ordered.Count; i++)
        {
            ScoreEntry entry = ordered[i];
            builder.AppendLine($"{entry.rank}. {entry.player.PlayerName}  +{entry.points}");
        }

        return builder.ToString().TrimEnd();
    }
}
