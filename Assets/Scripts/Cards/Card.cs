using System;
using System.Collections;
using TMPro;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

[RequireComponent(typeof(RectTransform))]
[RequireComponent(typeof(CanvasGroup))]
public class Card : MonoBehaviour, IBeginDragHandler, IDragHandler, IEndDragHandler, IPointerClickHandler
{
    [Header("Visuals")]
    [SerializeField] private Image cardImage;
    [SerializeField] private TMP_Text valueLabel;
    [SerializeField] private Outline glowOutline;

    private CanvasGroup canvasGroup;
    private RectTransform rectTransform;
    private Player owner;
    private CardData cardData;
    private bool faceUp;
    private bool isPlayable;
    private Transform originalParent;
    private Vector3 originalWorldPosition;
    private bool isDragging;
    private Coroutine glowRoutine;

    public Player Owner => owner;
    public CardData Data => cardData;
    public Suit Suit => cardData != null ? cardData.suit : Suit.Hearts;
    public int Value => cardData != null ? cardData.value : 0;
    public RectTransform RectTransform => rectTransform;
    public bool IsPlayable => isPlayable;
    public int CardId => cardData == null ? -1 : (((int)cardData.suit) * 13) + cardData.value;

    private void Awake()
    {
        rectTransform = GetComponent<RectTransform>();
        canvasGroup = GetComponent<CanvasGroup>();

        if (cardImage == null)
        {
            cardImage = GetComponent<Image>();
        }

        if (glowOutline == null)
        {
            glowOutline = GetComponent<Outline>();
        }

        if (valueLabel == null)
        {
            valueLabel = GetComponentInChildren<TMP_Text>(true);
        }

        if (glowOutline != null)
        {
            glowOutline.enabled = false;
        }
    }

    public void Setup(CardData data, Player cardOwner, bool showFace)
    {
        cardData = data;
        owner = cardOwner;
        faceUp = showFace;
        SetPlayable(false);
        RefreshVisuals();
    }

    public void AttachToPlayer(Player cardOwner, bool showFace)
    {
        owner = cardOwner;
        faceUp = showFace;
        RefreshVisuals();
    }

    public void SetPlayable(bool playable)
    {
        isPlayable = playable;

        if (glowOutline != null)
        {
            glowOutline.enabled = playable;
            glowOutline.effectColor = playable ? new Color(1f, 0.9f, 0.2f, 1f) : Color.clear;
            glowOutline.effectDistance = playable ? new Vector2(8f, 8f) : Vector2.zero;
        }

        if (cardImage != null)
        {
            cardImage.color = playable ? Color.white : new Color(0.92f, 0.92f, 0.92f, 1f);
        }

        if (glowRoutine != null)
        {
            StopCoroutine(glowRoutine);
            glowRoutine = null;
        }

        if (playable)
        {
            glowRoutine = StartCoroutine(PulsePlayable());
        }
        else
        {
            transform.localScale = Vector3.one;
        }
    }

    public void SetFaceUp(bool showFace)
    {
        faceUp = showFace;
        RefreshVisuals();
    }

    public void ResetForPool()
    {
        StopAllCoroutines();
        glowRoutine = null;
        owner = null;
        cardData = null;
        faceUp = false;
        isPlayable = false;
        isDragging = false;

        if (glowOutline != null)
        {
            glowOutline.enabled = false;
        }

        if (canvasGroup != null)
        {
            canvasGroup.alpha = 1f;
            canvasGroup.blocksRaycasts = true;
            canvasGroup.interactable = true;
        }
    }

    public void OnBeginDrag(PointerEventData eventData)
    {
        if (!CanHumanDrag())
        {
            return;
        }

        isDragging = true;
        originalParent = transform.parent;
        originalWorldPosition = transform.position;

        if (canvasGroup != null)
        {
            canvasGroup.blocksRaycasts = false;
        }

        transform.SetAsLastSibling();
        transform.SetParent(GetRootCanvasTransform(), true);
        transform.position = eventData.position;
    }

    public void OnDrag(PointerEventData eventData)
    {
        if (!isDragging)
        {
            return;
        }

        transform.position = eventData.position;
    }

    public void OnEndDrag(PointerEventData eventData)
    {
        if (!isDragging)
        {
            return;
        }

        isDragging = false;

        if (canvasGroup != null)
        {
            canvasGroup.blocksRaycasts = true;
        }

        bool droppedOnPlayZone = GameManager.Instance != null && GameManager.Instance.CanPlayCardFromDrop(this, eventData.position, eventData.pressEventCamera);
        if (droppedOnPlayZone)
        {
            GameManager.Instance.RequestPlayCard(this);
            return;
        }

        ReturnToOwnerHand();
    }

    public void OnPointerClick(PointerEventData eventData)
    {
        if (!CanHumanClick())
        {
            return;
        }

        if (GameManager.Instance != null)
        {
            GameManager.Instance.RequestPlayCard(this);
        }
    }

    public IEnumerator MoveToPosition(Vector3 targetPosition, float duration)
    {
        Vector3 start = transform.position;
        float elapsed = 0f;

        while (elapsed < duration)
        {
            elapsed += Time.deltaTime;
            float t = Mathf.Clamp01(elapsed / duration);
            transform.position = Vector3.Lerp(start, targetPosition, t);
            yield return null;
        }

        transform.position = targetPosition;
    }

    public void ReturnToOwnerHand()
    {
        if (owner == null)
        {
            return;
        }

        transform.SetParent(owner.HandRoot, false);
        owner.RefreshHandLayout();
        transform.position = originalWorldPosition;
    }

    private bool CanHumanDrag()
    {
        return owner != null && owner.IsHumanControlled && isPlayable && GameManager.Instance != null && GameManager.Instance.IsCurrentPlayer(owner);
    }

    private bool CanHumanClick()
    {
        return owner != null && owner.IsHumanControlled && isPlayable && GameManager.Instance != null && GameManager.Instance.IsCurrentPlayer(owner);
    }

    private Transform GetRootCanvasTransform()
    {
        Canvas canvas = GetComponentInParent<Canvas>();
        return canvas != null ? canvas.transform : transform.root;
    }

    private void RefreshVisuals()
    {
        if (cardImage != null && cardData != null)
        {
            cardImage.sprite = faceUp ? cardData.faceSprite : cardData.backSprite;
            cardImage.color = cardData.tint;
        }

        if (valueLabel != null)
        {
            valueLabel.gameObject.SetActive(faceUp);
            valueLabel.text = faceUp && cardData != null ? cardData.GetDisplayName() : string.Empty;
        }
    }

    private IEnumerator PulsePlayable()
    {
        Vector3 normalScale = Vector3.one;
        Vector3 pulseScale = Vector3.one * 1.06f;

        while (isPlayable)
        {
            float t = (Mathf.Sin(Time.time * 5f) + 1f) * 0.5f;
            transform.localScale = Vector3.Lerp(normalScale, pulseScale, t);
            yield return null;
        }

        transform.localScale = Vector3.one;
    }
}
