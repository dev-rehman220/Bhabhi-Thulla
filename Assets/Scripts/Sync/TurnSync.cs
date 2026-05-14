using Photon.Pun;
using UnityEngine;

public class TurnSync : MonoBehaviourPun
{
    public static TurnSync Instance { get; private set; }

    private void Awake()
    {
        if (Instance != null && Instance != this)
        {
            Destroy(gameObject);
            return;
        }

        Instance = this;
    }

    public void NextTurnNetwork(int nextPlayerIndex)
    {
        photonView.RPC(nameof(RPC_NextTurn), RpcTarget.AllViaServer, nextPlayerIndex);
    }

    [PunRPC]
    private void RPC_NextTurn(int index)
    {
        if (GameManager.Instance != null)
        {
            GameManager.Instance.SetTurn(index);
        }
    }
}
