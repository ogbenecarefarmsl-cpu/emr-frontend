# Notification Sounds

This directory contains audio files for system notifications.

## Sound Files

- `new-order.mp3` - Played when a new order is created (Reception notification)
- `sample-collected.mp3` - Played when a sample is collected (Lab notification)
- `results-ready.mp3` - Played when test results are ready (Reception notification)
- `urgent-order.mp3` - Played for urgent/STAT priority orders (All users)
- `payment-received.mp3` - Played when payment is received (Reception notification)

## Format Requirements

- Format: MP3
- Sample Rate: 44.1 kHz
- Bit Rate: 128 kbps
- Duration: 1-3 seconds (short and clear)
- Volume: Normalized to -3dB

## Adding Custom Sounds

1. Place your MP3 file in this directory
2. Update `frontend/src/services/soundService.ts` to reference the new sound
3. Ensure the file is included in the PWA cache (already configured in vite.config.ts)

## Free Sound Resources

You can find free notification sounds at:
- https://notificationsounds.com/
- https://freesound.org/
- https://mixkit.co/free-sound-effects/notification/

## License

Ensure any sounds you add have appropriate licensing for commercial use.
