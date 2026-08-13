import { extractOriginPattern } from '../utils';

export async function requestRemoteImportPermission(
  url: string,
  permissionsApi: Pick<typeof chrome.permissions, 'request'> = chrome.permissions
): Promise<boolean> {
  const origin = extractOriginPattern(url.trim());
  return permissionsApi.request({ origins: [origin] });
}
