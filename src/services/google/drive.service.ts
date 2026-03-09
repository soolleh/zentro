/**
 * drive.service.ts
 *
 * Thin wrapper around the Google Drive REST API v3.
 * All operations target the `appDataFolder` space — the most restrictive
 * scope available. Zentro can only see its own private folder.
 *
 * All methods return Promise<Result<T>>. No throws escape this module.
 *
 * Error handling:
 *  401 — token expired: caller should call getValidAccessToken and retry.
 *  403 — permission revoked: return GOOGLE_AUTH_EXPIRED.
 *  429 — rate limited: return DRIVE_RATE_LIMITED (do not retry).
 *  network failure: return DRIVE_NETWORK_ERROR (non-fatal).
 */

import type { Result } from '@/shared/types/common.types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DriveFile = {
  id: string;
  name: string;
  size: number;
  createdTime: string;
  modifiedTime: string;
  appProperties?: Record<string, string>;
};

export type UploadFileParams = {
  name: string;
  content: Blob;
  mimeType: string;
  accessToken: string;
  existingFileId?: string;
  appProperties?: Record<string, string>;
};

type DriveListResponse = {
  files: Array<{
    id: string;
    name: string;
    size: string;
    createdTime: string;
    modifiedTime: string;
    appProperties?: Record<string, string>;
  }>;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeError(code: string, message: string, cause?: unknown): Result<never> {
  return {
    success: false,
    error: {
      code,
      message,
      context: cause instanceof Error ? { cause: cause.message } : undefined,
    },
  };
}

function authHeader(accessToken: string): HeadersInit {
  return { Authorization: `Bearer ${accessToken}` };
}

async function handleResponseError(response: Response): Promise<Result<never>> {
  if (response.status === 401) {
    return makeError('GOOGLE_TOKEN_EXPIRED', 'Access token expired.');
  }
  if (response.status === 403) {
    return makeError('GOOGLE_AUTH_EXPIRED', 'Google Drive permission revoked.');
  }
  if (response.status === 429) {
    return makeError('DRIVE_RATE_LIMITED', 'Google Drive rate limit exceeded.');
  }
  const body = await response.text().catch(() => '');
  return makeError('DRIVE_API_ERROR', `Drive API error ${response.status.toString()}: ${body}`);
}

// ---------------------------------------------------------------------------
// Upload file (create or update)
// ---------------------------------------------------------------------------

export async function uploadFile(params: UploadFileParams): Promise<Result<DriveFile>> {
  const { name, content, mimeType, accessToken, existingFileId } = params;

  const { appProperties } = params;
  const isUpdate = Boolean(existingFileId);

  // Build multipart body
  const metaObj: Record<string, unknown> = isUpdate
    ? { name }
    : { name, parents: ['appDataFolder'] };
  if (appProperties && Object.keys(appProperties).length > 0) {
    metaObj.appProperties = appProperties;
  }
  const metadata = JSON.stringify(metaObj);

  const boundary = `zentro-boundary-${Date.now().toString()}`;
  const delimiter = `--${boundary}`;
  const closeDelimiter = `--${boundary}--`;

  const metaPart = `${delimiter}\r\nContent-Type: application/json\r\n\r\n${metadata}\r\n`;
  const filePart = `${delimiter}\r\nContent-Type: ${mimeType}\r\n\r\n`;
  const closeP = `\r\n${closeDelimiter}`;

  const encoder = new TextEncoder();
  const metaBytes = encoder.encode(metaPart);
  const filePartBytes = encoder.encode(filePart);
  const closeBytes = encoder.encode(closeP);
  const contentBytes = new Uint8Array(await content.arrayBuffer());

  const combined = new Uint8Array(
    metaBytes.length + filePartBytes.length + contentBytes.length + closeBytes.length
  );
  let offset = 0;
  combined.set(metaBytes, offset);
  offset += metaBytes.length;
  combined.set(filePartBytes, offset);
  offset += filePartBytes.length;
  combined.set(contentBytes, offset);
  offset += contentBytes.length;
  combined.set(closeBytes, offset);

  const url = isUpdate
    ? `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=multipart`
    : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';

  try {
    const response = await fetch(url, {
      method: isUpdate ? 'PATCH' : 'POST',
      headers: {
        ...authHeader(accessToken),
        'Content-Type': `multipart/related; boundary="${boundary}"`,
      },
      body: combined,
    });

    if (!response.ok) return handleResponseError(response);

    const file = (await response.json()) as {
      id: string;
      name: string;
      size: string;
      createdTime: string;
      modifiedTime: string;
      appProperties?: Record<string, string>;
    };

    return {
      success: true,
      data: {
        id: file.id,
        name: file.name,
        size: parseInt(file.size, 10) || 0,
        createdTime: file.createdTime,
        modifiedTime: file.modifiedTime,
        ...(file.appProperties ? { appProperties: file.appProperties } : {}),
      },
    };
  } catch (err) {
    return makeError('DRIVE_NETWORK_ERROR', 'Network error uploading to Drive.', err);
  }
}

// ---------------------------------------------------------------------------
// List files in appDataFolder
// ---------------------------------------------------------------------------

export async function listFiles(accessToken: string): Promise<Result<DriveFile[]>> {
  const params = new URLSearchParams({
    spaces: 'appDataFolder',
    fields: 'files(id,name,size,createdTime,modifiedTime,appProperties)',
    orderBy: 'createdTime desc',
    pageSize: '20',
  });

  try {
    const response = await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, {
      headers: authHeader(accessToken),
    });

    if (!response.ok) return handleResponseError(response);

    const data = (await response.json()) as DriveListResponse;
    const files: DriveFile[] = (data.files ?? []).map((f) => ({
      id: f.id,
      name: f.name,
      size: parseInt(String(f.size), 10) || 0,
      createdTime: f.createdTime,
      modifiedTime: f.modifiedTime,
      ...(f.appProperties ? { appProperties: f.appProperties } : {}),
    }));

    return { success: true, data: files };
  } catch (err) {
    return makeError('DRIVE_NETWORK_ERROR', 'Network error listing Drive files.', err);
  }
}

