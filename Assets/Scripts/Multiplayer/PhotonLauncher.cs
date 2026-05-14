using Photon.Pun;
using Photon.Realtime;
using UnityEngine;

public class PhotonLauncher : MonoBehaviourPunCallbacks
{
    [SerializeField] private string gameVersion = "1.0";
    [SerializeField] private string roomPrefix = "Room_";

    private void Start()
    {
        PhotonNetwork.AutomaticallySyncScene = true;
        PhotonNetwork.GameVersion = gameVersion;
        PhotonNetwork.ConnectUsingSettings();
    }

    public override void OnConnectedToMaster()
    {
        PhotonNetwork.JoinLobby();
    }

    public void CreateRoom()
    {
        RoomOptions options = new RoomOptions
        {
            MaxPlayers = 4,
            IsOpen = true,
            IsVisible = true
        };

        PhotonNetwork.CreateRoom(roomPrefix + Random.Range(1000, 9999), options);
    }

    public void JoinRoom(string roomName)
    {
        if (!string.IsNullOrWhiteSpace(roomName))
        {
            PhotonNetwork.JoinRoom(roomName);
        }
    }
}
