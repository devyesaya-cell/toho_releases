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

    if (options.body && !(options.body instanceof FormData)) {
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

  // Universal chunked uploader (splits files into <= 1.5MB chunks to safely bypass 2MB server/proxy limits)
  async uploadInChunks(endpoint, file, extraFields = {}, onProgress) {
    // 1.5 MB chunk size (1,572,864 bytes) leaves safe room for multipart boundary headers under 2MB limit
    const CHUNK_SIZE = 1.5 * 1024 * 1024;
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE) || 1;
    const uploadId = `upl_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    let lastResult = null;

    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
      const start = chunkIndex * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const chunkBlob = file.slice(start, end);

      const queryParams = new URLSearchParams({
        uploadId,
        chunkIndex: String(chunkIndex),
        totalChunks: String(totalChunks),
        fileName: file.name,
        fileSize: String(file.size),
      });

      for (const [k, v] of Object.entries(extraFields)) {
        if (v !== undefined && v !== null && v !== '') {
          queryParams.append(k, String(v));
        }
      }

      const url = `${endpoint}${endpoint.includes('?') ? '&' : '?'}${queryParams.toString()}`;

      const formData = new FormData();
      formData.append('uploadId', uploadId);
      formData.append('chunkIndex', String(chunkIndex));
      formData.append('totalChunks', String(totalChunks));
      formData.append('fileName', file.name);
      formData.append('fileSize', String(file.size));

      for (const [k, v] of Object.entries(extraFields)) {
        if (v !== undefined && v !== null && v !== '') {
          formData.append(k, String(v));
        }
      }

      formData.append('file', chunkBlob, file.name);

      lastResult = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', url);
        xhr.setRequestHeader('x-api-key', this.getKey());

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable && onProgress) {
            const currentChunkLoaded = e.loaded;
            const overallLoaded = Math.min(file.size, start + currentChunkLoaded);
            const percent = Math.min(100, Math.round((overallLoaded / file.size) * 100));
            onProgress(percent, overallLoaded, file.size, chunkIndex + 1, totalChunks);
          }
        };

        xhr.onload = () => {
          try {
            const res = JSON.parse(xhr.responseText);
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve(res);
            } else {
              reject(new Error(res.error || `Upload bagian ${chunkIndex + 1}/${totalChunks} gagal (HTTP ${xhr.status})`));
            }
          } catch (err) {
            if (xhr.status === 413) {
              reject(new Error(`Bagian file ${chunkIndex + 1}/${totalChunks} ditolak (HTTP 413). Batas upload server adalah 2MB.`));
            } else if (xhr.status === 502) {
              reject(new Error(`Server tidak merespons (HTTP 502 Bad Gateway) saat mengunggah bagian ${chunkIndex + 1}/${totalChunks}.`));
            } else if (xhr.status === 504) {
              reject(new Error(`Waktu upload habis (HTTP 504 Gateway Timeout) pada bagian ${chunkIndex + 1}/${totalChunks}.`));
            } else if (xhr.status === 401 || xhr.status === 403) {
              reject(new Error(`Autentikasi ditolak (HTTP ${xhr.status}). Periksa kembali Admin Master Key Anda.`));
            } else if (xhr.status === 0) {
              reject(new Error('Koneksi terputus ke server (Network error / Connection aborted).'));
            } else {
              reject(new Error(`Server mengembalikan status HTTP ${xhr.status} (${xhr.statusText || 'Non-JSON response'})`));
            }
          }
        };

        xhr.onerror = () => reject(new Error(`Koneksi terputus saat upload bagian ${chunkIndex + 1}/${totalChunks}`));
        xhr.send(formData);
      });

      if (onProgress) {
        const percent = Math.min(100, Math.round(((chunkIndex + 1) / totalChunks) * 100));
        onProgress(percent, end, file.size, chunkIndex + 1, totalChunks);
      }
    }

    return lastResult;
  },

  // Asset Upload with automatic chunking
  async uploadReleaseAsset(releaseId, file, onProgress) {
    return this.uploadInChunks(`/api/v1/releases/${releaseId}/assets`, file, {}, onProgress);
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

  // Storage File Upload with automatic chunking
  async uploadStorageFile(bucket, file, description = '', onProgress) {
    return this.uploadInChunks('/api/v1/storage/upload', file, { bucket, description }, onProgress);
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
