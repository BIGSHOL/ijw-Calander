/**
 * MakeEdu Content Script
 * Extracts student data from MakeEdu page and syncs with textbook system
 */

(function() {
  'use strict';

  // Create floating sync button
  createFloatingButton();

  /**
   * Create floating button UI
   */
  function createFloatingButton() {
    const container = document.createElement('div');
    container.id = 'textbook-sync-container';
    container.innerHTML = `
      <div class="sync-panel">
        <div class="sync-header">
          <span>교재 시스템 연동</span>
          <button class="sync-toggle" title="접기/펼치기">−</button>
        </div>
        <div class="sync-content">
          <button id="sync-all-btn" class="sync-btn primary">
            전체 동기화
          </button>
          <div class="sync-status" id="sync-status"></div>
          <div class="sync-results" id="sync-results"></div>
        </div>
      </div>
    `;

    document.body.appendChild(container);

    // Event listeners
    container.querySelector('.sync-toggle').addEventListener('click', togglePanel);
    container.querySelector('#sync-all-btn').addEventListener('click', syncAllStudents);
  }

  /**
   * Toggle panel visibility
   */
  function togglePanel(e) {
    const content = document.querySelector('.sync-content');
    const btn = e.target;
    if (content.style.display === 'none') {
      content.style.display = 'block';
      btn.textContent = '−';
    } else {
      content.style.display = 'none';
      btn.textContent = '+';
    }
  }

  /**
   * Extract all student data from the current page
   */
  function extractStudentsFromPage() {
    const students = [];

    // Find all student rows in the table
    // Based on HTML analysis: student name is in a.dl_pop with title attribute
    // Includes both st_ (black) and st_red (red) classes
    const studentLinks = document.querySelectorAll('a.dl_pop[class*="st_"]');

    studentLinks.forEach(link => {
      const row = link.closest('tr');
      if (!row) return;

      // title 속성 우선, 없으면 첫 번째 텍스트 노드만 추출 (하위 버튼 텍스트 제외)
      let studentName = link.getAttribute('title') || '';
      if (!studentName) {
        for (const node of link.childNodes) {
          if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent.trim();
            if (text) { studentName = text; break; }
          }
        }
      }
      studentName = studentName.trim();

      // Find book/course name - a.btnPayName in the same row
      const bookLink = row.querySelector('a.btnPayName');
      const bookName = bookLink ? bookLink.textContent.trim() : '';

      // Find payment status - input.checkPayYn.changeCheck
      const paymentCheckbox = row.querySelector('input.checkPayYn.changeCheck');
      const isPaid = paymentCheckbox ? paymentCheckbox.checked : false;

      if (studentName) {
        students.push({
          studentName,
          bookName,
          isPaid,
          rowElement: row
        });
      }
    });

    return students;
  }

  /**
   * Sync all students found on the page
   */
  async function syncAllStudents() {
    const statusEl = document.getElementById('sync-status');
    const resultsEl = document.getElementById('sync-results');
    const syncBtn = document.getElementById('sync-all-btn');

    statusEl.textContent = '학생 정보 추출 중...';
    statusEl.className = 'sync-status loading';
    resultsEl.innerHTML = '';
    syncBtn.disabled = true;

    const students = extractStudentsFromPage();

    if (students.length === 0) {
      statusEl.textContent = '페이지에서 학생 정보를 찾을 수 없습니다.';
      statusEl.className = 'sync-status error';
      syncBtn.disabled = false;
      return;
    }

    statusEl.textContent = `${students.length}명의 학생 발견. 동기화 중...`;

    let successCount = 0;
    let failCount = 0;
    let notFoundCount = 0;

    for (const student of students) {
      try {
        const result = await syncStudent(student);

        const resultItem = document.createElement('div');
        resultItem.className = `result-item ${result.success ? 'success' : (result.notFound ? 'not-found' : 'error')}`;

        if (result.success) {
          successCount++;
          resultItem.textContent = `✓ ${student.studentName} (${student.isPaid ? '완납' : '미납'})`;
          // Highlight the row
          if (student.rowElement) {
            student.rowElement.style.backgroundColor = '#d4edda';
            setTimeout(() => {
              student.rowElement.style.backgroundColor = '';
            }, 3000);
          }
        } else if (result.notFound) {
          notFoundCount++;
          resultItem.textContent = `− ${student.studentName}: 교재 시스템에 없음`;
        } else {
          failCount++;
          resultItem.textContent = `✗ ${student.studentName}: ${result.error}`;
        }

        resultsEl.appendChild(resultItem);
      } catch (error) {
        failCount++;
        const resultItem = document.createElement('div');
        resultItem.className = 'result-item error';
        resultItem.textContent = `✗ ${student.studentName}: ${error.message}`;
        resultsEl.appendChild(resultItem);
      }
    }

    statusEl.textContent = `완료: 성공 ${successCount}, 미등록 ${notFoundCount}, 실패 ${failCount}`;
    statusEl.className = `sync-status ${failCount > 0 ? 'warning' : 'success'}`;
    syncBtn.disabled = false;
  }

  /**
   * Sync a single student
   */
  async function syncStudent(student) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({
        action: 'SYNC_STATUS',
        data: {
          studentName: student.studentName,
          bookName: student.bookName,
          isPaid: student.isPaid
        }
      }, response => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    });
  }

})();
