import { useState } from "react";
import { formatDurationDelta } from "../../core/lyricMatch";
import type { LyricHit, PickList } from "../../shared/pick";
import { BackIcon, IconButton } from "./icons";

export function PickSong({
  pick,
  busy,
  error,
  onSearch,
  onUse,
  onSkip,
  onBack,
}: {
  pick: PickList;
  busy: boolean;
  error: string;
  onSearch: (fields: { title: string; artist: string; lockTitle: boolean; lockArtist: boolean }) => void;
  onUse: (key: string, remember: boolean) => void;
  onSkip: () => void;
  onBack: () => void;
}) {
  const [title, setTitle] = useState(pick.title);
  const [artist, setArtist] = useState(pick.artist);
  const [lockTitle, setLockTitle] = useState(false);
  const [lockArtist, setLockArtist] = useState(false);
  const [selected, setSelected] = useState(pick.hits[0]?.key ?? "");
  const [remember, setRemember] = useState(true);

  return (
    <main>
      <header className="topbar">
        <IconButton label="返回" onClick={onBack}>
          <BackIcon />
        </IconButton>
        <h1>選擇歌詞</h1>
      </header>
      <p className="status">同名歌可能有不同版本。揀一條，可以記住。</p>
      {pick.reason ? <p className="meta">{pick.reason}</p> : null}
      <div className="card">
        <div className="row">
          <label>
            歌名
            <input type="text" value={title} onChange={(event) => setTitle(event.target.value)} />
          </label>
          <label className="lock">
            <input type="checkbox" checked={lockTitle} onChange={(event) => setLockTitle(event.target.checked)} />
            鎖
          </label>
        </div>
        <div className="row">
          <label>
            歌手
            <input type="text" value={artist} onChange={(event) => setArtist(event.target.value)} />
          </label>
          <label className="lock">
            <input type="checkbox" checked={lockArtist} onChange={(event) => setLockArtist(event.target.checked)} />
            鎖
          </label>
          <button
            type="button"
            disabled={busy || (!title.trim() && !artist.trim())}
            onClick={() => onSearch({ title, artist, lockTitle, lockArtist })}
          >
            再搜
          </button>
        </div>
        <div className="queue hits">
          {pick.hits.length === 0 ? <p className="meta">沒有結果</p> : null}
          {pick.hits.map((hit) => (
            <button
              key={hit.key}
              type="button"
              className={hit.key === selected ? "hit selected" : "hit"}
              onClick={() => setSelected(hit.key)}
              onDoubleClick={() => onUse(hit.key, remember)}
            >
              <span>{hit.title}</span>
              <span className="sub">{hitLine(hit)}</span>
            </button>
          ))}
        </div>
        {error ? <p className="error">{error}</p> : null}
        <div className="row">
          <label className="lock">
            <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />
            記住呢首歌
          </label>
          <button type="button" disabled={busy || !selected} onClick={() => onUse(selected, remember)}>
            使用
          </button>
          <button type="button" disabled={busy} onClick={onSkip}>
            直接預覽
          </button>
        </div>
      </div>
    </main>
  );
}

function hitLine(hit: LyricHit): string {
  const artist = hit.artist || "未知歌手";
  return `${hit.source} · ${artist} · ${formatDurationDelta(hit.deltaMs)}`;
}
