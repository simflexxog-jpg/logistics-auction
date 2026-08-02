function normalizeApprovalStatus(value, fallback = 'pending') {
  const normalized = (value || '').toString().trim().toLowerCase();
  if (['pending', 'approved', 'rejected'].includes(normalized)) {
    return normalized;
  }
  return fallback;
}

function getApprovalStatus(record = {}) {
  if (record.approvalStatus) {
    return normalizeApprovalStatus(record.approvalStatus);
  }
  if (record.isApproved === true) return 'approved';
  if (record.isApproved === false) return 'rejected';
  return 'pending';
}

function buildApprovalUpdate(action, adminUserId, reason) {
  const update = {
    reviewedBy: adminUserId,
    reviewedAt: new Date()
  };

  if (action === 'approve') {
    update.approvalStatus = 'approved';
    update.rejectionReason = null;
  } else if (action === 'reject') {
    update.approvalStatus = 'rejected';
    update.rejectionReason = reason || null;
  } else {
    update.approvalStatus = 'pending';
  }

  return update;
}

module.exports = { normalizeApprovalStatus, getApprovalStatus, buildApprovalUpdate };
