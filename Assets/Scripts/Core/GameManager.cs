using System.Collections;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;

public class GameManager : MonoBehaviour
{
    public static GameManager Instance { get; private set; }

    [Header("Managers")]
    [SerializeField] private DeckManager deckManager;
    [SerializeField] private TurnManager turnManager;
    [SerializeField] private UIManager uiManager;
    [SerializeField] private ScoreManager scoreManager;
    [SerializeField] private AudioManager audioManager;

    [Header("Players")]
    [SerializeField] private List<Player> players = new List<Player>();

    [Header("Runtime")]
    [SerializeField] private GameState state = GameState.Menu;

    private readonly List<Card> pile = new List<Card>();
    private bool actionLocked;
    private DifficultyLevel currentDifficulty = DifficultyLevel.Medium;

    public GameState State => state;
    public IReadOnlyList<Card> Pile => pile;
    public Card TopCard => pile.Count == 0 ? null : pile[pile.Count - 1];
    public Suit? RequiredSuit => pile.Count == 0 ? null : (Suit?)pile[pile.Count - 1].Suit;

    private void Awake()
    {
        if (Instance != null && Instance != this)
        {
            Destroy(gameObject);
            return;
        }

        Instance = this;
    }

    private void Start()
    {
        ResolveReferences();
        SetGameState(GameState.Menu);
        if (uiManager != null)
        {
            uiManager.ShowMenu();
        }
    }

    public void StartGame(DifficultyLevel difficulty)
    {
        currentDifficulty = difficulty;
        StartCoroutine(StartGameRoutine());
    }

    public bool IsCurrentPlayer(Player player)
    {
        return turnManager != null && turnManager.CurrentPlayer == player;
    }

    public List<Card> GetLegalCards(Player player)
    {
        return player == null ? new List<Card>() : player.GetLegalCards(TopCard);
    }

    public bool CanPlayCardFromDrop(Card card, Vector2 screenPosition, Camera eventCamera)
    {
        return state == GameState.Playing && card != null && uiManager != null && uiManager.IsPointerOverPlayArea(screenPosition, eventCamera) && IsCurrentPlayer(card.Owner) && CanPlayCard(card.Owner, card);
    }

    public bool CanPlayCard(Player player, Card card)
    {
        if (state != GameState.Playing || player == null || card == null)
        {
            return false;
        }

        if (!IsCurrentPlayer(player))
        {
            return false;
        }

        return MoveValidator.Validate(card, player.Hand.ToList(), TopCard);
    }

    public void BeginHumanTurn(Player player)
    {
        if (state != GameState.Playing || player == null)
        {
            return;
        }

        List<Card> legalCards = GetLegalCards(player);
        SetPlayableCards(player, legalCards);

        if (uiManager != null)
        {
            uiManager.SetStatusText(legalCards.Count > 0 ? "Drag a glowing card onto the table." : "No legal move. Pick up the pile.");
            uiManager.SetPickupButtonVisible(legalCards.Count == 0);
        }
    }

    public void RequestPlayCard(Card card)
    {
        if (state != GameState.Playing || actionLocked || card == null)
        {
            return;
        }

        Player currentPlayer = turnManager != null ? turnManager.CurrentPlayer : null;
        if (!CanPlayCard(currentPlayer, card))
        {
            card.ReturnToOwnerHand();
            return;
        }

        StartCoroutine(ResolvePlayCard(card, false));
    }

    public void RequestPickupPile()
    {
        if (state != GameState.Playing || actionLocked || turnManager == null)
        {
            return;
        }

        Player currentPlayer = turnManager.CurrentPlayer;
        if (currentPlayer == null)
        {
            return;
        }

        if (currentPlayer.IsHumanControlled && currentPlayer.HasPlayableCard(TopCard))
        {
            return;
        }

        StartCoroutine(ResolvePickupPile(currentPlayer, false));
    }

