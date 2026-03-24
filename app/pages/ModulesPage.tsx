import { useState } from 'react';
import { useSearchParams, Link } from 'react-router';
import { Filter } from 'lucide-react';
import { MODULES } from '../data/gameData';
import { ImageWithFallback } from '../components/figma/ImageWithFallback';
import type { ModuleType } from '../data/gameData';

export function ModulesPage() {
  const [searchParams] = useSearchParams();
  const typeFilter = searchParams.get('type') as ModuleType | null;
  const [filter, setFilter] = useState<'all' | 'dnd' | 'coc'>(typeFilter || 'all');

  const filtered = filter === 'all' ? MODULES : MODULES.filter(m => m.type === filter);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl text-amber-400">选择模组</h1>
          <p className="text-gray-400 mt-1">选择一个故事，开始你的冒险</p>
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          {(['all', 'dnd', 'coc'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                filter === f
                  ? 'bg-amber-500 text-black'
                  : 'bg-[#16213e] text-gray-400 hover:text-white'
              }`}
            >
              {f === 'all' ? '全部' : f === 'dnd' ? 'D&D' : 'CoC'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map(module => (
          <Link
            key={module.id}
            to={`/character/create?module=${module.id}`}
            className="group bg-[#16213e] rounded-xl border border-[#1a1a4e] hover:border-amber-500/50 overflow-hidden transition-all hover:scale-[1.01]"
          >
            <div className="h-48 relative overflow-hidden">
              <ImageWithFallback
                src={module.image}
                alt={module.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#16213e] via-transparent to-transparent" />
              <div className="absolute top-3 left-3 flex gap-2">
                <span className={`px-2 py-0.5 rounded text-xs ${
                  module.type === 'dnd' ? 'bg-red-600/90' : 'bg-green-700/90'
                }`}>
                  {module.type === 'dnd' ? 'D&D' : 'CoC'}
                </span>
                <span className="px-2 py-0.5 rounded text-xs bg-amber-600/90">{module.difficulty}</span>
              </div>
            </div>
            <div className="p-4">
              <p className="text-xs text-gray-500 mb-1">{module.publisher}</p>
              <h3 className="text-lg text-white mb-2">{module.name}</h3>
              <p className="text-gray-400 text-sm line-clamp-2 mb-3">{module.description}</p>
              <div className="flex items-center justify-between">
                <div className="flex gap-1">
                  {module.tags.map(tag => (
                    <span key={tag} className="px-2 py-0.5 rounded-full text-xs bg-[#0f0f23] text-gray-400">
                      {tag}
                    </span>
                  ))}
                </div>
                <span className="text-emerald-400">{module.price}</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
