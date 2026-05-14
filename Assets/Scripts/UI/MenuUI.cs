using UnityEngine;

public class MenuUI : MonoBehaviour
{
    public void OnStartButtonPressed()
    {
        if (GameManager.Instance != null)
        {
            GameManager.Instance.StartGame(UIManager.Instance != null ? UIManager.Instance.GetSelectedDifficulty() : DifficultyLevel.Medium);
        }
    }

    public void OnQuitButtonPressed()
    {
        Application.Quit();
    }
}
