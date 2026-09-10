'use strict';

class LatestCareerReadingInsightSource {
  constructor({ secureReadingService } = {}) {
    if (!secureReadingService || typeof secureReadingService.listSecureReadings !== 'function' || typeof secureReadingService.getSecureReadingDetail !== 'function') throw new TypeError('LatestCareerReadingInsightSource requires SecureReadingService list and detail methods.');
    this.secureReadingService = secureReadingService; Object.freeze(this);
  }
  async latestForProfile({ principal, birthProfileId } = {}) {
    const readings = await this.secureReadingService.listSecureReadings({ principal, birthProfileId });
    const latest = readings.find((reading) => reading && reading.domain === 'CAREER' && reading.birthProfileId === birthProfileId);
    if (!latest) return null;
    const detail = await this.secureReadingService.getSecureReadingDetail({ principal, readingId: latest.readingId });
    if (!detail || detail.birthProfileId !== birthProfileId || detail.domain !== 'CAREER' || !Array.isArray(detail.insights)) return null;
    return Object.freeze({ birthProfileId, insights: detail.insights });
  }
}
module.exports = { LatestCareerReadingInsightSource };
