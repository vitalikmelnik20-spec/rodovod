import { memo } from 'react';
import { Handle, Position, useViewport } from 'reactflow';
import { useNavigate, useParams } from 'react-router-dom';

function PersonNode({ data }) {
  const navigate = useNavigate();
  const { id: treeId } = useParams();
  const { zoom } = useViewport();

  const initials = [data.first_name, data.last_name]
    .filter(Boolean).map(s => s[0]).join('') || '?';

  const year = data.birth_date ? new Date(data.birth_date).getFullYear() : null;
  const deathYear = data.death_date ? new Date(data.death_date).getFullYear() : null;

  const handleColor = !data.is_alive ? '#475569'
    : data.gender === 'male' ? '#3B82F6'
    : data.gender === 'female' ? '#EC4899'
    : '#0EA5E9';

  const handleStyle = { background: handleColor, width: 8, height: 8 };

  const bgGradient = !data.is_alive
    ? 'linear-gradient(135deg, #1e293b, #334155)'
    : data.gender === 'male'
      ? 'linear-gradient(135deg, #1e3a8a, #1d4ed8)'
      : data.gender === 'female'
        ? 'linear-gradient(135deg, #831843, #be185d)'
        : 'linear-gradient(135deg, #164e63, #0e7490)';

  const handles = (
    <>
      <Handle type="target" position={Position.Top} style={handleStyle} />
      <Handle type="source" id="left" position={Position.Left} style={{ ...handleStyle, top: '50%' }} />
      <Handle type="source" id="right" position={Position.Right} style={{ ...handleStyle, top: '50%' }} />
      <Handle type="source" position={Position.Bottom} style={handleStyle} />
    </>
  );

  // 4.5 LOD — dot view at very low zoom
  if (zoom < 0.4) {
    return (
      <>
        {handles}
        <div
          onClick={() => navigate(`/tree/${treeId}/person/${data.id}`)}
          style={{ width: 28, height: 28, borderRadius: '50%', background: bgGradient, border: `2px solid ${handleColor}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
        >
          <span style={{ color: '#fff', fontSize: 9, fontWeight: 'bold' }}>{initials}</span>
        </div>
      </>
    );
  }

  // 4.5 LOD — compact view at medium zoom
  if (zoom < 0.7) {
    return (
      <>
        {handles}
        <div
          onClick={() => navigate(`/tree/${treeId}/person/${data.id}`)}
          className="person-node bg-slate-800 border-2 rounded-xl overflow-hidden cursor-pointer select-none"
          style={{ width: 90, borderColor: handleColor }}
        >
          <div style={{ height: 55, background: bgGradient, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {data.avatar_url
              ? <img src={data.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <span className="text-white text-xl font-bold">{initials}</span>
            }
          </div>
          <p className="text-white text-xs font-bold truncate px-1.5 py-1 text-center">
            {data.first_name || data.last_name || '?'}
          </p>
        </div>
      </>
    );
  }

  // Full view
  return (
    <>
      {handles}
      <div onClick={() => navigate(`/tree/${treeId}/person/${data.id}`)}
        className="person-node bg-slate-800 border-2 rounded-2xl overflow-hidden cursor-pointer active:scale-95 transition-all select-none"
        style={{
          width: 110,
          borderColor: handleColor,
          boxShadow: data.highlighted ? '0 0 0 3px #3B82F6' : '0 4px 20px rgba(0,0,0,0.5)',
        }}>

        <div className="relative w-full" style={{ height: 80 }}>
          {data.avatar_url ? (
            <img src={data.avatar_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center" style={{ background: bgGradient }}>
              <span className="text-white text-2xl font-bold">{initials}</span>
            </div>
          )}
          <div className={`absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full border border-slate-800 ${data.is_alive ? 'bg-green-400' : 'bg-slate-500'}`} />
        </div>

        <div className="px-2 py-1.5 text-center">
          <p className="text-white text-xs font-bold leading-tight truncate">
            {data.first_name || data.last_name || 'Без імені'}
          </p>
          {data.last_name && data.first_name && (
            <p className="text-slate-400 text-xs truncate">{data.last_name}</p>
          )}
          {year && (
            <p className="text-slate-500 text-xs mt-0.5">
              {year}{deathYear ? ` — ${deathYear}` : ''}
            </p>
          )}
        </div>
      </div>
    </>
  );
}

export default memo(PersonNode);
