export function contextAction(): string {
    return !window.matchMedia('(pointer: fine') ? 'Long-press' : 'Right-click';
}
