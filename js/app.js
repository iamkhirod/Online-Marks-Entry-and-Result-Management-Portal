// ============================================================
// APP.JS — Master Controller for SAERAS Dashboard
// ============================================================

let SESSION = null;
let charts = {};
let subjectsCache = [];

function getSession() {
  if (!SESSION) {
    const raw = sessionStorage.getItem('saeras_session');
    if (!raw) {
      window.location.href = 'index.html';
      return null;
    }
    try {
      SESSION = JSON.parse(raw);
    } catch (e) {
      window.location.href = 'index.html';
      return null;
    }
  }
  return SESSION;
}

function logout() {
  sessionStorage.removeItem('saeras_session');
  window.location.href = 'index.html';
}

function toast(msg, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `<span>${msg}</span>`;
  container.appendChild(t);
  setTimeout(() => {
    t.style.opacity = '0';
    setTimeout(() => t.remove(), 300);
  }, 3500);
}

function showModal(html, extraClass = '') {
  const m = document.getElementById('modal-content');
  m.className = 'modal' + (extraClass ? ' ' + extraClass : '');
  m.innerHTML = html;
  document.getElementById('modal-overlay').classList.add('show');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('show');
  const m = document.getElementById('modal-content');
  if (m) m.className = 'modal';
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
}

function toggleNotifPanel() {
  document.getElementById('notif-panel').classList.toggle('show');
}

function destroyChart(id) {
  if (charts[id]) {
    charts[id].destroy();
    delete charts[id];
  }
}

// ==========================================
// NAVIGATION STRUCTURE
// ==========================================
const NAV_CONFIG = {
  admin: [
    { id: 'admin-dashboard', icon: '📊', label: 'Dashboard' },
    { id: 'manage-students', icon: '👥', label: 'Students' },
    { id: 'manage-faculty', icon: '👨‍🏫', label: 'Faculty' },
    { id: 'manage-subjects', icon: '📚', label: 'Subjects' },
    { id: 'copo', icon: '🎯', label: 'CO-PO Mapping' },
    { id: 'reports', icon: '📄', label: 'Reports & Audits' }
  ],
  faculty: [
    { id: 'faculty-dashboard', icon: '📊', label: 'My Subjects' },
    { id: 'marks-entry', icon: '✏️', label: 'Marks Entry' },
    { id: 'faculty-analytics', icon: '📈', label: 'Performance Analytics' }
  ],
  student: [
    { id: 'student-dashboard', icon: '📊', label: 'My Results & GPA' },
    { id: 'search', icon: '🔍', label: 'Search Portal' }
  ]
};

function renderNav() {
  const s = getSession();
  if (!s) return;

  const items = NAV_CONFIG[s.role] || [];
  const navEl = document.getElementById('nav-items');
  navEl.innerHTML = `
    <div class="nav-label">${s.role.toUpperCase()} PORTAL</div>
    ${items.map(it => `
      <div class="nav-item" data-page="${it.id}" onclick="switchPage('${it.id}')">
        <span class="icon">${it.icon}</span>${it.label}
      </div>
    `).join('')}
  `;

  document.getElementById('user-name').textContent = s.name;
  document.getElementById('user-role').textContent = s.role;
  const initials = s.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  document.getElementById('user-avatar').textContent = initials;
}

async function switchPage(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const target = document.getElementById(`pg-${pageId}`);
  if (target) {
    target.classList.add('active');
  }

  document.querySelectorAll('.nav-item').forEach(n => {
    n.classList.toggle('active', n.dataset.page === pageId);
  });

  const activeNav = document.querySelector(`.nav-item[data-page="${pageId}"]`);
  if (activeNav) {
    document.getElementById('page-title').textContent = activeNav.textContent.trim();
  }

  // Route Handler
  try {
    if (pageId === 'admin-dashboard') await renderAdminDash();
    else if (pageId === 'manage-students') await renderStudentTable();
    else if (pageId === 'manage-faculty') await renderFacultyTable();
    else if (pageId === 'manage-subjects') await renderSubjectsTable();
    else if (pageId === 'copo') await renderCOPO();
    else if (pageId === 'reports') await renderReports();
    else if (pageId === 'faculty-dashboard') await renderFacultyDash();
    else if (pageId === 'marks-entry') await initMarksEntry();
    else if (pageId === 'faculty-analytics') await initFacultyAnalytics();
    else if (pageId === 'student-dashboard') await renderStudentDash();
    else if (pageId === 'search') await initSearch();
  } catch (err) {
    console.error('Page render error:', err);
    toast(`Failed to load page data: ${err.message}`, 'error');
  }
}

// ==========================================
// NOTIFICATIONS
// ==========================================
async function renderNotifs() {
  const s = getSession();
  try {
    const notifs = await API.getNotifications(s.role);
    const unreadCount = notifs.filter(n => !n.is_read).length;
    const dot = document.getElementById('notif-dot');
    if (dot) dot.classList.toggle('hidden', unreadCount === 0);

    const list = document.getElementById('notif-list');
    if (!list) return;

    if (!notifs.length) {
      list.innerHTML = '<div class="empty-state"><p>No notifications</p></div>';
      return;
    }

    list.innerHTML = notifs.map(n => `
      <div class="notif-item ${n.is_read ? '' : 'unread'}">
        <div class="notif-title">${n.title}</div>
        <div style="font-size:0.8rem;color:var(--text2);margin-top:2px">${n.message}</div>
        <div class="notif-time">${new Date(n.created_at).toLocaleString()}</div>
      </div>
    `).join('');
  } catch (e) {
    console.error(e);
  }
}

async function markAllNotifsRead() {
  await API.markNotificationsRead();
  await renderNotifs();
  toast('Notifications marked as read', 'success');
}

