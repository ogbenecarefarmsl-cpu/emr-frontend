/**
 * Sound notification service for playing audio alerts
 * Handles sound playback with volume control and error handling
 */

export type SoundType = 
  | 'new-order'
  | 'sample-collected'
  | 'results-ready'
  | 'urgent-order'
  | 'payment-received';

interface SoundConfig {
  path: string;
  volume: number;
  description: string;
}

const SOUNDS: Record<SoundType, SoundConfig> = {
  'new-order': {
    path: '/sounds/new-order.wav',
    volume: 1.0,  // Very loud - new order alert
    description: 'New order created'
  },
  'sample-collected': {
    path: '/sounds/sample-ready.wav',
    volume: 0.8,
    description: 'Sample collected'
  },
  'results-ready': {
    path: '/sounds/success.wav',
    volume: 1.0,  // Very loud - results from analyzer
    description: 'Results ready'
  },
  'urgent-order': {
    path: '/sounds/critical-alert.wav',
    volume: 1.0,
    description: 'Urgent order alert'
  },
  'payment-received': {
    path: '/sounds/success.wav',
    volume: 0.7,
    description: 'Payment received'
  }
};

class SoundService {
  private audioCache: Map<SoundType, HTMLAudioElement> = new Map();
  private enabled: boolean = true;
  private masterVolume: number = 1.0;

  constructor() {
    // Load sound preferences from localStorage
    const savedEnabled = localStorage.getItem('sound_enabled');
    const savedVolume = localStorage.getItem('sound_volume');
    
    if (savedEnabled !== null) {
      this.enabled = savedEnabled === 'true';
    }
    
    if (savedVolume !== null) {
      this.masterVolume = parseFloat(savedVolume);
    }

    // Preload sounds
    this.preloadSounds();
  }

  /**
   * Preload all sound files into memory for instant playback
   */
  private preloadSounds(): void {
    Object.entries(SOUNDS).forEach(([type, config]) => {
      try {
        const audio = new Audio(config.path);
        audio.preload = 'auto';
        audio.volume = config.volume * this.masterVolume;
        this.audioCache.set(type as SoundType, audio);
      } catch (error) {
        console.warn(`Failed to preload sound: ${type}`, error);
      }
    });
  }

  /**
   * Play a notification sound
   */
  async play(type: SoundType): Promise<void> {
    if (!this.enabled) {
      return;
    }

    try {
      let audio = this.audioCache.get(type);
      
      if (!audio) {
        // Fallback: create audio element if not cached
        const config = SOUNDS[type];
        audio = new Audio(config.path);
        audio.volume = config.volume * this.masterVolume;
        this.audioCache.set(type, audio);
      }

      // Reset audio to beginning if already playing
      audio.currentTime = 0;
      
      // Play the sound
      await audio.play();
    } catch (error) {
      console.warn(`Failed to play sound: ${type}`, error);
    }
  }

  /**
   * Enable or disable all sounds
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    localStorage.setItem('sound_enabled', String(enabled));
  }

  /**
   * Check if sounds are enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Set master volume (0.0 to 1.0)
   */
  setVolume(volume: number): void {
    this.masterVolume = Math.max(0, Math.min(1, volume));
    localStorage.setItem('sound_volume', String(this.masterVolume));
    
    // Update volume for all cached audio elements
    this.audioCache.forEach((audio, type) => {
      const config = SOUNDS[type];
      audio.volume = config.volume * this.masterVolume;
    });
  }

  /**
   * Get current master volume
   */
  getVolume(): number {
    return this.masterVolume;
  }

  /**
   * Test a sound by playing it
   */
  async test(type: SoundType): Promise<void> {
    const wasEnabled = this.enabled;
    this.enabled = true;
    await this.play(type);
    this.enabled = wasEnabled;
  }
}

// Export singleton instance
export const soundService = new SoundService();
