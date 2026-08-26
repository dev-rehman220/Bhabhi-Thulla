using UnityEngine;

[CreateAssetMenu(menuName = "Get Away Thulla/Card Data", fileName = "CardData")]
public class CardData : ScriptableObject
{
    public Suit suit;

    [Range(1, 13)]
    public int value = 1;

    public Sprite faceSprite;
    public Sprite backSprite;
    public Color tint = Color.white;

    public string GetRankLabel()
    {
        return value switch
        {
            1 => "A",
            11 => "J",
            12 => "Q",
            13 => "K",
            _ => value.ToString()
        };
    }

    public string GetDisplayName()
    {
        return $"{GetRankLabel()} of {suit}";
    }
}
