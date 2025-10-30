// MembershipUtils.js - Utility functions for membership management
export class MembershipUtils {
  static async checkMembershipStatus() {
    // First check new localStorage format (email-based from Stripe)
    const membershipEmail = localStorage.getItem('membershipEmail');
    const membershipStatus = localStorage.getItem('membershipStatus');
    
    if (membershipEmail && membershipStatus) {
      try {
        const status = JSON.parse(membershipStatus);
        if (status && (status.valid || status.isValid) && status.tier !== 'free') {
          // console.log('🔍 MEMBERSHIP_UTILS: Found valid membership in localStorage:', status);
          return { 
            isValid: true, 
            tier: status.tier, 
            email: membershipEmail,
            source: 'localStorage',
            message: 'Valid membership found'
          };
        }
      } catch (e) {
        console.error('🔍 MEMBERSHIP_UTILS: Error parsing membershipStatus:', e);
      }
    }
    
    // Fallback to old code-based system
    const membershipCode = localStorage.getItem('membershipCode');
    
    if (!membershipCode) {
      // console.log('🔍 MEMBERSHIP_UTILS: No membership found');
      return { isValid: false, message: 'No membership code found' };
    }

    try {
      // Check cache first (5 minute cache)
      const cachedStatus = localStorage.getItem('membershipStatus');
      const cacheTime = localStorage.getItem('membershipCacheTime');
      
      if (cachedStatus && cacheTime) {
        const timeSinceCache = Date.now() - parseInt(cacheTime);
        if (timeSinceCache < 5 * 60 * 1000) { // 5 minutes
          const parsed = JSON.parse(cachedStatus);
          if (!parsed.isValid) {
            localStorage.removeItem('membershipStatus');
            localStorage.removeItem('membershipCacheTime');
          }
          return parsed;
        }
      }

      // Validate with server
      const response = await fetch('/.netlify/functions/validate-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: membershipCode, action: 'validate' })
      });
      
      const result = await response.json();
      
      // Cache the result
      localStorage.setItem('membershipStatus', JSON.stringify(result));
      localStorage.setItem('membershipCacheTime', Date.now().toString());
      
      return result;
    } catch (error) {
      console.error('Error checking membership:', error);
      return { isValid: false, message: 'Error checking membership' };
    }
  }
}

// Local Storage Management for Favorites
export class FavoritesManager {
  static getFavorites() {
    try {
      return JSON.parse(localStorage.getItem('memberFavorites') || '[]');
    } catch {
      return [];
    }
  }

  static getBookmarkedChannels() {
    try {
      return JSON.parse(localStorage.getItem('memberChannels') || '[]');
    } catch {
      return [];
    }
  }

  static addFavorite(video) {
    const favorites = this.getFavorites();
    
    // Check for existing favorite using multiple methods for compatibility
    const exists = favorites.some(fav => {
      // New format with platform support
      if (video.uniqueId && fav.uniqueId) {
        return fav.uniqueId === video.uniqueId;
      }
      // Platform-specific comparison
      if (video.platform && fav.platform) {
        return fav.videoId === video.videoId && fav.platform === video.platform;
      }
      // Legacy format (YouTube only)
      return fav.videoId === video.videoId;
    });
    
    if (!exists) {
      favorites.unshift({
        uniqueId: video.uniqueId || `${video.platform || 'youtube'}:${video.videoId}`,
        videoId: video.videoId,
        platform: video.platform || 'youtube',
        title: video.title,
        thumbnail: video.thumbnail,
        channelTitle: video.channelTitle,
        url: video.url,
        dateAdded: new Date().toISOString()
      });
      localStorage.setItem('memberFavorites', JSON.stringify(favorites));
    }
    return favorites;
  }

  static removeFavorite(videoId, platform = null) {
    const favorites = this.getFavorites();
    // console.log('🔍 FavoritesManager.removeFavorite called with:', { videoId, platform });
    // console.log('🔍 Current favorites:', favorites);
    
    const filtered = favorites.filter(fav => {
      // For legacy favorites without platform, just match videoId
      if (!fav.platform) {
        const shouldRemove = fav.videoId === videoId;
        // console.log(`🔍 Legacy favorite check: ${fav.videoId} === ${videoId} = ${shouldRemove}`);
        return !shouldRemove;
      }
      
      // For new favorites with platform
      if (platform) {
        // Match both platform and videoId
        const shouldRemove = fav.videoId === videoId && fav.platform === platform;
        // console.log(`🔍 Platform-specific check: ${fav.videoId}:${fav.platform} === ${videoId}:${platform} = ${shouldRemove}`);
        return !shouldRemove;
      } else {
        // No platform specified, just match videoId (for backward compatibility)
        const shouldRemove = fav.videoId === videoId;
        // console.log(`🔍 VideoId-only check: ${fav.videoId} === ${videoId} = ${shouldRemove}`);
        return !shouldRemove;
      }
    });
    
    // console.log('🔍 Filtered favorites:', filtered);
    localStorage.setItem('memberFavorites', JSON.stringify(filtered));
    return filtered;
  }

  static addChannel(channel) {
    const channels = this.getBookmarkedChannels();
    
    // Create a unique identifier for multi-platform support
    const uniqueChannelId = `${channel.platform || 'youtube'}:${channel.channelId}`;
    
    // Check if channel already exists using multiple methods for compatibility
    const exists = channels.some(ch => {
      // New format with platform support
      if (channel.uniqueChannelId && ch.uniqueChannelId) {
        return ch.uniqueChannelId === channel.uniqueChannelId;
      }
      // Platform-specific comparison
      if (channel.platform && ch.platform) {
        return ch.channelId === channel.channelId && ch.platform === channel.platform;
      }
      // Legacy format (YouTube only)
      return ch.channelId === channel.channelId;
    });
    
    if (!exists) {
      channels.unshift({
        uniqueChannelId: uniqueChannelId,
        channelId: channel.channelId,
        platform: channel.platform || 'youtube',
        channelName: channel.channelName,
        channelUrl: channel.channelUrl || null,
        dateAdded: new Date().toISOString()
      });
      localStorage.setItem('memberChannels', JSON.stringify(channels));
    }
    return channels;
  }

  static removeChannel(channelId, platform = null) {
    const channels = this.getBookmarkedChannels();
    const filtered = channels.filter(ch => {
      // For legacy channels without platform, just match channelId
      if (!ch.platform) {
        return ch.channelId !== channelId;
      }
      
      // For new channels with platform
      if (platform) {
        // Match both platform and channelId
        return !(ch.channelId === channelId && ch.platform === platform);
      } else {
        // No platform specified, just match channelId (for backward compatibility)
        return ch.channelId !== channelId;
      }
    });
    localStorage.setItem('memberChannels', JSON.stringify(filtered));
    return filtered;
  }

  static isFavorited(videoId, platform = null) {
    return this.getFavorites().some(fav => {
      // If platform is specified, match both platform and videoId
      if (platform) {
        return fav.videoId === videoId && fav.platform === platform;
      }
      // Otherwise, just match videoId (legacy behavior)
      return fav.videoId === videoId;
    });
  }

  static isChannelBookmarked(channelId, platform = null) {
    return this.getBookmarkedChannels().some(ch => {
      // If platform is specified, match both platform and channelId
      if (platform) {
        return ch.channelId === channelId && ch.platform === platform;
      }
      // Otherwise, just match channelId (legacy behavior)
      return ch.channelId === channelId;
    });
  }
}