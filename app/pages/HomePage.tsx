import { Link } from 'react-router';
import { Sword, UserPlus, Plus, ChevronRight, Clock, MapPin } from 'lucide-react';
import { useGameStore } from '../data/gameStore';
import { MODULES } from '../data/gameData';
import { ImageWithFallback } from '../components/figma/ImageWithFallback';

function ModuleCard({ module }: { module: typeof MODULES[0] }) {
  return (
    <Link
      to={`/character/create?module=${module.id}`}
      className="group rounded-xl overflow-hidden bg-[#16213e] border border-[#1a1a4e] hover:border-amber-500/50 transition-all hover:scale-[1.02]"
    >
      <div className="aspect-[3/4] relative overflow-hidden">
        <ImageWithFallback
          src={module.image}
          alt={module.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
        <div className="absolute top-2 left-2 flex gap-1">
          <span className={`px-2 py-0.5 rounded text-xs ${
            module.type === 'dnd' ? 'bg-red-600/90' : 'bg-green-700/90'
          }`}>
            {module.type === 'dnd' ? 'D&D' : 'CoC'}
          </span>
          <span className="px-2 py-0.5 rounded text-xs bg-amber-600/90">{module.difficulty}</span>
        </div>
        <div className="absolute bottom-0 left-0 right-0 p-3">
          <p className="text-xs text-gray-400">{module.publisher}</p>
          <h3 className="text-white">{module.name}</h3>
        </div>
      </div>
      <div className="p-3">
        <p className="text-gray-400 text-sm line-clamp-2">{module.description}</p>
        <p className="text-emerald-400 mt-2">{module.price}</p>
      </div>
    </Link>
  );
}

export function HomePage() {
  const { isNewUser, adventures, characters } = useGameStore();

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {isNewUser ? (
        /* New User View */
        <>
          <div className="text-center mb-12">
            <h1 className="text-4xl text-amber-400 mb-3">欢迎来到 TRPG Solo</h1>
            <p className="text-gray-400 text-lg">开始你的文字冒险之旅，选择以下方式开始</p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 mb-16">
            {/* Start Adventure */}
            <Link
              to="/modules"
              className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#1a1a4e] to-[#16213e] border border-[#2a2a5e] hover:border-amber-500/50 p-8 transition-all hover:scale-[1.01]"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full -translate-y-8 translate-x-8 group-hover:scale-150 transition-transform duration-500" />
              <Sword className="w-12 h-12 text-amber-400 mb-4" />
              <h2 className="text-2xl text-white mb-2">开始你的第一场冒险</h2>
              <p className="text-gray-400 mb-6">
                浏览可用模组，选择一个故事开始你的冒险旅程。系统会引导你创建角色并进入游戏。
              </p>
              <span className="inline-flex items-center gap-1 text-amber-400 group-hover:gap-2 transition-all">
                选择模组 <ChevronRight className="w-4 h-4" />
              </span>
            </Link>

            {/* Create Character */}
            <Link
              to="/character/create"
              className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#1a1a4e] to-[#16213e] border border-[#2a2a5e] hover:border-purple-500/50 p-8 transition-all hover:scale-[1.01]"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full -translate-y-8 translate-x-8 group-hover:scale-150 transition-transform duration-500" />
              <UserPlus className="w-12 h-12 text-purple-400 mb-4" />
              <h2 className="text-2xl text-white mb-2">创建你的第一个角色</h2>
              <p className="text-gray-400 mb-6">
                先打造一个独特的角色，选择D&D或CoC体系，然后挑选适合的模组进行冒险。
              </p>
              <span className="inline-flex items-center gap-1 text-purple-400 group-hover:gap-2 transition-all">
                创建角色 <ChevronRight className="w-4 h-4" />
              </span>
            </Link>
          </div>

          {/* Recommended Modules */}
          <div className="mb-8">
            <h2 className="text-xl text-white mb-1 flex items-center gap-2">
              <span className="w-1 h-6 bg-amber-400 rounded-full" />
              入门模组
            </h2>
            <p className="text-gray-500 mb-6 ml-3">推荐新手开始的冒险故事</p>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {MODULES.map(m => (
                <ModuleCard key={m.id} module={m} />
              ))}
            </div>
          </div>
        </>
      ) : (
        /* Returning User View */
        <>
          <div className="mb-8">
            <h1 className="text-3xl text-amber-400 mb-1">欢迎回来，冒险者</h1>
            <p className="text-gray-400">继续你的冒险或开始新的旅程</p>
          </div>

          {/* My Adventures */}
          <section className="mb-10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl text-white flex items-center gap-2">
                <span className="w-1 h-6 bg-amber-400 rounded-full" />
                我的冒险
              </h2>
              <Link
                to="/modules"
                className="flex items-center gap-1 text-sm text-amber-400 hover:text-amber-300 transition-colors"
              >
                <Plus className="w-4 h-4" /> 新冒险
              </Link>
            </div>
            {adventures.length === 0 ? (
              <div className="bg-[#16213e] rounded-xl border border-[#1a1a4e] p-8 text-center">
                <p className="text-gray-500">还没有冒险，去开始一场吧！</p>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {adventures.map(adv => (
                  <Link
                    key={adv.id}
                    to={`/game/${adv.id}`}
                    className="group bg-[#16213e] rounded-xl border border-[#1a1a4e] hover:border-amber-500/50 overflow-hidden transition-all"
                  >
                    <div className="h-32 relative overflow-hidden">
                      <ImageWithFallback src={adv.image} alt={adv.moduleName} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#16213e] to-transparent" />
                    </div>
                    <div className="p-4 -mt-6 relative">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs mb-2 ${
                        adv.moduleType === 'dnd' ? 'bg-red-600/90' : 'bg-green-700/90'
                      }`}>
                        {adv.moduleType === 'dnd' ? 'D&D' : 'CoC'}
                      </span>
                      <h3 className="text-white">{adv.moduleName}</h3>
                      <p className="text-sm text-gray-400">角色: {adv.characterName}</p>
                      <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                        <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{adv.currentLocation}</span>
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{adv.lastPlayed}</span>
                      </div>
                      <div className="mt-3 w-full bg-gray-700 rounded-full h-1.5">
                        <div className="bg-amber-400 h-1.5 rounded-full" style={{ width: `${adv.progress}%` }} />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>

          {/* My Characters */}
          <section className="mb-10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl text-white flex items-center gap-2">
                <span className="w-1 h-6 bg-purple-400 rounded-full" />
                我的角色
              </h2>
              <Link
                to="/character/create"
                className="flex items-center gap-1 text-sm text-purple-400 hover:text-purple-300 transition-colors"
              >
                <Plus className="w-4 h-4" /> 新角色
              </Link>
            </div>
            {characters.length === 0 ? (
              <div className="bg-[#16213e] rounded-xl border border-[#1a1a4e] p-8 text-center">
                <p className="text-gray-500">还没有角色，去创建一个吧！</p>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                {characters.map(char => (
                  <Link
                    key={char.id}
                    to={`/modules?type=${char.type}`}
                    className="bg-[#16213e] rounded-xl border border-[#1a1a4e] hover:border-purple-500/50 p-4 transition-all"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-12 h-12 rounded-full bg-[#533483] flex items-center justify-center text-xl">
                        {char.avatar}
                      </div>
                      <div>
                        <h3 className="text-white">{char.name}</h3>
                        <p className="text-xs text-gray-400">
                          {char.type === 'dnd' ? `${char.race} ${char.class}` : char.occupation} Lv.{char.level}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        char.type === 'dnd' ? 'bg-red-600/50 text-red-300' : 'bg-green-700/50 text-green-300'
                      }`}>
                        {char.type === 'dnd' ? 'D&D' : 'CoC'}
                      </span>
                      <span className="text-xs text-gray-500">HP {char.hp}/{char.maxHp}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>

          {/* Recommended Modules */}
          <section>
            <h2 className="text-xl text-white mb-1 flex items-center gap-2">
              <span className="w-1 h-6 bg-emerald-400 rounded-full" />
              推荐模组
            </h2>
            <p className="text-gray-500 mb-4 ml-3">发现更多冒险</p>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {MODULES.map(m => (
                <ModuleCard key={m.id} module={m} />
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
