import { createState } from '../js/data.mjs';

export function freshState() {
  return createState();
}

export function forceEventReady(state) {
  state.eventHistory = [];
}
