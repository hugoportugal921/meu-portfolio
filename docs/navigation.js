export function setupNavigation({ body, sidebar, shell, toggle, closeButton, backdrop, skipLink, main, mobileQuery, keyboardTarget }) {
  let open = false;
  const listeners = [];
  const listen = (target, event, handler) => {
    target.addEventListener(event, handler);
    listeners.push(() => target.removeEventListener(event, handler));
  };
  function setOpen(next, restoreFocus = false) {
    open = mobileQuery.matches && Boolean(next);
    body.classList.toggle('menu-open', open);
    sidebar.inert = mobileQuery.matches && !open;
    shell.inert = open;
    if (sidebar.inert) sidebar.setAttribute('aria-hidden', 'true');
    else sidebar.removeAttribute('aria-hidden');
    toggle.setAttribute('aria-expanded', String(open));
    backdrop.hidden = !open;
    if (open) closeButton.focus();
    else if (restoreFocus) toggle.focus();
  }
  listen(toggle, 'click', () => setOpen(!open));
  listen(closeButton, 'click', () => setOpen(false, true));
  listen(backdrop, 'click', () => setOpen(false, true));
  listen(sidebar, 'click', event => {
    if (event.target.closest('a[href^="#"]') && open) {
      setOpen(false);
      main.focus({ preventScroll: true });
    }
  });
  listen(skipLink, 'click', event => {
    event.preventDefault();
    setOpen(false);
    main.focus();
  });
  listen(keyboardTarget, 'keydown', event => {
    if (event.key === 'Escape' && open) { event.preventDefault(); setOpen(false, true); }
    if (event.key === 'Tab' && open) {
      const controls = [...sidebar.querySelectorAll('a[href],button:not([disabled])')];
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && keyboardTarget.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && keyboardTarget.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  });
  listen(mobileQuery, 'change', () => setOpen(false));
  setOpen(false);
  return {
    close: () => setOpen(false),
    destroy() { for (const remove of listeners) remove(); setOpen(false); sidebar.inert = false; sidebar.removeAttribute('aria-hidden'); },
  };
}
