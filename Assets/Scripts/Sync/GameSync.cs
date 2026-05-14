using Photon.Pun;
using UnityEngine;

public class GameSync : MonoBehaviourPun
{
    public static GameSync Instance { get; private set; }

    private void Awake()
    {
        if (Instance != null && Instance != this)
        {
            Destroy(gameObject);
            return;
        }

        Instance = this;
    }

    public void SyncState(string stateName)
    {
        photonView.RPC(nameof(RPC_SyncState), RpcTarget.AllViaServer, stateName);
    }

    [PunRPC]
    private void RPC_SyncState(string stateName)
    {
        Debug.Log($"Game sync state: {stateName}");
    }
}
