/**
 * Central API Client for VPS Storage & Release Hub
 */
const API = {
  getKey() {
    return localStorage.getItem('vps_api_key') || 'vps_secret_admin_key_2026';
  },

  setKey(key) {
    localStorage.setItem('vps_api_key', key.trim());
  },

  async request(endpoint, options = {}) {
    const headers = options.headers || {};
    const key = this.getKey();
    if (key) {
      headers['x-api-key'] = key;
    }

    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    const res = await fetch(endpoint, {
      ...options,
      headers,
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || `HTTP error ${res.status}`);
    }
    return data;
  },

  // Stats
  async getStats() {
    return this.request('/api/v1/stats');
  },

  // Apps
  async getApps() {
    return this.request('/api/v1/apps');
  },

  async createApp(appData) {
    return this.request('/api/v1/apps', {
      method: 'POST',
      body: JSON.stringify(appData),
    });
  },

  async deleteApp(id) {
    return this.request(`/api/v1/apps/${id}`, {
      method: 'DELETE',
    });
  },

  // Releases
  async getReleases(appId = '', platform = '') {
    let url = '/api/v1/releases?';
    if (appId) url += `app=${encodeURIComponent(appId)}&`;
    if (platform && platform !== 'all') url += `platform=${encodeURIComponent(platform)}&`;
    return this.request(url);
  },

  async getRelease(id) {
    return this.request(`/api/v1/releases/${id}`);
  },

  async createRelease(data) {
    return this.request('/api/v1/releases', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async deleteRelease(id) {
    return this.request(`/api/v1/releases/${id}`, {
      method: 'DELETE',
    });
  },

  // Asset Upload with XMLHttpRequest for real-time progress
  uploadReleaseAsset(releaseId, file, onProgress) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const formData = new FormData();
      formData.append('file', file);

      xhr.open('POST', `/api/v1/releases/${releaseId}/assets`);
      xhr.setRequestHeader('x-api-key', this.getKey());

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) {
          const percent = Math.round((e.loaded / e.total) * 100);
          onProgress(percent, e.loaded, e.total);
        }
      };

      xhr.onload = () => {
        try {
          const res = JSON.parse(xhr.responseText);
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(res);
          } else {
            reject(new Error(res.error || `Upload failed with status ${xhr.status}`));
          }
        } catch (err) {
          reject(new Error('Invalid response from server'));
        }
      };

      xhr.onerror = () => reject(new Error('Network error during asset upload'));
      xhr.send(formData);
    });
  },

  async deleteReleaseAsset(assetId) {
    return this.request(`/api/v1/releases/assets/${assetId}`, {
      method: 'DELETE',
    });
  },

  // Storage Files
  async getStorageFiles(bucket = '', search = '') {
    let url = '/api/v1/storage/files?';
    if (bucket && bucket !== 'all') url += `bucket=${encodeURIComponent(bucket)}&`;
    if (search) url += `search=${encodeURIComponent(search)}&`;
    return this.request(url);
  },

  async getBuckets() {
    return this.request('/api/v1/storage/buckets');
  },

  uploadStorageFile(bucket, file, description = '', onProgress) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const formData = new FormData();
      formData.append('bucket', bucket);
      formData.append('description', description);
      formData.append('file', file);

      xhr.open('POST', '/api/v1/storage/upload');
      xhr.setRequestHeader('x-api-key', this.getKey());

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) {
          const percent = Math.round((e.loaded / e.total) * 100);
          onProgress(percent, e.loaded, e.total);
        }
      };

      xhr.onload = () => {
        try {
          const res = JSON.parse(xhr.responseText);
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(res);
          } else {
            reject(new Error(res.error || `Upload failed with status ${xhr.status}`));
          }
        } catch (err) {
          reject(new Error('Invalid response from server'));
        }
      };

      xhr.onerror = () => reject(new Error('Network error during file upload'));
      xhr.send(formData);
    });
  },

  async deleteStorageFile(id) {
    return this.request(`/api/v1/storage/files/${id}`, {
      method: 'DELETE',
    });
  },

  // API Keys
  async getKeys() {
    return this.request('/api/v1/keys');
  },

  async createKey(name, role) {
    return this.request('/api/v1/keys', {
      method: 'POST',
      body: JSON.stringify({ name, role }),
    });
  },

  async deleteKey(id) {
    return this.request(`/api/v1/keys/${id}`, {
      method: 'DELETE',
    });
  },

  // Test Auto-update
  async testLatestRelease(appId, platform, currentVersion) {
    let url = `/api/v1/releases/latest?app=${encodeURIComponent(appId)}`;
    if (platform) url += `&platform=${encodeURIComponent(platform)}`;
    if (currentVersion) url += `&current_version=${encodeURIComponent(currentVersion)}`;
    return this.request(url);
  },
};
