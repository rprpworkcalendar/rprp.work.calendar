(function () {
  'use strict';

  const CONFIG = window.RP_CALENDAR_CONFIG || {};
  const API_URL = String(CONFIG.GAS_API_URL || '').trim();
  const APP_NAME = CONFIG.APP_NAME || 'ปฏิทินภาพรวมงาน';
  const ORG_NAME = CONFIG.ORG_NAME || 'องค์กร';
  const MAX_UPLOAD_MB = Number(CONFIG.MAX_UPLOAD_MB || 5);
  const APP_MODE = document.body.dataset.appMode || 'public';
  const IS_ADMIN_APP = APP_MODE === 'admin';
  const SESSION_KEY = 'rp_calendar_native_session';
  const TIMEZONE = 'Asia/Bangkok';

  const state = {
    view: getInitialView(),
    loading: true,
    error: '',
    source: isApiConfigured() ? 'google_sheet' : 'demo',
    events: [],
    logs: [],
    users: [],
    session: readSession(),
    query: '',
    status: 'ทั้งหมด',
    group: 'ทั้งหมด',
    monthDate: new Date(),
    selectedEvent: null,
    attachments: [],
    editingEvent: null,
    editingUser: null,
    userQuery: '',
    isSaving: false,
    isUploading: false,
    sidebarCollapsed: window.innerWidth < 920
  };

  const demoEvents = [
    { id:'EVT-DEMO-001', title:'ประชุมแผนกิจกรรมประจำเดือน', start_date:todayISO(), end_date:todayISO(), start_time:'09:00', end_time:'11:00', location:'ห้องประชุมอาคารอำนวยการ', format_type:'ในพื้นที่', description:'ประชุมติดตามแผนงานและมอบหมายผู้รับผิดชอบรายกิจกรรม', status:'ยืนยัน', coordinator:'เจ้าหน้าที่อำนวยการ', work_group:'อำนวยการ', created_by:'demo', created_at:new Date().toISOString(), updated_at:new Date().toISOString(), deleted_at:'' },
    { id:'EVT-DEMO-002', title:'กิจกรรมเรียนรู้พรรณไม้สำหรับเยาวชน', start_date:addDaysISO(3), end_date:addDaysISO(3), start_time:'10:00', end_time:'15:00', location:'เรือนกล้วยไม้', format_type:'ในพื้นที่', description:'กิจกรรมฐานเรียนรู้และการสื่อความหมายพรรณไม้', status:'ยืนยัน', coordinator:'เจ้าหน้าที่วิชาการ', work_group:'วิชาการและการเรียนรู้', created_by:'demo', created_at:new Date().toISOString(), updated_at:new Date().toISOString(), deleted_at:'' },
    { id:'EVT-DEMO-003', title:'รายงานสรุปผลการประชาสัมพันธ์', start_date:addDaysISO(9), end_date:addDaysISO(9), start_time:'13:30', end_time:'16:00', location:'ออนไลน์', format_type:'ออนไลน์', description:'จัดทำและนำเสนอรายงานผลการเข้าถึงสื่อประชาสัมพันธ์', status:'ร่าง', coordinator:'เจ้าหน้าที่สื่อสารองค์กร', work_group:'การตลาดและประชาสัมพันธ์', created_by:'demo', created_at:new Date().toISOString(), updated_at:new Date().toISOString(), deleted_at:'' },
    { id:'EVT-DEMO-004', title:'ตรวจพื้นที่ก่อนจัดนิทรรศการ', start_date:addDaysISO(-6), end_date:addDaysISO(-6), start_time:'08:30', end_time:'12:00', location:'ลานกิจกรรมกลางแจ้ง', format_type:'ในพื้นที่', description:'ตรวจความพร้อมพื้นที่ ไฟฟ้า ป้ายทาง และจุดบริการผู้เข้าชม', status:'เสร็จสิ้น', coordinator:'หัวหน้างานพื้นที่', work_group:'ดูแลรักษาสวนและโครงสร้างพื้นฐาน', created_by:'demo', created_at:new Date().toISOString(), updated_at:new Date().toISOString(), deleted_at:'' },
    { id:'EVT-DEMO-005', title:'กิจกรรมที่เลื่อนออกไป', start_date:addDaysISO(12), end_date:addDaysISO(12), start_time:'09:00', end_time:'12:00', location:'ห้องอบรม', format_type:'ในพื้นที่', description:'รายการตัวอย่างสถานะยกเลิก', status:'ยกเลิก', coordinator:'เจ้าหน้าที่ทดสอบ', work_group:'อำนวยการ', created_by:'demo', created_at:new Date().toISOString(), updated_at:new Date().toISOString(), deleted_at:'' }
  ];

  const demoLogs = [
    { log_id:'LOG-DEMO-001', datetime:new Date().toISOString(), action:'เปิดระบบ', user_id:'demo', user_name:'ระบบตัวอย่าง', detail:'โหลดข้อมูลตัวอย่างเนื่องจากยังไม่ได้ตั้งค่า Apps Script URL', event_id:'', client:'demo' }
  ];

  const demoUsers = [
    { user_id:'USR-ADMIN-001', name:'ผู้ดูแลระบบ', email:'admin@example.com', role:'admin', work_group:'อำนวยการ', is_active:'TRUE', created_at:new Date().toISOString() },
    { user_id:'USR-STAFF-001', name:'เจ้าหน้าที่ทดสอบ', email:'staff@example.com', role:'staff', work_group:'วิชาการและการเรียนรู้', is_active:'TRUE', created_at:new Date().toISOString() }
  ];

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    render();
    bindEvents();
    if (IS_ADMIN_APP && !state.session) return;
    await loadData();
  }

  function bindEvents() {
    document.body.addEventListener('click', async (event) => {
      const target = event.target.closest('[data-action]');
      if (!target) return;
      const action = target.dataset.action;
      const id = target.dataset.id || '';

      if (action === 'toggle-sidebar') { state.sidebarCollapsed = !state.sidebarCollapsed; render(); return; }
      if (action === 'view') { setView(target.dataset.view); return; }
      if (action === 'go-admin') { window.location.href = './admin.html'; return; }
      if (action === 'go-public') { window.location.href = './index.html'; return; }
      if (action === 'refresh') { await loadData(); return; }
      if (action === 'login-view') {
        if (IS_ADMIN_APP) { state.view = 'login'; render(); }
        else { window.location.href = './admin.html'; }
        return;
      }
      if (action === 'logout') { logout(); return; }
      if (action === 'open-event') { await openEvent(id); return; }
      if (action === 'close-modal') { closeModal(); return; }
      if (action === 'new-event') { state.editingEvent = null; renderAdminForm(); return; }
      if (action === 'edit-event') { beginEditEvent(id); return; }
      if (action === 'delete-event') { await deleteEvent(id); return; }
      if (action === 'new-user') { state.editingUser = null; renderUserForm(); return; }
      if (action === 'edit-user') { beginEditUser(id); return; }
      if (action === 'delete-user') { await deleteUser(id); return; }
      if (action === 'prev-month') { state.monthDate = addMonths(state.monthDate, -1); renderMain(); return; }
      if (action === 'next-month') { state.monthDate = addMonths(state.monthDate, 1); renderMain(); return; }
      if (action === 'today-month') { state.monthDate = new Date(); renderMain(); return; }
      if (action === 'delete-attachment') { await deleteAttachment(id); return; }
    });

    document.body.addEventListener('submit', async (event) => {
      const form = event.target.closest('form[data-form]');
      if (!form) return;
      event.preventDefault();
      if (form.dataset.form === 'login') await handleLogin(form);
      if (form.dataset.form === 'event') await handleEventSave(form);
      if (form.dataset.form === 'user') await handleUserSave(form);
    });

    document.body.addEventListener('input', (event) => {
      if (event.target.matches('[data-filter="query"]')) { state.query = event.target.value; renderMain(); }
      if (event.target.matches('[data-filter="status"]')) { state.status = event.target.value; renderMain(); }
      if (event.target.matches('[data-filter="group"]')) { state.group = event.target.value; renderMain(); }
      if (event.target.matches('[data-filter="user-query"]')) { state.userQuery = event.target.value; renderMain(); }
    });

    document.body.addEventListener('change', async (event) => {
      if (event.target.matches('[data-upload]')) await handleFileUpload(event.target.files && event.target.files[0]);
    });
  }

  async function loadData() {
    state.loading = true;
    state.error = '';
    renderMain();
    try {
      const [eventsRes, logsRes, usersRes] = await Promise.all([
        apiGet('listEvents'),
        (IS_ADMIN_APP && state.session) ? apiPost('listLogs', {}, true).catch(() => ({ ok: true, data: [] })) : Promise.resolve({ ok: true, data: [] }),
        (IS_ADMIN_APP && isAdmin()) ? apiPost('listUsers', {}, true).catch(() => ({ ok: true, data: [] })) : Promise.resolve({ ok: true, data: [] })
      ]);
      state.events = Array.isArray(eventsRes.data) ? eventsRes.data.filter(item => !item.deleted_at) : [];
      state.logs = Array.isArray(logsRes.data) ? logsRes.data : [];
      state.users = Array.isArray(usersRes.data) ? usersRes.data : [];
      state.source = eventsRes.source || (isApiConfigured() ? 'google_sheet' : 'demo');
    } catch (err) {
      state.error = err.message || String(err);
      state.events = demoEvents;
      state.logs = demoLogs;
      state.users = demoUsers;
      state.source = 'demo';
    } finally {
      state.loading = false;
      render();
    }
  }

  function render() {
    const app = document.getElementById('app');
    if (IS_ADMIN_APP && !state.session) {
      app.innerHTML = renderOfficialLogin();
      const modalRoot = document.getElementById('modal-root');
      if (modalRoot) modalRoot.innerHTML = '';
      return;
    }

    if (!IS_ADMIN_APP) {
      app.innerHTML = `
        <div class="public-page">
          ${renderPublicHeader()}
          <main class="public-main">
            <div id="topbar"></div>
            <div id="main-content"></div>
          </main>
          ${renderPublicFooter()}
        </div>
        <div id="modal-root"></div>
      `;
      renderTopbar();
      renderMain();
      renderModal();
      return;
    }

    app.innerHTML = `
      <div class="app-shell admin-shell">
        <aside class="sidebar ${state.sidebarCollapsed ? 'collapsed' : ''}">
          <div class="brand">
            <div class="brand-mark">RP</div>
            <div>
              <h1>${escapeHTML(APP_NAME)}</h1>
              <p>${escapeHTML(ORG_NAME)}</p>
            </div>
          </div>
          <div class="actions" style="margin-bottom:12px">
            <button class="btn secondary mobile-menu" data-action="toggle-sidebar">เมนู</button>
            <span class="badge ${isApiConfigured() ? 'api' : 'demo'}">${isApiConfigured() ? 'เชื่อม Apps Script' : 'Demo Mode'}</span>
          </div>
          <nav class="nav">
            ${adminNavHTML()}
          </nav>
          <div class="sidebar-card">
            <b>สถานะเจ้าหน้าที่</b><br>
            ${escapeHTML(state.session.name)}<br><span class="small">${escapeHTML(state.session.role)}</span><br><button class="btn secondary" style="margin-top:10px" data-action="logout">ออกจากระบบ</button>
          </div>
          <div class="sidebar-card">
            <b>การใช้งาน</b><br>
            GitHub Pages ใช้แสดงผลหน้าเว็บ ส่วน Google Apps Script ใช้เป็น API เชื่อม Google Sheet และ Drive
          </div>
        </aside>
        <main class="main">
          <div id="topbar"></div>
          <div id="main-content"></div>
        </main>
      </div>
      <div id="modal-root"></div>
    `;
    renderTopbar();
    renderMain();
    renderModal();
  }



  function renderPublicHeader() {
    return `<header class="site-header">
      <div class="site-header-inner">
        <button class="brand brand-public" data-action="view" data-view="calendar" aria-label="กลับหน้าปฏิทิน">
          <img class="brand-logo-public" src="./royal-park-logo.png" alt="โลโก้อุทยานหลวงราชพฤกษ์">
          <div>
            <h1>${escapeHTML(APP_NAME)}</h1>
          </div>
        </button>
        <nav class="public-nav" aria-label="เมนูสาธารณะ">
          ${publicNavHTML()}
        </nav>
        <div class="public-header-actions">
          <button class="btn secondary" data-action="refresh">รีเฟรช</button>
          <button class="btn warning" data-action="go-admin">เข้าสู่ระบบเจ้าหน้าที่</button>
        </div>
      </div>
    </header>`;
  }

  function renderPublicFooter() {
    const year = new Date().getFullYear() + 543;
    return `<footer class="site-footer">
      <div class="site-footer-inner site-footer-minimal">
        <div class="footer-meta">© ${year} ${escapeHTML(ORG_NAME)}</div>
      </div>
    </footer>`;
  }

  function navButton(view, label, icon) {
    return `<button class="${state.view === view ? 'active' : ''}" data-action="view" data-view="${view}"><span>${icon}</span>${label}</button>`;
  }
  function publicNavHTML() {
    return [
      navButton('calendar','ปฏิทินภาพรวม','🗓️'),
      navButton('report','รายงาน','📊')
    ].join('');
  }


  function adminNavHTML() {
    const items = [
      navButton('admin','จัดการรายการ','📝'),
      navButton('calendar','ปฏิทิน','🗓️'),
      navButton('dashboard','ภาพรวม','🏠'),
      navButton('report','รายงาน','📊')
    ];
    if (isAdmin()) items.splice(1, 0, navButton('users','จัดการผู้ใช้','👥'));
    return items.join('');
  }


  function renderTopbar() {
    const titleMap = { dashboard:'สรุปภาพรวมงาน', calendar:'ปฏิทินภาพรวมงาน', admin:'จัดการรายการงาน', users:'จัดการผู้ใช้', report:'รายงานสรุป', login:'เข้าสู่ระบบ' };
    const topbar = document.getElementById('topbar');
    if (!topbar) return;
    if (!IS_ADMIN_APP) {
      topbar.innerHTML = `<div class="public-hero public-hero-clean">
        <div>
          <h2>${titleMap[state.view] || 'ปฏิทินภาพรวมงาน'}</h2>
        </div>
      </div>`;
      return;
    }
    topbar.innerHTML = `
      <div class="topbar">
        <div>
          <h2>${titleMap[state.view] || 'ภาพรวมงาน'}</h2>
          <p>ระบบหลังบ้านสำหรับเจ้าหน้าที่: จัดการรายการงานและไฟล์แนบ</p>
        </div>
        <div class="actions">
          <span class="badge ${state.source === 'google_sheet' ? 'api' : 'demo'}">${state.source === 'google_sheet' ? 'Google Sheet API' : 'Demo Mode'}</span>
          <button class="btn secondary" data-action="refresh">รีเฟรช</button>
          <button class="btn warning" data-action="logout">ออกจากระบบ</button>
        </div>
      </div>`;
  }


  function renderMain() {
    const main = document.getElementById('main-content');
    if (!main) return;
    if (state.loading) { main.innerHTML = `<div class="loading">กำลังโหลดข้อมูล...</div>`; return; }
    if (state.error) {
      main.innerHTML = `<div class="error"><b>เชื่อมต่อ API ไม่สำเร็จ</b><br>${escapeHTML(state.error)}<br><span class="small">ระบบแสดงข้อมูลตัวอย่างชั่วคราว ตรวจสอบ config.js และ Apps Script deployment</span></div>`;
      return;
    }
    if (state.view === 'dashboard') main.innerHTML = renderDashboard();
    if (state.view === 'calendar') main.innerHTML = renderCalendar();
    if (state.view === 'admin') main.innerHTML = renderAdmin();
    if (state.view === 'users') main.innerHTML = renderUsers();
    if (state.view === 'report') main.innerHTML = renderReport();
    if (state.view === 'login') main.innerHTML = IS_ADMIN_APP ? renderOfficialLoginInner() : renderPublicLoginNotice();
  }

  function renderDashboard() {
    if (!IS_ADMIN_APP) return renderCalendar();
    const events = filteredEvents();
    const today = todayISO();
    const upcoming = events.filter(e => e.status !== 'ยกเลิก' && e.start_date >= today).sort((a,b) => a.start_date.localeCompare(b.start_date));
    const todayEvents = events.filter(e => e.start_date <= today && today <= (e.end_date || e.start_date));
    const cancelled = state.events.filter(e => e.status === 'ยกเลิก').length;
    return `
      <div class="grid cards">
        ${metric('รายการทั้งหมด', state.events.length)}
        ${metric('วันนี้', todayEvents.length)}
        ${metric('งานใกล้ถึง', upcoming.length)}
        ${metric('ยกเลิก', cancelled)}
      </div>
      ${filtersHTML()}
      <div class="grid" style="grid-template-columns:minmax(0,1.1fr) minmax(0,.9fr)">
        <section class="card">
          <div class="section-title"><h3>รายการงาน</h3><span class="small muted">${events.length} รายการ</span></div>
          ${eventTable(events.slice(0, 20))}
        </section>
        <section class="card">
          <div class="section-title"><h3>งานใกล้ถึง</h3></div>
          <div class="event-list">
            ${upcoming.slice(0, 8).map(eventCard).join('') || `<div class="empty">ยังไม่มีงานใกล้ถึง</div>`}
          </div>
        </section>
      </div>`;
  }


  function filtersHTML() {
    const groups = ['ทั้งหมด'].concat(unique(state.events.map(e => e.work_group).filter(Boolean)));
    const statuses = ['ทั้งหมด'].concat(unique(state.events.map(e => e.status).filter(Boolean)));
    return `<div class="card" style="margin:14px 0">
      <div class="toolbar">
        <input class="input" style="max-width:360px" placeholder="ค้นหาชื่องาน สถานที่ ผู้ประสานงาน" value="${escapeAttr(state.query)}" data-filter="query">
        <select class="select" style="max-width:220px" data-filter="status">${statuses.map(s => `<option ${s===state.status?'selected':''}>${escapeHTML(s)}</option>`).join('')}</select>
        <select class="select" style="max-width:280px" data-filter="group">${groups.map(g => `<option ${g===state.group?'selected':''}>${escapeHTML(g)}</option>`).join('')}</select>
      </div>
    </div>`;
  }

  function metric(label, value) {
    return `<div class="card metric"><div class="label">${escapeHTML(label)}</div><div class="value">${value}</div></div>`;
  }

  function eventTable(events) {
    if (!events.length) return `<div class="empty">ไม่พบรายการงาน</div>`;
    return `<div class="table-wrap"><table class="table">
      <thead><tr><th>วันที่</th><th>รายการ</th><th>สถานที่</th><th>กลุ่มงาน</th><th>สถานะ</th><th></th></tr></thead>
      <tbody>${events.map(e => `<tr>
        <td class="nowrap">${formatDate(e.start_date)}</td>
        <td><b>${escapeHTML(e.title)}</b><div class="event-meta">${formatTimeRange(e.start_time, e.end_time)} · ${escapeHTML(e.coordinator || '-')}</div></td>
        <td>${escapeHTML(e.location || '-')}</td>
        <td>${escapeHTML(e.work_group || '-')}</td>
        <td>${statusBadge(e.status)}</td>
        <td class="nowrap"><button class="btn secondary" data-action="open-event" data-id="${escapeAttr(e.id)}">ดู</button></td>
      </tr>`).join('')}</tbody>
    </table></div>`;
  }

  function eventCard(e) {
    return `<button class="event-item" data-action="open-event" data-id="${escapeAttr(e.id)}">
      <div class="event-meta">${formatDate(e.start_date)} · ${escapeHTML(e.start_time || '-')}</div>
      <h4>${escapeHTML(e.title)}</h4>
      <div class="event-meta">${escapeHTML(e.location || '-')}<br>${escapeHTML(e.work_group || '-')}</div>
    </button>`;
  }

  function renderCalendar() {
    const month = state.monthDate.getMonth();
    const year = state.monthDate.getFullYear();
    const first = new Date(year, month, 1);
    const start = new Date(first);
    start.setDate(first.getDate() - first.getDay());
    const days = [];
    for (let i = 0; i < 42; i++) { const d = new Date(start); d.setDate(start.getDate() + i); days.push(d); }
    const names = ['อา','จ','อ','พ','พฤ','ศ','ส'];
    const monthly = monthEvents();
    const calendarCard = `<section class="card calendar-card">
      <div class="calendar-head">
        <div><h3 style="margin:0">${monthName(month)} ${year + 543}</h3><p class="muted small">คลิกที่รายการในปฏิทินเพื่อดูรายละเอียดงาน</p></div>
        <div class="actions"><button class="btn secondary" data-action="prev-month">ก่อนหน้า</button><button class="btn secondary" data-action="today-month">เดือนนี้</button><button class="btn secondary" data-action="next-month">ถัดไป</button></div>
      </div>
      <div class="calendar-grid">${names.map(n => `<div class="day-name">${n}</div>`).join('')}${days.map(dayCell).join('')}</div>
    </section>`;
    const listCard = `<aside class="card month-list-card">
      <div class="section-title"><h3>รายการงานของเดือนนี้</h3><span class="small muted">${monthly.length} รายการ</span></div>
      <div class="month-list">
        ${monthly.length ? monthly.map(monthListItem).join('') : `<div class="empty">ยังไม่มีรายการงานในเดือนนี้</div>`}
      </div>
    </aside>`;
    return `<div class="public-calendar-layout">${calendarCard}${listCard}</div>`;
  }



  function monthEvents() {
    const year = state.monthDate.getFullYear();
    const month = state.monthDate.getMonth();
    const start = toISO(new Date(year, month, 1));
    const end = toISO(new Date(year, month + 1, 0));
    return filteredEvents().filter(e => {
      const eventStart = String(e.start_date || '').slice(0, 10);
      const eventEnd = String(e.end_date || e.start_date || '').slice(0, 10);
      return eventStart <= end && eventEnd >= start;
    }).sort((a, b) => String(a.start_date || '').localeCompare(String(b.start_date || '')) || String(a.start_time || '').localeCompare(String(b.start_time || '')));
  }

  function monthListItem(e) {
    return `<button class="month-list-item" data-action="open-event" data-id="${escapeAttr(e.id)}">
      <div class="month-list-date">
        <b>${formatDayOnly(e.start_date)}</b>
        <span>${formatMonthShort(e.start_date)}</span>
      </div>
      <div class="month-list-body">
        <div class="month-list-title">${escapeHTML(e.title)}</div>
        <div class="event-meta">${formatTimeRange(e.start_time, e.end_time)} · ${escapeHTML(e.location || '-')}</div>
        <div class="event-meta">${escapeHTML(e.work_group || '-')}</div>
      </div>
      <div>${statusBadge(e.status)}</div>
    </button>`;
  }

  function dayCell(date) {
    const iso = toISO(date);
    const currentMonth = date.getMonth() === state.monthDate.getMonth();
    const items = filteredEvents().filter(e => {
      const eventStart = normalizeDateOnly(e.start_date);
      const eventEnd = normalizeDateOnly(e.end_date || e.start_date);
      return eventStart && eventEnd && eventStart <= iso && iso <= eventEnd;
    }).sort((a, b) => String(a.start_date || '').localeCompare(String(b.start_date || '')) || String(a.start_time || '').localeCompare(String(b.start_time || '')));
    return `<div class="day ${currentMonth ? '' : 'off'} ${iso === todayISO() ? 'today' : ''}">
      <div class="day-num">${date.getDate()}</div>
      ${items.slice(0, 4).map(e => `<button class="chip ${e.status === 'ยกเลิก' ? 'cancel' : ''}" data-action="open-event" data-id="${escapeAttr(e.id)}">${escapeHTML(e.title)}</button>`).join('')}
      ${items.length > 4 ? `<div class="small muted">+${items.length - 4}</div>` : ''}
    </div>`;
  }

  function renderAdmin() {
    if (!state.session) return renderLogin('กรุณาเข้าสู่ระบบก่อนจัดการรายการงาน');
    if (!canEdit()) return `<div class="error">บัญชีนี้ไม่มีสิทธิ์เพิ่มหรือแก้ไขรายการงาน</div>`;
    const events = filteredEvents();
    return `<div class="grid" style="grid-template-columns:minmax(360px,.85fr) minmax(0,1.15fr)">
      <section class="card"><div id="admin-form-root">${eventFormHTML(state.editingEvent)}</div></section>
      <section class="card">
        <div class="section-title"><h3>รายการสำหรับจัดการ</h3><button class="btn secondary" data-action="new-event">ล้างฟอร์ม</button></div>
        ${filtersHTML()}
        ${adminTable(events)}
      </section>
    </div>`;
  }

  function renderAdminForm() {
    const root = document.getElementById('admin-form-root');
    if (root) root.innerHTML = eventFormHTML(state.editingEvent);
  }

  function eventFormHTML(item) {
    const e = item || { status:'ยืนยัน', format_type:'ในพื้นที่', start_date:todayISO(), end_date:todayISO(), start_time:'', end_time:'', title:'', location:'', coordinator:state.session ? state.session.name : '', work_group:state.session ? state.session.work_group : '', description:'' };
    return `<form data-form="event">
      <input type="hidden" name="id" value="${escapeAttr(e.id || '')}">
      <div class="section-title"><h3>${e.id ? 'แก้ไขรายการงาน' : 'เพิ่มรายการงาน'}</h3></div>
      <div class="field"><label>ชื่องาน *</label><input class="input" name="title" required value="${escapeAttr(e.title)}"></div>
      <div class="form-grid" style="margin-top:12px">
        ${inputField('วันที่เริ่ม *','start_date','date',e.start_date,true)}
        ${inputField('วันที่สิ้นสุด *','end_date','date',e.end_date || e.start_date,true)}
        ${inputField('เวลาเริ่ม','start_time','time',e.start_time || '',false)}
        ${inputField('เวลาสิ้นสุด','end_time','time',e.end_time || '',false)}
      </div>
      <div class="field" style="margin-top:12px"><label>สถานที่ *</label><input class="input" name="location" required value="${escapeAttr(e.location)}"></div>
      <div class="form-grid" style="margin-top:12px">
        ${selectField('รูปแบบ','format_type',e.format_type || 'ในพื้นที่',['ในพื้นที่','ออนไลน์','ทั้งในพื้นที่และออนไลน์'])}
        ${selectField('สถานะ','status',e.status || 'ยืนยัน',['ร่าง','ยืนยัน','เสร็จสิ้น','ยกเลิก'])}
        ${inputField('ผู้ประสานงาน','coordinator','text',e.coordinator || '',false)}
        ${inputField('กลุ่มงาน','work_group','text',e.work_group || '',false)}
      </div>
      <div class="field" style="margin-top:12px"><label>รายละเอียด</label><textarea class="textarea" name="description">${escapeHTML(e.description || '')}</textarea></div>
      <div class="actions" style="margin-top:14px"><button class="btn" type="submit" ${state.isSaving ? 'disabled' : ''}>${state.isSaving ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}</button><button class="btn secondary" type="button" data-action="new-event">ล้างฟอร์ม</button></div>
    </form>`;
  }

  function inputField(label, name, type, value, required) {
    return `<div class="field"><label>${label}</label><input class="input" type="${type}" name="${name}" ${required ? 'required' : ''} value="${escapeAttr(value || '')}"></div>`;
  }

  function selectField(label, name, value, options) {
    return `<div class="field"><label>${label}</label><select class="select" name="${name}">${options.map(o => `<option value="${escapeAttr(o)}" ${o===value?'selected':''}>${escapeHTML(o)}</option>`).join('')}</select></div>`;
  }

  function adminTable(events) {
    if (!events.length) return `<div class="empty">ไม่มีรายการสำหรับจัดการ</div>`;
    return `<div class="table-wrap"><table class="table">
      <thead><tr><th>วันที่</th><th>ชื่องาน</th><th>สถานะ</th><th>จัดการ</th></tr></thead>
      <tbody>${events.map(e => `<tr><td>${formatDate(e.start_date)}</td><td><b>${escapeHTML(e.title)}</b><div class="event-meta">${escapeHTML(e.location || '-')}</div></td><td>${statusBadge(e.status)}</td><td class="nowrap"><button class="btn secondary" data-action="open-event" data-id="${escapeAttr(e.id)}">ดู</button> <button class="btn warning" data-action="edit-event" data-id="${escapeAttr(e.id)}">แก้ไข</button> <button class="btn danger" data-action="delete-event" data-id="${escapeAttr(e.id)}">ลบ</button></td></tr>`).join('')}</tbody>
    </table></div>`;
  }

  function renderUsers() {
    if (!state.session) return renderLogin('กรุณาเข้าสู่ระบบก่อนจัดการผู้ใช้');
    if (!isAdmin()) return `<div class="error">บัญชีนี้ไม่มีสิทธิ์จัดการผู้ใช้</div>`;
    const users = filteredUsers();
    return `<div class="grid" style="grid-template-columns:minmax(340px,.8fr) minmax(0,1.2fr)">
      <section class="card"><div id="user-form-root">${userFormHTML(state.editingUser)}</div></section>
      <section class="card">
        <div class="section-title"><h3>บัญชีผู้ใช้งาน</h3><button class="btn secondary" data-action="new-user">เพิ่มผู้ใช้ใหม่</button></div>
        <div class="card" style="box-shadow:none;margin:0 0 14px;padding:0">
          <input class="input" placeholder="ค้นหาชื่อ อีเมล กลุ่มงาน หรือ role" value="${escapeAttr(state.userQuery)}" data-filter="user-query">
        </div>
        ${usersTable(users)}
      </section>
    </div>`;
  }

  function renderUserForm() {
    const root = document.getElementById('user-form-root');
    if (root) root.innerHTML = userFormHTML(state.editingUser);
  }

  function userFormHTML(item) {
    const u = item || { user_id:'', name:'', email:'', role:'staff', work_group:'', is_active:'TRUE' };
    const isEdit = !!u.user_id;
    return `<form data-form="user">
      <input type="hidden" name="user_id" value="${escapeAttr(u.user_id || '')}">
      <div class="section-title"><h3>${isEdit ? 'แก้ไขผู้ใช้' : 'เพิ่มผู้ใช้'}</h3></div>
      <div class="field"><label>ชื่อ-สกุล *</label><input class="input" name="name" required value="${escapeAttr(u.name || '')}"></div>
      <div class="field" style="margin-top:12px"><label>อีเมล *</label><input class="input" type="email" name="email" required value="${escapeAttr(u.email || '')}"></div>
      <div class="form-grid" style="margin-top:12px">
        ${selectField('Role *','role',u.role || 'staff',['viewer','staff','admin','super_admin'])}
        ${selectField('สถานะ','is_active',String(u.is_active).toUpperCase() === 'FALSE' ? 'FALSE' : 'TRUE',['TRUE','FALSE'])}
      </div>
      <div class="field" style="margin-top:12px"><label>กลุ่มงาน</label><input class="input" name="work_group" value="${escapeAttr(u.work_group || '')}"></div>
      <div class="field" style="margin-top:12px"><label>${isEdit ? 'PIN ใหม่ (เว้นว่างหากไม่เปลี่ยน)' : 'PIN เริ่มต้น *'}</label><input class="input" type="password" name="pin" ${isEdit ? '' : 'required'} minlength="4" autocomplete="new-password" placeholder="อย่างน้อย 4 ตัวอักษร"></div>
      <div class="user-role-help">
        <b>Role:</b> viewer = ดูข้อมูลเท่านั้น, staff = จัดการรายการงาน, admin = จัดการรายการและผู้ใช้, super_admin = สิทธิ์สูงสุด
      </div>
      <div class="actions" style="margin-top:14px"><button class="btn" type="submit" ${state.isSaving ? 'disabled' : ''}>${state.isSaving ? 'กำลังบันทึก...' : 'บันทึกผู้ใช้'}</button><button class="btn secondary" type="button" data-action="new-user">ล้างฟอร์ม</button></div>
    </form>`;
  }

  function usersTable(users) {
    if (!users.length) return `<div class="empty">ยังไม่มีบัญชีผู้ใช้ หรือไม่พบตามคำค้นหา</div>`;
    return `<div class="table-wrap"><table class="table">
      <thead><tr><th>ชื่อ</th><th>อีเมล</th><th>Role</th><th>กลุ่มงาน</th><th>สถานะ</th><th>จัดการ</th></tr></thead>
      <tbody>${users.map(u => `<tr>
        <td><b>${escapeHTML(u.name || '-')}</b><div class="event-meta">${escapeHTML(u.user_id || '-')}</div></td>
        <td>${escapeHTML(u.email || '-')}</td>
        <td><span class="status draft">${escapeHTML(u.role || '-')}</span></td>
        <td>${escapeHTML(u.work_group || '-')}</td>
        <td>${userActiveBadge(u.is_active)}</td>
        <td class="nowrap"><button class="btn warning" data-action="edit-user" data-id="${escapeAttr(u.user_id)}">แก้ไข</button> <button class="btn danger" data-action="delete-user" data-id="${escapeAttr(u.user_id)}">ปิดใช้งาน</button></td>
      </tr>`).join('')}</tbody>
    </table></div>`;
  }

  function filteredUsers() {
    const q = state.userQuery.trim().toLowerCase();
    return state.users.filter(u => {
      if (!q) return true;
      return [u.user_id, u.name, u.email, u.role, u.work_group].join(' ').toLowerCase().includes(q);
    }).sort((a,b) => String(a.name || '').localeCompare(String(b.name || ''), 'th'));
  }

  function userActiveBadge(value) {
    const active = String(value).toUpperCase() !== 'FALSE' && String(value) !== '0';
    return `<span class="status ${active ? 'ok' : 'cancel'}">${active ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}</span>`;
  }

  function beginEditUser(id) {
    if (!isAdmin()) return alert('ไม่มีสิทธิ์จัดการผู้ใช้');
    const user = state.users.find(u => u.user_id === id);
    if (!user) return;
    state.editingUser = Object.assign({}, user);
    state.view = 'users';
    render();
    setTimeout(() => window.scrollTo({ top:0, behavior:'smooth' }), 20);
  }

  async function handleUserSave(form) {
    if (!isAdmin()) return alert('ไม่มีสิทธิ์จัดการผู้ใช้');
    const data = formData(form);
    state.isSaving = true;
    renderUserForm();
    try {
      const action = data.user_id ? 'updateUser' : 'createUser';
      const res = await apiPost(action, data, true);
      if (!res.ok) throw new Error(res.message || 'บันทึกผู้ใช้ไม่สำเร็จ');
      state.editingUser = null;
      await loadData();
      state.view = 'users';
      alert('บันทึกผู้ใช้เรียบร้อย');
    } catch (err) {
      alert(err.message || String(err));
    } finally {
      state.isSaving = false;
      render();
    }
  }

  async function deleteUser(id) {
    if (!isAdmin()) return alert('ไม่มีสิทธิ์จัดการผู้ใช้');
    const user = state.users.find(u => u.user_id === id);
    if (!user) return;
    if (!confirm(`ยืนยันปิดใช้งานผู้ใช้: ${user.name || user.email}\nผู้ใช้นี้จะไม่สามารถเข้าสู่ระบบหลังบ้านได้`)) return;
    try {
      const res = await apiPost('deleteUser', { user_id:id }, true);
      if (!res.ok) throw new Error(res.message || 'ปิดใช้งานไม่สำเร็จ');
      state.editingUser = null;
      await loadData();
      state.view = 'users';
    } catch (err) { alert(err.message || String(err)); }
  }

  function renderReport() {
    const events = filteredEvents();
    const today = todayISO();
    const thisMonthKey = toISO(new Date(state.monthDate.getFullYear(), state.monthDate.getMonth(), 1)).slice(0, 7);
    const thisMonthEvents = events.filter(e => normalizeDateOnly(e.start_date).slice(0, 7) === thisMonthKey);
    const upcoming = events.filter(e => e.status !== 'ยกเลิก' && normalizeDateOnly(e.start_date) >= today).sort(sortEvents);
    const byStatus = countBy(events, 'status');
    const byGroup = countBy(events, 'work_group');
    const byMonth = countBy(events, e => normalizeDateOnly(e.start_date).slice(0, 7));
    const confirmed = byStatus['ยืนยัน'] || 0;
    const draft = byStatus['ร่าง'] || 0;
    const cancelled = byStatus['ยกเลิก'] || 0;
    const done = byStatus['เสร็จสิ้น'] || 0;
    return `<div class="report-dashboard">
      <div class="grid cards report-metrics">
        ${metric('รายการทั้งหมด', events.length)}
        ${metric('งานเดือนนี้', thisMonthEvents.length)}
        ${metric('งานใกล้ถึง', upcoming.length)}
        ${metric('ยืนยันแล้ว', confirmed)}
      </div>
      <div class="report-status-strip">
        <div><b>${draft}</b><span>ร่าง</span></div>
        <div><b>${done}</b><span>เสร็จสิ้น</span></div>
        <div><b>${cancelled}</b><span>ยกเลิก</span></div>
        <div><b>${Object.keys(byGroup).length}</b><span>กลุ่มงาน</span></div>
      </div>
      <div class="grid report-summary-grid">
        ${summaryCard('สรุปตามสถานะ', byStatus)}
        ${summaryCard('สรุปตามกลุ่มงาน', byGroup)}
        ${summaryCard('สรุปตามเดือน', byMonth)}
      </div>
      <div class="grid report-lists-grid">
        ${reportEventList('งานใกล้ถึง', upcoming.slice(0, 8), 'ยังไม่มีงานใกล้ถึง')}
        ${reportEventList('รายการของเดือนที่เลือก', thisMonthEvents.sort(sortEvents).slice(0, 10), 'ยังไม่มีรายการในเดือนนี้')}
      </div>
    </div>`;
  }

  function reportEventList(title, events, emptyText) {
    return `<section class="card report-list-card">
      <div class="section-title"><h3>${escapeHTML(title)}</h3><span class="small muted">${events.length} รายการ</span></div>
      <div class="event-list">${events.length ? events.map(e => `<button class="event-item report-event-item" data-action="open-event" data-id="${escapeAttr(e.id)}">
        <div class="report-event-date">${formatDate(e.start_date)}</div>
        <h4>${escapeHTML(e.title)}</h4>
        <div class="event-meta">${formatTimeRange(e.start_time, e.end_time)} · ${escapeHTML(e.location || '-')}</div>
        <div class="event-meta">${escapeHTML(e.work_group || '-')} · ${statusText(e.status)}</div>
      </button>`).join('') : `<div class="empty">${escapeHTML(emptyText)}</div>`}</div>
    </section>`;
  }

  function summaryCard(title, data) {
    const entries = Object.entries(data).sort((a,b) => b[1] - a[1]);
    const max = Math.max(1, ...entries.map(e => e[1]));
    return `<section class="card"><h3 style="margin-top:0">${escapeHTML(title)}</h3><div class="summary-bars">${entries.map(([k,v]) => `<div class="bar-row"><span>${escapeHTML(k || '-')}</span><div class="bar"><i style="width:${Math.max(8, v/max*100)}%"></i></div><b>${v}</b></div>`).join('') || '<div class="empty">ไม่มีข้อมูล</div>'}</div></section>`;
  }

  function logsTable() {
    if (!state.logs.length) return `<div class="empty">ยังไม่มีข้อมูล log</div>`;
    return `<div class="table-wrap"><table class="table"><thead><tr><th>เวลา</th><th>Action</th><th>ผู้ใช้</th><th>รายละเอียด</th></tr></thead><tbody>${state.logs.slice(0, 50).map(l => `<tr><td>${formatDateTime(l.datetime)}</td><td>${escapeHTML(l.action || '-')}</td><td>${escapeHTML(l.user_name || l.user_id || '-')}</td><td>${escapeHTML(l.detail || '-')}</td></tr>`).join('')}</tbody></table></div>`;
  }

  function renderPublicLoginNotice() {
    return `<section class="card login-box"><h3>เข้าสู่ระบบเจ้าหน้าที่</h3><p class="muted small">หน้า Public ใช้สำหรับแสดงข้อมูลทั่วไป หากต้องการจัดการรายการงาน กรุณาเข้าสู่ระบบผ่าน Admin Portal</p><button class="btn" data-action="go-admin">ไปหน้า Admin Portal</button></section>`;
  }

  function renderOfficialLogin() {
    return `<main class="admin-login-layout">
      ${renderOfficialLoginInner()}
      <aside class="admin-login-panel admin-login-panel-brand" aria-hidden="true">
        <div class="admin-login-brand-grid"></div>
        <div class="admin-login-brand-card">
          <div class="admin-login-brand-mark"><span></span><span></span><span></span></div>
          <h2>Royal Park Rajapruek</h2>
          <p>${escapeHTML(APP_NAME)}</p>
          <span class="admin-login-brand-chip">Google Sheet + Drive ready</span>
        </div>
      </aside>
    </main><div id="modal-root"></div>`;
  }

  function renderOfficialLoginInner(message) {
    return `<section class="admin-login-panel admin-login-panel-form" aria-labelledby="adminLoginTitle">
      <a href="./index.html" class="admin-login-back"><span aria-hidden="true">‹</span><span>กลับหน้าแรก</span></a>
      <div class="admin-login-card admin-login-portal-card">
        <div class="text-center mb-2">
          <div class="admin-login-eyebrow">Admin Portal</div>
          <h1 id="adminLoginTitle">เข้าสู่ระบบเจ้าหน้าที่</h1>
          <p class="text-muted text-small">สำหรับเข้าระบบหลังบ้านเท่านั้น</p>
        </div>
        ${message ? `<div class="alert alert-danger mb-2">${escapeHTML(message)}</div>` : ''}
        <form data-form="login" class="admin-login-form">
          <div class="form-group">
            <label for="admin_username">ชื่อผู้ใช้</label>
            <input id="admin_username" type="text" name="username" class="form-control" required autocomplete="username" placeholder="กรอกอีเมลหรือรหัสผู้ใช้">
          </div>
          <div class="form-group">
            <label for="admin_password">รหัสผ่าน</label>
            <input id="admin_password" type="password" name="password" class="form-control" required autocomplete="current-password" placeholder="กรอกรหัสผ่าน/PIN">
          </div>
          <button type="submit" class="btn btn-primary btn-block mt-1">เข้าสู่ระบบ</button>
        </form>
        <div class="admin-login-footer"><p class="admin-login-footer-note">เข้าสู่ระบบเพื่อจัดการปฏิทิน รายการงาน และไฟล์แนบ</p></div>
      </div>
    </section>`;
  }

  function renderModal() {
    const root = document.getElementById('modal-root');
    if (!root) return;
    if (!state.selectedEvent) { root.innerHTML = ''; return; }
    const e = state.selectedEvent;
    root.innerHTML = `<div class="modal-backdrop"><div class="modal">
      <div class="modal-head"><div><span>${statusBadge(e.status)}</span><h2 style="margin:10px 0 0">${escapeHTML(e.title)}</h2><p class="muted small">รหัส: ${escapeHTML(e.id)}</p></div><button class="close" data-action="close-modal">×</button></div>
      <div class="detail-grid">
        ${detailBox('วันที่', `${formatDate(e.start_date)}${e.end_date && e.end_date !== e.start_date ? ' - ' + formatDate(e.end_date) : ''}`)}
        ${detailBox('เวลา', `${formatTimeRange(e.start_time, e.end_time)}`)}
        ${detailBox('สถานที่', e.location || '-')}
        ${detailBox('รูปแบบ', e.format_type || '-')}
        ${detailBox('ผู้ประสานงาน', e.coordinator || '-')}
        ${detailBox('กลุ่มงาน', e.work_group || '-')}
      </div>
      <div class="detail-box" style="margin-top:12px"><b>รายละเอียด</b>${escapeHTML(e.description || '-')}</div>
      ${IS_ADMIN_APP ? `<div class="card" style="box-shadow:none;margin-top:14px">
        <div class="section-title"><h3>ไฟล์แนบ Google Drive</h3>${canEdit() ? `<label class="btn ${state.isUploading ? 'secondary' : ''}">${state.isUploading ? 'กำลังอัปโหลด...' : 'แนบไฟล์'}<input class="hidden" type="file" data-upload ${state.isUploading ? 'disabled' : ''}></label>` : ''}</div>
        <p class="muted small">จำกัดไฟล์ละไม่เกิน ${MAX_UPLOAD_MB} MB</p>
        ${attachmentsHTML()}
      </div>` : ''}
      <div class="actions" style="justify-content:flex-end;margin-top:14px">
        ${IS_ADMIN_APP && canEdit() ? `<button class="btn warning" data-action="edit-event" data-id="${escapeAttr(e.id)}">แก้ไข</button><button class="btn danger" data-action="delete-event" data-id="${escapeAttr(e.id)}">ลบ/ยกเลิก</button>` : ''}
        <button class="btn secondary" data-action="close-modal">ปิด</button>
      </div>
    </div></div>`;
  }

  function detailBox(label, value) { return `<div class="detail-box"><b>${escapeHTML(label)}</b>${escapeHTML(value)}</div>`; }

  function attachmentsHTML() {
    if (!state.attachments.length) return `<div class="empty">ยังไม่มีไฟล์แนบ</div>`;
    return `<div>${state.attachments.map(a => `<div class="attachment-row"><div><b>${escapeHTML(a.file_name || '-')}</b><div class="event-meta">${escapeHTML(a.mime_type || '-')} · ${formatBytes(a.size_bytes)} · ${formatDateTime(a.created_at)}</div></div><div class="actions">${a.file_url ? `<a class="btn secondary" target="_blank" rel="noreferrer" href="${escapeAttr(a.file_url)}">เปิด</a>` : ''}${canEdit() ? `<button class="btn danger" data-action="delete-attachment" data-id="${escapeAttr(a.id)}">ลบ</button>` : ''}</div></div>`).join('')}</div>`;
  }

  async function handleLogin(form) {
    const data = formData(form);
    const username = data.username || data.email || '';
    const password = data.password || data.pin || '';
    try {
      const res = await apiPost('login', { email:username, username, pin:password, password, portal:'admin' }, false);
      if (!res.ok) throw new Error(res.message || 'เข้าสู่ระบบไม่สำเร็จ');
      const nextSession = res.data;
      if (!['staff','admin','super_admin'].includes(String(nextSession.role || ''))) {
        throw new Error('บัญชีนี้ไม่มีสิทธิ์เข้าระบบหลังบ้าน');
      }
      state.session = nextSession;
      saveSession(state.session);
      state.view = 'admin';
      await loadData();
    } catch (err) {
      if (IS_ADMIN_APP) {
        const app = document.getElementById('app');
        if (app) app.innerHTML = renderOfficialLogin(err.message || String(err));
      } else {
        alert(err.message || String(err));
      }
    }
  }

  async function handleEventSave(form) {
    const data = formData(form);
    if (data.start_date > data.end_date) { alert('วันที่สิ้นสุดต้องไม่มาก่อนวันที่เริ่มต้น'); return; }
    state.isSaving = true;
    renderAdminForm();
    try {
      const action = data.id ? 'updateEvent' : 'createEvent';
      const res = await apiPost(action, data, true);
      if (!res.ok) throw new Error(res.message || 'บันทึกไม่สำเร็จ');
      await loadData();
      state.editingEvent = null;
      alert('บันทึกข้อมูลเรียบร้อย');
    } catch (err) {
      alert(err.message || String(err));
    } finally {
      state.isSaving = false;
      render();
    }
  }

  async function deleteEvent(id) {
    if (!canEdit()) return alert('ไม่มีสิทธิ์ลบข้อมูล');
    const item = state.events.find(e => e.id === id);
    if (!item) return;
    if (!confirm(`ยืนยันลบ/ยกเลิกรายการ: ${item.title}\nระบบจะทำ soft delete ใน Google Sheet`)) return;
    try {
      const res = await apiPost('deleteEvent', { id }, true);
      if (!res.ok) throw new Error(res.message || 'ลบไม่สำเร็จ');
      closeModal();
      await loadData();
    } catch (err) { alert(err.message || String(err)); }
  }

  async function openEvent(id) {
    const item = state.events.find(e => e.id === id);
    if (!item) return;
    state.selectedEvent = item;
    state.attachments = [];
    renderModal();
    try {
      const res = await apiGet('listAttachments', { event_id:id });
      state.attachments = Array.isArray(res.data) ? res.data : [];
    } catch (err) {
      state.attachments = [];
    }
    renderModal();
  }

  function closeModal() { state.selectedEvent = null; state.attachments = []; renderModal(); }

  function beginEditEvent(id) {
    const item = state.events.find(e => e.id === id);
    if (!item) return;
    state.editingEvent = Object.assign({}, item);
    state.view = 'admin';
    closeModal();
    render();
    setTimeout(() => window.scrollTo({ top:0, behavior:'smooth' }), 20);
  }

  async function handleFileUpload(file) {
    if (!file || !state.selectedEvent) return;
    if (!canEdit()) return alert('ไม่มีสิทธิ์แนบไฟล์');
    if (file.size > MAX_UPLOAD_MB * 1024 * 1024) return alert(`ไฟล์ใหญ่เกินไป จำกัดไม่เกิน ${MAX_UPLOAD_MB} MB`);
    state.isUploading = true;
    renderModal();
    try {
      const base64 = await fileToBase64(file);
      const res = await apiPost('uploadAttachment', {
        event_id: state.selectedEvent.id,
        file_name: file.name,
        mime_type: file.type || 'application/octet-stream',
        size_bytes: file.size,
        base64
      }, true);
      if (!res.ok) throw new Error(res.message || 'อัปโหลดไม่สำเร็จ');
      await openEvent(state.selectedEvent.id);
    } catch (err) {
      alert(err.message || String(err));
    } finally {
      state.isUploading = false;
      renderModal();
    }
  }

  async function deleteAttachment(id) {
    if (!canEdit()) return alert('ไม่มีสิทธิ์ลบไฟล์แนบ');
    if (!confirm('ยืนยันลบไฟล์แนบนี้')) return;
    try {
      const res = await apiPost('deleteAttachment', { id }, true);
      if (!res.ok) throw new Error(res.message || 'ลบไฟล์แนบไม่สำเร็จ');
      await openEvent(state.selectedEvent.id);
    } catch (err) { alert(err.message || String(err)); }
  }

  async function apiGet(action, params) {
    if (!isApiConfigured()) return demoApi(action, params || {});
    const url = new URL(API_URL);
    url.searchParams.set('action', action);
    Object.entries(params || {}).forEach(([key, value]) => url.searchParams.set(key, value));
    const res = await fetch(url.toString(), { method:'GET' });
    return parseJsonResponse(res);
  }

  async function apiPost(action, payload, requireAuth) {
    if (!isApiConfigured()) return demoPost(action, payload);
    const auth = requireAuth && state.session ? { token:state.session.token } : (state.session ? { token:state.session.token } : null);
    const res = await fetch(API_URL, {
      method:'POST',
      headers:{ 'Content-Type':'text/plain;charset=utf-8' },
      body:JSON.stringify({ action, payload, auth, client:'github-pages-native-html' })
    });
    return parseJsonResponse(res);
  }

  async function parseJsonResponse(res) {
    const text = await res.text();
    let json;
    try { json = JSON.parse(text); } catch (err) { throw new Error(`API ไม่ได้ตอบกลับเป็น JSON: ${text.slice(0, 160)}`); }
    if (!res.ok) throw new Error(json.message || `HTTP ${res.status}`);
    if (json.ok === false) throw new Error(json.message || 'API error');
    return json;
  }

  async function demoApi(action, params) {
    await sleep(180);
    if (action === 'listEvents') return { ok:true, data:demoEvents, source:'demo' };
    if (action === 'listLogs') return { ok:true, data:demoLogs, source:'demo' };
    if (action === 'listUsers') return { ok:true, data:demoUsers, source:'demo' };
    if (action === 'listAttachments') return { ok:true, data:[], source:'demo' };
    return { ok:true, data:null, source:'demo' };
  }

  async function demoPost(action, payload) {
    await sleep(180);
    if (action === 'login') return { ok:true, data:{ user_id:'USR-DEMO', name:'ผู้ดูแลระบบตัวอย่าง', email:payload.email, role:'admin', work_group:'อำนวยการ', token:'demo-token' }, source:'demo' };
    if (['listUsers','createUser','updateUser','deleteUser'].includes(action)) return { ok:false, message:'ยังไม่ได้ตั้งค่า Apps Script URL ใน config.js ระบบจึงยังบันทึกข้อมูลผู้ใช้จริงไม่ได้', source:'demo' };
    return { ok:false, message:'ยังไม่ได้ตั้งค่า Apps Script URL ใน config.js ระบบจึงยังบันทึกข้อมูลจริงไม่ได้', source:'demo' };
  }

  function filteredEvents() {
    const q = state.query.trim().toLowerCase();
    return state.events.filter(e => {
      if (state.status !== 'ทั้งหมด' && e.status !== state.status) return false;
      if (state.group !== 'ทั้งหมด' && e.work_group !== state.group) return false;
      if (!q) return true;
      return [e.title, e.location, e.coordinator, e.work_group, e.description].join(' ').toLowerCase().includes(q);
    }).sort((a,b) => (a.start_date || '').localeCompare(b.start_date || ''));
  }

  function canEdit() { return !!(state.session && ['staff','admin','super_admin'].includes(state.session.role)); }
  function isAdmin() { return !!(state.session && ['admin','super_admin'].includes(state.session.role)); }

  function statusBadge(status) {
    const cls = status === 'ยืนยัน' ? 'ok' : status === 'ยกเลิก' ? 'cancel' : status === 'เสร็จสิ้น' ? 'done' : 'draft';
    return `<span class="status ${cls}">${escapeHTML(status || '-')}</span>`;
  }

  function formData(form) { return Object.fromEntries(new FormData(form).entries()); }
  function setView(view) {
    if (!IS_ADMIN_APP && view === 'admin') { window.location.href = './admin.html'; return; }
    if (IS_ADMIN_APP && !state.session) { state.view = 'login'; render(); return; }
    state.view = view; state.sidebarCollapsed = window.innerWidth < 920; render();
  }
  function logout() {
    localStorage.removeItem(SESSION_KEY);
    state.session = null;
    state.events = [];
    state.logs = [];
    state.users = [];
    state.editingEvent = null;
    state.editingUser = null;
    state.view = IS_ADMIN_APP ? 'login' : 'dashboard';
    render();
  }
  function readSession() { try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch { return null; } }
  function saveSession(session) { localStorage.setItem(SESSION_KEY, JSON.stringify(session)); }
  function isApiConfigured() { return /^https:\/\/script\.google\.com\/macros\/s\//.test(API_URL); }
  function getInitialView() {
    const requested = (location.hash || '').replace('#','') || document.body.dataset.initialView || 'dashboard';
    if (!IS_ADMIN_APP && requested === 'admin') return 'dashboard';
    if (IS_ADMIN_APP && !readSession() && requested !== 'login') return 'login';
    return requested;
  }
  function unique(arr) { return Array.from(new Set(arr)); }
  function countBy(arr, key) { return arr.reduce((acc,item) => { const k = typeof key === 'function' ? key(item) : item[key]; acc[k || '-'] = (acc[k || '-'] || 0) + 1; return acc; }, {}); }
  function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
  function fileToBase64(file) { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result || '').split(',')[1] || ''); reader.onerror = reject; reader.readAsDataURL(file); }); }

  function normalizeDateOnly(value) {
    if (!value) return '';
    const text = String(value).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
    const date = new Date(text);
    if (!Number.isNaN(date.getTime())) return toISO(date);
    return text.slice(0, 10);
  }
  function todayISO() { return new Intl.DateTimeFormat('sv-SE', { timeZone:TIMEZONE, year:'numeric', month:'2-digit', day:'2-digit' }).format(new Date()); }
  function addDaysISO(days) { const d = new Date(); d.setDate(d.getDate() + days); return toISO(d); }
  function toISO(date) { return new Intl.DateTimeFormat('sv-SE', { timeZone:TIMEZONE, year:'numeric', month:'2-digit', day:'2-digit' }).format(date); }
  function addMonths(date, months) { const d = new Date(date); d.setMonth(d.getMonth() + months); return d; }
  function monthName(index) { return ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'][index]; }
  function formatDayOnly(iso) {
    if (!iso) return '-';
    const value = String(iso).slice(0, 10);
    const day = Number(value.split('-')[2]);
    return day || '-';
  }
  function formatMonthShort(iso) {
    if (!iso) return '-';
    const value = String(iso).slice(0, 10);
    const parts = value.split('-').map(Number);
    if (!parts[0] || !parts[1]) return '-';
    return thaiMonthShort(parts[1] - 1);
  }
  function thaiMonthShort(index) {
    return ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'][index] || '-';
  }
  function formatDate(iso) { if (!iso) return '-'; const [y,m,d] = String(iso).slice(0,10).split('-').map(Number); if (!y || !m || !d) return iso; return new Date(y,m-1,d).toLocaleDateString('th-TH', { day:'numeric', month:'short', year:'numeric' }); }
  function formatDateTime(value) { if (!value) return '-'; const d = new Date(value); if (Number.isNaN(d.getTime())) return value; return d.toLocaleString('th-TH', { timeZone:TIMEZONE, year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' }); }
  function formatTime(value) {
    if (!value) return '-';
    const text = String(value).trim();
    const isoTime = text.match(/T(\d{2}:\d{2})/);
    if (isoTime) return isoTime[1];
    const plain = text.match(/^(\d{1,2}):(\d{2})/);
    if (plain) return `${plain[1].padStart(2, '0')}:${plain[2]}`;
    return text;
  }
  function formatTimeRange(start, end) {
    const a = formatTime(start);
    const b = formatTime(end);
    if (a === '-' && b === '-') return '-';
    return `${a} - ${b}`;
  }
  function sortEvents(a, b) {
    return normalizeDateOnly(a.start_date).localeCompare(normalizeDateOnly(b.start_date)) || formatTime(a.start_time).localeCompare(formatTime(b.start_time));
  }
  function statusText(value) { return String(value || '-'); }
  function formatBytes(bytes) { const n = Number(bytes || 0); if (!n) return '-'; if (n < 1024) return n + ' B'; if (n < 1024*1024) return (n/1024).toFixed(1) + ' KB'; return (n/1024/1024).toFixed(2) + ' MB'; }
  function escapeHTML(value) { return String(value == null ? '' : value).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
  function escapeAttr(value) { return escapeHTML(value).replace(/'/g, '&#39;'); }
})();
