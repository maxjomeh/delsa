export function validHistoryConversation(job, conversation) {
  return typeof job?.account_id === 'string' &&
    conversation != null && typeof conversation === 'object' &&
    typeof conversation.id === 'string' &&
    conversation.id.length > 0 && conversation.id.length <= 180 &&
    conversation.id.trim() === conversation.id &&
    typeof conversation.participantId === 'string' &&
    conversation.participantId.trim().length > 0 &&
    conversation.participantId.length <= 200 &&
    (conversation.accountId == null || conversation.accountId === job.account_id);
}

export function historyNextCursor(pagination, previousCursor, prefix) {
  if (!pagination?.hasMore) return null;
  const next = pagination.nextCursor;
  if (typeof next !== 'string' || !next || next.length > 1024) {
    throw Object.assign(new Error(`${prefix}_MISSING`), {code: `${prefix}_MISSING`});
  }
  if (next === previousCursor) {
    throw Object.assign(new Error(`${prefix}_STALLED`), {code: `${prefix}_STALLED`});
  }
  return next;
}
