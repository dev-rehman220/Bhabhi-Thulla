using System.Collections.Generic;

public static class MoveValidator
{
    public static bool Validate(Card selectedCard, List<Card> playerHand, Card topCard)
    {
        if (selectedCard == null || playerHand == null || !playerHand.Contains(selectedCard))
        {
            return false;
        }

        return GameRulesEngine.IsValidMove(selectedCard, topCard);
    }
}
