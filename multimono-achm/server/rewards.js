'use strict';
// Récompenses du club : 8 couleurs de progression, attribuées à la main par le gérant.
// Les couleurs « doubles » (jaune-orange, orange-vert) s'affichent moitié-moitié, comme une ceinture.
const REWARDS = [
  { rank: 0, name: 'Blanc', colors: ['#F8FAFC'], ink: '#0B3954' },
  { rank: 1, name: 'Jaune', colors: ['#FACC15'], ink: '#422006' },
  { rank: 2, name: 'Jaune-orange', colors: ['#FACC15', '#F97316'], ink: '#431407' },
  { rank: 3, name: 'Orange', colors: ['#F97316'], ink: '#FFFFFF' },
  { rank: 4, name: 'Orange-vert', colors: ['#F97316', '#16A34A'], ink: '#FFFFFF' },
  { rank: 5, name: 'Vert', colors: ['#16A34A'], ink: '#FFFFFF' },
  { rank: 6, name: 'Bleu', colors: ['#2563EB'], ink: '#FFFFFF' },
  { rank: 7, name: 'Violet', colors: ['#7C3AED'], ink: '#FFFFFF' },
];

const MAX_RANK = REWARDS.length - 1;
const reward = (rank) => REWARDS[Math.min(Math.max(Number(rank) || 0, 0), MAX_RANK)];

/** Fond CSS (dégradé net moitié-moitié pour les couleurs doubles) */
const background = (r) => (r.colors.length === 1 ? r.colors[0]
  : `linear-gradient(90deg, ${r.colors[0]} 0 50%, ${r.colors[1]} 50% 100%)`);

module.exports = { REWARDS, MAX_RANK, reward, background };
