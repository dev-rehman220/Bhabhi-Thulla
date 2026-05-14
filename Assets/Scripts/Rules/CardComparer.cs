using System.Collections.Generic;

public class CardComparer : IComparer<Card>
{
    public static int CompareCards(Card a, Card b)
    {
        if (a == null && b == null)
        {
            return 0;
        }

        if (a == null)
        {
            return -1;
        }

        if (b == null)
        {
            return 1;
        }

        if (a.Suit != b.Suit)
        {
            return a.Suit.CompareTo(b.Suit);
        }

        return a.Value.CompareTo(b.Value);
    }

    public int Compare(Card x, Card y)
    {
        return CompareCards(x, y);
    }
}
