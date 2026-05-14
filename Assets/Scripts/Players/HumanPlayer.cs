public class HumanPlayer : Player
{
    public override void TakeTurn()
    {
        if (GameManager.Instance != null)
        {
            GameManager.Instance.BeginHumanTurn(this);
        }
    }
}
