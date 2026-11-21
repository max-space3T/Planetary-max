export type Workspace = 'overview' | 'art' | 'chess' | 'sports' | 'games' | 'media' | 'architecture';
export interface Artwork { id: string; title: string; artist: string; medium: string; year: string; palette: string; category: 'Abstract' | 'Digital' | 'Mixed media'; }
export interface BetSelection { id: string; event: string; pick: string; odds: number; }
export interface TelemetryPoint { label: string; value: string; unit: string; }