    public void PlayGameOverSound(bool didHumanWin)
    {
        if (audioManager == null)
        {
            return;
        }

        if (didHumanWin)
        {
            audioManager.PlayWin();
        }
        else
        {
            audioManager.PlayLose();
        }
    }

    private IEnumerator StartGameRoutine()
    {
        ResolveReferences();
        actionLocked = true;

        ClearTableAndHands();

        if (players.Count != 4)
        {
            players = FindObjectsOfType<Player>(true).OrderBy(player => player.SeatIndex).ToList();
        }

        if (players.Count != 4)
        {
            Debug.LogError("Get Away Thulla requires exactly 4 players.");
            actionLocked = false;
            yield break;
        }

        foreach (Player player in players)
        {
            player.ResetForRound();
            if (player is AIPlayer ai)
            {
                ai.SetDifficulty(currentDifficulty);
            }
        }

        deckManager.GenerateDeck();
        deckManager.Shuffle();
        pile.Clear();

        SetGameState(GameState.Playing);

        if (uiManager != null)
        {
            uiManager.ShowPlaying();
            uiManager.SetPickupButtonVisible(false);
            uiManager.SetStatusText("Dealing cards...");
            uiManager.SetRankingText(string.Empty);
            uiManager.SetScoreText(string.Empty);
        }

        if (scoreManager != null)
        {
            scoreManager.ResetRound(players);
        }

        for (int round = 0; round < 13; round++)
        {
            foreach (Player player in players)
            {
                CardData cardData = deckManager.DrawCardData();
                if (cardData == null)
                {
                    continue;
                }

                Transform animationRoot = uiManager != null ? uiManager.transform : transform;
                Card card = deckManager.SpawnCard(cardData, player, animationRoot, player.IsHumanControlled);
                if (card == null)
                {
                    continue;
                }

                card.transform.position = uiManager != null ? uiManager.DeckAnchor.position : player.HandRoot.position;

                if (audioManager != null)
                {
                    audioManager.PlayDeal();
                }

                yield return card.MoveToPosition(player.HandRoot.position, 0.08f);
                player.AddCard(card, player.IsHumanControlled);
                player.RefreshHandLayout();
                yield return new WaitForSeconds(0.02f);
            }
        }

        actionLocked = false;

        int startIndex = Random.Range(0, players.Count);
        turnManager.Configure(players, startIndex);
        BeginCurrentTurn();
    }

    private IEnumerator ResolvePlayCard(Card card, bool fromNetwork)
    {
        actionLocked = true;

        Player currentPlayer = turnManager.CurrentPlayer;
        currentPlayer.RemoveCard(card);

        if (audioManager != null)
        {
            audioManager.PlayCard();
        }

        pile.Add(card);
        card.SetPlayable(false);
        card.SetFaceUp(true);
        card.transform.SetParent(uiManager != null ? uiManager.PileAnchor : transform, true);

        if (!fromNetwork)
        {
            NetworkGameManager.Instance?.PlayCardNetwork(card);
        }

        Vector3 target = uiManager != null ? uiManager.PileAnchor.position : transform.position;
        target += new Vector3(pile.Count * 2f, -pile.Count * 2f, 0f);
        yield return card.MoveToPosition(target, 0.16f);
        card.transform.position = target;

        GameEvents.RaiseCardPlayed(currentPlayer, card);

        if (currentPlayer.HandCount == 0)
        {
            HandlePlayerFinished(currentPlayer);
        }

        if (CheckForGameOver())
        {
            yield break;
        }

        actionLocked = false;
        if (!fromNetwork)
        {
            AdvanceTurn();
        }
    }

