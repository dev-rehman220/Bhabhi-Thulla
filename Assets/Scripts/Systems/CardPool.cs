using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

public class CardPool : MonoBehaviour
{
    [SerializeField] private Card cardPrefab;
    [SerializeField] private Transform poolRoot;
    [SerializeField] private int prewarmCount = 60;

    private readonly Queue<Card> availableCards = new Queue<Card>();

    public void Prewarm()
    {
        if (cardPrefab == null)
        {
            return;
        }

        while (availableCards.Count < prewarmCount)
        {
            Card card = CreateCardInstance();
            Release(card);
        }
    }

    public Card Get(Transform parent)
    {
        Card card = availableCards.Count > 0 ? availableCards.Dequeue() : CreateCardInstance();
        card.gameObject.SetActive(true);
        card.transform.SetParent(parent, false);
        return card;
    }

    public void Release(Card card)
    {
        if (card == null)
        {
            return;
        }

        card.ResetForPool();
        card.transform.SetParent(poolRoot != null ? poolRoot : transform, false);
        card.gameObject.SetActive(false);
        availableCards.Enqueue(card);
    }

    private Card CreateCardInstance()
    {
        Card card;

        if (cardPrefab != null)
        {
            card = Instantiate(cardPrefab, poolRoot != null ? poolRoot : transform);
        }
        else
        {
            GameObject cardObject = new GameObject("Card", typeof(RectTransform), typeof(CanvasGroup), typeof(Image), typeof(Outline), typeof(Card));
            cardObject.transform.SetParent(poolRoot != null ? poolRoot : transform, false);
            card = cardObject.GetComponent<Card>();
        }

        card.gameObject.SetActive(false);
        return card;
    }
}
