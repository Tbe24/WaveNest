import { describe, expect, it, vi } from 'vitest';
import { requestRemoteImportPermission } from '../services/permissions';

describe('requestRemoteImportPermission', () => {
  it('requests the origin pattern for a remote import url', async () => {
    const request = vi.fn().mockResolvedValue(true);
    const granted = await requestRemoteImportPermission('https://feeds.example.com/show.rss', {
      request
    });

    expect(granted).toBe(true);
    expect(request).toHaveBeenCalledWith({
      origins: ['https://feeds.example.com/*']
    });
  });
});