    private IEnumerator ResolvePickupPile(Player currentPlayer, bool fromNetwork)
    {
        actionLocked = true;

        if (pile.Count == 0)
        {
            actionLocked = false;
            AdvanceTurn();
            yield break;
        }

        List<Card> collectedCards = pile.ToList();
        pile.Clear();

        if (audioManager != null)
        {
            audioManager.PlayCollect();
        }

        foreach (Card card in collectedCards)
        {
            card.SetFaceUp(currentPlayer.IsHumanControlled);
            yield return card.MoveToPosition(currentPlayer.HandRoot.position, 0.12f);
            currentPlayer.AddCard(card, currentPlayer.IsHumanControlled);
        }

        if (!fromNetwork)
        {
            NetworkGameManager.Instance?.SyncPickupPile(currentPlayer.SeatIndex);
        }

        GameEvents.RaisePileCollected(currentPlayer);

        actionLocked = false;
        if (!fromNetwork)
        {
            AdvanceTurn();
        }
    }

    public void PlayCard(Card card)
    {
        RequestPlayCard(card);
    }

    public void ApplyRemoteMove(int value, int suit, int cardId)
    {
        if (state != GameState.Playing || turnManager == null)
        {
            return;
        }

        Player currentPlayer = turnManager.CurrentPlayer;
        if (currentPlayer == null)
        {
            return;
        }

        Card card = currentPlayer.Hand.FirstOrDefault(item => item != null && item.Value == value && (int)item.Suit == suit);
        if (card == null)
        {
            card = currentPlayer.Hand.FirstOrDefault(item => item != null && item.CardId == cardId);
        }

        if (card == null)
        {
            return;
        }

        StartCoroutine(ResolvePlayCard(card, true));
    }

    public void OnNetworkCardPlayed(int cardID)
    {
        int suit = cardID / 13;
        int value = cardID % 13;

        if (value == 0)
        {
            value = 13;
            suit -= 1;
        }

        ApplyRemoteMove(value, suit, cardID);
    }

    public void ApplyRemotePickup(int playerSeatIndex)
    {
        if (turnManager == null)
        {
            return;
        }

        Player player = players.FirstOrDefault(item => item != null && item.SeatIndex == playerSeatIndex);
        if (player == null)
        {
            return;
        }

        StartCoroutine(ResolvePickupPile(player, true));
    }

    public void SetTurn(int index)
    {
        if (turnManager == null)
        {
            return;
        }

        turnManager.SetCurrentIndex(index);
        BeginCurrentTurn();
    }

    private void BeginCurrentTurn()
    {
        if (state != GameState.Playing || turnManager == null)
        {
            return;
        }

        Player currentPlayer = turnManager.CurrentPlayer;
        if (currentPlayer == null)
        {
            return;
        }

        GameEvents.RaiseTurnStarted(currentPlayer);

        if (uiManager != null)
        {
            uiManager.SetTurnText($"Turn: {currentPlayer.PlayerName}");
            uiManager.SetScoreText(GetScoreSummary());
        }

        List<Card> legalCards = GetLegalCards(currentPlayer);
        SetPlayableCards(currentPlayer, legalCards);

        if (currentPlayer.IsHumanControlled)
        {
            uiManager?.SetPickupButtonVisible(legalCards.Count == 0);
            uiManager?.SetStatusText(legalCards.Count == 0 ? "No legal move. Collect the pile." : "Select a matching card and drop it on the table.");
        }
        else
        {
            uiManager?.SetPickupButtonVisible(false);
            uiManager?.SetStatusText($"{currentPlayer.PlayerName} is thinking...");
            currentPlayer.TakeTurn();
        }
    }

    private void AdvanceTurn()
    {
        if (CheckForGameOver())
        {
            return;
        }

        int nextIndex = turnManager != null && players.Count > 0 ? (turnManager.CurrentIndex + 1) % players.Count : 0;

        if (TurnSync.Instance != null)
        {
            TurnSync.Instance.NextTurnNetwork(nextIndex);
            return;
        }

        if (NetworkGameManager.Instance != null)
        {
            NetworkGameManager.Instance.SyncTurn(nextIndex);
            return;
        }

        turnManager.Advance();
        BeginCurrentTurn();
    }

