function buildAnalyticsSummary(stats = {}) {
  const totalUsers = Number(stats.users || 0);
  const totalListings = Number(stats.listings || 0);
  const totalPayments = Number(stats.payments || 0);
  const pendingListings = Number(stats.pendingListings || 0);
  const pendingPayments = Number(stats.pendingPayments || 0);
  const approvedListings = Number(stats.approvedListings || 0);
  const approvedPayments = Number(stats.approvedPayments || 0);
  const totalRevenue = Number(stats.revenue || 0);

  const approvalRate = totalListings + totalPayments
    ? ((approvedListings + approvedPayments) / (totalListings + totalPayments)) * 100
    : 0;

  return {
    totalUsers,
    totalListings,
    totalPayments,
    pendingListings,
    pendingPayments,
    approvedListings,
    approvedPayments,
    totalRevenue,
    approvalRate: Number(approvalRate.toFixed(2))
  };
}

module.exports = { buildAnalyticsSummary };
