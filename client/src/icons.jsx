import {
  Award, BookOpen, Compass, Crown, Flame, Footprints, GraduationCap, Handshake, HeartPulse, Leaf, Map, Medal, Mountain,
  Music, ScrollText, Search, ShieldCheck, Sparkles, Star, Sun, Target, Telescope, Tent, Trees, Trophy, Users, Waypoints,
} from 'lucide-react';

/**
 * Ícones de conteúdo (classes, especialidades, cursos) e de medalhas/troféus.
 * O banco guarda só a chave (ex.: "compass"); a interface desenha o ícone.
 */
export const ICONS = {
  compass: [Compass, 'Bússola'],
  handshake: [Handshake, 'Amizade'],
  search: [Search, 'Pesquisa'],
  tent: [Tent, 'Barraca'],
  boots: [Footprints, 'Trilha'],
  map: [Map, 'Mapa'],
  mountain: [Mountain, 'Montanha'],
  trees: [Trees, 'Floresta'],
  leaf: [Leaf, 'Natureza'],
  sun: [Sun, 'Sol'],
  flame: [Flame, 'Fogueira'],
  knot: [Waypoints, 'Nós e cordas'],
  health: [HeartPulse, 'Saúde'],
  telescope: [Telescope, 'Astronomia'],
  book: [BookOpen, 'Livro'],
  scroll: [ScrollText, 'Pergaminho'],
  graduation: [GraduationCap, 'Curso'],
  music: [Music, 'Música'],
  users: [Users, 'Equipe'],
  target: [Target, 'Meta'],
  shield: [ShieldCheck, 'Escudo'],
  medal: [Medal, 'Medalha'],
  award: [Award, 'Distintivo'],
  trophy: [Trophy, 'Troféu'],
  star: [Star, 'Estrela'],
  crown: [Crown, 'Coroa'],
  sparkles: [Sparkles, 'Destaque'],
};

export const CONTENT_ICON_KEYS = ['compass', 'handshake', 'search', 'tent', 'boots', 'map', 'mountain', 'trees', 'leaf', 'sun', 'flame', 'knot', 'health', 'telescope', 'book', 'scroll', 'graduation', 'music', 'users', 'target', 'award', 'medal', 'trophy', 'star'];
export const MEDAL_ICON_KEYS = ['medal', 'trophy', 'award', 'star', 'crown', 'sparkles', 'shield', 'flame', 'tent', 'compass', 'target', 'users'];

/** Desenha um ícone pela chave; aceita também uma imagem enviada (URL). */
export function AppIcon({ name, size = 24, fallback = BookOpen, strokeWidth = 2, className }) {
  if (typeof name === 'string' && name.startsWith('/')) {
    return <img src={name} alt="" style={{ width: size, height: size, objectFit: 'contain' }} className={className} />;
  }
  const Cmp = ICONS[name]?.[0] || fallback;
  return <Cmp size={size} strokeWidth={strokeWidth} className={className} aria-hidden="true" />;
}

export function IconPicker({ keys, value, onChange }) {
  return (
    <div className="icon-picker">
      {keys.map((k) => (
        <button key={k} type="button" title={ICONS[k][1]} aria-label={ICONS[k][1]} className={value === k ? 'active' : ''} onClick={() => onChange(k)}>
          <AppIcon name={k} size={22} />
        </button>
      ))}
    </div>
  );
}
