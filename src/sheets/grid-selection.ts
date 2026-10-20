import {
  addressName,
  parseAddress,
  rangeBounds,
} from '../spreadsheet/address.js';

export function gridSelection(
  grid: HTMLElement,
  initial: string,
  select: (key: string) => boolean,
) {
  let anchor = initial;
  let end = initial;
  let pointer: number | null = null;
  let suppressClick = false;
  const paint = () => {
    const bounds = rangeBounds(parseAddress(anchor), parseAddress(end));
    for (const cell of grid.querySelectorAll<HTMLElement>('[data-cell]')) {
      const ref = parseAddress(cell.dataset.cell!);
      cell.classList.toggle(
        'selected-range',
        ref.row >= bounds.top &&
          ref.row < bounds.top + bounds.rows &&
          ref.column >= bounds.left &&
          ref.column < bounds.left + bounds.columns,
      );
    }
  };
  const extend = (key: string) => {
    end = key;
    paint();
  };
  grid.addEventListener('pointerdown', event => {
    const target = (event.target as Element).closest<HTMLElement>(
      '[data-cell]',
    );
    if (
      !target ||
      event.button !== 0 ||
      event.target instanceof HTMLInputElement
    )
      return;
    const previous = anchor;
    if (!select(target.dataset.cell!)) return;
    anchor = event.shiftKey ? previous : target.dataset.cell!;
    end = target.dataset.cell!;
    pointer = event.pointerId;
    suppressClick = true;
    grid.setPointerCapture(pointer);
    event.preventDefault();
    paint();
  });
  grid.addEventListener('pointermove', event => {
    if (event.pointerId !== pointer) return;
    const hit = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest<HTMLElement>('[data-cell]');
    if (hit && grid.contains(hit)) extend(hit.dataset.cell!);
  });
  const stop = () => {
    pointer = null;
  };
  grid.addEventListener('pointerup', event => {
    if (event.pointerId !== pointer) return;
    if (grid.hasPointerCapture(pointer)) grid.releasePointerCapture(pointer);
    stop();
  });
  grid.addEventListener('pointercancel', stop);
  grid.addEventListener('lostpointercapture', stop);
  grid.addEventListener(
    'click',
    event => {
      if (!suppressClick || !event.isTrusted) return;
      suppressClick = false;
      event.stopImmediatePropagation();
    },
    true,
  );
  return {
    reset(key: string) {
      anchor = end = key;
      paint();
    },
    paint,
    get range() {
      return `${anchor}:${end}`;
    },
    move(dx: number, dy: number) {
      const ref = parseAddress(end);
      const key = addressName({
        ...ref,
        row: Math.min(100, Math.max(1, ref.row + dy)),
        column: Math.min(12, Math.max(1, ref.column + dx)),
      });
      extend(key);
      grid.querySelector<HTMLElement>(`[data-cell="${key}"]`)?.scrollIntoView({
        block: 'nearest',
        inline: 'nearest',
        container: 'nearest',
      } as ScrollIntoViewOptions);
    },
  };
}
