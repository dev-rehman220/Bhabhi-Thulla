using Photon.Pun;
using UnityEngine;

public class NetworkGameManager : MonoBehaviourPun
{
    public static NetworkGameManager Instance { get; private set; }

    private void Awake()
    {
        if (Instance != null && Instance != this)
        {
            Destroy(gameObject);
            return;
        }

        Instance = this;
    }

    public void PlayCardNetwork(Card card)
    {
        if (card == null)
        {
            return;
        }

        photonView.RPC(nameof(RPC_PlayCard), RpcTarget.AllViaServer, card.Value, (int)card.Suit, card.CardId);
    }

    public void SyncTurn(int nextPlayerIndex)
    {
        photonView.RPC(nameof(RPC_SyncTurn), RpcTarget.AllViaServer, nextPlayerIndex);
    }

    public void SyncPickupPile(int playerSeatIndex)
    {
        photonView.RPC(nameof(RPC_PickupPile), RpcTarget.AllViaServer, playerSeatIndex);
    }

    [PunRPC]
    private void RPC_PlayCard(int value, int suit, int cardId)
    {
        if (GameManager.Instance != null)
        {
            GameManager.Instance.ApplyRemoteMove(value, suit, cardId);
        }
    }

    [PunRPC]
    private void RPC_SyncTurn(int nextPlayerIndex)
    {
        if (GameManager.Instance != null)
        {
            GameManager.Instance.SetTurn(nextPlayerIndex);
        }
    }

    [PunRPC]
    private void RPC_PickupPile(int playerSeatIndex)
    {
        if (GameManager.Instance != null)
        {
            GameManager.Instance.ApplyRemotePickup(playerSeatIndex);
        }
    }
}
