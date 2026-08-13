import { type ChangeEvent, useState } from 'react';
import type { ImportKind } from '../types';
import { requestRemoteImportPermission } from '../services/permissions';

interface ImportPanelProps {
  onImportRemote(url: string, kind: ImportKind): Promise<void>;
  onImportLocal(rawText: string, kind: ImportKind, title: string): Promise<void>;
}

function inferImportKind(filename: string): ImportKind {
  return filename.endsWith('.m3u') || filename.endsWith('.m3u8') ? 'm3u' : 'rss';
}

export function ImportPanel(props: ImportPanelProps) {
  const [remoteUrl, setRemoteUrl] = useState('');
  const [kind, setKind] = useState<ImportKind>('m3u');
  const [message, setMessage] = useState<string>('');

  async function handleRemoteImport() {
    const normalizedUrl = remoteUrl.trim();

    if (!normalizedUrl) {
      setMessage('Add a playlist or podcast feed URL first.');
      return;
    }

    try {
      const granted = await requestRemoteImportPermission(normalizedUrl);
      if (!granted) {
        setMessage('Host access was denied. You can still import a local file instead.');
        return;
      }

      await props.onImportRemote(normalizedUrl, kind);
      setRemoteUrl('');
      setMessage('Remote source added.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to import that URL.');
    }
  }

  async function handleFileImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const rawText = await file.text();
      await props.onImportLocal(rawText, inferImportKind(file.name), file.name);
      setMessage(`${file.name} imported.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to read that file.');
    } finally {
      event.target.value = '';
    }
  }

  return (
    <section className="section-block">
      <div className="section-block__header">
        <h2>Imports</h2>
        <span>M3U + RSS</span>
      </div>
      <div className="import-panel">
        <div className="import-panel__remote">
          <input
            aria-label="Remote source URL"
            className="text-input"
            placeholder="https://example.com/playlist.m3u"
            value={remoteUrl}
            onChange={(event) => setRemoteUrl(event.target.value)}
          />
          <select
            className="select-input"
            value={kind}
            onChange={(event) => setKind(event.target.value as ImportKind)}
          >
            <option value="m3u">M3U Playlist</option>
            <option value="rss">Podcast RSS</option>
          </select>
          <button className="accent-button" onClick={() => void handleRemoteImport()} type="button">
            Add URL
          </button>
        </div>
        <label className="file-input">
          <span>Import local file</span>
          <input accept=".m3u,.m3u8,.xml,.rss" type="file" onChange={(event) => void handleFileImport(event)} />
        </label>
        {message ? <p className="helper-text">{message}</p> : null}
      </div>
    </section>
  );
}
