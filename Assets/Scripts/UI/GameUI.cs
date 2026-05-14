using TMPro;
using UnityEngine;

public class GameUI : MonoBehaviour
{
    [SerializeField] private TMP_Text gameStateText;
    [SerializeField] private TMP_Text hintText;

    private void OnEnable()
    {
        GameEvents.GameStateChanged += HandleGameStateChanged;
        GameEvents.TurnStarted += HandleTurnStarted;
        GameEvents.PlayerFinished += HandlePlayerFinished;
        GameEvents.RankingsChanged += HandleRankingsChanged;
    }

    private void OnDisable()
    {
        GameEvents.GameStateChanged -= HandleGameStateChanged;
        GameEvents.TurnStarted -= HandleTurnStarted;
        GameEvents.PlayerFinished -= HandlePlayerFinished;
        GameEvents.RankingsChanged -= HandleRankingsChanged;
    }

    private void HandleGameStateChanged(GameState state)
    {
        if (gameStateText != null)
        {
            gameStateText.text = state.ToString();
        }
    }

    private void HandleTurnStarted(Player player)
    {
        if (hintText != null && player != null)
        {
            hintText.text = $"{player.PlayerName}'s turn";
        }
    }

    private void HandlePlayerFinished(Player player)
    {
        if (hintText != null && player != null)
        {
            hintText.text = $"{player.PlayerName} finished the round";
        }
    }

    private void HandleRankingsChanged(IReadOnlyList<Player> players)
    {
        if (UIManager.Instance != null)
        {
            UIManager.Instance.RefreshRankingText();
        }
    }

    public void OnPickupPilePressed()
    {
        if (GameManager.Instance != null)
        {
            GameManager.Instance.RequestPickupPile();
        }
    }
}
