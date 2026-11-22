// ONE dispatch attempt for a claimed outbox item, and an honest classification of the provider's answer.
// Same pessimistic model as the human send route: no retries, ever. A timeout, a 5xx or an in-flight 409 is UNKNOWN,
// never "failed", and never sent again. Only a definite refusal (400/401/403/422/429) is 'rejected'.
// `request` is the Zernio client (injected so tests never touch the network).
export async function dispatchClaimed(request, claimed, outboxId) {
  let status = 'unknown', providerMessageId = null, errorCode = null;
  try {
    const result = await request('POST', '/v1/inbox/conversations/' + encodeURIComponent(claimed.conversation_id) + '/messages',
      {body: {accountId: claimed.account_id, message: claimed.body}, idempotencyKey: outboxId});
    const receipt = result?.data?.messageId || (
      Array.isArray(result?.data?.messageIds) && result.data.messageIds.length === 1 ? result.data.messageIds[0] : null);
    if (result?.success === true && typeof receipt === 'string' && receipt.length > 0 && receipt.length <= 255 && !result?.data?.partialFailure) {
      status = 'accepted'; providerMessageId = receipt;
    } else errorCode = 'unverified_provider_acknowledgment';
  } catch (e) {
    const code = Number(e?.status || 0);
    errorCode = (typeof e?.code === 'string' && e.code.length < 90 ? e.code : 'provider_request_error');
    status = [400, 401, 403, 422, 429].includes(code) ? 'rejected' : 'unknown';
  }
  return {status, providerMessageId, errorCode};
}
