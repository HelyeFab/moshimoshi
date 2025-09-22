# Notification Sounds

## notification.mp3

This directory should contain the notification sound file `notification.mp3`.

### Requirements:
- Format: MP3
- Duration: 0.5-1 second
- Type: Subtle notification chime
- File size: < 50KB

### Suggested sound characteristics:
- Gentle bell or chime sound
- Not too loud or jarring
- Pleasant and non-intrusive
- Similar to typical notification sounds on mobile devices

### Free sound resources:
- [Freesound.org](https://freesound.org) - Search for "notification" or "bell"
- [Zapsplat.com](https://www.zapsplat.com) - Free sounds with account
- [Mixkit.co](https://mixkit.co/free-sound-effects/bell/) - Free notification sounds

### Implementation:
The sound file is played in the `InAppNotificationProvider` component when a review is due.