    private void HandlePlayerFinished(Player player)
    {
        if (player == null || player.IsFinished)
        {
            return;
        }

        int rank = scoreManager != null ? scoreManager.RegisterFinish(player) : 0;
        int points = scoreManager != null
            ? scoreManager.Entries.FirstOrDefault(entry => entry.player == player)?.points ?? 0
            : 0;

        GameEvents.RaisePlayerFinished(player);
        GameEvents.RaiseRankingsChanged(players);

        if (uiManager != null)
        {
            uiManager.SetRankingText(scoreManager != null ? scoreManager.BuildRankingText() : string.Empty);
            uiManager.SetScoreText(GetScoreSummary());
        }
    }

    private bool CheckForGameOver()
    {
        if (turnManager == null)
        {
            return false;
        }

        if (turnManager.GetActivePlayerCount() > 1)
        {
            return false;
        }

        Player loser = turnManager.GetLastActivePlayer();
        if (loser != null && !loser.IsFinished)
        {
            loser.ApplyRoundScore(0);
        }

        EndGame(loser);
        return true;
    }

    private void EndGame(Player loser)
    {
        state = GameState.GameOver;
        GameEvents.RaiseGameStateChanged(state);
        GameEvents.RaiseRankingsChanged(players);

        bool humanWon = scoreManager != null && scoreManager.Entries.Any(entry => entry.player != null && entry.player.IsHumanControlled && entry.rank == 1);
        PlayGameOverSound(humanWon);

        if (uiManager != null)
        {
            uiManager.ShowGameOver();
            uiManager.SetStatusText(loser != null ? $"Loser: {loser.PlayerName}" : "Game Over");
            uiManager.SetRankingText(scoreManager != null ? scoreManager.BuildRankingText() : string.Empty);
            uiManager.SetScoreText(GetScoreSummary());
        }

        actionLocked = false;
    }

    private void ClearTableAndHands()
    {
        if (players != null)
        {
            foreach (Player player in players)
            {
                if (player == null)
                {
                    continue;
                }

                List<Card> cards = player.Hand.ToList();
                foreach (Card card in cards)
                {
                    deckManager.ReleaseCard(card);
                }

                player.ClearHandSilently();
            }
        }

        foreach (Card card in pile)
        {
            deckManager.ReleaseCard(card);
        }

        pile.Clear();
    }

    private void ResolveReferences()
    {
        if (deckManager == null)
        {
            deckManager = FindObjectOfType<DeckManager>();
        }

        if (turnManager == null)
        {
            turnManager = FindObjectOfType<TurnManager>();
        }

        if (uiManager == null)
        {
            uiManager = FindObjectOfType<UIManager>();
        }

        if (scoreManager == null)
        {
            scoreManager = FindObjectOfType<ScoreManager>();
        }

        if (audioManager == null)
        {
            audioManager = FindObjectOfType<AudioManager>();
        }

        if (players == null || players.Count == 0)
        {
            players = FindObjectsOfType<Player>(true).OrderBy(player => player.SeatIndex).ToList();
        }
    }

    private void SetGameState(GameState newState)
    {
        state = newState;
        GameEvents.RaiseGameStateChanged(newState);
    }

    private void SetPlayableCards(Player player, List<Card> legalCards)
    {
        if (player == null)
        {
            return;
        }

        foreach (Card card in player.Hand)
        {
            card.SetPlayable(legalCards.Contains(card));
        }
    }

    private string GetScoreSummary()
    {
        List<string> lines = new List<string>();
        foreach (Player player in players)
        {
            if (player == null)
            {
                continue;
            }

            string suffix = player.IsFinished ? $" (Rank {player.FinishRank})" : string.Empty;
            lines.Add($"{player.PlayerName}: {player.HandCount} cards{suffix}");
        }

        return string.Join("\n", lines);
    }
}
