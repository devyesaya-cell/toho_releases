/**
 * Main WebApp Application Logic
 */

// Application State
const state = {
  currentView: 'releases',
  apps: [],
  releases: [],
  storageFiles: [],
  activeBucket: 'all',
  keys: [],
  selectedAppFilter: '',
  selectedPlatformFilter: 'all',
  stats: null,
};

// Utilities
function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatDate(timestampSeconds) {
  if (!timestampSeconds) return '-';
  const d = new Date(timestampSeconds * 1000);
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  const icon = type === 'success' ? 'ri-checkbox-circle-fill' : type === 'error' ? 'ri-error-warning-fill' : 'ri-information-fill';
  toast.innerHTML = `<i class="${icon}" style="font-size: 1.2rem;"></i> <span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

function copyText(text, label = 'Copied to clipboard!') {
  if (!navigator.clipboard) {
    const el = document.createElement('textarea');
    el.value = text;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
  } else {
    navigator.clipboard.writeText(text);
  }
  showToast(label, 'success');
}

function getFileIcon(name = '', mime = '') {
  const ext = name.split('.').pop().toLowerCase();
  if (ext === 'apk') return 'ri-android-fill';
  if (['exe', 'msix'].includes(ext)) return 'ri-windows-fill';
  if (['zip', 'tar', 'gz', '7z'].includes(ext)) return 'ri-folder-zip-fill';
  if (['png', 'jpg', 'jpeg', 'webp', 'svg'].includes(ext)) return 'ri-image-fill';
  if (['json', 'yaml', 'txt', 'md'].includes(ext)) return 'ri-file-text-fill';
  if (['bin', 'dat', 'iso'].includes(ext)) return 'ri-hard-drive-2-fill';
  return 'ri-file-3-fill';
}

// Router & View Management
function initRouter() {
  const hash = window.location.hash.replace('#', '') || 'releases';
  switchView(hash);

  window.addEventListener('hashchange', () => {
    const newHash = window.location.hash.replace('#', '') || 'releases';
    switchView(newHash);
  });

  document.querySelectorAll('.nav-item[data-view]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      const view = el.getAttribute('data-view');
      window.location.hash = view;
    });
  });
}

function switchView(viewName) {
  state.currentView = viewName;

  document.querySelectorAll('.nav-item').forEach((el) => {
    if (el.getAttribute('data-view') === viewName) {
      el.classList.add('active');
    } else {
      el.classList.remove('active');
    }
  });

  document.querySelectorAll('.view-section').forEach((el) => {
    el.style.display = 'none';
  });

  const activeSection = document.getElementById(`view-${viewName}`);
  if (activeSection) {
    activeSection.style.display = 'block';
  }

  // Load data for the view
  if (viewName === 'releases') loadReleasesData();
  if (viewName === 'storage') loadStorageData();
  if (viewName === 'keys') loadKeysData();
  if (viewName === 'integration') loadIntegrationData();
}

// ==================== RELEASES VIEW ====================
async function loadReleasesData() {
  try {
    const [statsRes, appsRes, releasesRes] = await Promise.all([
      API.getStats(),
      API.getApps(),
      API.getReleases(state.selectedAppFilter, state.selectedPlatformFilter),
    ]);

    state.stats = statsRes.data;
    state.apps = appsRes.data;
    state.releases = releasesRes.data;

    renderStats();
    populateAppDropdowns();
    renderReleases();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function renderStats() {
  if (!state.stats) return;
  document.getElementById('stat-apps-count').innerText = state.stats.total_apps;
  document.getElementById('stat-releases-count').innerText = state.stats.total_releases;
  document.getElementById('stat-downloads-count').innerText = state.stats.total_downloads;
  document.getElementById('stat-storage-size').innerText = state.stats.total_storage_formatted;
}

function populateAppDropdowns() {
  const filterSelect = document.getElementById('filter-app-select');
  const modalSelect = document.getElementById('rel-app-id');
  const testSelect = document.getElementById('test-app-id');

  const prevFilterVal = filterSelect.value;
  filterSelect.innerHTML = '<option value="">All Applications</option>';
  modalSelect.innerHTML = '';
  testSelect.innerHTML = '';

  state.apps.forEach((app) => {
    const opt = document.createElement('option');
    opt.value = app.id;
    opt.textContent = `${app.name} (${app.id})`;
    filterSelect.appendChild(opt);

    const opt2 = opt.cloneNode(true);
    modalSelect.appendChild(opt2);

    const opt3 = opt.cloneNode(true);
    testSelect.appendChild(opt3);
  });

  filterSelect.value = prevFilterVal;
}

function renderReleases() {
  const container = document.getElementById('releases-container');

  if (!state.releases || state.releases.length === 0) {
    container.innerHTML = `
      <div class="empty-state glass-panel">
        <div class="empty-state-icon"><i class="ri-git-commit-line"></i></div>
        <h3>No Releases Published Yet</h3>
        <p>Click "Publish New Release" above to deploy your first version (APK, EXE, ZIP).</p>
      </div>
    `;
    return;
  }

  container.innerHTML = '';

  state.releases.forEach((rel) => {
    const card = document.createElement('div');
    card.className = 'release-card glass-panel';

    const isMandatory = rel.is_mandatory === 1;
    const isPrerelease = rel.is_prerelease === 1;

    let badgesHtml = `
      <span class="app-badge"><i class="ri-apps-line"></i> ${rel.app_name || rel.app_id}</span>
      <span class="tag-badge">${rel.tag_name}</span>
      <span class="platform-badge"><i class="ri-device-line"></i> ${rel.target_platform}</span>
    `;

    if (isMandatory) {
      badgesHtml += `<span class="mandatory-badge"><i class="ri-alert-fill"></i> Mandatory Update</span>`;
    }
    if (isPrerelease) {
      badgesHtml += `<span class="tag-badge" style="background: rgba(239, 68, 68, 0.1); color: var(--accent-rose); border-color: rgba(239, 68, 68, 0.3);">Pre-release</span>`;
    }

    // Assets HTML
    let assetsHtml = '';
    if (rel.assets && rel.assets.length > 0) {
      assetsHtml = `
        <div class="assets-box">
          <div class="assets-box-header">
            <span>Attached Assets & Packages (${rel.assets.length})</span>
          </div>
          <div class="assets-list">
            ${rel.assets
              .map(
                (ast) => `
              <div class="asset-row">
                <div class="asset-info">
                  <div class="asset-icon"><i class="${getFileIcon(ast.file_name)}"></i></div>
                  <div>
                    <div class="asset-name">${ast.file_name}</div>
                    <div class="asset-details">
                      <span><i class="ri-hard-drive-line"></i> ${formatBytes(ast.file_size)}</span>
                      <span><i class="ri-download-2-line"></i> ${ast.download_count} downloads</span>
                    </div>
                  </div>
                </div>
                <div class="asset-actions">
                  <button class="checksum-btn btn-view-checksum" data-name="${ast.file_name}" data-sha256="${ast.sha256}" data-md5="${ast.md5}" data-url="${ast.download_url}">
                    SHA-256
                  </button>
                  <a href="${ast.download_url}" class="btn btn-primary btn-sm" download>
                    <i class="ri-download-line"></i> Download
                  </a>
                  <button class="btn btn-secondary btn-sm btn-delete-asset" data-id="${ast.id}" title="Delete asset">
                    <i class="ri-delete-bin-line" style="color: var(--accent-rose);"></i>
                  </button>
                </div>
              </div>
            `
              )
              .join('')}
          </div>
        </div>
      `;
    }

    card.innerHTML = `
      <div class="release-card-header">
        <div>
          <div class="release-title-area">${badgesHtml}</div>
          <h3 class="release-heading">${rel.title}</h3>
          <div class="release-meta">
            <span><i class="ri-time-line"></i> Published ${formatDate(rel.created_at)}</span>
            <span><i class="ri-hashtag"></i> Build #${rel.build_number}</span>
            ${rel.min_supported_version ? `<span><i class="ri-shield-check-line"></i> Min Version: ${rel.min_supported_version}</span>` : ''}
          </div>
        </div>
        <div class="filter-group">
          <button class="btn btn-secondary btn-sm btn-attach-asset" data-id="${rel.id}" data-title="${rel.title} (${rel.tag_name})">
            <i class="ri-attachment-2"></i> Attach File
          </button>
          <button class="btn btn-secondary btn-sm btn-delete-release" data-id="${rel.id}" title="Delete Release">
            <i class="ri-delete-bin-line" style="color: var(--accent-rose);"></i>
          </button>
        </div>
      </div>

      ${rel.release_notes ? `<div class="release-notes-box">${rel.release_notes}</div>` : ''}
      
      ${assetsHtml}

      <div class="quick-upload-dropzone release-dropzone" data-release-id="${rel.id}">
        <i class="ri-upload-2-line" style="color: var(--accent-cyan); margin-right: 0.35rem;"></i>
        <span>Drag & drop APK or binary package here to attach to <strong>${rel.tag_name}</strong></span>
      </div>
    `;

    container.appendChild(card);
  });

  // Attach event listeners to card buttons
  container.querySelectorAll('.btn-delete-release').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (confirm('Are you sure you want to delete this release and all attached files?')) {
        try {
          await API.deleteRelease(btn.getAttribute('data-id'));
          showToast('Release deleted successfully');
          loadReleasesData();
        } catch (err) {
          showToast(err.message, 'error');
        }
      }
    });
  });

  container.querySelectorAll('.btn-delete-asset').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (confirm('Delete this file asset?')) {
        try {
          await API.deleteReleaseAsset(btn.getAttribute('data-id'));
          showToast('Asset deleted');
          loadReleasesData();
        } catch (err) {
          showToast(err.message, 'error');
        }
      }
    });
  });

  container.querySelectorAll('.btn-attach-asset').forEach((btn) => {
    btn.addEventListener('click', () => {
      const releaseId = btn.getAttribute('data-id');
      const title = btn.getAttribute('data-title');
      openUploadAssetModal(releaseId, title);
    });
  });

  container.querySelectorAll('.btn-view-checksum').forEach((btn) => {
    btn.addEventListener('click', () => {
      openChecksumModal(
        btn.getAttribute('data-name'),
        btn.getAttribute('data-sha256'),
        btn.getAttribute('data-md5'),
        btn.getAttribute('data-url')
      );
    });
  });

  // Setup drag & drop on individual release cards
  container.querySelectorAll('.release-dropzone').forEach((zone) => {
    const releaseId = zone.getAttribute('data-release-id');

    zone.addEventListener('dragover', (e) => {
      e.preventDefault();
      zone.classList.add('dragover');
    });

    zone.addEventListener('dragleave', () => {
      zone.classList.remove('dragover');
    });

    zone.addEventListener('drop', async (e) => {
      e.preventDefault();
      zone.classList.remove('dragover');
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0];
        try {
          showToast(`Uploading ${file.name}...`, 'warning');
          await API.uploadReleaseAsset(releaseId, file);
          showToast(`Attached ${file.name} to release!`);
          loadReleasesData();
        } catch (err) {
          showToast(err.message, 'error');
        }
      }
    });
  });
}

// ==================== FILE STORAGE VIEW ====================
async function loadStorageData() {
  try {
    const searchVal = document.getElementById('storage-search-input').value;
    const [filesRes, bucketsRes] = await Promise.all([
      API.getStorageFiles(state.activeBucket, searchVal),
      API.getBuckets(),
    ]);

    state.storageFiles = filesRes.data;
    renderBucketPills(bucketsRes.data);
    renderStorageFiles();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function renderBucketPills(buckets) {
  const container = document.getElementById('bucket-pills-container');
  const defaultBuckets = ['general', 'firmware', 'models', 'images', 'docs'];
  const allBucketNames = Array.from(new Set(['all', ...defaultBuckets, ...buckets.map((b) => b.bucket)]));

  container.innerHTML = allBucketNames
    .map(
      (b) => `
    <button class="pill-select ${state.activeBucket === b ? 'active' : ''}" data-bucket="${b}">
      ${b === 'all' ? 'All Buckets' : b}
    </button>
  `
    )
    .join('');

  container.querySelectorAll('.pill-select').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.activeBucket = btn.getAttribute('data-bucket');
      container.querySelectorAll('.pill-select').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      loadStorageData();
    });
  });
}

function renderStorageFiles() {
  const container = document.getElementById('files-grid-container');

  if (!state.storageFiles || state.storageFiles.length === 0) {
    container.innerHTML = `
      <div class="empty-state glass-panel" style="grid-column: 1 / -1;">
        <div class="empty-state-icon"><i class="ri-folder-open-line"></i></div>
        <h3>No Files Found in this Bucket</h3>
        <p>Drag and drop files onto the uploader above to store 3D models, firmware, or assets.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = '';

  state.storageFiles.forEach((file) => {
    const card = document.createElement('div');
    card.className = 'file-card glass-panel';

    card.innerHTML = `
      <div class="file-card-top">
        <div class="file-type-icon"><i class="${getFileIcon(file.original_name)}"></i></div>
        <div class="file-meta-content">
          <div class="file-name-title" title="${file.original_name}">${file.original_name}</div>
          <span class="file-bucket-tag">${file.bucket}</span>
          ${file.description ? `<p style="font-size: 0.8rem; color: var(--text-dim); margin-top: 0.25rem;">${file.description}</p>` : ''}
        </div>
      </div>

      <div class="file-card-details">
        <span><i class="ri-hard-drive-line"></i> ${formatBytes(file.file_size)}</span>
        <span><i class="ri-download-2-line"></i> ${file.download_count} dl</span>
        <span>${formatDate(file.created_at)}</span>
      </div>

      <div class="file-card-actions">
        <button class="btn btn-secondary btn-sm btn-copy-link" data-url="${file.public_url}" title="Copy Public Direct Link">
          <i class="ri-link"></i> Link
        </button>
        <button class="btn btn-secondary btn-sm btn-view-checksum" data-name="${file.original_name}" data-sha256="${file.sha256}" data-md5="${file.md5}" data-url="${file.download_url}">
          <i class="ri-fingerprint-line"></i> Hash
        </button>
        <a href="${file.download_url}" class="btn btn-primary btn-sm" download>
          <i class="ri-download-line"></i>
        </a>
        <button class="btn btn-secondary btn-sm btn-delete-file" data-id="${file.id}">
          <i class="ri-delete-bin-line" style="color: var(--accent-rose);"></i>
        </button>
      </div>
    `;

    container.appendChild(card);
  });

  // Attach button events
  container.querySelectorAll('.btn-copy-link').forEach((btn) => {
    btn.addEventListener('click', () => {
      copyText(btn.getAttribute('data-url'), 'Public file URL copied!');
    });
  });

  container.querySelectorAll('.btn-view-checksum').forEach((btn) => {
    btn.addEventListener('click', () => {
      openChecksumModal(
        btn.getAttribute('data-name'),
        btn.getAttribute('data-sha256'),
        btn.getAttribute('data-md5'),
        btn.getAttribute('data-url')
      );
    });
  });

  container.querySelectorAll('.btn-delete-file').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (confirm('Delete this file permanently from VPS storage?')) {
        try {
          await API.deleteStorageFile(btn.getAttribute('data-id'));
          showToast('File deleted successfully');
          loadStorageData();
        } catch (err) {
          showToast(err.message, 'error');
        }
      }
    });
  });
}

