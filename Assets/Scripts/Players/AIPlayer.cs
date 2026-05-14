using System.Collections;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;

public class AIPlayer : Player
{
    [SerializeField] private float thinkDelay = 0.85f;

    private Coroutine thinkRoutine;

    public override void TakeTurn()
    {
        if (thinkRoutine != null)
        {
            StopCoroutine(thinkRoutine);
        }

        thinkRoutine = StartCoroutine(ThinkAndPlay());
    }

    public void SetDifficulty(DifficultyLevel difficulty)
    {
        SetAIDifficulty(difficulty);
    }

    private IEnumerator ThinkAndPlay()
    {
        yield return new WaitForSeconds(thinkDelay);

        if (GameManager.Instance == null)
        {
            yield break;
        }

        List<Card> legalCards = GameManager.Instance.GetLegalCards(this);
        if (legalCards.Count == 0)
        {
            GameManager.Instance.RequestPickupPile();
            yield break;
        }

        Card chosenCard = ChooseCard(legalCards, GameManager.Instance.TopCard);
        if (chosenCard != null)
        {
            GameManager.Instance.RequestPlayCard(chosenCard);
        }
    }

    private Card ChooseCard(List<Card> legalCards, Card topCard)
    {
        DifficultyLevel difficulty = Difficulty;

        return difficulty switch
        {
            DifficultyLevel.Easy => legalCards[Random.Range(0, legalCards.Count)],
            DifficultyLevel.Hard => ChooseHardCard(legalCards, topCard),
            _ => ChooseMediumCard(legalCards, topCard)
        };
    }

    private Card ChooseMediumCard(List<Card> legalCards, Card topCard)
    {
        if (topCard != null)
        {
            List<Card> matching = legalCards.Where(card => card.Suit == topCard.Suit).ToList();
            if (matching.Count > 0)
            {
                return matching.OrderBy(card => card.Value).First();
            }
        }

        return legalCards.OrderBy(card => card.Value).First();
    }

    private Card ChooseHardCard(List<Card> legalCards, Card topCard)
    {
        if (topCard != null)
        {
            List<Card> matching = legalCards.Where(card => card.Suit == topCard.Suit).ToList();
            if (matching.Count > 0)
            {
                return matching.OrderByDescending(card => card.Value).First();
            }
        }

        return legalCards
            .GroupBy(card => card.Suit)
            .OrderByDescending(group => group.Count())
            .ThenByDescending(group => group.Max(card => card.Value))
            .First()
            .OrderByDescending(card => card.Value)
            .First();
    }
}
