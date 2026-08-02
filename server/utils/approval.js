function buildApprovalUpdate(action, reviewerId, reason) {
  const normalized = (action || 'approve').toString().toLowerCase();
  const isApprove = normalized === 'approve';

  return {
    approvalStatus: isApprove ? 'approved' : 'rejected',
    reviewedBy: reviewerId || null,
    reviewedAt: new Date(),
    rejectionReason: isApprove ? null : reason || null,
  };
}

function getApprovalStatus(record) {
  const status = record?.approvalStatus || 'pending';
  if (status === 'approved') return 'approved';
  if (status === 'rejected') return 'rejected';
  return 'pending';
}

module.exports = {
  buildApprovalUpdate,
  getApprovalStatus,
};
