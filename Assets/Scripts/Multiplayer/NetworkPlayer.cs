using Photon.Pun;
using UnityEngine;

public class NetworkPlayer : MonoBehaviourPun
{
    public Player playerData;

    public void SyncPlayCard(int cardID)
    {
        photonView.RPC(nameof(RPC_PlayCard), RpcTarget.AllViaServer, cardID);
    }

    [PunRPC]
    private void RPC_PlayCard(int cardID)
    {
        if (GameManager.Instance != null)
        {
            GameManager.Instance.OnNetworkCardPlayed(cardID);
        }
    }
}