// ==========================================
// ADMIN DASHBOARD
// ==========================================
async function renderAdminDash() {
  const [analytics, subjects, users] = await Promise.all([
    API.getAnalyticsOverview(),
    API.getSubjects(),
    API.getUsers()
  ]);

  const students = users.filter(u => u.role === 'student');
  const faculty = users.filter(u => u.role === 'faculty');

  // Metrics
  document.getElementById('admin-metrics').innerHTML = `
    <div class="metric">
      <div class="metric-label">Total Students</div>
      <div class="metric-value">${students.length}</div>
      <div class="metric-sub">Active in portal</div>
    </div>
    <div class="metric success">
      <div class="metric-label">Active Subjects</div>
      <div class="metric-value">${subjects.length}</div>
      <div class="metric-sub">Across semesters</div>
    </div>
    <div class="metric">
      <div class="metric-label">Faculty Members</div>
      <div class="metric-value">${faculty.length}</div>
      <div class="metric-sub">Departments assigned</div>
    </div>
    <div class="metric warning">
      <div class="metric-label">Overall Pass Rate</div>
      <div class="metric-value">${analytics.pass_fail.pass_rate}%</div>
      <div class="metric-sub">${analytics.pass_fail.passed} Passed / ${analytics.pass_fail.failed} Failed</div>
    </div>
  `;

  // Grade Distribution Chart
  destroyChart('chart-grade-dist');
  const gd = analytics.grade_distribution;
  charts['chart-grade-dist'] = new Chart(document.getElementById('chart-grade-dist'), {
    type: 'doughnut',
    data: {
      labels: Object.keys(gd),
      datasets: [{
        data: Object.values(gd),
        backgroundColor: ['#16a34a', '#22c55e', '#3b82f6', '#8b5cf6', '#f59e0b', '#f97316', '#ef4444'],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'right', labels: { color: '#94a3b8', padding: 12, font: { family: 'Inter' } } }
      }
    }
  });

  // Pass Rate by Subject Chart
  destroyChart('chart-pass-rate');
  const stats = analytics.subject_stats;
  charts['chart-pass-rate'] = new Chart(document.getElementById('chart-pass-rate'), {
    type: 'bar',
    data: {
      labels: stats.map(s => s.code),
      datasets: [{
        label: 'Pass %',
        data: stats.map(s => s.pass_rate),
        backgroundColor: 'rgba(99, 102, 241, 0.7)',
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { beginAtZero: true, max: 100, grid: { color: 'rgba(51,65,85,.3)' }, ticks: { color: '#94a3b8' } },
        x: { grid: { display: false }, ticks: { color: '#94a3b8' } }
      },
      plugins: { legend: { display: false } }
    }
  });

  // Top Performers Table
  const topEl = document.getElementById('top-performers-tbody');
  if (analytics.top_performers && analytics.top_performers.length) {
    topEl.innerHTML = analytics.top_performers.map((s, i) => `
      <tr>
        <td>${i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}</td>
        <td><strong>${s.name}</strong></td>
        <td><span class="tag">${s.registration_number}</span></td>
        <td><strong style="color:var(--primary2)">${s.cgpa.toFixed(2)}</strong></td>
      </tr>
    `).join('');
  } else {
    topEl.innerHTML = '<tr><td colspan="4" class="text-center text-muted">No student assessment records found.</td></tr>';
  }

  // Weak Students Table
  const weakEl = document.getElementById('weak-students-tbody');
  if (analytics.weak_students && analytics.weak_students.length) {
    weakEl.innerHTML = analytics.weak_students.map(s => `
      <tr>
        <td>${s.name}</td>
        <td><span class="tag">${s.registration_number}</span></td>
        <td><strong style="color:var(--danger)">${s.cgpa.toFixed(2)}</strong></td>
        <td><span class="badge ${s.cgpa < 3 ? 'fail' : 'warn'}">${s.cgpa < 3 ? 'Critical Action' : 'Remedial Help'}</span></td>
      </tr>
    `).join('');
  } else {
    weakEl.innerHTML = '<tr><td colspan="4" class="text-center text-muted">No weak students identified (All above 5.0 CGPA).</td></tr>';
  }
}

// ==========================================
// ADMIN: MANAGE STUDENTS
// ==========================================
async function renderStudentTable() {
  const query = (document.getElementById('stu-search')?.value || '').trim();
  const branch = document.getElementById('stu-branch-filter')?.value || '';

  const students = await API.getStudents({ q: query, branch });
  const tbody = document.getElementById('students-tbody');

  if (!students.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted">No students matching criteria</td></tr>';
    return;
  }

  tbody.innerHTML = students.map(s => `
    <tr>
      <td><span class="tag">${s.registration_number}</span></td>
      <td><strong>${s.name}</strong></td>
      <td>${s.branch}</td>
      <td>Sem ${s.semester}</td>
      <td><strong>${s.cgpa.toFixed(2)}</strong></td>
      <td><span class="badge ${s.status === 'Pass' ? 'pass' : (s.status === 'Fail' ? 'fail' : 'neutral')}">${s.status}</span></td>
      <td><span class="badge ${s.enabled ? 'pass' : 'fail'}">${s.enabled ? 'Active' : 'Disabled'}</span></td>
      <td>
        <div style="display:flex;gap:4px">
          <button class="btn sm primary" onclick="viewOfficialMarkSheet('${s.registration_number}')" title="View Official Results Sheet">
            📄 Sheet
          </button>
          <button class="btn sm outline" onclick="toggleStudent('${s.user_id}')">
            ${s.enabled ? 'Disable' : 'Enable'}
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

async function toggleStudent(userId) {
  await API.toggleUser(userId);
  await renderStudentTable();
  toast('User account access status updated.', 'success');
}

function exportStudentsCSV() {
  API.getStudents().then(students => {
    let csv = 'Registration Number,Student Name,Branch,Semester,CGPA,Status\n';
    students.forEach(s => {
      csv += `"${s.registration_number}","${s.name}","${s.branch}",${s.semester},${s.cgpa.toFixed(2)},"${s.status}"\n`;
    });
    downloadBlob(csv, 'students_academic_report.csv', 'text/csv');
    toast('Student CSV Report exported.', 'success');
  });
}

// ==========================================
// ADMIN: MANAGE FACULTY
// ==========================================
async function renderFacultyTable() {
  const [faculty, subjects] = await Promise.all([
    API.getUsers('faculty'),
    API.getSubjects()
  ]);

  const tbody = document.getElementById('faculty-tbody');
  if (!faculty.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No faculty accounts found.</td></tr>';
    return;
  }

  tbody.innerHTML = faculty.map(f => {
    const assignedSubs = subjects.filter(s => s.faculty && s.faculty.includes(f.name)).map(s => s.code).join(', ');
    return `
      <tr>
        <td><strong>${f.name}</strong></td>
        <td>${f.email}</td>
        <td>${assignedSubs || '<span class="text-muted">None Assigned</span>'}</td>
        <td><span class="badge ${f.enabled ? 'pass' : 'fail'}">${f.enabled ? 'Active' : 'Disabled'}</span></td>
        <td>
          <button class="btn sm primary" onclick="showAssignSubjectModal('${f.id}', '${f.name}')">Assign Subjects</button>
          <button class="btn sm outline" onclick="toggleFaculty('${f.id}')">${f.enabled ? 'Disable' : 'Enable'}</button>
        </td>
      </tr>
    `;
  }).join('');
}

async function toggleFaculty(userId) {
  await API.toggleUser(userId);
  await renderFacultyTable();
  toast('Faculty status updated', 'success');
}

function showAddFacultyModal() {
  showModal(`
    <h2>Add Faculty Member</h2>
    <p class="modal-sub">Create a new faculty account for marks entry and grading</p>
    <div class="form-group">
      <label>Full Name</label>
      <input type="text" id="mf-name" placeholder="Dr. Jane Doe">
    </div>
    <div class="form-group">
      <label>Username / Email</label>
      <input type="text" id="mf-username" placeholder="jane@saeras.edu">
    </div>
    <div class="form-group">
      <label>Default Password</label>
      <input type="text" id="mf-pass" value="faculty123">
    </div>
    <div class="modal-footer">
      <button class="btn outline" onclick="closeModal()">Cancel</button>
      <button class="btn primary" onclick="submitAddFaculty()">Create Faculty</button>
    </div>
  `);
}

async function submitAddFaculty() {
  const name = document.getElementById('mf-name').value.trim();
  const username = document.getElementById('mf-username').value.trim();
  const password = document.getElementById('mf-pass').value.trim();

  if (!name || !username) {
    toast('Please enter name and username', 'error');
    return;
  }

  try {
    await API.createUser({ name, username, email: username, password, role: 'faculty' });
    closeModal();
    await renderFacultyTable();
    toast('Faculty created successfully!', 'success');
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function showAssignSubjectModal(facultyId, facultyName) {
  const subjects = await API.getSubjects();
  const options = subjects.map(s => `
    <label style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.05)">
      <input type="checkbox" class="assign-sub-cb" value="${s.id}" ${s.faculty && s.faculty.includes(facultyName) ? 'checked' : ''}>
      <span><b>${s.code}</b> — ${s.name} (${s.branch}, Sem ${s.semester})</span>
    </label>
  `).join('');

  showModal(`
    <h2>Assign Subjects to ${facultyName}</h2>
    <p class="modal-sub">Check the courses this instructor teaches:</p>
    <div style="max-height:300px;overflow-y:auto;margin:15px 0">
      ${options}
    </div>
    <div class="modal-footer">
      <button class="btn outline" onclick="closeModal()">Cancel</button>
      <button class="btn primary" onclick="submitSubjectAssignments('${facultyId}')">Save Assignments</button>
    </div>
  `);
}

async function submitSubjectAssignments(facultyId) {
  const checked = Array.from(document.querySelectorAll('.assign-sub-cb:checked')).map(cb => cb.value);
  try {
    await API.assignFaculty(facultyId, checked);
    closeModal();
    await renderFacultyTable();
    toast('Subject assignments saved!', 'success');
  } catch (err) {
    toast(err.message, 'error');
  }
}

// ==========================================
// ADMIN: MANAGE SUBJECTS
// ==========================================
async function renderSubjectsTable() {
  subjectsCache = await API.getSubjects();
  const tbody = document.getElementById('subjects-tbody');
  tbody.innerHTML = subjectsCache.map(s => `
    <tr>
      <td><span class="tag">${s.code}</span></td>
      <td><strong>${s.name}</strong></td>
      <td>${s.branch}</td>
      <td>Sem ${s.semester}</td>
      <td>${s.credits} Credits</td>
      <td>${s.faculty && s.faculty.length ? s.faculty.join(', ') : '<span class="text-muted">Unassigned</span>'}</td>
      <td>${s.students_count}</td>
      <td>
        <button class="btn sm outline" onclick="showEditSubjectModal('${s.id}')">Edit</button>
      </td>
    </tr>
  `).join('');
}

function showAddSubjectModal() {
  showModal(`
    <h2>Add New Subject</h2>
    <p class="modal-sub">Dynamically register a new academic course in database</p>
    <div class="form-grid">
      <div class="form-group">
        <label>Course Code</label>
        <input type="text" id="as-code" placeholder="e.g. CS401">
      </div>
      <div class="form-group">
        <label>Subject Name</label>
        <input type="text" id="as-name" placeholder="e.g. Machine Learning">
      </div>
      <div class="form-group">
        <label>Department / Branch</label>
        <select id="as-branch">
          <option>CS</option><option>ECE</option><option>MECH</option><option>CIVIL</option>
        </select>
      </div>
      <div class="form-group">
        <label>Semester</label>
        <input type="number" id="as-sem" value="4" min="1" max="8">
      </div>
      <div class="form-group">
        <label>Credits</label>
        <input type="number" id="as-credits" value="4" min="1" max="6">
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn outline" onclick="closeModal()">Cancel</button>
      <button class="btn primary" onclick="submitAddSubject()">Save Subject</button>
    </div>
  `);
}

async function submitAddSubject() {
  const code = document.getElementById('as-code').value.trim();
  const name = document.getElementById('as-name').value.trim();
  const branch = document.getElementById('as-branch').value;
  const semester = parseInt(document.getElementById('as-sem').value);
  const credits = parseInt(document.getElementById('as-credits').value);

  if (!code || !name) {
    toast('Code and Name are required', 'error');
    return;
  }

  try {
    await API.addSubject({ code, name, branch, semester, credits });
    closeModal();
    await renderSubjectsTable();
    toast(`Subject ${code} created successfully!`, 'success');
  } catch (err) {
    toast(err.message, 'error');
  }
}

function showEditSubjectModal(subId) {
  const s = subjectsCache.find(x => x.id === subId);
  if (!s) return;
  showModal(`
    <h2>Edit Subject Details</h2>
    <div class="form-grid">
      <div class="form-group"><label>Code</label><input type="text" id="es-code" value="${s.code}"></div>
      <div class="form-group"><label>Name</label><input type="text" id="es-name" value="${s.name}"></div>
      <div class="form-group">
        <label>Branch</label>
        <select id="es-branch">
          <option ${s.branch==='CS'?'selected':''}>CS</option>
          <option ${s.branch==='ECE'?'selected':''}>ECE</option>
          <option ${s.branch==='MECH'?'selected':''}>MECH</option>
          <option ${s.branch==='CIVIL'?'selected':''}>CIVIL</option>
        </select>
      </div>
      <div class="form-group"><label>Semester</label><input type="number" id="es-sem" value="${s.semester}"></div>
      <div class="form-group"><label>Credits</label><input type="number" id="es-credits" value="${s.credits}"></div>
    </div>
    <div class="modal-footer">
      <button class="btn outline" onclick="closeModal()">Cancel</button>
      <button class="btn primary" onclick="submitEditSubject('${subId}')">Update</button>
    </div>
  `);
}

async function submitEditSubject(subId) {
  const code = document.getElementById('es-code').value.trim();
  const name = document.getElementById('es-name').value.trim();
  const branch = document.getElementById('es-branch').value;
  const semester = parseInt(document.getElementById('es-sem').value);
  const credits = parseInt(document.getElementById('es-credits').value);

  try {
    await API.addSubject({ code, name, branch, semester, credits });
    closeModal();
    await renderSubjectsTable();
    toast('Subject updated', 'success');
  } catch (e) {
    toast(e.message, 'error');
  }
}

// ==========================================
// CO-PO ATTAINMENT MATRIX
// ==========================================
async function renderCOPO() {
  const sel = document.getElementById('copo-subject');
  if (!sel.options.length) {
    const subjects = await API.getSubjects();
    sel.innerHTML = subjects.map(s => `<option value="${s.code}">${s.code} — ${s.name}</option>`).join('');
  }

  const code = sel.value;
  const data = await API.getCOPO(code);
  const tbody = document.getElementById('copo-tbody');

  if (!data || !data.length || !data[0].mappings) {
    tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted">No CO-PO matrix defined for this subject yet.</td></tr>';
    return;
  }

  tbody.innerHTML = data[0].mappings.map(m => `
    <tr>
      <td><strong>${m.co_code}</strong>: ${m.description}</td>
      <td><span class="copo-cell c${m.po1}">${m.po1}</span></td>
      <td><span class="copo-cell c${m.po2}">${m.po2}</span></td>
      <td><span class="copo-cell c${m.po3}">${m.po3}</span></td>
      <td><span class="copo-cell c${m.po4}">${m.po4}</span></td>
      <td><span class="copo-cell c${m.po5}">${m.po5}</span></td>
      <td><span class="copo-cell c${m.po6}">${m.po6}</span></td>
      <td><strong style="color:var(--primary2)">${m.average}</strong></td>
    </tr>
  `).join('');
}

// ==========================================
// REPORTS & AUDITS
// ==========================================
async function renderReports() {
  const [subjects, analytics] = await Promise.all([
    API.getSubjects(),
    API.getAnalyticsOverview()
  ]);

  const sel = document.getElementById('rpt-subject');
  if (sel && !sel.options.length) {
    sel.innerHTML = subjects.map(s => `<option value="${s.id}">${s.code} — ${s.name}</option>`).join('');
  }

  // Pass Fail Chart
  destroyChart('chart-passfail');
  charts['chart-passfail'] = new Chart(document.getElementById('chart-passfail'), {
    type: 'pie',
    data: {
      labels: ['Pass', 'Fail'],
      datasets: [{
        data: [analytics.pass_fail.passed, analytics.pass_fail.failed],
        backgroundColor: ['#22c55e', '#ef4444'],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#94a3b8' } } }
    }
  });

  // Average Marks Chart
  destroyChart('chart-subavg');
  charts['chart-subavg'] = new Chart(document.getElementById('chart-subavg'), {
    type: 'bar',
    data: {
      labels: analytics.subject_stats.map(s => s.code),
      datasets: [{
        label: 'Average Score (/40)',
        data: analytics.subject_stats.map(s => s.avg_marks),
        backgroundColor: 'rgba(139, 92, 246, 0.7)',
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { beginAtZero: true, max: 40, grid: { color: 'rgba(51,65,85,.3)' }, ticks: { color: '#94a3b8' } },
        x: { grid: { display: false }, ticks: { color: '#94a3b8' } }
      },
      plugins: { legend: { display: false } }
    }
  });
}

async function generatePDF() {
  const subId = document.getElementById('rpt-subject').value;
  const res = await API.getSubjectStudents(subId);
  if (!res.success) return;

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const sub = res.subject;

  doc.setFontSize(16);
  doc.setTextColor(99, 102, 241);
  doc.text('OUTR — Academic Assessment & Result Report', 14, 18);

  doc.setFontSize(10);
  doc.setTextColor(50, 50, 50);
  doc.text(`Course: ${sub.code} — ${sub.name} (Department: ${sub.branch} | Semester: ${sub.semester})`, 14, 26);
  doc.text(`Grading Scale: 40 Marks Total (MidSem: 20, Assign: 10, Quiz: 5, Attend: 5)`, 14, 32);
  doc.text(`Generated Date: ${new Date().toLocaleDateString()}`, 14, 38);

  const tableRows = res.students.map(s => [
    s.registration_number,
    s.name,
    s.mid_sem.toFixed(1),
    s.assignment.toFixed(1),
    s.quiz.toFixed(1),
    s.attendance.toFixed(1),
    s.total.toFixed(1),
    s.grade,
    s.gpa.toFixed(1),
    s.grade === 'F' ? 'FAIL' : 'PASS'
  ]);

  doc.autoTable({
    startY: 44,
    head: [['Roll No', 'Name', 'Mid /20', 'Assign /10', 'Quiz /5', 'Attend /5', 'Total /40', 'Grade', 'GPA', 'Result']],
    body: tableRows,
    theme: 'grid',
    headStyles: { fillColor: [99, 102, 241], textColor: [255, 255, 255] },
    styles: { fontSize: 8, cellPadding: 3 }
  });

  doc.save(`Assessment_Report_${sub.code}.pdf`);
  toast('Academic Audit PDF report generated and downloaded.', 'success');
}

async function exportReportCSV() {
  const subId = document.getElementById('rpt-subject').value;
  const res = await API.getSubjectStudents(subId);
  if (!res.success) return;

  let csv = 'Registration Number,Student Name,Mid Sem (20),Assignment (10),Quiz (5),Attendance (5),Total (40),Grade,GPA,Result\n';
  res.students.forEach(s => {
    csv += `"${s.registration_number}","${s.name}",${s.mid_sem},${s.assignment},${s.quiz},${s.attendance},${s.total},"${s.grade}",${s.gpa},"${s.grade==='F'?'FAIL':'PASS'}"\n`;
  });

  downloadBlob(csv, `marks_export_${res.subject.code}.csv`, 'text/csv');
  toast('CSV export downloaded.', 'success');
}

// ==========================================
// FACULTY DASHBOARD & MARKS ENTRY
// ==========================================
async function renderFacultyDash() {
  const s = getSession();
  const subjects = await API.getFacultySubjects(s.id);
  const tbody = document.getElementById('fac-subjects-tbody');

  const totalStudents = subjects.reduce((sum, sub) => sum + sub.student_count, 0);
  const avgPass = subjects.length ? Math.round(subjects.reduce((sum, sub) => sum + sub.pass_rate, 0) / subjects.length) : 0;

  document.getElementById('fac-metrics').innerHTML = `
    <div class="metric">
      <div class="metric-label">Assigned Courses</div>
      <div class="metric-value">${subjects.length}</div>
      <div class="metric-sub">Active Semester</div>
    </div>
    <div class="metric success">
      <div class="metric-label">Enrolled Students</div>
      <div class="metric-value">${totalStudents}</div>
      <div class="metric-sub">Across all courses</div>
    </div>
    <div class="metric warning">
      <div class="metric-label">Average Pass Rate</div>
      <div class="metric-value">${avgPass}%</div>
      <div class="metric-sub">Internal assessment target</div>
    </div>
  `;

  if (!subjects.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted">No courses assigned to your profile. Please contact Admin.</td></tr>';
    return;
  }

  tbody.innerHTML = subjects.map(sub => `
    <tr>
      <td><span class="tag">${sub.code}</span></td>
      <td><strong>${sub.name}</strong></td>
      <td>${sub.branch}</td>
      <td>Sem ${sub.semester}</td>
      <td>${sub.student_count}</td>
      <td><strong>${sub.avg_marks}</strong> / 40</td>
      <td>
        <div class="flex items-center gap-2">
          <div class="mini-bar"><div class="mini-fill" style="width:${sub.pass_rate}%;background:${sub.pass_rate>=70?'var(--success)':'var(--warning)'}"></div></div>
          <span>${sub.pass_rate}%</span>
        </div>
      </td>
      <td>
        <button class="btn sm primary" onclick="startEnteringMarks('${sub.id}')">Enter Marks &rarr;</button>
      </td>
    </tr>
  `).join('');
}

function startEnteringMarks(subId) {
  switchPage('marks-entry').then(() => {
    const sel = document.getElementById('upload-subject');
    if (sel) {
      sel.value = subId;
      loadMarksEntry();
    }
  });
}

async function initMarksEntry() {
  const s = getSession();
  const sel = document.getElementById('upload-subject');
  const subjects = (s.role === 'faculty') 
    ? await API.getFacultySubjects(s.id) 
    : await API.getSubjects();

  sel.innerHTML = subjects.map(sub => `<option value="${sub.id}">${sub.code} — ${sub.name}</option>`).join('');
  await loadMarksEntry();
}

async function loadMarksEntry() {
  const subId = document.getElementById('upload-subject').value;
  if (!subId) return;

  const res = await API.getSubjectStudents(subId);
  const tbody = document.getElementById('marks-entry-tbody');

  if (!res.success || !res.students.length) {
    tbody.innerHTML = '<tr><td colspan="9" class="text-center text-muted">No enrolled students found for this branch/subject.</td></tr>';
    return;
  }

  tbody.innerHTML = res.students.map(st => `
    <tr data-sid="${st.student_id}">
      <td><span class="tag">${st.registration_number}</span></td>
      <td><strong>${st.name}</strong></td>
      <td><input type="number" step="0.5" class="mk-mid" value="${st.mid_sem}" min="0" max="20" style="width:65px" oninput="updateRowCalc(this)"></td>
      <td><input type="number" step="0.5" class="mk-assign" value="${st.assignment}" min="0" max="10" style="width:65px" oninput="updateRowCalc(this)"></td>
      <td><input type="number" step="0.5" class="mk-quiz" value="${st.quiz}" min="0" max="5" style="width:60px" oninput="updateRowCalc(this)"></td>
      <td><input type="number" step="0.5" class="mk-attend" value="${st.attendance}" min="0" max="5" style="width:60px" oninput="updateRowCalc(this)"></td>
      <td class="mk-total"><strong>${st.total}</strong></td>
      <td class="mk-grade"><span class="badge ${st.grade==='F'?'fail':(st.gpa>=8?'pass':'info')}">${st.grade}</span></td>
      <td class="mk-gpa">${st.gpa}</td>
    </tr>
  `).join('');
}

function calculateGradeLocal(total) {
  if (total >= 36) return { grade: 'O', gpa: 10.0 };
  if (total >= 32) return { grade: 'A+', gpa: 9.0 };
  if (total >= 28) return { grade: 'A', gpa: 8.0 };
  if (total >= 24) return { grade: 'B+', gpa: 7.0 };
  if (total >= 20) return { grade: 'B', gpa: 6.0 };
  if (total >= 16) return { grade: 'C', gpa: 5.0 };
  return { grade: 'F', gpa: 0.0 };
}

function updateRowCalc(inputEl) {
  const row = inputEl.closest('tr');
  const mid = Math.min(20, Math.max(0, parseFloat(row.querySelector('.mk-mid').value) || 0));
  const assign = Math.min(10, Math.max(0, parseFloat(row.querySelector('.mk-assign').value) || 0));
  const quiz = Math.min(5, Math.max(0, parseFloat(row.querySelector('.mk-quiz').value) || 0));
  const attend = Math.min(5, Math.max(0, parseFloat(row.querySelector('.mk-attend').value) || 0));

  const total = Math.round((mid + assign + quiz + attend) * 100) / 100;
  const g = calculateGradeLocal(total);

  row.querySelector('.mk-total').innerHTML = `<strong>${total.toFixed(1)}</strong>`;
  row.querySelector('.mk-grade').innerHTML = `<span class="badge ${g.grade==='F'?'fail':(g.gpa>=8?'pass':'info')}">${g.grade}</span>`;
  row.querySelector('.mk-gpa').textContent = g.gpa.toFixed(1);
}

async function saveAllMarks(publish = false) {
  const subId = document.getElementById('upload-subject').value;
  const rows = document.querySelectorAll('#marks-entry-tbody tr[data-sid]');
  const entries = [];

  rows.forEach(r => {
    entries.push({
      student_id: r.dataset.sid,
      mid_sem: parseFloat(r.querySelector('.mk-mid').value) || 0,
      assignment: parseFloat(r.querySelector('.mk-assign').value) || 0,
      quiz: parseFloat(r.querySelector('.mk-quiz').value) || 0,
      attendance: parseFloat(r.querySelector('.mk-attend').value) || 0
    });
  });

  try {
    const res = await API.saveMarks(subId, entries, publish);
    toast(res.message, 'success');
  } catch (err) {
    toast(err.message, 'error');
  }
}

function publishMarks() {
  if (confirm('Are you sure you want to publish these marks? Students will receive notifications.')) {
    saveAllMarks(true);
  }
}

// File Upload Handler (Excel/CSV)
async function handleFileUpload(input) {
  if (input.files && input.files[0]) {
    await processUploadedFile(input.files[0]);
  }
}

async function handleFileDrop(e) {
  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
    await processUploadedFile(e.dataTransfer.files[0]);
  }
}

async function processUploadedFile(file) {
  const subId = document.getElementById('upload-subject').value;
  const resultDiv = document.getElementById('upload-result');
  resultDiv.classList.remove('hidden');
  resultDiv.innerHTML = `<div class="notice info">Processing ${file.name} through assessment engine...</div>`;

  const formData = new FormData();
  formData.append('file', file);
  formData.append('subjectId', subId);

  const s = getSession();
  if (s) formData.append('facultyId', s.id);

  try {
    const res = await API.uploadExcelFile(formData);
    if (res.success) {
      resultDiv.innerHTML = `
        <div class="notice success">
          <strong>✅ Upload Processed Successfully!</strong><br>
          &bull; <b>${res.records_processed}</b> assessment marks recorded/updated.<br>
          &bull; <b>${res.new_accounts_created}</b> new student user accounts automatically created with Registration Number as default password.<br>
          &bull; Grade, GPA, SGPA/CGPA recalculated.
        </div>
      `;
      toast(`Successfully processed ${res.records_processed} records`, 'success');
      await loadMarksEntry();
    } else {
      resultDiv.innerHTML = `<div class="notice danger">❌ Error: ${res.error}</div>`;
      toast(res.error, 'error');
    }
  } catch (err) {
    resultDiv.innerHTML = `<div class="notice danger">❌ Server Error: ${err.message}</div>`;
    toast(err.message, 'error');
  }
}

// Faculty Analytics
async function initFacultyAnalytics() {
  const s = getSession();
  const sel = document.getElementById('fac-analytics-sub');
  const subjects = (s.role === 'faculty') 
    ? await API.getFacultySubjects(s.id) 
    : await API.getSubjects();

  sel.innerHTML = subjects.map(sub => `<option value="${sub.id}">${sub.code} — ${sub.name}</option>`).join('');
  await renderFacultyAnalytics();
}

async function renderFacultyAnalytics() {
  const subId = document.getElementById('fac-analytics-sub').value;
  if (!subId) return;

  const res = await API.getSubjectStudents(subId);
  if (!res.success) return;

  const marks = res.students;
  const gd = { 'O': 0, 'A+': 0, 'A': 0, 'B+': 0, 'B': 0, 'C': 0, 'F': 0 };
  marks.forEach(m => {
    if (gd[m.grade] !== undefined) gd[m.grade]++;
  });

  destroyChart('chart-fac-grade');
  charts['chart-fac-grade'] = new Chart(document.getElementById('chart-fac-grade'), {
    type: 'doughnut',
    data: {
      labels: Object.keys(gd),
      datasets: [{
        data: Object.values(gd),
        backgroundColor: ['#16a34a', '#22c55e', '#3b82f6', '#8b5cf6', '#f59e0b', '#f97316', '#ef4444'],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'right', labels: { color: '#94a3b8' } } }
    }
  });

  const count = marks.length || 1;
  const avgMid = (marks.reduce((sum, m) => sum + m.mid_sem, 0) / count).toFixed(1);
  const avgAssign = (marks.reduce((sum, m) => sum + m.assignment, 0) / count).toFixed(1);
  const avgQuiz = (marks.reduce((sum, m) => sum + m.quiz, 0) / count).toFixed(1);
  const avgAttend = (marks.reduce((sum, m) => sum + m.attendance, 0) / count).toFixed(1);

  destroyChart('chart-fac-breakdown');
  charts['chart-fac-breakdown'] = new Chart(document.getElementById('chart-fac-breakdown'), {
    type: 'bar',
    data: {
      labels: ['Mid-Sem /20', 'Assignment /10', 'Quiz /5', 'Attendance /5'],
      datasets: [{
        label: 'Component Average Score',
        data: [avgMid, avgAssign, avgQuiz, avgAttend],
        backgroundColor: ['rgba(99, 102, 241, 0.7)', 'rgba(139, 92, 246, 0.7)', 'rgba(59, 130, 246, 0.7)', 'rgba(34, 197, 94, 0.7)'],
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y',
      scales: {
        x: { beginAtZero: true, grid: { color: 'rgba(51,65,85,.3)' }, ticks: { color: '#94a3b8' } },
        y: { grid: { display: false }, ticks: { color: '#94a3b8' } }
      },
      plugins: { legend: { display: false } }
    }
  });
}

// ==========================================
// STUDENT DASHBOARD
// ==========================================
async function renderStudentDash() {
  const s = getSession();
  const regNo = s.username; // For student, username is Registration Number

  const res = await API.getStudentResults(regNo);
  if (!res.success) {
    toast('Results not found', 'error');
    return;
  }

  document.getElementById('stu-cgpa').textContent = res.cgpa.toFixed(2);
  document.getElementById('stu-name-display').textContent = s.name;
  document.getElementById('stu-roll-display').textContent = `Reg No: ${res.student.registration_number}`;
  document.getElementById('stu-branch-display').textContent = `${res.student.branch} Department | Semester ${res.student.semester}`;

  const passPct = res.total_subjects ? Math.round((res.passed_subjects / res.total_subjects) * 100) : 0;
  document.getElementById('stu-metrics').innerHTML = `
    <div class="metric">
      <div class="metric-label">Enrolled Courses</div>
      <div class="metric-value">${res.total_subjects}</div>
      <div class="metric-sub">${res.total_credits} Total Credits</div>
    </div>
    <div class="metric success">
      <div class="metric-label">Passed Courses</div>
      <div class="metric-value">${res.passed_subjects} / ${res.total_subjects}</div>
      <div class="metric-sub">${passPct}% Success Rate</div>
    </div>
    <div class="metric">
      <div class="metric-label">Semester SGPA</div>
      <div class="metric-value" style="color:var(--primary2)">${res.sgpa.toFixed(2)}</div>
      <div class="metric-sub">Semester ${res.student.semester}</div>
    </div>
    <div class="metric success">
      <div class="metric-label">Cumulative CGPA</div>
      <div class="metric-value">${res.cgpa.toFixed(2)}</div>
      <div class="metric-sub">Scale: 10.0</div>
    </div>
  `;

  const tbody = document.getElementById('stu-results-tbody');
  if (!res.marks.length) {
    tbody.innerHTML = '<tr><td colspan="9" class="text-center text-muted">No published examination results available.</td></tr>';
    return;
  }

  tbody.innerHTML = res.marks.map(m => `
    <tr>
      <td><strong>${m.subject_code}</strong>: ${m.subject_name}</td>
      <td>${parseFloat(m.mid_sem).toFixed(1)}</td>
      <td>${parseFloat(m.assignment).toFixed(1)}</td>
      <td>${parseFloat(m.quiz).toFixed(1)}</td>
      <td>${parseFloat(m.attendance).toFixed(1)}</td>
      <td><strong>${parseFloat(m.total).toFixed(1)}</strong></td>
      <td><span class="badge ${m.grade==='F'?'fail':(m.gpa>=8?'pass':'info')}">${m.grade}</span></td>
      <td><strong>${parseFloat(m.gpa).toFixed(1)}</strong></td>
      <td><span class="badge ${m.grade==='F'?'fail':'pass'}">${m.grade==='F'?'FAIL':'PASS'}</span></td>
    </tr>
  `).join('');
}

// ==========================================
// OFFICIAL OUTR ONLINE RESULTS SHEET GENERATORS
// ==========================================
function buildMarkSheetHtml(res) {
  const stu = res.student;
  const branchMap = {
    'CS': 'COMPUTER SCIENCE & ENGINEERING',
    'CSE': 'COMPUTER SCIENCE & ENGINEERING',
    'ECE': 'ELECTRONICS & COMMUNICATION ENGINEERING',
    'MECH': 'MECHANICAL ENGINEERING',
    'CIVIL': 'CIVIL ENGINEERING',
    'EE': 'ELECTRICAL ENGINEERING',
    'IT': 'INFORMATION TECHNOLOGY'
  };
  const branchDisplay = branchMap[stu.branch?.toUpperCase()] || stu.branch?.toUpperCase() || 'COMPUTER SCIENCE & ENGINEERING';

  const semNum = stu.semester || 6;
  const ordinals = { 1: '1st', 2: '2nd', 3: '3rd', 4: '4th', 5: '5th', 6: '6th', 7: '7th', 8: '8th' };
  const semOrd = ordinals[semNum] || `${semNum}th`;
  const semType = (semNum % 2 === 0) ? 'Even' : 'Odd';
  const examName = `${semOrd} Sem B-Tech Regular ${semType} 2025 2026`;

  const totalCredits = res.total_credits ? (Number.isInteger(res.total_credits) ? res.total_credits : res.total_credits.toFixed(1)) : '22';
  const sgpaDisplay = (typeof res.sgpa === 'number') ? res.sgpa.toFixed(2) : (res.sgpa || '0.00');

  const rows = res.marks.map((m, idx) => `
    <tr>
      <td>${idx + 1}</td>
      <td>${m.subject_code}</td>
      <td class="col-sub">${m.subject_name.toUpperCase()}</td>
      <td>${parseFloat(m.credits || 3).toFixed(1)}</td>
      <td><strong>${m.grade}</strong></td>
    </tr>
  `).join('');

  return `
    <div class="outr-results-sheet" id="official-results-sheet-content">
      <img src="images/marksheet_header.png" alt="Odisha University of Technology and Research" class="sheet-header-img">
      <div class="sheet-banner-navy">ONLINE RESULTS SHEET</div>
      <table class="sheet-meta-table">
        <tbody>
          <tr>
            <td class="lbl">Examination:</td>
            <td class="val">${examName}</td>
          </tr>
          <tr>
            <td class="lbl">Course:</td>
            <td class="val">B.Tech</td>
          </tr>
          <tr>
            <td class="lbl">Branch:</td>
            <td class="val">${branchDisplay}</td>
          </tr>
          <tr>
            <td class="lbl">Registration No:</td>
            <td class="val">${stu.registration_number}</td>
          </tr>
          <tr>
            <td class="lbl">Student name:</td>
            <td class="val">${stu.name.toUpperCase()}</td>
          </tr>
        </tbody>
      </table>

      <table class="sheet-table">
        <thead>
          <tr>
            <th style="width:55px;">Sl. No.</th>
            <th style="width:115px;">Subject Code</th>
            <th class="col-sub">Subject</th>
            <th style="width:70px;">Credit</th>
            <th style="width:70px;">Grade</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
          <tr class="sheet-total-row">
            <td colspan="3" style="text-align:right;padding-right:16px;">Total Credits:</td>
            <td style="text-align:center;">${totalCredits}</td>
            <td></td>
          </tr>
        </tbody>
      </table>

      <div class="sheet-results-footer">
        <div>Published On: 12/06/2026</div>
        <div class="sheet-sgpa-badge">SGPA: ${sgpaDisplay}</div>
      </div>

      <ol class="sheet-instructions-list">
        <li>The result is provisional.</li>
        <li>The student interested for retotaling / rechecking are to apply through online mode on or before 22.06.2026 by paying Rs. 500 per answer script to the university.</li>
        <li>Student interested for retotaling / rechecking along with photocopy of answer script need to apply through online mode on or before 22.06.2026 by paying Rs 1000 per answer script to the university.</li>
        <li>The SGPA shown for the subjects displayed on this page.</li>
      </ol>

      <div class="sheet-sig-box">
        <img src="images/signature.png" alt="Signature" class="sheet-sig-img">
        <div class="sheet-sig-title">Controller of Examinations</div>
      </div>
    </div>
  `;
}

async function viewOfficialMarkSheet(rollNo) {
  const s = getSession();
  const targetRoll = rollNo || (s ? s.username : null);
  if (!targetRoll) {
    toast('Registration number required to view mark sheet', 'error');
    return;
  }

  try {
    const res = await API.getStudentResults(targetRoll);
    if (!res.success) {
      toast(res.error || 'Results not found for ' + targetRoll, 'error');
      return;
    }

    const sheetHtml = buildMarkSheetHtml(res);
    const modalHtml = `
      <div class="modal-sheet-actions no-print">
        <div style="font-weight:700;color:var(--primary);font-size:0.95rem;display:flex;align-items:center;gap:6px">
          <span>🎓</span> OUTR Online Results Sheet &mdash; ${res.student.registration_number}
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn sm primary" onclick="window.print()">🖨️ Print / Save as PDF</button>
          <button class="btn sm outline" onclick="downloadMarkSheet('${targetRoll}')">📥 Download PDF</button>
          <button class="btn sm outline" onclick="closeModal()">✖ Close</button>
        </div>
      </div>
      ${sheetHtml}
    `;

    showModal(modalHtml, 'modal-sheet');
  } catch (err) {
    toast('Failed to load mark sheet: ' + err.message, 'error');
  }
}

async function downloadMarkSheet(rollNo) {
  const s = getSession();
  const targetRoll = rollNo || (s ? s.username : null);
  if (!targetRoll) {
    toast('Registration number required', 'error');
    return;
  }

  try {
    const res = await API.getStudentResults(targetRoll);
    if (!res.success) {
      toast('Results not found for ' + targetRoll, 'error');
      return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const stu = res.student;
    const branchMap = {
      'CS': 'COMPUTER SCIENCE & ENGINEERING',
      'CSE': 'COMPUTER SCIENCE & ENGINEERING',
      'ECE': 'ELECTRONICS & COMMUNICATION ENGINEERING',
      'MECH': 'MECHANICAL ENGINEERING',
      'CIVIL': 'CIVIL ENGINEERING',
      'EE': 'ELECTRICAL ENGINEERING',
      'IT': 'INFORMATION TECHNOLOGY'
    };
    const branchDisplay = branchMap[stu.branch?.toUpperCase()] || stu.branch?.toUpperCase() || 'COMPUTER SCIENCE & ENGINEERING';
    const semNum = stu.semester || 6;
    const ordinals = { 1: '1st', 2: '2nd', 3: '3rd', 4: '4th', 5: '5th', 6: '6th', 7: '7th', 8: '8th' };
    const semOrd = ordinals[semNum] || `${semNum}th`;
    const semType = (semNum % 2 === 0) ? 'Even' : 'Odd';
    const examName = `${semOrd} Sem B-Tech Regular ${semType} 2025 2026`;
    const totalCredits = res.total_credits ? (Number.isInteger(res.total_credits) ? res.total_credits : res.total_credits.toFixed(1)) : '22';
    const sgpaDisplay = (typeof res.sgpa === 'number') ? res.sgpa.toFixed(2) : (res.sgpa || '0.00');

    // 1. Outer Black Border (A4 is 210 x 297mm)
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.5);
    doc.rect(10, 10, 190, 277);

    // 2. University Header Image
    if (typeof MARKSHEET_HEADER_B64 !== 'undefined') {
      doc.addImage(MARKSHEET_HEADER_B64, 'PNG', 16, 14, 178, 24);
    }

    // 3. ONLINE RESULTS SHEET Navy Banner
    doc.setFillColor(29, 61, 112); // #1d3d70
    doc.rect(14, 40, 182, 7.5, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('ONLINE RESULTS SHEET', 105, 45.2, { align: 'center' });

    // 4. Student Metadata Section
    doc.setFontSize(9);
    const startMetaY = 53;
    const lineH = 5.2;

    const metaFields = [
      ['Examination:', examName, [0, 0, 0]],
      ['Course:', 'B.Tech', [29, 61, 112]],
      ['Branch:', branchDisplay, [29, 61, 112]],
      ['Registration No:', String(stu.registration_number), [29, 61, 112]],
      ['Student name:', stu.name.toUpperCase(), [29, 61, 112]]
    ];

    metaFields.forEach((item, i) => {
      const y = startMetaY + (i * lineH);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(50, 50, 50);
      doc.text(item[0], 16, y);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(item[2][0], item[2][1], item[2][2]);
      doc.text(item[1], 52, y);
    });

    // 5. Subjects Table
    const tableRows = res.marks.map((m, i) => [
      i + 1,
      m.subject_code,
      m.subject_name.toUpperCase(),
      parseFloat(m.credits || 3).toFixed(1),
      m.grade
    ]);

    // Total credits footer row in table
    tableRows.push([
      { content: 'Total Credits:', colSpan: 3, styles: { halign: 'right', fontStyle: 'bold', fillColor: [241, 245, 249] } },
      { content: String(totalCredits), styles: { halign: 'center', fontStyle: 'bold', fillColor: [241, 245, 249] } },
      { content: '', styles: { fillColor: [241, 245, 249] } }
    ]);

    doc.autoTable({
      startY: 81,
      margin: { left: 14, right: 14 },
      head: [['Sl. No.', 'Subject Code', 'Subject', 'Credit', 'Grade']],
      body: tableRows,
      theme: 'grid',
      headStyles: {
        fillColor: [29, 61, 112],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 9,
        halign: 'center',
        cellPadding: 2.2
      },
      styles: {
        fontSize: 8.5,
        cellPadding: 2,
        lineColor: [203, 213, 225],
        lineWidth: 0.25,
        textColor: [15, 23, 42]
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 16 },
        1: { halign: 'center', cellWidth: 32 },
        2: { halign: 'left', cellPadding: 2.5 },
        3: { halign: 'center', cellWidth: 20 },
        4: { halign: 'center', cellWidth: 20, fontStyle: 'bold' }
      }
    });

    // 6. Results Footer
    const finalY = doc.lastAutoTable.finalY + 3;
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.4);
    doc.line(14, finalY, 196, finalY);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(0, 0, 0);
    doc.text('Published On: 12/06/2026', 16, finalY + 5.5);
    doc.text(`SGPA: ${sgpaDisplay}`, 194, finalY + 5.5, { align: 'right' });

    doc.line(14, finalY + 7.5, 196, finalY + 7.5);

    // 7. Numbered Instructions
    const instY = finalY + 12;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(30, 41, 59);

    const instructions = [
      '1.  The result is provisional.',
      '2.  The student interested for retotaling / rechecking are to apply through online mode on or before 22.06.2026 by paying Rs. 500 per answer script to the university.',
      '3.  Student interested for retotaling / rechecking along with photocopy of answer script need to apply through online mode on or before 22.06.2026 by paying Rs 1000 per answer script to the university.',
      '4.  The SGPA shown for the subjects displayed on this page.'
    ];

    let currY = instY;
    instructions.forEach(line => {
      const splitText = doc.splitTextToSize(line, 180);
      doc.text(splitText, 16, currY);
      currY += (splitText.length * 3.8);
    });

    // 8. Controller of Examinations Signature
    const sigY = currY + 4;
    if (typeof SIGNATURE_B64 !== 'undefined') {
      doc.addImage(SIGNATURE_B64, 'PNG', 16, sigY, 24, 14);
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.text('Controller of Examinations', 16, sigY + 19);

    doc.save(`OUTR_Online_Result_Sheet_${stu.registration_number}.pdf`);
    toast('Official OUTR Result Sheet PDF downloaded.', 'success');
  } catch (e) {
    console.error(e);
    toast('Failed to download PDF: ' + e.message, 'error');
  }
}


// Search
async function initSearch() {
  const sel = document.getElementById('search-subject');
  if (sel.options.length <= 1) {
    const subs = await API.getSubjects();
    sel.innerHTML = '<option value="">All Subjects</option>' + 
      subs.map(s => `<option value="${s.id}">${s.code} — ${s.name}</option>`).join('');
  }
}

async function doSearch() {
  const roll = document.getElementById('search-roll').value.trim();
  const resultDiv = document.getElementById('search-results');

  if (!roll) {
    toast('Please enter a registration / roll number', 'error');
    return;
  }

  try {
    const res = await API.getStudentResults(roll);
    if (!res.success) {
      resultDiv.innerHTML = '<div class="notice danger">Student record not found.</div>';
      return;
    }

    const stu = res.student;
    resultDiv.innerHTML = `
      <div class="notice success" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
        <div>
          <b style="font-size:1.05rem">${stu.name}</b> (${stu.registration_number}) &mdash; Branch: ${stu.branch} | Sem ${stu.semester}
          <div style="font-size:0.85rem;color:var(--text2);margin-top:2px">
            <strong>CGPA: ${res.cgpa.toFixed(2)}</strong> | <strong>SGPA: ${(typeof res.sgpa === 'number') ? res.sgpa.toFixed(2) : res.sgpa}</strong>
          </div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn sm primary" onclick="viewOfficialMarkSheet('${stu.registration_number}')">📄 View Online Results Sheet</button>
          <button class="btn sm outline" onclick="downloadMarkSheet('${stu.registration_number}')">📥 Download PDF</button>
        </div>
      </div>
      <div class="table-wrap" style="margin-top:10px">
        <table>
          <thead>
            <tr>
              <th>Course</th><th>Mid /20</th><th>Assign /10</th><th>Quiz /5</th><th>Attend /5</th><th>Total /40</th><th>Grade</th><th>GPA</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${res.marks.map(m => `
              <tr>
                <td><b>${m.subject_code}</b>: ${m.subject_name}</td>
                <td>${parseFloat(m.mid_sem).toFixed(1)}</td>
                <td>${parseFloat(m.assignment).toFixed(1)}</td>
                <td>${parseFloat(m.quiz).toFixed(1)}</td>
                <td>${parseFloat(m.attendance).toFixed(1)}</td>
                <td><strong>${parseFloat(m.total).toFixed(1)}</strong></td>
                <td><span class="badge ${m.grade==='F'?'fail':(m.gpa>=8?'pass':'info')}">${m.grade}</span></td>
                <td>${parseFloat(m.gpa).toFixed(1)}</td>
                <td><span class="badge ${m.grade==='F'?'fail':'pass'}">${m.grade==='F'?'FAIL':'PASS'}</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch (err) {
    resultDiv.innerHTML = `<div class="notice danger">${err.message}</div>`;
  }
}

function downloadBlob(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 200);
}

// ==========================================
// INITIALIZATION
// ==========================================
window.addEventListener('DOMContentLoaded', async () => {
  const s = getSession();
  if (!s) return;

  renderNav();
  await renderNotifs();

  // Show active database engine badge
  try {
    const health = await API.getHealth();
    const badge = document.querySelector('.sem-badge');
    if (badge) {
      badge.textContent = `${health.database_driver.toUpperCase()} DB | 2024–25`;
      badge.title = health.database_target;
    }
  } catch (e) {}

  // Open first allowed page
  const allowed = NAV_CONFIG[s.role] || [];
  if (allowed.length > 0) {
    await switchPage(allowed[0].id);
  }
});
