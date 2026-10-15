// 40 visuais do Stumble DBV: 20 de menino e 20 de menina. Roupas comportadas (saias e vestidos
// abaixo do joelho ou calça comprida), sem brincos, colares ou outros enfeites.
// hair: curto | topete | raspado | cacheado | coque | rabo | trancas | longo
// hat: bone | chapeu | boina | faixa | capacete | null · extra: lenco | mochila | avental | capa | oculos | null
const M = (id, name, o) => ({ id, name, g: 'm', skin: '#f1c27d', hair: 'curto', hairColor: '#2b1b10', shoes: '#1f2937', bottomType: 'calca', ...o });
const F = (id, name, o) => ({ id, name, g: 'f', skin: '#f1c27d', hair: 'rabo', hairColor: '#2b1b10', shoes: '#1f2937', bottomType: 'saia', ...o });

export const OUTFITS = [
  M('m01', 'Desbravador de gala', { top: '#c8a86b', bottom: '#1f3d2b', hat: 'chapeu', hatColor: '#8b6b3d', extra: 'lenco', extraColor: '#facc15' }),
  M('m02', 'Campista', { top: '#ea580c', bottom: '#a8875a', bottomType: 'bermuda', hat: 'bone', hatColor: '#166534', skin: '#c68642' }),
  M('m03', 'Explorador', { top: '#4d7c0f', bottom: '#78350f', extra: 'mochila', extraColor: '#b45309', hair: 'topete' }),
  M('m04', 'Atleta azul', { top: '#2563eb', bottom: '#1e3a8a', hat: 'faixa', hatColor: '#f8fafc', skin: '#8d5524', hair: 'raspado' }),
  M('m05', 'Atleta vermelho', { top: '#dc2626', bottom: '#111827', bottomType: 'bermuda', hair: 'cacheado', skin: '#c68642' }),
  M('m06', 'Montanhista', { top: '#0891b2', bottom: '#334155', hat: 'boina', hatColor: '#be123c', extra: 'mochila', extraColor: '#0f766e' }),
  M('m07', 'Marinheiro', { top: '#f8fafc', bottom: '#1e3a8a', hat: 'boina', hatColor: '#f8fafc', extra: 'lenco', extraColor: '#1d4ed8' }),
  M('m08', 'Pescador', { top: '#facc15', bottom: '#1e40af', hat: 'chapeu', hatColor: '#facc15', skin: '#e0ac69' }),
  M('m09', 'Jardineiro', { top: '#65a30d', bottom: '#713f12', extra: 'avental', extraColor: '#a16207', hat: 'chapeu', hatColor: '#d6b26e' }),
  M('m10', 'Astronauta', { top: '#e5e7eb', bottom: '#e5e7eb', hat: 'capacete', hatColor: '#f8fafc', shoes: '#9ca3af', extra: 'mochila', extraColor: '#9ca3af' }),
  M('m11', 'Chef', { top: '#ffffff', bottom: '#111827', hat: 'chef', hatColor: '#ffffff', extra: 'avental', extraColor: '#f1f5f9', skin: '#8d5524' }),
  M('m12', 'Piloto', { top: '#1e3a8a', bottom: '#1e3a8a', hat: 'bone', hatColor: '#1e3a8a', extra: 'oculos', extraColor: '#111827' }),
  M('m13', 'Arqueiro', { top: '#166534', bottom: '#3f3f46', hat: 'boina', hatColor: '#15803d', extra: 'capa', extraColor: '#14532d', hair: 'topete', hairColor: '#a16207' }),
  M('m14', 'Ciclista', { top: '#f97316', bottom: '#0f172a', hat: 'capacete', hatColor: '#f97316', extra: 'oculos', extraColor: '#0f172a', skin: '#c68642' }),
  M('m15', 'Pintor', { top: '#f5f5f4', bottom: '#2563eb', hat: 'boina', hatColor: '#dc2626', extra: 'avental', extraColor: '#fde68a', hair: 'cacheado' }),
  M('m16', 'Músico', { top: '#7c3aed', bottom: '#111827', hair: 'topete', hairColor: '#111827', skin: '#e0ac69' }),
  M('m17', 'Médico', { top: '#e0f2fe', bottom: '#0ea5e9', extra: 'avental', extraColor: '#ffffff', hair: 'raspado', skin: '#8d5524' }),
  M('m18', 'Cientista', { top: '#ffffff', bottom: '#475569', extra: 'oculos', extraColor: '#0f172a', hair: 'cacheado', hairColor: '#9ca3af' }),
  M('m19', 'Fazendeiro', { top: '#b91c1c', bottom: '#1d4ed8', hat: 'chapeu', hatColor: '#d6b26e', skin: '#e0ac69' }),
  M('m20', 'Esquiador', { top: '#06b6d4', bottom: '#0f172a', hat: 'faixa', hatColor: '#f43f5e', extra: 'oculos', extraColor: '#f97316', hair: 'curto', hairColor: '#facc15' }),

  F('f01', 'Desbravadora de gala', { top: '#c8a86b', bottom: '#1f3d2b', hat: 'chapeu', hatColor: '#8b6b3d', extra: 'lenco', extraColor: '#facc15', hair: 'coque' }),
  F('f02', 'Campista', { top: '#ea580c', bottom: '#a8875a', bottomType: 'calca', hat: 'bone', hatColor: '#166534', skin: '#c68642', hair: 'trancas' }),
  F('f03', 'Exploradora', { top: '#4d7c0f', bottom: '#78350f', extra: 'mochila', extraColor: '#b45309', hairColor: '#a16207' }),
  F('f04', 'Atleta azul', { top: '#2563eb', bottom: '#1e3a8a', bottomType: 'calca', hat: 'faixa', hatColor: '#f8fafc', skin: '#8d5524', hair: 'cacheado' }),
  F('f05', 'Atleta rosa', { top: '#db2777', bottom: '#111827', bottomType: 'calca', hair: 'rabo', hairColor: '#111827' }),
  F('f06', 'Montanhista', { top: '#0891b2', bottom: '#334155', bottomType: 'calca', hat: 'boina', hatColor: '#be123c', extra: 'mochila', extraColor: '#0f766e', hair: 'trancas', hairColor: '#7c2d12' }),
  F('f07', 'Marinheira', { top: '#f8fafc', bottom: '#1e3a8a', hat: 'boina', hatColor: '#f8fafc', extra: 'lenco', extraColor: '#1d4ed8', hair: 'longo' }),
  F('f08', 'Professora', { top: '#a855f7', bottom: '#1f2937', extra: 'oculos', extraColor: '#1f2937', hair: 'coque', skin: '#e0ac69' }),
  F('f09', 'Jardineira', { top: '#65a30d', bottom: '#713f12', extra: 'avental', extraColor: '#a16207', hat: 'chapeu', hatColor: '#d6b26e', hair: 'trancas', hairColor: '#facc15' }),
  F('f10', 'Astronauta', { top: '#e5e7eb', bottom: '#e5e7eb', bottomType: 'calca', hat: 'capacete', hatColor: '#f8fafc', shoes: '#9ca3af', extra: 'mochila', extraColor: '#9ca3af' }),
  F('f11', 'Chef', { top: '#ffffff', bottom: '#111827', hat: 'chef', hatColor: '#ffffff', extra: 'avental', extraColor: '#f1f5f9', skin: '#8d5524', hair: 'coque' }),
  F('f12', 'Piloto', { top: '#1e3a8a', bottom: '#1e3a8a', bottomType: 'calca', hat: 'bone', hatColor: '#1e3a8a', extra: 'oculos', extraColor: '#111827', hair: 'rabo', hairColor: '#7c2d12' }),
  F('f13', 'Arqueira', { top: '#166534', bottom: '#3f3f46', bottomType: 'calca', extra: 'capa', extraColor: '#14532d', hair: 'longo', hairColor: '#a16207' }),
  F('f14', 'Ciclista', { top: '#f97316', bottom: '#0f172a', bottomType: 'calca', hat: 'capacete', hatColor: '#f97316', skin: '#c68642', hair: 'rabo' }),
  F('f15', 'Pintora', { top: '#f5f5f4', bottom: '#2563eb', hat: 'boina', hatColor: '#dc2626', extra: 'avental', extraColor: '#fde68a', hair: 'longo', hairColor: '#111827' }),
  F('f16', 'Musicista', { top: '#7c3aed', bottom: '#111827', bottomType: 'vestido', hair: 'cacheado', hairColor: '#111827', skin: '#e0ac69' }),
  F('f17', 'Enfermeira', { top: '#e0f2fe', bottom: '#0ea5e9', extra: 'avental', extraColor: '#ffffff', hair: 'coque', skin: '#8d5524' }),
  F('f18', 'Cientista', { top: '#ffffff', bottom: '#475569', bottomType: 'calca', extra: 'oculos', extraColor: '#0f172a', hair: 'rabo', hairColor: '#ea580c' }),
  F('f19', 'Fazendeira', { top: '#b91c1c', bottom: '#1d4ed8', bottomType: 'vestido', hat: 'chapeu', hatColor: '#d6b26e', hair: 'trancas', skin: '#e0ac69' }),
  F('f20', 'Esquiadora', { top: '#06b6d4', bottom: '#0f172a', bottomType: 'calca', hat: 'faixa', hatColor: '#f43f5e', extra: 'oculos', extraColor: '#f97316', hair: 'longo', hairColor: '#facc15' }),
];

export const outfitById = (id) => OUTFITS.find((o) => o.id === id) || OUTFITS[0];
