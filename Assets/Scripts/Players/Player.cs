using System.Collections.Generic;
using System.Linq;
using UnityEngine;

public class Player : MonoBehaviour
{
    [Header("Identity")]
    [SerializeField] private string playerName = "Player";
    [SerializeField] private int seatIndex;
    [SerializeField] private bool humanControlled;
    [SerializeField] private DifficultyLevel aiDifficulty = DifficultyLevel.Medium;

    [Header("Hand Layout")]
    [SerializeField] private Transform handRoot;
    [SerializeField] private float cardSpacing = 110f;
    [SerializeField] private float fanRotation = 8f;

    protected readonly List<Card> hand = new List<Card>();

    public string PlayerName => string.IsNullOrWhiteSpace(playerName) ? gameObject.name : playerName;
    public int SeatIndex => seatIndex;
    public bool IsHumanControlled => humanControlled;
    public DifficultyLevel Difficulty => aiDifficulty;
    public IReadOnlyList<Card> Hand => hand;
    public bool IsFinished { get; private set; }
    public int FinishRank { get; private set; }
    public int Score { get; private set; }
    public Transform HandRoot => handRoot != null ? handRoot : transform;

    public virtual void ResetForRound()
    {
        IsFinished = false;
        FinishRank = 0;
        Score = 0;
    }

    public virtual void TakeTurn()
    {
    }

    public void SetAIDifficulty(DifficultyLevel difficulty)
    {
        aiDifficulty = difficulty;
    }

    public virtual void AddCard(Card card, bool faceUp)
    {
        if (card == null)
        {
            return;
        }

        if (!hand.Contains(card))
        {
            hand.Add(card);
        }

        card.transform.SetParent(HandRoot, false);
        card.AttachToPlayer(this, faceUp);
        UpdateHandLayout();
    }

    public List<Card> GetLegalCards(Card topCard)
    {
        if (hand.Count == 0)
        {
            return new List<Card>();
        }

        if (topCard == null)
        {
            return hand.ToList();
        }

        return hand.Where(card => card != null && GameRulesEngine.IsValidMove(card, topCard)).ToList();
    }

    public bool HasPlayableCard(Card topCard)
    {
        return GetLegalCards(topCard).Count > 0;
    }

    public virtual void RemoveCard(Card card)
    {
        if (card == null)
        {
            return;
        }

        if (hand.Remove(card))
        {
            UpdateHandLayout();
        }
    }

    public void ClearHandSilently()
    {
        hand.Clear();
    }

    public List<Card> GetLegalCards(Suit? requiredSuit)
    {
        if (!requiredSuit.HasValue)
        {
            return hand.ToList();
        }

        List<Card> matchingSuit = hand.Where(card => card != null && card.Suit == requiredSuit.Value).ToList();
        return matchingSuit.Count > 0 ? matchingSuit : hand.ToList();
    }

    public bool HasPlayableCard(Suit? requiredSuit)
    {
        return GetLegalCards(requiredSuit).Count > 0;
    }

    public int HandCount => hand.Count;

    public void MarkFinished(int rank, int points)
    {
        IsFinished = true;
        FinishRank = rank;
        Score += points;
    }

    public void ApplyRoundScore(int points)
    {
        Score += points;
    }

    public void RefreshHandLayout()
    {
        UpdateHandLayout();
    }

    protected virtual void UpdateHandLayout()
    {
        if (handRoot == null)
        {
            handRoot = transform;
        }

        float spacing = Mathf.Clamp(cardSpacing - (hand.Count * 2f), 55f, cardSpacing);
        float width = Mathf.Max(0f, (hand.Count - 1) * spacing);
        float startX = -width * 0.5f;

        for (int i = 0; i < hand.Count; i++)
        {
            Card card = hand[i];
            if (card == null)
            {
                continue;
            }

            RectTransform rt = card.RectTransform;
            if (rt == null)
            {
                continue;
            }

            float normalized = hand.Count <= 1 ? 0.5f : i / Mathf.Max(1f, hand.Count - 1f);
            rt.SetSiblingIndex(i);
            rt.anchoredPosition = new Vector2(startX + (spacing * i), 0f);
            rt.localRotation = Quaternion.Euler(0f, 0f, Mathf.Lerp(-fanRotation, fanRotation, normalized));
            rt.localScale = Vector3.one;
        }
    }
}
