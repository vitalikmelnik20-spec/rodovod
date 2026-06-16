import { memo } from 'react';
import { Handle, Position, useViewport } from 'reactflow';
import { useNavigate, useParams } from 'react-router-dom';

const AVATAR_COLORS = [
  '#1565C0', '#2E7D32', '#6A1B9A', '#AD1457',
  '#E65100', '#00695C', '#283593', '#4E342E',
];

function getAvatarColor(seed = '') {
  let hash = 0;
  for (const c of seed) hash = c.charCodeAt(0) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

const handleBase = {
  background: 'var(--line-color)',
  width: 8,
  height: 8,
  border: 'none',
};

function PersonNode({ data }) {
  const navigate = useNavigate();
  const { id: treeId } = useParams();
  const { zoom } = useViewport();

  const fullName = [data.first_name, data.last_name].filter(Boolean).join(' ');
  const initials = [data.first_name, data.last_name]
    .filter(Boolean).map(s => s[0]).join('') || '?';
  const avatarColor = getAvatarColor(fullName || String(data.id));

  const birthYear = data.birth_date ? new Date(data.birth_date).getFullYear() : null;
  const deathYear = data.death_date ? new Date(data.death_date).getFullYear() : null;
  const yearsLabel = birthYear
    ? (deathYear ? `${birthYear} — ${deathYear}` : `${birthYear} —`)
    : null;

  const handles = (
    <>
      <Handle type="target" position={Position.Top}    style={handleBase} />
      <Handle type="source" id="left"  position={Position.Left}  style={{ ...handleBase, top: '50%' }} />
      <Handle type="source" id="right" position={Position.Right} style={{ ...handleBase, top: '50%' }} />
      <Handle type="source" position={Position.Bottom} style={handleBase} />
    </>
  );

  // ── Dot view (zoom < 0.4) ───────────────────────────────────────────────
  if (zoom < 0.4) {
    return (
      <>
        {handles}
        <div
          onClick={() => navigate(`/tree/${treeId}/person/${data.id}`)}
          style={{
            width: 28, height: 28, borderRadius: '50%',
            background: avatarColor,
            border: data.highlighted ? '2px solid #F59E0B' : '2px solid var(--card-border)',
            boxShadow: data.highlighted ? '0 0 0 3px #F59E0B60' : undefined,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <span style={{ color: '#fff', fontSize: 9, fontWeight: 700 }}>{initials}</span>
        </div>
      </>
    );
  }

  // ── Compact view (zoom 0.4–0.7) ────────────────────────────────────────
  if (zoom < 0.7) {
    return (
      <>
        {handles}
        <div
          onClick={() => navigate(`/tree/${treeId}/person/${data.id}`)}
          className="person-node"
          style={{
            width: 110,
            background: 'var(--card-bg)',
            border: data.highlighted ? '2px solid #F59E0B' : '1px solid var(--card-border)',
            boxShadow: data.highlighted ? '0 0 0 3px #F59E0B40' : 'var(--card-shadow)',
            borderRadius: 10,
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            padding: '10px 8px 8px',
            cursor: 'pointer',
            userSelect: 'none',
            opacity: !data.is_alive ? 0.8 : 1,
          }}
        >
          <div style={{
            width: 48, height: 48, borderRadius: '50%', overflow: 'hidden',
            marginBottom: 6, background: avatarColor, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {data.avatar_url
              ? <img src={data.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <span style={{ color: '#fff', fontSize: 16, fontWeight: 700 }}>{initials}</span>
            }
          </div>
          <p style={{
            color: 'var(--text-primary)', fontSize: 11, fontWeight: 600,
            textAlign: 'center', lineHeight: 1.2,
            overflow: 'hidden', maxHeight: 26,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
            width: '100%',
          }}>
            {data.first_name || data.last_name || '?'}
          </p>
        </div>
      </>
    );
  }

  // ── Full view 160×200 (zoom ≥ 0.7) ────────────────────────────────────
  const border = data.highlighted
    ? '2px solid #F59E0B'
    : data.is_me
      ? '2px solid var(--accent)'
      : '1px solid var(--card-border)';

  const shadow = data.highlighted
    ? '0 0 0 3px #F59E0B40, var(--card-shadow)'
    : data.is_me
      ? '0 0 0 3px var(--accent-ring), var(--card-shadow)'
      : 'var(--card-shadow)';

  return (
    <>
      {handles}
      <div style={{ position: 'relative', width: 160 }}>
        <div
          onClick={() => navigate(`/tree/${treeId}/person/${data.id}`)}
          className="person-node"
          style={{
            width: 160,
            minHeight: 200,
            background: 'var(--card-bg)',
            border,
            borderRadius: 12,
            boxShadow: shadow,
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            padding: '16px 12px',
            cursor: 'pointer',
            userSelect: 'none',
            opacity: !data.is_alive ? 0.8 : 1,
            transition: 'box-shadow 0.2s, border-color 0.2s',
          }}
        >
          {/* Avatar 80px */}
          <div style={{
            width: 80, height: 80, borderRadius: '50%', overflow: 'hidden',
            marginBottom: 12, background: avatarColor, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            position: 'relative',
          }}>
            {data.avatar_url
              ? <img src={data.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <span style={{ color: '#fff', fontSize: 28, fontWeight: 700 }}>{initials}</span>
            }
            <div style={{
              position: 'absolute', bottom: 3, right: 3,
              width: 11, height: 11, borderRadius: '50%',
              background: data.is_alive ? '#4CAF50' : 'var(--text-secondary)',
              border: '1.5px solid var(--card-bg)',
            }} />
          </div>

          <p style={{
            color: 'var(--text-primary)', fontSize: 14, fontWeight: 600,
            textAlign: 'center', lineHeight: 1.3,
            overflow: 'hidden', display: '-webkit-box',
            WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
            width: '100%', wordBreak: 'break-word',
          }}>
            {[data.first_name, data.patronymic].filter(Boolean).join(' ') || '—'}
          </p>

          {data.last_name && (
            <p style={{
              color: 'var(--text-secondary)', fontSize: 13,
              textAlign: 'center', marginTop: 2,
              overflow: 'hidden', textOverflow: 'ellipsis',
              whiteSpace: 'nowrap', width: '100%',
            }}>
              {data.last_name}
            </p>
          )}

          {yearsLabel && (
            <p style={{ color: 'var(--text-secondary)', fontSize: 12, textAlign: 'center', marginTop: 4 }}>
              {yearsLabel}
            </p>
          )}
        </div>

        {/* ── «+» button — add relative ────────────────────────────────── */}
        {data.onAddRelative && (
          <button
            onClick={e => { e.stopPropagation(); data.onAddRelative(data.id); }}
            style={{
              position: 'absolute',
              bottom: -14,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 28, height: 28,
              borderRadius: '50%',
              background: 'var(--accent)',
              color: '#fff',
              fontSize: 20,
              fontWeight: 300,
              lineHeight: 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '2px solid var(--card-bg)',
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
              zIndex: 10,
            }}
            title="Додати родича"
          >
            +
          </button>
        )}
      </div>
    </>
  );
}

export default memo(PersonNode);
