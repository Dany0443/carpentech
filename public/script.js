(() => {
  'use strict';

  const root = document.documentElement;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const systemDark = matchMedia('(prefers-color-scheme: dark)');

  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
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
    '#theme-toggle, #menu-open, #photo-open, #copy-email, .robot-segments, .team-filters, .contact-intents',
  ).forEach((element) => {
    element.hidden = false;
  });

  let snackbarTimer;

  function notify(message) {
    const snackbar = $('#snackbar');

    clearTimeout(snackbarTimer);
    snackbar.textContent = message;
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
      link.dataset.email === 'partner' ? emailUrl('Partnership with CarpenTech') : emailUrl();
  });
  $('[data-email-address]').textContent = emailAddress;

  const themeButton = $('#theme-toggle');
  const isDark = () => (root.dataset.theme ? root.dataset.theme === 'dark' : systemDark.matches);

  function syncThemeControl() {
    const dark = isDark();

    themeButton.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
    themeButton.setAttribute('aria-pressed', String(dark));
    $('use', themeButton).setAttribute('href', dark ? '#i-sun' : '#i-moon');
    $('meta[name="theme-color"]').setAttribute('content', dark ? '#111b15' : '#f5f7f1');
  }

  themeButton.addEventListener('click', () => {
    const next = isDark() ? 'light' : 'dark';
    const update = () => {
      root.dataset.theme = next;
      store('carpentech-theme', next);
      syncThemeControl();
    };

    if (document.startViewTransition && motionAllowed()) {
      document.startViewTransition(update);
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
    explorerImage.alt =
      button.dataset.system === 'drive'
        ? 'Zoomed view of the robot drivetrain, wheels, and mechanical connections'
        : button.dataset.system === 'control'
          ? 'Zoomed view of the robot’s REV control hubs and wiring'
          : 'A closer view of robot 28287, showing its frame and components';
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

  const teamButtons = $$('[data-team-filter]');
  const members = $$('.member-card');

  teamButtons.forEach((button) =>
    button.addEventListener('click', () => {
      if (button.getAttribute('aria-pressed') === 'true') {
        return;
      }

      const before = new Map(
        members
          .filter((member) => !member.hidden)
          .map((member) => [member, member.getBoundingClientRect()]),
      );
      const area = button.dataset.teamFilter;

      teamButtons.forEach((element) =>
        element.setAttribute('aria-pressed', String(element === button)),
      );

      members.forEach((member) => {
        activeAnimations.get(member)?.cancel();

        const areas = member.dataset.teamArea.split(' ');

        member.hidden = area !== 'all' && !areas.includes(area);
      });

      const visible = members.filter((member) => !member.hidden);
      const after = new Map(visible.map((member) => [member, member.getBoundingClientRect()]));

      visible.forEach((member) => {
        const previous = before.get(member);
        const current = after.get(member);

        animate(
          member,
          [
            {
              opacity: previous ? 1 : 0,
              transform: previous
                ? `translate(${previous.left - current.left}px, ${previous.top - current.top}px)`
                : 'translateY(8px)',
            },
            { opacity: 1, transform: 'none' },
          ],
          { easing: motion.spatial },
        );
      });

      $('#team-status').textContent =
        area === 'all'
          ? `${visible.length} team members`
          : `${visible.length} in ${button.textContent.trim()}`;
    }),
  );
  arrowGroup(teamButtons);

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

  intentButtons.forEach((button) =>
    button.addEventListener('click', () => {
      if (button.getAttribute('aria-pressed') === 'true') {
        return;
      }

      intentButtons.forEach((element) =>
        element.setAttribute('aria-pressed', String(element === button)),
      );

      const intent = intents[button.dataset.intent];
      const link = $('#intent-email');

      $('#intent-description').textContent = intent.description;
      link.firstChild.textContent = intent.action;
      link.href = emailUrl(intent.subject, intent.body);
      revealContent($('#intent-description'));
    }),
  );
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
  $('#photo-open').addEventListener('click', () => openDialog(photo));
  [menu, photo].forEach((dialog) => {
    dialog.addEventListener('close', () => {
      if (!menu.open && !photo.open) {
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
  const sections = ['robot', 'about', 'team', 'support'].map((id) => document.getElementById(id));
  let navTick = false;

  function syncNavigation() {
    let current = null;

    sections.forEach((section) => {
      if (section.getBoundingClientRect().top <= innerHeight * 0.42) {
        current = section.id;
      }
    });

    if (scrollY + innerHeight >= document.documentElement.scrollHeight - 8) {
      current = 'support';
    }

    navLinks.forEach((link) => {
      if (link.dataset.nav === current) {
        link.setAttribute('aria-current', 'location');
      } else {
        link.removeAttribute('aria-current');
      }
    });

    navTick = false;
  }

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

  $('#copy-email').addEventListener('click', async () => {
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