// ---------------------------------------------------------------------------
// Download file
// ---------------------------------------------------------------------------

export async function downloadFile(fileId: string, accessToken: string): Promise<Result<Blob>> {
  try {
    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
      headers: authHeader(accessToken),
    });

    if (!response.ok) return handleResponseError(response);

    const blob = await response.blob();
    return { success: true, data: blob };
  } catch (err) {
    return makeError('DRIVE_NETWORK_ERROR', 'Network error downloading Drive file.', err);
  }
}

// ---------------------------------------------------------------------------
// Delete file
// ---------------------------------------------------------------------------

export async function deleteFile(fileId: string, accessToken: string): Promise<Result<void>> {
  try {
    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
      method: 'DELETE',
      headers: authHeader(accessToken),
    });

    if (response.status === 204 || response.ok) {
      return { success: true, data: undefined };
    }
    return handleResponseError(response);
  } catch (err) {
    return makeError('DRIVE_NETWORK_ERROR', 'Network error deleting Drive file.', err);
  }
}

// ---------------------------------------------------------------------------
// Get user info
// ---------------------------------------------------------------------------

export async function getUserInfo(
  accessToken: string
): Promise<Result<{ email: string; name: string }>> {
  try {
    const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: authHeader(accessToken),
    });

    if (!response.ok) return handleResponseError(response);

    const data = (await response.json()) as { email?: string; name?: string };
    return {
      success: true,
      data: {
        email: data.email ?? '',
        name: data.name ?? '',
      },
    };
  } catch (err) {
    return makeError('DRIVE_NETWORK_ERROR', 'Network error fetching user info.', err);
  }
}
