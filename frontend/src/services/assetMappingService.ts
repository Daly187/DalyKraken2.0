import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export interface AssetMapping {
  canonical: string;
  asterSymbol: string;
  hyperliquidSymbol: string;
  multiplier: number;
}

export interface AssetMappingsDocument {
  mappings: AssetMapping[];
  lastUpdated: any; // Firestore timestamp
  version: number;
}

const LOCALSTORAGE_KEY = 'manualAssetMappings';
const LOCALSTORAGE_VERSION_KEY = 'manualAssetMappings_version';

/**
 * Asset Mapping Service
 * Manages asset mappings with Firestore as primary storage and localStorage as cache
 */
class AssetMappingService {
  /**
   * Get user ID from wallet address (using wallet as anonymous user ID)
   * In the future, this could be replaced with proper Firebase Auth
   */
  private getUserId(): string | null {
    // Use either wallet address as a unique identifier
    const asterWallet = localStorage.getItem('aster_wallet_address');
    const hlWallet = localStorage.getItem('hyperliquid_wallet_address');

    if (asterWallet) return `wallet_${asterWallet}`;
    if (hlWallet) return `wallet_${hlWallet}`;

    return null;
  }

  /**
   * Load mappings from localStorage (fast cache)
   */
  loadFromLocalStorage(): AssetMapping[] {
    try {
      const saved = localStorage.getItem(LOCALSTORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return Array.isArray(parsed) ? parsed : [];
      }
    } catch (error) {
      console.error('[AssetMappingService] Failed to load from localStorage:', error);
    }
    return [];
  }

  /**
   * Save mappings to localStorage (cache)
   */
  saveToLocalStorage(mappings: AssetMapping[], version: number): void {
    try {
      localStorage.setItem(LOCALSTORAGE_KEY, JSON.stringify(mappings));
      localStorage.setItem(LOCALSTORAGE_VERSION_KEY, version.toString());
    } catch (error) {
      console.error('[AssetMappingService] Failed to save to localStorage:', error);
    }
  }

  /**
   * Get current version from localStorage
   */
  getLocalVersion(): number {
    try {
      const version = localStorage.getItem(LOCALSTORAGE_VERSION_KEY);
      return version ? parseInt(version, 10) : 0;
    } catch {
      return 0;
    }
  }

  /**
   * Load mappings from Firestore
   */
  async loadFromFirestore(): Promise<{ mappings: AssetMapping[]; version: number } | null> {
    const userId = this.getUserId();
    if (!userId) {
      console.warn('[AssetMappingService] No wallet address found, cannot load from Firestore');
      return null;
    }

    try {
      const docRef = doc(db, 'users', userId, 'fundingSettings', 'assetMappings');
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data() as AssetMappingsDocument;
        console.log('[AssetMappingService] Loaded from Firestore:', data.mappings.length, 'mappings, version:', data.version);
        return {
          mappings: data.mappings || [],
          version: data.version || 1,
        };
      } else {
        console.log('[AssetMappingService] No Firestore document found');
        return null;
      }
    } catch (error) {
      console.error('[AssetMappingService] Failed to load from Firestore:', error);
      return null;
    }
  }

  /**
   * Save mappings to Firestore
   */
  async saveToFirestore(mappings: AssetMapping[]): Promise<boolean> {
    const userId = this.getUserId();
    if (!userId) {
      console.warn('[AssetMappingService] No wallet address found, cannot save to Firestore');
      return false;
    }

    try {
      const currentVersion = this.getLocalVersion();
      const newVersion = currentVersion + 1;

      const docRef = doc(db, 'users', userId, 'fundingSettings', 'assetMappings');
      await setDoc(docRef, {
        mappings,
        lastUpdated: serverTimestamp(),
        version: newVersion,
      });

      // Update local version
      this.saveToLocalStorage(mappings, newVersion);

      console.log('[AssetMappingService] Saved to Firestore:', mappings.length, 'mappings, version:', newVersion);
      return true;
    } catch (error) {
      console.error('[AssetMappingService] Failed to save to Firestore:', error);
      return false;
    }
  }

  /**
   * Sync mappings between localStorage and Firestore
   * Returns the authoritative mappings to use
   */
  async sync(): Promise<AssetMapping[]> {
    const localMappings = this.loadFromLocalStorage();
    const localVersion = this.getLocalVersion();

    console.log('[AssetMappingService] Syncing... Local version:', localVersion, 'Local mappings:', localMappings.length);

    // Try to load from Firestore
    const firestoreData = await this.loadFromFirestore();

    // No Firestore data - migrate local data if it exists
    if (!firestoreData) {
      if (localMappings.length > 0) {
        console.log('[AssetMappingService] Migrating', localMappings.length, 'mappings from localStorage to Firestore');
        await this.saveToFirestore(localMappings);
      }
      return localMappings;
    }

    // Firestore has newer data - use it
    if (firestoreData.version > localVersion) {
      console.log('[AssetMappingService] Firestore has newer data (v' + firestoreData.version + ' > v' + localVersion + '), using Firestore data');
      this.saveToLocalStorage(firestoreData.mappings, firestoreData.version);
      return firestoreData.mappings;
    }

    // Local has newer data (shouldn't happen often) - upload to Firestore
    if (localVersion > firestoreData.version) {
      console.log('[AssetMappingService] Local has newer data (v' + localVersion + ' > v' + firestoreData.version + '), uploading to Firestore');
      await this.saveToFirestore(localMappings);
      return localMappings;
    }

    // Same version - use Firestore as source of truth
    console.log('[AssetMappingService] Same version, using Firestore data');
    this.saveToLocalStorage(firestoreData.mappings, firestoreData.version);
    return firestoreData.mappings;
  }

  /**
   * Add a mapping
   */
  async addMapping(mapping: AssetMapping, currentMappings: AssetMapping[]): Promise<AssetMapping[]> {
    const newMappings = [...currentMappings, mapping];

    // Save to both localStorage (instant) and Firestore (persistent)
    this.saveToLocalStorage(newMappings, this.getLocalVersion() + 1);
    await this.saveToFirestore(newMappings);

    return newMappings;
  }

  /**
   * Remove a mapping
   */
  async removeMapping(index: number, currentMappings: AssetMapping[]): Promise<AssetMapping[]> {
    const newMappings = currentMappings.filter((_, i) => i !== index);

    // Save to both localStorage (instant) and Firestore (persistent)
    this.saveToLocalStorage(newMappings, this.getLocalVersion() + 1);
    await this.saveToFirestore(newMappings);

    return newMappings;
  }

  /**
   * Update all mappings
   */
  async updateMappings(mappings: AssetMapping[]): Promise<void> {
    this.saveToLocalStorage(mappings, this.getLocalVersion() + 1);
    await this.saveToFirestore(mappings);
  }
}

export const assetMappingService = new AssetMappingService();
