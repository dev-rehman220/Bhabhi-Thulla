using TMPro;
using UnityEngine;
using UnityEngine.UI;

public class UIManager : MonoBehaviour
{
    public static UIManager Instance { get; private set; }

    [Header("Panels")]
    [SerializeField] private GameObject menuPanel;
    [SerializeField] private GameObject gamePanel;
    [SerializeField] private GameObject gameOverPanel;

    [Header("Gameplay UI")]
    [SerializeField] private TMP_Text turnText;
    [SerializeField] private TMP_Text statusText;
    [SerializeField] private TMP_Text rankingText;
    [SerializeField] private TMP_Text scoreText;
    [SerializeField] private Button pickupButton;
    [SerializeField] private TMP_Dropdown difficultyDropdown;

    [Header("Board Anchors")]
    [SerializeField] private RectTransform playAreaZone;
    [SerializeField] private Transform deckAnchor;
    [SerializeField] private Transform pileAnchor;

    private void Awake()
    {
        if (Instance != null && Instance != this)
        {
            Destroy(gameObject);
            return;
        }

        Instance = this;
    }

    public void ShowMenu()
    {
        if (menuPanel != null) menuPanel.SetActive(true);
        if (gamePanel != null) gamePanel.SetActive(false);
        if (gameOverPanel != null) gameOverPanel.SetActive(false);
    }

    public void ShowPlaying()
    {
        if (menuPanel != null) menuPanel.SetActive(false);
        if (gamePanel != null) gamePanel.SetActive(true);
        if (gameOverPanel != null) gameOverPanel.SetActive(false);
    }

    public void ShowGameOver()
    {
        if (menuPanel != null) menuPanel.SetActive(false);
        if (gamePanel != null) gamePanel.SetActive(false);
        if (gameOverPanel != null) gameOverPanel.SetActive(true);
    }

    public DifficultyLevel GetSelectedDifficulty()
    {
        int index = difficultyDropdown != null ? difficultyDropdown.value : 1;
        index = Mathf.Clamp(index, 0, 2);
        return (DifficultyLevel)index;
    }

    public void SetTurnText(string value)
    {
        if (turnText != null) turnText.text = value;
    }

    public void SetStatusText(string value)
    {
        if (statusText != null) statusText.text = value;
    }

    public void SetRankingText(string value)
    {
        if (rankingText != null) rankingText.text = value;
    }

    public void SetScoreText(string value)
    {
        if (scoreText != null) scoreText.text = value;
    }

    public void SetPickupButtonVisible(bool visible)
    {
        if (pickupButton != null)
        {
            pickupButton.gameObject.SetActive(visible);
            pickupButton.interactable = visible;
        }
    }

    public bool IsPointerOverPlayArea(Vector2 screenPosition, Camera eventCamera)
    {
        return playAreaZone != null && RectTransformUtility.RectangleContainsScreenPoint(playAreaZone, screenPosition, eventCamera);
    }

    public Transform DeckAnchor => deckAnchor != null ? deckAnchor : transform;
    public Transform PileAnchor => pileAnchor != null ? pileAnchor : transform;

    public void RefreshRankingText()
    {
        if (ScoreManager.Instance != null)
        {
            SetRankingText(ScoreManager.Instance.BuildRankingText());
        }
    }
}
