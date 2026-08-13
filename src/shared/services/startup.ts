import { createEmptyPlaybackState } from '../constants';
import type { AudioSource, PlaybackState } from '../types';

export function restorePlaybackState(
  previousState: PlaybackState | undefined,
  availableSources: AudioSource[]
): PlaybackState {
  if (!previousState) {
    return createEmptyPlaybackState();
  }

  const currentSourceExists = previousState.currentSourceId
    ? availableSources.some((source) => source.id === previousState.currentSourceId)
    : false;

  const currentSourceId = currentSourceExists ? previousState.currentSourceId : undefined;
  const shouldPause = previousState.status === 'playing' || previousState.status === 'loading';

  return {
    ...createEmptyPlaybackState(),
    ...previousState,
    currentSourceId,
    position: currentSourceId ? previousState.position : 0,
    queueIds: currentSourceId ? previousState.queueIds : [],
    status: currentSourceId ? (shouldPause ? 'paused' : previousState.status) : 'idle',
    error: undefined
  };
}
