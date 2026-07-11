/**
 * 构造带调试信息的错误响应。
 * - `error`: 面向用户的中文错误消息
 * - `debugError`: 底层错误详情（message + stack），便于线上排查
 *
 * 注意：debugError 会暴露内部错误细节，仅用于受信任的运维/调试场景。
 */
export function errorResponse(
  message: string,
  status: number,
  err?: unknown,
): Response {
  const payload: { error: string; debugError?: string } = { error: message };
  if (err !== undefined && err !== null) {
    payload.debugError = formatError(err);
  }
  return Response.json(payload, { status });
}

function formatError(err: unknown): string {
  if (err instanceof Error) {
    return err.stack ?? `${err.name}: ${err.message}`;
  }
  if (typeof err === 'string') return err;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

/** 500 服务器内部错误，附带底层异常详情。 */
export function serverError(err?: unknown): Response {
  return errorResponse('服务器内部错误', 500, err);
}

/** 400 请求参数错误，可附带底层异常详情。 */
export function badRequest(message: string, err?: unknown): Response {
  return errorResponse(message, 400, err);
}
