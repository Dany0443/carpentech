(() => {
  'use strict';
  const root = document.documentElement;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const systemDark = matchMedia('(prefers-color-scheme: dark)');
  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
  const motionAllowed = () => !reduceMotion.matches && root.dataset.motion !== 'off';
  const store = (key, value) => { try { localStorage.setItem(key, value); } catch { /* Storage is optional. */ } };
  const spring = CSS.supports('animation-timing-function', 'linear(0, .8, 1)') ? getComputedStyle(root).getPropertyValue('--motion-spring').trim() : 'cubic-bezier(.2,0,0,1)';
  const activeAnimations = new WeakMap();
  function animate(element, frames, options = {}) {
    if (!element || !motionAllowed() || !element.animate) return null;
    activeAnimations.get(element)?.cancel();
    const animation = element.animate(frames, { duration: 450, easing: spring, ...options });
    activeAnimations.set(element, animation);
    animation.addEventListener('finish', () => { if (activeAnimations.get(element) === animation) activeAnimations.delete(element); }, { once: true });
    return animation;
  }
  root.classList.add('js');
  $$('[data-motion-toggle], #theme-toggle, #menu-open, #photo-open, #copy-email, .robot-segments, .team-filters, .contact-intents').forEach(element => { element.hidden = false; });

  let snackbarTimer;
  function notify(message) {
    const snackbar = $('#snackbar');
    clearTimeout(snackbarTimer);
    snackbar.textContent = message;
    snackbar.classList.add('is-visible');
    snackbarTimer = setTimeout(() => snackbar.classList.remove('is-visible'), 3500);
  }
  function syncMotionControls() {
    const paused = !motionAllowed();
    $$('[data-motion-toggle]').forEach(button => {
      button.setAttribute('aria-pressed', String(paused));
      button.setAttribute('aria-label', reduceMotion.matches ? 'Reduced motion follows your system preference' : paused ? 'Enable animations' : 'Pause animations');
      $('use', button).setAttribute('href', paused ? '#i-play' : '#i-pause');
      const label = $('span', button);
      if (label) label.textContent = reduceMotion.matches ? 'Reduced motion' : paused ? 'Motion paused' : 'Motion on';
    });
    if (paused) { document.getAnimations().forEach(animation => animation.cancel()); $$('.animate-in').forEach(element => element.classList.remove('animate-in')); }
  }
  $$('[data-motion-toggle]').forEach(button => button.addEventListener('click', () => {
    if (reduceMotion.matches) { notify('Reduced motion is enabled in your system settings.'); return; }
    const paused = root.dataset.motion !== 'off';
    root.dataset.motion = paused ? 'off' : 'on';
    store('carpentech-motion', paused ? 'off' : 'on');
    syncMotionControls(); notify(paused ? 'Animations paused.' : 'Animations enabled.');
  }));
  reduceMotion.addEventListener('change', syncMotionControls);
  syncMotionControls();

  const themeButton = $('#theme-toggle');
  const isDark = () => root.dataset.theme ? root.dataset.theme === 'dark' : systemDark.matches;
  function syncThemeControl() {
    const dark = isDark();
    themeButton.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
    themeButton.setAttribute('aria-pressed', String(dark));
    $('use', themeButton).setAttribute('href', dark ? '#i-sun' : '#i-moon');
    $('meta[name="theme-color"]').setAttribute('content', dark ? '#111b15' : '#f5f7f1');
  }
  themeButton.addEventListener('click', () => {
    const next = isDark() ? 'light' : 'dark';
    const update = () => { root.dataset.theme = next; store('carpentech-theme', next); syncThemeControl(); };
    if (document.startViewTransition && motionAllowed()) document.startViewTransition(update); else update();
    animate($('svg', themeButton), [{ transform: 'rotate(-70deg) scale(.55)' }, { transform: 'none' }], { duration: 500 });
  });
  systemDark.addEventListener('change', syncThemeControl);
  syncThemeControl();

  // All content is visible by default; an observer only adds finite entrance motion.
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      entries.filter(entry => entry.isIntersecting).forEach((entry, index) => {
        observer.unobserve(entry.target);
        if (!motionAllowed()) return;
        entry.target.style.setProperty('--reveal-delay', `${Math.min(index * 55, 165)}ms`);
        entry.target.classList.add('animate-in');
        entry.target.addEventListener('animationend', () => entry.target.classList.remove('animate-in'), { once: true });
      });
    }, { threshold: .08, rootMargin: '0px 0px -20px 0px' });
    $$('[data-reveal]').forEach(element => observer.observe(element));
  }

  const systemButtons = $$('[data-system]');
  const robotDetails = $$('[data-robot-detail]');
  const explorerImage = $('#explorer-image');
  const indicator = $('.segment-indicator');
  let selectedSystem = 0;
  const photoViews = { overview: 'translate(0%, 0%) scale(1)', drive: 'translate(2%, -18%) scale(1.65)', control: 'translate(-8%, 20%) scale(1.65)' };
  robotDetails.forEach((detail, index) => { detail.hidden = index !== 0; });
  function selectSystem(button) {
    const index = systemButtons.indexOf(button);
    if (index === selectedSystem) return;
    const fromTransform = getComputedStyle(explorerImage).transform;
    const oldIndicator = getComputedStyle(indicator).transform;
    const nextTransform = photoViews[button.dataset.system];
    selectedSystem = index;
    systemButtons.forEach(element => element.setAttribute('aria-pressed', String(element === button)));
    robotDetails.forEach(detail => { detail.hidden = detail.dataset.robotDetail !== button.dataset.system; });
    indicator.style.transform = `translateX(${index * 100}%)`;
    explorerImage.style.transform = nextTransform;
    animate(indicator, [{ transform: oldIndicator }, { transform: `translateX(${index * 100}%)` }], { duration: 520 });
    animate(explorerImage, [{ transform: fromTransform }, { transform: nextTransform }], { duration: 700 });
    animate($('#robot-insight'), [{ opacity: .25, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }], { duration: 350, easing: 'cubic-bezier(.05,.7,.1,1)' });
    explorerImage.alt = button.dataset.system === 'drive' ? 'Zoomed view of the robot drivetrain, wheels, and mechanical connections' : button.dataset.system === 'control' ? 'Zoomed view of the robot’s REV control hubs and wiring' : 'A closer view of robot 28287, showing its frame and components';
  }
  systemButtons.forEach(button => button.addEventListener('click', () => selectSystem(button)));
  function arrowGroup(buttons) {
    buttons.forEach((button, index) => button.addEventListener('keydown', event => {
      let next;
      if (event.key === 'ArrowRight') next = (index + 1) % buttons.length;
      if (event.key === 'ArrowLeft') next = (index - 1 + buttons.length) % buttons.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = buttons.length - 1;
      if (next === undefined) return;
      event.preventDefault(); buttons[next].focus(); buttons[next].click();
    }));
  }
  arrowGroup(systemButtons);

  const teamButtons = $$('[data-team-filter]');
  const members = $$('.roster li');
  teamButtons.forEach(button => button.addEventListener('click', () => {
    if (button.getAttribute('aria-pressed') === 'true') return;
    const before = new Map(members.filter(member => !member.hidden).map(member => [member, member.getBoundingClientRect()]));
    teamButtons.forEach(element => element.setAttribute('aria-pressed', String(element === button)));
    members.forEach(member => { member.hidden = button.dataset.teamFilter !== 'all' && member.dataset.teamArea !== button.dataset.teamFilter; });
    const visible = members.filter(member => !member.hidden);
    visible.forEach((member, index) => {
      const previous = before.get(member), current = member.getBoundingClientRect();
      animate(member, [{ opacity: previous ? 1 : .25, transform: previous ? `translate(${previous.left - current.left}px, ${previous.top - current.top}px)` : 'translateY(16px)' }, { opacity: 1, transform: 'none' }], { duration: 400, delay: index * 25 });
    });
    const area = button.dataset.teamFilter === 'all' ? 'team members' : button.dataset.teamFilter === 'people' ? 'in management & PR' : `in ${button.textContent.toLowerCase()}`;
    $('#team-status').textContent = `${visible.length} ${area}`;
  }));
  arrowGroup(teamButtons);

  const intents = {
    partner: { description: 'Have an idea for supporting the team? Let’s talk about a partnership that works for both of us.', action: 'Start a conversation', subject: 'Partnership with CarpenTech', body: 'Hello CarpenTech,\n\nI would like to discuss supporting your team.\n\nMy name / organization:\nHow we could help:\n' },
    mentor: { description: 'Have experience in engineering, programming, or communication? Share what you know with students who are ready to learn.', action: 'Talk about mentoring', subject: 'Mentoring CarpenTech', body: 'Hello CarpenTech,\n\nI am interested in mentoring the team.\n\nMy experience:\nHow I could help:\n' },
    join: { description: 'Curious about robotics? You don’t need to have all the answers. Get in touch and tell us what you would like to learn.', action: 'Ask about joining', subject: 'Joining CarpenTech', body: 'Hello CarpenTech,\n\nI would like to learn more about joining the team.\n\nMy name:\nWhat interests me:\n' }
  };
  const intentButtons = $$('[data-intent]');
  intentButtons.forEach(button => button.addEventListener('click', () => {
    if (button.getAttribute('aria-pressed') === 'true') return;
    intentButtons.forEach(element => element.setAttribute('aria-pressed', String(element === button)));
    const intent = intents[button.dataset.intent], link = $('#intent-email');
    $('#intent-description').textContent = intent.description;
    link.firstChild.textContent = intent.action;
    link.href = `mailto:carpentech@carpineni.ro?subject=${encodeURIComponent(intent.subject)}&body=${encodeURIComponent(intent.body)}`;
    animate($('#intent-description'), [{ opacity: .3, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], { duration: 300 });
  }));
  arrowGroup(intentButtons);
  $$('details').forEach(details => details.addEventListener('toggle', () => { if (details.open) animate($('.details-body', details), [{ opacity: .2, transform: 'translateY(-8px)' }, { opacity: 1, transform: 'none' }], { duration: 300 }); }));

  const menu = $('#mobile-menu'), photo = $('#photo-dialog'), menuOpen = $('#menu-open');
  function openDialog(dialog) {
    if (dialog.open) return;
    dialog.showModal(); document.body.classList.add('has-dialog');
    if (dialog === menu) menuOpen.setAttribute('aria-expanded', 'true');
    animate(dialog, [{ opacity: .3, transform: dialog === menu ? 'translateY(-28px) scale(.97)' : 'translateY(24px) scale(.94)' }, { opacity: 1, transform: 'none' }], { duration: 450 });
    if (dialog === menu) $$('nav a', menu).forEach((link, index) => animate(link, [{ opacity: .2, transform: 'translateY(-12px)' }, { opacity: 1, transform: 'none' }], { duration: 350, delay: index * 45 }));
  }
  menuOpen.addEventListener('click', () => openDialog(menu)); $('#photo-open').addEventListener('click', () => openDialog(photo));
  [menu, photo].forEach(dialog => {
    dialog.addEventListener('close', () => { if (!menu.open && !photo.open) document.body.classList.remove('has-dialog'); if (dialog === menu) menuOpen.setAttribute('aria-expanded', 'false'); });
    dialog.addEventListener('click', event => { const r = dialog.getBoundingClientRect(); if (event.target === dialog && (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom)) dialog.close(); });
  });
  $$('nav a', menu).forEach(link => link.addEventListener('click', () => menu.close()));
  matchMedia('(min-width: 801px)').addEventListener('change', event => { if (event.matches && menu.open) menu.close(); });

  const navLinks = $$('[data-nav]'), sections = ['robot', 'about', 'team', 'support'].map(id => document.getElementById(id));
  let navTick = false;
  function syncNavigation() {
    let current = null;
    sections.forEach(section => { if (section.getBoundingClientRect().top <= innerHeight * .42) current = section.id; });
    if (scrollY + innerHeight >= document.documentElement.scrollHeight - 8) current = 'support';
    navLinks.forEach(link => { if (link.dataset.nav === current) link.setAttribute('aria-current', 'location'); else link.removeAttribute('aria-current'); }); navTick = false;
  }
  addEventListener('scroll', () => { if (!navTick) { navTick = true; requestAnimationFrame(syncNavigation); } }, { passive: true }); syncNavigation();
  $('#copy-email').addEventListener('click', async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText('carpentech@carpineni.ro');
      const use = $('#copy-email use'); use.setAttribute('href', '#i-check'); notify('Email copied. Let’s make something happen.'); setTimeout(() => use.setAttribute('href', '#i-copy'), 2200);
    } catch {
      const range = document.createRange(); range.selectNodeContents($('.email-block>a'));
      const selection = getSelection(); selection.removeAllRanges(); selection.addRange(range); notify('Email selected. Copy it with your device’s copy command.');
    }
  });
})();
