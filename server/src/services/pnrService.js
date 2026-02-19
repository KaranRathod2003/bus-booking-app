const CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generatePNR() {
  let pnr = 'PNR';
  for (let i = 0; i < 6; i++) {
    pnr += CHARSET[Math.floor(Math.random() * CHARSET.length)];
  }
  return pnr;
}
