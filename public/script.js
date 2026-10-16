(function () {
  // Reveal animations and animated counters on scroll
  const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) {
        return;
      }

      const target = entry.target;
      target.classList.add('in');

      // Animate numerical counters
      const numberElements = target.querySelectorAll('[data-n]');
      numberElements.forEach(el => {
        const targetNumber = Number(el.dataset.n);
        const startTime = performance.now();
        const duration = 1100;

        function animateNumber(now) {
          const progress = Math.min((now - startTime) / duration, 1);
          const easeOutCubic = 1 - Math.pow(1 - progress, 3);
          el.textContent = Math.round(targetNumber * easeOutCubic);

          if (progress < 1) {
            requestAnimationFrame(animateNumber);
          }
        }

        animateNumber(startTime);
      });

      // Animate progress bar widths
      const progressElements = target.querySelectorAll('[data-w]');
      progressElements.forEach(el => {
        el.style.width = el.dataset.w + '%';
      });

      observer.unobserve(target);
    });
  }, { threshold: 0.15 });

  document.querySelectorAll('.rv, .progress').forEach(el => {
    revealObserver.observe(el);
  });

  // Navigation scroll spy
  const sectionIds = ['home', 'about', 'robot', 'team', 'join'];
  let forcedSectionId = null;
  let scrollTick = 0;

  function setActiveNavLink(id) {
    document.querySelectorAll('[data-s]').forEach(link => {
      link.classList.toggle('on', link.dataset.s === id);
    });
  }

  function updateScrollSpy() {
    if (forcedSectionId) {
      return;
    }

    const docElement = document.documentElement;
    let currentId = 'home';

    // Highlight the last section if scrolled to the bottom
    if (window.innerHeight + window.scrollY >= docElement.scrollHeight - 6) {
      currentId = 'join';
    } else {
      sectionIds.forEach(id => {
        const section = document.getElementById(id);
        if (section && section.getBoundingClientRect().top <= window.innerHeight * 0.45) {
          currentId = id;
        }
      });
    }

    setActiveNavLink(currentId);
  }

  window.addEventListener('scroll', () => {
    if (!scrollTick) {
      scrollTick = requestAnimationFrame(() => {
        scrollTick = 0;
        updateScrollSpy();
      });
    }
  }, { passive: true });

  // Reset forced section lock when user manually scrolls or touches
  ['wheel', 'touchstart', 'keydown', 'pointerdown'].forEach(eventType => {
    window.addEventListener(eventType, () => {
      forcedSectionId = null;
    }, { passive: true });
  });

  // Jump to section and lock highlight when a nav link is clicked
  document.querySelectorAll('[data-s]').forEach(link => {
    link.addEventListener('click', () => {
      forcedSectionId = link.dataset.s;
      setActiveNavLink(forcedSectionId);
    });
  });

  updateScrollSpy();

  // Mobile bottom navigation indicator animation
  const bottomNav = document.querySelector('.nav-b');
  if (bottomNav) {
    const indicator = bottomNav.querySelector('.nav-ind');
    let currentActiveLink = null;
    let indicatorState = { left: 0, right: 0 };
    let indicatorRafId = 0;

    function renderIndicator(left, right, verticalOffset) {
      indicator.style.left = left + 'px';
      indicator.style.width = (right - left) + 'px';
      const inset = (8 + verticalOffset) + 'px';
      indicator.style.top = inset;
      indicator.style.bottom = inset;
    }

    function positionIndicator(linkElement, animate) {
      if (!linkElement) {
        return;
      }

      const navLinks = Array.from(bottomNav.querySelectorAll('a'));
      const navStyles = getComputedStyle(bottomNav);
      const paddingLeft = parseFloat(navStyles.paddingLeft) || 8;
      const columnGap = parseFloat(navStyles.columnGap) || 2;

      const linkStyles = getComputedStyle(linkElement);
      const linkPaddingLeft = parseFloat(linkStyles.paddingLeft) || 12;
      const iconWidth = linkElement.querySelector('.ms').offsetWidth + 2 * linkPaddingLeft;
      const labelElement = linkElement.querySelector('.lb');
      const labelWidth = labelElement ? Math.min(labelElement.scrollWidth, 90) : 0;

      const targetLeft = paddingLeft + navLinks.indexOf(linkElement) * (iconWidth + columnGap);
      const targetRight = targetLeft + iconWidth + 8 + labelWidth;

      cancelAnimationFrame(indicatorRafId);

      if (!currentActiveLink || !animate) {
        indicator.style.transition = 'none';
        renderIndicator(targetLeft, targetRight, 0);
        indicatorState = { left: targetLeft, right: targetRight };
        currentActiveLink = linkElement;
        return;
      }

      if (linkElement === currentActiveLink) {
        return;
      }

      // Fluid pill animation: leading edge expands first, trailing edge catches up
      const startState = indicatorState;
      const startTime = performance.now();
      const duration = 400;
      const movingRight = targetRight > startState.right;

      function easeOutCubic(t) {
        return 1 - Math.pow(1 - t, 3);
      }

      function easeInOutCubic(t) {
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      }

      function stepAnimation(now) {
        const elapsed = Math.min((now - startTime) / duration, 1);
        const leadingProgress = easeOutCubic(Math.min(1, elapsed / 0.55));
        const trailingProgress = easeInOutCubic(Math.max(0, (elapsed - 0.3) / 0.7));

        let currentLeft;
        let currentRight;

        if (movingRight) {
          currentRight = startState.right + (targetRight - startState.right) * leadingProgress;
          currentLeft = startState.left + (targetLeft - startState.left) * trailingProgress;
        } else {
          currentLeft = startState.left + (targetLeft - startState.left) * leadingProgress;
          currentRight = startState.right + (targetRight - startState.right) * trailingProgress;
        }

        indicatorState = { left: currentLeft, right: currentRight };
        const bounceOffset = 5 * Math.sin(Math.PI * elapsed);
        renderIndicator(currentLeft, currentRight, bounceOffset);

        if (elapsed < 1) {
          indicatorRafId = requestAnimationFrame(stepAnimation);
        } else {
          indicatorState = { left: targetLeft, right: targetRight };
          renderIndicator(targetLeft, targetRight, 0);
        }
      }

      indicatorRafId = requestAnimationFrame(stepAnimation);
      currentActiveLink = linkElement;
    }

    // Observe active class changes on navigation links
    const navObserver = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        if (mutation.target.classList.contains('on')) {
          positionIndicator(mutation.target, true);
        }
      });
    });

    navObserver.observe(bottomNav, {
      attributes: true,
      attributeFilter: ['class'],
      subtree: true
    });

    function resyncIndicator() {
      const activeLink = bottomNav.querySelector('a.on');
      if (activeLink) {
        currentActiveLink = null;
        positionIndicator(activeLink, false);
      }
    }

    window.addEventListener('resize', resyncIndicator);
    window.addEventListener('load', resyncIndicator);
  }

  // Dark and light theme toggle
  const themeToggle = document.getElementById('theme');
  if (themeToggle) {
    let themeTimeout = null;

    themeToggle.addEventListener('click', () => {
      const root = document.documentElement;
      const isDark = root.dataset.theme
        ? root.dataset.theme === 'dark'
        : window.matchMedia('(prefers-color-scheme: dark)').matches;

      root.classList.add('theme-anim');
      root.dataset.theme = isDark ? 'light' : 'dark';

      clearTimeout(themeTimeout);
      themeTimeout = setTimeout(() => {
        root.classList.remove('theme-anim');
      }, 600);
    });
  }

  // Robot details modal dialog
  const robotDialog = document.getElementById('robot-dialog');
  const openRobotButton = document.getElementById('robot-open');
  const closeRobotButton = document.getElementById('robot-close');

  if (robotDialog && openRobotButton && closeRobotButton) {
    let openingRobotDialog = false;

    openRobotButton.addEventListener('click', () => {
      if (openingRobotDialog || robotDialog.open) {
        return;
      }

      openingRobotDialog = true;
      const robotCard = openRobotButton.closest('.robot-card');
      robotCard?.classList.add('is-opening');

      const delay = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 140;
      window.setTimeout(() => {
        robotDialog.showModal();
        robotCard?.classList.remove('is-opening');
        openingRobotDialog = false;
      }, delay);
    });

    closeRobotButton.addEventListener('click', () => {
      robotDialog.close();
    });

    robotDialog.addEventListener('close', () => {
      openRobotButton.closest('.robot-card')?.classList.remove('is-opening');
      openingRobotDialog = false;
    });

    robotDialog.addEventListener('click', event => {
      const bounds = robotDialog.getBoundingClientRect();
      const clickIsOutside = event.clientX < bounds.left || event.clientX > bounds.right
        || event.clientY < bounds.top || event.clientY > bounds.bottom;

      if (event.target === robotDialog && clickIsOutside) {
        robotDialog.close();
      }
    });

    // Keep Escape from dismissing the dialog.
    robotDialog.addEventListener('cancel', event => {
      event.preventDefault();
    });
  }
})();

