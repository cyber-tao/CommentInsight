class CredentialVault {
    static _mem = {};
    static storageAvailable() {
        return typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local && typeof chrome.storage.local.set === 'function';
    }
    static async setSecret(key, value) {
        try {
            const namespaced = `vault_${key}`;
            const v = String(value || '');
            if (this.storageAvailable()) {
                await chrome.storage.local.set({ [namespaced]: v });
                Logger.info('vault', 'Set secret', { key: namespaced });
            } else {
                this._mem[namespaced] = v;
                Logger.info('vault', 'Set secret (memory)', { key: namespaced });
            }
        } catch (e) {
            Logger.error('vault', 'Set secret failed', e);
        }
    }
    static async getSecret(key) {
        try {
            const namespaced = `vault_${key}`;
            if (this.storageAvailable()) {
                const res = await chrome.storage.local.get(namespaced);
                return res[namespaced] || '';
            }
            return this._mem[namespaced] || '';
        } catch (e) {
            Logger.error('vault', 'Get secret failed', e);
            return '';
        }
    }
    static async setAIKey(value) { return this.setSecret('ai_api_key', value); }
    static async getAIKey() { return this.getSecret('ai_api_key'); }
    static async setYouTubeKey(value) { return this.setSecret('youtube_api_key', value); }
    static async getYouTubeKey() { return this.getSecret('youtube_api_key'); }
    static async setTwitterBearerToken(value) { return this.setSecret('twitter_bearer_token', value); }
    static async getTwitterBearerToken() { return this.getSecret('twitter_bearer_token'); }
}

if (typeof window !== 'undefined') {
    window.CredentialVault = CredentialVault;
}
if (typeof self !== 'undefined') {
    self.CredentialVault = CredentialVault;
}
