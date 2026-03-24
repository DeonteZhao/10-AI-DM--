import { Mountains, Fire, Bank, Ghost, Skull } from '@phosphor-icons/react';

export function ModuleImagePlaceholder({ moduleId, className = "" }: { moduleId: string, className?: string }) {
  const getIcon = () => {
    switch (moduleId) {
      case 'dnd-frozen-sick': 
        return <Mountains className="w-16 h-16 text-[var(--bg-color)] drop-shadow-[2px_2px_0_var(--ink-color)]" weight="fill" />;
      case 'dnd-dragon-lair': 
        return <Fire className="w-16 h-16 text-[var(--bg-color)] drop-shadow-[2px_2px_0_var(--ink-color)]" weight="fill" />;
      case 'dnd-ruins': 
        return <Bank className="w-16 h-16 text-[var(--bg-color)] drop-shadow-[2px_2px_0_var(--ink-color)]" weight="fill" />;
      case 'coc-haunted-house': 
        return <Ghost className="w-16 h-16 text-[var(--bg-color)] drop-shadow-[2px_2px_0_var(--ink-color)]" weight="fill" />;
      case 'coc-dark-cult': 
        return <Skull className="w-16 h-16 text-[var(--bg-color)] drop-shadow-[2px_2px_0_var(--ink-color)]" weight="fill" />;
      default: 
        return <Mountains className="w-16 h-16 text-[var(--bg-color)] drop-shadow-[2px_2px_0_var(--ink-color)]" weight="fill" />;
    }
  };

  return (
    <div className={`w-full h-full bg-[var(--ink-color)] relative flex items-center justify-center overflow-hidden ${className}`}>
      <div 
        className="absolute inset-0 opacity-20" 
        style={{ 
          backgroundImage: 'linear-gradient(45deg, var(--bg-color) 25%, transparent 25%, transparent 75%, var(--bg-color) 75%, var(--bg-color)), linear-gradient(45deg, var(--bg-color) 25%, transparent 25%, transparent 75%, var(--bg-color) 75%, var(--bg-color))', 
          backgroundSize: '16px 16px',
          backgroundPosition: '0 0, 8px 8px'
        }} 
      />
      <div className="relative z-10 group-hover:scale-110 transition-transform duration-300">
        {getIcon()}
      </div>
    </div>
  );
}
