using System.Collections.Generic;
using UnityEngine;

public class DeckManager : MonoBehaviour
{
    public static DeckManager Instance { get; private set; }

    [SerializeField] private CardPool cardPool;
    [SerializeField] private List<CardData> cardLibrary = new List<CardData>();

    private readonly List<CardData> runtimeDeck = new List<CardData>();

    private void Awake()
    {
        if (Instance != null && Instance != this)
        {
            Destroy(gameObject);
            return;
        }

        Instance = this;
        if (cardPool == null)
        {
            cardPool = GetComponent<CardPool>();
        }

        if (cardPool != null)
        {
            cardPool.Prewarm();
        }
    }

    public void GenerateDeck()
    {
        runtimeDeck.Clear();

        if (cardLibrary != null && cardLibrary.Count >= 52)
        {
            runtimeDeck.AddRange(cardLibrary.GetRange(0, 52));
            return;
        }

        foreach (Suit suit in System.Enum.GetValues(typeof(Suit)))
        {
            for (int value = 1; value <= 13; value++)
            {
                runtimeDeck.Add(CreateFallbackCardData(suit, value));
            }
        }
    }

    public void Shuffle()
    {
        for (int i = 0; i < runtimeDeck.Count; i++)
        {
            int swapIndex = Random.Range(i, runtimeDeck.Count);
            (runtimeDeck[i], runtimeDeck[swapIndex]) = (runtimeDeck[swapIndex], runtimeDeck[i]);
        }
    }

    public CardData DrawCardData()
    {
        if (runtimeDeck.Count == 0)
        {
            return null;
        }

        CardData card = runtimeDeck[0];
        runtimeDeck.RemoveAt(0);
        return card;
    }

    public Card SpawnCard(CardData data, Player owner, Transform parent, bool faceUp)
    {
        if (cardPool == null)
        {
            Debug.LogError("CardPool reference is missing.");
            return null;
        }

        Card card = cardPool.Get(parent);
        card.Setup(data, owner, faceUp);
        return card;
    }

    public void ReleaseCard(Card card)
    {
        if (cardPool == null || card == null)
        {
            return;
        }

        cardPool.Release(card);
    }

    private CardData CreateFallbackCardData(Suit suit, int value)
    {
        CardData data = ScriptableObject.CreateInstance<CardData>();
        data.name = $"{suit}_{value}";
        data.suit = suit;
        data.value = value;
        return data;
    }
}