// ==================== API KEYS VIEW ====================
async function loadKeysData() {
  try {
    const res = await API.getKeys();
    state.keys = res.data;
    renderKeysTable();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function renderKeysTable() {
  const tbody = document.getElementById('keys-table-body');
  if (!state.keys || state.keys.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="padding: 2rem; text-align: center; color: var(--text-dim);">No generated keys found.</td></tr>`;
    return;
  }

  tbody.innerHTML = state.keys
    .map(
      (k) => `
    <tr style="border-bottom: 1px solid var(--border-subtle);">
      <td style="padding: 1rem 1.25rem; font-weight: 600; color: #fff;">${k.name}</td>
      <td style="padding: 1rem 1.25rem;">
        <span class="tag-badge" style="background: ${k.role === 'admin' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(6, 182, 212, 0.1)'}; color: ${k.role === 'admin' ? 'var(--accent-emerald)' : 'var(--accent-cyan)'};">
          ${k.role.toUpperCase()}
        </span>
      </td>
      <td style="padding: 1rem 1.25rem; font-family: var(--font-mono); font-size: 0.85rem; color: #a5f3fc;">
        ${k.key.substring(0, 16)}••••••••
        <button class="btn btn-secondary btn-sm" style="padding: 0.2rem 0.5rem; margin-left: 0.5rem;" onclick="copyText('${k.key}', 'API Key copied!')">
          <i class="ri-file-copy-line"></i>
        </button>
      </td>
      <td style="padding: 1rem 1.25rem; color: var(--text-dim);">${formatDate(k.created_at)}</td>
      <td style="padding: 1rem 1.25rem; color: var(--text-dim);">${formatDate(k.last_used_at)}</td>
      <td style="padding: 1rem 1.25rem; text-align: right;">
        <button class="btn btn-secondary btn-sm btn-delete-key" data-id="${k.id}">
          <i class="ri-delete-bin-line" style="color: var(--accent-rose);"></i>
        </button>
      </td>
    </tr>
  `
    )
    .join('');

  tbody.querySelectorAll('.btn-delete-key').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (confirm('Revoke and delete this API key?')) {
        try {
          await API.deleteKey(btn.getAttribute('data-id'));
          showToast('API key revoked');
          loadKeysData();
        } catch (err) {
          showToast(err.message, 'error');
        }
      }
    });
  });
}

// ==================== APP INTEGRATION VIEW ====================
function loadIntegrationData() {
  populateAppDropdowns();
}

async function runClientUpdateTest() {
  const appId = document.getElementById('test-app-id').value;
  const platform = document.getElementById('test-platform').value;
  const version = document.getElementById('test-version').value;

  const pre = document.getElementById('test-response-pre');
  const urlLabel = document.getElementById('test-endpoint-url');

  const endpointStr = `/api/v1/releases/latest?app=${appId}&platform=${platform}&current_version=${version}`;
  urlLabel.innerText = `GET ${endpointStr}`;

  pre.innerText = 'Querying VPS API...';

  try {
    const res = await API.testLatestRelease(appId, platform, version);
    pre.innerText = JSON.stringify(res, null, 2);
  } catch (err) {
    pre.innerText = `Error: ${err.message}`;
  }
}

// ==================== MODALS & FORMS ====================
function openModal(id) {
  document.getElementById(id).classList.add('active');
}

function closeModal(id) {
  document.getElementById(id).classList.remove('active');
}

function openUploadAssetModal(releaseId, title) {
  document.getElementById('asset-target-release-id').value = releaseId;
  document.getElementById('asset-target-release-title').innerText = title;
  document.getElementById('asset-upload-progress-box').style.display = 'none';
  document.getElementById('asset-upload-bar').style.width = '0%';
  document.getElementById('form-upload-asset').reset();
  openModal('modal-upload-asset');
}

function openChecksumModal(name, sha256, md5, url) {
  document.getElementById('cs-filename').value = name;
  document.getElementById('cs-sha256').value = sha256;
  document.getElementById('cs-md5').value = md5;
  document.getElementById('cs-url').value = url;
  openModal('modal-checksum');
}

function setupEventListeners() {
  // Modal Close buttons
  document.querySelectorAll('[data-close]').forEach((btn) => {
    btn.addEventListener('click', () => {
      closeModal(btn.getAttribute('data-close'));
    });
  });

  // Filter App & Platform dropdown changes
  document.getElementById('filter-app-select').addEventListener('change', (e) => {
    state.selectedAppFilter = e.target.value;
    loadReleasesData();
  });

  document.getElementById('filter-platform-select').addEventListener('change', (e) => {
    state.selectedPlatformFilter = e.target.value;
    loadReleasesData();
  });

  document.getElementById('btn-refresh-releases').addEventListener('click', () => {
    loadReleasesData();
    showToast('Releases refreshed');
  });

  // Buttons to open modals
  document.getElementById('btn-new-app').addEventListener('click', () => {
    document.getElementById('form-create-app').reset();
    openModal('modal-app');
  });

  document.getElementById('btn-new-release').addEventListener('click', () => {
    document.getElementById('form-create-release').reset();
    openModal('modal-release');
  });

  document.getElementById('btn-trigger-upload-modal').addEventListener('click', () => {
    document.getElementById('form-storage-upload').reset();
    document.getElementById('storage-upload-progress-box').style.display = 'none';
    document.getElementById('storage-bucket-input').value = state.activeBucket === 'all' ? 'general' : state.activeBucket;
    openModal('modal-storage-upload');
  });

  document.getElementById('btn-generate-key').addEventListener('click', () => {
    document.getElementById('form-create-key').reset();
    openModal('modal-new-key');
  });

  // Auth Status button
  document.getElementById('auth-status-btn').addEventListener('click', () => {
    document.getElementById('auth-key-input').value = API.getKey();
    openModal('modal-auth');
  });

  // Form: Save Auth Key
  document.getElementById('form-set-auth-key').addEventListener('submit', (e) => {
    e.preventDefault();
    const key = document.getElementById('auth-key-input').value;
    API.setKey(key);
    closeModal('modal-auth');
    showToast('API Key saved in browser!');
    loadReleasesData();
  });

  // Form: Create App
  document.getElementById('form-create-app').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('app-new-id').value;
    const name = document.getElementById('app-new-name').value;
    const description = document.getElementById('app-new-desc').value;

    try {
      await API.createApp({ id, name, description });
      closeModal('modal-app');
      showToast(`App "${name}" registered!`);
      loadReleasesData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // Form: Create Release
  document.getElementById('form-create-release').addEventListener('submit', async (e) => {
    e.preventDefault();
    const app_id = document.getElementById('rel-app-id').value;
    const tag_name = document.getElementById('rel-tag').value;
    const title = document.getElementById('rel-title').value;
    const build_number = parseInt(document.getElementById('rel-build').value, 10);
    const target_platform = document.getElementById('rel-platform').value;
    const min_supported_version = document.getElementById('rel-min-ver').value;
    const is_mandatory = document.getElementById('rel-is-mandatory').checked;
    const is_prerelease = document.getElementById('rel-is-prerelease').checked;
    const release_notes = document.getElementById('rel-notes').value;

    try {
      await API.createRelease({
        app_id,
        tag_name,
        title,
        build_number,
        target_platform,
        min_supported_version,
        is_mandatory,
        is_prerelease,
        release_notes,
      });
      closeModal('modal-release');
      showToast(`Release ${tag_name} published!`);
      loadReleasesData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // Form: Upload Asset to Release
  document.getElementById('form-upload-asset').addEventListener('submit', async (e) => {
    e.preventDefault();
    const releaseId = document.getElementById('asset-target-release-id').value;
    const file = document.getElementById('asset-file-input').files[0];
    if (!file) return;

    const progressBox = document.getElementById('asset-upload-progress-box');
    const progressBar = document.getElementById('asset-upload-bar');
    const progressPercent = document.getElementById('asset-upload-percent');
    const submitBtn = document.getElementById('btn-submit-asset-upload');

    progressBox.style.display = 'block';
    submitBtn.disabled = true;

    try {
      await API.uploadReleaseAsset(releaseId, file, (percent) => {
        progressBar.style.width = `${percent}%`;
        progressPercent.innerText = `${percent}%`;
      });
      closeModal('modal-upload-asset');
      showToast(`Uploaded ${file.name} to release!`);
      loadReleasesData();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      submitBtn.disabled = false;
    }
  });

  // Form: Upload File to Universal Storage
  document.getElementById('form-storage-upload').addEventListener('submit', async (e) => {
    e.preventDefault();
    const bucket = document.getElementById('storage-bucket-input').value;
    const file = document.getElementById('storage-modal-file-input').files[0];
    const desc = document.getElementById('storage-desc-input').value;
    if (!file) return;

    const progressBox = document.getElementById('storage-upload-progress-box');
    const progressBar = document.getElementById('storage-upload-bar');
    const progressPercent = document.getElementById('storage-upload-percent');
    const submitBtn = document.getElementById('btn-submit-storage-upload');

    progressBox.style.display = 'block';
    submitBtn.disabled = true;

    try {
      await API.uploadStorageFile(bucket, file, desc, (percent) => {
        progressBar.style.width = `${percent}%`;
        progressPercent.innerText = `${percent}%`;
      });
      closeModal('modal-storage-upload');
      showToast(`File ${file.name} stored in bucket "${bucket}"!`);
      loadStorageData();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      submitBtn.disabled = false;
    }
  });

  // Form: Create API Key
  document.getElementById('form-create-key').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('key-name-input').value;
    const role = document.getElementById('key-role-select').value;

    try {
      const res = await API.createKey(name, role);
      closeModal('modal-new-key');
      showToast(`Key generated: ${res.data.key.substring(0, 16)}...`);
      loadKeysData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // Drag and Drop for File Storage
  const storageDragzone = document.getElementById('storage-dragzone');
  const storageFileInput = document.getElementById('storage-file-input');

  storageDragzone.addEventListener('click', () => storageFileInput.click());

  storageDragzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    storageDragzone.classList.add('dragover');
  });

  storageDragzone.addEventListener('dragleave', () => {
    storageDragzone.classList.remove('dragover');
  });

  storageDragzone.addEventListener('drop', async (e) => {
    e.preventDefault();
    storageDragzone.classList.remove('dragover');
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      const bucket = state.activeBucket === 'all' ? 'general' : state.activeBucket;
      for (const file of files) {
        try {
          showToast(`Uploading ${file.name}...`, 'warning');
          await API.uploadStorageFile(bucket, file);
          showToast(`Uploaded ${file.name}!`);
        } catch (err) {
          showToast(err.message, 'error');
        }
      }
      loadStorageData();
    }
  });

  storageFileInput.addEventListener('change', async () => {
    if (storageFileInput.files && storageFileInput.files.length > 0) {
      const files = Array.from(storageFileInput.files);
      const bucket = state.activeBucket === 'all' ? 'general' : state.activeBucket;
      for (const file of files) {
        try {
          showToast(`Uploading ${file.name}...`, 'warning');
          await API.uploadStorageFile(bucket, file);
          showToast(`Uploaded ${file.name}!`);
        } catch (err) {
          showToast(err.message, 'error');
        }
      }
      loadStorageData();
    }
  });

  // Storage Search Input with Debounce
  let searchTimeout;
  document.getElementById('storage-search-input').addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      loadStorageData();
    }, 300);
  });

  // Copy buttons in Checksum modal
  document.getElementById('btn-copy-sha256').addEventListener('click', () => {
    copyText(document.getElementById('cs-sha256').value, 'SHA-256 copied!');
  });
  document.getElementById('btn-copy-md5').addEventListener('click', () => {
    copyText(document.getElementById('cs-md5').value, 'MD5 copied!');
  });
  document.getElementById('btn-copy-url').addEventListener('click', () => {
    copyText(document.getElementById('cs-url').value, 'Download link copied!');
  });

  // Test Update Button
  document.getElementById('btn-run-client-test').addEventListener('click', runClientUpdateTest);
  document.getElementById('btn-copy-test-json').addEventListener('click', () => {
    copyText(document.getElementById('test-response-pre').innerText, 'Test JSON copied!');
  });

  // Snippet tabs
  const tabFlutter = document.getElementById('tab-snippet-flutter');
  const tabCurl = document.getElementById('tab-snippet-curl');
  const tabNode = document.getElementById('tab-snippet-node');

  const snipFlutter = document.getElementById('snippet-flutter');
  const snipCurl = document.getElementById('snippet-curl');
  const snipNode = document.getElementById('snippet-node');

  tabFlutter.addEventListener('click', () => {
    tabFlutter.classList.add('active');
    tabCurl.classList.remove('active');
    tabNode.classList.remove('active');
    snipFlutter.style.display = 'block';
    snipCurl.style.display = 'none';
    snipNode.style.display = 'none';
  });

  tabCurl.addEventListener('click', () => {
    tabCurl.classList.add('active');
    tabFlutter.classList.remove('active');
    tabNode.classList.remove('active');
    snipCurl.style.display = 'block';
    snipFlutter.style.display = 'none';
    snipNode.style.display = 'none';
  });

  tabNode.addEventListener('click', () => {
    tabNode.classList.add('active');
    tabFlutter.classList.remove('active');
    tabCurl.classList.remove('active');
    snipNode.style.display = 'block';
    snipFlutter.style.display = 'none';
    snipCurl.style.display = 'none';
  });

  document.querySelectorAll('.btn-copy-code').forEach((btn) => {
    btn.addEventListener('click', () => {
      const code = btn.closest('.code-box').querySelector('pre').innerText;
      copyText(code, 'Code snippet copied to clipboard!');
    });
  });
}

// Bootstrap
document.addEventListener('DOMContentLoaded', () => {
  initRouter();
  setupEventListeners();
});
