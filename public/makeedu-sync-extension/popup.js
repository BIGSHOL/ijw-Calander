document.addEventListener('DOMContentLoaded', async () => {
  // Debug: Check all storage content
  const allStorage = await chrome.storage.local.get(null);
  console.log('All storage content:', allStorage);

  await checkConnection();
  await checkVersion();
  await loadPendingCount();
  await loadSyncHistory();

  document.getElementById('open-makeedu').addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://school.makeedu.co.kr' });
  });
});

/**
 * Check for extension updates
 */
async function checkVersion() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'CHECK_VERSION' });
    if (response.success && response.updateAvailable) {
      document.getElementById('update-banner').style.display = 'block';
      document.getElementById('latest-version').textContent = `v${response.latestVersion}`;
    }
  } catch (error) {
    // Silent fail - version check is not critical
  }
}

/**
 * Check Firestore connection status
 */
async function checkConnection() {
  const indicator = document.getElementById('status-indicator');
  const text = document.getElementById('status-text');

  try {
    const response = await chrome.runtime.sendMessage({ action: 'CHECK_CONNECTION' });

    if (response.success && response.connected) {
      indicator.className = 'status-indicator connected';
      text.textContent = 'Firestore 연결됨';
    } else {
      indicator.className = 'status-indicator disconnected';
      text.textContent = '연결 오류: ' + (response.error || '알 수 없음');
    }
  } catch (error) {
    indicator.className = 'status-indicator disconnected';
    text.textContent = '연결 실패';
  }
}

/**
 * Load pending request counts by status
 */
async function loadPendingCount() {
  const registeredEl = document.getElementById('not-registered-count');
  const paidEl = document.getElementById('not-paid-count');
  const orderedEl = document.getElementById('not-ordered-count');

  try {
    const response = await chrome.runtime.sendMessage({ action: 'GET_REQUESTS' });

    if (response.success && response.counts) {
      registeredEl.textContent = response.counts.notRegistered;
      paidEl.textContent = response.counts.notPaid;
      orderedEl.textContent = response.counts.notOrdered;
    } else {
      registeredEl.textContent = '?';
      paidEl.textContent = '?';
      orderedEl.textContent = '?';
    }
  } catch (error) {
    registeredEl.textContent = '?';
    paidEl.textContent = '?';
    orderedEl.textContent = '?';
  }
}

/**
 * Load sync history from storage
 */
async function loadSyncHistory() {
  const listEl = document.getElementById('history-list');

  try {
    const result = await chrome.storage.local.get(['syncHistory']);
    const history = result.syncHistory || [];

    if (history.length === 0) {
      listEl.innerHTML = '<div class="empty-state">동기화 내역이 없습니다</div>';
      return;
    }

    // 최신순 정렬
    history.sort((a, b) => new Date(b.syncedAt) - new Date(a.syncedAt));

    listEl.innerHTML = history.slice(0, 10).map(item => {
      const time = formatTime(item.syncedAt);

      // Build status badges
      const badges = [];
      if (item.isCompleted) {
        badges.push('<span class="status-badge completed">등록</span>');
      }
      if (item.isPaid) {
        badges.push('<span class="status-badge paid">납부</span>');
      }

      return `
        <div class="history-item">
          <div class="history-info">
            <div class="history-name">${escapeHtml(item.studentName)}</div>
            <div class="history-book">${escapeHtml(item.bookName || '')}</div>
            <div class="history-time">${time}</div>
          </div>
          <div class="history-badges">
            ${badges.join('')}
          </div>
        </div>
      `;
    }).join('');
  } catch (error) {
    listEl.innerHTML = '<div class="empty-state">내역을 불러올 수 없습니다</div>';
  }
}

/**
 * Format time for display
 */
function formatTime(isoString) {
  const date = new Date(isoString);
  const now = new Date();
  const diff = now - date;

  if (diff < 60000) {
    return '방금 전';
  } else if (diff < 3600000) {
    return `${Math.floor(diff / 60000)}분 전`;
  } else if (diff < 86400000) {
    return `${Math.floor(diff / 3600000)}시간 전`;
  } else {
    return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
  }
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
