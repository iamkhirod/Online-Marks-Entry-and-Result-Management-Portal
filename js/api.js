// ============================================================
// API.JS — REST Client for SAERAS Backend
// ============================================================

const API = {
  baseUrl: '',

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = options.headers || {};
    if (!(options.body instanceof FormData) && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    try {
      const res = await fetch(url, { ...options, headers });
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || `HTTP ${res.status}`);
        }
        return data;
      }
      return res;
    } catch (err) {
      console.error(`API Error [${endpoint}]:`, err);
      throw err;
    }
  },

  // Auth
  login(username, password, role) {
    return this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password, role })
    });
  },

  changePassword(userId, newPassword) {
    return this.request('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ userId, newPassword })
    });
  },

  // Health
  getHealth() {
    return this.request('/api/health');
  },

  // Students
  getStudents(params = {}) {
    const q = new URLSearchParams(params).toString();
    return this.request(`/api/students${q ? '?' + q : ''}`);
  },

  getStudentResults(regNo) {
    return this.request(`/api/students/${encodeURIComponent(regNo)}/results`);
  },

  // Faculty
  getFacultySubjects(facultyId) {
    return this.request(`/api/faculty/my-subjects?facultyId=${encodeURIComponent(facultyId)}`);
  },

  getSubjectStudents(subjectId) {
    return this.request(`/api/faculty/subject-students/${encodeURIComponent(subjectId)}`);
  },

  saveMarks(subjectId, entries, publish = false) {
    return this.request('/api/marks/save', {
      method: 'POST',
      body: JSON.stringify({ subjectId, entries, publish })
    });
  },

  // Excel / CSV Upload
  uploadExcelFile(formData) {
    return this.request('/api/excel/upload-file', {
      method: 'POST',
      body: formData
    });
  },

  uploadExcelJSON(payload) {
    return this.request('/api/excel/upload-json', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  // Admin
  getUsers(role) {
    return this.request(`/api/admin/users${role ? '?role=' + role : ''}`);
  },

  createUser(data) {
    return this.request('/api/admin/users', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  toggleUser(userId) {
    return this.request(`/api/admin/toggle-user/${encodeURIComponent(userId)}`, {
      method: 'POST'
    });
  },

  getSubjects() {
    return this.request('/api/admin/subjects');
  },

  addSubject(data) {
    return this.request('/api/admin/subjects', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  assignFaculty(facultyId, subjectIds) {
    return this.request('/api/admin/assign-faculty', {
      method: 'POST',
      body: JSON.stringify({ facultyId, subjectIds })
    });
  },

  // Analytics
  getAnalyticsOverview() {
    return this.request('/api/analytics/overview');
  },

  // CO-PO
  getCOPO(subjectCode) {
    return this.request(`/api/copo${subjectCode ? '?code=' + encodeURIComponent(subjectCode) : ''}`);
  },

  // Notifications
  getNotifications(role) {
    return this.request(`/api/notifications?role=${encodeURIComponent(role || 'all')}`);
  },

  markNotificationsRead() {
    return this.request('/api/notifications/mark-read', { method: 'POST' });
  }
};
