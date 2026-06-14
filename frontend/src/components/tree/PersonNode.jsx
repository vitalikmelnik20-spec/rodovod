import { Handle, Position } from 'reactflow';
import { useNavigate, useParams } from 'react-router-dom';

export default function PersonNode({ data }) {
  const navigate = useNavigate();
  const { id: treeId } = useParams();

  const initials = [data.first_name, data.last_name]
    .filter(Boolean).map(s => s[0]).join('') || '?';

  const year = data.birth_date ? new Date(data.birth_date).getFullYear() : null;
  const deathYear = data.death_date ? new Date(data.death_date).getFullYear() : null;

  return (
    <>
      <Handle type="target" position={Position.Top} style={{ background: '#3B82F6', width: 8, height: 8 }} />

      <div onClick={() => navigate(`/tree/${treeId}/person/${data.id}`)}
        className="person-node bg-slate-800 border-2 rounded-2xl overflow-hidden cursor-pointer active:scale-95 transition-all select-none"
        style={{
          width: 110,
          borderColor: data.is_alive ? '#3B82F6' : '#475569',
          boxShadow: data.highlighted ? '0 0 0 3px #3B82F6' : '0 4px 20px rgba(0,0,0,0.5)',
        }}>

        {/* Фото або ініціали */}
        <div className="relative w-full" style={{ height: 80 }}>
          {data.avatar_url ? (
            <img src={data.avatar_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center"
              style={{ background: data.is_alive ? 'linear-gradient(135deg, #1e3a8a, #1d4ed8)' : 'linear-gradient(135deg, #1e293b, #334155)' }}>
              <span className="text-white text-2xl font-bold">{initials}</span>
            </div>
          )}
          {/* Статус */}
          <div className={`absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full border border-slate-800 ${data.is_alive ? 'bg-green-400' : 'bg-slate-500'}`} />
        </div>

        {/* Ім'я і роки */}
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

      <Handle type="source" position={Position.Bottom} style={{ background: '#3B82F6', width: 8, height: 8 }} />
    </>
  );
}
