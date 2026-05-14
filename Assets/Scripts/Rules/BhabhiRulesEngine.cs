using System.Collections.Generic;

public static class BhabhiRulesEngine
{
    public static bool IsValidMove(Card playedCard, Card topCard)
    {
        if (playedCard == null)
        {
            return false;
        }

        if (topCard == null)
        {
            return true;
        }

        if (playedCard.Suit != topCard.Suit)
        {
            return false;
        }

        return playedCard.Value > topCard.Value;
    }

    public static bool CanPlayerPlay(List<Card> hand, Card topCard)
    {
        if (hand == null || hand.Count == 0)
        {
            return false;
        }

        foreach (Card card in hand)
        {
            if (IsValidMove(card, topCard))
            {
                return true;
            }
        }

        return false;
    }
}
