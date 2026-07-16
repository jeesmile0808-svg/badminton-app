// สูตรคำนวณค่าใช้จ่าย ตามตารางคำนวณ Google Sheet ของกลุ่ม
// ค่าสนามรวม = อัตรา/ชม. * จำนวนชั่วโมง
// ค่าลูกรวม = ราคา/ลูก * จำนวนลูกที่ใช้
// แบ่งตามสัดส่วนจำนวนเกมส์ที่แต่ละคนเล่น เทียบกับผลรวมเกมส์ทั้งหมด
function computeTotals(config, players) {
  const totalCourtFee = Math.round((config.courtHourlyRate || 0) * (config.hours || 0));
  const totalShuttleFee = Math.round((config.shuttleUnitPrice || 0) * (config.shuttlesUsed || 0));
  const grandTotal = totalCourtFee + totalShuttleFee;

  const names = Object.keys(players);
  const totalGames = names.reduce((sum, n) => sum + (players[n].online ? (players[n].games || 0) : 0), 0);
  const playerCount = names.filter((n) => players[n].online).length;
  const totalMatches = totalGames > 0 ? +(totalGames / 4).toFixed(2) : 0;

  const perPlayer = {};
  names.forEach((name) => {
    const p = players[name];
    const games = p.online ? (p.games || 0) : 0;
    const courtFee = totalGames > 0 ? Math.ceil((totalCourtFee / totalGames) * games) : 0;
    const shuttleFee = totalGames > 0 ? Math.ceil((totalShuttleFee / totalGames) * games) : 0;
    perPlayer[name] = { games, courtFee, shuttleFee, total: courtFee + shuttleFee };
  });

  return {
    totalCourtFee,
    totalShuttleFee,
    grandTotal,
    totalGames,
    totalMatches,
    playerCount,
    perPlayer,
  };
}

module.exports = { computeTotals };
