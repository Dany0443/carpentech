(() => {
  'use strict';

  const root = document.documentElement;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const systemDark = matchMedia('(prefers-color-scheme: dark)');

  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
  const localize = (value) => window.i18n?.t(value) ?? value;
  const motionAllowed = () => !reduceMotion.matches;

  const store = (key, value) => {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* Storage is optional. */
    }
  };

  const motionStyle = getComputedStyle(root);
  const motion = {
    effects: motionStyle.getPropertyValue('--md-sys-motion-easing-emphasized').trim(),
    spatial: CSS.supports('animation-timing-function', 'linear(0, .8, 1)')
      ? motionStyle.getPropertyValue('--motion-spring').trim()
      : motionStyle.getPropertyValue('--md-sys-motion-easing-emphasized').trim(),
    duration: parseFloat(motionStyle.getPropertyValue('--motion-medium')),
    fast: parseFloat(motionStyle.getPropertyValue('--motion-fast')),
    stagger: parseFloat(motionStyle.getPropertyValue('--motion-stagger')),
  };
  const activeAnimations = new WeakMap();

  function animate(element, frames, options = {}) {
    if (!element || !motionAllowed() || !element.animate) {
      return;
    }

    activeAnimations.get(element)?.cancel();

    const animation = element.animate(frames, {
      duration: motion.duration,
      easing: motion.effects,
      ...options,
    });

    activeAnimations.set(element, animation);

    const cleanup = () => {
      if (activeAnimations.get(element) === animation) {
        activeAnimations.delete(element);
      }
    };

    animation.addEventListener('finish', cleanup, { once: true });
    animation.addEventListener('cancel', cleanup, { once: true });

    return animation;
  }

  function revealContent(element) {
    // Continue from the current opacity.
    const opacity = activeAnimations.has(element) ? getComputedStyle(element).opacity : 0.6;

    animate(element, [{ opacity }, { opacity: 1 }]);
  }

  root.classList.add('js');
  $$(
    '#theme-toggle, #menu-open, #photo-open, #copy-email, .robot-segments, .contact-intents',
  ).forEach((element) => {
    element.hidden = false;
  });

  $$('.button').forEach((button) => {
    const release = () => button.classList.remove('is-pressed');

    button.addEventListener('pointerdown', () => button.classList.add('is-pressed'));
    button.addEventListener('pointerup', release);
    button.addEventListener('pointercancel', release);
    button.addEventListener('pointerleave', release);
    button.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        button.classList.add('is-pressed');
      }
    });
    button.addEventListener('keyup', release);
    button.addEventListener('blur', release);
  });

  // Ripple + haptic tick on press.
  const rippleTargets =
    '.button, .social-button, .icon-button, .round-link, .segmented-control button, .contact-intents button, .copy-button, .mobile-menu nav a';

  document.addEventListener(
    'pointerdown',
    (event) => {
      const el = event.target.closest(rippleTargets);

      if (!el || event.button > 0 || !motionAllowed()) {
        return;
      }

      const r = el.getBoundingClientRect();
      const size =
        Math.hypot(
          Math.max(event.clientX - r.left, r.right - event.clientX),
          Math.max(event.clientY - r.top, r.bottom - event.clientY),
        ) * 2;
      const ripple = document.createElement('span');

      ripple.className = 'ripple';
      ripple.style.cssText = `width:${size}px;height:${size}px;left:${event.clientX - r.left - size / 2}px;top:${event.clientY - r.top - size / 2}px`;
      el.append(ripple);
      ripple
        .animate(
          [
            { transform: 'scale(0)', opacity: 0.18 },
            { transform: 'scale(1)', opacity: 0.14, offset: 0.55 },
            { transform: 'scale(1)', opacity: 0 },
          ],
          { duration: 700, easing: motion.effects },
        )
        .finished.then(() => ripple.remove(), () => ripple.remove());
      navigator.vibrate?.(6);
    },
    { passive: true },
  );

  let snackbarTimer;

  function notify(message) {
    const snackbar = $('#snackbar');

    clearTimeout(snackbarTimer);
    snackbar.textContent = localize(message);
    snackbar.classList.add('is-visible');
    snackbarTimer = setTimeout(() => snackbar.classList.remove('is-visible'), 3500);
  }

  reduceMotion.addEventListener('change', () => {
    if (!reduceMotion.matches) {
      return;
    }

    document.getAnimations().forEach((animation) => animation.cancel());
    $$('.animate-in, .reveal-pending').forEach((element) =>
      element.classList.remove('animate-in', 'reveal-pending'),
    );
  });

  const emailAddress = ['carpentech', ['carpineni', 'ro'].join('.')].join('@');

  function emailUrl(subject = '', body = '') {
    // Encode spaces for mail clients.
    const query = subject
      ? `?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
      : '';

    return `mailto:${emailAddress}${query}`;
  }

  $$('[data-email]').forEach((link) => {
    link.href =
      link.dataset.email === 'partner'
        ? emailUrl(localize('Partnership with CarpenTech'))
        : emailUrl();
  });
  $$('[data-email-address]').forEach((element) => {
    element.textContent = emailAddress;
  });

  const themeButton = $('#theme-toggle');
  const isDark = () => (root.dataset.theme ? root.dataset.theme === 'dark' : systemDark.matches);

  function syncThemeControl() {
    const dark = isDark();

    themeButton.setAttribute(
      'aria-label',
      localize(dark ? 'Switch to light theme' : 'Switch to dark theme'),
    );
    themeButton.setAttribute('aria-pressed', String(dark));
    $('use', themeButton).setAttribute('href', dark ? '#i-sun' : '#i-moon');
    $('meta[name="theme-color"]').setAttribute('content', dark ? '#111b15' : '#f5f7f1');
  }

  themeButton.addEventListener('click', (event) => {
    const next = isDark() ? 'light' : 'dark';
    const update = () => {
      root.dataset.theme = next;
      store('carpentech-theme', next);
      syncThemeControl();
    };

    if (!motionAllowed()) {
      update();

      return;
    }

    if (window.i18n?.transitionWithWave) {
      window.i18n.transitionWithWave(update, themeButton, event);
    } else {
      update();
    }
  });

  systemDark.addEventListener('change', syncThemeControl);
  syncThemeControl();

  if ('IntersectionObserver' in window) {
    let keyboardNavigation = false;

    addEventListener('keydown', () => {
      keyboardNavigation = true;
    });
    addEventListener(
      'pointerdown',
      () => {
        keyboardNavigation = false;
      },
      { passive: true },
    );
    addEventListener(
      'wheel',
      () => {
        keyboardNavigation = false;
      },
      { passive: true },
    );

    const observer = new IntersectionObserver(
      (entries) => {
        entries
          .filter((entry) => entry.isIntersecting)
          .forEach((entry, index) => {
            observer.unobserve(entry.target);
            entry.target.classList.remove('reveal-pending');

            if (!motionAllowed() || keyboardNavigation) {
              return;
            }

            entry.target.style.setProperty(
              '--reveal-delay',
              `${Math.min(index, 3) * motion.stagger}ms`,
            );
            entry.target.classList.add('animate-in');
            entry.target.addEventListener(
              'animationend',
              () => entry.target.classList.remove('animate-in'),
              { once: true },
            );
          });
      },
      { threshold: 0.08, rootMargin: '0px 0px -20px 0px' },
    );

    $$('[data-reveal]').forEach((element) => {
      if (motionAllowed() && element.getBoundingClientRect().top >= innerHeight) {
        element.classList.add('reveal-pending');
      }

      observer.observe(element);
    });

    addEventListener('focusin', (event) => {
      const element = event.target.closest('.reveal-pending, .animate-in');

      if (!element) {
        return;
      }

      observer.unobserve(element);
      element.classList.remove('reveal-pending', 'animate-in');
    });
  }

  const systemButtons = $$('[data-system]');
  const robotDetails = $$('[data-robot-detail]');
  const explorerImage = $('#explorer-image');
  const indicator = $('.segment-indicator');
  let selectedSystem = 0;
  const photoViews = {
    overview: 'translate(0%, 0%) scale(1)',
    drive: 'translate(2%, -18%) scale(1.65)',
    control: 'translate(-8%, 20%) scale(1.65)',
  };

  function syncExplorerAlt() {
    const system = systemButtons[selectedSystem]?.dataset.system;
    const alt =
      system === 'drive'
        ? 'Zoomed view of the robot drivetrain, wheels, and mechanical connections'
        : system === 'control'
          ? 'Zoomed view of the robot’s REV control hubs and wiring'
          : 'A closer view of robot 28287, showing its frame and components';

    if (explorerImage) {
      explorerImage.alt = localize(alt);
    }
  }

  robotDetails.forEach((detail, index) => {
    detail.hidden = index !== 0;
  });

  function selectSystem(button) {
    const index = systemButtons.indexOf(button);

    if (index === selectedSystem) {
      return;
    }

    const nextTransform = photoViews[button.dataset.system];

    selectedSystem = index;
    systemButtons.forEach((element) =>
      element.setAttribute('aria-pressed', String(element === button)),
    );
    robotDetails.forEach((detail) => {
      detail.hidden = detail.dataset.robotDetail !== button.dataset.system;
    });
    indicator.style.transform = `translateX(${index * 100}%)`;
    explorerImage.style.transform = nextTransform;
    revealContent($('#robot-insight'));
    syncExplorerAlt();
  }

  systemButtons.forEach((button) => button.addEventListener('click', () => selectSystem(button)));

  function arrowGroup(buttons) {
    buttons.forEach((button, index) =>
      button.addEventListener('keydown', (event) => {
        let next;

        if (event.key === 'ArrowRight') {
          next = (index + 1) % buttons.length;
        }

        if (event.key === 'ArrowLeft') {
          next = (index - 1 + buttons.length) % buttons.length;
        }

        if (event.key === 'Home') {
          next = 0;
        }

        if (event.key === 'End') {
          next = buttons.length - 1;
        }

        if (next === undefined) {
          return;
        }

        event.preventDefault();
        buttons[next].focus();
        buttons[next].click();
      }),
    );
  }

  arrowGroup(systemButtons);

  const intents = {
    partner: {
      description:
        'Have an idea for supporting the team? Let’s talk about a partnership that works for both of us.',
      action: 'Start a conversation',
      subject: 'Partnership with CarpenTech',
      body: 'Hello CarpenTech,\n\nI would like to discuss supporting your team.\n\nMy name / organization:\nHow we could help:\n',
    },
    mentor: {
      description:
        'Have experience in engineering, programming, or communication? Share what you know with students who are ready to learn.',
      action: 'Talk about mentoring',
      subject: 'Mentoring CarpenTech',
      body: 'Hello CarpenTech,\n\nI am interested in mentoring the team.\n\nMy experience:\nHow I could help:\n',
    },
    join: {
      description:
        'Curious about robotics? You don’t need to have all the answers. Get in touch and tell us what you would like to learn.',
      action: 'Ask about joining',
      subject: 'Joining CarpenTech',
      body: 'Hello CarpenTech,\n\nI would like to learn more about joining the team.\n\nMy name:\nWhat interests me:\n',
    },
  };
  const intentButtons = $$('[data-intent]');

  function renderIntent(key, announce = false) {
    const intent = intents[key];
    const description = $('#intent-description');
    const link = $('#intent-email');

    if (!intent || !description || !link) {
      return;
    }

    description.textContent = localize(intent.description);
    link.firstChild.textContent = localize(intent.action);
    link.href = emailUrl(localize(intent.subject), localize(intent.body));

    if (announce) {
      revealContent(description);
    }
  }

  intentButtons.forEach((button) =>
    button.addEventListener('click', () => {
      if (button.getAttribute('aria-pressed') === 'true') {
        return;
      }

      intentButtons.forEach((element) =>
        element.setAttribute('aria-pressed', String(element === button)),
      );

      renderIntent(button.dataset.intent, true);
    }),
  );

  renderIntent(intentButtons.find((button) => button.getAttribute('aria-pressed') === 'true')?.dataset.intent);

  document.addEventListener('i18n:change', () => {
    $$('[data-email]:not(#intent-email)').forEach((link) => {
      link.href =
        link.dataset.email === 'partner'
          ? emailUrl(localize('Partnership with CarpenTech'))
          : emailUrl();
    });
    renderIntent(intentButtons.find((button) => button.getAttribute('aria-pressed') === 'true')?.dataset.intent);
    syncExplorerAlt();
  });

  arrowGroup(intentButtons);
  $$('details').forEach((details) => {
    const summary = $('summary', details);
    const content = $('.details-body', details);
    let expanded = details.open;

    function settle() {
      activeAnimations.get(details)?.cancel();
      activeAnimations.get(content)?.cancel();
      details.open = expanded;
      details.style.removeProperty('height');
      details.style.removeProperty('overflow');
      content.style.removeProperty('opacity');
      content.style.removeProperty('transform');
    }

    summary.addEventListener('click', (event) => {
      event.preventDefault();
      expanded = !expanded;
      details.dataset.state = expanded ? 'open' : 'closed';
      details.toggleAttribute('data-instant', event.detail === 0);
      details.classList.remove('animate-in');

      if (!motionAllowed() || event.detail === 0 || !details.animate) {
        settle();

        return;
      }

      const fromHeight = details.getBoundingClientRect().height;
      const contentStyle = getComputedStyle(content);
      const fromOpacity = activeAnimations.has(content) ? contentStyle.opacity : expanded ? 0 : 1;
      const fromTransform = activeAnimations.has(content)
        ? contentStyle.transform
        : expanded
          ? 'translateY(-12px)'
          : 'none';

      activeAnimations.get(details)?.cancel();
      details.open = true;
      details.style.height = 'auto';

      const toHeight = expanded ? details.getBoundingClientRect().height : summary.offsetHeight;
      const duration = expanded ? motion.duration : motion.fast;

      details.style.height = `${toHeight}px`;
      details.style.overflow = 'clip';

      // Height moves the content below.
      const expansion = animate(
        details,
        [{ height: `${fromHeight}px` }, { height: `${toHeight}px` }],
        { duration },
      );
      const destination = {
        opacity: expanded ? 1 : 0,
        transform: expanded ? 'none' : 'translateY(-12px)',
      };

      content.style.opacity = destination.opacity;
      content.style.transform = destination.transform;
      animate(content, [{ opacity: fromOpacity, transform: fromTransform }, destination], {
        duration,
        easing: motion.spatial,
      });
      expansion.addEventListener('finish', settle, { once: true });
    });

    reduceMotion.addEventListener('change', () => {
      if (reduceMotion.matches) {
        settle();
      }
    });

    // Follow native disclosure changes.
    details.addEventListener('toggle', () => {
      if (activeAnimations.has(details)) {
        return;
      }

      expanded = details.open;
      details.dataset.state = expanded ? 'open' : 'closed';
    });
  });

  const menu = $('#mobile-menu');
  const photo = $('#photo-dialog');
  const menuOpen = $('#menu-open');

  function openDialog(dialog) {
    if (dialog.open) {
      return;
    }

    dialog.showModal();
    document.body.classList.add('has-dialog');

    if (dialog === menu) {
      menuOpen.setAttribute('aria-expanded', 'true');
    }
  }

  menuOpen.addEventListener('click', () => openDialog(menu));
  $('#photo-open')?.addEventListener('click', () => openDialog(photo));
  [menu, photo, $('#lightbox')].filter(Boolean).forEach((dialog) => {
    dialog.addEventListener('close', () => {
      if (!menu.open && !photo?.open && !$('#lightbox')?.open) {
        document.body.classList.remove('has-dialog');
      }

      if (dialog === menu) {
        menuOpen.setAttribute('aria-expanded', 'false');
      }
    });
    dialog.addEventListener('click', (event) => {
      const r = dialog.getBoundingClientRect();

      if (
        event.target === dialog &&
        (event.clientX < r.left ||
          event.clientX > r.right ||
          event.clientY < r.top ||
          event.clientY > r.bottom)
      ) {
        dialog.close();
      }
    });
  });
  $$('nav a', menu).forEach((link) => link.addEventListener('click', () => menu.close()));
  matchMedia('(min-width: 801px)').addEventListener('change', (event) => {
    if (event.matches && menu.open) {
      menu.close();
    }
  });

  const navLinks = $$('[data-nav]');
  // Only links to sections on this page are tracked; other pages have none.
  const sections = navLinks
    .map((link) => document.getElementById(link.dataset.nav))
    .filter(Boolean);
  const header = $('.site-header');
  const nav = $('.primary-nav');
  const pill = document.createElement('span');
  const glide = motion.effects;
  let pillBox = null;
  let currentId = null;
  let navLock = null;
  let lockTimer;
  let navTick = false;
  // Pages without in-page sections (like DECODE) park the pill on the current page link.
  const staticLink = navLinks.length ? null : $('a[aria-current="page"]', nav);

  pill.className = 'nav-pill';
  pill.setAttribute('aria-hidden', 'true');
  nav.prepend(pill);
  nav.classList.add('has-pill');

  // The pill stretches across both links, then snaps onto the new one.
  function placePill(link, animated = true) {
    if (!link) {
      pill.style.opacity = '0';
      pillBox = null;

      return;
    }

    let prev = pillBox;

    if (pill.getAnimations().length) {
      const p = pill.getBoundingClientRect();

      prev = { x: p.left - nav.getBoundingClientRect().left, w: p.width };
      pill.getAnimations().forEach((animation) => animation.cancel());
    }

    const next = { x: link.offsetLeft, w: link.offsetWidth };

    pill.style.width = `${next.w}px`;
    pill.style.transform = `translateX(${next.x}px)`;
    pill.style.opacity = '1';
    pillBox = next;

    if (!animated || !motionAllowed()) {
      return;
    }

    if (prev) {
      const lo = Math.min(prev.x, next.x);
      const hi = Math.max(prev.x + prev.w, next.x + next.w);

      pill.animate(
        [
          { transform: `translateX(${prev.x}px)`, width: `${prev.w}px` },
          { transform: `translateX(${lo}px)`, width: `${hi - lo}px`, offset: 0.38 },
          { transform: `translateX(${next.x}px)`, width: `${next.w}px` },
        ],
        { duration: 460, easing: glide },
      );
    } else {
      pill.animate(
        [
          { transform: `translateX(${next.x}px) scale(0.85)`, opacity: 0 },
          { transform: `translateX(${next.x}px) scale(1)`, opacity: 1 },
        ],
        { duration: 320, easing: glide },
      );
    }
  }

  function setCurrent(id, animated = true) {
    if (id === currentId && (pillBox || !id)) {
      return;
    }

    currentId = id;
    navLinks.forEach((link) => {
      if (link.dataset.nav === id) {
        link.setAttribute('aria-current', 'location');
      } else {
        link.removeAttribute('aria-current');
      }
    });
    placePill(
      navLinks.find((link) => link.dataset.nav === id),
      animated,
    );
  }

  function syncNavigation() {
    let current = null;

    sections.forEach((section) => {
      if (section.getBoundingClientRect().top <= innerHeight * 0.42) {
        current = section.id;
      }
    });

    if (sections.length && scrollY + innerHeight >= document.documentElement.scrollHeight - 8) {
      current = sections.at(-1).id;
    }

    // While a nav click is scrolling, hold the pill on its target instead of hopping through sections.
    setCurrent(navLock ?? current);
    header.classList.toggle('is-scrolled', scrollY > 16);
    navTick = false;
  }

  function releaseNav() {
    clearTimeout(lockTimer);
    navLock = null;
    syncNavigation();
  }

  navLinks.forEach((link) =>
    link.addEventListener('click', () => {
      navLock = link.dataset.nav;
      setCurrent(navLock);
      clearTimeout(lockTimer);
      lockTimer = setTimeout(releaseNav, 1400);
    }),
  );
  addEventListener('scrollend', () => navLock && releaseNav());
  ['wheel', 'touchstart'].forEach((type) =>
    addEventListener(type, () => navLock && releaseNav(), { passive: true }),
  );
  new ResizeObserver(() => {
    const link = (staticLink || navLinks.find((item) => item.dataset.nav === currentId));

    if (link) {
      placePill(link, false);
    }
  }).observe(nav);
  document.fonts?.ready.then(() => {
    const link = (staticLink || navLinks.find((item) => item.dataset.nav === currentId));

    if (link) {
      placePill(link, false);
    }
  });

  addEventListener(
    'scroll',
    () => {
      if (!navTick) {
        navTick = true;
        requestAnimationFrame(syncNavigation);
      }
    },
    { passive: true },
  );

  syncNavigation();

  if (staticLink) {
    placePill(staticLink);
  }

  // Main page -> DECODE: the card photo and title morph into the season hero.
  const decodeNames = {
    '.decode-media': 'decode-photo',
    '.decode-feature h2': 'decode-title',
    '.season-collage .wide': 'decode-photo',
    '.season-copy h1': 'decode-title',
  };
  const nameElements = (on) =>
    Object.entries(decodeNames).forEach(([selector, name]) => {
      const element = $(selector);

      if (element) {
        element.style.viewTransitionName = on ? name : '';
      }
    });
  const isDecode = (url) => new URL(url).pathname.includes('/decode');

  addEventListener('pageswap', (event) => {
    if (event.viewTransition && event.activation?.entry && isDecode(event.activation.entry.url)) {
      nameElements(true);
    }
  });
  addEventListener('pagereveal', (event) => {
    const from = navigation.activation?.from?.url;

    if (event.viewTransition && from && !isDecode(from)) {
      nameElements(true);
      event.viewTransition.finished.finally(() => nameElements(false));
    }
  });
  addEventListener('pageshow', (event) => event.persisted && nameElements(false));

  // Season gallery lightbox.
  const lightbox = $('#lightbox');

  $$('[data-lightbox]').forEach((shot) =>
    shot.addEventListener('click', () => {
      const img = $('img', shot);

      $('img', lightbox).src = img.currentSrc || img.src;
      $('img', lightbox).alt = img.alt;
      $('#lightbox-title').textContent = shot.dataset.lightbox;
      openDialog(lightbox);
    }),
  );

  $('#copy-email')?.addEventListener('click', async () => {
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error('Clipboard unavailable');
      }

      await navigator.clipboard.writeText(emailAddress);

      const use = $('#copy-email use');

      use.setAttribute('href', '#i-check');
      notify('Email copied. Let’s make something happen.');
      setTimeout(() => use.setAttribute('href', '#i-copy'), 2200);
    } catch {
      const range = document.createRange();

      range.selectNodeContents($('.email-block>a'));

      const selection = getSelection();

      selection.removeAllRanges();
      selection.addRange(range);
      notify('Email selected. Copy it with your device’s copy command.');
    }
  });
})();
