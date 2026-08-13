import type { RuntimeMessage, RuntimeMessageResponse, RuntimeState } from '../types';

interface StateUpdatedMessage {
  type: 'STATE_UPDATED';
  state: RuntimeState;
}

export async function sendRuntimeMessage(message: RuntimeMessage): Promise<RuntimeMessageResponse> {
  return chrome.runtime.sendMessage(message) as Promise<RuntimeMessageResponse>;
}

export function subscribeToRuntimeState(listener: (state: RuntimeState) => void): () => void {
  const runtimeListener = (message: unknown) => {
    const payload = message as Partial<StateUpdatedMessage> | undefined;
    if (payload?.type === 'STATE_UPDATED' && payload.state) {
      listener(payload.state);
    }
  };

  chrome.runtime.onMessage.addListener(runtimeListener as Parameters<typeof chrome.runtime.onMessage.addListener>[0]);

  return () => {
    chrome.runtime.onMessage.removeListener(
      runtimeListener as Parameters<typeof chrome.runtime.onMessage.removeListener>[0]
    );
  };
}
