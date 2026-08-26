# Get Away Thulla (Unity 2D)

This workspace contains the core C# scripts and folder structure for a mobile-friendly Unity 2D implementation of Get Away Thulla.

## Included

- 4-player turn-based gameplay: 1 human + 3 AI
- Full 52-card deck
- Suit-matching rules
- Pile pickup mechanic
- Win/loss ranking flow
- Drag-and-drop card interaction
- Object pooling for cards
- Menu, Playing, and GameOver states
- Score and ranking system

## Folder structure

- Assets/Scripts/Core
- Assets/Scripts/Players
- Assets/Scripts/Cards
- Assets/Scripts/UI
- Assets/Scripts/Systems
- Assets/Scripts/Utils
- Assets/Prefabs
- Assets/Scenes
- Assets/Sprites
- Assets/Audio
- ProjectSettings

## Scene setup summary

1. Create a Canvas with menu, gameplay, and game-over panels.
2. Add a Card prefab using a UI Image, CanvasGroup, and Card component.
3. Add four player objects: one HumanPlayer and three AIPlayer objects.
4. Add GameManager, DeckManager, TurnManager, UIManager, ScoreManager, AudioManager, and CardPool to a scene.
5. Assign the table drop zone, deck anchor, and pile anchor in UIManager.
6. Assign the Card prefab and optional sprites/audio clips.

## Notes

- The scripts are written to work even without authored card assets by generating fallback card data at runtime.
- Real card sprites can be added later through CardData ScriptableObjects.

## Multiplayer upgrade

- Install Photon PUN 2 from the Asset Store.
- Create and paste a Photon App ID into Photon Server Settings.
- Enable Automatically Sync Scene in the Photon launcher.
- Add the scripts under Assets/Scripts/Multiplayer, Assets/Scripts/Rules, and Assets/Scripts/Sync to your scene.
- Use GameScene as the shared network scene for hosted rooms.
