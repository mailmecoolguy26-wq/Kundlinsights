'use strict';

const { google } = require('googleapis');

class GooglePlayApiClient {
  constructor({ serviceAccount } = {}) {
    this.auth = new google.auth.GoogleAuth({
      credentials: serviceAccount,
      scopes: ['https://www.googleapis.com/auth/androidpublisher'],
    });
    this.publisher = google.androidpublisher({ version: 'v3', auth: this.auth });
  }

  async getSubscription({ packageName, purchaseToken }) {
    const response = await this.publisher.purchases.subscriptionsv2.get({
      packageName,
      token: purchaseToken,
    });
    return response.data;
  }
}

module.exports = { GooglePlayApiClient };
